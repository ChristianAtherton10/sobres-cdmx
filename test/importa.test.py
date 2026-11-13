# Pruebas del importador del Excel de pendientes (13 nov 2026). No usa red.
import sys, os, tempfile, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'reportes', 'pasada'))
import importa_pendientes as I
from openpyxl import Workbook

fallos = []
def check(cond, msg):
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: fallos.append(msg)

print('\nImportador · horario por día')
p, e = I.horario('Lun–jue 13:00–23:00. Vie–sáb 13:00–01:00. Dom cerrado')
check(e is None and p[1] == [13, 23] and p[5] == [13, 25] and 0 not in p and len(p) == 6, 'lun–jue, vie–sáb pasada la medianoche y domingo cerrado')
p, e = I.horario('Diario 10:00-18:00')
check(e is None and len(p) == 7 and p[0] == [10, 18], 'diario')
p, e = I.horario('Mar a dom 9 am a 5 pm; lun cerrado')
check(e is None and sorted(p) == [0, 2, 3, 4, 5, 6] and p[2] == [9, 17], 'mar a dom con am/pm')
p, e = I.horario('Sáb y dom 11:00–15:00')
check(e is None and sorted(p) == [0, 6], 'sáb y dom')
p, e = I.horario('abre tarde, cierra cuando se acaba')
check(p is None and e, 'un horario que no se entiende NO se adivina')
check(I.numero('$300-500') == 500 and I.numero(350) == 350 and I.numero('') is None, 'precio: un número; de un rango, el alto')

print('\nImportador · del Excel a la capa de verificados')
COLS = ['Prioridad', 'ID', 'Nombre', 'Categoría', 'Zona', 'Colonia', 'Qué falta para salir con tope', 'Motivo de la pausa', 'Dato actual (precio · horario)', 'Web',
        'Precio por persona (MXN)', 'Qué incluye', 'Unidad', 'Cover (MXN)', 'Extras obligatorios', 'Fuente del precio (liga)', 'Horario por día', 'Último acceso / cocina cierra',
        'Sesiones u horarios de función', 'Dirección con número', 'Fuente del horario/dirección (liga)', 'Fecha de verificación', 'Notas']
def fila(**k): return [k.get(c, None) for c in COLS]
wb = Workbook(); wb.active.title = 'Léeme'; ws = wb.create_sheet('Pendientes'); ws.append(COLS)
ws.append(fila(**{'ID': 'a-1', 'Nombre': 'Restaurante con liga', 'Categoría': 'Restaurante', 'Precio por persona (MXN)': 450, 'Qué incluye': 'Plato fuerte y bebida',
                  'Fuente del precio (liga)': 'https://ejemplo.mx/menu', 'Horario por día': 'Lun–sáb 13:00–23:00. Dom cerrado', 'Último acceso / cocina cierra': '22:00', 'Fecha de verificación': '2026-11-12'}))
ws.append(fila(**{'ID': 'a-2', 'Nombre': 'Antro sin liga', 'Categoría': 'Antro', 'Precio por persona (MXN)': '300-500', 'Cover (MXN)': 200}))
ws.append(fila(**{'ID': 'a-3', 'Nombre': 'Boliche por pista', 'Categoría': 'Boliche', 'Precio por persona (MXN)': 800, 'Unidad': 'grupo', 'Fuente del precio (liga)': 'https://ejemplo.mx/pistas', 'Fecha de verificación': '2026-11-12'}))
ws.append(fila(**{'ID': 'a-4', 'Nombre': 'Sin llenar', 'Categoría': 'Bar'}))
ws.append(fila(**{'ID': 'a-5', 'Nombre': 'Horario raro', 'Categoría': 'Bar', 'Horario por día': 'a veces', 'Dirección con número': 'Calle Falsa 123', 'Fecha de verificación': '2026-11-12'}))
ws.append(fila(**{'ID': 'a-6', 'Nombre': 'Taller', 'Categoría': 'Taller', 'Sesiones u horarios de función': 'Sáb 11:00 y 16:00', 'Fecha de verificación': '2026-11-12'}))
ruta = os.path.join(tempfile.mkdtemp(), 'pend.xlsx'); wb.save(ruta)
I.GEO = os.path.join(os.path.dirname(ruta), 'geo.json')
s = I.importa(ruta, red=False, hoy='2026-11-13'); it = s['items']
check(set(it) == {'a-1', 'a-2', 'a-3', 'a-6'}, 'sólo entran filas con datos aplicables, por su ID: ' + str(sorted(it)))
a1 = it['a-1']
check(a1['estado'] == 'verificado' and a1['precio']['rep'] == 450 and a1['url'] == 'https://ejemplo.mx/menu' and a1['fecha'] == '2026-11-12', 'precio con liga = verificado, con fuente y fecha')
check(a1['resuelve'] == ['horario'] and a1['dias'] == [1, 2, 3, 4, 5, 6] and a1['oh'] == [13, 23] and a1['cocinaCierra'] == 22, 'horario resuelve «horario»; cocina cierra 22:00')
a2 = it['a-2']
check(a2['estado'] == 'estimado' and a2['precio']['rep'] == 700 and 'cover' in a2['precio']['canasta'].lower() and a2['fecha'] == '2026-11-13', 'sin liga = ESTIMADO; rango → el alto; el cover se suma y se dice')
check(it['a-3']['precio']['unidad'] == 'grupo' and it['a-3']['precio']['rep'] == 800, 'precio por grupo conserva la unidad')
check(it['a-6']['resuelve'] == ['sesion'] and 'Sáb 11:00' in it['a-6']['condicion'], 'sesiones → «reserva o elige tu horario»')
av = ' | '.join(s['avisos'])
check('a-5' in av and 'horario no aplicado' in av and 'ubicación sigue pendiente' in av, 'lo que no se entiende o no se confirma sale en avisos, no en el catálogo')
check('a-2' in av and 'ESTIMADO' in av, 'avisa qué precios entraron como estimados')

print('\n' + ('✓ todas pasaron' if not fallos else '✗ fallaron: ' + '; '.join(fallos)))
sys.exit(1 if fallos else 0)
