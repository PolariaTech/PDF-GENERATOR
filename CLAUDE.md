# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Resumen del proyecto

Generador de documentos PDF para Polaria. Convierte un Markdown en un PDF con diseño oficial: OpenAI extrae y estructura el contenido, el usuario revisa/edita el JSON resultante, y Playwright (Chromium headless) renderiza el HTML final a PDF.

Soporta dos tipos de documento, cada uno con su propio schema y prompt de IA. Un tipo de documento puede tener mas de una plantilla (ver mas abajo):
- `epica`: resumen ejecutivo mensual de épicas (objetivo, alcance, KPIs, riesgo, equipo, horas). Una sola plantilla (`default`).
- `sprint`: resumen de sprint agrupado por miembro -> proyecto -> issue. Tres plantillas: `detail` (lista de issues, default), `resumen-inicio` (tarjetas por miembro al arrancar el sprint, sin el donut de planeados/agregados) y `resumen` (igual que `resumen-inicio` pero al cierre, con planeados vs agregados).

Todo el backend vive en `backend/` (Express + TypeScript). El frontend es un único `frontend/index.html` estático (Tailwind por CDN, JS vanilla, sin build step), servido por Express.

## Comandos

```bash
cd backend
npm install      # instala dependencias; postinstall descarga Chromium via Playwright
npm run dev      # ts-node-dev con auto-reload, sirve en http://localhost:3001
npm run build    # compila TypeScript a dist/ (tsc)
npm start        # corre la version compilada (dist/server.js)
```

No hay scripts de lint ni de test en `package.json`: no asumas que existe una suite o un linter configurado.

## Arquitectura

### Patrón "document type" (registry)

Cada tipo de documento es un módulo autocontenido en `backend/src/documents/<tipo>/`:

- `config.ts` — exporta un `DocumentConfig<T>` (`backend/src/documents/types.ts`): schema Zod, `systemPrompt` para la IA, `componerDatos()` (enriquece los datos validados con colores/agregados antes de renderizar), `templates: Record<string, DocumentTemplate>` y `defaultTemplate`. Cada `DocumentTemplate` tiene su `path` y, opcionalmente, `pdf.width/height` (epica usa el default 1240x1050px; sprint usa 900x1188px para `detail` y 1240x1050px para `resumen-inicio`/`resumen`). `pdf.width` es fijo; `pdf.height` es solo el alto **mínimo** — `generarPdf()` lo agranda automáticamente si el contenido no entra (ver sección de generación de PDF). Un documento puede registrar mas de una plantilla bajo distintas claves (ver `sprint`).
- `sample-data.ts` — datos de ejemplo para `/sample-preview`.
- `template*.html` — una plantilla Handlebars por entrada de `templates` (CSS inline, sin helpers custom; los datos ya llegan formateados desde `componerDatos()`).

Para agregar un tipo de documento nuevo: crear la carpeta con esos archivos y registrar el `config` + `sample-data` en `backend/src/documents/registry.ts`. Las rutas son genéricas y no requieren cambios. Para agregar una plantilla nueva a un tipo existente: crear el `.html`, agregarlo a `templates` en su `config.ts` y sumar la entrada al array `templates` del documento en el objeto `DOCUMENTS` de `frontend/index.html` (ver sección Frontend).

### Rutas (`backend/src/api/document.routes.ts`)

Mismo set de 4 endpoints para cualquier `docType` registrado:

- `GET /api/:docType/sample-preview` — HTML de ejemplo, sin IA. Acepta `?plantilla=<key>` opcional.
- `POST /api/:docType/extraer` — recibe un `.md` (multer, campo `archivo`), llama a OpenAI y devuelve `{ datos, uso }`. No depende de la plantilla: el schema es el mismo sin importar cual se vaya a renderizar despues.
- `POST /api/:docType/preview` — valida el JSON (editado por el usuario, en `body.datos` o en el body directo) contra el schema y devuelve HTML. Acepta `body.plantilla` opcional.
- `POST /api/:docType/pdf` — igual que preview pero devuelve el PDF. Acepta `body.plantilla` opcional.

`plantilla` debe ser una clave existente en `config.templates`; si no se manda o no existe, se usa `config.defaultTemplate`. Todas validan con `config.schema.safeParse(...)` antes de procesar y responden `{ error }` en caso de fallo.

### Generación de PDF (`backend/src/core/generators/pdf.generator.ts`)

- `generarHtml(datos, config, templateKey?)` resuelve la plantilla (`templateKey` si existe en `config.templates`, si no `config.defaultTemplate`), compila el Handlebars correspondiente (cacheado en memoria por path resuelto) y la renderiza.
- `generarPdf(datos, config, templateKey?)` lanza un Chromium headless por request, hace `page.setContent` esperando `networkidle` (las plantillas cargan Google Fonts y Tabler Icons desde CDN) y llama a `page.pdf()` usando el `pdf.width` de la plantilla resuelta (default 1240x1050px si la plantilla no define el suyo) como ancho fijo. El **alto es auto-ajustable**: tras el `setContent` se mide `document.documentElement.scrollHeight` y se usa `Math.max(scrollHeight, pdf.height configurado)` como alto real del PDF — nunca se achica por debajo del alto de diseño de la plantilla, pero crece si el contenido (ej. muchos miembros/issues en `sprint`/`detail`) no entra en ese alto. Antes el alto era fijo y el contenido que sobraba se recortaba silenciosamente; no volver a fijarlo sin este ajuste. El `browser.close()` va en `finally`, **después** de `await page.pdf(...)` — cerrar el browser antes de que esa promesa resuelva rompe la llamada al protocolo CDP de forma intermitente y puede tirar el proceso entero. Si tocas esta función, mantén el `await` explícito ahí.

### Extracción con IA (`backend/src/core/ai/extractor.service.ts`)

Usa `openai.beta.chat.completions.parse` con `zodResponseFormat(config.schema, ...)` para forzar que la respuesta cumpla el schema del documento. Modelo y precio por token están centralizados en `backend/src/constants.ts` (`PRECIO_GPT5MINI`); cambios de modelo/precio van ahí, no en el extractor.

### Datos fijos (`backend/src/constants.ts`)

- `HORAS_FIJAS`: bloque de horas del equipo, en base **mensual** (4 semanas, 480h totales). No se extrae del markdown; se edita a mano cuando cambia la distribución mensual. Lo usa `epica` directamente (su `horas` siempre sale de esta constante, no del JSON). Los segmentos "Personalizaciones" y "Team building" están comentados temporalmente (sus horas se redistribuyeron proporcionalmente en "Proyectos" e "Incidencias", manteniendo el total en 480h); para revertir, descomentarlos y devolver "Proyectos"/"Incidencias" a sus valores previos (ver comentario junto a la constante).
- `escalarHoras(horasFijas, factor)` / `formatearHoras(valor)`: helpers para derivar un bloque de horas a otro periodo o formatear un numero sin decimales de mas. `sprint` ya NO usa `escalarHoras` (ver mas abajo); quedan disponibles para otros documentos que sí necesiten un bloque de horas fijo.
- `PALETAS` / `asignarPaleta(indice)`: colores asignados en orden a cada épica/miembro/elemento (cicla si hay más elementos que paletas). `sprint` la reutiliza para colorear las tarjetas por miembro en `resumen`/`resumen-inicio`.

### Plantillas `resumen`/`resumen-inicio` de `sprint`

A diferencia de `epica`, en `sprint` el bloque de horas SÍ es editable por request: `SprintSchema` tiene un campo `horas.segmentos` (array de `{ nombre, horas }`, sin `pct`/`color`/`total`) que viaja en el JSON que el usuario edita en el frontend. `componerDatosSprint()` calcula `total` (suma de `horas` de cada segmento), `pct` (cada `horas` sobre el total) y asigna `color` ciclando `COLORES_HORAS` (solo el primer segmento muestra el `%` dentro de la barra). El prompt de IA instruye usar como default 3 segmentos (Proyectos/Reuniones/Incidencias, 94.4/9.6/16h) salvo que el documento diga otra cosa; Personalizaciones y Team building están ocultos temporalmente en el prompt (sus horas ya se redistribuyeron proporcionalmente en Proyectos e Incidencias) — no reaparecen salvo que el propio documento los mencione explícitamente.

`SprintSchema` tambien tiene `estadoSprint` (string corto, ej. CUMPLIDO/EN PROGRESO/EN RIESGO) y `porcentajeCompletado` (0-100) a nivel de documento — los usa el título de `template-resumen.html` (`{{estadoSprint}} - {{porcentajeCompletado}}%`). El prompt instruye calcular `porcentajeCompletado` como el % de issues con status `Done`, pero ambos campos quedan editables a mano en el JSON.

Ademas de `members[].projects[].issues[]`, `SprintSchema` extrae por miembro un campo `objetivo` (texto libre, EXACTAMENTE 480-500 caracteres) y por issue un booleano `agregado` (true si el issue se sumo durante el sprint, no estaba planeado). A nivel de documento tambien extrae `equipo` (quien/cuando/donde/como) y `riesgoTransversal` (texto/mitigacion), espejo de los mismos bloques de `epica`. Todos estos campos (`horas`, `estadoSprint`, `porcentajeCompletado`, `objetivo`, `agregado`, `equipo`, `riesgoTransversal`) se extraen siempre — la extraccion no depende de la plantilla elegida — aunque `template-detail.html` no usa `horas`, `estadoSprint`, `porcentajeCompletado`, `equipo` ni `riesgoTransversal` (sí usa `agregado`: cada issue muestra una etiqueta "Planeado"/"Agregado", calculada en `componerDatosSprint()` vía `AGREGADO_TAG_CFG`).

`componerDatosSprint()` ademas calcula, por miembro: `planeados`/`agregados` (a partir de `agregado`), `estadoConteos` (mapeo de los 5 estados de `IssueStatusSchema` a las 9 categorias estilo Linear del donut "Por estado" — Triage/Bloqueado/Backlog/Duplicado quedan siempre en 0 hasta que el esquema los soporte) y los `conic-gradient` ya armados (`planGradient`, `estadoGradient`) para que las plantillas no calculen nada, solo los pongan en `style`.

`template-resumen-inicio.html` es igual a `template-resumen.html` pero sin el bloque de texto/leyenda de "Planeados vs Agregados" (al inicio del sprint no tiene sentido mostrarlo). Si cambias el layout de tarjeta en uno, revisa si aplica al otro.

### Etiquetas por issue en `template-detail.html`

Cada issue muestra 4 etiquetas en fila (`issue-type`, `issue-priority`, `issue-status`, `issue-agregado`), cada una con `width` fijo en CSS (no `min-width`) y `justify-content: center`, para que todas las filas queden alineadas en columnas sin importar el largo del texto (p.ej. "Done" y "In Progress" ocupan el mismo ancho). Si agregas una etiqueta nueva o cambias los valores posibles de una existente, ajusta ese `width` al del contenido más largo de esa columna. El color/ícono de cada etiqueta sale de un `*_CFG` en `config.ts` (`TYPE_CFG`, `PRI_CFG`, `STA_CFG`, `AGREGADO_TAG_CFG`) — no hardcodear colores en el `.html`. El ancho de página de `detail` (900px) ya contempla las 4 columnas fijas más el título del issue; si agregas otra etiqueta, probablemente haya que ampliarlo de nuevo.

### Frontend (`frontend/index.html`)

Página única; el objeto `DOCUMENTS` dentro del `<script>` define labels/copy por tipo de documento. Si agregas un tipo de documento en el backend, también hay que añadir su entrada aquí para que aparezca como tab en la UI. Si el documento tiene mas de una plantilla, agrega un array `templates: [{ key, label }, ...]` a su entrada en `DOCUMENTS`; el selector de plantillas (tabs "Plantilla") se renderiza solo si ese array existe, y su `key` seleccionada se manda como `?plantilla=` en `sample-preview` y como `body.plantilla` en `preview`/`pdf`. Detecta si se abre como `file://` para apuntar al backend en `localhost:3001` en vez de `location.origin`.

## Variables de entorno

`backend/.env` (no versionado):

- `OPENAI_API_KEY` — requerida, API key de OpenAI Platform (no la suscripción de ChatGPT).
- `PORT` — opcional, default `3001`.
- `API_KEY` — opcional. Si no se define, el middleware `apiKeyAuth` (`backend/src/api/document.routes.ts`) no bloquea nada y todos los endpoints `/api/*` quedan igual que hoy (uso local/frontend sin auth). Si se define (instancia expuesta con una URL pública, p.ej. para que n8n llame `/api/sprint/pdf`), toda request a `/api/*` debe incluir el header `X-API-Key` con este mismo valor o responde `401 UNAUTHORIZED`.

## Convenciones existentes

- Identificadores, comentarios y mensajes de error en español; los nombres reflejan el dominio (`componerDatos`, `asignarPaleta`, `HORAS_FIJAS`).
- Las rutas devuelven errores con `sendError()` (`backend/src/api/document.routes.ts`): `{ success: false, code: ErrorCode, message: string, details?: unknown }`, con `console.error` previo incluyendo el `docType` — seguir ese mismo formato en rutas nuevas, nunca `res.status(...).json({ error: string })` suelto.
- Las plantillas Handlebars no usan helpers custom: cualquier formateo/derivación de datos se hace en `componerDatos()`, no en el template.

## Documentación del proyecto

El proyecto sigue el estándar interno de documentación de Polaria (`GUIA_DOCUMENTACION_EXTENDIDA.md`). Ver `docs/DOCUMENTATION_CHECKLIST.md` para el estado de cada uno de los 20 puntos de esa guía y dónde vive cada documento (arquitectura, API, glosario, ADRs, seguridad, onboarding, etc.).

## Pendiente de documentar / decisiones abiertas

- No hay suite de tests ni linter/formatter configurado — sigue siendo una decisión de equipo pendiente (ver `docs/TESTING.md` para el protocolo de verificación manual que se usa mientras tanto).
- No hay pipeline de CI/CD ni instrucciones de despliegue más allá de `npm run build && npm start` (ver `docs/RUNBOOKS.md` y `docs/ENVIRONMENTS.md` para el detalle honesto de lo que existe hoy vs. lo planeado).
- `docs/COMPLIANCE.md` deja abierta la confirmación legal/organizacional sobre el tratamiento de nombres del equipo en los reportes de sprint — no es una decisión técnica.

## Instrucciones para Claude

- Mantener el patrón "document type" para cualquier documento nuevo o cambio de esquema; no crear rutas o lógica de render ad-hoc fuera de `documents/<tipo>/` + `registry.ts`.
- No introducir nuevas dependencias (librerías de PDF, plantillas, validación, etc.) sin justificar por qué Handlebars/Playwright/Zod/OpenAI no alcanzan.
- No romper compatibilidad de los schemas Zod existentes (`EpicaSchema`, `SprintSchema`) sin avisar: son el contrato entre la IA, el frontend y el render.
- Antes de cambios grandes de arquitectura (nuevo patrón de routing, cambio de motor de templates/PDF, etc.), explicar la decisión y el porqué antes de implementar.
- Reutilizar lo que ya existe (`componerDatos`, `asignarPaleta`, `escalarHoras`, helpers de `constants.ts`) en vez de duplicar lógica de formateo/color/horas en un nuevo documento o plantilla.
- Si tocas `pdf.generator.ts`, recordar la regla de `await page.pdf(...)` antes de `browser.close()` (ver sección de arquitectura) — es la causa real de fallos intermitentes ya vistos en este proyecto.
- Si necesitas levantar `npm run dev` para verificar un cambio (capturas, curl, etc.), el usuario suele tener su propio `npm run dev` corriendo en el puerto 3001: usa otro puerto (`PORT=3002 npm run dev`) y detén tu proceso de prueba al terminar, en vez de matar lo que esté en 3001 sin confirmar de quién es.
