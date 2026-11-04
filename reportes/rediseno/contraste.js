// Contraste WCAG de cada tema (mínimo 4.5:1 en texto). Uso: node reportes/rediseno/contraste.js
const L = h => { const c = h.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const TEMAS = require('./temas.json');
const PARES = [['ink', 'bg', 'Títulos sobre el fondo'], ['text', 'bg', 'Texto sobre el fondo'], ['text', 'card', 'Texto en tarjetas'], ['n600', 'bg', 'Texto secundario sobre el fondo'],
  ['n600', 'card', 'Texto secundario en tarjetas'], ['n700', 'card', 'Notas en tarjetas'], ['accent', 'bg', 'Acento como texto (enlaces, etiquetas)'], ['accent', 'card', 'Acento como texto en tarjetas'],
  ['onAccent', 'accent', 'Botón principal'], ['onFill', 'fill', 'Chip elegido / barra'], ['ink', 'surface', 'Texto sobre superficie']];
let mal = 0;
for (const [k, t] of Object.entries(TEMAS)) {
  console.log('\n' + k + ' · ' + t.nombre);
  for (const [a, b, q] of PARES) { const r = cr(t[a], t[b]); const ok = r >= 4.5; if (!ok && k !== 'hoy') mal++;
    console.log('  ' + (ok ? '✓' : '✗') + ' ' + r.toFixed(2).padStart(5) + ':1  ' + q + ' (' + t[a] + ' / ' + t[b] + ')'); }
}
console.log(mal ? '\n✗ ' + mal + ' pares del formato C no pasan' : '\n✓ el formato C pasa 4.5:1 en todos los pares ("hoy" = diseño anterior, sólo de referencia)'); process.exitCode = mal ? 1 : 0;
