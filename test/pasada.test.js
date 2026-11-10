// Pasada profunda (10 nov 2026). Corre con el MISMO catálogo que la preview (revisión del
// fundador incluida) y con el comportamiento por defecto de la app: tope de presupuesto ESTRICTO.
const { makeApp, test, assert, section, report } = require('./harness.js');

const nueva = (st, opts) => { const a = makeApp({}, Object.assign({ search: '?v=facil', dseed: 1, rseed: 3, estricto: true }, opts || {})); a.ev = () => {};
  st = Object.assign({}, st);
  if (st.zonas) { st.zonesSel = st.zonas === 'all' ? [] : a.conGrupos(st.zonas); st.zone = st.zonas === 'all' ? 'all' : st.zonesSel[0]; delete st.zonas; }
  a.setState(st); return a; };
const busca = (st, opts) => { const a = nueva(st, opts); const r = a.runSearch({ nueva: true }); return { a, r, ps: (r && r.plans) || [] }; };
const txt = p => p.stops.map(v => v.n).join(' → ');
const NOCHE = { who: 'amigos', groupSize: 4, vibes: ['nightlife'], facilOpcion: 'fiesta', budget: 'b1000', zonas: ['roma'] };
const DATE = { who: 'date', groupSize: 2, vibes: ['romántico'], facilOpcion: 'romantico', budget: 'b600', zonas: ['roma', 'juarez'] };

section('42 · Pasada profunda F1: planes con sentido y costo defendible');

test('42.1 · un estadio, arena o foro sólo sale con un evento concreto (antes: cita en el Estadio GNP sin función)', () => {
  const a = nueva({}); const C = a.cat();
  ['Estadio GNP Seguros', 'Palacio de los Deportes', 'Estadio Azteca'].forEach(n => { const v = C.find(x => x.n === n); if (v) assert(a.esSede(v) && !a.esRecomendable(v), n + ' se propone sin función'); });
  const ev = C.find(v => v.evento && /Estadio GNP|Palacio de los Deportes|Auditorio Nacional/.test(v.n)); assert(ev && !a.esSede(ev), 'el evento en la sede debe poder salir');
  [1, 2, 3, 4].forEach(sd => { const { ps } = busca(Object.assign({}, DATE, { aceptaSinPrecio: true }), { dseed: sd, rseed: sd * 3 });
    ps.forEach(p => p.stops.forEach(v => assert(!a.esSede(v), 'semilla ' + sd + ': recinto sin función en una cita: ' + txt(p)))); });
});

test('42.2 · dos fichas de la misma sede cuentan como el mismo lugar; dos conciertos en la sede son dos actividades', () => {
  const a = nueva({}); const C = a.cat();
  const sede = C.find(v => v.n === 'Auditorio Nacional'), evs = C.filter(v => v.evento && / · Auditorio Nacional$/.test(v.n));
  assert(sede && evs.length >= 2, 'faltan fichas del Auditorio');
  evs.forEach(e => assert(a.sedeDe(e) === a.sedeDe(sede) && a.mismoLugar(e, sede), e.n + ' no comparte sede'));
  assert(a.actKey(evs[0]) !== a.actKey(evs[1]), 'dos conciertos distintos se contaron como la misma actividad');
  const m = C.find(v => v.n === 'Museo Franz Mayer'), l = C.find(v => v.n === 'Librería del Museo Franz Mayer');
  if (m && l) assert(a.sedeDe(m) === a.sedeDe(l), 'el museo y su librería son la misma sede');
  // La plaza es contenedor, no "el mismo lugar" que sus locales; y dos sucursales lejanas no son la misma sede.
  const k = C.find(v => /^Karting Perisur/.test(v.n)), cp = C.find(v => v.n === 'Cinépolis Perisur');
  if (k && cp) assert(a.sedeDe(k) !== a.sedeDe(cp) && a.plazaDe(k) === 'Perisur' && a.plazaDe(cp) === 'Perisur', 'Perisur: sede/plaza mal');
  const s1 = C.find(v => v.n === 'Museo Soumaya · Plaza Carso'), s2 = C.find(v => v.n === 'Museo Soumaya · Plaza Loreto');
  assert(a.sedeDe(s1) !== a.sedeDe(s2), 'dos sucursales lejanas quedaron como la misma sede');
  [1, 2, 3].forEach(sd => { const { a: b, ps } = busca({ who: 'amigos', groupSize: 4, vibes: ['cultural'], budget: 'any', zonas: ['polanco', 'juarez'], planFrom: 11, planTo: 19 }, { dseed: sd, rseed: sd });
    ps.forEach(p => { const ks = p.stops.map(v => b.sedeDe(v)); assert(new Set(ks).size === ks.length, 'misma sede dos veces en un plan: ' + txt(p)); }); });
});

test('42.3 · tope estricto: con presupuesto, cada gasto obligatorio tiene respaldo y el total (con propina y traslado) cabe', () => {
  let n = 0;
  [DATE, NOCHE, { who: 'familia', groupSize: 4, vibes: ['familiar'], budget: 'b600', zonas: ['polanco'], planFrom: 13, planTo: 19 },
   { who: 'solo', groupSize: 1, vibes: ['cultural'], budget: 'b600', zonas: ['juarez'], planFrom: 11, planTo: 18 }].forEach(st => [1, 2, 3].forEach(sd => {
    const { a, ps } = busca(st, { dseed: sd, rseed: sd * 5 }); const tope = a.budgetMax();
    ps.forEach(p => { n++; const c = a.costoPlan(p.stops, p.times);
      p.stops.forEach(v => assert(['firme', 'estimado', 'libre'].indexOf(a.respaldoDe(v)) >= 0, v.n + ' entró con tope sin costo respaldado (' + a.respaldoDe(v) + '): ' + txt(p)));
      assert(c.total === c.consumo + c.propina + c.transporte, 'el total no desglosa consumo + propina + traslado');
      assert(c.total <= tope, 'se pasa del tope: $' + c.total + ' > $' + tope + ' · ' + txt(p));
      assert(!p.stops.some(v => a.coverPendiente(v)), 'cover pendiente dentro de un tope: ' + txt(p)); }); }));
  assert(n >= 12, 'muy pocas opciones para probar: ' + n);
  // Sin presupuesto (o si la persona acepta "precio por confirmar") lo sin precio sí entra.
  const libre = nueva({ budget: 'any' }); const sinP = libre.cat().find(v => v.ppUnknown && v.cat === 'Restaurante' && libre.esRecomendable(v));
  assert(libre.budgetOk(sinP), 'sin presupuesto debe entrar lo que no tiene precio');
  const tope = nueva({ budget: 'b600' }); assert(!tope.budgetOk(tope.cat().find(v => v.id === sinP.id)), 'con tope entró un restaurante sin precio');
  tope.state.aceptaSinPrecio = true; assert(tope.budgetOk(tope.cat().find(v => v.id === sinP.id)), 'el ajuste "precio por confirmar" no lo dejó entrar');
});

test('42.4 · traslado en el desglose: a pie $0, público $6 por viaje, en app con taxímetro oficial y dividido una vez', () => {
  const a = nueva({ groupSize: 4, who: 'amigos' }); const C = a.cat();
  const x = C.find(v => v.n === 'Castacán'), y = C.find(v => v.n === 'Bar Latosa'); assert(x && y, 'faltan lugares de prueba');
  a.state.transporte = 'caminando'; assert(a.costoTraslado([x, y]).porPersona === 0, 'a pie debe ser $0');
  a.state.transporte = 'metro'; const m = a.costoTraslado([x, y, x]); assert(m.porPersona === 12 && m.respaldo === 'firme' && /^https:/.test(m.fuente.url), 'público: ' + JSON.stringify(m).slice(0, 160));
  a.state.transporte = 'propio'; assert(a.costoTraslado([x, y]).porPersona === 0 && /estacionamiento/.test(a.costoTraslado([x, y]).nota), 'coche propio');
  a.state.transporte = 'servicio'; const t = a.costoTraslado([x, y], [20, 22]);
  assert(t.porPersona > 0 && t.respaldo === 'estimado' && t.fuente.banderazo === 8.74 && t.fuente.fecha, 'app: ' + JSON.stringify(t).slice(0, 200));
  assert(t.porPersona <= Math.ceil(t.porAuto / 4 / 5) * 5, 'no se dividió entre los 4: $' + t.porPersona + ' de $' + t.porAuto + ' por auto');
  const noche = a.costoTraslado([x, y], [23, 25]); assert(noche.porAuto > t.porAuto, 'sin recargo nocturno saliendo después de las 11 pm');
  a.state.groupSize = 6; assert(a.costoTraslado([x, y], [20, 22]).autos === 2, '6 personas van en 2 autos');
});

test('42.5 · las paradas aportan: sin "Compras" de relleno, sin dos lugares del mismo tipo, 3 por salida (4 si el horario es largo)', () => {
  const casos = [{ who: 'familia', groupSize: 4, vibes: ['familiar'], budget: 'b600', zonas: ['coyoacan'], planFrom: 14, planTo: 20 },
    { who: 'familia', groupSize: 4, vibes: ['familiar'], budget: 'b1000', zonas: ['polanco'], planFrom: 13, planTo: 19, aceptaSinPrecio: true },
    { who: 'solo', groupSize: 1, vibes: ['chill'], budget: 'b600', zonas: ['roma'], planFrom: 11, planTo: 18 },
    { who: 'amigos', groupSize: 4, vibes: ['social'], budget: 'b1000', zonas: ['delvalle'], planFrom: 13, planTo: 19, aceptaSinPrecio: true }];
  casos.forEach((st, i) => [1, 2, 3].forEach(sd => { const { a, ps } = busca(st, { dseed: sd, rseed: sd * 7 }); const [f, t] = a.range();
    ps.forEach(p => { assert(p.plaza || !p.stops.some(v => v.cat === 'Centro comercial'), 'caso ' + i + ': "Compras" de relleno: ' + txt(p));
      assert(p.stops.length <= (t - f >= 7 ? 4 : 3), 'caso ' + i + ': demasiadas paradas (' + p.stops.length + '): ' + txt(p));
      const cs = p.stops.filter(v => a.DRINK.indexOf(v.cat) < 0).map(v => v.cat); assert(new Set(cs).size === cs.length, 'caso ' + i + ': dos lugares del mismo tipo: ' + txt(p)); }); }));
  const a = nueva({}); const C = a.cat(); const res = C.find(v => v.cat === 'Restaurante' && v.lat), par = C.find(v => v.cat === 'Parque' && v.lat && a.legKm(res, v) > 3);
  assert(!a.sigueBien(res, 'comida', par, 'paseo'), 'un parque a más de 3 km no es "caminar por un parque cercano"');
  assert(!a.sigueBien(res, 'comida', C.find(v => v.cat === 'Centro comercial'), 'compras'), '"compras" entró como parada');
});

test('42.6 · último acceso y cierre de cocina mandan sobre la hora de cierre', () => {
  const a = nueva({});
  const museo = { id: 't-m', n: 'Museo de prueba', cat: 'Museo', oh: [10, 18], ultimoAcceso: 17, tags: [], who: [], tm: [] };
  assert(a.atHour(museo, 16.5) && !a.atHour(museo, 17.25), 'último acceso 5 pm: no se entra a las 5:15');
  const rest = { id: 't-r', n: 'Restaurante de prueba', cat: 'Restaurante', oh: [13, 26], cocinaCierra: 23, tags: [], who: [], tm: [], act: ['cena'] };
  assert(a.atHour(rest, 22.5) && !a.atHour(rest, 22.75) && !a.atHour(rest, 24.5), 'la cocina cierra a las 11: se llega a más tardar 10:30');
  const taq = { id: 't-t', n: 'Taquería de prueba', cat: 'Taquería', oh: [13, 27], cocinaCierra: 26.5, tags: [], who: [], tm: [], act: ['cena'] };
  assert(a.atHour(taq, 25.5) && a.atHour(taq, 1.5) && !a.atHour(taq, 26.25), 'tacos de madrugada con cocina hasta las 2:30');
});

test('42.7 · reloj de CDMX y día de servicio: a la 1 am "hoy en la noche" sigue siendo la noche anterior', () => {
  const a = nueva({ when: 'noche', planDate: '' });
  a.ahoraCDMX = () => ({ iso: '2026-11-14', hora: 1.25 });   // sábado 1:15 am
  assert(a.diaServicioISO() === '2026-11-13' && a.fechaPlanISO() === '2026-11-13', 'a la 1:15 am del sábado el plan de "hoy" es del viernes: ' + a.fechaPlanISO());
  assert(a.fechaDe('manana') === '2026-11-14' && a.fechaDe('finde') === '2026-11-14', 'mañana/finde: ' + a.fechaDe('manana') + ' ' + a.fechaDe('finde'));
  a.state.when = 'ahora'; const r = a.rangeDefault(); assert(r[0] >= 25 && r[0] <= 26 && r[1] > r[0], '"ahora" a la 1:15 am debe empezar ~1:30 am: ' + r);
  a.ahoraCDMX = () => ({ iso: '2026-11-14', hora: 18 }); a.state.when = 'noche';
  assert(a.fechaPlanISO() === '2026-11-14' && a.fechaDe('libre') === '', 'a las 6 pm el plan es de hoy; sin fecha no hay fecha');
});

test('42.8 · en familia, una opción es la tarde completa en UNA plaza (actividad, comer ahí mismo, postre)', () => {
  let con = 0;
  [['santafe'], ['coyoacan'], ['polanco']].forEach(z => [1, 2].forEach(sd => { const { a, ps } = busca({ who: 'familia', groupSize: 4, vibes: ['familiar'], facilOpcion: 'familia', budget: 'b1000', zonas: z, planFrom: 13, planTo: 20, aceptaSinPrecio: true }, { dseed: sd, rseed: sd * 3 });
    const pl = ps.filter(p => p.plaza); assert(pl.length <= 1, 'más de una opción de plaza');
    pl.forEach(p => { con++; assert(p.stops.length >= 2 && p.stops.every(v => a.plazaDe(v) === p.plaza && v.cat !== 'Centro comercial'), 'la tarde en ' + p.plaza + ' se sale de la plaza: ' + txt(p));
      assert(p.stops.some(v => a.sirveComida(v)), 'plaza sin dónde comer: ' + txt(p)); }); }));
  assert(con >= 3, 'casi nunca salió una opción de plaza: ' + con);
});

test('42.9 · noche que pasa de las 2 am: los tacos de madrugada son el remate, después del antro y con la taquería abierta', () => {
  let remate = 0;
  [1, 2, 3, 4].forEach(sd => { const { a, ps } = busca(Object.assign({}, NOCHE, { planFrom: 22, planTo: 28, aceptaSinPrecio: true }), { dseed: sd, rseed: sd * 3 });
    ps.forEach(p => { const i = p.stops.findIndex(v => a.esAntro(v)), j = p.stops.findIndex((v, k) => v.cat === 'Taquería' && k > i);
      if (i >= 0 && j > i) { remate++; assert(j === p.stops.length - 1 && p.times[j] >= 24.5, 'los tacos de remate no cierran la noche: ' + txt(p));
        assert(a.atHour(p.stops[j], p.times[j]), p.stops[j].n + ' está cerrada a las ' + a.time12(p.times[j])); assert(a.cierraBailando(p.stops), 'no cuenta como noche de baile'); }
      p.stops.forEach((v, k) => assert(a.atHour(v, p.times[k]) || a.funcionSinConfirmar(v), v.n + ' cerrado a las ' + a.time12(p.times[k]))); }); });
  assert(remate >= 2, 'en 4 tandas casi nunca salió antro + tacos de madrugada: ' + remate);
});

test('42.10 · «No quiero antros» es filtro duro al generar y regenerar; el ajuste ofrece quitarlo', () => {
  const a = nueva(Object.assign({}, NOCHE, { planFrom: 22, planTo: 28, noQuiero: ['antro'], aceptaSinPrecio: true }));
  a.runSearch({ nueva: true });
  for (let i = 0; i < 4; i++) { (a.state.results.plans || []).forEach(p => p.stops.forEach(v => assert(!a.esAntro(v), 'tanda ' + i + ': salió un antro o salón: ' + txt(p)))); a.regenerate(); }
  assert(a.exclSet().has(a.cat().find(v => v.cat === 'Antro').id), 'el antro no está en las exclusiones');
  a.toggleNoQuiero('antro'); assert(!(a.state.noQuiero || []).length && !a.exclSet().has(a.cat().find(v => v.cat === 'Antro').id), 'no se pudo quitar');
  const b = nueva({ who: 'amigos', groupSize: 4, vibes: ['cultural'], budget: 'b600', zonas: ['xochimilco'], noQuiero: ['museo'], planFrom: 11, planTo: 17 }); const r = b.runSearch({ nueva: true });
  (r.plans || []).forEach(p => p.stops.forEach(v => assert(['Museo', 'Galería', 'Centro cultural'].indexOf(v.cat) < 0, 'salió un museo: ' + v.n)));
  if ((r.plans || []).filter(p => b.planCompleto(p)).length < 3) assert((r.ajustes || []).every(x => x.gana > 0 && x.txt && x.patch), 'ajuste sin efecto');
});

test('42.11 · con menos de tres salidas completas no amplía la zona sola: ofrece ajustes que sí dan más', () => {
  const { a, r, ps } = busca(DATE);
  ps.forEach(p => p.stops.forEach(v => assert(a.zoneList().indexOf(v.z) >= 0, 'se salió de la zona sin preguntar: ' + v.n + ' (' + v.z + ')')));
  if (ps.filter(p => a.planCompleto(p)).length < 3) { const aj = r.ajustes || [];
    assert(aj.length >= 1 && aj.length <= 4, 'sin ajustes concretos: ' + aj.length);
    aj.forEach(x => assert(['zona', 'presupuesto', 'precio', 'horario', 'noquiero'].indexOf(x.k) >= 0 && x.gana > 0, 'ajuste raro: ' + JSON.stringify(x))); }
  // El ajuste de zona, una vez elegido, sí suma las vecinas y lo dice.
  const c = busca({ who: 'amigos', groupSize: 6, vibes: ['nightlife'], budget: 'b1000', zonas: ['coyoacan'], planFrom: 21, planTo: 27, aceptaSinPrecio: true, ampliarZonas: true });
  if (c.ps.some(p => p.stops.some(v => c.a.zoneList().indexOf(v.z) < 0))) assert(/zonas vecinas/.test(c.r.expandNote || ''), 'sumó zonas sin decirlo');
});

test('42.12 · disponibilidad condicionada: taller con sesión por reservar sí sale (avisando); teatro sin cartelera no', () => {
  const a = nueva({}); const C = a.cat();
  const t = C.find(v => /^Contorno/.test(v.n)); assert(t && t.condicion && a.esRecomendable(t) && /reserva tu sesión/.test(a.condicionDe(t)), 'Contorno debe salir condicionado: ' + (t && t.pNotaLugar));
  const teatros = C.filter(v => v.cat === 'Teatro' && /Seleccionar función/.test(v.pausa || '')); assert(teatros.length > 50 && teatros.every(v => !a.esRecomendable(v)), 'teatros sin cartelera reactivados');
  C.filter(v => v.pausa).forEach(v => assert(!a.esRecomendable(v), v.n + ' está en pausa y sale'));
  const ev = C.find(v => v.evento && v.fechas && a.vigenteDesde(v, a.todayISO()));
  if (ev) assert(/elige la función/.test(a.condicionDe(ev)), 'sin fecha, un evento debe pedir elegir función');
  const { a: b, ps } = busca({ who: 'amigos', groupSize: 4, vibes: ['creativo'], budget: 'b1000', zonas: 'all', planFrom: 11, planTo: 20 });
  ps.forEach(p => { const cond = b.condicionesPlan(p.stops); if (p.stops.some(v => v.condicion)) assert(cond.length >= 1, 'plan con sesión por reservar sin aviso: ' + txt(p)); });
});

section('43 · Pasada profunda F2: «Dame otros 3» de raíz');

const prinDe = (a, p) => a.actKey(p.stops.find(v => v.id === p.ancla) || p.stops.find(v => v.id === a.anclaDe(p.stops, p.acts)) || p.stops[0]);

test('43.1 · cinco regeneraciones con buena cobertura: ninguna actividad principal ni lugar repetido, por sede', () => {
  const a = nueva(Object.assign({}, NOCHE, { budget: 'any' })); a.runSearch({ nueva: true });
  const prin = new Set(), lugares = new Set(); let tandas = 0, rep = 0, repPrin = 0;
  for (let i = 0; i <= 5; i++) { if (i) a.regenerate(); if (a.state.agotado && a.state.agotado.nuevas === 0) break; tandas++;
    (a.state.results.plans || []).forEach(p => { const k = prinDe(a, p); if (prin.has(k)) repPrin++; prin.add(k);
      p.stops.forEach(v => { const s = a.actKey(v); if (lugares.has(s)) rep++; lugares.add(s); }); }); }
  assert(tandas === 6, 'se agotó demasiado pronto: ' + tandas + ' tandas');
  assert(repPrin === 0, repPrin + ' actividades principales repetidas');
  assert(rep === 0, rep + ' lugares repetidos habiendo cobertura de sobra');
  assert(prin.size >= 16, 'pocas actividades principales nuevas: ' + prin.size);
});

test('43.2 · al agotarse no recicla en silencio: conserva la última tanda útil, dice qué limita y ofrece ajustes o volver a empezar', () => {
  const a = nueva(NOCHE); a.runSearch({ nueva: true }); const vistos = new Set(); let ultima = null, agotado = null;
  for (let i = 0; i < 25 && !agotado; i++) { (a.state.results.plans || []).forEach(p => { const k = prinDe(a, p);
      if (ultima !== a.state.results) { assert(!vistos.has(k), 'tanda ' + i + ': repitió actividad principal ' + txt(p)); } });
    if (ultima !== a.state.results) (a.state.results.plans || []).forEach(p => vistos.add(prinDe(a, p)));
    ultima = a.state.results; a.regenerate(); if (a.state.agotado && a.state.agotado.nuevas === 0) agotado = a.state.agotado; }
  assert(agotado, 'nunca avisó que se agotó');
  assert(a.state.results === ultima && (ultima.plans || []).length >= 1, 'no conservó el último resultado útil');
  assert(agotado.limita && ['presupuesto', 'horario', 'zona', 'exclusiones'].indexOf(agotado.limita.k) >= 0 && !/del catálogo/.test(agotado.limita.txt), 'no dice qué filtro limita: ' + JSON.stringify(agotado.limita));
  const V = a.renderVals(); assert(V.agotadoOn && /Ya viste todo/.test(V.agotadoTit) && typeof V.reiniciar === 'function', 'la pantalla no lo dice: ' + V.agotadoTit);
  (agotado.ajustes || []).forEach(x => assert(x.txt && x.patch && x.gana > 0, 'ajuste sin efecto: ' + JSON.stringify(x)));
  a.reiniciarVistos(); assert(!a.state.agotado && (a.state.results.plans || []).length >= 1 && (a.state.seenStops || []).length > 0, 'volver a empezar no regeneró');
});

test('43.3 · el historial es por sede y sin orden: la otra ficha del mismo lugar o el mismo plan al revés ya se vieron', () => {
  const a = nueva({}); const C = a.cat();
  const b1 = C.find(v => v.n === 'Museo Franz Mayer'), b2 = C.find(v => v.n === 'Librería del Museo Franz Mayer'), x = C.find(v => v.n === 'Castacán'), y = C.find(v => v.n === 'Bar Latosa');
  assert(a.comboSig([x, y]) === a.comboSig([y, x]), 'cambiar el orden cuenta como plan nuevo');
  if (b1 && b2) assert(a.comboSig([b1, x]) === a.comboSig([b2, x]), 'la otra ficha de la misma sede cuenta como lugar nuevo');
  const r = a.engine(0, { vistosPlan: [y.id], soloNuevos: true, regen: 1, reqSeed: 5 });
  (r.plans || []).forEach(p => assert(prinDe(a, p) !== a.actKey(y), 'volvió a salir como principal un lugar ya visto: ' + txt(p)));
});

test('43.4 · generar: toques repetidos no encolan tandas, un error conserva lo último útil y no deja la pantalla cargando', () => {
  const a = nueva(Object.assign({}, NOCHE, { budget: 'any' })); a.runSearch({ nueva: true }); a.nav('results');
  const antes = a.state.results; let corrio = 0;
  a._gen = { tk: 99, tipo: 'regen' }; a.generar(() => { corrio++; }, 'regen'); assert(corrio === 0, 'un segundo toque encoló otra regeneración');
  let aviso = ''; a.toast = t => { aviso = t; }; const ce = console.error; console.error = () => {};
  a._gen = null; a.generar(() => { throw new Error('falla simulada'); }, 'regen'); console.error = ce;
  assert(a.state.results === antes && !a.state.regenerando && !a.state.generando, 'el error borró el resultado o dejó la pantalla cargando');
  assert(/No pudimos armar/.test(aviso), 'no avisó del error: ' + aviso);
  a.generar(() => a.regenerate(), 'regen'); assert(a.state.results !== antes && !a.state.regenerando, 'después del error ya no regenera');
  // Una respuesta vieja no pisa a la nueva: la ficha más reciente manda.
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  assert(/if \(this\._genTk !== tk\) return;/.test(src) && !/setTimeout\(correr, corto \? 180 : 1050\)/.test(src), 'volvió la espera fija de 1,050 ms o falta la ficha de solicitud');
});

if (require.main === module) report();
