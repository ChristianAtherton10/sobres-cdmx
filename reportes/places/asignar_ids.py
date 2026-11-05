#!/usr/bin/env python3
"""Asigna a cada lugar del catálogo su place_id de Google (Places API New).

Una sola vez (y luego sólo para lugares nuevos). Guarda ÚNICAMENTE el place_id
(lo único que los términos de Google permiten guardar) en data/google_ids.js.
Búsqueda limitada a ~1.5 km alrededor del lugar y siempre dentro de CDMX.
Se empareja con el nombre completo a <= 1.6 km, o con parte del nombre a <= 400 m.
Uso:  node reportes/places/lista.js && python3 reportes/places/asignar_ids.py [--max N]
La llave se lee de ~/.sobres/places_key; nunca se imprime.
"""
import json, math, os, re, sys, time, unicodedata
AQUI = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, os.path.join(REPO, 'lib'))
import places as P

if not P.llave(): sys.exit('Falta la llave en ~/.sobres/places_key')
MAX = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 10**9
GEN = set('the los las del de la el y and restaurante restaurant bar cafe coffee tacos taqueria cantina cocina mexicana sucursal museo parque cine'.split())
def palabras(s):
    s = unicodedata.normalize('NFD', (s or '').lower()); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return [w for w in re.sub(r'[^a-z0-9 ]', ' ', s).split() if (len(w) > 2 or w.isdigit()) and w not in GEN]
# Tipos de Google que nunca son una salida (un doctor "Fierro", un hospital "Polar").
NO_SALIDA = {'doctor', 'hospital', 'dentist', 'lawyer', 'accounting', 'real_estate_agency', 'general_contractor', 'insurance_agency',
             'physiotherapist', 'veterinary_care', 'car_repair', 'car_dealer', 'storage', 'moving_company', 'electrician', 'plumber',
             'locksmith', 'roofing_contractor', 'funeral_home', 'school', 'primary_school', 'secondary_school', 'university',
             'corporate_office', 'consultant', 'finance', 'bank', 'atm', 'government_office', 'local_government_office', 'police',
             'post_office', 'pharmacy', 'drugstore', 'health', 'medical_lab', 'beauty_salon', 'hair_care', 'laundry', 'gas_station',
             'parking', 'lodging', 'hotel', 'apartment_building', 'housing_complex', 'church', 'place_of_worship'}
# Palabras que pueden sobrar en el nombre de Google sin cambiar de lugar.
SOBRA = GEN | set('cafeteria cocktail cocktails bar barra wine vinos restaurante bistro bistrot condesa roma polanco juarez coyoacan centro cdmx mexico norte sur santa san angel del valle napoles lomas sucursal mx'.split())
def par(a, b): return a == b or (len(a) > 4 and len(b) > 4 and (a.startswith(b) or b.startswith(a)))

L = json.load(open(os.path.join(AQUI, 'lista.json')))
prog_p = os.path.join(AQUI, 'progreso.json')
prog = json.load(open(prog_p)) if os.path.exists(prog_p) else {}
hechos = 0
for sid, n, lat, lng, cat in L:
    if sid in prog or hechos >= MAX: continue
    if not P.en_cdmx(lat, lng): prog[sid] = None; continue   # sin coordenada válida (0,0) o fuera de CDMX
    q = re.sub(r'\s*·\s*', ' ', n)
    r = P.buscar(q, lat, lng, campos='places.id,places.displayName,places.location,places.types')
    if isinstance(r, dict):
        print('Google respondió error', r.get('error'), '— me detengo'); break
    A = palabras(n); best = None
    for c in r:
        loc = c.get('location', {}); d = math.hypot((loc.get('latitude', 0) - lat) * 111, (loc.get('longitude', 0) - lng) * 105) * 1000
        B = palabras((c.get('displayName') or {}).get('text', ''))
        s = sum(1 for w in A if any(par(w, b) for b in B))
        # Nombre completo igual: vale hasta 1.6 km (muchos pines del catálogo están
        # corridos: Quintonil a 736 m, Fonda Margarita a 1.3 km). A medias: 400 m.
        if NO_SALIDA & set(c.get('types', [])): continue
        completo = (A and s == len(A)) or (not A and palabras(n + ' x') == palabras((c.get('displayName') or {}).get('text', '') + ' x'))
        # Lejos del pin, el nombre de Google no puede traer palabras de más.
        limpio = all(any(par(b, w) for w in A) or b in SOBRA for b in B)
        if ((completo and limpio and d <= 1600) or (s >= 1 and d <= 400)) and (best is None or (s, -d) > (best[0], -best[1])):
            best = (s, d, c['id'], (c.get('displayName') or {}).get('text', ''))
    prog[sid] = [best[2], round(best[1]), best[3]] if best else None
    hechos += 1
    if hechos % 50 == 0:
        json.dump(prog, open(prog_p, 'w'), ensure_ascii=False); print(hechos, 'consultados', flush=True)
    time.sleep(0.05)
json.dump(prog, open(prog_p, 'w'), ensure_ascii=False)
ids = {k: v[0] for k, v in prog.items() if v}
open(os.path.join(REPO, 'data', 'google_ids.js'), 'w').write(
    '/* SOBRES — place_id de Google para cada lugar (reportes/places/asignar_ids.py). Sólo ids: horario,\n'
    ' * precio y calificación se piden en vivo a /api/lugar (términos de Google Maps Platform). */\n'
    'window.SOBRES_GID = ' + json.dumps({'version': 1, 'fecha': time.strftime('%Y-%m-%d'), 'ids': ids}, separators=(',', ':')) + ';\n')
print(len(ids), 'con place_id de', len(prog), 'consultados;', sum(1 for v in prog.values() if not v), 'sin pareja')
