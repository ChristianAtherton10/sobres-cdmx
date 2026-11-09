// Revisión del catálogo del fundador en Excel (9 nov 2026): data/revision.js,
// generado por reportes/revision/build_revision.py.
const { makeApp, test, assert, section, report } = require('./harness.js');

section('41 · Revisión del catálogo del fundador (Excel 9 nov 2026)');

const R = (() => { const a = makeApp({}); return a._win.SOBRES_REVISION; })();
const porNombre = (app, n) => app.cat().find(v => v.n === n);

test('41.1 · la revisión carga y el catálogo espera por ella (catalogoListo)', () => {
  assert(R && R.fecha === '2026-11-09' && R.pausasActivas === true, 'no cargó data/revision.js');
  const a = makeApp({}); const w = a._win; const tenia = w.SOBRES_REVISION; delete w.SOBRES_REVISION;
  assert(!a.catalogoListo(), 'el catálogo se daba por listo sin la revisión'); w.SOBRES_REVISION = tenia;
});

test('41.2 · las bajas salen del catálogo (Baltra Bar duplicado, bibliotecas escolares)', () => {
  const a = makeApp({}); const ids = new Set(a.cat().map(v => v.id));
  const b = Object.keys(R.bajas); assert(b.length >= 100, 'bajas: ' + b.length);
  assert(b.every(id => !ids.has(id)), 'sigue: ' + b.filter(id => ids.has(id)).slice(0, 3));
  assert(!a.cat().some(v => v.n === 'Baltra Bar'), 'sigue Baltra Bar') ;
  assert(a.cat().some(v => v.n === 'Baltra'), 'se fue también la ficha buena de Baltra');
});

test('41.3 · una ficha en PAUSA sigue en el catálogo pero no sale en planes; el interruptor las apaga', () => {
  const id = Object.keys(R.pausas).find(k => !R.bajas[k]);
  const a = makeApp({}); const v = a.cat().find(x => x.id === id);
  assert(v && !a.esRecomendable(v) && /En pausa/.test(v.pNotaLugar), 'pausa no aplicada a ' + id);
  const n = a.cat().filter(x => x.pausa).length; assert(n >= 600, 'pausadas: ' + n);
  const sin = makeApp({}, { revision: { pausasActivas: false } });
  assert(!sin.cat().some(x => x.pausa), 'con el interruptor apagado siguen en pausa');
});

test('41.4 · las correcciones del Excel ganan: Limantour Roma (nombre, dirección, categoría, horario)', () => {
  const a = makeApp({}); const v = porNombre(a, 'Licorería Limantour · Roma');
  assert(v, 'no está con el nombre nuevo');
  assert(v.addr === 'Av. Álvaro Obregón 106' && v.cat === 'Bar de autor', JSON.stringify([v.addr, v.cat]));
  assert(/Lun–jue 18:00–00:00/.test(v.hrs), 'horario: ' + v.hrs);
  const f = porNombre(a, 'Fonda Fina'); assert(f.pp === 500 && f.propinaIncluida, 'Fonda Fina cambió: ' + f.pp);
});

test('41.5 · reactivados por el fundador (Brujas, Saint Panadería, Costra) sí salen en planes', () => {
  const a = makeApp({});
  ['Brujas', 'Saint Panadería', 'Costra Panadería'].forEach(n => { const v = porNombre(a, n); assert(v && a.esRecomendable(v), n + ' no sale'); });
});

test('41.6 · altas: llevan fuente y fecha; sólo salen en planes con horario y pin confirmado con número', () => {
  const a = makeApp({}); const ids = new Set(R.altas.map(x => x.id));
  const altas = a.cat().filter(v => ids.has(v.id)); assert(altas.length === R.altas.length && altas.length >= 15, 'altas: ' + altas.length);
  altas.forEach(v => { assert(v.src && v.pFecha, v.n + ' sin fuente o fecha');
    if (a.esRecomendable(v)) assert(!v.coordAprox && !v.horaEstimada, v.n + ' sale sin pin o sin horario'); });
});

test('41.7 · funciones nuevas: Duelo y Lost en el CENART, con fecha y fuente; las vencidas no cargan', () => {
  const a = makeApp({}); const ev = a.cat().filter(v => v.evento && /^ev-r/.test(v.id));
  assert(ev.some(v => /^Duelo/.test(v.n)) && ev.some(v => /^Lost/.test(v.n)), 'faltan funciones');
  ev.forEach(v => assert(v.fechas && v.fechas.hasta >= a.todayISO() && v.src, v.n + ' sin fecha/fuente o vencida'));
});

test('41.8 · todo lugar sigue en una de las 10 zonas y los planes salen con la revisión', () => {
  const a = makeApp({}); const zs = new Set([].concat(...a.ZGRUPOS().map(g => g[1])));
  const fuera = a.cat().filter(v => !zs.has(v.z)); assert(!fuera.length, 'fuera de zona: ' + fuera.slice(0, 3).map(v => v.n + ' ' + v.z));
  const p = makeApp({ who: 'date', groupSize: 2, zone: 'roma', zonesSel: ['roma', 'romasur', 'condesa'], vibes: ['romántico'], when: 'noche', budget: 'b1999' }, { dseed: 3 });
  p.runSearch(); assert((p.state.results.plans || []).length === 3, 'planes: ' + (p.state.results.plans || []).length);
});

if (require.main === module) report();
