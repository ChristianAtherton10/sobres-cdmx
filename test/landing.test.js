// Fase 3 · Que la gente que llega de un anuncio sí arme un plan (feat/landing, 4 nov 2026).
const { makeApp, test, assert, section, report } = require('./harness.js');

section('28 · Fase 3: llegada desde un anuncio');

const conGtag = app => { const evs = []; app._win.gtag = (k, n, p) => evs.push({ n, p }); return evs; };

test('28.1 · preset y utm_content preseleccionan el plan del anuncio (no "Comer rico · Roma Norte")', () => {
  let a = makeApp({}, { search: '?preset=familia&zona=coyoacan' });
  assert(a.state.who === 'familia' && a.state.vibes.join() === 'familiar' && a.state.zone === 'coyoacan', 'familia: ' + JSON.stringify([a.state.who, a.state.vibes, a.state.zone]));
  a = makeApp({}, { search: '?utm_source=instagram&utm_content=date_polanco&zona=polanco' });
  assert(a.state.who === 'date' && a.state.groupSize === 2 && a.state.vibes.join() === 'romántico' && a.state.zone === 'polanco', 'date');
  a = makeApp({}, { search: '?preset=noche' });
  assert(a.state.vibes.join() === 'nightlife' && a.state.when === 'noche', 'noche');
  a = makeApp({}, { search: '?preset=loquesea&zona=marte' });
  assert(a.state.vibes.join() === 'foodie' && a.state.zone === 'roma', 'un preset desconocido cambió los valores por defecto');
});

test('28.2 · ?v=rapido muestra una sola pantalla con el botón fijo; sin parámetro, el flujo de siempre', () => {
  let a = makeApp({}, { search: '?v=rapido' });
  let rv = a.renderVals();
  assert(rv.rapidoOn && !rv.noRapido, 'el modo rápido no se activó');
  assert(/por defecto/.test(rv.rapidoNota), 'no dice qué va por defecto');
  a = makeApp({});
  rv = a.renderVals();
  assert(!rv.rapidoOn && rv.noRapido, 'el flujo normal cambió');
});

test('28.3 · cada evento lleva los UTM de la visita; elegir y compartir disparan los nombres nuevos', () => {
  const a = makeApp({}, { search: '?utm_source=instagram&utm_medium=stories&utm_campaign=e31&utm_content=noche_roma' });
  const evs = conGtag(a);
  a.ev('armar_planes', { zona: 'Roma' });
  a.ev('elegir_plan', { opcion: 1 });
  a.ev('compartir_enlace', { tanda: true });
  const nombres = evs.map(e => e.n);
  assert(nombres.join() === 'armar_planes,elegir_plan,plan_elegido,compartir_enlace,plan_compartido', nombres.join());
  evs.forEach(e => assert(e.p.utm_source === 'instagram' && e.p.utm_campaign === 'e31' && e.p.variante === 'normal', e.n + ' sin UTM'));
});

test('28.4 · las visitas de QA (utm_source=qa o qa_claude) no mandan eventos', () => {
  ['qa', 'qa_claude'].forEach(src => {
    const a = makeApp({}, { search: '?utm_source=' + src });
    const evs = conGtag(a);
    a.ev('armar_planes', {}); a.ev('plan_visto', {});
    assert(!evs.length, src + ' mandó ' + evs.length + ' eventos');
  });
});

test('28.5 · buscar dispara plan_visto; elegir, plan_elegido', () => {
  const a = makeApp({ zone: 'roma', zonesSel: ['roma'] });
  const evs = conGtag(a);
  a.runSearch({ nueva: true });
  assert(evs.some(e => e.n === 'plan_visto' && e.p.opciones === 3), 'sin plan_visto');
  a.renderVals().opciones[0].elegir();
  assert(evs.some(e => e.n === 'plan_elegido'), 'sin plan_elegido');
});

test('28.6 · un enlace de planes funciona como página de llegada con "Armar el mío"', () => {
  const emisor = makeApp({ who: 'familia', groupSize: 4, zone: 'coyoacan', zonesSel: ['coyoacan'], when: 'finde', vibes: ['familiar'], budget: 'b600' });
  emisor.runSearch({ nueva: true });
  const link = emisor.tandaLink();
  assert(/^https:\/\/sitio\.test\/\?p=1~/.test(link), link);
  const a = makeApp({}, { search: link.slice(link.indexOf('?')) });
  const evs = conGtag(a);
  a.abrirTanda(link.split('?p=')[1], true);
  let rv = a.renderVals();
  assert(rv.armarMioOn, 'no aparece "Armar el mío"');
  assert(rv.opciones.length === emisor.state.results.plans.length, 'no se ven los mismos planes');
  rv.armarMio();
  assert(a.state.view === 'home' && a.state.paso === 1, 'no lleva al formulario');
  assert(a.state.who === 'familia' && a.state.zone === 'coyoacan' && a.state.vibes.join() === 'familiar', 'no prellenó con lo mismo');
  assert(evs.some(e => e.n === 'armar_el_mio'), 'sin evento armar_el_mio');
});

test('28.7 · el catálogo espera a TODAS sus capas (antes el paquete podía quedarse fuera)', () => {
  const a = makeApp({});
  assert(a.catalogoListo(), 'con todo cargado debería estar listo');
  const guardado = a._win.SOBRES_PAQUETE; delete a._win.SOBRES_PAQUETE;
  assert(!a.catalogoListo(), 'sin el paquete dice que está listo');
  a._win.SOBRES_PAQUETE = guardado;
});

section('29 · Revisión del 4 nov 2026 (QA en web y celular)');

test('29.1 · Patrick Miller sólo se propone en viernes; Salón Los Ángeles martes y domingo', () => {
  const dia = d => makeApp({ who: 'amigos', zone: 'roma', zonesSel: ['roma'], when: 'fecha', customDate: d, vibes: ['nightlife'] });
  const pm = a => a.cat().find(v => v.id === 'cdmx-2022');
  let a = dia('2026-11-04'); assert(!a.timingOk(pm(a)), 'Patrick Miller sale un miércoles');
  a = dia('2026-11-06'); assert(a.timingOk(pm(a)), 'Patrick Miller no sale el viernes');
  a = dia('2026-11-05'); assert(!a.timingOk(a.cat().find(v => v.id === 'cdmx-2066')), 'Salón Los Ángeles sale un jueves');
});

test('29.2 · un enlace con UN plan dice "este plan", no "estos planes"', () => {
  const emisor = makeApp({ zone: 'roma', zonesSel: ['roma'] }); emisor.runSearch({ nueva: true });
  const link = emisor.tandaLinkDe([emisor.state.results.plans[0]]);
  const a = makeApp({}); a.abrirTanda(link.split('?p=')[1], true);
  assert(/este plan/.test(a.renderVals().tandaDeTxt), a.renderVals().tandaDeTxt);
});

test('29.3 · la búsqueda del inicio encuentra lugares y abre su ficha', () => {
  const a = makeApp({}); a.setState({ homeQ: 'contramar' });
  const rv = a.renderVals();
  assert(rv.homeOpen && rv.homeResults.length && /Contramar/.test(rv.homeResults[0].name), 'no encontró Contramar');
  rv.homeResults[0].open();
  assert(a.state.view === 'detail' && a.state.detailId === 'contramar', 'no abrió la ficha');
  assert(!a.state.homeQ, 'la búsqueda no se limpió');
});

test('29.4 · cada evento de GA4 lleva el número anónimo del usuario', () => {
  const a = makeApp({}); const evs = []; a._win.gtag = (k, n, p) => evs.push({ n, p }); a._win.SOBRES_UID = 'S-ABCDEFGHJK';
  a.ev('plan_visto', {});
  assert(evs[0] && evs[0].p.sobres_uid === 'S-ABCDEFGHJK', JSON.stringify(evs[0]));
});

test('29.5 · "Ver otras opciones" trae TIPOS de plan distintos, no sólo otros lugares', () => {
  const a = makeApp({ who: 'amigos', groupSize: 4, zone: 'roma', zonesSel: ['roma'], when: 'noche', vibes: ['nightlife'], budget: 'b1000', budgetCustom: null }, { dseed: 5, rseed: 36 });
  a.runSearch({ nueva: true });
  const tipos = new Set(); let previa = null; let nuevasPorTanda = [];
  for (let i = 0; i < 4; i++) {
    const t = new Set(a.state.results.plans.map(p => p.plantilla || 'suelto:' + p.stops[0].cat));
    if (previa) nuevasPorTanda.push([...t].filter(x => !previa.has(x)).length);
    t.forEach(x => tipos.add(x)); previa = t;
    a.renderVals().resurprise();
  }
  assert(tipos.size >= 7, 'sólo ' + tipos.size + ' tipos de plan en 4 tandas: ' + [...tipos].join(', '));
  assert(nuevasPorTanda.every(n => n >= 1), 'alguna tanda no trajo ningún tipo nuevo: ' + nuevasPorTanda.join(','));
});

test('29.6 · dos personas distintas no reciben exactamente las mismas tres opciones', () => {
  const corre = uid => { const a = makeApp({ who: 'amigos', groupSize: 4, zone: 'roma', zonesSel: ['roma'], when: 'noche', vibes: ['nightlife'], budget: 'b1000', budgetCustom: null }, { dseed: 5, rseed: 36 });
    a._win.SOBRES_UID = uid; a.runSearch({ nueva: true }); return a.state.results.plans.map(p => a.comboSig(p.stops)).join('/'); };
  const distintos = new Set(['S-AAAAAAAAAA', 'S-BBBBBBBBBB', 'S-CCCCCCCCCC', 'S-DDDDDDDDDD'].map(corre));
  assert(distintos.size >= 2, 'las 4 personas vieron lo mismo');
});

section('30 · Tipo de comida dentro de "Comer rico"');

const COM = { who: 'amigos', groupSize: 4, zone: 'roma', zonesSel: ['roma'], when: 'noche', budget: 'b1000', budgetCustom: null, vibes: ['foodie'] };
const comidas = (a, pl) => pl.stops.filter(v => a.esComidaFiltrable(v));

test('30.1 · con "Comer rico" aparece la sub-tabla; "Todo tipo" viene marcado y se puede elegir uno o varios', () => {
  const a = makeApp(COM);
  let rv = a.renderVals();
  assert(rv.cocinaOn && rv.cocinaOpts.length >= 10, 'no aparece la sub-tabla');
  assert(rv.cocinaOpts[0].label === 'Todo tipo' && rv.cocinaOpts[0].pressed === 'true', 'Todo tipo no viene marcado');
  rv.cocinaOpts.find(o => o.label === 'Italiana y pizza').pick();
  rv = a.renderVals(); rv.cocinaOpts.find(o => o.label === 'Japonesa y sushi').pick();
  assert(JSON.stringify(a.state.cocinas) === '["italiana","japonesa"]', 'no guardó dos tipos: ' + a.state.cocinas);
  rv = a.renderVals(); assert(rv.cocinaOpts[0].pressed === 'false', 'Todo tipo sigue marcado con dos elegidos');
  rv.cocinaOpts[0].pick(); assert(!a.state.cocinas.length, '"Todo tipo" no limpia la selección');
  const b = makeApp(Object.assign({}, COM, { vibes: ['cultural'] }));
  assert(!b.renderVals().cocinaOn, 'aparece sin "Comer rico"');
});

test('30.2 · un tipo (mariscos): todas las paradas de comer de las 3 opciones son de mariscos', () => {
  [1, 2, 3].forEach(sd => {
    const a = makeApp(Object.assign({}, COM, { cocinas: ['mariscos'] }), { dseed: sd, rseed: sd * 5 + 2 });
    a.runSearch({ nueva: true });
    const pls = a.state.results.plans || [];
    assert(pls.length >= 2, 'semilla ' + sd + ': ' + pls.length + ' opciones');
    pls.forEach(pl => { const c = comidas(a, pl);
      assert(c.length, 'una opción sin dónde comer: ' + pl.stops.map(v => v.n));
      c.forEach(v => assert(a.tiposCocina(v).includes('mariscos'), v.n + ' no es de mariscos (' + a.tiposCocina(v) + ')')); });
  });
});

test('30.3 · varios tipos (italiana o japonesa): sólo salen esos, y "Ver otras opciones" respeta el filtro', () => {
  const a = makeApp(Object.assign({}, COM, { cocinas: ['italiana', 'japonesa'] }), { dseed: 4, rseed: 9 });
  a.runSearch({ nueva: true });
  const ver = () => (a.state.results.plans || []).forEach(pl => comidas(a, pl).forEach(v =>
    assert(a.tiposCocina(v).some(k => k === 'italiana' || k === 'japonesa'), v.n + ' (' + a.tiposCocina(v) + ')')));
  ver(); a.regenerate(); ver();
});

test('30.4 · "Tacos" en "Comer rico" sí deja entrar taquerías (sin tacos no)', () => {
  const a = makeApp(Object.assign({}, COM, { budget: 'b600', cocinas: ['tacos'] }), { dseed: 2, rseed: 3 });
  a.runSearch({ nueva: true });
  const st = (a.state.results.plans || []).flatMap(pl => comidas(a, pl));
  assert(st.length && st.every(v => a.tiposCocina(v).includes('tacos')), st.map(v => v.n).join(', '));
  assert(st.some(v => v.cat === 'Taquería'), 'ninguna taquería con "Tacos" elegido');
  const b = makeApp(COM, { dseed: 2, rseed: 3 }); b.runSearch({ nueva: true });
  assert(!(b.state.results.plans || []).some(pl => pl.stops.some(v => v.cat === 'Taquería')), '"Comer rico" sin tacos trae taquerías');
});

test('30.5 · si no hay ese tipo en la zona, lo dice y muestra otras cocinas (no un plan vacío)', () => {
  const a = makeApp(Object.assign({}, COM, { zone: 'xochimilco', zonesSel: ['xochimilco'], cocinas: ['francesa'] }), { dseed: 1, rseed: 1 });
  const hay = a.cat().some(v => v.z === 'xochimilco' && a.esComidaFiltrable(v) && a.esRecomendable(v) && a.tiposCocina(v).includes('francesa'));
  assert(!hay, 'la prueba supone que no hay francesa en Xochimilco');
  a.runSearch({ nueva: true });
  assert((a.state.results.plans || []).length > 0, 'plan vacío');
  assert(/No encontré comida francesa en/.test(a.state.results.expandNote || ''), 'no lo dijo: ' + a.state.results.expandNote);
});

test('30.6 · cada restaurante sabe su tipo: la mayoría de los recomendables tiene al menos uno', () => {
  const a = makeApp(COM);
  const R = a.cat().filter(v => a.esRecomendable(v) && a.esComidaFiltrable(v));
  const con = R.filter(v => a.tiposCocina(v).length);
  assert(con.length / R.length > 0.6, con.length + ' de ' + R.length);
  const bonvi = a.cat().find(v => v.n === 'La Bonvi · Polanco');
  assert(a.tiposCocina(bonvi).includes('tacos'), 'La Bonvi sin tipo tacos');
});

test('30.7 · tipo que existe pero no cabe en horario o presupuesto: lo dice y arma con otras cocinas', () => {
  const a = makeApp(Object.assign({}, COM, { budget: 'b600', cocinas: ['mariscos', 'japonesa'] }), { dseed: 1, rseed: 1 });
  a.runSearch({ nueva: true });
  const r = a.state.results;
  assert((r.plans || []).length > 0, 'quedó "sin planes"');
  const fuera = (r.plans || []).some(pl => pl.stops.some(v => a.esComidaFiltrable(v) && !a.tiposCocina(v).some(k => k === 'mariscos' || k === 'japonesa')));
  if (fuera) assert(/No encontré comida mariscos o japonesa y sushi/.test(r.expandNote || ''), 'cambió de cocina sin decirlo: ' + r.expandNote);
});

section('31 · Google Places en vivo (sólo CDMX)');

// Horario de Google: lunes a sábado 13:00–01:00 (cruza medianoche); domingo cerrado.
const PER = [1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, hour: 13, minute: 0 }, close: { day: (d + 1) % 7, hour: 1, minute: 0 } }));

test('31.1 · lee el horario de Google, también cuando cierra después de medianoche', () => {
  const a = makeApp(COM); const g = { periodos: PER };
  // 2026-11-06 es viernes.
  assert(a.googleAbierto(g, '2026-11-06', 20) === true, 'viernes 8 pm');
  assert(a.googleAbierto(g, '2026-11-06', 24.5) === true, 'viernes 12:30 am (sábado temprano)');
  assert(a.googleAbierto(g, '2026-11-06', 25.5) === false, 'viernes 1:30 am ya cerró');
  assert(a.googleAbierto(g, '2026-11-06', 11) === false, 'viernes 11 am todavía no abre');
  assert(a.googleAbierto(g, '2026-11-08', 15) === false, 'domingo está cerrado');
  assert(a.googleAbierto(g, '2026-11-07', 24.5) === true, 'sábado 12:30 am (cierra domingo 1 am)');
  assert(a.googleAbierto({ periodos: [{ open: { day: 0, hour: 0, minute: 0 } }] }, '2026-11-08', 3) === true, '24 horas');
  assert(a.googleAbierto({}, '2026-11-06', 20) === null, 'sin horario no adivina');
});

test('31.2 · en el plan avisa si Google dice cerrado (a esa hora o para siempre); la ficha muestra "Según Google"', () => {
  const a = makeApp(COM); const v = a.cat().find(x => x.n === 'La Bonvi · Polanco');
  a._g = { [v.id]: { estado: 'OPERATIONAL', periodos: PER, horario: ['lunes: 13:00–1:00'], precio: [300, 800], rating: 4.9, resenas: 8415, maps: 'https://maps.google.com/?cid=1' } };
  assert(a.googleAviso(v, '2026-11-06', 20) === '', 'avisa estando abierto');
  assert(/a esa hora está cerrado/.test(a.googleAviso(v, '2026-11-08', 15)), 'no avisa en domingo');
  a._g[v.id].estado = 'CLOSED_PERMANENTLY';
  assert(/cerró de forma permanente/.test(a.googleAviso(v, '2026-11-06', 20)), 'no avisa del cierre');
  a._g[v.id].estado = 'OPERATIONAL';
  a.setState({ view: 'detail', detailId: v.id });
  const d = a.renderVals().detail;
  assert(d.g.gHay && d.g.gPrecio === '$300–$800 por persona' && /4\.9/.test(d.g.gRating), JSON.stringify(d.g));
});

test('31.3 · la llave y las búsquedas quedan cerradas a CDMX (lib/places.py y api/lugar.py)', () => {
  const fs = require('fs'), path = require('path');
  const lib = fs.readFileSync(path.join(__dirname, '..', 'lib', 'places.py'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api', 'lugar.py'), 'utf8');
  assert(/locationRestriction/.test(lib) && /def en_cdmx/.test(lib) && /fuera de CDMX/.test(lib), 'sin candado de CDMX');
  assert(/G\.get\(i\)/.test(api) && /no es del catálogo/.test(api), 'la API consulta ids que no son del catálogo');
  assert(!/AIza[0-9A-Za-z_-]{20,}/.test(lib + api + fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')), 'hay una llave escrita en el código');
});

section('32 · Lugares de Google en vivo para armar el plan');

// Lunes a domingo 13:00–23:00 (Google: día 0 = domingo).
const PER7 = [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, hour: 13, minute: 0 }, close: { day: d, hour: 23, minute: 0 } }));
const gp = (pid, n, lat, lng, extra) => Object.assign({ pid, n, lat, lng, tipo: 'japanese_restaurant', types: ['japanese_restaurant', 'restaurant', 'food'],
  precio: [300, 600], rating: 4.6, resenas: 900, periodos: PER7, horario: ['lunes: 13:00–23:00'], addr: 'Calle 1, Roma Nte., 06700 Ciudad de México, CDMX', maps: 'https://maps.google.com/?cid=9' }, extra || {});

test('32.1 · un lugar de Google se vuelve lugar de SOBRES: zona, horario real, precio alto, cocina y "De Google Maps"', () => {
  const a = makeApp(COM);
  const v = a.gToVenue(gp('ChIJ_prueba-1', 'Sushi Prueba', 19.4185, -99.1605), { tipo: 'restaurante', cocina: 'japonesa', zonas: 'roma' });
  assert(v.id === 'gp-ChIJ_prueba-1' && v.cat === 'Restaurante' && v.z === 'roma', JSON.stringify([v.id, v.cat, v.z]));
  assert(v.oh[0] === 13 && v.oh[1] === 23 && !v.horaEstimada, 'horario: ' + v.oh);
  assert(v.pp === 600 && v.pEstado === 'estimado' && /Google Maps/.test(v.pCanasta), 'precio: ' + v.pp + ' ' + v.pEstado);
  assert(a.tiposCocina(v).includes('japonesa'), 'cocina: ' + v.cocina);
  assert(v.deGoogle && v.src === 'Google Maps (en vivo)' && v.addr === 'Calle 1, Roma Nte.', v.addr);
  assert(a.googleDe(v) && a.googleBloque(v).gHay, 'la ficha no tiene "Según Google"');
  const bar = a.gToVenue(gp('ChIJbar', 'Bar Prueba', 19.4185, -99.1605, { tipo: 'bar', types: ['bar', 'point_of_interest'] }), { tipo: 'bar', zonas: 'roma' });
  assert(bar.cat === 'Bar' && bar.aptoFamilia === 'no', bar.cat + ' ' + bar.aptoFamilia);
  assert(a.gToVenue(gp('ChIJx', 'Hotel', 19.41, -99.16, { tipo: 'lodging', types: ['lodging'] }), null) === null, 'un hotel no es lugar');
});

test('32.2 · no se repite lo que ya está en el catálogo (mismo nombre a unos metros)', () => {
  const a = makeApp(COM);
  const c = a.cat().find(v => v.n === 'Contramar');
  const n = a.sumaGoogle([gp('ChIJdup', 'Contramar', c.lat + 0.0005, c.lng), gp('ChIJnuevo', 'Sushi Nuevo', 19.4185, -99.1605)], { tipo: 'restaurante', zonas: 'roma' });
  assert(n.length === 1 && n[0].n === 'Sushi Nuevo', n.map(v => v.n));
  assert(a.cat().some(v => v.id === 'gp-ChIJnuevo'), 'no entró al catálogo de esta visita');
  assert(a.sumaGoogle([gp('ChIJnuevo', 'Sushi Nuevo', 19.4185, -99.1605)], null).length === 0, 'se agregó dos veces');
});

test('32.3 · el motor arma con ellos: japonesa en Roma con $300–600 ya no se queda sin japonés', () => {
  const st = Object.assign({}, COM, { budget: 'b600', cocinas: ['japonesa'] });
  const a = makeApp(st, { dseed: 3, rseed: 5 });
  a.sumaGoogle([1, 2, 3, 4, 5].map(i => gp('ChIJjp' + i, 'Sushi Barrio ' + i, 19.419 + i * 0.001, -99.161 + i * 0.001, { precio: [200, 400] })), { tipo: 'restaurante', cocina: 'japonesa', zonas: 'roma' });
  a.runSearch({ nueva: true });
  const pls = a.state.results.plans || [];
  const com = pls.flatMap(pl => pl.stops.filter(v => a.esComidaFiltrable(v)));
  assert(com.length && com.every(v => a.tiposCocina(v).includes('japonesa')), com.map(v => v.n).join(', '));
  assert(com.some(v => v.deGoogle), 'no usó ninguno de Google: ' + com.map(v => v.n).join(', '));
});

test('32.4 · qué se le pide a Google según lo elegido (máximo 3 búsquedas, sólo tipos permitidos)', () => {
  const a = makeApp(Object.assign({}, COM, { vibes: ['foodie', 'nightlife'], cocinas: ['japonesa', 'mariscos', 'italiana'], zonesSel: ['roma', 'condesa'] }));
  const b = a.googleBusquedas();
  assert(b.length === 3 && b[0].cocina === 'japonesa' && b[1].cocina === 'mariscos' && b[2].tipo === 'bar', JSON.stringify(b));
  assert(b.every(x => x.zonas === 'roma,condesa'), 'zonas: ' + b[0].zonas);
  const f = makeApp(Object.assign({}, COM, { who: 'familia', vibes: ['familiar'] }));
  assert(!f.googleBusquedas().some(x => x.tipo === 'bar' || x.tipo === 'antro'), 'en familia pide bares');
});

test('32.5 · un lugar de Google viaja en el enlace compartido (place_id con "_" y "-")', () => {
  const a = makeApp(COM);
  const id = 'gp-ChIJ_ab-CD_ef12';
  assert(a.largaId(a.cortaId(id)) === id, a.cortaId(id) + ' → ' + a.largaId(a.cortaId(id)));
  assert(!/[~_.!]/.test(a.cortaId(id)), 'el id corto trae un separador: ' + a.cortaId(id));
});

section('33 · Hotspots y nada básico (feedback del 4 nov 2026)');

test('33.1 · se eligen máximo 2 ambientes (con 3 "se vuelve loquito")', () => {
  const a = makeApp(Object.assign({}, COM, { vibes: [] }));
  const pick = l => a.renderVals().vibeTiles.find(t => t.label === l).pick();
  pick('Comer rico'); pick('Romántico'); pick('Creativo');
  assert(a.state.vibes.length === 2 && a.state.vibes.includes('creativo'), 'quedaron: ' + a.state.vibes);
});

test('33.2 · "Comer rico + Romántico" nunca da La Casa de Toño ni cadenas, y con presupuesto para ellos, al menos 40% son hotspots', () => {
  // Con $600–1,000 se revisa que no haya nada básico; con $1,000–1,999 (donde caben
  // los hotspots con su precio alto) además que la mayoría sean hotspots.
  ['juarez', 'coyoacan', 'roma', 'polanco', 'condesa'].forEach(z => [1, 2, 3].forEach(sd => ['b1000', 'b1999'].forEach(bud => {
    const a = makeApp(Object.assign({}, COM, { who: 'date', groupSize: 2, zone: z, zonesSel: [z], budget: bud, vibes: ['foodie', 'romántico'] }), { dseed: sd, rseed: sd * 3 + 1 });
    a.runSearch({ nueva: true });
    const st = (a.state.results.plans || []).flatMap(pl => pl.stops);
    const mal = st.filter(v => a.esCadenaCasual(v) || /casa de to[ñn]o|garat/i.test(v.n));
    assert(!mal.length, z + ' semilla ' + sd + ': ' + mal.map(v => v.n));
    const com = st.filter(v => a.FOOD.includes(v.cat) || a.DRINK.includes(v.cat));
    const hot = com.filter(v => v.hot);
    if (bud === 'b1999' && ['roma', 'polanco', 'condesa'].includes(z)) assert(hot.length * 5 >= com.length * 2, z + ' semilla ' + sd + ': sólo ' + hot.length + ' de ' + com.length + ' son hotspots: ' + com.map(v => v.n));
  })));
});

test('33.3 · "Creativo" no propone obras de teatro (ver una obra no es crear)', () => {
  [1, 2, 3, 4].forEach(sd => {
    const a = makeApp(Object.assign({}, COM, { zone: 'juarez', zonesSel: ['juarez'], vibes: ['foodie', 'creativo'] }), { dseed: sd, rseed: sd + 9 });
    a.runSearch({ nueva: true });
    const teatro = (a.state.results.plans || []).flatMap(pl => pl.stops).filter(v => v.cat === 'Teatro' || /milagro/i.test(v.n));
    assert(!teatro.length, 'semilla ' + sd + ': ' + teatro.map(v => v.n));
  });
});

test('33.4 · la lista de hotspots trae fuente y fecha, sólo ids del catálogo, y avisa cuando toca actualizarla', () => {
  const a = makeApp(COM); const H = a._win.SOBRES_HOTSPOTS;
  assert(H && Object.keys(H.ids).length > 120, 'pocos hotspots');
  Object.values(H.fuentes).forEach(f => assert(/^https?:\/\//.test(f.url) && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha), 'fuente sin url o fecha: ' + f.n));
  const ids = new Set(a.cat().map(v => v.id));
  Object.entries(H.ids).forEach(([id, h]) => { assert(ids.has(id), 'id que no existe: ' + id); h.f.forEach(f => assert(H.fuentes[f], 'fuente desconocida ' + f)); });
  ['Quintonil', 'Pujol', 'Handshake Speakeasy', 'Bar Mauro', 'Contramar'].forEach(n => assert(a.cat().find(v => v.n === n).hot >= 2, n + ' no es hotspot'));
  assert(!a.cat().find(v => v.id === 'os-n9965047017').hot, '"Hunan" de Satélite quedó como el Hunan de Marco Beteta');
  const dias = (Date.parse(a.todayISO()) - Date.parse(H.actualizado)) / 864e5;
  if (dias > 35) console.log('    ⚠ Los hotspots tienen ' + Math.round(dias) + ' días: toca actualizarlos (reportes/hotspots/build_hotspots.py).');
});

test('33.5 · Grulla (Nápoles 76, Juárez) queda en Juárez, no en la colonia Nápoles', () => {
  const a = makeApp(COM); const g = a.cat().find(v => v.id === 'pq-60e50ecd9c');
  assert(g.z === 'juarez' && !g.coordAprox && Math.abs(g.lat - 19.4253) < 0.002, g.z + ' ' + g.lat);
});

// ── 34 · Conciertos de noviembre 2026 (5 nov 2026) ──────────────────────────
section('34 · Conciertos de noviembre 2026');
const VIGENTES_NOV = () => makeApp(COM).todayISO() <= '2026-11-29';

test('34.1 · cada concierto trae fuente con URL y fecha, días de noviembre, y hora/precio "por confirmar" si la nota no los da', () => {
  const E = makeApp(COM)._win.SOBRES_EVENTOS.eventos.filter(e => e.concierto && (/ en concierto · /.test(e.n) || /Corona Capital|Flow Fest/.test(e.n)));
  assert(E.length >= 70, 'sólo ' + E.length + ' conciertos');
  E.forEach(e => {
    assert(/^https:\/\//.test(e.url) && /^2026-1[01]-\d{2}$/.test(e.fecha), e.n + ': sin fuente o fecha');
    const dias = e.fechas.solo || [e.fechas.desde, e.fechas.hasta];
    dias.forEach(d => assert(/^2026-11-(0[5-9]|[12]\d|30)$/.test(d), e.n + ': fecha fuera de noviembre ' + d));
    assert(e.horaEstimada && /por confirmar/.test(e.hrs), e.n + ': inventa la hora');
    if (!/Corona Capital|Flow Fest/.test(e.n)) assert(e.estado === 'por_confirmar' && e.precio.max == null, e.n + ': inventa el precio');
    assert(/boleto/i.test(e.nota || ''), e.n + ': no avisa que se necesita boleto');
  });
  // Los que no coinciden en las tres agendas no entran.
  ['Niña Pastori', 'XG en', 'Majo Aguilar', 'Jerry Rivera', 'Helado Negro'].forEach(n => assert(!E.some(e => e.n.indexOf(n) === 0), n + ' entró sin confirmar'));
  // Morat 17 nov: entró el 5 nov (Milenio, ClaroSports y boleteras).
  assert(E.find(e => /^Morat/.test(e.n)).fechas.solo.includes('2026-11-17'), 'falta Morat 17 nov');
});

// Regresión: un evento con hora "por confirmar" entraba a cualquier hora
// (Dillom, concierto de noche, salía a las 10 am).
test('34.2 · un concierto con hora por confirmar nunca entra antes de su ventana (de noche)', () => {
  const malos = [];
  // Caso real (5 nov): solo, Roma, "mañana", Comer rico + Fiesta → Dillom a las 10 am.
  ['roma', 'polanco', 'centro', 'delvalle'].forEach(z => ['manana', 'finde'].forEach(when => [1, 2, 4].forEach(g => [['foodie', 'nightlife'], ['social']].forEach(vb => {
    const a = makeApp(Object.assign({}, COM, { who: 'solo', groupSize: g, zone: z, zonesSel: [z], when, vibes: vb }), { dseed: 77 });
    a.runSearch({ nueva: true });
    (a.engine(0).plans || []).forEach(p => p.stops.forEach((v, i) => { if (v.evento && v.oh && p.times[i] < v.oh[0]) malos.push(z + '/' + when + ': ' + v.n + ' a las ' + p.times[i]); }));
  }))));
  assert(!malos.length, malos.slice(0, 4).join(' | '));
});

test('34.3 · en su fecha los conciertos grandes sí salen, pero no se comen todas las opciones', () => {
  if (!VIGENTES_NOV()) { console.log('    ⚠ Ya pasó noviembre 2026: los conciertos vencieron (reportes/eventos/build_eventos.js).'); return; }
  let soda = 0;
  [1, 2, 3, 4, 5, 6].forEach(sd => {
    const a = makeApp(Object.assign({}, COM, { who: 'amigos', groupSize: 4, zone: 'centro', zonesSel: ['centro'], when: 'fecha', customDate: '2026-11-23', vibes: ['nightlife', 'social'] }), { dseed: sd, rseed: sd * 7 + 1 });
    a.runSearch({ nueva: true });
    const ps = a.state.results.plans || [];
    if (ps.some(p => p.stops.some(v => /^Soda Stereo/.test(v.n)))) soda++;
    assert(ps.filter(p => p.stops.some(v => v.concierto)).length <= 1, 'semilla ' + sd + ': más de una opción con concierto');
  });
  assert(soda >= 1, 'Soda Stereo (23 nov, Palacio de los Deportes) nunca salió en el Centro');
  // Fuera de su fecha no aparece.
  const a = makeApp(Object.assign({}, COM, { who: 'amigos', groupSize: 4, zone: 'centro', zonesSel: ['centro'], when: 'fecha', customDate: '2026-11-24', vibes: ['nightlife', 'social'] }), { dseed: 1 });
  a.runSearch({ nueva: true });
  assert(!(a.state.results.plans || []).some(p => p.stops.some(v => /^Soda Stereo|^Karol G/.test(v.n))), 'propuso un concierto fuera de su fecha');
});

test('34.4 · un concierto no entra a un plan romántico + comer rico', () => {
  [1, 2, 3].forEach(sd => {
    const a = makeApp(Object.assign({}, COM, { who: 'date', groupSize: 2, zone: 'polanco', zonesSel: ['polanco'], when: 'fecha', customDate: '2026-11-25', vibes: ['foodie', 'romántico'] }), { dseed: sd });
    a.runSearch({ nueva: true });
    const c = (a.state.results.plans || []).flatMap(p => p.stops).filter(v => v.concierto);
    assert(!c.length, c.map(v => v.n).join(', '));
  });
});

// ── 35 · Clásicos de las guías que faltaban (5 nov 2026) ─────────────────────
section('35 · Clásicos de las guías que faltaban');
const CLASICOS = ['Almara', 'Cachava', 'Chapulín', 'Çuina', 'Dante Brasa y Fuego', 'Ehden · Centro Histórico', 'Ehden · Roma Norte', 'Gruta Ehden · Florida',
  'Grana Sabores de Origen', 'La Cabrera · Roma Norte', 'La Cocina del Bizco', 'Marea · Restaurante de Mar', 'Rocasal', 'Somsaa', 'The Lamb',
  'Tierra Adentro Cocina', 'Torre de Castilla', 'Vega', 'Costa Guadiana', 'Danubio', 'Cantina del Bosque'];

test('35.1 · cada clásico nuevo trae fuente con URL, fecha de consulta, ubicación exacta (no aproximada) y queda como hotspot', () => {
  const a = makeApp(COM); const C = a.cat();
  CLASICOS.forEach(n => {
    const v = C.find(x => x.n === n); assert(v, n + ' no está en el catálogo');
    assert(/^https:\/\//.test(v.pUrl || v.url || '') || /^https:\/\//.test((a._win.SOBRES_INVESTIGADOS.lugares.find(r => r.n === n) || {}).url || ''), n + ': sin URL');
    const r = a._win.SOBRES_INVESTIGADOS.lugares.find(x => x.n === n);
    assert(r.consultado === '2026-11-05' && !r.coordAprox && r.recomendable !== false, n + ': ' + JSON.stringify({ c: r.consultado, aprox: r.coordAprox, rec: r.recomendable }));
    assert(v.hot >= 2, n + ' no quedó como hotspot');
  });
  // Lo que no se pudo confirmar no entra: Arturo's (tres direcciones distintas en sus fuentes) y los que
  // sólo se ubican a nivel de calle (Gruta Ehden Polanco, Romina, Brutal, Sushi Iwashi) — 5 nov 2026.
  assert(!C.some(v => /^arturo.?s$/i.test(v.n) || ['Gruta Ehden · Polanco', 'Romina', 'Brutal Vinata de Barrio', 'Sushi Iwashi'].includes(v.n)), 'entró un lugar sin ubicación exacta');
});

test('35.2 · los clásicos que ya estaban con otro nombre quedan marcados, sin confundir sucursales', () => {
  const C = makeApp(COM).cat();
  ['Tacos del Valle', 'Deigo Cocina Tradicional Japonesa', 'Museo Mexicano del Diseño (MUMEDI)', 'Cantina del Bosque'].forEach(n => {
    const v = C.find(x => x.n === n); assert(v && v.hot >= 1, n + ' no quedó como hotspot');
  });
  // "Sushi Iwashi" (Polanco, MB100) no es "Iwashi Lomas" (que sí es hotspot, pero por The Happening); "Deigo" es el original, no el de ramen.
  const H = makeApp(COM)._win.SOBRES_HOTSPOTS.ids, il = C.find(x => x.n === 'Iwashi Lomas');
  assert(!H[il.id] || !H[il.id].f.some(f => /^mb100/.test(f)), 'Iwashi Lomas quedó como el Sushi Iwashi de Beteta');
  assert(!C.find(x => x.n === 'Deigo Ramen').hot, 'Deigo Ramen quedó como el Deigo clásico');
});

// ── 36 · Hotspots de MB100 2026, Quién, The Happening y eventos de noviembre (5 nov 2026) ──
section('36 · Hotspots del momento y eventos de noviembre');

test('36.1 · las listas nuevas marcan hotspots sólo de CDMX y sin pegar sucursales equivocadas', () => {
  const a = makeApp(COM), H = a._win.SOBRES_HOTSPOTS, C = a.cat();
  ['mb100_26', 'quien_jul26', 'hap_nov26'].forEach(f => assert(H.fuentes[f] && /^https:/.test(H.fuentes[f].url), 'falta la fuente ' + f));
  ['Jowong', 'Issi', 'Trillo', 'La Bellezza', 'Los Super Elegantes', 'Oscuro Ramen', 'Sona · sala de escucha'].forEach(n => {
    const v = C.find(x => x.n === n); assert(v && v.hot >= 2, n + ' no quedó como hotspot'); });
  ['Siembra Tortillería', 'Siembra terraza'].forEach(n => { const v = C.find(x => x.n === n); assert(!H.ids[v.id] || !H.ids[v.id].f.includes('mb100_26'), n + ' quedó como "Siembra Comedor"'); });
});

// Regresión: el filtro de acervos ("archivo", "tienda del museo") tumbaba al restaurante Archivo, y
// las librerías sólo pasaban con nombre de una lista fija (99 Records quedaba fuera).
test('36.2 · 99 Records (vinilos) y el restaurante Archivo sí se pueden proponer; un archivo histórico no', () => {
  const a = makeApp(COM), C = a.cat();
  ['99 Records · Roma Norte', '99 Records · Condesa', 'Archivo'].forEach(n => { const v = C.find(x => x.n === n); assert(v && a.esRecomendable(v), n + ' no se propone'); });
  const acervo = C.find(x => /^Biblioteca del Archivo Nacional/.test(x.n)); assert(!a.esRecomendable(acervo), 'un acervo entró como plan');
});

test('36.3 · eventos de noviembre: lo verificado entra, lo que ya pasó o no se confirma no', () => {
  const E = makeApp(COM)._win.SOBRES_EVENTOS.eventos;
  ['Feria del Libro Comestible', 'Brindis de Altura · Bajel', 'Lotti × Le Chêne', 'Bienal de São Paulo', 'Cena por las Chinampas', 'Kati Horna', 'NFL: 49ers vs Vikings', 'Barbie Run']
    .forEach(n => { const e = E.find(x => x.n.indexOf(n) >= 0); assert(e && /^https:/.test(e.url) && e.fecha, n + ': falta o sin fuente'); });
  // Sin fuente que lo confirme, ya pasó, o sin dirección exacta.
  ['Cosmo', 'Snoopy', 'Festival Día de Muertos', 'Trajinera del Chef', 'Materia', 'Open House', 'Ladurée'].forEach(n => assert(!E.some(x => x.n.indexOf(n) >= 0), n + ' no debía entrar'));
  E.filter(e => e.consultado === '2026-11-05').forEach(e => assert((e.fechas.hasta || '9') >= '2026-11-05', e.n + ' ya pasó'));
  const nfl = E.find(x => /^NFL/.test(x.n)); assert(nfl.oh[0] > 19 && nfl.oh[0] < 19.5 && !nfl.horaEstimada, 'la NFL es a las 19:20');
});

// ── 37 · Más opciones (5 nov 2026): "me da sólo 3 restaurantes y luego repite" ──
section('37 · Más opciones con tus filtros, sin presupuesto y cocinas asiáticas');
const ASIA = { who: 'date', groupSize: 2, zone: 'roma', zonesSel: ['roma', 'romasur', 'condesa'], vibes: ['foodie'], when: 'fecha', customDate: '2026-11-07',
  planFrom: 13, planTo: 17, budget: 'b1999', budgetCustom: null, cocinas: ['asiatica'], transport: 'coche' };

test('37.1 · existe "Sin presupuesto": sin tope ni piso, y deja entrar lo de $2,000', () => {
  const a = makeApp(Object.assign({}, ASIA, { budget: 'any' }));
  assert(a.BUD.some(b => b[0] === 'any' && b[1] === 'Sin presupuesto'), 'falta la opción');
  assert(a.budgetMax() >= 99999 && a.budgetMin() === 0 && /sin presupuesto/.test(a.budLabel()), a.budgetMax() + ' ' + a.budgetMin() + ' ' + a.budLabel());
  const g = a.cat().find(v => v.n === 'Galanga Thai House'); assert(a.budgetOk(g), 'Galanga ($2,000) no entra sin presupuesto');
  const b = makeApp(ASIA); assert(!b.budgetOk(b.cat().find(v => v.n === 'Galanga Thai House')), 'con $1,000–1,999 Galanga ($2,000) no debe entrar');
});

// Regresión: El Mékông, Makan, Warung Makan y Pin-tó Thai no contaban como "China y otras asiáticas".
test('37.2 · "China y otras asiáticas" reconoce sudeste asiático, Indonesia, Singapur y nombres sin ficha de cocina', () => {
  const a = makeApp(ASIA), C = a.cat();
  ['El Mékông', 'Makan', 'Warung Makan', 'Pin-tó Thai', 'Somsaa', 'Biwon'].forEach(n => { const v = C.find(x => x.n === n); assert(v && a.tiposCocina(v).includes('asiatica'), n + ': ' + (v && a.tiposCocina(v))); });
  ['Kaito Del Valle', 'Oscuro Ramen'].forEach(n => { const v = C.find(x => x.n === n); assert(!a.tiposCocina(v).includes('asiatica'), n + ' es japonés, no "otras asiáticas"'); });
});

// Regresión: Biwon (Florencia 20, Juárez) caía en la zona Roma por cercanía y salía al pedir Roma.
test('37.3 · la colonia de la ficha manda entre Juárez, Roma y Condesa (sin tocar "Naucalpan de Juárez")', () => {
  const C = makeApp(ASIA).cat();
  ['Biwon', 'La Bellezza'].forEach(n => assert(C.find(v => v.n === n).z === 'juarez', n + ' no quedó en Juárez'));
  const sat = C.find(v => v.id === 'xl-R0075'); assert(sat.z === 'satelite', 'Cantina La No. 20 Satélite se movió: ' + sat.z);
});

test('37.4 · debajo de las 3 opciones salen TODOS los que cumplen: zona, cocina, horario, sin repetir los del plan', () => {
  const a = makeApp(ASIA, { dseed: 1, rseed: 5 }); a.runSearch({ nueva: true });
  const L = a.listaFiltros(), enPlan = new Set(a.state.results.plans.flatMap(p => p.stops.map(v => v.id)));
  assert(L.length >= 4, 'sólo ' + L.length + ' en la lista');
  L.forEach(v => { assert(['roma', 'romasur', 'condesa'].includes(v.z), v.n + ' fuera de zona: ' + v.z); assert(a.tiposCocina(v).includes('asiatica'), v.n + ' no es asiático');
    assert(!enPlan.has(v.id), v.n + ' ya está en un plan'); });
  const b = makeApp(Object.assign({}, ASIA, { budget: 'any' }), { dseed: 1, rseed: 5 }); b.runSearch({ nueva: true });
  assert(b.listaFiltros().length > L.length, 'sin presupuesto no amplía la lista');
  assert(/listaTitulo/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8')), 'falta la lista en la plantilla');
});

test('37.5 · lo de Google en vivo entra a la lista sólo si está en tus zonas', () => {
  const a = makeApp(ASIA, { dseed: 1 }); a.runSearch({ nueva: true });
  const sab = [{ open: { day: 6, hour: 12, minute: 0 }, close: { day: 6, hour: 22, minute: 0 } }];
  const g = (pid, n, lat, lng, tipo) => ({ pid, n, lat, lng, tipo, types: [tipo, 'restaurant'], precio: [200, 400], rating: 4.6, resenas: 800, periodos: sab, horario: [], addr: '', maps: '' });
  a.sumaGoogle([g('P1', 'Pho Mama San', 19.4155, -99.1596, 'vietnamese_restaurant'), g('P2', 'Min Sok Chon', 19.4262, -99.1662, 'korean_restaurant')], { tipo: 'restaurante', cocina: 'asiatica' });
  const n = a.listaFiltros().map(v => v.n);
  assert(n.includes('Pho Mama San'), 'Pho Mama San (Roma Norte) no entró: ' + n.join(', '));
  assert(!n.includes('Min Sok Chon'), 'Min Sok Chon (Juárez) entró pidiendo Roma/Condesa');
});

// ── 38 · A/B "paso 1 fácil" (?v=facil, 8 nov 2026) ───────────────────────────
section('38 · ?v=facil: 3 pasos (paso 1 de un toque, ← Atrás en 2 y 3)');
const conEv = a => { const L = []; a.ev = (n, p) => L.push([n, Object.assign({ version: a.versionAB() }, p || {})]); return L; };

test('38.1 · sin parámetro no sale la versión fácil (zona por defecto: el grupo Roma · Condesa)', () => {
  const a = makeApp({}); const u = a.facilVals('home', () => {});
  assert(!a.state.facil && !u.facilP1 && !u.facilP2 && a.versionAB() === 'actual', 'la actual cambió');
  assert(a.state.zonesSel.join() === 'roma,romasur,condesa' && a.zonesLabel() === 'Roma · Condesa', 'zona por defecto: ' + a.state.zonesSel);
  const b = makeApp({}, { search: '?v=rapido' }); assert(b.versionAB() === 'rapido' && !b.state.facil, 'v=rapido cambió');
});

test('38.2 · ?v=facil se activa, preselecciona Roma · Condesa y Juárez · Centro y se queda toda la sesión', () => {
  const a = makeApp({}, { search: '?v=facil' });
  assert(a.state.facil && a.state.facilPaso === 1 && a.versionAB() === 'facil', 'no se activó');
  assert(a.state.zonesSel.join() === 'roma,romasur,condesa,juarez,centro' && a.zonesLabel() === 'Roma · Condesa y Juárez · Centro', 'zonas: ' + a.state.zonesSel);
  assert(a._win.sessionStorage.getItem('sobres_v') === 'facil', 'no se guardó en la sesión');
  const b = makeApp({}, { search: '?utm_source=meta', session: { sobres_v: 'facil' } });
  assert(b.state.facil, 'al navegar (sin ?v) se perdió la versión fácil');
  const c = makeApp({}, { search: '?v=facil&zona=coyoacan' }); assert(c.state.zonesSel.join() === 'coyoacan,sanangel,cu', 'pisó la zona del anuncio: ' + c.state.zonesSel);
});

test('38.3 · paso 1: 6 opciones (Romántico en vez de Aventura), avanza solo; "Cenar rico" pide el tipo de comida y ése avanza', () => {
  const a = makeApp({}, { search: '?v=facil' }); const L = conEv(a);
  const u = a.facilVals('home', () => {}); assert(u.facilP1 && u.facilOpts.length === 6, 'opciones: ' + u.facilOpts.length);
  assert(u.facilOpts.map(o => o.label).join('|') === 'Cenar rico|Noche y fiesta|Tranqui|Cultural|Romántico|En familia', u.facilOpts.map(o => o.label));
  u.facilOpts[4].pick();   // Romántico: avanza solo y van en pareja
  assert(a.state.facilPaso === 2 && a.state.vibes.join() === 'romántico' && a.state.who === 'date', JSON.stringify([a.state.facilPaso, a.state.vibes, a.state.who]));
  a.facilVals('home', () => {}).facilAtras(); assert(a.state.facilPaso === 1, 'el paso 2 no regresa al 1');
  a.facilVals('home', () => {}).facilOpts[0].pick();   // Cenar rico: NO avanza, sale el tipo de comida
  let v = a.facilVals('home', () => {});
  assert(a.state.facilPaso === 1 && v.facilCocinaOn && v.facilCocinaOpts[0].label === 'Todo tipo' && a.state.who === 'amigos', 'Cenar rico no mostró el tipo de comida');
  v.facilCocinaOpts.find(o => o.label === 'China y otras asiáticas').pick();
  assert(a.state.facilPaso === 2 && a.state.cocinas.join() === 'asiatica', 'el tipo de comida no avanzó: ' + JSON.stringify([a.state.facilPaso, a.state.cocinas]));
  const e = L.filter(x => x[0] === 'paso_1_elegido'); assert(e.length === 1 && e[0][1].opcion === 'romantico' && e[0][1].version === 'facil', JSON.stringify(e));
});

test('38.3b · pasos 2 y 3: Siguiente, ← Atrás y "Ver mis 3 planes" arma los planes', () => {
  const a = makeApp({}, { search: '?v=facil' }); a.ev = () => {};
  a.facilVals('home', () => {}).facilOpts[1].pick(); assert(a.facilVals('home', () => {}).facilP2, 'no llegó al paso 2');
  a.facilVals('home', () => {}).facilSiguiente(); assert(a.state.facilPaso === 3 && a.facilVals('home', () => {}).facilP3, 'no llegó al paso 3');
  a.facilVals('home', () => {}).facilAtras(); assert(a.state.facilPaso === 2, 'el paso 3 no regresa al 2');
  a.facilVals('home', () => {}).facilSiguiente(); let lanzo = false; a.facilVals('home', () => { lanzo = true; }).facilGo();
  assert(lanzo, '"Ver mis 3 planes" no armó los planes');
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  ['Arma tu próxima salida en 3 pasos', 'id="armar-facil-donde"', 'id="armar-facil-quien"', 'Ver mis 3 planes', 'Regresar al paso 1', 'Regresar al paso 2']
    .forEach(t => assert(html.indexOf(t) >= 0, 'falta en la plantilla: ' + t));
});

test('38.4 · en la actual, paso_1_elegido sale con el primer chip o "Siguiente", y todos los eventos llevan version', () => {
  const a = makeApp({}); const L = []; a._win.gtag = (t, n, p) => L.push([n, p]);
  a.evPaso1('nightlife'); a.evPaso1('siguiente'); a.ev('armar_planes', { vibras: 'nightlife' });
  const e = L.filter(x => x[0] === 'paso_1_elegido');
  assert(e.length === 1 && e[0][1].opcion === 'nightlife' && e[0][1].version === 'actual', JSON.stringify(L));
  assert(L.every(x => x[1].version === 'actual'), 'falta version en algún evento');
  const q = makeApp({}, { search: '?v=facil&utm_source=qa_claude' }); const M = []; q._win.gtag = (t, n, p) => M.push(n);
  q.ev('armar_planes', {}); assert(!M.length, 'QA mandó eventos a GA4');
});

test('38.5 · con los valores por defecto salen 3 planes completos (sin planes de 1 parada) en casi todas las opciones', () => {
  let malos = 0, tot = 0;
  [1, 2, 3, 4].forEach(d => ['cenar', 'fiesta', 'tranqui', 'cultural', 'romantico', 'familia'].forEach(k => { tot++;
    const a = makeApp({}, { search: '?v=facil', dseed: d }); a.ev = () => {};
    const i = a.FACIL().findIndex(f => f[0] === k); a.facilVals('home', () => {}).facilOpts[i].pick();
    if (k === 'cenar') a.facilVals('home', () => {}).facilCocinaOpts[0].pick();   // "Todo tipo"
    const r = a.runSearch({ nueva: true }), ps = (r && r.plans) || [];
    if (ps.length < 3 || ps.some(p => p.stops.length === 1)) malos++; }));
  assert(malos <= 1, malos + ' de ' + tot + ' búsquedas con menos de 3 planes o planes de 1 parada');
  // Y la versión actual NO cambia su motor: "Comer rico" sin ?v sigue pudiendo dar una cena sola.
  const b = makeApp({ vibes: ['foodie'] }, { dseed: 1 }); b.ev = () => {}; const rb = b.runSearch({ nueva: true });
  assert(!rb.plans.some(p => p.stops.some(v => ['Bar', 'Cantina', 'Speakeasy'].includes(v.cat))), 'la actual metió bares en "Comer rico"');
});

// ── 39 · Zonas en 8 grupos, presupuesto nuevo y logo (8 nov 2026) ─────────────
section('39 · Zonas en grupos, presupuesto y logo');

test('39.1 · las zonas se eligen en 8 grupos y cada grupo elige todas sus zonas', () => {
  const a = makeApp({});
  const Z = a.renderVals().zoneOpts.map(o => o.label);
  assert(Z.join('|') === 'Toda la ciudad|Roma · Condesa|Polanco · Chapultepec|Juárez · Centro|Del Valle · Nápoles|Coyoacán · Sur|Santa Fe · Poniente|Lomas · Satélite|Xochimilco', Z.join('|'));
  const z = n => a.renderVals().zoneOpts.find(o => o.label === n);
  z('Roma · Condesa').pick(); assert(a.state.zone === 'all', 'Roma · Condesa no se quita');
  z('Coyoacán · Sur').pick(); assert(a.zoneList().join() === 'coyoacan,sanangel,cu' && a.zonesLabel() === 'Coyoacán · Sur', a.zoneList());
  z('Lomas · Satélite').pick(); assert(a.zonesLabel() === 'Coyoacán · Sur y Lomas · Satélite', a.zonesLabel());
  // Un enlace viejo con una sola zona sigue funcionando y se nombra por su zona.
  const v = makeApp({ zone: 'roma', zonesSel: ['roma'] }); assert(v.zonesLabel() === 'Roma Norte' && v.renderVals().zoneOpts.find(o => o.label === 'Roma · Condesa').pressed === 'true', v.zonesLabel());
});

test('39.2 · presupuesto: Gratis, Hasta $600, $600–1,000, $1,000–1,999, $2,000+ y Sin presupuesto; "Hasta $300" viejo = Hasta $600', () => {
  const a = makeApp({});
  assert(a.renderVals().budgetOpts.map(o => o.label).join('|').replace(/✓ /g, '').replace('Gratis ($0)', 'Gratis') === 'Gratis|Hasta $600|$600–1,000|$1,000–1,999|$2,000+|Sin presupuesto', a.renderVals().budgetOpts.map(o => o.label));
  const b = makeApp({ budget: 'b600' }); assert(b.budgetMax() === 600 && b.budgetMin() === 0, 'Hasta $600 debe ir de $0 a $600');
  const c = makeApp({ budget: 'b300' }); assert(c.budgetMax() === 600 && /600/.test(c.budLabel()), 'un enlace viejo "Hasta $300" quedó sin tope: ' + c.budgetMax());
});

test('39.3 · el logo de SOBRES regresa al principio (paso 1), en las dos versiones', () => {
  const a = makeApp({ paso: 3 }); a.nav('results'); a.renderVals().brandGo();
  assert(a.state.view === 'home' && a.state.paso === 1, 'actual: ' + a.state.view + ' paso ' + a.state.paso);
  const f = makeApp({}, { search: '?v=facil' }); f.ev = () => {}; f.facilVals('home', () => {}).facilOpts[1].pick(); f.facilVals('home', () => {}).facilSiguiente();
  f.renderVals().brandGo(); assert(f.state.facilPaso === 1 && f.state.view === 'home', 'fácil: paso ' + f.state.facilPaso);
});

if (require.main === module) report();
