#!/usr/bin/env python3
"""Verificados de la pasada profunda (10 nov 2026) → data/verificados.js

Cada entrada conserva el ID de la ficha y trae fuente (liga) + fecha. `resuelve` dice qué motivos de
pausa quedan resueltos (horario, ubicacion, sesion): la ficha se reactiva sólo si se resuelven TODOS.
`activar` levanta la pausa propia de un alta del Excel cuando ya tiene pin con número y horario publicado.
Pines: reportes/pasada/pines.json (Nominatim con número confirmado, o número vecino de la misma calle).

Uso: python3 reportes/pasada/build_verificados.py
"""
import json, os
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
FECHA = '2026-11-10'
PINES = json.load(open(os.path.join(AQUI, 'pines.json'))) if os.path.exists(os.path.join(AQUI, 'pines.json')) else {}
MDT = dict(fuente='Manos de Tierra — sucursales (sitio oficial)', url='https://www.manosdetierraceramica.mx/sucursales', oh=[10, 13],
           hrs='Lun a vie 10:00–14:00 y 17:00–21:00 · sáb y dom 9:00–13:00 · sesión de 2 horas con reserva', duracionMin=120,
           condicion='Reserva tu sesión de dos horas en el calendario de la sucursal.')
ITEMS = {
  # ── precio y horario con el sitio oficial ──
  'cdmx-2047': dict(n='Acuario Inbursa', estado='rango', precio=dict(min=260, rep=260, max=260, unidad='persona', moneda='MXN',
                    canasta='Pase General comprado en línea: desde $260 por persona. En taquilla o con extras puede costar más.'),
                    fuente='Acuario Inbursa — sitio oficial (Pase General en línea)', url='https://www.acuarioinbursa.com.mx/', oh=[10, 18], hrs='Diario 10:00–18:00',
                    addr='Blvd. Miguel de Cervantes Saavedra 386', col='Granada'),
  # ── horario oficial (el precio sigue por confirmar: no lo publican) ──
  'cdmx-3032': dict(n='Taller Experimental de Cerámica', fuente='Visit Mexico City (portal oficial de turismo de CDMX) — Taller Experimental de Cerámica Díaz de Cossío',
                    url='https://mexicocity.cdmx.gob.mx/venues/experimental-ceramics/', oh=[10, 14], dias=[1, 2, 3, 4, 5, 6], hrs='Lun a vie 10:00–17:00 · sáb 10:00–14:00',
                    addr='Centenario 63', col='Del Carmen', web='https://ceramicadiazdecossio.com.mx/', tel='55 5555 4696'),
  # ── horario y pin de OpenStreetMap: la ficha de OSM era la misma taquería, mal clasificada como café (se da de baja abajo) ──
  'cdmx-2028': dict(n='Taquería Los Parados', fuente='OpenStreetMap — ficha del lugar (nodo 11770329070)', url='https://www.openstreetmap.org/node/11770329070',
                    oh=[12, 27], hrs='Diario 12:00–3:00', lat=19.40562, lng=-99.16115, addr='Monterrey 333', col='Roma Sur'),
  # ── altas del Excel del fundador: horario publicado + sesión por reservar ──
  'rv-fb39aec0d1': dict(MDT, n='Manos de Tierra · Interlomas', activar=True),
  'rv-4de0eaf5c4': dict(MDT, n='Manos de Tierra · Altavista', activar=True),
  'rv-5cd139a78f': dict(MDT, n='Manos de Tierra · San Jerónimo', activar=True),
  'rv-af01b608aa': dict(n='Pepes Taller de Cerámica', fuente='Pepes Taller — sitio del lugar (horario del Excel del fundador, 9-nov-2026)', url='https://pepestaller.com/', oh=[11, 15], dias=[0, 3, 4, 5, 6],
                        hrs='Mié a vie 10:00–22:00 · sáb 11:00–18:00 · dom 11:00–15:00 · sesión de 3 horas con reserva', duracionMin=180,
                        condicion='Reserva tu sesión de tres horas.', activar=True),
  'rv-611785805c': dict(n='Adamanta · Del Valle', fuente='Adamanta — sede Del Valle (sitio oficial)', url='https://www.adamanta.mx/del-valle', oh=[8, 20],
                        hrs='Lun a jue 6:00–23:00 · vie 6:00–22:00 · sáb, dom y festivos 8:00–20:00', activar=True),
  'rv-4e1c5b7751': dict(n='Adamanta · Santa Fe', fuente='Adamanta — sede Santa Fe (sitio oficial)', url='https://www.adamanta.mx/santa-fe', activar=True),
  'rv-3fe70cd44c': dict(n='Adamanta · Satélite', fuente='Adamanta — sede Satélite (sitio oficial)', url='https://www.adamanta.mx/satelite', activar=True),
  'rv-c2387c7acc': dict(n='Ólika Studio', fuente='Ólika Studio — sitio del lugar', url='https://www.olika-studio.com/sesiones-y-talleres', activar=True),
  'rv-c00b52193d': dict(n='Aura Cocina Mexicana · taller', fuente='Aura — clases de cocina (sitio del lugar)', url='https://es.auramexcooking.com/cooking-classes'),
  'rv-366c6dacff': dict(n='Pista de Hielo Santa Fe · sesión pública', fuente='Pista de Hielo Santa Fe — sesión pública (sitio del lugar)', url='https://pistadehielosantafe.com/clubes-y-servicios/sesion-publica/'),
  'rv-68d8b1cf0e': dict(n='Odette · Lomas', fuente='CDMX365 — Odette', url='https://cdmx365.com/es/odette', activar=True),
  'rv-8712b60b44': dict(n='Exploradores Club de Café · Santa Fe', fuente='Exploradores — ubicaciones (sitio del lugar)', url='https://www.exploradores.cafe/pages/ubicaciones', activar=True),
  'rv-37c448c785': dict(n='Vive Cerámica · Satélite', fuente='Vive Cerámica — sitio del lugar (clase suelta $499)', url='https://www.viveceramica.com/'),
}
items, sin_pin = {}, []
for i, x in ITEMS.items():
    x = dict(x); x['fecha'] = FECHA
    p = PINES.get(i)
    if p:
        x['lat'], x['lng'] = p['lat'], p['lng']
        x.setdefault('resuelve', []).append('ubicacion')
        if p.get('nota'): x['nota'] = p['nota']
    # Un alta sólo se activa con pin confirmado (regla de ubicación de SOBRES) y horario publicado.
    if x.get('activar') and i.startswith('rv-') and not p and i not in ('rv-fb39aec0d1',):   # Manos de Tierra Interlomas ya traía pin con número
        x.pop('activar'); sin_pin.append(x['n'])
    if x.get('activar') and not x.get('oh') and i in ('rv-c00b52193d', 'rv-366c6dacff', 'rv-37c448c785'): x.pop('activar')
    items[i] = x
# Pines confirmados de fichas que salían en planes con pin aproximado (o que el Excel dejó sin pin).
for i, p in PINES.items():
    if i in items: continue
    items[i] = dict(fecha=FECHA, lat=p['lat'], lng=p['lng'], resuelve=['ubicacion'], fuente='OpenStreetMap / Nominatim — número de la calle confirmado', url='https://nominatim.openstreetmap.org/', nota=p.get('nota', ''))
# Duplicados que aparecieron al confirmar pines: la ficha de OSM es la misma sala que ya estaba.
BAJAS = {'os-n11737763876': 'Duplicado de Cinépolis · Arcos Bosques, ID cdmx-4030 (mismo pin: Paseo de los Tamarindos 90).',
         'os-n11770329070': 'Duplicado de Taquería Los Parados, ID cdmx-2028 (Monterrey 333); además estaba clasificada como café.'}
salida = {'version': 1, 'fecha': FECHA, 'items': items, 'bajas': BAJAS, 'altas': []}
with open(os.path.join(RAIZ, 'data', 'verificados.js'), 'w') as fh:
    fh.write('// Generado por reportes/pasada/build_verificados.py — no editar a mano.\n')
    fh.write('window.SOBRES_VERIFICADOS = ' + json.dumps(salida, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'verificados: {len(items)} fichas · con pin nuevo: {sum(1 for x in items.values() if "lat" in x)} · altas sin pin (siguen en pausa): {sin_pin}')
