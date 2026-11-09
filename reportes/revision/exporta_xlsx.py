import json, sys, re
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

D = json.load(open(sys.argv[1])); OUT = sys.argv[2]
V = D['venues']
AMB = {'foodie':'Comer rico','nightlife':'Noche y fiesta','chill':'Tranqui','cultural':'Cultural','romántico':'Romántico','familiar':'En familia','social':'Con amigos','joyita':'Joyita','creativo':'Creativo','aventurero':'Aventurero'}
WHO = {'solo':'Solo','date':'Date','amigos':'Amigos','familia':'Familia','compa':'Compañeros'}
DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
def hora(h):
    if h is None: return ''
    h = float(h); m = 1 if h >= 24 else 0; h = h - 24 if h >= 24 else h
    t = f"{int(h):02d}:{int(round((h-int(h))*60)):02d}"
    return t + (' (+1 día)' if m else '')
def dias(v):
    d = v.get('dias'); c = v.get('cerrado')
    if d: s = sorted(set(d))
    elif c: s = [i for i in range(7) if i not in c]
    else: return 'Todos'
    if len(s) == 7: return 'Todos'
    return ', '.join(DIAS[i] for i in [1,2,3,4,5,6,0] if i in s)
def origen(i):
    for p, n in (('xl-','Excel de candidatos'),('pq','Paquete 3-nov-2026'),('iv','Investigados a mano'),('os-','OpenStreetMap'),('ev','Eventos con fecha')):
        if i.startswith(p): return n
    return 'Catálogo base'
def estado(v):
    if v.get('ppUnknown'): return 'Sin precio'
    return {'verificado':'Verificado','rango':'Rango publicado','estimado':'Estimado','inferido':'Inferido','por_confirmar':'Por confirmar'}.get(v.get('pEstado') or '', 'Estimado')

AR = 'Arial'
f = lambda **k: Font(name=AR, size=10, **k)
H_EDIT = PatternFill('solid', fgColor='1F2A44'); H_RO = PatternFill('solid', fgColor='8A8F99'); H_TUYO = PatternFill('solid', fgColor='B8432F')
RO = PatternFill('solid', fgColor='F1F1F1'); TUYO = PatternFill('solid', fgColor='FFF6CC')
thin = Side(style='thin', color='DDDDDD')

COLS = [  # (encabezado, ancho, tipo: e=editable, r=solo lectura, t=tuyo, nota)
 ('ID', 13, 'r', 'No lo cambies: así sé qué lugar es. Para un lugar NUEVO déjalo vacío.'),
 ('Quitar', 8, 't', 'Escribe "Sí" para sacarlo de SOBRES. No borres filas.'),
 ('Nombre', 30, 'e', None), ('Categoría', 16, 'e', 'Usa una de la hoja Listas.'), ('Cocina', 14, 'e', None),
 ('Zona', 22, 'e', 'Una de las 10 zonas (hoja Listas).'), ('Subzona', 16, 'r', 'Zona interna; la recalculo con la dirección.'),
 ('Colonia', 18, 'e', None), ('Dirección', 34, 'e', 'Calle y número. Sin número no entra (regla de ubicación).'),
 ('Precio por persona (MXN)', 12, 'e', 'El más alto del rango; museos a precio para mexicanos.'),
 ('Precio', 11, 'e', 'Verificado (fuente con precio), Rango publicado, Estimado, Inferido (por categoría), Por confirmar o Sin precio.'), ('Fuente del precio', 34, 'e', None), ('Liga del precio', 30, 'e', None),
 ('Fecha del precio', 12, 'e', 'AAAA-MM-DD'), ('Horario', 28, 'e', 'Texto como lo verá la gente.'),
 ('Abre', 9, 'e', 'HH:MM, 24 h.'), ('Cierra', 14, 'e', 'HH:MM, 24 h. Después de medianoche: "02:00 (+1 día)".'),
 ('Días que abre', 20, 'e', 'Todos, o lista: Lun, Mar, Mié, Jue, Vie, Sáb, Dom.'),
 ('Ambientes', 28, 'e', 'Separados por coma (hoja Listas).'), ('Para quién', 24, 'e', 'Solo, Date, Amigos, Familia, Compañeros.'),
 ('Descripción', 48, 'e', None), ('Web', 26, 'e', None), ('Teléfono', 14, 'e', None),
 ('Calificación OpenTable', 10, 'r', None), ('Reseñas OpenTable', 9, 'r', None), ('Hotspot (listas)', 18, 'r', None),
 ('Sale en planes', 9, 'r', 'No = está en el catálogo pero el motor no lo propone (cerrado, sin horario confirmado, etc.).'),
 ('Fuente del lugar', 34, 'e', 'De dónde sale el lugar. Todo lugar nuevo lleva fuente (liga) y fecha.'),
 ('Origen', 16, 'r', None), ('Latitud', 10, 'r', None), ('Longitud', 10, 'r', None),
 ('Tus notas', 30, 't', 'Lo que quieras decirme de este lugar.'),
]
def fila(v):
    return [v['id'], '', v['n'], v['cat'], v.get('cocina') or '', v['_grupo'], v['_zlabel'], v.get('col') or '', v.get('addr') or '',
        None if v.get('ppUnknown') else v.get('pp'), estado(v), v.get('pFuente') or '', v.get('pUrl') or '', v.get('pFecha') or '',
        v.get('hrs') or '', hora((v.get('oh') or [None, None])[0]), hora((v.get('oh') or [None, None])[1]), dias(v),
        ', '.join(AMB.get(t, t) for t in v.get('tags') or []), ', '.join(WHO.get(w, w) for w in v.get('who') or []),
        v.get('d') or '', v.get('web') or '', v.get('tel') or '', v.get('otRt'), v.get('otRc'),
        ', '.join(v.get('hotF') or []) if v.get('hot') else '', 'Sí' if v['_rec'] else 'No', v.get('src') or '', origen(v['id']),
        v.get('lat'), v.get('lng'), '']

ZORD = [g[0] for g in D['grupos']]
lug = sorted([v for v in V if not v.get('evento')], key=lambda v: (ZORD.index(v['_grupo']) if v['_grupo'] in ZORD else 99, v['cat'], v['n'].lower()))
eve = sorted([v for v in V if v.get('evento')], key=lambda v: ((v.get('fechas') or {}).get('desde') or '', v['n']))

wb = Workbook()
# ── Léeme ──
L = wb.active; L.title = 'Léeme'
txt = [
 ('Catálogo de SOBRES', Font(name=AR, size=16, bold=True)),
 (f'Exportado el 9-nov-2026 de la app tal como la usa el motor: {len(lug):,} lugares (hoja Lugares) y {len(eve)} eventos con fecha (hoja Eventos).', f()),
 ('', f()),
 ('Cómo editarlo', Font(name=AR, size=12, bold=True)),
 ('1. Cambiar un dato: edita la celda en la hoja Lugares. No cambies la columna ID.', f()),
 ('2. Quitar un lugar: escribe "Sí" en la columna Quitar. No borres la fila (así sé cuál fue).', f()),
 ('3. Agregar un lugar: al final de Lugares, deja ID vacío y llena Nombre, Categoría, Zona, Colonia, Dirección con número, Precio, Horario y Fuente del lugar con liga y fecha.', f()),
 ('4. Columnas con encabezado azul oscuro: puedes editarlas. Gris: las calcula la app (si las cambias, las ignoro). Rojo (Quitar, Tus notas): son para ti.', f()),
 ('5. Cuando termines, mándamelo de regreso tal cual (.xlsx).', f()),
 ('', f()),
 ('Qué hago yo cuando me lo regreses', Font(name=AR, size=12, bold=True)),
 ('• Te mando primero un resumen: cuántos cambios, altas y bajas, y lo que no pude aplicar y por qué. Nada se publica sin tu "aprobado".', f()),
 ('• Lugares nuevos: verifico la dirección con número (si no hay número no entra) y les pongo zona según su ubicación.', f()),
 ('• Precios sin fuente quedan como "Estimado". Lo que tú pongas como fundador queda con fuente "Referencia del fundador de SOBRES" y la fecha.', f()),
 ('• Los eventos (hoja Eventos) son sólo de consulta: los actualizo yo desde sus fuentes y caducan solos.', f()),
 ('', f()),
 ('Ejemplo de una fila bien llenada (es un lugar que ya está en el catálogo):', Font(name=AR, size=10, bold=True)),
]
for i, (t, fo) in enumerate(txt, 1):
    c = L.cell(row=i, column=1, value=t); c.font = fo; c.alignment = Alignment(wrap_text=True, vertical='top')
L.column_dimensions['A'].width = 120
ej = next((v for v in lug if v['n'] == 'Fonda Fina'), lug[0]); r0 = len(txt) + 1
for j, (h, w, k, n) in enumerate(COLS[:22]):
    L.cell(row=r0 + j, column=1, value=f'{h}: {fila(ej)[j] if fila(ej)[j] not in (None, "") else "(vacío)"}').font = f()

# ── Lugares / Eventos ──
def hoja(nombre, filas):
    ws = wb.create_sheet(nombre)
    for j, (h, w, k, n) in enumerate(COLS, 1):
        c = ws.cell(row=1, column=j, value=h)
        c.font = Font(name=AR, size=10, bold=True, color='FFFFFF'); c.fill = {'e': H_EDIT, 'r': H_RO, 't': H_TUYO}[k]
        c.alignment = Alignment(wrap_text=True, vertical='center')
        if n: c.comment = Comment(n, 'SOBRES')
        ws.column_dimensions[get_column_letter(j)].width = w
    ws.row_dimensions[1].height = 42
    for i, v in enumerate(filas, 2):
        for j, val in enumerate(fila(v), 1):
            c = ws.cell(row=i, column=j, value=val); c.font = f()
            k = COLS[j - 1][2]
            if k == 'r': c.fill = RO
            elif k == 't': c.fill = TUYO
        ws.cell(row=i, column=10).number_format = '$#,##0'
    ws.freeze_panes = 'D2'; ws.auto_filter.ref = f'A1:{get_column_letter(len(COLS))}{len(filas) + 1}'
    return ws
WL = hoja('Lugares', lug)
WE = hoja('Eventos', eve)
WE.insert_cols(3); WE.cell(row=1, column=3, value='Fechas').font = Font(name=AR, size=10, bold=True, color='FFFFFF'); WE.cell(row=1, column=3).fill = H_RO
for i, v in enumerate(eve, 2):
    fe = v.get('fechas') or {}; WE.cell(row=i, column=3, value=(fe.get('desde') or '') + (' a ' + fe['hasta'] if fe.get('hasta') and fe.get('hasta') != fe.get('desde') else '')).font = f()
WE.column_dimensions['C'].width = 24

# ── Listas ──
LS = wb.create_sheet('Listas')
cats = sorted({v['cat'] for v in V})
listas = [('Zonas', ZORD), ('Categorías', cats), ('Ambientes', list(AMB.values())), ('Para quién', list(WHO.values())),
          ('Precio', ['Verificado', 'Rango publicado', 'Estimado', 'Inferido', 'Por confirmar', 'Sin precio']), ('Quitar', ['Sí'])]
for j, (h, vals) in enumerate(listas, 1):
    c = LS.cell(row=1, column=j, value=h); c.font = Font(name=AR, size=10, bold=True, color='FFFFFF'); c.fill = H_EDIT
    for i, x in enumerate(vals, 2): LS.cell(row=i, column=j, value=x).font = f()
    LS.column_dimensions[get_column_letter(j)].width = 24
zc = len(COLS) + 2  # subzonas por zona
LS.cell(row=1, column=8, value='Zona').font = Font(name=AR, size=10, bold=True); LS.cell(row=1, column=9, value='Incluye (subzonas internas)').font = Font(name=AR, size=10, bold=True)
zl = dict(D['zonas'])
for i, (g, zs) in enumerate(D['grupos'], 2):
    LS.cell(row=i, column=8, value=g).font = f(); LS.cell(row=i, column=9, value=', '.join(zl.get(z, z) for z in zs)).font = f()
LS.column_dimensions['H'].width = 24; LS.column_dimensions['I'].width = 50

n = len(lug) + 500
def dv(ws, col, rng, n):
    d = DataValidation(type='list', formula1=rng, allow_blank=True, showErrorMessage=True, errorStyle='warning',
                       error='Ese valor no está en la hoja Listas.'); ws.add_data_validation(d); d.add(f'{col}2:{col}{n}')
dv(WL, 'B', '=Listas!$F$2:$F$2', n); dv(WL, 'D', f'=Listas!$B$2:$B${len(cats)+1}', n)
dv(WL, 'F', f'=Listas!$A$2:$A${len(ZORD)+1}', n); dv(WL, 'K', '=Listas!$E$2:$E$7', n)
wb.save(OUT)
print(len(lug), len(eve))
