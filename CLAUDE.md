# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Resumen del proyecto

Generador de documentos PDF para Polaria. Convierte un Markdown en un PDF con diseño oficial: OpenAI extrae y estructura el contenido, el usuario revisa/edita el JSON resultante, y Playwright (Chromium headless) renderiza el HTML final a PDF.

Soporta dos tipos de documento, cada uno con su propio schema, prompt de IA y plantilla:
- `epica`: resumen ejecutivo mensual de épicas (objetivo, alcance, KPIs, riesgo, equipo, horas).
- `sprint`: resumen de sprint agrupado por miembro -> proyecto -> issue.

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

- `config.ts` — exporta un `DocumentConfig<T>` (`backend/src/documents/types.ts`): schema Zod, `systemPrompt` para la IA, `componerDatos()` (enriquece los datos validados con colores/agregados antes de renderizar) y `templatePath`. Opcionalmente `pdf.width/height` por documento (epica usa el default 1240x1050px; sprint usa 840x1188px).
- `sample-data.ts` — datos de ejemplo para `/sample-preview`.
- `template.html` — plantilla Handlebars con el diseño final (CSS inline, sin helpers custom; los datos ya llegan formateados desde `componerDatos()`).

Para agregar un tipo de documento nuevo: crear la carpeta con esos tres archivos y registrar el `config` + `sample-data` en `backend/src/documents/registry.ts`. Las rutas son genéricas y no requieren cambios.

### Rutas (`backend/src/api/document.routes.ts`)

Mismo set de 4 endpoints para cualquier `docType` registrado:

- `GET /api/:docType/sample-preview` — HTML de ejemplo, sin IA.
- `POST /api/:docType/extraer` — recibe un `.md` (multer, campo `archivo`), llama a OpenAI y devuelve `{ datos, uso }`.
- `POST /api/:docType/preview` — valida el JSON (editado por el usuario) contra el schema y devuelve HTML.
- `POST /api/:docType/pdf` — igual que preview pero devuelve el PDF.

Todas validan con `config.schema.safeParse(...)` antes de procesar y responden `{ error }` en caso de fallo.

### Generación de PDF (`backend/src/core/generators/pdf.generator.ts`)

- `generarHtml()` compila la plantilla Handlebars (cacheada en memoria por path resuelto) y la renderiza.
- `generarPdf()` lanza un Chromium headless por request, hace `page.setContent` esperando `networkidle` (las plantillas cargan Google Fonts y Tabler Icons desde CDN) y llama a `page.pdf()`. El `browser.close()` va en `finally`, **después** de `await page.pdf(...)` — cerrar el browser antes de que esa promesa resuelva rompe la llamada al protocolo CDP de forma intermitente y puede tirar el proceso entero. Si tocas esta función, mantén el `await` explícito ahí.

### Extracción con IA (`backend/src/core/ai/extractor.service.ts`)

Usa `openai.beta.chat.completions.parse` con `zodResponseFormat(config.schema, ...)` para forzar que la respuesta cumpla el schema del documento. Modelo y precio por token están centralizados en `backend/src/constants.ts` (`PRECIO_GPT4OMINI`); cambios de modelo/precio van ahí, no en el extractor.

### Datos fijos (`backend/src/constants.ts`)

- `HORAS_FIJAS`: bloque de horas del equipo (documento `epica`). No se extrae del markdown; se edita a mano cuando cambia la distribución mensual.
- `PALETAS` / `asignarPaleta(indice)`: colores asignados en orden a cada épica/elemento (cicla si hay más elementos que paletas).

### Frontend (`frontend/index.html`)

Página única; el objeto `DOCUMENTS` dentro del `<script>` define labels/copy por tipo de documento. Si agregas un tipo de documento en el backend, también hay que añadir su entrada aquí para que aparezca como tab en la UI. Detecta si se abre como `file://` para apuntar al backend en `localhost:3001` en vez de `location.origin`.

## Variables de entorno

`backend/.env` (no versionado):

- `OPENAI_API_KEY` — requerida, API key de OpenAI Platform (no la suscripción de ChatGPT).
- `PORT` — opcional, default `3001`.

## Convenciones existentes

- Identificadores, comentarios y mensajes de error en español; los nombres reflejan el dominio (`componerDatos`, `asignarPaleta`, `HORAS_FIJAS`).
- Las rutas devuelven errores como `res.status(...).json({ error: string })`, con `console.error` previo incluyendo el `docType` — seguir ese mismo formato en rutas nuevas.
- Las plantillas Handlebars no usan helpers custom: cualquier formateo/derivación de datos se hace en `componerDatos()`, no en el template.

## Pendiente de documentar

- No hay suite de tests ni linter/formatter configurado — confirmar con el equipo si se planea agregar.
- No hay `.env.example` en el repo (el README anterior lo mencionaba); confirmar si debe crearse.
- No hay pipeline de CI/CD ni instrucciones de despliegue más allá de `npm run build && npm start`.

## Instrucciones para Claude

- Mantener el patrón "document type" para cualquier documento nuevo o cambio de esquema; no crear rutas o lógica de render ad-hoc fuera de `documents/<tipo>/` + `registry.ts`.
- No introducir nuevas dependencias (librerías de PDF, plantillas, validación, etc.) sin justificar por qué Handlebars/Playwright/Zod/OpenAI no alcanzan.
- No romper compatibilidad de los schemas Zod existentes (`EpicaSchema`, `SprintSchema`) sin avisar: son el contrato entre la IA, el frontend y el render.
- Antes de cambios grandes de arquitectura (nuevo patrón de routing, cambio de motor de templates/PDF, etc.), explicar la decisión y el porqué antes de implementar.
- Reutilizar lo que ya existe (`componerDatos`, `asignarPaleta`, helpers de `constants.ts`) en vez de duplicar lógica de formateo/color en un nuevo documento.
- Si tocas `pdf.generator.ts`, recordar la regla de `await page.pdf(...)` antes de `browser.close()` (ver sección de arquitectura) — es la causa real de fallos intermitentes ya vistos en este proyecto.
