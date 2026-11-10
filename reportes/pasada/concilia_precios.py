#!/usr/bin/env python3
"""Conciliación por ID de precios: base exportada vs Excel revisado vs data/revision.js (10 nov 2026)."""
import json, os, re, sys
from collections import Counter
from openpyxl import load_workbook
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
def filas(p, hoja='Lugares'):
    ws = load_workbook(p)[hoja]; enc = [c.value for c in ws[1]]
    return [dict(zip(enc, r)) for r in ws.iter_rows(min_row=2, values_only=True) if any(x not in (None, '') for x in r)]
B = {f['ID']: f for f in filas(os.path.join(RAIZ, 'reportes/revision/base_9nov2026.xlsx'))}
R = [f for f in filas(os.path.join(RAIZ, 'reportes/revision/revisado_9nov2026.xlsx'))]
txt = open(os.path.join(RAIZ, 'data/revision.js')).read(); REV = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
print('Excel revisado: filas', len(R), '· con ID', sum(1 for f in R if f['ID']))
print('Estado en la BASE     :', Counter(f['Precio'] for f in B.values()))
print('Estado en el REVISADO :', Counter(f['Precio'] for f in R))
print('Revisado con número de precio:', sum(1 for f in R if f['Precio por persona (MXN)'] is not None), '· sin número:', sum(1 for f in R if f['Precio por persona (MXN)'] is None))
x = Counter()
for f in R:
    if f['ID'] not in B: continue
    b = B[f['ID']]
    x[(b['Precio'], 'con$' if b['Precio por persona (MXN)'] is not None else 'sin$', '→', f['Precio'], 'con$' if f['Precio por persona (MXN)'] is not None else 'sin$', 'QUITAR' if f['Quitar'] else '')] += 1
print('\nTransiciones base → revisado (estado, con/sin número):')
for k, n in sorted(x.items(), key=lambda kv: -kv[1]): print('  %4d  %s' % (n, ' '.join(k)))
# notas PRECIO
np_ = Counter()
for f in R:
    for s in (f.get('Tus notas') or '').split(' | '):
        if s.strip().startswith('PRECIO ·'): np_[re.sub(r'\$[\d,\.]+', '$N', s.strip())[:95]] += 1
print('\nNotas PRECIO:'); [print('  %4d  %s' % (n, k)) for k, n in np_.most_common(8)]
# lo que hizo el importador
pr = {i: c['pr'] for i, c in REV['cambios'].items() if 'pr' in c}
print('\nImportador: fichas con cambio de precio', len(pr), '· quedaron por_confirmar', sum(1 for p in pr.values() if p['estado'] == 'por_confirmar'),
      '· de ellas el Excel decía Estimado:', sum(1 for i, p in pr.items() if p['estado'] == 'por_confirmar' and next((f for f in R if f['ID'] == i), {}).get('Precio') == 'Estimado'))
perd = [f for f in R if f['ID'] in B and B[f['ID']]['Precio por persona (MXN)'] is not None and f['Precio por persona (MXN)'] is None and not f['Quitar']]
print('Fichas que tenían número en la base y el Excel se lo quitó (sin contar bajas):', len(perd), Counter(f['Precio'] for f in perd))
print('  de ésas, con fuente OpenTable en la base:', sum(1 for f in perd if 'opentable' in ((B[f['ID']]['Fuente del precio'] or '') + (B[f['ID']]['Liga del precio'] or '')).lower()))
print('  ejemplos:', [(f['Nombre'], B[f['ID']]['Precio por persona (MXN)'], B[f['ID']]['Precio'], '→', f['Precio'], (f['Tus notas'] or '')[:80]) for f in perd[:4]])
est = [f for f in R if f['Precio'] == 'Estimado']
print('\nEstimado en el revisado:', len(est), '· con número', sum(1 for f in est if f['Precio por persona (MXN)'] is not None))
print('  ejemplos:', [(f['Nombre'], f['Precio por persona (MXN)'], f['Fuente del precio']) for f in est[:5]])
