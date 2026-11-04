#!/usr/bin/env python3
"""Candidatos de OpenStreetMap para las zonas con menos oferta (Fase 4, 4 nov 2026).

Lee reportes/osm/<zona>.json (respuestas de Overpass) y propone lugares que NO
están en el catálogo. No se mezcla nada: produce
  - reportes/osm/candidatos_osm.json   (fichas listas para mezclar si se aprueban)
  - reportes/osm/REPORTE_OSM.md        (tabla por zona para revisar)
Con --mezclar escribe data/osm.js (sólo después de que el fundador apruebe).

Reglas:
  - Fuente = la ficha de OSM (URL) y su fecha = última edición del elemento.
  - Sin precio en OSM → precio "por confirmar". Horario: se lee opening_hours
    sólo si es simple; si no, "por confirmar".
  - Cadenas de comida rápida y café (marca de OSM o nombre conocido) fuera,
    salvo cines, boliches y centros comerciales, que sí son salida.
  - Edición anterior a 2023 → sólo Explorar hasta reverificar.
  - Repetido = mismo nombre normalizado a menos de 300 m de algo del catálogo.
"""
import json, math, os, re, sys, unicodedata, collections

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(AQUI))
HOY = '2026-11-04'
ZONAS = {'roma': (19.419, -99.16), 'romasur': (19.404, -99.157), 'condesa': (19.411, -99.174), 'polanco': (19.433, -99.195),
 'juarez': (19.427, -99.157), 'centro': (19.434, -99.137), 'chapultepec': (19.417, -99.186), 'coyoacan': (19.35, -99.162),
 'sanangel': (19.346, -99.187), 'delvalle': (19.386, -99.167), 'cu': (19.322, -99.185), 'santafe': (19.366, -99.26),
 'xochimilco': (19.2735, -99.1035), 'lomas': (19.4235, -99.2265), 'satelite': (19.508, -99.236)}
ZL = {'santafe': 'Santa Fe · Poniente', 'satelite': 'Satélite · Naucalpan', 'lomas': 'Lomas · Tecamachalco', 'xochimilco': 'Xochimilco',
      'romasur': 'Roma Sur', 'delvalle': 'Del Valle · Nápoles'}
PEDIDAS = ['santafe', 'satelite', 'lomas', 'xochimilco', 'romasur', 'delvalle']

def norm(s):
    s = unicodedata.normalize('NFD', (s or '').lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9 ]', ' ', s).strip()
def km(a, b): return math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 105)
def zona_de(lat, lng):
    z = min(ZONAS, key=lambda k: km(ZONAS[k], (lat, lng))); return z, km(ZONAS[z], (lat, lng))

CADENAS = re.compile(r"\b(starbucks|vips|sanborns|mcdonald|burger king|kfc|domino|little caesar|subway|toks|italianni|chili'?s|"
                     r"carl'?s jr|wings army|papa john|pizza hut|oxxo|7.?eleven|cielito querido|punta del cielo|the italian coffee|"
                     r"krispy|dairy queen|church'?s|popeyes|benedetti|potzollcalli|el portón|el porton|sushi roll|wingstop|"
                     r"applebee|olive garden|p\.?f\.? chang|california pizza|hooters|la casa de to[nñ]o|fonda argentina|ihop|bisquets obregon|"
                     r"wing'?s star|mr\.? sushi|santa clara|boston'?s|sushi itto|la mansion|chilis|liverpool|sears|suburbia)\b")
# No son salida: escuelas y academias, maquinitas de barrio.
NO_SALIDA = re.compile(r"\b(superama|fresko|corporativo|b store|escuela|academia|instituto|capacitacion|club de baile|dance|danza|ballet|estudio|taller(es)? de|maquin|videojueg|smartgame|gabo games|evolucion games)")
def categoria(t):
    a, l, tu, sh = t.get('amenity'), t.get('leisure'), t.get('tourism'), t.get('shop')
    coc = norm(t.get('cuisine', ''))
    if a == 'restaurant': return 'Taquería' if re.search(r'\btaco', coc + ' ' + norm(t.get('name'))) else 'Restaurante'
    if a == 'fast_food': return 'Taquería' if re.search(r'taco|mexican', coc + ' ' + norm(t.get('name'))) else None
    return {('amenity', 'cafe'): 'Café', ('amenity', 'ice_cream'): 'Heladería', ('amenity', 'bar'): 'Bar', ('amenity', 'pub'): 'Bar',
            ('amenity', 'nightclub'): 'Antro', ('amenity', 'cinema'): 'Cine', ('amenity', 'theatre'): 'Teatro', ('amenity', 'arts_centre'): 'Centro cultural',
            ('leisure', 'bowling_alley'): 'Boliche', ('leisure', 'amusement_arcade'): 'Atracción', ('leisure', 'escape_game'): 'Escape room',
            ('leisure', 'water_park'): 'Parque de diversiones', ('leisure', 'trampoline_park'): 'Parque de diversiones', ('leisure', 'park'): 'Parque',
            ('tourism', 'museum'): 'Museo', ('tourism', 'gallery'): 'Galería', ('tourism', 'theme_park'): 'Parque de diversiones',
            ('tourism', 'zoo'): 'Atracción', ('tourism', 'aquarium'): 'Atracción', ('shop', 'mall'): 'Centro comercial'}.get(
        next(((k, t[k]) for k in ('amenity', 'leisure', 'tourism', 'shop') if k in t), None))
SALIDA_AUNQUE_CADENA = {'Cine', 'Boliche', 'Centro comercial', 'Parque de diversiones', 'Atracción', 'Escape room'}
FAMILIA = {'Parque', 'Museo', 'Parque de diversiones', 'Atracción', 'Cine', 'Boliche', 'Centro comercial', 'Heladería'}
ADULTO = {'Bar', 'Antro'}
DIAS = {'Mo': 1, 'Tu': 2, 'We': 3, 'Th': 4, 'Fr': 5, 'Sa': 6, 'Su': 0}
def horario(oh):
    """'Mo-Su 08:00-22:00' / 'Mo-Fr 09:00-18:00; Sa 10:00-14:00' → (abre, cierra). Si no es simple: None."""
    if not oh or oh.strip() == '24/7': return (0, 24) if oh and oh.strip() == '24/7' else None
    hs = re.findall(r'(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})', oh)
    if not hs or re.search(r'PH|sunrise|sunset|week|\[', oh): return None
    ab = min(int(a) + int(b) / 60 for a, b, _, _ in hs)
    ci = max((int(c) + int(d) / 60) + (24 if int(c) + int(d) / 60 <= int(a) + int(b) / 60 else 0) for a, b, c, d in hs)
    return (round(ab * 4) / 4, round(ci * 4) / 4)
DEFECTO = {'Restaurante': (13, 23), 'Taquería': (13, 24), 'Café': (8, 20), 'Heladería': (11, 21), 'Bar': (17, 26), 'Antro': (22, 28),
           'Cine': (12, 23), 'Teatro': (18, 22), 'Centro cultural': (10, 19), 'Boliche': (12, 22), 'Atracción': (11, 20), 'Escape room': (12, 22),
           'Parque de diversiones': (10, 18), 'Parque': (7, 19), 'Museo': (10, 18), 'Galería': (11, 18), 'Centro comercial': (10, 22)}
TAGS = {'Restaurante': ['foodie'], 'Taquería': ['foodie', 'social'], 'Café': ['chill'], 'Heladería': ['chill', 'familiar'], 'Bar': ['nightlife', 'social'],
        'Antro': ['nightlife'], 'Cine': ['chill', 'cultural'], 'Teatro': ['cultural'], 'Centro cultural': ['cultural'], 'Boliche': ['social', 'familiar'],
        'Atracción': ['familiar', 'aventurero'], 'Escape room': ['social', 'aventurero'], 'Parque de diversiones': ['familiar', 'aventurero'],
        'Parque': ['familiar', 'chill'], 'Museo': ['cultural', 'familiar'], 'Galería': ['cultural'], 'Centro comercial': ['familiar']}
ACT = {'Restaurante': ['comida', 'cena'], 'Taquería': ['comida', 'cena'], 'Café': ['cafe'], 'Heladería': ['cafe'], 'Bar': ['copas'], 'Antro': ['baile', 'copas'],
       'Cine': ['funcion'], 'Teatro': ['funcion'], 'Centro cultural': ['visita'], 'Boliche': ['juego'], 'Atracción': ['juego'], 'Escape room': ['reto'],
       'Parque de diversiones': ['atraccion'], 'Parque': ['paseo'], 'Museo': ['visita'], 'Galería': ['visita'], 'Centro comercial': ['compras']}

catalogo = json.load(open(os.path.join(AQUI, 'catalogo_actual.json')))
def repetido(n, lat, lng):
    a = norm(n)
    for c in catalogo:
        if c.get('lat') is None: continue
        if km((c['lat'], c['lng']), (lat, lng)) > 0.3: continue
        b = norm(c['n'])
        if a == b or (len(a) > 5 and a in b) or (len(b) > 5 and b in a): return c
        # Misma primera palabra propia a menos de 150 m ("MIAH Speakeasy Bar" = "Miah Bar").
        STOPW = {'el', 'la', 'los', 'las', 'bar', 'cafe', 'restaurante', 'tacos', 'taqueria', 'the', 'de', 'cine', 'parque', 'museo'}
        pa = [w for w in a.split() if w not in STOPW]; pb = [w for w in b.split() if w not in STOPW]
        if pa and pb and pa[0] == pb[0] and len(pa[0]) >= 4 and km((c['lat'], c['lng']), (lat, lng)) < 0.15: return c
    return None

cands, desc = [], collections.Counter()
vistos = set()
for zona in PEDIDAS:
    f = os.path.join(AQUI, zona + '.json')
    if not os.path.exists(f): continue
    for e in json.load(open(f)).get('elements', []):
        t = e.get('tags', {}); n = (t.get('name') or '').strip()
        lat = e.get('lat') or (e.get('center') or {}).get('lat'); lng = e.get('lon') or (e.get('center') or {}).get('lon')
        if not n or lat is None: desc['sin nombre o ubicación'] += 1; continue
        key = (e['type'], e['id'])
        if key in vistos: continue
        vistos.add(key)
        cat = categoria(t)
        if not cat: desc['tipo que no es salida (comida rápida sin tacos, etc.)'] += 1; continue
        if cat not in SALIDA_AUNQUE_CADENA and (t.get('brand') or t.get('brand:wikidata') or CADENAS.search(norm(n.replace("'", '').replace('’', '')))): desc['cadena'] += 1; continue
        if NO_SALIDA.search(norm(n)): desc['escuela, academia o maquinitas (no es salida)'] += 1; continue
        if cat == 'Atracción' and t.get('leisure') == 'amusement_arcade' and not (t.get('website') or t.get('brand')): desc['maquinitas sin ficha propia'] += 1; continue
        if cat == 'Parque' and not (t.get('wikidata') or t.get('website') or re.search(r'parque|bosque|jard[ií]n|alameda', norm(n))): desc['parque sin nombre propio'] += 1; continue
        if t.get('disused:amenity') or t.get('was:amenity') or 'closed' in (t.get('opening_hours') or '').lower(): desc['cerrado'] += 1; continue
        r0 = repetido(n, lat, lng)
        if r0: desc['ya en el catálogo'] += 1; continue
        if any(norm(c['n']) == norm(n) and km((c['lat'], c['lng']), (lat, lng)) < 0.3 for c in cands): desc['repetido en OSM'] += 1; continue
        z, dz = zona_de(lat, lng)
        if z not in PEDIDAS: desc['fuera de las 6 zonas pedidas'] += 1; continue
        h = horario(t.get('opening_hours'))
        fecha = (e.get('timestamp') or '')[:10]
        url = 'https://www.openstreetmap.org/%s/%d' % (e['type'], e['id'])
        calle = ' '.join(x for x in [t.get('addr:street', ''), t.get('addr:housenumber', '')] if x)
        col = t.get('addr:suburb') or t.get('addr:neighbourhood') or ZL.get(z, z)
        veg = t.get('diet:vegetarian') in ('yes', 'only') or t.get('diet:vegan') in ('yes', 'only') or re.search(r'vegan|vegetari', norm(n + ' ' + t.get('cuisine', '')))
        rec = {'id': 'os-' + e['type'][0] + str(e['id']), 'n': n, 'cat': cat, 'lat': round(lat, 5), 'lng': round(lng, 5), 'zone': z,
               'col': col, 'addr': calle or col, 'oh': list(h or DEFECTO[cat]), 'hrs': t.get('opening_hours') if h else 'Horario por confirmar',
               'who': ['amigos', 'compa'] + (['date'] if cat in ('Restaurante', 'Bar', 'Café', 'Cine', 'Teatro', 'Museo', 'Galería') else []) + (['familia'] if cat in FAMILIA or cat in ('Restaurante', 'Taquería') else []),
               'tags': TAGS[cat], 'act': ACT[cat], 'tm': [], 'web': t.get('website') or t.get('contact:website') or '',
               'fuente': 'OpenStreetMap (ficha del lugar)', 'url': url, 'fecha': fecha, 'consultado': HOY, 'hrsFuente': 'OpenStreetMap',
               'precio': {'min': None, 'rep': None, 'max': None, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': 'OpenStreetMap no publica precios.'},
               'estado': 'por_confirmar', 'falta': 'el precio', 'score': 66, 'tier': 'B', 'basis': cat + ' en ' + col}
        if not h: rec['horaEstimada'] = True
        if t.get('cuisine') and cat in ('Restaurante', 'Taquería'): rec['cocina'] = t['cuisine'].split(';')[0].replace('_', ' ').capitalize()
        if veg: rec['dieta'] = ['vegetariano']
        if cat in FAMILIA: rec['aptoFamilia'] = 'sí'
        if cat in ADULTO: rec['aptoFamilia'] = 'no'
        oh = rec['oh']; rec['tm'] = [x for x, ok in (('manana', oh[0] <= 11), ('tarde', oh[0] <= 17 and oh[1] >= 15), ('noche', oh[1] >= 21)) if ok] or ['tarde']
        if cat in ('Cine', 'Teatro'): rec['sesion'] = True
        notas = []
        if not h: notas.append('Horario sin confirmar.')
        if fecha < '2023-01-01':
            rec['recomendable'] = False; notas.append('La ficha de OSM no se edita desde ' + fecha + ': confirma que siga abierto.')
        if dz > 5.5: rec['lejos'] = True
        if notas: rec['nota'] = ' '.join(notas)
        cands.append(rec)

# Propuestas a mano que OSM no marca como centro comercial (con su propia fuente).
MANUAL = [{'id': 'os-w220679375', 'n': 'Plaza Satélite', 'cat': 'Centro comercial', 'lat': 19.51026, 'lng': -99.23416, 'zone': 'satelite',
  'col': 'Ciudad Satélite, Naucalpan', 'addr': 'Circuito Centro Comercial 2251, Cd. Satélite', 'oh': [11, 21], 'hrs': 'Horario por confirmar', 'horaEstimada': True,
  'who': ['amigos', 'familia', 'date', 'compa'], 'tags': ['familiar'], 'act': ['compras'], 'tm': ['manana', 'tarde', 'noche'], 'web': 'https://plazasatelite.com.mx',
  'fuente': 'Wikipedia — Plaza Satélite (tiendas, Cinépolis, Parque Plaza Satélite)', 'url': 'https://es.wikipedia.org/wiki/Plaza_Sat%C3%A9lite', 'fecha': 'sin fecha (consultada ' + HOY + ')',
  'consultado': HOY, 'hrsFuente': '', 'precio': {'min': None, 'rep': None, 'max': None, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': 'Entrada libre; lo que compres va aparte.'},
  'estado': 'por_confirmar', 'falta': 'el precio', 'score': 70, 'tier': 'B', 'basis': 'Centro comercial en Ciudad Satélite (abrió en 1971)', 'aptoFamilia': 'sí', 'nota': 'Horario sin confirmar.'}]
for m in MANUAL:
    if not repetido(m['n'], m['lat'], m['lng']) and not any(c['id'] == m['id'] for c in cands): cands.append(m)
json.dump(cands, open(os.path.join(AQUI, 'candidatos_osm.json'), 'w'), ensure_ascii=False, indent=0)
if '--mezclar' in sys.argv:
    js = ('/* SOBRES — Lugares de OpenStreetMap aprobados para mezclar (generado por reportes/osm/build_osm.py --mezclar).\n'
          ' * Fuente y fecha = ficha de OSM y su última edición. Precio por confirmar. */\n'
          'window.SOBRES_OSM = ' + json.dumps({'version': 1, 'fecha': HOY, 'lugares': cands}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(os.path.join(REPO, 'data', 'osm.js'), 'w').write(js)

# Reporte
G = {'comer': ['Restaurante', 'Taquería'], 'postres': ['Café', 'Heladería'], 'beber': ['Bar'], 'bailar': ['Antro'],
     'cultura': ['Museo', 'Galería', 'Teatro', 'Centro cultural'], 'exper': ['Cine', 'Boliche', 'Escape room', 'Atracción', 'Parque de diversiones', 'Parque']}
L = ['# Candidatos de OpenStreetMap (4 nov 2026)', '',
     'Generado por `reportes/osm/build_osm.py`. **No están en el catálogo**: se mezclan sólo si los apruebas (`--mezclar`).', '',
     'Descartados: ' + ', '.join('%s %d' % (k, v) for k, v in desc.most_common()) + '.', '',
     '| Zona | Candidatos | Comer | Vegetariano | Café/postres | Beber | Bailar | Cultura | Experiencias | Familia | Para reverificar |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
for z in PEDIDAS:
    C = [c for c in cands if c['zone'] == z]
    if not os.path.exists(os.path.join(AQUI, z + '.json')): L.append('| %s | sin datos (Overpass no respondió) | | | | | | | | | |' % ZL[z]); continue
    cnt = {g: sum(1 for c in C if c['cat'] in cs) for g, cs in G.items()}
    L.append('| %s | %d | %d | %d | %d | %d | %d | %d | %d | %d | %d |' % (ZL[z], len(C), cnt['comer'], sum(1 for c in C if c.get('dieta')), cnt['postres'], cnt['beber'],
             cnt['bailar'], cnt['cultura'], cnt['exper'], sum(1 for c in C if c.get('aptoFamilia') == 'sí'), sum(1 for c in C if c.get('recomendable') is False)))
for z in PEDIDAS:
    C = sorted([c for c in cands if c['zone'] == z], key=lambda c: (c['cat'], c['n']))
    if not C: continue
    L += ['', '## ' + ZL[z], '', '| Lugar | Tipo | Dirección | Horario | Ficha OSM (última edición) |', '|---|---|---|---|---|']
    for c in C:
        L.append('| %s%s | %s | %s | %s | [%s](%s) |' % (c['n'].replace('|', '/'), ' *(reverificar)*' if c.get('recomendable') is False else '', c['cat'],
                 c['addr'].replace('|', '/'), (c['hrs'] or '').replace('|', '/'), c['fecha'], c['url']))
open(os.path.join(AQUI, 'REPORTE_OSM.md'), 'w').write('\n'.join(L) + '\n')
print(len(cands), 'candidatos;', dict(desc))
for z in PEDIDAS: print(' ', z, sum(1 for c in cands if c['zone'] == z))
