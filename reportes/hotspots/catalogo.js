// Todo el catálogo [id, nombre, lat, lng, categoría] para cruzar los hotspots.
const { makeApp } = require('../../test/harness.js');
const app = makeApp({ who: 'amigos', zone: 'roma', zonesSel: ['roma'], vibes: ['foodie'] });
const L = app.cat().filter(v => !v.evento).map(v => [v.id, v.n, v.lat, v.lng, v.cat]);
require('fs').writeFileSync(__dirname + '/catalogo.json', JSON.stringify(L));
console.log(L.length, 'lugares');
