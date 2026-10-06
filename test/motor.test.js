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
  app.state.results = app.engine(0);
  app.state.planStops = 2;
  const vistos = new Set();
  for (let i = 0; i < 10; i++) { vistos.add(sig(app.getPlan())); app.regenerate(); }
  assert(vistos.size === 10, 'sólo ' + vistos.size + ' combinaciones distintas de 10');
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

// ───────────────────────── 6. Matriz del reporte ─────────────────────────
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
