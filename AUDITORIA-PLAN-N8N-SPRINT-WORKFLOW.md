# Auditoría integral — PLAN-N8N-SPRINT-WORKFLOW.md

> **Estado: hallazgos resueltos en la construcción real — documento histórico, no vigente como pendiente.** Todos los hallazgos críticos y altos de esta auditoría (rama de error PDF/JSON, rangos de caracteres reales, validación de tipos de fila, logging/writeback/idempotencia) quedaron implementados en el workflow final. El hallazgo #11 (no-determinismo del AI Agent en `agregado`) fue, además, el disparador de un cambio de arquitectura completo: se abandonó el AI Agent multi-turno por extracción determinística — ver `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md`. El hallazgo #9 (reemplazar tools por MCP donde hubiera equivalente) quedó sin objeto: al eliminarse el AI Agent, las 3 tools pasaron a ser HTTP Request nodes planos, no hay MCP de por medio en ninguna de las tres llamadas a Linear.
>
> **Actualización (2026-07-15):** el nodo de validación de rangos de caracteres + reintento (implementado según este hallazgo) fue eliminado del workflow después de correrse el pilot real con éxito — hoy ese hallazgo vuelve a estar sin mitigación en n8n. Ver `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md` (sección Estado) y `docs/BUSINESS_FLOWS.md` (Flujo 4, Caso borde A) para el detalle.

Tres agentes especializados auditaron el plan de forma independiente, cada uno leyendo el código real (no solo el texto del plan): **Automation Governance Architect** (gobernanza/viabilidad), **Workflow Architect** (cobertura de spec, branches, handoffs) y **MCP Builder** (diseño de las tools del AI Agent). Los tres llegaron al mismo veredicto por caminos distintos, y dos hallazgos críticos surgieron **de forma independiente en los tres reportes** sin que se los hubiera señalado — esa es la señal más fuerte de que son reales.

Archivos leídos para grounding (además del plan): `backend/src/documents/sprint/config.ts`, `backend/src/api/document.routes.ts`, `backend/src/core/generators/pdf.generator.ts`, `backend/src/core/ai/extractor.service.ts`, `.claude/skills/sprint-json-builder/SKILL.md`.

## Veredicto consolidado

**DEFER — no construir tal como está escrito.** La arquitectura de 8 nodos es razonable y el prerrequisito de red ya está bien identificado, pero el plan descansa sobre **dos premisas técnicas falsas** y tiene **cero ramas de fallo completas de punta a punta**. Construirlo hoy produce un workflow que funciona en la demo (Sprint 3, feliz) y falla de forma opaca en producción.

---

## Hallazgos consolidados (deduplicados, por severidad)

### 🔴 Crítico — bloqueante, resolver antes de tocar n8n

**1. El paso 7→8 puede subir un JSON de error a Drive disfrazado de PDF.**
*Encontrado independientemente por los 3 agentes.* El backend responde binario PDF en éxito, pero JSON `{success:false, code, message, details}` en cualquier error (400/500). El plan no tiene ninguna rama que distinga esos dos casos antes del nodo de Google Drive. Con `Response Format: File`, un 400/500 se sube como si fuera un archivo válido — indistinguible hasta que alguien lo abre.
**Impacto si no se corrige:** corrompe silenciosamente el reporte que llega a liderazgo; es el hallazgo de mayor riesgo de todo el plan.

**2. Tres fuentes de verdad divergentes para los rangos de caracteres.**
El plan cita "475-480, 50-60, 180-230, 100-140" — esos números vienen de `.claude/skills/sprint-json-builder/SKILL.md`, que está **desactualizado**. El `SPRINT_SYSTEM_PROMPT` real en `config.ts` pide 480-500 (objetivo) y cuatro rangos distintos para `equipo` (60-90/30-50/50-80/40-70), no un único 50-60. El propio plan ya heredó los números viejos antes de construir nada.
**Impacto:** el system prompt que se traduzca al Agent en n8n validará contra reglas que ya no son las vigentes.

**3. El "chequeo de rangos contra el schema" del paso 6 no tiene nada contra qué chequear.**
`SprintSchema` (Zod) solo define `.max()` en los campos de texto (`objetivo` max 600, `equipo.*` max 150, `riesgoTransversal.*`/`desviaciones.*` max 320/200) — **sin mínimos**. Los rangos exactos viven solo como texto libre del prompt. "Validar contra el schema" es, literalmente, imposible tal como está descrito.
**Impacto:** el reintento de un solo salto que propone el plan nunca se dispara aunque el LLM entregue un `objetivo` de 10 caracteres.

**4. El timeout de 15s del backend es duro y no depende de n8n.**
`RENDER_TIMEOUT_MS = 15_000` en `pdf.generator.ts` aplica a `setContent()` y a `page.pdf()`, con un singleton de Chromium limitado a 4 renders concurrentes **compartido con el uso normal del frontend**. El plan dice "timeout generoso" en el nodo HTTP Request de n8n — eso no tiene ningún efecto sobre el límite real.
**Impacto:** sprints grandes (`detail` con muchos issues), o el workflow corriendo mientras alguien usa el frontend, producen 500 sin relación con lo que configure n8n.

**5. Sin autenticación definida hacia el backend público.**
El plan resuelve la URL pública pero no menciona ningún mecanismo de auth para `POST {{PDF_API_BASE_URL}}/api/sprint/pdf`. Un endpoint público, sin auth, respaldado por 4 slots de renderizado, es trivialmente agotable.
**Impacto:** riesgo de seguridad real, no solo de robustez — debe resolverse junto con el prerrequisito de red, no después.

### 🟠 Alto

**6. La validación "ligera" del paso 6 no equivale al `safeParse` real del backend.** No chequea el enum estricto de `estadoSprint`, ni `.min(1)` en `projects`/`issues` por miembro. Un JSON puede pasar la validación de n8n y ser rechazado igual en el paso 7 — después de gastar toda la ejecución cara del Agent (3 tools de Linear + LLM).

**7. Se elimina sin discutirlo el gate de confirmación humana que sí existe en el flujo manual actual** (`SKILL.md` Paso 7: no marcar el JSON como definitivo sin confirmación). El plan va directo del Agent al PDF final y a Drive. Dado que el dato es un reporte de desempeño de equipo visible a liderazgo (criticidad media-alta), esto merece una decisión explícita del equipo, no una omisión implícita.

**8. Diseño de las tools del AI Agent incompleto:**
   - No hay texto de `description` escrito para ninguna de las 3 tools — el orden correcto (`buscar_ciclo` → `listar_issues_del_ciclo` → `historial_issue`×N) depende de que el LLM lo infiera solo.
   - `priority` debería pedirse como `priorityLabel` (string, ya mapeado por Linear), no como el entero crudo 0-4 que expone la API.
   - Sin paginación explícita en `listar_issues_del_ciclo` (Linear pagina ~50 nodos por defecto) — un ciclo grande se reporta incompleto sin error visible.
   - No está definido si el query GraphQL es texto fijo por nodo o si el LLM lo redacta — **debe ser fijo**, con el agente rellenando solo variables tipadas; dejar que el LLM escriba el GraphQL completo es un riesgo de robustez y, si el API key tuviera scope de escritura, de seguridad.

**9. Reemplazar las 3 tools por GraphQL crudo cuando 2 de 3 tenían equivalente MCP** (`list_cycles`, `list_issues` ya disponibles). Solo `historial_issue` necesitaba salirse del MCP. Mantener las 3 a mano triplica la superficie de mantenimiento (paginación, shape de respuesta, evolución del schema de Linear) que podía quedar en 1.

**10. Tres miembros fijos hardcodeados** (`["Luis","Mauricio","Daniel"]`) en el cálculo de horas (`3*8*días`) y en el reordenamiento — `SprintSchema.members` no tiene máximo, y el propio `SKILL.md` contempla "Otros miembros" que el plan de n8n no resuelve.

**11. Uso de un agente LLM multi-turno no determinístico para derivar `agregado`**, que alimenta directamente un KPI visible a liderazgo — contradice la filosofía determinística que el resto del proyecto ya aplica (`extractor.service.ts` es de un solo turno con `zodResponseFormat`).

### 🟡 Medio

12. Sin validación de tipos de la fila de Sheets antes de seguir (festivos numérico, fecha parseable, `plantilla` ∈ claves válidas) — un typo en la columna Plantilla cae silenciosamente al `defaultTemplate: "detail"`, generando el documento equivocado sin error.
13. Sin logging/audit trail (nombre de workflow+versión, timestamp, fila origen, éxito/fallo, clase de error).
14. Sin error branch ni notificación (Slack/email) ante fallos de Linear, LLM, backend o Drive.
15. Sin status writeback a la Sheet (link de Drive, timestamp, estado) — el operador depende de abrir n8n para saber si corrió.
16. Carpeta de Google Drive literalmente "a definir".
17. Sin retry/backoff configurado en las tools de Linear ante 429/5xx.
18. Búsqueda de ciclo por nombre es frágil — debería usar `weekNumber`/`number` (ya disponible en la fila) como criterio primario.
19. Sin idempotencia: correr el trigger 2 veces sobre la misma fila duplica gasto de LLM/Linear y archivos en Drive.

### 🟢 Positivo — mantener tal cual

- El cálculo determinístico de horas (paso 4) está bien resuelto y correctamente **no** delegado al LLM.
- Reutilizar una sola credencial de Linear entre las 3 tools evita drift de auth.
- La idea del reintento de un solo salto en el paso 6 es, en sí, una mejora sobre lo que hace hoy el backend para extracción simple (que no reverifica nada) — el problema es contra qué valida, no la idea de validar.

---

## Plan de acción mejorado (priorizado)

### Fase 0 — Bloqueante, antes de escribir un solo nodo en n8n

| # | Acción | Por qué | Impacto |
|---|---|---|---|
| 0.1 | Fijar `config.ts` como única fuente de verdad de los rangos de caracteres; descartar los números del `SKILL.md` | Elimina el hallazgo #2 en su origen | Mantenibilidad: evita que el system prompt de n8n nazca ya desincronizado |
| 0.2 | Definir auth del backend (API key en header o auth del túnel) junto con la URL pública | Hallazgo #5 | Seguridad: cierra un endpoint público sin protección |
| 0.3 | Decidir explícitamente: ¿agente multi-turno con tools, o extracción single-shot (mismo patrón que `extractor.service.ts`) + una llamada de historial determinística? | Hallazgo #11 — cambia el perfil de riesgo entero | Ejecución: un single-shot es más predecible en costo/latencia/resultado; si se mantiene el agente, debe ser una decisión consciente, no por defecto |
| 0.4 | Acordar con el equipo si se elimina el gate de confirmación humana o se reemplaza por algo equivalente | Hallazgo #7 | Calidad del dato: evita perder el único control de calidad que el proceso manual sí tenía |

### Fase 1 — Cambios de diseño sobre los nodos ya propuestos

| # | Acción | Por qué | Impacto |
|---|---|---|---|
| 1.1 | Agregar rama IF por status code / content-type inmediatamente después del paso 7, antes del paso 8 | Hallazgo #1 (el más votado) | Ejecución: evita corromper el entregable final en Drive |
| 1.2 | Reescribir el paso 6 para validar contra los números reales de `config.ts` (hardcodeados en el Code node, con comentario cruzado hacia `config.ts`), no "contra el schema" | Hallazgos #2, #3 | Ejecución + mantenibilidad: la validación pasa de ser un placebo a ser real |
| 1.3 | Escribir las `description` de las 3 tools, fijar el query GraphQL como texto estático con variables tipadas, pedir `priorityLabel` en vez de `priority`, activar paginación nativa en `listar_issues_del_ciclo` | Hallazgo #8 | Ejecución: reduce el espacio de error del agente; evita sprints reportados incompletos |
| 1.4 | Insertar nodo de validación de tipos justo después de leer la Sheet (festivos numérico, fecha parseable, `plantilla` ∈ `{detail, resumen-inicio, resumen, resumen-v2}`) | Hallazgo #12 | Ejecución: falla rápido y visible en vez de generar el documento equivocado en silencio |
| 1.5 | Evaluar enfoque híbrido MCP (para `buscar_ciclo`/`listar_issues_del_ciclo`) + HTTP Request Tool solo para `historial_issue` | Hallazgo #9 | Mantenibilidad: un tercio de la superficie GraphQL custom a mantener |

### Fase 2 — Hardening antes de considerar el pilot "listo"

| # | Acción | Por qué | Impacto |
|---|---|---|---|
| 2.1 | Logging por ejecución (workflow+versión, timestamp, `sprintName`, éxito/fallo, clase de error) a una hoja de auditoría o Data Table de n8n | Hallazgo #13 | Mantenibilidad: diagnosticable sin abrir el log de ejecución de n8n |
| 2.2 | Notificación (Slack/email) en cualquier fallo de Linear/LLM/backend/Drive | Hallazgo #14 | Ejecución: nadie descubre un fallo por accidente |
| 2.3 | Status writeback a la fila de Sheets (link de Drive + timestamp + estado) | Hallazgo #15 | Ejecución: visibilidad del resultado sin depender de n8n |
| 2.4 | Definir la carpeta de Drive; retry/backoff en los 3 HTTP Request Tools de Linear | Hallazgos #16, #17 | Ejecución: cierra dos placeholders reales del plan |
| 2.5 | Dedupe: marcar la fila como "procesada" (columna nueva o Data Table) antes de permitir un segundo trigger sobre la misma fila | Hallazgo #19 | Ejecución: evita doble gasto de LLM/Linear y archivos duplicados |
| 2.6 | Cambiar `buscar_ciclo` para filtrar primero por `weekNumber`/`number`, nombre como criterio secundario | Hallazgo #18 | Ejecución: más robusto si el equipo no renombra ciclos |

### Fase 3 — Escalabilidad (no bloqueante para el pilot con Sprint 3, sí antes de producción/schedule)

| # | Acción | Por qué | Impacto |
|---|---|---|---|
| 3.1 | Soportar "Otros miembros" más allá de Luis/Mauricio/Daniel en horas y reordenamiento | Hallazgo #10 | Escalabilidad: el equipo puede crecer sin romper el workflow |
| 3.2 | Evaluar batching de `historial_issue` (una query con `id: {in:[...]}}` en vez de N llamadas) | Riesgo ya señalado por MCP Builder | Escalabilidad: crítico si esto pasa a schedule automático (riesgo #4 ya identificado en el plan original) |
| 3.3 | Revisar rate limits reales de Linear con un ciclo grande antes de automatizar el trigger | Ya señalado en el plan original, confirmado por los 3 agentes | Escalabilidad |

---

## Próximo paso recomendado

Ejecutar la Fase 0 y la Fase 1 (son las que cambian el diseño, no solo lo endurecen) **antes** de construir el primer nodo en n8n. Con eso resuelto, correr el pilot con Sprint 3 tal como ya proponía el plan original, comparando `agregado` contra la verificación manual — pero ahora con las ramas de error del paso 7/8 en su lugar, para que un fallo real durante esa prueba no termine subiendo un JSON de error a Drive sin que nadie lo note.
