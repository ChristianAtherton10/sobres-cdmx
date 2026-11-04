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

if (require.main === module) report();
