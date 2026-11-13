#!/usr/bin/env python3
"""Importa el Excel de pendientes que llena el fundador → reportes/pasada/verificados_excel.json
(que build_verificados.py mezcla en data/verificados.js). Conserva el ID de cada ficha.

Uso:  python3 reportes/pasada/importa_pendientes.py <Pendientes_llenado.xlsx> [--sin-red]
      python3 reportes/pasada/build_verificados.py

Reglas:
- Sólo entran las columnas amarillas que traigan algo. Cada dato lleva fuente y fecha; si no hay liga, la
  fuente es «Fundador (Excel de pendientes)» y un precio sin liga entra como ESTIMADO, no como verificado.
- Precio: UN número por persona (o por grupo, que SOBRES divide una vez entre quienes van). Un rango
  «300-500» toma el más alto. El cover se suma a la cifra y se dice en «qué incluye».
- Horario por día: «Lun–jue 13:00–23:00. Vie–sáb 13:00–01:00. Dom cerrado». Si un tramo no se entiende, el
  horario NO se aplica y sale en avisos (no se adivina).
- Dirección con número: se confirma el número en Nominatim; sólo así se resuelve «ubicación».
- Una ficha en pausa se reactiva sólo si quedan resueltos TODOS sus motivos (lo decide la app).
"""
import json, os, re, sys, time, datetime, urllib.request, urllib.parse
from openpyxl import load_workbook
AQUI = os.path.dirname(os.path.abspath(__file__))
D = {'dom': 0, 'lun': 1, 'mar': 2, 'mie': 3, 'jue': 4, 'vie': 5, 'sab': 6}
ORD = [1, 2, 3, 4, 5, 6, 0]
COMIDA = {'Restaurante', 'Taquería', 'Café', 'Heladería', 'Panadería', 'Mercado', 'Churrería', 'Cantina', 'Pizzería', 'Marisquería'}

def sin_acentos(t):
    return ''.join({'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u'}.get(c, c) for c in str(t).lower())

def hora(t):
    """'13:00', '13', '1 pm', '1:30am' → horas decimales, o None."""
    m = re.match(r'^\s*(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:h|hrs|horas)?\s*$', t.strip())
    if not m: return None
    h = int(m.group(1)); mi = int(m.group(2) or 0); ap = (m.group(3) or '').replace('.', '')
    if ap == 'pm' and h < 12: h += 12
    if ap == 'am' and h == 12: h = 0
    return h + mi / 60 if 0 <= h <= 24 and 0 <= mi < 60 else None

def dias_de(t):
    """'lun-jue', 'sab y dom', 'diario', 'lun, mie, vie' → lista de días (0 = domingo), o None."""
    t = sin_acentos(t).strip(' :,')
    if re.search(r'diario|todos los dias|lunes a domingo|lun\w* a dom', t): return list(range(7))
    out = []
    for parte in re.split(r',| y | e ', t):
        parte = parte.strip()
        if not parte: continue
        r = re.split(r'\s*(?:-|–|—| a | al )\s*', parte)
        k = [x.strip()[:3] for x in r]
        if any(x not in D for x in k): return None
        if len(k) == 1: out.append(D[k[0]])
        elif len(k) == 2:
            i, j = ORD.index(D[k[0]]), ORD.index(D[k[1]])
            out += [ORD[x % 7] for x in range(i, (j if j >= i else j + 7) + 1)]
        else: return None
    return out or None

def horario(txt):
    """→ ({dia: [abre, cierra]}, None) o (None, 'por qué no')."""
    por = {}
    for seg in re.split(r'[.;·\n|]+(?!\d)', str(txt)):
        seg = seg.strip()
        if not seg: continue
        s = sin_acentos(seg)
        m = re.match(r'^(.*?)(cerrado|24 ?h(?:oras|rs)?|\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|—| a | a las )\s*\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\s*(?:h|hrs|horas)?)\s*$', s)
        if not m: return None, 'no entendí «' + seg + '»'
        ds = dias_de(m.group(1)) if m.group(1).strip(' :,') else list(range(7))
        if ds is None: return None, 'no entendí los días de «' + seg + '»'
        h = m.group(2)
        if h == 'cerrado':
            for d in ds: por.pop(d, None)
            continue
        if h.startswith('24'): w = [0, 30]
        else:
            a, b = [hora(x) for x in re.split(r'\s*(?:-|–|—| a las | a )\s*', h, maxsplit=1)]
            if a is None or b is None: return None, 'no entendí las horas de «' + seg + '»'
            if b <= a: b += 24
            w = [a, b]
        for d in ds: por[d] = w
    return (por, None) if por else (None, 'sin días abiertos')

def numero(x):
    """Un precio: 350, '$350', '300-500' (toma el alto). None si no hay número."""
    if x is None or x == '': return None
    if isinstance(x, (int, float)): return int(round(x))
    n = [int(a.replace(',', '')) for a in re.findall(r'\d[\d,]*', str(x))]
    return max(n) if n else None

GEO = os.path.join(AQUI, 'geocache_pendientes.json')
def geocodifica(direccion, cache, red):
    if direccion in cache: return cache[direccion]
    if not red: return None
    q = urllib.parse.urlencode({'q': direccion + ', Ciudad de México', 'format': 'jsonv2', 'addressdetails': 1, 'limit': 1, 'countrycodes': 'mx'})
    req = urllib.request.Request('https://nominatim.openstreetmap.org/search?' + q, headers={'User-Agent': 'sobres-catalogo/1.0'})
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=15).read()); time.sleep(1.1)
    except Exception:
        return None
    out = None
    if r and (r[0].get('address') or {}).get('house_number'):
        out = {'lat': round(float(r[0]['lat']), 6), 'lng': round(float(r[0]['lon']), 6), 'numero': r[0]['address']['house_number']}
    cache[direccion] = out
    return out

def importa(ruta, red=True, hoy=None):
    hoy = hoy or datetime.date.today().isoformat()
    ws = load_workbook(ruta, data_only=True)['Pendientes']
    H = {str(c.value).strip(): i for i, c in enumerate(ws[1]) if c.value}
    col = lambda r, nombre: (r[H[nombre]] if nombre in H and H[nombre] < len(r) else None)
    txt = lambda x: '' if x is None else str(x).strip()
    cache = json.load(open(GEO)) if os.path.exists(GEO) else {}
    items, avisos = {}, []
    for r in ws.iter_rows(min_row=2, values_only=True):
        i = txt(col(r, 'ID'))
        if not i: continue
        n, cat = txt(col(r, 'Nombre')), txt(col(r, 'Categoría'))
        precio, incluye, unidad = numero(col(r, 'Precio por persona (MXN)')), txt(col(r, 'Qué incluye')), sin_acentos(txt(col(r, 'Unidad'))) or 'persona'
        cover, extras, fprecio = numero(col(r, 'Cover (MXN)')), txt(col(r, 'Extras obligatorios')), txt(col(r, 'Fuente del precio (liga)'))
        hor, ultimo, ses = txt(col(r, 'Horario por día')), txt(col(r, 'Último acceso / cocina cierra')), txt(col(r, 'Sesiones u horarios de función'))
        direc, fhor, fecha, notas = txt(col(r, 'Dirección con número')), txt(col(r, 'Fuente del horario/dirección (liga)')), col(r, 'Fecha de verificación'), txt(col(r, 'Notas'))
        if not any([precio is not None, cover is not None, hor, ultimo, ses, direc]): continue
        if isinstance(fecha, (datetime.date, datetime.datetime)): fecha = fecha.strftime('%Y-%m-%d')
        fecha = txt(fecha)
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', fecha):
            avisos.append(f'{i} {n}: sin fecha de verificación válida; se usó la del día de la importación ({hoy}).'); fecha = hoy
        x = {'n': n, 'fecha': fecha, 'resuelve': [], 'origen': 'excel'}
        liga = lambda t: t if re.match(r'^https?://', t) else ''
        # ── precio ──
        if precio is not None or cover is not None:
            if precio is None:
                avisos.append(f'{i} {n}: trae cover pero no precio de consumo; el precio no se aplicó.')
            elif unidad not in ('persona', 'grupo'):
                avisos.append(f'{i} {n}: unidad «{unidad}» no reconocida (usa persona o grupo); el precio no se aplicó.')
            else:
                total = precio + (cover or 0)
                can = [incluye] if incluye else []
                if cover: can.append(f'Incluye cover de ${cover}')
                if extras: can.append('Extra obligatorio: ' + extras)
                x['precio'] = {'min': total, 'rep': total, 'max': total, 'unidad': unidad, 'moneda': 'MXN', 'canasta': '. '.join(can)}
                x['estado'] = 'verificado' if liga(fprecio) else 'estimado'
                x['fuente'] = ('Sitio del lugar' if liga(fprecio) else 'Fundador (Excel de pendientes)') + (' — ' + fprecio if fprecio and not liga(fprecio) else '')
                x['url'] = liga(fprecio)
                if not liga(fprecio): avisos.append(f'{i} {n}: precio sin liga de fuente; entra como ESTIMADO.')
        # ── horario ──
        if hor:
            por, err = horario(hor)
            if err: avisos.append(f'{i} {n}: horario no aplicado ({err}).')
            else:
                x['ohDia'] = {str(d): w for d, w in sorted(por.items())}
                ws_ = list(por.values())
                x['oh'] = [max(w[0] for w in ws_), min(w[1] for w in ws_)] if max(w[0] for w in ws_) < min(w[1] for w in ws_) else max(ws_, key=ws_.count)
                x['dias'] = sorted(por) if len(por) < 7 else []
                x['hrs'] = hor; x['resuelve'].append('horario')
        if ultimo:
            h = hora(re.sub(r'[^\d:.apm ]', '', sin_acentos(ultimo)).strip())
            if h is None: avisos.append(f'{i} {n}: último acceso / cocina «{ultimo}» no entendido.')
            else:
                if h < 6: h += 24
                x['cocinaCierra' if ('cocina' in sin_acentos(ultimo) or (cat in COMIDA and 'acceso' not in sin_acentos(ultimo))) else 'ultimoAcceso'] = h
        if ses:
            x['condicion'] = 'Reserva o elige tu horario: ' + ses; x['resuelve'].append('sesion')
        # ── ubicación ──
        if direc:
            g = geocodifica(direc, cache, red)
            if g: x.update({'lat': g['lat'], 'lng': g['lng'], 'addr': direc}); x['resuelve'].append('ubicacion')
            else: avisos.append(f'{i} {n}: no pude confirmar el número de «{direc}» en el mapa; la ubicación sigue pendiente.')
        if 'ohDia' in x or 'lat' in x or 'condicion' in x:
            x.setdefault('fuente', ('Sitio del lugar' if liga(fhor) else 'Fundador (Excel de pendientes)')); x.setdefault('url', liga(fhor))
            x['hrsFuente'] = ('Sitio del lugar — ' + fhor) if liga(fhor) else 'Fundador (Excel de pendientes)'
        if notas: x['nota'] = notas
        if any(k in x for k in ('precio', 'ohDia', 'lat', 'condicion', 'cocinaCierra', 'ultimoAcceso')): items[i] = x
    json.dump(cache, open(GEO, 'w'), ensure_ascii=False, indent=1)
    return {'archivo': os.path.basename(ruta), 'importado': hoy, 'items': items, 'avisos': avisos}

if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    sal = importa(sys.argv[1], red='--sin-red' not in sys.argv)
    json.dump(sal, open(os.path.join(AQUI, 'verificados_excel.json'), 'w'), ensure_ascii=False, indent=1)
    it = sal['items'].values()
    print(f"{len(sal['items'])} fichas con datos · precio: {sum(1 for x in it if 'precio' in x)} (verificado {sum(1 for x in it if x.get('estado') == 'verificado')}, estimado {sum(1 for x in it if x.get('estado') == 'estimado')})"
          f" · horario: {sum(1 for x in it if 'horario' in x['resuelve'])} · ubicación: {sum(1 for x in it if 'ubicacion' in x['resuelve'])} · sesión: {sum(1 for x in it if 'sesion' in x['resuelve'])}")
    print(f"{len(sal['avisos'])} avisos:"); [print('  -', a) for a in sal['avisos'][:60]]
