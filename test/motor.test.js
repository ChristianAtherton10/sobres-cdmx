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
    if (vistos.has(f)) dup.push(etq); vistos.add(f); };
  anota('inicial');
  for (let i = 0; i < 9; i++) { app.regenerate(); anota('rehacer' + i); }
  // editar a mano y seguir regenerando
  const cur = app.getPlan();
  const otro = app.state.results.ranked.find(v => !cur.stops.includes(v));
  app.setState({ planCustom: { stops: [cur.stops[0], otro], times: cur.times, spent: cur.stops[0].pp + otro.pp } });
  for (let i = 0; i < 3; i++) { app.regenerate(); anota('tras-editar' + i); }
  for (let i = 0; i < 3; i++) { app.runSearch({ surprise: true }); anota('sorpresa' + i); }
  for (let i = 0; i < 3; i++) { app.aiBuild('dame algo diferente, 4 amigos en santa fe hoy en la noche, maximo 1000 por persona'); anota('ai' + i); }
  assert(dup.length === 0, 'repitió en: ' + dup.join(', '));
});

test('cubre la mayor parte del espacio válido y tarda en repetir', () => {
  // Medición previa a los cambios: 32 combinaciones y primera repetición en el
  // paso 11.  El barrido sistemático sube la cobertura y retrasa la repetición.
  const app = makeApp(BASE, { dseed: 1234 });
  app.runSearch(); app.state.planStops = 2;
  const vistos = new Set(); let primeraRep = -1;
  for (let i = 0; i < 60; i++) {
    const p = app.getPlan(); if (!p) break;
    const f = sig(p);
    if (vistos.has(f) && primeraRep < 0) primeraRep = i;
    vistos.add(f); app.regenerate();
  }
  assert(vistos.size >= 33, 'sólo alcanzó ' + vistos.size + ' combinaciones distintas');
  assert(primeraRep < 0 || primeraRep >= 15, 'repitió demasiado pronto, en el paso ' + primeraRep);
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
