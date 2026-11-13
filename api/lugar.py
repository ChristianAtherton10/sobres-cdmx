# GET /api/lugar?ids=<id SOBRES>,<id SOBRES> — horario, precio y estado de
# Google Places EN VIVO para lugares del catálogo (máximo 8 por llamada).
# Sólo acepta ids del catálogo que tengan place_id en data/google_ids.js, y
# sólo responde lugares dentro de CDMX (lib/places.py). Nada se guarda.
import json, os, sys, re
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from concurrent.futures import ThreadPoolExecutor

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'lib'))
import places as P

_GID = None
def gid():
    global _GID
    if _GID is None:
        try:
            t = open(os.path.join(AQUI, '..', 'data', 'google_ids.js')).read()
            _GID = json.loads(t[t.index('{'):t.rindex('}') + 1]).get('ids', {})
        except Exception:
            _GID = {}
    return _GID

def resumen(d):
    pr = d.get('priceRange') or {}
    lo = (pr.get('startPrice') or {}).get('units'); hi = (pr.get('endPrice') or {}).get('units')
    return {'estado': d.get('businessStatus', ''), 'abiertoAhora': (d.get('currentOpeningHours') or {}).get('openNow'),
            'periodos': (d.get('regularOpeningHours') or {}).get('periods', []),
            'horario': (d.get('regularOpeningHours') or {}).get('weekdayDescriptions', []),
            'precio': [int(lo) if lo else None, int(hi) if hi else None] if (lo or hi) else None,
            'nivel': d.get('priceLevel', ''), 'rating': d.get('rating'), 'resenas': d.get('userRatingCount'),
            'maps': d.get('googleMapsUri', '')}

class handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def responde(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        if not P.llave():
            return self.responde(503, {'error': 'sin llave'})
        ids = [x for x in (parse_qs(urlparse(self.path).query).get('ids', [''])[0]).split(',') if re.match(r'^[\w-]{3,80}$', x)][:8]
        G = gid(); out = {}
        # 'gp-<place_id>' = lugar que SOBRES encontró en vivo en Google (viene en un enlace compartido): se pide
        # con nombre y ubicación para reconstruirlo. Igual sólo responde si está dentro de CDMX.
        # Las consultas van en paralelo (13 nov 2026): la app espera esta respuesta antes de mostrar la tanda.
        def uno(i):
            vivo = i.startswith('gp-')
            pid = i[3:] if vivo else G.get(i)
            if not pid:
                return None                   # no es del catálogo: no se consulta
            try:
                d = P.detalle(pid, extra=vivo)
            except Exception:
                return None               # red o tiempo agotado: ese lugar se queda sin dato en vivo
            if 'error' in d:
                return None
            o = resumen(d)
            if vivo:
                loc = d.get('location') or {}
                o.update({'pid': pid, 'n': (d.get('displayName') or {}).get('text', ''), 'lat': loc.get('latitude'), 'lng': loc.get('longitude'),
                          'tipo': d.get('primaryType', ''), 'types': d.get('types', [])[:8], 'addr': d.get('formattedAddress', '')})
            return o
        if ids:
            with ThreadPoolExecutor(max_workers=8) as ex:
                for i, o in zip(ids, ex.map(uno, ids)):
                    if o is not None:
                        out[i] = o
        self.responde(200, {'fuente': 'Datos de Google Maps', 'lugares': out})
