#!/usr/bin/env python3
"""Hotspots de SOBRES: los lugares que de verdad recomienda la prensa y las guías.

Pedido del fundador (4 nov 2026): "dale prioridad a los hotspots… actualizadas por
mes". Cada nombre viene de una lista publicada (fuente + fecha). NIVEL:
  3 = estrella Michelin, 50 Best (top 50), museos más visitados / imprescindibles
  2 = Guía México Gastronómico, MB100 de Marco Beteta, aperturas del año / del mes
`mes` = mes en que entró a la lista de SOBRES; las aperturas ("nuevo") pesan
como hotspot del mes durante 4 meses y luego quedan como hotspot normal.
Se actualiza cada mes: agregar la lista nueva en LISTAS, correr
  node reportes/hotspots/catalogo.js && python3 reportes/hotspots/build_hotspots.py
Genera data/hotspots.js (ids del catálogo → nivel, fuentes, mes) y REPORTE.md
con los nombres que todavía no están en el catálogo.
"""
import json, os, re, unicodedata
AQUI = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(AQUI))
HOY = '2026-11-14'; MES = '2026-11'

FUENTES = {
 'mich26':  ('Time Out México — restaurantes de la CDMX con estrella Michelin (Guía Michelin 2026)', 'https://www.timeoutmexico.mx/ciudad-de-mexico/restaurantes/restaurantes-de-la-cdmx-que-tienen-estrella-michelin', '2026-05-20'),
 'bares26': ("Grupo Animal — North America's 50 Best Bars 2026", 'https://grupoanimal.mx/gastronomia/tendencias-gourmet/50-best-mejores-bares-2026-mexico', '2026-04-23'),
 'bares25': ("The World's 50 Best — North America's 50 Best Bars 2025 (1–100)", 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2025-the-list-revealed', '2025-04-29'),
 'latam25': ("Chilango — Latin America's 50 Best Restaurants 2025", 'https://www.chilango.com/comida-y-tragos/restaurantes/mejores-restaurantes-de-cdmx-50-best-latin-americas-lista-completa-2025/', '2025-12-03'),
 'mg26':    ('Chilango — Guía México Gastronómico 2026 (restaurantes de CDMX)', 'https://www.chilango.com/comida-y-tragos/donde-comer-en-cdmx-conoce-los-restaurantes-mas-top-del-2026-segun-la-guia-mexico-gastronomico/', '2026-02-04'),
 'bib25':   ('Récord — Guía Michelin México 2025: restaurantes premiados (Bib Gourmand de CDMX; ceremonia del 3 jun 2025)', 'https://www.record.com.mx/contra/guia-michelin-2025-estos-son-los-restaurantes-premiados-en-mexico', '2025-06-03'),
 'mb100':   ('Chilango — Guía MB100 de Marco Beteta (y sus clásicos de CDMX)', 'https://www.chilango.com/comida-y-tragos/marco-beteta-guia-mb100-los-mejores-100-restaurantes-mexico/', '2024-11-19'),
 'to_ap26': ('Time Out México — Best 2026: las mejores aperturas de restaurantes en CDMX', 'https://www.timeoutmexico.mx/ciudad-de-mexico/restaurantes/best-2026-mejores-aperturas-restaurantes-cdmx', '2026-04-24'),
 'mb_bares26': ('Marco Beteta — 20 bares de reciente apertura en CDMX', 'https://mbmarcobeteta.com/nuevos-bares-cdmx/', '2026-08-04'),
 'hap_oct26': ('The Happening — nuevos hotspots de octubre 2026 en CDMX', 'https://thehappening.com/quieres-conocer-nuevos-restaurantes-aqui-estan-los-hotspots-de-octubre-2026/', '2026-10-06'),
 'mb_nov26': ('Marco Beteta — restaurantes nuevos para visitar en noviembre en CDMX', 'https://mbmarcobeteta.com/restaurantes-nuevos-cdmx/', '2026-11-03'),
 'bares26_100': ("The World's 50 Best — North America's 50 Best Bars 2026, lugares 51–100", 'https://www.the50.com/stories/News/north-americas-50-best-bars-2026-51-100-list.html', '2026-03-31'),
 'mb_clasicos26': ('Marco Beteta — MB100 2026: los 30 clásicos (restaurantes de CDMX)', 'https://mbmarcobeteta.com/los-100-mejores-restaurantes-de-mexico-mb100/', '2025-11-19'),
 'mb100_26': ('Marco Beteta — Los 100 mejores restaurantes de México, MB100 2026 (restaurantes de CDMX)', 'https://mbmarcobeteta.com/los-100-mejores-restaurantes-de-mexico-mb100/', '2025-11-19'),
 'quien_jul26': ('Quién — Los nuevos hotspots de CDMX que ya están en todos los planes', 'https://www.quien.com/estilo-de-vida/2026/07/01/los-nuevos-hotspots-de-cdmx-que-ya-estan-en-todos-los-planes', '2026-07-01'),
 'hap_nov26': ('The Happening — nuevos hotspots para conocer en noviembre 2026', 'https://thehappening.com/nuevos-hotspots-para-conocer-en-noviembre-2026/', '2026-10-30'),
 'museos24': ('Mexico News Daily (datos de Time Out México, INAH e INBAL) — museos más visitados de CDMX en 2024', 'https://mexiconewsdaily.com/culture/most-popular-mexico-city-museums-in-2024', '2025-01-20'),
 'museos26': ('Chilango — museos imprescindibles de CDMX (Mundial 2026)', 'https://www.chilango.com/que-hacer/arte-y-cultura/museos-imperdibles-cdmx-mundial-2026-direccion-costo/amp/', '2026-06-02'),
}
# (fuente, nivel, nuevo?, nombres). Un nombre puede traer alias: 'Nombre|alias1|alias2'.
LISTAS = [
 ('mich26', 3, False, ['Quintonil', 'Pujol', 'Gaba', 'La Once Mil', 'Máximo|Máximo Bistrot', 'Expendio de Maíz|Expendio de Maíz Sin Nombre', 'Masala y Maíz',
                       'Em', 'Sud 777', 'Esquina Común', 'Rosetta', 'Baldío']),
 ('bares26', 3, False, ['Bar Mauro', 'Tlecan|Tlecān', 'Handshake Speakeasy|Handshake', 'Form + Matter|FORM + MATTER (FOMA)|Form Matter', 'Licorería Limantour',
                        'Kaito del Valle', 'Baltra|Baltra Bar']),
 ('bares25', 2, False, ['Rayo|Rayo Cocktail Bar', 'Bijou Drinkery Room', 'Café de Nadie', 'Brujas', 'Ticuchi', 'Casa Prunes']),
 ('latam25', 3, False, ['Quintonil', 'Máximo|Máximo Bistrot', 'Rosetta']),
 ('mg26', 2, False, ['Ajoblanco', 'Al Andalus', 'Alfil', 'Almara', 'Arango', 'Au Pied de Cochon', 'Azul Histórico|Azul Condesa|Azul y Oro|Azulísimo', 'Balcón del Zócalo',
   'Baldío', 'Botánico', 'Bulla', 'Cachava', 'Cana', 'Carmela & Sal|Carmela y Sal', 'Cascabel', 'Centro Castellano', 'Chapulín', 'Contramar', 'Çuina|Cuina',
   'Dante Brasa y Fuego', 'Ehden', 'El Bajío', 'El Cardenal', 'El Mirador de Chapultepec|Cantina El Mirador', 'Eloise|Eloise Chic Cuisine', 'Em', 'Emilio',
   'Er Rre|Er Rre un Bistró', 'Esquina Común', 'Fabia', 'Fierro', 'Fonda Margarita', 'Fónico', 'Gaba', 'Galea', 'Grana|Grana Sabores de Origen', 'Guzina Oaxaca', 'Havre 77', 'Kill Bill',
   'La Cabrera', 'La Cocina del Bizco', 'Limosneros', 'Lina', 'Lorea', 'Los Danzantes', 'Los Panchos', 'Maizajo', 'Marea', 'Mattea', 'Máximo|Máximo Bistrot', 'Meroma',
   'Mi Compa Chava', 'Migrante', 'Momiji', 'Nicos', 'Pargot', 'Plonk', 'Prendes', 'Pujol', 'Raíz', 'Rocasal', 'Sarde', 'Sartoria', 'Sesame', 'Siembra Comedor|Siembra',
   'Somsaa', 'Taco Tasting Room', 'Tenampa|Salón Tenampa', 'The Lamb', 'The Palm', 'Tierra Adentro', 'Tori Tori', 'Torre de Castilla', 'Vega', 'Voraz', 'Xuva', 'Yoshimi',
   'Zagala', 'Zeru', 'La Once Mil', 'Brutal']),
 ('bib25', 2, False, ['Contramar', 'Voraz', 'Ultramarinos Demar', 'Tacos de Valle|Tacos del Valle', 'La 89']),
 ('mb100', 2, False, ['Máximo|Máximo Bistrot', 'Havre 77', 'Quintonil', 'Sushi Iwashi', 'Er Rre|Er Rre un Bistró', 'Zeru', 'Makan', 'Martínez', 'Mi Compa Chava', 'Em', "Morton's",
   'Galanga|Galanga Thai House', 'Romina', 'Al Andalus', 'Limosneros', 'Sarde', 'Entremar', 'Cana', 'Costa Guadiana', 'Carmela y Sal', 'Pargot', "Arturo's", 'Raíz',
   'Zagala', 'La Barra de Fran', 'Yoshimi', 'Meroma', 'Eloise', 'Siembra', 'Galea', 'Masala y Maíz', 'Azul Histórico', 'Balcón del Zócalo', 'Loma Linda',
   'Cantina El Mirador', 'The Palm', 'Deigo|Deigo Cocina Tradicional Japonesa', 'Suntory', 'San Ángel Inn', 'Danubio', 'El Cardenal', 'Nicos', 'Bakea', 'Hunan', 'Contramar', 'La Taberna del León',
   'Gruta Ehden', 'Bar El Bosque|Cantina El Bosque|Cantina del Bosque', 'Pujol']),
 ('to_ap26', 2, True, ['Lindy', 'Viamonte', 'Lotti', 'El Mekong', 'Esca', 'Cobarde', 'Marne Café|Marne', 'Marisquería Julichi', "L'Enfant", 'Marta', 'Pistilo', 'Fritanguita',
   'Savvia', 'Étranger', 'OTTO', 'Varde', 'Crissis', 'Mantequilla Social Club', 'Burger Gang', 'Café Margarita', 'Alboroto', 'Lorenzo', 'Sente', 'Alegra', 'Bar Latosa',
   'Chalino Chino', 'Rosso|Rosso Speakeasy', 'Club El Desconocido', 'Grasso', 'Bartola', 'Faba', 'Franz|Franz 145', 'Ramen Ichi', 'Giorgio', 'Del Río']),
 ('mb_bares26', 2, True, ['Tokyo Lomas', 'Shhh Roma|Shhh', 'Bar Latosa', 'Varde', 'Ruido', 'Rosso|Rosso Speakeasy', 'Bar Ocaso', 'Procusto', 'Franz 145|Franz', 'Librería Valladolid', 'RO Upstairs|Ro upstairs',
   'Katz', 'Bar Básico', 'Petra', 'Less is More', 'La Vista', 'Diamantina', 'Bar Mauro', 'Trampa Bar|Trampa', 'Form + Matter|FORM + MATTER (FOMA)']),
 ('hap_oct26', 2, True, ['Mesa', 'El Bar', 'Mistral|Restaurante Mistral', 'Andante', 'Barrita de Sushi', 'Cupido Café|Cupido Café Polanco', 'U-89 Bar|U-89', 'Copernico', 'El Tenebroso', 'Enzu',
   'La Cava de la Docena', 'Celita']),
 ('mb_nov26', 2, True, ['El Bar', 'Café Tormenta', 'Barrita de Sushi', 'Bar de Verano', 'El Silverio', 'Grulla', 'Mistral|Restaurante Mistral', 'Yuhu Izakaya Hi-Fi|Yuhu', 'XOB', 'Nico Pan y Café']),
 ('museos24', 3, False, ['Museo Nacional de Antropología|Museo Nacional de Antropología (MNA)', 'Museo Nacional de Historia|Museo Nacional de Historia · Castillo de Chapultepec|Castillo de Chapultepec',
   'Palacio de Bellas Artes|Museo del Palacio de Bellas Artes', 'Museo Frida Kahlo|Casa Azul', 'Templo Mayor|Templo Mayor (museo y zona arqueológica)|Museo del Templo Mayor',
   'Museo Franz Mayer', 'Museo de Arte Moderno', 'Museo Nacional de las Culturas del Mundo', 'Museo Tamayo']),
 ('museos26', 3, False, ['Museo Nacional de Antropología|Museo Nacional de Antropología (MNA)', 'Museo Frida Kahlo', 'Palacio de Bellas Artes|Museo del Palacio de Bellas Artes',
   'Museo Anahuacalli|Anahuacalli', 'Templo Mayor|Templo Mayor (museo y zona arqueológica)|Museo del Templo Mayor', 'Museo Franz Mayer', 'Mumedi|MUMEDI|Museo Mexicano del Diseño',
   'Museo Numismático Nacional']),
 # MB100 2026 (sólo CDMX). 'Siembra Comedor' no se alía a Siembra Tortillería/terraza (otros lugares).
 ('mb100_26', 2, False, ['Al Andalus|Al Andalus · San Angel', 'Balcón del Zócalo', 'Cana', 'Carmela y Sal', 'Costa Guadiana', 'Em', 'Entremar', 'Er Rre|Er Rre un Bistró',
   'Gaba', 'Galanga|Galanga Thai House', 'Havre 77', 'Hotaru', 'Issi', 'Jowong', 'Lorea', 'Makan', 'Martínez', 'Máximo Bistrot|Máximo', 'Mi Compa Chava', 'Momiji',
   'Propio', 'Quintonil', 'Sartoria', 'Siembra Comedor', 'Sudestada', 'Supplì', 'Sushi Iwashi', 'Trillo', 'Ultramarinos Demar', 'Voraz', 'Yoshimi|Yoshimi · Hyatt Regency', 'Zeru']),
 ('quien_jul26', 2, True, ['Lotti', 'La Bellezza|La Bellezza México', 'Faba', 'Marne Café|Marne', 'El Mekong|El Mékông', 'Varde', 'Katz', 'Sona|Sona · sala de escucha']),
 ('hap_nov26', 2, True, ['El Silverio', 'Los Super Elegantes', 'Jocoque House Polanco', 'Yellow Cup Coffee', 'Ramen Oscuro|Oscuro Ramen', 'Mirta', 'Iwashi Lomas', 'Cassette',
   'Taquería El Cuadrilátero|Taqueria El Cuadrilátero', 'Moré', 'Parla Juárez', "Chico's Café|Chico’s Cafe", 'Atlantis', 'Archivo', 'Grulla', 'Bar de Verano']),
]

# ── Revisión del 14 nov 2026: listas que ya envejecieron (marcadas «revisar» por la app) ──
# Se cotejó cada lugar contra la edición vigente de su lista. Lo que se renovó entra por la lista nueva;
# la lista vieja deja de dar la marca de hotspot por sí sola (el lugar sigue en el catálogo).
RETIRADAS = {
 'bares25': "50 Best Bars 2025 (18 meses). En 2026 sólo Café de Nadie sigue (No. 60, lista 51–100); Rayo, Ticuchi, Bijou, Casa Prunes y Brujas no están ni en 1–50 ni en 51–100.",
# 'mb100' (Chilango, nov 2024) NO se retira: son los clásicos que el fundador pidió destacar (pruebas 35.x). En la edición 2026
 # siguen San Ángel Inn, Hunan y Suntory (lista mb_clasicos26); Bakea, Deigo, La Barra de Fran, La Taberna del León, Loma Linda,
 # Morton's, Gruta Ehden, Danubio y Cantina del Bosque ya no aparecen: quedan «por revisar» hasta que el fundador decida.
 'to_ap26': "Aperturas de abril de 2026: a los 6 meses dejan de contar como «nuevo».",
}
LISTAS = [l for l in LISTAS if l[0] not in RETIRADAS] + [
 ('bares26_100', 2, False, ['Café de Nadie']),
 ('mb_clasicos26', 2, False, ['San Ángel Inn', 'Hunan', 'Suntory']),
]
FUENTES = {f: v for f, v in FUENTES.items() if f not in RETIRADAS}

def k(s):
    s = unicodedata.normalize('NFD', (s or '').lower()); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s.replace('&', 'y'))
def principal(n):
    return re.split(r' · | — ', n)[0]

cat = json.load(open(os.path.join(AQUI, 'catalogo.json')))   # [id, n, lat, lng, cat] (node reportes/hotspots/catalogo.js)
idx = {}
for sid, n, lat, lng, c in cat:
    for clave in {k(n), k(principal(n)), k(re.sub(r'\s*\(.*?\)', '', principal(n)))}:
        if clave: idx.setdefault(clave, []).append((sid, n, c))
# Coincidencias de nombre que NO son el lugar de la lista.
NO_ES = {'os-n9965047017'}   # "Hunan" de OpenStreetMap en Satélite ≠ Hunan (clásico de Marco Beteta, Lomas)
hot, faltan = {}, []
for f, nivel, nuevo, nombres in LISTAS:
    for entrada in nombres:
        nombre, *alias = entrada.split('|')
        ids = []
        for x in [nombre] + alias:
            for sid, n, c in idx.get(k(x), []):
                if sid not in NO_ES and sid not in [i for i, _ in ids]: ids.append((sid, n))
        # "Siembra" → "Siembra Tortillería": el nombre de la lista como INICIO del nombre
        # del catálogo (sólo nombres de 6+ letras, para no pegar "Mesa" o "Vega" a otro).
        if not ids:
            for x in [nombre] + alias:
                kx = k(x)
                if len(kx) < 6: continue
                for sid, n, lat, lng, c in cat:
                    if c in ('Restaurante', 'Bar', 'Café', 'Cantina', 'Izakaya', 'Fonda de autor', 'Speakeasy', 'Bar de autor', 'Mezcalería', 'Rooftop', 'Taquería', 'Museo') \
                       and k(principal(n)).startswith(kx) and sid not in NO_ES and sid not in [i for i, _ in ids]: ids.append((sid, n))
        if not ids:
            faltan.append((f, nombre)); continue
        for sid, n in ids:
            h = hot.setdefault(sid, {'nivel': 0, 'f': [], 'mes': MES, 'nuevo': False, 'n': n})
            h['nivel'] = max(h['nivel'], nivel); h['nuevo'] = h['nuevo'] or nuevo
            if f not in h['f']: h['f'].append(f)
out = {sid: {'nivel': h['nivel'], 'f': h['f'], 'mes': h['mes'], **({'nuevo': True} if h['nuevo'] else {})} for sid, h in hot.items()}
js = ('/* SOBRES — Hotspots (reportes/hotspots/build_hotspots.py). Cada lugar viene de una lista publicada\n'
      ' * (fuente y fecha en `fuentes`). Se actualiza cada mes. */\n'
      'window.SOBRES_HOTSPOTS = ' + json.dumps({'version': 1, 'actualizado': HOY, 'proxima': '2026-12-01',
        'fuentes': {k2: {'n': v[0], 'url': v[1], 'fecha': v[2]} for k2, v in FUENTES.items()}, 'ids': out}, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(REPO, 'data', 'hotspots.js'), 'w').write(js)
L = ['# Hotspots — ' + HOY, '', f'{len(out)} lugares del catálogo marcados como hotspot.', '', '## Faltan en el catálogo', '']
L = L[:4] + ['## Listas retiradas en la revisión del 14 nov 2026', ''] + [f'- `{f}`: {m}' for f, m in RETIRADAS.items()] + [''] + L[4:]
for f, n in faltan: L.append(f'- {n} ({FUENTES[f][0]})')
open(os.path.join(AQUI, 'REPORTE.md'), 'w').write('\n'.join(L) + '\n')
print(len(out), 'hotspots en catálogo;', len(faltan), 'faltan')
print('FALTAN:', ', '.join(sorted(set(n for _, n in faltan))))
