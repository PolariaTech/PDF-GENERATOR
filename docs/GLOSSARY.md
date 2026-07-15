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

### Sprint (`sprint`)

**Definición de negocio**: el resumen de un sprint (ciclo corto de trabajo, típicamente semanal) agrupado por miembro del equipo → proyecto → issue. Muestra en qué se enfocó cada persona, qué issues cerró o dejó abiertos, cuáles estaban planeados desde el inicio y cuáles se agregaron sobre la marcha, y el estado general de cumplimiento del sprint.

**Representación en el sistema**: tipo de documento con `id: "sprint"` registrado en `backend/src/documents/registry.ts`. Todo su código vive en `backend/src/documents/sprint/`: `config.ts` (schema `SprintSchema`, prompt `SPRINT_SYSTEM_PROMPT`, función `componerDatosSprint`), `sample-data.ts` y 4 plantillas (ver **plantilla/template** más abajo).

**Términos relacionados**: `plantilla`/`template`, `agregado`, `estadoSprint`/`porcentajeCompletado`, `objetivo`, `equipo`, `riesgoTransversal`, `desviaciones`.

**Ejemplo concreto**: el sprint de ejemplo `backend/src/documents/sprint/sample-data.ts` (`sprintName: "1 JUNIO-JULIO 2026"`, del 22 al 29 de junio) tiene 3 miembros (Luis, Mauricio, Daniel), cada uno con uno o más proyectos y varios issues, y `estadoSprint: "CUMPLIDO"` con `porcentajeCompletado: 100`.

---

## Plantillas de render

### Plantilla / template

**Definición de negocio**: la forma visual en la que se presenta un mismo tipo de documento. Un tipo de documento (por ejemplo Sprint) puede tener más de una plantilla porque el mismo contenido extraído se necesita mostrar de formas distintas según el momento del proceso: una lista detallada de issues, o una vista resumida de tarjetas por persona.

**Representación en el sistema**: cada entrada del objeto `templates: Record<string, DocumentTemplate>` de un `DocumentConfig<T>` (`backend/src/documents/types.ts`). Cada `DocumentTemplate` define `path` (el archivo `.html` de Handlebars) y opcionalmente `pdf.width`/`pdf.height` (tamaño de página; el alto es solo una referencia de diseño — `generarPdf()` crece o achica la página según el alto real del contenido, ver `docs/adr/0007-altura-de-pdf-tambien-se-achica-no-solo-crece.md`). Se elige con el parámetro `plantilla` (query en `sample-preview`, body en `preview`/`pdf`); si no se manda o no existe, se usa `config.defaultTemplate`. Épica tiene una sola plantilla (`default`); Sprint (`backend/src/documents/sprint/config.ts`) tiene 4:

| Clave | Archivo | Cuándo se usa | Tamaño de PDF (referencia) |
|---|---|---|---|
| `detail` (default de Sprint) | `template-detail.html` | Lista completa de issues por miembro y proyecto, con etiquetas de tipo/prioridad/estado/agregado por issue. | 900×1188px |
| `resumen-inicio` | `template-resumen-inicio.html` | Tarjetas por miembro al arrancar el sprint — sin comparar planeados vs. agregados porque el sprint todavía no cerró. | 1240×1050px |
| `resumen` | `template-resumen.html` | Igual que `resumen-inicio`, pero al cierre del sprint, con el donut de planeados vs. agregados. | 1240×1050px |
| `resumen-v2` | `template-resumen-v2.html` | Resumen de cierre con dos KPIs de cumplimiento separados (issues planeados vs. agregados) más un KPI global de planeación, en vez del riesgo transversal muestra `desviaciones`. | 1240×1050px |

**Términos relacionados**: `epica`, `sprint`, `componerDatos`.

**Ejemplo concreto**: en el frontend (`frontend/index.html`), el tab "Sprint" muestra un selector "Plantilla" con las opciones `Detalle`, `Resumen inicio`, `Resumen fin` y `Resumen fin v2`; elegir "Resumen fin v2" manda `body.plantilla = "resumen-v2"` a `POST /api/sprint/pdf`.

**No confundir con**: **tipo de documento** (`epica`/`sprint`) — el tipo de documento define qué schema y qué prompt de IA se usan (es el mismo para todas sus plantillas); la plantilla solo define cómo se ve el resultado ya extraído.

---

## Transformación de datos antes de renderizar

### `componerDatos`

**Definición de negocio**: el paso de "maquillaje" de los datos antes de armar el documento final — toma el contenido ya extraído/editado (objetivo, issues, horas, etc.) y calcula todo lo que la plantilla necesita mostrar pero que no viene directo del contenido: colores por persona/épica, porcentajes, totales, y los gráficos tipo donut ya armados.

**Representación en el sistema**: la propiedad `componerDatos(datosExtraidos: T): any` de todo `DocumentConfig<T>` (`backend/src/documents/types.ts`). Cada tipo de documento define la suya: `componerDatosEpica` (`backend/src/documents/epica/config.ts`) y `componerDatosSprint` (`backend/src/documents/sprint/config.ts`). Se ejecuta en las rutas `preview` y `pdf` (`backend/src/api/document.routes.ts`) sobre el JSON ya validado con Zod, justo antes de pasarlo a Handlebars.

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

**Representación en el sistema**: campo booleano `agregado` en cada issue de `SprintSchema` (`backend/src/documents/sprint/config.ts`). En la plantilla `template-detail.html` se muestra como una etiqueta "Planeado" (`agregado: false`) o "Agregado" (`agregado: true`), con color/ícono definidos en `AGREGADO_TAG_CFG`. `componerDatosSprint` además lo usa para calcular, por miembro, `planeados`/`agregados` y sus gradientes (`planGradient`), y a nivel de todo el documento, dos KPIs de cumplimiento independientes (`planPorcentajeCompletado`/`agregadoPorcentajeCompletado`, usados en `template-resumen-v2.html`) contando cuántos issues de cada grupo (planeados vs. agregados) terminaron en estado `Done`.

**Estados posibles**: `true` (agregado durante el sprint) / `false` (planeado desde el inicio).

**Términos relacionados**: `sprint`, `estadoSprint`/`porcentajeCompletado`, `desviaciones`.

**Ejemplo concreto**: en `backend/src/documents/sprint/sample-data.ts`, Luis tiene el issue "Base backend modular NestJS para Polaria web v2.0" con `agregado: true` (no estaba planeado, se sumó en la semana), mientras el resto de sus issues del sprint tienen `agregado: false` (estaban planeados desde el inicio).

**No confundir con**: el `status` del issue (`Todo`/`In Progress`/`In Review`/`Done`/`Cancelled`) — `status` indica en qué etapa está el trabajo; `agregado` indica si ese trabajo estaba en el plan original, son dos ejes independientes (un issue agregado puede estar `Done` o seguir `Todo`).

### `estadoSprint` / `porcentajeCompletado`

**Definición de negocio**: el veredicto de si el sprint, en su conjunto, cumplió lo que se propuso. `porcentajeCompletado` es la métrica (qué proporción de los issues del sprint quedaron terminados); `estadoSprint` es la etiqueta legible de esa métrica.

**Representación en el sistema**: dos campos a nivel de documento en `SprintSchema` — `porcentajeCompletado: z.number().min(0).max(100)` y `estadoSprint: z.enum(["CUMPLIDO", "NO CUMPLIDO"])`. El prompt de IA (`SPRINT_SYSTEM_PROMPT`) instruye calcular `porcentajeCompletado` como el % de issues con `status: "Done"` sobre el total, y `estadoSprint` como `CUMPLIDO` si ese porcentaje es 90 o más, `NO CUMPLIDO` si es menor — pero ambos quedan editables a mano en el JSON antes de generar el PDF. La misma regla de "90% o más" (función `resolverEstadoSprint`) se reutiliza en `componerDatosSprint` para calcular, de forma independiente, el estado de los dos KPIs de `template-resumen-v2.html` (uno para issues planeados, otro para agregados) — esos son campos calculados (`planEstadoSprint`, `agregadoEstadoSprint`), no el mismo campo que `estadoSprint` del documento.

**Estados posibles**: `CUMPLIDO` / `NO CUMPLIDO` (documento completo); los KPIs calculados de `resumen-v2` usan el mismo par de estados por separado para "planeados" y "agregados", más un tercer indicador `ÓPTIMO`/`ACEPTABLE`/`DESVIADO` (KPI "global", con bandas distintas: 95-105% óptimo, 85-95%/105-115% aceptable, el resto desviado) que mide sobre-cumplimiento o sub-cumplimiento de lo planeado.

**Términos relacionados**: `agregado`, `desviaciones`.

**Ejemplo concreto**: en `sample-data.ts`, el sprint tiene `porcentajeCompletado: 100` y `estadoSprint: "CUMPLIDO"` — el título de `template-resumen.html` para ese sprint muestra literalmente "CUMPLIDO - 100%" (interpolando `{{estadoSprint}} - {{porcentajeCompletado}}%`).

### `objetivo`

**Definición de negocio**: el resumen, en lenguaje simple, de en qué se enfocó una persona durante el sprint — qué hizo y por qué importa, sin necesidad de leer issue por issue.

**Representación en el sistema**: campo `objetivo` de cada miembro en `SprintSchema` (`z.string().max(600)`). El prompt de IA pide un texto de **exactamente 480-500 caracteres** (contando espacios) — el límite de 600 del schema es un margen de seguridad, no el objetivo real de longitud; si el contenido disponible es más corto o más largo, la IA lo ajusta (ampliando con detalle real o resumiendo) para caer en ese rango.

**Términos relacionados**: `sprint`, `equipo`.

**Ejemplo concreto**: en `sample-data.ts`, el `objetivo` de Daniel resume en un párrafo que "concentró su semana en preparar a Mateo Support para producción sobre Supabase", migrando la base de datos, construyendo la infraestructura de RAG y conectando el manual de usuario al flujo de consulta.

### `equipo`

**Definición de negocio**: una foto rápida de cómo trabajó el equipo en el período (épica del mes o sprint de la semana): quién participó, en qué ventana de tiempo, en qué entornos/canales, y con qué stack técnico.

**Representación en el sistema**: objeto con 4 campos de texto corto (`quien`, `cuando`, `donde`, `como`, cada uno `max(150)` caracteres) presente **tanto en `EpicaSchema` como en `SprintSchema`** (`backend/src/documents/epica/config.ts` y `backend/src/documents/sprint/config.ts`) — es el mismo bloque conceptual en los dos tipos de documento.

**Términos relacionados**: `objetivo`, `riesgoTransversal`.

**Ejemplo concreto**: en el sprint de ejemplo, `equipo.quien` es "Equipo enfocado (3 personas) - Dani, Mauro y Lucho, un proyecto cada uno" y `equipo.como` es "NestJS, Supabase, n8n, Next.js, Linear".

### `riesgoTransversal`

**Definición de negocio**: el riesgo principal que afecta a todo el período a la vez (no a una épica o proyecto puntual), junto con cómo se está mitigando. Por ejemplo, correr una migración de datos en paralelo con desarrollo nuevo sin ambiente de pruebas dedicado.

**Representación en el sistema**: objeto `{ texto, mitigacion }` presente en `EpicaSchema` y en `SprintSchema` (`texto` 180-230 caracteres, `mitigacion` 100-140 caracteres, según el prompt de IA). En Sprint, `template-detail.html` no lo usa; en las plantillas de resumen (`resumen`, `resumen-inicio`) sí aparece, pero en `template-resumen-v2.html` **se reemplaza por `desviaciones`**.

**Términos relacionados**: `equipo`, `desviaciones`.

**Ejemplo concreto**: en el sprint de ejemplo, `riesgoTransversal.texto` señala que "la migración de datos y los nuevos módulos web corren en paralelo sin ambiente de pruebas dedicado", con mitigación "validar cada entrega con datos reales antes de cerrarla y monitorear de cerca los primeros días".

**No confundir con**: `desviaciones` — `riesgoTransversal` habla de un riesgo **a futuro** (algo que todavía puede salir mal); `desviaciones` habla **en pasado**, de qué tan bien se cumplió lo planeado una vez que el sprint ya cerró.

### `desviaciones`

**Definición de negocio**: la explicación honesta, al cierre de un sprint, de si se cumplió lo planeado o no y por qué — cuánto del alcance original quedó sin cerrar, y por qué se agregó trabajo que no estaba previsto. No mide si el equipo trabajó lo suficiente, mide qué tan bien se ajustó lo hecho a lo planeado.

**Representación en el sistema**: objeto `{ logrado, motivo }`, exclusivo de `SprintSchema` (no existe en Épica): `logrado` (180-230 caracteres) responde directamente "¿se logró lo planificado?"; `motivo` (100-140 caracteres) explica por qué se agregaron issues no planeados o por qué quedaron issues planeados sin completar. Reemplaza a `riesgoTransversal` específicamente en `template-resumen-v2.html`, porque en un sprint ya cerrado el riesgo a futuro no aplica — lo relevante es explicar la desviación de alcance ya ocurrida.

**Términos relacionados**: `riesgoTransversal`, `agregado`, `estadoSprint`/`porcentajeCompletado`.

**Ejemplo concreto**: en el sprint de ejemplo, `desviaciones.logrado` dice que "el plan inicial se cumplió parcialmente: algunos issues planeados quedaron abiertos por mayor complejidad de la esperada, mientras el equipo sumó trabajo no previsto que surgió durante la semana", y `desviaciones.motivo` explica que "los issues agregados respondieron a incidencias y pedidos que aparecieron en curso; los planeados sin cerrar pasan al siguiente sprint".

**No confundir con**: `riesgoTransversal` (ver más arriba).
