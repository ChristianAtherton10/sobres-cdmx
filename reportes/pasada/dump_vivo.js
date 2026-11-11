// Catálogo tal como lo usa la preview → reportes/pasada/catalogo_vivo.json (para concilia.py y pendientes.py)
const path = require('path'), fs = require('fs');
const { makeApp } = require(path.join(__dirname, '..', '..', 'test', 'harness.js'));
const a = makeApp({}, { estricto: true }); const G = {}; a.ZGRUPOS().forEach(([l, zs]) => zs.forEach(z => G[z] = l));
const out = a.cat().map(v => Object.assign({}, v, { _rec: a.esRecomendable(v), _resp: a.respaldoDe(v), _grupo: G[v.z] || '', _sede: a.esSede(v), _plaza: a.plazaDe(v), _cover: a.coverPendiente(v), _gid: a.tieneGoogle ? false : false }));
fs.writeFileSync(path.join(__dirname, 'catalogo_vivo.json'), JSON.stringify(out));
console.log(out.length);
