# GET /api/buscar?tipo=restaurante&cocina=japonesa&zonas=roma,condesa
# Lugares de Google Places EN VIVO para que el motor de SOBRES arme planes con
# más opciones. Sólo CDMX (rectángulo de las zonas elegidas, recortado a CDMX),
# sólo tipos y cocinas de una lista fija (nada de texto libre: la llave no
# sirve para buscar otra cosa) y nada se guarda.
import json, os, re, sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'lib'))
import places as P

ZONAS = {'roma': (19.419, -99.16), 'romasur': (19.404, -99.157), 'condesa': (19.411, -99.174), 'polanco': (19.433, -99.195),
         'juarez': (19.427, -99.157), 'centro': (19.434, -99.137), 'chapultepec': (19.417, -99.186), 'coyoacan': (19.35, -99.162),
         'sanangel': (19.346, -99.187), 'delvalle': (19.386, -99.167), 'cu': (19.322, -99.185), 'santafe': (19.366, -99.26),
         'xochimilco': (19.2735, -99.1035), 'lomas': (19.4235, -99.2265), 'satelite': (19.508, -99.236)}
TIPOS = {'restaurante': ('restaurante', {'restaurant'}), 'bar': ('bar', {'bar', 'pub', 'wine_bar', 'cocktail_bar'}),
         'cafe': ('café', {'cafe', 'coffee_shop', 'bakery'}), 'antro': ('antro para bailar', {'night_club'}),
         'postre': ('postres helados', {'ice_cream_shop', 'dessert_shop', 'bakery', 'cafe'})}
COCINAS = {'mexicana': 'restaurante mexicano', 'tacos': 'taquería', 'mariscos': 'mariscos', 'japonesa': 'restaurante japonés sushi',
           'asiatica': 'restaurante asiático', 'italiana': 'restaurante italiano', 'cortes': 'restaurante de cortes', 'francesa': 'restaurante francés',
           'mediterranea': 'restaurante español mediterráneo', 'latina': 'restaurante peruano', 'hamburguesas': 'hamburguesas',
           'vegetariana': 'restaurante vegetariano', 'internacional': 'restaurante de autor'}
CAMPOS = ('places.id,places.displayName,places.location,places.primaryType,places.types,places.priceRange,places.rating,'
          'places.userRatingCount,places.regularOpeningHours.periods,places.regularOpeningHours.weekdayDescriptions,'
          'places.businessStatus,places.formattedAddress,places.googleMapsUri')

def rectangulo(zs):
    if not zs:
        return P.CDMX
    la = [ZONAS[z][0] for z in zs]; ln = [ZONAS[z][1] for z in zs]; d = 0.02
    c = P.CDMX
    return {'low': {'latitude': max(c['low']['latitude'], min(la) - d), 'longitude': max(c['low']['longitude'], min(ln) - d)},
            'high': {'latitude': min(c['high']['latitude'], max(la) + d), 'longitude': min(c['high']['longitude'], max(ln) + d)}}

def compacto(p):
    pr = p.get('priceRange') or {}
    lo = (pr.get('startPrice') or {}).get('units'); hi = (pr.get('endPrice') or {}).get('units')
    loc = p.get('location') or {}; oh = p.get('regularOpeningHours') or {}
    return {'pid': p['id'], 'n': (p.get('displayName') or {}).get('text', ''), 'lat': loc.get('latitude'), 'lng': loc.get('longitude'),
            'tipo': p.get('primaryType', ''), 'types': p.get('types', [])[:8], 'precio': [int(lo) if lo else None, int(hi) if hi else None] if (lo or hi) else None,
            'rating': p.get('rating'), 'resenas': p.get('userRatingCount'), 'periodos': oh.get('periods', []),
            'horario': oh.get('weekdayDescriptions', []), 'addr': p.get('formattedAddress', ''), 'maps': p.get('googleMapsUri', '')}

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
        q = parse_qs(urlparse(self.path).query)
        tipo = q.get('tipo', [''])[0]; cocina = q.get('cocina', [''])[0]
        zs = [z for z in q.get('zonas', [''])[0].split(',') if z in ZONAS][:4]
        if tipo not in TIPOS or (cocina and (cocina not in COCINAS or tipo != 'restaurante')):
            return self.responde(400, {'error': 'tipo o cocina no válidos'})
        texto, tipos_ok = TIPOS[tipo]
        if cocina:
            texto = COCINAS[cocina]
        r = P._pide('https://places.googleapis.com/v1/places:searchText', CAMPOS,
                    {'textQuery': texto, 'languageCode': 'es', 'regionCode': 'MX', 'pageSize': 20,
                     'locationRestriction': {'rectangle': rectangulo(zs)}})
        if 'error' in r:
            return self.responde(502, {'error': 'google', 'codigo': r.get('error')})
        out = []
        for p in r.get('places', []):
            loc = p.get('location') or {}
            if p.get('businessStatus', 'OPERATIONAL') != 'OPERATIONAL': continue
            if not P.en_cdmx(loc.get('latitude', 0), loc.get('longitude', 0)): continue
            if (p.get('rating') or 0) < 4.3 or (p.get('userRatingCount') or 0) < 100: continue   # relevantes, no random
            if not (tipos_ok & set(p.get('types', []))): continue
            out.append(compacto(p))
        self.responde(200, {'fuente': 'Datos de Google Maps', 'lugares': out})
