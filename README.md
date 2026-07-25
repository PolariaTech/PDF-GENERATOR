# Generador de Documentos PDF Polaria

> Convierte un documento Markdown en un PDF con el diseño oficial de Polaria: la IA extrae y estructura el contenido, vos revisás/corregís el JSON resultante, y el sistema renderiza el PDF final con un clic.

Este proyecto resuelve un problema concreto del equipo de Polaria: armar a mano, mes a mes y sprint a sprint, los resúmenes ejecutivos de épicas y sprints en un diseño consistente consumía tiempo y llevaba a documentos con formato inconsistente entre autores. Acá se sube un `.md` con las notas del período, OpenAI lo estructura en un JSON validado, el JSON se revisa/edita a mano si hace falta, y Playwright genera el PDF final con el diseño oficial — sin herramientas de diseño ni copiar/pegar entre plantillas.

## Estado del proyecto

Este repositorio **no tiene badges de CI/CD, cobertura de tests, ni versión publicada** porque ninguno de esos procesos existe todavía: no hay pipeline de integración continua configurado y no hay suite de tests automatizados (ver [Cómo correr los tests](#cómo-correr-los-tests)). Se documenta así explícitamente en vez de mostrar badges que no reflejarían la realidad del proyecto.

## Stack tecnológico

| Tecnología | Versión | Rol en este proyecto |
|---|---|---|
| Node.js + Express | Express `^4.19.2` | Servidor HTTP del backend; expone los 4 endpoints por tipo de documento (`sample-preview`, `extraer`, `preview`, `pdf`) y sirve el frontend estático. |
| TypeScript | `^5.6.3` | Tipa todo el backend: schemas Zod, `DocumentConfig<T>`, servicios de IA y generación de PDF. |
| OpenAI (`gpt-4o-mini`) | SDK `openai` `^4.67.3` | Extrae y estructura el Markdown subido en un JSON validado, vía `openai.beta.chat.completions.parse` (`backend/src/core/ai/extractor.service.ts`). |
| Zod | `^3.25.76` | Define el schema de cada tipo de documento (`EpicaSchema`, `SprintSchema`) y valida tanto la salida de la IA como el JSON editado a mano antes de `/preview` y `/pdf`. |
| Handlebars | `^4.7.8` | Compila las plantillas `.html` (CSS inline, sin helpers custom) con los datos ya enriquecidos por `componerDatos()`. |
| Playwright (Chromium headless) | `^1.48.0` | Renderiza el HTML final a PDF (`backend/src/core/generators/pdf.generator.ts`); usa un browser singleton reutilizado entre requests y ajusta el alto del PDF al contenido real renderizado. |
| Multer | `^1.4.5-lts.1` | Procesa el archivo `.md` subido en `POST /api/:docType/extraer` (límite de 2 MB, solo `.md`). |
| Tailwind CSS (CDN) | sin versión fija (CDN) | Estilos del frontend estático (`frontend/index.html`), sin paso de build. |

## Prerrequisitos

- **Node.js 20.x LTS** (mínimo funcional: 18.x). `backend/package.json` no declara un campo `"engines"`, así que npm no impone un mínimo — esta guía se verificó usando la LTS activa (20.x); no uses una versión anterior a 18 porque Playwright `^1.48.0` no la soporta. Descargar en [nodejs.org](https://nodejs.org/).
- **npm 9 o superior** (se instala junto con Node.js).
- **Git**, para clonar el repositorio.
- **Cuenta externa necesaria**: una API key de **OpenAI Platform** (no la suscripción de ChatGPT Plus). Se obtiene en [platform.openai.com/api-keys](https://platform.openai.com/api-keys) y requiere saldo/facturación activa en esa cuenta.
- Conexión a internet en tiempo de ejecución: el backend llama a la API de OpenAI en `/extraer`, y las plantillas cargan Google Fonts y Tabler Icons desde CDN durante el render a PDF.

## Instalación

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/DanielGalvis-Dev/epica-pdf-generator.git
   cd epica-pdf-generator
   ```

2. Instalar las dependencias del backend:

   ```bash
   cd backend
   npm install
   ```

   El script `postinstall` de Playwright descarga Chromium automáticamente al terminar el `npm install`. La primera vez puede tardar 1-3 minutos según tu conexión — es normal, no se colgó.

3. Crear el archivo de variables de entorno (ver sección siguiente) y completar `OPENAI_API_KEY`.

Para el detalle paso a paso con verificación y troubleshooting extendido, ver **[docs/INSTALL.md](./docs/INSTALL.md)**.

## Variables de entorno

Copiar la plantilla y completar `OPENAI_API_KEY`:

```bash
cp backend/.env.example backend/.env
```

`backend/.env` (no versionado) queda con:

```bash
OPENAI_API_KEY=sk-...tu-api-key-aqui   # obligatoria: API key de OpenAI Platform
PORT=3001                              # opcional, default 3001
API_KEY=                               # opcional, ver docs/SECURITY.md
```

`OPENAI_API_KEY` es obligatoria: si falta, el servidor loguea el error y termina el proceso al arrancar (ver [Troubleshooting](#troubleshooting-rápido)). El detalle completo de todas las variables soportadas vive en **[docs/ENV_VARS.md](./docs/ENV_VARS.md)**.

## Cómo correr el proyecto

```bash
cd backend
npm run dev
```

Arranca con auto-reload (`ts-node-dev`) en **http://localhost:3001**. En el log vas a ver `Servidor de documentos corriendo en http://localhost:3001` cuando terminó de levantar. Abrí esa URL, elegí el tipo de documento (Épica o Sprint), subí un `.md`, revisá el JSON extraído, ajustá si hace falta y descargá el PDF. Si el documento tiene más de una plantilla (Épica tiene `default` y `cierre`; Sprint tiene `detail`, `resumen-inicio`, `resumen`, `resumen-v2` y `resumen-v3`), elegí cuál usar en el selector "Plantilla" antes de generar la vista previa o el PDF. No hay credenciales de prueba: la app corre local y sin sistema de usuarios.

Comandos alternativos:

```bash
npm run build   # compila TypeScript a dist/
npm start       # corre la versión compilada (requiere build previo)
```

## Cómo correr los tests

**Este proyecto no tiene una suite de tests automatizados ni un linter/formatter configurado en `backend/package.json`.** No hay `npm test` ni script de lint. La única forma actual de verificar un cambio es correr `npm run dev` y probar el flujo manualmente (subir un `.md`, revisar el JSON, generar preview y PDF) para el tipo de documento y la plantilla que tocaste. Ver [docs/TESTING.md](./docs/TESTING.md) para la estrategia de pruebas manuales del equipo.

## Estructura del proyecto

```
PDF-GENERATOR/
├── backend/
│   ├── src/
│   │   ├── api/            Rutas HTTP: /api/:docType/{sample-preview,extraer,preview,pdf}
│   │   ├── core/            Lógica de negocio: extracción con IA (core/ai/) y render a PDF (core/generators/)
│   │   ├── documents/       Un módulo por tipo de documento (epica/, sprint/) + registry.ts y types.ts
│   │   ├── constants.ts     Horas fijas del equipo, paletas de color, precio del modelo de OpenAI
│   │   └── server.ts        Arranque de Express, middlewares de error y apagado ordenado
│   ├── .env                 No versionado; variables de entorno locales
│   └── package.json
└── frontend/
    └── index.html           UI de una sola pantalla (HTML + JS vanilla + Tailwind por CDN, sin build)
```

## Documentación

- [docs/INSTALL.md](./docs/INSTALL.md) — guía de instalación detallada y verificable, paso a paso.
- [docs/architecture/](./docs/architecture/) — arquitectura del sistema y decisiones de diseño.
- [docs/API.md](./docs/API.md) — referencia completa de los endpoints `/api/:docType/*`.
- [docs/GLOSSARY.md](./docs/GLOSSARY.md) — glosario de términos del dominio (`epica`, `sprint`, `agregado`, `componerDatos`, etc.).
- [docs/BUSINESS_FLOWS.md](./docs/BUSINESS_FLOWS.md) — flujos de negocio de extremo a extremo.
- [docs/adr/](./docs/adr/) — registro de decisiones de arquitectura (ADRs).
- [docs/TESTING.md](./docs/TESTING.md) — estrategia de pruebas (hoy, manuales) del equipo.
- [docs/RUNBOOKS.md](./docs/RUNBOOKS.md) — procedimientos operativos ante incidentes.
- [docs/ONBOARDING.md](./docs/ONBOARDING.md) — guía de onboarding para desarrolladores nuevos.
- [docs/SECURITY.md](./docs/SECURITY.md) — consideraciones de seguridad (API key, manejo de secretos).
- [docs/ENVIRONMENTS.md](./docs/ENVIRONMENTS.md) — entornos existentes y sus diferencias.
- [docs/OBSERVABILITY.md](./docs/OBSERVABILITY.md) — estado real de logs/métricas/alertas.
- [docs/VERSIONING.md](./docs/VERSIONING.md) — política de versionado semántico.
- [docs/MIGRATIONS.md](./docs/MIGRATIONS.md) — notas de migración entre versiones mayores (aún no aplica).
- [docs/UI_COMPONENTS.md](./docs/UI_COMPONENTS.md) — por qué no aplica un catálogo de componentes (Storybook) hoy.
- [docs/COMPLIANCE.md](./docs/COMPLIANCE.md) — evaluación preliminar de compliance y normativas.
- [docs/PALETA_COLORES.md](./docs/PALETA_COLORES.md) — paleta de colores de marca (Polaria).
- [docs/DOCUMENTATION_CHECKLIST.md](./docs/DOCUMENTATION_CHECKLIST.md) — checklist maestra: estado de los 20 puntos del estándar de documentación.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — cómo contribuir código y documentación a este repositorio.
- [CHANGELOG.md](./CHANGELOG.md) — historial de cambios por versión.
- [CLAUDE.md](./CLAUDE.md) — guía de arquitectura orientada a trabajar con Claude Code en este repositorio.

## Troubleshooting rápido

**1. El servidor termina apenas lo arrancás, con `Falta la variable de entorno OPENAI_API_KEY`**
Causa: no existe `backend/.env` o no tiene `OPENAI_API_KEY` definida. `backend/src/server.ts` valida esa variable antes de levantar Express y hace `process.exit(1)` si falta.
Solución: crear/editar `backend/.env` y agregar `OPENAI_API_KEY=sk-...` con una key válida de [platform.openai.com](https://platform.openai.com/api-keys). Volver a correr `npm run dev`.

**2. Al generar una vista previa o un PDF falla con un error de Playwright del estilo `browserType.launch: Executable doesn't exist at ...`**
Causa: Chromium no se descargó (el `postinstall` de `npm install` no corrió o falló, por ejemplo por una conexión cortada).
Solución: desde `backend/`, correr manualmente:
```bash
npx playwright install chromium
```
Verificar que termina sin errores y volver a intentar la generación del PDF.

**3. `POST /api/sprint-fin/preview` o `POST /api/sprint-fin/pdf` devuelve `400` con `code: "VALIDATION_ERROR"`**
Causa: el JSON enviado en `body.datos` (o en el body directo) no cumple el schema Zod del tipo de documento (`EpicaSchema`, `SprintInicioSchema` o `SprintSchema` de `sprint-fin`) — por ejemplo, falta un campo obligatorio, un `status` de issue con un valor fuera de `Todo/In Progress/In Review/Done/Cancelled`, o un texto que excede el rango de caracteres del campo.
Solución: revisar el campo `details` de la respuesta (es el `.flatten()` de Zod: indica exactamente qué campo falló y por qué) y corregir ese campo en el JSON antes de reintentar. El JSON extraído por la IA siempre es editable en el frontend antes de generar el PDF.

**4. `EADDRINUSE: address already in use :::3001` al correr `npm run dev`**
Causa: ya hay otro proceso escuchando en el puerto 3001 (por ejemplo, otra instancia de este mismo backend corriendo en paralelo).
Solución: cerrar el proceso que ocupa el puerto, o levantar este con otro puerto: `PORT=3002 npm run dev` (Windows PowerShell: `$env:PORT=3002; npm run dev`).

**5. Al subir un archivo en el formulario de extracción, responde `400` con `code: "UPLOAD_ERROR"` y `"Error al procesar el archivo subido."`**
Causa: el archivo no termina en `.md` o no tiene un `mimetype` de texto (`multer` lo rechaza en el `fileFilter` de `backend/src/server.ts`), o pesa más de 2 MB (límite fijo del `multer`).
Solución: verificar que el archivo subido sea un `.md` de texto plano y pese menos de 2 MB.
