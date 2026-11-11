#!/usr/bin/env node
// Cobertura por zona × intención × presupuesto con COMBINACIONES VIABLES (tope estricto, catálogo de la preview).
//   node reportes/pasada/cobertura.js [--sp]   (--sp: aceptando precio por confirmar, para comparar)
const path = require('path');
const { makeApp } = require(path.join(__dirname, '..', '..', 'test', 'harness.js'));
const sp = process.argv.includes('--sp');
const INT = [['Cenar rico', { vibes: ['foodie'], who: 'amigos', groupSize: 4, planFrom: 19, planTo: 24 }], ['Noche y fiesta', { vibes: ['nightlife'], who: 'amigos', groupSize: 4, planFrom: 20, planTo: 27 }],
  ['Tranqui', { vibes: ['chill'], who: 'amigos', groupSize: 2, planFrom: 11, planTo: 18 }], ['Cultural', { vibes: ['cultural'], who: 'amigos', groupSize: 2, planFrom: 11, planTo: 18 }],
  ['Romántico', { vibes: ['romántico'], who: 'date', groupSize: 2, planFrom: 19, planTo: 25 }], ['En familia', { vibes: ['familiar'], who: 'familia', groupSize: 4, planFrom: 12, planTo: 19 }],
  ['Creativo', { vibes: ['creativo'], who: 'amigos', groupSize: 2, planFrom: 11, planTo: 20 }], ['Con amigos', { vibes: ['social'], who: 'amigos', groupSize: 4, planFrom: 17, planTo: 24 }]];
const BUD = ['b600', 'b1000', 'b1999'];
const a0 = makeApp({}); const Z = a0.ZGRUPOS();
const fila = []; let huecos = 0, total = 0;
console.log('Salidas COMPLETAS por búsqueda (mejor de 2 semillas; 3 = llena) · ' + (sp ? 'aceptando precio por confirmar' : 'tope estricto'));
console.log('zona'.padEnd(24) + INT.map(i => i[0].slice(0, 9).padEnd(11)).join('') + '  (cada celda: $600 / $1,000 / $1,999)');
Z.forEach(([zl, zs]) => { let ln = zl.padEnd(24);
  INT.forEach(([il, st]) => { const c = BUD.map(b => { let mejor = 0;
      [1, 2].forEach(sd => { const a = makeApp(Object.assign({ facil: true, when: 'libre', budget: b, budgetCustom: null, zone: zs[0], zonesSel: zs.slice(), aceptaSinPrecio: sp }, st), { dseed: sd, rseed: sd * 3, estricto: true });
        a.ev = () => {}; const r = a.runSearch({ nueva: true }); const n = ((r && r.plans) || []).filter(p => a.planCompleto(p)).length; if (n > mejor) mejor = n; });
      total++; if (mejor < 3) huecos++; return mejor; });
    ln += c.join('/').padEnd(11); fila.push({ zona: zl, intencion: il, c }); });
  console.log(ln); });
console.log(`\nBúsquedas con menos de 3 salidas completas: ${huecos} de ${total} (${Math.round(huecos * 100 / total)}%)`);
const cero = fila.filter(f => f.c.every(x => x === 0)); console.log('Sin ninguna salida completa en los tres presupuestos: ' + cero.length + ' → ' + cero.map(f => f.intencion + ' en ' + f.zona).join('; '));
