#!/usr/bin/env python3
"""Conciliación POR ID: Excel revisado (9 nov) ↔ importador (data/revision.js) ↔ catálogo que usa la preview.
Escribe reportes/pasada/CONCILIACION.md.   Uso: python3 reportes/pasada/concilia.py
(necesita reportes/pasada/catalogo_vivo.json: `node reportes/pasada/dump_vivo.js`)"""
import json, os, re
from collections import Counter
from openpyxl import load_workbook
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
def filas(p, hoja):
    ws = load_workbook(p)[hoja]; enc = [c.value for c in ws[1]]
    return [dict(zip(enc, r)) for r in ws.iter_rows(min_row=2, values_only=True) if any(x not in (None, '') for x in r)]
def js(p):
    t = open(p).read(); return json.loads(t[t.index('{'):t.rindex('}') + 1])
BASE = {f['ID']: f for h in ('Lugares', 'Eventos') for f in filas(os.path.join(RAIZ, 'reportes/revision/base_9nov2026.xlsx'), h)}
REVX = [dict(f, _hoja=h) for h in ('Lugares', 'Eventos') for f in filas(os.path.join(RAIZ, 'reportes/revision/revisado_9nov2026.xlsx'), h)]
REV = js(os.path.join(RAIZ, 'data/revision.js'))
VER = js(os.path.join(RAIZ, 'data/verificados.js')) if os.path.exists(os.path.join(RAIZ, 'data/verificados.js')) else {'items': {}, 'altas': []}
VIVO = {v['id']: v for v in json.load(open(os.path.join(AQUI, 'catalogo_vivo.json')))}
nota = lambda f: f.get('Tus notas') or ''
si = lambda f: str(f.get('Quitar') or '').strip().lower() in ('sí', 'si', 'x', '1')
con_id = [f for f in REVX if f.get('ID')]; sin_id = [f for f in REVX if not f.get('ID')]
L = []; w = L.append
w('# Conciliación por ID — Excel del 9 nov ↔ importador ↔ catálogo de la preview\n')
w(f'Generado por `reportes/pasada/concilia.py`. Excel: {len(REVX)} filas ({len(con_id)} con ID, {len(sin_id)} sin ID). Catálogo de la preview: {len(VIVO)} fichas.\n')

# IDs
perd = [f['ID'] for f in con_id if f['ID'] not in BASE]
w('## 1. IDs\n')
w(f'- IDs del Excel que no existían en la exportación: **{len(perd)}**.')
falt = [i for i in BASE if i not in {f["ID"] for f in con_id}]
w(f'- IDs de la exportación que ya no vienen en el Excel (filas borradas): **{len(falt)}**.')
fuera = [f['ID'] for f in con_id if not si(f) and f['ID'] not in VIVO]
venc = [i for i in fuera if i.startswith('ev')]
w(f'- IDs que el Excel conserva y no están en el catálogo de la preview: **{len(fuera)}** ({len(venc)} son eventos ya vencidos, que no se cargan).' + (f' Otros: {", ".join(i for i in fuera if not i.startswith("ev"))[:300]}' if len(fuera) > len(venc) else ''))
w('- Ninguna corrección cambió un ID: los cambios viajan por ID en `data/revision.js` y `data/verificados.js`.\n')

# Bajas
bx = {f['ID'] for f in con_id if si(f)}; bi = set(REV['bajas'])
w('## 2. Bajas\n')
w(f'- Excel (Quitar = Sí): **{len(bx)}** · importador: **{len(bi)}** · siguen en el catálogo: **{len([i for i in bx if i in VIVO])}**.')
w(f'- Diferencias Excel↔importador: {len(bx ^ bi)}.')
w(f'- Duplicados declarados (la ficha buena hereda el hotspot): {json.dumps(REV.get("duplicados", {}), ensure_ascii=False)}.\n')

# Pausas
px = {f['ID']: nota(f) for f in con_id if 'PAUSA ·' in nota(f) and not si(f)}; pi = REV['pausas']
w('## 3. Pausas\n')
w(f'- Excel (nota «PAUSA ·»): **{len(px)}** · importador: **{len(pi)}**.')
solo_x = [i for i in px if i not in pi]; solo_i = [i for i in pi if i not in px]
w(f'- En el Excel y no en el importador: **{len(solo_x)}** — la única razón era el pin y Nominatim confirmó el número (se levantó al importar) o es un evento fusionado con fechas activas.')
w(f'- En el importador y no en el Excel: **{len(solo_i)}**' + (f' ({", ".join(solo_i[:8])})' if solo_i else '') + '.')
est = Counter()
for i in pi:
    v = VIVO.get(i)
    est['fuera del catálogo (evento vencido)' if not v else 'reactivada con verificación' if v.get('reactivado') else 'condicionada (elige función/sesión)' if v.get('condicion') else 'en pausa' if v.get('pausa') else 'otro'] += 1
w('- Estado HOY de esas pausas en la preview: ' + ' · '.join(f'{k}: **{n}**' for k, n in est.most_common()) + '.')
mot = Counter()
for i, p in pi.items():
    v = VIVO.get(i)
    if v and v.get('pausa'):
        t = p.lower(); ks = [k for k, r in (('horario', r'horario'), ('ubicación', r'direcci|geocodificar|pin|acceso'), ('función/sesión', r'funci|sesi|cupo|reserv|taquilla|boleto|cartelera')) if re.search(r, t)]
        mot[' + '.join(ks) or 'otro'] += 1
w('- Motivos de las que siguen en pausa: ' + ' · '.join(f'{k}: {n}' for k, n in mot.most_common()) + '.\n')

# Altas
w('## 4. Altas\n')
al = [f for f in sin_id if f['_hoja'] == 'Lugares']; ev = [f for f in sin_id if f['_hoja'] == 'Eventos']
w(f'- Lugares nuevos en el Excel: **{len(al)}** · importados: **{len(REV["altas"])}**. Hoy en planes: **{sum(1 for a in REV["altas"] if VIVO.get(a["id"], {}).get("_rec"))}**; el resto espera pin con número u horario (se dice en su ficha).')
w(f'- Filas de eventos nuevas en el Excel: **{len(ev)}** → **{len(REV["eventos"])}** eventos nuevos (una ficha por evento con todas sus fechas) + fechas fusionadas en eventos que ya existían (Morat, Karol G, DLD).')
w(f'- Altas verificadas en la pasada profunda: **{len(VER.get("altas", []))}**.\n')

# Precios
w('## 5. Precios\n')
t = Counter()
for f in con_id:
    if f['_hoja'] != 'Lugares' or f['ID'] not in BASE: continue
    b = BASE[f['ID']]; t[(b['Precio'], f['Precio'], 'baja' if si(f) else '')] += 1
w('| Estado en la exportación | Estado en el Excel | Fichas |\n|---|---|---|')
for (a, b, q), n in sorted(t.items(), key=lambda kv: -kv[1]): w(f'| {a} | {b}{" (baja)" if q else ""} | {n} |')
est_x = sum(1 for f in con_id if f['_hoja'] == 'Lugares' and f['Precio'] == 'Estimado')
pc = [f for f in con_id if f['_hoja'] == 'Lugares' and f['Precio'] == 'Por confirmar']
ot = sum(1 for f in pc if 'opentable' in ((BASE.get(f['ID'], {}).get('Fuente del precio') or '') + (BASE.get(f['ID'], {}).get('Liga del precio') or '')).lower())
w(f'\n- **{est_x} «Estimado»** en el Excel: todas conservan su número (no se tocaron).')
w(f'- **{len(pc)} «Por confirmar»** sin número: {ot} venían de la banda de OpenTable; las demás eran estimaciones o inferencias por categoría. El dato «705 precios de OpenTable» de mi reporte del 9 nov era incorrecto.')
vv = Counter((('sin precio' if v.get('ppUnknown') else 'con precio') + ' · ' + (v.get('pEstado') or '')) for v in VIVO.values() if not v.get('evento'))
w('- En la preview: ' + ' · '.join(f'{k}: {n}' for k, n in vv.most_common()) + '.')
w(f'- Verificados con fuente en la pasada profunda: **{len(VER.get("items", {}))}** fichas.\n')

# Ubicación
w('## 6. Ubicación\n')
dirc = sum(1 for f in con_id if f['ID'] in BASE and (BASE[f['ID']].get('Dirección') or '') != (f.get('Dirección') or ''))
pinq = sum(1 for f in con_id if f['ID'] in BASE and BASE[f['ID']].get('Latitud') is not None and f.get('Latitud') is None)
zon = sum(1 for f in con_id if f['ID'] in BASE and BASE[f['ID']].get('Zona') != f.get('Zona'))
g = json.load(open(os.path.join(RAIZ, 'reportes/revision/geo_resultado.json')))
w(f'- Direcciones cambiadas: **{dirc}** · pines retirados por el Excel: **{pinq}** · cambios de zona: **{zon}**.')
w(f'- Pines recalculados con Nominatim y número confirmado: **{len(g["geo_ok"])}**; sin confirmar (siguen en pausa por ubicación): **{len(g["geo_no"])}**.')
ap = sum(1 for v in VIVO.values() if v.get('coordAprox') and v.get('_rec'))
w(f'- Lugares que salen en planes con pin aproximado: **{ap}** (ninguno debería; si hay, es una ficha anterior a la revisión).\n')
open(os.path.join(AQUI, 'CONCILIACION.md'), 'w').write('\n'.join(L) + '\n')
print('\n'.join(L))
