# Análisis: de `resumen-v2` a informe ejecutivo de sprint

> **Documento analizado:** `backend/src/documents/sprint/template-resumen-v2.html` + su schema (`SprintSchema`, `backend/src/documents/sprint/config.ts`) — el reporte de **cierre de sprint** del generador de PDFs de Polaria (tab "Resumen fin v2" en el frontend).
> **Referencia de agentes:** `RESUMEN_AGENTES_PM_AGENCY_AGENTS.md` (15 agentes relevantes de `agency-agents-main`, con un stack recomendado de 4 core + 3 complementarios).
> **Audiencia objetivo del informe final:** dirección/gerencia/administración — debe leerse y entenderse en menos de 5 minutos.
> **Alcance de este análisis:** contenido y estructura del documento, no el código de la plantilla (eso es un paso posterior, una vez se apruebe la estructura propuesta).

---

## Parte 1 — Diagnóstico del documento actual

### 1.1 Qué cubre hoy (inventario real, verificado contra `config.ts` + `template-resumen-v2.html`)

| Bloque | Contenido |
|---|---|
| Header | `sprintName`, rango de fechas, semana, nº de miembros |
| 4 KPIs de header | Planeados % completado (CUMPLIDO/NO CUMPLIDO), Agregados % completado (idem), Global % vs. planeado (ÓPTIMO/ACEPTABLE/DESVIADO), Horas % vs. planeado (mismo semáforo que Global) — este último condicionado a que llegue `horasPlaneadas` |
| Por miembro (tarjeta) | Objetivo narrativo (480-500 car.), donut "Planeados vs Agregados" (conteo de issues), donut "Resultado" (distribución en 9 categorías estilo Linear, de las cuales solo 5 pueden tener valor `>0` hoy), barra de horas PLAN→REAL por segmento (Proyectos/Reuniones/Incidencias), caja "Desviaciones de alcance" (logrado + motivo, narrativo) |
| Footer | Quién/Cuándo/Dónde/Cómo (narrativo, a nivel de equipo), barra de horas del equipo PLAN→REAL |

Es, en esencia, **un snapshot de cierre por persona** con dos lentes: alcance (issues) y tiempo (horas), más contexto narrativo. Para un documento generado 100% automáticamente a partir de Markdown + Linear, es un punto de partida sólido — el problema no es que esté mal hecho, es que le faltan las piezas que convierten un "resumen" en un **informe de gestión**.

### 1.2 Qué funciona bien

- **Una sola página, jerarquía visual clara** (header → tarjetas → footer): cumple el objetivo de lectura rápida mejor que la mayoría de reportes de sprint hechos a mano.
- **Separación planeado vs. agregado** en todo el documento (KPIs, donuts, horas) — es la señal más honesta de qué tan bien se estimó, y ningún agente del análisis la sustituye, es específica de Polaria.
- **Semáforos ya implementados** (CUMPLIDO/NO CUMPLIDO y ÓPTIMO/ACEPTABLE/DESVIADO) con rangos discutidos y decididos explícitamente (daily 2026-07-07) — es la base correcta para lo que pide la Parte 4.
- **PLAN→REAL por segmento de horas**, no solo en total — permite ver *dónde* se fue el tiempo extra (reuniones, incidencias) sin necesitar el detalle de issues.
- **Auto-ajuste de alto del PDF** (`pdf.generator.ts`) — no hay riesgo de contenido cortado al agregar más miembros, lo cual es relevante porque cualquier sección nueva de la Parte 4 no rompe el layout.

### 1.3 Información redundante o de bajo valor tal como está hoy

1. **El donut "Resultado" por miembro** dibuja 9 categorías (Triage, Bloqueado, Duplicado, Backlog incluidas) cuando el schema de sprint solo soporta 5 estados reales (`IssueStatusSchema`). 4 de las 9 filas de la leyenda **siempre muestran `0`** — ocupan espacio y atención visual sin aportar información, en un documento que se supone se lee en minutos.
2. **Dos vocabularios de semáforo distintos conviviendo en el mismo header** (`CUMPLIDO/NO CUMPLIDO` para Planeados/Agregados vs. `ÓPTIMO/ACEPTABLE/DESVIADO` para Global/Horas): un lector no técnico tiene que aprender dos escalas para leer 4 números que están uno al lado del otro. No es información redundante en el sentido estricto, pero sí es **fricción cognitiva redundante** que se puede resolver con una escala única.

> **Corrección (post-implementación de v3):** una versión anterior de este análisis marcaba `riesgoTransversal` (no renderizado en `template-resumen-v2.html`) como "dato muerto" y recomendaba mostrarlo en el cierre. Es un error: `riesgoTransversal` es prospectivo ("qué puede salir mal") y ya está correctamente reservado para `template-resumen-inicio.html` (donde el sprint todavía no ocurrió). En un reporte de *cierre*, un riesgo especulativo no aporta — lo que ya cubre ese terreno es `desviaciones` por miembro (retrospectivo: qué pasó y por qué). No es una brecha a resolver; es una decisión de diseño ya correcta desde la introducción de v2 (ver comentario en `SprintSchema`, decisión del 2026-07-17). Se corrige también en la Parte 3 y Parte 4 más abajo.

### 1.4 Qué falta para una gestión profesional de proyectos

Agrupado por lo que un director/gerente necesita y hoy no está:

- **Sin bloqueos/vencidos explícitos** (retrospectivo, distinto del riesgo prospectivo de `riesgoTransversal`, que correctamente no aplica al cierre — ver corrección en 1.3): nada resalta qué issue quedó bloqueado o venció durante el sprint, con antigüedad o dueño.
- **Sin pronóstico/forecast.** El documento es 100% retrospectivo (qué pasó); no proyecta si al ritmo actual el próximo sprint/hito se cumple.
- **Sin comparación histórica (tendencia).** No hay ninguna referencia a sprints anteriores — no se puede saber si el equipo está mejorando o empeorando en cumplimiento, ni si el patrón de "agregados" es puntual o crónico.
- **Sin hitos (milestones).** El documento vive a nivel de sprint; no hay noción de hito de proyecto/épica cumplido o próximo, que es justo lo que un gerente de cuenta necesita para hablar con el cliente.
- **Sin "qué decisión necesita tomar la dirección".** Las cajas de "Desviaciones" explican qué pasó, pero no extraen una recomendación accionable con dueño y fecha (patrón Executive Summary Generator / SCQA).
- **Sin vista de portafolio.** El reporte es de un sprint/equipo; si Polaria tiene más de una épica activa en paralelo, no hay forma de comparar/priorizar capacidad entre proyectos desde este documento.
- **Sin veredicto único al inicio.** Hay 4 KPIs, pero ningún "estado general del sprint" consolidado que un lector pueda captar en el primer segundo (el objetivo declarado de "<5 minutos" hoy depende de que el lector sintetice 4 semáforos mentalmente).

### 1.5 Métricas/indicadores a añadir (resumen ejecutivo de la lista anterior)

- **Semáforo único de "salud del sprint"** (agregando los 4 KPIs actuales en un solo veredicto).
- **% de capacidad utilizada por persona** (ya hay el dato crudo — horas reales/planeadas — falta enmarcarlo como utilización/riesgo de sobrecarga).
- **Issues bloqueados/vencidos** (conteo + antigüedad del bloqueo).
- **Tendencia de las últimas 3-4 sprints** (mini-serie de % completado y de horas globales).
- **Pronóstico de cierre** de la épica/proyecto en curso al ritmo actual.
- **Registro de riesgos activos** (no solo el transversal narrativo: severidad + mitigación + dueño).
- **Próximos hitos** (fecha + qué se juega en cada uno).

### 1.6 Reorganización sugerida (alto nivel, se detalla en Parte 4)

El orden actual es *header → detalle por persona → footer de contexto*. Para lectura ejecutiva en <5 min conviene invertir la prioridad: **veredicto y decisiones primero, detalle por persona después** (el lector de dirección rara vez necesita leer las 3-12 tarjetas de miembro completas; las usa como evidencia de respaldo, no como punto de entrada).

---

## Parte 2 — Comparación con los agentes de `RESUMEN_AGENTES_PM_AGENCY_AGENTS.md`

El documento de referencia ya concluyó (sección 5) que el stack estándar para Polaria son **4 agentes core** (Sprint Prioritizer, Project Shepherd, Studio Producer, Chief of Staff), más 2 "complementos de soporte" (Grupo E) que no estaban en el stack fijo pero son justo los que más aplican a *este* documento: Executive Summary Generator, Analytics Reporter. Los evalúo a todos contra `resumen-v2` específicamente (no contra el flujo completo de Polaria, que ya cubrió el documento de referencia).

> **Nota:** una versión anterior de este análisis también evaluaba **Finance Tracker** (costo/presupuesto). Se descartó explícitamente por decisión del usuario — Polaria no quiere exponer costos/tarifas en este documento — y se elimina de todo el análisis (Partes 1, 3, 4 y 5 quedaron ajustadas en consecuencia).

### Sprint Prioritizer — *rigor cuantitativo de capacidad y estimación*

- **Capacidades que aporta:** matemática de velocidad histórica, buffers de capacidad (10-15%), framework de estimación (RICE), matriz de riesgo propia.
- **Qué podría generar automáticamente en el documento:** el **% de utilización de capacidad por persona** (real vs. planeado, ya con el dato crudo disponible en `horas.segmentos`) y una alerta cuando alguien excede sistemáticamente su capacidad — es el agente que mejor explica *por qué* el % "Horas vs. planeado" se desvió, más allá del texto narrativo actual.
- **Secciones que ayudaría a mejorar:** el bloque de horas por miembro (hoy solo muestra el dato, no lo interpreta) y el KPI "Horas · % vs. planeado" del header (hoy es un número aislado sin contexto de tendencia).
- **Apartados nuevos que recomendaría:** un bloque de **"Capacidad y velocidad"** a nivel de equipo — velocidad real del sprint vs. velocidad histórica promedio, para alimentar el forecast de la Parte 4.
- **Solapamiento:** con Analytics Reporter en el terreno de "tendencia" — la diferencia es que Sprint Prioritizer razona en términos de *capacidad/velocidad* (para planear el siguiente sprint), Analytics Reporter en términos de *KPI histórico* (para reportar hacia arriba). No hace falta que generen la misma sección: Sprint Prioritizer alimenta el forecast, Analytics Reporter alimenta la serie histórica visible.
- **Valor para dirección/administración:** es el agente que responde "¿es sostenible este ritmo?" — la pregunta que más le importa a un gerente cuando ve horas por encima de lo planeado sprint tras sprint.

### Project Shepherd — *riesgo formal + coordinación cross-funcional*

- **Capacidades que aporta:** registro de riesgo formal (probabilidad × impacto, mitigación), ruta crítica, comunicación por audiencia.
- **Qué podría generar automáticamente:** un **registro de bloqueos/vencidos** (retrospectivo: qué quedó atascado o fuera de plazo durante el sprint que ya cerró) — no `riesgoTransversal`, que es prospectivo y correctamente vive solo en `resumen-inicio` (ver corrección en 1.3).
- **Secciones que ayudaría a mejorar:** complementa la caja "Desviaciones de alcance" actual — hoy explica *qué pasó*, Project Shepherd la llevaría a explicar también *qué queda pendiente/bloqueado para el próximo sprint* (dependencias no resueltas).
- **Apartados nuevos:** **"Bloqueos"** (issues bloqueados/vencidos con antigüedad, dato retrospectivo que hoy no existe en ningún template de cierre).
- **Solapamiento:** con Chief of Staff en "decisiones pendientes" — se evita duplicando así: Project Shepherd gestiona el **registro de riesgo técnico/operativo** (qué puede bloquear el trabajo), Chief of Staff gestiona el **brief de decisiones de negocio** (qué necesita resolver la dirección). Uno alimenta al otro, no se pisan.
- **Valor para dirección:** es el agente que le da al documento una respuesta explícita a "¿qué requiere atención inmediata?" — hoy esa pregunta (explícitamente listada por el usuario) no tiene una sección dedicada.

### Studio Producer — *vista de portafolio multi-proyecto*

- **Capacidades que aporta:** asignación de capacidad entre proyectos, ROI de cartera, ranking de "qué proyecto se lleva el equipo esta semana".
- **Qué podría generar:** si Polaria tiene más de una épica/proyecto activo en el mismo período, una franja de **"Capacidad del equipo entre proyectos"** — hoy `resumen-v2` asume implícitamente un solo proyecto por sprint.
- **Secciones que ayudaría a mejorar:** el footer "Quién/Cuándo/Dónde/Cómo" — hoy es narrativo y estático; Studio Producer lo convertiría en una vista de asignación real (cuánto % de cada persona fue a este proyecto vs. otros).
- **Apartados nuevos:** **"Contexto de portafolio"**, opcional y solo relevante si hay ≥2 proyectos activos simultáneos.
- **Solapamiento:** ninguno directo con los otros tres — es el único que opera a nivel de *portafolio* en vez de *sprint*. Su valor depende 100% de si Polaria escala a paralelismo real de proyectos (hoy, según el propio `RESUMEN_AGENTES_PM_AGENCY_AGENTS.md`, el modelo es una persona-una épica-un mes, así que hoy es de **prioridad baja** para este documento específico).
- **Valor para dirección:** relevante para un director de cuenta/socio que gestiona varios clientes a la vez, no tanto para leer un sprint individual.

### Chief of Staff — *PMO ligero, filtra ruido, decisiones abiertas*

- **Capacidades que aporta:** "State of Play" (qué se movió, decisiones abiertas con fecha límite), mantiene mapa de dependencias entre documentos, es el único diseñado para "gestionar múltiples agentes de IA" en el contexto de Polaria.
- **Qué podría generar automáticamente:** el **veredicto único de salud del sprint** (1.4/1.6) y la sección **"Decisiones que necesita tomar la dirección"** — es exactamente su función declarada ("filtra ruido, enruta decisiones").
- **Secciones que ayudaría a mejorar:** convierte las 4 tarjetas de KPI del header en una síntesis de una sola frase con semáforo, en vez de dejar que el lector sintetice 4 números.
- **Apartados nuevos:** **"Resumen ejecutivo"** al inicio del documento (2-3 líneas + semáforo) y **"Decisiones abiertas"** (con dueño y fecha límite).
- **Solapamiento:** con Executive Summary Generator — casi total en la función de "resumen al inicio". Se evita duplicando así: Chief of Staff opera a nivel **operativo/semanal** (qué se movió, qué decidir *ahora*), Executive Summary Generator aporta el **formato/framework de redacción** (SCQA, longitud acotada, recomendación con dueño+timeline) que Chief of Staff después llena. En la práctica, uno de los dos sobra como agente activado — se recomienda usar el framework de Executive Summary Generator *dentro* del rol de Chief of Staff, no como dos pasos separados (ver Parte 5).
- **Valor para dirección:** es el agente más directamente alineado con el objetivo del usuario ("que en <5 minutos entiendan el estado real y puedan decidir") — todo lo demás alimenta datos, Chief of Staff los convierte en lectura ejecutiva.

### Executive Summary Generator — *framework de redacción ejecutiva (SCQA/McKinsey)*

- **Capacidades que aporta:** resúmenes de 325-475 palabras con estructura Situación-Complicación-Pregunta-Respuesta, recomendaciones con dueño y timeline explícitos.
- **Qué podría generar:** el párrafo de apertura del informe (reemplaza/formaliza lo que hoy no existe) y el formato exacto de la sección "Decisiones abiertas" que propone Chief of Staff.
- **Secciones que ayudaría a mejorar:** las cajas narrativas actuales (`objetivo`, `desviaciones.logrado/motivo`) ya son texto libre generado por IA — Executive Summary Generator aportaría el *framework* para que ese texto sea consistente en estructura entre sprints, no solo en rango de caracteres (que es lo único que se controla hoy).
- **Apartados nuevos:** ninguno adicional a los ya cubiertos por Chief of Staff — su aporte es de **formato**, no de dato nuevo.
- **Solapamiento:** con Chief of Staff (ver arriba). Recomendación: no activarlo como agente separado, absorber su framework de redacción en el prompt del "resumen ejecutivo" (ya sea generado por Chief of Staff o directamente en `SPRINT_SYSTEM_PROMPT`).
- **Valor para dirección:** garantiza que el resumen ejecutivo sea *escaneable* (frases cortas, recomendación al final) en vez de narrativa continua como las cajas actuales de "Objetivo"/"Desviaciones".

### Analytics Reporter — *dashboards, tendencia, forecasting*

- **Capacidades que aporta:** dashboards de KPI, análisis estadístico, forecasting.
- **Qué podría generar automáticamente:** la **serie histórica** (últimos N sprints: % completado, horas globales, desviación) y el **pronóstico de finalización** de la épica al ritmo actual — responde directamente 2 de las 10 preguntas obligatorias del usuario ("¿cuál es el pronóstico de finalización?", "¿estamos mejorando o empeorando?").
- **Secciones que ayudaría a mejorar:** convierte los 4 KPIs de header (hoy snapshots aislados de un solo sprint) en series con contexto ("112% este sprint, vs. 98%/105%/109% los 3 anteriores").
- **Apartados nuevos:** **"Tendencia"** (mini gráfico o tabla de 3-4 sprints) y **"Pronóstico"**.
- **Solapamiento:** con Sprint Prioritizer en el terreno de forecast — la distinción ya se explicó arriba (Sprint Prioritizer = capacidad/velocidad para planear, Analytics Reporter = serie histórica de KPIs para reportar). En la práctica, ambos necesitan la **misma fuente de datos** (histórico de sprints cerrados), así que conviene que el forecast se calcule en un solo lugar (probablemente al componer los datos del backend, no en dos agentes separados) y ambos "roles" lo consuman.
- **Valor para dirección:** sin este agente (o su lógica), el documento seguirá siendo **puramente retrospectivo** — no puede responder "¿vamos a tiempo?" de forma proyectada, solo "¿qué pasó?".

---

## Parte 3 — Análisis de brechas (Gap Analysis)

| Funcionalidad / Sección | Estado actual | Agente que la cubriría | Prioridad | Beneficio esperado |
|---|---|---|---|---|
| Semáforo único de salud del sprint | No existe (4 KPIs sueltos) | Chief of Staff | **Alta** | Lectura en segundos, no minutos; cumple directamente el objetivo de "<5 min" |
| Resumen ejecutivo inicial (2-4 líneas) | No existe | Chief of Staff + Executive Summary Generator (framework) | **Alta** | Punto de entrada único; evita que el lector tenga que reconstruir el estado leyendo todas las tarjetas |
| Issues "vencidos" (planeados, no Done al cierre) | **Implementado en v3** (`vencidos` en `config.ts`, sin cambio de schema — se deriva de `agregado`+`status`) | Project Shepherd | — | Responde "¿qué quedó pendiente?" por nombre, no solo por conteo |
| Issues realmente "bloqueados" (dependencia externa) | No existe — sí requiere campo nuevo en el schema (`IssueStatusSchema` no tiene "Blocked"), descartado por ahora a favor de "vencidos" | Project Shepherd | **Baja** | Señal más fina que "vencido"; el usuario priorizó "vencidos" primero por no requerir cambio de schema |
| Decisiones abiertas para la dirección | No existe | Chief of Staff | **Alta** | Convierte el documento de informativo a accionable |
| % de utilización de capacidad por persona | Parcial (dato crudo de horas existe, no está interpretado como utilización) | Sprint Prioritizer | **Media** | Detecta sobrecarga/riesgo de burnout antes de que sea un problema de entrega |
| Tendencia histórica (3-4 sprints) | No existe | Analytics Reporter | **Media** | Responde "¿mejoramos o empeoramos?"; requiere persistir históricos (hoy cada PDF es independiente) |
| Pronóstico de finalización (forecast) | No existe | Analytics Reporter + Sprint Prioritizer | **Media** | Responde explícitamente una de las 10 preguntas obligatorias del informe |
| Próximos hitos | No existe | Project Shepherd / Studio Producer | **Media** | Da contexto de "qué sigue", útil para conversación con cliente |
| Unificar vocabulario de semáforos (2 escalas → 1) | Existe pero inconsistente | — (cambio de diseño, no requiere agente) | **Baja** | Reduce fricción de lectura; esfuerzo de implementación mínimo |
| Quitar categorías de estado siempre en 0 del donut "Resultado" | Existe pero con ruido visual | — (cambio de diseño) | **Baja** | Limpieza visual, sin agente involucrado |
| Vista de portafolio multi-proyecto | No existe | Studio Producer | **Baja** | Solo relevante si Polaria pasa a paralelismo real de proyectos (hoy no es el modelo operativo) |

---

## Parte 4 — Propuesta de mejora: nueva estructura del documento

Principio de reorganización: **de arriba hacia abajo, de más sintético a más detallado** — un director debería poder detenerse después de la primera sección y ya saber qué hacer; el resto es evidencia de respaldo para quien quiera profundizar.

| # | Sección | Objetivo | Contenido específico | Agente responsable | Visual |
|---|---|---|---|---|---|
| 1 | **Resumen ejecutivo** | Responder en 10 segundos "¿cómo va esto?" | 2-4 líneas (SCQA) + **semáforo único** de salud del sprint (verde/amarillo/rojo) agregando los 4 KPIs actuales | Chief of Staff (framework: Executive Summary Generator) | Badge grande + texto corto |
| 2 | **KPIs de cierre** *(ya existe, se conserva)* | Cuantificar cumplimiento | Planeados/Agregados/Global/Horas — **unificar a una sola escala de semáforo** (3 niveles) en vez de 2 escalas distintas | Backend (`resolverEstadoGlobal` ya lo resuelve; extender a los 4) | 4 tarjetas de KPI, semáforo consistente |
| 3 | **Decisiones que requiere la dirección** *(nueva)* | Convertir el reporte en accionable | Lista corta: decisión, contexto en 1 línea, dueño, fecha límite | Chief of Staff | Tabla de 2-4 filas máx. |
| 4 | **Bloqueos** *(nueva)* | Detectar qué necesita atención inmediata | Issues bloqueados/vencidos con antigüedad y dueño — dato retrospectivo, no confundir con `riesgoTransversal` (prospectivo, ya reservado correctamente a `resumen-inicio`) | Project Shepherd | Tabla corta + semáforo por fila |
| 5 | **Capacidad y horas** *(evoluciona el bloque actual)* | Ver si el ritmo es sostenible | Lo que ya existe (PLAN→REAL por segmento) + interpretación de % de utilización por persona + alerta de sobrecarga | Sprint Prioritizer | Barras ya existentes + badge de utilización |
| 6 | **Tendencia y pronóstico** *(nueva)* | Ver si se mejora/empeora y proyectar cierre | Serie de 3-4 sprints anteriores (% completado, horas) + pronóstico de finalización de la épica en curso al ritmo actual | Analytics Reporter | Mini-serie/sparkline + una cifra de forecast |
| 7 | **Detalle por miembro** *(se conserva, se mueve más abajo)* | Evidencia de respaldo, no punto de entrada | Todo lo que hoy existe: objetivo, donuts, horas, desviaciones — sin cambios de contenido, solo de posición en el documento | (sin cambios — ya generado por `SPRINT_SYSTEM_PROMPT`) | Igual a hoy |
| 8 | **Contexto de equipo** *(se conserva)* | Quién/cuándo/dónde/cómo | Igual a hoy | (sin cambios) | Igual a hoy |
| 9 | **Próximos hitos** *(nueva, opcional)* | Qué viene después | Fecha + qué se juega (solo si aplica al proyecto) | Project Shepherd / Studio Producer | Lista corta |

> Sin sección de costo/presupuesto — descartada explícitamente por el usuario (ver nota en Parte 2). El documento no expone tarifas ni dinero.

### Cómo responde esta estructura a las preguntas obligatorias del usuario

| Pregunta | Sección que la responde |
|---|---|
| ¿Cuál es el estado real del proyecto? | 1 (Resumen ejecutivo) |
| ¿Qué % del trabajo está completado? | 2 (KPIs) |
| ¿Adelantados o retrasados respecto al plan? | 2 (Global % vs. planeado) + 6 (tendencia) |
| ¿Cuál es la desviación en tiempo/esfuerzo? | 5 (horas) — sin presupuesto, ver nota arriba |
| ¿Qué riesgos requieren atención inmediata? | 3 (decisiones) + 4 (bloqueos) |
| ¿Qué tareas están bloqueadas o fuera de plazo? | 4 |
| ¿Qué hitos se cumplieron y cuáles están próximos? | 9 |
| ¿Cómo está la utilización de capacidad del equipo? | 5 |
| ¿Cuál es el pronóstico de finalización al ritmo actual? | 6 |
| ¿Qué decisiones necesita tomar la dirección? | 3 |

Con esta estructura, **las secciones 1-4 caben en la primera pantalla/media página** y ya responden 7 de las 10 preguntas — el resto (5-10) es profundización para quien necesite más detalle, sin obligar a nadie a leerlo para "entender el estado real".

---

## Parte 5 — Recomendaciones finales

**Conservar tal cual:**
- La separación planeado vs. agregado en todo el documento — es la señal más valiosa y específica de Polaria, ningún agente la reemplaza.
- Las tarjetas por miembro (objetivo, donuts, horas, desviaciones) — se mueven de posición (sección 8, no la primera), no se eliminan ni se rediseñan en contenido.
- El auto-ajuste de alto del PDF — sigue siendo necesario con más secciones, no menos.
- El footer Quién/Cuándo/Dónde/Cómo — sigue siendo información de contexto válida.

**Eliminar / dejar de renderizar sin dato:**
- Las 4 categorías del donut "Resultado" que siempre están en 0 (Triage, Bloqueado, Duplicado, Backlog) hasta que el schema realmente las soporte — hoy son ruido visual puro.
- Nada del contenido narrativo actual se elimina. `riesgoTransversal` **no** debe agregarse al cierre — confirmado con el usuario y correcto desde el diseño original: es prospectivo y ya vive donde corresponde (`resumen-inicio`).

**Reorganizar:**
- Invertir el orden: resumen ejecutivo + decisiones + bloqueos primero, detalle por persona después (Parte 4).
- Unificar los dos vocabularios de semáforo (CUMPLIDO/NO CUMPLIDO y ÓPTIMO/ACEPTABLE/DESVIADO) en una sola escala de 3 niveles para los 4 KPIs de header.

**Nuevas secciones a incorporar (en orden de prioridad, según la Parte 3):**
1. Resumen ejecutivo + semáforo único (Alta)
2. Decisiones que requiere la dirección (Alta)
3. Bloqueos/vencidos, dato retrospectivo nuevo (Alta)
4. % de utilización de capacidad interpretado, no solo mostrado (Media)
5. Tendencia + pronóstico (Media — requiere primero persistir históricos de sprints cerrados, hoy cada PDF se genera de forma aislada; es el prerrequisito técnico más grande de toda esta propuesta)
6. Próximos hitos (Baja)
7. Vista de portafolio (Baja — solo si Polaria pasa a paralelismo real de proyectos)

Sin costo/presupuesto en ninguna fase — descartado explícitamente por el usuario, Polaria no quiere exponer tarifas/dinero en este documento.

**Agentes a usar para generar cada sección (mapeo directo a la Parte 4):**
- Chief of Staff → Resumen ejecutivo + Decisiones abiertas (con el framework de Executive Summary Generator absorbido en su prompt, no como agente separado — evita el solapamiento identificado en Parte 2).
- Project Shepherd → Bloqueos + Próximos hitos.
- Sprint Prioritizer → Interpretación de capacidad/utilización.
- Analytics Reporter → Tendencia y pronóstico (comparte fuente de datos con Sprint Prioritizer, no duplicar el cálculo).
- Studio Producer → Vista de portafolio (única sección de prioridad Baja, activar solo si cambia el modelo operativo).

**Versión ideal como estándar de la agencia — hoja de ruta en 3 fases**, para no intentar todo de una vez (consistente con la filosofía de "skills angostos, no fusión" que ya adoptó `RESUMEN_AGENTES_PM_AGENCY_AGENTS.md` en su sección 8):

- **Fase 1 (bajo costo, sin cambios de arquitectura):** resumen ejecutivo + semáforo único, unificar vocabulario de semáforos, quitar categorías en 0. Ya implementada en `template-resumen-v3.html`.
- **Fase 2 — implementada en `template-resumen-v3.html`:** utilización de capacidad interpretada por persona (badge `% CAPACIDAD` reusando `porcentaje`/`estadoSprint` que `construirBloqueHoras()` ya calculaba a nivel de miembro) + issues "vencidos" (planeados sin llegar a Done al cierre, listados por nombre en una caja condicional por tarjeta — resultó no necesitar campo nuevo, se deriva de `agregado`+`status`). Sin costo/presupuesto, descartado. Queda pendiente, de menor prioridad, la variante más fina de "bloqueado real" (dependencia externa), que sí requeriría un campo nuevo en el schema.
- **Fase 3 — implementada en `template-resumen-v3.html` (tendencia + proyección; hitos queda pendiente):** el generador dejó de ser puramente stateless para esto. `backend/src/documents/sprint/historico.ts` persiste un JSON local no versionado (`backend/data/sprint-historico.json`) con un registro resumido por sprint cerrado; `historico.routes.ts` expone `POST /api/sprint/historico` (registro explícito, upsert por sprintName+weekNumber — deliberadamente separado de `/pdf` para que probar/regenerar el PDF no ensucie el histórico) y `GET /api/sprint/historico`. `componerDatosSprint()` lee ese histórico (solo lectura, seguro también para `/preview`) y calcula `tendencia` (últimos 3 sprints anteriores + el actual) y `proyeccion` (MEJORANDO/ESTABLE/EMPEORANDO comparando el % global actual vs. el promedio de esos 3). Sin pronóstico de fecha de cierre de épica: el schema de Sprint no trackea alcance total de la épica, así que "proyección" es tendencia de KPI, no una fecha estimada. **Pendiente:** wiring en n8n para que llame a `POST /api/sprint/historico` cuando un sprint realmente cierra (no se toca en la misma sesión que el backend, mismo criterio que otros pendientes de n8n — ver `feedback_n8n_workflow_editing` en memoria) y la sección de "Próximos hitos" (no implementada, sigue dependiendo de datos de proyecto/época que hoy no están en `SprintSchema`).

No se recomienda instalar los 6 agentes evaluados como agentes de terceros activos — mismo principio ya validado en el documento de referencia: usarlos como **plantillas de qué preguntar/calcular**, incorporadas directamente al `SPRINT_SYSTEM_PROMPT` y a `componerDatosSprint()`, no como agentes externos corriendo en paralelo al flujo actual de extracción.
