// Arma reportes/precios/lista.json: todos los lugares de comer y beber del catálogo.
const { makeApp } = require('../../test/harness.js');
const app = makeApp({ who: 'amigos', zone: 'roma', zonesSel: ['roma'], vibes: ['foodie'] });
const FOOD = /^(Restaurante|Taquería|Bar|Café|Heladería|Antro|Rooftop|Cantina|Bar de autor|Speakeasy|Mezcalería|Pulquería|Cervecería|Panadería|Mercado|Salón de baile|Karaoke|Billar|Boliche)$/;
const L = app.cat().filter(v => FOOD.test(v.cat) && v.lat != null && !v.evento)
  .map(v => [v.id, v.n, +v.lat.toFixed(5), +v.lng.toFixed(5), v.col || '', v.cat, v.pp, v.pEstado]);
require('fs').writeFileSync(__dirname + '/lista.json', JSON.stringify(L));
console.log(L.length, 'lugares');
