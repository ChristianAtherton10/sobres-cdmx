# Cruce de los 679 candidatos contra el catálogo actual de SOBRES.
# Uso: python3 -I cruce.py <SOBRES_candidatos.json> <repo>
import json, sys, io, re, unicodedata, collections
cand_path, repo = sys.argv[1], sys.argv[2]
C = json.load(open(cand_path, encoding='utf-8'))['records']

def norm(t):
    t = unicodedata.normalize('NFKD', t or '').encode('ascii', 'ignore').decode().lower()
    t = t.replace('&', ' y ')
    t = re.sub(r"[^a-z0-9 ]+", ' ', t)
    return re.sub(r'\s+', ' ', t).strip()
GEN = {'restaurante','restaurant','bar','cafe','cafeteria','cdmx','mexico','ciudad','de','del','la','el','los','las','y','the','club','cocina','taqueria','museo','casa','cantina','mx','by','rooftop','and'}
def base(n):  # nombre sin la sucursal ("Panaderia Rosetta · Roma" -> "panaderia rosetta")
    return norm(re.split(r'\s+[·\-–—|]\s+', n or '')[0])
def toks(n): return {w for w in base(n).split() if w not in GEN and len(w) > 1}

# Catálogo vigente: lugares.js + auditoría (bajas fuera, correcciones de nombre, nuevos) + fichas fijas.
src = io.open(repo + '/data/lugares.js', encoding='utf-8').read()
j = json.loads(src[src.index('{'):src.rindex('}') + 1]); F = j['fields']
rows = {r[0]: dict(zip(F, r)) for r in j['rows']}
aud = io.open(repo + '/data/auditoria.js', encoding='utf-8').read()
bajas = set(re.findall(r"^\s+'(cdmx-\d+)': \{\s*\n\s+era:", aud, re.M))
for vid, n in re.findall(r"'(cdmx-\d+)': \{\s*\n(?:\s*//[^\n]*\n)*\s+n: '([^']+)'", aud):
    if vid in rows: rows[vid]['n'] = n
for vid in bajas: rows.pop(vid, None)
for m in re.finditer(r"""\{ id: ['"](cdmx-\d+)['"], n: (?:'([^']+)'|"([^"]+)"), cat: ['"]([^'"]+)['"], zone: ['"]([a-z]+)['"]""", aud):
    rows.setdefault(m.group(1), {'id': m.group(1), 'n': m.group(2) or m.group(3), 'cat': m.group(4), 'zone': m.group(5)})
html = io.open(repo + '/index.html', encoding='utf-8').read()
for m in re.finditer(r"V\('([a-z]+)','([^']+)','([^']+)','([a-z]+)','([^']+)'", html):
    if m.group(1) in ('barrovivo', 'distral', 'rutataco'): continue   # perfiles de ejemplo, fuera
    rows[m.group(1)] = {'id': m.group(1), 'n': m.group(2), 'cat': m.group(5), 'zone': m.group(4)}
cat = list(rows.values())
idx_base = collections.defaultdict(list)
for v in cat: idx_base[base(v['n'])].append(v)

METRO = re.compile(r'naucalpan|satelite|interlomas|huixquilucan|tlalnepantla|ecatepec|atizapan|metepec|toluca|cuautitlan|lomas-verdes|lomas verdes|estado-de-mexico|edomex|mundo e\b', re.I)
SEP = re.compile(r'\s+[·\-–—|]\s+|\s*[·]\s*')
def partes(n):
    p = SEP.split(n or '', maxsplit=1)
    return norm(p[0]), (norm(p[1]) if len(p) > 1 else '')
def tk(t): return {w for w in t.split() if w not in GEN and len(w) > 1}
marca = collections.defaultdict(list)
for v in cat: marca[partes(v['n'])[0]].append(v)
completos = {norm(v['n']): v for v in cat}
salida = []
for c in C:
    nm = c['discovery_name']; m0, suc = partes(nm)
    urls = [s2['url'] for s2 in c.get('sources', [])]
    reg = {'candidate_id': c['candidate_id'], 'nombre': nm, 'categoria_sugerida': c.get('suggested_category'), 'fuentes': urls}
    hits = marca.get(m0) or [v for a in (c.get('aliases') or []) for v in marca.get(partes(a)[0], [])]
    full = completos.get(norm(nm))
    if full:
        reg['estado'] = 'existente'; hits = [full]
    elif hits:
        if suc:
            mismas = [v for v in hits if tk(partes(v['n'])[1]) & tk(suc)]
            if mismas: reg['estado'] = 'existente'; hits = mismas[:1]
            else: reg['estado'] = 'marca_existente_sucursal_nueva'
        else:
            reg['estado'] = 'existente' if len(hits) == 1 else 'existente_varias_sucursales'
    else:
        posibles = []
        tc = tk(norm(nm))
        for v in cat:
            tv = tk(norm(v['n']))
            if not tc or not tv: continue
            jac = len(tc & tv) / len(tc | tv)
            mb = tk(partes(v['n'])[0])
            cont = len(mb) >= 2 and mb <= tk(m0)
            if jac >= 0.6 or cont: posibles.append((round(jac, 2), v))
        posibles.sort(key=lambda x: -x[0])
        if posibles:
            reg['estado'] = 'posible_duplicado'; hits = []
            reg['revisar_contra'] = [{'id': v['id'], 'n': v['n'], 'similitud': s3} for s3, v in posibles[:3]]
        else:
            reg['estado'] = 'nuevo_sin_confirmar'; hits = []
    if hits: reg['coincide_con'] = [{'id': v['id'], 'n': v['n'], 'cat': v.get('cat'), 'zona': v.get('zone')} for v in hits]
    CDMX = re.compile(r'polanco|centro|roma|condesa|santa fe|coyoac|san angel|del valle|napoles|juarez|reforma|masaryk|narvarte|anzures|chapultepec|mitikah|artz|pedregal|zocalo|tlalpan|xochimilco|obregon|cibeles', re.I)
    fuera = (METRO.search(nm) or (urls and all(METRO.search(u) for u in urls))) and not CDMX.search(norm(nm))
    if fuera and reg['estado'] in ('nuevo_sin_confirmar', 'marca_existente_sucursal_nueva', 'posible_duplicado'):
        reg['estado'] = 'fuera_de_cdmx_por_resolver'
    falta = [k for k, campo in [('dirección', 'address'), ('coordenadas', 'latitude'), ('horario', 'opening_hours'), ('precio', 'price_min_mxn')] if c.get(campo) in (None, '')]
    reg['falta'] = falta; reg['activo'] = False
    if c['candidate_id'] == 'X0001':
        reg['estado'] = 'corregido_en_catalogo'; reg['coincide_con'] = [{'id': 'cdmx-2229', 'n': 'Casa San Juan', 'cat': 'Antro', 'zona': 'polanco'}]
        reg['nota'] = 'Registro existente corregido: antro en Polanco III Secc, Av. Presidente Masaryk 393 (CDMX Reservas + Mango Mango). Horario y cover sin confirmar.'
    salida.append(reg)

cuenta = collections.Counter(r['estado'] for r in salida)
json.dump({'generado': '2026-10-18', 'catalogo_comparado': len(cat), 'conteo': cuenta, 'registros': salida},
          open(repo + '/reportes/candidatos-cruce.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(cat), 'fichas en el catálogo vigente')
print(dict(cuenta))
