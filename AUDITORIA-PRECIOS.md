# Auditoría de precios del catálogo consumidor de SOBRES

Fecha de consulta: **2026-10-06**. Moneda **MXN** salvo donde se indique.

> **Esta auditoría está incompleta y así se declara.** Se verificaron contra fuente
> primaria u oficial **16** registros de **1044**. Los demás conservan un precio
> **inferido** que la interfaz marca como *estimado*. No se inventó ninguna cifra para
> rellenar un hueco, y ningún total se declara seguro si se apoya en una inferencia.

## 1. De dónde sale cada precio (rastreo en el repositorio)

`data/lugares.js` trae un campo `pp` y un campo `src`. Al rastrearlos:
**`src` documenta de dónde salió el LUGAR, no de dónde salió el PRECIO.**

- 1044 registros comparten sólo **46 precios distintos**.
- **445** registros en $0, **120** en $85, **108** en $350, **37** en $1,500.
- **728** registros vienen del Sistema de Información Cultural de la Secretaría de
  Cultura, que **no publica precios**: su `pp` es inferencia nuestra, no dato de la fuente.
- **230** vienen de "Curaduría Sobres", cuyo propio texto dice *"verifica horarios y precios antes de ir"*.

| Origen | Aplica a | Por qué no es evidencia |
|---|---|---|
| `defecto_categoria` | Centro cultural, Galería, Librería, Biblioteca, Parque, Centro comercial, Al aire libre | Toda la categoría comparte una única cifra ($0). Muchos de estos lugares sí son de entrada libre, pero el dato no se verificó lugar por lugar y no distingue acceso gratis de consumo dentro (café, librería, estacionamiento). |
| `defecto_categoria` | Museo | 120 de 148 museos comparten $85. La auditoría muestra que el rango real va de $0 (Museo Soumaya) a $320 (Frida Kahlo): el defecto subestima entre 2 y 4 veces los museos principales. |
| `defecto_categoria` | Teatro | 98 de 100 teatros comparten $350, sin distinguir función, zona ni localidad. |
| `defecto_categoria` | Foro | 42 de 75 foros comparten $300. |
| `defecto_tier` | Restaurante | Valor por defecto asignado al tier MICHELIN/alta cocina (37 registros con exactamente $1,500). No sale de una carta. |
| `curaduria` | cualquier registro con ese `src` | Los 230 registros con src "Curaduría Sobres" llevan un precio estimado a mano, sin carta ni boleto de respaldo. Su propio texto dice "verifica horarios y precios antes de ir". |
| `sic` | cualquier registro con ese `src` | El Sistema de Información Cultural (SIC) de la Secretaría de Cultura aporta 728 registros y NO publica precios. Cualquier `pp` en esos registros es inferencia nuestra, no dato de la fuente. |

## 2. La señal: el precio es un valor por defecto de la categoría

| Categoría | Lugares | Precios distintos | Precio dominante |
|---|---:|---:|---|
| Museo | 148 | 6 | $85 en 120 de 148 |
| Centro cultural | 132 | 1 | $0 en 132 de 132 |
| Restaurante | 130 | 27 | $1500 en 37 de 130 |
| Teatro | 100 | 3 | $350 en 98 de 100 |
| Galería | 97 | 1 | $0 en 97 de 97 |
| Librería | 93 | 1 | $0 en 93 de 93 |
| Biblioteca | 88 | 1 | $0 en 88 de 88 |
| Foro | 75 | 3 | $300 en 42 de 75 |
| Atracción | 33 | 8 | $200 en 23 de 33 |
| Café | 29 | 13 | $160 en 6 de 29 |
| Bar | 25 | 9 | $550 en 11 de 25 |
| Parque | 20 | 1 | $0 en 20 de 20 |
| Taquería | 13 | 7 | $120 en 3 de 13 |
| Centro comercial | 13 | 1 | $0 en 13 de 13 |

## 3. Registros corregidos contra fuente primaria

| Lugar | Antes | Corregido | Qué compra ese monto | Fuente | Fecha | Estado |
|---|---|---|---|---|---|---|
| **Museo Frida Kahlo** | $85 | $60–$320 pp | Entrada general $320; residente mexicano $160; estudiante/maestro con credencial $60. No incluye Casa Kahlo ni guía. | Museo Frida Kahlo — taquilla oficial | 2026-10-06 | `verificado` |
| **Museo Nacional de Antropología (MNA)** | $85 | $0–$210 pp | Entrada general $210; mexicano y residente $105; domingo gratis para residentes; gratis con INAPAM, menores de 13, estudiantes y maestros con credencial. | Tarifas INAH 2026 (prensa nacional sobre el acuerdo de cuotas) | 2026-10-06 | `verificado` |
| **Museo Soumaya, Plaza Carso** | $85 | $0 pp | Entrada libre a las salas; no incluye consumo en cafetería ni estacionamiento de Plaza Carso. | Museo Soumaya — sitio oficial | 2026-10-06 | `verificado` |
| **Ultramarinos Demar** | $550 | $400–$1500 pp | Ticket promedio reportado por persona con entrada del apartado de crudos, un plato fuerte y una copa de vino. El mínimo corresponde a comer sólo del apartado de crudos sin alcohol. | MICHELIN Guide (ficha del restaurante, banda $$) + reseñas de prensa gastronómica que reportan ticket promedio de $1,000 y "más de $1,500" por persona | 2026-10-06 | `rango` |
| **** | $180 | $600 **por trajinera / hora** (hasta 20 personas) | Tarifa oficial de la alcaldía: $600 MXN por TRAJINERA por hora, hasta 20 personas — NO es por persona. No incluye comida, bebidas ni música de mariachi, que se pagan aparte a bordo. | Tarifa por embarcación publicada por la alcaldía Xochimilco y difundida en guías de la ciudad | 2026-10-06 | `rango` |
| **Six Flags México** | $900 | $1100–$1600 pp | Boleto de un día desde $1,100 en tienda digital (el precio cambia según la fecha). El extremo alto corresponde al Boleto de un Día + Atracciones de Terror ($1,600). No incluye estacionamiento, comida ni Flash Pass. Menores de 90 cm entran gratis. | Six Flags México — boletos de un día (sitio oficial) | 2026-10-06 | `rango` |

Correcciones que no son de precio y salieron en la misma revisión:

- **cdmx-0200**: Requiere boleto con horario; conviene comprar en línea.
- **cdmx-0161**: Tarifa actualizada en 2026; el catálogo traía el defecto de categoría.
- **cdmx-0151**: El defecto de $85 cobraba de más un museo que es gratis.
- **Ultramarinos Demar**: El usuario reportó que $500 era muy bajo y tenía razón. Además la dirección del catálogo (Zacatecas 8) y el horario (13–23) estaban equivocados: la ficha oficial dice Mérida 21 y cierre a las 20:00, con martes cerrado. No hay carta pública con precios por plato, así que el monto queda como RANGO, no como cifra verificada.
- **xochimilco**: El catálogo lo tenía como $180 POR PERSONA, mezclando unidades: la trajinera se cobra por embarcación y por hora. Como el monto por persona depende de cuántos vayan y de cuántas horas, no se convierte a "por persona" sin una regla explícita y se deja como tarifa por embarcación. Además estaba asignado a la zona Coyoacán, a unos 10 km del embarcadero.
- **cdmx-2091**: El precio de taquilla es distinto al de la tienda digital, y el de un día varía por fecha: por eso es rango y no una cifra fija. El catálogo lo tenía en $900, por debajo del mínimo real.

## 4. Oferta nueva verificada (lo que al catálogo le faltaba)

| Lugar | Zona | Actividad | Precio | Qué incluye | Fuente | Estado |
|---|---|---|---|---|---|---|
| **PANEM Club** | polanco | baile, copas | **Por confirmar** (cover y consumo mínimo) | — | Fichas públicas de PANEM Club en Campos Elíseos 290/A (Yelp y agregadores de vida nocturna); acceso selectivo con reserva | `por_confirmar` |
| **Enigma Rooms Roma I** | roma | reto · necesita sesión | $250–$450 pp | 60 minutos de juego por persona. El precio baja por persona conforme crece el equipo y cambia según sede, fecha y horario; el mínimo publicado es "desde $250 por persona". | Enigma Rooms — página oficial de Ciudad de México ("Los precios están en MXN e incluyen 60 minutos de juego"; "desde $250 por persona") | `rango` |
| **Enigma Rooms Roma II** | roma | reto · necesita sesión | $250–$450 pp | 60 minutos de juego por persona; el precio por persona baja conforme crece el equipo. | Enigma Rooms — página oficial de Ciudad de México | `rango` |
| **Enigma Rooms Coyoacán** | coyoacan | reto · necesita sesión | $250–$450 pp | 60 minutos de juego por persona. | Enigma Rooms — página oficial de Ciudad de México | `rango` |
| **CDMX Electric Bike Tours** | roma | recorrido · necesita sesión | USD 70 pp | Recorrido guiado en bicicleta eléctrica en grupo pequeño por Roma Norte, Condesa, Juárez y Reforma, con bicicleta incluida. No incluye comida. | CDMX Electric Bike Tours — sitio oficial | `verificado` |
| **Contorno — taller de cerámica** | roma | taller · necesita sesión | $600 por clase | $600 MXN por clase individual (alfarería o torno), materiales incluidos. El taller completo de varias sesiones cuesta $2,900, pero ésa es otra unidad y NO se suma como el gasto de una tarde. | Reportajes de Time Out México y Food & Travel sobre talleres de cerámica en CDMX, que citan precio por clase y por taller | `rango` |
| **Cerámica Libertad** | condesa | taller · necesita sesión | $3500–$3950 el curso completo | CURSO completo de aproximadamente 6 clases (mes y medio): torno $3,500; cursos de principiantes y expertos $3,800–$3,950. NO se vende por clase suelta, así que NO es comparable con un precio por persona de una tarde. | Cerámica Libertad — tienda en línea (producto "Taller de Torno Cerámico") + reportaje de Time Out México | `rango` |
| **Taller Experimental de Cerámica** | coyoacan | taller · necesita sesión | **Por confirmar** (precio por clase y calendario de sesiones) | — | Reportajes de Time Out México y Chilango sobre talleres de cerámica en Coyoacán (existencia y domicilio verificados; tarifa no publicada) | `por_confirmar` |
| **Drink & Paint — Edén Shopping Bistro** | roma | taller · necesita sesión | $1000–$1200 pp | Sesión de pintura guiada por artista, con tres copas de vino, tres tapas, materiales y bastidor de 40×40 cm incluidos. Incluye alcohol: no sirve para un plan "sin alcohol". | CDMX Secreta — reportaje de la experiencia Drink & Paint con precio y contenido de la sesión | `rango` |
| **Pintando con Vino** | condesa | taller · necesita sesión | $850 pp | $850 MXN por persona con todos los materiales, las bebidas y una comida incluidos. | Reportaje de Food and Pleasure sobre experiencias de pintar y beber en CDMX | `rango` |

## 5. Registros dados de baja por identidad fabricada

### `cdmx-2005` — Panem Bakery & Bistro — Café — Campos Elíseos 290-A, Polanco — $250 — 08:00–20:00

Identidad fabricada: mezcla dos negocios distintos. La dirección Campos Elíseos 290/A, Polanco corresponde a PANEM CLUB, un antro que abre jueves a sábado de 23:00 a 04:00. "Panem Bakery & Bistro" es una cadena de panadería-bistró de San Pedro Garza García / Monterrey, cuyo sitio oficial (panem.mx) lista cinco sucursales, TODAS en Nuevo León y NINGUNA en la Ciudad de México. El registro tomaba la dirección del antro y le pegaba el nombre, la categoría (Café), un horario diurno y un precio que no existen en esa dirección.

*Fuente:* panem.mx (sucursales oficiales) + fichas públicas de PANEM Club en Campos Elíseos 290/A (Yelp, agregadores de vida nocturna) · *consultado:* 2026-10-06 · *reemplazado por:* `cdmx-3001`

### `cdmx-2006` — Panem Roma — Café — "Roma Norte" — $220

Sucursal inexistente. panem.mx no lista ninguna sucursal en CDMX. El registro no tenía calle ni número (sólo "Roma Norte") y sus coordenadas eran aproximadas de la colonia.

*Fuente:* panem.mx · *consultado:* 2026-10-06

### `cdmx-2088` — Panem Del Valle — Café — "Del Valle" — $220

Sucursal inexistente, mismo caso que cdmx-2006: sin calle ni número y sin respaldo en el sitio oficial.

*Fuente:* panem.mx · *consultado:* 2026-10-06

## 6. Qué queda pendiente

- Corregidos contra fuente primaria: **6** registros.
- Altas nuevas verificadas: **10** registros.
- Bajas por identidad fabricada: **3** registros.
- **Pendientes: 1035 registros** conservan un precio inferido del valor por
  defecto de su categoría. Cada uno se muestra en la interfaz como *estimado*, con la
  nota de su procedencia, y un plan que los use se presenta como **"desde $X"**, nunca
  como un total cerrado.

Ningún precio se cambió "a ojo": o se verificó con fuente y fecha, o quedó marcado como
estimado o por confirmar. Donde la tarifa no es por persona (una trajinera por hora, un
curso de varias sesiones) **no se convirtió** a por persona: se guarda en su unidad y el
costo por cabeza queda declarado como desconocido.
