# Sobres CDMX — lógica compartida de las funciones serverless de Vercel.
#
# DIFERENCIA CLAVE CON server.py (Render):
#   En Render el servidor vivía siempre prendido y guardaba el estado en memoria,
#   escribiendo a Redis cada 8 s. En Vercel cada petición puede caer en una
#   instancia nueva y sin memoria, así que:
#     · /api/state  lee el estado (con caché corta en memoria para no gastar cuota)
#     · /api/mutate lee → aplica → escribe en Redis DENTRO de la misma petición,
#       protegido por un candado para que dos votos simultáneos no se pisen.
#   Por eso en Vercel la base de datos (Upstash Redis) es OBLIGATORIA:
#   sin ella no hay dónde guardar nada entre peticiones.
import json, os, time, random, threading, urllib.request


def _env(*names):
    for n in names:
        v = os.environ.get(n)
        if v and v.strip():
            return v.strip()
    return ''


# Acepta los nombres de Upstash directo y los que inyecta la integración de Vercel.
REDIS_URL = _env('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL', 'REDIS_REST_URL').rstrip('/')
REDIS_TOKEN = _env('UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN', 'REDIS_REST_TOKEN')
REDIS_KEY = _env('SOBRES_REDIS_KEY') or 'sobres_state_v1'
LOCK_KEY = REDIS_KEY + '_lock'
REDIS_ON = bool(REDIS_URL and REDIS_TOKEN)

CACHE_TTL = float(_env('SOBRES_CACHE_TTL') or 2.5)   # segundos que reusamos el estado leído
_MX = threading.Lock()
_CACHE = {'state': None, 'at': 0.0}


def blank_state():
    return {'users': {}, 'ratings': {}, 'plans': [], 'reservas': [], 'pubs': [],
            'venues': [], 'stats': {}, 'rev': 0, 'epoch': int(time.time())}


# ───────────────────────── Upstash Redis por REST ─────────────────────────
def _cmd(*args, **kw):
    """Manda un comando de Redis. Formato de arreglo: ['SET','clave','valor',...]."""
    timeout = kw.get('timeout', 10)
    body = json.dumps([str(a) for a in args], ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(REDIS_URL, data=body, method='POST',
                                 headers={'Authorization': 'Bearer ' + REDIS_TOKEN,
                                          'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=timeout)).get('result')


def _fill(s):
    for k, v in blank_state().items():
        s.setdefault(k, v)
    return s


def read_state(force=False):
    """Estado actual. Usa caché en memoria para no gastar cuota en cada poll."""
    if not REDIS_ON:
        if _CACHE['state'] is None:
            _CACHE['state'] = blank_state()
        return _CACHE['state']
    now = time.time()
    if not force and _CACHE['state'] is not None and (now - _CACHE['at']) < CACHE_TTL:
        return _CACHE['state']
    try:
        raw = _cmd('GET', REDIS_KEY)
        s = _fill(json.loads(raw)) if raw else blank_state()
    except Exception as e:
        print('[redis] lectura falló:', e, flush=True)
        if _CACHE['state'] is not None:
            return _CACHE['state']          # mejor servir algo viejo que fallar
        s = blank_state()
    _CACHE['state'] = s
    _CACHE['at'] = time.time()
    return s


def write_state(s):
    _CACHE['state'] = s
    _CACHE['at'] = time.time()
    if not REDIS_ON:
        return False
    try:
        _cmd('SET', REDIS_KEY, json.dumps(s, ensure_ascii=False), timeout=15)
        return True
    except Exception as e:
        print('[redis] escritura falló:', e, flush=True)
        return False


def _acquire(tries=25, wait=0.08):
    """Candado corto para que dos cambios simultáneos no se pisen."""
    if not REDIS_ON:
        return True
    tok = '%x' % random.getrandbits(64)
    for _ in range(tries):
        try:
            if _cmd('SET', LOCK_KEY, tok, 'NX', 'PX', 5000, timeout=6) is not None:
                return tok
        except Exception:
            return True          # si Redis se queja, seguimos sin candado
        time.sleep(wait)
    return True                  # se acabó la espera: seguimos (no dejamos caer la app)


def _release(tok):
    if REDIS_ON and tok is not True:
        try:
            _cmd('DEL', LOCK_KEY, timeout=6)
        except Exception:
            pass


STATE = blank_state()


def save_state():
    """En Vercel la escritura la hace mutate(); aquí no hay nada que hacer."""
    return None


# ───────────────────────── helpers ─────────────────────────
def find_plan(pid):
    for p in STATE['plans']:
        if p['id'] == pid: return p
    return None


def today():
    return time.strftime('%Y-%m-%d')


def bump(vid, kind, who=None, zone=None):
    """Registra una métrica real de un lugar."""
    if not vid or kind not in ('v', 's', 'r', 'a'): return
    st = STATE['stats'].setdefault(str(vid)[:64], {'v': 0, 's': 0, 'r': 0, 'a': 0, 'd': {}, 'who': {}, 'zone': {}})
    st[kind] = st.get(kind, 0) + 1
    d = st['d'].setdefault(today(), {'v': 0, 's': 0, 'r': 0, 'a': 0})
    d[kind] = d.get(kind, 0) + 1
    if len(st['d']) > 30:
        for k in sorted(st['d'])[:-30]: st['d'].pop(k, None)
    if kind in ('v', 'r'):
        if who: st['who'][str(who)[:16]] = st['who'].get(str(who)[:16], 0) + 1
        if zone: st['zone'][str(zone)[:20]] = st['zone'].get(str(zone)[:20], 0) + 1


def apply_op(op, p):
    now = int(time.time() * 1000)
    users, ratings = STATE['users'], STATE['ratings']
    if op == 'join':
        n = (p.get('name') or '').strip()[:24]
        if not n: return 'nombre vacío'
        users.setdefault(n, {'friends': [], 'joined': now})
    elif op == 'friend':
        u, fr, on = p.get('user'), p.get('friend'), bool(p.get('on', True))
        if not u or not fr or u == fr: return 'datos'
        users.setdefault(u, {'friends': [], 'joined': now})
        fl = users[u].setdefault('friends', [])
        if on and fr not in fl: fl.append(fr)
        if not on and fr in fl: fl.remove(fr)
    elif op == 'rate':
        u, vid, stars = p.get('user'), p.get('venueId'), p.get('stars')
        if not u or not vid or not isinstance(stars, (int, float)): return 'datos'
        stars = max(1, min(5, int(stars)))
        ratings.setdefault(vid, {})[u] = {'s': stars, 'txt': (p.get('txt') or '')[:280], 'ts': now,
                                          'venueName': (p.get('venueName') or '')[:80]}
    elif op == 'unrate':
        u, vid = p.get('user'), p.get('venueId')
        if vid in ratings: ratings[vid].pop(u, None)
    elif op == 'proposePlan':
        pl = p.get('plan') or {}
        if not pl.get('id') or not pl.get('name'): return 'datos'
        if find_plan(pl['id']): return None
        by = str(p.get('user', 'alguien'))[:24]
        STATE['plans'].append({
            'id': str(pl['id'])[:120], 'name': str(pl['name'])[:140], 'meta': str(pl.get('meta', ''))[:160],
            'by': by, 'ts': now,
            'stops': [str(x)[:64] for x in (pl.get('stops') or [])[:8]],
            'times': [t for t in (pl.get('times') or [])[:8] if isinstance(t, (int, float))],
            'from': pl.get('from') if isinstance(pl.get('from'), (int, float)) else None,
            'to': pl.get('to') if isinstance(pl.get('to'), (int, float)) else None,
            'spent': pl.get('spent') if isinstance(pl.get('spent'), (int, float)) else None,
            'date': str(pl.get('date') or '')[:10],
            'transport': str(pl.get('transport') or '')[:20],
            # Contexto del EMISOR. Sin esto el receptor rellenaba con sus propios
            # valores por defecto: 5 personas llegaban como 4, un tope de $1,500
            # se leía como ≤ $600 y UberXL se volvía UberX. El defecto no estaba
            # en el frontend: el servidor nunca guardaba estos campos.
            'people': int(pl['people']) if isinstance(pl.get('people'), (int, float)) else 0,
            'who': str(pl.get('who') or '')[:16],
            'zone': str(pl.get('zone') or '')[:24],
            'zonesSel': [str(z)[:24] for z in (pl.get('zonesSel') or [])[:12]],
            'vibes': [str(v3)[:20] for v3 in (pl.get('vibes') or [])[:3]],
            'budget': str(pl.get('budget') or '')[:12],
            'budgetCustom': int(pl['budgetCustom']) if isinstance(pl.get('budgetCustom'), (int, float)) else None,
            # Componentes de costo tal como los calculó el emisor, etiquetados.
            'costo': {k2: (v4 if isinstance(v4, (int, float, bool)) else [str(x)[:80] for x in v4][:6])
                      for k2, v4 in list((pl.get('costo') or {}).items())[:8]
                      if isinstance(v4, (int, float, bool, list))},
            'ext': {str(k)[:64]: str(v2)[:80] for k, v2 in list((pl.get('ext') or {}).items())[:8] if str(k).startswith('ext-')},
            'votes': {by: 'sobres'}, 'stopVotes': {}})
        STATE['plans'] = STATE['plans'][-80:]
        for sid in (pl.get('stops') or [])[:8]: bump(sid, 'a')
    elif op == 'votePlan':
        u, pid, kind = p.get('user'), p.get('planId'), p.get('kind')
        pl = find_plan(pid)
        if not u or not pl: return 'datos'
        if kind in ('sobres', 'nojalo'): pl.setdefault('votes', {})[u] = kind
        else: pl.setdefault('votes', {}).pop(u, None)
    elif op == 'voteStop':
        u, pid, vid, kind = p.get('user'), p.get('planId'), p.get('venueId'), p.get('kind')
        pl = find_plan(pid)
        if not u or not pl or not vid: return 'datos'
        d = pl.setdefault('stopVotes', {}).setdefault(vid, {})
        if kind in ('up', 'down'): d[u] = kind
        else: d.pop(u, None)
    elif op == 'sharePlan':
        u, pid = p.get('user'), p.get('planId')
        pl = find_plan(pid)
        if not u or not pl: return 'datos'
        swl = pl.setdefault('sharedWith', [])
        for t in (p.get('to') or [])[:40]:
            t = str(t)[:24]
            if t and t not in swl: swl.append(t)
    elif op == 'setTransport':
        pl = find_plan(p.get('planId'))
        if not pl: return 'datos'
        pl['transport'] = str(p.get('mode') or '')[:20]
    elif op == 'delPlan':
        STATE['plans'] = [x for x in STATE['plans'] if x['id'] != p.get('planId')]
    elif op == 'reserve':
        STATE['reservas'].append({'user': str(p.get('user', 'Anónimo'))[:24], 'venueId': p.get('venueId'),
                                  'venueName': str(p.get('venueName', ''))[:80],
                                  'slot': str(p.get('slot', ''))[:20], 'people': p.get('people'), 'ts': now})
        STATE['reservas'] = STATE['reservas'][-300:]
        bump(p.get('venueId'), 'r', p.get('who'), p.get('zone'))
    elif op == 'track':
        # métricas reales: [{id, k}] con k en v(ista) s(ave) r(eserva) a(parición)
        for ev in (p.get('events') or [])[:60]:
            bump(ev.get('id'), ev.get('k'), p.get('who'), p.get('zone'))
    elif op == 'publishVenue':
        v = p.get('venue') or {}
        name = str(v.get('n') or '').strip()[:80]
        if not name: return 'nombre vacío'
        vid = str(v.get('id') or ('venue-' + str(now)))[:64]
        rec = {
            'id': vid, 'n': name, 'cat': str(v.get('cat') or 'Restaurante')[:30],
            'zone': str(v.get('zone') or 'roma')[:20], 'col': str(v.get('col') or '')[:60],
            'addr': str(v.get('addr') or '')[:120], 'web': str(v.get('web') or '')[:200],
            'pp': int(v.get('pp') or 0), 'oh0': float(v.get('oh0') or 12), 'oh1': float(v.get('oh1') or 23),
            'hrs': str(v.get('hrs') or '')[:60], 'desc': str(v.get('desc') or '')[:400],
            'tags': [str(t)[:20] for t in (v.get('tags') or [])[:4]],
            'who': [str(t)[:12] for t in (v.get('who') or [])[:5]],
            'tm': [str(t)[:10] for t in (v.get('tm') or [])[:4]],
            'lat': v.get('lat'), 'lng': v.get('lng'),
            'date': str(v.get('date') or '')[:10], 'hora': str(v.get('hora') or '')[:20],
            'kind': 'evento' if v.get('kind') == 'evento' else 'lugar',
            'by': str(p.get('user') or 'venue')[:24], 'ts': now,
        }
        STATE['venues'] = [x for x in STATE['venues'] if x['id'] != vid] + [rec]
        STATE['venues'] = STATE['venues'][-200:]
    elif op == 'delVenue':
        STATE['venues'] = [x for x in STATE['venues'] if x['id'] != p.get('venueId')]
    elif op == 'publish':
        pub = p.get('pub') or {}
        pub['id'] = pub.get('id') or ('pub-' + str(now))
        STATE['pubs'].append(pub); STATE['pubs'] = STATE['pubs'][-100:]
    elif op == 'reset':
        if p.get('pin') != 'sobres-reset': return 'pin'
        keep = p.get('keepVenues') and STATE.get('venues') or []
        STATE.clear(); STATE.update(blank_state())
        STATE['venues'] = keep
        STATE['epoch'] = int(time.time())
    else:
        return 'op desconocida'
    STATE['rev'] += 1
    save_state()


# ───────────────────────── API usada por las funciones ─────────────────────────
def mutate(op, payload):
    """Lee → aplica la operación → escribe, de forma atómica. Devuelve (error, estado)."""
    global STATE
    with _MX:
        tok = _acquire()
        try:
            STATE = read_state(force=True)
            err = apply_op(op, payload)
            if err:
                return err, STATE
            write_state(STATE)
            return None, STATE
        finally:
            _release(tok)


def reply(h, code, obj):
    """Contesta JSON desde un BaseHTTPRequestHandler de Vercel."""
    b = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    h.send_response(code)
    h.send_header('Content-Type', 'application/json; charset=utf-8')
    h.send_header('Cache-Control', 'no-store')
    h.send_header('Content-Length', str(len(b)))
    h.end_headers()
    h.wfile.write(b)


def query_param(path, name):
    try:
        from urllib.parse import urlparse, parse_qs
        return parse_qs(urlparse(path).query).get(name, [None])[0]
    except Exception:
        return None
