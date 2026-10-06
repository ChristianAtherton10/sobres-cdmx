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
function combinacionesValidas(app) {
  const r = app.state.results;
  const max = app.budgetMax();
  const rng = app.range();
  const n = Math.max(2, Math.min(5, Math.round((rng[1] - rng[0]) / 2.2)));
  const step = (rng[1] - rng[0]) / n;
  const t0 = rng[0], t1 = rng[0] + step;
  const excl = app.exclSet();
  const pool = app.cat().filter(v => !excl.has(v.id) && app.budgetOk(v) && app.timingOk(v) && r.zones.includes(v.z));
  const grupoDe = v => Object.keys(app.G).find(g => app.G[g].includes(v.cat));
  const gs0 = app.SEGG[app.segFor(t0)] || ['comida'];
  const gs1 = app.SEGG[app.segFor(t1)] || ['comida'];
  const A = pool.filter(v => { const g = grupoDe(v); return g && gs0.includes(g) && app.atHour(v, t0); });
  const B = pool.filter(v => { const g = grupoDe(v); return g && gs1.includes(g) && app.atHour(v, t1); });
  const out = new Set();
  A.forEach(a => B.forEach(b => {
    if (a.id === b.id || grupoDe(a) === grupoDe(b)) return;
    if (a.pp + b.pp > max) return;
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

test('un lugar gratis sigue diciendo Gratis, no "por confirmar"', () => {
  const app = makeApp(BASE, { dseed: 5 });
  assert(app.precioTxt({ pp: 0 }) === 'Gratis');
  assert(app.precioTxt({ pp: 450 }) === '~$450 pp');
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

test('a pie el total sí es completo, e incluye propina estimada', () => {
  const app = conPlan();
  app.state.transporte = 'caminando';
  const c = app.costoPlan(app.getPlan().stops);
  assert(c.completo === true, 'faltan: ' + c.faltan.join(', '));
  assert(c.propina > 0, 'no estimó propina');
  assert(c.total === c.consumo + c.propina, 'el total no cuadra');
  assert(app.renderVals().planMeta.includes('propina'), 'no muestra la propina');
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

report();
