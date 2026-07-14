# Onboarding — Polaria PDF Generator

Guía de recorrido para tu primer día en este repo. No es una referencia exhaustiva (para eso está `CLAUDE.md` y, cuando esté listo, `docs/architecture/README.md`): es el camino más corto para entender cómo entra un request y sale un PDF, y qué reglas no obvias hay que respetar antes de tocar código.

Todo lo que sigue está verificado leyendo el código fuente citado (rutas y números de línea aproximados a la fecha de escritura de este documento). Si algo cambió desde entonces, el código manda sobre este documento.

## 1. Qué leer primero (en este orden)

1. **`CLAUDE.md`** (raíz del repo) — 10-15 min. Es la fuente de verdad de arquitectura y convenciones para este repo; todo lo que sigue abajo es una expansión guiada de lo que ahí se resume en prosa.
2. **`docs/architecture/README.md`** — otro proceso lo está escribiendo en paralelo a este documento; a la fecha de escritura la carpeta `docs/architecture/` existe pero está vacía. Cuando esté disponible, léelo antes de seguir: da la vista de arquitectura de más alto nivel. Si todavía no existe cuando llegas aquí, sigue con este documento y vuelve a él después.
3. **`README.md`** (raíz) — cómo levantar el proyecto (`npm install`, `npm run dev`).
4. **Este documento** — el recorrido de una request real, punta a punta.
5. **El código de un `documents/<tipo>/` completo** (recomendado: `sprint/`, es el más rico) — una vez entendido el flujo genérico, este es el ejemplo real de cómo se usa.

No hay glosario de dominio, ADRs, ni CONTRIBUTING.md en el repo a la fecha de este documento — no se referencian aquí porque no existen todavía.

## 2. Qué es este sistema (una frase)

Un backend Express + TypeScript que convierte un Markdown en un PDF con diseño oficial de Polaria: OpenAI extrae y estructura el contenido según un schema Zod, el usuario revisa/edita el JSON resultante en un frontend estático, y Playwright (Chromium headless) renderiza el HTML final a PDF.

## 3. Recorrido de una request real: `POST /api/sprint/pdf`

Esta sección sigue el pedido más completo del sistema — generar el PDF de un sprint — desde que entra el HTTP request hasta que sale el binario. Cada paso cita el archivo real.

### 3.1 Entrada: `backend/src/server.ts`

- `server.ts` valida al arrancar que exista `OPENAI_API_KEY` (si falta, `process.exit(1)`, líneas 9-14).
- Monta middlewares en este orden: `cors()`, `express.json({ limit: "2mb" })`, `apiKeyAuth` (línea 40, aplica a todo `/api`), `upload.single("archivo")` solo para `/api/:docType/extraer` (línea 41), y finalmente `documentRouter` (línea 42) — que es donde vive la lógica real de las 4 rutas.
- `apiKeyAuth` (definida en `backend/src/api/document.routes.ts`, líneas 61-75) es un no-op si la variable de entorno `API_KEY` no está definida — en desarrollo local normalmente no lo está, así que no bloquea nada. Solo exige el header `X-API-Key` cuando el backend está expuesto públicamente y `API_KEY` sí está seteada en `.env`.
- Después de `documentRouter`, dos middlewares de error de 4 argumentos (Express los reconoce como error-handlers por la arity, no por el nombre): uno específico para errores de Multer/archivo inválido (líneas 52-69) y uno genérico catch-all (líneas 75-81) que garantiza que cualquier error no manejado responda JSON (`{ error }`-shaped vía `sendError`), nunca un 500 HTML crudo — esto importa porque un workflow de n8n consume esta API y necesita JSON parseable siempre.
- `closeBrowser()` (importado de `pdf.generator.ts`) se llama en el shutdown ordenado (`SIGTERM`/`SIGINT`, líneas 87-107) antes de cerrar el servidor HTTP.

### 3.2 Ruteo: `backend/src/api/document.routes.ts`

- El request `POST /api/sprint/pdf` cae en la ruta genérica `documentRouter.post("/:docType/pdf", ...)` (líneas 175-209). No hay una ruta específica por tipo de documento — el mismo handler sirve `epica`, `sprint` y cualquier tipo futuro.
- `getConfigOrRespond("sprint", res)` (línea 77) busca el `DocumentConfig` en el registry (`getDocumentConfig`, ver 3.3); si `docType` no está registrado, responde 404 `NOT_FOUND` sin llegar a tocar OpenAI ni Playwright.
- `config.schema.safeParse(getPayload(req.body))` valida el JSON del body contra `SprintSchema` (definido en `sprint/config.ts`). `getPayload` (línea 86-88) acepta tanto `{ datos: {...} }` como el objeto directo en la raíz del body. Si la validación falla, responde 400 `VALIDATION_ERROR` con `parsed.error.flatten()` en `details` — nunca llega a renderizar nada.
- `config.componerDatos(parsed.data)` (línea 194) — para `sprint` esto es `componerDatosSprint`, ver 3.4 — enriquece los datos ya validados con colores, porcentajes y gradientes antes de pasarlos a la plantilla.
- `generarPdf(datos, config, getPlantilla(req.body?.plantilla))` (línea 195) hace el trabajo pesado — ver 3.5. `getPlantilla` (líneas 90-92) solo acepta un string; si el body no manda `plantilla` o manda algo no-string, devuelve `undefined` y `generarPdf` cae al `defaultTemplate` del config.
- Éxito: responde el buffer del PDF con `Content-Type: application/pdf` y `Content-Disposition: attachment` (líneas 199-204). El nombre de archivo sale de `${config.id}_${Date.now()}` saneado con regex.
- Cualquier excepción no capturada en el `try` cae al `catch` de la ruta, que hace `console.error` (incluyendo el `docType`, para poder grepear logs) y responde 500 `INTERNAL_ERROR` vía `sendError`.

### 3.3 Registro de tipos de documento: `backend/src/documents/registry.ts` y `backend/src/documents/types.ts`

- `types.ts` define la interfaz `DocumentConfig<T>` (schema Zod, `systemPrompt`, `componerDatos()`, `templates: Record<string, DocumentTemplate>`, `defaultTemplate`) y `DocumentTemplate` (`path` + `pdf?.width/height` opcional).
- `registry.ts` es un mapa plano: `documentRegistry = { epica: epicaConfig, sprint: sprintConfig }` y `documentSamples = { epica: epicaSampleData, sprint: sprintSampleData }`. `getDocumentConfig("sprint")` devuelve `sprintConfig` tal cual está exportado desde `sprint/config.ts`. No hay lógica adicional: agregar un tipo de documento nuevo es agregar una entrada aquí (ver sección 4, "patrón document-type").

### 3.4 `componerDatosSprint` en `backend/src/documents/sprint/config.ts` (líneas 239-364)

Recibe los datos ya validados por `SprintSchema` y calcula, sin que la plantilla Handlebars tenga que hacer ningún cómputo:

- Por issue: colores/íconos de tipo, prioridad y estado (`TYPE_CFG`, `PRI_CFG`, `STA_CFG`) y la etiqueta "Planeado"/"Agregado" (`AGREGADO_TAG_CFG`, según el booleano `agregado` del issue).
- Por miembro: `totalIssues`, `planeados`/`agregados`, `estadoConteos` (mapeo de los 5 estados del schema a las 9 categorías estilo Linear del donut "Por estado"), los `conic-gradient` ya armados (`planGradient`, `estadoGradient`), y la paleta de color vía `asignarPaleta(indice)` (de `constants.ts`).
- A nivel de documento: `horas` (total y `pct`/`color` de cada segmento, calculado sobre `datosExtraidos.horas.segmentos` que sí viaja en el JSON — a diferencia de `epica`, ver sección 4), los KPIs `planKpi`/`agregadoKpi`/`globalKpi` que usa `template-resumen-v2.html`, y `typeLegend`.
- Devuelve un objeto plano que las plantillas Handlebars consumen directo con `{{campo}}` — nunca hacen cálculos ellas mismas (regla explícita, ver sección 4).

### 3.5 Render: `backend/src/core/generators/pdf.generator.ts`

- `resolveTemplate(config, templateKey)` (líneas 9-18): si `templateKey` existe en `config.templates`, la usa; si no, cae a `config.defaultTemplate`. Para `sprint`, `config.templates` tiene 4 claves: `detail` (900×1188px, default), `resumen-inicio` (1240×1050px), `resumen` (1240×1050px) y `resumen-v2` (1240×1050px).
- `generarHtml` compila el `.html` de la plantilla resuelta con Handlebars y lo cachea en memoria por path resuelto (`templateCache`, línea 7) — el archivo se lee de disco y se compila una sola vez por proceso.
- `generarPdf` (líneas 164-222):
  1. Toma un slot de un semáforo hecho a mano (`acquireSlot`/`releaseSlot`, líneas 96-128) que limita a `MAX_CONCURRENT_RENDERS = 4` renders simultáneos, para no saturar memoria/CPU si varios requests piden PDF a la vez.
  2. Obtiene el browser Chromium singleton (`getBrowser()`, líneas 68-78) — se lanza una sola vez de forma perezosa, no un `chromium.launch()` por request (lanzar un browser completo por request sería el cuello de botella bajo carga concurrente).
  3. Abre un `BrowserContext` + `Page` nuevos (baratos, comparados con relanzar el browser) con el viewport de la plantilla resuelta.
  4. `page.setContent(html, { waitUntil: "load", timeout: 15000 })` y luego espera `document.fonts.ready` (las plantillas cargan Google Fonts y Tabler Icons desde CDN).
  5. Mide `document.documentElement.scrollHeight` y usa `Math.max(scrollHeight, viewportHeight configurado)` como alto real del PDF — el alto configurado en `template.pdf.height` es un mínimo, no un fijo; si el contenido no entra (ej. muchos issues en `sprint`/`detail`), la página crece en vez de recortar contenido.
  6. Llama `page.pdf({ printBackground: true, width, height: finalHeight, pageRanges: "1" })` envuelto en un timeout manual de 15s (`withTimeout`, porque `page.pdf()` no expone un `timeout` nativo).
  7. `context.close()` va en el `finally`, **después** de que el `await page.pdf(...)` haya resuelto — ver sección 4, es la regla no obvia más importante del archivo.
- El PDF resultante (`Buffer`) vuelve a `document.routes.ts`, que lo envía como respuesta binaria.

### Comparación: otros 3 endpoints del mismo patrón

Los otros 3 endpoints (`GET /:docType/sample-preview`, `POST /:docType/extraer`, `POST /:docType/preview`) comparten la misma estructura de `getConfigOrRespond` + `config.schema` + `componerDatos`, pero:

- `sample-preview` no valida body ni llama a OpenAI: toma `getDocumentSample(docType)` (datos de ejemplo de `sample-data.ts`), los parsea con `config.schema.parse(...)` (no `safeParse`, así que un sample-data roto tira una excepción visible en logs) y devuelve HTML crudo vía `generarHtml` — nunca PDF.
- `extraer` es el único que usa `extractor.service.ts` / OpenAI (ver 3.6) y el único que pasa por `multer` (`upload.single("archivo")` en `server.ts`).
- `preview` es idéntico a `pdf` hasta el paso de `componerDatos`, pero llama `generarHtml` en vez de `generarPdf` y devuelve HTML (para el `<iframe>` del frontend), no un binario.

### 3.6 Extracción con IA (relevante para `POST /:docType/extraer`, no para `pdf`): `backend/src/core/ai/extractor.service.ts`

- Usa `openai.beta.chat.completions.parse` con `response_format: zodResponseFormat(config.schema, ...)` — esto fuerza a la API de OpenAI a devolver una respuesta que cumple el schema Zod del `docType`, no un JSON libre que después haya que validar a mano.
- `messages` son dos: `system` = `config.systemPrompt` (el prompt específico del tipo de documento, definido en su `config.ts`), `user` = el markdown crudo subido.
- Modelo y precio están centralizados en `backend/src/constants.ts` (`PRECIO_GPT5MINI`) — el extractor no hardcodea ni el modelo ni el precio, solo los importa.
- El cliente OpenAI se instancia con `timeout: 60_000` y `maxRetries: 1` para no colgar el handler Express indefinidamente si OpenAI no responde.
- Devuelve `{ datos: parsed, uso: { modelo, tokensEntrada, tokensSalida, tokensTotal, costoEstimadoUsd } }` — el costo se calcula en el propio servicio a partir de `PRECIO_GPT5MINI`.

## 4. Convenciones no obvias (léelas antes de tocar código)

### 4.1 `await page.pdf(...)` SIEMPRE antes de `context.close()` / `browser.close()`

En `backend/src/core/generators/pdf.generator.ts`, el `context.close()` vive en un bloque `finally` que se ejecuta **después** de que la promesa de `page.pdf(...)` resuelva (líneas 198-218 del archivo). Cerrar el context/browser antes de que esa promesa resuelva rompe la llamada al protocolo CDP de forma intermitente y puede tirar el browser compartido para todos los requests en curso (el browser es un singleton de módulo, no uno por request — ver `getBrowser()`). Esta regla ya causó fallos intermitentes reales en este proyecto (ver commit `27de4b6`, "fix(pdf): esperar resolución de page.pdf() antes de cerrar el browser") y está repetida tanto en `CLAUDE.md` como en comentarios inline del propio archivo. Si tocas esta función, no reordenes el `await`.

### 4.2 Patrón "document type": cómo agregar un documento nuevo

Cada tipo de documento es un módulo autocontenido en `backend/src/documents/<tipo>/` con 3-4 archivos: `config.ts` (schema Zod + `systemPrompt` + `componerDatos()` + `templates` + `defaultTemplate`), `sample-data.ts` (datos de ejemplo para `/sample-preview`) y uno o más `template*.html` (Handlebars, CSS inline, sin helpers custom). Las 4 rutas de `document.routes.ts` son genéricas y no requieren cambios para un tipo nuevo — solo hay que registrar el `config` + `sample-data` en `backend/src/documents/registry.ts` (agregar la entrada a `documentRegistry` y `documentSamples`, como se ve en las líneas 7-19 de ese archivo) y, si el documento debe aparecer en la UI, agregar su entrada al objeto `DOCUMENTS` en `frontend/index.html` (línea 185 en adelante). Las plantillas Handlebars nunca calculan nada (ni colores, ni porcentajes, ni formateo) — todo eso vive en `componerDatos()`, la plantilla solo interpola `{{campo}}`.

Para agregar una plantilla nueva a un tipo **existente** (por ejemplo, otra variante de `sprint`): crear el `.html`, agregarlo a `templates` en el `config.ts` de ese tipo (ver `sprintConfig.templates` en `sprint/config.ts`, líneas 371-388, que ya registra 4 claves: `detail`, `resumen-inicio`, `resumen`, `resumen-v2`) y sumar la entrada correspondiente al array `templates` de ese documento en `DOCUMENTS` en `frontend/index.html` (líneas 209-214) para que aparezca como tab de plantilla en la UI.

Nota de estado real del código a la fecha de este documento: `CLAUDE.md` describe 3 plantillas de `sprint` (`detail`, `resumen-inicio`, `resumen`), pero el código ya tiene una cuarta, `resumen-v2` (`backend/src/documents/sprint/template-resumen-v2.html`, registrada en `sprint/config.ts`), que reemplaza el bloque `riesgoTransversal` por uno nuevo `desviaciones` (`{logrado, motivo}`, ver `SprintSchema` en `sprint/config.ts` líneas 65-68) para sprints ya cerrados. Es un ejemplo real de que la documentación puede quedar un paso atrás del código: ante cualquier duda, el schema/config en el código manda.

### 4.3 Por qué `HORAS_FIJAS` es fijo y no se extrae del markdown (para `epica`)

`backend/src/constants.ts` define `HORAS_FIJAS`: un bloque de horas del equipo en base mensual (4 semanas, 480h totales), editado a mano cuando cambia la distribución mensual real del equipo. `componerDatosEpica` (en `epica/config.ts`, línea 95: `...HORAS_FIJAS`) lo mezcla directo en los datos que ve la plantilla de `epica` — nunca sale del JSON extraído por IA ni del markdown subido. La razón visible en el código: la distribución de horas del equipo no es algo que un documento de épicas mensuales describa por sprint/mes, es una constante organizacional que cambia rara vez y se edita en un solo lugar cuando cambia.

Importante: esto es distinto en `sprint`. Ahí el bloque de horas **sí** es editable por request — `SprintSchema` tiene un campo `horas.segmentos` (array `{nombre, horas}`) que sí viaja en el JSON que el usuario edita, y `componerDatosSprint` calcula `total`/`pct`/`color` a partir de esos segmentos (no de `HORAS_FIJAS`). `sprint` ya no usa el helper `escalarHoras` de `constants.ts` (que sigue existiendo para otros documentos futuros que sí necesiten derivar `HORAS_FIJAS` a otro periodo).

### 4.4 Otras convenciones a tener presentes

- Identificadores, comentarios y mensajes de error están en español; sigue esa convención en código nuevo.
- Las rutas devuelven errores con la forma `{ success: false, code, message, details? }` vía el helper `sendError` (`document.routes.ts`, líneas 28-40), con un `console.error` previo que incluye el `docType` — replica ese formato en rutas nuevas, no inventes una forma de error distinta.
- `apiKeyAuth` es condicional a que `API_KEY` esté seteada en `.env`: en desarrollo local normalmente no protege nada; no asumas que el endpoint está autenticado salvo que verifiques la variable de entorno del entorno donde corre.
- El browser de Playwright es un singleton de módulo (no uno por request) — cualquier cambio en `pdf.generator.ts` que toque el ciclo de vida del browser/context debe respetar el semáforo de concurrencia (`MAX_CONCURRENT_RENDERS = 4`) y el orden `page.pdf()` → `context.close()` de la sección 4.1.

## 5. Primera tarea sugerida para practicar

**Agregar un campo nuevo, opcional, a un schema existente y propagarlo hasta una plantilla.**

Ejemplo concreto y acotado: agregar un campo `notaInterna` (string opcional, no visible en el PDF final, solo para probar el flujo) a `EpicaItemSchema` en `backend/src/documents/epica/config.ts`, o alternativamente un campo derivado nuevo en `componerDatosSprint` (por ejemplo, un conteo adicional por miembro basado en un campo que ya existe en `SprintSchema`, como "issues de prioridad Urgent").

Por qué esta tarea es un buen primer ticket:

- Toca exactamente los archivos que ya recorriste en la sección 3: el schema Zod (`config.ts` del tipo elegido), opcionalmente `componerDatos()` si el campo necesita derivarse, y la plantilla `.html` correspondiente si el campo debe verse en el PDF.
- No toca rutas (`document.routes.ts`), el registry, ni `pdf.generator.ts` — es un cambio contenido a un solo módulo `documents/<tipo>/`, siguiendo el patrón document-type de la sección 4.2.
- Se puede verificar de punta a punta sin credenciales de OpenAI: usa `GET /api/<tipo>/sample-preview` (agregando el campo también a `sample-data.ts` del tipo elegido) para ver el HTML resultante en el navegador, y `POST /api/<tipo>/preview` con un JSON de prueba en el body para confirmar que el schema Zod acepta/rechaza como se espera.
- Para levantar el backend en paralelo al que ya pueda estar corriendo el resto del equipo en el puerto 3001, usa `PORT=3002 npm run dev` (convención explícita de `CLAUDE.md`) y no mates el proceso que ya esté corriendo en 3001 sin confirmar de quién es.

## 6. Archivos inspeccionados para este documento

- `D:\POLARIA\PDF-GENERATOR\CLAUDE.md`
- `backend/src/server.ts`
- `backend/src/api/document.routes.ts`
- `backend/src/documents/types.ts`
- `backend/src/documents/registry.ts`
- `backend/src/documents/epica/config.ts`
- `backend/src/documents/sprint/config.ts`
- `backend/src/core/ai/extractor.service.ts`
- `backend/src/core/generators/pdf.generator.ts`
- `backend/src/constants.ts`
- `frontend/index.html` (líneas 180-280, objeto `DOCUMENTS` y selector de plantillas)
- `backend/src/documents/sprint/template-resumen-v2.html` (solo grep puntual sobre `desviaciones`/`riesgoTransversal`, para confirmar la plantilla 4ta no documentada en `CLAUDE.md`)

No inspeccionados (fuera del alcance de este recorrido): `epica/template.html`, `sprint/template-detail.html` en detalle línea por línea, `sprint/template-resumen.html`, `sprint/template-resumen-inicio.html`, `sample-data.ts` de ambos tipos, ni el resto de `frontend/index.html` (líneas 1-179 y 280-564). `docs/architecture/`, `docs/adr/` y `docs/runbooks/` existen como carpetas en el repo pero estaban vacías al momento de escribir este documento.
