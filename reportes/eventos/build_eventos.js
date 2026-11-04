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
    desde: '2026-11-14', hasta: '2026-11-14', oh: [17, 23], hrs: 'Sáb 14 nov · de noche (hora por confirmar)', horaEstimada: true, f: 'chil', precio: GRATIS, who: ['familia', 'amigos', 'date'], tags: ['familiar', 'cultural', 'romántico'] },
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
const app = makeApp({});
const C = app.cat();
let geocache = {}; const GC = path.join(__dirname, 'geocache.json'); if (fs.existsSync(GC)) geocache = JSON.parse(fs.readFileSync(GC, 'utf8'));
const crypto = require('crypto');
const out = E.map(e => {
  let lat, lng, zone, addr, col = '', aprox = false;
  if (e.sede instanceof RegExp) { const v = C.find(x => e.sede.test(x.n)); if (!v) throw new Error('sede no encontrada: ' + e.sede);
    lat = v.lat; lng = v.lng; zone = v.z; addr = v.addr || v.n; col = v.col || ''; e.sedeId = v.id; e.sedeN = v.n; }
  else { ({ lat, lng, zone, addr } = e.sede); aprox = !!e.sede.aprox;
    if (lat == null) { const g = geocache[e.sede.geo]; if (!g) throw new Error('falta geocodificar: ' + e.sede.geo); lat = g[0]; lng = g[1]; } }
  if (!zone) { let best = null; app.ZONES.forEach(z => { const g = app.ZGEO[z[0]]; if (!g) return; const d = Math.hypot((g[0] - lat) * 111, (g[1] - lng) * 105); if (!best || d < best[1]) best = [z[0], d]; }); zone = best[0]; }
  const [fuente, url, fecha] = F[e.f];
  const r = { id: 'ev-' + crypto.createHash('sha1').update(e.n).digest('hex').slice(0, 10), n: e.n, cat: e.cat, evento: true,
    fechas: e.solo ? { solo: e.solo, desde: e.solo[0], hasta: e.solo[e.solo.length - 1] } : { desde: e.desde, hasta: e.hasta },
    lat, lng, zone, col, addr, oh: e.oh, hrs: e.hrs, who: e.who, tags: e.tags, tm: [e.oh[0] <= 11 ? 'manana' : null, e.oh[0] <= 17 ? 'tarde' : null, e.oh[1] >= 20 ? 'noche' : null].filter(Boolean),
    act: { Museo: ['visita'], Foro: ['funcion'], 'Centro cultural': ['visita'], 'Atracción': ['visita', 'paseo'] }[e.cat],
    fuente, url, fecha, consultado: HOY, hrsFuente: fuente, web: '', score: 80, tier: 'B', basis: 'Evento con fecha en ' + (e.sedeN || addr) };
  if (e.horaEstimada) r.horaEstimada = true;
  if (aprox) r.coordAprox = true;
  if (e.sedeId) r.sede = e.sedeId;
  if (e.precio) { r.precio = e.precio; r.estado = 'rango'; } else { r.precio = { min: null, rep: null, max: null, unidad: 'persona', moneda: 'MXN', canasta: 'La fuente no publica el precio.' }; r.estado = 'por_confirmar'; r.falta = 'el precio'; }
  if (e.cat === 'Foro') { r.sesion = true; }
  if (e.nota) r.nota = e.nota;
  if (e.tags.includes('familiar')) r.aptoFamilia = 'sí';
  return r;
});
const js = '/* SOBRES — Eventos con fecha (Fase 4, consultados el ' + HOY + '). Generado por reportes/eventos/build_eventos.js.\n'
  + ' * El motor sólo los propone si la fecha del plan cae entre `fechas.desde` y `fechas.hasta` (o en `fechas.solo`),\n'
  + ' * y desaparecen solos cuando vencen. Hora o precio que la fuente no da: "por confirmar". */\n'
  + 'window.SOBRES_EVENTOS = ' + JSON.stringify({ version: 1, fecha: HOY, eventos: out }) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'data', 'eventos.js'), js);
out.forEach(r => console.log(r.id, r.zone, r.fechas.desde + '→' + r.fechas.hasta, r.n));
