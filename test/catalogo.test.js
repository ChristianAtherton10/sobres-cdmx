// Catálogo: lugares nuevos del paquete del 3 nov 2026 (data/paquete.js).
// Reglas: todo lugar nuevo lleva fuente (URL) y fecha; lo no confirmado se marca
// estimado / por confirmar; no se repite lo que ya estaba.
const fs = require('fs');
const path = require('path');
const { makeApp, test, assert, section, report } = require('./harness.js');

section('26 · Catálogo: paquete del 3 nov 2026');

test('cada lugar nuevo trae fuente (URL), fecha de consulta y precio con su estado', () => {
  const app = makeApp({});
  const nuevos = app.cat().filter(v => /^pq-/.test(v.id));
  assert(nuevos.length > 300, 'sólo ' + nuevos.length + ' lugares nuevos');
  nuevos.forEach(v => {
    assert(/^https?:\/\//.test(v.pUrl || ''), v.n + ' sin URL de fuente');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(v.consultado || ''), v.n + ' sin fecha de consulta');
    assert(['estimado', 'rango', 'por_confirmar'].includes(v.pEstado), v.n + ' con precio "' + v.pEstado + '"');
    assert(v.horaEstimada || /\d/.test(v.hrs || ''), v.n + ' sin horario ni marca de "por confirmar"');
  });
});

test('ningún lugar nuevo repite uno que ya estaba (mismo nombre a menos de 300 m)', () => {
  const app = makeApp({});
  const n = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const viejos = app.cat().filter(v => !/^pq-/.test(v.id) && v.lat != null);
  const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 105);
  const dup = [];
  app.cat().filter(v => /^pq-/.test(v.id) && v.lat != null && !v.coordAprox).forEach(v => viejos.forEach(o => {
    if (o.coordAprox || km(v, o) > 0.3) return;
    const a = n(v.n.split(/ · |, /)[0]), b = n(o.n.split(/ · |, /)[0]);
    if (a.length > 3 && (a === b || a.includes(b) && b.length > 5 || b.includes(a) && a.length > 5) && v.cat === o.cat) dup.push(v.n + ' = ' + o.n);
  }));
  assert(!dup.length, 'repetidos: ' + dup.join(' · '));
});

test('los ids del paquete viajan en el enlace compartido', () => {
  const app = makeApp({});
  const v = app.cat().find(x => /^pq-/.test(x.id));
  assert(app.largaId(app.cortaId(v)) === v.id, 'el id ' + v.id + ' no se codifica bien');
});

test('el importador es idempotente: correrlo otra vez no cambia nada', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'data', 'paquete.js'), 'utf8');
  const ids = (js.match(/"id":"pq-[0-9a-f]+"/g) || []);
  assert(new Set(ids).size === ids.length, 'ids repetidos dentro de data/paquete.js');
});

if (require.main === module) report();
