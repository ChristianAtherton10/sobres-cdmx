"""Google Places API (New), sólo para la Ciudad de México.

Candados (pedido del fundador, 4 nov 2026: "solo de CDMX, no quiero nada más"):
  1. Toda búsqueda va con locationRestriction al rectángulo de CDMX + zona
     metropolitana donde SOBRES tiene zonas (Satélite, Naucalpan, Huixquilucan).
  2. Los detalles sólo se piden para lugares del catálogo (su place_id está en
     data/google_ids.js) y se descartan si Google los ubica fuera del rectángulo.
  3. La llave vive en la variable GOOGLE_PLACES_KEY (Vercel) o en
     ~/.sobres/places_key (scripts locales); nunca en el repositorio.
Términos de Google: de forma permanente sólo se guarda el place_id; horario,
precio y calificación se piden en vivo y se muestran con "Datos de Google".
"""
import json, os, urllib.request, urllib.error

# Rectángulo CDMX + metropolitana (sur: Xochimilco/Tlalpan; norte: Satélite).
CDMX = {'low': {'latitude': 19.18, 'longitude': -99.37}, 'high': {'latitude': 19.60, 'longitude': -98.94}}

def en_cdmx(lat, lng):
    return CDMX['low']['latitude'] <= lat <= CDMX['high']['latitude'] and CDMX['low']['longitude'] <= lng <= CDMX['high']['longitude']

def llave():
    k = os.environ.get('GOOGLE_PLACES_KEY', '').strip()
    if not k:
        p = os.path.expanduser('~/.sobres/places_key')
        if os.path.exists(p):
            k = open(p).read().strip()
    return k

def _pide(url, campos, cuerpo=None, timeout=8):
    req = urllib.request.Request(url, data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
                                 method='POST' if cuerpo is not None else 'GET')
    req.add_header('X-Goog-Api-Key', llave())
    req.add_header('X-Goog-FieldMask', campos)
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {'error': e.code, 'detalle': e.read()[:300].decode('utf-8', 'replace')}

def buscar(texto, lat=None, lng=None, campos='places.id,places.displayName,places.location'):
    """Text Search (New) limitado a CDMX. Con lat/lng, prefiere lo cercano."""
    cuerpo = {'textQuery': texto, 'languageCode': 'es', 'regionCode': 'MX', 'pageSize': 5,
              'locationRestriction': {'rectangle': CDMX}}
    if lat is not None:
        # locationBias y locationRestriction no se combinan: se acota el
        # rectángulo a ~1.5 km alrededor del lugar, siempre dentro de CDMX.
        d = 0.014
        cuerpo['locationRestriction'] = {'rectangle': {
            'low': {'latitude': max(CDMX['low']['latitude'], lat - d), 'longitude': max(CDMX['low']['longitude'], lng - d)},
            'high': {'latitude': min(CDMX['high']['latitude'], lat + d), 'longitude': min(CDMX['high']['longitude'], lng + d)}}}
    r = _pide('https://places.googleapis.com/v1/places:searchText', campos, cuerpo)
    return r.get('places', []) if 'error' not in r else r

CAMPOS_DETALLE = ('id,location,businessStatus,currentOpeningHours.openNow,regularOpeningHours.periods,'
                  'regularOpeningHours.weekdayDescriptions,priceRange,priceLevel,rating,userRatingCount,googleMapsUri')

def detalle(place_id):
    if not place_id or not place_id.replace('_', '').replace('-', '').isalnum():
        return {'error': 400}
    r = _pide('https://places.googleapis.com/v1/places/' + place_id + '?languageCode=es&regionCode=MX', CAMPOS_DETALLE)
    loc = r.get('location') or {}
    if 'error' not in r and not en_cdmx(loc.get('latitude', 0), loc.get('longitude', 0)):
        return {'error': 'fuera de CDMX'}
    return r
