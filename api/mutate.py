# POST /api/mutate — aplica un cambio (unirse, amigo, calificar, votar, publicar…).
import json, os, sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import sobres as S


class handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return S.reply(self, 400, {'error': 'json inválido'})
        if not S.REDIS_ON:
            return S.reply(self, 503, {'error': 'falta conectar la base de datos (Upstash)'})
        err, st = S.mutate(body.get('op'), body.get('payload') or {})
        if err:
            return S.reply(self, 400, {'error': err})
        return S.reply(self, 200, st)
