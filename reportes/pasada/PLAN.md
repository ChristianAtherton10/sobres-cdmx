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
- [x] F4 Editar / compartir / votar / confirmar (versión del plan votado).
- [x] F5 Hotspots con fecha y envejecimiento; aprendizaje por elección/sustitución/confirmación, por compañía.
- [x] F6 Tarjeta móvil (qué, por qué, cuánto, cómo nos movemos).
- [x] F7 Aceptación con el catálogo de la preview, rendimiento antes/después, preview, reporte.

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

## Cierre (11 nov 2026) — rama `pasada-profunda`, commit dd1992e, SIN merge
- Preview: https://sobres-cdmx-fzixzdxtu-sobres-33f0.vercel.app  (3 pasos: /?v=facil)
- Pruebas: 326 (motor.test.js, incluye test/pasada.test.js 42.x–46.x con tope estricto y catálogo de la preview) + servidor.
- Rendimiento en navegador: primera 1,121 → ~500 ms; «Ver otras opciones» ~1,070 → 160–210 ms.
- Entregables en `Claude outputs/pasada-profunda/`: Pendientes_por_verificar (1,379 fichas), Casos_de_aceptacion.txt, Conciliacion_por_ID.md.
- Decisiones para el fundador: (1) tope estricto por defecto (89% de búsquedas < 3 salidas completas hasta verificar precios);
  (2) ¿respaldar horario y rango de precio en vivo con Google Places para las paradas que se muestran? (~3× llamadas);
  (3) las pruebas de lógica anteriores corren con «precio por confirmar» aceptado.

## 13 nov 2026 — ajustes del fundador tras ver la preview
- Paso 1: «Cenar rico» → «Foodie». Tarjeta de la tanda: sólo horario · precio (fuera las 4 respuestas y el aviso rojo;
  condiciones y desglose se ven al elegir el plan).
- Decisión: respaldar HORARIO en vivo con Google, NO rango de precio (SOBRES usa un precio, aunque sea estimado).
  Fichas en pausa sólo por horario (237; 157 con place_id y pin; 68 con precio respaldado) entran «a prueba» y se
  muestran sólo si Google confirma horario. Máx. 3 rondas; `generar` espera a Google (≤1.5 s por ronda).
- Medido en local con Google real (375×812): primera 1,076 ms; «Ver otras opciones» 660–1,450 ms (antes sin respaldo 160–210).
- La llave de Google en Vercel sólo existe en Production y en Preview de `feat/places`: en la preview de
  `pasada-profunda` /api/lugar da 503 y el respaldo se apaga solo. Pruebas 47.1–47.6. Suite: 332.

## 14 nov 2026 — pendientes (rama `pendientes-catalogo`, sin merge)
- Importador del Excel de pendientes: `importa_pendientes.py <xlsx>` → `verificados_excel.json` → `build_verificados.py`.
  Precio sin liga = estimado; horario que no se entiende no se aplica; dirección sólo con número confirmado. Pruebas: test/importa.test.py.
- Motor: horario distinto por día (`ohDia`) y precio por grupo (`pGrupo`, se divide una vez), ajustados en cada búsqueda.
- Voto por enlace probado contra el servidor (local, estado aislado): funciona. Arreglo: quien vota desde un enlace ya ve el plan
  en «Mis planes» (45.8). Abierto: por enlace nunca hay «¡SE ARMÓ!» (la audiencia sólo cuenta envíos por nombre); quien comparte
  queda con voto ✓ automático en las 3 opciones; el plan compartido guarda la fecha del día aunque se armó sin fecha.
- Del Valle: Zona Arqueológica de Mixcoac (gratis, INAH), Museo Estelar (gratis con cita), horario del Museo del Metro, pin de
  Los Consentidos del Barrio. Respaldados 12 → 15; «Cultural ≤$600» pasó de 0 a 2 salidas completas.
- Pines: `confirma_pines.py` confirmó 1 de 12 (Nominatim no tiene esos números); esquinas de parques: Overpass falló dos veces.
- Sin hacer: revisión de los 48 hotspots marcados.

## 14 nov 2026 — «quiero que las 2,732 fichas entren a armar planes. TODOS» (rama `precios-estimados`)
- Diagnóstico: sólo 342 de 2,732 entraban con presupuesto (precio sin respaldo 735, pausas 637, fuente vieja/horario ~500, pin 123, acervos/librerías ~130, recintos 74).
- Decisiones del fundador: cifras estimadas por tipo SÍ cuentan (`respaldoDe` → estimado); lo que su Excel dejó «por confirmar»
  recupera el precio anterior como estimado (202 fichas, `pRecuperado`); y después: TODO el catálogo entra.
- `todoEntra()` (por defecto) / `soloVerificado` (modo estricto, lo que ejercitan las pruebas anteriores). Candidatas: 2,655 de 2,732.
  Fuera: 74 recintos sin evento y 3 marcados como cerrados. Lo dudoso se relega (`dudoso`) y se avisa en el plan (`condicionDe`).
- Cobertura (120 búsquedas, 10 zonas × 6 antojos × $600/$1,000): 3 opciones 86%; 3 salidas completas 59% (antes 11%); 3 búsquedas en 0.
- Arreglo: el relleno de reserva podía meter una segunda opción de plaza. Pruebas 49.1–49.4; suite 342.
