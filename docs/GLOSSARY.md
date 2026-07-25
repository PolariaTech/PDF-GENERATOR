# Glosario de términos del dominio

**Audiencia**: cualquier persona que necesite entender el vocabulario de negocio de este proyecto — desarrolladores nuevos, y cualquiera del equipo de Polaria que edite un JSON antes de generar un PDF y necesite saber qué significa cada campo.

Cada entrada indica: definición de negocio en lenguaje simple, cómo se llama ese mismo concepto en el código (para que puedas ubicarlo si necesitás tocarlo), y un ejemplo real tomado del código o de los datos de ejemplo del proyecto.

---

## Tipos de documento

### Épica (`epica`)

**Definición de negocio**: el resumen ejecutivo mensual de las épicas (grandes iniciativas de producto) en las que trabaja el equipo de Polaria. Por cada épica del mes muestra su objetivo, qué entra en el alcance, sus KPIs, el riesgo principal y quién la lidera; además de un bloque de horas del equipo y un riesgo transversal que afecta a todas las épicas del mes a la vez.

**Representación en el sistema**: tipo de documento con `id: "epica"` registrado en `backend/src/documents/registry.ts`. Todo su código vive en `backend/src/documents/epica/`: `config.ts` (schema `EpicaSchema`, prompt `EPICA_SYSTEM_PROMPT`, función `componerDatosEpica`), `sample-data.ts` y una única plantilla (`template.html`, clave `default`).

**Términos relacionados**: `componerDatos`, `HORAS_FIJAS`, `equipo`, `riesgoTransversal`.

**Ejemplo concreto**: un documento de Épica para el período JUNIO-JULIO puede incluir la épica "Bodega Fría v2.0" (responsable LUCHO) con 3 KPIs tipo chip (por ejemplo `6/6 VISTAS`, `>90% PRECISION`, `<5S RESPUESTA`) y su propio riesgo, junto a otras épicas del mismo mes lideradas por DANI o MAURO.

**No confundir con**: **Sprint** — Épica resume un mes completo agrupado por iniciativa de producto; Sprint resume una semana/ciclo corto agrupado por persona y por issue individual.

### Sprint Inicio (`sprint-inicio`)

**Definición de negocio**: el resumen de arranque de un sprint (ciclo corto de trabajo, típicamente semanal), agrupado por miembro del equipo → proyecto → issue. Muestra en qué se va a enfocar cada persona y qué issues se planean, con un schema deliberadamente mínimo (nada de `agregado`/`desviaciones`/estado de cumplimiento — ninguno tiene sentido todavía, ver **Sprint Fin** abajo).

**Representación en el sistema**: tipo de documento con `id: "sprint-inicio"` registrado en `backend/src/documents/registry.ts`. Todo su código vive en `backend/src/documents/sprint-inicio/`: `config.ts` (schema `SprintInicioSchema`, prompt `SPRINT_INICIO_SYSTEM_PROMPT`, función `componerDatosInicio`), `sample-data.ts` y una única plantilla (`resumen-inicio`).

**Términos relacionados**: `plantilla`/`template`, `objetivo`, `equipo`, `riesgoTransversal`, **Sprint Fin**.

**Ejemplo concreto**: el sprint de ejemplo `backend/src/documents/sprint-inicio/sample-data.ts` (`sprintName: "1 JULIO-AGOSTO 2026"`) tiene 3 miembros, cada uno con un proyecto y varios issues en estado `"Todo"` — todavía no hay nada completado ni cancelado, es un plan.

**No confundir con**: **Sprint Fin** — mismo agrupamiento por miembro/proyecto/issue, pero es un `docType` distinto (`sprint-fin`, endpoints `/api/sprint-fin/*`) con su propio schema completo, usado al cerrar el sprint. Fueron un único tipo `sprint` hasta 2026-07-25 (ver `docs/adr/0008-particion-sprint-inicio-fin-y-reintento-de-extraccion.md`).

### Sprint Fin (`sprint-fin`)

**Definición de negocio**: el resumen de cierre de un sprint, agrupado por miembro del equipo → proyecto → issue. Muestra en qué se enfocó cada persona, qué issues cerró o dejó abiertos, cuáles estaban planeados desde el inicio y cuáles se agregaron sobre la marcha, y el estado general de cumplimiento del sprint.

**Representación en el sistema**: tipo de documento con `id: "sprint-fin"` registrado en `backend/src/documents/registry.ts`. Todo su código vive en `backend/src/documents/sprint-fin/`: `config.ts` (schema `SprintSchema`, prompt `SPRINT_SYSTEM_PROMPT`, función `componerDatosSprint`), `sample-data.ts` y 4 plantillas (ver **plantilla/template** más abajo).

**Términos relacionados**: `plantilla`/`template`, `agregado`, `estadoSprint`/`porcentajeCompletado`, `objetivo`, `equipo`, `riesgoTransversal`, `desviaciones`, **Sprint Inicio**.

**Ejemplo concreto**: el sprint de ejemplo `backend/src/documents/sprint-fin/sample-data.ts` (`sprintName: "1 JUNIO-JULIO 2026"`, del 22 al 29 de junio) tiene 3 miembros (Luis, Mauricio, Daniel), cada uno con uno o más proyectos y varios issues, y `estadoSprint: "CUMPLIDO"` con `porcentajeCompletado: 100`.

---

## Plantillas de render

### Plantilla / template

**Definición de negocio**: la forma visual en la que se presenta un mismo tipo de documento. Un tipo de documento (por ejemplo Sprint) puede tener más de una plantilla porque el mismo contenido extraído se necesita mostrar de formas distintas según el momento del proceso: una lista detallada de issues, o una vista resumida de tarjetas por persona.

**Representación en el sistema**: cada entrada del objeto `templates: Record<string, DocumentTemplate>` de un `DocumentConfig<T>` (`backend/src/documents/types.ts`). Cada `DocumentTemplate` define `path` (el archivo `.html` de Handlebars) y opcionalmente `pdf.width`/`pdf.height` (tamaño de página; el alto es solo una referencia de diseño — `generarPdf()` crece o achica la página según el alto real del contenido, ver `docs/adr/0007-altura-de-pdf-tambien-se-achica-no-solo-crece.md`). Se elige con el parámetro `plantilla` (query en `sample-preview`, body en `preview`/`pdf`); si no se manda o no existe, se usa `config.defaultTemplate`. Épica tiene 2 (`default` y `cierre`); Sprint Inicio (`backend/src/documents/sprint-inicio/config.ts`) tiene 1; Sprint Fin (`backend/src/documents/sprint-fin/config.ts`) tiene 4:

| `docType` | Clave | Archivo | Cuándo se usa | Tamaño de PDF (referencia) |
|---|---|---|---|---|
| `sprint-inicio` | `resumen-inicio` (única, default) | `template-resumen-inicio.html` | Tarjetas por miembro al arrancar el sprint — sin comparar planeados vs. agregados porque ese concepto no existe todavía. | 1240×1050px |
| `sprint-fin` | `detail` (default) | `template-detail.html` | Lista completa de issues por miembro y proyecto, con etiquetas de tipo/prioridad/estado/agregado por issue. | 900×1188px |
| `sprint-fin` | `resumen` | `template-resumen.html` | Tarjetas por miembro al cierre del sprint, con el donut de planeados vs. agregados. | 1240×1050px |
| `sprint-fin` | `resumen-v2` | `template-resumen-v2.html` | Versión simplificada de `resumen` para el cierre: header con solo 2 KPIs (issues planeados vs. agregados, % completado), sin horas por miembro ni `desviaciones`. En el box de riesgo, además del riesgo transversal previsto, muestra `riesgoTransversalResultado` si viene informado. | 1240×1050px |
| `sprint-fin` | `resumen-v3` | `template-resumen-v3.html` | Evolución de `resumen-v2`: semáforo único de salud del sprint, badge de utilización de capacidad por miembro, issues "vencidos" al cierre y tendencia/proyección contra sprints anteriores (lee `backend/data/sprint-historico.json`, ver `docs/planning/ANALISIS_INFORME_EJECUTIVO_SPRINT_RESUMEN_V2.md`). | 1240×1050px |

Épica, análogamente, tiene `default` (resumen de inicio) y `cierre` (mismos datos + cumplimiento por épica, sprints del ciclo, resultado del riesgo transversal — solo se completan si el documento fuente trae resultados reales, no un plan).

**Términos relacionados**: `epica`, **Sprint Inicio**, **Sprint Fin**, `componerDatos`.

**Ejemplo concreto**: en el frontend (`frontend/index.html`), el tab "Sprint Fin" muestra un selector "Plantilla" con las opciones `Detalle`, `Resumen fin`, `Resumen fin v2` y `Resumen fin v3`; elegir "Resumen fin v3" manda `body.plantilla = "resumen-v3"` a `POST /api/sprint-fin/pdf`. El tab "Sprint Inicio" no muestra selector (una sola plantilla). El tab "Épica" muestra `Inicio` y `Cierre`.

**No confundir con**: **tipo de documento** (`epica`/`sprint-inicio`/`sprint-fin`) — el tipo de documento define qué schema y qué prompt de IA se usan (es el mismo para todas sus plantillas); la plantilla solo define cómo se ve el resultado ya extraído.

---

## Transformación de datos antes de renderizar

### `componerDatos`

**Definición de negocio**: el paso de "maquillaje" de los datos antes de armar el documento final — toma el contenido ya extraído/editado (objetivo, issues, horas, etc.) y calcula todo lo que la plantilla necesita mostrar pero que no viene directo del contenido: colores por persona/épica, porcentajes, totales, y los gráficos tipo donut ya armados.

**Representación en el sistema**: la propiedad `componerDatos(datosExtraidos: T): any` de todo `DocumentConfig<T>` (`backend/src/documents/types.ts`). Cada tipo de documento define la suya: `componerDatosEpica` (`backend/src/documents/epica/config.ts`), `componerDatosInicio` (`backend/src/documents/sprint-inicio/config.ts`) y `componerDatosSprint` (`backend/src/documents/sprint-fin/config.ts`). Se ejecuta en las rutas `preview` y `pdf` (`backend/src/api/document.routes.ts`) sobre el JSON ya validado con Zod, justo antes de pasarlo a Handlebars.

**Términos relacionados**: `asignarPaleta`, `HORAS_FIJAS`, `plantilla`/`template`.

**Ejemplo concreto**: `componerDatosSprint` recibe el JSON validado de un sprint y, por cada miembro, calcula `planeados`/`agregados` (contando el campo `agregado` de sus issues), le asigna una paleta de color según su posición en el array (`asignarPaleta(indice)`), y arma el string CSS `planGradient` (un `conic-gradient(...)`) que la plantilla `resumen`/`resumen-v2` pone directo en un `style` sin calcular nada.

**No confundir con**: la extracción con IA (`extractor.service.ts`) — la IA solo estructura el contenido crudo del `.md` en un JSON que cumple el schema; `componerDatos` corre después, sobre datos que ya pasaron esa validación (vengan de la IA o editados a mano), y nunca inventa contenido, solo lo enriquece con presentación.

### `HORAS_FIJAS`

**Definición de negocio**: la distribución de horas del equipo en un mes típico (cuántas horas van a proyectos, reuniones, incidencias, etc.), usada como bloque fijo del documento de Épica porque esa distribución no se extrae del `.md` mensual — se edita a mano cuando cambia.

**Representación en el sistema**: constante `HORAS_FIJAS: DatosFijos` en `backend/src/constants.ts`, en base mensual (480 horas totales, 4 semanas). `componerDatosEpica` la agrega tal cual (`...HORAS_FIJAS`) a los datos de cada documento de Épica — nunca sale del JSON extraído.

**Términos relacionados**: `escalarHoras`, `objetivo` (en Sprint, el bloque de horas sí es parte del JSON editable, a diferencia de Épica).

**Ejemplo concreto**: al momento de escribir esta guía, `HORAS_FIJAS` tiene 3 segmentos visibles — "Proyectos (3 objetivos)" (79%, 377.7h), "Reuniones" (8%, 38.4h) e "Incidencias" (13%, 63.9h) — sumando 480h. Los segmentos "Personalizaciones" y "Team building" están comentados temporalmente en el código (sus horas se redistribuyeron proporcionalmente en Proyectos e Incidencias); para revertirlo hay que descomentarlos y devolver Proyectos/Incidencias a sus valores previos, según el comentario junto a la constante.

### `escalarHoras`

**Definición de negocio**: la operación de tomar la distribución de horas mensual del equipo y proyectarla a un período más corto (por ejemplo, una semana), manteniendo los mismos porcentajes por categoría pero recalculando el total y las horas de cada una.

**Representación en el sistema**: función `escalarHoras(horasFijas: DatosFijos, factor: number): DatosFijos` en `backend/src/constants.ts`. Actualmente **no la usa ningún documento**: Sprint dejó de necesitarla porque su bloque de horas (`horas.segmentos`) ya es parte del JSON editable por request, con valores que sugiere la IA. Queda disponible para un futuro tipo de documento que sí necesite derivar un bloque de horas fijo a otro período.

**Términos relacionados**: `HORAS_FIJAS`.

**Ejemplo concreto**: `escalarHoras(HORAS_FIJAS, 0.25)` proyectaría el bloque mensual (480h) a una semana (120h), manteniendo el mismo 79%/8%/13% en cada segmento.

### `asignarPaleta`

**Definición de negocio**: la regla de qué color e ícono le corresponde a cada épica, o a cada persona en un sprint, para que las tarjetas del PDF se distingan visualmente entre sí de forma consistente (siempre la primera épica/persona es azul, la segunda es teal, etc.).

**Representación en el sistema**: función `asignarPaleta(indice: number): Paleta` en `backend/src/constants.ts`, que cicla sobre el array `PALETAS` (5 combinaciones de `icono`/`colorAccent`/`colorBgIcon`/`colorBgBadge`/`colorBgResult`). Si hay más elementos que paletas, vuelve a empezar desde la primera. La usan tanto `componerDatosEpica` (una paleta por épica) como `componerDatosSprint` (una paleta por miembro).

**Términos relacionados**: `componerDatos`.

**Ejemplo concreto**: en el sprint de ejemplo, el primer miembro (Luis, índice 0) recibe la paleta azul (`colorAccent: "#2563eb"`) y el segundo (Mauricio, índice 1) recibe la paleta teal (`colorAccent: "#0d9488"`), sin que nadie las asigne a mano.

---

## Campos del dominio de Sprint (y su espejo en Épica)

### `agregado`

**Definición de negocio**: distingue, para cada issue de un sprint, si ese trabajo estaba planeado desde que arrancó el sprint o si se sumó después, sobre la marcha (por ejemplo, una incidencia que apareció en producción). Es la base para medir qué tan bien se planeó el sprint: muchos issues "agregados" sugieren que el alcance inicial no capturó bien el trabajo real.

**Exclusivo de `sprint-fin`** — no existe en `sprint-inicio`: al arrancar un sprint TODO es lo planeado, no hay todavía un "antes/después" de ningún corte.

**Representación en el sistema**: campo booleano `agregado` en cada issue de `SprintSchema` (`backend/src/documents/sprint-fin/config.ts`). En la plantilla `template-detail.html` se muestra como una etiqueta "Planeado" (`agregado: false`) o "Agregado" (`agregado: true`), con color/ícono definidos en `AGREGADO_TAG_CFG`. `componerDatosSprint` además lo usa para calcular, por miembro, `planeados`/`agregados` y sus gradientes (`planGradient`), y a nivel de todo el documento, dos KPIs de cumplimiento independientes (`planPorcentajeCompletado`/`agregadoPorcentajeCompletado`, usados en `template-resumen-v2.html`) contando cuántos issues de cada grupo (planeados vs. agregados) terminaron en estado `Done`.

**Estados posibles**: `true` (agregado durante el sprint) / `false` (planeado desde el inicio).

**Términos relacionados**: **Sprint Fin**, `estadoSprint`/`porcentajeCompletado`, `desviaciones`.

**Ejemplo concreto**: en `backend/src/documents/sprint-fin/sample-data.ts`, Luis tiene el issue "Base backend modular NestJS para Polaria web v2.0" con `agregado: true` (no estaba planeado, se sumó en la semana), mientras el resto de sus issues del sprint tienen `agregado: false` (estaban planeados desde el inicio).

**No confundir con**: el `status` del issue (`Todo`/`In Progress`/`In Review`/`Done`/`Cancelled`) — `status` indica en qué etapa está el trabajo; `agregado` indica si ese trabajo estaba en el plan original, son dos ejes independientes (un issue agregado puede estar `Done` o seguir `Todo`).

### `estadoSprint` / `porcentajeCompletado`

**Definición de negocio**: el veredicto de si el sprint, en su conjunto, cumplió lo que se propuso. `porcentajeCompletado` es la métrica (qué proporción de los issues del sprint quedaron terminados); `estadoSprint` es la etiqueta legible de esa métrica.

**Exclusivo de `sprint-fin`** — no existe en `sprint-inicio` (un sprint que todavía no arrancó no tiene nada que "completar").

**Representación en el sistema**: dos campos a nivel de documento en `SprintSchema` (`backend/src/documents/sprint-fin/config.ts`) — `porcentajeCompletado: z.number().min(0).max(100)` y `estadoSprint: z.enum(["CUMPLIDO", "NO CUMPLIDO"])`. El prompt de IA (`SPRINT_SYSTEM_PROMPT`) instruye calcular `porcentajeCompletado` como el % de issues con `status: "Done"` sobre el total, y `estadoSprint` como `CUMPLIDO` si ese porcentaje es 90 o más, `NO CUMPLIDO` si es menor — pero ambos quedan editables a mano en el JSON antes de generar el PDF. La misma regla de "90% o más" (función `resolverEstadoSprint`) se reutiliza en `componerDatosSprint` para calcular, de forma independiente, el estado de los dos KPIs de `template-resumen-v2.html` (uno para issues planeados, otro para agregados) — esos son campos calculados (`planEstadoSprint`, `agregadoEstadoSprint`), no el mismo campo que `estadoSprint` del documento.

**Estados posibles**: `CUMPLIDO` / `NO CUMPLIDO` (documento completo); los KPIs calculados de `resumen-v2` usan el mismo par de estados por separado para "planeados" y "agregados" (nada más — no muestra el KPI global). `resumen-v3` va más allá: agrega un tercer indicador `ÓPTIMO`/`ACEPTABLE`/`DESVIADO` (KPI "global", con bandas distintas: 95-105% óptimo, 85-95%/105-115% aceptable, el resto desviado) que mide sobre-cumplimiento o sub-cumplimiento de lo planeado, y unifica los 4 KPIs bajo ese mismo vocabulario de 3 estados.

**Términos relacionados**: `agregado`, `desviaciones`.

**Ejemplo concreto**: en `sample-data.ts`, el sprint tiene `porcentajeCompletado: 100` y `estadoSprint: "CUMPLIDO"` — el título de `template-resumen.html` para ese sprint muestra literalmente "CUMPLIDO - 100%" (interpolando `{{estadoSprint}} - {{porcentajeCompletado}}%`).

### `objetivo`

**Definición de negocio**: el resumen, en lenguaje simple, de en qué se enfocó una persona durante el sprint — qué hizo y por qué importa, sin necesidad de leer issue por issue.

**Representación en el sistema**: campo `objetivo` de cada miembro, presente tanto en `SprintInicioSchema` (`backend/src/documents/sprint-inicio/config.ts`, `z.string().min(450).max(520)`) como en `SprintSchema` de `sprint-fin` (`backend/src/documents/sprint-fin/config.ts`, `z.string().max(600)`, sin mínimo todavía). En ambos casos el prompt de IA pide un texto de **exactamente 480-500 caracteres** (contando espacios) — los límites del schema son un margen de seguridad, no el objetivo real de longitud; si el contenido disponible es más corto o más largo, la IA lo ajusta (ampliando con detalle real o resumiendo) para caer en ese rango. `sprint-inicio` sí rechaza (y reintenta, ver `extractor.service.ts`) un texto muy corto o muy largo; `sprint-fin` todavía no (ver Caso borde A de `docs/BUSINESS_FLOWS.md`).

**Términos relacionados**: **Sprint Inicio**, **Sprint Fin**, `equipo`.

**Ejemplo concreto**: en `sample-data.ts`, el `objetivo` de Daniel resume en un párrafo que "concentró su semana en preparar a Mateo Support para producción sobre Supabase", migrando la base de datos, construyendo la infraestructura de RAG y conectando el manual de usuario al flujo de consulta.

### `equipo`

**Definición de negocio**: una foto rápida de cómo trabajó el equipo en el período (épica del mes o sprint de la semana): quién participó, en qué ventana de tiempo, en qué entornos/canales, y con qué stack técnico.

**Representación en el sistema**: objeto con 4 campos de texto corto (`quien`, `cuando`, `donde`, `como`) presente en `EpicaSchema` (`backend/src/documents/epica/config.ts`, cada uno `max(150)`), en `SprintInicioSchema` (`backend/src/documents/sprint-inicio/config.ts`, rangos con margen de tolerancia — `quien` 30-110, `cuando` 10-70, `donde` 20-100, `como` 10-90) y en `SprintSchema` de `sprint-fin` (`backend/src/documents/sprint-fin/config.ts`, cada uno `max(150)`) — es el mismo bloque conceptual en los tres tipos de documento, con rangos algo distintos.

**Términos relacionados**: `objetivo`, `riesgoTransversal`.

**Ejemplo concreto**: en el sprint de ejemplo, `equipo.quien` es "Equipo enfocado (3 personas) - Dani, Mauro y Lucho, un proyecto cada uno" y `equipo.como` es "NestJS, Supabase, n8n, Next.js, Linear".

### `riesgoTransversal`

**Definición de negocio**: el riesgo principal que afecta a todo el período a la vez (no a una épica o proyecto puntual), junto con cómo se está mitigando. En Épica es un riesgo abierto, inferido del conjunto de épicas. En Sprint está acotado a un único tema fijo: que aparezcan incidencias no planeadas que consuman las horas reservadas para el segmento "Incidencias" del bloque `horas`, restando tiempo a lo planeado en Proyectos.

**Representación en el sistema**: objeto `{ texto, mitigacion }` presente en `EpicaSchema`, en `SprintInicioSchema` (`texto` 150-250, `mitigacion` 70-160 — margen de tolerancia sobre el rango 180-230/100-140 que pide el prompt) y en `SprintSchema` de `sprint-fin` (`texto` máx. 320, `mitigacion` máx. 200, sin mínimo — mismo prompt apunta a 180-230/100-140). En `sprint-fin`, `template-detail.html` no lo usa; sí aparece en `resumen`/`resumen-v2`/`resumen-v3`. En `sprint-inicio` aparece en su única plantilla, `resumen-inicio`.

**Términos relacionados**: `equipo`, `desviaciones`, `riesgoTransversalResultado`.

**Ejemplo concreto**: en el sprint de ejemplo de `sprint-fin` (un cierre, `tiempoVerbal: "Pasado"`), `riesgoTransversal.texto` señala que "el riesgo de este sprint era que aparecieran incidencias no planeadas que consumieran las horas reservadas para eso, dejando menos tiempo del previsto para avanzar en los proyectos de cada persona", con mitigación "ese tiempo para incidencias ya estaba reservado de antemano como colchón, justo para poder absorber ese riesgo sin afectar lo planeado en Proyectos" — en `sprint-inicio` (siempre futuro, sin campo `tiempoVerbal`) el mismo campo se redacta en presente/subjuntivo ("el riesgo es que aparezcan...").

**No confundir con**: `riesgoTransversalResultado` — `riesgoTransversal` habla de un riesgo **a futuro** (algo que todavía puede pasar, se muestra en `sprint-inicio`); `riesgoTransversalResultado` habla **en pasado**, de si ese riesgo se materializó o no una vez que el sprint/período ya cerró.

### `riesgoTransversalResultado`

**Definición de negocio**: al cierre de un sprint o período de épicas, si el riesgo transversal previsto al inicio se materializó o no, y qué pasó en la práctica. En Sprint, concretamente: si entraron incidencias que consumieron el colchón de horas reservado (y si eso afectó o no el cierre planeado), o si no entraron y el sprint pudo avanzar según lo planeado o incluso sumar issues agregados porque hubo margen de sobra.

**Exclusivo de `epica` y `sprint-fin`** — no existe en `sprint-inicio` (un sprint que no cerró no tiene resultado de riesgo que reportar).

**Representación en el sistema**: campo opcional `riesgoTransversalResultado: z.string()` a nivel de documento, presente en `EpicaSchema` (máx. 260 caracteres) y en `SprintSchema` de `sprint-fin` (máx. 260 caracteres). Solo se completa cuando el documento fuente describe resultados reales (no un plan) — igual criterio que `cumplimiento` (Épica) y `desviaciones` (Sprint). En Épica lo muestra `template-cierre.html`; en `sprint-fin`, `template-resumen-v2.html` (bajo el texto de `riesgoTransversal`, con un divisor y label "RESULTADO"). El contenido difiere entre los dos: en Épica es puramente cualitativo, sin cifras (mismo criterio que `cumplimiento`, que tampoco calcula un % — ver `EPICA_SYSTEM_PROMPT`); en `sprint-fin`, `SPRINT_SYSTEM_PROMPT` exige cifras concretas basadas en los issues reales del documento (cuántos planeados se completaron sobre el total, cuántos agregados entraron y cuántos de esos se completaron) en vez de una descripción vaga tipo "hubo margen".

**Términos relacionados**: `riesgoTransversal`, `desviaciones`.

**Ejemplo concreto**: en el sprint de ejemplo, `riesgoTransversalResultado` dice "no entraron incidencias que consumieran el colchón reservado. El equipo completó 16 de los 17 issues planeados y, gracias al avance más rápido de lo esperado, sumó 4 issues agregados, de los cuales completó 3" — las cifras (16/17, 4, 3) coinciden con los KPIs de header `planPorcentajeCompletado` (94%) y `agregadoPorcentajeCompletado` (75%) del mismo documento.

**No confundir con**: `desviaciones` — `riesgoTransversalResultado` es un único resultado a nivel de documento sobre el riesgo de horas/incidencias; `desviaciones` es, por cada miembro, la desviación de alcance de sus propios issues (planeados vs. completados).

### `desviaciones`

**Definición de negocio**: la explicación honesta, al cierre de un sprint, de si se cumplió lo planeado o no y por qué — cuánto del alcance original quedó sin cerrar, y por qué se agregó trabajo que no estaba previsto. No mide si el equipo trabajó lo suficiente, mide qué tan bien se ajustó lo hecho a lo planeado.

**Exclusivo de `sprint-fin`** — no existe en Épica ni en `sprint-inicio` (un sprint que no cerró no tiene desviación que reportar).

**Representación en el sistema**: objeto `{ logrado, motivo }`, exclusivo de `SprintSchema` (`backend/src/documents/sprint-fin/config.ts`): `logrado` (180-230 caracteres) responde directamente "¿se logró lo planificado?"; `motivo` (100-140 caracteres) explica por qué se agregaron issues no planeados o por qué quedaron issues planeados sin completar. El schema lo extrae siempre por miembro, pero solo `template-resumen-v3.html` lo renderiza hoy (`resumen-v2` muestra en su lugar el resultado del riesgo transversal a nivel de documento, no por miembro — ver `riesgoTransversalResultado`).

**Términos relacionados**: `riesgoTransversal`, `riesgoTransversalResultado`, `agregado`, `estadoSprint`/`porcentajeCompletado`.

**Ejemplo concreto**: en el sprint de ejemplo, `desviaciones.logrado` dice que "el plan inicial se cumplió parcialmente: algunos issues planeados quedaron abiertos por mayor complejidad de la esperada, mientras el equipo sumó trabajo no previsto que surgió durante la semana", y `desviaciones.motivo` explica que "los issues agregados respondieron a incidencias y pedidos que aparecieron en curso; los planeados sin cerrar pasan al siguiente sprint".

**No confundir con**: `riesgoTransversal` (ver más arriba).
