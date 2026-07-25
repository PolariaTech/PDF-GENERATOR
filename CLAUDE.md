# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Resumen del proyecto

Generador de documentos PDF para Polaria. Convierte un Markdown en un PDF con diseño oficial: OpenAI extrae y estructura el contenido, el usuario revisa/edita el JSON resultante, y Playwright (Chromium headless) renderiza el HTML final a PDF.

Soporta tres tipos de documento, cada uno con su propio schema y prompt de IA. Un tipo de documento puede tener mas de una plantilla (ver mas abajo):
- `epica`: resumen ejecutivo mensual de épicas (objetivo, alcance, KPIs, riesgo, equipo, horas). Dos plantillas: `default` (resumen de inicio) y `cierre` (mismos datos + cumplimiento/sprints del ciclo/resultado del riesgo transversal, ver más abajo).
- `sprint-inicio`: resumen de arranque de sprint agrupado por miembro -> proyecto -> issue, con schema deliberadamente mínimo (solo los campos que renderiza su única plantilla). Una plantilla: `resumen-inicio` (tarjetas por miembro al arrancar el sprint). Sin `agregado`/`desviaciones`/`riesgoTransversalResultado`/`estadoSprint`/`porcentajeCompletado` — ninguno existe todavía al inicio de un sprint (ver más abajo).
- `sprint-fin`: resumen de cierre de sprint, mismo agrupamiento por miembro -> proyecto -> issue pero con el schema completo. Cuatro plantillas: `detail` (lista de issues, default), `resumen` (tarjetas por miembro con planeados vs agregados), `resumen-v2` (versión simplificada de `resumen`: header con solo 2 KPIs -- % completado de planeados y de agregados -- y, en vez del riesgo transversal prospectivo, el resultado de ese riesgo al cierre, ver más abajo) y `resumen-v3` (evolución más rica, construida sobre los mismos datos de `desviaciones`/horas por miembro que ya trae el schema: semáforo único de salud del sprint, badge de utilización de capacidad por miembro, issues "vencidos" del cierre y tendencia/proyección contra sprints anteriores — ver `docs/planning/ANALISIS_INFORME_EJECUTIVO_SPRINT_RESUMEN_V2.md` para el análisis completo detrás de v3 y la sección de histórico más abajo).

`sprint-inicio` y `sprint-fin` eran un único tipo `sprint` hasta 2026-07-25 (ver ADR-0008): se partieron porque cada momento del ciclo necesita datos y validación distintos, y mantenerlos en un solo schema obligaba al arranque a cargar con campos que todavía no tienen sentido en ese momento.

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

- `config.ts` — exporta un `DocumentConfig<T>` (`backend/src/documents/types.ts`): schema Zod, `systemPrompt` para la IA, `componerDatos()` (enriquece los datos validados con colores/agregados antes de renderizar), `templates: Record<string, DocumentTemplate>` y `defaultTemplate`. Cada `DocumentTemplate` tiene su `path` y, opcionalmente, `pdf.width/height` (epica usa el default 1240x1050px; sprint-inicio usa 1240x1050px para su única plantilla; sprint-fin usa 900x1188px para `detail` y 1240x1050px para el resto). `pdf.width` es fijo; `pdf.height` es solo el alto **mínimo** — `generarPdf()` lo agranda automáticamente si el contenido no entra (ver sección de generación de PDF). Un documento puede registrar mas de una plantilla bajo distintas claves (ver `sprint-fin`).
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

### Histórico de sprints (`backend/src/documents/sprint-fin/historico.ts` + `historico.routes.ts`)

Única excepción al patrón "rutas genéricas": el generador es completamente *stateless* (cada `/preview`/`/pdf` es independiente) salvo por esto. Exclusivo de `sprint-fin` (no existe para `sprint-inicio`, que no tiene tendencia). `historico.ts` lee/escribe un archivo JSON local no versionado (`backend/data/sprint-historico.json`, ver `.gitignore`) con un registro resumido por sprint cerrado (`SprintHistoricoEntry`: KPIs de header + fecha de registro). `historico.routes.ts` expone `POST /api/sprint-fin/historico` (valida con `sprintFinConfig.schema`, compone datos con `componerDatosSprint` y hace upsert por `sprintName`+`weekNumber` — llamar de nuevo con el mismo sprint actualiza en vez de duplicar) y `GET /api/sprint-fin/historico` (lista cruda). **No se dispara automáticamente al generar un PDF** — es una llamada explícita aparte, para que probar/regenerar el PDF final no ensucie el histórico. `componerDatosSprint()` sí lee el histórico en cada llamada (función pura de lectura, segura también para `/preview`) para calcular `tendencia` (últimos 3 sprints anteriores + el actual, excluyendo el propio si ya estaba registrado) y `proyeccion` (dirección MEJORANDO/ESTABLE/EMPEORANDO comparando el % global actual contra el promedio de esos 3) — ambos exclusivos de `template-resumen-v3.html`, ausentes si no hay histórico previo (`tendenciaDisponible`). No hay pronóstico de fecha de cierre de épica: el schema de Sprint no trackea alcance total de la épica, así que "proyección" es solo tendencia de KPI, no una fecha estimada.

### Generación de PDF (`backend/src/core/generators/pdf.generator.ts`)

- `generarHtml(datos, config, templateKey?)` resuelve la plantilla (`templateKey` si existe en `config.templates`, si no `config.defaultTemplate`), compila el Handlebars correspondiente (cacheado en memoria por path resuelto) y la renderiza.
- `generarPdf(datos, config, templateKey?)` lanza un Chromium headless por request, hace `page.setContent` esperando `load` (las plantillas cargan Google Fonts y Tabler Icons desde CDN) y llama a `page.pdf()` usando el `pdf.width` de la plantilla resuelta (default 1240x1050px si la plantilla no define el suyo) como ancho fijo. El **alto es auto-ajustable en ambos sentidos**: tras el `setContent` se mide `document.documentElement.scrollHeight` y ese valor se usa tal cual como alto real del PDF para todos los documentos — crece si el contenido (ej. muchos miembros/issues en `sprint-fin`/`detail`) no entra en el `pdf.height` configurado de la plantilla, y también se achica si el contenido real es menor (ej. `resumen-inicio` con pocos miembros), en vez de dejar espacio en blanco de más. El `pdf.height` de cada plantilla ya no actúa como piso mínimo, solo como referencia de diseño. El `browser.close()` va en `finally`, **después** de `await page.pdf(...)` — cerrar el browser antes de que esa promesa resuelva rompe la llamada al protocolo CDP de forma intermitente y puede tirar el proceso entero. Si tocas esta función, mantén el `await` explícito ahí.

### Extracción con IA (`backend/src/core/ai/extractor.service.ts`)

Usa `openai.beta.chat.completions.parse` con `zodResponseFormat(config.schema, ...)` para forzar que la respuesta cumpla el schema del documento. Modelo y precio por token están centralizados en `backend/src/constants.ts` (`PRECIO_GPT4OMINI`); cambios de modelo/precio van ahí, no en el extractor.

**Reintento por validación de schema (hasta `MAX_REINTENTOS_EXTRACCION = 3`, 4 intentos en total, ver ADR-0008):** tras cada llamada a OpenAI, `extraer()` corre `config.schema.safeParse(parsed)` explícitamente (no confía en que la Structured Output API de OpenAI haga cumplir `minLength`/`maxLength` durante la generación, ese soporte no es un contrato documentado estable). Si falla, reintenta reenviando el mismo markdown con el motivo exacto del fallo (`campo: mensaje`) anexado como nota de sistema, para darle al modelo una oportunidad real de corregirse — no un simple "intenta de nuevo". El `uso` (tokens/costo) que se reporta suma **todos** los intentos, no solo el último. Este mecanismo es genérico por `docType`: hoy solo `sprint-inicio` tiene rangos `.min()` lo bastante ajustados como para dispararlo seguido (ver sección de `sprint-inicio` más abajo); `epica`/`sprint-fin` lo heredan gratis para cuando se les aplique el mismo endurecimiento.

### Datos fijos (`backend/src/constants.ts`)

- `HORAS_FIJAS`: bloque de horas del equipo, en base **mensual** (4 semanas, 480h totales). No se extrae del markdown; se edita a mano cuando cambia la distribución mensual. Lo usa `epica` directamente (su `horas` siempre sale de esta constante, no del JSON). Los segmentos "Personalizaciones" y "Team building" están comentados temporalmente (sus horas se redistribuyeron proporcionalmente en "Proyectos" e "Incidencias", manteniendo el total en 480h); para revertir, descomentarlos y devolver "Proyectos"/"Incidencias" a sus valores previos (ver comentario junto a la constante).
- `escalarHoras(horasFijas, factor)` / `formatearHoras(valor)`: helpers para derivar un bloque de horas a otro periodo o formatear un numero sin decimales de mas. Ni `sprint-inicio` ni `sprint-fin` usan `escalarHoras` (ver mas abajo); quedan disponibles para otros documentos que sí necesiten un bloque de horas fijo.
- `PALETAS` / `asignarPaleta(indice)`: colores asignados en orden a cada épica/miembro/elemento (cicla si hay más elementos que paletas). `sprint-inicio` y `sprint-fin` la reutilizan para colorear las tarjetas por miembro.

### Plantilla `cierre` de `epica`

`EpicaSchema` gana tres campos opcionales, solo relevantes en el flujo de **cierre** (`template-cierre.html`; `template.html`/`default` no los renderiza aunque vengan informados): `epicas[].cumplimiento` (narrativa cualitativa de qué tanto se logró vs. lo planeado — nunca un porcentaje calculado, la fórmula de cumplimiento global todavía no la aprueba el equipo administrativo), `epicas[].sprints` (array de `{ nombre, estado: "CUMPLIDO" | "NO CUMPLIDO" }`, los sprints que compusieron el ciclo de esa épica) y `riesgoTransversalResultado` a nivel de documento (si el riesgo previsto en el resumen de inicio se materializó o no). `EPICA_SYSTEM_PROMPT` instruye a la IA a omitir estos tres campos por completo si el documento fuente es solo un plan sin resultados reales — no a inventarlos. `componerDatosEpica()` deriva de `epicas[].sprints` los conteos (`sprintsTotal`/`sprintsCumplidos`/`sprintsNoCumplidos`) y el `conic-gradient` (`sprintsGradient`, colores en `SPRINTS_CICLO_CFG`) para el donut "Sprints del ciclo" de `template-cierre.html`, igual patrón que los demás donuts del proyecto (nada de cálculo en el `.html`).

### `sprint-inicio` (`backend/src/documents/sprint-inicio/config.ts`)

Schema deliberadamente mínimo: solo los campos que `template-resumen-inicio.html` renderiza. Igual que `sprint-fin`, el bloque de horas SÍ es editable por request (a diferencia de `epica`): `SprintInicioSchema.horas.segmentos` (array de `{ nombre, horas }`) viaja en el JSON; `componerDatosInicio()` calcula `total`/`pct`/`color` (ciclando `COLORES_HORAS`, solo el primer segmento muestra el `%`). El prompt usa como default los mismos 3 segmentos (Proyectos/Reuniones/Incidencias, 94.4/9.6/16h) salvo que el documento diga otra cosa.

Por miembro extrae `name`, `initials` (2 letras mayúsculas, validado con regex) y `objetivo` (texto libre); por issue, solo `title` y `status` — nada de `type`/`priority`/`agregado`: el template no los renderiza, y `agregado` en particular no tiene sentido todavía (al inicio del sprint TODO es lo planeado, no existe un "antes/después" de ningún corte). A nivel de documento también extrae `equipo` (quien/cuando/donde/como) y `riesgoTransversal` (texto/mitigación), espejo de los mismos bloques de `epica`, acotado a un único tema: que aparezcan incidencias no planeadas que consuman las horas del segmento "Incidencias". Sin `estadoSprint`/`porcentajeCompletado`/`riesgoTransversalResultado`/`desviaciones` — ninguno aplica a un sprint que todavía no arrancó (ver ADR-0008).

`componerDatosInicio()` calcula, por miembro, `estadoConteos` (mapeo de los 5 estados de `IssueStatusSchema` a las 9 categorías estilo Linear del donut "Por estado") y el `conic-gradient` (`estadoGradient`) ya armado.

**Rangos con margen de tolerancia (ver ADR-0008):** el prompt le pide a la IA rangos exactos (ej. `objetivo` EXACTAMENTE 480-500 caracteres), pero `SprintInicioSchema` valida un rango más ancho (`objetivo` 450-520, el resto de campos de texto con el mismo criterio -30/+20) porque los LLM no cuentan caracteres con precisión — el schema solo atrapa lo claramente fuera de rango, no exige perfección. `sprintName` exige, por regex, terminar en un año de 4 dígitos (mismo problema que `epica` resolvió en código con `asegurarAnioEnPeriodo`, porque la IA lo omite en la práctica; acá en cambio el reintento de `extractor.service.ts`, ver arriba, le da al modelo la oportunidad de corregirlo solo). Su prompt siempre redacta en futuro — a diferencia de `sprint-fin`, no tiene ningún campo `tiempoVerbal` que alternar.

### `sprint-fin` (`backend/src/documents/sprint-fin/config.ts`)

Mismo patrón de horas editables que `sprint-inicio` (`SprintSchema.horas.segmentos`, `componerDatosSprint()` calcula `total`/`pct`/`color`); Personalizaciones y Team building están ocultos temporalmente en el prompt (sus horas ya se redistribuyeron proporcionalmente en Proyectos e Incidencias) — no reaparecen salvo que el propio documento los mencione explícitamente.

`SprintSchema` tambien tiene `estadoSprint` (string corto, ej. CUMPLIDO/NO CUMPLIDO) y `porcentajeCompletado` (0-100) a nivel de documento — los usa el título de `template-resumen.html` (`{{estadoSprint}} - {{porcentajeCompletado}}%`). El prompt instruye calcular `porcentajeCompletado` como el % de issues con status `Done`, pero ambos campos quedan editables a mano en el JSON.

Ademas de `members[].projects[].issues[]`, `SprintSchema` extrae por miembro un campo `objetivo` (texto libre, EXACTAMENTE 480-500 caracteres segun el prompt, pero `.max(600)` **sin** `.min()` en el schema — a diferencia de `sprint-inicio`, todavía sin el mismo endurecimiento, ver Caso borde A de `docs/BUSINESS_FLOWS.md`) y por issue un booleano `agregado` (true si el issue se sumo durante el sprint, no estaba planeado). A nivel de documento tambien extrae `equipo` (quien/cuando/donde/como) y `riesgoTransversal` (texto/mitigacion), espejo de los mismos bloques de `epica`. Todos estos campos se extraen siempre — la extraccion no depende de la plantilla elegida — aunque `template-detail.html` no usa `horas`, `estadoSprint`, `porcentajeCompletado`, `equipo` ni `riesgoTransversal` (sí usa `agregado`: cada issue muestra una etiqueta "Planeado"/"Agregado", calculada en `componerDatosSprint()` vía `AGREGADO_TAG_CFG`).

`componerDatosSprint()` ademas calcula, por miembro: `planeados`/`agregados` (a partir de `agregado`), `estadoConteos` (mapeo de los 5 estados de `IssueStatusSchema` a las 9 categorias estilo Linear del donut "Por estado" — Triage/Bloqueado/Backlog/Duplicado quedan siempre en 0 hasta que el esquema los soporte) y los `conic-gradient` ya armados (`planGradient`, `estadoGradient`) para que las plantillas no calculen nada, solo los pongan en `style`.

`SPRINT_SYSTEM_PROMPT` de `sprint-fin` conserva la lógica original de `tiempoVerbal` (Futuro/Pasado) heredada de antes de la partición, pero en la práctica hoy `sprint-fin` solo se usa con documentos `tiempoVerbal: "Pasado"` — los de planning (`"Futuro"`) van a `sprint-inicio`, que ya no tiene ese campo (ver arriba). La rama `"Futuro"` del prompt de `sprint-fin` queda vestigial, no rota, por si algún día se necesita.

### Plantilla `resumen-v2` de `sprint-fin`

Versión deliberadamente más simple que `resumen`: mismo header/tarjetas por miembro, pero el bloque de KPIs del header queda recortado a solo 2 (`planPorcentajeCompletado`/`planEstadoSprint` y `agregadoPorcentajeCompletado`/`agregadoEstadoSprint`, ya calculados en `componerDatosSprint()` para `resumen-v3` — `resumen-v2` no calcula nada nuevo, solo deja de renderizar `globalPorcentaje` y el KPI de horas), sin el box de horas por miembro ni las tarjetas de "Desviaciones de alcance" que sí tiene `resumen-v3`. `SprintSchema` gana un campo opcional a nivel de documento, `riesgoTransversalResultado` (string, máx. 260 caracteres) — mismo patrón que el de `epica` (ver arriba): si el riesgo transversal previsto al inicio del sprint (`sprint-inicio`) se materializó o no, y qué pasó en la práctica. Solo `template-resumen-v2.html` lo renderiza (bajo el texto de `riesgoTransversal` en el mismo box, con un divisor y label "RESULTADO", igual estructura visual que `template-cierre.html` de `epica`); el resto de plantillas lo ignoran aunque venga informado. `SPRINT_SYSTEM_PROMPT` instruye a la IA a incluirlo siempre que `tiempoVerbal` sea `"Pasado"` — un criterio atado directamente a `tiempoVerbal` en vez de pedirle a la IA que juzgue por su cuenta "¿esto describe resultados reales?", que resultó ambiguo y producía `null` de forma recurrente en documentos que sí calificaban (ver `docs/BUSINESS_FLOWS.md`, Flujo 3). Además, la IA ya **no** redacta ninguna cifra en este campo (contar issues planeados/agregados/completados sobre su propia lista extraída no era confiable — llegó a decir "20 de los 20" cuando eran 15): solo escribe la frase cualitativa sobre si entraron incidencias que consumieran el colchón reservado; `componerDatosSprint()` calcula las cifras reales y arma la frase numérica de forma determinística, concatenándola después (ver Flujo 4, Caso borde C de `docs/BUSINESS_FLOWS.md`).

El propio `riesgoTransversal.texto/mitigacion` (mismo patrón en `sprint-inicio`) está acotado a un único tema: el riesgo de que aparezcan incidencias no planeadas que consuman las horas reservadas para el segmento "Incidencias" del bloque `horas` — ya no es un riesgo genérico inferido del documento. La idea es que el riesgo previsto al inicio (`sprint-inicio`) y su resultado al cierre (`riesgoTransversalResultado` de `sprint-fin`) cuenten la misma historia: los issues se planearon reservando ese colchón de horas: si no entran incidencias, el sprint cierra según lo planeado (o incluso hay margen para sumar agregados); si entran, consumen el colchón antes que afectar lo planeado.

Todo texto narrativo de un documento de **`sprint-fin`** (cualquier extracción que describa resultados reales, no un plan) debe quedar redactado en pasado, `riesgoTransversal.texto/mitigacion` incluido (ej. "el riesgo era que aparecieran incidencias..." en vez de "el riesgo es que aparezcan..."). Esto lo gobierna el campo `tiempoVerbal` del documento fuente que se le pasa a `/extraer`, siempre `"Pasado"` para `sprint-fin`. Como `sprint-inicio` y `sprint-fin` son dos `docType`/endpoints distintos desde la partición (ver arriba), inicio y cierre de un mismo sprint parten necesariamente de dos documentos fuente (y dos extracciones) distintas, nunca una sola reutilizada para ambos.

### Etiquetas por issue en `template-detail.html`

Cada issue muestra 4 etiquetas en fila (`issue-type`, `issue-priority`, `issue-status`, `issue-agregado`), cada una con `width` fijo en CSS (no `min-width`) y `justify-content: center`, para que todas las filas queden alineadas en columnas sin importar el largo del texto (p.ej. "Done" y "In Progress" ocupan el mismo ancho). Si agregas una etiqueta nueva o cambias los valores posibles de una existente, ajusta ese `width` al del contenido más largo de esa columna. El color/ícono de cada etiqueta sale de un `*_CFG` en `config.ts` (`TYPE_CFG`, `PRI_CFG`, `STA_CFG`, `AGREGADO_TAG_CFG`) — no hardcodear colores en el `.html`. El ancho de página de `detail` (900px) ya contempla las 4 columnas fijas más el título del issue; si agregas otra etiqueta, probablemente haya que ampliarlo de nuevo.

### Frontend (`frontend/index.html`)

Página única; el objeto `DOCUMENTS` dentro del `<script>` define labels/copy por tipo de documento. Si agregas un tipo de documento en el backend, también hay que añadir su entrada aquí para que aparezca como tab en la UI. Si el documento tiene mas de una plantilla, agrega un array `templates: [{ key, label }, ...]` a su entrada en `DOCUMENTS`; el selector de plantillas (tabs "Plantilla") se renderiza solo si ese array existe, y su `key` seleccionada se manda como `?plantilla=` en `sample-preview` y como `body.plantilla` en `preview`/`pdf`. Detecta si se abre como `file://` para apuntar al backend en `localhost:3001` en vez de `location.origin`.

## Variables de entorno

`backend/.env` (no versionado):

- `OPENAI_API_KEY` — requerida, API key de OpenAI Platform (no la suscripción de ChatGPT).
- `PORT` — opcional, default `3001`.
- `API_KEY` — opcional. Si no se define, el middleware `apiKeyAuth` (`backend/src/api/document.routes.ts`) no bloquea nada y todos los endpoints `/api/*` quedan igual que hoy (uso local/frontend sin auth). Si se define (instancia expuesta con una URL pública, p.ej. para que n8n llame `/api/sprint-inicio/pdf` o `/api/sprint-fin/pdf`), toda request a `/api/*` debe incluir el header `X-API-Key` con este mismo valor o responde `401 UNAUTHORIZED`.

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
- No romper compatibilidad de los schemas Zod existentes (`EpicaSchema`, `SprintInicioSchema`, `SprintSchema` de `sprint-fin`) sin avisar: son el contrato entre la IA, el frontend y el render.
- Antes de cambios grandes de arquitectura (nuevo patrón de routing, cambio de motor de templates/PDF, etc.), explicar la decisión y el porqué antes de implementar.
- Reutilizar lo que ya existe (`componerDatos`, `asignarPaleta`, `escalarHoras`, helpers de `constants.ts`) en vez de duplicar lógica de formateo/color/horas en un nuevo documento o plantilla.
- Si tocas `pdf.generator.ts`, recordar la regla de `await page.pdf(...)` antes de `browser.close()` (ver sección de arquitectura) — es la causa real de fallos intermitentes ya vistos en este proyecto.
- Si necesitas levantar `npm run dev` para verificar un cambio (capturas, curl, etc.), el usuario suele tener su propio `npm run dev` corriendo en el puerto 3001: usa otro puerto (`PORT=3002 npm run dev`) y detén tu proceso de prueba al terminar, en vez de matar lo que esté en 3001 sin confirmar de quién es.
