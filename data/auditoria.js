/* SOBRES — Auditoría de datos del catálogo consumidor.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * --------------------------------------------------------------------------
 * `data/lugares.js` trae un campo `pp` (precio por persona) y un campo `src`.
 * Al auditarlo encontramos que `src` documenta de dónde salió EL LUGAR, no de
 * dónde salió EL PRECIO, y que el precio es casi siempre un valor por defecto
 * de la categoría:
 *
 *   1,044 registros  →  sólo 46 precios distintos
 *   445 registros con pp = 0          (Centro cultural, Galería, Librería,
 *                                      Biblioteca, Parque, Centro comercial:
 *                                      una sola cifra para TODA la categoría)
 *   120 de 148 museos con pp = 85     (precio plano inventado)
 *    98 de 100 teatros con pp = 350
 *    37 restaurantes con pp = 1500    (valor por defecto del tier MICHELIN)
 *   728 registros vienen del SIC de la Secretaría de Cultura, que NO publica
 *       precios: su `pp` es inferencia pura.
 *
 * Por eso aquí separamos tres cosas que antes estaban mezcladas:
 *   - PROCEDENCIA  (`origen`): de dónde sale la cifra.
 *   - CANASTA      (`canasta`): qué compra exactamente ese monto.
 *   - ESTADO       (`estado`): si está verificado, es un rango, o falta.
 *
 * NADA de lo que está aquí es inventado para rellenar: cada registro con
 * `estado: 'verificado'` o `'rango'` lleva fuente y fecha de consulta. Lo que
 * no pudimos verificar queda `'por_confirmar'` y la interfaz lo dice.
 */
window.SOBRES_AUDITORIA = (function () {
  const HOY = '2026-10-06';

  /* ---------------------------------------------------------------- *
   * 1. Vocabulario de ACTIVIDADES                                     *
   *                                                                   *
   * La categoría física de un lugar no dice qué se hace ahí. Un parque *
   * puede ser un paseo o la salida de un recorrido en bici; un museo   *
   * puede ser una visita o impartir un taller. Separamos las dos cosas.*
   *                                                                   *
   * `sesion: true` = la actividad necesita un horario propio (clase,   *
   * función, tour, partida). Una puerta abierta no confirma una clase. *
   * ---------------------------------------------------------------- */
  const ACTS = {
    visita:    { lbl: 'Visita',            sesion: false },
    lectura:   { lbl: 'Librería',          sesion: false },
    paseo:     { lbl: 'Paseo',             sesion: false },
    vista:     { lbl: 'Mirador',           sesion: false },
    desayuno:  { lbl: 'Desayuno',          sesion: false },
    comida:    { lbl: 'Comida',            sesion: false },
    cena:      { lbl: 'Cena',              sesion: false },
    cafe:      { lbl: 'Café',              sesion: false },
    copas:     { lbl: 'Copas',             sesion: false },
    baile:     { lbl: 'Baile',             sesion: false },
    compras:   { lbl: 'Compras',           sesion: false },
    juego:     { lbl: 'Juego',             sesion: false },
    atraccion: { lbl: 'Atracciones',       sesion: false },
    funcion:   { lbl: 'Función',           sesion: true  },
    taller:    { lbl: 'Taller',            sesion: true  },
    reto:      { lbl: 'Reto',              sesion: true  },
    recorrido: { lbl: 'Recorrido activo',  sesion: true  }
  };

  /* ---------------------------------------------------------------- *
   * 2. Compatibilidad VIBRA ↔ ACTIVIDAD                               *
   *                                                                   *
   * `prot` = actividades que de verdad ENCARNAN la vibra. Si el usuario*
   *          pide esa vibra, cada propuesta debería traer una.         *
   * `ok`   = complementos aceptables (comida, café, traslado…).        *
   * `no`   = incompatibles. Si NINGUNA vibra elegida las admite, se    *
   *          excluyen de forma DURA (antes sólo bajaban de puntaje y   *
   *          entraban igual como relleno: de ahí los bares en un plan  *
   *          chill + cultural).                                       *
   * ---------------------------------------------------------------- */
  const VIBEACT = {
    chill:        { prot: ['paseo','cafe','visita','lectura'],       ok: ['comida','cena','desayuno','compras','taller','vista','funcion'], no: ['baile','copas','atraccion','reto'] },
    cultural:     { prot: ['visita','funcion','lectura'],            ok: ['cafe','comida','cena','desayuno','paseo','taller','vista','recorrido'], no: ['baile'] },
    aventurero:   { prot: ['reto','recorrido','atraccion'],          ok: ['juego','paseo','comida','cafe','vista','cena','desayuno'], no: [] },
    creativo:     { prot: ['taller'],                                ok: ['visita','cafe','comida','cena','lectura','funcion'], no: ['baile'] },
    foodie:       { prot: ['comida','cena','desayuno'],              ok: ['cafe','copas','compras','visita','taller'], no: [] },
    nightlife:    { prot: ['copas','baile'],                         ok: ['cena','funcion','juego','vista'], no: [] },
    'romántico':  { prot: ['cena','visita','vista'],                 ok: ['cafe','copas','paseo','funcion','comida','taller'], no: ['atraccion'] },
    social:       { prot: ['copas','juego','comida'],                ok: ['baile','funcion','compras','reto','cena','cafe','atraccion'], no: [] },
    familiar:     { prot: ['atraccion','paseo','funcion'],           ok: ['comida','cafe','visita','juego','taller','compras','desayuno','recorrido'], no: ['copas','baile'] },
    joyita:       { prot: [], ok: null, no: [] },   // ok:null = modificador, no restringe
    'clásico':    { prot: [], ok: null, no: [] }
  };

  /* ---------------------------------------------------------------- *
   * 3. Actividades INFERIDAS por categoría                            *
   *                                                                   *
   * Para los 1,030 registros que no alcanzamos a auditar uno por uno.  *
   * Es una inferencia declarada, NO un dato verificado: el motor la    *
   * marca como tal y nunca la usa para afirmar que una experiencia con *
   * sesión (taller, reto, recorrido, función) existe de verdad.        *
   * ---------------------------------------------------------------- */
  const ACT_POR_CAT = {
    'Restaurante': ['comida','cena'], 'Taquería': ['comida','cena'], 'Fonda de autor': ['comida','cena'],
    'Izakaya': ['cena','copas'], 'Churrería': ['cafe'], 'Café': ['cafe','desayuno'],
    'Mercado': ['comida','compras'], 'Cantina': ['copas','comida'],
    'Bar': ['copas'], 'Bar de autor': ['copas'], 'Speakeasy': ['copas'], 'Mezcalería': ['copas'],
    'Rooftop': ['copas','vista'], 'Antro': ['baile','copas'], 'Salón de baile': ['baile'],
    'Museo': ['visita'], 'Galería': ['visita'], 'Centro cultural': ['visita'],
    'Sitio histórico': ['visita'], 'Biblioteca': ['lectura'], 'Librería': ['lectura'],
    'Teatro': ['funcion'], 'Foro': ['funcion'], 'Espectáculo': ['funcion'], 'Cine': ['funcion'],
    'Parque': ['paseo'], 'Al aire libre': ['paseo'],
    'Boliche': ['juego'], 'Billar': ['juego'], 'Atracción': ['visita'],
    'Centro comercial': ['compras'],
    'Taller': ['taller'], 'Tour': ['recorrido'],
    'Escape room': ['reto'], 'Parque de diversiones': ['atraccion']
  };

  /* ---------------------------------------------------------------- *
   * 4. Procedencia de los precios NO auditados                        *
   *                                                                   *
   * Esto es el resultado de rastrear `pp` en el repositorio. Cada      *
   * regla explica de dónde sale la cifra y por qué NO es evidencia.    *
   * ---------------------------------------------------------------- */
  const PROCEDENCIA = [
    { cats: ['Centro cultural','Galería','Librería','Biblioteca','Parque','Centro comercial','Al aire libre'],
      pp: 0, origen: 'defecto_categoria',
      nota: 'Toda la categoría comparte una única cifra ($0). Muchos de estos lugares sí son de entrada libre, pero el dato no se verificó lugar por lugar y no distingue acceso gratis de consumo dentro (café, librería, estacionamiento).' },
    { cats: ['Museo'], pp: 85, origen: 'defecto_categoria',
      nota: '120 de 148 museos comparten $85. La auditoría muestra que el rango real va de $0 (Museo Soumaya) a $320 (Frida Kahlo): el defecto subestima entre 2 y 4 veces los museos principales.' },
    { cats: ['Teatro'], pp: 350, origen: 'defecto_categoria',
      nota: '98 de 100 teatros comparten $350, sin distinguir función, zona ni localidad.' },
    { cats: ['Foro'], pp: 300, origen: 'defecto_categoria', nota: '42 de 75 foros comparten $300.' },
    { cats: ['Restaurante'], pp: 1500, origen: 'defecto_tier',
      nota: 'Valor por defecto asignado al tier MICHELIN/alta cocina (37 registros con exactamente $1,500). No sale de una carta.' },
    { cats: null, origen: 'curaduria',
      nota: 'Los 230 registros con src "Curaduría Sobres" llevan un precio estimado a mano, sin carta ni boleto de respaldo. Su propio texto dice "verifica horarios y precios antes de ir".' },
    { cats: null, origen: 'sic',
      nota: 'El Sistema de Información Cultural (SIC) de la Secretaría de Cultura aporta 728 registros y NO publica precios. Cualquier `pp` en esos registros es inferencia nuestra, no dato de la fuente.' }
  ];

  /* ---------------------------------------------------------------- *
   * 5. Registros AUDITADOS contra fuente primaria/oficial             *
   *                                                                   *
   * `precio`: { min, rep, max, unidad, moneda, canasta }               *
   *    min = mínimo disponible real · rep = consumo representativo     *
   *    max = extremo alto del rango  · canasta = QUÉ compra ese monto  *
   * `estado`: verificado (cifra oficial) | rango (evidencia indirecta  *
   *    consistente) | por_confirmar (sin evidencia suficiente)         *
   * ---------------------------------------------------------------- */
  const LUGARES = {
    /* ---- Museos: el defecto de $85 contra las taquillas reales ---- */
    'cdmx-0200': {
      precio: { min: 60, rep: 160, max: 320, unidad: 'persona', moneda: 'MXN',
        canasta: 'Entrada general $320; residente mexicano $160; estudiante/maestro con credencial $60. No incluye Casa Kahlo ni guía.' },
      estado: 'verificado', ppAnterior: 85,
      fuente: 'Museo Frida Kahlo — taquilla oficial', url: 'https://boletos.museofridakahlo.org.mx/en/tickets/museo-frida-kahlo-cdmx', fecha: HOY,
      sucursal: 'Casa Azul, Londres 247, Del Carmen, Coyoacán',
      nota: 'Requiere boleto con horario; conviene comprar en línea.'
    },
    'cdmx-0161': {
      precio: { min: 0, rep: 105, max: 210, unidad: 'persona', moneda: 'MXN',
        canasta: 'Entrada general $210; mexicano y residente $105; domingo gratis para residentes; gratis con INAPAM, menores de 13, estudiantes y maestros con credencial.' },
      estado: 'verificado', ppAnterior: 85,
      fuente: 'Tarifas INAH 2026 (prensa nacional sobre el acuerdo de cuotas)', url: 'https://expansion.mx/tendencias/2025/12/31/museo-de-antropologia-precio-boleto-2026', fecha: HOY,
      sucursal: 'Paseo de la Reforma y Calz. Gandhi, Chapultepec',
      nota: 'Tarifa actualizada en 2026; el catálogo traía el defecto de categoría.'
    },
    'cdmx-0151': {
      precio: { min: 0, rep: 0, max: 0, unidad: 'persona', moneda: 'MXN',
        canasta: 'Entrada libre a las salas; no incluye consumo en cafetería ni estacionamiento de Plaza Carso.' },
      estado: 'verificado', ppAnterior: 85,
      fuente: 'Museo Soumaya — sitio oficial', url: 'http://www.museosoumaya.org/', fecha: HOY,
      sucursal: 'Plaza Carso, Ampl. Granada',
      nota: 'El defecto de $85 cobraba de más un museo que es gratis.'
    },

    /* ---- El caso que reportó el usuario: Ultramarinos ---- */
    'cdmx-2135': {
      n: 'Ultramarinos Demar', addr: 'Mérida 21, Roma Norte',
      oh: [13, 20], hrs: 'Lun y Mié–Dom 13:00–20:00 · cierra martes',
      cerrado: [2],   // 2 = martes
      lat: 19.42341, lng: -99.15853,
      precio: { min: 400, rep: 1000, max: 1500, unidad: 'persona', moneda: 'MXN',
        canasta: 'Ticket promedio reportado por persona con entrada del apartado de crudos, un plato fuerte y una copa de vino. El mínimo corresponde a comer sólo del apartado de crudos sin alcohol.' },
      estado: 'rango', ppAnterior: 550,
      fuente: 'MICHELIN Guide (ficha del restaurante, banda $$) + reseñas de prensa gastronómica que reportan ticket promedio de $1,000 y "más de $1,500" por persona',
      url: 'https://guide.michelin.com/us/en/ciudad-de-mexico/cuauhtemoc_1995126/restaurant/ultramarinos-demar', fecha: HOY,
      sucursal: 'Única sucursal, Roma Norte',
      nota: 'El usuario reportó que $500 era muy bajo y tenía razón. Además la dirección del catálogo (Zacatecas 8) y el horario (13–23) estaban equivocados: la ficha oficial dice Mérida 21 y cierre a las 20:00, con martes cerrado. No hay carta pública con precios por plato, así que el monto queda como RANGO, no como cifra verificada.'
    },

    /* ---- Xochimilco no es Coyoacán ---- */
    'xochimilco': {
      lat: 19.2735, lng: -99.1035,
      addr: 'Embarcadero Nuevo Nativitas, Xochimilco',
      precio: { min: 600, rep: 600, max: 600, unidad: 'trajinera_por_hora', moneda: 'MXN',
        canasta: 'Tarifa oficial de la alcaldía: $600 MXN por TRAJINERA por hora, hasta 20 personas — NO es por persona. No incluye comida, bebidas ni música de mariachi, que se pagan aparte a bordo.' },
      estado: 'rango', ppAnterior: 180,
      fuente: 'Tarifa por embarcación publicada por la alcaldía Xochimilco y difundida en guías de la ciudad',
      fecha: HOY, sucursal: 'Embarcadero Nuevo Nativitas',
      nota: 'El catálogo lo tenía como $180 POR PERSONA, mezclando unidades: la trajinera se cobra por embarcación y por hora. Como el monto por persona depende de cuántos vayan y de cuántas horas, no se convierte a "por persona" sin una regla explícita y se deja como tarifa por embarcación. Además estaba asignado a la zona Coyoacán, a unos 10 km del embarcadero.'
    },

    /* ---- Six Flags: existía, con precio por debajo del real ---- */
    'cdmx-2091': {
      cat: 'Parque de diversiones', act: ['atraccion'],
      oh: [10, 20], hrs: 'Lun–Mar 10:00–21:00 · Jue, Vie y Dom 10:00–18:00 · Sáb 10:00–20:00 (varía por temporada)',
      precio: { min: 1100, rep: 1300, max: 1600, unidad: 'persona', moneda: 'MXN',
        canasta: 'Boleto de un día desde $1,100 en tienda digital (el precio cambia según la fecha). El extremo alto corresponde al Boleto de un Día + Atracciones de Terror ($1,600). No incluye estacionamiento, comida ni Flash Pass. Menores de 90 cm entran gratis.' },
      estado: 'rango', ppAnterior: 900,
      fuente: 'Six Flags México — boletos de un día (sitio oficial)', url: 'https://www.sixflags.com/mexico/daily-tickets', fecha: HOY,
      sucursal: 'Carr. Picacho al Ajusco 1500, Tlalpan',
      nota: 'El precio de taquilla es distinto al de la tienda digital, y el de un día varía por fecha: por eso es rango y no una cifra fija. El catálogo lo tenía en $900, por debajo del mínimo real.'
    }
  };

  /* ---------------------------------------------------------------- *
   * 6. Registros DADOS DE BAJA por identidad fabricada                *
   * ---------------------------------------------------------------- */
  const BAJA = {
    'cdmx-2005': {
      era: 'Panem Bakery & Bistro — Café — Campos Elíseos 290-A, Polanco — $250 — 08:00–20:00',
      motivo: 'Identidad fabricada: mezcla dos negocios distintos. La dirección Campos Elíseos 290/A, Polanco corresponde a PANEM CLUB, un antro que abre jueves a sábado de 23:00 a 04:00. "Panem Bakery & Bistro" es una cadena de panadería-bistró de San Pedro Garza García / Monterrey, cuyo sitio oficial (panem.mx) lista cinco sucursales, TODAS en Nuevo León y NINGUNA en la Ciudad de México. El registro tomaba la dirección del antro y le pegaba el nombre, la categoría (Café), un horario diurno y un precio que no existen en esa dirección.',
      fuente: 'panem.mx (sucursales oficiales) + fichas públicas de PANEM Club en Campos Elíseos 290/A (Yelp, agregadores de vida nocturna)', fecha: HOY,
      reemplazo: 'cdmx-3001'
    },
    'cdmx-2006': {
      era: 'Panem Roma — Café — "Roma Norte" — $220',
      motivo: 'Sucursal inexistente. panem.mx no lista ninguna sucursal en CDMX. El registro no tenía calle ni número (sólo "Roma Norte") y sus coordenadas eran aproximadas de la colonia.',
      fuente: 'panem.mx', fecha: HOY
    },
    'cdmx-2088': {
      era: 'Panem Del Valle — Café — "Del Valle" — $220',
      motivo: 'Sucursal inexistente, mismo caso que cdmx-2006: sin calle ni número y sin respaldo en el sitio oficial.',
      fuente: 'panem.mx', fecha: HOY
    }
  };

  /* ---------------------------------------------------------------- *
   * 7. Registros NUEVOS verificados                                   *
   *                                                                   *
   * Oferta real que al catálogo le faltaba por completo: retos,        *
   * recorridos activos y talleres de crear. Cada uno con fuente.       *
   * `sesion: true` + `sesiones` = la experiencia necesita una hora de  *
   * inicio; no basta con que el local esté abierto.                   *
   * ---------------------------------------------------------------- */
  const NUEVOS = [
    /* ===== La identidad real que estaba detrás de "Panem" ===== */
    { id: 'cdmx-3001', n: 'PANEM Club', cat: 'Antro', zone: 'polanco', col: 'Polanco IV Secc',
      addr: 'Campos Elíseos 290/A', web: '', lat: 19.4268, lng: -99.1912,
      act: ['baile','copas'], oh: [23, 28], hrs: 'Jue–Sáb 23:00–04:00',
      dias: [4, 5, 6], tags: ['nightlife','social'], who: ['amigos','date','compa'], tm: ['noche'],
      score: 80, tier: 'B',
      precio: { min: null, rep: null, max: null, unidad: 'persona', moneda: 'MXN', canasta: null },
      estado: 'por_confirmar', falta: 'cover y consumo mínimo',
      fuente: 'Fichas públicas de PANEM Club en Campos Elíseos 290/A (Yelp y agregadores de vida nocturna); acceso selectivo con reserva',
      fecha: HOY,
      nota: 'Es el negocio que de verdad ocupa esa dirección. No publica cover ni consumo mínimo, así que el precio queda por confirmar en lugar de inventarse. Abre sólo jueves a sábado a partir de las 23:00: NO puede entrar como pausa de café de las 5:30 pm.',
      basis: 'Antro de acceso selectivo en Polanco; reserva requerida' },

    /* ===== AVENTURA: retos con sesión ===== */
    { id: 'cdmx-3010', n: 'Enigma Rooms Roma I', cat: 'Escape room', zone: 'roma', col: 'Roma Norte',
      addr: 'Colima 385, interior 6', web: 'https://enigmarooms.mx/ciudad-de-mexico.html',
      lat: 19.41905, lng: -99.16215,
      act: ['reto'], oh: [10.25, 22.25], hrs: 'Lun–Dom 10:15–22:15',
      sesion: true, duracionMin: 60, grupoMin: 2, grupoMax: 6,
      tags: ['aventurero','social'], who: ['amigos','compa','date'], tm: ['manana','tarde','noche','finde'],
      score: 86, tier: 'A',
      precio: { min: 250, rep: 320, max: 450, unidad: 'persona', moneda: 'MXN',
        canasta: '60 minutos de juego por persona. El precio baja por persona conforme crece el equipo y cambia según sede, fecha y horario; el mínimo publicado es "desde $250 por persona".' },
      estado: 'rango',
      fuente: 'Enigma Rooms — página oficial de Ciudad de México ("Los precios están en MXN e incluyen 60 minutos de juego"; "desde $250 por persona")',
      url: 'https://enigmarooms.mx/ciudad-de-mexico.html', fecha: HOY,
      nota: 'Reserva en línea obligatoria con horario de sesión. Es una actividad protagonista de aventura real, no un lugar que simplemente está abierto.',
      basis: 'Escape room con reserva por sesión de 60 minutos' },

    { id: 'cdmx-3011', n: 'Enigma Rooms Roma II', cat: 'Escape room', zone: 'roma', col: 'Roma Norte',
      addr: 'Colima 367', web: 'https://enigmarooms.mx/ciudad-de-mexico.html',
      lat: 19.41887, lng: -99.16296,
      act: ['reto'], oh: [10.25, 22.25], hrs: 'Lun–Dom 10:15–22:15',
      sesion: true, duracionMin: 60, grupoMin: 2, grupoMax: 6,
      tags: ['aventurero','social'], who: ['amigos','compa','date'], tm: ['manana','tarde','noche','finde'],
      score: 84, tier: 'A',
      precio: { min: 250, rep: 320, max: 450, unidad: 'persona', moneda: 'MXN',
        canasta: '60 minutos de juego por persona; el precio por persona baja conforme crece el equipo.' },
      estado: 'rango',
      fuente: 'Enigma Rooms — página oficial de Ciudad de México', url: 'https://enigmarooms.mx/ciudad-de-mexico.html', fecha: HOY,
      nota: 'Sede distinta de Roma I: salas propias, misma marca. Se registra como establecimiento aparte para no mezclar reservas ni horarios.',
      basis: 'Segunda sede de Enigma Rooms en Roma Norte' },

    { id: 'cdmx-3012', n: 'Enigma Rooms Coyoacán', cat: 'Escape room', zone: 'coyoacan', col: 'Axotla',
      addr: 'Industria 64', web: 'https://enigmarooms.mx/ciudad-de-mexico.html',
      lat: 19.35322, lng: -99.18093,
      act: ['reto'], oh: [10.75, 21.5], hrs: 'Lun–Dom 10:45–21:30',
      sesion: true, duracionMin: 60, grupoMin: 2, grupoMax: 6,
      tags: ['aventurero','social'], who: ['amigos','compa','familia'], tm: ['manana','tarde','noche','finde'],
      score: 82, tier: 'B',
      precio: { min: 250, rep: 320, max: 450, unidad: 'persona', moneda: 'MXN',
        canasta: '60 minutos de juego por persona.' },
      estado: 'rango',
      fuente: 'Enigma Rooms — página oficial de Ciudad de México', url: 'https://enigmarooms.mx/ciudad-de-mexico.html', fecha: HOY,
      basis: 'Escape room con reserva por sesión, sede Coyoacán' },

    /* ===== AVENTURA: recorrido activo con sesión ===== */
    { id: 'cdmx-3020', n: 'CDMX Electric Bike Tours', cat: 'Tour', zone: 'roma', col: 'Roma Norte',
      addr: 'Zacatecas 3 (punto de encuentro)', web: 'https://electricbiketours.com.mx/lets-ride/',
      lat: 19.41524, lng: -99.16087,
      act: ['recorrido'], oh: [9.25, 14], hrs: 'Salida diaria 9:30 am (registro 9:15)',
      sesion: true, sesiones: [9.5], duracionMin: 240,
      tags: ['aventurero','social','cultural'], who: ['amigos','date','compa','familia'], tm: ['manana','finde'],
      score: 83, tier: 'B',
      precio: { min: 70, rep: 70, max: 70, unidad: 'persona', moneda: 'USD',
        mxnAprox: 1300, reglaConversion: '70 USD × ~18.5 MXN/USD (tipo de cambio del 6-oct-2026). La conversión es aproximada y el cobro es en dólares.',
        canasta: 'Recorrido guiado en bicicleta eléctrica en grupo pequeño por Roma Norte, Condesa, Juárez y Reforma, con bicicleta incluida. No incluye comida.' },
      estado: 'verificado',
      fuente: 'CDMX Electric Bike Tours — sitio oficial', url: 'https://electricbiketours.com.mx/lets-ride/', fecha: HOY,
      nota: 'Una sola salida al día a las 9:30 am y cupo limitado: sólo cabe en un plan que empiece por la mañana. El precio se publica en dólares; lo guardamos en USD y la conversión a pesos queda marcada como aproximada.',
      basis: 'Recorrido guiado en bici eléctrica, salida única diaria' },

    /* ===== CREATIVO: talleres de hacer, con sesión ===== */
    { id: 'cdmx-3030', n: 'Contorno — taller de cerámica', cat: 'Taller', zone: 'roma', col: 'Roma Norte',
      addr: 'Av. Chapultepec 180', web: '',
      lat: 19.42281, lng: -99.16214,
      act: ['taller'], oh: [11, 20], hrs: 'Clases por horario; consulta el calendario',
      sesion: true, duracionMin: 180,
      tags: ['creativo','chill','social'], who: ['amigos','date','compa','solo'], tm: ['tarde','finde'],
      score: 80, tier: 'B',
      precio: { min: 600, rep: 600, max: 600, unidad: 'clase_por_persona', moneda: 'MXN',
        otraUnidad: { monto: 2900, unidad: 'taller completo de varias sesiones' },
        canasta: '$600 MXN por clase individual (alfarería o torno), materiales incluidos. El taller completo de varias sesiones cuesta $2,900, pero ésa es otra unidad y NO se suma como el gasto de una tarde.' },
      estado: 'rango',
      fuente: 'Reportajes de Time Out México y Food & Travel sobre talleres de cerámica en CDMX, que citan precio por clase y por taller',
      url: 'https://www.timeoutmexico.mx/ciudad-de-mexico/shopping/talleres-de-ceramica-en-la-cdmx', fecha: HOY,
      nota: 'Es el único taller de cerámica con evidencia de venta por CLASE SUELTA, así que es el que puede entrar en un plan de un día. Requiere reservar: el horario de arriba es el rango en que hay clases, no una puerta abierta.',
      basis: 'Clase suelta de cerámica, torno y construcción manual' },

    { id: 'cdmx-3031', n: 'Cerámica Libertad', cat: 'Taller', zone: 'condesa', col: 'Condesa',
      addr: 'Insurgentes 403', web: 'https://ceramicalibertad.com',
      lat: 19.40889, lng: -99.17083,
      act: ['taller'], oh: [10, 20], hrs: 'Cursos por temporada; inicio en fecha fija',
      sesion: true, duracionMin: 180, cursoCerrado: true,
      tags: ['creativo','chill'], who: ['solo','amigos','date'], tm: ['tarde','finde'],
      score: 78, tier: 'B',
      precio: { min: 3500, rep: 3800, max: 3950, unidad: 'curso', moneda: 'MXN',
        canasta: 'CURSO completo de aproximadamente 6 clases (mes y medio): torno $3,500; cursos de principiantes y expertos $3,800–$3,950. NO se vende por clase suelta, así que NO es comparable con un precio por persona de una tarde.' },
      estado: 'rango',
      fuente: 'Cerámica Libertad — tienda en línea (producto "Taller de Torno Cerámico") + reportaje de Time Out México',
      url: 'https://ceramicalibertad.com/products/torno888', fecha: HOY,
      nota: 'Se registra para que el catálogo tenga oferta creativa real, pero marcado como CURSO: el motor no debe meterlo en un plan de un día ni sumar $3,800 como si fuera el gasto de una tarde.',
      basis: 'Curso de cerámica de varias sesiones' },

    { id: 'cdmx-3032', n: 'Taller Experimental de Cerámica', cat: 'Taller', zone: 'coyoacan', col: 'Del Carmen',
      addr: 'Centenario 63', web: '',
      lat: 19.34806, lng: -99.16314,
      act: ['taller'], oh: [10, 18], hrs: 'Clases por horario; consulta el calendario',
      sesion: true, duracionMin: 180,
      tags: ['creativo','cultural','chill'], who: ['solo','amigos','date','familia'], tm: ['manana','tarde','finde'],
      score: 76, tier: 'B',
      precio: { min: null, rep: null, max: null, unidad: 'persona', moneda: 'MXN', canasta: null },
      estado: 'por_confirmar', falta: 'precio por clase y calendario de sesiones',
      fuente: 'Reportajes de Time Out México y Chilango sobre talleres de cerámica en Coyoacán (existencia y domicilio verificados; tarifa no publicada)',
      url: 'https://www.timeoutmexico.mx/ciudad-de-mexico/shopping/talleres-de-ceramica-en-la-cdmx', fecha: HOY,
      nota: 'El lugar existe y está en el corazón de Coyoacán, pero no encontramos tarifa publicada. Se queda como "Precio por confirmar" en vez de ponerle una cifra genérica.',
      basis: 'Taller de cerámica en Coyoacán' },

    { id: 'cdmx-3033', n: 'Drink & Paint — Edén Shopping Bistro', cat: 'Taller', zone: 'roma', col: 'Roma Norte',
      addr: 'Valladolid 56', web: '',
      lat: 19.41996, lng: -99.16762,
      act: ['taller'], oh: [17, 22], hrs: 'Sesiones por fecha; consulta el calendario',
      sesion: true, duracionMin: 180,
      tags: ['creativo','social','romántico'], who: ['amigos','date','compa'], tm: ['tarde','noche','finde'],
      score: 79, tier: 'B',
      precio: { min: 1000, rep: 1100, max: 1200, unidad: 'persona', moneda: 'MXN',
        canasta: 'Sesión de pintura guiada por artista, con tres copas de vino, tres tapas, materiales y bastidor de 40×40 cm incluidos. Incluye alcohol: no sirve para un plan "sin alcohol".' },
      estado: 'rango',
      fuente: 'CDMX Secreta — reportaje de la experiencia Drink & Paint con precio y contenido de la sesión',
      url: 'https://cdmxsecreta.com/drink-paint-clase-de-pintura/', fecha: HOY,
      nota: 'Sesión suelta con fecha: sirve para un plan de una tarde. La canasta incluye vino y comida, por eso el monto es alto comparado con una clase de cerámica a secas.',
      basis: 'Clase de pintura con vino y tapas, por sesión' },

    { id: 'cdmx-3034', n: 'Pintando con Vino', cat: 'Taller', zone: 'condesa', col: 'Condesa',
      addr: 'Sede por sesión (consulta el calendario)', web: '',
      lat: 19.41147, lng: -99.17436,
      act: ['taller'], oh: [16, 22], hrs: 'Sesiones por fecha; sede variable',
      sesion: true, duracionMin: 180, sedeVariable: true,
      tags: ['creativo','social'], who: ['amigos','date','compa'], tm: ['tarde','noche','finde'],
      score: 74, tier: 'B',
      precio: { min: 850, rep: 850, max: 850, unidad: 'persona', moneda: 'MXN',
        canasta: '$850 MXN por persona con todos los materiales, las bebidas y una comida incluidos.' },
      estado: 'rango',
      fuente: 'Reportaje de Food and Pleasure sobre experiencias de pintar y beber en CDMX',
      url: 'https://foodandpleasure.com/lugares-para-pintar-en-la-cdmx/', fecha: HOY,
      nota: 'La sede cambia por sesión, así que las coordenadas son de referencia y la ruta debe confirmarse al reservar.',
      basis: 'Clase de pintura con bebidas y comida incluidas' }
  ];

  /* ---------------------------------------------------------------- *
   * 8. Etiquetas de vibra corregidas                                  *
   *                                                                   *
   * El catálogo marcaba "aventurero" en 57 lugares, de los cuales 53   *
   * eran monumentos, plazas y parques (el Ángel de la Independencia y  *
   * el Zócalo entre ellos) y "creativo" en 123, de los cuales 97 eran  *
   * galerías para VER arte, no para HACER nada. Esa asociación vaga es *
   * la razón de que "aventurero" devolviera parque + plaza + cine.     *
   *                                                                   *
   * Aquí NO reetiquetamos a mano 180 registros: declaramos la regla y  *
   * el motor la aplica sobre la actividad real del lugar.              *
   * ---------------------------------------------------------------- */
  const VIBRA_EXIGE_ACTIVIDAD = {
    // Para estas vibras, el tag del catálogo NO basta: hace falta que el
    // lugar ofrezca una actividad protagonista de la vibra.
    aventurero: ['reto','recorrido','atraccion'],
    creativo:   ['taller']
  };

  return { version: 2, fecha: HOY, ACTS, VIBEACT, ACT_POR_CAT, PROCEDENCIA,
           LUGARES, BAJA, NUEVOS, VIBRA_EXIGE_ACTIVIDAD };
})();
