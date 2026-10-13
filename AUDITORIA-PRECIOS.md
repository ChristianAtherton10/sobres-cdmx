# Auditoría de precios y procedencia del catálogo de SOBRES

Fecha de la última revisión: **2026-10-06**. Moneda **MXN** salvo donde se indique.

> **Esta auditoría está incompleta y así se declara.** El dataset base aporta **1044**
> registros; con la curaduría propia y estas altas, la app muestra **1,128 lugares**.
> Se corrigieron contra fuente **6** registros y se dieron de alta **61** con fuente
> propia. Los demás conservan un precio **inferido** que la interfaz muestra como *estimado*.
> No se inventó ninguna cifra y ningún total se declara seguro si se apoya en una inferencia.

## 1. De dónde sale cada precio

`data/lugares.js` trae `pp` y `src`. **`src` documenta de dónde salió el LUGAR, no el PRECIO.**

- 1044 registros originales comparten sólo **46 precios distintos**.
- **445** en $0, **120** en $85, **108** en $350, **37** en $1,500.
- **728** vienen del SIC de la Secretaría de Cultura, que **no publica precios**.

| Origen | Aplica a | Por qué no es evidencia |
|---|---|---|
| `defecto_categoria` | Centro cultural, Galería, Librería, Biblioteca, Parque, Centro comercial, Al aire libre | Toda la categoría comparte una única cifra ($0). Muchos de estos lugares sí son de entrada libre, pero el dato no se verificó lugar por lugar y no distingue acceso gratis de consumo dentro (café, librería, estacionamiento). |
| `defecto_categoria` | Museo | 120 de 148 museos comparten $85. La auditoría muestra que el rango real va de $0 (Museo Soumaya) a $320 (Frida Kahlo): el defecto subestima entre 2 y 4 veces los museos principales. |
| `defecto_categoria` | Teatro | 98 de 100 teatros comparten $350, sin distinguir función, zona ni localidad. |
| `defecto_categoria` | Foro | 42 de 75 foros comparten $300. |
| `defecto_tier` | Restaurante | Valor por defecto asignado al tier MICHELIN/alta cocina (37 registros con exactamente $1,500). No sale de una carta. |
| `curaduria` | cualquier registro con ese `src` | Los 230 registros con src "Curaduría Sobres" llevan un precio estimado a mano, sin carta ni boleto de respaldo. Su propio texto dice "verifica horarios y precios antes de ir". |
| `mediana_categoria` | cualquier registro con ese `src` | Lugares añadidos a mano cuya categoría, colonia y dirección sí se verificaron contra una ficha pública, pero que no publican carta ni tarifa. Su precio es la mediana real de su categoría en este catálogo, declarada como estimada. |
| `sic` | cualquier registro con ese `src` | El Sistema de Información Cultural (SIC) de la Secretaría de Cultura aporta 728 registros y NO publica precios. Cualquier `pp` en esos registros es inferencia nuestra, no dato de la fuente. |

## 2. Registros corregidos contra fuente

| Lugar | Antes | Corregido | Qué compra ese monto | Fuente | Estado |
|---|---|---|---|---|---|
| **Museo Frida Kahlo** | $85 | $60–$320 pp | Entrada general $320; residente mexicano $160; estudiante/maestro con credencial $60. No incluye Casa Kahlo ni guía. | Museo Frida Kahlo — taquilla oficial | `verificado` |
| **Museo Nacional de Antropología (MNA)** | $85 | $0–$210 pp | Entrada general $210; mexicano y residente $105; domingo gratis para residentes; gratis con INAPAM, menores de 13, estudiantes y maestros con credencial. | Tarifas INAH 2026 (prensa nacional sobre el acuerdo de cuotas) | `verificado` |
| **Museo Soumaya, Plaza Carso** | $85 | $0 pp | Entrada libre a las salas; no incluye consumo en cafetería ni estacionamiento de Plaza Carso. | Museo Soumaya — sitio oficial | `verificado` |
| **Ultramarinos Demar** | $550 | $400–$1500 pp | Ticket promedio reportado por persona con entrada del apartado de crudos, un plato fuerte y una copa de vino. El mínimo corresponde a comer sólo del apartado de crudos sin alcohol. | MICHELIN Guide (ficha del restaurante, banda $$) + reseñas de prensa gastronómica que reportan ticket promedio de $1,000 y "más de $1,500" por persona | `rango` |
| **** | $180 | $600 por trajinera/hora | Tarifa oficial de la alcaldía: $600 MXN por TRAJINERA por hora, hasta 20 personas — NO es por persona. No incluye comida, bebidas ni música de mariachi, que se pagan aparte a bordo. | Tarifa por embarcación publicada por la alcaldía Xochimilco y difundida en guías de la ciudad | `rango` |
| **Six Flags México** | $900 | $1100–$1600 pp | Boleto de un día desde $1,100 en tienda digital (el precio cambia según la fecha). El extremo alto corresponde al Boleto de un Día + Atracciones de Terror ($1,600). No incluye estacionamiento, comida ni Flash Pass. Menores de 90 cm entran gratis. | Six Flags México — boletos de un día (sitio oficial) | `rango` |

## 3. Altas con fuente (61)

Cada alta lleva la fuente de su categoría, colonia y dirección. El precio sólo se afirma
cuando alguien lo publicó; si no, queda `inferido` (la mediana real de su categoría, que la
interfaz marca como estimado) o `por_confirmar`.

| Lugar | Zona | Categoría | Precio | Fuente | Estado |
|---|---|---|---|---|---|
| **PANEM Club** | polanco | Antro | **Por confirmar** (cover y consumo mínimo) | Fichas públicas de PANEM Club en Campos Elíseos 290/A (Yelp y agregadores de vida nocturna); acceso selectivo con reserva | `por_confirmar` |
| **Enigma Rooms Roma I** | roma | Escape room · con sesión | $250–$450 pp | Enigma Rooms — página oficial de Ciudad de México ("Los precios están en MXN e incluyen 60 minutos de juego"; "desde $250 por persona") | `rango` |
| **Enigma Rooms Roma II** | roma | Escape room · con sesión | $250–$450 pp | Enigma Rooms — página oficial de Ciudad de México | `rango` |
| **Enigma Rooms Coyoacán** | coyoacan | Escape room · con sesión | $250–$450 pp | Enigma Rooms — página oficial de Ciudad de México | `rango` |
| **CDMX Electric Bike Tours** | roma | Tour · con sesión | USD 70 pp | CDMX Electric Bike Tours — sitio oficial | `verificado` |
| **Contorno — taller de cerámica** | roma | Taller · con sesión | $600 por clase | Reportajes de Time Out México y Food & Travel sobre talleres de cerámica en CDMX, que citan precio por clase y por taller | `rango` |
| **Cerámica Libertad** | condesa | Taller · con sesión | $3500–$3950 el curso | Cerámica Libertad — tienda en línea (producto "Taller de Torno Cerámico") + reportaje de Time Out México | `rango` |
| **Taller Experimental de Cerámica** | coyoacan | Taller · con sesión | **Por confirmar** (precio por clase y calendario de sesiones) | Reportajes de Time Out México y Chilango sobre talleres de cerámica en Coyoacán (existencia y domicilio verificados; tarifa no publicada) | `por_confirmar` |
| **Drink & Paint — Edén Shopping Bistro** | roma | Taller · con sesión | $1000–$1200 pp | CDMX Secreta — reportaje de la experiencia Drink & Paint con precio y contenido de la sesión | `rango` |
| **Pintando con Vino** | condesa | Taller · con sesión | $850 pp | Reportaje de Food and Pleasure sobre experiencias de pintar y beber en CDMX | `rango` |
| **Cipriani** | juarez | Restaurante | $900–$2500 pp | Sitio oficial de Cipriani Mexico City y fichas públicas del restaurante (banda de precio alta) | `rango` |
| **Campomar · Masaryk** | polanco | Restaurante | $750 pp | OpenTable · ficha del restaurante | `inferido` |
| **Campomar · Mitikah** | delvalle | Restaurante | $750 pp | OpenTable · ficha del restaurante | `inferido` |
| **Marcello** | roma | Restaurante | $800–$1800 pp | Reseñas de prensa gastronómica que reportan cuenta de $1,485 MXN más propina | `rango` |
| **Abrasamar** | roma | Restaurante | $750 pp | OpenTable · ficha del restaurante | `inferido` |
| **Taller de Ostiones** | juarez | Restaurante | $750 pp | OpenTable · ficha del restaurante | `inferido` |
| **Filomeno** | roma | Cantina | $380 pp | OpenTable · ficha del restaurante | `inferido` |
| **Asador Nerón** | condesa | Restaurante | $750 pp | Apple Maps y fichas públicas del restaurante (banda $$$$) | `inferido` |
| **Hiya Wine Bar** | roma | Bar de autor | $480 pp | The Guide CDMX · reportaje de apertura | `inferido` |
| **Yoru Handroll & Sushi Bar** | roma | Restaurante | $750 pp | OpenTable · ficha del restaurante | `inferido` |
| **Madonna** | roma | Restaurante | $750 pp | Fichas públicas del lugar (dirección en Orizaba 37, Roma Norte) | `inferido` |
| **Umai** | roma | Restaurante | $750 pp | OpenTable · ficha del restaurante | `inferido` |
| **Kotsu by Onomura** | roma | Restaurante | $750 pp | OpenTable · ficha del restaurante | `inferido` |
| **Catch** | juarez | Restaurante | $750 pp | Sitio oficial de Catch México | `inferido` |
| **Mandolina · Polanco** | polanco | Restaurante | $750 pp | OpenTable · ficha del restaurante | `inferido` |
| **El Mékông** | condesa | Restaurante | $750 pp | Time Out México · ficha del restaurante | `inferido` |
| **Bikini Pizza** | condesa | Restaurante | $70–$280 pp | Time Out México y Food & Pleasure: rebanada publicada en $70 MXN | `rango` |
| **Tacos París** | roma | Taquería | $310–$500 pp | OpenTable · ficha del restaurante (banda publicada MXN 310–500) | `rango` |
| **Olaf** | juarez | Restaurante | $750 pp | Marco Beteta · ficha del restaurante | `inferido` |
| **Raíz** | polanco | Restaurante | **Por confirmar** (el precio del menú) | Directorio gastronómico de CDMX (existencia y concepto verificados; no publica tarifa del menú) | `por_confirmar` |
| **Ruido** | juarez | Bar de autor | $480 pp | Directorio gastronómico de CDMX (concepto y colonia verificados; falta número) | `inferido` |
| **Cursi** | roma | Restaurante | $750 pp | Coolhunter MX · reseña del restaurante | `inferido` |
| **Fónico** | roma | Restaurante | $750 pp | Directorio gastronómico de CDMX (concepto verificado; falta dirección exacta) | `inferido` |
| **Gin Gin · Polanco** | polanco | Bar | $480 pp | Cadena con varias sucursales en la ciudad (verificar número exacto) | `inferido` |
| **Cantón Mexicali** | condesa | Restaurante | $750 pp | Rico Guide y Marco Beteta · fichas del restaurante | `inferido` |
| **Cancino · Roma** | roma | Restaurante | $750 pp | Cadena con varias sucursales en Roma, Juárez y Condesa (verificar número exacto) | `inferido` |
| **Farina · Roma** | roma | Restaurante | $750 pp | Ficha pública del restaurante (verificar número exacto) | `inferido` |
| **Butcher & Sons · Roma** | roma | Restaurante | $750 pp | Cadena con sucursales en Roma, Condesa y Polanco (verificar número exacto) | `inferido` |
| **Ichikani · Arcos Bosques** | santafe | Restaurante | $750 pp | Robb Report en Español y OpenTable · fichas del restaurante | `inferido` |
| **Cinépolis · Arcos Bosques** | santafe | Cine | $140 pp | Complejo de la cadena dentro de Arcos Bosques | `inferido` |
| **Bistro Estoril** | santafe | Restaurante | $750 pp | Grupo Estoril · sitio oficial | `inferido` |
| **La Mallorquina · Arcos Bosques** | santafe | Café | $160 pp | Sucursal de la panadería dentro de Arcos Bosques | `inferido` |
| **Tacos Juan · Masaryk** | polanco | Taquería | $130 pp | Tacos Juan · sitio oficial | `inferido` |
| **Tacos Juan · Santa Fe** | santafe | Taquería | $130 pp | Tacos Juan · sitio oficial | `inferido` |
| **Belfiore** | polanco | Restaurante | $750 pp | OpenTable · ficha del restaurante | `inferido` |
| **Panadería Gala** | roma | Café | $160 pp | The Infatuation · reseña de Panadería Gala | `inferido` |
| **Cuarentena Baking** | roma | Café | $160 pp | Cuarentena Baking · sitio oficial | `inferido` |
| **Sonora Grill · Miyana** | polanco | Restaurante | $750 pp | Sucursal de la cadena dentro de Miyana | `inferido` |
| **Dinsmoor** | polanco | Antro | **Por confirmar** (cover y consumo mínimo) | Fichas públicas del club en Hegel 307, Polanco | `por_confirmar` |
| **Salón Solín** | roma | Antro | **Por confirmar** (cover y consumo mínimo) | Tripadvisor y Mindtrip · fichas del lugar | `por_confirmar` |
| **Bar 27 · Santa Fe** | santafe | Antro | **Por confirmar** (cover y consumo mínimo) | Tripadvisor · ficha del lugar (sin dirección publicada) | `por_confirmar` |
| **Musak** | roma | Bar de autor | $480 pp | Musak · página oficial | `inferido` |
| **Travieso** | roma | Bar de autor | $480 pp | Roadbook · guía de bares de CDMX | `inferido` |
| **The Midnight Monkey** | roma | Speakeasy | $600 pp | Fichas públicas del bar en Plaza Río de Janeiro 54 | `inferido` |
| **Antesala** | roma | Bar de autor | $480 pp | The Infatuation · guía de bares de CDMX | `inferido` |
| **Maison Artemisia** | roma | Bar de autor | $480 pp | Maison Artemisia · sitio oficial y 50 Best Discovery | `inferido` |
| **Oly** | condesa | Restaurante | $500 pp | Sitio oficial olyoly.mx y banda de precio publicada en OpenTable (dato aportado por el usuario) | `rango` |
| **Aida Café · Santa Fe** | santafe | Café | $310–$500 pp | Sitio oficial aidacafe.mx y banda de precio publicada en OpenTable (dato aportado por el usuario) | `rango` |
| **Duke** | polanco | Antro | $1000 pp | Sitio del lugar dukepalmas.club: horario y consumo anunciados (dato aportado por el usuario) | `rango` |
| **Kinshasa Roma** | roma | Rooftop | **Por confirmar** (el consumo por persona y el cover si lo hay) | Ficha de CDMX365 sobre Kinshasa Roma (dato aportado por el usuario) | `por_confirmar` |
| **Jardín Paraíso** | roma | Bar | **Por confirmar** (el consumo por persona (se menciona $400–$600 como referencia sin confirmar)) | Reseña de janenovikova.com e Instagram @_jardinmx (datos aportados por el usuario) | `por_confirmar` |

## 4. Bajas por identidad fabricada

### `cdmx-2005` — Panem Bakery & Bistro — Café — Campos Elíseos 290-A, Polanco — $250 — 08:00–20:00

Identidad fabricada: mezcla dos negocios distintos. La dirección Campos Elíseos 290/A, Polanco corresponde a PANEM CLUB, un antro que abre jueves a sábado de 23:00 a 04:00. "Panem Bakery & Bistro" es una cadena de panadería-bistró de San Pedro Garza García / Monterrey, cuyo sitio oficial (panem.mx) lista cinco sucursales, TODAS en Nuevo León y NINGUNA en la Ciudad de México. El registro tomaba la dirección del antro y le pegaba el nombre, la categoría (Café), un horario diurno y un precio que no existen en esa dirección.

*Fuente:* panem.mx (sucursales oficiales) + fichas públicas de PANEM Club en Campos Elíseos 290/A (Yelp, agregadores de vida nocturna) · *consultado:* 2026-10-06 · *reemplazado por:* `cdmx-3001`

### `cdmx-2006` — Panem Roma — Café — "Roma Norte" — $220

Sucursal inexistente. panem.mx no lista ninguna sucursal en CDMX. El registro no tenía calle ni número (sólo "Roma Norte") y sus coordenadas eran aproximadas de la colonia.

*Fuente:* panem.mx · *consultado:* 2026-10-06

### `cdmx-2088` — Panem Del Valle — Café — "Del Valle" — $220

Sucursal inexistente, mismo caso que cdmx-2006: sin calle ni número y sin respaldo en el sitio oficial.

*Fuente:* panem.mx · *consultado:* 2026-10-06

## 5. Qué queda pendiente

- Corregidos contra fuente: **6** · Altas con fuente: **61** · Bajas: **3**.
- **Pendientes: 1035 registros** del catálogo original conservan un precio inferido
  del valor por defecto de su categoría. Se muestran como *estimado* y un plan que los use se
  presenta como **"desde $X"**, nunca como un total cerrado.

Donde la tarifa no es por persona (una trajinera por hora, un curso de varias sesiones) **no se
convirtió**: se guarda en su unidad y el costo por cabeza queda declarado como desconocido.
