"""Importa el paquete "Catálogo CDMX para SOBRES" (corte 3 nov 2026) a la app.

Uso:
  python3 -I reportes/paquete/build_paquete.py <ruta a SOBRES_CDMX.json>

Qué hace (idempotente: correrlo dos veces da el mismo resultado):
  - Toma sólo la colección `categorias_solicitadas` (restaurantes, bares, antros,
    cafés, panaderías, heladerías, museos, cines y centros comerciales).
  - Compara cada ficha contra el catálogo actual de la app
    (reportes/paquete/catalogo_actual.json, exportado con el banco de pruebas):
    nombre normalizado + distancia. Lo que ya está NO se agrega; lo dudoso
    (nombre parecido y cerca, o marca con varias sucursales) se deja en revisión.
  - No pisa datos existentes: sólo agrega lugares nuevos.
  - Cada lugar nuevo lleva fuente (URL), fecha de la fuente y fecha de consulta.
    Precios del paquete = estimación editorial → estado "estimado".
    Sin horario publicado → horario por confirmar. Fuente antigua → no se
    propone en planes (recomendable:false) hasta reverificar.
Salidas:
  data/paquete.js                         window.SOBRES_PAQUETE = {lugares}
  reportes/paquete/correspondencia.json   venue_id del paquete → id en la app (o motivo)
  CANDIDATOS-NUEVOS.md                    reporte para revisión
"""
import json, math, os, re, sys, unicodedata, collections
from difflib import SequenceMatcher

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'reportes', 'excel'))
import horas  # parser de horarios ya usado para el Excel

PAQ = sys.argv[1]
HOY = '2026-11-03'

def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    s = s.replace('&', ' and ')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]+', ' ', s)).strip()
STOP = {'restaurante','restaurant','bar','cafe','the','la','el','los','las','de','del','y','and','mx','cdmx','ciudad','mexico','city','museo'}
LUGAR_GEN = {'polanco','roma','condesa','santa','fe','sta','san','angel','coyoacan','satelite','lomas','palmas','reforma','insurgentes',
 'perisur','mitikah','artz','oasis','arcos','bosques','masaryk','centro','historico','valle','napoles','juarez','zona','rosa','narvarte',
 'pedregal','miyana','antara','carso','samara','cibeles','norte','sur','bistrot','bistro','cocina','grill','arte','sucursal',
 'contemporaneo','nacional','chapultepec','unam','casa','jw','marriott','prado','hyatt','regency','cinepolis','cinemex','plaza',
 'shopping','center','mall','fashion','hall','historia'}
EXTRA_GEN = {'cocina','tradicional','japonesa','campo','speakeasy','comercial','cena','en','shopping','brasserie','huitrerie','museo','palacio','sitio','tienda'}
def toks(s): return [t for t in norm(s).split() if t not in STOP] or norm(s).split()
# La coma y el punto también separan marca y sede ('Museo Soumaya, Plaza Loreto').
def base(n): return re.split(r'\s+[-–·|]\s+|\s*-\s+|\s+-\s*|\(|,\s+|\.\s+', n)[0].strip()
def sim(a, b):
    na, nb = norm(base(a)), norm(base(b))
    if not na or not nb: return 0
    if na == nb: return 1
    # Mismas palabras en otro orden ('Museo Nacional de Historia Castillo de
    # Chapultepec' = 'Castillo de Chapultepec · Museo Nacional de Historia').
    if set(toks(a)) == set(toks(b)): return 0.95
    ta, tb = set(toks(na)), set(toks(nb))
    if ta and ta == tb: return 0.95
    if ta and tb and (ta <= tb or tb <= ta):
        extra = (ta - tb) | (tb - ta); comun = ta & tb
        if extra <= LUGAR_GEN and (comun - LUGAR_GEN): return 0.92
        return 0.7
    return SequenceMatcher(None, na, nb).ratio() * 0.9
def km(a, b):
    if None in (a.get('lat'), a.get('lng'), b.get('lat'), b.get('lng')): return None
    return math.hypot((a['lat'] - b['lat']) * 111.0, (a['lng'] - b['lng']) * 105.0)

ZONAS = {'roma': (19.419, -99.16), 'romasur': (19.404, -99.157), 'condesa': (19.411, -99.174), 'polanco': (19.433, -99.195),
 'juarez': (19.427, -99.157), 'centro': (19.434, -99.137), 'chapultepec': (19.417, -99.186), 'coyoacan': (19.35, -99.162),
 'sanangel': (19.346, -99.187), 'delvalle': (19.386, -99.167), 'cu': (19.322, -99.185), 'santafe': (19.366, -99.26),
 'xochimilco': (19.2735, -99.1035), 'lomas': (19.4235, -99.2265), 'satelite': (19.508, -99.236)}
ZL = {'roma': 'Roma Norte', 'romasur': 'Roma Sur', 'condesa': 'Condesa', 'polanco': 'Polanco', 'juarez': 'Juárez', 'centro': 'Centro',
 'chapultepec': 'Chapultepec', 'coyoacan': 'Coyoacán', 'sanangel': 'San Ángel', 'delvalle': 'Del Valle', 'cu': 'Pedregal',
 'santafe': 'Santa Fe', 'xochimilco': 'Xochimilco', 'lomas': 'Lomas de Chapultepec', 'satelite': 'Ciudad Satélite'}
def zona_de(lat, lng):
    best = min(ZONAS.items(), key=lambda kv: math.hypot((kv[1][0] - lat) * 111, (kv[1][1] - lng) * 105))
    return best[0], math.hypot((best[1][0] - lat) * 111, (best[1][1] - lng) * 105)
# Colonia → centro aproximado, sólo para fichas sin coordenadas (se marca coordAprox).
COL_ZONA = {'roma norte': (19.4185, -99.1625), 'roma sur': (19.404, -99.159), 'condesa': (19.411, -99.174), 'hipodromo': (19.4125, -99.1705),
 'polanco': (19.432, -99.195), 'juarez': (19.4265, -99.1595), 'centro': (19.4335, -99.138), 'san rafael': (19.4375, -99.161),
 'santa maria la ribera': (19.4485, -99.1585), 'tabacalera': (19.4355, -99.1525), 'san miguel chapultepec': (19.4125, -99.1835),
 'escandon': (19.4015, -99.1795), 'narvarte': (19.394, -99.1555), 'del valle': (19.383, -99.167), 'napoles': (19.3935, -99.1745),
 'anzures': (19.4295, -99.1795), 'coyoacan': (19.3495, -99.162), 'san angel': (19.346, -99.19), 'santa fe': (19.3655, -99.2625),
 'lomas de chapultepec': (19.4235, -99.2135), 'cuauhtemoc': (19.4285, -99.1665), 'doctores': (19.4205, -99.1465), 'tacubaya': (19.4025, -99.1885)}
def col_geo(txt):
    n = norm(txt)
    for k in sorted(COL_ZONA, key=len, reverse=True):
        if re.search(r'\b' + k + r'\b', n): return COL_ZONA[k]
    return None

# ------------------------------------------------------------ categorías
def cat_de(r):
    c, sub, n = r['categoria'], r.get('subcategoria') or '', norm(r['nombre'])
    if c == 'restaurante':
        if sub == 'taqueria' or re.search(r'\btaqueria\b|\btacos\b', n): return 'Taquería'
        if re.search(r'\bcantina\b', n): return 'Cantina'
        return 'Restaurante'
    if c == 'bar':
        if 'rooftop' in n or 'terraza' in n: return 'Rooftop'
        if 'speakeasy' in n: return 'Speakeasy'
        if re.search(r'mezcal', n): return 'Mezcalería'
        if re.search(r'\bcantina\b', n): return 'Cantina'
        return 'Bar'
    return {'antro': 'Antro', 'cafeteria': 'Café', 'panaderia': 'Café', 'heladeria': 'Heladería', 'museo': 'Museo',
            'cine': 'Cine', 'centro_comercial': 'Centro comercial'}[c]
ACT = {'Restaurante': ['comida','cena'], 'Taquería': ['comida','cena'], 'Cantina': ['copas','comida'], 'Café': ['cafe','desayuno'],
 'Heladería': ['cafe'], 'Bar': ['copas'], 'Speakeasy': ['copas'], 'Mezcalería': ['copas'], 'Rooftop': ['copas','vista'],
 'Antro': ['baile','copas'], 'Museo': ['visita'], 'Cine': ['funcion'], 'Centro comercial': ['compras']}
DEF_OH = {'Restaurante': [13, 23], 'Taquería': [13, 24], 'Cantina': [13, 24], 'Café': [8, 20], 'Heladería': [12, 21], 'Bar': [18, 26],
 'Speakeasy': [19, 26], 'Mezcalería': [18, 26], 'Rooftop': [17, 26], 'Antro': [23, 27], 'Museo': [10, 18], 'Cine': [12, 23],
 'Centro comercial': [11, 21]}
TAGS = {'Restaurante': ['foodie','social'], 'Taquería': ['foodie','clásico'], 'Cantina': ['nightlife','clásico'], 'Café': ['chill','foodie'],
 'Heladería': ['chill','familiar'], 'Bar': ['nightlife','social'], 'Speakeasy': ['nightlife','romántico','joyita'],
 'Mezcalería': ['nightlife','joyita'], 'Rooftop': ['nightlife','social','vistas'], 'Antro': ['nightlife','social'],
 'Museo': ['cultural'], 'Cine': ['cultural','chill'], 'Centro comercial': ['familiar','social']}
WHO_MAP = {'amigos': 'amigos', 'cita': 'date', 'pareja': 'date', 'familia': 'familia', 'solo': 'solo', 'trabajo': 'compa', 'companeros': 'compa'}
FOOD_DRINK = {'Restaurante','Taquería','Cantina','Café','Heladería','Bar','Speakeasy','Mezcalería','Rooftop','Antro',
              'Fonda de autor','Izakaya','Churrería','Mercado','Bar de autor','Salón de baile'}

# ------------------------------------------------------------- horarios
DIAS = [('lunes','lun'),('martes','mar'),('miercoles','mie'),('jueves','jue'),('viernes','vie'),('sabado','sab'),('domingo','dom')]
EN = {'monday':'Mon','tuesday':'Tue','wednesday':'Wed','thursday':'Thu','friday':'Fri','saturday':'Sat','sunday':'Sun'}
def horario(txt):
    """Texto publicado → {'oh','dias'} o None. Si algo no cuadra, None (= por confirmar)."""
    if not txt or len(txt) < 6: return None
    t = txt.strip()
    if re.search(r'12 AM-12 AM|24 horas|24 hrs', t, re.I): return {'oh': [0, 24], 'dias': list(range(7))}
    if re.search(r'\b(Monday|Tuesday|Sunday)\b', t):
        lineas = re.findall(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+([^A-Z]*(?:AM|PM)[^A-Z]*(?:AM|PM)|closed)', t)
        partes = ['%s %s' % (EN[d.lower()], h.strip()) for d, h in lineas if h.strip().lower() != 'closed']
        return horas.ot('\n'.join(partes)) if partes else None
    s = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode().lower()
    s = s.split('entrada')[0]
    for largo, corto in DIAS: s = re.sub(r'\b' + largo + r'\b', corto, s)
    s = re.sub(r'\b(lun|mar|mie|jue|vie|sab|dom)\w*\s+a\s+(lun|mar|mie|jue|vie|sab|dom)\w*', r'\1-\2', s)
    s = re.sub(r'\bde\s+(\d{1,2}(?::\d{2})?)\s*(?:h|hrs|horas)?\s+a\s+(\d{1,2}(?::\d{2})?)\s*(?:h|hrs|horas)?\b', r'\1-\2', s)
    s = re.sub(r'(\d)\s*(?:h|hrs|horas)\b\.?', r'\1', s)
    s = re.sub(r'(\d)\.(\d{2})', r'\1:\2', s)           # '9.30pm' = 9:30 pm
    s = s.replace(' y ', ', ')
    tramos = []; pend = []
    for linea in re.split(r';|,|\n|\.\s', s):
        m = re.search(r'(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*-\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?', linea)
        if not m:
            # 'vie, sáb 3pm-1am': los días sueltos se suman al siguiente tramo.
            pend += horas._dias_es(linea); continue
        a = horas._hora(m.group(1), m.group(2)); b = horas._hora(m.group(3), m.group(4))
        if a is None or b is None: continue
        # '1:30-11pm' = 13:30 a 23:00; '12-8pm' = 12:00 a 20:00; '6pm-2am' cruza medianoche
        if not m.group(2) and m.group(4) == 'pm' and a < 12 and a + 12 < b: a += 12
        if not m.group(2) and m.group(4) == 'am' and 1 <= a < 12: a += 12
        # 'dom 10am-6:30' = 10:00 a 18:30, no hasta las 6:30 del día siguiente
        if not m.group(4) and b < a and a >= 7 and b < 12 and b + 12 > a: b += 12
        dtxt = linea[:m.start()]
        dias = horas._dias_es(dtxt)
        if not dias and not re.search(r'[a-z]{3}', dtxt): dias = [] if pend else list(range(7))
        dias = sorted(set(dias) | set(pend)); pend = []
        tramos.append((dias, a, horas._cierre(a, b)))
    return horas._resumir(tramos)
def fmt_h(h):
    h = h % 24; hh = int(h); mm = int(round((h - hh) * 60))
    ap = 'am' if hh < 12 else 'pm'; h12 = hh % 12 or 12
    return '%d%s %s' % (h12, (':%02d' % mm) if mm else '', ap)

# --------------------------------------------------------------- precios
def r50(x): return int(round(x / 50.0) * 50) if x >= 300 else int(round(x / 10.0) * 10)
def precio_de(r):
    lo, hi = r.get('precio_estimado_min_mxn'), r.get('precio_estimado_max_mxn')
    if lo is None and hi is None: return {}, 'por_confirmar'
    lo = lo if lo is not None else hi; hi = hi if hi is not None else lo
    rep = r50((lo + hi) / 2.0) if hi != lo else int(lo)
    met = r.get('precio_estimacion_metodo') or ''
    nivel = r.get('precio_nivel_fuente')
    publicada = met.startswith('tarifa_general_reportada') or met.startswith('entrada_libre_reportada')
    canasta = (r.get('precio_incluye') or '').strip()
    if publicada:
        canasta = ('Tarifa general publicada por ' + r['fuente_nombre'] + (' (sujeta a condiciones y fecha de la fuente).' if True else '')
                   + ((' ' + canasta) if canasta else ''))
    else:
        canasta = ('Estimación editorial del paquete SOBRES CDMX (3 nov 2026)' + (', con el nivel ' + nivel + ' que publica ' + r['fuente_nombre'] if nivel else '')
                   + '. ' + canasta + ' No es precio de carta.').strip()
    estado = 'rango' if publicada and r.get('vigencia') != 'fuente_antigua_reverificar' else 'estimado'
    return {'min': int(lo), 'rep': rep, 'max': int(hi), 'unidad': 'persona', 'moneda': 'MXN', 'canasta': canasta}, estado

# ------------------------------------------------------------ duplicados
# Catálogo de la app SIN los lugares del propio paquete (si no, al regenerar todo
# "ya estaría" y data/paquete.js quedaría vacío). Se exporta con:
#   node -e "const {makeApp}=require('./test/harness.js'); ..."  (ver CANDIDATOS-NUEVOS.md)
catalogo = [c for c in json.load(open(os.path.join(AQUI, 'catalogo_actual.json'))) if not c['id'].startswith('pq-')]
def clase(cat):
    if cat in FOOD_DRINK: return 'fd'
    if cat in ('Cine', 'Centro comercial'): return cat
    # Un museo puede estar en el catálogo como sitio histórico o centro cultural,
    # pero NO es la biblioteca, la tienda o el teatro que tiene adentro.
    if cat in ('Museo', 'Sitio histórico', 'Centro cultural', 'Galería', 'Atracción'): return 'museo'
    return 'cultura'
def calle_num(addr):
    """'Alfonso Reyes 217, Condesa' → {'reyes 217'}; 'Belisario Domínguez 70-72' →
    {'dominguez 70', 'dominguez 72'}. Sirve para distinguir la misma dirección
    (duplicado) de otra dirección de la misma marca (sucursal)."""
    a = norm(re.sub(r'\b(c\.?p\.?|cp)\s*\d{5}\b|\b\d{5}\b', ' ', addr or ''))
    m = re.search(r'([a-z]{3,})\s+(\d{1,5})(?:\s+(?:y\s+)?(\d{1,5}))?\b', a)
    if not m: return set()
    return {m.group(1) + ' ' + n for n in (m.group(2), m.group(3)) if n}
def contenido(corto, largo):
    """El nombre corto aparece tal cual dentro del largo ('Rosso' en 'Rosso Speakeasy')."""
    a, b = norm(base(corto)), norm(largo)
    return len(a) >= 4 and (' ' + a + ' ') in (' ' + b + ' ')
def dup_catalogo(rec):
    """(lugar del catálogo que es el MISMO, None) o (None, (candidato dudoso, sim, km)).
    Se evalúan TODOS los del catálogo y gana la coincidencia más fuerte:
    3 = misma marca y misma dirección, 2 = nombre contenido a <300 m,
    1 = nombre casi igual y cerca. Dos direcciones distintas = otra sucursal."""
    mejor, mejor_sc, dudoso = None, (0, 0, 0, 0), None
    ka = calle_num(rec.get('addr'))
    tr = set(toks(rec['n'])) - LUGAR_GEN - EXTRA_GEN
    for c in catalogo:
        if clase(rec['cat']) != clase(c['cat']): continue
        s = sim(rec['n'], c['n']); d = km(rec, c); kb = calle_num(c.get('addr'))
        aprox = rec.get('coordAprox') or c.get('coordAprox')
        nivel = 0
        misma_dir = bool(ka and kb and ka & kb)
        if misma_dir and (s >= 0.6 or contenido(rec['n'], c['n']) or contenido(c['n'], rec['n'])): nivel = 3
        elif s >= 0.95 and d is not None and d <= 0.9 and not aprox: nivel = 1
        elif s >= 0.95 and d is not None and d <= 2.5 and aprox: nivel = 1   # pin aproximado: misma marca, cerca
        elif s >= 0.9 and ka and kb and not misma_dir and (d is None or d > 0.15): nivel = -1   # otra sucursal
        elif d is not None and d <= 0.3 and not aprox:
            tc = set(toks(c['n'])) - LUGAR_GEN - EXTRA_GEN
            corto, largo = (tr, tc) if len(tr) <= len(tc) else (tc, tr)
            if contenido(rec['n'], c['n']) or contenido(c['n'], rec['n']): nivel = 2
            elif corto and corto <= largo and any(len(w) >= 4 for w in corto) and (
                    len(corto) / len(largo) >= 0.75 or contenido(rec['n'], c['n']) or contenido(c['n'], rec['n'])): nivel = 2
        if nivel == 0 and s >= 0.8:
            if d is None or aprox:
                if s >= 0.95 and (not rec.get('col') or not c.get('col') or norm(rec['col'])[:6] == norm(c['col'])[:6] or d is None or d < 2.5): nivel = 1
                elif s >= 0.9: dudoso = dudoso or (c, s, d)
            elif (s >= 0.9 and d <= 0.45) or (s >= 0.95 and d <= 1.2): nivel = 1
            elif s >= 0.9 and d <= 3: dudoso = dudoso or (c, s, d)
            elif d <= 0.08: dudoso = dudoso or (c, s, d)
        if nivel <= 0: continue
        sc = (1 if nivel == 3 else 0, round(s, 3), 1 if c['cat'] == rec['cat'] else 0, nivel)
        if sc > mejor_sc: mejor, mejor_sc = c, sc
    return mejor, (None if mejor else dudoso)

# Revisadas a mano (4 nov 2026): parecidas a un lugar existente pero en otra
# dirección, así que son otra sucursal y sí se agregan.
NOMBRE_FIX = {   # mismo formato "marca · sede" que el resto del catálogo
    'Museo Soumaya. Casa Museo Guillermo Tovar de Teresa': 'Museo Soumaya · Casa Guillermo Tovar de Teresa',
}
# Mismo lugar con datos distintos en cada lado (revisado a mano).
MISMO = {
    'Taqueria Los Cocuyos': ('cdmx-2179', 'Los Cocuyos (Bolívar 57); el paquete dice Simón Bolívar 67.'),
    'Café de medio día en Momiji café': ('xl-R0318', 'Momiji; OJO: en la app tiene el pin aproximado en Lomas y el paquete lo ubica en Praga 35, Juárez.'),
    'Hanky Panky Cocktail Bar': ('cdmx-0035', 'Hanky Panky (Juárez), 50 Best Bars.'),
}
SUCURSAL_DISTINTA = {
    'Cinépolis VIP Samara': 'Samara Shops (Av. Santa Fe 94), no Centro Santa Fe',
    'Panadería Rosetta Juárez': 'la del catálogo es la de Colima en la Roma',
}

# ------------------------------------------------------------------ main
data = json.load(open(PAQ))
recs = [r for r in data['records'] if r['coleccion'] == 'categorias_solicitadas']
salida, corr = [], {}
inf = collections.defaultdict(list)
vistos = {}
for r in sorted(recs, key=lambda x: x['venue_id']):
    vid = r['venue_id']
    cat = cat_de(r)
    nombre = re.sub(r'\s+', ' ', r['nombre']).strip()
    nombre = NOMBRE_FIX.get(nombre, nombre)
    rec = {'id': 'pq-' + vid.split('_')[-1][:10], 'n': nombre, 'cat': cat}
    if r['estado_importacion'] == 'revisar_sucursal_o_mudanza':
        inf['revision_sucursal'].append((r, 'El paquete la marca como posible sucursal o mudanza.')); corr[vid] = 'revisar: sucursal o mudanza'; continue
    if r['geo_estado'] == 'coordenadas_fuera_de_rango':
        inf['revision_ubicacion'].append((r, 'Coordenadas fuera de la CDMX.')); corr[vid] = 'revisar: coordenadas fuera de rango'; continue
    lat, lng, aprox = r.get('latitud'), r.get('longitud'), False
    col = r.get('colonia') or ''
    if lat is None:
        g = col_geo(col + ' ' + (r.get('direccion') or ''))
        if g: lat, lng, aprox = g[0], g[1], True
    if lat is None:
        inf['sin_ubicacion'].append((r, 'Sin coordenadas ni colonia reconocible.')); corr[vid] = 'pendiente: sin ubicación'; continue
    rec.update({'lat': round(lat, 6), 'lng': round(lng, 6)})
    if aprox: rec['coordAprox'] = True
    rec['col'] = col
    rec['addr'] = r.get('direccion') or ''
    # ¿ya está en el catálogo de la app?
    igual, duda = dup_catalogo(rec)
    if nombre in MISMO:
        igual = next(c for c in catalogo if c['id'] == MISMO[nombre][0]); duda = None
    if duda and nombre in SUCURSAL_DISTINTA: duda = None
    if igual:
        inf['ya_estaba'].append((r, igual)); corr[vid] = igual['id']; continue
    if duda:
        c, s, d = duda
        inf['dudoso'].append((r, c, s, d)); corr[vid] = 'revisar: parecido a ' + c['id']; continue
    clave = (r.get('marca_key') or norm(nombre), round(lat, 3), round(lng, 3))
    if clave in vistos:
        inf['repetido_paquete'].append((r, vistos[clave])); corr[vid] = 'repetido en el paquete: ' + vistos[clave]; continue
    vistos[clave] = rec['id']
    z, dz = zona_de(lat, lng)
    rec['zone'] = z
    if dz > 5.5: rec['lejos'] = True; inf['lejos'].append((r, z, round(dz, 1)))
    rec['col'] = col or ZL.get(z, '')
    addr = r.get('direccion') or ''
    addr = re.sub(r',?\s*(Ciudad de México|CDMX|Cdad\. de México)\b', '', addr)
    rec['addr'] = re.sub(r',?\s*\b\d{5}\b', '', addr).strip(' ,')
    # horario
    h = horario(r.get('horarios_publicados'))
    if h and h['oh'][1] - h['oh'][0] > 18 and h['oh'] != [0, 24]: h = None   # no cuadra: por confirmar
    if h and not (h['oh'][0] < 6 and h['oh'] != [0, 24] and cat not in ('Bar','Antro','Speakeasy','Mezcalería','Rooftop','Cantina','Taquería')):
        rec['oh'] = h['oh']
        rec['hrs'] = ('Diario ' if len(h['dias']) == 7 else '') + fmt_h(h['oh'][0]) + '–' + fmt_h(h['oh'][1])
        if h['oh'] == [0, 24]: rec['hrs'] = 'Abierto 24 horas'
        if len(h['dias']) < 7: rec['dias'] = h['dias']
        rec['hrsFuente'] = r.get('horarios_publicados')
    else:
        if r.get('horarios_publicados'): inf['horario_no_leido'].append((r, r['horarios_publicados']))
        rec['oh'] = DEF_OH[cat]; rec['hrs'] = 'Horario por confirmar'; rec['horaEstimada'] = True
    # actividades, para quién, momento
    act = list(ACT[cat])
    if cat == 'Restaurante' and rec['oh'][0] <= 10: act.append('desayuno')
    if cat == 'Rooftop' and rec['oh'][0] <= 19: act.append('cena')
    rec['act'] = act
    who = []
    for t in r.get('tipo_plan_tags') or []:
        w = WHO_MAP.get(norm(t).replace(' ', '_'))
        if w and w not in who: who.append(w)
    rec['who'] = who or ['amigos']
    tags = list(TAGS[cat])
    if 'familia' in rec['who'] and 'familiar' not in tags and cat not in ('Bar','Antro','Speakeasy','Mezcalería','Cantina'): tags.append('familiar')
    if 'date' in rec['who'] and 'romántico' not in tags and cat in ('Restaurante','Rooftop','Speakeasy') and (r.get('presupuesto_nivel') in ('alto','muy_alto')): tags.append('romántico')
    if r.get('novedad_tipo') in ('seleccion_guia_2026', 'ranking_2026'): tags.append('joyita')
    rec['tags'] = tags
    tm = []
    if rec['oh'][0] <= 11: tm.append('manana')
    if rec['oh'][0] <= 17 and rec['oh'][1] >= 15: tm.append('tarde')
    if rec['oh'][1] >= 21: tm.append('noche')
    if cat in ('Museo', 'Centro comercial'): tm.append('finde')
    rec['tm'] = tm or ['tarde']
    # precio
    pr, est = precio_de(r)
    rec['precio'] = pr; rec['estado'] = est
    if est == 'por_confirmar': rec['falta'] = 'el precio'
    # fuente, fechas, puntaje
    rec['fuente'] = r['fuente_nombre']
    rec['url'] = r.get('fuente_url') or r.get('url_publica')
    rec['web'] = r.get('website_url') or ''
    rec['fecha'] = r.get('fuente_actualizada') or ''
    rec['consultado'] = r.get('consultado_el') or HOY
    rec['paqueteId'] = vid
    antigua = r.get('vigencia') == 'fuente_antigua_reverificar'
    sc = {'Guía MICHELIN': 88, 'The 50 Best Bars 2026': 92, 'Eater, mapa de CDMX (octubre 2026)': 84, 'Marco Beteta MB100 2026': 84,
          'Time Out México': 78, 'The Happening, aperturas reportadas': 76, 'Secretaría de Turismo CDMX': 72,
          'Secretaría de Cultura, SIC': 70}.get(r['fuente_nombre'], 72)
    if antigua: sc -= 6
    rec['score'] = sc; rec['tier'] = 'A' if sc >= 88 else 'B'
    cocina = ', '.join(r.get('cocina_tags') or [])
    if r['categoria'] == 'panaderia': cocina = cocina or 'Panadería'
    if cocina and cat in FOOD_DRINK: rec['cocina'] = cocina.split(',')[0].strip()
    lugar = rec['col']
    tipo = rec.get('cocina') or {'Café': 'Café', 'Heladería': 'Heladería', 'Museo': 'Museo', 'Cine': 'Cine',
                                 'Centro comercial': 'Centro comercial'}.get(cat, cat)
    rec['basis'] = tipo[0].upper() + tipo[1:] + (' en ' + lugar if lugar and norm(lugar) not in norm(tipo) else '')
    if r['fuente_nombre'] == 'Guía MICHELIN': rec['distincion'] = 'Recomendado por la Guía MICHELIN'
    if r.get('novedad_tipo') == 'ranking_2026': rec['distincion'] = 'The World\'s 50 Best Bars 2026'
    if r.get('adultos_para_plan') is True: rec['aptoFamilia'] = 'no'
    notas = []
    if r.get('novedad_tipo') == 'apertura_reportada': notas.append('Apertura reportada por ' + r['fuente_nombre'] + ' (la fecha de la nota no es la fecha de apertura).')
    if aprox: notas.append('Ubicación aproximada (centro de la colonia): la fuente no da coordenadas.')
    if rec.get('horaEstimada'): notas.append('Horario sin confirmar.')
    if antigua:
        rec['recomendable'] = False
        notas.append('La fuente es antigua (' + (r.get('fuente_actualizada') or 'sin fecha') + '): confirma que siga abierto. Mientras tanto no lo proponemos en planes.')
    if rec.get('lejos'): notas.append('Queda lejos del centro de su zona; sólo aparece al buscar en toda la ciudad.')
    if notas: rec['nota'] = ' '.join(notas)
    salida.append(rec); corr[vid] = rec['id']
    inf['nuevo'].append((r, rec))

# ids únicos
ids = collections.Counter(x['id'] for x in salida)
assert all(n == 1 for n in ids.values()), [k for k, n in ids.items() if n > 1]

cab = ('/* SOBRES — Lugares nuevos del paquete "Catálogo CDMX para SOBRES" (corte 3 nov 2026),\n'
       ' * generado por reportes/paquete/build_paquete.py. Sólo lo que NO estaba en el catálogo.\n'
       ' * Precios = estimación editorial (estado "estimado"), salvo tarifas publicadas vigentes ("rango").\n'
       ' * Cada lugar trae fuente (URL), fecha de la fuente y fecha de consulta. */\n')
js = cab + 'window.SOBRES_PAQUETE = ' + json.dumps({'version': 1, 'fecha': HOY, 'fuente': 'SOBRES_CDMX_Paquete_Claude_Code.zip (3 nov 2026)',
                                                     'lugares': salida}, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(REPO, 'data', 'paquete.js'), 'w').write(js)
json.dump(corr, open(os.path.join(AQUI, 'correspondencia.json'), 'w'), ensure_ascii=False, indent=0, sort_keys=True)

# -------------------------------------------------------------- reporte
def fila(*xs): return '| ' + ' | '.join(str(x).replace('|', '/') for x in xs) + ' |'
L = ['# Lugares nuevos del paquete (3 nov 2026)', '',
     'Generado por `reportes/paquete/build_paquete.py`. Se tomaron las **%d fichas de categorías solicitadas** '
     '(restaurantes, bares, antros, cafés, panaderías, heladerías, museos, cines, centros comerciales) y se compararon '
     'contra los **%d lugares** que ya tenía la app (nombre normalizado + distancia).' % (len(recs), len(catalogo)), '',
     '| Resultado | Fichas |', '|---|---:|']
for k, t in [('nuevo', 'Agregados al catálogo'), ('ya_estaba', 'Ya estaban (no se repiten)'), ('dudoso', 'Parecidos a uno existente: en revisión, NO agregados'),
             ('repetido_paquete', 'Repetidos dentro del paquete'), ('revision_sucursal', 'Posible sucursal o mudanza (el paquete pide revisarlas)'),
             ('revision_ubicacion', 'Coordenadas fuera de la CDMX'), ('sin_ubicacion', 'Sin ubicación utilizable')]:
    L.append(fila(t, len(inf[k])))
nv = [x[1] for x in inf['nuevo']]
L += ['', '## Agregados por categoría y zona', '']
cz = collections.Counter((x['cat'], x['zone']) for x in nv)
cats = sorted(set(c for c, _ in cz)); zs = sorted(set(z for _, z in cz))
L.append(fila('Categoría', *zs, 'Total')); L.append('|' + '---|' * (len(zs) + 2))
for c in cats: L.append(fila(c, *[cz.get((c, z), '') for z in zs], sum(cz.get((c, z), 0) for z in zs)))
L += ['', '- Se proponen en planes: **%d**. Sólo en Explorar hasta reverificar (fuente antigua): **%d**. Lejos de toda zona (sólo "Toda la ciudad"): **%d**.'
      % (sum(1 for x in nv if x.get('recomendable') is not False), sum(1 for x in nv if x.get('recomendable') is False), sum(1 for x in nv if x.get('lejos'))),
      '- Con horario publicado y leído: **%d**; horario por confirmar: **%d**. Ubicación aproximada (centro de colonia): **%d**.'
      % (sum(1 for x in nv if not x.get('horaEstimada')), sum(1 for x in nv if x.get('horaEstimada')), sum(1 for x in nv if x.get('coordAprox'))),
      '- Precio: todos estimados (editorial) salvo **%d** tarifas publicadas vigentes.' % sum(1 for x in nv if x['estado'] == 'rango'), '']
L += ['## En revisión: parecidos a un lugar que ya está (no se agregaron)', '',
      fila('Ficha del paquete', 'Categoría', 'Se parece a', 'Similitud', 'Distancia'), '|---|---|---|---:|---:|']
for r, c, s, d in sorted(inf['dudoso'], key=lambda x: x[0]['nombre']):
    L.append(fila(r['nombre'], r['categoria'], c['n'] + ' (`' + c['id'] + '`)', '%.2f' % s, ('%.2f km' % d) if d is not None else 's/coord'))
L += ['', '## Posibles sucursales o mudanzas (no se agregaron)', '', fila('Ficha', 'Dirección', 'Fuente'), '|---|---|---|']
for r, m in inf['revision_sucursal']: L.append(fila(r['nombre'], r.get('direccion') or '', r['fuente_url']))
L += ['', '## Sin ubicación utilizable (no se agregaron)', '', fila('Ficha', 'Categoría', 'Dirección'), '|---|---|---|']
for r, m in inf['sin_ubicacion'] + inf['revision_ubicacion']: L.append(fila(r['nombre'], r['categoria'], r.get('direccion') or '—'))
L += ['', '## Horarios publicados que no se pudieron leer (quedan "por confirmar")', '', fila('Ficha', 'Texto publicado'), '|---|---|']
for r, t in inf['horario_no_leido']: L.append(fila(r['nombre'], t[:120]))
L += ['', '## Ya estaban (se conserva el dato de la app)', '', fila('Ficha del paquete', 'En la app'), '|---|---|']
for r, c in sorted(inf['ya_estaba'], key=lambda x: x[0]['nombre']): L.append(fila(r['nombre'], c['n'] + ' (`' + c['id'] + '`)'))
L += ['', '## Agregados', '', fila('Id', 'Nombre', 'Categoría', 'Zona', 'Precio pp', 'Horario', 'Fuente'), '|---|---|---|---|---:|---|---|']
for x in sorted(nv, key=lambda x: (x['cat'], x['zone'], x['n'])):
    L.append(fila('`' + x['id'] + '`', x['n'] + (' *(lejos)*' if x.get('lejos') else '') + (' *(reverificar)*' if x.get('recomendable') is False else ''),
                  x['cat'], x['zone'], ('~$%d' % x['precio']['rep']) if x['precio'] else '—', x['hrs'], '[' + x['fuente'] + '](' + x['url'] + ')'))
open(os.path.join(REPO, 'CANDIDATOS-NUEVOS.md'), 'w').write('\n'.join(L) + '\n')
print({k: len(v) for k, v in inf.items()}, 'salida', len(salida))
