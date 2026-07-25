# Runbooks de operación — Polaria PDF Generator

> Estado real del proyecto (2026-07-13): no existe pipeline de CI/CD, no existe entorno de staging ni un deploy productivo definido. El único despliegue documentado hoy es `npm run build && npm start` corriendo en la misma máquina donde se opera (local o un servidor que el equipo levante a mano). Ver `docs/ENVIRONMENTS.md` para el detalle de entornos y `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md` para el plan de exposición pública (todavía no implementado). Este documento asume ese contexto: no hay Vercel/Railway/Kubernetes de por medio, los pasos son literalmente los comandos que hay que correr en la máquina donde vive el proceso.

Variables de entorno referenciadas en los runbooks (`OPENAI_API_KEY`, `PORT`, `API_KEY`): ver `docs/ENV_VARS.md` para el detalle completo de cada una (requerida/opcional, formato, dónde se define).

---

## 1. Deploy / arranque del servidor

**Objetivo**: levantar el backend (Express + Playwright) para servir la API y el frontend estático.
**Cuándo usarlo**: primer arranque en una máquina nueva, o después de un cambio de código que ya está mergeado y probado localmente.
**Tiempo estimado**: 3-5 minutos (incluye la descarga de Chromium la primera vez).

### Prerrequisitos
- Node.js instalado (versión compatible con `typescript@5.6` y `playwright@1.48`, ver `backend/package.json`).
- Acceso al repositorio (`git pull` de la rama a desplegar).
- El archivo `backend/.env` existe y tiene `OPENAI_API_KEY` definida (ver `docs/ENV_VARS.md`). Sin esto el proceso no arranca — es una validación explícita en `backend/src/server.ts` líneas 9-14.

### Pasos

**Paso 1: Instalar dependencias**
```bash
cd backend
npm install
```
Resultado esperado: `npm install` termina sin errores. El script `postinstall` corre automáticamente `playwright install chromium` — la primera vez descarga el binario de Chromium (puede tardar 1-2 minutos según la conexión). Si ya existe en el cache de Playwright, es casi instantáneo.

**Paso 2: Compilar TypeScript**
```bash
npm run build
```
Resultado esperado: no hay salida de errores de `tsc`; se genera la carpeta `backend/dist/` con el JS compilado (incluye `dist/server.js`, que es el entry point de `npm start`).

**Paso 3: Arrancar el proceso**
```bash
npm start
```
Resultado esperado en consola:
```
Servidor de documentos corriendo en http://localhost:3001
```
(o el puerto que tenga `PORT` en `.env`, default `3001`). Si en cambio ves el mensaje `Falta la variable de entorno OPENAI_API_KEY...` seguido de que el proceso termina, ver la sección "Qué hacer si falla" abajo.

### Verificación de éxito
- El log `Servidor de documentos corriendo en http://localhost:<PORT>` aparece y el proceso sigue vivo (no vuelve al prompt).
- `curl http://localhost:<PORT>/api/epica/sample-preview` devuelve HTML (no un error de conexión rechazada).
- Si `API_KEY` está definida en `.env`, el mismo `curl` sin header `X-API-Key` debe devolver `401` con `{"success":false,"code":"UNAUTHORIZED",...}` — confirma que el middleware de auth está activo (ver runbook 5).

### Qué hacer si falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Falta la variable de entorno OPENAI_API_KEY...` y el proceso termina (`process.exit(1)`) | `backend/.env` no existe o no tiene `OPENAI_API_KEY` | Crear/editar `backend/.env` con `OPENAI_API_KEY=sk-...`, volver a correr `npm start`. |
| `Error: Cannot find module './dist/server.js'` (o similar) al hacer `npm start` | Se saltó el `npm run build`, o falló silenciosamente | Correr `npm run build` de nuevo y revisar que no haya errores de compilación de TypeScript antes de reintentar `npm start`. |
| El puerto ya está en uso (`EADDRINUSE`) | Ya hay un proceso escuchando en ese puerto (posiblemente otro `npm run dev`/`npm start` del propio equipo) | Definir otro `PORT` en `.env` o al invocar (`PORT=3002 npm start`), **no matar el proceso existente sin confirmar de quién es** (ver nota en `CLAUDE.md`). |
| Chromium no se descargó (`postinstall` falló silenciosamente, sin conexión a internet en ese momento) | Ver runbook 3 (Playwright/Chromium no arrancó) | Correr `npx playwright install chromium` manualmente dentro de `backend/`. |

### Rollback de este runbook
Si el nuevo build tiene un problema, no hay un mecanismo de rollback automatizado (no hay CI/CD ni versionado de deploys todavía): volver al commit anterior con `git checkout <commit-anterior>` (o `git revert`), repetir Pasos 1-3. Documentar en el próximo punto de la guía de arquitectura si se decide versionar builds de otra forma.

---

## 2. Shutdown ordenado del proceso

**Objetivo**: detener el backend sin dejar renders de PDF a medias ni el proceso de Chromium huérfano.
**Cuándo usarlo**: cualquier apagado planeado (mantenimiento, redeploy, reinicio de la máquina).
**Tiempo estimado**: instantáneo a 10 segundos (ver el `forceExit` de abajo).

### Cómo funciona (ya implementado, no requiere acción manual más allá de la señal)
`backend/src/server.ts` registra handlers para `SIGTERM` y `SIGINT` (líneas 106-107). Al recibir cualquiera de las dos:
1. Loguea `Recibida <signal>, cerrando servidor de forma ordenada...`.
2. Llama a `closeBrowser()` (`backend/src/core/generators/pdf.generator.ts`), que cierra el browser Chromium singleton **solo si llegó a lanzarse** (si nunca hubo un render, no hace nada).
3. Cuando `closeBrowser()` resuelve (o falla — el error se loguea pero no bloquea el shutdown), cierra el servidor HTTP (`server.close()`) y termina el proceso con `process.exit(0)`.
4. Hay un timeout de seguridad de 10 segundos (`forceExit`): si el cierre ordenado se cuelga, fuerza `process.exit(1)` de todas formas para no dejar el proceso colgado indefinidamente.

### Pasos

**Paso 1: Enviar la señal**
```bash
# Si corrés el proceso en foreground, Ctrl+C envía SIGINT directamente.
# Si corre en background, buscar el PID y enviar SIGTERM:
kill <PID>
```
Resultado esperado en consola/logs:
```
Recibida SIGTERM, cerrando servidor de forma ordenada...
```

**Paso 2: Esperar el cierre**
No hace falta ninguna acción — esperar a que el proceso termine solo (hasta 10 segundos).

### Verificación de éxito
- El proceso ya no aparece en la lista de procesos (`ps` / Task Manager).
- No queda ningún proceso `chromium`/`chrome` huérfano asociado (si `closeBrowser()` corrió bien, Playwright cierra el browser completo, no solo una pestaña).
- El puerto queda libre (un `curl` inmediato al mismo puerto da "conexión rechazada").

### Qué hacer si falla / si se mata el proceso a la fuerza (`kill -9`)

`kill -9` (o cerrar la ventana/terminal de forma abrupta, o un crash del sistema) **no dispara `SIGTERM`/`SIGINT`** — el proceso Node muere de inmediato sin que corra el handler de `shutdown()`. Consecuencias concretas:
- El proceso de Chromium lanzado por `chromium.launch()` puede quedar huérfano en el sistema (no hay `browser.close()` porque nadie lo llamó). Verificar con el administrador de tareas / `ps aux | grep chrome` y matarlo manualmente si sigue vivo.
- Cualquier render en curso (`page.pdf()` en progreso) se pierde a medias — el cliente que esperaba la respuesta HTTP recibe una conexión cortada, no un error JSON. Es responsabilidad del cliente (frontend o, a futuro, el nodo HTTP Request de n8n) reintentar la request completa; no hay estado parcial que recuperar del lado del servidor.
- Al volver a levantar el proceso (runbook 1), un `chromium.launch()` nuevo se lanza de forma perezosa en el primer request que lo necesite — no hace falta ninguna limpieza manual del lado de la app para que vuelva a funcionar, más allá de matar el proceso huérfano de Chromium si quedó vivo (para no acumular memoria).

**Recomendación**: usar siempre `SIGTERM`/`SIGINT` (Paso 1 de este runbook) en vez de `kill -9`, salvo que el proceso esté genuinamente colgado y no responda a la señal ordenada dentro de los 10 segundos del `forceExit`.

---

## 3. Playwright/Chromium no arranca

**Objetivo**: diagnosticar y resolver el caso en que `chromium.launch()` falla.
**Cuándo usarlo**: los renders de preview/PDF empiezan a fallar todos (no solo uno puntual) con errores relacionados a Chromium/browser, típicamente justo después de un deploy nuevo o un cambio de máquina.
**Tiempo estimado**: 5-15 minutos.

### Síntoma visible en logs
`backend/src/core/generators/pdf.generator.ts` (líneas 68-78) envuelve el `chromium.launch()` en un `browserPromise` cacheado. Si el `launch()` falla:
- El error se propaga hasta el `catch` del handler de la ruta (`/api/:docType/pdf` o `/api/:docType/preview`), que loguea `Error en /api/<docType>/pdf: <error>` en la consola del servidor (ver `document.routes.ts` líneas 205-207) y responde `500 INTERNAL_ERROR` al cliente.
- El error real de Playwright (ej. `browserType.launch: Executable doesn't exist at ...` o `Failed to launch chromium`) queda en el log del servidor, no en la respuesta HTTP (la respuesta siempre es el mensaje genérico `"Error al generar PDF."` — por diseño, para no filtrar detalles internos a un caller externo).
- Importante: el código **ya reintenta solo** en el próximo request. El `.catch()` del `browserPromise` (línea 70-75) limpia `browserPromise = null` ni bien el `launch()` falla, así que no queda una promesa rota cacheada — el siguiente request que llegue vuelve a intentar `chromium.launch()` desde cero. Esto significa que un fallo transitorio (ej. recursos momentáneamente agotados) puede autorresolverse solo con el siguiente request, sin reiniciar el proceso.

### Pasos de diagnóstico

**Paso 1: Revisar el log completo del servidor**
Buscar la línea `Error en /api/.../pdf:` (o `/preview:`) inmediatamente seguida del stack trace de Playwright. El mensaje típico si el binario no está instalado:
```
browserType.launch: Executable doesn't exist at .../chromium-XXXX/chrome.exe
```

**Paso 2: Verificar que Chromium está instalado**
```bash
cd backend
npx playwright install chromium
```
Resultado esperado: si ya estaba instalado, termina casi al instante confirmando que está presente; si no, lo descarga (puede tardar 1-2 minutos) e imprime la ruta donde quedó instalado.

**Paso 3: Reintentar un render**
Sin reiniciar el proceso (el `browserPromise` ya se limpió solo tras el fallo — Paso 3 de este runbook no requiere reinicio salvo que el Paso 2 haya instalado Chromium por primera vez en esa máquina, en cuyo caso sí conviene reiniciar el proceso para descartar cualquier estado en memoria):
```bash
curl http://localhost:<PORT>/api/epica/sample-preview
```
Resultado esperado: HTML de vuelta, no un 500.

### Qué hacer si falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Executable doesn't exist at ...` | Chromium nunca se instaló (falló el `postinstall` del `npm install`, ej. sin conexión a internet en ese momento) | `npx playwright install chromium` (Paso 2). |
| `Failed to launch chromium: spawn ENOMEM` o similar | La máquina se quedó sin memoria para lanzar un proceso Chromium completo | Revisar cuántos renders concurrentes hay en curso (`MAX_CONCURRENT_RENDERS`, runbook 4) y la memoria disponible de la instancia; considerar bajar `MAX_CONCURRENT_RENDERS` en `pdf.generator.ts` si la máquina es modesta (1-2 vCPU, según el comentario del propio archivo). |
| El error se repite en cada request nuevo, no se autorresuelve | El problema es persistente (falta el binario, permisos de ejecución, etc.), no transitorio | Seguir Pasos 1-3 completos; si persiste tras reinstalar Chromium, revisar permisos de ejecución del binario descargado en esa máquina. |

### Verificación de éxito
`GET /api/<docType>/sample-preview` (cualquier `docType` registrado) devuelve HTML 200, y un `POST /api/<docType>/pdf` con datos válidos devuelve un PDF binario (`Content-Type: application/pdf`), no un 500.

---

## 4. Renders fallando por timeout (`RENDER_TIMEOUT_MS`)

**Objetivo**: distinguir un timeout esperado de una señal de problema real en la cola de renders.
**Cuándo usarlo**: empiezan a aparecer errores 500 en `/preview` o `/pdf` con mensajes de timeout en el log del servidor.
**Tiempo estimado**: 10-20 minutos de diagnóstico.

### Contexto (config actual)
`backend/src/core/generators/pdf.generator.ts`:
- `RENDER_TIMEOUT_MS = 15_000` (línea 137) — aplica tanto a `page.setContent(...)` (carga del HTML, incluyendo fuentes de Google Fonts/Tabler Icons desde CDN) como a `page.pdf()` (vía el wrapper `withTimeout`, líneas 146-162, porque `page.pdf()` no expone un `timeout` nativo).
- `MAX_CONCURRENT_RENDERS = 4` (línea 105) — cualquier request que llega cuando ya hay 4 renders en curso espera en `waitQueue` (líneas 107-120) hasta que se libera un slot.
- El mensaje de error que aparece en el log es literalmente: `Timeout de 15000ms superado en page.pdf()` (o el timeout propio de `setContent`, que Playwright reporta con su propio formato).

### Síntoma en logs
`Error en /api/sprint-fin/pdf: Error: Timeout de 15000ms superado en page.pdf()` (o similar para `setContent`), seguido de la respuesta `500 INTERNAL_ERROR` al cliente.

### Diagnóstico: ¿esperado o problema real?

| Señal | Interpretación | Acción |
|---|---|---|
| El timeout ocurre en un documento puntual conocido por ser grande (ej. `sprint`/`detail` con muchos issues, o un `epica` con muchas épicas) | **Esperado.** El PDF generator ya auto-ajusta el alto (`finalHeight`, líneas 195-196) para no recortar contenido, pero eso implica más tiempo de layout/rasterizado en documentos grandes; con suficiente volumen puede superar los 15s. | No es un bug. Si se vuelve frecuente para ese tipo de documento, evaluar subir `RENDER_TIMEOUT_MS` (con el equipo, no unilateralmente — ver "Instrucciones para Claude" en `CLAUDE.md` sobre avisar antes de cambios de arquitectura) o dividir el documento. |
| Varios requests distintos (de tamaño normal, ya generados sin problema antes) empiezan a fallar por timeout al mismo tiempo | **Señal de cola saturada.** Con `MAX_CONCURRENT_RENDERS = 4`, un request que entra a la cola cuando ya hay 4 activos espera sin límite de tiempo en `waitQueue` — si la espera en cola más el render real supera los 15s del propio render, el timeout dispara aunque el documento individual sea liviano. | Revisar cuántos requests concurrentes está recibiendo el servidor en ese momento (¿un pico real de tráfico? ¿un cliente reintentando en loop tras un error?). Si el volumen esperado de uso concurrente creció, considerar subir `MAX_CONCURRENT_RENDERS` (con cuidado: cada slot activo es un `BrowserContext`/`Page` sobre el mismo browser, consume memoria/CPU — el comentario del propio archivo asume "una instancia modesta, 1-2 vCPU"). |
| El timeout ocurre en la carga inicial (`setContent`), no en `page.pdf()` | Las plantillas cargan Google Fonts y Tabler Icons desde CDNs externos — si esos CDNs están lentos/caídos, `waitUntil: "load"` puede tardar más de lo normal. | Verificar conectividad saliente de la máquina a `fonts.googleapis.com`/`tabler-icons` (o el CDN que use la plantilla). Si es un problema recurrente de red, evaluar self-hosting de esos assets (fuera de alcance de este runbook — requeriría cambio de plantilla). |
| Timeouts que empiezan justo después de un deploy/cambio de máquina, sin relación al tamaño del documento ni a concurrencia | Puede ser el mismo problema del runbook 3 (Chromium con problemas de arranque/performance en esa máquina) manifestándose como timeout en vez de fallo de `launch()`. | Descartar primero el runbook 3. |

### Verificación de éxito
Repetir el mismo request que falló (mismo `docType`/plantilla/datos) en un momento de baja concurrencia. Si responde 200 con el PDF esperado, el timeout anterior fue transitorio (cola saturada o CDN lento); si vuelve a fallar consistentemente, es un problema real de tamaño de documento o de la máquina (seguir la tabla de arriba).

### Qué NO hacer
No subir `RENDER_TIMEOUT_MS` como primera reacción sin antes revisar si el patrón es "documento grande puntual" vs. "cola saturada" — son causas distintas con soluciones distintas, y `CLAUDE.md` pide explícitamente no tocar `pdf.generator.ts` sin mantener la regla de `await page.pdf()` antes de cerrar el `context`/browser (ver runbook 2 y el comentario en el propio archivo, líneas 198-204).

---

## 5. Checklist mínimo antes de exponer el backend públicamente (túnel o deploy para n8n)

**Objetivo**: no exponer una URL pública del backend sin autenticación mínima.
**Cuándo usarlo**: antes de levantar un túnel (Cloudflare Tunnel, ngrok, etc.) o un deploy real que le dé al backend una URL alcanzable desde internet — el caso concreto hoy es el workflow de n8n en la nube descrito en `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`, que necesita llamar a `POST /api/sprint-fin/pdf` desde fuera de la red local.

> **Estado actual: esto todavía NO está implementado como despliegue real.** El middleware de auth (`apiKeyAuth` en `backend/src/api/document.routes.ts`, líneas 55-75) ya existe en el código y es condicional: si `API_KEY` no está definida en `.env`, no valida nada (deja pasar todo, que es el comportamiento actual en local). Este checklist es lo mínimo que hay que hacer **antes** de que ese backend sea alcanzable desde internet — no antes de simplemente correrlo en local.

### Checklist (todos los ítems son obligatorios, no opcionales, antes del primer request público)

1. **Definir `API_KEY` en el `.env` del backend que se va a exponer.**
   Verificación: `grep API_KEY backend/.env` muestra un valor no vacío. Sin esto, `apiKeyAuth` queda en modo no-op (línea 63-66 de `document.routes.ts`) y cualquiera con la URL puede llamar a la API sin restricción.

2. **Confirmar que el middleware bloquea sin el header correcto.**
   ```bash
   curl -i https://<url-publica>/api/sprint-fin/sample-preview
   ```
   Resultado esperado: `401` con body `{"success":false,"code":"UNAUTHORIZED","message":"API key invalida o faltante."}`.

   ```bash
   curl -i https://<url-publica>/api/sprint-fin/sample-preview -H "X-API-Key: <valor-correcto>"
   ```
   Resultado esperado: `200` con HTML.

3. **Configurar el mismo valor de `API_KEY` en el consumidor (n8n).**
   Según `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md` (Decisión confirmada #1), el nodo HTTP Request de n8n debe enviar el header `X-API-Key` con ese valor en cada request a `POST /api/sprint-fin/pdf`. Guardarlo como credential/variable de entorno en n8n (`PDF_API_KEY`), nunca hardcodeado en el nodo.

4. **No reusar la `API_KEY` de un entorno expuesto en el `.env` local/dev.**
   Si en algún momento existe más de un entorno con `API_KEY` definida, cada uno debe tener su propio valor (mismo principio que separar credenciales entre entornos, ver `docs/ENVIRONMENTS.md`).

5. **Confirmar que la cola de renders sigue acotada.**
   `MAX_CONCURRENT_RENDERS = 4` (ver runbook 4) sigue aplicando igual para tráfico público que para el frontend local — un endpoint público sin este límite sería trivialmente agotable con requests concurrentes; el límite ya existe en el código, no hay que agregar nada, solo confirmar que no se subió sin criterio antes de exponer.

6. **No exponer sin los pasos 1-3 completos.** Esto es explícito en el propio plan (`docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`, Contexto y decisiones ya tomadas): *"un endpoint público sin auth, respaldado por solo 4 renders concurrentes, es trivialmente agotable"*.

### Verificación de éxito del checklist completo
- `API_KEY` definida en el `.env` de la instancia expuesta.
- Un request sin `X-API-Key` a la URL pública devuelve `401`.
- Un request con el `X-API-Key` correcto devuelve `200`/PDF según el endpoint.
- El consumidor (n8n) tiene el mismo valor configurado como credential/variable, no hardcodeado en el workflow.

### Qué hacer si falla
Si un request público con el header correcto sigue devolviendo `401`: comparar bytes exactos del valor en `.env` del backend contra el valor configurado en n8n (`compararEnTiempoConstante` en `document.routes.ts` línea 46-53 rechaza si difieren en longitud o contenido — un espacio de más o un salto de línea al copiar/pegar es la causa más común).

### Nota sobre alcance
Este checklist cubre solo el mínimo de autenticación por API key. La resolución de la URL pública en sí (deploy real vs. túnel tipo Cloudflare Tunnel/ngrok) es un prerrequisito separado, todavía sin resolver — ver `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`, sección "Próximos pasos", ítems 1-2, y `docs/ENVIRONMENTS.md` para el estado planeado de ese entorno.
