// Detector de errores de captura en nombres del catálogo (letras pegadas,
// letras sueltas, espacios mal puestos). Lo usan las pruebas y el barrido de la
// Fase 1. Cada regla trae su motivo; los nombres reales que parecen raros
// (Shhh, Cha Cha Chá, Gin Gin, LooLoo) no caen en ninguna.
const REGLAS = [
  // "Los Talleresl Miguel…": una letra pegada al final de la palabra que
  // en español no termina así.
  { re: /\p{Ll}[sz]l\b/u, motivo: 'letra pegada al final de una palabra' },
  // "Raúl l Bailleres": una letra suelta que no es y/e/o/u/a.
  { re: /\s[b-df-hj-np-tv-xzñ]\s/u, motivo: 'letra suelta entre palabras' },
  // "Vasconcelos , Casa…": espacio antes de la coma o el punto.
  { re: /\s[,.;:]/u, motivo: 'espacio antes de un signo' },
  // "Yoshimi- Hyatt": guion pegado de un lado y suelto del otro.
  { re: /\p{L}- \p{L}|\p{L} -\p{L}/u, motivo: 'guion mal espaciado' },
  // "Comapañía", "Compañia": la palabra existe y se escribe de una sola forma.
  { re: /Comapa|Compañia\b/u, motivo: 'palabra mal escrita' },
  // Dos espacios seguidos o espacio al inicio/final.
  { re: /\s{2,}|^\s|\s$/u, motivo: 'espacios de más' }
];

function motivo(n) { const r = REGLAS.find(x => x.re.test(n || '')); return r ? r.motivo : null; }
function sospechoso(n) { return !!motivo(n); }

module.exports = { sospechoso, motivo, REGLAS };
