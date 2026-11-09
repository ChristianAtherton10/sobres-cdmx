#!/usr/bin/env python3
"""Revisión del catálogo hecha por el fundador en Excel (9 nov 2026) → data/revision.js

Entradas (en esta carpeta):
  base_9nov2026.xlsx       — lo que SOBRES exportó (exporta_xlsx.py sobre dump_catalogo.js)
  revisado_9nov2026.xlsx   — el mismo archivo ya revisado por el fundador
Sólo se aplica lo que CAMBIÓ entre los dos (celda por celda), más:
  · Quitar = "Sí"            → baja (con el motivo de la nota "BAJA · …")
  · nota con "PAUSA · …"      → se queda en el catálogo pero no sale en planes
  · filas sin ID              → altas (lugares) o funciones nuevas (eventos)
  · pin borrado o dirección nueva → se geocodifica con Nominatim y sólo se acepta
    si Nominatim confirma el NÚMERO de la calle (regla de ubicación de SOBRES).
    Si la única razón de la pausa era el pin y se confirmó, la pausa se levanta.
Columnas calculadas (Subzona, Sale en planes, Origen, OpenTable) no se copian.

Uso: python3 reportes/revision/build_revision.py
"""
import json, os, re, sys, time, hashlib, urllib.parse, urllib.request
from openpyxl import load_workbook

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
FECHA = '2026-11-09'
FUENTE_REV = 'Revisión del catálogo del fundador de SOBRES (Excel, 9-nov-2026)'

AMB = {'Comer rico': 'foodie', 'Noche y fiesta': 'nightlife', 'Tranqui': 'chill', 'Cultural': 'cultural', 'Romántico': 'romántico',
       'En familia': 'familiar', 'Con amigos': 'social', 'Joyita': 'joyita', 'Creativo': 'creativo', 'Aventurero': 'aventurero'}
WHO = {'Solo': 'solo', 'Date': 'date', 'Amigos': 'amigos', 'Familia': 'familia', 'Compañeros': 'compa'}
DIAS = {'Dom': 0, 'Lun': 1, 'Mar': 2, 'Mié': 3, 'Jue': 4, 'Vie': 5, 'Sáb': 6}
ESTADO = {'Verificado': 'verificado', 'Rango publicado': 'rango', 'Estimado': 'estimado', 'Inferido': 'inferido',
          'Por confirmar': 'por_confirmar', 'Sin precio': 'por_confirmar'}

# Las 10 zonas en pantalla y sus zonas internas (mismo orden que ZGRUPOS() en index.html).
GRUPOS = [('Roma · Condesa', ['roma', 'romasur', 'condesa']), ('Polanco · Chapultepec', ['polanco', 'chapultepec']),
          ('Juárez · Centro', ['juarez', 'centro']), ('Del Valle · Nápoles', ['delvalle']), ('Coyoacán · CU', ['coyoacan', 'cu']),
          ('San Ángel', ['sanangel']), ('Santa Fe · Poniente', ['santafe']), ('Lomas · Tecamachalco', ['lomas']),
          ('Satélite · Naucalpan', ['satelite']), ('Xochimilco', ['xochimilco'])]
ETIQ = {'roma': 'Roma Norte', 'romasur': 'Roma Sur', 'condesa': 'Condesa', 'polanco': 'Polanco', 'chapultepec': 'Chapultepec',
        'juarez': 'Juárez', 'centro': 'Centro', 'coyoacan': 'Coyoacán', 'cu': 'CU · Sur'}
COLZ = {'Juárez': 'juarez', 'Roma Norte': 'roma', 'Roma Sur': 'romasur', 'Condesa': 'condesa', 'Hipódromo': 'condesa',
        'Hipódromo Condesa': 'condesa', 'Centro': 'centro', 'Centro Histórico': 'centro', 'Polanco': 'polanco', 'Coyoacán': 'coyoacan',
        'Del Carmen': 'coyoacan', 'Bosque de Chapultepec': 'chapultepec'}

def zona_interna(grupo, subzona, colonia):
    g = dict(GRUPOS).get(grupo)
    if not g: return None
    if len(g) == 1: return g[0]
    for z in g:
        if subzona and ETIQ.get(z) == subzona: return z
    if COLZ.get(colonia) in g: return COLZ[colonia]
    return g[0]

def hora(t):
    if t in (None, ''): return None
    m = re.match(r'\s*(\d{1,2}):(\d{2})(.*)', str(t))
    if not m: return None
    h = int(m.group(1)) + int(m.group(2)) / 60
    if '+1' in m.group(3): h += 24
    return round(h, 2)

def dias(t):
    if t in (None, ''): return None
    if str(t).strip() == 'Todos': return []
    return sorted({DIAS[x.strip()] for x in str(t).split(',') if x.strip() in DIAS})

def lista(t, mapa):
    if t in (None, ''): return []
    return [mapa.get(x.strip(), x.strip()) for x in str(t).split(',') if x.strip()]

def segmentos(nota, clave):
    return [s.strip()[len(clave) + 3:].strip() for s in (nota or '').split(' | ') if s.strip().startswith(clave + ' ·')]

# ------------------------------------------------------------------ geocodificación (Nominatim)
CACHE = os.path.join(AQUI, 'geocache.json')
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
def geocodifica(addr, col):
    """[lat, lng] sólo si Nominatim encuentra la calle CON número; si no, None."""
    if not addr or not re.search(r'\d', addr): return None
    q = addr if (col or '') in addr else f'{addr}, {col}'
    q = re.sub(r',?\s*(local|int\.?|interior|planta alta|piso)\b.*?(?=,|$)', '', q, flags=re.I) + ', México'
    if q not in cache:
        url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(
            {'q': q, 'format': 'jsonv2', 'addressdetails': 1, 'limit': 3, 'countrycodes': 'mx', 'viewbox': '-99.40,19.62,-98.94,19.05', 'bounded': 1})
        req = urllib.request.Request(url, headers={'User-Agent': 'sobres-catalogo/1.0 (catalogo escolar)'})
        try: cache[q] = json.load(urllib.request.urlopen(req, timeout=25))
        except Exception as e: print('  Nominatim falló:', q, e); return None
        time.sleep(1.1)
        json.dump(cache, open(CACHE, 'w'), ensure_ascii=False, indent=0)
    for r in cache[q] or []:
        if (r.get('address') or {}).get('house_number'):
            return [round(float(r['lat']), 5), round(float(r['lon']), 5)]
    return None

# ------------------------------------------------------------------ lectura
def filas(wb, hoja):
    ws = wb[hoja]; enc = [c.value for c in ws[1]]
    return [dict(zip(enc, r)) for r in ws.iter_rows(min_row=2, values_only=True) if any(x not in (None, '') for x in r)]

base_wb = load_workbook(os.path.join(AQUI, 'base_9nov2026.xlsx'))
rev_wb = load_workbook(os.path.join(AQUI, 'revisado_9nov2026.xlsx'))
BASE = {f['ID']: f for h in ('Lugares', 'Eventos') for f in filas(base_wb, h)}
# Nombre de evento existente → id: las "funciones antes agrupadas" que el fundador separó por
# fecha (Morat, Karol G, DLD) se funden con su evento en vez de duplicarlo.
EV_BASE = {f['Nombre']: f['ID'] for f in filas(base_wb, 'Eventos')}
fusion = {}   # id del evento → fechas activas

vacio = lambda x: x is None or x == ''
dif = lambda a, b, k: (None if vacio(a.get(k)) else a.get(k)) != (None if vacio(b.get(k)) else b.get(k))

bajas, pausas, cambios, activar, altas, eventos, duplicados = {}, {}, {}, [], [], [], {}
geo_ok, geo_no = [], []

def precio_de(f):
    est = ESTADO.get(f.get('Precio') or '', 'por_confirmar')
    pp = f.get('Precio por persona (MXN)')
    out = {'estado': est if pp is not None or est == 'por_confirmar' else 'por_confirmar',
           'fuente': f.get('Fuente del precio') or '', 'url': f.get('Liga del precio') or '', 'fecha': f.get('Fecha del precio') or ''}
    if pp is not None and out['estado'] != 'por_confirmar':
        out['precio'] = {'rep': pp, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': ''}
    return out

def pausa_de(f, pin_ok):
    """Motivos de pausa de la nota; el del pin se levanta si Nominatim confirmó el número."""
    mot = segmentos(f.get('Tus notas'), 'PAUSA')
    if pin_ok:
        mot = [re.sub(r'\s*Geocodificar[^.]*\.?', '', m).strip() for m in mot]
        mot = [m for m in mot if m]
    return ' '.join(mot)

for hoja in ('Lugares', 'Eventos'):
    for f in filas(rev_wb, hoja):
        vid = f.get('ID')
        if vid and vid in BASE:
            b = BASE[vid]
            if str(f.get('Quitar') or '').strip().lower() in ('sí', 'si', 'x', '1'):
                bajas[vid] = ' '.join(segmentos(f.get('Tus notas'), 'BAJA')) or 'Baja en la revisión del fundador.'
                m = re.search(r'Duplicado de .*?ID ([\w-]+)', bajas[vid])
                if m: duplicados[vid] = m.group(1)
                continue
            c = {}
            for col, k in (('Nombre', 'n'), ('Categoría', 'cat'), ('Cocina', 'cocina'), ('Colonia', 'col'), ('Dirección', 'addr'),
                           ('Horario', 'hrs'), ('Descripción', 'basis'), ('Web', 'web'), ('Teléfono', 'tel'), ('Fuente del lugar', 'fuente')):
                if dif(b, f, col): c[k] = f.get(col) or ''
            if dif(b, f, 'Abre') or dif(b, f, 'Cierra'):
                a, z = hora(f.get('Abre')), hora(f.get('Cierra'))
                if a is not None and z is not None:
                    c['oh'] = [a, z if z > a else z + 24]
                else: c['sinHora'] = True
            if dif(b, f, 'Días que abre'):
                d = dias(f.get('Días que abre'))
                if d is not None: c['dias'] = d
            if dif(b, f, 'Ambientes'): c['tags'] = lista(f.get('Ambientes'), AMB)
            if dif(b, f, 'Para quién'): c['who'] = lista(f.get('Para quién'), WHO)
            if dif(b, f, 'Zona') or dif(b, f, 'Subzona'):
                z = zona_interna(f.get('Zona'), f.get('Subzona'), f.get('Colonia'))
                if z: c['zone'] = z
            if any(dif(b, f, k) for k in ('Precio por persona (MXN)', 'Precio', 'Fuente del precio', 'Liga del precio', 'Fecha del precio')):
                c['pr'] = precio_de(f)
            # Pin: se recalcula si lo borraron o si cambió la dirección.
            pin_ok = False
            if f.get('Latitud') is None or 'addr' in c:
                g = geocodifica(f.get('Dirección'), f.get('Colonia'))
                if g: c['lat'], c['lng'] = g; pin_ok = True; geo_ok.append(f['Nombre'])
                else:
                    geo_no.append(f['Nombre'])
                    if f.get('Latitud') is None: c['coordAprox'] = True
            p = pausa_de(f, pin_ok)
            if p: pausas[vid] = p
            elif f.get('Sale en planes') == 'Sí' and b.get('Sale en planes') == 'No': activar.append(vid)
            if c: cambios[vid] = c
        elif not vid:
            # Alta: lugar nuevo o función nueva de un evento.
            a, z = hora(f.get('Abre')), hora(f.get('Cierra'))
            fechas = None
            if hoja == 'Eventos':
                fe = str(f.get('Fechas') or '')
                m = re.findall(r'\d{4}-\d{2}-\d{2}', fe)
                if not m: continue
                if f['Nombre'] in EV_BASE:
                    fz = fusion.setdefault(EV_BASE[f['Nombre']], {'activas': [], 'pausadas': []})
                    fz['pausadas' if segmentos(f.get('Tus notas'), 'PAUSA') else 'activas'].extend(m)
                    continue
                fechas = {'desde': m[0], 'hasta': m[-1]} if len(m) > 1 else {'solo': [m[0]], 'desde': m[0], 'hasta': m[0]}
            g = geocodifica(f.get('Dirección'), f.get('Colonia'))
            if g: geo_ok.append(f['Nombre'])
            else: geo_no.append(f['Nombre'])
            lat, lng = (g or [f.get('Latitud'), f.get('Longitud')])
            pre = 'ev-r' if hoja == 'Eventos' else 'rv-'
            nid = pre + hashlib.sha1((f['Nombre'] + '|' + (f.get('Dirección') or '') + '|' + str(f.get('Fechas') or '')).encode()).hexdigest()[:10]
            tags = lista(f.get('Ambientes'), AMB) or ['cultural']
            who = lista(f.get('Para quién'), WHO) or ['amigos']
            sin_hora = a is None or z is None
            oh = [a, z if z > a else z + 24] if not sin_hora else [10, 20]
            tm = [t for t, ok in (('manana', oh[0] <= 11), ('tarde', oh[0] <= 17 and oh[1] >= 15), ('noche', oh[1] >= 21)) if ok] or ['tarde']
            pr = precio_de(f)
            mot = pausa_de(f, bool(g))
            if sin_hora and not mot: mot = 'Confirmar el horario de la sesión.'
            if lat is None and not mot: mot = 'Confirmar la ubicación.'
            r = dict(id=nid, n=f['Nombre'], cat=f.get('Categoría') or 'Atracción', zone=zona_interna(f.get('Zona'), f.get('Subzona'), f.get('Colonia')) or 'roma',
                     col=f.get('Colonia') or '', addr=f.get('Dirección') or '', web=f.get('Web') or '', oh=oh, hrs=f.get('Horario') or '',
                     tags=tags, who=who, tm=tm, lat=lat, lng=lng, score=78, tier='B', basis=f.get('Descripción') or '',
                     fuente=f.get('Fuente del lugar') or FUENTE_REV, url=pr['url'], fecha=pr['fecha'] or FECHA, estado=pr['estado'],
                     cocina=f.get('Cocina') or '', tel=f.get('Teléfono') or '', consultado=FECHA, horaEstimada=sin_hora,
                     dias=(dias(f.get('Días que abre')) or None), nota=('En pausa: ' + mot) if mot else '')
            if 'precio' in pr: r['precio'] = pr['precio']
            if f.get('Categoría') == 'Taller': r['sesion'] = True; r['act'] = ['taller']
            if mot: r['recomendable'] = False
            if hoja == 'Eventos':
                r.update(evento=True, fechas=fechas, concierto=bool(re.search(r'en concierto', f['Nombre'], re.I)), sede=f.get('Dirección') or '')
                prev = next((e for e in eventos if e['n'] == r['n'] and e['addr'] == r['addr']), None)
                if prev:   # otra fecha del mismo evento: una sola ficha con todas sus fechas
                    fs_ = sorted(set((prev['fechas'].get('solo') or [prev['fechas']['desde']]) + (fechas.get('solo') or [fechas['desde']])))
                    prev['fechas'] = {'solo': fs_, 'desde': fs_[0], 'hasta': fs_[-1]}
                    if not mot and prev.get('recomendable') is False: prev.pop('recomendable'); prev['nota'] = ''
                else: eventos.append(r)
            else: altas.append(r)

# Funciones separadas → el evento existente queda con sus fechas activas (o en pausa si no hay).
for eid, fz in fusion.items():
    act = sorted(set(fz['activas']))
    if act:
        cambios.setdefault(eid, {})['fechas'] = {'solo': act, 'desde': act[0], 'hasta': act[-1]}
        pausas.pop(eid, None)
    else:
        pausas[eid] = pausas.get(eid) or 'Confirmar fecha, hora y boletos.'

salida = {'version': 1, 'fecha': FECHA, 'fuente': FUENTE_REV,
          # Interruptor: false = las fichas "PAUSA" siguen saliendo en planes como antes.
          'pausasActivas': True,
          'bajas': bajas, 'duplicados': duplicados, 'pausas': pausas, 'activar': activar, 'cambios': cambios, 'altas': altas, 'eventos': eventos}
with open(os.path.join(RAIZ, 'data', 'revision.js'), 'w') as fh:
    fh.write('// Generado por reportes/revision/build_revision.py — no editar a mano.\n')
    fh.write('window.SOBRES_REVISION = ' + json.dumps(salida, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'eventos fundidos {len(fusion)} · duplicados {duplicados}')
print(f'bajas {len(bajas)} · pausas {len(pausas)} · activar {len(activar)} · cambios {len(cambios)} · altas {len(altas)} · funciones nuevas {len(eventos)}')
print(f'pines confirmados con número {len(geo_ok)} · sin confirmar {len(geo_no)}')
json.dump({'geo_ok': geo_ok, 'geo_no': geo_no}, open(os.path.join(AQUI, 'geo_resultado.json'), 'w'), ensure_ascii=False, indent=1)
