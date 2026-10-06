// Banco de pruebas del motor de Sobres, sin navegador.
// Extrae la clase del .html, le pone stubs de browser y la instancia, para poder
// correr engine()/aiParse()/getPlan() desde Node y hacer pruebas de regresión.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function makeApp(stateOverrides = {}, opts = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no se encontró el bloque data-dc-script');

  // ── stubs mínimos de navegador ──
  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  if (opts.dseed != null) store['sobres_dseed'] = String(opts.dseed);

  const win = { innerWidth: 1200, localStorage, addEventListener() {}, removeEventListener() {} };
  const doc = { hidden: false, addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [] };

  class DCLogic {
    constructor(props) { this.props = props || {}; }
    setState(upd, cb) {
      const patch = typeof upd === 'function' ? upd(this.state) : upd;
      Object.assign(this.state, patch);
      if (cb) cb();
    }
  }

  const sandbox = {
    DCLogic, window: win, localStorage, document: doc,
    location: { search: '' }, setTimeout: (fn) => { try { fn(); } catch(e) {} return 0; }, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {}, fetch: () => Promise.reject(new Error('sin red')),
    console, Math, Date, JSON, URLSearchParams
  };

  // Cargar el catálogo real (define window.SOBRES_LUGARES)
  const datos = fs.readFileSync(path.join(ROOT, 'data', 'lugares.js'), 'utf8');
  new Function('window', datos)(win);

  const Component = new Function(...Object.keys(sandbox),
    m[1] + '\n;return Component;')(...Object.values(sandbox));

  const app = new Component({});

  // Replica de la carga de EXT que en el navegador ocurre en componentDidMount.
  const D = win.SOBRES_LUGARES;
  const F = D.fields;
  app.EXT = D.rows.map(r => {
    const o = {}; F.forEach((f, i) => o[f] = r[i]);
    return { id:o.id, n:o.n, cat:o.cat, z:o.zone, col:o.col, addr:o.addr, web:o.web, pp:o.pp,
      oh:[o.oh0,o.oh1], hrs:o.hrs, tags:o.tags, who:o.who, tm:o.tm, x:o.x, y:o.y, lat:o.lat,
      lng:o.lng, score:o.score, tier:o.tier, d:o.basis, src:o.src, rt:null,
      av: o.tier === 'A' ? 'Alta demanda · reserva directa' : 'Verificar disponibilidad', ext:true };
  });
  app.ZGEO = {}; (D.zones || []).forEach(z => { app.ZGEO[z[0]] = [z[2], z[3]]; });

  Object.assign(app.state, stateOverrides);
  return app;
}

// ── mini-runner, sin dependencias ──
let pass = 0, fail = 0; const fails = [];
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; fails.push(name); console.log('  ✗ ' + name + '\n      ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'falló'); }
function section(t) { console.log('\n' + t); }
function report() {
  console.log('\n' + (fail ? '✗' : '✓') + ` ${pass} pasaron, ${fail} fallaron`);
  if (fail) { console.log('  fallaron: ' + fails.join(' · ')); process.exitCode = 1; }
}
const names = p => (p.stops || []).map(v => v.n);
const sig = p => names(p).slice().sort().join(' | ');

module.exports = { makeApp, test, assert, section, report, names, sig };
