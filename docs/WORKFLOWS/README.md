# Documentación de workflows de n8n

Documentación operativa de los 4 workflows de automatización que corren en n8n cloud (proyecto personal de Polaria Tech, `https://polariatech.app.n8n.cloud`). Separada de `docs/BUSINESS_FLOWS.md` (que documenta el software en sí — frontend + backend — para cualquier persona del equipo sin que necesite abrir n8n) porque estos 4 documentos sí asumen que quien los lee va a entrar a la UI de n8n a operarlos, depurarlos o modificarlos.

| Workflow | Documento | Dispara | Genera |
|---|---|---|---|
| `Sprint - Generar Resumen Inicio PDF - Google Drive` (`rqkqaSiaFq0eK7lU`) | [sprint-inicio.md](./sprint-inicio.md) | Manual | `RESUMEN_INICIO_SPRINT_...PDF` (plantilla `resumen-inicio`) |
| `Sprint - Generar Resumen Final PDF - Google Drive` (`ZdUWttXimeb9fKTN`) | [sprint-fin.md](./sprint-fin.md) | Manual | `RESUMEN_FINAL_.../DETAIL_...PDF` (plantillas `resumen`/`resumen-v2`/`resumen-v3`/`detail`) |
| `Epica - Generar Resumen Inicio PDF - Google Drive` (`jRYd4dDes9Eh0rO3`) | [epica-inicio.md](./epica-inicio.md) | Google Drive (archivo nuevo) + manual | `RESUMEN_INICIO_EPICA_...PDF` (plantilla `default`) |
| `Epica - Generar Resumen Final PDF - Google Drive` (`sMMCR1cijPY1IFxt`) | [epica-fin.md](./epica-fin.md) | Schedule (4 semanas) + manual | `RESUMEN_FINAL_EPICA_...PDF` (plantilla `cierre`) |

Los 4 son gemelos entre sí en el patrón general (leer una fuente → armar un Markdown/JSON → `POST /api/<tipo>/extraer` → `POST /api/<tipo>/pdf` → subir a Drive → notificar por Gmail), pero cada uno tiene su propia fuente de datos y su propio disparador — ver cada documento individual para el detalle.

## Historia

Hasta 2026-07-25 existían solo 2 workflows: uno de Sprint que generaba las 5 plantillas de `sprint` (`detail`, `resumen-inicio`, `resumen`, `resumen-v2`, `resumen-v3`) según una columna `Plantilla` en un Google Sheet, y uno de Épica que solo generaba la plantilla `default` (inicio). Se partieron en 4 workflows — uno por combinación tipo de documento × momento del ciclo (inicio/fin) — para que cada uno tenga un alcance más chico y predecible. Detalle de esa partición:
- **Sprint**: se duplicó el workflow único; una copia se recortó a solo `resumen-inicio` (auditoría de nodos realmente necesarios hecha por el agente Automation Governance Architect — ver `sprint-inicio.md`), la otra quedó igual pero filtrando las 4 plantillas de cierre.
- **Épica**: el workflow de inicio (basado en un PDF de planning) no cambió. El de fin es enteramente nuevo — no leía ningún PDF antes, ahora consulta Linear directamente (Initiative → Projects → Cycles) porque no existía ninguna fuente de "resultado real de cierre" para épicas antes de esta partición.

Ver `docs/BUSINESS_FLOWS.md` (Flujo 3 y Flujo 5, ahora recortados a un puntero aquí) para el contexto de negocio previo a la partición, y `docs/COMPLIANCE.md` para la nota de datos personales que agregó la automatización de horas por Calendar/Gemini.

## Referencias compartidas por los 4 workflows

- Contrato de datos: `backend/src/documents/sprint-inicio/config.ts` (`SprintInicioSchema`), `backend/src/documents/sprint-fin/config.ts` (`SprintSchema`), `backend/src/documents/epica/config.ts` (`EpicaSchema`) — ningún workflow tiene un schema paralelo, todos validan contra el mismo que usa el flujo manual (Flujo 1 de `BUSINESS_FLOWS.md`).
- Rutas y forma de los errores de la API: `backend/src/api/document.routes.ts`.
- Motor de render y sus límites (timeout 15s, cola de 4 renders, alto auto-ajustable): `backend/src/core/generators/pdf.generator.ts`.
- Casos borde compartidos entre el flujo manual y cualquier automatización (rangos de caracteres sin mínimo, timeout de render, LLM no confiable contando): `docs/BUSINESS_FLOWS.md`, Flujo 4.
- Decisión de arquitectura (extracción determinística en vez de AI Agent): `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md`.
