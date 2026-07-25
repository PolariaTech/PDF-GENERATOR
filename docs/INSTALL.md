# Guía de instalación y ejecución local

**Audiencia**: desarrolladores del equipo de Polaria (o colaboradores externos con acceso al repositorio) que van a correr el backend de generación de PDFs por primera vez en su máquina.

**Objetivo de esta guía**: que puedas tener el proyecto corriendo en `http://localhost:3001` y generando un PDF de ejemplo en **menos de 1 hora**, siguiendo únicamente los pasos de acá abajo, sin tener que preguntarle nada a nadie del equipo. Si en algún paso te trabás y no está resuelto en la sección [Troubleshooting](#troubleshooting-de-instalación), es un bug de esta guía — repórtalo para que se agregue.

Tiempo total estimado: **10-20 minutos** si ya tenés Node.js instalado y una API key de OpenAI a mano; hasta **40-50 minutos** si tenés que instalar Node.js y crear la cuenta/API key de OpenAI desde cero.

## 1. Prerrequisitos

### Herramientas de desarrollo (obligatorias)

| Herramienta | Versión mínima | Cómo verificarla | Instalación |
|---|---|---|---|
| Node.js | 18.x (recomendado 20.x LTS) | `node -v` | [nodejs.org](https://nodejs.org/) — descargar el instalador de la versión LTS |
| npm | 9.x o superior (viene con Node.js) | `npm -v` | Se instala junto con Node.js, no requiere paso aparte |
| Git | cualquier versión reciente | `git --version` | [git-scm.com](https://git-scm.com/downloads) |

> `backend/package.json` no declara un campo `"engines"`, así que npm no bloquea versiones antiguas de Node por sí solo. El mínimo de 18.x es funcional (por Playwright `^1.48.0`, que no soporta versiones anteriores), no impuesto por una herramienta. Esta guía se verificó con Node 20 LTS.

### Cuentas externas necesarias

| Cuenta | Para qué se usa | Obligatoria/opcional |
|---|---|---|
| OpenAI Platform (no la suscripción de ChatGPT Plus) | Genera la API key que el backend usa para extraer y estructurar el Markdown subido (endpoint `/api/:docType/extraer`) | **Obligatoria** para usar la extracción con IA. Sin ella, el servidor ni siquiera arranca (ver paso 6). |

No hay otras cuentas externas (no se usa Firebase, Cloudinary, ni ningún otro servicio en este proyecto).

## 2. Obtener el código

Cloná el repositorio:

```bash
git clone https://github.com/DanielGalvis-Dev/epica-pdf-generator.git
cd epica-pdf-generator
```

Resultado esperado: se crea una carpeta `epica-pdf-generator/` con `backend/`, `frontend/`, `README.md` y `CLAUDE.md` en la raíz.

Si no tenés permisos de acceso al repositorio (error `Repository not found` o `Permission denied`), pedile acceso a quien administre el repo en GitHub antes de continuar — no es un problema de tu instalación local.

## 3. Instalar dependencias

Entrá a `backend/` (todo el código vive ahí; `frontend/` no tiene dependencias propias) e instalá:

```bash
cd backend
npm install
```

**Tiempo aproximado: 1-3 minutos**, según tu conexión — el `postinstall` de este `npm install` corre automáticamente `playwright install chromium`, que descarga el binario de Chromium (varios cientos de MB). No se colgó si tarda; esperá a que vuelva el prompt.

Resultado esperado: vas a ver primero el log normal de `npm install` (algo como `added` seguido de un número de paquetes — en este proyecto son del orden de 150-200 paquetes contando subdependencias), y después el log de descarga de Playwright terminando con algo como:

```
Chromium ... downloaded to ...ms-playwright...
```

Pueden aparecer warnings de dependencias `deprecated` o `peer` en la salida de `npm install` — son normales en este proyecto y se pueden ignorar.

Si ves errores de permisos (`EACCES`) en Mac/Linux: no uses `sudo npm install`. Es señal de que tu instalación global de npm tiene permisos incorrectos; corregilo siguiendo la [guía oficial de npm sobre permisos](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) en vez de forzar con `sudo`.

## 4. Configurar variables de entorno

Este repositorio incluye una plantilla `backend/.env.example` con placeholders (nunca valores reales). Copiala a `backend/.env`:

**Mac/Linux:**
```bash
cp backend/.env.example backend/.env
```

**Windows (PowerShell):**
```powershell
Copy-Item backend\.env.example backend\.env
```

Abrí `backend/.env` con tu editor y reemplazá el placeholder de `OPENAI_API_KEY`:

```bash
OPENAI_API_KEY=sk-...tu-api-key-aqui
```

- `OPENAI_API_KEY` es la única variable **obligatoria** para arrancar el servidor. Sacala de tu cuenta en [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (ver paso 5 si todavía no tenés una).
- `PORT` ya viene con `3001` en la plantilla; cambialo solo si necesitás correr el backend en otro puerto (por ejemplo, si ya tenés algo corriendo en 3001, ver [Troubleshooting](#troubleshooting-de-instalación)).
- `API_KEY` viene vacía en la plantilla — dejala así para uso local. Solo se completa cuando el backend se expone con una URL pública (ver `docs/SECURITY.md`).

Para el detalle completo de cada variable, ver **[docs/ENV_VARS.md](./ENV_VARS.md)** — no se duplica ese detalle acá.

## 5. Configurar servicios externos: obtener la API key de OpenAI

Si todavía no tenés una API key de OpenAI Platform:

1. Entrá a [platform.openai.com](https://platform.openai.com/) e iniciá sesión (o creá una cuenta). **Importante**: esto es distinto de una cuenta de ChatGPT Plus/suscripción — necesitás específicamente acceso a la Platform/API, que factura por uso.
2. Andá a la sección **API keys** ([platform.openai.com/api-keys](https://platform.openai.com/api-keys)).
3. Hacé clic en **Create new secret key**, ponele un nombre (por ejemplo `pdf-generator-local`) y copiá el valor que empieza con `sk-...`. OpenAI solo lo muestra una vez.
4. Verificá que la cuenta tenga saldo o un método de pago cargado en **Billing** — sin eso, las llamadas a la API fallan aunque la key sea válida.
5. Pegá esa key como `OPENAI_API_KEY` en `backend/.env` (paso 4).

Este proyecto usa el modelo `gpt-4o-mini` (definido en `backend/src/constants.ts`, no en `.env`); no hace falta configurar el modelo, solo la key.

## 6. Iniciar el servidor

Desde `backend/`:

```bash
npm run dev
```

**Tiempo aproximado: unos segundos** (usa `ts-node-dev` con auto-reload, sin paso de build previo).

Resultado esperado en la terminal:

```
Servidor de documentos corriendo en http://localhost:3001
```

Si en cambio el proceso termina inmediatamente con `Falta la variable de entorno OPENAI_API_KEY. Definila en backend/.env antes de arrancar el servidor.`, volvé al paso 4 — no completaste `OPENAI_API_KEY` en `backend/.env`.

## 7. Verificar que funciona

1. Abrí **http://localhost:3001** en el navegador. Deberías ver la UI de una sola pantalla con tabs para elegir el tipo de documento (**Épica** / **Sprint**).
2. Elegí un tipo de documento (por ejemplo, **Sprint**). La vista previa de ejemplo debería cargarse sola en el panel, sin subir ningún archivo — esto confirma que `GET /api/sprint-fin/sample-preview` funciona (Express, Handlebars y Playwright están todos operativos).
3. Como verificación directa por línea de comandos, con el servidor corriendo, en otra terminal:

   ```bash
   curl http://localhost:3001/api/epica/sample-preview
   ```

   Resultado esperado: un bloque de HTML (empieza con `<!DOCTYPE html>` o similar), no un error JSON. Si en cambio ves `{"success":false,...}`, revisá el mensaje de `message`/`code` en esa respuesta.
4. (Opcional, para probar el flujo con IA real) En la UI, subí un archivo `.md` de prueba en el tipo de documento elegido. Si `OPENAI_API_KEY` es válida y tiene saldo, vas a ver el JSON extraído para revisar/editar antes de generar el PDF.

Si los pasos 1-3 funcionan, la instalación fue exitosa. No hay credenciales de prueba que configurar: la app corre local, sin sistema de usuarios ni login.

## Troubleshooting de instalación

### `npm install` falla descargando Chromium / se corta el `postinstall`

**Síntoma**: `npm install` termina con un error relacionado a `playwright install chromium`, o el proceso se corta a mitad de la descarga (por ejemplo, por una VPN corporativa o un proxy que bloquea la descarga del binario).

**Causa probable**: sin conexión estable, o una red corporativa/proxy bloqueando la descarga de binarios desde los servidores de Playwright.

**Solución paso a paso**:
```bash
cd backend
npx playwright install chromium
```
Volvé a correr ese comando: es idempotente y podés reintentarlo tantas veces como haga falta. Si tu red corporativa bloquea la descarga, pedile a tu equipo de IT que habilite acceso a los dominios de descarga de Playwright, o corré este paso desde una red sin esa restricción.

**Cómo verificar que se resolvió**: el comando termina sin errores y, al correr `npm run dev` y abrir la vista previa de ejemplo (paso 7), el HTML se renderiza sin que el servidor tire un error de Playwright en consola.

### `EADDRINUSE: address already in use :::3001` al correr `npm run dev`

**Síntoma**: el proceso no arranca y la terminal muestra `Error: listen EADDRINUSE: address already in use :::3001`.

**Causa probable**: ya hay otro proceso escuchando en el puerto 3001 — muy probablemente otra instancia de este mismo backend, tuya o de un compañero, corriendo en paralelo en la misma máquina.

**Solución paso a paso**: arrancá en otro puerto sin tocar el proceso que ya está corriendo (puede ser de otra persona):

- Mac/Linux: `PORT=3002 npm run dev`
- Windows (PowerShell): `$env:PORT=3002; npm run dev`

**Cómo verificar que se resolvió**: la terminal muestra `Servidor de documentos corriendo en http://localhost:3002` (o el puerto que hayas elegido), y esa URL abre la UI normalmente.

### El servidor arranca pero `/extraer` responde `500` o un error de autenticación de OpenAI

**Síntoma**: subís un `.md` en la UI y la extracción falla, o `docker`/consola del backend muestra un error `401`/`Incorrect API key provided` proveniente de la librería `openai`.

**Causa probable**: `OPENAI_API_KEY` está mal copiada (espacio de más, key incompleta) o la cuenta de OpenAI no tiene saldo/billing configurado.

**Solución paso a paso**: revisá `backend/.env`, confirmá que `OPENAI_API_KEY` no tenga espacios ni comillas alrededor del valor, y verificá el saldo/billing en [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing). Reiniciá `npm run dev` después de editar `.env` (las variables de entorno se leen solo al arrancar el proceso).

**Cómo verificar que se resolvió**: subir el mismo `.md` de prueba devuelve el JSON extraído en la UI en vez de un error.

### Node.js instalado pero `npm run dev` falla con errores de sintaxis o de tipos raros

**Síntoma**: errores de compilación de TypeScript que no tienen que ver con tu código, o `ts-node-dev` fallando al arrancar.

**Causa probable**: estás en una versión de Node.js anterior a la mínima funcional (18.x) — Playwright `^1.48.0` y algunas dependencias de tipos no se comportan bien en versiones más viejas.

**Solución paso a paso**: confirmá tu versión con `node -v` y actualizá a 20.x LTS desde [nodejs.org](https://nodejs.org/) si estás por debajo de 18.x.

**Cómo verificar que se resolvió**: `npm run dev` levanta y muestra `Servidor de documentos corriendo en http://localhost:3001` sin errores de compilación.

## Siguiente paso

Con el servidor corriendo, ver el [README.md](../README.md) para el resto del flujo de uso, o [docs/GLOSSARY.md](./GLOSSARY.md) para entender el vocabulario del dominio (`epica`, `sprint`, `agregado`, `plantilla`, etc.) antes de tocar código.
