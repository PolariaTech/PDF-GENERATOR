# Sprint - Generar Resumen Final PDF - Google Drive

- **Workflow ID**: `ZdUWttXimeb9fKTN`
- **Proyecto n8n**: personal de Polaria Tech, carpeta de automatizaciones de PDF Generator
- **Trigger**: manual (`Iniciar Generación de Sprint`) — no hay trigger automático todavía
- **Genera**: `RESUMEN_FINAL_SPRINT_<N>_<MES-MES_AÑO>.PDF` (plantillas `resumen`/`resumen-v2`/`resumen-v3`) o `DETAIL_SPRINT_<N>_<MES-MES_AÑO>.PDF` (plantilla `detail`)
- **Ver también**: [sprint-inicio.md](./sprint-inicio.md) (workflow gemelo, solo plantilla `resumen-inicio`), [README.md](./README.md)

## Estado actual

**Construido, con pilot real corrido con éxito (2026-07-15) bajo el workflow único original.** El 2026-07-25 ese workflow único (que generaba las 5 plantillas de `sprint`) se partió en dos: este (`ZdUWttXimeb9fKTN`, duplicado del original) quedó con las 63 nodos intactos y un filtro nuevo para procesar solo filas de plantilla `resumen`/`resumen-v2`/`resumen-v3`/`detail`; el otro (`rqkqaSiaFq0eK7lU`, ver `sprint-inicio.md`) se recortó a solo `resumen-inicio`.

El plan técnico original (AI Agent multi-turno con 3 tools sobre Linear) vive en `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md` y su auditoría en `docs/planning/AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md` — ambos documentos quedan como registro histórico del diseño inicial. Durante la construcción real se cambió esa pieza central por extracción determinística (ver `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md`): el AI Agent fallaba de forma dura (crash de ejecución) cuando el parser estructurado no podía interpretar su salida, y los campos que alimentan KPIs de liderazgo (`agregado`, `type`, `priority`, `status`) no tenían por qué depender de un LLM cuando son aritmética/comparación de fechas pura.

Existió también un workflow AI Agent original paralelo (`G8Fq2jaofpNAYCM9`) — arquitectura vieja, pendiente decidir si se archiva ahora que el determinístico corrió sin problemas.

**Actualización 2026-07-25 (backend, no n8n):** más allá de la partición del workflow de n8n (arriba), el backend también partió el `docType` único `sprint` en `sprint-inicio`/`sprint-fin` — dos schemas Zod y dos prompts separados, no uno compartido (ver ADR-0008). Este workflow ahora llama a `/api/sprint-fin/extraer` y `/api/sprint-fin/pdf` (antes `/api/sprint/*`); el schema (`SprintSchema`) no cambió de forma, solo de ubicación (`backend/src/documents/sprint-fin/config.ts`) y de nombre del export (`sprintFinConfig`).

**Ajustes manuales del mismo día (63→64 nodos):** el corte de planning se corrigió de 17:00 a 13:00 hora Bogotá en `Calcular Horas y Corte de Agregados1` (mismo fix que `sprint-inicio`, portado por Claude a pedido del operador). Además se agregó un nodo Code nuevo entre `Calcular Agregado y Clasificar Issue1` y `Consolidar Markdown del Sprint1` que recorta la `descripcion` de cada issue a solo la sección "Descripción (What)" (igual que el nodo `Parsear información por issue` de `sprint-inicio`), pero **sin** borrar `comentarios` — a diferencia de `sprint-inicio`, acá se conservan porque el texto narrativo de cierre (`desviaciones`, `riesgoTransversalResultado`) necesita más contexto real. Ese nodo quedó con el nombre genérico por defecto, `Code in JavaScript` (nunca se renombró).

## Objetivo del flujo

Estado inicial → estado final: **Un ciclo (sprint) cerrado o en curso en Linear, con una fila pendiente en la Google Sheet "Preguntas Skill" con `Plantilla` en `resumen`/`resumen-v2`/`resumen-v3`/`detail`** → **un PDF de cierre de sprint generado y subido a Google Drive, con la fila marcada como procesada**, sin que nadie tenga que copiar datos de Linear a un Markdown ni editar el JSON a mano.

## Actores involucrados

| Actor | Rol en este flujo |
|---|---|
| Operador | Dispara el trigger manual en n8n |
| n8n (orquestador) | Lee la Google Sheet, valida la fila, calcula las horas, consulta Linear con HTTP Request nodos planos, clasifica cada issue de forma determinística, consolida un Markdown, llama a `POST /api/sprint-fin/extraer` y a `POST /api/sprint-fin/pdf`, y sube el resultado a Drive |
| Linear (API GraphQL) | Fuente de verdad de los ciclos, issues y su historial — consultada con 3 llamadas HTTP directas (`Buscar Ciclo en Linear1`, `Listar Issues del Ciclo1`, `Obtener Historial de Issue1` una vez por issue), sin ningún LLM de por medio. También aporta `startsAt`/`endsAt` del ciclo |
| Nager.Date (API pública de feriados) | Fuente de los feriados de Colombia (`date.nager.at`) usados para calcular festivos/fecha de planning — mismo patrón que usa el workflow de épica-inicio |
| Google Calendar (3 cuentas: Daniel, Mauro, Lucho) | Fuente de las reuniones reales de la semana del sprint (eventos con Google Meet) para calcular `Horas Reuniones` automáticamente cuando `Tiempo verbal=Pasado` — requiere que Mauro y Lucho compartan su calendario con la cuenta que usan las credenciales de n8n |
| Google Drive (carpeta de notas de Gemini) | Fuente de la duración real de cada reunión (cuando existe una nota de Gemini para esa reunión) en vez de la duración agendada del evento |
| Backend — extracción (`POST /api/sprint-fin/extraer`) | El mismo endpoint que usa el flujo manual — acotado al texto narrativo (`objetivo`, `equipo`, `riesgoTransversal`, `desviaciones`, la parte cualitativa de `riesgoTransversalResultado`) |
| Backend — PDF (mismo `POST /api/sprint-fin/pdf` que usa el frontend manual) | Valida y genera el PDF — no hay backend paralelo |
| Google Sheets ("Preguntas Skill") | Guarda la configuración de cada corrida y el resultado — festivos, fecha de planning y zona horaria ya no son columnas |
| Google Drive | Destino final del PDF |

## Resumen del flujo en términos de negocio

1. Un operador dispara manualmente el workflow en n8n.
2. n8n toma **todas** las filas pendientes con `Plantilla` en `resumen`/`resumen-v2`/`resumen-v3`/`detail` de la Sheet de configuración de sprints y las procesa una por una, de punta a punta cada una, en orden (filas `resumen-inicio` quedan para el workflow gemelo).
3. n8n valida que esa fila tenga datos completos y coherentes (plantilla válida, tiempo verbal, etc.) antes de gastar ninguna llamada a Linear o al backend.
4. n8n busca el ciclo en Linear por nombre exacto para obtener sus fechas, calcula cuántos feriados de Colombia caen en la semana del sprint y la fecha real del primer día hábil (el "sprint planning" real).
5. n8n calcula de forma determinística (sin LLM) las horas del equipo para ese sprint (Reuniones desde los 3 calendarios + notas de Gemini si `Tiempo verbal=Pasado` y la columna del Sheet viene vacía, Personalizaciones con su default o el valor del Sheet, Incidencias del Sheet, Proyectos como el resto) y el corte de fecha que separa "planeado" de "agregado".
6. n8n lista todos los issues del ciclo en Linear, y para cada uno consulta su historial de cambios de ciclo — todo con llamadas HTTP directas, sin agente ni tool-calling.
7. n8n clasifica cada issue de forma determinística (`agregado`, `type`, `priority`, `status`) y consolida todo en un único Markdown, junto con `porcentajeCompletado`/`estadoSprint` ya calculados.
8. n8n envía ese Markdown a `POST /api/sprint-fin/extraer` para que redacte el texto narrativo respetando los rangos de caracteres del prompt.
9. n8n **pisa** en la respuesta del LLM los campos ya calculados de forma determinística (`sprintName`, fechas, `weekNumber`, `estadoSprint`, `porcentajeCompletado`, `horas`, `plantilla`, y las cifras numéricas de `riesgoTransversalResultado`). **No hay validación de rangos de caracteres ni reintento** — ver Caso borde A de `docs/BUSINESS_FLOWS.md` (Flujo 4).
10. n8n llama a `POST /api/sprint-fin/pdf`, autenticado con una API key propia del backend.
11. n8n confirma que la respuesta sea realmente un PDF (y no un JSON de error) antes de subir nada a Drive.
12. n8n calcula el nombre del archivo según la plantilla, busca/crea primero la carpeta del período y luego la subcarpeta del sprint dentro de ella, revisa si ya existe un archivo con ese nombre y le agrega un sufijo autoincremental si hace falta, antes de subirlo a Google Drive.
13. n8n relee el Sheet en el instante y ubica en código el `row_number` real de la fila de origen, y la marca como procesada con ese `row_number`, el link del archivo y la fecha.
14. n8n envía un correo de informe (Polaria-branded) con el resultado y los datos clave del documento generado, y continúa con la siguiente fila pendiente (paso 2) si queda alguna.

## Postcondiciones

- La fila de la Sheet queda marcada `Procesado = TRUE`, con el link de Drive y un timestamp — identificada por un `row_number` recalculado justo antes de escribir (no por columnas de texto como matcher, ni por el `row_number` leído al inicio del workflow — ver nota de confiabilidad más abajo).
- El PDF queda en `01_SPRINTS/PERIODO <MES-MES AÑO>/<subcarpeta del sprint>/`, con nombre `RESUMEN_FINAL_SPRINT_<N>_<MES-MES_AÑO>.PDF` (`resumen`/`resumen-v2`/`resumen-v3`) o `DETAIL_SPRINT_<N>_<MES-MES_AÑO>.PDF` (`detail`), todo en mayúsculas; autoincremento `_1`, `_2`, etc. si ya existe.
- Queda un registro de auditoría de la corrida en el Data Table de n8n `sprint_pdf_execution_log`.
- Se envía un correo de informe a `daniel.galvis@polaria.tech` (éxito o error), HTML con la paleta de marca de Polaria.

## Reglas de negocio que aplican

- El JSON final debe cumplir exactamente el mismo `SprintSchema` de `sprint-fin` que valida el flujo manual (tab "Sprint Fin" del frontend) — no hay schema paralelo. Es un schema distinto al de `sprint-inicio` desde 2026-07-25 (ver ADR-0008).
- La única fuente de verdad para los rangos de caracteres del prompt es `SPRINT_SYSTEM_PROMPT` en `backend/src/documents/sprint-fin/config.ts`, nunca una copia hardcodeada en n8n.
- Los campos calculables de forma determinística nunca se dejan en manos del LLM — n8n los pisa siempre.
- El endpoint que llama n8n es el mismo que usa el frontend manual: cualquier cambio de contrato afecta ambos flujos a la vez.

## Historial de cambios relevantes

Changelog condensado (detalle completo en el historial de commits del repo y en ADR-0006/ADR-0007):

- El nombre del PDF depende de la plantilla, con autoincremento si ya existe. La carpeta padre en Drive es `01_SPRINTS`.
- La fila se marca procesada matcheando por `row_number` recalculado justo antes de escribir (`Releer Sheet Antes de Marcar` + `Calcular Row Number Fresco`), no por columnas de texto — el nodo nativo de Google Sheets no aplicaba un AND estricto entre columnas cuando había varias filas por sprint (una por plantilla) compartiendo Ciclo+weekNumber.
- El alto del PDF también se achica cuando el contenido real es menor al de diseño, no solo crece (ADR-0007).
- Si no hay ninguna fila pendiente, el workflow no muere en silencio: devuelve un item con `esValida:false` y dispara el correo de "fila inválida".
- Correo de éxito Polaria-branded (`Enviar Informe de PDF Generado`) con contenido que varía según plantilla (`detail` = desglose por estado; `resumen`/`resumen-v2` = estado del sprint, % completado, planeados vs. agregados, horas por segmento).
- **2026-07-22, cambios grandes:** procesa todas las filas pendientes (no solo la última); fix de schema circular en `zodResponseFormat` (`/api/sprint-fin/extraer`); reorganización de `01_SPRINTS` en subcarpetas por período; festivos y fecha de planning automatizados vía Nager.Date; **Horas de Reuniones automatizadas desde 3 Google Calendars + notas reales de Gemini** (duración real de la llamada leída de la nota de Gemini cuando existe, en vez de la duración agendada; person-hours, no horas de reloj); Personalizaciones con default `23.8h/semana`; zona horaria hardcodeada a `America/Bogota`; y dos bugs de confiabilidad del LLM corregidos en `riesgoTransversalResultado` — ver Caso borde C de `docs/BUSINESS_FLOWS.md` (Flujo 4).
- **2026-07-25:** partición del workflow único en `sprint-inicio`/`sprint-fin`. Este workflow (`sprint-fin`) solo perdió el filtro de plantilla (ahora excluye `resumen-inicio`); conserva los 63 nodos y toda la lógica de horas por Calendar/Gemini, ya que sigue aplicando a `Tiempo verbal=Pasado`.

## Pendientes de wiring (backend ya listo, n8n todavía no lo rellena)

- **KPI de horas adicional en `resumen-v2`** (`horas.segmentos[].horasPlaneadas`): falta el paso que busca la fila `resumen-inicio` del mismo Ciclo+weekNumber y copia/recalcula el valor planeado de Proyectos antes de `Consolidar Payload Final del Sprint1`. Sin ese wiring el KPI simplemente no aparece (comportamiento seguro).
- **Desviación de horas planeadas vs. reales por segmento**: falta poblar `horasPlaneadas` en cada segmento de `horas.segmentos` (documento y por miembro) con los valores fijos (3.5h reuniones + 3h incidencias por persona) + personalizaciones del Sheet + Proyectos = capacidad − resto. Sin wiring, la tarjeta cae al formato anterior (solo horas reales).
- **`resumen-v3` — tendencia/proyección**: falta el paso que llama a `POST /api/sprint-fin/historico` cuando un sprint de verdad cierra (deliberadamente separado de `/pdf`, no se registra en cada regeneración/prueba). Sin wiring, `resumen-v3` funciona pero la sección de tendencia nunca aparece.

## Referencias

- Plan técnico original (AI Agent, registro histórico): `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`
- Auditoría del plan original: `docs/planning/AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`
- Decisión de arquitectura (extracción determinística): `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md`
- Alto de PDF auto-ajustable: `docs/adr/0007-altura-de-pdf-tambien-se-achica-no-solo-crece.md`
- Decisión de partir el backend en `sprint-inicio`/`sprint-fin` + reintento de extracción: `docs/adr/0008-particion-sprint-inicio-fin-y-reintento-de-extraccion.md`
- Análisis detrás de `resumen-v3`: `docs/planning/ANALISIS_INFORME_EJECUTIVO_SPRINT_RESUMEN_V2.md`
- Casos borde compartidos con el flujo manual: `docs/BUSINESS_FLOWS.md`, Flujo 4 (Caso borde A: `sprint-fin` todavía sin `.min()`/reintento, a diferencia de `sprint-inicio`)
- Contrato de datos: `backend/src/documents/sprint-fin/config.ts`
