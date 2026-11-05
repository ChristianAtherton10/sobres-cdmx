# sobres_cdmx_osm.csv · lugares de CDMX desde OpenStreetMap

Descargado el 3 de noviembre de 2026 de OpenStreetMap (API Overpass), en el recuadro 19.18–19.56 N y 99.05–99.36 O: CDMX, Naucalpan y Huixquilucan.

- **8,486 lugares con nombre.** 4,952 caen dentro de las 15 zonas de SOBRES.
- **8,224 no parecen estar ya en el catálogo.** Se compararon contra `data/excel.js` y `data/lugares.js` por nombre normalizado y una distancia menor a 400 m. Son 262 coincidencias (columna `ya_en_sobres`).
- Incluye restaurantes, cafés, taquerías, helados, bares, antros, karaokes, cines, teatros, centros culturales, museos, galerías, atracciones, parques, boliches, escape rooms, juegos, zoológicos y centros comerciales.

## Licencia (obligatorio)

Los datos son © colaboradores de OpenStreetMap, con licencia ODbL. Si se usan en sobres.mx:

- Hay que poner "© OpenStreetMap contributors" con link a https://www.openstreetmap.org/copyright. Explorar ya lo muestra en el mapa; agrégalo también en "Datos y fuentes".
- Si se publica una base derivada, debe compartirse con la misma licencia.

## Columnas

| Columna | Qué es |
| --- | --- |
| osm | ID de OpenStreetMap (`node/123`, `way/456`) para volver a consultarlo |
| nombre | Nombre como aparece en OSM |
| grupo | Comer, Beber, Cultura, Experiencias, Aire libre |
| cat | Restaurante, Café, Taquería, Comida rápida, Helados y postres, Bar, Antro, Karaoke, Cine, Teatro, Centro cultural, Museo, Galería, Atracción, Parque, Boliche, Escape room, Juegos, Parque temático / zoológico, Centro comercial |
| cocina | Etiqueta `cuisine` de OSM (por ejemplo `mexican;tacos`) |
| lat, lng | Coordenadas (para edificios y parques, el centro) |
| zona | Zona de SOBRES si está dentro de su radio; vacía si está fuera |
| zona_cercana, km_zona | Zona más cercana y la distancia a su centro |
| colonia, calle | Dirección, si OSM la tiene |
| horario_osm | `opening_hours` de OSM (1,273 lugares lo tienen) |
| web, instagram | Sitio y cuenta, si OSM los tiene (753 con web) |
| dieta_osm | vegetariano, vegano o sin gluten, si OSM lo marca (99 lugares) |
| alcohol | "sí" si es bar o antro o vende alcohol según OSM |
| acceso_silla | Etiqueta `wheelchair` de OSM |
| cadena | Marca (`brand`), útil para quitar cadenas como comida rápida |
| ya_en_sobres | "sí" si ya hay un lugar con el mismo nombre a menos de 400 m |

## Ojo: lo que estos datos NO traen

- **Precios:** no hay. Todo precio que se le ponga es "estimado", por tipo de lugar y zona, como ya hace el catálogo.
- **Que siga abierto:** OSM lo editan voluntarios y hay lugares cerrados. Antes de usar un lugar en un plan, hay que confirmarlo con su web, su Instagram o una fuente actual.
- **Bares y antros:** están poco registrados en OSM (Polanco solo tiene 8 bares). Hay que complementarlos con otra fuente.
- **"Atracción":** incluye monumentos y estatuas que no son un plan. Hay que filtrar.
- **"Comida rápida":** incluye cadenas. Usa `cadena` para quitarlas salvo que se pidan.

## Segunda fuente recomendada: DENUE (INEGI)

El Directorio Estadístico Nacional de Unidades Económicas es oficial y gratis, tiene coordenadas y tiene todos los negocios registrados, bares y antros incluidos. Se baja como CSV por entidad (Ciudad de México y Estado de México) desde el sitio de INEGI, en DENUE, sección "Descarga masiva". Sirven los sectores SCIAN 722 (alimentos y bebidas), 711 y 712 (espectáculos, museos y sitios históricos) y 713 (entretenimiento y recreación). Sirve para confirmar que un lugar existe y para llenar huecos de bares.

## Prompt para Claude Code

Pega esto en Claude Code, en la carpeta sobres-cdmx, en la rama `feat/catalogo`:

> Lee `data/nuevos/LEEME_sobres_cdmx_osm.md` y `data/nuevos/sobres_cdmx_osm.csv`. Quiero sumar lugares al catálogo de SOBRES sin inventar nada.
>
> 1. Filtra: quita lo que tenga `ya_en_sobres = sí` y lo que esté fuera de zona (`zona` vacía). Quita cadenas de comida rápida, monumentos y estatuas de "Atracción", y nombres genéricos ("Parque", "Restaurante"). Revisa duplicados con más cuidado que el cruce automático: mismo lugar con nombre escrito distinto o sucursales.
> 2. Convierte cada lugar al formato de `data/excel.js`: id nuevo `osm-…`, `cat`, `zone`, `col`, `addr`, `lat`, `lng`, `act`, `who`, `tm`, `tags`, `cocina` y horario (`oh` y `hrs`; si no hay, "Horario por confirmar" y `horaEstimada: true`). Pon `precio` como estimado por tipo de lugar y zona, con la explicación en `canasta`, y `fuente: "OpenStreetMap (ODbL)"` con la URL `https://www.openstreetmap.org/<osm>`.
> 3. Agrega las marcas nuevas: `aptoFamilia` (no para bares, antros, cantinas y karaokes; sí para parques, museos, heladerías, centros comerciales, cines y boliches; desconocido para el resto), `publico` (`20s`, `30s+`, `familia`, `todos`) y `dieta` (desde `dieta_osm` y `cocina`).
> 4. Prioriza las zonas con menos variedad: Santa Fe, Satélite, Lomas, Xochimilco, Roma Sur y Del Valle. Meta por zona: 40 de comer (8 con opción vegetariana), 15 bares, 10 de cultura, 8 experiencias y 10 aptos para familia.
> 5. No mezcles nada al catálogo todavía. Genera `CANDIDATOS-NUEVOS.md` con una tabla por zona (cuántos entran por categoría) y una lista de los 30 lugares más dudosos para que yo los revise. Cuando escriba "aprobado", guárdalos en un archivo nuevo `data/osm.js`, cárgalo en `index.html` después de `excel.js`, agrega el crédito "© OpenStreetMap contributors" en "Datos y fuentes" y corre `node test/motor.test.js` y `test/cobertura.js`.
> 6. Agrega `data/nuevos/` a `.vercelignore` para que el CSV de trabajo no se publique en sobres.mx.
> 7. No hagas push a `main` sin mi "aprobado".
