/* SOBRES — Recetas por ambiente (4 nov 2026).
 *
 * Cada ambiente dice QUÉ TIPO de lugares propone y CÓMO se combinan. El motor
 * llena cada plantilla con lugares reales del catálogo (zona, horario,
 * presupuesto, traslados) y, si un plan no queda bien, ofrece lugares sueltos
 * de la misma receta. Aquí no hay lugares inventados: sólo tipos.
 *
 * PIEZAS: cómo reconocer un lugar.
 *   cats       categorías del catálogo que cuentan
 *   nombre     expresión (texto) que debe aparecer en el nombre (además de, o en vez de, cats)
 *   sinNombre  expresión que lo descarta
 *   momento    cuándo se hace: desayuno (8–12), comida (13–16:30), cena (19–22:30),
 *              noche (18+), antro (llegada 22:30–00:30), dia (9–18) o libre
 *   comida     true si es una comida completa (entre dos, mínimo 4 h)
 *   maxPP      tope de precio por persona de la pieza (p. ej. cena rápida)
 *   sinCadenas no cuenta Chili's, Shake Shack, VIPS…
 *   porConfirmar  teatro, taller o función sin horario confirmado: se puede
 *              proponer, con "consulta la cartelera" / "reserva tu horario"
 *
 * RECETAS: plantillas por franja del día (manana < 12, tarde 12–18, noche 18+).
 *   Cada plantilla es una lista de piezas en orden. "sueltos" son las piezas
 *   que se ofrecen como lugar suelto cuando no sale un buen plan.
 */
window.SOBRES_RECETAS = {
  version: 1,
  piezas: {
    // ── comer ──
    desayuno_rico:   { lbl: 'Desayuno', cats: ['Café', 'Restaurante', 'Fonda de autor'], acts: ['desayuno'], momento: 'desayuno', comida: true, sinCadenas: true },
    comida_rica:     { lbl: 'Comida', cats: ['Restaurante', 'Fonda de autor', 'Izakaya'], momento: 'comida', comida: true, sinCadenas: true },
    cena_rica:       { lbl: 'Cena', cats: ['Restaurante', 'Fonda de autor', 'Izakaya', 'Rooftop'], acts: ['cena', 'comida'], momento: 'cena', comida: true, sinCadenas: true },
    comida_familiar: { lbl: 'Comida en familia', cats: ['Restaurante', 'Fonda de autor', 'Mercado', 'Taquería'], momento: 'comida', comida: true, familia: true },
    cena_familiar:   { lbl: 'Cena en familia', cats: ['Restaurante', 'Fonda de autor', 'Taquería'], momento: 'cena', comida: true, familia: true },
    mercado_gourmet: { lbl: 'Mercado', cats: ['Mercado'], nombreTambien: 'mil[aá]n 44', sinNombre: 'artesan|bazar', momento: 'comida', comida: true },
    cena_rapida:     { lbl: 'Cenita rápida', cats: ['Taquería', 'Restaurante'], maxPP: 380, momento: 'cena', comida: true },
    tacos:           { lbl: 'Tacos', cats: ['Taquería'], momento: 'libre', comida: true },
    postre:          { lbl: 'Postre', cats: ['Heladería', 'Churrería', 'Café'], nombreSiCat: { 'Café': 'panader|pasteler|postre|crepa|churr|waffle|chocolat|dulce|gelato|helad|nieve|bake|pan ' }, momento: 'libre' },
    cafe:            { lbl: 'Café', cats: ['Café'], momento: 'libre' },
    // ── beber y bailar ──
    bar:             { lbl: 'Bar', cats: ['Bar', 'Bar de autor', 'Speakeasy', 'Mezcalería', 'Cantina', 'Rooftop'], barPorNombre: true, momento: 'noche' },
    bar_romantico:   { lbl: 'Unos tragos', cats: ['Bar de autor', 'Speakeasy', 'Rooftop'], nombreTambien: 'wine|vino|vinos|jazz', momento: 'noche' },
    rooftop:         { lbl: 'Rooftop', cats: ['Rooftop'], momento: 'noche' },
    cantina:         { lbl: 'Cantina', cats: ['Cantina'], nombreTambien: 'cantina|pulquer', momento: 'libre' },
    antro:           { lbl: 'Antro', cats: ['Antro'], momento: 'antro' },
    // Se llega como al antro (≈ 23:30, regla R08/R09): un salón de baile cierra la noche.
    salon_baile:     { lbl: 'A bailar', cats: ['Salón de baile'], nombreTambien: 'mama rumba', momento: 'antro' },
    karaoke:         { lbl: 'Karaoke', nombre: 'karaoke|cantabar|canta coraz', momento: 'noche' },
    // ── cultura ──
    museo:           { lbl: 'Museo', cats: ['Museo'], sinNombre: 'del niño|kidzania', momento: 'dia' },
    galeria:         { lbl: 'Galería', cats: ['Galería'], momento: 'dia' },
    centro_cultural: { lbl: 'Centro cultural', cats: ['Centro cultural'], momento: 'dia' },
    sitio_historico: { lbl: 'Recorrido histórico', cats: ['Sitio histórico'], nombreTambien: 'catedral|palacio nacional|palacio postal|torre latinoamericana|casa de los azulejos|z[oó]calo|templo mayor|plaza de las tres culturas|monumento a la revoluci', momento: 'dia' },
    libreria:        { lbl: 'Librería', cats: ['Librería', 'Biblioteca'], momento: 'dia' },
    teatro:          { lbl: 'Teatro', cats: ['Teatro', 'Foro'], momento: 'noche', porConfirmar: true },
    cine:            { lbl: 'Cine', cats: ['Cine'], momento: 'libre', porConfirmar: true },
    cine_arte:       { lbl: 'Cine de arte', nombre: 'cineteca|ifal|cineman[ií]a|cine tonal[aá]|casa del cine|cineclub|filmoteca|cinemat[oó]grafo del chopo', momento: 'libre', porConfirmar: true },
    // ── experiencias ──
    taller:          { lbl: 'Taller', cats: ['Taller'], momento: 'libre', porConfirmar: true },
    cata:            { lbl: 'Cata', nombre: '\\bcatas?\\b|degustaci|vin[ií]cola|pintando con vino|drink & paint', momento: 'libre', porConfirmar: true },
    paseo_romantico: { lbl: 'Paseo', nombre: 'lago de chapultepec|jard[ií]n bot[aá]nico|parque m[eé]xico|jard[ií]n centenario|viveros|kiosco morisco|trajinera|parque lincoln|caminar masaryk|bazar s[aá]bado|parque espa[nñ]a|bike tour|bici', momento: 'dia' },
    mirador:         { lbl: 'Mirador', nombre: 'torre latinoamericana|mirador|monumento a la revoluci', momento: 'libre' },
    parque:          { lbl: 'Parque', cats: ['Parque', 'Al aire libre'], momento: 'dia' },
    jardin:          { lbl: 'Jardín', nombre: 'jard[ií]n bot[aá]nico|viveros|parque m[eé]xico|parque lincoln|jard[ií]n centenario|parque espa[nñ]a', momento: 'dia' },
    parque_familiar: { lbl: 'Parque', nombre: 'aztl[aá]n|bosque de chapultepec|zool[oó]gico|bosque de tlalpan|viveros|ecol[oó]gico de xochimilco|bicentenario|tezoz[oó]moc|bosque de san juan de arag[oó]n|nativitas|la mexicana|alameda central|parque m[eé]xico|hundido', momento: 'dia' },
    museo_ninos:     { lbl: 'Museo para niños', nombre: 'papalote|historia natural|universum|juguete|mide|museo de cera|ripley|kidzania|acuario|planetario|caracol', momento: 'dia' },
    atraccion_familiar: { lbl: 'Atracción', nombre: 'zool[oó]gico|acuario|kidzania|six flags|aztl[aá]n|trajinera|karting|papalote', momento: 'dia', porConfirmar: false },
    reto:            { lbl: 'Escape room', cats: ['Escape room'], momento: 'libre', porConfirmar: true },
    boliche:         { lbl: 'Boliche', cats: ['Boliche'], momento: 'libre' },
    billar:          { lbl: 'Billar', cats: ['Billar'], momento: 'libre' },
    karting:         { lbl: 'Go karts', nombre: 'karting|go ?kart', momento: 'libre' },
    lucha_libre:     { lbl: 'Lucha libre', nombre: 'lucha libre|arena m[eé]xico|arena coliseo', momento: 'noche', porConfirmar: true },
    bici_tour:       { lbl: 'En bici', nombre: 'bike|bici|ciclot', momento: 'dia', porConfirmar: true },
    trajineras:      { lbl: 'Trajineras', nombre: 'trajinera', momento: 'dia' },
    parque_diversiones: { lbl: 'Parque de diversiones', cats: ['Parque de diversiones'], nombreTambien: 'aztl[aá]n parque', momento: 'dia' },
    bazar:           { lbl: 'Bazar', nombre: 'bazar|artesan|tianguis', momento: 'dia' },
    estadio:         { lbl: 'Partido', nombre: 'estadio', momento: 'libre', porConfirmar: true },
    // Eventos con fecha (data/eventos.js). Sólo entran los que van con el
    // ambiente pedido (sus etiquetas) y cuya fecha coincide con la del plan.
    evento:          { lbl: 'Evento', evento: true, momento: 'libre', porConfirmar: true }
  },
  recetas: {
    'romántico': {
      manana: [['paseo_romantico', 'desayuno_rico'], ['desayuno_rico', 'museo'], ['desayuno_rico', 'jardin']],
      tarde:  [['evento', 'postre'], ['taller', 'comida_rica'], ['paseo_romantico', 'postre'], ['museo', 'comida_rica'], ['comida_rica', 'paseo_romantico'], ['cata', 'comida_rica'], ['galeria', 'postre']],
      // Más plantillas de noche (4 nov 2026): para que "Ver otras opciones" traiga TIPOS de cita distintos.
      noche:  [['evento', 'cena_rica'], ['cena_rica', 'bar_romantico'], ['taller', 'cena_rica'], ['cine', 'cena_rica'], ['teatro', 'cena_rica'], ['cata', 'cena_rica'], ['mirador', 'cena_rica'], ['cena_rica', 'postre'],
               ['bar_romantico', 'cena_rica'], ['rooftop', 'cena_rica'], ['cena_rica', 'rooftop'], ['cine_arte', 'cena_rica'], ['cena_rica', 'salon_baile']],
      sueltos: ['cena_rica', 'taller', 'bar_romantico', 'cata', 'paseo_romantico']
    },
    'foodie': {
      manana: [['desayuno_rico'], ['desayuno_rico', 'mercado_gourmet']],
      tarde:  [['evento', 'comida_rica'], ['comida_rica', 'postre'], ['mercado_gourmet', 'postre'], ['comida_rica', 'cafe']],
      noche:  [['cena_rica', 'postre'], ['cena_rica'], ['tacos', 'postre'], ['mercado_gourmet', 'postre'], ['cena_rica', 'cafe'], ['cena_rapida', 'postre']],
      sueltos: ['cena_rica', 'comida_rica', 'mercado_gourmet', 'desayuno_rico']
    },
    'nightlife': {
      tarde:  [['bar', 'bar'], ['cantina', 'bar']],
      noche:  [['evento', 'bar'], ['cena_rapida', 'bar', 'antro'], ['bar', 'antro'], ['bar', 'bar'], ['cantina', 'salon_baile'], ['cena_rapida', 'bar'], ['rooftop', 'antro'], ['bar', 'karaoke'], ['karaoke'],
               ['rooftop', 'bar'], ['cantina', 'bar'], ['bar', 'salon_baile'], ['tacos', 'antro'], ['billar', 'bar'], ['bar_romantico', 'antro']],
      sueltos: ['bar', 'antro', 'rooftop', 'cantina', 'karaoke', 'salon_baile']
    },
    'cultural': {
      manana: [['museo', 'galeria'], ['sitio_historico', 'museo'], ['museo', 'libreria']],
      tarde:  [['evento', 'comida_rica'], ['museo', 'comida_rica'], ['museo', 'galeria'], ['sitio_historico', 'museo'], ['centro_cultural', 'museo'], ['galeria', 'libreria'], ['comida_rica', 'museo']],
      noche:  [['evento', 'cena_rica'], ['teatro'], ['cine_arte'], ['teatro', 'cena_rica'], ['cine', 'cena_rica'], ['cena_rica', 'teatro'], ['cine_arte', 'cena_rica'], ['cena_rica', 'cine_arte']],   // sin 'teatro + postre': "Cultural" no lleva churrerías ni cafés (prueba 16)
      sueltos: ['museo', 'teatro', 'cine_arte', 'galeria', 'centro_cultural', 'cine']
    },
    'familiar': {
      manana: [['evento', 'comida_familiar'], ['parque_familiar', 'comida_familiar'], ['museo_ninos', 'comida_familiar'], ['atraccion_familiar', 'comida_familiar']],
      tarde:  [['evento', 'comida_familiar'], ['parque_familiar', 'comida_familiar', 'postre'], ['museo_ninos', 'comida_familiar'], ['atraccion_familiar', 'comida_familiar'], ['trajineras', 'comida_familiar'], ['comida_familiar', 'cine'], ['boliche', 'comida_familiar'], ['comida_familiar', 'parque_familiar']],
      noche:  [['cena_familiar', 'postre'], ['cine', 'cena_familiar'], ['boliche', 'cena_familiar'], ['evento', 'cena_familiar'], ['boliche', 'postre'], ['cine', 'postre'],
               ['karting', 'cena_familiar'], ['tacos', 'postre'], ['cena_familiar', 'cine']],
      sueltos: ['parque_familiar', 'museo_ninos', 'atraccion_familiar', 'comida_familiar', 'cine']
    },
    'social': {
      tarde:  [['reto', 'comida_rica'], ['boliche', 'bar'], ['karting', 'tacos'], ['lucha_libre', 'tacos'], ['mercado_gourmet', 'bar'], ['cine', 'tacos'], ['reto', 'tacos']],
      noche:  [['evento', 'cena_rapida'], ['reto', 'cena_rapida', 'bar'], ['boliche', 'bar'], ['cena_rapida', 'bar'], ['lucha_libre', 'tacos'], ['cena_rapida', 'karaoke'], ['bar', 'karaoke'], ['billar', 'bar'], ['cantina', 'bar'], ['cena_rapida', 'salon_baile']],
      sueltos: ['reto', 'boliche', 'karaoke', 'billar', 'bar', 'cantina', 'lucha_libre']
    },
    'aventurero': {
      manana: [['bici_tour', 'desayuno_rico'], ['trajineras', 'comida_familiar'], ['parque_diversiones']],
      tarde:  [['reto', 'tacos'], ['karting', 'comida_rica'], ['trajineras', 'comida_rica'], ['lucha_libre', 'tacos'], ['parque_diversiones']],
      noche:  [['reto', 'cena_rapida'], ['lucha_libre', 'tacos'], ['karting', 'cena_rapida']],
      sueltos: ['reto', 'karting', 'bici_tour', 'trajineras', 'parque_diversiones', 'lucha_libre']
    },
    // Creativo = hacer algo con las manos: siempre hay un taller (o una cata).
    'creativo': {
      manana: [['taller', 'desayuno_rico'], ['bazar', 'taller']],
      tarde:  [['taller', 'comida_rica'], ['galeria', 'taller'], ['taller', 'cafe'], ['bazar', 'taller']],
      noche:  [['taller', 'cena_rica'], ['cata', 'cena_rica']],
      sueltos: ['taller', 'cata']
    },
    'chill': {
      manana: [['cafe', 'libreria'], ['jardin', 'cafe'], ['desayuno_rico', 'parque']],
      tarde:  [['evento', 'cafe'], ['parque', 'cafe'], ['galeria', 'cafe'], ['libreria', 'postre'], ['jardin', 'postre'], ['museo', 'cafe']],
      // Sin bar: "Tranqui" no mete copas de relleno (prueba de chill + cultural).
      noche:  [['cena_rica', 'postre'], ['cine', 'postre'], ['cine_arte', 'postre'], ['cena_rica', 'cafe'], ['tacos', 'postre'], ['cine', 'cena_rica']],
      sueltos: ['cafe', 'libreria', 'jardin', 'galeria', 'postre']
    },
    // Joyitas: las mismas ideas, prefiriendo lugares poco conocidos.
    'joyita': {
      tarde:  [['galeria', 'comida_rica'], ['comida_rica', 'cafe'], ['museo', 'postre']],
      noche:  [['cena_rica', 'bar_romantico'], ['bar', 'bar']],
      sueltos: ['cena_rica', 'bar_romantico', 'galeria', 'cafe']
    },
    // Sin ambiente elegido ("Lo que sea"): un poco de todo, según la hora.
    '_libre': {
      manana: [['desayuno_rico', 'museo'], ['parque', 'desayuno_rico']],
      tarde:  [['museo', 'comida_rica'], ['comida_rica', 'postre'], ['reto', 'tacos'], ['parque', 'cafe']],
      noche:  [['cena_rica', 'bar'], ['cine', 'cena_rica'], ['cena_rapida', 'bar']],
      sueltos: ['cena_rica', 'bar', 'museo', 'reto']
    }
  }
};
