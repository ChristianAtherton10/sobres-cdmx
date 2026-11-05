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

if (require.main === module) report();
