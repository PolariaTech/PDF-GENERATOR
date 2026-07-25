# Sprint - Generar Resumen Inicio PDF - Google Drive

- **Workflow ID**: `rqkqaSiaFq0eK7lU`
- **Proyecto n8n**: personal de Polaria Tech, carpeta de automatizaciones de PDF Generator
- **Trigger**: manual (`Iniciar Generación de Sprint`)
- **Genera**: `RESUMEN_INICIO_SPRINT_<N>_<MES-MES_AÑO>.PDF` (única plantilla: `resumen-inicio`)
- **Ver también**: [sprint-fin.md](./sprint-fin.md) (workflow gemelo, resto de plantillas — ahí vive el detalle histórico completo compartido por ambos), [README.md](./README.md)

## Estado actual

**Construido 2026-07-25**, duplicando el workflow único original (`rqkqaSiaFq0eK7lU` era el propio workflow original; se conservó este ID y se recortó, mientras que la copia nueva `ZdUWttXimeb9fKTN` se quedó con el resto de plantillas — ver `sprint-fin.md`).

El recorte se hizo a partir de una auditoría del agente **Automation Governance Architect**, no de una suposición: se le pidió verificar, nodo por nodo, cuáles de los 63 nodos originales eran realmente necesarios para generar `resumen-inicio` contra `SprintSchema` y `template-resumen-inicio.html`, y cuáles solo servían a datos que ese schema exige igual para cualquier plantilla (por lo tanto no eran candidatos a eliminar aunque el HTML no los muestre).

**Resultado de la auditoría**: 42 de 63 nodos (67%) eran necesarios sin cambios — `SprintSchema` exige los mismos campos (`horas`, `agregado`, `estadoSprint`, `desviaciones`, etc.) sin importar la plantilla, así que la mayoría del pipeline no dependía del HTML final. El único bloque grande realmente eliminable (14 nodos, 22%) fue la cadena completa de **horas reales por Google Calendar + notas de Gemini** — ese cálculo solo se lee en la rama `Tiempo verbal=Pasado` de `Calcular Horas y Corte de Agregados1`, y `resumen-inicio` siempre es `Tiempo verbal=Futuro` por convención del proyecto, así que ese valor se calculaba pero nunca se usaba. Los 7 nodos restantes se simplificaron (dejaron de ramificar por plantilla) en vez de eliminarse. Esto dejó el workflow en 49 nodos.

### Cambios manuales posteriores a la auditoría (mismo día, sin pasar por Claude)

El operador hizo varios ajustes directo en la UI de n8n después del recorte automatizado. El workflow quedó en **50 nodos**:

- **Quitó el sufijo "1" de los 54 nodos que lo tenían** (residuo de la duplicación original) y corrigió a mano las referencias `$('Nodo1')` que quedaron rotas — incluida una que ya estaba rota *antes* del recorte (`Enviar Notificación de Ciclo No Encontrado`, que apuntaba a un nodo que nunca existió en esta copia).
- **Corrigió el corte de planning de 17:00 a 13:00** hora Bogotá en `Calcular Horas y Corte de Agregados` (validado contra POL-108: ese issue pasó a "In Progress" a las 2:37pm, así que con el corte viejo aparecía incorrectamente "In Progress" al momento del planning).
- **Corrigió una pérdida de datos en `Calcular Dia de Planning y Festivos`**: el nodo ahora trae la fila original por referencia a `Normalizar y Validar Fila del Sprint` (antes apuntaba a un nodo ya renombrado/inexistente, así que los campos que no fueran `fechaPlanning`/`festivos` llegaban `undefined` río abajo).
- **Agregó `Filtrar Issues No Agregados`** (nodo Filter) entre `Calcular Agregado y Clasificar Issue` y el resto del pipeline: descarta los issues con `agregado=true` antes de armar el Markdown — el workflow ya calculaba ese booleano pero nunca lo usaba para filtrar. Con esto, solo llegan al PDF de arranque los issues que estaban en el sprint al momento del planning.
- **Agregó `Parsear información por issue`** (nodo Code) justo después: recorta la `descripcion` de cada issue a solo la sección "Descripción (What)" (descarta todo desde "Caso de Uso" en adelante) y borra el campo `comentarios` por completo, para acortar el Markdown que se le manda a la IA.
- **Quitó el nodo `Loop Over Items - Filas Pendientes`** (splitInBatches): el pipeline ya no itera fila por fila, corre una sola vez con lo que devuelva `Normalizar y Validar Fila del Sprint`. Decisión deliberada, no un descuido — en la práctica nunca hay más de una fila `resumen-inicio` pendiente a la vez. **Ojo si eso cambia**: `Normalizar y Validar Fila del Sprint` sigue devolviendo un item por cada fila pendiente si llegara a haber más de una, pero sin el loop, la mayoría de los nodos río abajo no son `runOnceForEachItem` y varios leen `$('...').first()` en referencias cruzadas — el mismo patrón de bug que motivó agregar el loop originalmente el 2026-07-22 ("si había varias filas en FALSE, solo se generaba la última") podría reaparecer si alguna vez hay 2+ filas `resumen-inicio` pendientes al mismo tiempo. No verificado con una ejecución real de ese escenario.

## Objetivo del flujo

Estado inicial → estado final: **Un ciclo (sprint) recién planeado en Linear, con una fila pendiente en la Google Sheet "Preguntas Skill" con `Plantilla=resumen-inicio`** → **un PDF de arranque de sprint generado y subido a Google Drive, con la fila marcada como procesada**.

## Qué cambia respecto al workflow de Fin

| | Sprint-Inicio | Sprint-Fin |
|---|---|---|
| Nodos | 50 | 63 |
| Filtro de fila | Solo `Plantilla=resumen-inicio`, y rechaza (a la rama de error) cualquier fila `resumen-inicio` con `Tiempo verbal` distinto de `Futuro` | `Plantilla` en `resumen`/`resumen-v2`/`resumen-v3`/`detail` |
| Procesa cuántas filas pendientes por corrida | Solo 1 (sin loop, ver arriba) | Todas (con `Loop Over Items - Filas Pendientes`) |
| Horas de Reuniones/Incidencias | Siempre el estimado fijo de planning (`reuniones=3`, `incidencias=9`) — la cadena de Calendar+Gemini fue eliminada por no usarse nunca en esta rama | Real desde 3 Google Calendars + notas de Gemini (si `Tiempo verbal=Pasado`), o el valor manual del Sheet |
| Corte de planning | 13:00 hora Bogotá | 13:00 hora Bogotá (mismo fix, portado el mismo día) |
| Issues agregados | Se filtran y se excluyen del Markdown (`Filtrar Issues No Agregados`) | Se incluyen todos, con la etiqueta `agregado` |
| Estado de cada issue | Siempre "al corte" (`resolverEstadoAlCorte()` — el estado que tenía el issue a la fecha de planning, no el estado actual en vivo) | El estado actual en vivo del issue en Linear |
| Nombre de salida | Hardcodeado `Resumen_Inicio` | Según la plantilla (`Resumen_Final`/`Detail`) |
| Correo de éxito | Solo la rama "issues planeados por persona" | Según plantilla (desglose por estado / estado del sprint + horas) |

Todo lo demás (lectura del Sheet, festivos vía Nager.Date, consulta a Linear, clasificación de issues, carpetas por período en Drive, autoincremento de nombre, Data Table de auditoría, notificaciones de error) es idéntico entre ambos workflows — ver `sprint-fin.md` para el detalle completo de esa parte compartida.

## Riesgo conocido, sin mitigar todavía

Nada en el código valida que una fila `Plantilla=resumen-inicio` tenga efectivamente `Tiempo verbal=Futuro` más allá del rechazo agregado en `Normalizar y Validar Fila del Sprint` (ver arriba) — es la única salvaguarda. Si esa validación llegara a quitarse o hubiera un bug que la sortee, una fila `resumen-inicio` + `Pasado` calcularía horas fijas de planning en silencio en vez de las horas reales, sin ningún error visible.

Ver también, arriba, el riesgo de perder filas en silencio si alguna vez hay 2+ filas `resumen-inicio` pendientes al mismo tiempo (consecuencia de haber quitado el loop) — riesgo distinto a este, ambos sin mitigar.

## Reglas de negocio que aplican

Los campos calculables nunca quedan en manos del LLM. A diferencia de `sprint-fin`, este workflow llama a `/api/sprint-inicio/extraer` y `/api/sprint-inicio/pdf` — **ya no** es el mismo endpoint ni el mismo schema que `sprint-fin`: desde 2026-07-25 (ver ADR-0008) el backend partió el `docType` único `sprint` en `sprint-inicio`/`sprint-fin`, cada uno con su propio schema Zod (`SprintInicioSchema`, deliberadamente mínimo) y su propio prompt. `SprintInicioSchema` además exige rangos de texto más estrictos que antes (con margen de tolerancia sobre el rango exacto del prompt) y `extractor.service.ts` reintenta hasta 3 veces si la IA no los cumple.

## Referencias

- Detalle histórico completo del workflow original (antes de la partición de n8n del 2026-07-25), casos de error, postcondiciones compartidas y pendientes de wiring: [sprint-fin.md](./sprint-fin.md)
- Contrato de datos: `backend/src/documents/sprint-inicio/config.ts`, sección "`sprint-inicio`" en `CLAUDE.md`
- Decisión de partir el backend en `sprint-inicio`/`sprint-fin` + reintento de extracción: `docs/adr/0008-particion-sprint-inicio-fin-y-reintento-de-extraccion.md`
- Casos borde compartidos con el flujo manual: `docs/BUSINESS_FLOWS.md`, Flujo 4 (Caso borde A: `sprint-inicio` ya tiene `.min()`+reintento, `sprint-fin` todavía no)
