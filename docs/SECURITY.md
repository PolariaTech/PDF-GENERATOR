# Seguridad y autenticación — Polaria PDF Generator

> Documento de estado actual. Describe lo que el sistema implementa hoy, con honestidad
> sobre lo que falta. No es una aspiración ni un diseño objetivo — si algo dice "no
> existe", es literal: no está implementado, no está planeado con fecha, y no debe
> asumirse como control de seguridad hasta que se implemente.
>
> Última revisión: 2026-07-13, contra el código real de `backend/src/api/document.routes.ts`,
> `backend/src/server.ts` y `backend/src/core/ai/extractor.service.ts`.

## Resumen ejecutivo

Este backend nació para uso local/interno (un usuario abriendo `frontend/index.html` contra
`localhost:3001`). Recientemente se le agregó un middleware de API key para poder exponerlo
con una URL pública y que un workflow de n8n lo invoque (ver
`docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`). El modelo de seguridad resultante es intencionalmente simple:
**un secreto compartido, sin roles, sin usuarios, sin rate limiting**. Es adecuado para el caso
de uso actual (equipo pequeño, un solo consumidor automatizado) pero **no es un modelo
multi-tenant ni de cara a usuarios finales no confiables**. Cualquier plan de exponer este
backend a una audiencia más amplia que "el equipo de Polaria + un workflow de n8n" requiere
revisar este documento primero.

---

## 1. Modelo de autenticación

### Mecanismo: API key única, condicional, por header

El único control de acceso del backend es el middleware `apiKeyAuth`, definido en
`backend/src/api/document.routes.ts` (líneas 55-75) y montado en `backend/src/server.ts` línea 40:

```ts
app.use("/api", apiKeyAuth);
app.use("/api/:docType/extraer", upload.single("archivo"));
app.use("/api", documentRouter);
```

Puntos clave, tal como está implementado hoy:

- **Es condicional (no-op por defecto).** Si la variable de entorno `API_KEY` no está definida
  en `backend/.env`, `apiKeyAuth` llama a `next()` inmediatamente y no valida nada — el
  comportamiento actual en desarrollo/uso local, donde no hay `API_KEY` configurada.
- **Se activa solo cuando `API_KEY` existe en el entorno.** En ese momento, cada request a
  cualquier ruta bajo `/api` (los 4 endpoints, para cualquier `docType`) debe incluir el header
  `X-API-Key` con un valor idéntico al de `API_KEY`. Si falta el header o no coincide, la
  respuesta es `401 UNAUTHORIZED` con el cuerpo estándar de error (`{ success: false, code:
  "UNAUTHORIZED", message: "API key invalida o faltante." }`).
- **Protege el backend completo, no un endpoint aislado.** El middleware se monta a nivel de
  `/api` antes del router, así que cubre `sample-preview`, `extraer`, `preview` y `pdf` por
  igual, y se ejecuta **antes** de que multer procese cualquier archivo subido — un caller sin
  API key válida no llega a que el servidor gaste ciclos parseando su upload.
- **Comparación en tiempo constante.** `compararEnTiempoConstante()` (líneas 46-53) usa
  `crypto.timingSafeEqual` en vez de `===`, para que la duración de la comparación no filtre por
  timing cuántos caracteres iniciales de la key acertó un atacante. El chequeo de longitud
  (`bufA.length !== bufB.length`) se hace antes y por fuera de `timingSafeEqual` — es necesario
  porque esa función lanza si los buffers difieren en longitud, y descartarlo antes no reintroduce
  el problema de timing porque la longitud de una API key no es información sensible por sí sola
  (a diferencia de su contenido carácter a carácter).
- **No hay tokens con expiración, ni renovación, ni invalidación.** No es JWT ni sesión: es un
  secreto estático que vive en `.env` y se compara en cada request. "Renovar" o "invalidar" la
  key significa editar `backend/.env` y reiniciar el servidor — no hay mecanismo de revocación en
  caliente, ni lista de keys revocadas, ni expiración temporal.
- **Un solo secreto compartido, no credenciales por consumidor.** No hay forma de distinguir "el
  workflow de n8n" de "cualquier otro caller que conozca la key" — todos comparten el mismo
  valor de `API_KEY`. Si se necesita revocar el acceso de un consumidor específico sin afectar a
  los demás, este mecanismo no lo permite (ver `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`, decisión 1, donde
  esto ya se identificó como limitación conocida y aceptada para el pilot).

### Cuándo se activa en la práctica

Pensado específicamente para el escenario descrito en `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`: el backend
se expone con una URL pública (deploy real o túnel tipo Cloudflare Tunnel/ngrok) para que un
workflow de n8n en la nube pueda llamar a `POST /api/sprint-inicio/pdf` o `/api/sprint-fin/pdf`. En ese escenario, definir
`API_KEY` en el `.env` de esa instancia es el control mínimo para que la URL pública no quede
abierta a cualquiera que la descubra.

### Limitación conocida y explícita: el frontend NO envía el header

`frontend/index.html` (el único cliente humano del sistema) hoy **no envía el header
`X-API-Key`** en ninguna de sus llamadas a `/api/*`. Esto es una limitación real, no un
detalle menor:

- Si se define `API_KEY` en una instancia que **también** sirve `frontend/index.html` a usuarios
  reales (recordar que `server.ts` línea 46 sirve el frontend estático desde el mismo Express),
  **el frontend se rompe**: todas sus llamadas a `/api/*` recibirán `401 UNAUTHORIZED` porque no
  mandan el header.
- Por diseño actual, `API_KEY` solo debería definirse en instancias pensadas para ser consumidas
  por un caller que sí sabe mandar el header (como el workflow de n8n), no en la instancia que
  el equipo usa día a día desde el navegador — o bien habría que actualizar primero
  `frontend/index.html` para que incluya el header (con la key inyectada de forma segura, no
  hardcodeada en el HTML servido públicamente, lo cual es un problema de diseño en sí mismo si el
  frontend se sirve a usuarios no confiables).
- **No se implementó ningún mecanismo para resolver esto** (ni un endpoint de login, ni
  inyección de la key en el HTML servido, ni un proxy intermedio). Queda como trabajo pendiente
  si se decide exponer con `API_KEY` activa una instancia que sirve el frontend a usuarios reales.

---

## 2. Modelo de autorización

**No existe un modelo de autorización.** No hay roles, no hay usuarios, no hay permisos
granulares por recurso o acción. La única decisión binaria es "¿tiene la API key correcta o
no?" — quien la tiene puede invocar los 4 endpoints, para cualquier `docType` registrado, sin
distinción.

No aplica una tabla RBAC porque no hay roles que documentar: el sistema tiene efectivamente un
solo "rol" implícito (poseedor de la API key = acceso total a generar/previsualizar documentos),
sin diferenciación entre, por ejemplo, "puede generar PDFs de épica" vs "puede generar PDFs de
sprint", ni entre lectura (`sample-preview`) y escritura/generación (`pdf`).

Si en el futuro se necesita distinguir consumidores (p. ej. n8n solo puede llamar a
`/api/sprint-inicio/pdf`/`/api/sprint-fin/pdf`, pero no a otros `docType`), eso requiere diseño nuevo — no está ni parcialmente
implementado hoy.

---

## 3. Superficie de ataque real

Los 4 endpoints son, por diseño, públicos una vez que el backend tiene una URL alcanzable:

| Endpoint | Método | Qué hace | Auth |
|---|---|---|---|
| `/api/:docType/sample-preview` | GET | Devuelve HTML de ejemplo (sin IA) | `apiKeyAuth` si `API_KEY` está definida |
| `/api/:docType/extraer` | POST | Sube un `.md`, llama a OpenAI, devuelve JSON estructurado | ídem |
| `/api/:docType/preview` | POST | Valida JSON contra el schema Zod, devuelve HTML | ídem |
| `/api/:docType/pdf` | POST | Igual que preview, devuelve el PDF binario | ídem |

Puntos relevantes de la superficie expuesta:

- **CORS restringido a un allowlist.** `server.ts` monta `cors()` con una función `origin()` que
  solo permite: requests sin header `Origin` (curl, o un caller servidor-a-servidor como n8n, que
  no aplica CORS), el origen `"null"` que mandan los navegadores cuando `frontend/index.html` se
  abre como `file://`, y `http://localhost:{PORT}`/`http://127.0.0.1:{PORT}` (el mismo puerto que
  sirve el backend). Configurable con la variable opcional `CORS_ORIGIN` (lista separada por
  comas) si se necesita agregar otro origen — ver `docs/ENV_VARS.md`. Cualquier otro origen recibe
  un error de CORS del lado del navegador. Antes de este cambio era `cors()` sin opciones
  (refleja cualquier origen, equivalente a `*`); se corrigió porque cualquier página web podía
  hacer fetch al backend desde el navegador de un usuario con la API key, o sin restricción alguna
  si `API_KEY` no estaba definida.
- **Costo de OpenAI como vector de abuso.** `/api/:docType/extraer` dispara una llamada real a
  la API de OpenAI (`extractor.service.ts`) por cada request válida. Sin rate limiting (ver
  sección 5), un caller con la API key (o cualquier caller si `API_KEY` no está definida) puede
  generar costo de OpenAI arbitrario simplemente repitiendo requests con archivos `.md`
  pequeños válidos. Este es probablemente el vector de abuso de mayor impacto económico hoy.
- **Generación de PDF como vector de agotamiento de recursos.** `/api/:docType/pdf` lanza un
  Chromium headless por request (`pdf.generator.ts`). El `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md` (sección
  de contexto) menciona una cola de máximo 4 renders concurrentes y un timeout duro de 15s
  (`RENDER_TIMEOUT_MS`) como mitigación de recursos a nivel de proceso — pero esto es un límite
  de capacidad interno, no una defensa contra abuso: no impide que un mismo caller sature esa
  cola de 4 slots con requests repetidas y deje al resto (incluido el uso legítimo) esperando o
  fallando por timeout.
- **Sin distinción de `docType` por consumidor.** Cualquier caller con la API key puede invocar
  cualquier `docType` registrado (`epica`, `sprint`, y los que se agreguen), no solo el que un
  workflow específico debería usar.

### Upload de archivos (`multer`, definido en `server.ts` líneas 24-33)

Lo que **sí** valida:

- **Extensión y mimetype declarado**: acepta el archivo si `originalname` termina en `.md`
  (case-insensitive) **o** el mimetype es `text/markdown` **o** `text/plain`. Es una condición
  OR, no AND — un archivo con extensión `.md` pero mimetype distinto igual pasa, y viceversa.
- **Tamaño**: límite duro de 2 MB (`fileSize: 2 * 1024 * 1024`).
- Cualquier archivo que no cumpla se rechaza con `ArchivoInvalidoError`, capturado por el
  error-handler de Multer en `server.ts` (líneas 52-66) y respondido como `400 UPLOAD_ERROR`
  (o `413` si excede el tamaño).

Lo que **no** valida (y no está implementado, no es un olvido de documentación):

- **No hay validación de contenido/magic bytes.** El `fileFilter` de multer confía en
  `originalname` y `mimetype`, ambos controlados por el cliente que hace el upload — un caller
  puede nombrar cualquier archivo `algo.md` y declarar el mimetype que quiera; el backend no abre
  el archivo para confirmar que su contenido es texto plano/Markdown antes de aceptarlo.
- **No hay escaneo de malware/antivirus** sobre el archivo subido.
- **Mitigante real**: el archivo nunca se ejecuta ni se interpreta como código en el servidor.
  `document.routes.ts` línea 130 hace `req.file.buffer.toString("utf-8")` y ese string se manda
  tal cual como contenido de un mensaje a la API de OpenAI (`extractor.service.ts`, `messages:
  [{ role: "user", content: markdown }]`). Es decir, el "peor caso" de un archivo malicioso hoy
  es: (a) consumir el límite de 2 MB de memoria/red, y (b) ser interpretado por el modelo de
  OpenAI como texto de entrada (superficie de prompt injection contra el propio
  `systemPrompt` del `docType`, no de ejecución de código en el servidor). No hay riesgo de
  path traversal ni de escritura en disco: el archivo se procesa en memoria (`multer` con
  storage en memoria, buffer) y no se persiste en el filesystem del servidor.
- **No hay límite de requests/tiempo para el endpoint de upload** más allá del límite de tamaño
  por archivo (ver sección 5, rate limiting).

---

## 4. Gestión de secretos

| Secreto | Dónde vive | Quién lo usa | Rotación |
|---|---|---|---|
| `OPENAI_API_KEY` | `backend/.env` (no versionado). Leída en `extractor.service.ts` línea 16 vía `process.env.OPENAI_API_KEY`, pasada al SDK oficial de OpenAI. `server.ts` líneas 9-14 aborta el arranque del proceso (`process.exit(1)`) si falta, con un mensaje explícito en consola — no hay forma de que el servidor corra sin ella. | El proceso backend, para llamar a `openai.beta.chat.completions.parse` en `/api/:docType/extraer`. | **No definida.** No hay política de rotación documentada ni automatizada. Rotar hoy significa: generar una key nueva en OpenAI Platform → reemplazar el valor en `backend/.env` → reiniciar el proceso. Rotar si hay sospecha de exposición (ej. se filtró un commit, un log, o una captura de pantalla). |
| `API_KEY` | `backend/.env` (no versionado). Leída en `document.routes.ts` línea 62 vía `process.env.API_KEY`, comparada contra el header `X-API-Key` en cada request a `/api/*`. Opcional: si no está definida, `apiKeyAuth` es no-op (ver sección 1). | Cualquier caller externo que necesite pasar `apiKeyAuth` (hoy, el workflow de n8n descrito en `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`). | **No definida.** Mismo estado que `OPENAI_API_KEY`: sin política de rotación, sin expiración. Como es un secreto único compartido entre todos los consumidores (ver sección 2), rotarla implica actualizar el `.env` del backend **y** el valor configurado en cada consumidor (ej. la variable `PDF_API_KEY` en n8n) al mismo tiempo, o hay una ventana donde el consumidor legítimo también queda bloqueado. |

Puntos de higiene verificados en este documento:

- **`backend/.env` está en `.gitignore`.** Verificado: el `.gitignore` en la raíz del repo
  incluye la línea `.env` (línea 3), y `git check-ignore -v backend/.env` confirma que esa regla
  cubre `backend/.env` específicamente. Ningún secreto real de este proyecto vive en el
  historial de git por esta vía.
- **Ningún secreto está hardcodeado en el código fuente.** Tanto `OPENAI_API_KEY` como `API_KEY`
  se leen exclusivamente de `process.env`; no hay valores por defecto ni fallback hardcodeado en
  `extractor.service.ts` ni en `document.routes.ts`.
- **`backend/.env.example` existe** con las claves `OPENAI_API_KEY`, `PORT`, `API_KEY` y
  `CORS_ORIGIN` (todas sin valores reales) — ver `docs/ENV_VARS.md` para el detalle de cada una.
- **Los secretos no se loguean.** El error-handler genérico de `server.ts` (líneas 71-81) y el
  patrón de `sendError` en `document.routes.ts` devuelven mensajes genéricos al cliente; el
  `console.error` de cada ruta loguea el objeto de error de la operación fallida (ej. errores de
  OpenAI, de Zod, de Playwright), no las variables de entorno. No se detectó ningún punto donde
  `OPENAI_API_KEY` o `API_KEY` se incluyan en una respuesta HTTP o en un log — pero tampoco hay
  un mecanismo automatizado (linter, test) que garantice que un cambio futuro no introduzca esa
  fuga; es una invariante que depende de revisión de código.

---

## 5. Qué NO existe hoy (deuda de seguridad explícita)

Listado deliberadamente honesto — cada ítem es una ausencia real, no un control implementado de
forma parcial:

- **No hay rate limiting.** Ningún endpoint (`sample-preview`, `extraer`, `preview`, `pdf`) tiene
  límite de requests por IP, por API key o por ventana de tiempo. Combinado con el costo de
  OpenAI en `/extraer` y el costo de cómputo de Chromium en `/pdf`, esta es probablemente la
  brecha de mayor impacto práctico si el backend queda expuesto públicamente sin una capa
  adicional (ver recomendación abajo).
- **No hay roles ni usuarios.** Ver sección 2 — un único secreto compartido, sin granularidad.
- **No hay auditoría de accesos más allá de `console.error`.** Los únicos rastros de actividad
  son los `console.error` que cada ruta emite ante un fallo (con el `docType` en el mensaje, por
  convención del proyecto). No hay log de requests exitosos, no hay quién-hizo-qué-cuándo
  persistente, no hay estructura de log parseable ni retención definida — si la consola del
  proceso no se captura a algún sistema externo, esos logs se pierden al reiniciar el proceso.
- **No hay rotación de la API key definida.** Ni política, ni mecanismo, ni calendario (ver
  sección 4).
- **No hay expiración de la API key** ni de ninguna sesión (no existe el concepto de sesión).
- **No hay CSP, `helmet`, ni cabeceras de seguridad HTTP adicionales.** `package.json` no incluye
  `helmet` ni librerías equivalentes; `server.ts` no setea manualmente cabeceras como
  `X-Content-Type-Options`, `X-Frame-Options` o `Content-Security-Policy` en las respuestas de la
  API (el HTML generado para preview/PDF sí es servido con `Content-Type` correcto, pero eso es
  distinto de cabeceras de defensa en profundidad a nivel de servidor).
- **No hay WAF ni capa de red delante del backend** documentada en este repo — cualquier
  protección de ese tipo (Cloudflare, etc.) dependería de cómo se despliegue la instancia
  expuesta, no de algo que el código del backend provea.

## 6. Procedimiento ante sospecha de brecha (mínimo viable)

No existe un runbook de incident response formal en el repo. Como mínimo, ante sospecha de que
`API_KEY` u `OPENAI_API_KEY` se filtraron (commit accidental, log expuesto, captura de pantalla
compartida, etc.):

1. **Revocar/rotar de inmediato**: generar una `OPENAI_API_KEY` nueva en OpenAI Platform y/o un
   valor nuevo para `API_KEY`, reemplazar en `backend/.env` de la instancia afectada, reiniciar
   el proceso (`npm start` / `npm run dev`).
2. Si se rotó `API_KEY`, actualizar el valor en **todos** los consumidores que la usan (hoy,
   principalmente la variable `PDF_API_KEY` de n8n en `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`) antes o
   inmediatamente después, para minimizar la ventana en que el consumidor legítimo también queda
   bloqueado.
3. Revisar el historial de git con `git log --all -p | grep -E 'API_KEY|OPENAI_API_KEY'` para
   confirmar que el valor filtrado no quedó además commiteado en el repo (más allá del canal por
   el que se sospecha la filtración).
4. Revisar el dashboard de uso/facturación de OpenAI Platform por picos anómalos de consumo en la
   ventana de tiempo en que la key pudo estar expuesta.
5. Dado que no hay logs de acceso persistentes (ver sección 5), no hay forma hoy de reconstruir
   con precisión qué requests se hicieron con la key comprometida antes de rotarla — esta es en sí
   misma una limitación a resolver si el backend pasa a manejar datos más sensibles.

Este procedimiento es deliberadamente mínimo porque las herramientas para uno más completo (logs
persistentes, alertas, revocación granular) no existen todavía; ampliarlo sin antes construir esa
base sería documentar un proceso que el sistema no puede sostener en la práctica.

## 7. Datos sensibles

- El sistema procesa contenido de documentos internos de Polaria (resúmenes de épicas y sprints:
  nombres de personas, objetivos, horas trabajadas, estado de proyectos). No procesa
  credenciales, datos financieros de terceros ni PII de clientes externos, hasta donde reflejan
  los schemas actuales (`EpicaSchema`, `SprintSchema`).
- Ese contenido se envía a la API de OpenAI como parte del prompt de extracción
  (`extractor.service.ts`) — está sujeto a la política de retención/uso de datos de OpenAI
  Platform (distinta de la política de ChatGPT consumer), no a un almacenamiento propio del
  sistema.
- El backend no persiste los documentos ni los PDFs generados: cada request de `/pdf` genera el
  archivo en memoria y lo devuelve en la respuesta HTTP; no hay base de datos ni almacenamiento
  en disco de los documentos procesados en este repo.

## 8. Vulnerabilidades conocidas y mitigaciones — resumen

| Vulnerabilidad / riesgo | Severidad práctica en el contexto actual | Mitigación existente | Mitigación pendiente |
|---|---|---|---|
| Sin rate limiting en `/extraer` (costo OpenAI) y `/pdf` (costo de cómputo) | Alta si se expone públicamente sin capa adicional | Ninguna a nivel de aplicación; cola interna de máx. 4 renders concurrentes + timeout de 15s en `pdf.generator.ts` (protege el proceso, no previene abuso) | Agregar rate limiting (ej. `express-rate-limit`) por IP y/o por API key antes de exponer públicamente sin una capa externa equivalente |
| CORS | Baja — ya restringido a un allowlist (`localhost`/`127.0.0.1`/`file://`/sin-origen), configurable con `CORS_ORIGIN` | Allowlist en `server.ts` (ver sección 3) | Ampliar el allowlist explícitamente vía `CORS_ORIGIN` si se sirve el frontend desde un dominio distinto |
| API key única sin rotación/expiración | Media | Comparación en tiempo constante (`timingSafeEqual`) mitiga solo el vector de timing attack, no de filtración | Definir política de rotación (sección 4/6) |
| Frontend no envía `X-API-Key` | Alta si se combina `API_KEY` activa + frontend servido a usuarios reales desde la misma instancia | Documentado explícitamente (sección 1) para evitar que alguien la active sin saberlo | Actualizar `frontend/index.html` para enviar el header, o servir el frontend desde una instancia separada sin `API_KEY` |
| Upload sin validación de contenido (solo extensión/mimetype declarado) | Baja — el archivo nunca se ejecuta, solo se lee como texto hacia OpenAI | Límite de tamaño (2 MB), lectura en memoria sin persistencia en disco | Ninguna planeada; se considera aceptable dado que no hay ejecución ni escritura en disco del contenido subido |
| Sin auditoría de accesos persistente | Media (dificulta forense post-incidente) | `console.error` por fallo, con `docType` en el mensaje | Log estructurado con retención definida, si el volumen de uso lo justifica |

---

## Referencias cruzadas

- Mecanismo de auth: `backend/src/api/document.routes.ts` (líneas 1-75, `apiKeyAuth` y
  `compararEnTiempoConstante`).
- Montaje del middleware y validación de upload: `backend/src/server.ts` (líneas 1-46).
- Manejo de `OPENAI_API_KEY`: `backend/src/core/ai/extractor.service.ts` (líneas 1-19).
- Contexto de por qué se agregó `API_KEY` y su rol en el workflow de n8n:
  `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md` (Decisión confirmada 1, sección "Contexto y decisiones ya
  tomadas", paso 8 y riesgo 3).
- Convenciones generales del proyecto: `CLAUDE.md` (raíz del repo).
