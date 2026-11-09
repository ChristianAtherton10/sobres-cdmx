const { makeApp } = require('/Users/christianatherton/sobres-cdmx/test/harness.js');
const app = makeApp({});
const G = {}; app.ZGRUPOS().forEach(([lab, zs]) => zs.forEach(z => G[z] = lab));
const all = app.cat().map(v => Object.assign({}, v, { _grupo: G[v.z] || '', _zlabel: app.zLabel(v.z), _rec: app.esRecomendable(v) }));
require('fs').writeFileSync(process.argv[2], JSON.stringify({ venues: all, grupos: app.ZGRUPOS(), zonas: app.ZONES.map(z => [z[0], z[1]]) }));
console.log(all.length);
