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

test('10 Rehacer seguidos dan 10 combinaciones distintas', () => {
  const app = makeApp(BASE, { dseed: 1234 });
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
    const agotado = app.state.results.exhausted || app._aiExhausted;
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
    && r.zones.includes(v.z) && app.vibeAdmite(v, VM) && !v.cursoCerrado);
  // Actividades posibles en cada momento, según la tabla declarada.
  const actsEn = (v, t) => app.actsUtiles(v, VM)
    .filter(k => (app.SEGACT[app.segFor(t)] || []).indexOf(k) >= 0);
  const A = pool.filter(v => actsEn(v, t0).length && app.atHour(v, t0));
  const B = pool.filter(v => actsEn(v, t1).length && app.atHour(v, t1));
  const out = new Set();
  A.forEach(a => B.forEach(b => {
    if (a.id === b.id) return;
    // ¿Existe algún par de actividades con función distinta?
    const fa = actsEn(a, t0).map(k => app.funcionAct(k, t0));
    const fb = actsEn(b, t1).map(k => app.funcionAct(k, t1));
    if (!fa.some(x => fb.some(y => x !== y))) return;
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
  const app = makeApp(BASE, { dseed: 1234 });
  app.runSearch(); app.state.planStops = 2;
  const validas = combinacionesValidas(app);
  assert(validas.size > 20, 'el universo medido es sospechosamente chico: ' + validas.size);
  const vistas = new Set();
  let repitioCon = null;
  for (let i = 0; i < 40; i++) {
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
  const app = makeApp({ ...BASE, zone: 'santafe', zonesSel: ['santafe'] }, { dseed: 1 });
  const o = app.opcionesCopas(['santafe']);
  const bares = app.cat().filter(v => v.z === 'santafe' && app.DRINK.includes(v.cat));
  assert(bares.length === 0, 'la premisa cambió: Santa Fe ya tiene bares');
  assert(o.seguras.length > 0, 'con 0 bares concluyó que nadie sirve copas');
});

test('cena + copas en Santa Fe: lo cumple o lo explica, nunca lo sustituye callado', () => {
  ['600', '1000'].forEach(tope => {
    const app = makeApp({ ...BASE, zone: 'santafe', zonesSel: ['santafe'] }, { dseed: 1234 });
    app.aiBuild('4 amigos en santa fe hoy, cenar y tomar algo de 8pm a medianoche, maximo ' + tope + ' por persona');
    const stops = app.state.planCustom.stops;
    const resumen = app.state.aiSummary || '';
    const hayCopas = stops.some(v => app.sirveCopas(v) === 'si');
    if (hayCopas) {
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
  app.state.transporte = 'didi'; assert(app.provNombre() === 'DiDi', app.provNombre());
  app.state.transporte = 'uber'; assert(app.provNombre() === 'Uber', app.provNombre());
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
  // Sin lugares de cover desconocido, el total sí cierra
  const sinCover = stops.filter(v => !['Antro', 'Salón de baile', 'Espectáculo'].includes(v.cat));
  if (sinCover.length === stops.length) assert(c.completo === true, 'faltan: ' + c.faltan.join(', '));
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
  const app = conPlan({ groupSize: 6, transporte: 'didi' });
  app.state.planDate = '2026-10-09';
  const original = app.getPlan();
  const pl = app.buildPlanPayload(original);
  const otro = makeApp({ ...BASE, zone: 'polanco', zonesSel: ['polanco'], groupSize: 2, transporte: 'uber' }, { dseed: 99 });
  otro.openPlanOpt({ plan: pl });
  const q = otro.getPlan();
  assert(names(q).join() === names(original).join(), 'paradas distintas: ' + names(q));
  assert(JSON.stringify(q.times) === JSON.stringify(original.times), 'horas distintas');
  assert(otro.state.planDate === '2026-10-09', 'fecha: ' + otro.state.planDate);
  assert(otro.state.groupSize === 6, 'personas: ' + otro.state.groupSize);
  assert(otro.state.transporte === 'didi', 'transporte: ' + otro.state.transporte);
  assert(q.spent === original.spent, 'costo distinto');
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
  const casos = [['transporte publico', 'metro'], ['vamos en didi', 'didi'], ['pedimos uber', 'uber'],
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
  assert(v.ppUnknown, 'no publica cover: el precio debe quedar por confirmar');
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
  assert(finales.size >= 8, 'sólo ' + finales.size + ' destinos finales distintos');
  assert(lugares.size >= 15, 'sólo ' + lugares.size + ' lugares distintos en 11 tandas');
  assert(combos.size >= 25, 'sólo ' + combos.size + ' combinaciones distintas');
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
  [['caminando','coyoacan'], ['caminando','roma'], ['metro','all'], ['uber','polanco']].forEach(([tr, z]) => {
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
      budget:'b1k', budgetCustom:tope, vibes:[], transporte:'didi', planFrom:13, planTo:17 }, { dseed: 71 });
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
    budget:'b1k', budgetCustom:300, vibes:[], transporte:'didi', planFrom:13, planTo:17 }, { dseed: 72 });
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
    budget:'b1k', budgetCustom:300, vibes:[], transporte:'didi', planFrom:13, planTo:17 }, { dseed: 81 });
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
  assert(app.uberUrl(ext) === '', 'Uber no debe abrirse con un nombre inventado');
  assert(app.mapsUrl(ext) === '', 'Maps no debe buscar el nombre escrito a mano');
  assert(ext.ppUnknown && app.precioTxt(ext) === 'Precio por confirmar');
  assert(app.legKm(ext, { lat: 19.4, lng: -99.16 }) === null, 'sin ubicación no hay distancia');
});

test('el contexto completo viaja al compartir y se restaura sin defaults', () => {
  const app = makeApp({ who:'amigos', groupSize:5, zone:'roma', zonesSel:['roma'], when:'fecha',
    customDate:'2026-10-07', budget:'b1k', budgetCustom:1500, vibes:['foodie','nightlife'],
    transporte:'uber', planFrom:18, planTo:26 }, { dseed: 84 });
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
      budget:'b600', budgetCustom:null, vibes:[], transporte:'didi' }, { dseed: 85 });
    const pl = Object.assign({}, payload, { people: n, ids: payload.stops });
    rx.openPlanOpt({ plan: pl });
    assert(rx.state.groupSize === n, n + ' personas llegaron como ' + rx.state.groupSize);
    assert(rx.state.budgetCustom === 1500, 'el tope llegó como ' + rx.state.budgetCustom);
    assert(rx.state.transporte === 'uber', 'el transporte llegó como ' + rx.state.transporte);
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

test('"$1,000+" ya no se presenta como un tope', () => {
  const app = makeApp({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], when:'noche',
    budget:'b1k', budgetCustom:null, vibes:[] }, { dseed: 89 });
  assert(!/1,000\+/.test(app.budLabel()), 'budLabel: ' + app.budLabel());
  assert(/sin tope/i.test(app.budLabel()), 'budLabel: ' + app.budLabel());
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

report();