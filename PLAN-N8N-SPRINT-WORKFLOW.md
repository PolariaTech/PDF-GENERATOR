# Plan de acción — Workflow n8n "Sprint PDF Generator"

> **Estado: implementado con un cambio de arquitectura respecto a este plan — documento histórico, no vigente.** La Decisión confirmada #2 de este plan (mantener el AI Agent multi-turno) se revirtió durante la construcción real: se reemplazó por extracción determinística (HTTP directo a Linear + `POST /api/sprint/extraer`). Ver `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md` para el porqué, y `docs/BUSINESS_FLOWS.md` (Flujo 3) para la descripción vigente del flujo construido. El resto de las decisiones de este plan (auth por API key, sin gate humano, arquitectura de nodos de validación/error/writeback) sí se mantuvieron. Workflow resultante: `Sprint - Generar Resumen PDF con Extracción Determinística - Google Drive` (n8n, id `rqkqaSiaFq0eK7lU`), con credenciales configuradas y pilot real corrido con éxito (2026-07-15) — ver `docs/adr/0006-extraccion-deterministica-en-vez-de-ai-agent-para-sync-de-linear.md` para los cambios posteriores al pilot (nodo de validación de rangos eliminado, nombre de PDF por plantilla, matching de fila por ciclo+semana).

> Actualizado tras la auditoría de `AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md` (Automation Governance Architect + Workflow Architect + MCP Builder). Los cambios de esta versión corrigen dos premisas técnicas que la v1 daba por ciertas sin serlo (rangos de caracteres contra "el schema", timeout "generoso" en n8n) y agregan las ramas de error/logging/idempotencia que la v1 no tenía. Ver el archivo de auditoría para el detalle completo de cada hallazgo.

## Decisiones confirmadas (Fase 0)

Las alternativas de cada decisión no se descartan de forma permanente — quedan documentadas como opción de respaldo si la elegida deja de ser suficiente (ver "Alternativa no descartada" en cada punto).

1. **Auth del backend: API key propia en header.** El endpoint `POST /api/sprint/pdf` valida un header (`X-API-Key` o similar) contra un valor en `.env` del backend — control total desde el código del proyecto, independiente de cómo se resuelva el túnel/deploy. **Pendiente de implementar**: middleware de auth en `backend/src/api/document.routes.ts` (o a nivel de router) antes de exponer la URL pública. Ver "Próximos pasos".
   - **Alternativas no descartadas**: auth a nivel de túnel/deploy (ej. Cloudflare Access, ngrok con auth token), o ambas combinadas (defensa en profundidad). Reconsiderar si el backend termina expuesto por un mecanismo que ya impone su propia capa de auth (evitaría duplicar control), o si se necesita revocar/rotar accesos por consumidor sin tocar código (una sola API key compartida no distingue quién llama).
2. **Se mantiene el AI Agent multi-turno con 3 tools** (no se cambia a extracción single-shot). Queda como riesgo conocido y aceptado el no-determinismo en `agregado` — se mitiga con la corrida de prueba contra Sprint 3 (paso 5 de "Próximos pasos"), comparando el resultado del agente contra la verificación manual ya hecha.
   - **Alternativa no descartada**: extracción single-shot + una llamada de historial determinística (mismo patrón que `extractor.service.ts` con `zodResponseFormat`), recomendada por la auditoría. Reconsiderar si la corrida contra Sprint 3 muestra que el agente se equivoca en `agregado` o en los rangos de caracteres con frecuencia, o si el costo/latencia de las llamadas a Linear vía tool-calling resulta alto para el volumen real de issues por ciclo.
3. **Sin gate de confirmación humana.** El workflow corre de punta a punta sin pausas de aprobación manual; la validación automática (nodo 7) + reintento único es el único control de calidad antes de generar el PDF. Mientras no haya varias corridas reales validadas, tratar cada PDF generado por este workflow como candidato a revisión antes de considerarlo definitivo para liderazgo (ver Riesgos, punto 6).
   - **Alternativas no descartadas**: gate humano permanente antes de subir a Drive (ej. aprobación por Slack), o gate humano solo temporal durante el pilot (removerlo tras varios sprints sin discrepancias). Reconsiderar si las primeras corridas reales muestran errores en el JSON final que la validación automática no atrapa, o si liderazgo pide una revisión humana explícita antes de dar por definitivo un reporte de desempeño de equipo.

## Contexto y decisiones ya tomadas
- **n8n corre en la nube** → el backend (`localhost:3001`) no es alcanzable tal cual. **Bloqueante real:** antes de construir el workflow, el backend necesita una URL pública (deploy real, o un túnel tipo Cloudflare Tunnel/ngrok para pruebas) **con autenticación por API key** (ver Decisión confirmada #1 — un endpoint público sin auth, respaldado por solo 4 renders concurrentes, es trivialmente agotable). Todo el plan asume dos variables en n8n (Environment/Credential): `PDF_API_BASE_URL` y `PDF_API_KEY`, ninguna hardcodeada.
- El trigger manual siempre procesa **la última fila** de la pestaña "Preguntas Skill".
- El PDF final se sube a **Google Drive**.
- La **plantilla es configurable por fila** → hay que agregar una columna `Plantilla` a la Google Sheet (`detail` / `resumen-inicio` / `resumen` / `resumen-v2`).
- **Fuente única de verdad para rangos de caracteres y reglas de extracción**: `backend/src/documents/sprint/config.ts` (constante `SPRINT_SYSTEM_PROMPT`), no `.claude/skills/sprint-json-builder/SKILL.md`. El `SKILL.md` quedó desactualizado respecto al schema real; cualquier texto que se traduzca al system prompt del Agent en n8n debe copiarse de `config.ts`, y si `config.ts` cambia, este plan y el prompt de n8n deben actualizarse en el mismo cambio.

## Cambio previo necesario en la Google Sheet
Antes de construir el workflow, agregar dos columnas a "Preguntas Skill":
- **K: `Plantilla`** (fila 2 = `resumen-v2` para que coincida con lo que ya generamos).
- **L: `Procesado`** (booleano/checkbox, vacío por defecto) — la usa el nodo de idempotencia (paso 2.1 más abajo) para no reprocesar la misma fila dos veces, y el nodo de writeback (paso 9) la marca en `TRUE` al terminar con éxito.

Sheet: https://docs.google.com/spreadsheets/d/1UyyP0z6SS1I42Vs0rK9HRnDCm9g412zchXvlQ5WU0Lw

---

## Arquitectura del workflow

```
Manual Trigger
   → Google Sheets (leer filas)
   → Code: quedarme con la última fila NO procesada + normalizar campos
   → IF: ¿fila válida? (festivos 0-5, fecha parseable, plantilla ∈ {detail,resumen-inicio,resumen,resumen-v2}, columnas no vacías)
        → NO: notificar (Slack/email) con el detalle del campo inválido y detener
        → SI: continuar
   → Code: calcular horas (total, proporciones) y el corte UTC de "agregado"
   → AI Agent (Chat Model + 3 tools sobre Linear + Structured Output Parser)
   → Code: post-proceso — orden fijo de members + resto por orden de aparición, validación real contra los rangos de config.ts, wrap {plantilla, ...json}
   → IF: ¿validación de rangos OK?
        → NO (1ra vez): reintento único devolviendo el error al AI Agent
        → NO (2da vez): notificar y detener
        → SI: continuar
   → HTTP Request → POST {{PDF_API_BASE_URL}}/api/sprint/pdf (header auth + binario)
   → IF: ¿status 200 y Content-Type application/pdf?
        → NO: loguear `details` del error (incluye zodError.flatten() si es 400) + notificar (Slack/email) + detener
        → SI:
           → Google Drive: subir PDF
           → Google Sheets: marcar fila `Procesado = TRUE` + escribir link de Drive + timestamp
           → Log de ejecución (éxito)
```

### 1. Manual Trigger
Nodo estándar, sin config especial.

### 2. Google Sheets — Leer filas
Operación "Get rows", spreadsheet = el sheet que ya armamos, sheet = "Preguntas Skill", rango completo (`A:L`, incluye la nueva columna `Procesado`).

### 3. Code — Última fila no procesada + normalización
- Tomar la última fila donde `Procesado` esté vacío/`FALSE` (no simplemente `items[items.length - 1]`, para no reprocesar una fila ya generada si se agregan filas nuevas antes de correr el workflow de nuevo).
- Si no hay ninguna fila pendiente: terminar el workflow limpio (sin error), no seguir al resto de los nodos.
- Renombrar columnas a claves limpias (`ciclo`, `weekNumber`, `tiempoVerbal`, `fechaPlanning`, `festivos`, `horasReuniones`, `horasIncidencias`, `segmentoNombre`, `segmentoHoras`, `zonaHoraria`, `plantilla`, `rowIndex` para el writeback posterior).

### 4. IF — Validación de la fila (nuevo)
Antes de gastar ninguna llamada a Linear o al LLM, verificar en un nodo Code/IF:
- `festivos` es numérico y está entre 0 y 5.
- `fechaPlanning` es una fecha parseable.
- `plantilla` es exactamente una de `detail`, `resumen-inicio`, `resumen`, `resumen-v2` (si no coincide, el backend caería silenciosamente al `defaultTemplate: "detail"` sin avisar — mejor cortar aquí con un mensaje claro).
- `tiempoVerbal` es exactamente `"Futuro"` o `"Pasado"` (el nodo 5 solo tiene fórmula para esos dos casos).
- Ninguna columna requerida viene vacía.

Si falla cualquier chequeo: notificar (Slack/email) con el nombre del campo y el valor recibido, y detener el workflow ahí — no debe llegar basura al AI Agent.

### 5. Code — Cálculo determinista de horas y corte de `agregado`
Esto **no se lo dejamos al agente** (es aritmética exacta, no razonamiento):
- `diasTrabajados = 5 - festivos`.
- `total = 3 * 8 * diasTrabajados` (asume 3 miembros fijos — ver limitación conocida más abajo).
- Si `tiempoVerbal === "Futuro"`: Proyectos/Reuniones/Incidencias = `total * 0.7867 / 0.08 / 0.1333` (redondeo a 1 decimal, ajuste de residuo en Proyectos).
- Si `tiempoVerbal === "Pasado"`: `Proyectos = total - horasReuniones - horasIncidencias - segmentoHoras`.
- `planningCutoffUTC`: `fechaPlanning` + `"T17:00:00"` calculado con **Luxon** (disponible en Code nodes de n8n) usando `zonaHoraria` como IANA timezone — no hardcodear un offset UTC-5 a mano.

Esto se pasa como contexto fijo al agente (no como algo que el agente calcule).

**Limitación conocida (no bloqueante para el pilot):** la fórmula asume exactamente 3 miembros (Luis/Mauricio/Daniel). Si el equipo crece, este cálculo y el reordenamiento del paso 7 necesitan revisarse — ver "Próximos pasos" (ítem de escalabilidad).

### 6. AI Agent
Este es el nodo central. Config:

- **Chat Model**: GPT-4o (no 4o-mini) — el agente tiene que razonar sobre historial de Linear, agrupar por lead y respetar rangos de caracteres exactos, más exigente que la extracción simple de `extractor.service.ts`.
- **System Prompt**: traducción de `SPRINT_SYSTEM_PROMPT` (constante real en `backend/src/documents/sprint/config.ts`, **no** de `sprint-json-builder/SKILL.md`) a instrucciones de agente: reglas de `agregado`, agrupación por lead (no por assignee), orden fijo Luis→Mauricio→Daniel + resto de miembros por orden de aparición, rangos de caracteres exactos (ver tabla abajo), reglas de `estadoSprint`/`porcentajeCompletado`, prohibición de inventar datos — incluyendo qué hacer si una tool falla (ver tools abajo: nunca inventar datos para "no fallar").

  **Rangos de caracteres vigentes** (copiados de `SPRINT_SYSTEM_PROMPT` en `config.ts`, única fuente de verdad):
  | Campo | Rango |
  |---|---|
  | `members[].objetivo` | 480-500 |
  | `equipo.quien` | 60-90 |
  | `equipo.cuando` | 30-50 |
  | `equipo.donde` | 50-80 |
  | `equipo.como` | 40-70 |
  | `riesgoTransversal.texto` | 180-230 |
  | `riesgoTransversal.mitigacion` | 100-140 |
  | `desviaciones.logrado` | 180-230 |
  | `desviaciones.motivo` | 100-140 |

- **Tools (HTTP Request Tool, no MCP — ver justificación abajo)**, con el query GraphQL **fijo como texto en cada nodo** (el agente solo rellena variables tipadas — nunca debe redactar el GraphQL completo, por robustez y porque la credencial no debería tener scope de mutación):
  1. **`buscar_ciclo`** — POST a `https://api.linear.app/graphql`, query fijo por `team.cycles` filtrando **primero por `number` (= `weekNumber` de la fila, criterio estable)** y el nombre como filtro secundario/de verificación, devuelve `id`, `number`, `name`, `startsAt`, `endsAt`.
     *Descripción para el agente*: "Busca un ciclo (sprint) de Linear por número dentro del equipo configurado. Llamar SIEMPRE primero: las otras dos tools requieren el `cycleId` que esta devuelve. Si no hay match, devuelve lista vacía — no inventes un id."
  2. **`listar_issues_del_ciclo`** — GraphQL `issues(filter: {cycle: {id: {eq: $cycleId}}})`, trae `id`, `title`, `priorityLabel` (string ya mapeado por Linear — **no** `priority` crudo, que es un entero 0-4), `state{name}`, `labels{nodes{name}}`, `project{name, lead{name}}`, `createdAt`. Paginación activada (nodo HTTP Request de n8n sigue `pageInfo.hasNextPage`/`endCursor` automáticamente) para devolver siempre el set completo, no solo la primera página (~50 nodos por defecto en Linear).
     *Descripción para el agente*: "Lista todos los issues de un ciclo ya identificado (requiere `cycleId` de `buscar_ciclo`). Devuelve el set completo, paginado automáticamente."
  3. **`obtener_historial_issue`** — GraphQL `issue(id: $id) { history { nodes { createdAt fromCycle{id} toCycle{id} } } }`. **Esta es la pieza que la skill no pudo resolver por MCP** (el MCP de Linear no expone historial de ciclo) — por eso esta tool puntual usa HTTP Request crudo; las otras dos (`buscar_ciclo`, `listar_issues_del_ciclo`) sí tienen equivalente en el MCP de Linear (`list_cycles`, `list_issues`) y se evalúa usar ese MCP para esas dos en vez de duplicar su lógica a mano (ver nota abajo).
     *Descripción para el agente*: "Dado el `issueId` de un issue ya listado, devuelve sus cambios de ciclo. Si el array viene vacío, interpreta `agregado=false` (el issue estuvo en el ciclo desde su creación), no como error."
- **Reintentos/errores de tool**: activar "Retry on Fail" con backoff en los 3 nodos HTTP Request Tool (Linear aplica rate limiting por complejidad de query). Si una tool falla (401/429/5xx), el mensaje de error debe volver al agente como texto accionable, nunca como excepción que aborte todo el workflow — y el prompt debe prohibir explícitamente que el agente invente datos ante un error de tool.
- **Output Parser**: Structured Output Parser con un JSON Schema que espeje exactamente `SprintSchema` de `backend/src/documents/sprint/config.ts` (mismo shape: `sprintName`, `dateStart`, `dateEnd`, `weekNumber`, `estadoSprint` [enum estricto: solo `"CUMPLIDO"` o `"NO CUMPLIDO"`], `porcentajeCompletado`, `horas.segmentos[]`, `members[].{name,initials,objetivo,projects[].{name,issues[].{title,type,priority,status,agregado}}}`, `equipo`, `riesgoTransversal`, `desviaciones`). Este JSON Schema es una **transcripción manual** — no hay forma de compartir código entre el Zod de TypeScript y n8n sin agregar una dependencia nueva al backend (fuera de alcance de este plan). Dejar un comentario cruzado en `config.ts` ("si cambias `SprintSchema`, actualizar también el Output Parser en n8n") para que el drift sea al menos visible.

Credencial: **Linear API Key** como HTTP Header Auth (`Authorization: <key>`) reutilizable en los 3 tools — evita drift de auth entre ellas.

### 7. Code — Post-proceso
- Reordenar `members`: `["Luis", "Mauricio", "Daniel"]` primero, en ese orden fijo; cualquier miembro adicional (lead fuera de esos 3) va después, en el orden en que aparece en la respuesta del agente — no descartarlo.
- Validación real (reemplaza la validación "contra el schema" de la v1, que no existía): chequear las longitudes de `objetivo`/`equipo.*`/`riesgoTransversal.*`/`desviaciones.*` contra los rangos exactos de la tabla del nodo 6 (hardcodeados aquí, con el mismo comentario cruzado hacia `config.ts`) — el `SprintSchema` de Zod solo tiene topes máximos (`.max()`), nunca mínimos, así que esta comprobación no puede delegarse al backend. Verificar también `estadoSprint` ∈ `{"CUMPLIDO","NO CUMPLIDO"}` y que cada `member.projects[]` y `project.issues[]` tenga al menos 1 elemento (el schema real exige `.min(1)` en ambos).
- Si algo se sale de rango o de shape: **loop de un solo reintento** devolviendo el error exacto al Agent (n8n soporta esto con un IF + vuelta al nodo Agent). Si el segundo intento también falla: notificar (Slack/email) con el detalle y detener — no seguir al paso 8 con datos inválidos.
- Armar el body final: `{ ...jsonDelAgente, plantilla: fila.plantilla }`.

### 8. HTTP Request — Generar PDF
`POST {{PDF_API_BASE_URL}}/api/sprint/pdf` con header `X-API-Key: {{PDF_API_KEY}}` (Decisión confirmada #1), body = JSON del paso anterior, `Response Format: File`.

**Timeout**: el backend aplica un límite duro de 15s (`RENDER_TIMEOUT_MS` en `pdf.generator.ts`) tanto para cargar el HTML como para `page.pdf()`, compartido con una cola de máximo 4 renders concurrentes que usa también el frontend normal de la app — configurar un timeout "generoso" en este nodo de n8n no tiene ningún efecto sobre ese límite real. Si un sprint grande (`detail` con muchos issues) supera los 15s, el backend responde 500 — tratarlo como un fallo esperado (ver rama de error abajo), no como algo que un timeout mayor en n8n vaya a evitar.

**Rama de error (nueva, la más importante del plan):** el backend responde JSON `{success:false, code, message, details}` en cualquier error (400 `VALIDATION_ERROR` con `details` = Zod `flatten()`, o 500 `INTERNAL_ERROR`), nunca binario. Agregar un nodo IF inmediatamente después que verifique el status code / `Content-Type` de la respuesta **antes** de pasar al paso 9:
- Si es 200 + `application/pdf`: continuar al paso 9.
- Si no: loguear el `message`/`details` recibido, notificar (Slack/email) y detener. **No dejar que un JSON de error llegue al nodo de Google Drive con `Response Format: File`** — se subiría como si fuera un PDF válido, indistinguible hasta que alguien lo abre.

### 9. Google Drive — Subir PDF
Nombre de archivo: `Sprint_{{sprintName}}_{{plantilla}}_{{fecha}}.pdf`, carpeta: **definir antes de construir** (pendiente, no resuelto en este plan todavía).

### 10. Google Sheets — Writeback + Log (nuevo)
- Marcar la fila procesada (`Procesado = TRUE`) para que el nodo 3 no la vuelva a tomar en la próxima corrida.
- Escribir el link del archivo de Drive y un timestamp en la misma fila, para que el operador vea el resultado sin abrir n8n.
- Registrar la ejecución (nombre de workflow + versión, timestamp, `sprintName`, éxito/fallo, clase de error si aplica) en una hoja de auditoría o Data Table de n8n separada — permite diagnosticar sin revisar el historial de ejecuciones de n8n uno por uno.

---

## Riesgos a tener en cuenta

1. **Rangos de caracteres exactos** son difíciles de acertar a la primera para un LLM — por eso el paso 7 incluye una validación+reintento contra los números reales de `config.ts` (no contra "el schema", que no los tiene).
2. **Historial de Linear vía GraphQL crudo** debería resolver el problema que tuvimos con el MCP, pero conviene probarlo con un ciclo real antes de confiar el 100% en el agente — correr el workflow una vez y comparar `agregado` contra lo que verificamos manualmente para Sprint 3.
3. **Alcance de red y auth**: si el backend no queda con URL pública estable y con el middleware de API key implementado, el workflow falla en el paso 8 — esto hay que resolverlo primero, es prerrequisito de todo lo demás (Decisión confirmada #1, implementación pendiente).
4. **Costo/latencia del agente**: con 3 tools + posible reintento, cada ejecución puede hacer bastantes llamadas a Linear + al LLM (una llamada a `obtener_historial_issue` por issue del sprint); para un trigger manual no es problema, pero si esto pasa a schedule automático más adelante habría que revisar rate limits de Linear y considerar agrupar el historial en una sola query paginada en vez de N llamadas.
5. **Timeout duro de 15s en el backend**, no configurable desde n8n — un sprint con muchos issues puede golpearlo; tratarlo como un caso de fallo esperado con su propia rama (ver paso 8), no como algo que se resuelve subiendo el timeout del lado de n8n.
6. **Sin gate de confirmación humana** (a diferencia del flujo manual actual) — ver Decisión confirmada #3. Tratar cada PDF generado por este workflow como candidato a revisión antes de considerarlo definitivo para liderazgo hasta tener varias corridas reales validadas.
7. **Equipo fijo de 3 miembros** hardcodeado en el cálculo de horas y en el reordenamiento — no escala automáticamente si el equipo cambia (ver "Próximos pasos").

---

## Próximos pasos
1. Implementar el middleware de API key en el backend (`X-API-Key` contra un valor en `.env`) — Decisión confirmada #1.
2. Resolver la URL pública del backend (deploy o túnel) una vez el middleware esté en su lugar.
3. Agregar columnas `Plantilla` y `Procesado` a la Google Sheet.
4. Construir el workflow en n8n siguiendo los nodos de este plan (incluye las ramas de validación/error/writeback nuevas).
5. Probar con Sprint 3 y comparar el `agregado` calculado por el agente contra la verificación manual ya hecha — usar esta corrida también para confirmar que la rama de error del paso 8 nunca sube un JSON de error a Drive.
6. (Escalabilidad, no bloqueante para el pilot) Revisar el cálculo de horas y el reordenamiento de miembros si el equipo deja de ser exactamente Luis/Mauricio/Daniel; evaluar agrupar `obtener_historial_issue` en una sola query si el volumen de issues por ciclo crece o el trigger pasa a schedule automático.
