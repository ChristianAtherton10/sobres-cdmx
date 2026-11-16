#!/usr/bin/env python3
"""place_id de Google para HOTSPOTS que asignar_ids.py no pudo emparejar (su pin del catálogo es aproximado y
la búsqueda a 1.5 km del pin no los encontraba). Aquí se busca por nombre en toda CDMX y se acepta sólo si el
nombre coincide completo y limpio, y hay un único candidato así (o el más cercano al pin, a <= 6 km).
Guarda ÚNICAMENTE el place_id en progreso.json → data/google_ids.js (lo regenera asignar_ids.py).
Uso: python3 reportes/places/asignar_hotspots.py <lista.json de [id, nombre, lat, lng, cat, colonia, zona]>"""
import json, math, os, re, sys, time, unicodedata
AQUI = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, os.path.join(REPO, 'lib'))
import places as P
if not P.llave(): sys.exit('Falta la llave en ~/.sobres/places_key')
GEN = set('the los las del de la el y and restaurante restaurant bar cafe coffee tacos taqueria cantina cocina mexicana sucursal museo parque cine'.split())
SOBRA = GEN | set('cafeteria cocktail cocktails barra wine vinos bistro bistrot condesa roma polanco juarez coyoacan centro cdmx mexico norte sur santa san angel del valle napoles lomas city ciudad speakeasy mezcaleria cocteleria room club'.split())
NO = {'doctor', 'hospital', 'dentist', 'lawyer', 'school', 'university', 'lodging', 'hotel', 'bank', 'pharmacy', 'church', 'corporate_office', 'apartment_building'}
def pal(s):
    s = unicodedata.normalize('NFD', (s or '').lower()); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return [w for w in re.sub(r'[^a-z0-9 ]', ' ', s).split() if (len(w) > 2 or w.isdigit()) and w not in GEN]
def par(a, b): return a == b or (len(a) > 4 and len(b) > 4 and (a.startswith(b) or b.startswith(a)))
L = json.load(open(sys.argv[1])); prog_p = os.path.join(AQUI, 'progreso.json'); prog = json.load(open(prog_p))
nuevos = 0
for sid, n, lat, lng, cat, col, z in L:
    if prog.get(sid): continue
    base = re.split(r' · | — ', n)[0]
    r = P.buscar(base + (' ' + col if col else '') + ' Ciudad de México', campos='places.id,places.displayName,places.location,places.types')
    if isinstance(r, dict): print('error de Google', r.get('error')); break
    A = pal(base); ok = []
    for c in r:
        if NO & set(c.get('types', [])): continue
        B = pal((c.get('displayName') or {}).get('text', '')); loc = c.get('location', {})
        completo = A and all(any(par(w, b) for b in B) for w in A); limpio = all(any(par(b, w) for w in A) or b in SOBRA for b in B)
        d = math.hypot((loc.get('latitude', 0) - (lat or 0)) * 111, (loc.get('longitude', 0) - (lng or 0)) * 105) if lat else 0
        if completo and limpio and d <= 6: ok.append((d, c['id'], (c.get('displayName') or {}).get('text', '')))
    ok.sort()
    if ok and (len(ok) == 1 or ok[0][0] <= 1.5 or ' · ' not in n):
        prog[sid] = [ok[0][1], round(ok[0][0] * 1000), ok[0][2]]; nuevos += 1; print('  ✓', n, '=', ok[0][2], f'({ok[0][0]:.1f} km del pin del catálogo)')
    else: print('  ·', n, '— sin pareja segura', [x[2] for x in ok][:3])
    time.sleep(0.05)
json.dump(prog, open(prog_p, 'w'), ensure_ascii=False); print(nuevos, 'nuevos')
