# Sprint - Generar Resumen Inicio PDF - Google Drive

- **Workflow ID**: `rqkqaSiaFq0eK7lU`
- **Proyecto n8n**: personal de Polaria Tech, carpeta de automatizaciones de PDF Generator
- **Trigger**: manual (`Iniciar Generación de Sprint`)
- **Genera**: `RESUMEN_INICIO_SPRINT_<N>_<MES-MES_AÑO>.PDF` (única plantilla: `resumen-inicio`)
- **Ver también**: [sprint-fin.md](./sprint-fin.md) (workflow gemelo, resto de plantillas — ahí vive el detalle histórico completo compartido por ambos), [README.md](./README.md)

## Estado actual

**Construido 2026-07-25**, duplicando el workflow único original (`rqkqaSiaFq0eK7lU` era el propio workflow original; se conservó este ID y se recortó, mientras que la copia nueva `ZdUWttXimeb9fKTN` se quedó con el resto de plantillas — ver `sprint-fin.md`).

El recorte se hizo a partir de una auditoría del agente **Automation Governance Architect**, no de una suposición: se le pidió verificar, nodo por nodo, cuáles de los 63 nodos originales eran realmente necesarios para generar `resumen-inicio` contra `SprintSchema` y `template-resumen-inicio.html`, y cuáles solo servían a datos que ese schema exige igual para cualquier plantilla (por lo tanto no eran candidatos a eliminar aunque el HTML no los muestre).

**Resultado de la auditoría**: 42 de 63 nodos (67%) eran necesarios sin cambios — `SprintSchema` exige los mismos campos (`horas`, `agregado`, `estadoSprint`, `desviaciones`, etc.) sin importar la plantilla, así que la mayoría del pipeline no dependía del HTML final. El único bloque grande realmente eliminable (14 nodos, 22%) fue la cadena completa de **horas reales por Google Calendar + notas de Gemini** — ese cálculo solo se lee en la rama `Tiempo verbal=Pasado` de `Calcular Horas y Corte de Agregados1`, y `resumen-inicio` siempre es `Tiempo verbal=Futuro` por convención del proyecto, así que ese valor se calculaba pero nunca se usaba. Los 7 nodos restantes se simplificaron (dejaron de ramificar por plantilla) en vez de eliminarse.

## Objetivo del flujo

Estado inicial → estado final: **Un ciclo (sprint) recién planeado en Linear, con una fila pendiente en la Google Sheet "Preguntas Skill" con `Plantilla=resumen-inicio`** → **un PDF de arranque de sprint generado y subido a Google Drive, con la fila marcada como procesada**.

## Qué cambia respecto al workflow de Fin

| | Sprint-Inicio | Sprint-Fin |
|---|---|---|
| Nodos | 49 | 63 |
| Filtro de fila | Solo `Plantilla=resumen-inicio`, y rechaza (a la rama de error) cualquier fila `resumen-inicio` con `Tiempo verbal` distinto de `Futuro` | `Plantilla` en `resumen`/`resumen-v2`/`resumen-v3`/`detail` |
| Horas de Reuniones/Incidencias | Siempre el estimado fijo de planning (`reuniones=3`, `incidencias=9`) — la cadena de Calendar+Gemini fue eliminada por no usarse nunca en esta rama | Real desde 3 Google Calendars + notas de Gemini (si `Tiempo verbal=Pasado`), o el valor manual del Sheet |
| Estado de cada issue | Siempre "al corte" (`resolverEstadoAlCorte()` — el estado que tenía el issue a la fecha de planning, no el estado actual en vivo) | El estado actual en vivo del issue en Linear |
| Nombre de salida | Hardcodeado `Resumen_Inicio` | Según la plantilla (`Resumen_Final`/`Detail`) |
| Correo de éxito | Solo la rama "issues planeados por persona" | Según plantilla (desglose por estado / estado del sprint + horas) |

Todo lo demás (lectura del Sheet, festivos vía Nager.Date, consulta a Linear, clasificación de issues, carpetas por período en Drive, autoincremento de nombre, Data Table de auditoría, notificaciones de error) es idéntico entre ambos workflows — ver `sprint-fin.md` para el detalle completo de esa parte compartida.

## Riesgo conocido, sin mitigar todavía

Nada en el código valida que una fila `Plantilla=resumen-inicio` tenga efectivamente `Tiempo verbal=Futuro` más allá del rechazo agregado en `Normalizar y Validar Fila del Sprint1` (ver arriba) — es la única salvaguarda. Si esa validación llegara a quitarse o hubiera un bug que la sortee, una fila `resumen-inicio` + `Pasado` calcularía horas fijas de planning en silencio en vez de las horas reales, sin ningún error visible.

## Reglas de negocio que aplican

Mismas que `sprint-fin.md`: el JSON final cumple el mismo `SprintSchema` que el flujo manual, los campos calculables nunca quedan en manos del LLM, y el endpoint (`/api/sprint/extraer`, `/api/sprint/pdf`) es compartido con el resto de flujos.

## Referencias

- Detalle histórico completo del workflow original (antes de la partición), casos de error, postcondiciones compartidas y pendientes de wiring: [sprint-fin.md](./sprint-fin.md)
- Contrato de datos: `backend/src/documents/sprint/config.ts`, sección "Plantillas `resumen`/`resumen-inicio` de `sprint`" en `CLAUDE.md`
- Casos borde compartidos con el flujo manual: `docs/BUSINESS_FLOWS.md`, Flujo 4
