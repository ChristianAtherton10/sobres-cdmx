// Pruebas de regresión del lado consumidor de Sobres.
// Cubren las fallas reproducidas del reporte de QA: repetición, exclusiones,
// presupuesto, horarios y zona.  Correr con:  node test/motor.test.js
const { makeApp, test, assert, section, report, names, sig } = require('./harness.js');

const BASE = { who:'amigos', groupSize:4, zone:'santafe', zonesSel:['santafe'],
  when:'noche', budget:'b1000', budgetCustom:null, vibes:['foodie','nightlife'] };

const FRASE_QA = 'Somos 4 amigos en Santa Fe. Queremos cenar y tomar algo hoy de 8 pm a ' +
  'medianoche con maximo 1000 por persona. Dame algo diferente, no quiero Puerto Madero ' +
  'ni Sonora Grill ni Cinepolis. Prefiero caminar y quedarme en Santa Fe.';

// ───────────────────────── 1. Variedad ─────────────────────────
section('1 · Variedad (antes: Rehacer alternaba entre 2 planes)');

// Santa Fe de noche ya no sirve para medir variedad: sin cine sin función, con
// cena obligatoria y tramos cortos, ahí sólo hay ~14 combinaciones válidas.
const BASE_VARIEDAD = { who:'amigos', groupSize:4, zone:'juarez', zonesSel:['juarez'], when:'noche',
  budget:'b1000', budgetCustom:null, vibes:['foodie'] };
test('10 Rehacer seguidos dan 10 combinaciones distintas', () => {
  const app = makeApp(BASE_VARIEDAD, { dseed: 1234 });
  app.runSearch();                 // como en la app real: fija el contexto de búsqueda
  app.state.planStops = 2;
  const vistos = new Set();
  for (let i = 0; i < 10; i++) { vistos.add(sig(app.getPlan())); app.regenerate(); }
  assert(vistos.size === 10, 'sólo ' + vistos.size + ' combinaciones distintas de 10');
});

test('el historial se mantiene entre Rehacer, Sorpréndeme y "dame algo diferente"', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  app.runSearch(); app.state.planStops = 2;
  const vistos = new Set(); const dup = [];
  const anota = etq => { const p = app.getPlan(); if (!p) return; const f = sig(p);
    // repetir sólo vale si el motor ya avisó que se agotaron las combinaciones
    const r0 = app.state.results || {};
    const agotado = r0.exhausted || app._aiExhausted || r0.soloRecombina || !!r0.avisoCompartida;
    if (vistos.has(f) && !agotado) dup.push(etq);
    vistos.add(f); };
  anota('inicial');
  for (let i = 0; i < 9; i++) { app.regenerate(); anota('rehacer' + i); }
  // editar a mano y seguir regenerando
  const cur = app.getPlan();
  const otro = app.state.results.ranked.find(v => !cur.stops.includes(v));
  app.setState({ planCustom: { stops: [cur.stops[0], otro], times: cur.times, spent: cur.stops[0].pp + otro.pp } });
  for (let i = 0; i < 3; i++) { app.regenerate(); anota('tras-editar' + i); }
  for (let i = 0; i < 3; i++) { app.runSearch({ surprise: true }); anota('sorpresa' + i); }
  for (let i = 0; i < 3; i++) { app.aiBuild('dame algo diferente, 4 amigos en santa fe hoy en la noche, maximo 1000 por persona'); anota('ai' + i); }
  assert(dup.length === 0, 'repitió sin avisar en: ' + dup.join(', '));
});

// Enumera, con reglas propias (no las del motor), todas las combinaciones de dos
// paradas válidas: zona + horario + presupuesto + un tipo de parada distinto.
// Enumerador INDEPENDIENTE del motor: recorre el catálogo entero por fuerza
// bruta aplicando sólo las restricciones DECLARADAS (zona, poder hacer la
// actividad a esa hora, compatibilidad de vibra, consumo + propina dentro del
// tope, tramo alcanzable y no repetir función). No usa la selección del motor,
// así que sirve para medir si el motor deja combinaciones válidas sin mostrar.
function combinacionesValidas(app) {
  const r = app.state.results;
  const max = app.budgetMax();
  const rng = app.range();
  const n = Math.max(2, Math.min(5, Math.round((rng[1] - rng[0]) / 2.2)));
  const step = (rng[1] - rng[0]) / n;
  const t0 = rng[0], t1 = rng[0] + step;
  const excl = app.exclSet();
  const VM = app.vibeModel();
  const pool = app.cat().filter(v => !excl.has(v.id) && app.budgetOk(v) && app.timingOk(v)
    && r.zones.includes(v.z) && app.vibeAdmite(v, VM) && !v.cursoCerrado
    && app.esRecomendable(v) && !app.funcionSinConfirmar(v));
  // Regla declarada: si la ventana cruza al menos una hora de comida (13–16:30)
  // o cena (19–22:30), el plan incluye comer.
  const solapa = (a, b) => Math.max(0, Math.min(rng[1], b) - Math.max(rng[0], a));
  const pideComida = !app.state.yaComimos && max >= 150 && (solapa(13, 16.5) >= 1 || solapa(19, 22.5) >= 1);
  const comer = k => k === 'comida' || k === 'cena';
  // Actividades posibles en cada momento, según la tabla declarada.
  const actsEn = (v, t) => app.actsUtiles(v, VM)
    .filter(k => (app.SEGACT[app.segFor(t)] || []).indexOf(k) >= 0);
  const A = pool.filter(v => actsEn(v, t0).length && app.atHour(v, t0));
  const B = pool.filter(v => actsEn(v, t1).length && app.atHour(v, t1));
  const out = new Set();
  A.forEach(a => B.forEach(b => {
    if (a.id === b.id) return;
    // Reglas declaradas de la guía: el antro cierra la noche (nunca va primero)
    // y cada estancia completa tiene que caber en la ventana pedida.
    if (app.esAntro(a)) return;
    if (!app.cabeEnVentana(a, t0, rng[1]) || !app.cabeEnVentana(b, t1, rng[1])) return;
    // ¿Existe algún par de actividades con función distinta?
    const xa = actsEn(a, t0), xb = actsEn(b, t1);
    const par = xa.some(i => xb.some(j => app.funcionAct(i, t0) !== app.funcionAct(j, t1) && (!pideComida || comer(i) || comer(j))));
    if (!par) return;
    { const m = app.minutosTramo(app.legKm(a, b)); if (m != null && m > app.MAX_TRAMO()) return; }
    if (!app.cabeEnTope([a, b], max).ok) return;
    const km = app.legKm(a, b);
    if (km != null) {
      const min = app.minutosTramo(km);
      if (min != null && app.duracionAct(a) * 60 + min > (t1 - t0) * 60 + 21) return;
    }
    out.add([a.id, b.id].sort().join('|'));
  }));
  return out;
}

test('muestra TODAS las combinaciones válidas antes de repetir una', () => {
  // Ventana corta a propósito: así el motor arma planes de DOS paradas y el
  // universo enumerado es comparable uno a uno con lo que ofrece.
  const app = makeApp(Object.assign({}, BASE_VARIEDAD, { planFrom: 19, planTo: 23 }), { dseed: 1234 });
  app.runSearch(); app.state.planStops = 2;
  const validas = combinacionesValidas(app);
  assert(validas.size > 20, 'el universo medido es sospechosamente chico: ' + validas.size);
  const vistas = new Set();
  let repitioCon = null;
  // Cada tanda ofrece 3; se dan vueltas de sobra para recorrer el universo medido.
  const vueltas = Math.max(40, validas.size);
  for (let i = 0; i < vueltas; i++) {
    const ofrecidos = (app.state.results.plans || []).map(p => app.comboSig(p.stops));
    const nuevos = ofrecidos.filter(f => !vistas.has(f));
    if (ofrecidos.length && !nuevos.length && repitioCon === null) {
      repitioCon = [...validas].filter(f => !vistas.has(f)).length;
      assert(app.state.results.exhausted, 'repitió sin avisar, en el paso ' + i);
    }
    ofrecidos.forEach(f => vistas.add(f));
    app.regenerate();
  }
  const sinMostrar = [...validas].filter(f => !vistas.has(f));
  assert(sinMostrar.length === 0, sinMostrar.length + ' combinaciones válidas nunca se mostraron');
  assert(repitioCon === null || repitioCon === 0,
    'repitió cuando aún quedaban ' + repitioCon + ' alternativas válidas');
});

test('al repetir, siempre lo avisa y nombra la restricción que limita', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  app.runSearch(); app.state.planStops = 2;
  const vistos = new Set();
  for (let i = 0; i < 60; i++) {
    const p = app.getPlan(); if (!p) break;
    const f = sig(p);
    if (vistos.has(f)) {
      assert(app.state.results.exhausted, 'repitió en el paso ' + i + ' sin avisar');
      const nota = app.state.results.expandNote || '';
      assert(/zona|presupuesto|horario|exclusiones/.test(nota), 'la nota no nombra la restricción: ' + nota);
      assert(/amplía/i.test(nota), 'la nota no ofrece ampliar: ' + nota);
      return;
    }
    vistos.add(f); app.regenerate();
  }
});

test('reordenar las mismas paradas NO cuenta como plan nuevo', () => {
  const app = makeApp(BASE, { dseed: 7 });
  const a = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
  const b = [{ id: 'z' }, { id: 'x' }, { id: 'y' }];
  assert(app.comboSig(a) === app.comboSig(b), 'la firma debería ignorar el orden');
});

test('el motor devuelve 3 planes distintos para comparar', () => {
  const app = makeApp(BASE, { dseed: 55 });
  const r = app.engine(0);
  assert(r.plans.length === 3, 'devolvió ' + r.plans.length + ' planes');
  assert(new Set(r.plans.map(p => p.sig)).size === r.plans.length, 'hay planes repetidos entre sí');
});

test('la primera tanda visible es de 12 lugares', () => {
  const app = makeApp(BASE, { dseed: 9 });
  app.runSearch();
  assert(app.state.visibleCount === 12, 'visibleCount = ' + app.state.visibleCount);
  assert(app.state.results.venues.length >= 12, 'sólo ' + app.state.results.venues.length + ' candidatos');
});

test('al agotarse las combinaciones lo dice, no relaja filtros en silencio', () => {
  const app = makeApp({ ...BASE, zone:'santafe', zonesSel:['santafe'], budget:'b300' }, { dseed: 3 });
  let aviso = false;
  app.state.results = app.engine(0);
  for (let i = 0; i < 40; i++) { app.regenerate(); if (app.state.results.exhausted) { aviso = true; break; } }
  if (aviso) assert(/amplía/i.test(app.state.results.expandNote || ''), 'no explicó cómo ampliar');
});

// ───────────────────────── 2. Exclusiones ─────────────────────────
section('2 · Negaciones y exclusiones');

test('"no quiero X ni Y ni Z" excluye, no pide', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  const p = app.aiParse(FRASE_QA);
  assert(p.named.length === 0, 'tomó como pedidos: ' + p.named.map(x => x.v.n));
  const marcas = p.excluded.map(v => v.n.toLowerCase()).join(' ');
  ['puerto madero', 'sonora grill', 'cinépolis'].forEach(m =>
    assert(marcas.includes(m), 'no excluyó ' + m));
});

test('una marca excluida arrastra todas sus sucursales', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  const p = app.aiParse(FRASE_QA);
  const sonoras = p.excluded.filter(v => /sonora grill/i.test(v.n));
  assert(sonoras.length >= 2, 'sólo excluyó ' + sonoras.length + ' sucursal(es) de Sonora Grill');
});

test('el plan generado NO contiene ningún lugar excluido', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  app.aiBuild(FRASE_QA);
  const malos = app.state.planCustom.stops.filter(v => /puerto madero|sonora grill|cinepolis|cinépolis/i.test(v.n));
  assert(malos.length === 0, 'metió prohibidos: ' + malos.map(v => v.n));
});

test('una petición en positivo no excluye nada', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  const p = app.aiParse('quiero ir a un museo y luego cenar mariscos en la roma');
  assert(p.excluded.length === 0, 'excluyó de más: ' + p.excluded.map(v => v.n));
});

test('nombres comunes no se confunden con lugares ("somos 4", "prefiero caminar")', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  const p = app.aiParse(FRASE_QA);
  const falsos = p.named.concat(p.excluded.map(v => ({ v })))
    .filter(x => /somos voces|caminar masaryk|santa clara|máximo bistrot/i.test(x.v.n));
  assert(falsos.length === 0, 'falsos positivos: ' + falsos.map(x => x.v.n));
});

test('los lugares pedidos por nombre sí se reconocen', () => {
  const app = makeApp({ ...BASE, zone:'roma', zonesSel:['roma'] }, { dseed: 1234 });
  const p = app.aiParse('manana con mis amigos por la roma, un museo, comer mariscos, drinks en Bar Orbita y cerrar en Departamento');
  const n = p.named.map(x => x.v.n.toLowerCase()).join(' ');
  assert(n.includes('órbita') && n.includes('departamento'), 'reconoció: ' + n);
});

// ───────────────────────── 3. Presupuesto ─────────────────────────
section('3 · Presupuesto');

test('ningún plan excede el tope, en todos los rangos y zonas', () => {
  const zonas = ['roma', 'polanco', 'coyoacan', 'santafe'];
  const topes = ['b300', 'b600', 'b1000'];
  const malos = [];
  zonas.forEach(z => topes.forEach(b => {
    const app = makeApp({ ...BASE, zone: z, zonesSel: [z], budget: b }, { dseed: 42 });
    const max = app.budgetMax();
    app.engine(0).plans.forEach(p => { if (p.spent > max) malos.push(z + '/' + b + ' = $' + p.spent + ' > $' + max); });
  }));
  assert(malos.length === 0, malos.join('; '));
});

test('tras 10 regeneraciones sigue sin excederse', () => {
  const app = makeApp({ ...BASE, budget: 'b600' }, { dseed: 8 });
  const max = app.budgetMax();
  app.state.results = app.engine(0); app.state.planStops = 2;
  for (let i = 0; i < 10; i++) {
    const p = app.getPlan();
    assert(p.spent <= max, 'regeneración ' + i + ': $' + p.spent + ' > $' + max);
    app.regenerate();
  }
});

test('el plan de la IA respeta el tope del itinerario completo', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  app.aiBuild(FRASE_QA);
  const total = app.state.planCustom.stops.reduce((a, v) => a + v.pp, 0);
  assert(total <= 1000, 'total $' + total + ' > $1000');
});

test('si no cabe en el presupuesto, lo dice en vez de prometerlo', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  app.aiBuild('cena en polanco hoy de 8pm a 11pm con maximo 50 pesos por persona');
  const t = app.state.aiSummary || '';
  const total = (app.state.planCustom.stops || []).reduce((a, v) => a + v.pp, 0);
  assert(total <= 50 || /⚠️|no hay suficientes/.test(t), 'prometió un total que no cumple: ' + t);
});

test('ampliar el plan a 3, 4 o 5 paradas no rompe el presupuesto', () => {
  // extendPlan rellenaba hasta N paradas permitiendo max * 1.5, y si nada cabía
  // metía el primer candidato a cualquier precio.
  ['b300', 'b600', 'b1000'].forEach(b => {
    const app = makeApp({ ...BASE, budget: b }, { dseed: 64 });
    const max = app.budgetMax();
    app.state.results = app.engine(0);
    [1, 2, 3, 4, 5].forEach(n => {
      app.state.planStops = n;
      const p = app.getPlan();
      if (!p) return;
      assert(p.spent <= max, b + ' con ' + n + ' paradas: $' + p.spent + ' > $' + max);
    });
  });
});

// ───────────────────────── 4. Horarios ─────────────────────────
section('4 · Horarios');

test('"de 8 pm a medianoche" se entiende como 20→24', () => {
  const app = makeApp(BASE, { dseed: 1 });
  const p = app.aiParse('hoy de 8 pm a medianoche');
  assert(p.from === 20 && p.to === 24, 'entendió ' + p.from + '→' + p.to);
});

test('ninguna parada cae en un horario en que el lugar está cerrado', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  app.aiBuild(FRASE_QA);
  const pc = app.state.planCustom;
  pc.stops.forEach((v, i) => assert(app.atHour(v, pc.times[i]),
    v.n + ' (' + v.oh[0] + '-' + v.oh[1] + ') propuesto a las ' + app.time12(pc.times[i])));
});

test('un parque que cierra a las 20h no se propone de noche', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  app.aiBuild(FRASE_QA);
  const tarde = app.state.planCustom.stops.filter((v, i) => app.state.planCustom.times[i] >= 21 && v.oh[1] <= 20);
  assert(tarde.length === 0, 'propuso cerrado: ' + tarde.map(v => v.n));
});

// ───────────────────────── 5. Zona ─────────────────────────
section('5 · Zona');

test('los resultados respetan la zona elegida', () => {
  ['roma', 'polanco', 'coyoacan', 'santafe'].forEach(z => {
    const app = makeApp({ ...BASE, zone: z, zonesSel: [z] }, { dseed: 11 });
    const r = app.engine(0);
    const fuera = r.venues.filter(v => !r.zones.includes(v.z));
    assert(fuera.length === 0, z + ' trajo lugares de ' + [...new Set(fuera.map(v => v.z))]);
  });
});

test('cambiar de zona no arrastra lugares de la búsqueda anterior', () => {
  const app = makeApp({ ...BASE, zone:'santafe', zonesSel:['santafe'] }, { dseed: 21 });
  app.runSearch();
  const antes = app.state.results.venues.map(v => v.id);
  app.setState({ zone:'polanco', zonesSel:['polanco'] });
  app.runSearch();
  const ahora = app.state.results.venues;
  assert(ahora.every(v => v.z === 'polanco' || app.state.results.zones.includes(v.z)),
    'quedaron lugares de otra zona');
  assert(ahora.filter(v => antes.includes(v.id)).length === 0 || ahora.every(v => v.z !== 'santafe'),
    'arrastró lugares de Santa Fe');
});

test('la etiqueta de zona y los resultados vienen del mismo dato', () => {
  // Reproduce el flujo del mapa y de los demos: antes se cambiaba `zone` pero se
  // dejaba `zonesSel` de la búsqueda anterior, así que la ficha decía Coyoacán
  // y los resultados eran de Roma.
  const app = makeApp({ ...BASE, zone:'roma', zonesSel:['roma'] }, { dseed: 31 });
  app.runSearch();
  app.setState({ zone: 'coyoacan', zonesSel: ['coyoacan'] });
  app.runSearch();
  const r = app.state.results;
  assert(app.zoneList().join() === 'coyoacan', 'zoneList quedó en ' + app.zoneList());
  assert(/coyoac/i.test(app.zonesLabel()), 'la etiqueta dice ' + app.zonesLabel());
  const fuera = r.venues.filter(v => !r.zones.includes(v.z));
  assert(fuera.length === 0, 'resultados de otra zona: ' + [...new Set(fuera.map(v => v.z))]);
});

// ───────────────────────── 6. Guardar y recuperar planes ─────────────────────────
section('6 · Guardar y recuperar planes');

const planGuardable = (dseed = 1234) => {
  const app = makeApp(BASE, { dseed });
  app.runSearch(); app.state.planStops = 2;
  return app;
};

test('guardar hace una copia completa, no dos cadenas de texto', () => {
  const app = planGuardable();
  app.renderVals().savePlan();
  const sp = app.state.savedPlans[0];
  ['stopIds', 'times', 'spent', 'date', 'people', 'who', 'transporte', 'zone', 'from', 'to']
    .forEach(k => assert(sp[k] !== undefined, 'falta el campo ' + k));
  assert(sp.stopIds.length === 2, 'guardó ' + sp.stopIds.length + ' paradas');
});

test('regenerar el borrador NO altera el plan guardado', () => {
  const app = planGuardable();
  const antes = names(app.getPlan()).join(' → ');
  app.renderVals().savePlan();
  for (let i = 0; i < 4; i++) app.regenerate();
  assert(names(app.getPlan()).join(' → ') !== antes, 'el borrador no cambió, la prueba no sirve');
  assert(app.state.savedPlans[0].route === antes, 'el guardado se contaminó: ' + app.state.savedPlans[0].route);
});

test('abrir un guardado recupera exactamente esa copia', () => {
  const app = planGuardable();
  const original = names(app.getPlan()).join(' → ');
  const horas = (app.getPlan().times || []).slice();
  app.renderVals().savePlan();
  for (let i = 0; i < 4; i++) app.regenerate();
  app.renderVals().savedPlans[0].open();
  const abierto = app.getPlan();
  assert(names(abierto).join(' → ') === original, 'abrió ' + names(abierto).join(' → '));
  assert(JSON.stringify((abierto.times || []).slice(0, 2)) === JSON.stringify(horas.slice(0, 2)), 'no restauró las horas');
});

test('el guardado sobrevive a recargar la página', () => {
  const app = planGuardable();
  const original = names(app.getPlan()).join(' → ');
  app.renderVals().savePlan();
  const app2 = makeApp(BASE, { dseed: 1234, storage: app._store });   // recarga
  assert(app2.state.savedPlans.length === 1, 'no persistió');
  app2.runSearch();
  app2.renderVals().savedPlans[0].open();
  assert(names(app2.getPlan()).join(' → ') === original, 'tras recargar abrió otra cosa');
});

test('el guardado conserva el presupuesto con el que se armó', () => {
  const app = makeApp({ ...BASE, budget: 'b1k', budgetCustom: 1000, view: 'plan' }, { dseed: 9 });
  app.runSearch(); app.state.view = 'plan'; app.state.planStops = 2;
  app.renderVals().savePlan();
  const g = app.state.savedPlans[0];
  assert(g.budgetCustom === 1000, 'no guardó el tope: ' + g.budgetCustom);
  // recarga con otro tope activo
  const b = makeApp({ ...BASE, budget: 'b600', budgetCustom: null }, { dseed: 9, storage: app._store });
  b.runSearch(); b.state.view = 'plan';
  b.renderVals().savedPlans[0].open(); b.state.view = 'plan';
  assert(b.budgetMax() === 1000, 'tras abrir muestra tope $' + b.budgetMax() + ' en vez de $1000');
  const tot = b.costoPlan(b.getPlan().stops);
  assert(tot.consumo === g.spent, 'el costo al abrir (' + tot.consumo + ') no coincide con el guardado (' + g.spent + ')');
});

test('guardar dos veces el mismo plan no lo duplica', () => {
  const app = planGuardable();
  app.renderVals().savePlan();
  app.renderVals().savePlan();
  assert(app.state.savedPlans.length === 1, 'quedaron ' + app.state.savedPlans.length);
});

test('borrar un guardado no toca los demás', () => {
  const app = planGuardable();
  app.renderVals().savePlan();
  app.regenerate(); app.renderVals().savePlan();
  assert(app.state.savedPlans.length === 2, 'esperaba 2 guardados');
  const queda = app.state.savedPlans[1].route;
  app.renderVals().savedPlans[0].del();
  assert(app.state.savedPlans.length === 1 && app.state.savedPlans[0].route === queda, 'borró el equivocado');
});

// ───────────────────────── 7. Catálogo y paradas manuales ─────────────────────────
section('7 · Catálogo y paradas manuales');

test('una parada manual no inventa precio, horario ni ubicación', () => {
  const app = makeApp(BASE, { dseed: 5 });
  const ex = app.mkExt('ext-1', 'Casa de mi primo');
  assert(ex.ppUnknown === true, 'no marcó el precio como desconocido');
  assert(app.precioTxt(ex) === 'Precio por confirmar', 'muestra "' + app.precioTxt(ex) + '"');
  assert(ex.lat === null && ex.lng === null, 'le inventó coordenadas');
  assert(ex.sinUbicacion === true, 'no marcó que falta ubicación');
});

test('sin ubicación válida no se calcula ruta', () => {
  const app = makeApp(BASE, { dseed: 5 });
  const ex = app.mkExt('ext-1', 'Casa de mi primo');
  const real = app.cat()[0];
  assert(app.legKm(ex, real) === null, 'calculó distancia sin ubicación');
  assert(app.minutosTramo(app.legKm(ex, real)) === null, 'calculó tiempo sin ubicación');
});

test('el precio se muestra con su procedencia, no como cifra firme', () => {
  const app = makeApp(BASE, { dseed: 5 });
  // Verificado contra taquilla: se afirma.
  assert(app.precioTxt({ pp: 0, pEstado: 'verificado', pMin: 0, pMax: 0 }) === 'Entrada libre (verificado)',
    app.precioTxt({ pp: 0, pEstado: 'verificado', pMin: 0, pMax: 0 }));
  assert(/verificado/.test(app.precioTxt({ pp: 160, pEstado: 'verificado', pMin: 60, pMax: 320 })));
  // Valor por defecto de la categoría: se marca como estimado.
  assert(app.precioTxt({ pp: 0, pEstado: 'inferido' }) === 'Entrada libre (estimado)');
  assert(app.precioTxt({ pp: 450, pEstado: 'inferido' }) === '~$450 pp (estimado)');
  // Sin evidencia: nunca "Gratis".
  const t = app.precioTxt({ pp: 0, ppUnknown: true, pFalta: 'cover' });
  assert(t === 'Precio por confirmar', t);
  assert(!/gratis/i.test(t), 'un precio desconocido no puede decir Gratis');
});

test('los precios auditados sustituyen al valor por defecto de la categoría', () => {
  const app = makeApp(BASE, { dseed: 5 });
  const byId = id => app.cat().find(v => v.id === id);
  const frida = byId('cdmx-0200');
  assert(frida.pp === 160 && frida.ppAnterior === 85, 'Frida Kahlo: ' + frida.pp + ' (antes ' + frida.ppAnterior + ')');
  assert(frida.pEstado === 'verificado' && frida.pFuente && frida.pUrl, 'falta fuente verificable');
  const antro = byId('cdmx-0161');
  assert(antro.pp === 105 && antro.pEstado === 'verificado', 'Antropología: ' + antro.pp);
  const sou = byId('cdmx-0151');
  assert(sou.pp === 0 && sou.pEstado === 'verificado', 'Soumaya es gratis y el defecto le cobraba $85');
  // El caso que reportó el usuario.
  const ultra = byId('cdmx-2135');
  assert(ultra.pp === 1000 && ultra.pMax === 1500 && ultra.ppAnterior === 550, 'Ultramarinos: ' + ultra.pp);
  assert(ultra.addr.indexOf('Mérida') >= 0, 'la dirección también estaba mal: ' + ultra.addr);
  assert(ultra.oh[1] === 20, 'el horario también estaba mal: cierra a las ' + ultra.oh[1]);
  // Six Flags estaba por DEBAJO del mínimo real.
  const sf = byId('cdmx-2091');
  assert(sf.pp >= 1100 && sf.ppAnterior === 900, 'Six Flags: ' + sf.pp);
});

test('un precio estimado no se presenta como total seguro', () => {
  const app = makeApp(BASE, { dseed: 5 });
  const inf = app.cat().filter(v => v.pEstado === 'inferido' && !v.ppUnknown).slice(0, 2);
  const c = app.costoPlan(inf);
  assert(!c.seguro, 'un total apoyado en valores por defecto no puede declararse seguro');
  assert(c.estimados.some(x => /estimad/.test(x)), 'debe decir que hay precios estimados: ' + c.estimados);
  const ver = [app.cat().find(v => v.id === 'cdmx-0151')];
  const c2 = app.costoPlan(ver);
  assert(c2.inferidos.length === 0, 'el verificado no cuenta como estimado');
});

test('no quedan duplicados del mismo lugar en el catálogo', () => {
  const app = makeApp(BASE, { dseed: 5 });
  const cat = app.cat().filter(v => v.lat && v.lng);
  const raiz = n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[·,.]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').sort().join(' ');
  const dups = [];
  const m = {};
  cat.forEach(v => { const k = raiz(v.n) + '|' + v.z + '|' + v.cat; if (m[k]) dups.push(v.n); else m[k] = v; });
  assert(dups.length === 0, 'duplicados: ' + dups.join(', '));
});

test('detecta quién sirve copas por datos, no sólo por categoría', () => {
  const app = makeApp({ ...BASE, zone: 'santafe', zonesSel: ['santafe'] }, { dseed: 1 });
  const cerv = app.cat().find(v => /Cervecería de Barrio · Santa Fe/.test(v.n));
  assert(app.sirveCopas(cerv) === 'si', 'no reconoce una cervecería: ' + app.sirveCopas(cerv));
  const museo = app.cat().find(v => v.cat === 'Museo');
  assert(app.sirveCopas(museo) === 'no', 'cree que un museo sirve copas');
  const foro = app.cat().find(v => /Auditorio Ángel Palerm/.test(v.n));
  assert(app.sirveCopas(foro) === 'no', 'la etiqueta nightlife de un foro no debe contar');
});

test('una zona sin bares no se da por vacía: busca quién sí sirve', () => {
  const app = makeApp(BASE, { dseed: 1 });
  // Se busca sola una zona que de verdad no tenga bares, para que la prueba no
  // dependa de cómo esté el catálogo hoy.
  const zonas = app.ZONES.map(z => z[0]);
  const sinBares = zonas.filter(z => app.cat().filter(v => v.z === z && app.DRINK.includes(v.cat)).length === 0);
  assert(sinBares.length > 0, 'ya no hay ninguna zona sin bares: la prueba necesita otra premisa');
  sinBares.forEach(z => {
    const o = app.opcionesCopas([z]);
    const comeYbebe = app.cat().filter(v => v.z === z && app.sirveCopas(v) !== 'no');
    if (comeYbebe.length) {
      assert(o.seguras.length + o.posibles.length > 0,
        z + ': con 0 bares concluyó que nadie sirve copas, teniendo ' + comeYbebe.length + ' candidatos');
    }
  });
});

test('cena + copas en Santa Fe: lo cumple o lo explica, nunca lo sustituye callado', () => {
  ['600', '1000'].forEach(tope => {
    const app = makeApp({ ...BASE, zone: 'santafe', zonesSel: ['santafe'] }, { dseed: 1234 });
    app.aiBuild('4 amigos en santa fe hoy, cenar y tomar algo de 8pm a medianoche, maximo ' + tope + ' por persona');
    const stops = app.state.planCustom.stops;
    const resumen = app.state.aiSummary || '';
    const hayCopas = stops.some(v => app.sirveCopas(v) === 'si');
    const esBar = stops.some(v => app.DRINK.includes(v.cat) || v.cat === 'Cantina');
    if (hayCopas && esBar) {
      // Santa Fe ya tiene bares en el catálogo: se cumple sin advertencias.
      assert(!/⚠️/.test(resumen), 'advirtió sin motivo: ' + resumen);
      assert(stops.some(v => app.CATS_MESA().includes(v.cat)) || /No alcanzó el presupuesto para comida/.test(resumen),
        'pidió cenar, no hay restaurante y no lo explicó: ' + stops.map(v => v.n) + ' · ' + resumen);
    } else if (hayCopas) {
      assert(/sirve|bar/i.test(resumen), 'cumplió pero no lo explicó: ' + resumen);
    } else {
      assert(/⚠️|No pude incluir/.test(resumen), 'no cumplió y no lo dijo (tope ' + tope + '): ' + resumen);
      assert(/ampliar|zona vecina|presupuesto|hora/i.test(resumen), 'no ofreció alternativas: ' + resumen);
    }
  });
});

test('donde SÍ hay bares, no inventa una advertencia', () => {
  const app = makeApp({ ...BASE, zone: 'roma', zonesSel: ['roma'] }, { dseed: 1234 });
  app.aiBuild('4 amigos en la roma hoy, cenar y tomar algo de 8pm a medianoche, maximo 1000 por persona');
  const stops = app.state.planCustom.stops;
  assert(stops.some(v => app.sirveCopas(v) === 'si'), 'en Roma no puso dónde tomar algo');
  assert(!/⚠️/.test(app.state.aiSummary || ''), 'advirtió sin motivo: ' + app.state.aiSummary);
});

// ───────────────────────── 8. Transporte ─────────────────────────
section('8 · Transporte');

test('el tiempo de trayecto cambia con el transporte', () => {
  const app = makeApp(BASE, { dseed: 5 });
  const t = {};
  ['caminando', 'metro', 'uber', 'propio'].forEach(m => { app.state.transporte = m; t[m] = app.minutosTramo(4.5); });
  assert(t.caminando > t.uber * 2, 'caminando ' + t.caminando + ' vs uber ' + t.uber + ': no distingue');
  assert(t.metro !== t.uber, 'metro y uber dan lo mismo');
});

test('los textos nombran al proveedor correcto', () => {
  const app = makeApp(BASE, { dseed: 5 });
  // SOBRES ya no nombra marcas de viaje: Uber y DiDi guardados en planes viejos
  // se leen como "servicio de transporte".
  app.state.transporte = 'servicio'; assert(app.provNombre() === 'servicio de transporte', app.provNombre());
  app.state.transporte = 'didi'; assert(app.provNombre() === 'servicio de transporte', app.provNombre());
  app.state.transporte = 'uber'; assert(app.provNombre() === 'servicio de transporte', app.provNombre());
  app.state.transporte = 'metro'; assert(app.provNombre() === 'transporte público', app.provNombre());
  app.state.transporte = 'propio'; assert(app.provNombre() === 'tu coche', app.provNombre());
  app.state.transporte = 'caminando'; assert(app.provNombre() === 'a pie', app.provNombre());
});

// ───────────────────────── 8b. Costos, horarios y zona horaria ─────────────────
section('8b · Costos, horarios y zona horaria');

const conPlan = (extra) => {
  const app = makeApp({ ...BASE, zone: 'roma', zonesSel: ['roma'], ...(extra || {}) }, { dseed: 1234 });
  app.runSearch(); app.state.planStops = 2; app.state.view = 'plan';
  return app;
};

test('el total no se presenta como completo si faltan costos', () => {
  const app = conPlan();
  app.state.transporte = 'uber';
  const c = app.costoPlan(app.getPlan().stops);
  assert(c.completo === false, 'dio por completo un total sin transporte');
  assert(c.faltan.some(x => /transporte/i.test(x)), 'no dice que falta el transporte: ' + c.faltan);
  const V = app.renderVals();
  assert(/^desde \$/.test(V.planTotal), 'lo presenta como total cerrado: ' + V.planTotal);
  assert(/NO incluye/.test(V.planMeta), 'no lista lo que falta: ' + V.planMeta);
});

test('a pie desaparece el hueco del transporte y se estima propina', () => {
  const app = conPlan();
  app.state.transporte = 'caminando';
  const stops = app.getPlan().stops;
  const c = app.costoPlan(stops);
  assert(!c.faltan.some(x => /transporte/i.test(x)), 'a pie no debería faltar transporte: ' + c.faltan);
  assert(c.propina > 0, 'no estimó propina');
  assert(c.total === c.consumo + c.propina, 'el total no cuadra');
  assert(app.renderVals().planMeta.includes('propina'), 'no muestra la propina');
  // Sin lugares de cover desconocido ni precio por confirmar, el total sí cierra
  const cerrados = stops.filter(v => !['Antro', 'Salón de baile', 'Espectáculo'].includes(v.cat) && !v.ppUnknown);
  if (cerrados.length === stops.length) assert(c.completo === true, 'faltan: ' + c.faltan.join(', '));
});

test('una parada sin precio se identifica, no se suma como gratis', () => {
  const app = conPlan();
  const ex = app.mkExt('ext-9', 'Casa de mi primo');
  const c = app.costoPlan([...app.getPlan().stops, ex]);
  assert(c.faltan.some(x => /sin precio/.test(x)), 'no avisa del precio desconocido: ' + c.faltan);
  assert(c.completo === false);
});

test('la hora y la fecha salen de America/Mexico_City', () => {
  const app = conPlan();
  const a = app.ahoraCDMX();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(a.iso), 'fecha inválida: ' + a.iso);
  assert(a.hora >= 0 && a.hora < 24, 'hora inválida: ' + a.hora);
  const esperado = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  assert(a.iso === esperado, 'no coincide con CDMX: ' + a.iso + ' vs ' + esperado);
  assert(app.todayISO() === esperado, 'todayISO no usa CDMX');
});

test('los cruces de medianoche se leen bien', () => {
  const app = conPlan();
  assert(app.time12(24) === '12:00 am', app.time12(24));
  assert(app.time12(25.5) === '1:30 am', app.time12(25.5));
  assert(app.time12(26) === '2:00 am', app.time12(26));
  assert(app.segFor(25) === 'noche', 'la 1 am no es noche');
});

test('"Elegir fecha" sin fecha no deja buscar', () => {
  const app = conPlan();
  const antes = app.state.results;
  app.setState({ when: 'fecha', customDate: '' });
  app.runSearch();
  assert(app.state.results === antes, 'buscó sin fecha');
  app.setState({ customDate: '2026-12-01' });
  app.runSearch();
  assert(app.state.results !== antes, 'con fecha debería buscar');
});

test('el horario de un cine no se presenta como función confirmada', () => {
  const app = conPlan();
  const cine = app.cat().find(v => v.cat === 'Cine');
  const rest = app.cat().find(v => v.cat === 'Restaurante');
  assert(app.esHorarioDeLugar(cine) === true, 'no marca el cine');
  assert(app.esHorarioDeLugar(rest) === false, 'marca de más');
});

// ───────────────────────── 8c. Compartir: QR y WhatsApp ────────────────────────
section('8c · Compartir');

test('el enlace lleva fecha, horas, personas, transporte y costo', () => {
  const app = conPlan({ groupSize: 6, transporte: 'didi' });
  app.state.planDate = '2026-10-09';
  const pl = app.buildPlanPayload(app.getPlan());
  ['date', 'times', 'people', 'transport', 'spent', 'from', 'to'].forEach(k =>
    assert(pl[k] !== undefined && pl[k] !== '', 'falta ' + k + ' en el enlace'));
  assert(pl.people === 6 && pl.transport === 'didi', 'personas/transporte mal: ' + pl.people + '/' + pl.transport);
});

test('abrir el enlace reproduce EXACTAMENTE el mismo plan', () => {
  const app = conPlan({ groupSize: 6, transporte: 'metro' });
  app.state.planDate = '2026-10-09';
  const original = app.getPlan();
  const pl = app.buildPlanPayload(original);
  const otro = makeApp({ ...BASE, zone: 'polanco', zonesSel: ['polanco'], groupSize: 2, transporte: 'servicio' }, { dseed: 99 });
  otro.openPlanOpt({ plan: pl });
  const q = otro.getPlan();
  assert(names(q).join() === names(original).join(), 'paradas distintas: ' + names(q));
  assert(JSON.stringify(q.times) === JSON.stringify(original.times), 'horas distintas');
  assert(otro.state.planDate === '2026-10-09', 'fecha: ' + otro.state.planDate);
  assert(otro.state.groupSize === 6, 'personas: ' + otro.state.groupSize);
  assert(otro.state.transporte === 'metro', 'transporte: ' + otro.state.transporte);
  assert(q.spent === original.spent, 'costo distinto');
  // Un plan viejo que se guardó con 'didi' llega como servicio de transporte.
  const viejo = makeApp({ ...BASE }, { dseed: 99 });
  viejo.openPlanOpt({ plan: Object.assign({}, pl, { transport: 'didi' }) });
  assert(viejo.state.transporte === 'servicio', 'plan viejo con didi: ' + viejo.state.transporte);
});

test('el QR y WhatsApp apuntan al mismo enlace del sitio', () => {
  const app = conPlan();
  const id = app.planOptId(app.getPlan());
  const link = app.planLink(id);
  assert(link.includes('?plan=' + encodeURIComponent(id)), 'enlace mal formado: ' + link);
  assert(!/sobres\.mx/.test(link), 'usa un dominio inventado');
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(link);
  assert(decodeURIComponent(qr.split('data=')[1]) === link, 'el QR no codifica el mismo enlace');
});

// ───────────────────────── 8d. Identificación y accesibilidad ──────────────────
section('8d · Identificación del plan y accesibilidad');

test('el encabezado dice si es borrador, guardado, enviado o recibido', () => {
  const app = conPlan();
  assert(/BORRADOR/.test(app.renderVals().planEstado), '1: ' + app.renderVals().planEstado);
  app.renderVals().savePlan();
  app.renderVals().savedPlans[0].open(); app.state.view = 'plan';
  assert(/GUARDADO/.test(app.renderVals().planEstado), '2: ' + app.renderVals().planEstado);
  app.regenerate(); app.state.view = 'plan';
  assert(/BORRADOR/.test(app.renderVals().planEstado), '3: ' + app.renderVals().planEstado);
  app.setState({ openedPlanId: 'p1', sync: { plans: [{ id: 'p1', sharedWith: ['Beto'] }] } });
  assert(/ENVIADO A BETO/.test(app.renderVals().planEstado), '4: ' + app.renderVals().planEstado);
  app.setState({ planReadOnly: true, openedPlanBy: 'Ana' });
  assert(/TE ENVIÓ ANA/.test(app.renderVals().planEstado), '5: ' + app.renderVals().planEstado);
});

test('los botones de icono tienen etiqueta accesible', () => {
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const tpl = html.slice(0, html.indexOf('data-dc-script'));
  const sin = [];
  const re = /<button[^>]*>([^<]{1,4})<\/button>/g;
  let m;
  while ((m = re.exec(tpl)) !== null) {
    const txt = m.group ? m.group(1) : m[1];
    if (/^[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]{2,}$/.test(txt.trim())) continue;
    if (!txt.trim()) continue;
    if (!/aria-label/.test(m[0])) sin.push(txt.trim());
  }
  assert(sin.length === 0, 'botones de icono sin etiqueta: ' + sin.join(' '));
});

// ───────────────────────── 8e. Intención, contexto y actividades ───────────────
section('8e · Intención, contexto y secuencia de actividades');

test('entiende el transporte pedido y lo aplica', () => {
  const casos = [['transporte publico', 'metro'], ['vamos en didi', 'servicio'], ['pedimos uber', 'servicio'],
    ['preferimos caminar', 'caminando'], ['llevamos mi coche', 'propio']];
  casos.forEach(([txt, esperado]) => {
    const app = makeApp({ ...BASE, transporte: 'uber' }, { dseed: 1 });
    const p = app.aiParse(app.strip('cena en la roma hoy, ' + txt));
    assert(p.transporte === esperado, txt + ' → ' + p.transporte);
  });
  const app = makeApp({ ...BASE, zone: 'polanco', zonesSel: ['polanco'], transporte: 'didi' }, { dseed: 1234 });
  app.aiBuild('pareja, cenar en polanco hoy de 8pm a 11pm, maximo 900 por persona, vamos en transporte publico');
  assert(app.state.transporte === 'metro', 'no aplicó el transporte: ' + app.state.transporte);
});

test('solo = 1 persona y date = 2, salvo que digan otra cosa', () => {
  const app = makeApp(BASE, { dseed: 1 });
  assert(app.aiParse('voy solo a cenar').size === 1, 'solo');
  assert(app.aiParse('salgo en un date').size === 2, 'date');
  assert(app.aiParse('somos 7 amigos').size === 7, 'explícito');
});

test('el presupuesto incluye la propina que la app suma', () => {
  const app = makeApp({ ...BASE, zone: 'polanco', zonesSel: ['polanco'] }, { dseed: 1234 });
  app.aiBuild('pareja, cenar y tomar cafe en polanco hoy de 6pm a 11pm, maximo 600 por persona');
  const c = app.costoPlan(app.state.planCustom.stops);
  assert(c.consumo + c.propina <= 600, 'consumo+propina = ' + (c.consumo + c.propina) + ' > 600');
  const resumen = app.state.aiSummary || '';
  const m = resumen.match(/\$(\d+) pp \(consumo/);
  if (m) assert(+m[1] === c.consumo + c.propina, 'el resumen dice $' + m[1] + ' y el cálculo ' + (c.consumo + c.propina));
});

test('si una actividad pedida no cabe, lo explica y no la sustituye', () => {
  const app = makeApp({ ...BASE, zone: 'polanco', zonesSel: ['polanco'] }, { dseed: 1234 });
  app.aiBuild('pareja, cenar y despues tomar un cafe en polanco hoy de 8pm a medianoche, maximo 600 por persona');
  const stops = app.state.planCustom.stops;
  const hayCafe = stops.some(v => v.cat === 'Café');
  const resumen = app.state.aiSummary || '';
  if (!hayCafe) {
    assert(/café|cafe/i.test(resumen) && /(No hay|no tiene|cierra)/i.test(resumen),
      'no explicó por qué falta el café: ' + resumen);
    const sustituto = stops.filter(v => ['Foro', 'Museo', 'Cine', 'Teatro'].includes(v.cat));
    assert(sustituto.length === 0, 'sustituyó el café por ' + sustituto.map(v => v.cat));
  }
});

test('no repite la función de una parada al ampliar el plan', () => {
  const app = makeApp({ ...BASE, who: 'compa', groupSize: 7, zone: 'santafe', zonesSel: ['santafe'],
    when: 'manana', budget: 'b300', budgetCustom: 300 }, { dseed: 777 });
  app.setState({ planFrom: 13, planTo: 17 });
  app.runSearch();
  [2, 3, 4, 5].forEach(n => {
    app.state.planStops = n;
    const p = app.getPlan(); if (!p) return;
    const fs = p.stops.map((v, i) => app.funcionDe(v, p.times[i]));
    assert(new Set(fs).size === fs.length, n + ' paradas repiten función: ' + fs.join(', '));
  });
});

test('dos comidas completas del mismo periodo no pasan', () => {
  const app = makeApp({ ...BASE, zone: 'santafe', zonesSel: ['santafe'], vibes: ['foodie'] }, { dseed: 3 });
  app.runSearch();
  for (let i = 0; i < 8; i++) {
    (app.state.results.plans || []).forEach(p => {
      const comidas = p.stops.map((v, j) => app.funcionDe(v, (p.times || [])[j] || 19)).filter(f => f === 'comida' || f === 'cena');
      assert(comidas.length <= 1, 'dos comidas: ' + p.stops.map(v => v.n));
    });
    app.regenerate();
  }
});

test('el ejemplo integrado entrega las cuatro actividades que pide', () => {
  const app = makeApp(BASE, { dseed: 1234 });
  app.renderVals().aiEjemplo();
  const txt = app.state.aiTxt;
  app.aiBuild(txt);
  const stops = app.state.planCustom.stops;
  const nombres = stops.map(v => v.n.toLowerCase()).join(' ');
  assert(stops.length >= 4, 'sólo armó ' + stops.length + ' paradas: ' + stops.map(v => v.n));
  assert(/órbita|orbita/.test(nombres), 'falta Órbita');
  assert(/departamento/.test(nombres), 'falta Departamento');
  assert(stops.some(v => v.cat === 'Museo'), 'falta el museo');
  assert(stops.some(v => app.cuisine(v) === 'mariscos'), 'faltan los mariscos');
  stops.forEach((v, i) => assert(app.atHour(v, app.state.planCustom.times[i]),
    v.n + ' cerrado a las ' + app.time12(app.state.planCustom.times[i])));
  const c = app.costoPlan(stops);
  assert(c.consumo + c.propina <= 1500, 'se pasa del tope: ' + (c.consumo + c.propina));
});

test('desechar el borrador limpia paradas, explicación e identificación', () => {
  const app = makeApp({ ...BASE, view: 'plan' }, { dseed: 1234 });
  app.aiBuild('mañana con mis amigos por la roma, un museo y comer mariscos');
  app.state.view = 'plan';
  assert(app.state.aiSummary, 'la prueba necesita un resumen previo');
  app.trashPlan(); app.state.view = 'plan';
  assert(!app.state.aiSummary, 'quedó la explicación del AI');
  assert(!app.state.aiTxt, 'quedó el texto de la intención');
  assert(!app.state.planCustomFrom, 'quedó la identificación');
  assert(/SIN PLAN/.test(app.renderVals().planEstado), 'sigue diciendo BORRADOR: ' + app.renderVals().planEstado);
});

test('crear nuevo plan empieza realmente vacío', () => {
  const app = makeApp({ ...BASE, view: 'plan' }, { dseed: 1234 });
  app.aiBuild('mañana con mis amigos por la roma, un museo y comer mariscos');
  app.state.view = 'plan';
  app.renderVals().newPlanAuto(); app.state.view = 'plan';
  assert(app.getPlan().stops.length === 0, 'no empezó vacío');
  assert(!app.state.aiSummary, 'arrastró la explicación anterior');
});

test('avisa cuando pediste noche y no hay dónde tomar algo', () => {
  const app = makeApp({ ...BASE, zone: 'santafe', zonesSel: ['santafe'], budget: 'b300',
    budgetCustom: 250, vibes: ['foodie', 'nightlife'] }, { dseed: 1234 });
  app.runSearch();
  const r = app.state.results;
  const hay = (r.plans || []).some(p => p.stops.some(v => app.sirveCopas(v) === 'si'));
  if (!hay) assert(r.avisoCopas, 'no avisó que faltan copas');
});

test('la hora de "ahora mismo" coincide en resumen y selectores', () => {
  const app = makeApp({ ...BASE, when: 'ahora' }, { dseed: 1 });
  [8.5, 9, 13.25, 20].forEach(h => {
    app.state.hour = h; app.state.planFrom = null; app.state.planTo = null;
    const r = app.range();
    const V = app.renderVals();
    assert(+V.planFromVal === r[0] && +V.planToVal === r[1],
      'hora ' + h + ': resumen ' + r + ' vs selectores ' + V.planFromVal + '/' + V.planToVal);
  });
});

test('sin ubicación válida no se traza ruta en Maps', () => {
  const app = makeApp({ ...BASE, zone: 'roma', zonesSel: ['roma'] }, { dseed: 5 });
  app.runSearch(); app.state.planStops = 2;
  const p = app.getPlan();
  const msgs = []; const orig = app.toast.bind(app); app.toast = m => { msgs.push(m); return orig(m); };
  app.setState({ planCustom: { stops: [p.stops[0], app.mkExt('ext-1', 'Casa de mi primo')], times: p.times, spent: p.stops[0].pp } });
  app.mapsRoute();
  assert(/Falta la dirección/.test(msgs[0] || ''), 'no bloqueó la ruta: ' + msgs[0]);
});

test('estrellas, campos y pines tienen nombre accesible', () => {
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const tpl = html.slice(0, html.indexOf('data-dc-script'));
  const sinEtq = [];
  (tpl.match(/<input[^>]*>/g) || []).forEach(t => {
    if (!/aria-label/.test(t) && /placeholder=|type="date"/.test(t)) sinEtq.push(t.slice(0, 60));
  });
  assert(sinEtq.length === 0, 'campos sin etiqueta: ' + sinEtq.join(' | '));
  assert(/starBtns[\s\S]{0,200}aria:/.test(html), 'las estrellas no tienen texto accesible');
  assert(/aria-label="\{\{ st\.aria \}\}"/.test(tpl), 'el botón de estrella no usa la etiqueta');
  assert(/aria-label', v\.n \+/.test(html), 'los pines del mapa no tienen nombre accesible');
});

test('el perfil no muestra textos técnicos de API keys', () => {
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // Sólo el texto visible: los imports del código no los ve nadie.
  const visible = html.slice(0, html.indexOf('data-dc-script'))
    + html.slice(html.indexOf('data-dc-script')).replace(/import\([^)]*\)/g, '');
  ['PENDIENTE DE KEY', 'falta la key', 'API key', 'providers.js</span>'].forEach(t =>
    assert(!visible.includes(t), 'sigue apareciendo "' + t + '" a la vista del usuario'));
});

test('las fichas Soumaya distinguen sede y actividad', () => {
  const app = makeApp(BASE, { dseed: 1 });
  const fichas = app.cat().filter(v => /soumaya/i.test(v.n));
  assert(fichas.length >= 3, 'se perdieron fichas: ' + fichas.length);
  const nombres = fichas.map(v => v.n);
  assert(new Set(nombres).size === nombres.length, 'hay títulos repetidos');
  fichas.forEach(v => assert(/carso|loreto|auditorio|fundación/i.test(v.n),
    'ficha sin sede ni actividad en el título: ' + v.n));
});

// ───────────────────────── 9. Votaciones ─────────────────────────
section('9 · Votaciones');

const grupo = gPlans => {
  const app = makeApp({ ...BASE, userName: 'Christian', view: 'group' }, { dseed: 5 });
  app.state.gPlans = gPlans;
  return app.renderVals();
};
const prop = (id, name, votes) => ({ id, name, meta: '2 paradas', by: 'Christian',
  ts: Date.now(), stops: ['cdmx-0001'], votes: votes || {} });

test('distingue sin propuestas, sin votos, sólo en contra, empate y líder', () => {
  assert(grupo([]).gEstado === 'sin-propuestas', 'sin propuestas');
  assert(grupo([prop('a', 'A'), prop('b', 'B')]).gEstado === 'sin-votos', 'sin votos');
  assert(grupo([prop('a', 'A', { Christian: 'nojalo' })]).gEstado === 'solo-contra', 'sólo en contra');
  assert(grupo([prop('a', 'A', { Christian: 'sobres' }), prop('b', 'B', { Pablo: 'sobres' })]).gEstado === 'empate', 'empate');
  assert(grupo([prop('a', 'A', { Christian: 'sobres', Pablo: 'sobres' }), prop('b', 'B', { Ana: 'sobres' })]).gEstado === 'lider', 'líder');
});

test('un voto en contra ya no se reporta como "sin votos"', () => {
  const V = grupo([prop('a', 'A', { Christian: 'nojalo' })]);
  assert(!/sin votos|Nadie ha votado/i.test(V.gConsensus), 'dice: ' + V.gConsensus);
  assert(/en contra/i.test(V.gConsensus), 'no menciona los votos en contra: ' + V.gConsensus);
});

test('el empate no se resuelve solo y la regla es visible', () => {
  const V = grupo([prop('a', 'A', { Christian: 'sobres' }), prop('b', 'B', { Pablo: 'sobres' })]);
  assert(/empate/i.test(V.gConsensus), V.gConsensus);
  assert(/desempat/i.test(V.gRegla + V.gConsensus), 'no explica el desempate');
});

test('compartir un lugar da un enlace del sitio, no un dominio inventado', () => {
  const app = makeApp(BASE, { dseed: 5 });
  const u = app.linkLugar('cdmx-0001');
  assert(!/sobres\.mx/.test(u), 'sigue usando sobres.mx: ' + u);
  assert(/lugar=cdmx-0001/.test(u), 'no apunta al lugar: ' + u);
});

// ───────────────────────── 10. Matriz del reporte ─────────────────────────
section('6 · Matriz: perfiles, tamaños, zonas y momentos');

test('todas las combinaciones producen un plan válido (o lo explican)', () => {
  const quienes = ['solo', 'date', 'amigos', 'familia', 'compa'];
  const tam = [1, 2, 4, 7];
  const zonas = ['roma', 'polanco', 'coyoacan', 'santafe'];
  const momentos = ['ahora', 'noche', 'manana', 'finde'];
  const problemas = [];
  let n = 0;
  quienes.forEach(w => tam.forEach(g => zonas.forEach(z => momentos.forEach(when => {
    n++;
    const app = makeApp({ ...BASE, who: w, groupSize: g, zone: z, zonesSel: [z], when }, { dseed: 77 });
    const max = app.budgetMax();
    const r = app.engine(0);
    r.plans.forEach(p => {
      if (p.spent > max) problemas.push([w, g, z, when].join('/') + ' excede: $' + p.spent);
      p.stops.forEach((v, i) => { if (p.times && p.times[i] != null && !app.atHour(v, p.times[i]))
        problemas.push([w, g, z, when].join('/') + ' ' + v.n + ' cerrado'); });
    });
  }))));
  assert(problemas.length === 0, n + ' combinaciones, ' + problemas.length + ' problemas: ' + problemas.slice(0, 5).join(' | '));
});



// ───────── 10 · Vibras: la actividad, no la etiqueta ─────────
// Estas pruebas NO usan las reglas del motor para juzgarlo: afirman sobre la
// CATEGORÍA del lugar y sobre el catálogo auditado, por fuera de vibeModel().
section('10 · Vibras: afinidad real con la actividad');

const CATS_COPAS = ['Bar','Bar de autor','Speakeasy','Mezcalería','Rooftop','Antro','Salón de baile','Cantina'];

test('chill + cultural no mete bares ni antros como relleno', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'all', zonesSel:[], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['chill','cultural'], planFrom:17, planTo:26 }, { dseed: 31 });
  app.runSearch();
  let revisados = 0;
  for (let i = 0; i <= 10; i++) {
    (app.state.results.plans || []).forEach(p => {
      p.stops.forEach(v => {
        revisados++;
        assert(CATS_COPAS.indexOf(v.cat) < 0, 'parada de copas con chill+cultural: ' + v.n + ' [' + v.cat + ']');
      });
    });
    if (i < 10) app.regenerate();
  }
  assert(revisados > 20, 'la prueba necesita revisar paradas de verdad, revisó ' + revisados);
});

test('una petición explícita de copas sí actualiza el contexto', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['chill','cultural'], planFrom:19, planTo:26 }, { dseed: 32 });
  app.setState({ aiPide: ['copas'] });
  app.runSearch();
  const hay = (app.state.results.plans || []).some(p => p.stops.some(v => app.actsDe(v).indexOf('copas') >= 0));
  assert(hay, 'si el usuario pide copas explícitamente, deben poder entrar');
});

test('aventurero entrega una actividad protagonista de aventura, o dice que falta', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'all', zonesSel:[], when:'manana',
    budget:'b1k', budgetCustom:null, vibes:['aventurero'], planFrom:11, planTo:23 }, { dseed: 33 });
  app.runSearch();
  const plans = app.state.results.plans || [];
  assert(plans.length >= 3, 'deben salir tres planes, salieron ' + plans.length);
  // Aventura de verdad = reto, recorrido activo o parque de atracciones, con datos
  // propios. Un parque, una plaza o un cine NO cuentan.
  const AVENTURA = ['Escape room','Parque de diversiones','Tour'];
  plans.forEach(p => {
    const prot = p.stops.filter(v => AVENTURA.indexOf(v.cat) >= 0);
    assert(prot.length >= 1, 'plan sin actividad de aventura: ' + p.stops.map(v => v.n + ' [' + v.cat + ']'));
    const generico = p.stops.every(v => ['Parque','Atracción','Cine','Centro comercial','Museo'].indexOf(v.cat) >= 0);
    assert(!generico, 'parque + plaza + cine no es un plan aventurero: ' + p.stops.map(v => v.n));
  });
});

test('aventurero en una zona sin oferta lo dice en vez de disfrazarlo', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'polanco', zonesSel:['polanco'], when:'manana',
    budget:'b1k', budgetCustom:null, vibes:['aventurero'], planFrom:11, planTo:23 }, { dseed: 34 });
  app.runSearch();
  const r = app.state.results;
  assert(r.protHay === 0, 'la prueba asume que Polanco no tiene aventura auditada, tiene ' + r.protHay);
  assert(r.avisoProt && /no tiene ninguna actividad/.test(r.avisoProt), 'falta el aviso: ' + r.avisoProt);
  assert(/Enigma|Six Flags/.test(r.avisoProt), 'el aviso debe decir dónde sí la hay');
  (r.plans || []).forEach(p => assert(p.protagonista === false, 'no puede marcarse como plan de aventura'));
});

test('creativo entrega un taller donde se hace algo, no una galería', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'all', zonesSel:[], when:'manana',
    budget:'b1k', budgetCustom:null, vibes:['creativo'], planFrom:11, planTo:23 }, { dseed: 35 });
  app.runSearch();
  const plans = app.state.results.plans || [];
  assert(plans.length >= 3, 'deben salir tres planes, salieron ' + plans.length);
  plans.forEach(p => {
    const talleres = p.stops.filter(v => v.cat === 'Taller');
    assert(talleres.length >= 1, 'plan creativo sin taller: ' + p.stops.map(v => v.n + ' [' + v.cat + ']'));
    talleres.forEach(v => assert(v.sesion, v.n + ' debería necesitar reserva de sesión'));
  });
});

test('un curso de varias semanas no entra como plan de una tarde', () => {
  const app = makeApp({ who:'solo', groupSize:1, zone:'all', zonesSel:[], when:'manana',
    budget:'b1k', budgetCustom:null, vibes:['creativo'], planFrom:11, planTo:23 }, { dseed: 36 });
  app.runSearch();
  for (let i = 0; i <= 6; i++) {
    (app.state.results.plans || []).forEach(p => p.stops.forEach(v =>
      assert(!v.cursoCerrado, 'metió un curso completo como parada: ' + v.n)));
    if (i < 6) app.regenerate();
  }
  // Pero sigue existiendo en el catálogo, con su unidad bien puesta.
  const curso = app.cat().find(v => v.id === 'cdmx-3031');
  assert(!curso || curso.pUnidad === 'curso', 'el curso debe guardarse con unidad propia');
});

// ───────── 11 · Identidad de negocios homónimos ─────────
section('11 · Identidad: Panem antro vs Panem Bakery & Bistro');

test('la identidad fabricada de Panem salió del catálogo', () => {
  const app = makeApp({}, { dseed: 41 });
  const cat = app.cat();
  ['cdmx-2005','cdmx-2006','cdmx-2088'].forEach(id =>
    assert(!cat.some(v => v.id === id), 'sigue el registro fabricado ' + id));
  assert(!cat.some(v => /panem bakery|panem roma|panem del valle/i.test(v.n)),
    'sigue habiendo una panadería Panem en CDMX que no existe');
});

test('el Panem real de Campos Elíseos es un antro, con su horario', () => {
  const app = makeApp({}, { dseed: 41 });
  const v = app.cat().find(x => x.id === 'cdmx-3001');
  assert(v, 'falta el registro del negocio que sí ocupa esa dirección');
  assert(v.cat === 'Antro', 'debe ser antro, es ' + v.cat);
  assert(v.oh[0] === 23, 'abre a las 23:00, no antes: ' + v.oh);
  // No publica cover; el precio es la referencia del fundador (~$2,000 en total), marcada como estimada.
  assert(!v.ppUnknown && v.pEstado === 'estimado' && v.pp === 1800, 'el precio debe ser la referencia del fundador, marcada como estimada');
  // Lo que reportó el usuario: NO puede ser una pausa de café de las 5:30 pm.
  assert(!app.atHour(v, 17.5), 'un antro cerrado no puede entrar a las 5:30 pm');
  assert(app.actsDe(v).indexOf('cafe') < 0, 'un antro no ofrece café');
});

test('ningún plan pone a Panem como parada de café', () => {
  const app = makeApp({ who:'date', groupSize:2, zone:'polanco', zonesSel:['polanco'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['chill'], planFrom:16, planTo:21 }, { dseed: 42 });
  app.runSearch();
  for (let i = 0; i <= 6; i++) {
    (app.state.results.plans || []).forEach(p => p.stops.forEach((v, j) => {
      if (!/panem/i.test(v.n)) return;
      const a = (p.acts || [])[j];
      assert(a !== 'cafe' && a !== 'desayuno', 'Panem como café: ' + v.n + ' a las ' + app.time12(p.times[j]));
    }));
    if (i < 6) app.regenerate();
  }
});

// ───────── 12 · Cobertura y descubrimiento de LUGARES ─────────
section('12 · Descubrimiento de lugares, no sólo de combinaciones');

test('once tandas en Santa Fe descubren muchos más destinos que antes', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'santafe', zonesSel:['santafe'], when:'noche',
    budget:'b1000', budgetCustom:null, vibes:['foodie','nightlife'], planFrom:19, planTo:26 }, { dseed: 51 });
  app.runSearch();
  const lugares = new Set(), finales = new Set(), combos = new Set();
  for (let i = 0; i <= 10; i++) {
    (app.state.results.plans || []).forEach(p => {
      combos.add(app.comboSig(p.stops));
      if (p.stops.length) finales.add(p.stops[p.stops.length - 1].id);
      p.stops.forEach(v => lugares.add(v.id));
    });
    if (i < 10) app.regenerate();
  }
  // Antes: 32 combinaciones pero sólo 3 destinos finales distintos.
  assert(lugares.size >= 15, 'sólo ' + lugares.size + ' lugares distintos en 11 tandas');
  assert(combos.size >= 25, 'sólo ' + combos.size + ' combinaciones distintas');
  // Santa Fe tiene UN solo lugar abierto a medianoche, así que el cierre puede
  // repetirse — pero entonces la app tiene que decirlo, no disimularlo.
  if (finales.size < 3) {
    assert(app.state.results.avisoCompartida,
      'repite el cierre en los tres planes sin explicar por qué: ' + [...finales]);
    assert(/no encontramos otra alternativa/.test(app.state.results.avisoCompartida),
      'el aviso debe decir que no hay alternativa: ' + app.state.results.avisoCompartida);
  }
});

test('cada tanda trae lugares nuevos mientras queden elegibles sin mostrar', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'manana',
    budget:'b1k', budgetCustom:null, vibes:[], planFrom:11, planTo:23 }, { dseed: 52 });
  app.runSearch();
  let tandasSinNuevo = 0;
  for (let i = 0; i < 8; i++) {
    app.regenerate();
    const r = app.state.results;
    if (r.plans && r.plans.length && r.lugaresNuevos === 0) {
      tandasSinNuevo++;
      // Si no hay lugares nuevos, la app TIENE que decirlo.
      assert(r.soloRecombina, 'recombinó sin avisarlo en la tanda ' + i);
      assert(/no lugares nuevos/.test(r.expandNote || ''), 'falta el aviso: ' + r.expandNote);
    }
  }
  assert(tandasSinNuevo <= 2, 'demasiadas tandas sin ningún lugar nuevo: ' + tandasSinNuevo);
});

test('los tres planes de una tanda no comparten todas las paradas', () => {
  [['roma', 11, 23], ['polanco', 11, 23], ['coyoacan', 11, 23]].forEach(([z, a, b]) => {
    const app = makeApp({ who:'amigos', groupSize:4, zone:z, zonesSel:[z], when:'manana',
      budget:'b1k', budgetCustom:null, vibes:[], planFrom:a, planTo:b }, { dseed: 53 });
    app.runSearch();
    const plans = app.state.results.plans || [];
    if (plans.length < 2) return;
    const firmas = new Set(plans.map(p => app.comboSig(p.stops)));
    assert(firmas.size === plans.length, z + ': dos planes de la misma tanda son iguales');
    // Al menos una parada protagonista distinta entre el primero y el segundo.
    const a0 = new Set(plans[0].stops.map(v => v.id));
    const distintos = plans[1].stops.filter(v => !a0.has(v.id)).length;
    assert(distintos >= 1, z + ': el segundo plan es el primero reordenado');
  });
});

// ───────── 13 · Viabilidad: no se genera lo imposible ─────────
section('13 · Viabilidad antes de ofrecer, no como aviso al pie');

test('ningún tramo exige más tiempo del que hay entre dos paradas', () => {
  [['caminando','coyoacan'], ['caminando','roma'], ['metro','all'], ['servicio','polanco']].forEach(([tr, z]) => {
    const app = makeApp({ who:'solo', groupSize:1, zone:z, zonesSel:z === 'all' ? [] : [z], when:'ahora',
      budget:'b1k', budgetCustom:null, vibes:[], transporte:tr, planFrom:11, planTo:19 }, { dseed: 61 });
    app.runSearch();
    for (let i = 0; i <= 5; i++) {
      (app.state.results.plans || []).forEach(p => p.stops.forEach((v, j) => {
        if (j === 0) return;
        const km = app.legKm(p.stops[j - 1], v); if (km == null) return;
        const min = app.minutosTramo(km); if (min == null) return;
        const hueco = (p.times[j] - p.times[j - 1]) * 60;
        const necesita = app.duracionAct(p.stops[j - 1]) * 60 + min;
        assert(necesita <= hueco + app.MARGEN() + 1, tr + '/' + z + ': ' + p.stops[j - 1].n + ' → ' + v.n
          + ' necesita ' + Math.round(necesita) + ' min y el hueco es ' + Math.round(hueco));
      }));
      if (i < 5) app.regenerate();
    }
  });
});

test('llegar a la hora de cierre no cuenta como abierto', () => {
  const app = makeApp({}, { dseed: 62 });
  const v = { oh: [10, 18], act: ['visita'] };
  assert(app.atHour(v, 16), 'a las 4 pm sí cabe una visita');
  assert(!app.atHour(v, 18), 'llegar a las 6 pm cuando cierra a las 6 pm no es válido');
  assert(!app.atHour(v, 17.5), 'media hora antes del cierre no alcanza para una visita');
  assert(!app.atHour(v, 9), 'antes de abrir tampoco');
  // Una experiencia con salida fija sólo existe a su hora.
  const tour = app.cat().find(x => x.id === 'cdmx-3020');
  assert(tour && tour.sesiones, 'el tour debe tener salida fija');
  assert(app.atHour(tour, 9.5), 'a su hora de salida sí');
  assert(!app.atHour(tour, 13), 'a media tarde no hay salida');
});

test('ningún plan propone un lugar cerrado a su hora', () => {
  const combos = [['roma','noche'], ['santafe','ahora'], ['coyoacan','manana'], ['polanco','noche']];
  combos.forEach(([z, w]) => {
    const app = makeApp({ who:'amigos', groupSize:4, zone:z, zonesSel:[z], when:w,
      budget:'b1k', budgetCustom:null, vibes:[] }, { dseed: 63 });
    app.runSearch();
    for (let i = 0; i <= 5; i++) {
      (app.state.results.plans || []).forEach(p => p.stops.forEach((v, j) =>
        assert(app.atHour(v, p.times[j]), z + '/' + w + ': ' + v.n + ' cerrado a las ' + app.time12(p.times[j]))));
      if (i < 5) app.regenerate();
    }
  });
});

// ───────── 14 · Presupuesto: una sola validación ─────────
section('14 · Validación única de presupuesto en todos los caminos');

test('ninguna propuesta se presenta por encima del tope', () => {
  [300, 600, 1000].forEach(tope => {
    const app = makeApp({ who:'amigos', groupSize:7, zone:'santafe', zonesSel:['santafe'], when:'manana',
      budget:'b1k', budgetCustom:tope, vibes:[], transporte:'servicio', planFrom:13, planTo:17 }, { dseed: 71 });
    app.runSearch();
    for (let i = 0; i <= 10; i++) {
      (app.state.results.plans || []).forEach(p => {
        const v = app.cabeEnTope(p.stops, tope);
        assert(v.ok, 'tope $' + tope + ' y el plan va en $' + v.total + ': ' + p.stops.map(x => x.n));
      });
      if (i < 10) app.regenerate();
    }
  });
});

test('cambiar el número de paradas no rompe el tope', () => {
  const app = makeApp({ who:'amigos', groupSize:7, zone:'santafe', zonesSel:['santafe'], when:'manana',
    budget:'b1k', budgetCustom:300, vibes:[], transporte:'servicio', planFrom:13, planTo:17 }, { dseed: 72 });
  app.runSearch();
  [2, 3, 4, 5].forEach(n => {
    app.setState({ planStops: n });
    const p = app.getPlan();
    if (!p || !p.stops.length) return;
    const v = app.cabeEnTope(p.stops, 300);
    assert(v.ok, n + ' paradas se van a $' + v.total + ' con tope $300: ' + p.stops.map(x => x.n));
  });
});

test('gratis es cero, y un precio desconocido no es gratis', () => {
  const app = makeApp({ who:'familia', groupSize:4, zone:'coyoacan', zonesSel:['coyoacan'], when:'manana',
    budget:'b1000', budgetCustom:null, vibes:['cultural','familiar'], planFrom:10, planTo:14 }, { dseed: 73 });
  // Por lenguaje natural.
  const p = app.aiParse('Somos una familia de 4, dos adultos y dos ninos. Queremos un plan gratis en Coyoacan manana de 10 am a 2 pm, cultural y familiar, sin alcohol.');
  assert(p.budget === 0, '"gratis" debe ser tope 0, fue ' + p.budget);
  assert(p.sinAlcohol, 'debe entender "sin alcohol"');
  app.aiBuild('Somos una familia de 4, dos adultos y dos ninos. Queremos un plan gratis en Coyoacan manana de 10 am a 2 pm, cultural y familiar, sin alcohol.');
  assert(app.state.budgetCustom === 0 && app.state.budget === 'free', 'el tope del estado debe quedar en 0');
  const stops = (app.state.planCustom || { stops: [] }).stops;
  stops.forEach(v => {
    assert(!v.ppUnknown, 'un precio desconocido no puede entrar en un plan gratis: ' + v.n);
    assert((v.pp || 0) === 0, v.n + ' cuesta $' + v.pp + ' en un plan gratis');
  });
  // Y el tope sobrevive al Rehacer.
  app.regenerate();
  ((app.state.planCustom || { stops: [] }).stops).forEach(v =>
    assert((v.pp || 0) === 0 && !v.ppUnknown, 'tras Rehacer se perdió el tope 0: ' + v.n));
});

test('la intención sobrevive al Rehacer y el resumen sale del plan vigente', () => {
  const app = makeApp({ who:'date', groupSize:2, zone:'polanco', zonesSel:['polanco'], when:'noche',
    budget:'b600', budgetCustom:null, vibes:[] }, { dseed: 74 });
  app.aiBuild('Somos una pareja de 2 personas. Queremos cenar y despues tomar un cafe en Polanco hoy de 8 pm a medianoche. Maximo 600 por persona. Vamos en transporte publico.');
  const resumenes = []; const primeras = [];
  for (let i = 0; i < 4; i++) {
    const st = (app.state.planCustom || { stops: [] }).stops;
    assert(st.length >= 1, 'no armó nada en la vuelta ' + i);
    // La cena pedida tiene que seguir siendo una cena.
    assert(app.FOOD.indexOf(st[0].cat) >= 0, 'la cena se convirtió en ' + st[0].cat + ' (' + st[0].n + ')');
    primeras.push(st[0].id);
    const esperado = app.costoPlan(st);
    const m = (app.state.aiSummary || '').match(/Desde \$(\d+)/);
    assert(m, 'el resumen debe decir el costo del plan vigente: ' + app.state.aiSummary);
    assert(+m[1] === esperado.consumo + esperado.propina,
      'el resumen dice $' + m[1] + ' y el plan vigente cuesta $' + (esperado.consumo + esperado.propina));
    resumenes.push(m[1]);
    app.regenerate();
  }
  assert(new Set(primeras).size >= 3, 'Rehacer repite la misma cena: ' + primeras);
});

test('el contexto acumula exclusiones sin borrar la intención anterior', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'santafe', zonesSel:['santafe'], when:'noche',
    budget:'b1000', budgetCustom:null, vibes:[] }, { dseed: 75 });
  app.aiBuild('Somos 4 amigos en Santa Fe. Queremos cenar y tomar algo hoy de 8 pm a medianoche con maximo 1000 por persona. No quiero Puerto Madero.');
  const n1 = (app.state.aiExcluded || []).length;
  assert(n1 >= 1, 'no entendió la primera exclusión');
  app.aiBuild('tampoco quiero Sonora Grill');
  const ex = app.state.aiExcluded || [];
  assert(ex.length > n1, 'la segunda exclusión borró la primera: ' + ex.length + ' vs ' + n1);
  // Y la intención (cenar + tomar algo) sigue viva.
  const cats = (app.state.aiCtx.cats || []).map(c => c.g);
  assert(cats.length >= 1, 'se perdieron las actividades pedidas');
  assert(app.state.groupSize === 4 && app.state.zone === 'santafe' && app.state.budgetCustom === 1000,
    'se perdió el contexto: ' + app.state.groupSize + '/' + app.state.zone + '/' + app.state.budgetCustom);
});


// ───────── 15 · El motor y los avisos usan la MISMA regla ─────────
section('15 · Coherencia entre lo que se construye y lo que se avisa');

test('cambiar el número de paradas no contradice el aviso de viabilidad', () => {
  const app = makeApp({ who:'compa', groupSize:7, zone:'santafe', zonesSel:['santafe'], when:'manana',
    budget:'b1k', budgetCustom:300, vibes:[], transporte:'servicio', planFrom:13, planTo:17 }, { dseed: 81 });
  app.runSearch();
  [2, 3, 4, 5].forEach(n => {
    app.setState({ planStops: n });
    const p = app.getPlan();
    if (!p || p.stops.length < 2) return;
    const tm = (p.times && p.times.length === p.stops.length) ? p.times : app.planTimes(p.stops.length);
    const v = app.viabilidad(p.stops, tm);
    assert(v.ok, n + ' paradas: el plan se entrega con un aviso de inviabilidad — ' + v.problemas[0]);
    assert(app.cabeEnTope(p.stops, 300).ok, n + ' paradas se pasan del tope');
  });
});

test('extendPlan respeta vibra, horario y presupuesto como la búsqueda', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'all', zonesSel:[], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['chill','cultural'], planFrom:17, planTo:26 }, { dseed: 82 });
  app.runSearch();
  const CATS_COPAS2 = ['Bar','Bar de autor','Speakeasy','Mezcalería','Rooftop','Antro','Salón de baile','Cantina'];
  [3, 4, 5].forEach(n => {
    app.setState({ planStops: n });
    const p = app.getPlan(); if (!p) return;
    p.stops.forEach((v, i) => {
      assert(CATS_COPAS2.indexOf(v.cat) < 0, 'extendPlan metió copas con chill+cultural: ' + v.n);
      assert(app.atHour(v, p.times[i]), 'extendPlan metió un lugar cerrado: ' + v.n);
    });
  });
});

test('una parada manual no genera enlaces a destinos inventados', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:[] }, { dseed: 83 });
  const ext = app.mkExt('ext-qa', 'Parada manual QA sin ubicación');
  assert(typeof app.uberUrl !== 'function', 'ya no hay enlaces para pedir viaje');
  assert(app.mapsUrl(ext) === '', 'Maps no debe buscar el nombre escrito a mano');
  assert(ext.ppUnknown && app.precioTxt(ext) === 'Precio por confirmar');
  assert(app.legKm(ext, { lat: 19.4, lng: -99.16 }) === null, 'sin ubicación no hay distancia');
});

test('el contexto completo viaja al compartir y se restaura sin defaults', () => {
  const app = makeApp({ who:'amigos', groupSize:5, zone:'roma', zonesSel:['roma'], when:'fecha',
    customDate:'2026-10-07', budget:'b1k', budgetCustom:1500, vibes:['foodie','nightlife'],
    transporte:'metro', planFrom:18, planTo:26 }, { dseed: 84 });
  app.runSearch();
  const plan = app.state.results.plans[0];
  const payload = app.buildPlanPayload({ stops: plan.stops, times: plan.times, spent: plan.spent });
  ['people','who','zone','zonesSel','vibes','budget','budgetCustom','transport','date','from','to','costo']
    .forEach(k => assert(payload[k] !== undefined, 'el payload no lleva ' + k));
  assert(payload.people === 5, 'personas: ' + payload.people);
  assert(payload.budgetCustom === 1500, 'tope: ' + payload.budgetCustom);
  // El receptor abre con SUS defaults (4 personas, otro tope) y debe quedarse con los del emisor.
  [1, 2, 5, 7].forEach(n => {
    const rx = makeApp({ who:'amigos', groupSize:4, zone:'condesa', zonesSel:['condesa'], when:'noche',
      budget:'b600', budgetCustom:null, vibes:[], transporte:'servicio' }, { dseed: 85 });
    const pl = Object.assign({}, payload, { people: n, ids: payload.stops });
    rx.openPlanOpt({ plan: pl });
    assert(rx.state.groupSize === n, n + ' personas llegaron como ' + rx.state.groupSize);
    assert(rx.state.budgetCustom === 1500, 'el tope llegó como ' + rx.state.budgetCustom);
    assert(rx.state.transporte === 'metro', 'el transporte llegó como ' + rx.state.transporte);
    assert(rx.state.zone === 'roma', 'la zona llegó como ' + rx.state.zone);
    const st = rx.state.planCustom.stops;
    assert(app.comboSig(st) === app.comboSig(plan.stops), 'las paradas no son las mismas');
    assert(rx.state.aiSummary === '', 'abrir no debe conservar la explicación de otra recomendación');
  });
});

test('proponer al grupo usa el mismo payload que el enlace', () => {
  const app = makeApp({ who:'amigos', groupSize:5, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:1500, vibes:[], transporte:'uber', planFrom:18, planTo:26 }, { dseed: 86 });
  app.runSearch();
  const plan = app.state.results.plans[0];
  app.setState({ userName: 'QA', planCustom: { stops: plan.stops, times: plan.times, spent: plan.spent } });
  app.proposePlan({ stops: plan.stops, times: plan.times, spent: plan.spent });
  const gp = (app.state.gPlans || [])[0];
  assert(gp, 'no se propuso nada');
  ['people','budgetCustom','transport','zone','costo'].forEach(k =>
    assert(gp[k] !== undefined, 'proposePlan perdió ' + k));
  assert(gp.people === 5 && gp.budgetCustom === 1500, 'proposePlan: ' + gp.people + '/' + gp.budgetCustom);
});

test('Solo = 1 y Date = 2 también en los selectores manuales', () => {
  const app = makeApp({ who:'familia', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b600', budgetCustom:null, vibes:[] }, { dseed: 87 });
  const v = app.renderVals();
  const solo = v.whoOpts.find(o => /solo/i.test(o.label));
  solo.pick();
  assert(app.state.groupSize === 1, 'Solo dejó ' + app.state.groupSize + ' personas');
  const v2 = app.renderVals();
  v2.whoOpts.find(o => /date/i.test(o.label)).pick();
  assert(app.state.groupSize === 2, 'Date dejó ' + app.state.groupSize + ' personas');
  // Y con DiDi el texto no habla de UberX.
  app.setState({ transporte: 'didi', groupSize: 5 });
  assert(!/uber/i.test(app.renderVals().rideHint), 'con DiDi no se menciona Uber: ' + app.renderVals().rideHint);
});

test('el encabezado comunica la vibra, no la lista de filtros', () => {
  const app = makeApp({ who:'amigos', groupSize:5, zone:'all', zonesSel:[], when:'ahora',
    budget:'b1k', budgetCustom:null, vibes:['creativo'], planFrom:12, planTo:18 }, { dseed: 88 });
  app.runSearch();
  const t = app.tituloPlan();
  assert(!/·/.test(t), 'el título sigue concatenando filtros: ' + t);
  assert(/creativ/i.test(t), 'el título debe nombrar la vibra: ' + t);
  assert(t.length < 46, 'título demasiado largo: ' + t);
  // Los filtros siguen existiendo, en el resumen secundario.
  const f = app.filtroItems().map(x => x.k);
  ['Quiénes','Zona','Cuándo','Presupuesto','Transporte'].forEach(k =>
    assert(f.indexOf(k) >= 0, 'falta ' + k + ' en el resumen de filtros'));
  // Sin vibra, un título neutro.
  app.setState({ vibes: [] });
  assert(/curados/i.test(app.tituloPlan()), 'sin vibra: ' + app.tituloPlan());
  assert(/armado/i.test(app.tituloPlan('editor')), 'editor: ' + app.tituloPlan('editor'));
});

test('el presupuesto abierto se nombra $2,000+ y existe el rango $1,000–1,999', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:[] }, { dseed: 89 });
  assert(/\$2,000\+/.test(app.budLabel()), 'budLabel: ' + app.budLabel());
  assert(app.BUD.map(b => b[1]).join('|') === 'Gratis|Hasta $300|$300–600|$600–1,000|$1,000–1,999|$2,000+', 'rangos: ' + app.BUD.map(b => b[1]));
  app.state.budget = 'b1999'; assert(app.budgetMax() === 1999 && /1,000–1,999/.test(app.budLabel()), 'rango 1,000–1,999');
  app.state.budget = 'b1k';

  // Y el máximo manual existe y manda.
  const v = app.renderVals();
  v.setBudgetCustom({ target: { value: '450' } });
  assert(app.state.budgetCustom === 450, 'no tomó el máximo manual');
  assert(/450/.test(app.budLabel()), 'budLabel: ' + app.budLabel());
});


test('guardar un plan deja de llamarlo borrador', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:[], view:'plan', planView:'edit' }, { dseed: 91 });
  app.runSearch();
  const p = app.state.results.plans[0];
  app.setState({ view:'plan', planView:'edit', planCustom: { stops: p.stops, times: p.times, spent: p.spent },
    planStops: p.stops.length, planNone:false });
  assert(/BORRADOR/.test(app.renderVals().planEstado), 'antes de guardar sí es borrador');
  app.renderVals().savePlan();
  app.setState({ view:'plan', planView:'edit' });
  const est = app.renderVals().planEstado;
  assert(/PLAN GUARDADO/.test(est), 'tras guardar el encabezado dice: ' + est);
  assert((app.state.savedPlans || []).length === 1, 'debe quedar exactamente un guardado');
  // Guardar dos veces no duplica ni vuelve a llamarlo borrador.
  app.renderVals().savePlan();
  assert((app.state.savedPlans || []).length === 1, 'se duplicó el guardado');
  assert(/PLAN GUARDADO/.test(app.renderVals().planEstado), 'al reguardar volvió a borrador');
});


// ───────── 16 · Cerrar el plan y abrirlo limpio ─────────
section('16 · Concretar el plan (UX)');

function planListo(dseed, who, size) {
  const app = makeApp({ who: who || 'amigos', groupSize: size || 4, zone:'roma', zonesSel:['roma'],
    when:'noche', budget:'b1k', budgetCustom:null, vibes:[], view:'plan', planView:'edit' }, { dseed: dseed });
  app.runSearch();
  const p = app.state.results.plans[0];
  app.setState({ view:'plan', planView:'edit', planCustom: { stops: p.stops, times: p.times, spent: p.spent },
    planStops: p.stops.length, planNone:false, planLocked:false });
  return app;
}

test('un plan para una sola persona no ofrece enviarlo', () => {
  const solo = planListo(95, 'solo', 1);
  const v = solo.renderVals();
  assert(v.puedeEnviar === false, 'un plan solo no se envía a nadie');
  assert(/mi plan/i.test(v.cerrarLabel), 'el botón debe hablar de concretarlo: ' + v.cerrarLabel);
  const grupo = planListo(95, 'amigos', 4);
  assert(grupo.renderVals().puedeEnviar === true, 'con amigos sí se puede enviar');
});

test('cerrar el plan lo bloquea y ofrece apartar cada parada', () => {
  const app = planListo(96, 'amigos', 4);
  assert(app.renderVals().planCanEdit, 'antes de cerrarlo se puede editar');
  app.renderVals().savePlan();
  app.setState({ view:'plan', planView:'edit' });
  const v = app.renderVals();
  assert(v.planLocked, 'tras cerrarlo el plan queda bloqueado');
  assert(!v.planCanEdit, 'y ya no muestra los controles de armado');
  assert(!v.paradasOn, 'ni el selector de número de paradas');
  assert(v.reservaItems.length === app.state.planCustom.stops.length, 'falta alguna parada por apartar');
  v.reservaItems.forEach(r => assert(r.cta && r.hora && r.name, 'cada parada necesita hora, nombre y acción'));
  assert(!v.reservaItems.some(r => r.hecho), 'arranca sin nada apartado');
  // Sólo cuenta como apartado lo que de verdad se reserva (restaurante, bar, antro).
  const k = app.state.planCustom.stops.findIndex(x => app.bookable(x));
  if (k >= 0) {
    v.reservaItems[k].go();
    app.setState({ view: 'plan', planView: 'edit', modal: null });
    const v2 = app.renderVals();
    assert(v2.reservaItems[k].hecho, 'la parada apartada debe quedar marcada');
    assert(/apartaste|reservaciones hechas/i.test(v2.reservaProgreso), 'el progreso debe moverse: ' + v2.reservaProgreso);
  }
  // Un museo no se "aparta": su acción es Cómo visitar.
  const museo = app.cat().find(x => x.cat === 'Museo');
  assert(app.accionDe(museo).label === 'Cómo visitar' && !app.bookable(museo), 'un museo no se reserva');
});

test('Editar vuelve a abrir los controles, y tocar el plan lo saca de guardado', () => {
  const app = planListo(97, 'amigos', 4);
  app.renderVals().savePlan();
  app.setState({ view:'plan', planView:'edit' });
  assert(app.renderVals().planLocked, 'quedó bloqueado');
  app.renderVals().planDesbloquear();
  app.setState({ view:'plan', planView:'edit' });
  assert(app.renderVals().planCanEdit, 'Editar devuelve los controles');
  // Cambiar una hora lo vuelve borrador.
  app.setState({ planLocked: true });
  app.setStopTime(0, 19);
  assert(!app.state.planLocked, 'cambiar el plan lo regresa a borrador');
});

test('un plan guardado se abre limpio desde Mis planes', () => {
  const app = planListo(98, 'amigos', 4);
  app.renderVals().savePlan();
  app.setState({ planLocked: false, planCustom: null, planCustomFrom: null, view: 'plan', planView: 'list' });
  const guardado = app.renderVals().savedPlans[0];
  assert(guardado, 'el guardado debe aparecer en Mis planes');
  guardado.open();
  app.setState({ view: 'plan', planView: 'edit' });
  const v = app.renderVals();
  assert(v.planLocked, 'abrir un guardado NO debe soltar todos los controles de armado');
  assert(!v.planCanEdit && !v.paradasOn, 'se abre limpio');
});


// ───────── 17 · Altas del catálogo ─────────
section('17 · Lugares nuevos: identidad, categoría y días');

test('los cinco lugares entraron una sola vez y con su categoría', () => {
  const app = makeApp(BASE, { dseed: 1 });
  const cat = app.cat();
  [['cdmx-4070','Oly','Restaurante','condesa'],
   ['cdmx-4071','Aida Café · Santa Fe','Café','santafe'],
   ['cdmx-4072','Duke','Antro','polanco'],
   ['cdmx-4073','Kinshasa Roma','Rooftop','roma'],
   ['cdmx-4074','Jardín Paraíso','Bar','roma']].forEach(([id, n, c, z]) => {
    const v = cat.find(x => x.id === id);
    assert(v, 'falta ' + n);
    assert(v.n === n, n + ' se llama ' + v.n);
    assert(v.cat === c, n + ' quedó como ' + v.cat + ' y es ' + c);
    assert(v.z === z, n + ' quedó en ' + v.z + ' y va en ' + z);
    assert(cat.filter(x => x.n === n).length === 1, n + ' está duplicado');
  });
});

test('dos negocios en la misma dirección no se fusionan', () => {
  const app = makeApp(BASE, { dseed: 1 });
  const enQro225 = app.cat().filter(v => (v.addr || '').indexOf('Querétaro 225') >= 0);
  // Mercado Roma, Kinshasa (rooftop) y M.R. Bar Club (tercer piso) comparten edificio.
  assert(enQro225.length >= 2, 'en Querétaro 225 debe haber al menos dos establecimientos, hay ' + enQro225.length);
  assert(new Set(enQro225.map(v => v.n)).size === enQro225.length, 'dos registros con el mismo nombre en la misma dirección');
  const cats = enQro225.map(v => v.cat).sort();
  assert(cats.join('|') === 'Mercado|Rooftop|Speakeasy', 'se mezclaron: ' + cats);
});

test('un antro que sólo abre viernes y sábado no entra un martes', () => {
  const duke = makeApp(BASE, { dseed: 1 }).cat().find(v => v.id === 'cdmx-4072');
  assert(duke.dias && duke.dias.join() === '5,6', 'Duke debe abrir sólo vie y sáb: ' + duke.dias);
  // 2026-10-13 es martes; 2026-10-16 es viernes.
  const mar = makeApp({ ...BASE, when: 'fecha', customDate: '2026-10-13' }, { dseed: 1 });
  assert(!mar.abreEseDia(duke, '2026-10-13'), 'un martes no abre');
  assert(!mar.timingOk(duke), 'y por lo tanto no debe pasar el filtro de horario');
  const vie = makeApp({ ...BASE, when: 'fecha', customDate: '2026-10-16' }, { dseed: 1 });
  assert(vie.abreEseDia(duke, '2026-10-16'), 'un viernes sí abre');
  // Y sin dato de días, nadie inventa un cierre.
  const libre = { oh: [12, 23], act: ['comida'] };
  assert(mar.abreEseDia(libre, '2026-10-13'), 'sin dato de días no se inventa que cierra');
});

test('los importes de referencia no se presentan como precio cerrado', () => {
  const app = makeApp(BASE, { dseed: 1 });
  const byId = id => app.cat().find(v => v.id === id);
  // Piso publicado: se muestra, pero el techo no se inventa.
  const oly = byId('cdmx-4070');
  assert(oly.pMin === 500 && oly.pMax == null, 'Oly: piso $500 sin techo inventado');
  assert(/500/.test(app.precioTxt(oly)) && !/estimado/.test(app.precioTxt(oly)), app.precioTxt(oly));
  assert(/PISO/i.test(oly.pCanasta) || /piso/i.test(oly.pCanasta), 'la canasta debe decir que es un piso');
  // Banda publicada: se muestra como banda.
  const aida = byId('cdmx-4071');
  assert(aida.pMin === 310 && aida.pMax === 500, 'Aida: banda $310–$500');
  // Pendiente de confirmar: NUNCA se carga como precio.
  ['cdmx-4073', 'cdmx-4074'].forEach(id => {
    const v = byId(id);
    assert(v.ppUnknown, v.n + ' no debe tener precio cargado');
    assert(app.precioTxt(v) === 'Precio por confirmar', v.n + ': ' + app.precioTxt(v));
    assert(!/gratis/i.test(app.precioTxt(v)), v.n + ' no puede decir Gratis');
  });
  // Y un precio sin confirmar no pasa un plan "gratis".
  const free = makeApp({ ...BASE, budget: 'free', budgetCustom: 0 }, { dseed: 1 });
  ['cdmx-4073', 'cdmx-4074', 'cdmx-4072'].forEach(id =>
    assert(!free.budgetOk(byId(id)), byId(id).n + ' se coló en un plan gratis'));
});


// ───────── 18 · Compartir los tres planes ─────────
section('18 · Un enlace con la tanda completa');

test('el enlace lleva los tres planes exactos y sus filtros', () => {
  const app = makeApp({ who:'amigos', groupSize:5, zone:'roma', zonesSel:['roma','romasur'], when:'noche',
    budget:'b1k', budgetCustom:1500, vibes:['foodie','nightlife'], transporte:'servicio',
    planFrom:18, planTo:26, userName:'Christian' }, { dseed: 101 });
  app.runSearch();
  const orig = app.state.results.plans;
  assert(orig.length >= 2, 'la prueba necesita al menos dos planes');
  const pay = app.tandaPayload();
  assert(pay && pay.v === 1, 'no armó el payload');
  assert(pay.p.length === orig.length, 'no viajan todos los planes');
  pay.p.forEach((pl, i) => assert(pl.s.join() === orig[i].stops.map(v => v.id).join(),
    'el plan ' + (i+1) + ' no viaja con sus paradas exactas'));
  ['w','g','z','zs','b','bc','vb','tr','f','t'].forEach(k =>
    assert(pay[k] !== undefined, 'el enlace no lleva ' + k));
  assert(pay.bc === 1500 && pay.g === 5, 'tope y personas: ' + pay.bc + '/' + pay.g);
  const url = app.tandaLink();
  assert(/\?p=/.test(url), 'el enlace debe llevar ?p=: ' + url);
  // Formato corto: sin JSON ni base64, y sólo con caracteres que la URL no escapa.
  const txt = url.split('?p=')[1];
  assert(/^[A-Za-z0-9\-._~%!]+$/.test(txt), 'el enlace lleva caracteres que la URL tiene que escapar: ' + txt);
  assert(txt.length < 320, 'el enlace corto se pasó de 320: ' + txt.length);
  assert(txt.length < app.b64enc(pay).length * 0.75,
    'el formato corto debería pesar bastante menos que el largo: ' + txt.length + ' vs ' + app.b64enc(pay).length);
  // Ida y vuelta: lo que importa es que vuelvan los mismos planes y filtros.
  const back = app.leeTandaCorta(txt);
  assert(back.g === 5 && back.bc === 1500 && back.tr === 'servicio' && back.w === 'amigos',
    'se perdieron filtros: ' + JSON.stringify([back.g, back.bc, back.tr, back.w]));
  assert(back.zs.join() === 'roma,romasur', 'zonas: ' + back.zs);
  assert(back.vb.join() === 'foodie,nightlife', 'vibras: ' + back.vb);
  assert(back.f === pay.f && back.t === pay.t, 'horario: ' + back.f + '–' + back.t);
  assert(back.p.length === orig.length, 'no viajan todos los planes');
  back.p.forEach((pl, i) => {
    assert(pl.s.join() === orig[i].stops.map(v => v.id).join(), 'plan ' + (i+1) + ': paradas distintas');
    pl.h.forEach((h, j) => assert(Math.abs(h - orig[i].times[j]) < 0.02,
      'plan ' + (i+1) + ' parada ' + (j+1) + ': la hora cambió ' + h + ' vs ' + orig[i].times[j]));
  });
});

test('los enlaces del formato viejo siguen funcionando', () => {
  const app = makeApp({ who:'amigos', groupSize:5, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:1500, vibes:['foodie'], transporte:'servicio',
    planFrom:18, planTo:26, userName:'Christian', catLoaded: 1 }, { dseed: 105 });
  app.runSearch();
  const firmas = app.state.results.plans.map(p => app.comboSig(p.stops));
  const viejo = app.b64enc(app.tandaPayload());   // formato base64 original
  const rx = makeApp({ who:'solo', groupSize:1, zone:'condesa', zonesSel:['condesa'],
    userName:'Beto', catLoaded: 1 }, { dseed: 106 });
  rx.abrirTanda(viejo, false);
  const r = rx.state.results;
  assert(r && r.plans.length === firmas.length, 'un enlace viejo dejó de abrir');
  r.plans.forEach((p, i) => assert(rx.comboSig(p.stops) === firmas[i], 'plan ' + (i+1) + ' llegó distinto'));
  assert(rx.state.groupSize === 5 && rx.state.userName === 'Beto', 'filtros o identidad mal');
});

test('quien lo abre ve los mismos planes y sigue siendo él, no el que lo mandó', () => {
  const emisor = makeApp({ who:'amigos', groupSize:5, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:1500, vibes:['foodie','nightlife'], transporte:'servicio',
    planFrom:18, planTo:26, userName:'Christian' }, { dseed: 102 });
  emisor.runSearch();
  const firmas = emisor.state.results.plans.map(p => emisor.comboSig(p.stops));
  const txt = emisor.tandaLink().split('?p=')[1];

  // Otro dispositivo, otra persona, otros filtros por defecto.
  const receptor = makeApp({ who:'solo', groupSize:1, zone:'condesa', zonesSel:['condesa'], when:'manana',
    budget:'b300', budgetCustom:null, vibes:['chill'], transporte:'caminando',
    userName:'Beto', catLoaded: 1 }, { dseed: 777 });
  receptor.abrirTanda(txt, true);
  const r = receptor.state.results;
  assert(r && r.plans.length === firmas.length, 'no llegaron los mismos planes');
  r.plans.forEach((p, i) => assert(receptor.comboSig(p.stops) === firmas[i],
    'el plan ' + (i+1) + ' llegó distinto'));
  // Los filtros del emisor mandan…
  assert(receptor.state.groupSize === 5 && receptor.state.budgetCustom === 1500
    && receptor.state.transporte === 'servicio' && receptor.state.zone === 'roma',
    'no se restauraron los filtros: ' + receptor.state.groupSize + '/' + receptor.state.budgetCustom);
  // …pero la identidad NO.
  assert(receptor.state.userName === 'Beto', 'el receptor cambió de nombre a ' + receptor.state.userName);
  assert(receptor.state.tandaDe === 'Christian', 'debe decir quién lo mandó');
  assert(!receptor.state.planReadOnly && !receptor.state.openedPlanId,
    'abrir una tanda no es abrir el plan de alguien más');
  // Y si hace su propia búsqueda, el aviso se va.
  receptor.runSearch();
  assert(receptor.state.tandaDe === '', 'el aviso de compartido debe desaparecer al buscar');
});

test('cada tanda da un enlace distinto', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:[], planFrom:18, planTo:26, userName:'Ana' }, { dseed: 103 });
  app.runSearch();
  const vistos = new Set();
  for (let i = 0; i < 5; i++) { vistos.add(app.tandaLink()); app.regenerate(); }
  assert(vistos.size >= 4, 'sólo ' + vistos.size + ' enlaces distintos en 5 tandas');
});

test('un enlace roto no rompe la app', () => {
  const app = makeApp({ userName: 'Ana', catLoaded: 1 }, { dseed: 104 });
  app.abrirTanda('esto-no-es-base64-valido!!', false);
  app.abrirTanda('basura~sin~sentido', true);
  app.abrirTanda('', true);
  app.abrirTanda(app.b64enc({ v: 9, p: [] }), false);
  assert(true, 'ningún enlace roto debe lanzar');
});


// ───────── 19 · Editar las tres propuestas ─────────
section('19 · Editar, guardar y mandar las tres');

function conTanda(dseed) {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['foodie'], transporte:'servicio',
    planFrom:18, planTo:26, userName:'Christian' }, { dseed: dseed });
  app.runSearch();
  return app;
}

test('editar una propuesta la reemplaza en la tanda, no en otra', () => {
  const app = conTanda(301);
  const v = app.renderVals();
  assert(v.plans.length >= 2, 'la prueba necesita dos propuestas');
  const antes = app.state.results.plans.map(p => app.comboSig(p.stops));
  // Entrar a editar la SEGUNDA.
  v.plans[1].open();
  app.setState({ view: 'plan', planView: 'edit' });
  assert(app.state.planDesdeTanda && app.state.planIdx === 1, 'no quedó apuntando a la propuesta 2');
  // Quitar su última parada.
  const p0 = app.getPlan();
  assert(p0.stops.length >= 2, 'necesita al menos dos paradas para quitar una');
  app.removeStop(p0.stops.length - 1);
  // Volver a los tres.
  app.renderVals().planBack();
  const plans = app.state.results.plans;
  assert(app.comboSig(plans[1].stops) !== antes[1], 'la propuesta 2 no se actualizó');
  assert(plans[1].editado, 'debe quedar marcada como editada');
  assert(app.comboSig(plans[0].stops) === antes[0], 'se tocó la propuesta 1');
  if (plans[2]) assert(app.comboSig(plans[2].stops) === antes[2], 'se tocó la propuesta 3');
  assert(!app.state.planDesdeTanda, 'al volver se suelta el vínculo');
  assert(app.state.view === 'results', 'debe regresar a los tres planes, quedó en ' + app.state.view);
});

test('el enlace que se comparte lleva la versión editada', () => {
  const app = conTanda(302);
  const v = app.renderVals();
  v.plans[0].open();
  app.setState({ view: 'plan', planView: 'edit' });
  const p0 = app.getPlan();
  app.removeStop(p0.stops.length - 1);
  const editado = app.comboSig(app.getPlan().stops);
  app.renderVals().planBack();
  // El enlace corto ya debe traer la versión editada.
  const txt = app.tandaLink().split('?p=')[1];
  const back = app.leeTandaCorta(txt);
  assert(back.p[0].s.slice().sort().join('|') === editado,
    'el enlace sigue llevando la versión vieja: ' + back.p[0].s);
  // Y quien lo abre ve lo editado.
  const rx = makeApp({ userName: 'Beto', catLoaded: 1 }, { dseed: 303 });
  rx.abrirTanda(txt, true);
  assert(rx.comboSig(rx.state.results.plans[0].stops) === editado, 'el receptor vio la versión vieja');
});

test('guardar los 3 los manda a Mis planes sin duplicar', () => {
  const app = conTanda(304);
  const n = app.state.results.plans.length;
  app.renderVals().guardarTanda();
  assert((app.state.savedPlans || []).length === n, 'guardó ' + app.state.savedPlans.length + ' de ' + n);
  app.state.savedPlans.forEach(sp => {
    assert(sp.stopIds && sp.stopIds.length, 'un guardado quedó sin paradas');
    assert(sp.people === 4 && sp.budget === 'b1k' && sp.transporte === 'servicio', 'se perdió el contexto');
  });
  // Dos veces no duplica.
  app.renderVals().guardarTanda();
  assert(app.state.savedPlans.length === n, 'se duplicaron al guardar otra vez');
});

test('guardar un plan editado desde la tanda lo deja igual en los tres', () => {
  const app = conTanda(305);
  const v = app.renderVals();
  v.plans[2] ? v.plans[2].open() : v.plans[0].open();
  const idx = app.state.planIdx;
  app.setState({ view: 'plan', planView: 'edit' });
  const p0 = app.getPlan();
  app.removeStop(p0.stops.length - 1);
  const firma = app.comboSig(app.getPlan().stops);
  app.renderVals().savePlan();
  assert(app.comboSig(app.state.results.plans[idx].stops) === firma,
    'guardar no dejó el cambio en la propuesta');
  assert((app.state.savedPlans || []).length === 1, 'debe quedar un guardado');
});


test('el enlace que se muestra siempre coincide con lo que hay en pantalla', () => {
  const app = conTanda(306);
  const firmaDeLink = () => {
    const back = app.leeTandaCorta(app.tandaLink().split('?p=')[1]);
    return back.p.map(x => x.s.slice().sort().join('|')).join(' // ');
  };
  const firmaEnPantalla = () => app.state.results.plans.map(p => app.comboSig(p.stops)).join(' // ');
  assert(firmaDeLink() === firmaEnPantalla(), 'de entrada ya no coinciden');
  // Tras editar una propuesta.
  const v = app.renderVals();
  v.plans[0].open();
  app.setState({ view: 'plan', planView: 'edit' });
  app.removeStop(app.getPlan().stops.length - 1);
  app.renderVals().planBack();
  assert(firmaDeLink() === firmaEnPantalla(), 'tras editar, el enlace quedó desfasado');
  // Tras Rehacer.
  app.regenerate();
  assert(firmaDeLink() === firmaEnPantalla(), 'tras regenerar, el enlace quedó desfasado');
  // Tras Sorpréndeme.
  app.runSearch({ surprise: true });
  assert(firmaDeLink() === firmaEnPantalla(), 'tras Sorpréndeme, el enlace quedó desfasado');
});

test('el enlace a la vista no sobrevive a un cambio de planes', () => {
  const app = conTanda(307);
  // "Compartir las 3" abre el panel único; "Copiar" deja el enlace a la vista.
  app.renderVals().copiarTanda();
  assert(app.state.sendOpen && app.state.compartirTanda, 'debe abrir el panel de compartir');
  assert(/[?]p=/.test(app.renderVals().compLink), 'el panel debe mostrar el enlace');
  app.renderVals().compCopiar();
  assert(app.state.tandaUrl, 'debe quedar el enlace a la vista');
  const antes = app.state.tandaUrl;
  app.regenerate();
  assert(!app.state.tandaUrl, 'tras Rehacer no puede seguir el enlace viejo en pantalla');
  app.renderVals().copiarTanda(); app.renderVals().compCopiar();
  assert(app.state.tandaUrl !== antes, 'el enlace nuevo debe ser distinto');
  // Y editar también lo quita.
  const v = app.renderVals();
  v.plans[0].open();
  app.setState({ view: 'plan', planView: 'edit' });
  app.removeStop(app.getPlan().stops.length - 1);
  app.renderVals().planBack();
  assert(!app.state.tandaUrl, 'tras editar tampoco puede seguir el enlace viejo');
});


test('una parada agregada a mano viaja en el enlace y no lo rompe', () => {
  const app = conTanda(308);
  const v = app.renderVals();
  v.plans[0].open();
  app.setState({ view: 'plan', planView: 'edit' });
  // Agregar una parada escrita a mano, como hace el buscador del editor.
  app.addExtStop('Casa de mi tía', 21);
  const conMano = app.getPlan().stops;
  assert(conMano.some(x => x.manual), 'no se agregó la parada a mano');
  app.renderVals().planBack();
  const txt = app.tandaLink().split('?p=')[1];
  // El id ext-… lleva un guion, que era el separador viejo: no debe partir nada.
  const back = app.leeTandaCorta(txt);
  assert(back.p.length === app.state.results.plans.length, 'se perdió un plan entero: ' + back.p.length);
  assert(back.p[0].s.length === conMano.length,
    'el plan editado perdió paradas: ' + back.p[0].s.length + ' de ' + conMano.length);
  assert(back.p[0].s.some(x => x && x.ext === 'Casa de mi tía'), 'la parada a mano no viajó: ' + JSON.stringify(back.p[0].s));
  // Y el receptor la ve, recreada como parada a mano suya.
  const rx = makeApp({ userName: 'Beto', catLoaded: 1 }, { dseed: 309 });
  rx.abrirTanda(txt, true);
  const p0 = rx.state.results.plans[0];
  assert(p0.stops.length === conMano.length, 'al receptor le llegó un plan incompleto');
  const mano = p0.stops.find(x => x.manual);
  assert(mano && mano.n === 'Casa de mi tía', 'no llegó la parada a mano: ' + (mano && mano.n));
  assert(mano.ppUnknown && mano.sinUbicacion, 'debe llegar con su precio y ubicación por confirmar');
});

test('cambiar una parada por otra también viaja', () => {
  const app = conTanda(310);
  const v = app.renderVals();
  v.plans[1].open();
  app.setState({ view: 'plan', planView: 'edit' });
  // "Cambiar": sustituir la primera parada por otra del catálogo.
  const alt = app.swapSuggest(0)[0];
  assert(alt, 'no hubo sugerencia para cambiar');
  app.setState({ swapIdx: 0 });
  app.addStop(alt);
  const esperado = app.comboSig(app.getPlan().stops);
  app.renderVals().planBack();
  const back = app.leeTandaCorta(app.tandaLink().split('?p=')[1]);
  assert(back.p[1].s.slice().sort().join('|') === esperado,
    'el cambio no viajó: ' + back.p[1].s + ' vs ' + esperado);
});

// ─────────── 20. Guía de motor: coherencia, variedad e historial ───────────
section('20 · Guía de motor: coherencia, variedad e historial');

const NOCHE_ROMA = { who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
  budget:'b1k', budgetCustom:null, vibes:['nightlife'], planFrom:20, planTo:26 };

test('R08/R09 · un antro por noche, siempre al final y llegando cerca de 23:30', () => {
  let conAntro = 0;
  [11, 12, 13, 14, 15, 16].forEach(seed => {
    const app = makeApp(NOCHE_ROMA, { dseed: seed });
    const r = app.runSearch({ nueva: true });
    r.plans.forEach(pl => {
      const idx = pl.stops.map((v, i) => app.esAntro(v) ? i : -1).filter(i => i >= 0);
      assert(idx.length <= 1, 'dos antros en un plan: ' + names(pl).join(' → '));
      if (!idx.length) return;
      conAntro++;
      assert(idx[0] === pl.stops.length - 1, 'el antro no cierra la noche: ' + names(pl).join(' → '));
      if (pl.stops.length > 1) assert(idx[0] !== 0, 'el antro abrió la noche');
      const t = pl.times[idx[0]];
      assert(t >= 22.5 && t <= 24.5, 'llegada al antro fuera de 22:30–00:30: ' + app.time12(t) + ' en ' + names(pl).join(' → '));
      assert(app.cabeEnVentana(pl.stops[idx[0]], t, 26), 'el antro no cabe completo en la ventana');
    });
  });
  assert(conAntro > 0, 'la prueba no vio ningún plan con antro: no mide nada');
});

test('P13 · "sólo antro": noche que empieza tarde → una parada válida, sin relleno', () => {
  const app = makeApp(Object.assign({}, NOCHE_ROMA, { planFrom: 23.5, planTo: 27 }), { dseed: 21 });
  const r = app.runSearch({ nueva: true });
  assert(r.plans.length > 0, 'no hubo planes');
  const solos = r.plans.filter(pl => pl.stops.length === 1);
  assert(solos.length > 0, 'ninguna opción fue el antro directo: ' + r.plans.map(pl => names(pl).join('+')).join(' / '));
  solos.forEach(pl => assert(app.esAntro(pl.stops[0]), 'una parada sola que no es antro: ' + names(pl)));
});

test('P06 · "ya comimos": no se mete ninguna comida ni cena', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:[], planFrom:15, planTo:19, yaComimos: true }, { dseed: 31 });
  const r = app.runSearch({ nueva: true });
  assert(r.plans.length > 0, 'sin planes');
  r.plans.forEach(pl => (pl.acts || []).forEach(a =>
    assert(['comida','cena','desayuno'].indexOf(a) < 0, 'metió ' + a + ' en ' + names(pl).join(' → '))));
});

test('P15 · cultural sin alcohol: ni bar ni precopeo', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma','juarez','condesa'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['cultural'], planFrom:17, planTo:23, sinAlcohol: true }, { dseed: 32 });
  const r = app.runSearch({ nueva: true });
  assert(r.plans.length > 0, 'sin planes');
  r.plans.forEach(pl => pl.stops.forEach(v =>
    assert(!app.implicaAlcohol(v), v.n + ' implica alcohol en un plan sin alcohol')));
});

test('P18 · Six Flags no es una visita breve: no cabe en dos horas', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'cu', zonesSel:['cu'], when:'finde',
    budget:'b1k', budgetCustom:2000, vibes:['aventurero'], planFrom:12, planTo:14 }, { dseed: 33 });
  const sf = app.cat().find(v => v.id === 'cdmx-2091');
  assert(sf && app.duracionAct(sf) >= 6, 'Six Flags debe durar un bloque largo');
  const r = app.runSearch({ nueva: true });
  r.plans.forEach(pl => assert(!pl.stops.some(v => v.id === 'cdmx-2091'), 'ofreció Six Flags en dos horas'));
});

test('P20 · a pie no se finge cercanía: un tramo largo no es caminable', () => {
  const app = makeApp({ transporte: 'caminando' }, { dseed: 34 });
  const a = { lat: 19.419, lng: -99.16, oh: [0, 28], cat: 'Bar' }, b = { lat: 19.44, lng: -99.135, oh: [0, 28], cat: 'Bar' };
  assert(app.legKm(a, b) > 2, 'la prueba necesita un tramo de más de 2 km');
  assert(app.alcanzaTramo(a, b, 5) === false, 'dio por caminable un tramo de ' + app.legKm(a, b).toFixed(1) + ' km');
  app.state.transporte = 'servicio';
  assert(app.alcanzaTramo(a, b, 5) === true, 'en servicio de transporte sí se puede');
});

test('P10 · un café no cumple el papel de comida o cena', () => {
  const app = makeApp({}, { dseed: 35 });
  // Sólo los cafés SIN comida verificada: un café-brunch con ficha y precio de
  // comida publicados (Aida Café) sí puede servir de comida.
  const cafes = app.cat().filter(v => v.cat === 'Café' && !v.actVer);
  assert(cafes.length > 5, 'pocos cafés para medir');
  cafes.forEach(v => assert(!app.actsDe(v).some(a => a === 'comida' || a === 'cena'), v.n + ' cuenta como comida'));
});

test('P27 · tres opciones como conjunto: anclas distintas y a lo más un lugar en común', () => {
  [41, 42, 43].forEach(seed => {
    const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
      budget:'b1k', budgetCustom:null, vibes:['foodie'], planFrom:19, planTo:23 }, { dseed: seed });
    const r = app.runSearch({ nueva: true });
    assert(r.plans.length === 3, 'no salieron tres');
    const anclas = r.plans.map(pl => app.anclaDe(pl.stops, pl.acts));
    assert(new Set(anclas).size === 3, 'anclas repetidas: ' + anclas);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const comun = r.plans[i].stops.filter(v => r.plans[j].stops.some(x => x.id === v.id)).length;
      assert(comun <= 1, 'las opciones ' + (i + 1) + ' y ' + (j + 1) + ' comparten ' + comun + ' lugares');
    }
  });
});

test('P28 · diez solicitudes con filtros idénticos → treinta planes distintos y válidos', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma','condesa'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['foodie'], planFrom:19, planTo:23 }, { dseed: 51 });
  const huellas = new Set(); let n = 0;
  for (let i = 0; i < 10; i++) {
    const r = app.runSearch({ nueva: true });
    r.plans.forEach(pl => {
      n++; huellas.add(app.comboSig(pl.stops));
      assert(app.cabeEnTope(pl.stops, app.budgetMax()).ok, 'plan fuera de presupuesto');
      const ts = pl.times;
      assert(app.cabeEnVentana(pl.stops[pl.stops.length - 1], ts[ts.length - 1], app.range()[1]), 'plan fuera de la ventana');
    });
  }
  assert(n === 30, 'se mostraron ' + n + ' planes, no 30');
  assert(huellas.size === 30, 'sólo ' + huellas.size + ' huellas distintas de 30');
});

test('P29 · un reintento técnico (mismo request_id) no genera ni cuenta dos veces', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['foodie'] }, { dseed: 52 });
  const r1 = app.runSearch({ reqId: 'sol-123' });
  const vistos1 = app.histLee().planes.length;
  const r2 = app.runSearch({ reqId: 'sol-123' });
  assert(r1 === r2, 'el reintento generó otra tanda');
  assert(app.histLee().planes.length === vistos1, 'el reintento contó la exposición dos veces');
  const r3 = app.runSearch({ nueva: true });
  assert(r3 !== r1 && r3.reqId !== r1.reqId, 'una solicitud nueva debe traer su propio id');
  assert(r3.reqSeed !== r1.reqSeed, 'una solicitud nueva debe traer su propia semilla');
});

test('P31 · el historial sobrevive a recargar: no se repiten planes ya vistos', () => {
  const F = { who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma','condesa'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['foodie'], planFrom:19, planTo:23 };
  const a = makeApp(F, { dseed: 53 });
  const vistos = new Set();
  for (let i = 0; i < 3; i++) a.runSearch({ nueva: true }).plans.forEach(pl => vistos.add(a.comboSig(pl.stops)));
  const guardado = {}; guardado[a.histClave()] = JSON.stringify(a.histLee());
  const b = makeApp(F, { dseed: 53, storage: guardado });   // misma persona, otra carga
  const r = b.runSearch({ nueva: true });
  r.plans.forEach(pl => assert(!vistos.has(b.comboSig(pl.stops)), 'tras recargar repitió ' + names(pl).join(' → ')));
});

test('P34 · cambiar una parada no devuelve de inmediato la que se quitó', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['foodie'], planFrom:19, planTo:23 }, { dseed: 54 });
  const r = app.runSearch({ nueva: true });
  const p = r.plans[0];
  app.setState({ view: 'plan', planView: 'edit', planCustom: { stops: p.stops, times: p.times, spent: p.spent }, planStops: p.stops.length });
  const quitada = app.getPlan().stops[0];
  const alt = app.swapSuggest(0)[0];
  assert(alt, 'no hubo sustituto');
  app.replaceStop(0, alt);
  const otra = app.swapSuggest(0);
  assert(otra.length > 0, 'no quedan sustitutos para medir');
  assert(!otra.some(v => v.id === quitada.id), 'volvió a sugerir ' + quitada.n + ', que se acaba de quitar');
});

test('P36 · transporte: cuatro modos, sin UberX, botón de viaje ni cotización', () => {
  const app = conPlan();
  const v = app.renderVals();
  assert(JSON.stringify(v.transportOpts.map(o => o.label)) === JSON.stringify(['Servicio de transporte','Mi coche','Caminando','Transporte público']),
    'opciones: ' + v.transportOpts.map(o => o.label));
  ['rideClass','uberUrl','didiGo'].forEach(f => assert(typeof app[f] !== 'function', 'sigue existiendo ' + f));
  assert(!('rideHint' in v) && !('isUber' in v) && !('isDidi' in v), 'quedaron datos de pedir viaje');
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const plantilla = html.slice(html.indexOf('<x-dc>'), html.indexOf('</x-dc>'));
  assert(!/uber|didi|pedir carro|cotiza/i.test(plantilla), 'la plantilla todavía menciona pedir viaje');
  (v.itinerary || []).forEach(st => assert(!st.legLabel || !/uber|didi/i.test(st.legLabel), 'el trayecto nombra una marca'));
});

// ─────────── 21. Correcciones de catálogo pedidas ───────────
section('21 · Correcciones de catálogo pedidas');

test('Casa San Juan es un antro en Polanco, no un restaurante en Las Lomas', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'polanco', zonesSel:['polanco'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['nightlife'], planFrom:23, planTo:27 }, { dseed: 61 });
  const v = app.cat().find(x => x.id === 'cdmx-2229');
  assert(v.n === 'Casa San Juan' && v.cat === 'Antro' && v.z === 'polanco', 'identidad: ' + [v.n, v.cat, v.z]);
  assert(/Masaryk 393/.test(v.addr) && /Polanco/.test(v.col), 'dirección: ' + v.addr + ' / ' + v.col);
  assert(Math.abs(v.lat - 19.432158) < 1e-4 && Math.abs(v.lng + 99.1981266) < 1e-4, 'coordenadas');
  assert(!app.actsDe(v).some(a => a === 'comida' || a === 'cena'), 'sigue contando como comida o cena');
  // El precio ya no está "por confirmar": el fundador dio la referencia (~$2,000
  // en total). Se carga como ESTIMADO y el horario sigue sin confirmar.
  assert(!v.ppUnknown && v.pp === 1800 && v.pEstado === 'estimado', 'el precio debe ser la referencia del fundador, marcada como estimada');
  assert(v.horaEstimada, 'el horario debe quedar por confirmar');
  assert(!app.cat().some(x => /Casa San Juan · Lomas/.test(x.n)), 'sobrevive el registro viejo');
  // Buscador
  const busq = app.searchIn('casa san juan');
  assert(busq[0] && busq[0].id === 'cdmx-2229' && busq[0].cat === 'Antro', 'buscador: ' + (busq[0] && busq[0].n));
  // Generación: entra como antro (baile) en la noche de Polanco y nunca abre la noche.
  assert(app.timingOk(v) && app.vibeAdmite(v, app.vibeModel()) && app.atHour(v, 23.5), 'no es elegible para una noche en Polanco');
  for (let i = 0; i < 6; i++) app.runSearch({ nueva: true }).plans.forEach(pl => {
    const k = pl.stops.findIndex(x => x.id === 'cdmx-2229');
    if (k >= 0) assert(k === pl.stops.length - 1, 'Casa San Juan no cerró la noche');
  });
  // Ficha: sin horas inventadas para apartar, y la fuente es la de la corrección.
  assert(app.realSlots(v).length === 0, 'ofreció horarios que nadie publicó');
  assert(/CDMX Reservas/.test(v.src), 'la ficha no cita la fuente de la corrección: ' + v.src);
});

test('los perfiles de ejemplo de la demo de venues ya no están en el catálogo', () => {
  const app = makeApp({}, { dseed: 62 });
  assert(!app.cat().some(v => v.fic), 'quedan perfiles de ejemplo');
  ['barrovivo','distral','rutataco'].forEach(id => assert(!app.cat().some(v => v.id === id), id + ' sigue en el catálogo'));
});

// ─────────── 22. Interfaz: una pantalla para armar, tres opciones comparables ───────────
section('22 · Interfaz: invitado, opciones comparables y lo que se quitó');

test('se entra sin nombre: el inicio es el formulario, no una pantalla de nombre', () => {
  const app = makeApp({ userName: '' }, { dseed: 71 });
  const v = app.renderVals();
  assert(v.isHome === true && v.needOnboard === false, 'pidió nombre al entrar');
  assert(v.vibeTiles.length === 10 && v.transportOpts.length === 4 && v.whoOpts.length === 5, 'el formulario no está completo en Inicio');
});

test('las opciones traen los mismos cuatro datos y una frase que es CIERTA', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:['foodie'], planFrom:19, planTo:23, view:'results' }, { dseed: 72 });
  app.runSearch({ nueva: true });
  const v = app.renderVals();
  assert(v.opciones.length === 3, 'opciones: ' + v.opciones.length);
  v.opciones.forEach(o => ['horario','paradas','costo','traslados','frase'].forEach(k => assert(o[k], 'falta ' + k)));
  assert(new Set(v.opciones.map(o => o.frase)).size === 3, 'frases repetidas: ' + v.opciones.map(o => o.frase));
  const rs = app.state.results.plans.map(pl => app.resumenPlan(pl.stops, pl.times));
  v.opciones.forEach((o, i) => {
    if (o.frase === 'Más económico') assert(rs.every((x, j) => j === i || x.costoNum == null || rs[i].costoNum < x.costoNum), 'no es la más económica');
    if (o.frase === 'Menos traslados') assert(rs.every((x, j) => j === i || x.trasMin == null || rs[i].trasMin < x.trasMin), 'no es la de menos traslados');
  });
});

test('guardar como invitado funciona y DESPUÉS ofrece cuenta, que se puede omitir', () => {
  const app = conPlan({ userName: '' });
  const v = app.renderVals();
  v.guardarPlanGo();
  assert((app.state.savedPlans || []).length === 1, 'no guardó sin cuenta');
  assert(app.state.cuentaOpen === true, 'no ofreció crear cuenta después de guardar');
  app.renderVals().cuentaOmitir();
  assert(app.state.cuentaOpen === false && (app.state.savedPlans || []).length === 1, 'omitir perdió el plan');
});

test('lo que se pidió quitar ya no está: SOBRES AI, DEMO, EN VIVO, venues y el emoji de guardar', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const plantilla = html.slice(html.indexOf('<x-dc>'), html.indexOf('</x-dc>'));
  [/SOBRES AI/i, /\bDEMO\b/, /liveLabel|conectados/, /Para venues/i, /💾/, /isVenues/, /Último minuto/].forEach(rx =>
    assert(!rx.test(plantilla), 'la plantilla todavía tiene ' + rx));
  const app = makeApp({}, { dseed: 73 });
  const v = app.renderVals();
  assert(v.navItems.map(n => n.label).join() === 'Inicio,Explorar,Mis planes', 'navegación: ' + v.navItems.map(n => n.label));
});

section('23 · Catálogo del Excel, repetidos y precios revisados');

test('todos los lugares del Excel están, sin repetir, salvo los que no tienen ubicación', () => {
  const app = makeApp(BASE, { dseed: 7 });
  const cat = app.cat();
  const xl = cat.filter(v => /^xl-/.test(v.id));
  assert(xl.length >= 480, 'faltan lugares del Excel: hay ' + xl.length);
  const ids = new Set(); cat.forEach(v => { assert(!ids.has(v.id), 'id repetido: ' + v.id); ids.add(v.id); });
  // Mismo nombre y misma dirección = el mismo lugar dos veces.
  const vistos = {};
  cat.forEach(v => { if (!v.addr) return; const k = app.strip(v.n) + '|' + app.strip(v.addr);
    assert(!vistos[k], 'repetido: ' + v.n + ' (' + v.addr + ')'); vistos[k] = 1; });
  // Cada uno trae fuente, actividad y precio con estado declarado.
  xl.forEach(v => { assert(v.src, v.n + ' sin fuente'); assert((v.act || []).length, v.n + ' sin actividad');
    assert(['estimado','rango','verificado','por_confirmar'].includes(v.pEstado), v.n + ' estado de precio raro: ' + v.pEstado); });
});

test('los repetidos que había en el catálogo ya no están (pero las sucursales sí)', () => {
  const cat = makeApp(BASE, { dseed: 7 }).cat();
  ['cdmx-0147','cdmx-0008','cdmx-0089','cdmx-0066','cdmx-0100','cdmx-0139','cdmx-0191','cdmx-0036','cdmx-0039','cdmx-2228','cdmx-2008','cdmx-2009']
    .forEach(id => assert(!cat.some(v => v.id === id), 'sigue el repetido ' + id));
  assert(cat.filter(v => /^Museo Tamayo/.test(v.n)).length === 1, 'Museo Tamayo debe estar una vez');
  assert(cat.filter(v => /Castillo de Chapultepec/.test(v.n) && v.cat === 'Museo').length === 1, 'el Castillo debe estar una vez');
  // Sucursales reales: varias Enigma Rooms, varios Fishers, dos sedes del Soumaya con nombre claro.
  assert(cat.filter(v => /^Enigma Rooms/.test(v.n)).length >= 4, 'faltan sedes de Enigma Rooms');
  const sou = cat.filter(v => /^Museo Soumaya/.test(v.n)).map(v => v.n).sort();
  assert(sou.join('|') === 'Museo Soumaya · Plaza Carso|Museo Soumaya · Plaza Loreto', 'sedes del Soumaya: ' + sou);
});

test('Sala de Despecho: Masaryk y Bosques, ~$1,500 por persona con propina', () => {
  const app = makeApp(BASE, { dseed: 7 });
  const sd = app.cat().filter(v => /^Sala de Despecho/.test(v.n));
  assert(sd.map(v => v.n).sort().join('|') === 'Sala de Despecho · Bosques|Sala de Despecho · Masaryk', 'sedes: ' + sd.map(v => v.n));
  sd.forEach(v => { const c = app.costoPlan([v]); assert(Math.abs(c.consumo + c.propina - 1485) < 20, v.n + ' cuesta ' + (c.consumo + c.propina)); });
  const bosques = sd.find(v => /Bosques/.test(v.n));
  assert(/Loma de la Palma 1813/.test(bosques.addr), 'dirección de Bosques: ' + bosques.addr);
  assert(bosques.dias && bosques.dias.join() === '0,3,4,5,6', 'Bosques abre miércoles a domingo');
});

test('precios: Quintonil, PANEM, Casa San Juan, Ryoshi y museos con su cifra real', () => {
  const app = makeApp(BASE, { dseed: 7 });
  const v = id => app.cat().find(x => x.id === id);
  assert(v('cdmx-0001').pMin === 5610, 'Quintonil: el menú solo cuesta $5,610');
  assert(v('cdmx-3001').pp === 1800 && v('cdmx-2229').pp === 1800, 'PANEM y Casa San Juan ~$2,000 con propina');
  assert(v('cdmx-2001').pp === 1100, 'Ryoshi ~$1,200 con propina');
  assert(v('tamayo').pp === 95 && v('cdmx-0005').pp === 105 && v('cdmx-0162').pp === 160, 'taquillas 2026');
  // Ningún restaurante se queda con el $1,500 de relleno.
  const relleno = app.cat().filter(x => x.pEstado === 'inferido' && x.pp === 1500);
  assert(!relleno.length, 'siguen con $1,500 de relleno: ' + relleno.map(x => x.n).slice(0, 5));
});

test('Mantequilla Social Club es restaurante con cupo de 16', () => {
  const app = makeApp(BASE, { dseed: 7 });
  const m = app.cat().filter(v => /Mantequilla/.test(v.n));
  assert(m.length === 1 && m[0].cat === 'Restaurante' && m[0].grupoMax === 16, JSON.stringify(m.map(x => [x.n, x.cat, x.grupoMax])));
  assert(app.queHacer(m[0]).some(t => /Cupo máximo: 16/.test(t)), 'la ficha no dice el cupo');
});

test('un lugar cerrado no se propone y la misma marca no sale en dos opciones', () => {
  const app = makeApp(BASE, { dseed: 7 });
  assert(!app.esRecomendable(app.cat().find(v => v.id === 'cdmx-0159')), 'el MUNAL está cerrado y se propone');
  for (let i = 0; i < 4; i++) {
    const r = i ? app.regenerate() && app.state.results : (app.runSearch(), app.state.results);
    const marcas = (app.state.results.plans || []).map(p => new Set(p.stops.map(v => app.marcaDe(v))));
    for (let a = 0; a < marcas.length; a++) for (let b = a + 1; b < marcas.length; b++)
      [...marcas[a]].forEach(m => assert(!marcas[b].has(m) || app.state.results.exhausted || /comparten/.test(app.state.results.expandNote || ''), 'la marca ' + m + ' sale en dos opciones'));
  }
});

test('lo que no se confirma no se propone y lo lejano sólo sale en toda la ciudad', () => {
  const app = makeApp(BASE, { dseed: 7 });
  const viejo = app.cat().find(v => v.id === 'xl-R0205');   // IDE Gourmet Oriental: única fuente de 2017
  assert(viejo && !app.esRecomendable(viejo), 'un lugar de una lista de 2017 sin confirmar se propone');
  const lejos = app.cat().find(v => v.id === 'xl-C0069');   // Parque Ejidal San Nicolás Totolapan
  assert(lejos && lejos.lejos, 'el Ajusco debería marcarse lejos');
  const cu = makeApp({ ...BASE, zone: 'cu', zonesSel: ['cu'], vibes: ['chill'], when: 'manana', planFrom: 9, planTo: 15 }, { dseed: 7 });
  cu.runSearch();
  assert(!(cu.state.results.plans || []).some(p => p.stops.some(v => v.lejos)), 'en CU · Sur propuso un lugar lejano');
});

test('los lugares del Excel viajan en el enlace compartido', () => {
  const app = makeApp(BASE, { dseed: 7 });
  assert(app.cortaId('xl-R0410') === 'LR0410' && app.largaId('LR0410') === 'xl-R0410', 'el id del Excel no se codifica bien');
  assert(app.largaId('x' + encodeURIComponent('Mi parada')).ext === 'Mi parada', 'se rompió la parada a mano');
});

section('24 · Votar lo compartido, pasos en celular y lo que se pidió');

test('romántico nunca propone una taquería ni una cadena casual', () => {
  const app = makeApp({ who:'date', groupSize:2, zone:'roma', zonesSel:['roma'], vibes:['romántico'], budget:'b1000', when:'noche', planFrom:19, planTo:24 }, { dseed: 11 });
  for (let i = 0; i < 4; i++) { if (i) app.regenerate(); else app.runSearch();
    (app.state.results.plans || []).forEach(p => p.stops.forEach(v => {
      assert(!['Taquería','Mercado','Cantina'].includes(v.cat), 'romántico propuso ' + v.n + ' (' + v.cat + ')'); })); }
  const califa = app.cat().find(v => /El Califa/.test(v.n));
  assert(califa && !app.vibeAdmite(califa), 'El Califa pasa como romántico');
});

test('noche y fiesta = bares y antros; comer rico = restaurante o terraza', () => {
  const n = makeApp({ zone:'roma', zonesSel:['roma'], vibes:['nightlife'], budget:'b1000', when:'noche', planFrom:20, planTo:26 }, { dseed: 12 });
  n.runSearch();
  const pn = n.state.results.plans || [];
  assert(pn.length, 'noche y fiesta en la Roma no dio planes');
  pn.forEach(p => p.stops.forEach(v => assert(n.CATS_NOCHE().includes(v.cat), 'noche y fiesta metió ' + v.n + ' (' + v.cat + ')')));
  const f = makeApp({ zone:'roma', zonesSel:['roma'], vibes:['foodie'], budget:'b1000', when:'noche', planFrom:19, planTo:24 }, { dseed: 13 });
  f.runSearch();
  (f.state.results.plans || []).forEach(p => assert(p.stops.some(v => f.cumpleCat(v, { k: 'mesa', cats: f.CATS_MESA() })),
    'comer rico sin restaurante: ' + p.stops.map(v => v.n + ' (' + v.cat + ')')));
});

test('si en la zona no cabe nada, amplía a las vecinas en vez de dejar la pantalla vacía', () => {
  const app = makeApp({ zone:'condesa', zonesSel:['condesa'], vibes:['nightlife'], budget:'b1000', when:'noche', planFrom:20, planTo:26 }, { dseed: 77, rseed: 500 });
  app.runSearch({ nueva: true });
  assert((app.state.results.plans || []).length > 0, 'no dio ningún plan');
});

test('un plan compartido se puede votar: botones en cada opción y propuesta a nombre de quien lo mandó', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  assert(/o\.votarSi/.test(html) && /o\.votarNo/.test(html), 'faltan los botones de voto en las opciones');
  assert(/registrarParaVotar\(planes, t\.by\)/.test(html), 'abrir un enlace no registra las opciones para votar');
  assert(/this\.setState\(\{ view: 'group' \}\)/.test(html), '?plan= no abre la votación sin nombre');
});

test('en celular el formulario va por pasos y en compu en una tabla', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  assert(/class="sb-tabla" data-paso="\{\{ paso \}\}"/.test(html), 'la tabla no sabe en qué paso va');
  assert(/@media \(max-width:1023px\)\{\s*\.sb-tabla\[data-paso="1"\]/.test(html), 'falta ocultar los otros pasos en celular');
  assert(/onClick="\{\{ pasoSiguiente \}\}"/.test(html), 'falta el botón Siguiente');
});

test('Hunan Polanco no existe', () => {
  assert(!makeApp(BASE, { dseed: 7 }).cat().some(v => /Hunan · Polanco/.test(v.n)), 'sigue Hunan Polanco');
});

report();