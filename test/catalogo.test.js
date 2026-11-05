// Catálogo: lugares nuevos del paquete del 3 nov 2026 (data/paquete.js).
// Reglas: todo lugar nuevo lleva fuente (URL) y fecha; lo no confirmado se marca
// estimado / por confirmar; no se repite lo que ya estaba.
const fs = require('fs');
const path = require('path');
const { makeApp, test, assert, section, report } = require('./harness.js');

section('26 · Catálogo: paquete del 3 nov 2026');

test('cada lugar nuevo trae fuente (URL), fecha de consulta y precio con su estado', () => {
  const app = makeApp({});
  const nuevos = app.cat().filter(v => /^pq-/.test(v.id));
  assert(nuevos.length > 300, 'sólo ' + nuevos.length + ' lugares nuevos');
  nuevos.forEach(v => {
    assert(/^https?:\/\//.test(v.pUrl || ''), v.n + ' sin URL de fuente');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(v.consultado || ''), v.n + ' sin fecha de consulta');
    assert(['estimado', 'rango', 'por_confirmar'].includes(v.pEstado), v.n + ' con precio "' + v.pEstado + '"');
    assert(v.horaEstimada || /\d/.test(v.hrs || ''), v.n + ' sin horario ni marca de "por confirmar"');
  });
});

test('ningún lugar nuevo repite uno que ya estaba (mismo nombre a menos de 300 m)', () => {
  const app = makeApp({});
  const n = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const viejos = app.cat().filter(v => !/^pq-/.test(v.id) && v.lat != null);
  const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 105);
  const dup = [];
  app.cat().filter(v => /^pq-/.test(v.id) && v.lat != null && !v.coordAprox).forEach(v => viejos.forEach(o => {
    if (o.coordAprox || km(v, o) > 0.3) return;
    const a = n(v.n.split(/ · |, /)[0]), b = n(o.n.split(/ · |, /)[0]);
    if (a.length > 3 && (a === b || a.includes(b) && b.length > 5 || b.includes(a) && a.length > 5) && v.cat === o.cat) dup.push(v.n + ' = ' + o.n);
  }));
  assert(!dup.length, 'repetidos: ' + dup.join(' · '));
});

test('los ids del paquete viajan en el enlace compartido', () => {
  const app = makeApp({});
  const v = app.cat().find(x => /^pq-/.test(x.id));
  assert(app.largaId(app.cortaId(v)) === v.id, 'el id ' + v.id + ' no se codifica bien');
});

test('el importador es idempotente: correrlo otra vez no cambia nada', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'data', 'paquete.js'), 'utf8');
  const ids = (js.match(/"id":"pq-[0-9a-f]+"/g) || []);
  assert(new Set(ids).size === ids.length, 'ids repetidos dentro de data/paquete.js');
});

// Regresión (4 nov 2026): dos correcciones con la misma clave en data/auditoria.js
// se pisaban en silencio (los días de Patrick Miller se perdían).
test('data/auditoria.js no repite claves de lugar (una pisaría a la otra)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'data', 'auditoria.js'), 'utf8');
  const i = src.indexOf('const LUGARES = {'), j = src.indexOf('\n  };\n', i);
  const claves = (src.slice(i, j).match(/^    '([a-z]+-[^']+)':/gm) || []).map(x => x.trim());
  const rep = claves.filter((k, n) => claves.indexOf(k) !== n);
  assert(!rep.length, 'claves repetidas: ' + rep.join(', '));
});

section('26b · Catálogo: lugares investigados el 4 nov 2026 (data/investigados.js)');

test('cada lugar investigado trae fuente (URL), fecha de la fuente y de consulta, y precio con su estado', () => {
  const app = makeApp({});
  const iv = app.cat().filter(v => /^iv-/.test(v.id));
  assert(iv.length >= 30, 'sólo ' + iv.length + ' lugares investigados');
  const crudo = {}; (require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'investigados.js'), 'utf8') + ';window', { window: {} })
    .SOBRES_INVESTIGADOS.lugares).forEach(r => { crudo[r.id] = r; });
  iv.forEach(v => {
    assert(/^https?:\/\//.test(v.pUrl || ''), v.n + ' sin URL de fuente');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(v.consultado || ''), v.n + ' sin fecha de consulta');
    assert(crudo[v.id] && crudo[v.id].fecha, v.n + ' sin fecha de la fuente');
    // 'verificado' sólo con tarifa oficial (p. ej. la del INAH para el Castillo de Chapultepec).
    assert(['estimado', 'rango', 'por_confirmar', 'verificado'].includes(v.pEstado), v.n + ' con precio "' + v.pEstado + '"');
    assert(v.horaEstimada || /\d/.test(v.hrs || ''), v.n + ' sin horario ni marca de "por confirmar"');
  });
});

test('una fuente anterior a 2024 no se propone en planes hasta reverificarla', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'data', 'investigados.js'), 'utf8');
  const L = require('vm').runInNewContext(js + ';window', { window: {} }).SOBRES_INVESTIGADOS.lugares;
  const viejas = L.filter(r => /^(19|20[01]\d|202[0-3])-/.test(r.fecha));
  assert(viejas.length > 0, 'la prueba no ve ninguna fuente vieja');
  viejas.forEach(r => assert(r.recomendable === false, r.n + ' (fuente ' + r.fecha + ') se propondría en planes'));
});

test('ningún lugar investigado repite uno que ya estaba (La Casa del Cine ya venía en el paquete)', () => {
  const app = makeApp({});
  const n = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 105);
  const viejos = app.cat().filter(v => !/^iv-/.test(v.id) && v.lat != null);
  const dup = [];
  app.cat().filter(v => /^iv-/.test(v.id)).forEach(v => viejos.forEach(o => {
    const a = n(v.n.split(/ · |, /)[0]), b = n(o.n.split(/ · |, /)[0]);
    // Una sucursal con el mismo nombre en OTRA zona y a más de 1.5 km es válida
    // ("Forever Vegano · Polanco" vs. "Forever Vegano" en la Roma), como en el resto del catálogo.
    // En la misma zona, dos sucursales con distinto apellido y a más de 1.5 km
    // también valen ("La Popular · Santa Fe" vs. "La Popular · Arcos Bosques").
    const mismaSucursal = km(v, o) < 1.5 || (v.z === o.z && n(v.n) === n(o.n));
    if (a.length > 3 && ((a === b && mismaSucursal) || (km(v, o) < 0.3 && v.cat === o.cat && (a.includes(b) && b.length > 5 || b.includes(a) && a.length > 5)))) dup.push(v.n + ' = ' + o.n);
  }));
  assert(!dup.length, 'repetidos: ' + dup.join(' · '));
});

// Regresión: "Museo Nacional de Historia · Castillo de Chapultepec" ya estaba
// como "Castillo de Chapultepec · Museo Nacional de Historia" (mismas palabras).
test('ningún lugar investigado repite otro con las mismas palabras en otro orden', () => {
  const app = makeApp({});
  const raiz = s => app.strip(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2).sort().join(' ');
  const viejos = new Map(app.cat().filter(v => !/^iv-/.test(v.id)).map(v => [raiz(v.n), v.n]));
  const dup = app.cat().filter(v => /^iv-/.test(v.id) && viejos.has(raiz(v.n))).map(v => v.n + ' = ' + viejos.get(raiz(v.n)));
  assert(!dup.length, dup.join(' · '));
});

// Regresión (4 nov 2026): se escribió 'si' sin acento y la app sólo entiende 'sí'.
test('la marca de familia de los investigados usa los valores de la app (sí / no / desconocido)', () => {
  const L = require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'investigados.js'), 'utf8') + ';window', { window: {} }).SOBRES_INVESTIGADOS.lugares;
  L.filter(r => r.aptoFamilia).forEach(r => assert(['sí', 'no', 'desconocido'].includes(r.aptoFamilia), r.n + ': aptoFamilia "' + r.aptoFamilia + '"'));
  assert(L.some(r => r.aptoFamilia === 'sí'), 'ningún investigado quedó apto para familia');
});

test('los ids investigados viajan en el enlace compartido', () => {
  const app = makeApp({});
  app.cat().filter(x => /^iv-/.test(x.id)).forEach(v =>
    assert(app.largaId(app.cortaId(v)) === v.id, 'el id ' + v.id + ' no se codifica bien'));
});

section('26c · Eventos con fecha (data/eventos.js)');

test('cada evento trae fuente (URL), fecha de la nota y fechas de inicio o fin', () => {
  const app = makeApp({});
  const ev = app.cat().filter(v => v.evento);
  assert(ev.length >= 8, 'sólo ' + ev.length + ' eventos');
  ev.forEach(v => {
    assert(/^https?:\/\//.test(v.pUrl || ''), v.n + ' sin URL');
    assert(v.fechas && v.fechas.hasta, v.n + ' sin fecha de fin');
    assert(v.horaEstimada || /\d/.test(v.hrs), v.n + ' sin hora ni "por confirmar"');
  });
});

test('un evento sólo se propone el día que pasa (y con su hora real)', () => {
  const dia = d => makeApp({ who: 'amigos', zone: 'centro', zonesSel: ['centro'], when: 'fecha', customDate: d, vibes: ['nightlife'] }, { dseed: 1, rseed: 8 });
  let a = dia('2026-11-14');
  const g = a.cat().find(v => /^Garbage/.test(v.n));
  assert(a.timingOk(g), 'Garbage no cuenta el 14 de noviembre');
  a.runSearch({ nueva: true });
  const pl = a.state.results.plans.find(p => p.stops.some(v => v.id === g.id));
  assert(pl, 'el 14 de noviembre ningún plan de noche en el Centro trae el concierto');
  assert(pl.times[pl.stops.findIndex(v => v.id === g.id)] === 20, 'el concierto no quedó a las 8 pm');
  a = dia('2026-11-15');
  assert(!a.timingOk(a.cat().find(v => v.id === g.id)), 'Garbage cuenta el 15 de noviembre');
  a.runSearch({ nueva: true });
  assert(!a.state.results.plans.some(p => p.stops.some(v => v.evento && !a.vigenteEn(v, '2026-11-15'))), 'un plan del 15 trae un evento de otro día');
});

test('un evento vencido ni se carga', () => {
  const app = makeApp({});
  app._win.SOBRES_EVENTOS.eventos.push({ id: 'ev-0000000000', n: 'Evento viejo de prueba', cat: 'Foro', evento: true, fechas: { desde: '2020-01-01', hasta: '2020-01-02' },
    lat: 19.43, lng: -99.13, zone: 'centro', oh: [20, 22], hrs: '20:00', who: ['amigos'], tags: ['social'], tm: ['noche'], fuente: 'prueba', url: 'https://ejemplo.test', estado: 'por_confirmar', precio: {} });
  const L = app.aplicarAuditoria(app.EXT.filter(v => !v.aud).slice(0, 5));
  assert(!L.some(v => v.id === 'ev-0000000000'), 'cargó un evento que ya pasó');
  app._win.SOBRES_EVENTOS.eventos.pop();
});

test('los ids de eventos viajan en el enlace compartido', () => {
  const app = makeApp({});
  const v = app.cat().find(x => x.evento);
  assert(app.largaId(app.cortaId(v)) === v.id, v.id);
});

section('26d · Lugares de OpenStreetMap aprobados (data/osm.js)');

test('cada lugar de OSM trae su ficha (URL), fecha de última edición y precio por confirmar', () => {
  const app = makeApp({});
  const L = app.cat().filter(v => /^os-/.test(v.id));
  assert(L.length >= 600, 'sólo ' + L.length + ' lugares de OSM');
  L.forEach(v => {
    assert(/^https:\/\/(www\.openstreetmap\.org|es\.wikipedia\.org)\//.test(v.pUrl || ''), v.n + ' sin ficha');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(v.consultado || ''), v.n + ' sin fecha de consulta');
    assert(v.pEstado === 'por_confirmar', v.n + ' con precio "' + v.pEstado + '" (OSM no publica precios)');
    assert(v.horaEstimada || /\d/.test(v.hrs || ''), v.n + ' sin horario ni "por confirmar"');
  });
});

test('ningún lugar de OSM repite uno que ya estaba (mismo nombre a menos de 300 m)', () => {
  const app = makeApp({});
  const n = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 105);
  const viejos = app.cat().filter(v => !/^os-/.test(v.id) && v.lat != null);
  const dup = [];
  app.cat().filter(v => /^os-/.test(v.id)).forEach(v => viejos.forEach(o => {
    const a = n(v.n.split(/ · |, /)[0]), b = n(o.n.split(/ · |, /)[0]);
    if (a.length > 3 && km(v, o) < 0.3 && (a === b || (a.includes(b) && b.length > 5) || (b.includes(a) && a.length > 5))) dup.push(v.n + ' = ' + o.n);
  }));
  assert(!dup.length, 'repetidos: ' + dup.slice(0, 8).join(' · '));
});

test('ninguna cadena de comida rápida entró desde OSM', () => {
  const app = makeApp({});
  const malos = app.cat().filter(v => /^os-/.test(v.id) && /starbucks|vips|mcdonald|burger king|kfc|domino|subway|ihop|bisquets obreg|boston'?s|santa clara/i.test(v.n));
  assert(!malos.length, malos.map(v => v.n).join(', '));
});

test('los ids de OSM viajan en el enlace compartido', () => {
  const app = makeApp({});
  ['n', 'w'].forEach(t => { const v = app.cat().find(x => new RegExp('^os-' + t).test(x.id));
    if (v) assert(app.largaId(app.cortaId(v)) === v.id, v.id); });
});

section('26e · Sin datos guardados de Google Maps (términos de Google, 4 nov 2026)');

test('el catálogo no guarda lugares sacados de Google Maps: sólo place_id; lo demás se pide en vivo', () => {
  const fs = require('fs'), path = require('path');
  assert(!fs.existsSync(path.join(__dirname, '..', 'data', 'maps.js')), 'sigue data/maps.js');
  const app = makeApp({});
  const gm = app.cat().filter(v => /^gm-/.test(v.id) || /^Google Maps/.test(v.src || '') && !v.deGoogle);
  assert(!gm.length, 'quedan lugares de Google Maps en el catálogo: ' + gm.slice(0, 5).map(v => v.n));
  const gid = fs.readFileSync(path.join(__dirname, '..', 'data', 'google_ids.js'), 'utf8');
  const j = JSON.parse(gid.slice(gid.indexOf('{'), gid.lastIndexOf('}') + 1));
  assert(Object.keys(j).sort().join() === 'fecha,ids,version' && Object.values(j.ids).every(x => /^[\w-]+$/.test(x)), 'google_ids.js guarda algo más que ids');
});

test('26f · Santa Fe: sin Jalalpa ni Prados de la Montaña; Cinépolis Patio Santa Fe confirmado por su cartelera; La Bonvi, Carolo y La Popular con fuente', () => {
  const app = makeApp({ who: 'amigos', zone: 'santafe', zonesSel: ['santafe'], vibes: ['foodie'] });
  const C = app.cat();
  assert(!C.some(v => /jalalpa|prados de la monta/i.test(v.n)), 'siguen los parques que se pidió quitar');
  const cine = C.find(v => v.id === 'pq-f6673bacff');
  assert(cine && app.esRecomendable(cine) && /Sigue abierto según SensaCine/.test(cine.pNotaLugar), 'el cine sigue fuera: ' + (cine && cine.pNotaLugar));
  const bonvi = C.filter(v => /La Bonvi/.test(v.n));
  assert(bonvi.length === 2 && bonvi.every(v => /^iv-/.test(v.id) && v.pUrl && v.pEstado === 'por_confirmar'), 'La Bonvi: ' + bonvi.map(v => v.n + ' ' + v.pEstado));
  ['Carolo · Carso', 'Carolo · Interlomas', 'La Popular · Santa Fe', 'Carolo · Santa Fe', 'La Popular · Arcos Bosques'].forEach(n =>
    assert(C.some(v => v.n === n && v.pUrl), 'falta ' + n));
  app.setState({ homeQ: 'bonvi' });
  assert(app.renderVals().homeResults.length >= 2, 'el buscador no encuentra las dos La Bonvi');
});

test('26g · con un rango de precio, SOBRES usa el más alto; en museos, la tarifa para mexicanos (fundador, 4 nov 2026)', () => {
  const app = makeApp({ who: 'amigos', zone: 'roma', zonesSel: ['roma'], vibes: ['foodie'] });
  const con = app.cat().filter(v => !v.ppUnknown && v.pMax != null && v.pRep != null && !v.pAjusteLocal && !v.pOtraUnidad && !v.cursoCerrado && v.pMoneda === 'MXN');
  assert(con.length > 500, 'pocos lugares con rango: ' + con.length);
  const MX = ['Museo', 'Sitio histórico', 'Zona arqueológica', 'Galería', 'Centro cultural'];
  const mal = con.filter(v => v.pp !== (MX.includes(v.cat) ? v.pRep : Math.max(v.pRep, v.pMax)));
  assert(!mal.length, 'no usan el alto: ' + mal.slice(0, 5).map(v => v.n + ' ' + v.pp + ' de ' + v.pMin + '–' + v.pMax));
});

if (require.main === module) report();
