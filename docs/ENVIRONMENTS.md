# Definición de entornos — Polaria PDF Generator

> **Estado real (2026-07-13): hoy existe un solo entorno.** No hay staging ni producción formales — `CLAUDE.md` es explícito: *"No hay pipeline de CI/CD ni instrucciones de despliegue más allá de `npm run build && npm start`"*. Este documento describe ese único entorno tal como existe hoy, y por separado el entorno público que `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md` necesita para que n8n (en la nube) pueda llamar al backend — ese segundo entorno está **planeado, no implementado**: no tiene URL todavía, no tiene deploy resuelto, y el único trabajo de código que ya existe para soportarlo es el middleware `apiKeyAuth` (condicional, no-op si `API_KEY` no está definida — ver `backend/src/api/document.routes.ts` líneas 55-75).
>
> No se documentan aquí "dev/staging/prod" como si ya existieran: sería inventar infraestructura que este proyecto no tiene. Cuando el equipo decida construir un entorno adicional real, esta tabla es el lugar para agregarlo con su configuración concreta — no antes.

## Tabla de entornos

| Entorno | Propósito | Cómo se levanta | Diferencias de configuración | Estado |
|---|---|---|---|---|
| **Local (dev)** | Único entorno real hoy. Cada desarrollador corre el backend y el frontend en su propia máquina para desarrollar y probar manualmente (incluye generar previews/PDFs de prueba y validar cambios de plantilla). | `cd backend && npm install && npm run dev` (ts-node-dev con auto-reload, puerto `3001` por default). El frontend es un `frontend/index.html` estático servido por el propio Express (`app.use(express.static(...))` en `server.ts`), no requiere build ni proceso aparte. | `backend/.env` local con `OPENAI_API_KEY` propia. `API_KEY` **no definida** — el middleware `apiKeyAuth` queda en modo no-op, cualquier request local pasa sin autenticación (comportamiento actual y esperado: es un proceso en `localhost`, no alcanzable desde fuera de la máquina). `PORT` normalmente sin definir (usa el default `3001`); si ya hay otro `npm run dev` corriendo, se usa `PORT=3002` (o el que corresponda) para no pisarlo — ver nota de convivencia en `CLAUDE.md`. | **Implementado.** Es el único entorno en uso activo. |
| **Backend expuesto públicamente (para n8n)** | Permitir que un workflow de n8n corriendo en la nube (fuera de la red local) llame a `POST /api/sprint-fin/pdf` para generar PDFs de forma automatizada, según `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`. No es un "entorno de producción" formal con staging previo — es la misma base de código de local, expuesta con una URL alcanzable desde internet. | **No resuelto todavía.** El plan deja dos alternativas abiertas, sin decidir: (a) un deploy real del backend a algún hosting, o (b) un túnel (Cloudflare Tunnel / ngrok) apuntando al proceso local, para pruebas. Cualquiera de las dos requiere primero completar el checklist de `docs/RUNBOOKS.md` (runbook 5) antes del primer request público. | Mismo código, mismo `npm run build && npm start`. La diferencia real es que `API_KEY` **sí debe estar definida** en el `.env` de esta instancia (a diferencia de local) — es lo único que activa el middleware `apiKeyAuth`. El consumidor (n8n) necesita el mismo valor como credential/variable (`PDF_API_KEY` en el plan), enviado en el header `X-API-Key` de cada request. No hay otras diferencias de configuración documentadas (mismo `OPENAI_API_KEY`, mismo `MAX_CONCURRENT_RENDERS`/`RENDER_TIMEOUT_MS` hardcodeados en `pdf.generator.ts`, no hay flags de "modo producción" en el código). | **Planeado, no implementado.** Bloqueante explícito en `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md` ("Próximos pasos" 1-2): falta decidir/montar la URL pública y confirmar el middleware de auth en producción real antes de construir el workflow de n8n. |

## Por qué no hay staging ni producción formales todavía

El estándar de referencia (documentación interna) recomienda tres entornos — dev, staging, producción — con proyectos/credenciales separados y un proceso de promoción formal (PR aprobado, tests, QA). Este proyecto no tiene ninguno de esos prerrequisitos hoy:

- No hay suite de tests automatizada (`CLAUDE.md`: *"No hay scripts de lint ni de test en `package.json`"*), por lo que no existe un gate de "tests pasan" que una promoción dev → staging pudiera exigir.
- No hay más de una instancia del backend corriendo — solo la de cada desarrollador en su máquina, más (a futuro) la instancia expuesta para n8n.
- No hay servicios externos con múltiples proyectos por entorno (el único servicio externo real es la API de OpenAI, con una sola API key por `.env`; no hay Firebase/Cloudinary en este stack).

Introducir una tabla de "dev/staging/prod" con datos inventados sería documentar infraestructura que no existe y that daría una falsa sensación de madurez operativa. Si el equipo decide construir staging más adelante (por ejemplo, para validar el workflow de n8n contra un backend de prueba antes de apuntar a la instancia real), ese es el momento de expandir esta tabla con su propósito, configuración y proceso de promoción reales.

## Variables de entorno por entorno (lo que existe hoy)

Ver `docs/ENV_VARS.md` para el detalle completo de cada variable (formato, validación, dónde se define). Resumen de las diferencias relevantes entre los dos entornos de esta tabla:

| Variable | Local (dev) | Backend expuesto (planeado) |
|---|---|---|
| `OPENAI_API_KEY` | Requerida, key propia de cada desarrollador o compartida por el equipo en su `.env` local. | Requerida, misma naturaleza — sin definirse el proceso arranca con `process.exit(1)` (ver `server.ts` líneas 9-14) sin importar el entorno. |
| `PORT` | Opcional, default `3001` (o `3002`+ si ya hay otro proceso local corriendo). | Opcional, default `3001` salvo que el hosting/túnel elegido imponga otro puerto. |
| `API_KEY` | **No definida** — `apiKeyAuth` no-op, sin autenticación. | **Debe estar definida** antes de exponer la URL — es el único control de acceso implementado hoy (ver `docs/RUNBOOKS.md`, runbook 5). |

## Proceso de promoción de código

No existe un proceso de promoción formal (no hay staging intermedio). El flujo real hoy es: cambios se prueban en local (`npm run dev`) y, una vez el desarrollador los considera listos, se llevan directamente a la instancia que corresponda (hoy, otra máquina local; a futuro, la instancia expuesta para n8n) repitiendo el runbook de deploy (`docs/RUNBOOKS.md`, runbook 1). No hay checks automáticos de CI que bloqueen este paso — es responsabilidad manual de quien despliega.

## Acceso

- **Local (dev)**: cada desarrollador tiene acceso total a su propia instancia (es su propia máquina). No hay control de acceso adicional más allá del que ya provee el sistema operativo.
- **Backend expuesto (planeado)**: una vez montado, el acceso queda controlado únicamente por conocer el valor de `API_KEY` (enviado como header `X-API-Key`). No hay todavía un mecanismo de gestión/rotación de esa key más allá de editar el `.env` a mano y actualizar el valor correspondiente en n8n — `docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md` deja explícitamente como alternativa no descartada mover esta auth a nivel de túnel/deploy (Cloudflare Access, etc.) si se necesita revocar accesos por consumidor sin tocar código.

## Datos y backups

No aplica: este proyecto no tiene una base de datos propia ni almacena datos persistentes entre requests (cada request de `/preview` o `/pdf` es sin estado, procesa el JSON recibido y devuelve HTML/PDF). No hay política de backups que documentar en esta versión del proyecto.
