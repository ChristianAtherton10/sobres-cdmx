# Conciliación por ID — Excel del 9 nov ↔ importador ↔ catálogo de la preview

Generado por `reportes/pasada/concilia.py`. Excel: 2952 filas (2918 con ID, 34 sin ID). Catálogo de la preview: 2823 fichas.

## 1. IDs

- IDs del Excel que no existían en la exportación: **0**.
- IDs de la exportación que ya no vienen en el Excel (filas borradas): **0**.
- IDs que el Excel conserva y no están en el catálogo de la preview: **3** (1 son eventos ya vencidos, que no se cargan). Otros: os-n11770329070, os-n11737763876
- Ninguna corrección cambió un ID: los cambios viajan por ID en `data/revision.js` y `data/verificados.js`.

## 2. Bajas

- Excel (Quitar = Sí): **110** · importador: **110** · siguen en el catálogo: **0**.
- Diferencias Excel↔importador: 0.
- Duplicados declarados (la ficha buena hereda el hotspot): {"baltra": "iv-f2b54ca0c5"}.

## 3. Pausas

- Excel (nota «PAUSA ·»): **747** · importador: **731**.
- En el Excel y no en el importador: **16** — la única razón era el pin y Nominatim confirmó el número (se levantó al importar) o es un evento fusionado con fechas activas.
- En el importador y no en el Excel: **0**.
- Estado HOY de esas pausas en la preview: en pausa: **659** · condicionada (elige función/sesión): **71** · fuera del catálogo (evento vencido): **1**.
- Motivos de las que siguen en pausa: horario: 235 · horario + ubicación: 179 · ubicación: 118 · función/sesión: 118 · otro: 6 · ubicación + función/sesión: 3.

## 4. Altas

- Lugares nuevos en el Excel: **15** · importados: **15**. Hoy en planes: **3**; el resto espera pin con número u horario (se dice en su ficha).
- Filas de eventos nuevas en el Excel: **19** → **3** eventos nuevos (una ficha por evento con todas sus fechas) + fechas fusionadas en eventos que ya existían (Morat, Karol G, DLD).
- Altas verificadas en la pasada profunda: **0**.

## 5. Precios

| Estado en la exportación | Estado en el Excel | Fichas |
|---|---|---|
| Sin precio | Sin precio | 795 |
| Estimado | Estimado | 703 |
| Inferido | Inferido | 493 |
| Inferido | Por confirmar | 347 |
| Estimado | Por confirmar | 253 |
| Inferido | Por confirmar (baja) | 92 |
| Rango publicado | Rango publicado | 77 |
| Verificado | Verificado | 34 |
| Inferido | Verificado | 10 |
| Sin precio | Sin precio (baja) | 10 |
| Inferido | Inferido (baja) | 6 |
| Sin precio | Verificado | 3 |
| Estimado | Estimado (baja) | 2 |
| Rango publicado | Por confirmar | 1 |
| Sin precio | Rango publicado | 1 |
| Estimado | Verificado | 1 |
| Estimado | Rango publicado | 1 |

- **705 «Estimado»** en el Excel: todas conservan su número (no se tocaron).
- **693 «Por confirmar»** sin número: 213 venían de la banda de OpenTable; las demás eran estimaciones o inferencias por categoría. El dato «705 precios de OpenTable» de mi reporte del 9 nov era incorrecto.
- En la preview: sin precio · por_confirmar: 1398 · con precio · estimado: 703 · con precio · inferido: 492 · con precio · rango: 81 · con precio · verificado: 56 · sin precio · rango: 2.
- Verificados con fuente en la pasada profunda: **43** fichas.

## 6. Ubicación

- Direcciones cambiadas: **50** · pines retirados por el Excel: **139** · cambios de zona: **7**.
- Pines recalculados con Nominatim y número confirmado: **52**; sin confirmar (siguen en pausa por ubicación): **160**.
- Lugares que salen en planes con pin aproximado: **2** (ninguno debería; si hay, es una ficha anterior a la revisión).

