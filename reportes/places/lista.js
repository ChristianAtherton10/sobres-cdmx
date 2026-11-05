// Todos los lugares del catálogo con coordenada propia (para asignarles place_id).
const { makeApp } = require('../../test/harness.js');
const app = makeApp({ who: 'amigos', zone: 'roma', zonesSel: ['roma'], vibes: ['foodie'] });
const L = app.cat().filter(v => v.lat != null && !v.coordAprox && !v.evento && !v.sedeVariable)
  .map(v => [v.id, v.n, +v.lat.toFixed(5), +v.lng.toFixed(5), v.cat]);
require('fs').writeFileSync(__dirname + '/lista.json', JSON.stringify(L));
console.log(L.length, 'lugares');
