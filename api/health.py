# GET /api/health — comprueba que la base de datos está conectada.
import os, sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import sobres as S


class handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        s = S.read_state()
        S.reply(self, 200, {'ok': True, 'host': 'vercel', 'redis': S.REDIS_ON,
                            'users': len(s.get('users', {})), 'plans': len(s.get('plans', [])),
                            'rev': s.get('rev', 0)})
