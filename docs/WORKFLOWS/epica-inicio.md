# Epica - Generar Resumen Inicio PDF - Google Drive

- **Workflow ID**: `jRYd4dDes9Eh0rO3`
- **Proyecto n8n**: personal de Polaria Tech, carpeta de automatizaciones de PDF Generator
- **Trigger**: Google Drive (`anyFileFolder`, poll cada minuto) + manual
- **Genera**: `RESUMEN_INICIO_EPICA_<PERIODO>.PDF` (única plantilla: `default`)
- **Ver también**: [epica-fin.md](./epica-fin.md) (workflow gemelo, plantilla `cierre`), [README.md](./README.md)

## Estado actual

**Construido 2026-07-17**, sin cambios de lógica en la partición del 2026-07-25 (solo se renombró; ya generaba exclusivamente la plantilla de inicio). Es el gemelo de `sprint-fin.md` pero para el tipo de documento `epica`: reutiliza el mismo patrón (descargar fuente → llamar `POST /api/epica/extraer` → `POST /api/epica/pdf` → subir a Drive → notificar por correo) sin backend paralelo.

## Objetivo del flujo

Estado inicial → estado final: **Un PDF de planning de épica (`EPICA_<PERIODO>.pdf`) subido a una subcarpeta de la carpeta de Drive `00_EPICAS`** → **un PDF de resumen de épica (`RESUMEN_INICIO_EPICA_<PERIODO>.pdf`) generado y subido a esa misma subcarpeta**, sin que nadie copie datos a un Markdown ni edite el JSON a mano.

## Actores involucrados

| Actor | Rol en este flujo |
|---|---|
| Equipo | Sube el PDF de planning de la épica a una subcarpeta de `00_EPICAS` (no dispara nada más — el trigger es automático) |
| n8n (orquestador) | Detecta el PDF nuevo, verifica que sea una fuente de épica, descarga el PDF, extrae su texto, llama a `POST /api/epica/extraer` y `POST /api/epica/pdf`, y sube el resultado a Drive |
| Google Drive | Fuente (PDF de planning) y destino (PDF de resumen) — misma subcarpeta |
| Backend — extracción (`POST /api/epica/extraer`) | El mismo endpoint del flujo manual: recibe el **texto** extraído del PDF (el endpoint lee el archivo como UTF-8, por eso el PDF se convierte a texto antes; no acepta el PDF binario) y devuelve el JSON estructurado de `EpicaSchema` vía OpenAI |
| Backend — PDF (`POST /api/epica/pdf`) | Valida y genera el PDF — mismo endpoint del flujo manual |

## Resumen del flujo en términos de negocio

1. El trigger de Google Drive vigila **todo My Drive** (`anyFileFolder`, poll cada minuto) — necesario porque el trigger de "carpeta específica" de n8n no detecta archivos creados en subcarpetas, y las fuentes viven en subcarpetas de `00_EPICAS`.
2. Un filtro descarta todo lo que no sea una fuente de épica: nombre que empieza por `EPICA_`, extensión `.pdf` y mimetype PDF. (Ese mismo filtro evita que el workflow se dispare con su propio output `RESUMEN_INICIO_...` y entre en bucle.)
3. n8n lista las subcarpetas de `00_EPICAS` y confirma que el PDF nuevo cuelga de una de ellas; si no, no hace nada.
4. n8n descarga el PDF fuente y extrae su texto (nodo *Extract from File*, operación PDF).
5. n8n convierte ese texto a un archivo `.md` y lo envía a `POST /api/epica/extraer`; si no vuelven datos válidos, manda un correo de error y corta.
6. n8n envía el JSON a `POST /api/epica/pdf`; confirma que la respuesta sea realmente un PDF antes de subir nada; si no, correo de error.
7. n8n calcula el nombre de salida (`RESUMEN_INICIO_` + nombre de la fuente, con autoincremento) y sube el PDF a la misma subcarpeta.
8. n8n envía un correo de informe (Polaria-branded) con la carpeta, el archivo generado, la fuente y un botón directo a Drive.

## Postcondiciones

- El PDF de resumen queda en la misma subcarpeta de `00_EPICAS` que la fuente, con nombre `RESUMEN_INICIO_EPICA_<PERIODO>.pdf` (autoincremental si ya existía).
- Notificación por Gmail a `daniel.galvis@polaria.tech`: correo de éxito o de error. No hay Data Table de auditoría en este flujo, solo correo.
- El sistema no persiste nada más; el backend es sin estado.

## Casos de error y decisiones pendientes

- **Trigger ruidoso:** al vigilar todo My Drive, el workflow "arranca y se detiene" en cada archivo nuevo del Drive antes de filtrar por nombre — ejecuciones abundantes en el historial, todas descartadas salvo las fuentes de épica.
- **La verificación de ubicación depende de que el payload del trigger incluya el campo `parents`.** Si no viniera, el workflow no haría nada en silencio; en ese caso habría que cambiar la verificación por un fetch de metadata del archivo.
- Reutiliza los mismos límites del backend que el flujo manual (timeout de render de 15s, cola de 4 renders, etc.).

## Reglas de negocio que aplican

- El JSON final debe cumplir el mismo `EpicaSchema` que valida el flujo manual — no hay schema paralelo.
- `epica` no tiene bloque de horas editable: siempre usa `HORAS_FIJAS` (`backend/src/constants.ts`), igual que en el flujo manual; el JSON de `/pdf` no incluye horas.
- El endpoint que llama n8n (`/api/epica/extraer`, `/api/epica/pdf`) es el mismo que usa el frontend manual: cualquier cambio de contrato afecta ambos flujos a la vez.

## Referencias

- Workflow gemelo de cierre: [epica-fin.md](./epica-fin.md)
- Contrato de datos: `backend/src/documents/epica/config.ts`
- Casos borde compartidos con el flujo manual: `docs/BUSINESS_FLOWS.md`, Flujo 4
