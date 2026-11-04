// Fase 2 · Que SOBRES entienda al cliente (rama feat/perfil, 4 nov 2026).
// El perfil vive sólo en el navegador (localStorage 'sobres_perfil') y aprende
// de lo que la persona hace: elegir/votar > compartir > guardar > buscar.
const { makeApp, test, assert, section, report } = require('./harness.js');

section('27 · Fase 2: perfil que aprende');

const BASE = { who: 'amigos', groupSize: 4, zone: 'roma', zonesSel: ['roma'], when: 'noche', budget: 'b1000', budgetCustom: null, vibes: ['foodie'] };
const lugar = (app, re) => app.cat().find(v => re.test(v.n));
// Simula una recarga: la app nueva arranca con lo que quedó guardado.
const recarga = (app, st, opts) => makeApp(Object.assign({}, BASE, st || {}), Object.assign({ storage: Object.assign({}, app._store) }, opts || {}));

test('27.1 · elegir pesa más que compartir, compartir más que guardar y guardar más que buscar', () => {
  const app = makeApp(BASE);
  const museo = lugar(app, /^Museo Nacional de Antropolog/), bar = lugar(app, /^Licorería Limantour/),
        cafe = app.cat().find(v => v.cat === 'Café'), helado = app.cat().find(v => v.cat === 'Heladería');
  app.aprende('busqueda');
  app.aprende('guardado', [cafe]);
  app.aprende('compartido', [bar]);
  app.aprende('elegido', [museo], [12]);
  const S = app.perfil().sen.cat;
  assert(S[museo.cat] > S[bar.cat] && S[bar.cat] > S[cafe.cat], 'pesos: ' + JSON.stringify(S));
  assert(!S[helado.cat], 'una búsqueda no inventa categorías');
  const p = app.perfil();
  assert(p.sen.franja.tarde > 0, 'no guardó el horario típico');
  assert(p.sen.who.amigos > 0, 'no guardó con quién sale');
  assert(p.precio.n > 0, 'no guardó el rango de precio');
});

test('27.2 · el perfil sobrevive a una recarga (vive en el navegador)', () => {
  const app = makeApp(BASE);
  app.aprende('elegido', [lugar(app, /^Museo Nacional de Antropolog/)], [12]);
  const app2 = recarga(app);
  assert(app2.perfil().acciones === 1, 'el perfil no se recuperó');
  assert(app2.perfilTiene(), 'tras elegir un plan ya hay perfil');
});

test('27.3 · eligió museo, helado y restaurante vegetariano → "Arma con mis gustos" trae algo cultural y un vegetariano', () => {
  const app = makeApp(BASE);
  const veg = app.cat().filter(v => v.cat === 'Restaurante' && v.z === 'roma' && app.dietaDe(v).length && app.esRecomendable(v));
  assert(veg.length >= 2, 'faltan restaurantes vegetarianos en la Roma para la prueba');
  const museo = app.cat().find(v => v.cat === 'Museo' && v.z === 'roma' && app.esRecomendable(v)) || lugar(app, /^Museo Nacional de Antropolog/);
  const helado = app.cat().find(v => v.cat === 'Heladería' && v.z === 'roma');
  const p = app.perfil(); p.dieta = ['vegetariano']; app.perfilGuarda(p);
  app.aprende('elegido', [museo, helado, veg[0]], [13, 15, 16]);
  [1, 2, 3, 4].forEach(sd => {
    const a2 = recarga(app, {}, { dseed: sd, rseed: sd * 7 + 1 });
    a2.setState(a2.gustosForm());
    assert(a2.state.vibes.includes('cultural'), 'los gustos no marcaron "cultural": ' + a2.state.vibes);
    a2.runSearch({ nueva: true });
    const pls = a2.state.results.plans || [];
    const t = pls.map(pl => pl.stops.map(v => v.n).join(' → ')).join(' | ');
    assert(pls.length === 3, 'semilla ' + sd + ': ' + pls.length + ' opciones');
    assert(pls.some(pl => pl.stops.some(v => a2.esCultural(v))), 'semilla ' + sd + ': ninguna opción cultural: ' + t);
    assert(pls.some(pl => pl.stops.some(v => a2.dietaDe(v).length)), 'semilla ' + sd + ': ningún vegetariano: ' + t);
  });
});

test('27.4 · cada opción explica por qué: "Porque te gustaron los museos y comes vegetariano"', () => {
  const app = makeApp(BASE);
  const museo = lugar(app, /^Museo Nacional de Antropolog/);
  const veg = app.cat().find(v => v.cat === 'Restaurante' && app.dietaDe(v).length);
  const p = app.perfil(); p.dieta = ['vegetariano']; app.perfilGuarda(p);
  app.aprende('elegido', [museo, veg], [12, 15]);
  const txt = app.porQue([museo, veg]);
  assert(/^Porque te gustaron los museos/.test(txt) && /comes vegetariano\.$/.test(txt), 'dijo: ' + txt);
  app.setState({ sinGustos: true });
  assert(app.porQue([museo, veg]) === '', '"Quiero algo diferente" no debe explicar con tus gustos');
});

test('27.5 · a alguien de 35–44 no se le proponen primero antros de universitarios', () => {
  const app = makeApp(BASE);
  const u = app.cat().filter(v => app.publicoDe(v) === '20s');
  assert(u.length > 0, 'ningún lugar quedó marcado como público 20s');
  const p = app.perfil(); p.edad = '35-44'; app.perfilGuarda(p);
  u.forEach(v => assert(app.afinidad(v) < 0, v.n + ' no baja para 35–44'));
  assert(app.cat().every(v => ['20s', '30s+', 'familia', 'todos'].includes(v.publico)), 'hay lugares sin marca de público');
});

test('27.6 · las preguntas para afinar se hacen una sola vez y son opcionales', () => {
  const app = makeApp(BASE);
  assert(app.renderVals().mostrarAfinar === true, 'la primera vez no aparecen');
  app.runSearch({ nueva: true });
  assert(app.renderVals().mostrarAfinar === false, 'después de la primera búsqueda siguen apareciendo');
  assert(app.perfil().edad === null && app.perfil().ninos === null, 'se llenaron sin que nadie contestara');
});

test('27.7 · "Arma con mis gustos" sólo aparece con perfil; "Quiero algo diferente" apaga los gustos', () => {
  const app = makeApp(BASE);
  assert(!app.renderVals().hayGustos, 'aparece sin perfil');
  app.aprende('elegido', [lugar(app, /^Museo Nacional de Antropolog/)], [12]);
  const rv = app.renderVals();
  assert(rv.hayGustos && rv.gustosResumen, 'no aparece con perfil');
  const v = lugar(app, /^Museo Nacional de Antropolog/);
  assert(app.afinidad(v) > 0, 'el museo elegido no suma');
  rv.diferenteGo();
  assert(app.afinidad(v) === 0, '"Quiero algo diferente" sigue usando los gustos');
});

test('27.8 · al día siguiente pregunta cómo les fue; "más caro" sube el precio estimado (no el verificado)', () => {
  const app = makeApp(BASE);
  const est = app.cat().find(v => v.pEstado === 'estimado' && !v.ppUnknown && v.pp > 0 && v.ext);
  const ver = app.cat().find(v => v.pEstado === 'verificado' && !v.ppUnknown && v.pp > 0 && v.ext);
  const p = app.perfil(); p.pendiente = { fecha: '2026-11-01', ids: [est.id, ver.id], cats: [est.cat, ver.cat] }; app.perfilGuarda(p);
  const rv = app.renderVals();
  assert(rv.hayFeedback && /Tu plan del/.test(rv.fbTitulo), 'no pregunta');
  const antes = est.pp, antesV = ver.pp;
  app.enviaFeedback('bien', 'caro', 'ana@ejemplo.com');
  assert(!app.renderVals().hayFeedback, 'vuelve a preguntar');
  const app2 = recarga(app);
  const e2 = app2.cat().find(v => v.id === est.id), v2 = app2.cat().find(v => v.id === ver.id);
  assert(e2.pp > antes, 'el estimado no subió: ' + antes + ' → ' + e2.pp);
  assert(v2.pp === antesV, 'tocó un precio verificado');
  assert(app2.perfil().feedback.length === 1 && app2.perfil().correo === 'ana@ejemplo.com', 'no guardó la respuesta');
});

test('27.9 · "Borrar mis datos" borra todo lo que SOBRES guarda en el navegador', () => {
  const app = makeApp(BASE);
  app.aprende('elegido', [lugar(app, /^Museo Nacional de Antropolog/)], [12]);
  app.runSearch({ nueva: true });
  app.persist();
  assert(Object.keys(app._store).some(k => /^sobres_/.test(k)), 'la prueba no guardó nada');
  app.borrarMisDatos();
  const quedan = Object.keys(app._store).filter(k => /^sobres_/.test(k));
  assert(!quedan.length, 'quedaron: ' + quedan.join(', '));
  assert(!app.perfilTiene(), 'el perfil sigue en memoria');
});

if (require.main === module) report();
