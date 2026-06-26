# Generador de Documentos Polaria (PDF)

App web local que convierte un documento `.md` en un PDF con el diseño oficial de Polaria, listo para compartir con socios, clientes o el equipo.

Soporta dos tipos de documento:

- **Épica**: resumen ejecutivo mensual de épicas (objetivo, alcance, KPIs, riesgo, equipo y horas).
- **Sprint**: resumen de sprint agrupado por miembro -> proyecto -> issue.

Flujo: subir `.md` -> la IA extrae y estructura el contenido -> revisas y corriges el JSON -> vista previa -> descarga el PDF con un clic.

## Tecnologías

- **Backend**: Node.js, Express, TypeScript
- **IA**: OpenAI (`gpt-4o-mini`, salida forzada a un schema con Zod)
- **Render**: Handlebars (HTML) + Playwright/Chromium (PDF)
- **Frontend**: HTML + Tailwind (CDN) + JavaScript vanilla, sin build step

## Requisitos previos

- Node.js 18 o superior
- Una API key de OpenAI (Platform, no la suscripción de ChatGPT)
- Conexión a internet al generar PDFs (llamada a OpenAI y carga de fuentes/iconos desde CDN)

## Instalación

```bash
cd backend
npm install
```

El `npm install` descarga Chromium automáticamente (script `postinstall` de Playwright). La primera vez puede tardar un par de minutos.

## Variables de entorno

Crea `backend/.env` con:

```bash
OPENAI_API_KEY=   # tu API key de OpenAI Platform
PORT=3001         # opcional, default 3001
```

## Comandos principales

```bash
cd backend
npm run dev      # desarrollo, con auto-reload (http://localhost:3001)
npm run build    # compila TypeScript a dist/
npm start        # corre la version compilada (requiere build previo)
```

No hay scripts de lint ni de test configurados todavía en este proyecto.

## Uso

```bash
cd backend
npm run dev
```

Abre `http://localhost:3001`, elige el tipo de documento (Épica o Sprint), sube el `.md`, revisa el JSON extraído, ajusta si hace falta y descarga el PDF.

## Estructura general

```
epica-pdf-generator/
├── backend/
│   ├── src/
│   │   ├── server.ts                  Express: monta rutas y sirve el frontend
│   │   ├── api/document.routes.ts     Endpoints /api/:docType/{extraer,preview,pdf,sample-preview}
│   │   ├── core/
│   │   │   ├── ai/extractor.service.ts      Llamada a OpenAI + parseo con schema Zod
│   │   │   └── generators/pdf.generator.ts  Handlebars -> HTML -> Playwright -> PDF
│   │   ├── documents/
│   │   │   ├── registry.ts            Registro de tipos de documento disponibles
│   │   │   ├── types.ts               Contrato DocumentConfig<T>
│   │   │   ├── epica/                 schema, prompt, datos de ejemplo y template del documento Epica
│   │   │   └── sprint/                schema, prompt, datos de ejemplo y template del documento Sprint
│   │   └── constants.ts               Horas fijas del equipo + paletas de color por epica
│   ├── .env                           No versionado
│   └── package.json
└── frontend/
    └── index.html                     UI de una sola pantalla (HTML + JS + Tailwind por CDN)
```

## Arquitectura resumida

Cada tipo de documento (`epica`, `sprint`) es un módulo independiente en `backend/src/documents/<tipo>/` que define su propio schema de validación (Zod), su prompt de extracción para la IA y su plantilla HTML. El registro en `documents/registry.ts` es lo único que conecta un tipo nuevo con las rutas genéricas de `api/document.routes.ts` — agregar un documento nuevo no requiere tocar las rutas.

Pipeline por request: `.md` subido -> OpenAI extrae JSON validado contra el schema (`core/ai/extractor.service.ts`) -> el usuario edita el JSON en el frontend -> `componerDatos()` enriquece esos datos (colores, totales) -> Handlebars genera el HTML -> Playwright renderiza ese HTML a PDF (`core/generators/pdf.generator.ts`).

El bloque de horas del equipo (documento Épica) es fijo y no se extrae del `.md`: vive en `backend/src/constants.ts`. Si la distribución cambia, se edita ahí una sola vez.

## Guía rápida para nuevos desarrolladores

1. `cd backend && npm install && npm run dev`.
2. Abre `http://localhost:3001` y prueba el flujo completo con un `.md` real o usa la vista previa de ejemplo (se carga sola al elegir un tipo de documento).
3. Para agregar un tipo de documento nuevo: crea `backend/src/documents/<tipo>/` con `config.ts`, `sample-data.ts` y `template.html`, regístralo en `documents/registry.ts`, y agrega su entrada en el objeto `DOCUMENTS` de `frontend/index.html` para que aparezca como tab en la UI.
4. Para cambiar el diseño de un PDF, edita el `template.html` correspondiente (Handlebars + CSS inline, sin helpers custom) y refresca la vista previa.

## Convenciones importantes

- Código, comentarios y mensajes de error en español.
- Las rutas devuelven errores como `{ error: string }`, registrando el `docType` en consola antes de responder.
- Toda transformación/formateo de datos para la plantilla vive en `componerDatos()` de cada documento, no en helpers de Handlebars.
- El JSON extraído por la IA siempre es editable antes de generar el PDF: cualquier error de extracción se corrige a mano sin volver a subir el archivo.

## Documentación adicional

Ver [CLAUDE.md](./CLAUDE.md) para el detalle de arquitectura orientado a trabajar con Claude Code en este repositorio (incluye notas sobre un bug ya corregido en la generación de PDF y pendientes de documentación del equipo).
