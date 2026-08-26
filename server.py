#!/usr/bin/env python3
# Sobres CDMX — servidor: sirve la página y sincroniza el estado social entre dispositivos.
#
# PERSISTENCIA:
#   - Por defecto guarda en state.json (disco local).
#   - En Render el disco es efímero: si defines las variables de entorno
#     UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN, el estado se guarda
#     además en Upstash Redis y sobrevive reinicios, redespliegues y "spin down".
#
# Corre local: python3 server.py [puerto]   (default 4321)
import json, os, sys, time, threading, signal, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
STATE_PATH = os.environ.get('SOBRES_STATE') or os.path.join(ROOT, 'state.json')
LOCK = threading.RLock()

REDIS_URL = (os.environ.get('UPSTASH_REDIS_REST_URL') or '').rstrip('/')
REDIS_TOKEN = os.environ.get('UPSTASH_REDIS_REST_TOKEN') or ''
REDIS_KEY = os.environ.get('SOBRES_REDIS_KEY') or 'sobres_state_v1'
REDIS_ON = bool(REDIS_URL and REDIS_TOKEN)

SAVE_EVERY = 8.0          # segundos entre escrituras remotas (protege la cuota gratis)
_dirty = threading.Event()


def blank_state():
    return {'users': {}, 'ratings': {}, 'plans': [], 'reservas': [], 'pubs': [],
            'venues': [], 'stats': {}, 'rev': 0, 'epoch': int(time.time())}


# ───────────────────────── almacenamiento remoto (Upstash REST) ─────────────────────────
def redis_get():
    if not REDIS_ON: return None
    try:
        req = urllib.request.Request(f'{REDIS_URL}/get/{REDIS_KEY}',
                                     headers={'Authorization': f'Bearer {REDIS_TOKEN}'})
        res = json.load(urllib.request.urlopen(req, timeout=15)).get('result')
        return json.loads(res) if res else None
    except Exception as e:
        print('[redis] lectura falló:', e, flush=True)
        return None


def redis_set(obj):
    if not REDIS_ON: return False
    try:
        body = json.dumps(obj, ensure_ascii=False).encode()
        req = urllib.request.Request(f'{REDIS_URL}/set/{REDIS_KEY}', data=body, method='POST',
                                     headers={'Authorization': f'Bearer {REDIS_TOKEN}',
                                              'Content-Type': 'application/octet-stream'})
        urllib.request.urlopen(req, timeout=20).read()
        return True
    except Exception as e:
        print('[redis] escritura falló:', e, flush=True)
        return False


def load_state():
    remote = redis_get()
    if remote:
        for k, v in blank_state().items(): remote.setdefault(k, v)
        print(f"[estado] recuperado de Redis: {len(remote.get('users', {}))} usuarios, "
              f"{len(remote.get('plans', []))} planes", flush=True)
        return remote
    try:
        with open(STATE_PATH) as f:
            s = json.load(f)
        for k, v in blank_state().items(): s.setdefault(k, v)
        print('[estado] recuperado de state.json', flush=True)
        return s
    except Exception:
        print('[estado] arrancando en blanco', flush=True)
        return blank_state()


STATE = load_state()


def save_local():
    try:
        tmp = STATE_PATH + '.tmp'
        with open(tmp, 'w') as f: json.dump(STATE, f, ensure_ascii=False)
        os.replace(tmp, STATE_PATH)
    except Exception:
        pass


def flush_remote():
    if not REDIS_ON: return
    with LOCK:
        snap = json.loads(json.dumps(STATE))
    redis_set(snap)


def _writer_loop():
    while True:
        _dirty.wait()
        time.sleep(SAVE_EVERY)
        _dirty.clear()
        flush_remote()


def save_state():
    save_local()
    _dirty.set()


def _bye(*a):
    print('[estado] guardando antes de apagar…', flush=True)
    save_local(); flush_remote()
    sys.exit(0)


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
    return None


# ───────────────────────── HTTP ─────────────────────────
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a): pass

    def end_headers(self):
        if self.path.startswith('/data/') or self.path.endswith('.js') or self.path.endswith('.css'):
            self.send_header('Cache-Control', 'public, max-age=3600')
        else:
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        if self.path.startswith('/api/health'):
            return self._json(200, {'ok': True, 'redis': REDIS_ON,
                                    'users': len(STATE['users']), 'plans': len(STATE['plans'])})
        if self.path.startswith('/api/state'):
            u = None
            try:
                from urllib.parse import urlparse, parse_qs
                u = parse_qs(urlparse(self.path).query).get('u', [None])[0]
            except Exception:
                pass
            with LOCK:
                if u and u in STATE['users']:
                    STATE['users'][u]['seen'] = int(time.time() * 1000)
                return self._json(200, STATE)
        if self.path == '/' or self.path.startswith('/?'):
            self.path = '/Sobres%20CDMX.dc.html'
        return super().do_GET()

    def do_POST(self):
        if self.path != '/api/mutate': return self._json(404, {'error': 'no'})
        try:
            n = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return self._json(400, {'error': 'json inválido'})
        with LOCK:
            err = apply_op(body.get('op'), body.get('payload') or {})
            if err: return self._json(400, {'error': err})
            return self._json(200, STATE)


if __name__ == '__main__':
    port = int(os.environ.get('PORT') or (sys.argv[1] if len(sys.argv) > 1 else 4321))
    if REDIS_ON:
        threading.Thread(target=_writer_loop, daemon=True).start()
        print('[estado] persistencia remota ACTIVA (Upstash Redis)', flush=True)
    else:
        print('[estado] persistencia remota apagada — solo state.json (se pierde al reiniciar en Render)', flush=True)
    for sig in (signal.SIGTERM, signal.SIGINT):
        try: signal.signal(sig, _bye)
        except Exception: pass
    print(f'Sobres CDMX corriendo en http://localhost:{port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
