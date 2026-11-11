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
  const lug = new Set();
  for (let i = 0; i < 25 && !agotado; i++) { if (ultima !== a.state.results) { const ag = a.state.agotado; let rep = 0;
      (a.state.results.plans || []).forEach(p => { if (vistos.has(prinDe(a, p))) rep++;
        if (i) assert(p.stops.some(v => !lug.has(a.actKey(v))), 'tanda ' + i + ': volvió un plan hecho sólo de lugares ya vistos: ' + txt(p)); });
      // Repetir la actividad principal sólo se vale cuando ya no hay nuevas, y se avisa cuántas.
      assert(rep === ((ag && ag.repitePrincipal) || 0), 'tanda ' + i + ': repitió ' + rep + ' actividades principales sin avisar');
      (a.state.results.plans || []).forEach(p => { vistos.add(prinDe(a, p)); p.stops.forEach(v => lug.add(a.actKey(v))); }); }
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

section('44 · Pasada profunda F3: catálogo verificado, pausas por motivo y ubicación');

test('44.1 · una pausa se levanta sólo cuando se resuelven TODOS sus motivos; el ID no cambia', () => {
  const a0 = nueva({}); const C0 = a0.cat();
  assert(a0.motivosPausa('Confirmar días y horario. Confirmar dirección o acceso específico.').join() === 'horario,ubicacion', 'motivos: ' + a0.motivosPausa('Confirmar días y horario. Confirmar dirección o acceso específico.'));
  assert(a0.motivosPausa('Seleccionar función de la cartelera.').join() === 'sesion' && a0.motivosPausa('Geocodificar la dirección porque el pin previo se compartía entre calles.').join() === 'ubicacion', 'motivos de sesión/ubicación');
  const dos = C0.find(v => v.pausa && a0.motivosPausa(v.pausa).join() === 'horario,ubicacion'), uno = C0.find(v => v.pausa && a0.motivosPausa(v.pausa).join() === 'horario' && !v.coordAprox && v.cat === 'Restaurante');
  assert(dos && uno, 'faltan fichas en pausa para la prueba');
  const base = { fecha: '2026-11-10', fuente: 'Fuente de prueba', url: 'https://ejemplo.test/', oh: [13, 23], hrs: 'Diario 13:00–23:00' };
  const ver = {}; ver[dos.id] = Object.assign({ resuelve: ['horario'] }, base); ver[uno.id] = Object.assign({ resuelve: ['horario'] }, base);
  const a = nueva({}, { verificados: ver }); const C = a.cat(); const d2 = C.find(v => v.id === dos.id), u2 = C.find(v => v.id === uno.id);
  assert(d2 && d2.pausa && !a.esRecomendable(d2), 'se reactivó con un motivo pendiente (ubicación): ' + d2.n);
  assert(u2 && !u2.pausa && u2.reactivado && a.esRecomendable(u2), 'no se reactivó con todos los motivos resueltos: ' + u2.n);
  assert(/Reactivado: Fuente de prueba \(2026-11-10\)/.test(u2.pNotaLugar) && u2.oh[0] === 13 && u2.hrs === 'Diario 13:00–23:00' && !u2.horaEstimada, 'no quedó el dato verificado con su fuente: ' + u2.pNotaLugar);
});

test('44.2 · lo verificado trae fuente y fecha y entra al tope: Acuario Inbursa $260 en línea', () => {
  const a = nueva({}); const v = a.cat().find(x => x.id === 'cdmx-2047');
  assert(v && v.n === 'Acuario Inbursa' && v.pp === 260 && a.respaldoDe(v) === 'firme', 'Acuario: $' + v.pp + ' ' + a.respaldoDe(v));
  assert(/^https:/.test(v.pUrl) && v.pFecha === '2026-11-10' && /en línea/.test(v.pCanasta) && v.oh.join() === '10,18', 'sin fuente, fecha o canasta');
  const V = a._win.SOBRES_VERIFICADOS; Object.keys(V.items).forEach(id => { const x = V.items[id]; assert(x.fecha && (x.url || x.fuente), id + ' sin fuente o fecha'); assert(a.cat().some(c => c.id === id), id + ' no existe: una verificación no puede cambiar el ID'); });
});

test('44.3 · regla de ubicación: nada sale en planes con pin aproximado; con el número confirmado, vuelve', () => {
  const a = nueva({}); const C = a.cat();
  const mal = C.filter(v => a.esRecomendable(v) && v.coordAprox && !v.evento); assert(!mal.length, 'en planes con pin aproximado: ' + mal.slice(0, 4).map(v => v.n));
  const V = a._win.SOBRES_VERIFICADOS; const conPin = Object.keys(V.items).filter(id => V.items[id].lat != null); assert(conPin.length >= 25, 'pocos pines confirmados: ' + conPin.length);
  conPin.forEach(id => { const v = C.find(x => x.id === id); assert(v && !v.coordAprox && Math.abs(v.lat - V.items[id].lat) < 1e-6, id + ' no tomó el pin confirmado'); });
  const sinV = makeApp({}, { estricto: true, sinVerificados: true }).cat(); assert(conPin.filter(id => (sinV.find(x => x.id === id) || {}).coordAprox).length >= 20, 'la prueba supone que sin la verificación esos pines eran aproximados');
  // El duplicado que apareció al confirmar el pin sale del catálogo.
  assert(!C.some(v => v.id === 'os-n11737763876') && C.some(v => v.id === 'cdmx-4030'), 'duplicado de Cinépolis Arcos Bosques');
});

test('44.4 · un alta del Excel sólo se activa con pin confirmado y horario publicado; el taller sale con sesión por reservar', () => {
  const a = nueva({}); const C = a.cat();
  const pepes = C.find(v => v.id === 'rv-af01b608aa'), mdt = C.find(v => v.id === 'rv-fb39aec0d1'), ada = C.find(v => v.id === 'rv-611785805c');
  assert(a.esRecomendable(pepes) && !pepes.coordAprox && pepes.oh.join() === '11,15' && /reserva tu sesión/.test(a.condicionDe(pepes)), 'Pepes: ' + pepes.pNotaLugar);
  assert(a.esRecomendable(mdt) && mdt.condicion && mdt.duracionMin === 120 && a.atHour(mdt, 10.5) && !a.atHour(mdt, 12), 'Manos de Tierra: sesión de 2 h entre 10 y 13');
  assert(!a.esRecomendable(ada) && ada.coordAprox, 'Adamanta Del Valle se activó sin pin confirmado');
});

section('45 · Pasada profunda F4: editar, deshacer, borrador y compartir');

// Un plan de noche en la Roma, ya en el editor.
const enEditor = (extra, opts) => { const a = nueva(Object.assign({}, NOCHE, { budget: 'any' }, extra || {}), Object.assign({ dseed: 2, rseed: 5 }, opts || {}));
  a.runSearch({ nueva: true }); const p0 = a.state.results.plans.find(p => p.stops.length >= 2) || a.state.results.plans[0];
  a.setState({ planCustom: { stops: p0.stops.slice(), times: p0.times.slice(), spent: p0.spent }, planStops: p0.stops.length, planEditando: true, planView: 'edit', planHist: [] }); a.nav('plan'); return a; };
const ids = p => p.stops.map(v => v.id).join(',');

test('45.1 · cada cambio se revisa con las reglas del motor: explica qué dejó de cuadrar, ofrece reemplazo y se puede deshacer', () => {
  const a = enEditor(); const antes = a.getPlan(), tAntes = a.curTimes(antes).join();
  assert(a.revisaPlan().ok, 'el plan recién armado ya traía problemas: ' + JSON.stringify(a.revisaPlan().problemas.map(x => x.txt)));
  a.setStopTime(0, 9);   // 9 am: el bar o la taquería de la noche no reciben
  const rev = a.revisaPlan(); assert(!rev.ok && rev.problemas.some(x => x.tipo === 'horario' && /no recibe a las 9:00 am/.test(x.txt)), 'no explicó el horario: ' + JSON.stringify(rev.problemas.map(x => x.txt)));
  const V = a.renderVals(); assert(V.revOn && V.revItems.length >= 1 && V.hayDeshacer && /dejó de cuadrar|dejaron de cuadrar/.test(V.revTit), 'la pantalla no lo muestra');
  rev.problemas.filter(x => x.reemplazo).forEach(x => { const st = a.getPlan().stops.slice(), ts = a.curTimes(a.getPlan()); st[x.i] = x.reemplazo;
    assert(a.atHour(x.reemplazo, ts[x.i]) && a.cabeEnTope(st, a.budgetMax(), ts).ok, 'el reemplazo ofrecido tampoco funciona: ' + x.reemplazo.n); });
  a.deshacer(); const p = a.getPlan();
  assert(ids(p) === ids(antes) && a.curTimes(p).join() === tAntes && a.revisaPlan().ok, 'deshacer no dejó el plan como estaba');
  // Con tope: meter un lugar sin precio confirmado se explica como tal.
  const b = enEditor({ budget: 'b1000' }); const sinP = b.cat().find(v => v.ppUnknown && v.cat === 'Bar' && v.z === 'roma' && !v.pausa && !v.coordAprox);
  if (sinP) { b.replaceStop(b.getPlan().stops.length - 1, sinP); const r2 = b.revisaPlan(); assert(r2.problemas.some(x => x.tipo === 'precio' || x.tipo === 'horario' || x.tipo === 'trayecto'), 'metió un lugar sin precio con tope y no dijo nada'); }
});

test('45.2 · fijar una parada y pedir alternativas para lo demás: la fijada se queda a su hora y las nuevas funcionan con el plan completo', () => {
  const a = enEditor({ noQuiero: ['antro'] }); const p0 = a.getPlan(); const fija = p0.stops[0], tFija = a.curTimes(p0)[0];
  a.fijar(fija.id); assert(a.renderVals().itinerary[0].fijada && /lo demás/.test(a.renderVals().altRestoTxt), 'no quedó fijada en pantalla');
  a.alternativasResto(); const p = a.getPlan(), ts = a.curTimes(p);
  assert(p.stops[0].id === fija.id && ts[0] === tFija, 'la parada fijada cambió');
  assert(p.stops.slice(1).some((v, k) => v.id !== p0.stops[k + 1].id), 'no cambió ninguna de las otras');
  p.stops.forEach((v, i) => { assert(a.atHour(v, ts[i]) || a.funcionSinConfirmar(v), v.n + ' cerrado a las ' + a.time12(ts[i])); assert(!a.noQuiereA(v), 'alternativa de «No quiero»: ' + v.n); });
  assert(new Set(p.stops.map(v => a.sedeDe(v))).size === p.stops.length && a.revisaPlan().ok && a.cabeEnTope(p.stops, a.budgetMax(), ts).ok, 'las alternativas no cuadran: ' + JSON.stringify(a.revisaPlan().problemas.map(x => x.txt)));
  a.deshacer(); assert(ids(a.getPlan()) === ids(p0), 'deshacer no regresó el plan anterior');
});

test('45.3 · sustituir: sólo lugares que funcionan para el plan completo, dentro del tope estricto y sin lo excluido', () => {
  const a = enEditor({ budget: 'b1000', noQuiero: ['cadena'] }); const p = a.getPlan(), ts = a.curTimes(p);
  p.stops.forEach((cur, i) => a.swapSuggest(i).forEach(v => { const st = p.stops.slice(); st[i] = v;
    assert(a.atHour(v, ts[i]) || a.funcionSinConfirmar(v), v.n + ' cerrado a esa hora'); assert(a.cabeEnTope(st, a.budgetMax(), ts).ok, v.n + ' saca al plan del tope');
    assert(['firme', 'estimado', 'libre'].indexOf(a.respaldoDe(v)) >= 0, v.n + ' sin precio respaldado con tope'); assert(!a.esCadenaCasual(v), 'cadena excluida: ' + v.n);
    assert(!p.stops.some((x, j) => j !== i && a.mismoLugar(x, v)), 'mismo lugar que otra parada: ' + v.n);
    if (i > 0) assert(a.alcanzaTramo(p.stops[i - 1], v, ts[i] - ts[i - 1]), 'no alcanza el trayecto hacia ' + v.n); }));
});

test('45.4 · "¿Qué hacemos después?": sugiere tipos que tienen sentido a esa hora; al agregar recalcula ruta y total', () => {
  const a = nueva({ who: 'amigos', groupSize: 4, vibes: ['foodie'], budget: 'any', zonas: ['roma'], planFrom: 19, planTo: 26 }); const C = a.cat();
  const cena = C.find(v => v.n === 'Castacán'); a.setState({ planCustom: { stops: [cena], times: [19.5], spent: cena.pp }, planStops: 1, planEditando: true, planView: 'edit' }); a.nav('plan');
  const D = a.sugerirDespues(); assert(D.length >= 2, 'casi no sugirió nada después de cenar: ' + D.map(d => d.lbl));
  assert(D.some(d => d.k === 'copas' || d.k === 'postre') && !D.some(d => d.k === 'comer' || d.k === 'tacos'), 'tipos sin sentido después de cenar: ' + D.map(d => d.lbl));
  D.forEach(d => { assert(a.atHour(d.v, d.t) && d.t >= 19.5 + a.duracionAct(cena) - 1e-6, d.lbl + ': ' + d.v.n + ' a una hora imposible'); assert(a.legKm(cena, d.v) <= 3, d.v.n + ' queda lejos'); });
  const antes = a.resumenPlan([cena], [19.5]); const V = a.renderVals(); assert(V.despuesOn && V.despues.length === D.length, 'no sale en pantalla');
  V.despues[0].add(); const p = a.getPlan(), rs = a.resumenPlan(p.stops, a.curTimes(p));
  assert(p.stops.length === 2 && p.stops[1].id === D[0].v.id && a.curTimes(p)[1] === D[0].t, 'no agregó la sugerencia a su hora');
  assert(rs.trasMin === D[0].min && (rs.costoNum > antes.costoNum || D[0].v.ppUnknown) && a.revisaPlan().ok, 'no recalculó ruta y total: ' + JSON.stringify(rs));
  // Después del antro sólo queda rematar con tacos (si hay taquería abierta), nunca otro museo o café.
  const b = enEditor(); const antro = b.cat().find(v => v.n === 'Patrick Miller'); b.setState({ planCustom: { stops: [antro], times: [23], spent: antro.pp }, planStops: 1 });
  b.sugerirDespues().forEach(d => assert(d.k === 'tacos' || d.k === 'comer', 'después del antro sugirió ' + d.lbl));
});

test('45.5 · quitar conserva las horas de las demás; agregar llega cuando de verdad se puede (fin de la anterior + trayecto)', () => {
  const a = enEditor(); const p0 = a.getPlan(), t0 = a.curTimes(p0); const extra = a.sugerirDespues()[0];
  if (extra) { a.addStop(extra.v); const p1 = a.getPlan(), t1 = a.curTimes(p1); const u = p0.stops.length - 1;
    assert(t1[t1.length - 1] >= t0[u] + a.duracionAct(p0.stops[u]) - 1e-6, 'la parada nueva empieza antes de que acabe la anterior'); a.removeStop(p1.stops.length - 1); }
  if (p0.stops.length >= 2) { a.removeStop(0); const p2 = a.getPlan(); assert(p2.stops.length === p0.stops.length - 1 && a.curTimes(p2)[0] === t0[1], 'al quitar se movieron las horas de las demás: ' + a.curTimes(p2) + ' vs ' + t0); }
});

test('45.6 · borrador: se guarda solo al editar, se retoma con los mismos lugares, horas y filtros, y se puede borrar', () => {
  const a = enEditor(); a.setStopTime(0, a.curTimes(a.getPlan())[0] + 0.25); a.fijar(a.getPlan().stops[0].id);
  const p = a.getPlan(), ts = a.curTimes(p).join(); const b0 = a.borradorLee(); assert(b0 && b0.c && /→/.test(b0.n), 'no guardó el borrador');
  const b = makeApp({}, { search: '?v=facil', estricto: true, storage: { sobres_borrador: a._store.sobres_borrador } }); b.ev = () => {};
  assert(b.renderVals().borradorOn && /Retomar tu borrador/.test(b.renderVals().borradorTxt), 'el inicio no ofrece retomar el borrador');
  assert(b.retomaBorrador(), 'no retomó'); const q = b.getPlan();
  assert(ids(q) === ids(p) && b.curTimes(q).join() === ts, 'el borrador no trae los mismos lugares y horas');
  assert(b.state.view === 'plan' && b.state.who === a.state.who && b.state.groupSize === a.state.groupSize && b.state.budget === a.state.budget && (b.state.fijadas || []).join() === p.stops[0].id, 'no restauró filtros o lo fijado');
  b.trashPlan(); assert(!b.borradorLee(), 'borrar el plan no borró el borrador');
  a.borraBorrador(); assert(!a.borradorLee() && !a._store.sobres_borrador, 'no se pudo borrar el borrador');
});

test('45.7 · el enlace de WhatsApp abre el MISMO plan (paradas, horas y costo) y avisa si lo cambias después de compartirlo', () => {
  const a = enEditor({ transporte: 'servicio' }); a.setStopTime(0, a.curTimes(a.getPlan())[0] + 0.5);
  const p = a.getPlan(), ts = a.curTimes(p); const costo = a.costoPlan(p.stops, ts);
  const url = a.tandaLinkDe([{ stops: p.stops, times: ts }]); assert(/\?p=/.test(url) && url.length < 600, 'enlace: ' + url);
  const b = makeApp({}, { estricto: true }); b.ev = () => {}; b.abrirTanda(decodeURIComponent(url.split('?p=')[1]), true);
  const q = (b.state.results.plans || [])[0]; assert(q && ids(q) === ids(p), 'el enlace no abre las mismas paradas');
  assert(q.times.join() === ts.join(), 'no llegan las mismas horas: ' + q.times + ' vs ' + ts);
  const c2 = b.costoPlan(q.stops, q.times); assert(c2.total === costo.total && c2.transporte === costo.transporte && b.state.groupSize === a.state.groupSize, 'no llega el mismo costo: $' + c2.total + ' vs $' + costo.total);
  assert(b.state.results.compartida && b.planOptId(q) === a.planOptId({ stops: p.stops }), 'los votos no quedarían en el mismo plan');
  // Versión: compartir y luego cambiar una parada.
  a.compartirUnPlan(); assert(!a.renderVals().versionOn, 'avisa de versión sin haber cambiado nada');
  const alt = a.swapSuggest(p.stops.length - 1)[0]; if (alt) { a.replaceStop(p.stops.length - 1, alt); const V = a.renderVals();
    assert(V.versionOn && /sigue viendo y votando la versión que mandaste/.test(V.versionTxt), 'no avisa que el grupo vota la versión anterior');
    assert(a.planOptId(a.getPlan()) !== a.planOptId({ stops: p.stops }), 'la versión nueva comparte id de votación con la anterior'); }
});

section('46 · Pasada profunda F5: hotspots con fecha y aprendizaje del usuario');

test('46.1 · hotspots: cada señal tiene tipo, fuente y fecha; lo reciente se apaga y lo viejo queda para revisión', () => {
  const a = nueva({}); const C = a.cat().filter(v => v.hot);
  C.forEach(v => a.senalesHot(v).forEach(x => { assert(['calidad', 'reciente', 'historica'].indexOf(x.tipo) >= 0 && x.fuente && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha), v.n + ': señal sin tipo, fuente o fecha'); assert(x.peso > 0 && x.peso <= 8.5, v.n + ': peso ' + x.peso); }));
  // La misma fuente pesa menos conforme envejece.
  const rec = C.find(v => a.senalesHot(v).some(x => x.tipo === 'reciente' && x.meses < 2)); assert(rec, 'no hay hotspot reciente para probar');
  const hoy = a.pesoHot(rec); const real = a.todayISO; a.todayISO = () => '2027-09-10'; const enDiezMeses = a.pesoHot(rec), revisar = a.senalesHot(rec).filter(x => x.tipo === 'reciente').every(x => x.revisar); a.todayISO = real;
  assert(enDiezMeses < hoy - 1 && revisar, 'una apertura de hace 10 meses pesa igual que hoy: ' + hoy + ' → ' + enDiezMeses);
  // Reseñas ≠ visitas: suman muy poco y nunca vuelven hotspot a un lugar que no lo es.
  const noHot = a.cat().find(v => !v.hot && v.otRc >= 500); if (noHot) assert(a.pesoHot(noHot) === 0, 'las reseñas solas lo volvieron hotspot');
  const viejos = C.filter(v => a.hotRevisar(v)); assert(viejos.length >= 10 && viejos.every(v => a.pesoHot(v) < 8.5), 'lo que hay que revisar pesa como nuevo');
  const fresco = C.find(v => a.senalesHot(v).some(x => x.tipo === 'calidad' && x.meses <= 12 && x.peso === 8.5)); assert(fresco && a.pesoHot(fresco) >= 8.5, 'un premio vigente perdió peso');
});

// Perfil que elige seguido lo mismo.
const tipoDe = (a, v) => a.cocinasPerfil(v).join(' ') + ' ' + v.cat;
const conHistorial = (a, re, veces, tipo) => { const vs = a.cat().filter(v => re.test(tipoDe(a, v)) && a.esRecomendable(v)).slice(0, 4); for (let i = 0; i < veces; i++) a.aprende(tipo || 'elegido', [vs[i % vs.length]], [20]); return vs; };
const afinDe = (a, ps, re) => ps.reduce((n, p) => n + p.stops.filter(v => re.test(tipoDe(a, v))).length, 0);

test('46.2 · perfil nuevo vs perfil que elige seguido mariscos, italiano o helado: más opciones afines, sin saltarse tope, zona ni «No quiero»', () => {
  [[/mariscos/, { vibes: ['foodie'], facilOpcion: 'cenar' }], [/italiana/, { vibes: ['foodie'], facilOpcion: 'cenar' }], [/Heladería/, { vibes: ['chill'], planFrom: 13, planTo: 20 }]].forEach(([re, st]) => {
    const base = Object.assign({ who: 'amigos', groupSize: 4, budget: 'b1999', zonas: ['roma', 'polanco'], noQuiero: ['cadena'], aceptaSinPrecio: true }, st); let nuevoN = 0, afinN = 0;
    [1, 2, 3].forEach(sd => { const n = busca(base, { dseed: sd, rseed: sd * 3 }); nuevoN += afinDe(n.a, n.ps, re);
      const b = nueva(base, { dseed: sd, rseed: sd * 3 }); conHistorial(b, re, 8); const r = b.runSearch({ nueva: true }); const ps = (r && r.plans) || [];
      afinN += afinDe(b, ps, re); const tope = b.budgetMax();
      ps.forEach(p => { assert(b.cabeEnTope(p.stops, tope, p.times).ok, re + ': el perfil se saltó el tope: ' + txt(p));
        p.stops.forEach(v => { assert(b.zoneList().indexOf(v.z) >= 0, re + ': el perfil se salió de la zona: ' + v.n); assert(!b.esCadenaCasual(v), re + ': el perfil metió una cadena excluida: ' + v.n); }); }); });
    assert(afinN > nuevoN, re + ': el perfil con historial no recibió más opciones afines (' + afinN + ' vs ' + nuevoN + ')');
  });
});

test('46.3 · elegir, sustituir, agregar y confirmar enseñan más que buscar; ver no enseña; lo quitado resta poco', () => {
  const a = nueva({ who: 'amigos' }); const C = a.cat(); const ita = C.find(v => a.cocinasPerfil(v).join() === 'italiana' && a.esRecomendable(v)), mar = C.find(v => a.cocinasPerfil(v).join() === 'mariscos' && a.esRecomendable(v)), hel = C.find(v => v.cat === 'Heladería');
  const W = a.PESO_PERFIL(); ['elegido', 'sustituido', 'agregado', 'guardado', 'voto'].forEach(k => assert(W[k] >= 4 && W[k] > W.compartido && W[k] > W.busqueda, k + ' no pesa más que compartir y buscar'));
  a.renderVals(); a.nav('results'); a.renderVals(); assert(!a.perfil().acciones && !Object.keys(a.perfil().sen.cat).length, 'ver pantallas enseñó algo');
  a.setState({ planCustom: { stops: [mar], times: [20], spent: mar.pp }, planStops: 1 }); a.replaceStop(0, ita);
  let S = a.perfil().sen; assert(S.cocina.italiana === 4 && !S.cocina.mariscos, 'sustituir no enseñó la cocina nueva: ' + JSON.stringify(S.cocina));
  a.aprende('agregado', [hel], [21.5]); assert(a.perfil().sen.cat['Heladería'] === 4, 'agregar una heladería no enseñó');
  a.aprende('elegido', [mar], [20]); const antes = a.perfil().sen.cocina.mariscos; a.aprende('quitado', [mar]); const des = a.perfil().sen.cocina.mariscos;
  assert(des < antes && des > 0, 'quitar una vez borró el gusto o no restó: ' + antes + ' → ' + des);
});

test('46.4 · por compañía: lo que eliges en una cita no manda cuando sales en familia; excluir hoy no se vuelve gusto', () => {
  const a = nueva({ who: 'date', groupSize: 2 }); const C = a.cat(); const bares = C.filter(v => v.cat === 'Bar de autor' && a.esRecomendable(v)).slice(0, 3), bar = C.find(v => v.cat === 'Bar de autor' && bares.indexOf(v) < 0), parque = C.find(v => v.cat === 'Parque');
  for (let i = 0; i < 6; i++) a.aprende('elegido', [bares[i % bares.length]], [21]);
  const enDate = a.afinidad(bar); a.setState({ who: 'familia', groupSize: 4 }); for (let i = 0; i < 6; i++) a.aprende('elegido', [parque], [13]);
  const enFam = a.afinidad(bar), parqueFam = a.afinidad(parque); a.setState({ who: 'date', groupSize: 2 }); const enDate2 = a.afinidad(bar), parqueDate = a.afinidad(parque);
  assert(enDate2 > enFam && parqueFam > parqueDate, 'la afinidad no distingue la compañía: bar date ' + enDate2 + ' / familia ' + enFam + ' · parque familia ' + parqueFam + ' / date ' + parqueDate);
  // «No quiero» es de esta salida: no entra al perfil ni lo borra.
  const antes = JSON.stringify(a.perfil().sen); a.toggleNoQuiero('bar'); a.runSearch({ nueva: true }); const S = a.perfil().sen;
  assert(S.cat['Bar de autor'] === JSON.parse(antes).cat['Bar de autor'], '«No quiero bares» cambió el gusto aprendido');
  (a.state.results.plans || []).forEach(p => p.stops.forEach(v => assert(a.DRINK.indexOf(v.cat) < 0 || a.esAntro(v), 'el gusto por los bares le ganó a «No quiero»: ' + v.n)));
});

test('46.5 · se puede reiniciar lo aprendido sin perder dieta ni edad; los votos de los amigos no son gustos propios', () => {
  const a = nueva({ who: 'amigos' }); const C = a.cat(); const p0 = a.perfil0(); p0.edad = '25-34'; p0.dieta = ['vegetariano']; a.perfilGuarda(p0);
  conHistorial(a, /italiana/, 6); assert(a.perfilTiene() && a.perfil().sen.cocina.italiana > 0, 'no aprendió');
  assert(typeof a.renderVals().reiniciarGustos === 'function', 'falta el botón para reiniciar');
  a.reiniciarGustos(); const p = a.perfil(); assert(!Object.keys(p.sen.cocina).length && !p.acciones && p.edad === '25-34' && p.dieta.join() === 'vegetariano', 'reiniciar borró de más o de menos: ' + JSON.stringify(p).slice(0, 200));
  // Abrir un enlace con los votos de otros no enseña nada.
  const b = nueva({}); b.runSearch({ nueva: true }); const url = b.tandaLinkDe(b.state.results.plans.slice(0, 1));
  const c = makeApp({}, { estricto: true }); c.ev = () => {}; const antes = JSON.stringify(c.perfil().sen); c.abrirTanda(decodeURIComponent(url.split('?p=')[1]), true);
  c.setState({ sync: { plans: [{ id: c.planOptId(c.state.results.plans[0]), votes: { Ana: 'sobres', Luis: 'sobres', Meli: 'nojalo' } }] } }); c.renderVals();
  assert(JSON.stringify(c.perfil().sen) === antes && !c.perfil().acciones, 'abrir un plan compartido o ver votos ajenos cambió el perfil');
});

test('46.6 · con historial suficiente, una de las tres opciones es una idea distinta a lo de siempre', () => {
  let conIdea = 0, total = 0;
  [1, 2, 3, 4].forEach(sd => { const a = nueva({ who: 'amigos', groupSize: 4, vibes: ['foodie', 'cultural'], budget: 'any', zonas: ['roma', 'juarez'], planFrom: 12, planTo: 20 }, { dseed: sd, rseed: sd * 7 });
    conHistorial(a, /Restaurante/, 10); const r = a.runSearch({ nueva: true }); const ps = (r && r.plans) || []; if (ps.length < 3) return; total++;
    const top = a.top(a.perfil().sen.cat, 2); const prin = p => p.stops.find(v => v.id === a.anclaDe(p.stops, p.acts)) || p.stops[0];
    if (ps.some(p => top.indexOf(prin(p).cat) < 0)) conIdea++; });
  assert(total >= 2 && conIdea === total, 'con historial, las tres fueron "lo de siempre" en ' + (total - conIdea) + ' de ' + total + ' tandas');
});

if (require.main === module) report();
