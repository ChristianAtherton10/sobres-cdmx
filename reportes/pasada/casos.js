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
        const ps = (r && r.plans) || []; let nuevosPrin = 0;
        ps.forEach(p => { const pr = (p.stops.find(v => v.id === p.ancla) || p.stops[0]); const kp = a.sedeDe ? a.sedeDe(pr) : pr.id;
          if (prin.has(kp)) repPrin++; else { prin.add(kp); nuevosPrin++; }
          p.stops.forEach(v => { total++; const k = a.sedeDe ? a.sedeDe(v) : v.id; if (vistos.has(k)) rep++; vistos.add(k); }); });
        console.log(`    tanda ${i}: ${ps.length} opciones · ${nuevosPrin} actividades principales nuevas · ${t1.toFixed(0)} ms${r && r.exhausted ? ' · AGOTADO' : ''}${r && r.expandNote ? ' · ' + r.expandNote : ''}`);
        ps.forEach(p => console.log('       ' + p.stops.map(v => v.n).join(' → ')));
      }
      console.log(`    → ${total} paradas mostradas, ${rep} repetidas; actividades principales distintas: ${prin.size}, repetidas ${repPrin}; primera ${tiempos[0].toFixed(0)} ms, regeneraciones ${tiempos.slice(1).map(x => x.toFixed(0)).join('/')} ms`);
    }); },
};
Object.keys(CASOS).filter(quiere).forEach(k => { console.log('\n■ ' + k); try { CASOS[k](); } catch (e) { console.log('   ERROR: ' + e.stack.split('\n').slice(0, 4).join(' | ')); } });
