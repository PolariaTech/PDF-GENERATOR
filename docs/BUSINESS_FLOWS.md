# Flujos de negocio end-to-end — Polaria PDF Generator

> Documento de negocio, no de arquitectura. Pensado para que cualquier persona del equipo (operaciones, producto, ingeniería) pueda leerlo sin necesitar el código. Cuando un flujo depende de un archivo concreto, se referencia entre paréntesis para quien quiera verificarlo, pero la narrativa no asume que el lector abra ese archivo.
>
> Grounding: código leído para este documento — `backend/src/api/document.routes.ts`, `frontend/index.html`, `backend/src/documents/sprint-inicio/config.ts`, `backend/src/documents/sprint-fin/config.ts`, `backend/src/documents/epica/config.ts`, `backend/src/core/generators/pdf.generator.ts`, `backend/src/core/ai/extractor.service.ts`, `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`, `docs/planning/AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`.

---

## Índice de flujos

| # | Flujo | Prioridad | Estado |
|---|---|---|---|
| 1 | Generación manual de un PDF desde el frontend | Principal | Construido |
| 2 | Selección de tipo de documento y plantilla | Configuración | Construido |
| 3 | Generación automática de PDF de sprint desde Linear (n8n) | Automatización | Construido, partido en 2 workflows (inicio/fin) el 2026-07-25 — ver `docs/WORKFLOWS/` |
| 4 | Casos borde compartidos entre el flujo manual y el plan de n8n | Casos borde | Aplican hoy, algunos sin mitigación |
| 5 | Generación automática de PDF de épica (n8n) | Automatización | Construido, partido en 2 workflows (inicio/fin) el 2026-07-25 — ver `docs/WORKFLOWS/` |

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
| Variante del flujo principal | `epica` tiene dos plantillas (`default` de inicio, `cierre`); `sprint` tiene cinco (`detail` default, `resumen-inicio`, `resumen`, `resumen-v2`, `resumen-v3`) — el selector de plantillas solo aparece si `DOCUMENTS[docType].templates` existe. |
| Combinación con otro flujo | Cada plantilla de `sprint` tiene su propio tamaño de página de referencia (`detail` 900×1188px, las otras cuatro 1240×1050px) — el alto real ya no respeta ese valor como mínimo: crece si el contenido no entra y se achica si sobra espacio, según el contenido real (ver `pdf.generator.ts` y `docs/adr/0007-altura-de-pdf-tambien-se-achica-no-solo-crece.md`); el ancho sí es fijo por plantilla y no configurable desde la UI. |

### Reglas de negocio que aplican
- `plantilla` es opcional en todos los endpoints; si falta o no coincide con ninguna clave registrada, el sistema usa siempre `config.defaultTemplate` del tipo de documento — nunca falla por una plantilla desconocida.
- La extracción por IA (`POST /extraer`) es **la misma sin importar la plantilla elegida**: el schema que fuerza la respuesta de OpenAI es uno solo por tipo de documento, no por plantilla. La plantilla solo afecta preview/pdf.
- Agregar una plantilla nueva a un tipo existente requiere tocar tres lugares en paralelo (no automatizado): el archivo `.html`, la entrada en `config.templates` del backend, y el array `templates` en `DOCUMENTS` del frontend — si se olvida el tercero, la plantilla funciona vía API pero nunca aparece como opción en la UI.

---

## Flujo 3 — Generación automática de PDF de sprint desde Linear (n8n)

**Documentación movida a `docs/WORKFLOWS/`** (separada de este documento porque asume que quien la lee va a operar n8n directamente, no solo entender el negocio): [sprint-inicio.md](WORKFLOWS/sprint-inicio.md) y [sprint-fin.md](WORKFLOWS/sprint-fin.md).

Resumen: un ciclo (sprint) en Linear se convierte en un PDF sin que nadie copie datos a un Markdown ni edite el JSON a mano — extracción determinística (sin AI Agent, ver ADR-0006), partida el 2026-07-25 en dos workflows según el momento del ciclo (arranque vs. cierre). El plan técnico original y su auditoría quedan como registro histórico en `docs/planning/`.

---

## Flujo 4 — Casos borde compartidos entre el flujo manual y el plan de n8n

Los casos A y B fueron identificados durante la auditoría del plan de n8n (`docs/planning/AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`), y **no son exclusivos de la automatización**: aplican igual de hoy, ahora mismo, en el Flujo 1 (manual), porque ambos flujos terminan validando contra el mismo `SprintSchema` y llamando al mismo backend. El caso C se encontró después, trabajando directamente en el Flujo 3.

### Caso borde A — El JSON no cumple los rangos de caracteres exactos que pide el prompt

**Qué se documentó en el plan de n8n:** el `SPRINT_SYSTEM_PROMPT` le pide a la IA, por ejemplo, que `members[].objetivo` tenga *exactamente* entre 480 y 500 caracteres, o que `equipo.quien` tenga entre 60 y 90. El plan de n8n originalmente asumía que podía "validar contra el schema" para atrapar un JSON fuera de esos rangos — la auditoría encontró que eso es imposible: **`SprintSchema` (Zod) solo define un máximo (`.max()`) en esos campos, nunca un mínimo.** `objetivo` acepta hasta 600 caracteres pero no exige ningún piso; lo mismo para `equipo.*` (máx. 150), `riesgoTransversal.*`/`desviaciones.*` (máx. 320/200).

**Por qué esto aplica igual al flujo manual (Flujo 1):** el schema que valida `POST /preview` y `POST /pdf` es el mismo, sin importar si el JSON lo escribió la IA o lo editó una persona a mano en el textarea del frontend. Hoy, un usuario puede escribir un `objetivo` de 10 caracteres para un miembro del sprint, y tanto el preview como el PDF se generan sin ningún error — el `safeParse` pasa porque 10 caracteres está por debajo del máximo de 600. El resultado es una tarjeta visualmente desbalanceada (mucho más corta que las demás) sin que el sistema avise nada; es un problema de diseño/homogeneidad visual, no de datos inválidos según el schema actual.

**Qué hace el sistema hoy (actualizado 2026-07-25, ver ADR-0008):** ya no es igual en los dos `docType` de sprint. **`sprint-inicio`** sí tiene `.min()` real (con margen de tolerancia sobre el rango exacto del prompt, ej. `objetivo` 450-520 en vez de 480-500 justo) y un reintento en `extractor.service.ts` (hasta 3, reenvía el markdown con el motivo exacto del fallo) — resuelto para ese `docType`. **`sprint-fin`** sigue exactamente como se describe arriba: solo `.max()`, sin `.min()`, sin reintento — este caso borde sigue aplicando ahí sin ninguna mitigación, igual que en el flujo manual cuando se edita un JSON de `sprint-fin` a mano. El reintento de `extractor.service.ts` es genérico por `docType` (no específico de `sprint-inicio`), así que aplicar el mismo `.min()` a `SprintSchema` de `sprint-fin` heredaría la misma protección sin trabajo adicional de infraestructura — pendiente, no hecho todavía.

### Caso borde B — El render supera el timeout de 15 segundos del backend

**Qué se documentó en el plan de n8n:** el plan original asumía que se podía configurar un timeout "generoso" en el nodo HTTP Request de n8n para darle más margen al render. La auditoría encontró que eso no tiene ningún efecto: `RENDER_TIMEOUT_MS = 15_000` en `backend/src/core/generators/pdf.generator.ts` es un límite duro del lado del backend, aplicado tanto a la carga del HTML (`page.setContent`) como a la generación del PDF (`page.pdf()`), y no es configurable desde quien llama al endpoint.

**Por qué esto aplica igual al flujo manual (Flujo 1):** cualquier persona que use el frontend hoy y genere un PDF de `sprint`/`detail` con muchos issues (o que use el frontend justo cuando ya hay otros 4 renders concurrentes ocupando la cola compartida, `MAX_CONCURRENT_RENDERS = 4`) puede pegarle al mismo límite de 15 segundos. El backend responde `500 INTERNAL_ERROR` exactamente igual que le respondería a n8n.

**Qué ve el usuario/operador en cada flujo:**
- Flujo manual: el usuario ve el mensaje genérico "Error al generar el PDF." en la UI (ver la nota de mensajes de error del Flujo 1) y puede reintentar de inmediato — no hay cola visible ni indicación de que el límite fue un timeout de render.
- Flujo n8n (planeado): el plan trata esto explícitamente como un fallo esperado, no como un bug: la rama de error del nodo 8 debe distinguir un `500` del backend de una respuesta PDF válida (ver Hallazgo crítico #1 de la auditoría — sin esa rama, un JSON de error podría subirse a Drive disfrazado de PDF) y notificar al equipo en vez de reintentar ciegamente con un timeout más largo.

**Qué hace el sistema hoy:** en ambos flujos, superar los 15 segundos siempre termina en un `500 INTERNAL_ERROR` sin reintento automático del lado del backend. Ni el flujo manual ni el plan de n8n cambian ese límite — solo cambia cómo reacciona cada uno ante ese mismo fallo.

### Caso borde C — El LLM no cuenta bien sobre su propia lista de issues

**Qué se encontró (2026-07-22, `riesgoTransversalResultado` de `resumen-v2`):** el `SPRINT_SYSTEM_PROMPT` le pedía al modelo que, al redactar ese campo, contara cuántos issues planeados/agregados había en total y cuántos de cada grupo se habían completado, citando esas cifras en la narrativa. Confirmado con datos reales de una ejecución (`get_execution` sobre `rqkqaSiaFq0eK7lU`): el modelo escribió "el equipo completo 20 de los 20 issues planeados" cuando la lista de issues que él mismo acababa de extraer tenía solo 15 planeados + 1 agregado. El modelo no es confiable contando/sumando sobre una lista estructurada que generó en la misma respuesta — el mismo tipo de falla que el Caso borde A (rangos de caracteres), pero para aritmética en vez de longitud de texto.

**Por qué esto puede aplicar a cualquier campo narrativo futuro que necesite citar una cifra derivada de datos ya extraídos:** cualquier instrucción de prompt del tipo "cuenta X e Y y menciónalo en la narrativa" es candidata a este mismo problema, no es exclusivo de este campo.

**Qué hace el sistema hoy:** se le quitó al LLM la responsabilidad de contar. `riesgoTransversalResultado` ahora solo lleva la parte cualitativa (si entraron o no incidencias que consumieran el colchón reservado) redactada por el LLM; `componerDatosSprint()` (`backend/src/documents/sprint-fin/config.ts`) calcula las cifras reales filtrando la lista de issues ya extraída (`planeadosCompletados`, `planeadosTotal`, `agregadosTotalCount`, `agregadosCompletados`) y arma la frase numérica de forma determinística (con singular/plural correcto y "completó todos los N" cuando aplica), concatenándola después de la frase del LLM antes de renderizar. **Regla general para cualquier documento nuevo:** si un campo narrativo necesita citar un número derivado de datos estructurados que ya están en el schema (conteos, porcentajes, sumas), calcularlo en el paso `componerDatos()` correspondiente en vez de pedírselo al LLM — el mismo criterio que ya aplicaba para `porcentajeCompletado`/`estadoSprint`/KPIs, extendido a texto narrativo con números incrustados.

---

## Flujo 5 — Generación automática de PDF de épica (n8n)

Documentación movida a `docs/WORKFLOWS/` (separada de este documento porque asume que quien la lee va a operar n8n directamente): [epica-inicio.md](WORKFLOWS/epica-inicio.md) y [epica-fin.md](WORKFLOWS/epica-fin.md).

Resumen: un PDF de planning de épica subido a Drive dispara la generación del resumen de arranque (`epica-inicio`, construido 2026-07-17); el cierre (`epica-fin`, construido 2026-07-25) no depende de un segundo documento sino que consulta Linear directamente (Initiative → Projects → Cycles) para calcular en código si cada época cumplió su ciclo de sprints.

---

## Referencias
- Documentación operativa de los 4 workflows de n8n (uno por documento, con IDs, nodos y casos de error): `docs/WORKFLOWS/`
- Plan técnico original de la automatización de sprint (AI Agent, registro histórico): `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`
- Auditoría del plan original (hallazgos por severidad + plan de acción priorizado): `docs/planning/AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`
- Decisión de arquitectura vigente (extracción determinística en vez de AI Agent): `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md`
- Mecanismo de alto auto-ajustable del PDF (crece y se achica según el contenido real): `docs/adr/0007-altura-de-pdf-tambien-se-achica-no-solo-crece.md`
- Contrato de datos de cada tipo de documento: `backend/src/documents/epica/config.ts`, `backend/src/documents/sprint-inicio/config.ts`, `backend/src/documents/sprint-fin/config.ts`
- Workflows de n8n: sprint-inicio `rqkqaSiaFq0eK7lU`, sprint-fin `ZdUWttXimeb9fKTN`, epica-inicio `jRYd4dDes9Eh0rO3`, epica-fin `sMMCR1cijPY1IFxt`
- Fuentes externas de datos personales usadas por sprint-fin (2026-07-22): feriados de Colombia vía `date.nager.at` (API pública, sin credencial), Google Calendar de los 3 miembros del equipo, notas de reunión de Gemini en Drive (carpeta `1CMDwbThDpqLrC-aIOuiHrDi5A_o1abCq`) — ver `docs/COMPLIANCE.md` para la nota de datos personales que esto agrega
- Rutas y forma de los errores de la API: `backend/src/api/document.routes.ts`
- Motor de render y sus límites (timeout, concurrencia, alto auto-ajustable): `backend/src/core/generators/pdf.generator.ts`
