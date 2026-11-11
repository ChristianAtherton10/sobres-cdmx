#!/usr/bin/env python3
"""Excel priorizado de lo que falta verificar para que cada ficha pueda salir en planes con tope de presupuesto.
Uso: node reportes/pasada/dump_vivo.js && python3 reportes/pasada/pendientes.py <salida.xlsx>
Prioridad = cuánto destraba: zonas con menos salidas completas, tipos de actividad escasos, hotspots, y
fichas a las que les falta UN solo dato."""
import json, os, re, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
AQUI = os.path.dirname(os.path.abspath(__file__))
V = json.load(open(os.path.join(AQUI, 'catalogo_vivo.json')))
OUT = sys.argv[1]
ZONA_PESO = {'Del Valle · Nápoles': 5, 'Lomas · Tecamachalco': 5, 'Xochimilco': 4, 'San Ángel': 4, 'Satélite · Naucalpan': 3, 'Santa Fe · Poniente': 3,
             'Coyoacán · CU': 2, 'Polanco · Chapultepec': 2, 'Juárez · Centro': 2, 'Roma · Condesa': 2}
CAT_PESO = {'Taller': 6, 'Escape room': 5, 'Boliche': 5, 'Billar': 4, 'Cine': 4, 'Atracción': 4, 'Antro': 4, 'Salón de baile': 4, 'Heladería': 3, 'Taquería': 3,
            'Bar de autor': 3, 'Speakeasy': 3, 'Rooftop': 3, 'Bar': 2, 'Cantina': 2, 'Café': 2, 'Galería': 2, 'Museo': 2, 'Centro cultural': 1, 'Restaurante': 2, 'Parque': 2, 'Mercado': 2}
def motivos(p):
    t = (p or '').lower(); m = []
    if 'horario' in t: m.append('horario')
    if re.search(r'direcci|geocodificar|\bpin\b|acceso espec|ubicaci', t): m.append('ubicación')
    if re.search(r'funci|sesi|cupo|reserv|taquilla|boleto|disponibilidad|cartelera|turno', t): m.append('función o sesión')
    return m
filas = []
for v in V:
    if v.get('evento') or v.get('_sede'): continue
    falta = []
    pausa = v.get('pausa') or ''
    if pausa: falta += motivos(pausa)
    elif not v.get('_rec'): continue          # fuera de planes por otra razón (acervo, biblioteca escolar, cerrado): no es un pendiente de datos
    if v.get('_resp') in ('pendiente', 'debil'): falta.append('precio' if v.get('_resp') == 'pendiente' else 'precio (hoy es una cifra sin fuente)')
    if v.get('_cover'): falta.append('cover')
    if v.get('horaEstimada') and 'horario' not in falta: falta.append('horario')
    if v.get('coordAprox') and 'ubicación' not in falta: falta.append('ubicación')
    if not falta: continue
    pr = ZONA_PESO.get(v.get('_grupo'), 1) + CAT_PESO.get(v['cat'], 1) + (4 if v.get('hot') else 0) + (3 if len(falta) == 1 else 0) + (2 if v.get('_plaza') else 0)
    filas.append((pr, v, falta))
filas.sort(key=lambda x: (-x[0], x[1].get('_grupo') or '', x[1]['cat'], x[1]['n']))
AR = 'Arial'; f = lambda **k: Font(name=AR, size=10, **k)
H1 = PatternFill('solid', fgColor='8A8F99'); H2 = PatternFill('solid', fgColor='1F2A44'); RO = PatternFill('solid', fgColor='F1F1F1'); ED = PatternFill('solid', fgColor='FFF6CC')
COLS = [('Prioridad', 9, 'r'), ('ID', 14, 'r'), ('Nombre', 30, 'r'), ('Categoría', 15, 'r'), ('Zona', 21, 'r'), ('Colonia', 17, 'r'), ('Qué falta para salir con tope', 34, 'r'),
        ('Motivo de la pausa', 34, 'r'), ('Dato actual (precio · horario)', 30, 'r'), ('Web', 26, 'r'),
        ('Precio por persona (MXN)', 12, 'e'), ('Qué incluye', 26, 'e'), ('Unidad', 11, 'e'), ('Cover (MXN)', 9, 'e'), ('Extras obligatorios', 18, 'e'),
        ('Fuente del precio (liga)', 30, 'e'), ('Horario por día', 34, 'e'), ('Último acceso / cocina cierra', 16, 'e'), ('Sesiones u horarios de función', 22, 'e'),
        ('Dirección con número', 28, 'e'), ('Fuente del horario/dirección (liga)', 30, 'e'), ('Fecha de verificación', 12, 'e'), ('Notas', 26, 'e')]
wb = Workbook(); L = wb.active; L.title = 'Léeme'
txt = ['Pendientes por verificar — SOBRES (10 nov 2026)',
 f'{len(filas):,} fichas a las que les falta al menos un dato para poder salir en planes CON tope de presupuesto. Ordenadas por lo que más destraba.',
 '',
 'Cómo llenarlo', '1. Columnas grises: lo que hay hoy (no las cambies; el ID identifica la ficha).', '2. Columnas amarillas: lo que verifiques, con su liga y la fecha (AAAA-MM-DD).',
 '3. Precio: lo que paga UNA persona. Si se cobra por grupo (mesa, lancha, cuarto), pon "grupo" en Unidad y el precio del grupo: SOBRES lo divide una sola vez entre quienes van.',
 '4. Qué incluye: consumo, entrada, boleto, clase… Si hay cover o un extra obligatorio (renta de equipo, zapatos), va en su columna.',
 '5. Horario por día: "Lun–jue 13:00–23:00. Vie–sáb 13:00–01:00. Dom cerrado". Último acceso o cierre de cocina si es distinto al cierre.',
 '6. Talleres y funciones: horarios de sesión o la liga del calendario; SOBRES los propone como "reserva tu sesión".',
 '',
 'Qué pasa al regresarlo', '• Cada dato entra con su fuente y fecha, sin cambiar el ID.',
 '• Una ficha en pausa se reactiva sólo cuando quedan resueltos TODOS sus motivos (horario, ubicación, función o sesión).',
 '• Una ficha con precio verificado ya puede entrar en planes con tope; sin precio sólo sale en "Sin presupuesto" o si la persona acepta "precio por confirmar".',
 '',
 'Prioridad', 'Suma: zona con pocas salidas completas (Del Valle y Lomas pesan más) + tipo de actividad escaso (talleres, escape rooms, boliche, cine, antros) + hotspot + le falta un solo dato + está en una plaza.']
for i, t in enumerate(txt, 1):
    c = L.cell(row=i, column=1, value=t); c.font = Font(name=AR, size=16 if i == 1 else 10, bold=(i == 1 or t in ('Cómo llenarlo', 'Qué pasa al regresarlo', 'Prioridad'))); c.alignment = Alignment(wrap_text=True, vertical='top')
L.column_dimensions['A'].width = 130
ws = wb.create_sheet('Pendientes')
for j, (h, w, k) in enumerate(COLS, 1):
    c = ws.cell(row=1, column=j, value=h); c.font = Font(name=AR, size=10, bold=True, color='FFFFFF'); c.fill = H1 if k == 'r' else H2
    c.alignment = Alignment(wrap_text=True, vertical='center'); ws.column_dimensions[get_column_letter(j)].width = w
ws.row_dimensions[1].height = 40
for i, (pr, v, falta) in enumerate(filas, 2):
    actual = ('sin precio' if v.get('ppUnknown') else '$' + str(v.get('pp')) + ' ' + (v.get('pEstado') or '')) + ' · ' + (v.get('hrs') or '')[:60]
    vals = [pr, v['id'], v['n'], v['cat'], v.get('_grupo') or '', v.get('col') or '', ', '.join(dict.fromkeys(falta)), v.get('pausa') or '', actual, v.get('web') or v.get('pUrl') or '']
    for j, val in enumerate(vals + [''] * (len(COLS) - len(vals)), 1):
        c = ws.cell(row=i, column=j, value=val); c.font = f(); c.fill = RO if COLS[j - 1][2] == 'r' else ED
ws.freeze_panes = 'D2'; ws.auto_filter.ref = f'A1:{get_column_letter(len(COLS))}{len(filas) + 1}'
d = DataValidation(type='list', formula1='"persona,grupo"', allow_blank=True); ws.add_data_validation(d); d.add(f'M2:M{len(filas) + 1}')
# resumen por zona
R = wb.create_sheet('Resumen')
from collections import Counter
cz = Counter(); cf = Counter()
for pr, v, falta in filas:
    cz[v.get('_grupo') or '—'] += 1
    for x in dict.fromkeys(falta): cf[x] += 1
R.cell(row=1, column=1, value='Zona').font = f(bold=True); R.cell(row=1, column=2, value='Fichas pendientes').font = f(bold=True)
for i, (k, n) in enumerate(cz.most_common(), 2): R.cell(row=i, column=1, value=k).font = f(); R.cell(row=i, column=2, value=n).font = f()
R.cell(row=1, column=4, value='Qué falta').font = f(bold=True); R.cell(row=1, column=5, value='Fichas').font = f(bold=True)
for i, (k, n) in enumerate(cf.most_common(), 2): R.cell(row=i, column=4, value=k).font = f(); R.cell(row=i, column=5, value=n).font = f()
R.cell(row=len(cz) + 3, column=1, value='Total').font = f(bold=True); R.cell(row=len(cz) + 3, column=2, value=f'=SUM(B2:B{len(cz) + 1})').font = f(bold=True)
for c, w in (('A', 26), ('B', 18), ('D', 36), ('E', 10)): R.column_dimensions[c].width = w
wb.save(OUT); print(len(filas), 'pendientes', dict(cf.most_common()))
