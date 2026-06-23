# Generador de Resumen de Épica (PDF)

App web local que convierte el documento `.md` de las épicas del mes en el PDF de resumen ejecutivo con el diseño oficial de Polaria, listo para compartir con socios y clientes.

Flujo: subir `.md` → la IA extrae y estructura el contenido → revisas y corriges el JSON → vista previa → descarga el PDF con un clic.

## Cómo funciona

1. Subes un archivo `.md` que contiene las épicas del mes.
2. El backend manda el texto a OpenAI, que devuelve un JSON estructurado (una entrada por épica, más el bloque de equipo y el riesgo transversal).
3. Revisas ese JSON en pantalla y corriges lo que haga falta.
4. La vista previa se actualiza con el diseño real.
5. Al darle a "Descargar PDF", el backend renderiza el HTML con Playwright (Chromium) y te entrega el PDF.

El bloque de horas del equipo (44h y su distribución) es fijo y no se extrae del documento: vive en `backend/src/constants.ts`. Si la distribución cambia, se edita ahí una sola vez.

## Requisitos

- Node.js 18 o superior
- Una API key de OpenAI (Platform, no la suscripción de ChatGPT)
- Conexión a internet al generar el PDF (para la llamada a OpenAI y para cargar la fuente Stack Sans Headline desde Google Fonts)

## Instalación

```bash
cd backend
npm install
```

El `npm install` descarga Chromium automáticamente (vía el script `postinstall` de Playwright). La primera vez puede tardar un par de minutos.

Luego configura tu API key:

```bash
cp .env.example .env
# abre .env y pega tu OPENAI_API_KEY real
```

## Uso

```bash
cd backend
npm run dev
```

Abre `http://localhost:3001` en el navegador. Sube el `.md`, revisa, descarga.

Para producción (build compilado):

```bash
npm run build
npm start
```

## Estructura

```
epica-pdf-generator/
├── backend/
│   ├── src/
│   │   ├── server.ts          Express: endpoints /api/extraer, /api/preview, /api/pdf
│   │   ├── extractor.ts       Llamada a OpenAI + prompt de extracción
│   │   ├── renderer.ts        Compone datos + Handlebars + Playwright -> PDF
│   │   ├── constants.ts       Bloque de horas fijo + paletas por épica
│   │   ├── types.ts           Esquema del JSON (contrato IA -> edición -> render)
│   │   └── templates/
│   │       └── resumen-epica.template.html   Diseño del PDF
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    └── index.html             UI de una sola pantalla (HTML + JS + Tailwind por CDN)
```

## Notas

- El diseño soporta de 1 a N épicas: las tarjetas se acomodan solas y los colores se asignan en orden (azul, teal, coral, morado, ámbar; cicla si hay más).
- El modelo usado es `gpt-4o` con `response_format: json_object`. Si quieres cambiarlo, está en `extractor.ts`.
- El JSON extraído siempre es editable antes de generar el PDF, así que cualquier error de la IA se corrige a mano sin volver a subir el archivo.
