#!/usr/bin/env python3
"""Lugares investigados a mano (4 nov 2026) para las piezas de receta con poca oferta.

Cada ficha lleva la fuente (URL), la fecha de la fuente y la fecha de consulta.
Reglas:
  - Precio u horario que la fuente no publica → "estimado" / "Horario por confirmar".
  - Fuente anterior a 2024 o sin fecha → recomendable:false (sólo Explorar hasta
    reverificar), igual que se hizo con el paquete del 3 nov.
  - Coordenadas: las de la ficha oficial cuando las da; si no, OpenStreetMap
    (Nominatim) con la dirección de la fuente; si tampoco, centro de la colonia
    marcado como aproximado.
Genera data/investigados.js y reportes/investigados/REPORTE.md.
"""
import hashlib, json, math, os, time, urllib.parse, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(AQUI))
HOY = '2026-11-04'

ZONAS = {'roma': (19.419, -99.16), 'romasur': (19.404, -99.157), 'condesa': (19.411, -99.174), 'polanco': (19.433, -99.195),
 'juarez': (19.427, -99.157), 'centro': (19.434, -99.137), 'chapultepec': (19.417, -99.186), 'coyoacan': (19.35, -99.162),
 'sanangel': (19.346, -99.187), 'delvalle': (19.386, -99.167), 'cu': (19.322, -99.185), 'santafe': (19.366, -99.26),
 'xochimilco': (19.2735, -99.1035), 'lomas': (19.4235, -99.2265), 'satelite': (19.508, -99.236)}

def zona_de(lat, lng):
    best = min(ZONAS.items(), key=lambda kv: math.hypot((kv[1][0] - lat) * 111, (kv[1][1] - lng) * 105))
    return best[0], math.hypot((best[1][0] - lat) * 111, (best[1][1] - lng) * 105)

# ------------------------------------------------------------------ fuentes
F = {
 'turismo': ('Secretaría de Turismo CDMX — ficha oficial del lugar', None, 'sin fecha (consultada ' + HOY + ')'),
 'nmas_traj': ('N+ — tarifas de trajineras, Semana Santa 2026 (cita a la Alcaldía Xochimilco)', 'https://www.nmas.com.mx/estilo-de-vida/lugares/xochimilco-semana-santa-tarifas-trajineras-embarcadero-nativitas-2026/', '2026-04-03'),
 'sopitas_kar': ('Sopitas — karaokes en la CDMX', 'https://www.sopitas.com/?p=1786049', '2025-02-16'),
 'to_billar': ('Time Out México — billares y boliches en la CDMX', 'https://www.timeoutmexico.mx/ciudad-de-mexico/bares-y-cantinas/billares-y-boliches-en-la-cdmx', '2025-02-07'),
 'chil_billar': ('Chilango — 6 billares que debes visitar en CDMX', 'https://www.chilango.com/comida-y-tragos/bares/billares-en-cdmx/', '2024-07-03'),
 'sopitas_bol': ('Sopitas — los 5 mejores lugares para jugar boliche en la CDMX', 'https://www.sopitas.com/mientras-tanto/ya-de-vacaciones-los-5-mejores-lugares-para-jugar-bolos-en-la-cdmx-boliche/amp/', '2023-12-24'),
 'to_karts': ('Time Out México — lugares de go karts en CDMX', 'https://www.timeoutmexico.mx/ciudad-de-mexico/ninos/lugares-de-go-karts-en-cdmx', '2024-11-26'),
 'chil_karts': ('Chilango — dónde hay go karts en CDMX', 'https://www.chilango.com/noticias/donde-hay-go-karts-en-cdmx-y-cerca-estas-son-las-pistas-mas-chidas-precio-horarios-y-ubicacion/', '2023-09-22'),
 'chil_baile26': ('Chilango — 7 lugares para sacar los prohibidos y bailar en CDMX', 'https://www.chilango.com/que-hacer/donde-bailar-en-cdmx-lugares-para-sacar-los-prohibidos/', '2026-07-24'),
 'chil_salsa23': ('Chilango — lugares para bailar salsa en la CDMX', 'https://www.chilango.com/que-hacer/musica/lugares-para-bailar-salsa/', '2023-02-16'),
 'to_moliere': ('Time Out México — Mercado Molière', 'https://www.timeoutmexico.mx/ciudad-de-mexico/restaurantes/mercado-moliere', '2016-03-02'),
 'chil_chopo': ('Chilango — Tianguis del Chopo celebra 45 aniversario', 'https://www.chilango.com/noticias/tianguis-del-chopo-aniversario-2025-fecha-cartelera/', '2025-10-03'),
 'adn_cines': ('adn40 — los mejores cines independientes escondidos en la CDMX', 'https://www.adn40.mx/tiempo-libre/2025-07-16/vacaciones-verano-2025-los-mejores-cines-independientes-escondidos-en-la-cdmx', '2025-07-16 (act. 2026-07-07)'),
 'filmoteca': ('Filmoteca UNAM — salas y programación', 'https://www.filmoteca.unam.mx/', 'programación de oct 2026 (consultada ' + HOY + ')'),
 'publi_cdd': ('Publimetro — el América seguirá jugando en el Estadio Ciudad de los Deportes', 'https://www.publimetro.com.mx/noticias/2025/09/02/america-seguira-jugando-en-el-estadio-ciudad-de-los-deportes-bj-toma-decision/', '2025-09-02'),
 'exp_harp': ('Expansión — quién es dueño del Estadio Alfredo Harp Helú, casa de los Diablos Rojos', 'https://expansion.mx/tendencias/2026/08/04/quien-es-dueno-estadio-alfredo-harp-helu-casa-diablos-rojos', '2026-08-04'),
 'sopitas_bici': ('Sopitas — guía para andar en bici dentro del Bosque de Chapultepec (Ecobici Los Pinos)', 'https://www.sopitas.com/mientras-tanto/guia-andar-bicicleta-dentro-bosque-chapultepec-ecobici-cdmx/amp/', '2024-07-22'),
 'chil_ecobici': ('Chilango — Ecobici tendrá estación en Chapultepec (tarifas 2025)', 'https://www.chilango.com/noticias/transporte/ecobici-cdmx-estacion-chapultepec/', '2025'),
 'inah_mnh': ('INAH — Museo Nacional de Historia, Castillo de Chapultepec (ficha oficial)', 'https://lugares.inah.gob.mx/en/node/4961', 'sin fecha (consultada ' + HOY + ')'),
 'turismo_esc': ('Secretaría de Turismo CDMX — Espacio Escultórico UNAM (ficha oficial)', 'https://mexicocity.cdmx.gob.mx/venues/unam-sculpture-space/', 'sin fecha (consultada ' + HOY + ')'),
 'fp_huerto': ('Food & Pleasure — Huerto Roma Verde', 'https://foodandpleasure.com/huerto-roma-verde/', '2025-10-18'),
 'chil_tacos_roma': ('Chilango — mejores tacos de la colonia Roma', 'https://www.chilango.com/comida-y-tragos/mejores-tacos-colonia-roma/', '2024-03-27'),
 'chil_cantinas': ('Chilango — cantinas de la vieja escuela en el Centro Histórico', 'https://www.chilango.com/agenda/vida-nocturna/cantinas-de-la-vieja-escuela-en-el-centro-historico-ciudad-de-mexico/', '2023-07-13'),
 'md_jamaica': ('México Desconocido — Mercado de Jamaica: lo que tienes que saber', 'https://www.mexicodesconocido.com.mx/mercado-de-jamaica-cdmx-tips.html', 'sin fecha'),
 'md_vasconcelos': ('México Desconocido — Biblioteca Vasconcelos, la más grande de México', 'https://escapadas.mexicodesconocido.com.mx/atractivos/biblioteca-vasconcelos-la-mas-grande-de-mexico/', 'sin fecha'),
 'hap_veg': ('The Happening — restaurantes veganos y vegetarianos en CDMX', 'https://thehappening.com/restaurantes-veganos-y-vegetarianos-con-buenos-platillos-en-cdmx/', '2026-02-27'),
 'trend_veg': ('Trend México — Restaurantes veganos en la CDMX 2026', 'https://www.trendmexico.com/restaurantes-veganos-en-la-cdmx/', '2026 (título del artículo)'),
 'exc_xochi': ('Excélsior — dónde comer en Xochimilco', 'https://www.excelsior.com.mx/estilo-de-vida/donde-comer-xochimilco-mejores-restaurantes-y-antojitos', '2025 (posterior a jul 2025: cita la tarifa de trajineras de $750)'),
 'fever_bb': ('Fever — Auditorio BlackBerry (cartelera vigente)', 'https://feverup.com/es/ciudad-de-mexico/venue/auditorio-blackberry', 'sin fecha (consultada ' + HOY + ')'),
 'fever_gnp': ('Fever — Estadio GNP Seguros (cartelera vigente)', 'https://feverup.com/es/ciudad-de-mexico/venue/foro-sol', 'sin fecha (consultada ' + HOY + ')'),
 'to_palacio': ('Time Out México — conciertos en el oriente de la CDMX en 2026 (Palacio de los Deportes)', 'https://www.timeoutmexico.mx/ciudad-de-mexico/musica/conciertos-en-oriente', '2026'),
 'nmas_torres': ('N+ — Torres de Satélite recuperan su luz', 'https://www.nmas.com.mx/estado-de-mexico/estilo-de-vida/lugares/torres-de-satelite-recuperan-su-luz-asi-se-ven-iluminadas-de-noche/', '2025-05'),
 'to_capitana': ('Time Out México — La Capitana (mezcalería en Satélite)', 'https://www.timeoutmexico.mx/ciudad-de-mexico/antros-bares/la-capitana', 'sin fecha'),
 'res_blog_sat': ('Reservándonos — los 7 mejores bares de Satélite', 'https://reservandonos.com/blog/mejores-bares-para-dar-el-grito-satelite/', '2025-08-06'),
 'res_bagheera': ('Reservándonos — Bagheera Rooftop Satélite (ficha vigente)', 'https://reservandonos.com/lugar/bagheera-rooftop-satelite/', 'sin fecha (consultada ' + HOY + ')'),
 'res_coralillo': ('Reservándonos — Coralillo Bar Satélite (ficha vigente)', 'https://reservandonos.com/lugar/coralillo-bar-satelite/', 'sin fecha (consultada ' + HOY + ')'),
 'res_doce': ('Reservándonos — Terraza Doce Satélite (ficha vigente)', 'https://reservandonos.com/lugar/terraza-doce-satelite/', 'sin fecha (consultada ' + HOY + ')'),
 'res_bilboa': ('Reservándonos — Bilboa Terraza Club Satélite (ficha vigente)', 'https://reservandonos.com/lugar/bilboa-terraza-club-satelite/', 'sin fecha (consultada ' + HOY + ')'),
 'res_cantaritos': ('Reservándonos — Cantaritos El Compa de Jalisco Satélite (ficha vigente)', 'https://reservandonos.com/lugar/cantaritos-el-compa-de-jalisco-satelite/', 'sin fecha (consultada ' + HOY + ')'),
 'intravel_fiera': ('Intravel — Fiera Rooftop, Lomas Virreyes (ficha vigente)', 'https://intravel.net/mexico-city/nightlife/fiera-rooftop', 'sin fecha (consultada ' + HOY + ')'),
 'res_bastian': ('Reservándonos — Bastian, Arcos Bosques (ficha vigente)', 'https://reservandonos.com/lugar/bastian-arcos-bosques/', 'sin fecha (consultada ' + HOY + ')'),
 'res_karaoke_il': ('Reservándonos — Terraza Karaoke Interlomas (ficha vigente)', 'https://reservandonos.com/en/place/terraza-karaoke-interlomas', 'sin fecha (consultada ' + HOY + ')'),
 'res_bocanariz': ('Reservándonos — Boca Nariz Interlomas (ficha vigente)', 'https://reservandonos.com/en/place/restaurante-boca-nariz-interlomas', 'sin fecha (consultada ' + HOY + ')'),
 'res_kamachos': ('Reservándonos — Kamachos Hookah Interlomas (ficha vigente)', 'https://reservandonos.com/en/place/kamachos-hookah-interlomas', 'sin fecha (consultada ' + HOY + ')'),
 'inf_bonvi': ('The Infatuation — La Bonvi (reseña y ficha)', 'https://www.theinfatuation.com/mexico-city/reviews/la-bonvi', 'sin fecha (consultada ' + HOY + ')'),
 'web_mirador': ('Cantina El Mirador — sitio oficial', 'https://www.cantinaelmirador.com/', 'sin fecha (consultada ' + HOY + ')'),
 'web_intervallo': ('Ristorante Intervallo — sitio oficial', 'http://www.ristoranteintervallo.com/', 'sin fecha (consultada ' + HOY + ')'),
 'web_veggicano': ('Veggicano — sitio oficial (menú y sucursal)', 'http://veggicano.com.mx/', 'sin fecha (consultada ' + HOY + ')'),
 'web_moramora': ('Mora Mora — sitio oficial (sucursales y menú del mes)', 'https://moramora.mx/', 'sin fecha (consultada ' + HOY + ')'),
 'web_ruffian': ('Ruffian Wine Bar — sitio oficial', 'http://www.ruffianwinebar.com/', 'sin fecha (consultada ' + HOY + ')'),
 'web_mitemaki': ('Mitemaki Handroll Bar — sitio oficial (sucursales y horario)', 'http://www.mitemaki.com/', 'sin fecha (consultada ' + HOY + ')'),
 'web_baltra': ('Baltra — sitio oficial (horario) y Time Out México (dirección)', 'http://baltra.bar/', 'sin fecha (consultada ' + HOY + ')'),
 'mdp_tacos': ('Mexico Daily Post — taquerías "nice" de la CDMX (La Bonvi, Pedregal 33)', 'https://mexicodailypost.news/2025/08/24/nice-taco-shops-in-mexico-city-that-you-have-to-experience-for-yourself-before-judging/', '2025-08-24'),
 'ot_carolo_carso': ('OpenTable — Carolo Carso', 'https://www.opentable.com/carolo-carso', 'sin fecha (consultada ' + HOY + ')'),
 'ot_carolo_il': ('OpenTable — Carolo Interlomas', 'https://www.opentable.ie/carolo-interlomas', 'sin fecha (consultada ' + HOY + ')'),
 'ot_popular_sf': ('OpenTable — La Popular Santa Fe', 'https://www.opentable.ie/r/la-popular-santa-fe-ciudad-de-mexico', 'sin fecha (consultada ' + HOY + ')'),
 'ot_vineria': ('OpenTable — La Vinería, Ciudad de México', 'https://opentable.ae/r/la-vineria-ciudad-de-mexico', 'sin fecha (consultada ' + HOY + ')'),
}

def fuente(k, url=None):
    n, u, f = F[k]
    return n, url or u, f

# Fichas vivas (oficiales o de reserva) consultadas hoy: no tienen fecha de nota, pero son vigentes.
VIGENTES = {'web_mirador', 'web_intervallo', 'web_veggicano', 'web_moramora', 'web_ruffian', 'web_mitemaki', 'web_baltra', 'inf_bonvi', 'ot_carolo_carso', 'ot_carolo_il', 'ot_popular_sf', 'turismo', 'filmoteca', 'ot_vineria', 'inah_mnh', 'turismo_esc', 'fever_bb', 'fever_gnp', 'res_bagheera', 'res_coralillo', 'res_doce', 'res_bilboa', 'res_cantaritos', 'intravel_fiera', 'res_bastian', 'res_karaoke_il', 'res_bocanariz', 'res_kamachos'}
def antigua(k, fecha):
    if k in VIGENTES: return False
    return not fecha[:4].isdigit() or int(fecha[:4]) < 2024

# ------------------------------------------------------------------ fichas
# h = (abre, cierra) en horas decimales; > 24 = madrugada del día siguiente.
L = [
 # Trajineras -------------------------------------------------------------
 dict(n='Trajineras · Embarcadero Nuevo Nativitas', cat='Atracción', col='Santa María Nativitas, Xochimilco',
      addr='Carretera Nativitas–Tulyehualco s/n, Santa María Nativitas', lat=19.25241, lng=-99.09353,
      f='turismo', url='https://mexicocity.cdmx.gob.mx/venues/embarcadero-nuevo-nativitas/?lang=es',
      h=(6, 22), hrs='Diario 6:00–22:00', act=['paseo'], who=['familia', 'amigos', 'date'], tags=['familiar', 'aventurero', 'romántico'],
      precio=dict(min=750, rep=750, max=750, unidad='trajinera_hora', canasta='Tarifa oficial por trajinera por hora (hasta 15–18 personas), según la Alcaldía Xochimilco citada por N+ (3 abr 2026). No incluye comida, bebida ni música.'),
      estado='rango', pf='nmas_traj', apto='sí'),
 dict(n='Trajineras · Embarcadero Cuemanco', cat='Atracción', col='Barrio 18, Xochimilco',
      addr='Periférico Sur (Blvd. Adolfo Ruiz Cortines) s/n, Barrio 18', lat=19.2869, lng=-99.1022,
      f='turismo', url='https://mexicocity.cdmx.gob.mx/venues/lago-de-xochimilco-embarcadero-de-cuemanco/',
      h=(8, 22), hrs='8:00–22:00 (horario general de las trajineras según N+, abr 2026; la ficha oficial no lo publica)', act=['paseo'],
      who=['familia', 'amigos', 'date'], tags=['familiar', 'aventurero', 'romántico'],
      precio=dict(min=750, rep=750, max=750, unidad='trajinera_hora', canasta='Tarifa oficial por trajinera por hora (hasta 15–18 personas), según la Alcaldía Xochimilco citada por N+ (3 abr 2026). Recorridos de 1 a 5 horas.'),
      estado='rango', pf='nmas_traj', apto='sí'),
 # Karaoke ----------------------------------------------------------------
 dict(n='Terraza Karaoke Roma', cat='Bar', col='Roma Norte', addr='Av. Chapultepec 400, Roma Norte',
      f='sopitas_kar', h=(17, 26), hrs='Mié a sáb 17:00–2:00', dias=[3, 4, 5, 6], act=['copas', 'juego'],
      who=['amigos', 'compa'], tags=['nightlife', 'social']),
 dict(n='Beer Garden Roma · karaoke coreano', cat='Bar', col='Roma Norte', addr='Puebla 213, Roma Norte',
      f='sopitas_kar', h=(15, 23), hrs='Mar a dom 15:00–23:00', dias=[0, 2, 3, 4, 5, 6], act=['copas', 'juego'],
      who=['amigos', 'compa', 'date'], tags=['nightlife', 'social']),
 dict(n='El Palomazo Karaoke', cat='Bar', col='Narvarte Poniente', addr='Av. Universidad 348, Narvarte Poniente',
      f='sopitas_kar', h=(20, 26), hrs='Mié 20:00–1:00 · jue 20:00–2:00 · vie y sáb 19:00–3:00', dias=[3, 4, 5, 6], act=['copas', 'juego'],
      who=['amigos', 'compa'], tags=['nightlife', 'social']),
 dict(n='Caverna Karaoke Insurgentes', cat='Bar', col='Guadalupe Inn', addr='Av. Insurgentes Sur 1869, Guadalupe Inn',
      f='sopitas_kar', h=(18, 26.5), hrs='Jue y vie 18:00–2:30 · sáb 20:00–2:30', dias=[4, 5, 6], act=['copas', 'juego'],
      who=['amigos', 'compa'], tags=['nightlife', 'social']),
 dict(n='Bocca Piano Cantabar', cat='Bar', col='Polanco IV Secc.', addr='Campos Elíseos 290, Polanco IV Secc.',
      lat=19.42679, lng=-99.19638, f='turismo', url='https://mexicocity.cdmx.gob.mx/venues/bocca-piano-cantabar/?lang=en',
      h=(21, 27), hrs='Mié a sáb 21:00–3:00 (ficha oficial; Sopitas, feb 2025, dice mar a sáb 22:00–4:00)', dias=[3, 4, 5, 6],
      act=['copas', 'juego'], who=['amigos', 'compa', 'date'], tags=['nightlife', 'social']),
 # Billar -----------------------------------------------------------------
 dict(n='El Recreo Coyoacán · billar', geo='Caballocalco 29, Coyoacán, Ciudad de México', cat='Billar', col='Coyoacán', addr='Caballocalco 29, Coyoacán',
      f='to_billar', h=(13, 23), hrs='Lun 13:00–22:00 · mar a jue y dom 13:00–23:00 · vie y sáb 13:00–1:00',
      who=['amigos', 'compa', 'date'], tags=['social']),
 dict(n='Glyfos Pool', cat='Billar', col='San Pedro de los Pinos', addr='Av. Patriotismo 242, San Pedro de los Pinos',
      f='chil_billar', h=(14, 23), hrs='Mar y mié 14:00–23:00 · jue 14:00–24:00 · vie 14:00–1:00 · sáb 16:00–1:00 · dom 16:00–23:00',
      dias=[0, 2, 3, 4, 5, 6], who=['amigos', 'compa'], tags=['social']),
 dict(n='Lucille · billar', cat='Billar', col='Roma Norte', addr='Orizaba 99, Roma Norte',
      f='chil_billar', h=(13.5, 22), hrs='Mié y dom 13:30–22:00 · jue 13:30–23:30 · vie y sáb 13:30–1:00', dias=[0, 3, 4, 5, 6],
      who=['amigos', 'compa', 'date'], tags=['social']),
 dict(n='Billares París', cat='Billar', col='Jardín Balbuena', addr='Retorno 9 de Fray Servando Teresa de Mier 3, Jardín Balbuena',
      f='chil_billar', h=(9, 24), hrs='Lun a sáb 9:00–1:00 · dom 9:00–24:00', who=['amigos', 'compa'], tags=['social']),
 # Boliche ----------------------------------------------------------------
 dict(n='Bolerama Coyoacán', geo='Bolerama Coyoacán, Ciudad de México', cat='Boliche', col='Del Valle', addr='Eje 8 Sur José María Rico 626, Del Valle',
      f='to_billar', h=(13, 22), hrs='Mar a vie 13:00–22:00 · sáb y dom 12:00–22:00 (Sopitas, dic 2023; Time Out, feb 2025, lo confirma sin horario)',
      dias=[0, 2, 3, 4, 5, 6], who=['amigos', 'familia', 'compa'], tags=['social', 'familiar'], apto='sí'),
 dict(n='Sport & Chips', cat='Boliche', col='Coyoacán', addr='Av. Miguel Ángel de Quevedo 1144',
      f='to_billar', h=(13, 24), hrs='Lun y mar 13:00–24:00 · mié y jue 13:00–1:00 · vie y sáb 13:00–2:00 · dom 11:00–22:00 (boliche y billar)',
      who=['amigos', 'familia', 'compa'], tags=['social', 'familiar']),
 dict(n='Bowlero · Chapultepec Morales', geo='Vázquez de Mella 315, Ciudad de México', cat='Boliche', col='Chapultepec Morales', addr='Vázquez de Mella 315, Chapultepec Morales',
      f='sopitas_bol', h=(12, 22), hrs='Mié a sáb 11:00–22:00 · mar y dom 12:00–22:00', dias=[0, 2, 3, 4, 5, 6],
      who=['amigos', 'familia', 'compa'], tags=['social', 'familiar'], apto='sí'),
 dict(n='Royal Bol · Torre Manacar', geo='Torre Manacar, Ciudad de México', cat='Boliche', col='Insurgentes Mixcoac', addr='Av. Insurgentes Sur 1457, Sótano 1, Insurgentes Mixcoac',
      f='sopitas_bol', h=(12, 22), hrs='Horario por confirmar', horaEstimada=True,
      who=['amigos', 'familia', 'compa'], tags=['social', 'familiar'], apto='sí'),
 dict(n='Royal Bol · Santa Fe', geo='Garden Santa Fe, Ciudad de México', cat='Boliche', col='Santa Fe', addr='Guillermo González Camarena 1205, Nivel B, Santa Fe',
      f='sopitas_bol', h=(12, 22), hrs='Horario por confirmar', horaEstimada=True,
      who=['amigos', 'familia', 'compa'], tags=['social', 'familiar'], apto='sí'),
 # Go karts ---------------------------------------------------------------
 dict(n='Go Kart Mania · Plaza Carso', cat='Atracción', col='Granada', addr='Lago Zurich 219-245, Granada',
      f='to_karts', h=(12, 20.5), hrs='Lun a vie 12:00–20:30 · sáb y dom 11:30–20:30', act=['juego'],
      who=['amigos', 'familia', 'compa', 'date'], tags=['aventurero', 'social'],
      precio=dict(min=399, rep=399, max=3999, unidad='persona', canasta='Una carrera "desde $399" según Time Out (nov 2024); paquetes hasta $3,999.'),
      estado='estimado'),
 dict(n='K1 Speed · Torre Manacar (go karts)', geo='Torre Manacar, Ciudad de México', cat='Atracción', col='Insurgentes Mixcoac', addr='Av. Insurgentes Sur 1457, Sótano 7, Insurgentes Mixcoac',
      f='to_karts', h=(13, 21), hrs='Horario por confirmar', horaEstimada=True, act=['juego'],
      who=['amigos', 'familia', 'compa', 'date'], tags=['aventurero', 'social'],
      precio=dict(min=360, rep=490, max=None, unidad='persona', canasta='Carrera "desde $360" más licencia anual de $130, según Time Out (nov 2024).'),
      estado='estimado'),
 dict(n='K1 Speed · Garden Santa Fe (go karts)', geo='Garden Santa Fe, Ciudad de México', cat='Atracción', col='Santa Fe', addr='Guillermo González Camarena 1205, local E2, Santa Fe',
      f='chil_karts', h=(13, 21), hrs='Horario por confirmar', horaEstimada=True, act=['juego'],
      who=['amigos', 'familia', 'compa'], tags=['aventurero', 'social']),
 # Salones de baile -------------------------------------------------------
 dict(n='Gran Salón de la Ciudad de México', cat='Salón de baile', col='Ex Hipódromo de Peralvillo', addr='Lerdo 311, Ex Hipódromo de Peralvillo',
      f='chil_baile26', h=(16, 22), hrs='Jue 16:00–22:00 · vie 17:00–24:00 · sáb 16:00–22:00 · dom 15:00–22:00 (salsa, cumbia, sonideros; jueves danzón)',
      dias=[0, 4, 5, 6], who=['amigos', 'date', 'compa'], tags=['nightlife', 'social']),
 dict(n='El Bandazo', cat='Salón de baile', col='Juárez (Zona Rosa)', addr='Londres 148, Juárez',
      f='chil_baile26', h=(17, 27), hrs='Vie 16:00–3:00 · sáb 17:00–3:00 (banda en vivo)', dias=[5, 6],
      who=['amigos', 'compa'], tags=['nightlife', 'social'],
      precio=dict(min=70, rep=70, max=None, unidad='persona', canasta='Sólo el cover de $70 (Chilango, jul 2026); las bebidas van aparte.'),
      estado='rango'),
 dict(n='Salón Caribe', cat='Salón de baile', col='San Rafael', addr='Av. Ribera de San Cosme 142, San Rafael',
      f='chil_salsa23', h=(16, 23), hrs='Mar a dom 16:00–23:00', dias=[0, 2, 3, 4, 5, 6], who=['amigos', 'date', 'compa'], tags=['nightlife', 'social']),
 dict(n='Salón Candela', cat='Salón de baile', col='Tabacalera', addr='Av. México-Tenochtitlán 10, Tabacalera',
      f='chil_salsa23', h=(16, 23), hrs='Lun a sáb 16:00–23:00 aprox. · dom 15:30–22:00 · clase de salsa 18:00', who=['amigos', 'date', 'compa'], tags=['nightlife', 'social']),
 dict(n='La Flor del Son', cat='Salón de baile', col='Roma Norte', addr='Puebla 52, Roma Norte',
      f='chil_salsa23', h=(13, 26.5), hrs='Lun a mié 13:00–18:00 · jue a sáb 13:00–2:30', who=['amigos', 'date', 'compa'], tags=['nightlife', 'social']),
 dict(n='Mambo Café Insurgentes', geo='Avenida de los Insurgentes Sur 644, Ciudad de México', cat='Salón de baile', col='Del Valle', addr='Av. de los Insurgentes Sur 644, Del Valle',
      f='chil_salsa23', h=(22, 27), hrs='Vie y sáb 22:00–3:00', dias=[5, 6], who=['amigos', 'date', 'compa'], tags=['nightlife', 'social']),
 # Mercado gastronómico ---------------------------------------------------
 dict(n='Mercado Molière', cat='Mercado', col='Ampliación Granada', addr='Prolongación Molière 500, Ampliación Granada',
      f='to_moliere', h=(11, 20), hrs='Lun a dom 11:00–20:00', who=['amigos', 'familia', 'date', 'compa'], tags=['foodie'],
      precio=dict(min=None, rep=150, max=None, unidad='persona', canasta='Consumo promedio de $150 según Time Out (2016); seguramente subió.'),
      estado='estimado', apto='sí'),
 # Bazar / tianguis -------------------------------------------------------
 dict(n='Tianguis Cultural del Chopo', geo='Tianguis Cultural del Chopo, Ciudad de México', cat='Atracción', col='Buenavista', addr='Aldama y Luna s/n, Buenavista',
      f='chil_chopo', h=(11, 17), hrs='Sábados (horario por confirmar, aprox. 11:00–17:00)', horaEstimada=True, dias=[6],
      act=['compras', 'paseo'], who=['amigos', 'compa', 'date'], tags=['cultural', 'social'],
      precio=dict(min=0, rep=0, max=0, unidad='persona', canasta='Entrada libre; lo que compres va aparte.'), estado='rango'),
 # Cine de arte -----------------------------------------------------------
    # La Casa del Cine MX ya estaba (pq-6665a541b2, paquete del 3 nov): no se repite.
 dict(n='Cineclub Condesa', cat='Cine', col='Condesa', addr='Av. Veracruz 102, Condesa',
      f='adn_cines', h=(12, 22), hrs='Según cartelera', horaEstimada=True, act=['funcion'], sesion=True,
      who=['amigos', 'date', 'compa'], tags=['cultural', 'chill']),
 dict(n='Salas de la Filmoteca UNAM · Centro Cultural Universitario', geo='Centro Cultural Universitario, Ciudad Universitaria, Ciudad de México', cat='Cine', col='Ciudad Universitaria',
      addr='Av. Insurgentes Sur 3000, Centro Cultural Universitario, Ciudad Universitaria',
      f='filmoteca', h=(12, 21), hrs='Según cartelera (salas Julio Bracho, José Revueltas y Carlos Monsiváis)', horaEstimada=True,
      act=['funcion'], sesion=True, who=['amigos', 'date', 'compa'], tags=['cultural', 'chill']),
 dict(n='Cinematógrafo del Chopo', cat='Cine', col='Santa María la Ribera', addr='Dr. Enrique González Martínez 10, Santa María la Ribera',
      f='filmoteca', h=(12, 21), hrs='Según cartelera', horaEstimada=True, act=['funcion'], sesion=True,
      who=['amigos', 'date', 'compa'], tags=['cultural', 'chill']),
 # Estadios ---------------------------------------------------------------
 dict(n='Estadio Ciudad de los Deportes', geo='Estadio Ciudad de los Deportes, Ciudad de México', cat='Atracción', col='Ciudad de los Deportes', addr='Indiana 255, Ciudad de los Deportes',
      f='publi_cdd', h=(12, 23), hrs='Según calendario de partidos', horaEstimada=True, act=['funcion'], sesion=True,
      who=['amigos', 'familia', 'compa'], tags=['social']),
 dict(n='Estadio Alfredo Harp Helú', cat='Atracción', col='Granjas México', addr='Viaducto Río de la Piedad s/n, Granjas México, Iztacalco',
      f='exp_harp', h=(12, 23), hrs='Según calendario de los Diablos Rojos', horaEstimada=True, act=['funcion'], sesion=True,
      who=['amigos', 'familia', 'compa'], tags=['social', 'familiar']),
 # Bici -------------------------------------------------------------------
 dict(n='Ecobici · Bosque de Chapultepec (estaciones Los Pinos)', cat='Tour', col='Bosque de Chapultepec',
      addr='Estaciones Ecobici de Los Pinos, entre la 1.ª y la 2.ª sección del Bosque de Chapultepec',
      f='sopitas_bici', h=(5, 21), hrs='Bicis en la 1.ª sección 5:00–21:00; 2.ª y 3.ª secciones 24 h', act=['recorrido', 'paseo'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['aventurero', 'romántico', 'chill'],
      precio=dict(min=123, rep=123, max=None, unidad='persona', canasta='Pase Ecobici de un día, tarifa 2025 según Chilango; puede haber cambiado.'),
      estado='estimado', pf='chil_ecobici', geo='Los Pinos, Bosque de Chapultepec, Ciudad de México', apto='sí'),
 # Vino ------------------------------------------------------------------
 dict(n='La Vinería', cat='Bar', col='Condesa', addr='Fernando Montes de Oca 52, Condesa',
      f='ot_vineria', h=(14, 23), hrs='Horario por confirmar', horaEstimada=True, act=['copas', 'cena'],
      who=['date', 'amigos'], tags=['romántico', 'foodie'],
      precio=dict(min=310, rep=400, max=500, unidad='persona', canasta='Banda de precio de OpenTable ($310–500 por persona).'),
      estado='rango'),
 # Lugares conocidos que faltaban (revisión del 4 nov 2026) ---------------
 # El Castillo de Chapultepec ya estaba ('Castillo de Chapultepec · Museo Nacional de Historia').
 dict(n='Espacio Escultórico UNAM', cat='Atracción', col='Ciudad Universitaria', addr='Calle Mario de la Cueva, Ciudad Universitaria',
      geo='Espacio Escultórico, Ciudad Universitaria, Ciudad de México', f='turismo_esc',
      h=(7, 16), hrs='Lun a vie 7:00–16:00 (entrada libre)', dias=[1, 2, 3, 4, 5], act=['paseo', 'visita'],
      who=['amigos', 'date', 'familia', 'compa'], tags=['cultural', 'chill', 'aventurero'],
      precio=dict(min=0, rep=0, max=0, unidad='persona', canasta='Entrada libre.'), estado='rango', apto='sí'),
 dict(n='Huerto Roma Verde', cat='Al aire libre', col='Roma Sur', addr='Jalapa 234, Roma Sur', f='fp_huerto',
      h=(10, 19), hrs='Diario 10:00–19:00 · talleres, mercado y café (Floresta, Café del Huerto)', act=['paseo', 'cafe', 'taller'],
      who=['amigos', 'date', 'familia', 'compa'], tags=['chill', 'creativo', 'familiar'], apto='sí'),
 dict(n='Tizne Tacomotora', cat='Taquería', col='Roma Norte', addr='Guanajuato 27-B, Roma Norte', f='chil_tacos_roma',
      h=(13, 21), hrs='Lun a sáb 13:00–21:00 · dom 12:00–18:00 (tacos ahumados)', act=['comida', 'cena'],
      who=['amigos', 'date', 'compa'], tags=['foodie', 'joyita']),
 dict(n='Cantina La Mascota', cat='Cantina', col='Centro Histórico', addr='Mesones 20, Centro Histórico', f='chil_cantinas',
      h=(13, 23), hrs='Dom a jue 13:00–23:00 · vie y sáb 13:00–2:00 (botana con la bebida)', act=['copas', 'comida'],
      who=['amigos', 'compa'], tags=['social', 'clásico']),
 dict(n='Mercado de Jamaica', cat='Mercado', col='Jamaica, Venustiano Carranza', addr='Guillermo Prieto 45, Jamaica', geo='Mercado de Jamaica, Ciudad de México',
      f='md_jamaica', h=(8, 20), hrs='Abierto 24 h (flores); horario de la zona de comida por confirmar', horaEstimada=True, act=['comida', 'compras', 'paseo'],
      who=['familia', 'amigos', 'date'], tags=['foodie', 'familiar'], apto='sí'),
 # Biblioteca Vasconcelos ya estaba en el catálogo: no se repite.

 # Veganos y vegetarianos (casi no había fuera de la Roma) --------------------
 dict(n='Paxil', cat='Restaurante', col='Roma Norte', addr='Orizaba 77, Roma Norte', lat=19.42019, lng=-99.16047, f='hap_veg', h=(13, 22), hrs='Horario por confirmar', horaEstimada=True,
      act=['comida', 'cena'], who=['amigos', 'date', 'compa'], tags=['foodie'], dieta=['vegano', 'vegetariano']),
 dict(n='U.TO.PIA. · cocina vegana', cat='Restaurante', col='Condesa', addr='Juan Escutia 63, Condesa', lat=19.41494, lng=-99.17472, f='trend_veg', h=(13, 22), hrs='Horario por confirmar', horaEstimada=True,
      act=['comida', 'cena'], who=['amigos', 'date', 'compa'], tags=['foodie', 'chill'], dieta=['vegano', 'vegetariano']),
 dict(n='Vegan Inc. · Miyana', cat='Restaurante', col='Polanco', addr='Plaza Miyana, planta alta, Polanco', geo='Miyana, Polanco, Ciudad de México', f='trend_veg',
      h=(13, 22), hrs='Horario por confirmar', horaEstimada=True, act=['comida', 'cena'], who=['amigos', 'date', 'compa', 'familia'], tags=['foodie'], dieta=['vegano', 'vegetariano']),
 dict(n='Vegan Inc. · Guadalupe Inn', cat='Restaurante', col='Guadalupe Inn', addr='Av. Revolución 1544, Guadalupe Inn', f='trend_veg',
      h=(13, 22), hrs='Horario por confirmar', horaEstimada=True, act=['comida', 'cena'], who=['amigos', 'date', 'compa', 'familia'], tags=['foodie'], dieta=['vegano', 'vegetariano']),
 dict(n='Forever Vegano · Polanco', cat='Restaurante', col='Polanco', addr='Alejandro Dumas 16, Polanco', f='trend_veg',
      h=(9, 22), hrs='Horario por confirmar', horaEstimada=True, act=['desayuno', 'comida', 'cena'], who=['amigos', 'date', 'compa', 'familia'], tags=['foodie'], dieta=['vegano', 'vegetariano']),
 # Xochimilco: dónde comer (además de trajineras) -------------------------------
 dict(n='Arca Tierra · desayuno en chinampa', cat='Tour', col='Xochimilco', addr='Chinampas de Xochimilco (punto de encuentro al reservar)', geo='Cuemanco, Xochimilco, Ciudad de México',
      f='exc_xochi', h=(7, 12), hrs='Experiencia de 3 a 4 horas · reserva tu horario', horaEstimada=True, act=['desayuno', 'recorrido'],
      who=['date', 'amigos', 'familia'], tags=['foodie', 'aventurero', 'romántico'],
      precio=dict(min=1100, rep=1100, max=None, unidad='persona', canasta='Desde $1,100 por persona (Excélsior).'), estado='rango', apto='sí'),
 dict(n='Terraza del Barrio Nativitas', cat='Restaurante', col='Nativitas, Xochimilco', addr='Nativitas, Xochimilco (junto a los canales)', geo='Embarcadero Nuevo Nativitas, Xochimilco',
      f='exc_xochi', h=(10, 19), hrs='Sáb y dom 10:00–19:00 · brunch con vista a los canales', dias=[0, 6], act=['desayuno', 'comida'],
      who=['familia', 'amigos', 'date'], tags=['foodie', 'familiar'], apto='sí'),
 dict(n='Patio Ciento20 Xochimilco', cat='Restaurante', col='Xochimilco', addr='Pedro Ramírez del Castillo 120, Xochimilco', f='exc_xochi',
      h=(13, 21), hrs='Horario por confirmar', horaEstimada=True, act=['comida', 'cena'], who=['familia', 'amigos', 'date'], tags=['foodie', 'familiar'], apto='sí'),
 dict(n='Mercado de Xochimilco', cat='Mercado', col='Santa Crucita, Xochimilco', addr='Av. Nuevo León s/n, Santa Crucita, Xochimilco', geo='Mercado de Xochimilco, Ciudad de México',
      f='exc_xochi', h=(8, 18), hrs='Horario por confirmar · antojitos, quesadillas y tlacoyos', horaEstimada=True, act=['comida', 'compras'],
      who=['familia', 'amigos'], tags=['foodie', 'familiar'], apto='sí'),
 # Recintos de conciertos (salen con "consulta la cartelera") -------------------
 dict(n='Auditorio BlackBerry', cat='Foro', col='Hipódromo', addr='Tlaxcala 160, Hipódromo', f='fever_bb', h=(19, 24), hrs='Según cartelera', horaEstimada=True,
      act=['funcion'], sesion=True, who=['amigos', 'date', 'compa'], tags=['nightlife', 'cultural']),
 dict(n='Estadio GNP Seguros', cat='Foro', col='Granjas México', addr='Viaducto Río de la Piedad s/n, Granjas México, Iztacalco', geo='Estadio GNP Seguros, Ciudad de México',
      f='fever_gnp', h=(17, 24), hrs='Según cartelera', horaEstimada=True, act=['funcion'], sesion=True, who=['amigos', 'compa', 'date'], tags=['nightlife', 'social']),
 dict(n='Palacio de los Deportes', cat='Foro', col='Granjas México', addr='Añil 667, Granjas México, Iztacalco', geo='Palacio de los Deportes, Ciudad de México',
      f='to_palacio', h=(18, 24), hrs='Según cartelera', horaEstimada=True, act=['funcion'], sesion=True, who=['amigos', 'compa', 'date'], tags=['nightlife', 'social']),
 # Satélite ------------------------------------------------------------------
 dict(n='Torres de Satélite', cat='Atracción', col='Ciudad Satélite', addr='Camellón del Periférico (Blvd. Manuel Ávila Camacho), Ciudad Satélite',
      lat=19.4992, lng=-99.2369, f='nmas_torres', h=(7, 23), hrs='A toda hora · se ven desde el auto; de noche iluminadas (desde may 2025)', act=['vista'],
      who=['amigos', 'date', 'familia'], tags=['cultural'], apto='sí', soloExplorar='Están en un camellón del Periférico: se ven desde el auto, no son una parada a pie.'),
 dict(n='La Capitana · mezcalería', cat='Mezcalería', col='Ciudad Satélite', addr='Federico T. de la Chica 12, Ciudad Satélite', f='to_capitana',
      h=(15, 24), hrs='Mar a dom 15:00–24:00', dias=[0, 2, 3, 4, 5, 6], act=['copas'], who=['amigos', 'date', 'compa'], tags=['nightlife', 'social']),
 # Bares en Satélite y Lomas (4 nov 2026) -------------------------------------
 dict(n='Bagheera Rooftop Satélite', cat='Antro', col='Ciudad Satélite', addr='Pafnuncio Padilla 12, Cd. Satélite', f='res_bagheera',
      h=(22, 29), hrs='Vie y sáb 22:00–5:00 · rooftop con reguetón y electrónica', dias=[5, 6], act=['baile', 'copas'],
      who=['amigos', 'compa'], tags=['nightlife', 'social'],
      precio=dict(min=300, rep=400, max=500, unidad='persona', canasta='$300–500 por persona según su ficha de Reservándonos.'), estado='rango'),
 dict(n='Coralillo Bar Satélite', geoAprox=True, geo='Circuito Economistas, Ciudad Satélite, Naucalpan de Juárez', cat='Bar', col='Ciudad Satélite', addr='Cto. Economistas 93, Planta Baja, Cd. Satélite', f='res_coralillo',
      h=(18, 25), hrs='Jue a sáb 18:00–1:00 · coctelería con DJ', dias=[4, 5, 6], act=['copas'],
      who=['amigos', 'date', 'compa'], tags=['nightlife', 'social'],
      precio=dict(min=300, rep=500, max=800, unidad='persona', canasta='$300–800 por persona según su ficha de Reservándonos.'), estado='rango'),
 dict(n='Terraza Doce Satélite', cat='Bar', col='Ciudad Satélite', addr='Pafnuncio Padilla 7, Cd. Satélite', f='res_doce',
      h=(14, 26), hrs='Diario 14:00–2:00 · terraza y lounge', act=['copas'],
      who=['amigos', 'date', 'compa'], tags=['nightlife', 'social', 'chill'],
      precio=dict(min=200, rep=250, max=300, unidad='persona', canasta='$200–300 por persona según su ficha de Reservándonos.'), estado='rango'),
 dict(n='Bilboa Terraza Club Satélite', geoAprox=True, geo='Avenida Fuentes de Satélite, Naucalpan de Juárez', cat='Bar', col='Lomas de Bellavista, Naucalpan', addr='Av. Fuentes de Satélite 34, Lomas de Bellavista', f='res_bilboa',
      h=(19, 26), hrs='Jue 19:00–2:00 · vie y sáb 13:00–2:00 · terraza con DJ y música en vivo', dias=[4, 5, 6], act=['copas', 'baile'],
      who=['amigos', 'compa'], tags=['nightlife', 'social'], apto='no',
      precio=dict(min=300, rep=400, max=500, unidad='persona', canasta='$300–500 por persona según su ficha de Reservándonos.'), estado='rango'),
 dict(n='Cantaritos El Compa de Jalisco Satélite', geoAprox=True, geo='Santa María Nativitas, Naucalpan de Juárez', cat='Cantina', col='Santa María Nativitas, Naucalpan', addr='Periférico Blvd. Manuel Ávila Camacho 885, Sta. María Nativitas', f='res_cantaritos',
      h=(13.5, 26.5), hrs='Jue a dom 13:30–2:30 · cantina con música en vivo', dias=[0, 4, 5, 6], act=['copas', 'comida'],
      who=['amigos', 'compa'], tags=['social', 'nightlife'],
      precio=dict(min=600, rep=700, max=800, unidad='persona', canasta='$600–800 por persona según su ficha de Reservándonos.'), estado='rango'),
 dict(n='Fiera Rooftop', zona='lomas', geo='Paseo de las Palmas 530, Ciudad de México', cat='Rooftop', col='Lomas de Chapultepec', addr='Paseo de las Palmas 530, Lomas Virreyes', f='intravel_fiera',
      h=(14, 25), hrs='Horario por confirmar · terraza con bar y restaurante', horaEstimada=True, act=['copas', 'cena', 'vista'],
      who=['amigos', 'date', 'compa'], tags=['nightlife', 'romántico']),
 # Bosques de las Lomas e Interlomas -------------------------------------------
 dict(n='Bastian · Arcos Bosques', cat='Antro', col='Bosques de las Lomas', addr='Paseo de los Tamarindos 90, sótano -1 (Paseo Arcos Bosques), Bosques de las Lomas',
      geo='Arcos Bosques, Ciudad de México', f='res_bastian', h=(19, 26), hrs='Mié a sáb 19:00–2:00 · coctelería, tacos y DJ', dias=[3, 4, 5, 6],
      act=['copas', 'baile'], who=['amigos', 'date', 'compa'], tags=['nightlife', 'social'],
      precio=dict(min=1200, rep=1500, max=1800, unidad='persona', canasta='$1,200–1,800 por persona (consumo promedio ~$1,500) según su ficha de Reservándonos.'), estado='rango'),
 dict(n='Terraza Karaoke Interlomas', cat='Bar', col='Hacienda de las Palmas, Huixquilucan', addr='Av. Jesús del Monte 41, Hacienda de las Palmas',
      geo='Interlomas, Huixquilucan', geoAprox=True, f='res_karaoke_il', h=(17, 27), hrs='Mié a dom 17:00–3:00 · karaoke, terraza y música en vivo',
      dias=[0, 3, 4, 5, 6], act=['copas', 'juego'], who=['amigos', 'compa'], tags=['nightlife', 'social'],
      precio=dict(min=200, rep=350, max=500, unidad='persona', canasta='$200–500 por persona según su ficha de Reservándonos.'), estado='rango'),
 dict(n='Boca Nariz Interlomas', cat='Restaurante', col='Bosque de las Palmas, Huixquilucan', addr='Vialidad de la Barranca 6, Bosque de las Palmas',
      geo='Interlomas, Huixquilucan', geoAprox=True, f='res_bocanariz', h=(13, 23), hrs='Mar y mié 13:00–22:00 · jue a sáb 13:00–24:00 · dom 13:00–20:00 · cocina española y bar',
      dias=[0, 2, 3, 4, 5, 6], act=['comida', 'cena', 'copas'], who=['amigos', 'date', 'compa', 'familia'], tags=['foodie', 'nightlife'],
      precio=dict(min=500, rep=650, max=800, unidad='persona', canasta='$500–800 por persona según su ficha de Reservándonos.'), estado='rango'),
 dict(n='Kamachos Hookah Interlomas', cat='Bar', col='Interlomas, Huixquilucan', addr='Pasaje Interlomas 10', geo='Interlomas, Huixquilucan', geoAprox=True, f='res_kamachos', h=(13, 23), hrs='Lun a vie 8:00–23:00 · sáb y dom 10:30–23:00 · hookah y snacks',
      act=['copas'], who=['amigos', 'compa'], tags=['social', 'chill'], apto='no',
      precio=dict(min=300, rep=400, max=500, unidad='persona', canasta='$300–500 por persona según su ficha de Reservándonos.'), estado='rango'),
 # Pedidos por el fundador (4 nov 2026), con fuente que no es Google ----------
 dict(n='La Bonvi · Polanco', cat='Taquería', col='Polanco', addr='Anatole France 139, Polanco', geo='Anatole France 139, Polanco, Ciudad de México',
      zona='polanco', f='inf_bonvi', h=(13, 23), hrs='Horario por confirmar', horaEstimada=True, act=['comida', 'cena'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['foodie', 'social'], cocina='Tacos'),
 dict(n='La Bonvi · Lomas Virreyes', cat='Taquería', col='Lomas Virreyes', addr='Pedregal 33, Lomas Virreyes', geo='Pedregal 33, Lomas de Chapultepec, Ciudad de México',
      zona='lomas', f='mdp_tacos', h=(13, 23), hrs='Horario por confirmar', horaEstimada=True, act=['comida', 'cena'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['foodie', 'social'], cocina='Tacos'),
 dict(n='Carolo · Carso', cat='Restaurante', col='Ampliación Granada', addr='Lago Zurich 245, Ampliación Granada (Plaza Carso)', geo='Lago Zurich 245, Ciudad de México',
      zona='polanco', f='ot_carolo_carso', h=(13, 23), hrs='Horario por confirmar', horaEstimada=True, act=['comida', 'cena'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['foodie'], cocina='Internacional'),
 dict(n='Carolo · Interlomas', cat='Restaurante', col='Bosque de las Palmas, Huixquilucan', addr='Vialidad de la Barranca 6, Bosque de las Palmas',
      geo='Interlomas, Huixquilucan', geoAprox=True, f='ot_carolo_il', h=(13, 23), hrs='Horario por confirmar', horaEstimada=True, act=['comida', 'cena'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['foodie'], cocina='Internacional'),
 dict(n='La Popular · Santa Fe', cat='Restaurante', col='Lomas de Santa Fe', addr='Juan Salvador Agraz 44, Lomas de Santa Fe', geo='Juan Salvador Agraz 44, Santa Fe, Ciudad de México',
      zona='santafe', f='ot_popular_sf', h=(13, 24), hrs='Horario por confirmar', horaEstimada=True, act=['comida', 'cena'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['foodie', 'social'], cocina='Mexicana'),
 # Huecos de cobertura (4 nov 2026): descubiertos con Google Places, verificados en su sitio oficial
 dict(n='Cantina El Mirador', cat='Cantina', col='San Miguel Chapultepec', addr='Av. Chapultepec 606, San Miguel Chapultepec', geo='San Miguel Chapultepec, Ciudad de México', geoAprox=True,
      zona='chapultepec', f='web_mirador', h=(13, 23), hrs='Lun a mié 13:00–22:00 · jue y vie 13:00–23:00 · sáb y dom 13:00–20:00', act=['comida', 'cena', 'copas'],
      who=['amigos', 'compa'], tags=['social', 'foodie'], cocina='Mexicana'),
 dict(n='Ristorante Intervallo', cat='Restaurante', col='San José Insurgentes', addr='Sagredo 162, San José Insurgentes', geo='Sagredo 162, Ciudad de México',
      f='web_intervallo', h=(13.5, 23), hrs='Lun a sáb 13:30–23:00 · dom 13:30–18:00', act=['comida', 'cena'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['foodie', 'romántico'], cocina='Italiana'),
 dict(n='Veggicano', cat='Restaurante', col='Del Carmen, Coyoacán', addr='Corina 117, local 1, Del Carmen', geo='Corina 117, Coyoacán, Ciudad de México',
      zona='coyoacan', f='web_veggicano', h=(10, 19), hrs='Lun a sáb 10:00–19:00 · dom 9:30–18:00', act=['desayuno', 'comida'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['foodie', 'chill'], dieta=['vegano', 'vegetariano'], cocina='Vegetariana',
      precio=dict(min=157, rep=220, max=237, unidad='persona', canasta='Un platillo de su menú: chilaquiles $157, filete en bechamel $220, hamburguesa $237 (tacos artesanales $45). Bebida aparte.'), estado='rango'),
 dict(n='Mora Mora · Santa Fe', cat='Café', col='Santa Fe', addr='Av. Santa Fe 483, Santa Fe', geo='Avenida Santa Fe 483, Ciudad de México',
      zona='santafe', f='web_moramora', h=(8, 20), hrs='Horario por confirmar', horaEstimada=True, act=['cafe', 'desayuno'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['chill'],
      precio=dict(min=99, rep=137, max=159, unidad='persona', canasta='Una bebida del menú del mes: latte $99, matcha $109, jugo $137, smoothie $159. Comida aparte.'), estado='rango'),
 dict(n='Mora Mora · San Miguel Chapultepec', cat='Café', col='San Miguel Chapultepec', addr='Gral. Juan Cano 70, San Miguel Chapultepec', geo='General Juan Cano 70, Ciudad de México',
      zona='chapultepec', f='web_moramora', h=(8, 20), hrs='Horario por confirmar', horaEstimada=True, act=['cafe', 'desayuno'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['chill'],
      precio=dict(min=99, rep=137, max=159, unidad='persona', canasta='Una bebida del menú del mes: latte $99, matcha $109, jugo $137, smoothie $159. Comida aparte.'), estado='rango'),
 dict(n='Mora Mora · Polanco', cat='Café', col='Polanco', addr='Edgar Allan Poe 94, Polanco', geo='Edgar Allan Poe 94, Ciudad de México',
      zona='polanco', f='web_moramora', h=(8, 20), hrs='Horario por confirmar', horaEstimada=True, act=['cafe', 'desayuno'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['chill'],
      precio=dict(min=99, rep=137, max=159, unidad='persona', canasta='Una bebida del menú del mes: latte $99, matcha $109, jugo $137, smoothie $159. Comida aparte.'), estado='rango'),
 dict(n='Ruffian Wine Bar', cat='Bar', col='Lomas Virreyes', addr='Av. Prado Norte 314, piso 3, Lomas Virreyes', geo='Prado Norte 314, Ciudad de México',
      zona='lomas', f='web_ruffian', h=(18, 25), hrs='Horario por confirmar', horaEstimada=True, act=['copas'],
      who=['amigos', 'date', 'compa'], tags=['nightlife', 'romántico'], apto='no'),
 dict(n='Mitemaki · Polanco', cat='Restaurante', col='Polanco', addr='Av. Emilio Castelar 44, Polanco IV Secc.', geo='Emilio Castelar 44, Ciudad de México',
      zona='polanco', f='web_mitemaki', h=(13, 23), hrs='Lun a sáb 13:00–23:00 · dom 13:00–19:00', act=['comida', 'cena'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['foodie'], cocina='Japonesa'),
 dict(n='Mitemaki · Bosques', cat='Restaurante', col='Bosques de las Lomas', addr='Bosque de Duraznos 39, Bosques de las Lomas', geo='Bosque de Duraznos 39, Ciudad de México',
      f='web_mitemaki', h=(13, 23), hrs='Lun a sáb 13:00–23:00 · dom 13:00–19:00', act=['comida', 'cena'],
      who=['amigos', 'date', 'compa', 'familia'], tags=['foodie'], cocina='Japonesa'),
 dict(n='Baltra', cat='Bar de autor', col='Condesa', addr='Iztaccíhuatl 36D, Condesa', geo='Iztaccihuatl 36, Hipódromo, Ciudad de México',
      zona='condesa', f='web_baltra', h=(18, 26), hrs='Dom a mié 18:00–24:00 · jue a sáb 18:00–2:00', act=['copas'],
      who=['amigos', 'date', 'compa'], tags=['nightlife', 'romántico'], apto='no'),
]

# ------------------------------------------------------------------ geocodificación
CACHE = os.path.join(AQUI, 'geocache.json')
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
def geocodifica(q):
    if q in cache: return cache[q]
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(
        {'q': q, 'format': 'json', 'limit': 1, 'countrycodes': 'mx', 'viewbox': '-99.36,19.60,-98.94,19.05', 'bounded': 1})
    req = urllib.request.Request(url, headers={'User-Agent': 'sobres-catalogo/1.0 (catalogo escolar)'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=20))
        cache[q] = [float(r[0]['lat']), float(r[0]['lon'])] if r else None
    except Exception as e:
        print('  geocodificación falló:', q, e); cache[q] = None
    time.sleep(1.1)
    json.dump(cache, open(CACHE, 'w'), ensure_ascii=False, indent=1)
    return cache[q]

salida, filas = [], []
for x in L:
    nombre_f, url_f, fecha_f = fuente(x['f'], x.get('url'))
    lat, lng, aprox = x.get('lat'), x.get('lng'), False
    if lat is None:
        g = geocodifica(x.get('geo') or (x['addr'] + ', Ciudad de México'))
        if not g:
            g = geocodifica(x['col'] + ', Ciudad de México'); aprox = True
        if g: lat, lng = round(g[0], 5), round(g[1], 5)
    z, dz = zona_de(lat, lng)
    if x.get('geoAprox'): aprox = True            # la dirección no traía número: pin en la calle/colonia
    if x.get('zona') in ZONAS: z = x['zona']; dz = math.hypot((ZONAS[z][0] - lat) * 111, (ZONAS[z][1] - lng) * 105)
    vid = 'iv-' + hashlib.sha1((x['n'] + '|' + x['addr']).encode()).hexdigest()[:10]
    oh = list(x['h'])
    tm = []
    if oh[0] <= 11: tm.append('manana')
    if oh[0] <= 17 and oh[1] >= 15: tm.append('tarde')
    if oh[1] >= 21: tm.append('noche')
    rec = dict(id=vid, n=x['n'], cat=x['cat'], lat=lat, lng=lng, col=x['col'], addr=x['addr'], zone=z,
               oh=oh, hrs=x['hrs'], who=x['who'], tags=x['tags'], tm=tm or ['tarde'],
               fuente=nombre_f, url=url_f, web='', fecha=fecha_f, consultado=HOY, hrsFuente=nombre_f)
    if x.get('act'): rec['act'] = x['act']
    if x.get('dias'): rec['dias'] = x['dias']
    if x.get('horaEstimada'): rec['horaEstimada'] = True
    if x.get('sesion'): rec['sesion'] = True
    if aprox: rec['coordAprox'] = True
    if dz > 5.5: rec['lejos'] = True
    if x.get('apto') == 'sí': rec['aptoFamilia'] = 'sí'
    if x.get('dieta'): rec['dieta'] = x['dieta']
    if x.get('cocina'): rec['cocina'] = x['cocina']
    if 'precio' in x:
        p = dict(x['precio']); p['moneda'] = 'MXN'
        rec['precio'] = p; rec['estado'] = x['estado']
        if x.get('pf'):
            pn, pu, pfe = fuente(x['pf'])
            rec['precioFuente'] = pn + ' (' + pfe + ') ' + pu
    else:
        rec['precio'] = {'min': None, 'rep': None, 'max': None, 'unidad': 'persona', 'moneda': 'MXN', 'canasta': 'La fuente no publica precios.'}
        rec['estado'] = 'por_confirmar'; rec['falta'] = 'el precio'
    vieja = antigua(x['f'], fecha_f)
    if x.get('soloExplorar'): vieja = True
    sc = 70 if vieja else 76
    rec['score'] = sc; rec['tier'] = 'B'
    rec['basis'] = x['cat'] + ' en ' + x['col']
    notas = []
    if rec.get('horaEstimada'): notas.append('Horario sin confirmar.')
    if aprox: notas.append('Ubicación aproximada (centro de la colonia).')
    if vieja:
        rec['recomendable'] = False
        notas.append(x.get('soloExplorar') or ('La fuente es de ' + fecha_f + ': confirma que siga abierto. Mientras tanto no lo proponemos en planes.'))
    if rec.get('lejos'): notas.append('Queda lejos del centro de su zona; sólo aparece al buscar en toda la ciudad.')
    if notas: rec['nota'] = ' '.join(notas)
    salida.append(rec)
    filas.append((x, rec, nombre_f, url_f, fecha_f, round(dz, 1)))

assert len({r['id'] for r in salida}) == len(salida)
js = ('/* SOBRES — Lugares investigados a mano (4 nov 2026) para las piezas de receta con poca oferta:\n'
      ' * trajineras, karaoke, billar, boliche, go karts, salones de baile, mercado, tianguis, cine de arte,\n'
      ' * estadios, bici y vino. Generado por reportes/investigados/build_investigados.py.\n'
      ' * Cada lugar trae fuente (URL), fecha de la fuente y fecha de consulta. Lo que la fuente no publica\n'
      ' * queda "estimado" o "por confirmar". Fuente anterior a 2024 → sólo Explorar hasta reverificar. */\n'
      'window.SOBRES_INVESTIGADOS = ' + json.dumps({'version': 1, 'fecha': HOY, 'lugares': salida}, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(REPO, 'data', 'investigados.js'), 'w').write(js)
json.dump([dict(id=r['id'], n=r['n'], zone=r['zone'], km=f[5], lat=r['lat'], lng=r['lng'], aprox=bool(r.get('coordAprox'))) for r, f in zip(salida, filas)],
          open(os.path.join(AQUI, 'resumen.json'), 'w'), ensure_ascii=False, indent=1)
print(len(salida), 'lugares;', sum(1 for r in salida if r.get('recomendable') is False), 'por reverificar;',
      sum(1 for r in salida if r.get('lejos')), 'lejos;', sum(1 for r in salida if r.get('coordAprox')), 'coord. aproximada')
for r, f in zip(salida, filas):
    print(' ', r['id'], r['zone'], f[5], 'km', ('LEJOS ' if r.get('lejos') else '') + ('APROX ' if r.get('coordAprox') else '') + ('REVERIF ' if r.get('recomendable') is False else ''), r['n'])
