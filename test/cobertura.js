// Traza de COBERTURA y DESCUBRIMIENTO.
// Responde con números, no con opiniones: cuántos lugares son elegibles en cada
// etapa, cuántos LUGARES DISTINTOS llega a mostrar el motor en una primera
// búsqueda más diez regeneraciones, y cuántos quedan válidos pero nunca vistos.
const { makeApp } = require('./harness.js');

const ZONAS = ['roma', 'polanco', 'coyoacan', 'santafe'];
const VIBRAS = ['chill','cultural','aventurero','creativo','foodie','nightlife','romántico','social','familiar','joyita'];

function traza(opts) {
  const st = Object.assign({ who:'amigos', groupSize:4, when:'manana', budget:'b1k',
    budgetCustom:null, vibes:[], zone:'all', zonesSel:[], planFrom:11, planTo:23 }, opts.state || {});
  const app = makeApp(st, { dseed: opts.dseed || 7 });
  const VM = app.vibeModel();
  const todo = app.cat();
  const excl = app.exclSet();

  // ETAPAS del embudo
  const e0 = todo.length;
  const eZona = todo.filter(v => app.inZone(v));
  const eVibra = eZona.filter(v => app.vibeAdmite(v, VM));
  const eHora = eVibra.filter(v => app.timingOk(v));
  const eBud = eHora.filter(v => app.budgetOk(v));
  const rango = app.range();
  const horas = []; { const n = Math.max(2, Math.min(5, Math.round((rango[1]-rango[0])/2.2)));
    const step = (rango[1]-rango[0])/n; for (let i=0;i<n;i++) horas.push(rango[0]+step*i); }
  const eAbre = eBud.filter(v => horas.some(h => app.atHour(v, h)));

  app.runSearch();
  const vistos = new Set(); const combos = new Set(); const finales = new Set();
  const porAct = {}; let tandas = 0; let protOk = 0, protTotal = 0;
  const reg = [];
  for (let i = 0; i <= 10; i++) {
    const plans = (app.state.results.plans || []);
    tandas++;
    const nuevosEstaTanda = [];
    plans.forEach(p => {
      combos.add(app.comboSig(p.stops));
      if (p.stops.length) finales.add(p.stops[p.stops.length-1].id);
      p.stops.forEach((v, j) => {
        if (!vistos.has(v.id)) nuevosEstaTanda.push(v.id);
        vistos.add(v.id);
        const a = (p.acts || [])[j] || app.actsDe(v)[0];
        (porAct[a] = porAct[a] || new Set()).add(v.id);
      });
      protTotal++;
      if (!VM.prot.length || p.stops.some(v => app.esProtagonista(v, VM))) protOk++;
    });
    reg.push({ i, planes: plans.length, nuevos: nuevosEstaTanda.length });
    if (i < 10) app.regenerate();
  }
  // Elegibles que el motor NUNCA mostró
  const nuncaVistos = eAbre.filter(v => !vistos.has(v.id));
  const protElegibles = eAbre.filter(v => app.esProtagonista(v, VM));
  return { e0, eZona: eZona.length, eVibra: eVibra.length, eHora: eHora.length,
    eBud: eBud.length, eAbre: eAbre.length, rango,
    vistos: vistos.size, combos: combos.size, finales: finales.size,
    nuncaVistos: nuncaVistos.length, porAct, reg, tandas,
    protOk, protTotal, protElegibles: protElegibles.length,
    protNombres: protElegibles.slice(0, 6).map(v => v.n),
    vibraNo: [...VM.no], prot: VM.prot, exige: Object.keys(VM.exige || {}),
    limita: app.state.results.limita, nota: app.state.results.expandNote || '' };
}

function fila(etq, r) {
  const act = Object.keys(r.porAct).map(k => k + ':' + r.porAct[k].size).join(' ');
  console.log(etq.padEnd(26)
    + ' eleg=' + String(r.eAbre).padStart(4)
    + ' lugares=' + String(r.vistos).padStart(3)
    + ' finales=' + String(r.finales).padStart(3)
    + ' combos=' + String(r.combos).padStart(3)
    + ' nunca=' + String(r.nuncaVistos).padStart(4)
    + ' prot=' + r.protOk + '/' + r.protTotal + '(hay ' + r.protElegibles + ')'
    + '  ' + act);
}

console.log('\n════ EMBUDO POR ZONA (sin vibra, 11:00–23:00, tope $1,000+) ════');
console.log('catálogo → zona → vibra → horario → presupuesto → abre a la hora de la parada');
ZONAS.forEach(z => {
  const r = traza({ state: { zone: z, zonesSel: [z] } });
  console.log(z.padEnd(10) + ' ' + r.e0 + ' → ' + r.eZona + ' → ' + r.eVibra + ' → ' + r.eHora + ' → ' + r.eBud + ' → ' + r.eAbre);
});

console.log('\n════ DESCUBRIMIENTO: 1 búsqueda + 10 regeneraciones, por zona ════');
ZONAS.forEach(z => fila(z, traza({ state: { zone: z, zonesSel: [z] } })));

console.log('\n════ DESCUBRIMIENTO POR VIBRA (toda la ciudad) ════');
VIBRAS.forEach(vb => fila(vb, traza({ state: { vibes: [vb] } })));

console.log('\n════ COMBINACIONES DE VIBRAS ════');
[['chill','cultural'],['foodie','nightlife'],['aventurero','social'],['creativo','chill'],['familiar','cultural']]
  .forEach(c => fila(c.join('+'), traza({ state: { vibes: c } })));

console.log('\n════ VIBRA × ZONA (los cuatro barrios que pediste) ════');
['aventurero','creativo','chill','nightlife'].forEach(vb => {
  ZONAS.forEach(z => fila(vb + ' / ' + z, traza({ state: { vibes: [vb], zone: z, zonesSel: [z] } })));
});
