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
- [ ] F1 Motor: sedes (estadio sólo con evento), misma sede = mismo lugar, actividad principal, tope estricto
      (costo respaldado; pendientes obligatorios fuera del tope), traslado en el desglose, último acceso y
      cocina, remate de tacos tras antro, «No quiero», <3 opciones con ajustes concretos, sin fecha = condicionado.
- [ ] F2 «Dame otros 3»: historial por sede, novedad de actividad principal, agotado con filtro que limita,
      lag (1.05 s fijo + Google por regeneración), clics rápidos, cambio de filtro mientras carga.
- [ ] F3 Catálogo: conciliación por ID, motivos de pausa estructurados + reactivación, cobertura por
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

## Bitácora de decisiones
(se va llenando)
