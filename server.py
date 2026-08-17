#!/usr/bin/env python3
# Sobres CDMX — servidor del salón: sirve la página y sincroniza el estado social
# (usuarios, amigos, ratings, planes propuestos con votos, reservas) entre dispositivos.
# Corre: python3 server.py [puerto]   (default 4321)
import json, os, sys, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
STATE_PATH = os.environ.get('SOBRES_STATE') or os.path.join(ROOT, 'state.json')
LOCK = threading.Lock()

def blank_state():
    return {'users': {}, 'ratings': {}, 'plans': [], 'reservas': [], 'pubs': [], 'rev': 0, 'epoch': int(time.time())}

def load_state():
    try:
        with open(STATE_PATH) as f:
            s = json.load(f)
        for k, v in blank_state().items(): s.setdefault(k, v)
        return s
    except Exception:
        return blank_state()

STATE = load_state()

def save_state():
    tmp = STATE_PATH + '.tmp'
    with open(tmp, 'w') as f: json.dump(STATE, f, ensure_ascii=False)
    os.replace(tmp, STATE_PATH)

def find_plan(pid):
    for p in STATE['plans']:
        if p['id'] == pid: return p
    return None

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
        ratings.setdefault(vid, {})[u] = {'s': stars, 'txt': (p.get('txt') or '')[:280], 'ts': now, 'venueName': (p.get('venueName') or '')[:80]}
    elif op == 'unrate':
        u, vid = p.get('user'), p.get('venueId')
        if vid in ratings: ratings[vid].pop(u, None)
    elif op == 'proposePlan':
        pl = p.get('plan') or {}
        if not pl.get('id') or not pl.get('name'): return 'datos'
        if find_plan(pl['id']): return None  # ya propuesto: idempotente
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
        STATE['plans'] = STATE['plans'][-60:]
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
        STATE['reservas'].append({'user': str(p.get('user', 'Anónimo'))[:24], 'venueId': p.get('venueId'), 'venueName': str(p.get('venueName', ''))[:80], 'slot': str(p.get('slot', ''))[:20], 'people': p.get('people'), 'ts': now})
        STATE['reservas'] = STATE['reservas'][-200:]
    elif op == 'publish':
        pub = p.get('pub') or {}
        pub['id'] = pub.get('id') or ('pub-' + str(now))
        STATE['pubs'].append(pub); STATE['pubs'] = STATE['pubs'][-100:]
    elif op == 'reset':
        if p.get('pin') != 'sobres-reset': return 'pin'
        STATE.clear(); STATE.update(blank_state()); STATE['epoch'] = int(time.time())
    else:
        return 'op desconocida'
    STATE['rev'] += 1
    save_state()
    return None

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a): pass
    def end_headers(self):
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
        if self.path.startswith('/api/state'):
            u = None
            try:
                from urllib.parse import urlparse, parse_qs
                u = parse_qs(urlparse(self.path).query).get('u', [None])[0]
            except Exception:
                pass
            with LOCK:
                if u and u in STATE['users']: STATE['users'][u]['seen'] = int(time.time() * 1000)
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
    print(f'Sobres CDMX corriendo en http://localhost:{port}')
    ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
