"""Arma data/excel.js con TODOS los lugares del Excel de candidatos que no
estaban en el catálogo, sin repetir, y las actualizaciones de precio que
OpenTable permite hacer sobre lugares que ya estaban.

Entradas (en este directorio):
  ../../.. reportes/candidatos-cruce.json (del repo)  — los 679 candidatos
  catalogo.json      — catálogo actual de la app (para no duplicar)
  ot_list.jsonl      — registros de OpenTable (páginas de colonia, listas y búsqueda)
  ot_perfiles.jsonl  — fichas de OpenTable (horario, web, dirección)
  ../geo/nomi.json   — OpenStreetMap/Nominatim
  articulos.py       — lo que dicen los artículos de Time Out y la Guía MICHELIN
"""
import json, math, os, re, sys, unicodedata
from difflib import SequenceMatcher
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = '/Users/christianatherton/sobres-cdmx'
sys.path.insert(0, AQUI)
import horas
from articulos import A as ART, C as CULT, MICH_OT

HOY = '2026-10-19'
def J(p): return json.load(open(os.path.join(AQUI, p)))
def JL(p):
    f = os.path.join(AQUI, p)
    return [json.loads(l) for l in open(f) if l.strip()] if os.path.exists(f) else []
def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    s = s.replace('&', ' and ')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]+', ' ', s)).strip()
STOP = {'restaurante','restaurant','bar','cafe','the','la','el','los','las','de','del','y','and','mx','cdmx','ciudad','mexico','city'}
LUGAR_GEN = {'polanco','roma','condesa','santa','fe','sta','san','angel','coyoacan','satelite','lomas','palmas','reforma','insurgentes',
 'perisur','mitikah','artz','oasis','arcos','bosques','masaryk','centro','historico','valle','napoles','juarez','zona','rosa','narvarte',
 'pedregal','miyana','antara','carso','samara','cibeles','norte','sur','bistrot','bistro','cocina','grill','restaurante','museo','arte',
 'contemporaneo','nacional','chapultepec','unam','casa','jw','marriott','prado','hyatt','regency'}
def toks(s): return [t for t in norm(s).split() if t not in STOP] or norm(s).split()
def km(a, b):
    if None in (a.get('lat'), a.get('lng'), b.get('lat'), b.get('lng')): return None
    return math.hypot((a['lat'] - b['lat']) * 111.0, (a['lng'] - b['lng']) * 105.0)
def base(n): return re.split(r'\s+[-–·|]\s+|\s*-\s+|\s+-\s*|\(', n)[0].strip()
def sim(a, b):
    na, nb = norm(base(a)), norm(base(b))
    if not na or not nb: return 0
    if na == nb: return 1
    ta, tb = set(toks(na)), set(toks(nb))
    if ta and ta == tb: return 0.95
    if ta and tb and (ta <= tb or tb <= ta):
        extra = (ta - tb) | (tb - ta); comun = ta & tb
        if extra <= LUGAR_GEN and (comun - LUGAR_GEN): return 0.92
        return 0.7
    return SequenceMatcher(None, na, nb).ratio() * 0.9

# ----------------------------------------------------------------- zonas
ZONAS = {'roma': (19.419, -99.16), 'romasur': (19.404, -99.157), 'condesa': (19.411, -99.174), 'polanco': (19.433, -99.195),
 'juarez': (19.427, -99.157), 'centro': (19.434, -99.137), 'chapultepec': (19.417, -99.186), 'coyoacan': (19.35, -99.162),
 'sanangel': (19.346, -99.187), 'delvalle': (19.386, -99.167), 'cu': (19.322, -99.185), 'santafe': (19.366, -99.26),
 'xochimilco': (19.2735, -99.1035), 'lomas': (19.4235, -99.2265), 'satelite': (19.508, -99.236)}
def zona_de(lat, lng):
    best = min(ZONAS.items(), key=lambda kv: math.hypot((kv[1][0] - lat) * 111, (kv[1][1] - lng) * 105))
    d = math.hypot((best[1][0] - lat) * 111, (best[1][1] - lng) * 105)
    return best[0], d
COL_ZONA = {  # colonia → (zona, lat, lng) para lugares sin coordenada propia
 'roma norte': ('roma', 19.4185, -99.1625), 'roma': ('roma', 19.4185, -99.1625), 'roma sur': ('romasur', 19.404, -99.159),
 'condesa': ('condesa', 19.411, -99.174), 'hipodromo': ('condesa', 19.4125, -99.1705), 'polanco': ('polanco', 19.432, -99.195),
 'juarez': ('juarez', 19.4265, -99.1595), 'cuauhtemoc': ('juarez', 19.4285, -99.1665), 'centro': ('centro', 19.4335, -99.138),
 'san rafael': ('juarez', 19.4375, -99.161), 'santa maria la ribera': ('juarez', 19.4485, -99.1585), 'tabacalera': ('juarez', 19.4355, -99.1525),
 'san miguel chapultepec': ('chapultepec', 19.4125, -99.1835), 'tacubaya': ('chapultepec', 19.4025, -99.1885),
 'escandon': ('condesa', 19.4015, -99.1795), 'narvarte': ('delvalle', 19.394, -99.1555), 'del valle': ('delvalle', 19.383, -99.167),
 'napoles': ('delvalle', 19.3935, -99.1745), 'ciudad de los deportes': ('delvalle', 19.383, -99.18), 'viaducto piedad': ('romasur', 19.401, -99.149),
 'lomas de chapultepec': ('lomas', 19.4235, -99.2135), 'anzures': ('polanco', 19.4295, -99.1795), 'la concepcion': ('coyoacan', 19.348, -99.1585),
 'coyoacan': ('coyoacan', 19.3495, -99.162), 'san angel': ('sanangel', 19.346, -99.19), 'jardines del pedregal': ('cu', 19.317, -99.205),
 'copilco': ('cu', 19.337, -99.177), 'ciudad universitaria': ('cu', 19.3235, -99.186), 'santa fe': ('santafe', 19.3655, -99.2625),
 'mixcoac': ('delvalle', 19.3755, -99.1875), 'industrial': ('centro', 19.4705, -99.1255), 'anahuac': ('polanco', 19.4395, -99.1775),
 'ciudad satelite': ('satelite', 19.508, -99.236), 'naucalpan': ('satelite', 19.48, -99.245), 'bosque de chapultepec': ('chapultepec', 19.4205, -99.1875),
 'buenavista': ('juarez', 19.4455, -99.1525), 'nonoalco tlatelolco': ('centro', 19.4515, -99.1375), 'lomas del chamizal': ('santafe', 19.3815, -99.2545),
 'iztapalapa': ('coyoacan', 19.3575, -99.0565), 'azcapotzalco': ('polanco', 19.5005, -99.2005), 'magdalena contreras': ('sanangel', 19.3005, -99.2665),
 'ajusco': ('cu', 19.2405, -99.2405), 'xochimilco': ('xochimilco', 19.2895, -99.0965), 'san pablo tepetlapa': ('coyoacan', 19.3236, -99.1424),
 'miguel hidalgo': ('polanco', 19.4295, -99.1955),
}
COLONIAS = ['Roma Norte','Roma Sur','Hipódromo Condesa','Hipódromo','Condesa','Polanco','Juárez','Cuauhtémoc','Centro Histórico','Centro','Tabacalera',
 'San Rafael','Santa María la Ribera','San Miguel Chapultepec','Lomas de Chapultepec','Lomas Virreyes','Bosques de las Lomas','Lomas de Santa Fe','Santa Fe',
 'Del Valle','Nápoles','Narvarte','Anzures','Anáhuac','Granada','San Ángel','Tizapán','Jardines del Pedregal','Coyoacán','Del Carmen','Xoco',
 'Insurgentes Mixcoac','San José Insurgentes','Insurgentes San Borja','Florida','Guadalupe Inn','Lomas de Tecamachalco','Ciudad Satélite','Cd. Satélite','Naucalpan']
def colonia_de(addr):
    a = norm(addr or '').replace('roma nte', 'roma norte')
    for c in COLONIAS:
        if norm(c) in a: return 'Ciudad Satélite' if c == 'Cd. Satélite' else c
    return ''
def col_geo(col):
    n = norm(col)
    for k in sorted(COL_ZONA, key=len, reverse=True):
        if k in n: return COL_ZONA[k]
    return None

# -------------------------------------------------------------- categorías
CAT_X = {'Café, postre o concepto mixto': 'Café', 'Bar / concepto nocturno': 'Bar', 'Heladería': 'Heladería',
 'Club / espacio de baile (validar)': 'Antro', 'Taquería / comida': 'Taquería', 'Parque / área verde': 'Parque', 'Museo': 'Museo',
 'Centro cultural': 'Centro cultural', 'Cine': 'Cine', 'Escape room': 'Escape room', 'Lucha libre / espectáculo': 'Espectáculo',
 'Zona arqueológica': 'Sitio histórico', 'Arquitectura / biblioteca': 'Biblioteca', 'Actividad al aire libre': 'Al aire libre',
 'Pintura de cerámica': 'Taller', 'Taller creativo': 'Taller', 'Taller de cerámica': 'Taller'}
def cat_de(cand, cocina, nombre):
    c = cand['categoria_sugerida']; n = norm(nombre); cu = norm(cocina or '')
    if 'rooftop' in n: return 'Rooftop'
    if 'speakeasy' in n: return 'Speakeasy'
    es_restaurante = cand['candidate_id'].startswith('R') and not c.startswith('Bar')
    if not es_restaurante and re.search(r'\bcocktail bar\b|\bwine bar\b|\bbar\b|\btavern\b|\bgin gin\b', n) and 'cafe' not in n: return 'Bar'
    if cu.startswith('bar de cocteles') or cu.startswith('bar de vinos'): return 'Bar'
    if c in CAT_X: return CAT_X[c]
    if 'taqueria' in n or cu.startswith('tacos'): return 'Taquería'
    if re.search(r'\bcafe\b', n) and 'restaurante' not in n: return 'Café'
    return 'Restaurante'
ACT = {'Restaurante': ['comida','cena'], 'Taquería': ['comida','cena'], 'Café': ['cafe','desayuno'], 'Heladería': ['cafe'],
 'Bar': ['copas'], 'Bar de autor': ['copas'], 'Speakeasy': ['copas'], 'Mezcalería': ['copas'], 'Rooftop': ['copas','vista'],
 'Antro': ['baile','copas'], 'Mercado': ['comida','compras'], 'Churrería': ['cafe'], 'Museo': ['visita'], 'Centro cultural': ['visita'],
 'Sitio histórico': ['visita'], 'Biblioteca': ['lectura'], 'Parque': ['paseo'], 'Al aire libre': ['paseo'], 'Cine': ['funcion'],
 'Espectáculo': ['funcion'], 'Escape room': ['reto'], 'Taller': ['taller']}
DEF_OH = {'Restaurante': [13, 23], 'Taquería': [13, 24], 'Café': [8, 20], 'Heladería': [12, 21], 'Bar': [18, 26], 'Bar de autor': [18, 26],
 'Speakeasy': [19, 26], 'Mezcalería': [18, 26], 'Rooftop': [17, 26], 'Antro': [23, 27], 'Mercado': [10, 18], 'Churrería': [8, 22],
 'Museo': [10, 18], 'Centro cultural': [10, 18], 'Sitio histórico': [9, 17], 'Biblioteca': [9, 19], 'Parque': [7, 19],
 'Al aire libre': [8, 17], 'Cine': [12, 23], 'Espectáculo': [19, 23], 'Escape room': [11, 21], 'Taller': [11, 19]}
TAGS = {'Restaurante': ['foodie','social'], 'Taquería': ['foodie','clásico'], 'Café': ['chill','foodie'], 'Heladería': ['chill','familiar'],
 'Bar': ['nightlife','social'], 'Bar de autor': ['nightlife','social'], 'Speakeasy': ['nightlife','romántico','joyita'],
 'Mezcalería': ['nightlife','joyita'], 'Rooftop': ['nightlife','social','vistas'], 'Antro': ['nightlife','social'], 'Mercado': ['foodie','social'],
 'Churrería': ['foodie','clásico'], 'Museo': ['cultural'], 'Centro cultural': ['cultural','creativo'], 'Sitio histórico': ['cultural'],
 'Biblioteca': ['cultural','chill'], 'Parque': ['chill','familiar'], 'Al aire libre': ['chill','aventurero'], 'Cine': ['cultural','chill'],
 'Espectáculo': ['social'], 'Escape room': ['aventurero','social'], 'Taller': ['creativo','social']}
WHO = {'Restaurante': ['amigos','date','compa','familia'], 'Taquería': ['amigos','solo','compa','familia'], 'Café': ['solo','date','amigos','compa'],
 'Heladería': ['familia','date','amigos'], 'Bar': ['amigos','date','compa'], 'Bar de autor': ['amigos','date','compa'], 'Speakeasy': ['date','amigos'],
 'Mezcalería': ['amigos','date'], 'Rooftop': ['amigos','date','compa'], 'Antro': ['amigos','date','compa'], 'Mercado': ['amigos','familia','compa'],
 'Churrería': ['familia','amigos','solo'], 'Museo': ['solo','date','familia','amigos'], 'Centro cultural': ['solo','date','amigos'],
 'Sitio histórico': ['familia','amigos','solo','date'], 'Biblioteca': ['solo','date'], 'Parque': ['familia','date','amigos','solo'],
 'Al aire libre': ['amigos','familia'], 'Cine': ['date','amigos','solo'], 'Espectáculo': ['amigos','familia'],
 'Escape room': ['amigos','compa','familia','date'], 'Taller': ['amigos','date','solo']}
FOOD = {'Restaurante','Taquería','Café','Heladería','Mercado','Churrería'}
DRINK = {'Bar','Bar de autor','Speakeasy','Mezcalería','Rooftop','Antro'}

# ----------------------------------------------------------------- precios
BANDA = {2: ('Hasta $300', 200, 350, 450), 3: ('De $310 a $500', 450, 650, 900), 4: ('Más de $500', 700, 1100, 2000)}
TO_REP = {1: 250, 2: 450, 3: 800, 4: 1400}
TO_CAFE = {1: 150, 2: 250, 3: 400, 4: 600}
MICH_REP = {1: 300, 2: 900, 3: 1600, 4: 3000}
DEF_PP = {'Restaurante': 600, 'Taquería': 200, 'Café': 200, 'Heladería': 100, 'Bar': 550, 'Bar de autor': 600, 'Speakeasy': 650,
 'Mezcalería': 450, 'Rooftop': 700, 'Antro': 900, 'Mercado': 300, 'Churrería': 120}
def r50(x): return int(round(x / 50.0) * 50) if x >= 300 else int(round(x / 10.0) * 10)
def precio_de(cat, pb=None, to=None, ms=None, estrella=False, nota_extra='', fijo=None, fmax=None):
    """Devuelve (precio, estado, explicación). TODO es estimación salvo `fijo`."""
    if fijo is not None:
        verif = 'CDMX Secreta' in (nota_extra or '') or 'INAH' in (nota_extra or '')
        return ({'min': fijo, 'rep': fijo, 'max': fmax if fmax is not None else fijo, 'unidad': 'persona', 'moneda': 'MXN',
                 'canasta': nota_extra or ('Entrada libre (biblioteca o espacio público).' if fijo == 0 else 'Precio publicado: $%d por persona.' % fijo)}, 'verificado' if verif else 'rango')
    if cat not in FOOD | DRINK:
        return ({'min': None, 'rep': None, 'max': None, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': None}, 'por_confirmar')
    if pb in BANDA and ms in MICH_REP and MICH_REP[ms] > BANDA[pb][2] * (1.4 if estrella else 1):
        pb = None   # la Guía MICHELIN lo pone más arriba que la banda de OpenTable
    if pb in BANDA:
        lbl, mn, rep, mx = BANDA[pb]
        if cat in ('Bar', 'Bar de autor', 'Speakeasy', 'Mezcalería'):   # dos tragos y algo de botana
            mn, rep, mx = {2: (150, 300, 400), 3: (350, 550, 750), 4: (550, 800, 1300)}[pb]
        if estrella: rep, mx = r50(rep * 1.4), r50(mx * 1.4)
        can = ('OpenTable publica la banda "%s" por persona. Estimamos ~$%s %s (rango $%s–$%s). ' % (lbl, f'{rep:,}', 'con dos tragos' if cat in ('Bar', 'Bar de autor', 'Speakeasy', 'Mezcalería') else 'con una bebida', f'{mn:,}', f'{mx:,}')
               + ('Tiene estrella MICHELIN, así que se toma la parte alta. ' if estrella else '') + 'Es una estimación, no un precio de carta.')
        return ({'min': mn, 'rep': rep, 'max': mx, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': can}, 'estimado')
    if ms in MICH_REP:
        rep = MICH_REP[ms]
        if estrella: rep = r50(rep * 1.4)
        can = 'La Guía MICHELIN lo ubica en el nivel %s de 4 de precio. Estimamos ~$%s por persona con una bebida. Es una estimación, no un precio de carta.' % ('$' * ms, f'{rep:,}')
        return ({'min': None, 'rep': rep, 'max': None, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': can}, 'estimado')
    if to in TO_REP:
        tabla = TO_CAFE if cat in ('Café', 'Heladería', 'Churrería') else TO_REP
        rep = tabla[to] if cat != 'Heladería' else {1: 90, 2: 150, 3: 220, 4: 300}[to]
        if cat == 'Antro': rep = {1: 450, 2: 800, 3: 1300, 4: 1800}[to]
        can = 'Time Out lo ubica en el nivel %d de 4 de precio. Estimamos ~$%s por persona%s. Es una estimación, no un precio de carta.' % (to, f'{rep:,}', ' con una bebida' if cat in FOOD | DRINK and cat not in ('Heladería',) else '')
        return ({'min': None, 'rep': rep, 'max': None, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': can}, 'estimado')
    rep = DEF_PP[cat]
    can = 'No encontramos precio publicado. Estimamos ~$%s por persona por el tipo de lugar (%s). Confírmalo antes de ir.' % (f'{rep:,}', cat.lower())
    return ({'min': None, 'rep': rep, 'max': None, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': can}, 'estimado')

# ------------------------------------------------------------------ horario
DIAS_TXT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
def fmt_h(h):
    h = h % 24; return '%02d:%02d' % (int(h), int(round((h - int(h)) * 60)))
def hrs_txt(res):
    d = res['dias']; oh = res['oh']
    if len(d) == 7: dd = 'Todos los días'
    else:
        # agrupa días consecutivos empezando en lunes
        orden = [1, 2, 3, 4, 5, 6, 0]; on = [x in d for x in orden]; grupos = []; i = 0
        while i < 7:
            if on[i]:
                j = i
                while j + 1 < 7 and on[j + 1]: j += 1
                grupos.append(DIAS_TXT[orden[i]] + ('–' + DIAS_TXT[orden[j]] if j > i else '')); i = j + 1
            else: i += 1
        dd = ', '.join(grupos)
    return '%s %s–%s' % (dd, fmt_h(oh[0]), fmt_h(oh[1]))

# ------------------------------------------------------------------ datos
cruce = json.load(open(os.path.join(REPO, 'reportes', 'candidatos-cruce.json')))['registros']
catalogo = J('catalogo.json')
nomi = J('../geo/nomi.json')
otl, ot_slug = {}, {}  # nombre normalizado / slug → registro de lista
CAMPOS = ['n', 'pb', 'lat', 'lng', 'cu', 'nb', 'rt', 'rc', 'url', 'dir', 'aw']
for a in JL('ot_list.jsonl'):
    r = dict(zip(CAMPOS, a)) if isinstance(a, list) else a
    for k in ('lat', 'lng', 'rt', 'rc', 'pb'):
        if r.get(k) == '': r[k] = None
    r['aw'] = 'MICHELIN' if r.get('aw') == 'M' else (r.get('aw') or '')
    otl.setdefault(norm(r['n']), []).append(r); ot_slug[r['url']] = r
cid_slug = dict(l.strip().split('|', 1) for l in open(os.path.join(AQUI, 'ot_map.txt')) if '|' in l)
perf = {}
for a in JL('ot_perfiles.jsonl'):
    if isinstance(a, dict): perf[a['cid']] = a; continue
    cid, nombre, pb, lat, lng, hor, web, vest, dirr, coc = a
    perf[cid] = {'nombre': nombre.replace('&amp;', '&'), 'pb': pb or None, 'lat': lat or None, 'lng': lng or None,
                 'horario': hor.replace(' | ', '\n'), 'web': ('https://' + web) if web and not web.startswith('http') else web,
                 'vestimenta': vest, 'dir': dirr, 'cocina': coc}
busq = {r['cid']: r for r in JL('ot_busq.jsonl')}   # cid → registro OT de la búsqueda
# Revisión a mano de los "posibles duplicados" del cruce: estos SÍ son el mismo
# lugar que ya está en el catálogo (no se agregan otra vez).
MISMO = {'R0004': 'cdmx-4071', 'R0128': 'cdmx-2062', 'R0242': 'cdmx-4032', 'R0045': 'cdmx-4031', 'R0385': 'cdmx-2113', 'R0399': 'cdmx-2001',
 'R0440': 'cdmx-4018', 'R0303': 'cdmx-0015', 'C0002': 'cdmx-2145', 'C0003': 'tamayo', 'C0007': 'cdmx-0890', 'C0008': 'cdmx-0159',
 'C0010': 'cdmx-0491', 'C0014': 'cdmx-0596', 'C0015': 'cdmx-0146', 'C0017': 'cdmx-0145', 'C0019': 'cdmx-0224', 'C0023': 'cdmx-0150',
 'C0024': 'cdmx-0184', 'C0026': 'cdmx-0671', 'C0027': 'cdmx-0611', 'C0028': 'cdmx-0417', 'C0030': 'cdmx-0823', 'C0054': 'cdmx-0098',
 'C0072': 'cdmx-0113', 'C0076': 'cineteca', 'C0091': 'cdmx-0110', 'C0092': 'cdmx-3010', 'C0020': 'muac', 'C0031': 'anahuacalli',
 'C0081': 'arena', 'C0011': 'cdmx-0381', 'C0085': 'cdmx-0186', 'R0439': 'orinoco'}
# Y estos NO lo son, aunque el nombre se parezca (otra sucursal u otro negocio).
DISTINTO = {'R0163', 'R0253', 'R0285', 'C0088', 'X0060', 'X0052', 'R0435', 'C0062', 'C0077', 'C0078'}
EXCLUIR = {
 'X0006': 'No encontramos dirección ni ficha de "El 98" en ninguna fuente; sin ubicación no se puede proponer.',
 'X0064': 'Time Out sólo dice "zona metropolitana": no encontramos dirección de Sens.',
 'X0065': 'Time Out sólo dice "zona metropolitana": no encontramos dirección de The Grand Hotel Club.',
 'X0048': 'Mantequilla Social Club se cargó a mano en la auditoría (cdmx-4076), con categoría y cupo correctos.',
}

def ot_de(cand):
    """Registro de OpenTable para un candidato: búsqueda > lista por nombre."""
    cid = cand['candidate_id']
    pf = perf.get(cid) or {}
    if cid in cid_slug and cid_slug[cid] in ot_slug:
        r = dict(ot_slug[cid_slug[cid]])
        if not r.get('lat') and pf.get('lat'): r['lat'], r['lng'] = pf['lat'], pf['lng']
        if not r.get('dir') and pf.get('dir'): r['dir'] = pf['dir']
        return r
    if cid in busq: return busq[cid]
    if pf.get('nombre'):   # sólo ficha (perfil o búsqueda), sin registro de lista
        return {'n': pf['nombre'], 'pb': pf.get('pb'), 'lat': pf.get('lat'), 'lng': pf.get('lng'),
                'cu': pf.get('cocina'), 'nb': '', 'rt': None, 'rc': None, 'url': cid_slug.get(cid, ''), 'dir': pf.get('dir') or '', 'aw': ''}
    rs = otl.get(norm(cand['nombre']))
    if rs: return rs[0]
    return None

TIPOS_COMIDA = {'restaurant','cafe','bar','fast_food','ice_cream','pub','nightclub','food_court','bakery','biergarten','supermarket','deli','confectionery'}
TIPOS_CULTURA = {'museum','arts_centre','gallery','attraction','library','cinema','theatre','park','nature_reserve','garden','stadium','greenhouse','archaeological_site','zoo','events_venue','escape_game','amusement_arcade'}
def osm_de(cid, umbral=0.85, cat=None, col=''):
    v = nomi.get(cid)
    if not v or not v['top']: return None
    for t in v['top']:
        if t['p'] < umbral: continue
        tipos = TIPOS_COMIDA if cat in FOOD | DRINK else TIPOS_CULTURA | {'restaurant','cafe'}
        if t.get('type') not in tipos: continue
        g = col_geo(col) if col else None
        if g and math.hypot((g[1] - t['lat']) * 111, (g[2] - t['lng']) * 105) > 3.0: continue   # otro lugar con el mismo nombre
        return t
    return None

def sim_total(a, b):
    return sim(a, b)
COMIDA_CAT = {'Restaurante','Taquería','Café','Heladería','Mercado','Churrería','Fonda de autor','Izakaya','Cantina','Bar','Bar de autor','Speakeasy','Mezcalería','Rooftop','Antro','Salón de baile'}
def dup_catalogo(rec, aprox=False):
    """Lugar del catálogo que es el MISMO establecimiento, o None. Con la
    ubicación aproximada (centro de colonia) sólo cuenta un nombre casi igual."""
    mejor = None
    for c in catalogo:
        if (rec.get('cat') in COMIDA_CAT) != (c['cat'] in COMIDA_CAT): continue
        s = sim_total(rec['n'], c['n'])
        if s < (0.95 if aprox else 0.9): continue
        d = km(rec, c)
        mismo_nombre = norm(rec['n']) == norm(c['n'])
        if d is None:
            if s >= 0.95 and (rec.get('cat') in FOOD | DRINK) == (c['cat'] in FOOD | DRINK | {'Fonda de autor','Izakaya','Cantina'}):
                if mismo_nombre or norm(base(rec['n'])) == norm(base(c['n'])):
                    # sin coordenadas del lado del catálogo: sólo si no es otra sucursal
                    suf_a = norm(rec['n'][len(base(rec['n'])):]); suf_b = norm(c['n'][len(base(c['n'])):])
                    if not suf_a or not suf_b or suf_a == suf_b or (suf_a and suf_a in norm(c.get('col', ''))):
                        mejor = c
            continue
        if d <= 0.45 or (s >= 0.95 and d <= 1.2 and not re.search(r'[·-]', rec['n'] + c['n'])):
            if not mejor or s > sim(rec['n'], mejor['n']): mejor = c
    return mejor

salida, actualiza, informe = [], {}, {'nuevo': [], 'ya_estaba': [], 'excluido': [], 'lejos': [], 'sin_coord': []}
vistos_ot = {}
pend = [r for r in cruce if r['estado'] not in ('existente', 'existente_varias_sucursales', 'corregido_en_catalogo')]
for cand in pend:
    cid = cand['candidate_id']
    if cid in EXCLUIR: informe['excluido'].append((cid, cand['nombre'], EXCLUIR[cid])); continue
    art = dict(ART.get(cid) or {})
    if cid in MICH_OT and not art.get('mich'): art['mich'], art['ms'] = MICH_OT[cid]
    cul = CULT.get(cid) or {}
    if art.get('cerrado'):
        informe['excluido'].append((cid, cand['nombre'], 'La fuente lo marca como cerrado.')); continue
    ot = ot_de(cand); pf = perf.get(cid) or {}
    nombre = (cul.get('n') or art.get('n') or (ot and ot['n']) or cand['nombre']).strip()
    nombre = re.sub(r'\s*-\s*', ' · ', nombre) if ot and ' - ' in nombre else nombre
    cocina = (pf.get('cocina') or (ot and ot.get('cu')) or art.get('tipo') or cul.get('tipo') or '')
    cat = cul.get('cat') or art.get('cat') or cat_de(cand, cocina, nombre)
    rec = {'id': 'xl-' + cid, 'n': nombre, 'cat': cat}
    osm = osm_de(cid, cat=cat, col=art.get('col') or cul.get('col') or '')
    # --- ubicación
    lat = lng = None; addr = ''; col = ''; coordAprox = False; fuente_geo = ''
    if ot and ot.get('lat'):
        lat, lng = ot['lat'], ot['lng']; addr = ot.get('dir') or ''; fuente_geo = 'OpenTable'
    if pf.get('lat') and not lat: lat, lng = pf['lat'], pf['lng']; fuente_geo = 'OpenTable'
    if pf.get('dir'): addr = pf['dir']
    addr = addr or art.get('addr') or cul.get('addr') or ''
    if not lat and osm:
        lat, lng = osm['lat'], osm['lng']; fuente_geo = 'OpenStreetMap'
        a = osm['addr']; addr = addr or ' '.join(x for x in [a.get('road'), a.get('house_number')] if x)
    col = art.get('col') or cul.get('col') or colonia_de(addr) or (ot and (ot.get('nb') or '').split('/')[0].strip()) or ''
    if osm and not col:
        a = osm['addr']; col = a.get('neighbourhood') or a.get('suburb') or ''
    if not lat:
        g = col_geo(col) if col else None
        if g: lat, lng = g[1], g[2]; coordAprox = True; fuente_geo = 'centro de la colonia'
    if not lat:
        informe['sin_coord'].append((cid, nombre, col)); lat = None
    # dirección limpia: sin CP ni "Ciudad de México"
    addr = re.sub(r',?\s*(Ciudad de México|CDMX|Cdad\. de México)\b', '', addr)
    addr = re.sub(r',?\s*\b\d{5}\b', '', addr).strip(' ,')
    rec.update({'lat': round(lat, 6) if lat else None, 'lng': round(lng, 6) if lng else None, 'addr': addr})
    # --- ¿ya estaba?
    if cid in MISMO:
        d = next((x for x in catalogo if x['id'] == MISMO[cid]), None)
    elif cid in DISTINTO:
        d = None
    else:
        d = dup_catalogo(rec, coordAprox)
    if d:
        informe['ya_estaba'].append((cid, nombre, d['id'], d['n']))
        # Si el del catálogo tiene precio por defecto y OpenTable trae banda, se actualiza.
        if ot and ot.get('pb') in BANDA and d['pEstado'] in ('inferido',) and d['cat'] in FOOD | DRINK | {'Fonda de autor','Izakaya','Cantina'}:
            pr, est = precio_de(d['cat'] if d['cat'] in FOOD | DRINK else 'Restaurante', pb=ot['pb'])
            actualiza[d['id']] = {'precio': pr, 'estado': est, 'ppAnterior': d['pp'], 'fecha': HOY,
                'fuente': 'OpenTable — ficha del restaurante (banda de precio)', 'url': 'https://www.opentable.com.mx' + (ot.get('url') or '').replace('https://www.opentable.com.mx', ''),
                'cocina': cocina, 'otRt': ot.get('rt'), 'otRc': ot.get('rc')}
        continue
    # --- duplicado dentro del propio Excel (mismo restaurante en dos listas)
    clave = (norm(nombre), round(lat or 0, 3), round(lng or 0, 3))
    if clave in vistos_ot:
        informe['ya_estaba'].append((cid, nombre, vistos_ot[clave], 'repetido en el Excel')); continue
    vistos_ot[clave] = rec['id']
    # --- zona
    if lat:
        z, dz = zona_de(lat, lng)
    else:
        z, dz = 'centro', 99
    rec['zone'] = z
    if dz > 5.5: rec['lejos'] = True; informe['lejos'].append((cid, nombre, z, round(dz, 1)))
    ZL = {'roma': 'Roma Norte', 'romasur': 'Roma Sur', 'condesa': 'Condesa', 'polanco': 'Polanco', 'juarez': 'Juárez', 'centro': 'Centro',
          'chapultepec': 'Chapultepec', 'coyoacan': 'Coyoacán', 'sanangel': 'San Ángel', 'delvalle': 'Del Valle', 'cu': 'Pedregal',
          'santafe': 'Santa Fe', 'xochimilco': 'Xochimilco', 'lomas': 'Lomas de Chapultepec', 'satelite': 'Ciudad Satélite'}
    rec['col'] = col or ZL.get(z, '')
    # --- horario
    res, fh = None, ''
    if pf.get('horario'): res, fh = horas.ot(pf['horario']), 'OpenTable'
    osm_oh = osm and osm['x'].get('opening_hours')
    osm_fecha = (osm and osm['x'].get('check_date')) or ''
    if not res and osm_oh and osm_fecha >= '2025': res, fh = horas.osm(osm_oh), 'OpenStreetMap'
    f_art = art.get('f') or cul.get('f')
    if not res and (art.get('hrs') or cul.get('hrs')) and f_art and f_art[2] >= 2024: res, fh = horas.timeout(art.get('hrs') or cul.get('hrs')), 'Time Out'
    if not res and osm_oh: res, fh = horas.osm(osm_oh), 'OpenStreetMap'
    if not res and (art.get('hrs') or cul.get('hrs')): res, fh = horas.timeout(art.get('hrs') or cul.get('hrs')), 'Time Out'
    if res:
        rec['oh'] = res['oh']; rec['hrs'] = hrs_txt(res)
        if len(res['dias']) < 7: rec['dias'] = res['dias']
    else:
        rec['oh'] = DEF_OH.get(cat, [12, 20]); rec['hrs'] = 'Horario por confirmar'; rec['horaEstimada'] = True
    # --- actividades, vibras, para quién, momento
    act = list(ACT.get(cat, ['visita']))
    if cat == 'Restaurante' and rec['oh'][0] <= 10: act.append('desayuno')
    if cat in ('Restaurante', 'Taquería') and re.search(r'bar|cantina|gastrobar|vinos|cocteles|cervec', norm(cocina + ' ' + nombre)): act.append('copas')
    if cat == 'Rooftop' and rec['oh'][0] <= 19: act.append('cena')
    rec['act'] = act
    tags = list(TAGS.get(cat, ['social']))
    rec['who'] = list(WHO.get(cat, ['amigos']))
    tm = []
    if rec['oh'][0] <= 11: tm.append('manana')
    if rec['oh'][0] <= 17 and rec['oh'][1] >= 15: tm.append('tarde')
    if rec['oh'][1] >= 21: tm.append('noche')
    if cat in ('Museo', 'Parque', 'Al aire libre', 'Centro cultural', 'Sitio histórico', 'Escape room', 'Taller'): tm.append('finde')
    rec['tm'] = tm or ['tarde']
    # --- precio
    estrella = bool(re.search(r'estrella', art.get('mich', '') or ''))
    pb = ot and ot.get('pb')
    pr, est = precio_de(cat, pb=pb, to=art.get('to'), ms=art.get('ms'), estrella=estrella,
                        fijo=cul.get('precio'), fmax=cul.get('max'), nota_extra=cul.get('nota', '') if cul.get('precio') is not None else '')
    if pr.get('rep') and pr['rep'] >= 900 and 'romántico' not in tags and cat == 'Restaurante': tags.append('romántico')
    if art.get('mich') or (ot and 'MICHELIN' in (ot.get('aw') or '')): tags.append('joyita')
    rec['tags'] = tags
    rec['precio'] = pr; rec['estado'] = est
    if est == 'por_confirmar': rec['falta'] = 'el precio o la entrada'
    # --- fuentes, puntaje, descripción
    fuentes = []
    if ot: fuentes.append('OpenTable (dirección, coordenadas y banda de precio)')
    if f_art: fuentes.append(f_art[0])
    if osm and fuente_geo == 'OpenStreetMap': fuentes.append('OpenStreetMap')
    if not fuentes: fuentes.append('Excel de candidatos de SOBRES (fuente: ' + cand['fuentes'][0] + ')')
    rec['fuente'] = '; '.join(fuentes)
    rec['url'] = ('https://www.opentable.com.mx' + ot['url'].replace('https://www.opentable.com.mx', '')) if ot and ot.get('url') else (f_art[1] if f_art else cand['fuentes'][0])
    rec['web'] = pf.get('web') or (osm and osm['x'].get('website')) or ''
    rec['fecha'] = HOY
    anio = f_art[2] if f_art else 2026
    confirmado = bool(ot) or bool(osm and (osm['x'].get('check_date') or '') >= '2024') or anio >= 2024
    if ot and ot.get('rt'):
        sc = 74 + (float(ot['rt']) - 4.3) * 18 + min(5, math.log10((ot.get('rc') or 0) + 1) * 1.7)
    elif art.get('mich'):
        sc = 94 if estrella else (90 if 'Bib' in art['mich'] else 86)
    elif anio >= 2025: sc = 82
    elif anio >= 2024: sc = 80
    else: sc = 76 if confirmado else 70
    rec['score'] = int(max(62, min(90 if not estrella else 95, round(sc))))
    rec['tier'] = 'A' if rec['score'] >= 88 else 'B'
    cocina_txt = (cocina.split(',')[0].strip() if cocina else (art.get('tipo') or cul.get('tipo') or cat))
    lugar = col or ''
    rec['basis'] = (cocina_txt[0].upper() + cocina_txt[1:]) + (' en ' + lugar if lugar and lugar.lower() not in cocina_txt.lower() else '')
    if cocina and cat in FOOD | DRINK: rec['cocina'] = cocina_txt
    if art.get('mich'): rec['distincion'] = art['mich'] if 'estrella' in art['mich'] or 'Bib' in art['mich'] else 'Recomendado por la Guía MICHELIN'
    elif ot and 'MICHELIN' in (ot.get('aw') or ''): rec['distincion'] = 'Reconocido por la Guía MICHELIN'
    if ot and ot.get('rt'): rec['otRt'] = ot['rt']; rec['otRc'] = ot.get('rc')
    if pf.get('vestimenta'): rec['vestimenta'] = pf['vestimenta']
    notas = []
    if art.get('nota'): notas.append(art['nota'])
    if cul.get('nota') and cul.get('precio') is None: notas.append(cul['nota'])
    if coordAprox: rec['coordAprox'] = True; notas.append('Ubicación aproximada (centro de la colonia): la fuente no da calle y número.')
    if rec.get('horaEstimada'): notas.append('Horario sin confirmar.')
    if not confirmado:
        rec['recomendable'] = False
        notas.append('La única fuente es de %d y no lo encontramos en fuentes recientes: confirma que siga abierto. Mientras tanto no lo proponemos en planes.' % anio)
    if rec.get('lejos'): notas.append('Queda lejos del centro de su zona; sólo aparece al buscar en toda la ciudad.')
    if cat in ('Escape room', 'Taller'): rec['sesion'] = True
    if notas: rec['nota'] = ' '.join(notas)
    rec['candidato'] = cid
    salida.append(rec); informe['nuevo'].append((cid, nombre, cat, z))

# ------- existentes del Excel con datos de OpenTable: precio real de banda
for cand in cruce:
    if cand['estado'] not in ('existente', 'existente_varias_sucursales', 'corregido_en_catalogo'): continue
    ot = ot_de(cand)
    for m in (cand.get('coincide_con') or [])[:1]:
        c = next((x for x in catalogo if x['id'] == m['id']), None)
        if not c or not ot or ot.get('pb') not in BANDA: continue
        if c['pEstado'] != 'inferido' or c['id'] in actualiza: continue
        cc = c['cat'] if c['cat'] in FOOD | DRINK else ('Bar' if c['cat'] in ('Cantina',) else 'Restaurante')
        pr, est = precio_de(cc, pb=ot['pb'])
        u = {'precio': pr, 'estado': est, 'ppAnterior': c['pp'], 'fecha': HOY,
             'fuente': 'OpenTable — ficha del restaurante (banda de precio)', 'url': 'https://www.opentable.com.mx' + (ot.get('url') or '').replace('https://www.opentable.com.mx', ''),
             'otRt': ot.get('rt'), 'otRc': ot.get('rc')}
        if ot.get('cu'): u['cocina'] = ot['cu']
        if ot.get('lat') and (not c.get('addr')): u.update({'lat': ot['lat'], 'lng': ot['lng'], 'addr': re.sub(r',?\s*\b\d{5}\b', '', ot.get('dir') or '').strip(' ,')})
        actualiza[c['id']] = u

# ------- cualquier otro lugar del catálogo que esté en OpenTable: banda real
COMIDA_ACT = FOOD | DRINK | {'Fonda de autor','Izakaya','Cantina'}
todos_ot = [r for rs in otl.values() for r in rs]
for c in catalogo:
    if c['id'] in actualiza or c['pEstado'] != 'inferido' or c['cat'] not in COMIDA_ACT: continue
    mejor = None
    for r in todos_ot:
        if r.get('pb') not in BANDA: continue
        sv = sim(c['n'], r['n'])
        if sv < 0.95: continue
        d = km(c, r) if r.get('lat') else None
        if d is not None and d > 0.6: continue
        GEN = {'mexico city', 'cdmx', 'ciudad de mexico', 'mexico'}
        suf_c = norm(c['n'][len(base(c['n'])):]); suf_r = norm(r['n'][len(base(r['n'])):])
        suf_c = '' if suf_c in GEN else suf_c; suf_r = '' if suf_r in GEN else suf_r
        EQUIV = {frozenset(['masaryk', 'polanco']), frozenset(['mitikah', 'coyoacan'])}
        if suf_c and suf_r and suf_c != suf_r and frozenset([suf_c, suf_r]) not in EQUIV: continue   # otra sucursal
        if d is None and (' · ' in c['n'] or ' - ' in r['n']): continue   # sin ubicación no se arriesga una sucursal
        mejor = r; break
    if not mejor: continue
    cc = c['cat'] if c['cat'] in FOOD | DRINK else ('Bar' if c['cat'] == 'Cantina' else 'Restaurante')
    pr, est = precio_de(cc, pb=mejor['pb'])
    u = {'precio': pr, 'estado': est, 'ppAnterior': c['pp'], 'fecha': HOY,
         'fuente': 'OpenTable — ficha del restaurante (banda de precio)', 'url': 'https://www.opentable.com.mx' + (mejor.get('url') or '').replace('https://www.opentable.com.mx', ''),
         'otRt': mejor.get('rt'), 'otRc': mejor.get('rc')}
    if mejor.get('cu'): u['cocina'] = mejor['cu']
    actualiza[c['id']] = u
    informe.setdefault('precio_ot', []).append((c['id'], c['n'], mejor['n'], c['pp'], pr['rep']))

out = {'version': 1, 'fecha': HOY, 'fuente': 'SOBRES_Catalogo_y_Reglas.xlsx (18-oct-2026) + OpenTable, OpenStreetMap, Time Out México y Guía MICHELIN', 'lugares': salida, 'actualiza': actualiza}
js = ('/* SOBRES — Lugares del Excel de candidatos (generado por build_excel.py el %s).\n'
      ' * Cada registro dice de dónde sale cada dato. Los precios con estado "estimado"\n'
      ' * NO son de carta: salen de la banda de OpenTable, del nivel de Time Out o de la\n'
      ' * Guía MICHELIN, o del tipo de lugar, y la app los presenta como estimados. */\n'
      'window.SOBRES_EXCEL = ' % HOY) + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(REPO, 'data', 'excel.js'), 'w').write(js)
json.dump(informe, open(os.path.join(AQUI, 'informe.json'), 'w'), ensure_ascii=False, indent=1)
print('nuevos', len(salida), '| ya estaban', len(informe['ya_estaba']), '| excluidos', len(informe['excluido']), '| lejos', len(informe['lejos']), '| sin coord', len(informe['sin_coord']), '| actualiza', len(actualiza))
