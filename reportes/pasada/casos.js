#!/usr/bin/env node
// Casos de aceptación de la pasada profunda (10 nov 2026). Corre sobre el MISMO catálogo que la
// preview (data/*.js con la revisión del fundador) y describe lo que saldría en pantalla.
//   node reportes/pasada/casos.js            → todos los casos
//   node reportes/pasada/casos.js date regen → sólo los que contengan esas palabras
const path = require('path');
const { makeApp } = require(path.join(__dirname, '..', '..', 'test', 'harness.js'));
const solo = process.argv.slice(2);
const quiere = n => !solo.length || solo.some(k => n.indexOf(k) >= 0);
const $ = n => (n == null ? '?' : '$' + Math.round(n));

function fila(a, v, t, act) {
  const marcas = [];
  if (v.ppUnknown) marcas.push('sin$'); else marcas.push($(v.pp) + (v.pEstado === 'verificado' || v.pEstado === 'rango' ? '✓' : '~'));
  if (v.pausa) marcas.push('PAUSA'); if (v.evento) marcas.push('EVENTO'); if (v.hot) marcas.push('hot' + v.hot);
  if (a.esCadenaCasual && a.esCadenaCasual(v)) marcas.push('cadena');
  if (v.horaEstimada) marcas.push('hora~'); if (v.coordAprox) marcas.push('pin~');
  const abre = a.atHour(v, t) ? '' : ' ¡CERRADO a esa hora!';
  return `      ${a.time12(t).padStart(8)}  ${v.n} [${v.cat}${act ? ' · ' + act : ''} · ${v.col || a.zLabel(v.z)}] ${marcas.join(' ')}${abre}`;
}
function pinta(a, r, titulo) {
  const ps = (r && r.plans) || [];
  console.log(`  ${titulo}: ${ps.length} opción(es)` + (r && r.expandNote ? ` · nota: ${r.expandNote}` : '') + (r && r.exhausted ? ' · AGOTADO' : ''));
  if (r && r.ajustes && r.ajustes.length) console.log('    AJUSTES que puede elegir: ' + r.ajustes.map(x => x.txt + ' (+' + x.gana + ')').join(' | '));
  ps.forEach((p, i) => {
    const c = a.costoPlan(p.stops), rs = a.resumenPlan(p.stops, p.times), v = a.viabilidad ? a.viabilidad(p.stops, p.times) : { ok: true, problemas: [] };
    console.log(`    ${i + 1}. ${p.label || p.plantilla || 'suelto'} · ${rs.horario} · total ${$(c.total)}${c.completo ? '' : ' (incompleto: ' + c.faltan.join('; ') + ')'} · traslados ${rs.traslados}${v.ok ? '' : ' · INVIABLE: ' + JSON.stringify(v.problemas).slice(0, 160)}`);
    p.stops.forEach((s, k) => console.log(fila(a, s, p.times[k], (p.acts || [])[k])));
    if (a.queHacemos) { console.log('         QUÉ: ' + a.queHacemos(p)); const g = a.porQueGusta(p); if (g) console.log('         POR QUÉ: ' + g);
      console.log('         CUÁNTO: ' + a.cuantoCuesta(p)); console.log('         CÓMO: ' + a.comoNosMovemos(p));
      const cd = a.condicionesPlan(p.stops); if (cd.length) console.log('         ANTES DE DARLO POR HECHO: ' + cd.join('; ')); }
  });
  return ps;
}
function app(st, opts) {
  const a = makeApp({}, Object.assign({ search: '?v=facil', dseed: 1, rseed: 3, estricto: true }, opts || {})); a.ev = () => {};
  if (st.zonas) { st.zonesSel = st.zonas === 'all' ? [] : a.conGrupos(st.zonas); st.zone = st.zonas === 'all' ? 'all' : st.zonesSel[0]; delete st.zonas; }
  a.setState(st); return a;
}
const ms = fn => { const t = process.hrtime.bigint(); const r = fn(); return [r, Number(process.hrtime.bigint() - t) / 1e6]; };

const CASOS = {
  'date-600': () => [1, 2].forEach(sd => { const a = app({ who: 'date', groupSize: 2, vibes: ['romántico'], facilOpcion: 'romantico', budget: 'b600', zonas: ['roma', 'juarez'] }, { dseed: sd, rseed: sd * 3 });
    pinta(a, a.runSearch({ nueva: true }), 'Date · Roma·Condesa + Juárez·Centro · hasta $600 · 7pm–2am (semilla ' + sd + ')'); }),
  'creativo': () => { [['delvalle'], 'all'].forEach(z => { const a = app({ who: 'amigos', groupSize: 4, vibes: ['creativo'], budget: 'b1000', zonas: z, planFrom: 11, planTo: 20 });
      pinta(a, a.runSearch({ nueva: true }), 'Creativo · ' + (z === 'all' ? 'toda la ciudad' : 'Del Valle · Nápoles') + ' · $600–1,000 · 11am–8pm'); }); },
  'antro-tacos': () => { const st = { who: 'amigos', groupSize: 4, vibes: ['nightlife'], facilOpcion: 'fiesta', budget: 'b1000', zonas: ['roma'], planFrom: 22, planTo: 28 };
    let a = app(Object.assign({}, st)); pinta(a, a.runSearch({ nueva: true }), 'Antro y tacos · Roma·Condesa · 10pm–4am · $600–1,000');
    a = app(Object.assign({}, st, { zonas: ['santafe'] })); pinta(a, a.runSearch({ nueva: true }), 'Antro y tacos · Santa Fe · 10pm–4am');
    a = app(Object.assign({}, st)); if (a.aiParse) { const p = a.aiParse('no quiero antros'); console.log('   (aiParse "no quiero antros" →', JSON.stringify({ excluded: (p.excluded || []).length, cats: p.cats, noCats: p.noCats || p.exclCats || null }) + ')'); }
    a = app(Object.assign({}, st, { noQuiero: ['antro'] })); const ps = pinta(a, a.runSearch({ nueva: true }), 'Noche con «No quiero antros»');
    console.log('   antros o salones en esas opciones: ' + ps.reduce((n, p) => n + p.stops.filter(v => a.esAntro(v)).length, 0)); },
  'familia-plaza': () => { const a = app({ who: 'familia', groupSize: 4, vibes: ['familiar'], facilOpcion: 'familia', budget: 'b600', zonas: ['polanco'], planFrom: 14, planTo: 20 });
    pinta(a, a.runSearch({ nueva: true }), 'Familia · Polanco·Chapultepec · 2pm–8pm · hasta $600');
    const b = app({ who: 'familia', groupSize: 4, vibes: ['familiar'], facilOpcion: 'familia', budget: 'b600', zonas: ['coyoacan'], planFrom: 14, planTo: 20 });
    pinta(b, b.runSearch({ nueva: true }), 'Familia · Coyoacán·CU (Mítikah) · 2pm–8pm · hasta $600'); },
  'solo': () => { const a = app({ who: 'solo', groupSize: 1, vibes: ['cultural'], facilOpcion: 'cultural', budget: 'b600', zonas: ['juarez'], planFrom: 11, planTo: 18 });
    pinta(a, a.runSearch({ nueva: true }), 'Solo · museo · Juárez·Centro · 11am–6pm · hasta $600');
    const b = app({ who: 'solo', groupSize: 1, vibes: ['chill'], facilOpcion: 'tranqui', budget: 'b600', zonas: ['roma'], planFrom: 11, planTo: 18 });
    pinta(b, b.runSearch({ nueva: true }), 'Solo · tranqui/café · Roma·Condesa · 11am–6pm · hasta $600'); },
  'regen': () => { [['Buena cobertura: amigos, noche, Roma·Condesa, $600–1,000', { who: 'amigos', groupSize: 4, vibes: ['nightlife'], facilOpcion: 'fiesta', budget: 'b1000', zonas: ['roma'] }],
      ['Se agota: creativo en Del Valle, $600–1,000, 11am–8pm', { who: 'amigos', groupSize: 4, vibes: ['creativo'], budget: 'b1000', zonas: ['delvalle'], planFrom: 11, planTo: 20 }]].forEach(([t, st]) => {
      const a = app(st); const vistos = new Set(), sedes = new Set(), prin = new Set(); const tiempos = []; let rep = 0, repPrin = 0, total = 0;
      console.log('  ' + t);
      for (let i = 0; i <= 5; i++) {
        const [r, t1] = ms(() => { if (i === 0) return a.runSearch({ nueva: true }); a.regenerate(); return a.state.results; }); tiempos.push(t1);
        const ag = i > 0 ? a.state.agotado : null;
        if (ag && ag.nuevas === 0) { console.log(`    tanda ${i}: AGOTADO · 0 opciones nuevas · ${t1.toFixed(0)} ms · se conserva la tanda anterior · «${(ag.limita || {}).txt || ''}» · ajustes: ${(ag.ajustes || []).map(x => x.txt).join(' | ') || 'ninguno'}`); continue; }
        const ps = (r && r.plans) || []; let nuevosPrin = 0;
        ps.forEach(p => { const pr = (p.stops.find(v => v.id === p.ancla) || p.stops[0]); const kp = a.sedeDe ? a.sedeDe(pr) : pr.id;
          if (prin.has(kp)) repPrin++; else { prin.add(kp); nuevosPrin++; }
          p.stops.forEach(v => { total++; const k = a.sedeDe ? a.sedeDe(v) : v.id; if (vistos.has(k)) rep++; vistos.add(k); }); });
        console.log(`    tanda ${i}: ${ps.length} opciones · ${nuevosPrin} actividades principales nuevas · ${t1.toFixed(0)} ms${ag ? ' · últimas ' + ag.nuevas : ''}${r && r.expandNote ? ' · ' + r.expandNote : ''}`);
        ps.forEach(p => console.log('       ' + p.stops.map(v => v.n).join(' → ')));
      }
      console.log(`    → ${total} paradas mostradas, ${rep} repetidas; actividades principales distintas: ${prin.size}, repetidas ${repPrin}; primera ${tiempos[0].toFixed(0)} ms, regeneraciones ${tiempos.slice(1).map(x => x.toFixed(0)).join('/')} ms`);
    }); },
};
// Editar: fijar, alternativas, sustituir, mover hora, deshacer, agregar, quitar, borrador y enlace.
CASOS['editar'] = () => {
  const a = app({ who: 'amigos', groupSize: 4, vibes: ['foodie'], facilOpcion: 'cenar', budget: 'b1999', zonas: ['roma'], planFrom: 19, planTo: 24, aceptaSinPrecio: true });
  const r = a.runSearch({ nueva: true }); const p0 = r.plans.find(p => p.stops.length >= 2) || r.plans[0];
  a.setState({ planCustom: { stops: p0.stops.slice(), times: p0.times.slice(), spent: p0.spent }, planStops: p0.stops.length, planEditando: true, planView: 'edit', planHist: [] }); a.nav('plan');
  const ver = t => { const p = a.getPlan(), ts = a.curTimes(p), rs = a.resumenPlan(p.stops, ts), rev = a.revisaPlan(p);
    console.log(`  ${t}: ${p.stops.map((v, i) => a.time12(ts[i]) + ' ' + v.n.split(' ·')[0]).join(' → ')} · ${rs.costo} pp · traslados ${rs.traslados}` + (rev.ok ? ' · cuadra' : ' · NO CUADRA: ' + rev.problemas.map(x => x.txt + (x.reemplazo ? ' [ofrece: ' + x.reemplazo.n + ']' : ' [sin reemplazo]')).join(' ')) + ` · pasos para deshacer: ${(a.state.planHist || []).length}`); };
  ver('Plan elegido');
  const fija = a.getPlan().stops[0]; a.fijar(fija.id); console.log('  Fijé: ' + fija.n);
  a.alternativasResto(); ver('Alternativas para lo demás');
  const i = a.getPlan().stops.length - 1, alt = a.swapSuggest(i); console.log('  Sustitutos que funcionan para la última parada: ' + alt.map(v => v.n).join(' | '));
  if (alt[0]) { a.replaceStop(i, alt[0]); ver('Sustituí la última por ' + alt[0].n.split(' ·')[0]); }
  a.setStopTime(0, a.curTimes(a.getPlan())[0] - 1); ver('Moví la primera una hora antes');
  a.setStopTime(a.getPlan().stops.length - 1, 9); ver('Moví la última a las 9 am (a propósito)');
  a.deshacer(); ver('Deshacer');
  const D = a.sugerirDespues(); console.log('  ¿Qué hacemos después?: ' + (D.map(d => d.lbl + ' → ' + d.v.n.split(' ·')[0] + ' ' + a.time12(d.t) + ' (a ' + d.min + ' min, ' + a.precioTxt(d.v) + ')').join(' | ') || 'nada que tenga sentido a esa hora'));
  if (D[0]) { a.addStopAt(D[0].v, D[0].t); ver('Agregué «' + D[0].lbl + '»'); }
  if (a.getPlan().stops.length > 2) { a.removeStop(1); ver('Quité la segunda'); }
  const b0 = a.borradorLee(); console.log('  Borrador guardado: ' + (b0 ? b0.n : 'NO'));
  const p = a.getPlan(), ts = a.curTimes(p), c = a.costoPlan(p.stops, ts), url = a.tandaLinkDe([{ stops: p.stops, times: ts }]);
  const b = makeApp({}, { estricto: true }); b.ev = () => {}; b.abrirTanda(decodeURIComponent(url.split('?p=')[1]), true); const q = b.state.results.plans[0], c2 = b.costoPlan(q.stops, q.times);
  console.log(`  Enlace de WhatsApp (${url.length} caracteres): ${url}`);
  console.log(`    quien lo abre ve: ${q.stops.map((v, k) => b.time12(q.times[k]) + ' ' + v.n.split(' ·')[0]).join(' → ')} · $${c2.total} pp (quien lo mandó: $${c.total}) · ${q.stops.map(v => v.id).join() === p.stops.map(v => v.id).join() && q.times.join() === ts.join() && c2.total === c.total ? 'IGUAL' : 'DISTINTO'} · mismo id de votación: ${b.planOptId(q) === a.planOptId(p)}`);
  a.compartirUnPlan(); const alt2 = a.swapSuggest(0)[0]; if (alt2) { a.replaceStop(0, alt2); const V = a.renderVals(); console.log('  Tras cambiarlo después de compartir: ' + (V.versionOn ? V.versionTxt : 'SIN AVISO')); }
  a.trashPlan(); console.log('  Plan eliminado → borrador: ' + (a.borradorLee() ? 'SIGUE' : 'eliminado'));
};
// Perfil nuevo vs perfil que elige seguido lo mismo.
CASOS['perfil'] = () => { [['mariscos', /mariscos/, { vibes: ['foodie'], facilOpcion: 'cenar', planFrom: 14, planTo: 22 }], ['italiano', /italiana/, { vibes: ['foodie'], facilOpcion: 'cenar', planFrom: 19, planTo: 24 }], ['helado', /Heladería/, { vibes: ['chill'], planFrom: 13, planTo: 20 }]].forEach(([nom, re, st]) => {
    const base = Object.assign({ who: 'amigos', groupSize: 4, budget: 'b1999', zonas: ['roma', 'polanco'], noQuiero: ['cadena'], aceptaSinPrecio: true }, st);
    const tipo = (a, v) => a.cocinasPerfil(v).join(' ') + ' ' + v.cat; const cuenta = (a, ps) => ps.reduce((n, p) => n + p.stops.filter(v => re.test(tipo(a, v))).length, 0);
    let n0 = 0, n1 = 0, viol = 0; const ej = [];
    [1, 2, 3].forEach(sd => { const a = app(Object.assign({}, base), { dseed: sd, rseed: sd * 3 }); const r0 = a.runSearch({ nueva: true }); n0 += cuenta(a, r0.plans || []);
      const b = app(Object.assign({}, base), { dseed: sd, rseed: sd * 3 }); const vs = b.cat().filter(v => re.test(tipo(b, v)) && b.esRecomendable(v)).slice(0, 4); for (let i = 0; i < 8; i++) b.aprende('elegido', [vs[i % vs.length]], [20]);
      const r1 = b.runSearch({ nueva: true }); const ps = r1.plans || []; n1 += cuenta(b, ps);
      ps.forEach(p => { if (!b.cabeEnTope(p.stops, b.budgetMax(), p.times).ok || p.stops.some(v => b.zoneList().indexOf(v.z) < 0 || b.esCadenaCasual(v))) viol++; });
      if (sd === 1) ps.forEach(p => ej.push(p.stops.map(v => v.n.split(' ·')[0] + (re.test(tipo(b, v)) ? '★' : '')).join(' → ') + (p.ideaNueva ? ' (idea nueva)' : ''))); });
    console.log(`  Elige seguido ${nom}: paradas afines en 3 búsquedas → perfil nuevo ${n0}, perfil con historial ${n1} · se saltó tope, zona o «No quiero»: ${viol}`); ej.forEach(e => console.log('       ' + e)); }); };
Object.keys(CASOS).filter(quiere).forEach(k => { console.log('\n■ ' + k); try { CASOS[k](); } catch (e) { console.log('   ERROR: ' + e.stack.split('\n').slice(0, 4).join(' | ')); } });
