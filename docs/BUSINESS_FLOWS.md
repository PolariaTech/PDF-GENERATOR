# Flujos de negocio end-to-end — Polaria PDF Generator

> Documento de negocio, no de arquitectura. Pensado para que cualquier persona del equipo (operaciones, producto, ingeniería) pueda leerlo sin necesitar el código. Cuando un flujo depende de un archivo concreto, se referencia entre paréntesis para quien quiera verificarlo, pero la narrativa no asume que el lector abra ese archivo.
>
> Grounding: código leído para este documento — `backend/src/api/document.routes.ts`, `frontend/index.html`, `backend/src/documents/sprint/config.ts`, `backend/src/documents/epica/config.ts`, `backend/src/core/generators/pdf.generator.ts`, `backend/src/core/ai/extractor.service.ts`, `PLAN-N8N-SPRINT-WORKFLOW.md`, `AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`.

---

## Índice de flujos

| # | Flujo | Prioridad | Estado |
|---|---|---|---|
| 1 | Generación manual de un PDF desde el frontend | Principal | Construido |
| 2 | Selección de tipo de documento y plantilla | Configuración | Construido |
| 3 | Generación automática de PDF de sprint desde Linear (n8n) | Automatización | Construido (extracción determinística) — pilot real corrido con éxito (2026-07-15) |
| 4 | Casos borde compartidos entre el flujo manual y el plan de n8n | Casos borde | Aplican hoy, algunos sin mitigación |

---

## Flujo 1 — Generación manual de un PDF desde el frontend

### Nombre del flujo
Generación manual de un PDF de Épica o Sprint a partir de un Markdown, vía el frontend.

### Objetivo del flujo
Estado inicial → estado final: **Un archivo `.md` con el contenido de una épica mensual o de un sprint** → **un PDF con el diseño oficial de Polaria, descargado en el navegador del usuario**, revisado y corregido por una persona en el camino.

### Actores involucrados
| Actor | Rol en este flujo |
|---|---|
| Usuario | Sube el `.md`, revisa/edita el JSON extraído, dispara la vista previa y la descarga final |
| Frontend (`frontend/index.html`) | Único archivo HTML/JS que orquesta los 4 pasos visibles ("Subir documento" → "Revisar y corregir" → "Vista previa" → descarga) |
| Backend / API (`document.routes.ts`) | Valida cada request contra el schema del tipo de documento, orquesta la extracción con IA y la generación de HTML/PDF |
| OpenAI (GPT-4o-mini) | Convierte el Markdown libre en un JSON estructurado que cumple el schema (Épica o Sprint) |
| Motor de render (Playwright/Chromium headless) | Convierte el HTML final en el binario PDF |

### Precondiciones
- El backend está corriendo y accesible desde el navegador (`http://localhost:3001` en desarrollo, o el `origin` del sitio si el frontend no se abre como `file://`).
- El usuario tiene un archivo `.md` con contenido no vacío que describe una épica mensual o un sprint.
- Existe una `OPENAI_API_KEY` válida configurada en `backend/.env` (si falta o es inválida, el paso de extracción falla — ver Casos de error).
- El usuario ya eligió el tipo de documento (`epica` o `sprint`) — ver Flujo 2, que es precondición implícita de este.

### Pasos del flujo

| # | Actor | Acción | Estado del sistema |
|---|---|---|---|
| 1 | Usuario | Arrastra o selecciona un archivo `.md` en la zona de carga | Frontend valida la extensión localmente; si termina en `.md`, habilita el botón "Extraer datos con IA" y muestra el nombre del archivo |
| 2 | Usuario | Hace clic en "Extraer datos con IA" | Frontend arma un `FormData` con el archivo (campo `archivo`) y envía `POST /api/:docType/extraer`; muestra el spinner "Extrayendo..." |
| 3 | Backend | Recibe el archivo, valida que no venga vacío | Si pasa, lee el contenido como texto UTF-8 y lo pasa al extractor de IA |
| 4 | OpenAI | Recibe el Markdown + el prompt del tipo de documento (`EPICA_SYSTEM_PROMPT` o `SPRINT_SYSTEM_PROMPT`), fuerza la respuesta a cumplir el schema Zod del documento | Devuelve un JSON estructurado más el conteo de tokens usados |
| 5 | Backend | Responde `{ success: true, datos, uso }` | — |
| 6 | Frontend | Rellena el editor de texto con el JSON recibido (formateado), muestra el costo/tokens estimados, y dispara automáticamente una vista previa | El panel "Revisar y corregir" queda visible |
| 7 | Usuario | Lee el JSON en el editor y corrige a mano lo que la IA extrajo mal (nombres, fechas, textos que no cayeron en el rango de caracteres esperado, etc.) | Solo cambia el estado en el navegador del usuario; nada se envía todavía |
| 8 | Usuario | Hace clic en "Actualizar vista previa" (o cambia de plantilla, ver Flujo 2) | Frontend parsea el JSON del editor y envía `POST /api/:docType/preview` con `{ datos, plantilla }` |
| 9 | Backend | Valida el JSON contra el schema Zod del documento; si es válido, enriquece los datos (colores, agregados, porcentajes) y renderiza la plantilla Handlebars correspondiente | Responde el HTML completo como texto plano |
| 10 | Frontend | Inyecta el HTML recibido dentro de un `<iframe>` y lo escala para que quepa en el ancho visible | Usuario ve la vista previa fiel al PDF final |
| 11 | Usuario | Hace clic en "Descargar PDF" | Frontend vuelve a parsear el JSON del editor y envía `POST /api/:docType/pdf` con el mismo body que el preview |
| 12 | Backend | Valida el JSON de nuevo (independiente del preview — no hay estado compartido entre requests), enriquece los datos y lanza Chromium headless para renderizar el PDF | Responde el binario con `Content-Type: application/pdf` y `Content-Disposition: attachment` |
| 13 | Frontend | Convierte la respuesta en un blob y dispara la descarga automática en el navegador | El usuario tiene el PDF en su carpeta de descargas |

### Postcondiciones
- El usuario tiene el PDF descargado en su equipo.
- El sistema **no persiste nada**: no hay base de datos en este proyecto. Si el usuario recarga la página, todo el progreso (archivo subido, JSON editado) se pierde y hay que empezar de nuevo.
- Cada uno de los tres endpoints (`extraer`, `preview`, `pdf`) es independiente y sin memoria: `preview` y `pdf` validan el mismo JSON por separado: es posible que un preview haya funcionado y el PDF falle si, entre medio, el usuario rompió el JSON en el editor.

### Casos de error

| Paso | Qué puede salir mal | Qué ve el usuario | Qué hace el sistema |
|---|---|---|---|
| 1 | El archivo no termina en `.md` | Mensaje "Solo se aceptan archivos .md" bajo la zona de carga | Rechazo 100% local, nunca llega al backend |
| 2-3 | No llega ningún archivo en el campo `archivo` | Mensaje genérico de error (ver nota de mensajes abajo) | Backend responde `400 BAD_REQUEST` ("No se recibio ningun archivo .md.") |
| 3 | El archivo llega vacío (`markdown.trim()` vacío) | Mensaje genérico de error | Backend responde `400 BAD_REQUEST` ("El archivo esta vacio.") |
| 4 | OpenAI no devuelve un JSON parseable contra el schema, la API key es inválida, o hay un problema de red con OpenAI | Mensaje genérico de error | Backend captura la excepción, hace `console.error` con el `docType` y el detalle real, y responde `500 INTERNAL_ERROR` ("Error al extraer datos.") — el detalle nunca llega al navegador |
| 4 | OpenAI tarda más de 60s o falla de forma transitoria (429/5xx) | Igual que arriba, pero después de hasta 1 reintento automático del SDK de OpenAI (`maxRetries: 1`, `timeout: 60_000` en `extractor.service.ts`) | Mismo camino: 500 tras agotar los reintentos |
| 8-9 (preview) / 11-12 (pdf) | El JSON editado a mano no cumple el schema (falta un campo requerido, un array vacío donde se exige al menos 1 elemento, un tipo de dato incorrecto) | Mensaje genérico de error (ver nota abajo) | Backend responde `400 VALIDATION_ERROR` con el detalle exacto de qué campo falló (`zodError.flatten()`) en el campo `details` de la respuesta — pero el frontend actual no muestra ese detalle (ver nota) |
| 7 (antes de enviar) | El usuario rompe la sintaxis del JSON en el editor (llave sin cerrar, coma de más) | "JSON invalido: `<mensaje de JSON.parse>`" | Se detecta 100% en el navegador (`JSON.parse`), nunca llega al backend |
| 12 | El render tarda más de 15 segundos (`RENDER_TIMEOUT_MS` en `pdf.generator.ts`) — típico en `sprint`/`detail` con muchos issues, o si las fuentes externas (Google Fonts, Tabler Icons) tardan en cargar | Mensaje genérico de error | Backend responde `500 INTERNAL_ERROR` ("Error al generar PDF.") |
| 12 | Ya hay 4 renders en curso en simultáneo (frontend + cualquier otro consumidor del backend, límite `MAX_CONCURRENT_RENDERS = 4`) | El usuario espera más de lo normal sin ningún mensaje de "en cola" | El request queda en una cola interna hasta que se libera un slot; no hay timeout de espera en cola, solo el de 15s una vez que el render arranca |
| 13 | La respuesta del `pdf` no es exitosa o no es realmente un PDF | Mensaje genérico de error | El frontend chequea `res.ok` y el `Content-Type`; si alguno falla, muestra un error en vez de intentar descargar basura |

**Nota sobre los mensajes de error mostrados al usuario:** el backend responde siempre `{ success: false, code, message, details }` (`document.routes.ts`). `responseError()` en `frontend/index.html` lee ese `message` y lo muestra en la UI (corregido — antes buscaba un campo `details.error` que el backend nunca envió, y el usuario solo veía el texto genérico de fallback). El detalle de qué campo del JSON falló (`details` con el `zodError.flatten()`) sigue sin mostrarse en la UI — solo es visible revisando la consola de red del navegador o los logs del servidor.

### Casos borde

| Tipo | Qué documentar |
|---|---|
| Variante — edición sin extracción por IA (solo `sprint`) | Para el tipo `sprint`, el panel "Revisar y corregir" se muestra siempre, incluso sin haber subido ni extraído ningún archivo (`resetOutput()` en `frontend/index.html`). Un usuario puede escribir/pegar el JSON de un sprint directamente en el editor y generar preview/PDF sin pasar nunca por `POST /extraer` ni por OpenAI. Para `epica` esto no aplica: el panel de edición permanece oculto hasta que exista un JSON extraído. |
| Variante del flujo principal | Cambiar de plantilla (ver Flujo 2) con el editor ya lleno de un JSON editado: el frontend no descarta el JSON, solo vuelve a pedir preview con la plantilla nueva (`setSelectedTemplate()`). |
| Combinación con otro flujo | Cambiar de tipo de documento (`epica` ↔ `sprint`) a mitad de edición dispara `resetOutput()`, que **vacía el editor sin confirmación** y recarga el preview de ejemplo del nuevo tipo. Cualquier corrección manual no copiada aparte se pierde silenciosamente. |
| Caso de error recuperable | Un rechazo de validación (`VALIDATION_ERROR`) o un JSON roto no bloquea el flujo: el usuario sigue editando en el mismo textarea y puede reintentar preview/pdf cuantas veces quiera. |
| Caso de error no recuperable | Un fallo de OpenAI (API key inválida, cuota agotada) detiene el flujo en el paso 4: no hay forma de continuar sin resolver la causa fuera de la UI (revisar `.env`, la cuenta de OpenAI, etc.). |

### Reglas de negocio que aplican
- El schema de cada tipo de documento (`EpicaSchema`, `SprintSchema`) es el único contrato válido: preview y PDF rechazan cualquier JSON que no lo cumpla, sin excepción, sin importar si vino de la IA o de edición manual.
- La extracción por IA nunca decide qué plantilla se usa — eso es independiente (ver Flujo 2) y se puede cambiar después de extraer sin volver a llamar a OpenAI.
- `epica` no tiene bloque de horas editable: siempre usa `HORAS_FIJAS` de `backend/src/constants.ts`, sin importar lo que diga el Markdown. `sprint` sí lo extrae/edita vía el campo `horas.segmentos` del JSON.

---

## Flujo 2 — Selección de tipo de documento y plantilla

### Nombre del flujo
Configuración de tipo de documento (`docType`) y plantilla (`plantilla`) antes de generar cualquier vista previa o PDF.

### Objetivo del flujo
Estado inicial → estado final: **Ningún tipo de documento fijado (la página carga con `epica` por defecto)** → **un par `(docType, plantilla)` concreto que determina qué schema, qué prompt de IA y qué plantilla HTML gobiernan todo el resto del flujo**, sin tocar código.

### Actores involucrados
| Actor | Rol en este flujo |
|---|---|
| Usuario | Elige la tab de tipo de documento y, si aplica, la tab de plantilla |
| Frontend | Mantiene el objeto `DOCUMENTS` (labels, copy y lista de plantillas por tipo) y decide qué tabs mostrar |
| Backend (`registry.ts` + `config.templates`/`defaultTemplate` de cada tipo) | Resuelve qué archivo `.html` y qué tamaño de página (`pdf.width`/`pdf.height`) corresponden a la plantilla pedida |

### Precondiciones
- El tipo de documento debe existir en el objeto `DOCUMENTS` del frontend **y** estar registrado en el backend (`backend/src/documents/registry.ts`); hoy son `epica` y `sprint`.
- Si el tipo tiene más de una plantilla, debe declarar un array `templates: [{ key, label }, ...]` en `DOCUMENTS` (frontend) que refleje las claves reales de `config.templates` (backend) — son dos listas mantenidas a mano, no una fuente única.

### Pasos del flujo

| # | Actor | Acción | Estado del sistema |
|---|---|---|---|
| 1 | Usuario | Hace clic en la tab "Epica" o "Sprint" | Frontend actualiza título, descripción y textos de ayuda de la página según `DOCUMENTS[docType]` |
| 2 | Frontend | Revisa si `DOCUMENTS[docType].templates` existe | Si existe (hoy solo `sprint`), muestra el selector "Plantilla" con una tab por entrada y selecciona la primera (`detail`) por defecto; si no existe (hoy `epica`), oculta el selector |
| 3 | Frontend | Limpia el editor y pide un ejemplo | Envía `GET /api/:docType/sample-preview?plantilla=<key o vacío>` |
| 4 | Backend | Busca la configuración del `docType` en el registry | Si no existe, responde `404 NOT_FOUND` |
| 5 | Backend | Toma los datos de ejemplo de ese tipo (`sample-data.ts`), los valida contra el schema y los enriquece (`componerDatos`) | — |
| 6 | Backend | Resuelve la plantilla: si la `plantilla` recibida coincide con una clave de `config.templates`, la usa; si no coincide o no se envió, cae en `config.defaultTemplate` **sin avisar** | Renderiza el HTML con esa plantilla |
| 7 | Backend | Responde el HTML de ejemplo | Frontend lo muestra en el iframe de vista previa |
| 8 | Usuario | (Opcional, solo si el tipo tiene plantillas) Hace clic en otra tab de plantilla, p. ej. pasar de "Detalle" a "Resumen fin v2" | Frontend guarda la nueva `plantilla` seleccionada y vuelve a pedir preview: con el JSON del editor si ya hay uno cargado, o con el sample-preview si el editor está vacío |

### Postcondiciones
- El par `(docType, plantilla)` queda fijado en el estado del frontend (`selectedDocType`, `selectedTemplate`) y viaja en cada llamada subsiguiente a `preview`/`pdf` hasta que el usuario lo cambie de nuevo.
- Cambiar de plantilla **no** vuelve a llamar a OpenAI ni pierde el JSON ya editado — solo cambia qué archivo `.html` se usa para renderizarlo.

### Casos de error
| Qué puede salir mal | Qué ve el usuario/operador | Qué hace el sistema |
|---|---|---|
| Se pide un `docType` no registrado (solo posible llamando la API directamente, no desde la UI) | Respuesta `404 NOT_FOUND` | `getConfigOrRespond()` corta antes de tocar nada más |
| Se pide una `plantilla` que no existe en `config.templates` (solo posible llamando la API directamente — la UI solo ofrece claves válidas) | **No hay error**: el backend cae en `defaultTemplate` sin ninguna señal de que la plantilla pedida no existía | Riesgo documentado también en el plan de n8n (Flujo 3/4): un typo en la plantilla genera el documento equivocado en silencio |

### Casos borde
| Tipo | Qué documentar |
|---|---|
| Variante del flujo principal | `epica` tiene una sola plantilla (`default`, sin selector visible); `sprint` tiene cuatro (`detail` default, `resumen-inicio`, `resumen`, `resumen-v2`) — el selector de plantillas solo aparece si `DOCUMENTS[docType].templates` existe. |
| Combinación con otro flujo | Cada plantilla de `sprint` tiene su propio tamaño de página de referencia (`detail` 900×1188px, las otras tres 1240×1050px) — el alto real ya no respeta ese valor como mínimo: crece si el contenido no entra y se achica si sobra espacio, según el contenido real (ver `pdf.generator.ts` y `docs/adr/0007-altura-de-pdf-tambien-se-achica-no-solo-crece.md`); el ancho sí es fijo por plantilla y no configurable desde la UI. |

### Reglas de negocio que aplican
- `plantilla` es opcional en todos los endpoints; si falta o no coincide con ninguna clave registrada, el sistema usa siempre `config.defaultTemplate` del tipo de documento — nunca falla por una plantilla desconocida.
- La extracción por IA (`POST /extraer`) es **la misma sin importar la plantilla elegida**: el schema que fuerza la respuesta de OpenAI es uno solo por tipo de documento, no por plantilla. La plantilla solo afecta preview/pdf.
- Agregar una plantilla nueva a un tipo existente requiere tocar tres lugares en paralelo (no automatizado): el archivo `.html`, la entrada en `config.templates` del backend, y el array `templates` en `DOCUMENTS` del frontend — si se olvida el tercero, la plantilla funciona vía API pero nunca aparece como opción en la UI.

---

## Flujo 3 — Generación automática de PDF de sprint desde Linear (n8n)

### Nombre del flujo
Generación automática de punta a punta de un PDF de Sprint desde un ciclo de Linear, sin edición manual del JSON, mediante un workflow de n8n.

### Estado actual
**Construido y con pilot real corrido con éxito (2026-07-15).** El plan original (AI Agent multi-turno con 3 tools sobre Linear) vive en `PLAN-N8N-SPRINT-WORKFLOW.md` y su auditoría en `AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md` — ambos documentos quedan como registro histórico del diseño inicial. Durante la construcción real se cambió esa pieza central por extracción determinística (ver `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md`): el AI Agent fallaba de forma dura (crash de ejecución) cuando el parser estructurado no podía interpretar su salida, y los campos que alimentan KPIs de liderazgo (`agregado`, `type`, `priority`, `status`) no tenían por qué depender de un LLM cuando son aritmética/comparación de fechas pura.

**Cambios posteriores al pilot inicial** (detalle completo en ADR-0006 y ADR-0007):
- El nodo que validaba los rangos de caracteres del texto narrativo y reintentaba `/extraer` una vez ante un fallo fue **eliminado** del workflow. Hoy no hay reintento ni validación de rangos en n8n — el paso `Consolidar Payload Final del Sprint` sigue pisando los campos calculables de forma determinística, pero ya no valida el texto que redacta el LLM.
- El nombre del PDF subido a Drive ahora depende de la plantilla (`RESUMEN_INICIO_SPRINT_<N>_<MES-MES_AÑO>.PDF`, `RESUMEN_FINAL_...`, `DETAIL_...`, todo en mayúsculas), con autoincremento (`_1`, `_2`, ...) si ya existe un archivo con ese nombre en la subcarpeta del sprint — antes el nombre incluía un timestamp y no distinguía por plantilla.
- La fila de la Sheet se marca como procesada matcheando por `Ciclo (nombre en Linear)` + `weekNumber`, no por el número de fila (`row_number`) — matchear por posición de fila resultaba en 0 filas actualizadas en la práctica.
- El alto del PDF generado ahora también se achica cuando el contenido real es menor al alto de diseño de la plantilla, no solo crece (ver ADR-0007) — afecta a los 4 tipos de plantilla de `sprint`, no solo a la generación vía n8n.

Hoy conviven dos workflows en n8n:
- **`Sprint - Generar Resumen PDF con Extracción Determinística - Google Drive`** (id `rqkqaSiaFq0eK7lU`) — arquitectura vigente, descrita abajo. Con las 6 credenciales de sus nodos HTTP Request (3× `Linear Auth`, 3× `PDF Generator API`) asignadas manualmente por el operador desde la UI de n8n (2026-07-14), y pilot real corrido con éxito (2026-07-15).
- **`Sprint - Generar Resumen PDF - Google Drive`** (id `G8Fq2jaofpNAYCM9`, AI Agent) — arquitectura original, no archivada todavía. Pendiente decidir si se archiva ahora que el workflow determinístico ya corrió sin problemas (ver ADR-0006, notas de seguimiento).

### Objetivo del flujo
Estado inicial → estado final: **Un ciclo (sprint) cerrado o en curso en Linear, con una fila pendiente en la Google Sheet "Preguntas Skill"** → **un PDF de sprint generado y subido a Google Drive, con la fila marcada como procesada**, sin que nadie tenga que copiar datos de Linear a un Markdown ni editar el JSON a mano.

### Actores involucrados
| Actor | Rol en este flujo |
|---|---|
| Operador | Dispara el trigger manual en n8n (no hay trigger automático todavía) |
| n8n (orquestador) | Lee la Google Sheet, valida la fila, calcula las horas, consulta Linear con HTTP Request nodos planos, clasifica cada issue de forma determinística, consolida un Markdown, llama a `POST /api/sprint/extraer` y a `POST /api/sprint/pdf`, y sube el resultado a Drive |
| Linear (API GraphQL) | Fuente de verdad de los ciclos, issues y su historial — consultada con 3 llamadas HTTP directas (`Buscar Ciclo en Linear`, `Listar Issues del Ciclo`, `Obtener Historial de Issue` una vez por issue), sin ningún LLM de por medio |
| Backend — extracción (`POST /api/sprint/extraer`) | El mismo endpoint que usa el flujo manual (Flujo 1) para convertir Markdown en JSON estructurado vía OpenAI — aquí recibe el Markdown que n8n consolidó a partir de Linear, no uno escrito por una persona. Es el único punto del flujo que usa un LLM, acotado al texto narrativo (`objetivo`, `equipo`, `riesgoTransversal`, `desviaciones`) |
| Backend — PDF (mismo `POST /api/sprint/pdf` que usa el frontend manual) | Valida y genera el PDF — **no hay un backend paralelo para automatización**, es el mismo endpoint del Flujo 1 |
| Google Sheets ("Preguntas Skill") | Guarda la configuración de cada corrida (ciclo, festivos, horas, plantilla) y el resultado (link de Drive, timestamp, `Procesado`) |
| Google Drive | Destino final del PDF |

### Resumen del flujo en términos de negocio
1. Un operador dispara manualmente el workflow en n8n.
2. n8n toma la última fila pendiente (no procesada) de la Sheet de configuración de sprints.
3. n8n valida que esa fila tenga datos completos y coherentes (fechas, plantilla válida, etc.) antes de gastar ninguna llamada a Linear o al backend.
4. n8n calcula de forma determinística (sin LLM) las horas del equipo para ese sprint y el corte de fecha que separa "planeado" de "agregado".
5. n8n busca el ciclo en Linear por nombre exacto, lista todos sus issues, y para cada uno consulta su historial de cambios de ciclo — todo con llamadas HTTP directas, sin agente ni tool-calling.
6. n8n clasifica cada issue de forma determinística (`agregado`, `type`, `priority`, `status` — comparación de fechas y mapeo de valores, sin LLM) y consolida todo en un único Markdown estructurado, junto con `porcentajeCompletado`/`estadoSprint` ya calculados.
7. n8n envía ese Markdown a `POST /api/sprint/extraer` (el mismo endpoint que usa el flujo manual) para que redacte el texto narrativo (`objetivo` por miembro, `equipo`, `riesgoTransversal`, `desviaciones`) respetando los rangos de caracteres del prompt.
8. n8n **pisa** en la respuesta del LLM los campos ya calculados de forma determinística (`sprintName` sin la palabra "SPRINT" — las plantillas HTML ya la traen escrita, para que no quede duplicada —, fechas, `weekNumber`, `estadoSprint`, `porcentajeCompletado`, `horas`, `plantilla`) para que nunca dependan de lo que el LLM haya podido inferir. **No hay validación de rangos de caracteres ni reintento** (existieron hasta el pilot inicial; se eliminaron después — ver ADR-0006): si el texto narrativo queda fuera del rango que pide `SPRINT_SYSTEM_PROMPT`, el PDF se genera igual.
9. n8n llama al mismo endpoint que usa el frontend manual (`POST /api/sprint/pdf`), autenticado con una API key propia del backend.
10. n8n confirma que la respuesta sea realmente un PDF (y no un JSON de error) antes de subir nada a Drive.
11. n8n calcula el nombre del archivo según la plantilla (`RESUMEN_INICIO_...`, `RESUMEN_FINAL_...`, `DETAIL_...`, ver Postcondiciones), revisa si ya existe un archivo con ese nombre en la subcarpeta del sprint y le agrega un sufijo autoincremental (`_1`, `_2`, ...) si hace falta, antes de subirlo a Google Drive.
12. n8n marca la fila de origen como procesada (matcheando por `Ciclo (nombre en Linear)` + `weekNumber`, no por posición de fila), con el link del archivo y la fecha.

### Postcondiciones
- La fila de la Sheet queda marcada `Procesado = TRUE`, con el link de Drive y un timestamp — la fila se identifica por `Ciclo (nombre en Linear)` + `weekNumber`, no por su número de fila.
- El PDF queda disponible en la carpeta de Drive `Sprint PDFs`, en una subcarpeta por sprint (buscada por nombre exacto; creada si no existe), con un nombre determinístico según la plantilla usada: `RESUMEN_INICIO_SPRINT_<N>_<MES-MES_AÑO>.PDF` (`resumen-inicio`), `RESUMEN_FINAL_SPRINT_<N>_<MES-MES_AÑO>.PDF` (`resumen`/`resumen-v2`) o `DETAIL_SPRINT_<N>_<MES-MES_AÑO>.PDF` (`detail`), todo en mayúsculas; si ya existe un archivo con ese nombre, se le agrega `_1`, `_2`, etc.
- Queda un registro de auditoría de la corrida (workflow, timestamp, `sprintName`, éxito/fallo) en el Data Table de n8n `sprint_pdf_execution_log`.

### Casos de error y decisiones pendientes
No se repiten aquí en detalle. El diseño original y su auditoría (con hallazgos ya resueltos en la construcción real, como la rama IF que distingue un PDF válido de un JSON de error antes de subir a Drive) viven en `PLAN-N8N-SPRINT-WORKFLOW.md` y `AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`; el cambio de arquitectura (AI Agent → extracción determinística) y sus consecuencias viven en `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md`. Pendiente:
- Decidir si se archiva el workflow anterior basado en AI Agent, ahora que el pilot real del workflow determinístico ya corrió con éxito (2026-07-15).
- Decidir si se mantiene algún gate de confirmación humana antes de considerar un PDF automático como definitivo para liderazgo (mismo punto abierto que ya señalaba el plan original) — más relevante todavía ahora que no hay validación de rangos de caracteres antes de generar el PDF (ver punto siguiente).
- Evaluar si conviene reintroducir alguna validación mínima del texto narrativo (sin necesariamente el reintento automático que existía antes de eliminarse) — ver ADR-0006.

### Reglas de negocio que aplican
- El JSON final debe cumplir exactamente el mismo `SprintSchema` que valida hoy el flujo manual — no hay un schema paralelo para automatización.
- La única fuente de verdad para los rangos de caracteres del prompt es `SPRINT_SYSTEM_PROMPT` en `backend/src/documents/sprint/config.ts`, nunca el `SKILL.md` de la skill de Linear (que quedó desactualizado respecto al schema real) ni ninguna copia hardcodeada en n8n que no se actualice junto con `config.ts`. Hoy nada en n8n valida que el LLM efectivamente haya respetado esos rangos (ver Casos de error y decisiones pendientes).
- Los campos que se pueden calcular de forma determinística (fechas, horas, `agregado`, `type`, `priority`, `status`, `estadoSprint`, `porcentajeCompletado`, `plantilla`) nunca se dejan en manos del LLM, aunque el endpoint de extracción los devuelva — n8n los pisa siempre con el valor calculado.
- El endpoint que llama n8n (`/api/sprint/extraer` y `/api/sprint/pdf`) es el mismo que usa el frontend manual: cualquier cambio de contrato en cualquiera de los dos afecta ambos flujos a la vez.

---

## Flujo 4 — Casos borde compartidos entre el flujo manual y el plan de n8n

Estos dos casos fueron identificados durante la auditoría del plan de n8n (`AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`), pero **no son exclusivos de la automatización**: aplican igual de hoy, ahora mismo, en el Flujo 1 (manual), porque ambos flujos terminan validando contra el mismo `SprintSchema` y llamando al mismo backend.

### Caso borde A — El JSON no cumple los rangos de caracteres exactos que pide el prompt

**Qué se documentó en el plan de n8n:** el `SPRINT_SYSTEM_PROMPT` le pide a la IA, por ejemplo, que `members[].objetivo` tenga *exactamente* entre 480 y 500 caracteres, o que `equipo.quien` tenga entre 60 y 90. El plan de n8n originalmente asumía que podía "validar contra el schema" para atrapar un JSON fuera de esos rangos — la auditoría encontró que eso es imposible: **`SprintSchema` (Zod) solo define un máximo (`.max()`) en esos campos, nunca un mínimo.** `objetivo` acepta hasta 600 caracteres pero no exige ningún piso; lo mismo para `equipo.*` (máx. 150), `riesgoTransversal.*`/`desviaciones.*` (máx. 320/200).

**Por qué esto aplica igual al flujo manual (Flujo 1):** el schema que valida `POST /preview` y `POST /pdf` es el mismo, sin importar si el JSON lo escribió la IA o lo editó una persona a mano en el textarea del frontend. Hoy, un usuario puede escribir un `objetivo` de 10 caracteres para un miembro del sprint, y tanto el preview como el PDF se generan sin ningún error — el `safeParse` pasa porque 10 caracteres está por debajo del máximo de 600. El resultado es una tarjeta visualmente desbalanceada (mucho más corta que las demás) sin que el sistema avise nada; es un problema de diseño/homogeneidad visual, no de datos inválidos según el schema actual.

**Qué hace el sistema hoy:** nada, en ninguno de los dos flujos. El workflow de n8n sí llegó a tener esa validación implementada (un nodo intermedio antes de llamar al backend, hardcodeado contra los números reales de `config.ts`, con reintento único si fallaba) — se construyó, se probó, y funcionó durante el pilot inicial. Después del pilot se eliminó deliberadamente (ver `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md`, sección Estado), así que hoy este caso borde vuelve a aplicar sin ninguna mitigación en ningún flujo. Esa misma validación, si se implementara como un `.min()` en `SprintSchema`, protegería ambos flujos a la vez sin duplicar lógica ni depender de un nodo de n8n que puede volver a eliminarse.

### Caso borde B — El render supera el timeout de 15 segundos del backend

**Qué se documentó en el plan de n8n:** el plan original asumía que se podía configurar un timeout "generoso" en el nodo HTTP Request de n8n para darle más margen al render. La auditoría encontró que eso no tiene ningún efecto: `RENDER_TIMEOUT_MS = 15_000` en `backend/src/core/generators/pdf.generator.ts` es un límite duro del lado del backend, aplicado tanto a la carga del HTML (`page.setContent`) como a la generación del PDF (`page.pdf()`), y no es configurable desde quien llama al endpoint.

**Por qué esto aplica igual al flujo manual (Flujo 1):** cualquier persona que use el frontend hoy y genere un PDF de `sprint`/`detail` con muchos issues (o que use el frontend justo cuando ya hay otros 4 renders concurrentes ocupando la cola compartida, `MAX_CONCURRENT_RENDERS = 4`) puede pegarle al mismo límite de 15 segundos. El backend responde `500 INTERNAL_ERROR` exactamente igual que le respondería a n8n.

**Qué ve el usuario/operador en cada flujo:**
- Flujo manual: el usuario ve el mensaje genérico "Error al generar el PDF." en la UI (ver la nota de mensajes de error del Flujo 1) y puede reintentar de inmediato — no hay cola visible ni indicación de que el límite fue un timeout de render.
- Flujo n8n (planeado): el plan trata esto explícitamente como un fallo esperado, no como un bug: la rama de error del nodo 8 debe distinguir un `500` del backend de una respuesta PDF válida (ver Hallazgo crítico #1 de la auditoría — sin esa rama, un JSON de error podría subirse a Drive disfrazado de PDF) y notificar al equipo en vez de reintentar ciegamente con un timeout más largo.

**Qué hace el sistema hoy:** en ambos flujos, superar los 15 segundos siempre termina en un `500 INTERNAL_ERROR` sin reintento automático del lado del backend. Ni el flujo manual ni el plan de n8n cambian ese límite — solo cambia cómo reacciona cada uno ante ese mismo fallo.

---

## Referencias
- Plan técnico original de la automatización (AI Agent, registro histórico): `PLAN-N8N-SPRINT-WORKFLOW.md`
- Auditoría del plan original (hallazgos por severidad + plan de acción priorizado): `AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`
- Decisión de arquitectura vigente (extracción determinística en vez de AI Agent): `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md`
- Mecanismo de alto auto-ajustable del PDF (crece y se achica según el contenido real): `docs/adr/0007-altura-de-pdf-tambien-se-achica-no-solo-crece.md`
- Contrato de datos de cada tipo de documento: `backend/src/documents/epica/config.ts`, `backend/src/documents/sprint/config.ts`
- Rutas y forma de los errores de la API: `backend/src/api/document.routes.ts`
- Motor de render y sus límites (timeout, concurrencia, alto auto-ajustable): `backend/src/core/generators/pdf.generator.ts`
