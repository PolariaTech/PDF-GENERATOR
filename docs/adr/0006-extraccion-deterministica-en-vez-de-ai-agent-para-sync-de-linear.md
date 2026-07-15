# ADR-0006: Extracción determinística (HTTP directo + `POST /api/sprint/extraer`) en vez de un AI Agent multi-turno para sincronizar datos de Linear en el workflow de n8n

## Fecha
2026-07-14. Decisión tomada durante la construcción real del workflow en n8n (después de `PLAN-N8N-SPRINT-WORKFLOW.md` y `AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`), al confirmarse en pruebas contra ejecuciones reales que el AI Agent fallaba de forma dura (crash, no rama de reintento) cuando el parser estructurado no podía interpretar su salida.

## Estado
Aceptado e implementado. Pilot real corrido con éxito el 2026-07-15 en el workflow n8n `Sprint - Generar Resumen PDF con Extracción Determinística - Google Drive` (id `rqkqaSiaFq0eK7lU`) — PDF generado, subido a Drive con nombre determinístico y fila de la Sheet marcada como procesada, de punta a punta sin intervención manual. Reemplaza como camino recomendado al workflow `Sprint - Generar Resumen PDF - Google Drive` (id `G8Fq2jaofpNAYCM9`, basado en AI Agent, no borrado — ver Consecuencias).

**Cambios posteriores a la decisión original** (ver Notas de seguimiento para el detalle): el nodo de validación de rangos de caracteres con reintento (`Aplicar Datos Deterministicos y Validar Rangos` y su rama de reintento, descritos en la sección Decisión de más abajo) fue **eliminado deliberadamente** del workflow tras confirmarse el pilot — hoy no hay reintento ni validación de rangos de caracteres en el flujo de n8n. El único paso que sigue pisando los campos calculables de forma determinística (`sprintName`, fechas, `weekNumber`, `estadoSprint`, `porcentajeCompletado`, `horas`, `plantilla`) es `Consolidar Payload Final del Sprint`, que ahora hace directamente lo que antes hacía el nodo eliminado, sin el chequeo de rango ni el reintento.

## Contexto

`PLAN-N8N-SPRINT-WORKFLOW.md` (Decisión confirmada #2) y su auditoría (`AUDITORIA-PLAN-N8N-SPRINT-WORKFLOW.md`, hallazgo #11) ya habían dejado registrada la alternativa de extracción single-shot como "no descartada", pero el plan optó inicialmente por mantener un AI Agent multi-turno con 3 tools HTTP sobre la API GraphQL de Linear (`buscar_ciclo`, `listar_issues_del_ciclo`, `obtener_historial_issue`), con un Structured Output Parser forzando el JSON final.

Al construir y probar ese workflow contra ejecuciones reales (`test_workflow`/`get_execution` en n8n), aparecieron dos problemas que la auditoría ya había anticipado como riesgo pero que se confirmaron en la práctica:
- El Agent podía responder en prosa en vez de invocar la tool de formato de salida cuando Linear no devolvía ningún ciclo/issue coincidente (comportamiento correcto del modelo — se negaba a inventar datos — pero el parser estructurado lo interpretaba como un fallo de parseo y **crasheaba la ejecución completa** en vez de disparar la rama de reintento/notificación ya diseñada).
- `test_workflow` con pin data no logra evitar llamadas reales a OpenAI en subnodos de AI Agent (modelo/tools), a diferencia de nodos HTTP/trigger normales — cada prueba de esa rama tenía costo real y no era determinística de probar en aislamiento.

Esto llevó a repensar la arquitectura completa: ¿por qué usar tool-calling multi-turno para orquestar 3 llamadas HTTP deterministas (buscar ciclo, listar issues, listar historial por issue), si esa orquestación puede hacerse con nodos HTTP Request normales de n8n, sin ningún LLM de por medio, y dejar el único paso que genuinamente necesita un LLM (redactar `objetivo`/`equipo`/`riesgoTransversal`/`desviaciones` en lenguaje natural respetando rangos exactos de caracteres) para el endpoint que el backend **ya tiene y ya usa el flujo manual** (`POST /api/sprint/extraer`, `openai.beta.chat.completions.parse` con `zodResponseFormat`, que garantiza JSON válido contra el schema a nivel de API — nunca puede fallar el parseo)?

## Opciones consideradas

1. **Mantener el AI Agent multi-turno con 3 tools** (arquitectura original del plan).
   - Pros: ya construido y en gran parte funcionando; un solo nodo agente concentra toda la lógica de "entender" los datos de Linear.
   - Contras: no determinístico en un campo que alimenta un KPI visible a liderazgo (`agregado`); fallos de parseo estructurado crashean la ejecución en vez de usar las ramas de error ya diseñadas; cada prueba dispara llamadas reales (costo) porque el pin data de `test_workflow` no cubre subnodos de AI Agent; tres tools GraphQL a mano triplican superficie de mantenimiento frente a Linear.
2. **Extracción determinística: HTTP Request nodes planos + Split Out + Code de clasificación + consolidación a Markdown + `POST /api/sprint/extraer`** (esta decisión).
   - Pros: cero no-determinismo en `agregado`/`type`/`priority`/`status` (deterministas en un Code node, sin LLM); reutiliza el endpoint de extracción que el flujo manual (Flujo 1 de `docs/BUSINESS_FLOWS.md`) ya usa y ya está probado en producción, sin backend paralelo; el único uso de LLM queda acotado al texto narrativo donde sí aporta valor (`objetivo`, `equipo`, `riesgoTransversal`, `desviaciones`); las llamadas HTTP planas a Linear son 100% pineable/testeable sin costo de LLM.
   - Contras: más nodos en el canvas que el workflow con Agent, porque la orquestación que antes hacía el LLM ahora es explícita nodo por nodo; `Listar Issues del Ciclo` usa `first: 100` sin paginación real (limitación aceptada, ver nota en el propio nodo — un sprint semanal de 3 personas nunca se acercó a ese volumen).
3. **Híbrido**: mantener el AI Agent solo para el texto narrativo, pero seguir usando tools de Linear para los datos duros.
   - Descartada por redundante: el backend ya expone `POST /api/sprint/extraer` con garantía de schema para exactamente ese propósito (texto narrativo a partir de Markdown) — construir un segundo mecanismo de extracción narrativa dentro de n8n hubiera duplicado lo que el backend ya resuelve.

## Decisión

Opción 2. Nuevo workflow (`rqkqaSiaFq0eK7lU`) que reemplaza el AI Agent y sus 3 tools por:
- 3 nodos HTTP Request planos (`Buscar Ciclo en Linear` por `name` exacto — no `number` —, `Listar Issues del Ciclo`, `Obtener Historial de Issue` corriendo una vez por issue tras un Split Out).
- Un Code node (`Calcular Agregado y Clasificar Issue`, `mode: runOnceForEachItem`) que deriva `agregado`/`type`/`priority`/`status` de forma 100% determinística por issue, sin LLM.
- Un Code node (`Consolidar Markdown del Sprint`) que arma un único Markdown estructurado (tabla por proyecto/miembro) más `porcentajeCompletado`/`estadoSprint` ya calculados.
- `Convert to File` + `POST /api/sprint/extraer` (multipart, campo `archivo`) — el mismo endpoint que usa el flujo manual — para la única parte que sigue necesitando LLM: el texto narrativo.
- Un Code node (`Aplicar Datos Deterministicos y Validar Rangos`) que, además de validar los rangos de caracteres (igual que antes), **pisaba** `sprintName`/`dateStart`/`dateEnd`/`weekNumber`/`estadoSprint`/`porcentajeCompletado`/`horas` con los valores ya calculados de forma determinística — nunca confiaba en lo que el LLM haya podido inferir para esos campos, aunque el endpoint los devolviera.
- El mismo patrón de reintento único (llamar `/extraer` una segunda vez con el motivo del fallo anexado al Markdown) que ya existía para el Agent, aplicado al endpoint HTTP en vez de a un segundo turno de agente.

**Nota (2026-07-15): esta última pieza (validación de rangos + reintento) fue eliminada del workflow después del pilot.** Hoy `Consolidar Payload Final del Sprint` sigue pisando los mismos campos calculables de forma determinística (`sprintName` sin el prefijo "SPRINT" para evitar que se duplique con el literal de las plantillas HTML, `dateStart`/`dateEnd`/`weekNumber`/`estadoSprint`/`porcentajeCompletado`/`horas`/`plantilla`), pero ya no valida rangos de caracteres ni reintenta `/extraer` — si el LLM devuelve texto narrativo fuera del rango esperado por `SPRINT_SYSTEM_PROMPT`, el PDF se genera igual con ese texto tal cual.

## Convención de implementación: body de los nodos HTTP Request contra Linear

Los 3 nodos que llaman a `https://api.linear.app/graphql` (`Buscar Ciclo en Linear`, `Listar Issues del Ciclo`, `Obtener Historial de Issue`) usan siempre la misma configuración de body, en vez de las variables estructuradas nativas del nodo HTTP Request (`contentType: json` + `specifyBody: json` + `jsonBody: {...}`):

- **Body Content Type**: `Raw`.
- **Content-Type**: `application/json`.
- **Headers**: siempre `apollo-require-preflight: true`, además del header `Content-Type: application/json` explícito en `headerParameters` (no solo el que setea `rawContentType`). Apollo Server (el motor GraphQL de Linear) exige, para prevenir CSRF, que la request tenga un `Content-Type` distinto de `text/plain`/`urlencoded`/`multipart`, **o** un header `apollo-require-preflight` no vacío — mandar ambos (JSON + el header) es defensa en profundidad, no redundancia real: si algún intermediario (proxy, gateway) llegara a normalizar/perder el `Content-Type`, el header explícito sigue bastando para pasar la validación de Apollo.
- **Body**: una expresión n8n (`fx`) que envuelve TODO el objeto en `JSON.stringify(...)`, nunca texto armado a mano con concatenación/escapes manuales:
  ```
  {{ JSON.stringify({ query: "<texto literal del query GraphQL>", variables: { <campo>: $json.<campo> } }) }}
  ```

**Por qué esta convención y no `jsonBody` estructurado**: es el mismo patrón que ya se usaba en el workflow anterior (`G8Fq2jaofpNAYCM9`, AI Agent) para las 3 tools de Linear, elegido ahí por consistencia con cómo Linear espera el body GraphQL. Se mantiene acá por dos motivos:
1. **Evita la clase de bug ya sufrida dos veces en el workflow anterior**: escribir el JSON del `query`/`variables` a mano (concatenación de strings, conteo manual de llaves) produjo errores de sintaxis GraphQL (`Unexpected "}"`) difíciles de detectar a simple vista. Envolver todo en `JSON.stringify(...)` delega el escapado (comillas, saltos de línea, llaves) al propio motor de expresiones de n8n — cero conteo manual.
2. **Un solo `=` de expresión, nunca embebido**: el toggle `fx` (o `expr()` del SDK) agrega automáticamente un único `=` al inicio del campo completo. **Nunca** escribir `"campo":"={{ ... }}"` dentro del JSON armado a mano — ese `=` interno queda como carácter literal en el texto final y rompe el valor (ej. `"cycleId":"=abc-123"` en vez de `"cycleId":"abc-123"`). Este error concreto ya se cometió una vez al pegar un valor copiado directamente del cuerpo `jsonBody` estructurado (que sí usa `=` por campo internamente) hacia un body raw.

**Ejemplo de referencia** (`Listar Issues del Ciclo`, estado actual en `rqkqaSiaFq0eK7lU`):
```
{{ JSON.stringify({ query: "query ListarIssuesDelCiclo($cycleId: ID!) {\n  issues(filter: { cycle: { id: { eq: $cycleId } } }, first: 100) {\n    nodes {\n      id\n      title\n      description\n      priorityLabel\n      state { name }\n      labels { nodes { name } }\n      project { name lead { name } }\n      createdAt\n    }\n    pageInfo { hasNextPage endCursor }\n  }\n}", variables: { cycleId: $json.cycleId } }) }}
```
Nota el tipo `$cycleId: ID!` (no `String!`): Linear exige `ID` para el filtro `cycle: { id: { eq: $cycleId } }` — usar `String!` ahí produce el error real `Variable "$cycleId" of type "String!" used in position expecting type "ID"`, encontrado y corregido durante las pruebas (2026-07-14). También se agregó `description` al listado de campos (no estaba en la versión original de este ADR) para que el LLM tenga el contenido real del issue al redactar el texto narrativo, no solo el título.

**Estado de aplicación actual** (verificado vía `get_workflow_details` sobre `rqkqaSiaFq0eK7lU`, 2026-07-15): los 3 nodos (`Buscar Ciclo en Linear`, `Listar Issues del Ciclo`, `Obtener Historial de Issue`) tienen el body en `Raw` + `Content-Type: application/json` + el header `apollo-require-preflight: true` — la conversión que quedó pendiente en la versión original de este ADR ya se completó. Dos matices que no estaban en el plan original:
- `Obtener Historial de Issue` sigue declarando `$issueId: String!` (no `ID!`) y funciona sin error — a diferencia del filtro `cycle: {id: {eq: ...}}`, el argumento `id` del campo `issue(id: ...)` de Linear no parece exigir el tipo `ID` estrictamente en la práctica. No se tocó porque no hay evidencia de que lo necesite.
- `Buscar Ciclo en Linear` terminó con una variante distinta a la documentada originalmente: en vez de declarar `$teamId`/`$name` como variables GraphQL, arma el query completo por concatenación de strings, insertando el `teamId` como literal fijo en el texto y el nombre del ciclo vía `JSON.stringify($json.ciclo)` (para el escapado seguro) directamente en el cuerpo del query, sin bloque `variables`:
  ```
  {{ JSON.stringify({ query: 'query BuscarCiclo { team(id: "a1ba209a-21ce-4ec1-88d4-1392b5771391") { cycles(filter: { name: { eq: ' + JSON.stringify($json.ciclo) + ' } }, first: 5) { nodes { id number name startsAt endsAt } } } }' }) }}
  ```
  Sigue siendo seguro (el valor interpolado pasa por `JSON.stringify`, no concatenación cruda), pero es una convención distinta a la de los otros dos nodos — tenerlo en cuenta si se vuelve a tocar este nodo.

## Consecuencias positivas

- `agregado`, `type`, `priority` y `status` — los campos que alimentan directamente KPIs visibles a liderazgo (donuts de planeados/agregados, por estado) — dejan de depender de la interpretación de un LLM y pasan a ser aritmética/comparación de fechas pura, alineado con la filosofía determinística que ya regía `Calcular Horas y Corte de Agregados` y el resto del proyecto (`extractor.service.ts` de un solo turno).
- Elimina la clase de fallo "el Agent respondió en prosa y crasheó la ejecución en vez de reintentar" — cualquier fallo ahora es un `success:false` HTTP normal, manejado por las mismas ramas IF/notificación que ya existían.
- Las llamadas a Linear son HTTP Request nodes estándar, totalmente pineables/testeables sin gasto de tokens, a diferencia de los subnodos de AI Agent.
- No introduce un mecanismo de extracción narrativa nuevo: reutiliza `POST /api/sprint/extraer`, ya probado por el flujo manual (Flujo 1), manteniendo un único punto de verdad para "cómo se convierte Markdown en `SprintSchema`".

## Consecuencias negativas

- El grafo del workflow creció, porque la orquestación que el LLM resolvía con tool-calling ahora es explícita: Split Out + HTTP por-issue + Code de clasificación + consolidación.
- `Listar Issues del Ciclo` sigue sin paginación real (`first: 100` fijo) — limitación heredada, documentada en el propio nodo, aceptada para el volumen actual del equipo (3 personas, sprints semanales).
- Tras eliminarse la validación de rangos + reintento (ver Estado, nota del 2026-07-15), ya no hay ninguna red de seguridad si el LLM devuelve texto narrativo fuera de los rangos de caracteres que pide `SPRINT_SYSTEM_PROMPT` — el PDF se genera igual, potencialmente con una tarjeta visualmente desbalanceada (ver también Caso borde A de `docs/BUSINESS_FLOWS.md`, Flujo 4).
- Quedan dos workflows de n8n vivos simultáneamente (`G8Fq2jaofpNAYCM9` con AI Agent, sin archivar; `rqkqaSiaFq0eK7lU` con extracción determinística, recomendado) — el pilot real ya se corrió con éxito (2026-07-15), pendiente decidir si se archiva el primero.
- Las herramientas de automatización usadas para construir el workflow no lograron asignar de forma programática las credenciales de los 6 nodos HTTP Request (3 de Linear, 3 hacia el backend de PDF) ni tampoco pudieron confirmar si habían quedado asignadas: la llamada de solo-lectura usada para verificar (`get_workflow_details`) no expone el campo `credentials` para ningún nodo del workflow, tenga o no credencial real asignada — no es evidencia de que la asignación se perdiera, solo de que esa vía de lectura no la muestra. El operador asignó las 6 credenciales manualmente desde la UI de n8n (2026-07-14) y quedaron configuradas.

## Notas de seguimiento

- Reconsiderar el `first: 100` sin paginación en `Listar Issues del Ciclo` si el equipo crece más allá de lo que sostiene el cálculo de horas fijo de 3 miembros (ver `Calcular Horas y Corte de Agregados`, misma limitación conocida ya documentada en `PLAN-N8N-SPRINT-WORKFLOW.md`).
- Pendiente: decidir si se archiva `G8Fq2jaofpNAYCM9` (siguiendo el mismo criterio ya usado para archivar `PCrWDqiWAwqQkkiy` al renombrar bajo el estándar de n8n de Polaria) ahora que el pilot del workflow determinístico ya corrió con éxito, y actualizar `docs/BUSINESS_FLOWS.md` (Flujo 3) para referenciar un único workflow vigente si se decide archivarlo.
- ~~Verificar manualmente en n8n, antes de la primera corrida real, que los 6 nodos HTTP Request tengan credencial asignada~~ — hecho (2026-07-14): 3× `Linear Auth`, 3× `PDF Generator API` (header `X-API-Key` contra el mismo valor que `API_KEY` en `.env` del backend — ver ADR-0005), asignadas manualmente por el operador desde la UI de n8n.
- ~~Correr el primer pilot end-to-end del workflow determinístico~~ — hecho (2026-07-15): ejecución real completa (Linear → extracción → PDF → subida a Drive → fila marcada como procesada), sin intervención manual.
- ~~Agregar el header `apollo-require-preflight: true` a `Listar Issues del Ciclo` y terminar de aplicar la convención completa a `Buscar Ciclo en Linear` y `Obtener Historial de Issue`~~ — hecho (2026-07-14/15): los 3 nodos tienen el header y el body en `Raw` + `JSON.stringify` (ver sección "Convención de implementación" arriba para el estado exacto de cada uno, incluida la variante de `Buscar Ciclo en Linear` sin bloque `variables`).
- Nuevo pendiente: evaluar si reintroducir alguna validación mínima de rangos de caracteres (sin necesariamente el reintento automático que existía antes) ahora que `Aplicar Datos Deterministicos y Validar Rangos` fue eliminado — ver Estado y Consecuencias negativas.
