#!/usr/bin/env python3
"""Lugares encontrados con búsquedas simples en Google Maps (4 nov 2026).

Como lo pidió el fundador: "restaurantes vegetarianos en Roma Norte", "bares en
Tecamachalco", etc. Los resultados (nombre, categoría, dirección, calificación,
reseñas, coordenadas, id del lugar y la hora de cierre de ese día) se copiaron de
la página de resultados a reportes/maps/resultados_*.json.

Reglas:
  - Relevancia: calificación >= 4.2 y >= 30 reseñas (se filtró al copiar).
  - Fuente = la ficha de Google Maps del lugar (URL con su place_id) y la fecha
    de consulta. Es una ficha viva, así que cuenta como vigente.
  - Precio por confirmar (Maps no da precio por persona). Horario: sólo se sabe a
    qué hora cerraba ese día, así que queda "por confirmar" con esa pista.
  - Dieta vegana/vegetariana sólo si la categoría de Maps o el nombre lo dicen.
  - No se repite nada del catálogo (mismo nombre a menos de 300 m, o misma primera
    palabra a menos de 150 m) ni se agregan cadenas de comida rápida.
Genera data/maps.js.
"""
import glob, hashlib, json, math, os, re, unicodedata, urllib.parse

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(AQUI))
HOY = '2026-11-04'
ZONAS = {'roma': (19.419, -99.16), 'romasur': (19.404, -99.157), 'condesa': (19.411, -99.174), 'polanco': (19.433, -99.195),
 'juarez': (19.427, -99.157), 'centro': (19.434, -99.137), 'chapultepec': (19.417, -99.186), 'coyoacan': (19.35, -99.162),
 'sanangel': (19.346, -99.187), 'delvalle': (19.386, -99.167), 'cu': (19.322, -99.185), 'santafe': (19.366, -99.26),
 'xochimilco': (19.2735, -99.1035), 'lomas': (19.4235, -99.2265), 'satelite': (19.508, -99.236)}
CADENAS = re.compile(r"\b(starbucks|vips|sanborns|mcdonald|burger king|kfc|domino|subway|toks|italianni|chilis|ihop|hooters|wingstop|bisquets)\b")

def norm(s):
    s = unicodedata.normalize('NFD', (s or '').lower().replace("'", '').replace('’', ''))
    return re.sub(r'[^a-z0-9 ]', ' ', ''.join(c for c in s if unicodedata.category(c) != 'Mn')).strip()
def km(a, b): return math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 105)
def zona_de(lat, lng):
    z = min(ZONAS, key=lambda k: km(ZONAS[k], (lat, lng))); return z, km(ZONAS[z], (lat, lng))

catalogo = json.load(open(os.path.join(AQUI, 'catalogo_actual.json')))
STOP = {'el', 'la', 'los', 'las', 'bar', 'cafe', 'restaurante', 'tacos', 'taqueria', 'the', 'de', 'cine', 'parque', 'museo', 'cantina', 'vegano', 'vegetariano'}
def repetido(n, lat, lng):
    a = norm(n); a0 = a.replace(' ', ''); pa = [w for w in a.split() if w not in STOP]
    for c in catalogo:
        if c.get('lat') is None: continue
        d = km((c['lat'], c['lng']), (lat, lng))
        if d > 0.3: continue
        b = norm(c['n']); b0 = b.replace(' ', ''); pb = [w for w in b.split() if w not in STOP]
        if a == b or (len(a0) > 5 and (a0 in b0 or b0 in a0)): return c
        if pa and pb and pa[0] == pb[0] and len(pa[0]) >= 4 and d < 0.15: return c
    return None

def categoria(gcat, n):
    g = norm(gcat); t = norm(n)
    if 'centro de eventos' in g: return None
    if 'academia' in g or 'escuela' in g: return None
    if 'discoteca' in g or 'club nocturno' in g: return 'Antro'
    if 'karaoke' in g: return 'Bar'
    if re.search(r'\bbar\b|pub|cocteleria|cerveceria', g): return 'Bar'
    if 'taqueria' in g: return 'Taquería'
    if 'cafeteria' in g or 'panaderia' in g: return 'Café'
    if 'restaurante' in g or 'marisqueria' in g: return 'Restaurante'
    return None

def cierre(txt):
    m = re.search(r'Cierra a las? (\d{1,2})(?::(\d\d))? ?(a|p)\.m\.', txt or '')
    if not m: return None
    h = int(m.group(1)) % 12 + (12 if m.group(3) == 'p' else 0) + (int(m.group(2) or 0) / 60)
    if m.group(3) == 'a' and h < 6: h += 24
    return round(h * 4) / 4

def raiz(n):
    return ' '.join(sorted(re.sub(r'[·,.]', ' ', unicodedata.normalize('NFD', n.lower())).split()))
RAICES = set(raiz(c['n']) + '|' + c['z'] + '|' + c['cat'] for c in catalogo)
out, vistos, desc, CONFIRMA = [], set(), {}, {}
def descarta(k): desc[k] = desc.get(k, 0) + 1
for f in sorted(glob.glob(os.path.join(AQUI, 'resultados_*.json'))):
    for q, filas in json.load(open(f)).items():
        for n, gcat, addr, rating, resenas, lat, lng, pid, hr, *extra in filas:
            if pid in vistos: descarta('repetido en otra búsqueda'); continue
            vistos.add(pid)
            if rating is None or rating < 4.2 or resenas < 30: descarta('poca calificación o pocas reseñas'); continue
            if CADENAS.search(norm(n)): descarta('cadena'); continue
            url = 'https://www.google.com/maps/search/?' + urllib.parse.urlencode({'api': 1, 'query': n, 'query_place_id': pid})
            ya = repetido(n, lat, lng)
            if ya:
                # La ficha viva de Maps confirma que un lugar del catálogo sigue abierto
                # (p. ej. un cine cuya única fuente era de 2022).
                CONFIRMA[ya['id']] = {'fuente': 'Google Maps — ficha vigente (%.1f★, %d reseñas)' % (rating, resenas), 'url': url, 'consultado': HOY}
                descarta('ya en el catálogo'); continue
            cat = categoria(gcat, n)
            if not cat: descarta('no es salida (centro de eventos, etc.)'); continue
            if 'karaoke' in norm(gcat) and 'karaoke' not in norm(n): n = n + ' · karaoke'
            z, dz = zona_de(lat, lng)
            # Mismo nombre en la misma zona y categoría = el mismo lugar (aunque el pin del catálogo esté lejos).
            if raiz(n) + '|' + z + '|' + cat in RAICES: descarta('ya en el catálogo'); continue
            RAICES.add(raiz(n) + '|' + z + '|' + cat)
            veg = re.search(r'vegan|vegetarian', norm(gcat)) or re.search(r'vegan|vegetari|plant based', norm(n))
            vegano = re.search(r'vegan', norm(gcat) + ' ' + norm(n))
            ab = {'Bar': 17, 'Restaurante': 13, 'Taquería': 13, 'Café': 8, 'Antro': 22}[cat]
            ci = cierre(hr) or {'Bar': 25, 'Restaurante': 22, 'Taquería': 23, 'Café': 20, 'Antro': 28}[cat]
            if ci <= ab: ab = max(7, ci - 6)
            act = {'Bar': ['copas'], 'Restaurante': ['comida', 'cena'], 'Taquería': ['comida', 'cena'], 'Café': ['cafe', 'desayuno'], 'Antro': ['baile', 'copas']}[cat]
            if cat == 'Bar' and re.search(r'restaurante', norm(gcat)): act = ['copas', 'cena']
            tags = {'Bar': ['nightlife', 'social'], 'Restaurante': ['foodie'], 'Taquería': ['foodie', 'social'], 'Café': ['chill'], 'Antro': ['nightlife']}[cat]
            rec = {'id': 'gm-' + hashlib.sha1(pid.encode()).hexdigest()[:10], 'n': n, 'cat': cat, 'lat': lat, 'lng': lng, 'zone': z,
                   'col': '', 'addr': addr.strip(' ·'), 'oh': [ab, ci],
                   'hrs': ('Ese día cerraba a las ' + hr.split('Cierra a las ')[-1].split('Cierra a la ')[-1] if 'Cierra' in hr else 'Horario por confirmar') + ' · horario completo por confirmar',
                   'horaEstimada': True, 'who': ['amigos', 'date', 'compa'] + (['familia'] if cat not in ('Bar', 'Antro') else []), 'tags': tags, 'act': act,
                   'tm': [x for x, ok in (('manana', ab <= 11), ('tarde', ab <= 17 and ci >= 15), ('noche', ci >= 21)) if ok] or ['tarde'],
                   'fuente': 'Google Maps — búsqueda "%s" (%.1f★, %d reseñas)' % (q, rating, resenas), 'url': url, 'web': '',
                   'fecha': 'ficha vigente (consultada ' + HOY + ')', 'consultado': HOY, 'hrsFuente': 'Google Maps',
                   'precio': {'min': None, 'rep': None, 'max': None, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': 'Google Maps no publica precio por persona.'},
                   'estado': 'por_confirmar', 'falta': 'el precio', 'score': int(min(86, 70 + (rating - 4.2) * 22)), 'tier': 'B',
                   'basis': gcat + ' (' + ('%.1f' % rating) + '★ en Google Maps, ' + str(resenas) + ' reseñas)',
                   'nota': 'Horario sin confirmar.' + (' Queda lejos del centro de su zona.' if dz > 5.5 else '')}
            # Rango por persona que publica Maps ("$300–800", reportado por la gente):
            # cuenta como precio ESTIMADO con su fuente, no verificado.
            m = re.match(r'\$([\d,]+)\s*[–-]\s*([\d,]+)', (extra[0] if extra else '') or '')
            if m:
                lo, hi = int(m.group(1).replace(',', '')), int(m.group(2).replace(',', ''))
                # Regla del fundador (4 nov 2026): con un rango, el precio por persona es el ALTO.
                rec['precio'] = {'min': lo, 'rep': hi, 'max': hi, 'unidad': 'persona', 'moneda': 'MXN',
                                 'canasta': 'Rango por persona que reporta la gente en Google Maps (%s).' % extra[0]}
                rec['estado'] = 'estimado'; rec['falta'] = 'confirmar el precio en el lugar'
            if veg: rec['dieta'] = ['vegano', 'vegetariano'] if vegano else ['vegetariano']
            if cat in ('Bar', 'Antro'): rec['aptoFamilia'] = 'no'
            if dz > 5.5: rec['lejos'] = True
            out.append(rec)

js = ('/* SOBRES — Lugares de búsquedas simples en Google Maps (4 nov 2026), generado por reportes/maps/build_maps.py.\n'
      ' * Fuente = ficha de Maps (place_id) y fecha de consulta; precio y horario completo por confirmar. */\n'
      'window.SOBRES_MAPS = ' + json.dumps({'version': 1, 'fecha': HOY, 'lugares': out, 'confirma': CONFIRMA}, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(REPO, 'data', 'maps.js'), 'w').write(js)
print(len(out), 'lugares nuevos;', desc)
import collections
print(collections.Counter((r['zone'], r['cat'] + ('·veg' if r.get('dieta') else '')) for r in out).most_common())
