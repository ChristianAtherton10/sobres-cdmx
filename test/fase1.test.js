// Fase 1 · Errores del motor reportados el 3 nov 2026 (510 visitas de anuncios,
// 1 plan armado). Cada prueba reproduce un error con los filtros que lo
// causaron y se queda como regresión. motor.test.js las corre al final; también
// se pueden correr solas:  node test/fase1.test.js
const fs = require('fs');
const path = require('path');
const { makeApp, test, assert, section, report } = require('./harness.js');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Escenarios del reporte (los mismos filtros que usó cada persona).
const ESC = {
  famSantaFe: { who:'familia', groupSize:4, zone:'santafe', zonesSel:['santafe'], vibes:['familiar'], when:'finde', budget:'b600', planFrom:13, planTo:21 },
  famCoyoacan: { who:'familia', groupSize:4, zone:'coyoacan', zonesSel:['coyoacan'], vibes:['familiar'], when:'finde', budget:'b600', planFrom:10, planTo:18 },
  nocheRoma: { who:'amigos', groupSize:6, zone:'roma', zonesSel:['roma'], vibes:['nightlife'], when:'finde', budget:'b1000', planFrom:21, planTo:27 },
  datePolanco: { who:'date', groupSize:2, zone:'polanco', zonesSel:['polanco'], vibes:['romántico'], when:'noche', budget:'b1999', planFrom:20, planTo:24 },
  foodieSantaFe: { who:'amigos', groupSize:4, zone:'santafe', zonesSel:['santafe'], vibes:['foodie'], when:'noche', budget:'b600', planFrom:19, planTo:24 },
  famCentro: { who:'familia', groupSize:4, zone:'centro', zonesSel:['centro'], vibes:[], when:'noche', budget:'b600', planFrom:17, planTo:22 }
};
const SEMILLAS = [3, 11, 29, 47, 83, 131];

// Corre una búsqueda nueva, como la primera vez que alguien arma su plan.
function corre(st, dseed) {
  const app = makeApp(Object.assign({ budgetCustom: null }, JSON.parse(JSON.stringify(st))), { dseed, rseed: dseed * 7 + 1 });
  app.runSearch({ nueva: true });
  return { app, r: app.state.results, plans: (app.state.results.plans || []) };
}
const finDe = (app, p) => { const n = p.stops.length; return p.times[n - 1] + app.duracionAct(p.stops[n - 1]); };
const cobertura = (app, p) => { const [a, b] = app.range(); return (Math.min(finDe(app, p), b) - a) / (b - a); };
const txt = p => p.stops.map((v, i) => v.n + ' (' + v.cat + ', ' + v.z + ')').join(' → ');

section('25 · Fase 1: errores del motor (reporte 3 nov 2026)');

// 1 ───────────────────────────────────────────────────────────────
test('1 · Santa Fe se puede deseleccionar (y la siguiente búsqueda no queda en "Santa Fe y Polanco")', () => {
  const app = makeApp({ zone:'santafe', zonesSel:['santafe'] });
  const z = nombre => app.renderVals().zoneOpts.find(o => o.label.replace('✓ ', '') === nombre);
  z('Santa Fe · Poniente').pick();
  assert(app.state.zone === 'all' || !app.zoneList().includes('santafe'), 'Santa Fe sigue seleccionada después de tocarla otra vez');
  z('Polanco · Chapultepec').pick();   // zonas en grupos desde el 8 nov 2026
  assert(app.zonesLabel() === 'Polanco · Chapultepec', 'después de quitar Santa Fe y elegir Polanco quedó: ' + app.zonesLabel());
  z('Polanco · Chapultepec').pick();
  assert(!app.zoneList().includes('polanco') || app.state.zone === 'all', 'Polanco no se quita');
});

// 2 ───────────────────────────────────────────────────────────────
test('2 · el plan llena al menos 70% de la ventana pedida, o explica por qué', () => {
  ['famSantaFe', 'famCoyoacan', 'nocheRoma', 'datePolanco'].forEach(k => SEMILLAS.forEach(sd => {
    const { app, plans } = corre(ESC[k], sd);
    assert(plans.length, k + ' no dio planes');
    // Desde el 4 nov 2026 un LUGAR suelto es una opción válida y va sin texto
    // de más; los planes de varias paradas sí tienen que llenar o explicar.
    plans.filter(p => !p.unaParada).forEach(p => {
      const c = cobertura(app, p);
      assert(c >= 0.7 || (p.avisoVentana && p.avisoVentana.length > 20),
        k + '/' + sd + ': cubre ' + Math.round(c * 100) + '% y no explica por qué — termina ' + app.time12(finDe(app, p)) + ': ' + txt(p));
    });
    // Explicar no puede ser la salida fácil: en estos casos sí hay con qué llenar.
    // Al menos una opción llena el horario, o todas las de varias paradas dicen
    // por qué no (familia en Santa Fe con $300–600 no alcanza para 8 horas).
    const llenos = plans.filter(p => cobertura(app, p) >= 0.7).length;
    const explican = plans.filter(p => !p.unaParada).every(p => cobertura(app, p) >= 0.7 || p.avisoVentana);
    assert(llenos >= 1 || explican, k + '/' + sd + ': ninguna de ' + plans.length + ' opciones llena la ventana ni lo explica');
  }));
});

// 3 ───────────────────────────────────────────────────────────────
test('3 · ventana de más de 4 h o que cruza comida/cena lleva una parada para comer', () => {
  ['famSantaFe', 'famCoyoacan', 'nocheRoma', 'foodieSantaFe'].forEach(k => SEMILLAS.forEach(sd => {
    const { app, plans } = corre(ESC[k], sd);
    plans.filter(p => !p.unaParada).forEach(p => assert(p.stops.some(v => app.sirveComida(v)) || (p.avisoComida && p.avisoComida.length > 20),
      k + '/' + sd + ': plan largo sin comida: ' + txt(p)));
    assert(plans.filter(p => p.stops.some(v => app.sirveComida(v))).length >= 1,
      k + '/' + sd + ': ninguna opción trae dónde comer');
  }));
});

// 4 ───────────────────────────────────────────────────────────────
test('4 · noche y fiesta pasada la 1 am: 2 de 3 opciones terminan en antro o bar con baile', () => {
  SEMILLAS.forEach(sd => {
    const { app, plans } = corre(ESC.nocheRoma, sd);
    assert(plans.length === 3, sd + ': Roma de noche dio ' + plans.length + ' opciones: ' + plans.map(txt).join(' || '));
    const bailan = plans.filter(p => app.bailable(p.stops[p.stops.length - 1])).length;
    assert(bailan >= 2, sd + ': sólo ' + bailan + ' terminan bailando: ' + plans.map(txt).join(' || '));
  });
});
test('4b · si en la zona no hay dónde bailar, amplía a la más cercana y lo dice', () => {
  const { app, plans, r } = corre({ who:'amigos', groupSize:6, zone:'coyoacan', zonesSel:['coyoacan'], vibes:['nightlife'], when:'finde', budget:'b1000', planFrom:21, planTo:27 }, 5);
  assert(!app.cat().some(v => v.z === 'coyoacan' && app.bailable(v) && !v.lejos), 'la prueba supone que Coyoacán no tiene antro');
  const bailan = plans.filter(p => app.bailable(p.stops[p.stops.length - 1])).length;
  assert(bailan >= 2, 'Coyoacán de fiesta: sólo ' + bailan + ' opciones terminan bailando');
  assert(/bailar|antro/i.test(r.expandNote || ''), 'no avisó que amplió la zona para ir a bailar: ' + r.expandNote);
});

// 5 ───────────────────────────────────────────────────────────────
test('5 · ningún lugar se repite entre las 3 opciones y la primera parada varía de tipo', () => {
  Object.keys(ESC).forEach(k => SEMILLAS.forEach(sd => {
    const { app, plans } = corre(ESC[k], sd);
    const vistos = {};
    plans.forEach((p, i) => p.stops.forEach(v => {
      const m = app.marcaDe(v);
      assert(vistos[m] == null || vistos[m] === i, k + '/' + sd + ': ' + v.n + ' sale en dos opciones');
      vistos[m] = i;
    }));
    // Tipo de inicio = categoría; en restaurantes, la cocina (tres restaurantes
    // de cocinas distintas sí son variedad — "Comer rico" sólo da restaurantes).
    if (plans.length === 3) {
      const cats = plans.map(p => app.tipoInicio(p.stops[0]));
      assert(!(cats[0] === cats[1] && cats[1] === cats[2]), k + '/' + sd + ': las 3 empiezan en ' + cats[0]);
    }
  }));
});

test('5b · sin repetir lugares igual salen varias opciones: se cambia la parada en común (Mercado de Coyoacán)', () => {
  for (let k = 1; k <= 12; k++) {
    const { plans } = corre(ESC.famCoyoacan, k * 13);
    assert(plans.length >= 2, 'semilla ' + k * 13 + ': familia en Coyoacán dio ' + plans.length + ' opción(es)');
    const { plans: pn } = corre(ESC.nocheRoma, k * 13);
    assert(pn.length === 3, 'semilla ' + k * 13 + ': noche en la Roma dio ' + pn.length + ' opciones');
  }
});

// 6 ───────────────────────────────────────────────────────────────
test('6 · mínimo 2 paradas; fuera de la zona sólo si no hay opciones dentro, y con aviso', () => {
  Object.keys(ESC).forEach(k => SEMILLAS.forEach(sd => {
    const { app, plans, r } = corre(ESC[k], sd);
    // Excepción pedida por el usuario (4 nov 2026): si no sale un buen plan, la
    // opción puede ser UN LUGAR suelto del tipo pedido (sin texto de más).
    plans.forEach(p => assert(p.stops.length >= 2 || p.unaParada, k + '/' + sd + ': plan de una sola parada: ' + txt(p)));
    const fuera = plans.some(p => p.stops.some(v => !app.zoneList().includes(v.z)));
    if (fuera) assert(/ampliamos|zona/i.test(r.expandNote || ''), k + '/' + sd + ': salió de la zona sin avisar');
  }));
  SEMILLAS.forEach(sd => {
    const { app, plans } = corre(ESC.datePolanco, sd);
    plans.forEach(p => assert(p.stops.every(v => v.z === 'polanco'), 'date en Polanco salió de Polanco: ' + txt(p)));
  });
});

// 7 ───────────────────────────────────────────────────────────────
test('7 · aptoFamilia existe en el catálogo (sí/no/desconocido)', () => {
  const app = makeApp({});
  const vals = new Set(app.cat().map(v => v.aptoFamilia));
  assert([...vals].every(x => ['sí', 'no', 'desconocido'].includes(x)), 'valores raros de aptoFamilia: ' + [...vals].join(','));
  ['Bar', 'Antro', 'Cantina', 'Speakeasy', 'Mezcalería'].forEach(c => {
    const v = app.cat().find(x => x.cat === c);
    assert(v && v.aptoFamilia === 'no', c + ' no está marcado como no apto para familia');
  });
  const k = app.cat().find(v => /karaoke/i.test(v.n)); assert(k && k.aptoFamilia === 'no', 'el karaoke no está marcado');
  const pq = app.cat().find(v => /pulquer[ií]a/i.test(v.n) && v.cat !== 'Museo'); assert(pq && pq.aptoFamilia === 'no', 'la pulquería no está marcada');
  const m = app.cat().find(v => v.cat === 'Museo'); assert(m.aptoFamilia !== 'no', 'un museo quedó como no apto');
});
test('7b · en familia no salen bares, antros, cantinas, pulquerías, speakeasies, mezcalerías ni karaokes', () => {
  const PROHIBIDO = ['Bar', 'Bar de autor', 'Antro', 'Salón de baile', 'Cantina', 'Speakeasy', 'Mezcalería'];
  const mira = (st, sd, etq) => { const { app, plans } = corre(st, sd);
    plans.forEach(p => p.stops.forEach(v => assert(!PROHIBIDO.includes(v.cat) && !/karaoke|pulquer[ií]a/i.test(v.n) && v.aptoFamilia !== 'no',
      etq + '/' + sd + ': plan familiar con ' + v.n + ' (' + v.cat + ')'))); };
  SEMILLAS.forEach(sd => {
    mira(ESC.famCentro, sd, 'familia centro');
    mira(ESC.famSantaFe, sd, 'familia santa fe');
    mira(Object.assign({}, ESC.famCentro, { zone:'roma', zonesSel:['roma'], vibes:['foodie'], planFrom:18, planTo:23 }), sd, 'familia roma noche');
    mira(Object.assign({}, ESC.famCentro, { zone:'polanco', zonesSel:['polanco'], vibes:['nightlife'], planFrom:19, planTo:24, budget:'b1000' }), sd, 'familia polanco nightlife');
  });
});

// 8 ───────────────────────────────────────────────────────────────
test('8 · zonas vecinas por distancia real entre centros y sin duplicados', () => {
  const app = makeApp({});
  const sf = app.vecinas('santafe');
  assert(!sf.includes('centro') && !sf.includes('romasur'), 'Santa Fe tiene de vecinas a: ' + sf.join(', '));
  assert(sf[0] === 'lomas', 'la vecina más cercana a Santa Fe debería ser Lomas, salió ' + sf[0]);
  Object.keys(app.ZGEO).forEach(z => { const l = app.vecinas(z); assert(new Set(l).size === l.length && !l.includes(z), z + ' tiene vecinas repetidas: ' + l); });
  // Dos zonas elegidas con la misma vecina: la vecina sale una vez.
  const two = makeApp({ zone:'santafe', zonesSel:['santafe','polanco'], vibes:['foodie'], budget:'b1000', when:'noche' });
  const r = two.engine(0, { ampliar: true });
  const lista = (r.expandNote.split(':')[1] || '').split(/,| y /).map(x => x.replace(/\(.*$/, '').trim()).filter(Boolean);
  assert(new Set(lista).size === lista.length, 'aviso con zonas repetidas: ' + r.expandNote);
  assert(new Set(r.zones).size === r.zones.length, 'zonas repetidas en la búsqueda: ' + r.zones);
});

// 9 ───────────────────────────────────────────────────────────────
test('9 · Explorar en "Toda la ciudad" muestra todos los lugares, no 420', () => {
  const app = makeApp({ view: 'map', mapZone: 'all', mapCat: 'todo', openNow: false });
  const rv = app.renderVals();
  const n = parseInt(String(rv.mapCount).replace(/[^\d]/g, ''), 10);
  assert(n === app.cat().length, 'Explorar dice ' + rv.mapCount + ' y el catálogo tiene ' + app.cat().length);
});

// 10 ──────────────────────────────────────────────────────────────
test('10 · con "Solo" se puede ser 1; el contador baja a 1', () => {
  const app = makeApp({ who:'amigos', groupSize:2 });
  let rv = app.renderVals();
  assert(rv.showSize, 'el contador de personas no se muestra');
  rv.sizeDown();
  assert(app.state.groupSize === 1, 'el mínimo sigue siendo ' + app.state.groupSize);
  assert(app.state.who === 'solo', 'con 1 persona debería quedar "Solo", quedó ' + app.state.who);
  rv = app.renderVals(); rv.sizeUp();
  assert(app.state.groupSize === 2 && app.state.who !== 'solo', 'de Solo no se puede volver a 2');
  const s = makeApp({}); s.renderVals().whoOpts.find(o => /Solo/.test(o.label)).pick();
  assert(s.state.groupSize === 1, 'Solo no deja 1 persona');
});

// 11 ──────────────────────────────────────────────────────────────
test('11 · el resumen de arriba reserva su espacio (no brinca al primer toque)', () => {
  assert(/class="sb-note sb-resumen-fijo"[^>]*>\{\{ armarResumen \}\}/.test(HTML), 'el resumen no tiene la clase que reserva su altura');
  assert(/\.sb-resumen-fijo\{[^}]*min-height:/.test(HTML), 'falta reservar la altura del resumen en el CSS');
  const app = makeApp({ vibes: [] });
  const a = app.renderVals().armarResumen; app.state.vibes = ['foodie', 'nightlife', 'cultural']; const b = app.renderVals().armarResumen;
  assert(a.length > 10 && b.length > 10, 'el resumen está vacío al inicio: "' + a + '"');
});

// 12 ──────────────────────────────────────────────────────────────
test('12 · no hay nombres con letras pegadas o repetidas', () => {
  const app = makeApp({});
  const malos = app.cat().filter(v => require('./typos.js').sospechoso(v.n));
  assert(!malos.length, malos.length + ' nombres sospechosos: ' + malos.slice(0, 6).map(v => v.n).join(' · '));
});

// 13 ──────────────────────────────────────────────────────────────
test('13 · cada opción cuesta lo que dice el rango (paradas + cover + 10% de propina)', () => {
  ['famSantaFe', 'nocheRoma', 'datePolanco', 'foodieSantaFe', 'famCoyoacan'].forEach(k => SEMILLAS.forEach(sd => {
    const { app, plans, r } = corre(ESC[k], sd);
    const max = app.budgetMax(), min = app.budgetMin();
    plans.forEach(p => {
      const c = app.costoEstimado(p.stops);
      assert(c <= max, k + '/' + sd + ': cuesta ~$' + c + ' pp y el tope es $' + max + ': ' + txt(p));
      // Un lugar suelto que cuesta menos que el rango no necesita explicación
      // (el usuario pidió quitar textos de más el 4 nov 2026).
      assert(c >= min || p.unaParada || /menos de|por debajo/i.test((p.avisoPrecio || '') + ' ' + (r.expandNote || '')),
        k + '/' + sd + ': cuesta ~$' + c + ' y el rango empieza en $' + min + ' sin explicarlo');
    });
  }));
});
test('13b · "Más económico" nunca cuesta más que las otras opciones', () => {
  Object.keys(ESC).forEach(k => SEMILLAS.forEach(sd => {
    const { app, plans } = corre(ESC[k], sd);
    if (plans.length < 2) return;
    const fr = app.frasesOpciones(plans);
    const i = fr.indexOf('Más económico'); if (i < 0) return;
    const ci = app.costoEstimado(plans[i].stops);
    plans.forEach((p, j) => assert(j === i || app.costoEstimado(p.stops) >= ci,
      k + '/' + sd + ': "Más económico" (~$' + ci + ') cuesta más que la opción ' + (j + 1) + ' (~$' + app.costoEstimado(p.stops) + ')'));
  }));
});

// 14 ─────────────────────────────────────────────────────────────
// Reporte del usuario (4 nov 2026): "si sólo quiero comer rico, ¿por qué pone
// bares? ¿y taquería?". Comer rico = restaurante o terraza, sin bares ni tacos.
test('14 · "Comer rico" no propone bares, cantinas, antros ni taquerías', () => {
  const NO = ['Bar', 'Bar de autor', 'Speakeasy', 'Mezcalería', 'Cantina', 'Antro', 'Salón de baile', 'Taquería'];
  const zonas = ['roma', 'condesa', 'polanco', 'juarez', 'coyoacan', 'santafe', 'centro'];
  zonas.forEach((z, i) => [3, 29, 83].forEach(sd => {
    const st = { who:'amigos', groupSize:4, zone:z, zonesSel:[z], vibes:['foodie'], when:'noche', budget:'b600' };
    const { app, plans } = corre(i % 2 ? Object.assign(st, { budget:'b1000', planFrom:19, planTo:24 }) : st, sd);
    assert(plans.length, z + '/' + sd + ': comer rico no dio planes');
    plans.forEach(p => {
      p.stops.forEach(v => assert(!NO.includes(v.cat), z + '/' + sd + ': comer rico propuso ' + v.n + ' (' + v.cat + '): ' + txt(p)));
      p.stops.forEach(v => assert(!app.esCadenaCasual(v), z + '/' + sd + ': comer rico propuso la cadena ' + v.n));
      assert(p.stops.length >= 2 || p.unaParada, z + '/' + sd + ': una parada que no es lugar suelto');
      assert(p.stops.some(v => app.CATS_MESA().includes(v.cat)), z + '/' + sd + ': comer rico sin restaurante: ' + txt(p));
    });
  }));
});
test('14c · con "Comer rico" ninguna opción se anuncia "Para unos tragos"', () => {
  ['roma', 'condesa', 'polanco'].forEach(z => [3, 29].forEach(sd => {
    const { app, plans } = corre({ who:'amigos', groupSize:4, zone:z, zonesSel:[z], vibes:['foodie'], when:'noche', budget:'b1000' }, sd);
    assert(app.frasesOpciones(plans).indexOf('Para unos tragos') < 0, z + '/' + sd + ': dice "Para unos tragos" en comer rico');
  }));
});
test('14b · con "Comer rico" + "Noche y fiesta" sí puede haber bares', () => {
  const { plans } = corre({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], vibes:['foodie','nightlife'], when:'noche', budget:'b1000', planFrom:19, planTo:26 }, 3);
  assert(plans.some(p => p.stops.some(v => ['Bar','Bar de autor','Speakeasy','Mezcalería','Antro','Rooftop'].includes(v.cat))), 'comer + fiesta se quedó sin bares');
});

// 15 ─────────────────────────────────────────────────────────────
// Reporte del usuario (4 nov 2026): "un restaurante a las 7 pm y otro a las
// 9:20 pm, ¿cómo hace sentido?". Entre dos comidas completas, mínimo 4 horas.
const COMIDA_COMPLETA = ['Restaurante', 'Fonda de autor', 'Izakaya', 'Taquería', 'Mercado'];
test('15 · nunca dos comidas completas con menos de 4 horas entre ellas', () => {
  const casos = [ESC.famSantaFe, ESC.famCoyoacan, ESC.foodieSantaFe, ESC.datePolanco,
    { who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], vibes:['foodie'], when:'noche', budget:'b1000' },
    { who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], vibes:['foodie'], when:'noche', budget:'b600' },
    { who:'amigos', groupSize:4, zone:'juarez', zonesSel:['juarez'], vibes:['foodie','nightlife'], when:'noche', budget:'b1000' },
    { who:'amigos', groupSize:4, zone:'condesa', zonesSel:['condesa'], vibes:[], when:'finde', budget:'b1000', planFrom:12, planTo:22 }];
  casos.forEach((st, k) => SEMILLAS.forEach(sd => {
    const { app, plans } = corre(st, sd);
    plans.forEach(p => {
      const ix = p.stops.map((v, i) => i).filter(i => app.esComidaCompleta(p.stops[i]));
      for (let a = 0; a < ix.length; a++) for (let b = a + 1; b < ix.length; b++)
        assert(Math.abs(p.times[ix[b]] - p.times[ix[a]]) >= 4 - 1e-6, 'caso ' + k + '/' + sd + ': dos comidas a ' +
          app.time12(p.times[ix[a]]) + ' y ' + app.time12(p.times[ix[b]]) + ': ' + txt(p));
    });
  }));
});
// Si no sale un buen plan, sólo lugares sueltos según lo que se pidió, sin texto de más.
test('15b · sin buen plan: lugares sueltos del tipo pedido y sin el aviso de "una sola parada"', () => {
  const tipos = { foodie: ['Restaurante','Fonda de autor','Izakaya','Rooftop'], nightlife: ['Bar','Bar de autor','Speakeasy','Mezcalería','Rooftop','Antro','Salón de baile','Cantina'] };
  [['santafe', ['foodie'], 'b600'], ['santafe', ['nightlife'], 'b600'], ['roma', ['foodie'], 'b600']].forEach(([z, vb, b]) => [3, 29].forEach(sd => {
    const { app, plans, r } = corre({ who:'amigos', groupSize:4, zone:z, zonesSel:[z], vibes:vb, when:'noche', budget:b }, sd);
    assert(plans.length >= 1, z + ' ' + vb + ': ninguna opción');
    if (z !== 'santafe') assert(plans.length === 3, z + ' ' + vb + ': ' + plans.length + ' opciones');
    plans.filter(p => p.stops.length === 1).forEach(p => {
      assert(tipos[vb[0]].includes(p.stops[0].cat) || app.esBarDeNombre(p.stops[0]), z + ' ' + vb + ': lugar suelto fuera de contexto: ' + txt(p));
      assert(p.stops[0].z === z || /zona vecina|ampliamos/.test(r.expandNote || ''), z + ': lugar suelto en otra zona sin avisar: ' + txt(p));
    });
    assert(!/una sola parada/i.test(JSON.stringify(plans.map(p => [p.avisoVentana, p.avisoComida, p.avisoPrecio, p.avisoUnaParada])) + (r.expandNote || '')),
      z + ': sigue el texto de "una sola parada"');
  }));
});

// 16 ─────────────────────────────────────────────────────────────
// Reporte del usuario (4 nov 2026): "puse cultural y me da opciones de comida,
// tacos, heladerías". Con "Cultural" cada opción trae algo cultural y no hay
// taquerías, cafés, heladerías ni bares de relleno.
test('16 · "Cultural": cada opción es cultural; nada de tacos, cafés, heladerías ni bares', () => {
  const NO = ['Taquería', 'Café', 'Heladería', 'Churrería', 'Bar', 'Bar de autor', 'Speakeasy', 'Mezcalería', 'Cantina', 'Antro', 'Salón de baile', 'Rooftop'];
  ['roma', 'centro', 'coyoacan', 'condesa'].forEach(z => ['noche', 'ahora', 'finde'].forEach(w => [3, 29].forEach(sd => {
    const { app, plans } = corre({ who:'amigos', groupSize:4, zone:z, zonesSel:[z], vibes:['cultural'], when:w, budget:'b600', hour:16 }, sd);
    plans.forEach(p => {
      p.stops.forEach(v => assert(!NO.includes(v.cat), z + '/' + w + '/' + sd + ': cultural con ' + v.n + ' (' + v.cat + '): ' + txt(p)));
      assert(p.stops.some(v => app.esCultural(v)), z + '/' + w + '/' + sd + ': opción sin nada cultural: ' + txt(p));
    });
  })));
});
test('16b · "Cultural" de noche en la Roma da lugares culturales (teatros con cartelera por confirmar), no comida', () => {
  const { app, plans } = corre({ who:'amigos', groupSize:4, zone:'roma', zonesSel:['roma'], vibes:['cultural'], when:'noche', budget:'b600' }, 3);
  assert(plans.length >= 1, 'no dio ninguna opción');
  plans.forEach(p => assert(p.stops.some(v => app.esCultural(v)), 'opción sin nada cultural: ' + txt(p)));
  // Sin función confirmada no se inventa horario en la tarjeta.
  app.setState({ results: app.state.results });
  const ops = app.renderVals().opciones || [];
  plans.forEach((p, i) => { if (p.cartelera) assert(ops[i] && ops[i].horario === 'Según cartelera', 'la tarjeta inventa horario: ' + (ops[i] && ops[i].horario)); });
});

// 17 ─────────────────────────────────────────────────────────────
// Recetas por ambiente (4 nov 2026): cada opción trae algo de la receta del
// ambiente pedido (comer rico = restaurante; cultural = museo/teatro/cine…;
// romántico = cena rica, taller, cata, paseo, bar de autor; etc.).
test('17 · cada ambiente propone lo suyo (recetas)', () => {
  const R = makeApp({}).RECETAS();
  const piezasDe = a => { const set = new Set(); ['manana', 'tarde', 'noche'].forEach(f => (R.recetas[a][f] || []).forEach(t => t.forEach(x => set.add(x)))); (R.recetas[a].sueltos || []).forEach(x => set.add(x)); return [...set]; };
  const casos = [['romántico', 'roma'], ['romántico', 'condesa'], ['foodie', 'polanco'], ['nightlife', 'roma'], ['cultural', 'centro'],
    ['familiar', 'chapultepec'], ['social', 'roma'], ['aventurero', 'roma'], ['creativo', 'roma'], ['chill', 'coyoacan']];
  casos.forEach(([vb, z]) => ['noche', 'finde'].forEach(w => [3, 29].forEach(sd => {
    const { app, plans } = corre({ who: vb === 'familiar' ? 'familia' : 'amigos', groupSize: 4, zone: z, zonesSel: [z], vibes: [vb], when: w, budget: 'b1000' }, sd);
    const P = piezasDe(vb);
    plans.forEach(p => assert(p.stops.some(v => P.some(k => app.esPieza(v, R.piezas[k]))),
      vb + '/' + z + '/' + w + '/' + sd + ': opción sin nada de la receta: ' + txt(p)));
  })));
});
test('17b · romántico en la Roma de noche: cena rica, bar de autor o experiencia; nada de tacos ni cadenas', () => {
  const { app, plans } = corre({ who:'date', groupSize:2, zone:'roma', zonesSel:['roma'], vibes:['romántico'], when:'noche', budget:'b1999' }, 3);
  assert(plans.length === 3, 'romántico dio ' + plans.length + ' opciones');
  plans.forEach(p => p.stops.forEach(v => assert(v.cat !== 'Taquería' && !app.esCadenaCasual(v), 'romántico con ' + v.n)));
});

// Regresión (4 nov 2026): la pieza "cata" tomaba el Teatro Santa Catarina y una
// biblioteca del CICATA; "en bici" tomaba una ruta de tacos A PIE (por ser Tour).
test('17c · las piezas no se confunden por una palabra dentro de otra', () => {
  const app = makeApp({}); const R = app.RECETAS(); const todos = app.cat();
  const de = k => todos.filter(v => app.esPieza(v, R.piezas[k])).map(v => v.n);
  de('cata').forEach(n => assert(!/catarina|cicata/i.test(n), 'cata = ' + n));
  de('bici_tour').forEach(n => assert(/bike|bici|ciclot/i.test(n), 'en bici = ' + n));
  assert(de('karaoke').some(n => /cantabar/i.test(n)), 'el karaoke no reconoce un "cantabar"');
  assert(de('cine_arte').some(n => /cine tonal/i.test(n)), 'el Cine Tonalá no cuenta como cine de arte');
  assert(de('mirador').some(n => /monumento a la revoluci/i.test(n)), 'falta el mirador del Monumento a la Revolución');
});

// Las piezas que tenían 1 o 2 lugares ya tienen de dónde escoger (con fuente).
test('17d · piezas con oferta real: karaoke, billar, boliche, go karts, baile, cine de arte, trajineras', () => {
  const app = makeApp({}); const R = app.RECETAS();
  const rec = app.cat().filter(v => app.esRecomendable(v));
  // boliche 5 → 4, karting 3 → 2 y cine de arte 6 → 4: la revisión del fundador (9 nov 2026) pausó
  // algunos hasta confirmar horario o cartelera.
  const min = { karaoke: 5, billar: 4, boliche: 4, karting: 2, salon_baile: 6, cine_arte: 4, trajineras: 2, estadio: 4 };
  Object.keys(min).forEach(k => {
    const n = rec.filter(v => app.esPieza(v, R.piezas[k])).length;
    assert(n >= min[k], k + ' tiene ' + n + ' lugares recomendables (mínimo ' + min[k] + ')');
  });
});

// Regresión (9 nov 2026): la prueba usaba "hoy" y un lunes no abre ningún karaoke,
// billar ni salón de la Roma (todos abren de miércoles a domingo): fallaba según el día.
// Ahora corre un viernes fijo.
const viernes17e = (() => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
test('17e · "con amigos" de noche en la Roma puede proponer karaoke, billar o salón de baile', () => {
  const R = makeApp({}).RECETAS(); const vistos = new Set();
  [1, 2, 3, 4, 5, 6, 7, 8].forEach(sd => {
    const { app, plans } = corre({ who: 'amigos', groupSize: 4, zone: 'roma', zonesSel: ['roma'], vibes: ['social'], when: 'fecha', customDate: viernes17e, budget: 'b1000' }, sd);
    plans.forEach(p => p.stops.forEach(v => ['karaoke', 'billar', 'salon_baile', 'boliche'].forEach(k => { if (app.esPieza(v, R.piezas[k])) vistos.add(k); })));
  });
  assert(vistos.size >= 2, 'en 8 tandas sólo salió: ' + [...vistos].join(', '));
});

// Regresión (4 nov 2026): al recortar o alargar un plan, las paradas que ya
// tenía se repartían a horas nuevas y una podía quedar a una hora en que cierra.
test('17f · recortar o alargar un plan no mueve las paradas que ya tenía a horas en que cierran', () => {
  const app = makeApp({ who: 'amigos', groupSize: 4, zone: 'all', zonesSel: [], when: 'noche', budget: 'b1k', budgetCustom: null,
    vibes: ['chill', 'cultural'], planFrom: 17, planTo: 26 }, { dseed: 82 });
  app.runSearch();
  const base = app.state.results.plans[0];
  [2, 3, 4, 5].forEach(n => {
    app.setState({ planStops: n });
    const p = app.getPlan();
    p.stops.forEach((v, i) => {
      assert(app.atHour(v, p.times[i]) || app.funcionSinConfirmar(v), n + ' paradas: ' + v.n + ' cerrado a las ' + p.times[i]);
      if (base.stops[i] === v) assert(p.times[i] === base.times[i], n + ' paradas: ' + v.n + ' cambió de hora');
    });
  });
});

if (require.main === module) report();
