#!/usr/bin/env python3
"""Confirma pines con número de calle (Nominatim) o, para parques, con una esquina de acceso (Overpass).
Regla de SOBRES: sin número confirmado ni esquina, la ficha no sale. Resultado → reportes/pasada/pines.json.
Uso: python3 reportes/pasada/confirma_pines.py   (la lista está abajo; cada entrada dice de dónde sale la dirección)"""
import json, os, time, urllib.request, urllib.parse
AQUI = os.path.dirname(os.path.abspath(__file__)); PINES = os.path.join(AQUI, 'pines.json')
UA = {'User-Agent': 'sobres-catalogo/1.0'}
# id: (calle, número, colonia/ciudad)  — dirección tal como está en la ficha (Excel del fundador o fuente de la ficha)
NUMEROS = {
  'rv-4de0eaf5c4': ('Avenida Desierto de los Leones', '52', 'San Ángel, Ciudad de México'),
  'rv-5cd139a78f': ('Héroes de Padierna', '132', 'San Jerónimo Lídice, Ciudad de México'),
  'rv-611785805c': ('Adolfo Prieto', '1439', 'Del Valle, Ciudad de México'),
  'rv-4e1c5b7751': ('Calle 3', '55', 'Lomas de Santa Fe, Ciudad de México'),
  'rv-3fe70cd44c': ('Boulevard Manuel Ávila Camacho', '3023', 'Naucalpan, Estado de México'),
  'rv-c2387c7acc': ('Ignacio Aldama', '74', 'Del Carmen, Coyoacán, Ciudad de México'),
  'rv-68d8b1cf0e': ('Monte Líbano', '915', 'Lomas de Chapultepec, Ciudad de México'),
  'rv-8712b60b44': ('Avenida Santa Fe', '601', 'Santa Fe, Ciudad de México'),
  'xl-R0294': ('Tlacoquemécatl', '47', 'Del Valle, Ciudad de México'),
  'pq-7df4adaa3b': ('Manzanas', '27', 'Tlacoquemécatl del Valle, Ciudad de México'),
  'pq-f74ea3648f': ('Aniceto Ortega', '1148', 'Del Valle, Ciudad de México'),
  'xl-C0100': ('Petén', '434', 'Narvarte, Ciudad de México'),
}
# id: (calle A, calle B) — esquina de acceso de un parque (los parques no tienen número)
ESQUINAS = {
  'cdmx-0098': ('Avenida de los Insurgentes Sur', 'Avenida Porfirio Díaz'),        # Parque Hundido
  'cdmx-0094': ('Avenida División del Norte', 'Avenida Municipio Libre'),           # Parque de los Venados
}
def pide(url, data=None):
    req = urllib.request.Request(url, data=data, headers=UA)
    try: return json.loads(urllib.request.urlopen(req, timeout=40).read())
    except Exception as e: return {'error': str(e)}
def numero(calle, num, lugar):
    q = urllib.parse.urlencode({'street': f'{num} {calle}', 'city': lugar.split(',')[-2].strip() if lugar.count(',') else lugar, 'country': 'México', 'format': 'jsonv2', 'addressdetails': 1, 'limit': 3})
    r = pide('https://nominatim.openstreetmap.org/search?' + q); time.sleep(1.1)
    if not isinstance(r, list) or not r:
        q = urllib.parse.urlencode({'q': f'{calle} {num}, {lugar}', 'format': 'jsonv2', 'addressdetails': 1, 'limit': 3})
        r = pide('https://nominatim.openstreetmap.org/search?' + q); time.sleep(1.1)
    for x in (r if isinstance(r, list) else []):
        hn = (x.get('address') or {}).get('house_number', '')
        if hn and num in [t.strip() for t in hn.replace('-', ',').replace(';', ',').split(',')] or hn == num:
            return round(float(x['lat']), 6), round(float(x['lon']), 6)
    return None
def esquina(a, b):
    q = f'[out:json][timeout:30];area["name"="Ciudad de México"]["admin_level"="4"]->.c;way["highway"]["name"="{a}"](area.c)->.a;way["highway"]["name"="{b}"](area.c)->.b;node(w.a)(w.b);out;'
    r = pide('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode()); time.sleep(2)
    el = (r or {}).get('elements') or []
    return el
if __name__ == '__main__':
    P = json.load(open(PINES))
    for i, (c, n, l) in NUMEROS.items():
        if i in P: continue
        g = numero(c, n, l); nota = ''
        if not g:
            for d in (2, -2, 4, -4, 6, -6):     # número vecino del mismo lado de la calle
                g = numero(c, str(int(n) + d), l)
                if g: nota = f'Pin en el número vecino {int(n) + d} de la misma calle (Nominatim no tiene el {n}).'; break
        print(i, c, n, '→', g, nota)
        if g: P[i] = {'lat': g[0], 'lng': g[1], 'nota': nota}
    for i, (a, b) in ESQUINAS.items():
        if i in P: continue
        el = esquina(a, b); print(i, a, '×', b, '→', [(e['lat'], e['lon']) for e in el][:4])
        if el: P[i] = {'lat': round(el[0]['lat'], 6), 'lng': round(el[0]['lon'], 6), 'nota': f'Parque sin número: pin en la esquina de acceso {a} y {b} (OpenStreetMap).', 'esquina': True}
    json.dump(P, open(PINES, 'w'), ensure_ascii=False, indent=1)
