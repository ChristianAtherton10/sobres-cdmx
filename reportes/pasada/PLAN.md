# Pasada profunda de SOBRES (rama `pasada-profunda`, desde main cbb969b, 10 nov 2026)

Encargo del fundador (10 nov 2026): producto + catálogo + código. Preview usable de principio a fin.
Producción sólo con «aprobado». Se conserva el paso 2 aprobado (10 zonas, sin día, sin scroll).

## Reglas vigentes
- Ramas + preview; nada a main sin «aprobado». `node test/motor.test.js` antes y después de cada fase.
- Cada error arreglado deja prueba de regresión. No inventar lugares, precios ni horarios: fuente (URL) + fecha.
- Sin ubicación aproximada: número confirmado (Nominatim) o esquina (Overpass); si no, fuera.
- Precio: el más alto del rango; museos tarifa nacional. Google Places sólo CDMX y sólo place_id.
- No leer .env.local ni llaves. Trabajo en español.

## Orden (el que pidió): 1) inviables, repetidos, lentos → 2) edición y cierre → 3) hotspots y personalización
- [x] F0 Línea base: `reportes/pasada/casos.js` → `base_antes.txt`; conciliación de precios `concilia_precios.py`.
- [x] F1 Motor: sedes (estadio sólo con evento), misma sede = mismo lugar, actividad principal, tope estricto
      (costo respaldado; pendientes obligatorios fuera del tope), traslado en el desglose, último acceso y
      cocina, remate de tacos tras antro, «No quiero», <3 opciones con ajustes concretos, sin fecha = condicionado.
- [x] F2 «Dame otros 3»: historial por sede, novedad de actividad principal, agotado con filtro que limita,
      lag (1.05 s fijo + Google por regeneración), clics rápidos, cambio de filtro mientras carga.
- [x] F3 Catálogo (mecanismo y conciliación hechos; la verificación masiva queda en el Excel de pendientes): conciliación por ID, motivos de pausa estructurados + reactivación, cobertura por
      zona × intención × presupuesto, huecos (Creativo, Del Valle) con actividades verificadas.
- [ ] F4 Editar / compartir / votar / confirmar (versión del plan votado).
- [ ] F5 Hotspots con fecha y envejecimiento; aprendizaje por elección/sustitución/confirmación, por compañía.
- [ ] F6 Tarjeta móvil (qué, por qué, cuánto, cómo nos movemos).
- [ ] F7 Aceptación con el catálogo de la preview, rendimiento antes/después, preview, reporte.

## Hallazgos de la línea base (10 nov, catálogo con revisión del 9 nov)
- 705 «Estimado» del Excel = fichas que CONSERVAN precio (703 intactas + 2 bajas). Aparte, 696 fichas quedaron
  «Por confirmar» sin número (601 siguen en catálogo); sólo 213 venían de banda de OpenTable. Mi resumen
  «705 precios de OpenTable» fue incorrecto: mezcló el conteo de celdas cambiadas con la fuente.
- En catálogo: con precio 703 estimado + 493 inferido + 86 rango + 61 verificado; sin precio 1,483.
  Recomendables 1,104: 502 sin precio.
- Date $600 Roma/Juárez: Estadio GNP y Palacio de los Deportes como «Teatro» sin función; totales incompletos bajo tope.
- Creativo: 0 opciones en Del Valle y en toda la ciudad ($600–1,000, 11–20 h).
- Antro: tacos antes y nunca de remate; Santa Fe se va a Polanco/Narvarte.
- Familia: dos boliches en un plan; «Compras» de relleno; sin lógica de plaza.
- Regenerar (Roma noche): Salón Covadonga en 5 de 6 tandas; 10 de 36 paradas repetidas; avisa «no quedan nuevos» y sí hay.
- Motor 10–17 ms por búsqueda en Node: el lag es de la interfaz (`generar`: 1,050 ms fijos + espera de Google ≤3.5 s).

## Estado al 10 nov (corte por límite de uso) — F1 A MEDIAS, sin preview todavía
Hecho en código (index.html, data/recetas.js), SIN terminar de ajustar pruebas:
- esSede(): estadio/arena/foro sólo con evento. sedes()/sedeDe()/actKey()/mismoLugar(): misma sede = mismo lugar.
- Costo: respaldoDe() (firme/estimado/libre/debil/pendiente), coverPendiente(), TARIFAS() (Metro $5/Metrobús $6;
  taxímetro oficial $8.74 + $1.07/250 m o 45 s, +20% noche), costoTraslado() dividido una vez entre el grupo,
  costoPlan(stops, times) con traslado, cabeEnTope estricto y budgetOk estricto (state.aceptaSinPrecio lo relaja).
- Fechas en hora de CDMX con día de servicio (diaServicioISO, fechaDe). atHour respeta ultimoAcceso y cocinaCierra.
- sigueBien(): sin «Compras» de relleno ni dos lugares del mismo tipo; máximo 3 paradas (4 si ventana ≥ 7 h).
- Plaza: PLAZAS(), plazaDe(), piezas plaza_act/plaza_comida/plaza_postre, una opción de plaza en familia.
- Remate: pieza tacos_madrugada, plantillas con remate, cierraBailando().
Pendiente inmediato de F1: quitar auto-ampliación de zona (líneas ~3614, 3623, 4484, 4491, 4506) y ofrecer
`ajustes` (calculaAjustes en engine()); «No quiero» (state.noQuiero vía exclSet + chips + aiParse); sin fecha =
condicionado (eventos/talleres con «elige función»); actualizar pruebas (17d estadio, encabezado, las de
auto-ampliación y las que usaban lugares sin precio con tope).
Hallazgo clave: con tope estricto sólo ~322 lugares recomendables tienen precio respaldado; cines, boliches,
taquerías de madrugada y locales de plaza están 'debil'/'pendiente' → hay que verificar precios (F3) para que
salgan plaza, remate y date $600 completos. Creativo sigue en 0 (talleres en pausa por sesión/cupo).

## Rendimiento medido en navegador (390×844, misma máquina)
- ANTES (producción, 10 nov): primera generación 1,121 ms; «Ver otras opciones» 1,077/1,073/1,071/1,069/1,072 ms;
  pantalla completa de «Un momento…» en cada una; toques repetidos se perdían.
- DESPUÉS (rama): primera 544 ms; regeneraciones 208/194/192/186/183 ms; la tanda anterior se queda a la vista;
  4 toques seguidos = 1 tanda nueva; cambiar un filtro mientras carga muestra sólo el resultado del filtro nuevo.

## F2 hecho
- generar(fn, tipo): ficha de solicitud (la más reciente manda), sin 1,050 ms fijos, Google ≤900 ms sólo en la primera.
- seenStops por búsqueda → opts.vistosPlan/soloNuevos; novedad por actKey (sede); comboSig por actKey.
- state.agotado {nuevas, vistas, limita, ajustes}; reiniciarVistos(); limita mide cada filtro por separado.
- UI: chips activos (✕), panel de ajustes, panel de agotado, «No quiero…» en resultados. Pruebas 43.1–43.4.

## F3 hecho
- data/verificados.js (build_verificados.py): items por ID con fuente+fecha, `resuelve` por motivo, `activar`, bajas por duplicado.
- motivosPausa(): horario / ubicacion / sesion; se reactiva sólo con TODOS resueltos (prueba 44.1).
- esRecomendable: pin aproximado fuera de planes (regla de ubicación). 27 pines confirmados con Nominatim (+3 de altas).
- CONCILIACION.md (concilia.py), cobertura.js (antes/después), pendientes.py → Excel de 1,380 pendientes priorizados.
- Verificación web: rinde poco (sitios sin precios o bloqueados). Confirmado: Acuario Inbursa $260/10–18, Adamanta Del Valle
  horario, Taller Experimental horario, Manos de Tierra horario, Vive Cerámica $499. Tarifas INAH 2026: I $105, II $85, III $80.
- COBERTURA con tope estricto: 89% de las búsquedas < 3 salidas completas (53% aceptando precio por confirmar).
  El cuello es el dato: 741 sin precio, 410 con cifra sin fuente, 423 sin horario confirmado, 307 sin pin.
- Opción a decidir con el fundador: respaldar horario y rango de precio EN VIVO con Google Places (/api/lugar ya existe,
  1,955 fichas tienen place_id) sólo para las ≤9 paradas que se van a mostrar; cuesta ~3× más llamadas a Places.

## Bitácora de decisiones
- Tope estricto: entran firme + estimado + libre; 'debil' y 'pendiente' quedan fuera salvo ajuste elegido.
- Traslado en app: referencia con taxímetro oficial (defendible), con nota de que Uber/DiDi puede costar más.
