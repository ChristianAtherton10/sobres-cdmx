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
  # ── 14 nov 2026: Del Valle · museos con sitio oficial ──
  'cdmx-0753': dict(n='Sala Introductoria a la Zona Arqueológica de Mixcoac', fecha='2026-11-14', estado='verificado',
                    precio=dict(min=0, rep=0, max=0, unidad='persona', moneda='MXN', canasta='Entrada gratuita (INAH).'),
                    fuente='INAH — Zona Arqueológica de Mixcoac (sitio oficial)', url='https://www.inah.gob.mx/zonas/zona-arqueologica-de-mixcoac',
                    oh=[9, 17], dias=[0, 2, 3, 4, 5, 6], hrs='Martes a domingo 9:00–17:00', addr='Calle Pirámide 7', col='San Pedro de los Pinos'),
  'cdmx-0761': dict(n='Museo Estelar', fecha='2026-11-14', estado='verificado',
                    precio=dict(min=0, rep=0, max=0, unidad='persona', moneda='MXN', canasta='Entrada sin costo, con reservación y cita previa.'),
                    fuente='Museo Estelar — sitio oficial', url='https://museoestelar.com/',
                    # El sitio se contradice sobre el martes; sólo se toman los días en que coincide.
                    oh=[12, 17], dias=[0, 3, 4, 5, 6], ohDia={'0': [12, 17], '3': [10, 18], '4': [10, 18], '5': [10, 18], '6': [10, 18]},
                    hrs='Mié a sáb 10:00–18:00 · dom 12:00–17:00 · con cita', condicion='Reserva tu cita: la entrada es sin costo pero sólo con reservación.',
                    addr='Santa Margarita 519', col='Insurgentes San Borja'),
  'cdmx-0759': dict(n='Museo del Metro', fecha='2026-11-14', fuente='Metro CDMX — Museo del Metro (sitio oficial)', url='https://www.metro.cdmx.gob.mx/museo-del-metro',
                    oh=[11, 14], dias=[0, 2, 3, 4, 5, 6], ohDia={'0': [11, 14], '2': [10, 18], '3': [10, 18], '4': [10, 18], '5': [10, 18], '6': [11, 14]},
                    hrs='Mar a vie 10:00–18:00 · sáb y dom 11:00–14:00 · estación Mixcoac (Línea 12)'),
  # ── 16 nov 2026: precio fijado por el fundador. La regla del más alto del rango daba $13,310 (menú + maridaje más
  #    caro); el fundador lo deja en $6,500 por persona (menú degustación de $5,610 más bebida), propina incluida. ──
  'cdmx-0001': dict(n='Quintonil', fecha='2026-11-16', estado='estimado', propinaIncluida=True,
                    precio=dict(min=6500, rep=6500, max=6500, unidad='persona', moneda='MXN',
                                canasta='Menú degustación de $5,610 por persona sin bebidas (UnoTV, 4-dic-2025) más bebida: ~$6,500 por persona, cifra fijada por el fundador de SOBRES el 16-nov-2026. Con maridaje sube.'),
                    fuente='UnoTV — "Ocho restaurantes mexicanos entre los 50 mejores del mundo: cuánto cuesta comer ahí" (4-dic-2025); cifra por persona fijada por el fundador',
                    url='https://www.unotv.com/estilo-de-vida/gastronomia/ocho-restaurantes-mexicanos-lograron-un-lugar-entre-los-50-mejores-del-mundo-cuanto-cuesta-comer-ahi/'),
}
# ── 16 nov 2026: precios de hotspots que no tenían ninguno. Cada uno con su fuente (liga) y la fecha de consulta.
#    Son consumos promedio de guías (no la carta del lugar), así que entran como "estimado". Cuando la fuente da
#    un rango se toma el más alto (regla de SOBRES). Fuentes de más de 5 años no se usaron (El Mirador 2017, Dante 2018).
TO = 'https://www.timeoutmexico.mx/ciudad-de-mexico/'
def est(n, pp, fuente, url, canasta, **k):
    return dict(k, n=n, fecha='2026-11-16', estado='estimado', fuente=fuente, url=url,
                precio=dict(min=pp, rep=pp, max=pp, unidad='persona', moneda='MXN', canasta=canasta))
PRECIOS_1116 = {
  'iv-f2b54ca0c5': est('Baltra', 350, 'Time Out México — Baltra (ficha del bar)', TO + 'bares-y-cantinas/baltra', 'Consumo promedio por persona: $350 (ficha de Time Out, sin fecha).'),
  'iv-3b9983ef0a': est('Danubio', 900, 'El Financiero — "¿Cuánto cuesta comer en Danubio?" (7-oct-2025)', 'https://www.elfinanciero.com.mx/food-and-drink/2025/10/07/cuanto-cuesta-comer-en-danubio-restaurante-que-visitado-por-carlos-slim-helu-y-los-presidentes/', 'Cheque promedio de $850 a $900 por persona sin propina (entrada, plato fuerte, bebida y postre); se toma el más alto.'),
  'cdmx-4020': est('Raíz', 2300, 'OpenTable — Raíz (menús de degustación)', 'https://www.opentable.co.uk/r/raiz-mexico', 'Menú de seis tiempos $1,900 y de nueve tiempos $2,300 por persona, sin bebidas; se toma el más alto.',
                   addr='Schiller 331', col='Polanco', lat=19.4320047, lng=-99.1866349, resuelve=['ubicacion'],
                   nota='Pin de OpenStreetMap/Nominatim: nodo del restaurante con número 331 en la calle Schiller.'),
  'iv-ec77f95f10': est('Ehden · Centro Histórico', 350, 'Chilango — "Ehden: el restaurante libanés más antiguo de CDMX" (16-ago-2024)', 'https://www.chilango.com/comida-y-tragos/restaurantes/ehden-restaurante-libanes-mas-antiguo-centro-cdmx/', 'Consumo promedio: $350 por persona.'),
  'os-n7295812691': est('El Bajío · Satélite', 400, 'Time Out México — El Bajío (ficha de la sucursal Cuitláhuac)', TO + 'restaurantes/el-bajio', 'Consumo promedio por persona: $400 en la sucursal Cuitláhuac; se usa como referencia de la cadena para esta sucursal.'),
  'os-n4675558750': est('El Bajío · Insurgentes Sur', 400, 'Time Out México — El Bajío (ficha de la sucursal Cuitláhuac)', TO + 'restaurantes/el-bajio', 'Consumo promedio por persona: $400 en la sucursal Cuitláhuac; se usa como referencia de la cadena para esta sucursal.'),
  'iv-d99c0ee47a': est('La Cocina del Bizco', 500, 'Time Out México — La Cocina del Bizco (ficha)', TO + 'restaurantes/la-cocina-del-bizco', 'Precio de la ficha de Time Out: $500 (OpenTable lo pone en "$500 o más").'),
  'iv-8c464a284d': est('Chapulín', 600, 'Time Out México — Chapulín (ficha)', TO + 'restaurantes-cafes/chapulin', 'Consumo promedio por persona: $600 (ficha de Time Out, sin fecha).'),
  'iv-5a6df611a9': est('Rocasal', 1000, 'Reservándonos — Rocasal Pedregal', 'https://www.reservandonos.com/en/place/restaurante-rocasal-pedregal/', 'Precio por persona: $500 a $1,000; se toma el más alto (Time Out da $700 de consumo promedio).'),
  'iv-7f18572e2e': est('Cachava', 700, 'Time Out México — Cachava (ficha)', TO + 'restaurantes/cachava', 'Consumo promedio por persona: $700 (ficha de Time Out, sin fecha).'),
  'iv-9fe82dac0b': est('Cantina del Bosque', 500, 'OpenTable — Cantina del Bosque', 'https://www.opentable.ie/r/cantina-del-bosque-ciudad-de-mexico', 'Rango de OpenTable: $310 a $500; se toma el más alto.'),
  'iv-efc0913747': est('Almara', 500, 'Time Out México — Almara (ficha)', TO + 'restaurantes/almara', 'Consumo promedio por persona: $500 (ficha de Time Out, sin fecha).'),
  'iv-69b2eb280d': est('Tierra Adentro Cocina', 200, 'Time Out México — Tierra Adentro (ficha)', TO + 'restaurantes/tierra-adentro', 'Consumo promedio por persona: $200 (ficha de Time Out, sin fecha).'),
  'iv-7d9130fd5a': est('Somsaa', 750, 'Time Out México — Somsaa (reseña del 15-feb-2023)', TO + 'restaurantes/somsaa', 'Precio de la ficha de Time Out: $750.'),
  'iv-d7ca8242a0': est('The Lamb', 700, 'Time Out México — The Lamb (ficha)', TO + 'restaurantes/the-lamb', 'Precio de la ficha de Time Out: $700.'),
  'iv-ada353af3c': est('Marea · Restaurante de Mar', 700, 'Time Out México — Marea, restaurante de mar (ficha; Publimetro dio el mismo ticket en feb-2022)', TO + 'restaurantes/marea-restaurante-de-mar', 'Consumo promedio por persona: $700.'),
  'cdmx-0404': est('Museo Mexicano del Diseño (MUMEDI)', 100, 'Chilango — "8 museos en CDMX que tienes que visitar; dónde están y cuánto cuesta la entrada"', 'https://www.chilango.com/que-hacer/arte-y-cultura/museos-imperdibles-cdmx-mundial-2026-direccion-costo/', 'Entrada: $100 en la sede de Bucareli 35.'),
}
for _i, _x in PRECIOS_1116.items():
    assert _i not in ITEMS, _i; ITEMS[_i] = _x
items, sin_pin = {}, []
for i, x in ITEMS.items():
    x = dict(x); x.setdefault('fecha', FECHA)
    p = PINES.get(i)
    if p:
        x['lat'], x['lng'] = p['lat'], p['lng']
        x.setdefault('resuelve', []).append('ubicacion')
        if p.get('nota'): x['nota'] = p['nota']
    # Un alta sólo se activa con pin confirmado (regla de ubicación de SOBRES) y horario publicado.
    if x.get('activar') and i.startswith('rv-') and not p and i not in ('rv-fb39aec0d1',):   # Manos de Tierra Interlomas ya traía pin con número
        x.pop('activar'); sin_pin.append(x['n'])
        x['activarConPin'] = True   # (16 nov 2026) se activa si Google la ubica en vivo cerca de su ficha (sólo se guarda su place_id)
    if x.get('activar') and not x.get('oh') and i in ('rv-c00b52193d', 'rv-366c6dacff', 'rv-37c448c785'): x.pop('activar')
    items[i] = x
# Pines confirmados de fichas que salían en planes con pin aproximado (o que el Excel dejó sin pin).
for i, p in PINES.items():
    if i in items: continue
    items[i] = dict(fecha=FECHA, lat=p['lat'], lng=p['lng'], resuelve=['ubicacion'], fuente='OpenStreetMap / Nominatim — número de la calle confirmado', url='https://nominatim.openstreetmap.org/', nota=p.get('nota', ''))
# Duplicados que aparecieron al confirmar pines: la ficha de OSM es la misma sala que ya estaba.
BAJAS = {'os-n11737763876': 'Duplicado de Cinépolis · Arcos Bosques, ID cdmx-4030 (mismo pin: Paseo de los Tamarindos 90).',
         'os-n11770329070': 'Duplicado de Taquería Los Parados, ID cdmx-2028 (Monterrey 333); además estaba clasificada como café.',
         'cdmx-2019': 'Salón Covadonga: retirado de SOBRES por decisión del fundador (16-nov-2026).'}
# Lo que el fundador llenó en el Excel de pendientes (importa_pendientes.py). Se suma a lo anterior por ID;
# si una ficha ya tenía datos de esta pasada, lo del Excel manda en los campos que trae.
EXCEL = os.path.join(AQUI, 'verificados_excel.json')
if os.path.exists(EXCEL):
    for i, x in json.load(open(EXCEL))['items'].items():
        base = dict(items.get(i, {})); res = sorted(set(base.get('resuelve', [])) | set(x.get('resuelve', [])))
        base.update(x); base['resuelve'] = res; items[i] = base
salida = {'version': 1, 'fecha': FECHA, 'items': items, 'bajas': BAJAS, 'altas': []}
with open(os.path.join(RAIZ, 'data', 'verificados.js'), 'w') as fh:
    fh.write('// Generado por reportes/pasada/build_verificados.py — no editar a mano.\n')
    fh.write('window.SOBRES_VERIFICADOS = ' + json.dumps(salida, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'verificados: {len(items)} fichas · con pin nuevo: {sum(1 for x in items.values() if "lat" in x)} · altas sin pin (siguen en pausa): {sin_pin}')
