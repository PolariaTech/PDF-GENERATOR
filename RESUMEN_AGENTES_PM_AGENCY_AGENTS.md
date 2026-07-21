# Resumen de Investigación: Agentes de Planificación y Gestión de Proyectos (agency-agents-main)

> **Documento de referencia autosuficiente** — generado para servir como contexto inicial en una nueva sesión, sin dependencia del historial de la conversación original.
>
> **Repositorio analizado:** `D:\agency-agents-main` ("The Agency" — msitarzewski/agency-agents), 147 agentes en 12 divisiones, colección de prompts de personalidad para Claude Code.
> **Contexto de aplicación:** Polaria, agencia de desarrollo de software. Repositorio de trabajo: `D:\POLARIA\MATEO_SUPPORT` (documentación y operaciones del workflow n8n "Mateo Support"). Equipo Linear: POLARIA. Responsable: Daniel Galvis (daniel.galvis@polaria.tech).

---

## 1. Objetivo de la investigación

**Qué se buscaba resolver:** Identificar, dentro del repositorio `agency-agents-main`, todos los agentes que aportan valor real a la **planificación, gestión y estimación de proyectos** — priorizando específicamente agentes de Project Management, Product Management, Delivery Management, Scrum/Agile, PMO, Estimación, Roadmapping, Capacity Planning y Risk Management — para evaluar si adoptarlos como estándar en el flujo de trabajo de Polaria.

**Contexto de uso:** Polaria es una agencia de desarrollo de software que actualmente gestiona varios proyectos/épicas en paralelo en Linear (equipo POLARIA), con un modelo operativo donde **una persona trabaja en una sola épica por mes** (no hay reparto de tiempo entre múltiples proyectos simultáneos por el mismo responsable). El caso de estudio concreto usado durante la investigación fue la épica real **"Mateo Support - Base de conocimiento interna segregada por rol"** (ventana 20/07–16/08/2026), para la cual se terminó aplicando en la práctica parte de lo aprendido (ver sección 8).

---

## 2. Hallazgos principales

Se identificaron **15 agentes relevantes** (de 147 totales) repartidos en 5 grupos funcionales, más **1 framework de meta-orquestación** (NEXUS, no es un agente individual). Se excluyó explícitamente 1 agente que parecía encajar por palabra clave pero no aporta valor real de PM.

### Grupo A — Núcleo Producto y Proyecto

| Agente | Ruta | Función | Fortalezas | Limitaciones | Caso de uso ideal |
|---|---|---|---|---|---|
| **Product Manager** ("Alex") | `product/product-manager.md` | Dueño del ciclo de vida completo del producto: discovery, PRD, roadmap Now/Next/Later, GTM, medición de resultados | Cobertura de ciclo completo más amplia de todo el repo; fuerza evidencia antes de construir; plantillas de PRD con tabla de riesgos y non-goals explícitos | No hace WBS ni asignación de recursos día a día — es estratégico, no operativo | Productos B2B SaaS con usuarios recurrentes donde hay que decidir *qué* construir, no solo *cómo* |
| **Sprint Prioritizer** | `product/product-sprint-prioritizer.md` | Priorización ágil (RICE, MoSCoW, Kano) + capacity planning (velocidad histórica, buffers 10-15%) | El más fuerte en estimación cuantitativa y gestión de capacidad; matriz de riesgo propia | No cubre descubrimiento ni estrategia de producto; asume que el backlog ya existe | Equipos con cadencia de sprints y backlog que compite por el mismo equipo |
| **Senior Project Manager** | `project-management/project-manager-senior.md` | Convierte specs en tareas atómicas (WBS de bajo nivel) con criterios de aceptación | Extremadamente concreto, anti-scope-creep | Sesgado a un stack específico (Laravel/Livewire/FluxUI); un solo proyecto, no portafolio | Proyectos con spec bien definida y un solo hilo de trabajo |
| **Project Shepherd** | `project-management/project-management-project-shepherd.md` | Coordinación cross-funcional, timeline con ruta crítica, gestión de riesgo formal, comunicación con stakeholders | El más completo en registro de riesgo formal y comunicación por audiencia | Genérico, sin mecánicas ágiles (no sprints ni velocidad) | Proyectos multi-equipo con stakeholders de distinta autoridad |
| **Studio Producer** | `project-management/project-management-studio-producer.md` | Liderazgo de **portafolio multi-proyecto**: asignación de recursos entre proyectos, ROI de cartera | Única capa de decisión "¿qué proyecto se lleva el equipo esta semana?" | Demasiado alto nivel para ejecución diaria — necesita un PM debajo | Agencias con varios clientes/proyectos simultáneos |
| **Studio Operations** | `project-management/project-management-studio-operations.md` | Gestión operativa día a día — SOPs, coordinación de recursos, herramientas | Complemento útil para procesos repetibles | Bajo valor para planificación estratégica — es "que la máquina no se trabe" | Estandarizar onboarding, vendors, herramientas |

### Grupo B — Descubrimiento e insights (alimentan la fase de requisitos)

| Agente | Ruta | Función | Limitación clave |
|---|---|---|---|
| **Feedback Synthesizer** | `product/product-feedback-synthesizer.md` | Sintetiza feedback multi-canal en prioridades cuantificadas | Bajo valor si el backlog ya viene definido (sin usuarios externos activos) |
| **Trend Researcher** | `product/product-trend-researcher.md` | Inteligencia de mercado (TAM/SAM/SOM, análisis competitivo) | Bajo valor para proyectos internos ya decididos |
| **Experiment Tracker** | `project-management/project-management-experiment-tracker.md` | Gestión de portafolio de experimentos A/B, rigor estadístico | Nicho — solo útil con tráfico suficiente para A/B testing real |

### Grupo C — Capa de meta-coordinación (PMO / orquestación)

| Agente | Ruta | Función | Nota |
|---|---|---|---|
| **Chief of Staff** | `specialized/specialized-chief-of-staff.md` | Coordinador maestro para founders/ejecutivos: filtra ruido, enruta decisiones, mantiene "mapa de dependencia de documentos" | El único diseñado explícitamente para "gestionar múltiples agentes de IA y mantener el contexto maestro" — encaja con el patrón ya usado en Polaria (`doc-updater`, `MEMORY.md`) |
| **Agents Orchestrator** | `specialized/agents-orchestrator.md` | Controlador de pipeline PM→Arquitectura→[Dev↔QA loop]→Integración, con reintentos limitados | Solo útil si el "equipo" son otros agentes de IA ejecutando tareas de desarrollo, no personas humanas |

### Grupo D — Gobernanza de entrega

| Agente | Ruta | Función | Nota |
|---|---|---|---|
| **Jira Workflow Steward** | `project-management/project-management-jira-workflow-steward.md` | Disciplina de branch/commit/PR trazable a un ticket | Bajo valor inmediato para Mateo Support (workflow n8n sin Git) |

### Grupo E — Complementos de soporte (fuera de PM/Producto, cierran huecos del ciclo)

| Agente | Ruta | Función |
|---|---|---|
| **Finance Tracker** | `support/support-finance-tracker.md` | Presupuesto, cash flow, análisis de inversión con NPV/IRR/payback |
| **Analytics Reporter** | `support/support-analytics-reporter.md` | Dashboards de KPI, análisis estadístico, forecasting |
| **Executive Summary Generator** | `support/support-executive-summary-generator.md` | Resúmenes ejecutivos con framework SCQA/McKinsey (325-475 palabras, recomendaciones con dueño+timeline) |

### Excluido explícitamente

**Behavioral Nudge Engine** (`product/product-behavioral-nudge-engine.md`) apareció por palabra clave en la carpeta `product/` pero **no aporta valor de gestión de proyectos**: es un motor de psicología conductual para diseñar notificaciones/cadencias dentro de un producto de software para *usuarios finales*, no una herramienta para planificar el proyecto de construirlo.

---

## 3. Ranking de los agentes

| # | Agente | Categoría | Por qué este puesto |
|---|---|---|---|
| 1 | **Sprint Prioritizer** | Imprescindible | Único con matemática de capacidad real (velocidad, buffers) + framework de estimación formal (RICE) + riesgo, todo en un mismo agente |
| 2 | **Product Manager** | Condicional* | Cobertura de ciclo completo más amplia; imprescindible si se gestiona *producto* (ej. Polaria App, vendido a clientes), prescindible si el backlog ya viene predefinido (ej. Mateo Support) |
| 3 | **Project Shepherd** | Imprescindible | El más fuerte en riesgo formal + stakeholders — el "PM clásico" que falta en trabajo cross-funcional |
| 4 | **Studio Producer** | Imprescindible | Única capa de portafolio — crítico con varios clientes/épicas simultáneas |
| 5 | **Senior Project Manager** | Opcional | WBS concreto pero acotado a un solo proyecto y sesgado a un stack específico (Laravel) |
| 6 | **Chief of Staff** | Imprescindible | Mejor "PMO de bolsillo" para un líder solo gestionando múltiples herramientas/agentes de IA |
| 7 | **Agents Orchestrator** | Opcional | Solo si el "equipo" son otros agentes de IA en un pipeline de dev, no aplica a coordinación humana |
| 8 | **Finance Tracker** | Opcional | Imprescindible en cuanto la estimación necesita traducirse a dinero real (ROI/presupuesto) |
| 9 | **Executive Summary Generator** | Opcional | El mejor para reportes de estado a nivel ejecutivo/cliente |
| 10 | **Analytics Reporter** | Opcional | Seguimiento cuantitativo post-lanzamiento, más BI que PM |
| 11 | **Experiment Tracker** | Opcional | Nicho (A/B testing) |
| 12 | **Feedback Synthesizer** | Opcional | Insumo de descubrimiento, no de planificación de ejecución |
| 13 | **Jira Workflow Steward** | Opcional | Solo útil con Git+Jira real |
| 14 | **Studio Operations** | Opcional | Aporte tangencial a la planificación estratégica |
| 15 | **Trend Researcher** | Opcional | Bajo valor si el proyecto ya está decidido |

*Product Manager quedó en categoría "condicional" tras una revisión posterior: su mayor valor aparece cuando hay descubrimiento real de mercado por hacer (producto vendido a clientes externos), no cuando el backlog ya viene de un levantamiento de requerimientos aprobado.

---

## 4. Matriz de capacidades

| Agente | Discovery | Alcance | WBS | Est. Esfuerzo | Est. Costos | Riesgos | Sprints | Recursos | Seguimiento | Reportes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Product Manager | ● | ● | ◐ | ◐ | — | ● | ● | — | ◐ | ● |
| Sprint Prioritizer | — | ◐ | ◐ | ● | — | ● | ● | ● | ◐ | ◐ |
| Project Shepherd | ◐ | ● | ● | ◐ | ◐ | ● | ● | ● | ● | ● |
| Studio Producer | ◐ | ● | — | ◐ | ● | ● | ◐ | ● | ◐ | ● |
| Senior Project Manager | — | ● | ● | ◐ | — | — | — | — | ◐ | — |
| Chief of Staff | ◐ | ◐ | — | — | — | ● | ◐ | ◐ | ● | ● |
| Agents Orchestrator | — | — | — | — | — | ◐ | — | — | ● | ● |
| Finance Tracker | — | — | — | — | ● | ◐ | — | ◐ | ◐ | ● |
| Executive Summary Gen. | — | — | — | — | — | ◐ | — | — | — | ● |
| Analytics Reporter | ◐ | — | — | — | — | — | — | — | ● | ● |
| Experiment Tracker | ◐ | ◐ | — | ◐ | — | ● | ◐ | — | ◐ | ◐ |
| Feedback Synthesizer | ● | ◐ | — | — | — | — | — | — | — | ◐ |
| Jira Workflow Steward | — | — | — | — | — | — | — | — | ● | ◐ |
| Studio Operations | — | — | — | — | ◐ | — | — | ◐ | ◐ | ◐ |
| Trend Researcher | ● | — | — | — | ◐ | ◐ | — | — | — | ◐ |

`● fuerte · ◐ parcial · — no aplica`

---

## 5. Stack recomendado

Para una agencia como Polaria, el stack estándar (no los 15) se reduce a **4 agentes core**:

| Agente | Rol en el proceso | Justificación |
|---|---|---|
| **Sprint Prioritizer** | Motor de estimación y capacidad | Es lo que más faltaba en el flujo actual de creación de issues en Linear — estimación sin datos de velocidad real |
| **Project Shepherd** | Gestión de riesgo y coordinación cuando un issue deja de ser trivial | Aporta el registro de riesgo formal que hoy no existe (solo comentarios sueltos al bloquear un issue) |
| **Studio Producer** | Vista de portafolio entre épicas simultáneas | Necesario cuando compiten varias épicas por la misma capacidad de una persona |
| **Chief of Staff** | PMO ligero sobre los propios skills de Claude Code | Complementa (no reemplaza) `doc-updater`/`MEMORY.md`, ya que Polaria opera con una sola persona coordinando múltiples herramientas |

**Product Manager se dejó fuera del set estándar** — es de alto valor pero **específico a producto vendido a clientes** (ej. Polaria App), no a proyectos internos con backlog ya definido (ej. Mateo Support). Se recomienda activarlo puntualmente para esos casos, no como parte del stack fijo.

**Se descartó explícitamente activar los 15 agentes o fusionarlos en un único "superagente"** (ver sección 8 — decisión tomada).

---

## 6. Workflow propuesto

Flujo desde la llegada de un proyecto/épica nueva hasta su cierre, usando el stack recomendado:

```
1. LLEGADA DE LA ÉPICA
   └─ Studio Producer → decide cuánta capacidad del equipo va a esta épica
      vs. otras activas (vista de portafolio)
      Artefacto: asignación de capacidad semanal por épica

2. CREACIÓN DEL BACKLOG (linear-issue-creator, ya existente en este repo)
   └─ Sprint Prioritizer → valida el backlog contra la velocidad histórica
      real del responsable (no una estimación a ciegas)
      Artefacto: distribución del backlog en el período, con % de
      utilización de capacidad y margen para trabajo no planificado

3. EJECUCIÓN (linear-transiciones-estado, ya existente en este repo)
   └─ Cuando un issue se bloquea → Project Shepherd aporta el registro
      de riesgo estructurado (probabilidad × impacto, mitigación,
      a qué otro issue bloquea)
      Artefacto: risk register visible en el issue/proyecto

4. SEGUIMIENTO SEMANAL / CIERRE DE HILO (doc-updater, ya existente)
   └─ Chief of Staff → complementa con un "State of Play": qué se
      movió, decisiones abiertas con fecha límite, risk register de
      30 días
      Artefacto: brief semanal + prompt de continuidad

5. CIERRE DE LA ÉPICA
   └─ Studio Producer → revisa ROI/cumplimiento de KPIs de la épica
      antes de reasignar la capacidad liberada a la siguiente
```

Los agentes no reemplazan los skills ya existentes en `D:\POLARIA\MATEO_SUPPORT\.claude\skills\` (`linear-issue-creator`, `linear-transiciones-estado`, `doc-updater`) — los complementan en los puntos donde hoy falta rigor cuantitativo (capacidad, riesgo estructurado, vista de portafolio).

---

## 7. NEXUS

**Qué es:** NEXUS ("Network of EXperts, Unified in Strategy") es el framework de meta-orquestación documentado en `strategy/nexus-strategy.md` + `strategy/QUICKSTART.md` (más playbooks y runbooks de apoyo). **No es un agente individual** — es la doctrina que conecta a los 147 agentes del repositorio en un pipeline de **7 fases**: Discover → Strategize → Scaffold → Build → Harden → Launch → Operate, con:
- **Quality Gates** obligatorios entre cada fase, con criterios de paso explícitos y un "gate keeper" nombrado.
- **Matriz de coordinación** de qué agente produce qué artefacto para cuál otro agente.
- **Tabla de gestión de riesgo por categoría** (deuda técnica, scope creep, presupuesto, etc.) con dueño y ruta de escalamiento.
- 3 modos de activación según escala: **NEXUS-Full** (12-24 semanas, todos los agentes), **NEXUS-Sprint** (15-25 agentes, 2-6 semanas), **NEXUS-Micro** (5-10 agentes, 1-5 días).

**Por qué es relevante:** Es la respuesta pre-construida en el propio repositorio a la pregunta "¿qué combinación de agentes cubre el ciclo completo de un proyecto?" — la misma pregunta que motivó esta investigación. Su principio central — **coordinación con gates, nunca fusión de roles** — fue la base para rechazar la propuesta (sugerida externamente por ChatGPT) de fusionar 4-5 agentes en un único "Agency Project Manager" (ver sección 8).

**Cómo encaja en el workflow de Polaria:** Polaria, por su escala (una persona, un proyecto activo por mes), se parece más al modo **NEXUS-Micro/Sprint** que a NEXUS-Full. No se recomienda adoptar las 9 divisiones completas de NEXUS — solo su **principio de handoffs estructurados y gates de calidad**, aplicado al subconjunto de 4 agentes del stack recomendado (sección 5). El workflow propuesto (sección 6) es, en esencia, una versión reducida y adaptada de la lógica de NEXUS a la escala real de Polaria.

---

## 8. Conclusiones

### Principales aprendizajes
- De 147 agentes en el repositorio, solo **15 aportan valor real** a planificación/gestión/estimación de proyectos — la mayoría de los "candidatos" descartados fallan por ser demasiado genéricos (Studio Operations), demasiado orientados a mercado externo (Trend Researcher) o de nicho (Experiment Tracker, Jira Workflow Steward).
- **Sprint Prioritizer** es el agente individual más valioso por su rigor cuantitativo en capacidad y estimación — algo que el flujo actual de Polaria en Linear no tenía.
- El principio de **"agentes separados con handoffs" supera a "un superagente fusionado"** por 4 razones concretas: (1) las reglas operativas de personas distintas (ej. Chief of Staff "filtra ruido" vs. Product Manager "haz explícito cada trade-off") se diluyen si se fusionan en un solo prompt; (2) se pierde el chequeo cruzado entre agentes; (3) contradice el patrón ya establecido en este mismo repositorio (`doc-updater`, `linear-issue-creator`, `linear-transiciones-estado` son skills angostos de una sola responsabilidad, no un PM genérico); (4) es más difícil de depurar cuando algo falla.

### Decisiones tomadas
1. **No instalar los 15 agentes ni fusionarlos** en un "Agency Project Manager" único (propuesta externa descartada con justificación de diseño de agentes).
2. **Adoptar el stack de 4** (Sprint Prioritizer, Project Shepherd, Studio Producer, Chief of Staff) como capas de referencia, no necesariamente como agentes instalados literalmente, sino como **plantillas y algoritmos a incorporar** en un futuro skill propio ("polaria-pm"), en vez de activarlos como agentes de terceros sin adaptar.
3. **Dejar Product Manager fuera del set fijo** — de alto valor pero específico a producto con clientes externos (Polaria App), no a proyectos internos con backlog predefinido (Mateo Support).
4. Se validó el enfoque en la práctica: se aplicó el cálculo de capacidad estilo Sprint Prioritizer contra la **velocidad histórica real de Daniel** (56 pts en la épica anterior "Mateo Support v2.0.0", ejecutada en solitario en ~3.43 semanas → ~16.3 pts/semana bruta, ~13.9 pts/semana con buffer del 15%). Esto permitió pasar de un backlog inicial de 7 issues (22 pts, que "se sentía corto para un mes") a un backlog de **13 issues (35 pts)** con 5 huecos de alcance identificados y cerrados (prueba de fuga KPI2, mecanismo de asignación de rol, split de ingesta por categoría, issue de despliegue a producción, instrumentación de KPI3).
5. Los 13 issues quedaron creados en Linear (**POL-108 a POL-120**, proyecto "Mateo Support - Base de conocimiento interna segregada por rol", 35 pts totales) con dependencias enlazadas (`blockedBy`/`related`) y un formato de descripción en Markdown real (blockquote de metadatos, headers `##` con emoji, listas con negrita, tabla de estimación) — formato que también se incorporó como estándar permanente en el skill `linear-issue-creator` (`D:\POLARIA\MATEO_SUPPORT\.claude\skills\linear-issue-creator\SKILL.md`) para todos los issues futuros.
6. Se generó un cronograma diario completo del mes (`CRONOGRAMA_20JUL-16AGO_2026.md` en la raíz del repo) que integra: el backlog de 13 issues con checkboxes por semana, ceremonias de equipo (daily 15min, sprint planning 45min con corrimiento automático cuando el lunes es festivo), los 2 festivos colombianos del período (20 jul Independencia, 7 ago Boyacá), un bloque protegido diario para estudio de AWS/Cloud ("Personalizaciones"), y una reserva de incidencias integrada al bloque de proyecto (interrupción inmediata si aparece, avance extra si no).

### Recomendaciones finales para Polaria
- **No comprar/instalar herramientas de PM externas todavía** — el gap real no era falta de un agente de PM, era falta de **datos de capacidad reales** (velocidad histórica) al momento de estimar. Ese gap ya se resolvió manualmente en esta sesión.
- Si se decide formalizar el enfoque, construir un **skill "polaria-pm"** propio y acotado (no un agente genérico importado) que extraiga solo 4 comportamientos concretos: (1) cálculo de capacidad al crear/refinar issues, (2) registro de riesgo estructurado al bloquear un issue, (3) brief semanal tipo "State of Play" complementando `doc-updater`, (4) vista de portafolio cuando hay más de una épica activa — deliberadamente **sin** discovery de producto ni PRDs, porque el backlog de Polaria ya viene predefinido por el levantamiento de requerimientos existente.
- Mantener el principio de **skills angostos y de una sola responsabilidad** que ya rige este repositorio, en vez de migrar hacia un agente PM monolítico — es una decisión de diseño validada, no solo una preferencia.
