// Eventos con fecha (Fase 4, consultados el 4 nov 2026) → data/eventos.js.
// Cada evento: fuente (URL), fecha de la nota, fechas de inicio y fin, sede.
// La ubicación sale de la SEDE cuando ya está en el catálogo; si no, de la
// dirección que da la fuente (marcada como aproximada si sólo hay colonia).
// Lo que la nota no dice (hora, precio) queda "por confirmar".
// Uso: node reportes/eventos/build_eventos.js
const fs = require('fs'), path = require('path');
const { makeApp } = require('../../test/harness.js');
const HOY = '2026-11-04';
const F = {
  chil: ['Chilango — Eventos de noviembre de 2026 en CDMX (conciertos, ferias y festivales sin costo)', 'https://www.chilango.com/que-hacer/eventos-de-noviembre-de-2026-en-cdmx-que-hace-sin-costo-conciertos-ferias-y-festivales/', '2026-11-02'],
  silla: ['La Silla Rota — Qué hacer en CDMX en noviembre 2026', 'https://lasillarota.com/yo-soi-tu/2026/10/31/que-hacer-en-cdmx-en-noviembre-2026-eventos-y-actividades-535426.html', '2026-10-31'],
  cronica: ['Crónica — Mexicráneos 2026 en Reforma: hasta cuándo estará', 'https://www.cronica.com.mx/nacional/2026/10/27/mexicraneos-2026-en-reforma-hasta-cuando-estara-la-exposicion-por-dia-e-muertos/', '2026-10-27']
};
const GRATIS = { min: 0, rep: 0, max: 0, unidad: 'persona', moneda: 'MXN', canasta: 'Entrada libre según la fuente.' };
// sede: regex del catálogo (toma ubicación y zona de ahí) o {lat,lng,zone,aprox}
const E = [
  { n: 'Mexicráneos 2026 · Paseo de la Reforma', cat: 'Atracción', sede: { lat: 19.42697, lng: -99.16772, zone: 'juarez', addr: 'Paseo de la Reforma, alrededor del Ángel de la Independencia' },
    desde: '2026-10-17', hasta: '2026-11-16', oh: [9, 23], hrs: 'Abierto 24 h (al aire libre)', f: 'cronica', precio: GRATIS, who: ['amigos', 'familia', 'date', 'compa'], tags: ['cultural', 'familiar', 'chill'] },
  { n: 'Camino a la Luz · esculturas luminosas en Reforma', cat: 'Atracción', sede: { lat: 19.4245, lng: -99.1745, zone: 'juarez', addr: 'Paseo de la Reforma, del Ángel a la Puerta de los Leones', aprox: true },
    desde: '2026-11-02', hasta: '2026-11-08', oh: [18, 23], hrs: 'Horario por confirmar (de noche se ven las luces)', horaEstimada: true, f: 'chil', who: ['amigos', 'familia', 'date'], tags: ['familiar', 'romántico', 'chill'],
    nota: 'La nota no dice desde cuándo: estaba vigente al publicarse (2 nov).' },
  { n: 'Concierto gratis: El Haragán y Compañía', cat: 'Foro', sede: /^Monumento a la Revolución$/, desde: '2026-11-06', hasta: '2026-11-06', oh: [18, 23], hrs: 'Hora por confirmar', horaEstimada: true,
    f: 'chil', precio: GRATIS, who: ['amigos', 'compa'], tags: ['nightlife', 'social'] },
  { n: 'Exhibición de piñatas mexicanas · Museo de Arte Popular', cat: 'Museo', sede: /^Museo de Arte Popular$/, desde: '2026-11-07', hasta: '2026-12-13', oh: [10, 18], hrs: 'Horario del museo (por confirmar)', horaEstimada: true,
    f: 'chil', who: ['familia', 'amigos', 'date'], tags: ['cultural', 'familiar'] },
  { n: 'Enjambre en el Zócalo (Vitae Fest)', cat: 'Foro', sede: /^Zócalo \(Plaza de la Constitución\)$/, desde: '2026-11-08', hasta: '2026-11-08', oh: [17.25, 22], hrs: 'Dom 8 nov · inicia 17:20; Enjambre 18:40',
    f: 'chil', precio: GRATIS, who: ['amigos', 'compa'], tags: ['nightlife', 'social'] },
  { n: 'Original · encuentro de arte textil en Los Pinos', cat: 'Centro cultural', sede: /^Complejo Cultural Los Pinos$/, desde: '2026-11-12', hasta: '2026-11-15', oh: [10.5, 20], hrs: '10:30–20:00',
    f: 'chil', who: ['familia', 'amigos', 'date'], tags: ['cultural', 'creativo'] },
  { n: 'FILIJ 44 · Feria Internacional del Libro Infantil y Juvenil', cat: 'Centro cultural', sede: /^Centro Nacional de las Artes \(CENART\)$/, desde: '2026-11-13', hasta: '2026-11-22', oh: [9, 19], hrs: '9:00–19:00',
    f: 'silla', who: ['familia'], tags: ['cultural', 'familiar'] },
  { n: 'Garbage en el Zócalo · concierto gratis', cat: 'Foro', sede: /^Zócalo \(Plaza de la Constitución\)$/, desde: '2026-11-14', hasta: '2026-11-14', oh: [20, 23], hrs: 'Sáb 14 nov · 20:00',
    f: 'chil', precio: GRATIS, who: ['amigos', 'compa', 'date'], tags: ['nightlife', 'social'], nota: 'La nota dice "14 de septiembre" por error; el contexto es noviembre.' },
  { n: 'Noche de las Estrellas · Las Islas de CU', cat: 'Atracción', sede: { lat: 19.3326, lng: -99.1858, zone: 'cu', addr: 'Las Islas, Ciudad Universitaria', aprox: true },
    desde: '2026-11-14', hasta: '2026-11-14', oh: [15, 22], hrs: 'Sáb 14 nov · 15:00–22:00 (horario según InStyle, 1 nov 2026)', f: 'chil', precio: GRATIS, who: ['familia', 'amigos', 'date'], tags: ['familiar', 'cultural', 'romántico'] },
  { n: 'Noche de Museos · Palacio de Bellas Artes', cat: 'Museo', sede: /^Palacio de Bellas Artes \(museo\)$/, desde: '2026-11-25', hasta: '2026-11-25', oh: [18, 22], hrs: 'Mié 25 nov · horario nocturno (por confirmar)', horaEstimada: true,
    f: 'chil', precio: GRATIS, who: ['amigos', 'date', 'familia'], tags: ['cultural', 'romántico'] },
  { n: 'Festival Francia en Los Pinos', cat: 'Centro cultural', sede: /^Complejo Cultural Los Pinos$/, desde: '2026-11-28', hasta: '2026-11-29', oh: [10, 18], hrs: '10:00–18:00 (festival gastronómico México-Francia)',
    f: 'silla', precio: GRATIS, who: ['familia', 'amigos', 'date'], tags: ['foodie', 'cultural', 'familiar'] },
  { n: 'Festival artesanal de café y chocolate · edición navideña', cat: 'Atracción', sede: { addr: 'Jalapa 38, Roma Norte', geo: 'Jalapa 38, Roma Norte, Ciudad de México' },
    desde: '2026-11-28', hasta: '2026-11-29', oh: [11, 19], hrs: 'Horario por confirmar', horaEstimada: true, f: 'chil',
    precio: { min: 0, rep: 0, max: null, unidad: 'persona', moneda: 'MXN', canasta: 'Entrada libre; la degustación de pasteles tiene costo.' }, who: ['amigos', 'date', 'familia'], tags: ['foodie', 'chill'] },
  { n: 'Las Formas de la Energía · Palacio de Bellas Artes', cat: 'Museo', sede: /^Palacio de Bellas Artes \(museo\)$/, desde: '2026-11-12', hasta: '2026-11-30', oh: [11, 17], hrs: 'Horario del museo (por confirmar)', horaEstimada: true,
    f: 'silla', who: ['amigos', 'date', 'familia'], tags: ['cultural'] },
  { n: 'Mes de Japón · Museo Nacional de Antropología', cat: 'Museo', sede: /^Museo Nacional de Antropología \(MNA\)$/, solo: ['2026-11-05', '2026-11-07', '2026-11-14', '2026-11-27'], oh: [10, 20], hrs: '5, 7, 14 y 27 nov · 10:00–20:00',
    f: 'silla', who: ['familia', 'amigos', 'date'], tags: ['cultural', 'familiar'] },
  { n: 'Festival de Piano En Blanco y Negro · Cenart', cat: 'Foro', sede: /^Centro Nacional de las Artes \(CENART\)$/, desde: '2026-11-07', hasta: '2026-11-29', oh: [17, 21], hrs: 'Auditorio Blas Galindo · funciones por confirmar', horaEstimada: true,
    f: 'silla', who: ['date', 'amigos'], tags: ['cultural', 'romántico'] },
  { n: 'Titanic: An Immersive Voyage · Expo Reforma', cat: 'Atracción', sede: { addr: 'Expo Reforma, colonia Juárez', geo: 'Expo Reforma, Ciudad de México' },
    desde: '2026-10-21', hasta: '2026-12-20', oh: [10, 20], hrs: 'Horario por confirmar', horaEstimada: true, f: 'silla', who: ['familia', 'amigos', 'date'], tags: ['familiar', 'cultural'] },
  { n: 'Amor eterno: Por siempre Juan Gabriel · Palacio Postal', cat: 'Museo', sede: /^Palacio Postal$/, desde: null, hasta: '2027-01-24', oh: [10, 18], hrs: 'Horario por confirmar', horaEstimada: true,
    f: 'silla', who: ['familia', 'amigos', 'date'], tags: ['cultural'], nota: 'La nota sólo da la fecha de cierre (24 ene 2027).' },
  { n: 'Concierto navideño · Orquesta Sinfónica de Minería', cat: 'Foro', sede: /^Sala Nezahualcóyotl$/, solo: ['2026-11-30', '2026-12-01'], oh: [20, 22.5], hrs: '30 nov y 1 dic · 20:00',
    f: 'silla', who: ['date', 'familia', 'amigos'], tags: ['cultural', 'romántico'] }
];
// ── Conciertos de noviembre 2026 (consultados el 5 nov 2026) ──────────────────
// Sólo entran los que traen la MISMA fecha y sede en las tres agendas: Milenio
// (2 nov), La Silla Rota (1 nov) y ClaroSports (3 nov). Fuera por no coincidir:
// Niña Pastori, XG, Helado Negro, Majo Aguilar y Jerry Rivera. Morat 17 nov entró el 5 nov: lo
// publican Milenio y ClaroSports y sigue a la venta en boleteras (La Silla Rota no lo lista).
// Ninguna nota da hora ni precio de boleto → "por confirmar" (salvo festivales).
F.mil = ['Milenio — Conciertos en CdMx en noviembre 2026 (agenda completa)', 'https://www.milenio.com/espectaculos/musica/conciertos-cdmx-noviembre-2026-agenda-completa', '2026-11-02'];
F.corona = ['Corona Capital — sitio oficial (fechas y sede); precios: ClaroSports, 3 nov 2026', 'https://www.coronacapital.com.mx/', '2026-11-05'];
F.claro = ['ClaroSports — Todos los conciertos de noviembre 2026 en la CDMX', 'https://www.clarosports.com/tendencias/musica/corona-capital-flow-fest-karol-g-y-mas-todos-los-conciertos-de-noviembre-2026-en-la-cdmx/', '2026-11-03'];
const SEDE = {
  gnp: /^Estadio GNP Seguros$/, pdd: /^Palacio de los Deportes$/, an: /^Auditorio Nacional$/, pepsi: /^Pepsi Center WTC$/,
  metro: /^Teatro Metropólitan$/, lunario: /^Lunario$/, bb: /^Auditorio BB$/, maraka: /^La Maraka$/, puebla: /^Foro Puebla 186$/,
  // Fuera del catálogo: coordenadas de OpenStreetMap (Nominatim, 5 nov 2026).
  arena: { lat: 19.4976072, lng: -99.1751954, addr: 'Arena Ciudad de México, Av. de las Granjas, Azcapotzalco', col: 'Azcapotzalco' },
  autodromo: { lat: 19.4062448, lng: -99.094593, addr: 'Autódromo Hermanos Rodríguez, Av. Río Churubusco, Iztacalco', col: 'Iztacalco' },
  plazamx: { lat: 19.3829715, lng: -99.1800979, addr: 'Plaza México, Augusto Rodin, Noche Buena, Benito Juárez', col: 'Noche Buena' }
};
const SEDE_N = { gnp: 'Estadio GNP Seguros', pdd: 'Palacio de los Deportes', an: 'Auditorio Nacional', pepsi: 'Pepsi Center WTC', metro: 'Teatro Metropólitan',
  lunario: 'Lunario', bb: 'Auditorio BB', maraka: 'La Maraka', puebla: 'Foro Puebla', arena: 'Arena CDMX', autodromo: 'Autódromo Hermanos Rodríguez', plazamx: 'Plaza México' };
const K = [ // [artista, sede, días de noviembre]
  ['Aitana', 'an', [5, 6, 7]], ['Puma Blue', 'metro', [5]], ['Peces Raros', 'bb', [5]], ['Dillom', 'puebla', [5, 6, 7]], ['Erick Brian', 'maraka', [5]],
  ['Morat', 'pdd', [6, 7, 8, 13, 14, 15, 17]], ['Rubio', 'bb', [6]], ['Serbia', 'metro', [6]], ['Yahir y Charlie Zaa', 'maraka', [6]],
  ['Los Panchos', 'metro', [8]], ['Ricardo Montaner', 'an', [10]], ['ZZ Top', 'an', [11]], ['Opeth', 'arena', [11]],
  ['Elefante', 'an', [12]], ['María León', 'metro', [12]], ['Pancho Varona', 'lunario', [12]], ['Lifehouse', 'maraka', [12]], ['Ultraligera', 'puebla', [12]],
  ['Karol G', 'gnp', [13, 14, 15]], ['Andrés Calamaro', 'pepsi', [13]], ['El Kanka', 'metro', [13]], ['Carlos Cuevas', 'lunario', [13]], ['DLD', 'maraka', [13, 14]],
  ['Little Jesus', 'metro', [14]], ['Luis Ángel "El Flaco"', 'plazamx', [14]],
  ['Mägo de Oz', 'arena', [15]], ['Daniel Boaventura', 'an', [15]], ['Rapaparty', 'pepsi', [15]], ['Yolanda del Río', 'metro', [15]],
  ['Emmanuel y Mijares', 'an', [18]], ['Rainao', 'lunario', [18]], ['MARO', 'puebla', [18]],
  ['Dimash Qudaibergen', 'pdd', [19, 20]], ['Los Cafres y Los Estrambóticos', 'an', [19]], ['Arde Bogotá', 'metro', [19]], ['God Save the Queen', 'arena', [19]], ['Kalimba', 'maraka', [19, 20, 21]],
  ['Los Ángeles Azules', 'an', [20, 21]], ['CD9', 'arena', [20]], ['Francisca Valenzuela', 'puebla', [20]],
  ['El Cuarteto de Nos', 'pdd', [21]], ['Benny', 'metro', [21]], ['Javier Corcobado', 'lunario', [21]], ['Bostich & Fussible, Kinky y Nortec Collective', 'arena', [21]],
  ['LP', 'an', [22]], ['Taburete', 'metro', [22]], ['Los Calzones', 'lunario', [22]],
  ['Soda Stereo', 'pdd', [23]], ['BOYNEXTDOOR', 'arena', [24]], ['Love of Lesbian', 'metro', [24]], ['Love of Lesbian', 'an', [25]],
  ['Giant Rooks', 'metro', [25]], ['Babasónicos', 'pdd', [25]],
  ['Hayley Williams', 'an', [26]], ['CocoRosie', 'bb', [26]], ['Nacho Vegas', 'metro', [26]], ['Beto Cuevas', 'maraka', [26]],
  ['KATSEYE', 'pdd', [27, 28]], ['Los Auténticos Decadentes', 'gnp', [27]], ['Alejandra Guzmán', 'arena', [27]], ['Caloncho', 'an', [27]], ['Roz', 'pepsi', [27]],
  ['Nasa Histories', 'metro', [27]], ['Kudai y Nikki Clan', 'maraka', [27]], ['Six Sex', 'puebla', [27]],
  ['Gloria Trevi', 'an', [28]], ['Matute', 'arena', [28]], ['Menudo', 'metro', [28]], ['Gera MX', 'pepsi', [28]], ['Nicho Hinojosa', 'maraka', [28]], ['Disco Bahía', 'bb', [28]],
  ['The Mars Volta', 'pepsi', [29]], ['Rodrigo de la Cadena', 'an', [29]], ['Los Daniels y Electrify', 'lunario', [29]]
];
const dd = d => '2026-11-' + String(d).padStart(2, '0');
const diasTxt = ds => ds.length === 1 ? ds[0] + ' nov' : ds.slice(0, -1).join(', ') + ' y ' + ds[ds.length - 1] + ' nov';
const NOTA_K = 'Necesitas boleto: revisa en la boletera si quedan. Fecha y sede según Milenio (2 nov), La Silla Rota (1 nov) y ClaroSports (3 nov).';
K.forEach(([a, k, ds]) => E.push({ n: a + ' en concierto · ' + SEDE_N[k], cat: 'Foro', sede: SEDE[k], solo: ds.map(dd), oh: [20, 23], horaEstimada: true,
  hrs: diasTxt(ds) + ' · hora por confirmar (viene en tu boleto)', f: 'mil', consultado: '2026-11-05', who: ['amigos', 'compa', 'date'], tags: ['nightlife', 'social'], nota: NOTA_K, concierto: true }));
// Festivales: fechas y sede en su sitio oficial / agendas; precio General de un día según ClaroSports (antes de cargos).
E.push({ n: 'Corona Capital 2026 · Autódromo Hermanos Rodríguez', cat: 'Foro', sede: SEDE.autodromo, desde: '2026-11-20', hasta: '2026-11-22', oh: [13, 23], horaEstimada: true,
  hrs: '20, 21 y 22 nov · todo el día (horario por confirmar)', f: 'corona', consultado: '2026-11-05', who: ['amigos', 'compa', 'date'], tags: ['nightlife', 'social'], concierto: true,
  precio: { min: 2200, rep: 3500, max: 3500, unidad: 'persona', moneda: 'MXN', canasta: 'Boleto General de un día: Fase 1 $2,200, Fase 2 $2,600, sábado Fase 3 $3,500 (antes de cargos, ClaroSports 3 nov 2026).' },
  nota: 'Necesitas boleto: revisa en la boletera si quedan.' });
E.push({ n: 'Coca-Cola Flow Fest 2026 · Autódromo Hermanos Rodríguez', cat: 'Foro', sede: SEDE.autodromo, desde: '2026-11-28', hasta: '2026-11-29', oh: [13, 23], horaEstimada: true,
  hrs: '28 y 29 nov · todo el día (horario por confirmar)', f: 'claro', consultado: '2026-11-05', who: ['amigos', 'compa', 'date'], tags: ['nightlife', 'social'], concierto: true,
  precio: { min: 1637, rep: 3100, max: 3100, unidad: 'persona', moneda: 'MXN', canasta: 'General de un día en Ticketmaster: de $1,636.75 a $3,100 (ClaroSports 3 nov 2026).' },
  nota: 'Necesitas boleto: revisa en la boletera si quedan. Fechas también en Milenio (2 nov) y La Silla Rota (1 nov).' });

// ── Lo que viene en noviembre (InStyle 1 nov; @cdmx_oficial; consultado el 5 nov 2026) ──
F.instyle = ['InStyle México — Qué hacer en CDMX en noviembre 2026', 'https://instyle.mx/estilo-de-vida/que-hacer-cdmx-noviembre-2026/', '2026-11-01'];
F.horna = ['Crónica — Kati Horna en el Palacio de Bellas Artes', 'https://www.cronica.com.mx/cultura/2026/10/25/kati-horna-la-fotografa-documento-la-transformacion-de-la-vida-social-y-politica-mexicana-en-la-segunda-mitad-del-siglo-xx/', '2026-10-25'];
F.nfl = ['Crónica — 49ers vs Vikings en CDMX: cuándo, dónde y a qué hora', 'https://www.cronica.com.mx/deportes/2026/05/13/san-francisco-49ers-vs-minnesota-vikings-en-cdmx-cuando-donde-y-a-que-hora-sera-el-juego-de-la-nfl-en-mexico/', '2026-05-13'];
F.barbie = ['Los40 — Barbie Run 2026 llega a CDMX', 'https://los40.com.mx/2026/03/17/barbie-run-2026-la-carrera-inspirada-en-barbie-llegara-a-cdmx-y-estos-son-los-detalles/', '2026-03-17'];
const NOV = { consultado: '2026-11-05' };
const BOLETO = 'Necesitas boleto: revisa en la boletera si quedan.';
E.push(Object.assign({ n: 'Feria del Libro Comestible · Jardín Gallina de Guinea', cat: 'Atracción', sede: { lat: 19.34538, lng: -99.1933, addr: 'General Aureliano Rivera 4, San Ángel', col: 'San Ángel' },
  desde: '2026-11-06', hasta: '2026-11-08', oh: [11, 19], hrs: '6 al 8 nov · 11:00–19:00', f: 'instyle', precio: GRATIS, who: ['amigos', 'date', 'familia', 'compa'], tags: ['foodie', 'cultural', 'chill'] }, NOV));
E.push(Object.assign({ n: 'Nota Tavern × Bar Chenin', cat: 'Bar', sede: /^Nota Tavern$/, desde: '2026-11-06', hasta: '2026-11-07', oh: [19, 24], horaEstimada: true,
  hrs: '6 y 7 nov · hora por confirmar', f: 'instyle', who: ['amigos', 'date', 'compa'], tags: ['nightlife', 'foodie'] }, NOV));
E.push(Object.assign({ n: 'Brindis de Altura · Bajel', cat: 'Bar', sede: /^Bajel$/, solo: ['2026-11-07'], oh: [20, 23], hrs: 'Sáb 7 nov · 20:00',
  f: 'instyle', who: ['amigos', 'date', 'compa'], tags: ['nightlife', 'romántico', 'social'] }, NOV));
E.push(Object.assign({ n: 'Brunch de Bistró 44', cat: 'Restaurante', sede: { lat: 19.42838, lng: -99.19427, addr: 'Av. Emilio Castelar 44, Polanco', col: 'Polanco' },
  solo: ['2026-11-08'], oh: [11, 13], hrs: 'Dom 8 nov · 11:00–13:00', f: 'instyle', who: ['amigos', 'date', 'familia', 'compa'], tags: ['foodie', 'chill'] }, NOV));
E.push(Object.assign({ n: 'Lotti × Le Chêne · primer aniversario de Lotti', cat: 'Restaurante', sede: /^Lotti$/, solo: ['2026-11-12'], oh: [14.5, 22.5],
  hrs: 'Jue 12 nov · servicios a las 14:30 y 19:00 (reserva en OpenTable)', f: 'instyle', who: ['date', 'amigos', 'compa'], tags: ['foodie', 'romántico'] }, NOV));
E.push(Object.assign({ n: 'Inauguración: la Bienal de São Paulo llega al Tamayo', cat: 'Museo', sede: /^Museo Tamayo$/, solo: ['2026-11-14'], oh: [19, 22],
  hrs: 'Sáb 14 nov · 19:00 (inauguración)', f: 'instyle', precio: GRATIS, who: ['amigos', 'date', 'compa', 'solo'], tags: ['cultural', 'creativo'] }, NOV));
E.push(Object.assign({ n: 'Cena por las Chinampas · Casa Pedregal', cat: 'Restaurante', sede: { lat: 19.3285, lng: -99.20478, addr: 'Av. de las Fuentes 180, Jardines del Pedregal', col: 'Jardines del Pedregal' },
  solo: ['2026-11-19'], oh: [19, 23], hrs: 'Jue 19 nov · 19:00', f: 'instyle', who: ['date', 'amigos', 'compa'], tags: ['foodie', 'romántico'] }, NOV));
E.push(Object.assign({ n: 'The Thanksgiving Table · Esca', cat: 'Restaurante', sede: /^ESCA$/, solo: ['2026-11-26'], oh: [19, 23], horaEstimada: true,
  hrs: 'Jue 26 nov · hora por confirmar', f: 'instyle', who: ['amigos', 'date', 'familia', 'compa'], tags: ['foodie'] }, NOV));
E.push(Object.assign({ n: 'Kati Horna: lo insólito es lo cotidiano · Palacio de Bellas Artes', cat: 'Museo', sede: /^Palacio de Bellas Artes \(museo\)$/, desde: null, hasta: '2026-11-30',
  oh: [11, 17], hrs: 'Horario del museo (por confirmar)', horaEstimada: true, f: 'horna', who: ['amigos', 'date', 'solo', 'compa'], tags: ['cultural', 'creativo'],
  nota: 'Abierta desde octubre; ninguna fuente publica la fecha de cierre (@cdmx_oficial la anuncia todo noviembre).' }, NOV));
E.push(Object.assign({ n: 'NFL: 49ers vs Vikings · Estadio Banorte', cat: 'Foro', sede: /^Estadio Azteca$/, solo: ['2026-11-22'], oh: [19.33, 23], hrs: 'Dom 22 nov · 19:20 (Sunday Night Football)',
  f: 'nfl', who: ['amigos', 'compa', 'familia', 'date'], tags: ['social', 'nightlife', 'aventurero'], concierto: true, nota: BOLETO }, NOV));
E.push(Object.assign({ n: 'Barbie Run CDMX 2026 · Paseo de la Reforma', cat: 'Atracción', sede: { lat: 19.42435, lng: -99.1753, addr: 'Paseo de la Reforma, frente a Torre Mayor (salida y meta)', col: 'Juárez', zone: 'juarez' },
  solo: ['2026-11-22'], oh: [6.5, 9.5], hrs: 'Dom 22 nov · 5 km 6:30 · 10 km 7:00 · caminata 3 km 7:30', f: 'barbie', who: ['amigos', 'familia', 'compa'], tags: ['aventurero', 'familiar', 'social'],
  nota: 'Requiere inscripción previa (kit y número).', concierto: true }, NOV));

const app = makeApp({});
const C = app.cat();
let geocache = {}; const GC = path.join(__dirname, 'geocache.json'); if (fs.existsSync(GC)) geocache = JSON.parse(fs.readFileSync(GC, 'utf8'));
const crypto = require('crypto');
const out = E.map(e => {
  let lat, lng, zone, addr, col = '', aprox = false;
  if (e.sede instanceof RegExp) { const v = C.find(x => e.sede.test(x.n)); if (!v) throw new Error('sede no encontrada: ' + e.sede);
    lat = v.lat; lng = v.lng; zone = v.z; addr = v.addr || v.n; col = v.col || ''; e.sedeId = v.id; e.sedeN = v.n; }
  else { ({ lat, lng, zone, addr } = e.sede); col = e.sede.col || ''; aprox = !!e.sede.aprox;
    if (lat == null) { const g = geocache[e.sede.geo]; if (!g) throw new Error('falta geocodificar: ' + e.sede.geo); lat = g[0]; lng = g[1]; } }
  if (!zone) { let best = null; app.ZONES.forEach(z => { const g = app.ZGEO[z[0]]; if (!g) return; const d = Math.hypot((g[0] - lat) * 111, (g[1] - lng) * 105); if (!best || d < best[1]) best = [z[0], d]; }); zone = best[0]; }
  const [fuente, url, fecha] = F[e.f];
  const r = { id: 'ev-' + crypto.createHash('sha1').update(e.n).digest('hex').slice(0, 10), n: e.n, cat: e.cat, evento: true,
    fechas: e.solo ? { solo: e.solo, desde: e.solo[0], hasta: e.solo[e.solo.length - 1] } : { desde: e.desde, hasta: e.hasta },
    lat, lng, zone, col, addr, oh: e.oh, hrs: e.hrs, who: e.who, tags: e.tags, tm: [e.oh[0] <= 11 ? 'manana' : null, e.oh[0] <= 17 ? 'tarde' : null, e.oh[1] >= 20 ? 'noche' : null].filter(Boolean),
    act: { Museo: ['visita'], Foro: ['funcion'], 'Centro cultural': ['visita'], 'Atracción': ['visita', 'paseo'], Restaurante: ['comida', 'cena'], Bar: ['copas'] }[e.cat],
    fuente, url, fecha, consultado: e.consultado || HOY, hrsFuente: fuente, web: '', score: 80, tier: 'B', basis: 'Evento con fecha en ' + (e.sedeN || addr) };
  if (e.horaEstimada) r.horaEstimada = true;
  if (aprox) r.coordAprox = true;
  if (e.sedeId) r.sede = e.sedeId;
  if (e.precio) { r.precio = e.precio; r.estado = 'rango'; } else { r.precio = { min: null, rep: null, max: null, unidad: 'persona', moneda: 'MXN', canasta: 'La fuente no publica el precio.' }; r.estado = 'por_confirmar'; r.falta = 'el precio'; }
  if (e.cat === 'Foro') { r.sesion = true; }
  if (e.nota) r.nota = e.nota;
  if (e.concierto) r.concierto = true;
  if (e.tags.includes('familiar')) r.aptoFamilia = 'sí';
  return r;
});
const js = '/* SOBRES — Eventos con fecha (Fase 4, consultados el ' + HOY + '). Generado por reportes/eventos/build_eventos.js.\n'
  + ' * El motor sólo los propone si la fecha del plan cae entre `fechas.desde` y `fechas.hasta` (o en `fechas.solo`),\n'
  + ' * y desaparecen solos cuando vencen. Hora o precio que la fuente no da: "por confirmar". */\n'
  + 'window.SOBRES_EVENTOS = ' + JSON.stringify({ version: 1, fecha: HOY, eventos: out }) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'data', 'eventos.js'), js);
out.forEach(r => console.log(r.id, r.zone, r.fechas.desde + '→' + r.fechas.hasta, r.n));
