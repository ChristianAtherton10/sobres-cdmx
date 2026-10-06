# GET /api/state — estado social completo (usuarios, amigos, planes, reseñas…).
import os, sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import sobres as S


class handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        # Nota: aquí NO escribimos nada. En Render marcábamos 'seen' del usuario en
        # cada poll porque era gratis (memoria); en Vercel cada escritura cuesta
        # una operación de Redis y el frontend no usa ese campo.
        S.reply(self, 200, S.read_state())
