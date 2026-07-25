# ADR-0008: Partir el document type `sprint` en `sprint-inicio`/`sprint-fin`, y reintento de extracción centralizado en el backend

## Fecha
2026-07-25

## Estado
Aceptado. No reemplaza ningún ADR anterior; extiende el patrón "document type" descrito en ADR-0001.

## Contexto

Hasta esta fecha, `sprint` era un único `docType` con un `SprintSchema` compartido por 5 plantillas: `detail`, `resumen-inicio` (arranque del sprint) y `resumen`/`resumen-v2`/`resumen-v3` (cierre). Ese schema único obligaba a que **todos** los campos existieran para **cualquier** plantilla, aunque varios de ellos no tuvieran sentido en el arranque: `agregado` por issue (no hay "antes/después" de un corte todavía), `desviaciones` por miembro (compara planeado vs. logrado, no existe nada logrado al inicio), `riesgoTransversalResultado`, `estadoSprint`/`porcentajeCompletado` (nada se ha completado todavía).

Esto se hizo evidente al auditar (agente Automation Governance Architect) qué nodos del workflow de n8n `Sprint - Generar Resumen PDF` eran realmente necesarios para generar solo `resumen-inicio`: 42 de 63 nodos resultaron "necesarios" únicamente porque el schema compartido exigía esos campos para *cualquier* plantilla, no porque `resumen-inicio` los usara. El propio schema, no el workflow, era la causa de que el arranque cargara con conceptos de cierre.

Por separado, `docs/BUSINESS_FLOWS.md` (Flujo 4, Caso borde A) documentaba desde antes un problema sin resolver: `SPRINT_SYSTEM_PROMPT` le pide a la IA rangos de caracteres *exactos* (ej. `objetivo` 480-500), pero `SprintSchema` (Zod) solo definía `.max()`, nunca `.min()` — un texto de 10 caracteres pasaba la validación sin error, produciendo tarjetas visualmente desbalanceadas sin ningún aviso. Endurecer eso a un `.min()` real requería primero resolver un riesgo operativo: los LLM no cuentan caracteres con precisión, así que un `.min()` sin ningún mecanismo de corrección convertiría "casi-buenos" outputs en fallos duros de `/extraer` (`500 INTERNAL_ERROR`), sin la red de seguridad que existía en el diseño original de n8n (reintento único, eliminado deliberadamente tras el pilot — ver ADR-0006) y que nunca se recuperó.

## Opciones consideradas

### Partición del document type

1. **Mantener `sprint` como un único `docType`, con el schema completo para todas las plantillas** (estado antes de este ADR).
   - Pros: un solo schema, un solo prompt, menos superficie de mantenimiento.
   - Contras: el arranque del sprint carga con campos que no aplican; cualquier endurecimiento de rangos (`.min()`) afecta por igual a datos de planning y de cierre, que en la práctica vienen de documentos y necesidades distintas.
2. **Partir en dos `docType`, `sprint-inicio` y `sprint-fin`, cada uno con su propio schema Zod y su propio prompt** (esta decisión).
   - Pros: `sprint-inicio` queda con el schema mínimo real que su única plantilla necesita — más simple para la IA (menos que redactar/estructurar), más fácil de endurecer con rangos estrictos sin arrastrar campos de cierre. Sigue el mismo patrón "document type" que ya usa el proyecto (ADR-0001), sin inventar un mecanismo nuevo.
   - Contras: rompe el contrato de API existente (`/api/sprint/*` deja de existir) — requiere migrar todos los consumidores (2 workflows de n8n, el frontend) a la vez. Dos schemas que mantener en sincronía donde antes había uno (ej. `equipo`/`riesgoTransversal` están duplicados conceptualmente entre ambos).
3. **Mantener un único `docType` `sprint`, pero con un schema Zod condicional según la plantilla** (ej. `z.discriminatedUnion` sobre `plantilla`).
   - Descartada: el patrón `DocumentConfig<T>` (`backend/src/documents/types.ts`) asume un schema fijo por `docType`, no una unión condicional por plantilla — hubiera requerido cambiar la abstracción genérica que usan `epica` y `sprint` por igual, un cambio de arquitectura mucho más invasivo que agregar un `docType` nuevo.

### Reintento de extracción

1. **No agregar ningún reintento; dejar la falla dura (`500`) como está** (consistente con ADR-0006, que eliminó el reintento original deliberadamente).
   - Pros: cero código nuevo, cero riesgo de loop.
   - Contras: endurecer los rangos de `sprint-inicio` sin reintento haría que cualquier imprecisión de conteo de caracteres del LLM (esperable, no es un bug) tirara `/extraer` con una probabilidad no despreciable — inaceptable para un endpoint que llaman 2 workflows de n8n en producción.
2. **Reintroducir el reintento dentro de cada workflow de n8n**, como existía originalmente (ADR-0006, "Aplicar Datos Deterministicos y Validar Rangos").
   - Descartada: duplicaría la misma lógica en los 4 workflows de n8n (o al menos en los 2 de sprint), y dejaría sin protección al flujo manual del frontend, que nunca pasa por n8n.
3. **Reintento centralizado en `extractor.service.ts` (backend), genérico por `docType`** (esta decisión).
   - Pros: un solo punto de mantenimiento; protege a los 4 workflows de n8n y al flujo manual a la vez; usa `config.schema.safeParse()` explícito en vez de confiar en que la Structured Output API de OpenAI haga cumplir `minLength`/`maxLength` durante la generación (soporte no documentado como contrato estable).
   - Contras: cada reintento duplica tokens/latencia de esa llamada — mitigado con un tope duro (`MAX_REINTENTOS_EXTRACCION = 3`, nunca reintentos infinitos) y sumando el costo real en `uso.costoEstimadoUsd` en vez de ocultarlo.

## Decisión

Ambas partes, opción 2 (partición) + opción 3 (reintento):

- **Partición**: `backend/src/documents/sprint/` se renombró a `backend/src/documents/sprint-fin/` (mismo `SprintSchema`, mismo `SPRINT_SYSTEM_PROMPT`, sin la plantilla `resumen-inicio`). Se creó `backend/src/documents/sprint-inicio/` nuevo, con `SprintInicioSchema` (subconjunto real de `SprintSchema`: sin `agregado`, `desviaciones`, `riesgoTransversalResultado`, `estadoSprint`, `porcentajeCompletado`, `horasPlaneadas`, horas por miembro, `type`/`priority` por issue) y `SPRINT_INICIO_SYSTEM_PROMPT` propio (siempre redacta en futuro, sin campo `tiempoVerbal`). `registry.ts` registra ambos; `server.ts` y `frontend/index.html` (2 tabs en vez de 1) se actualizaron acorde. Los 2 workflows de n8n de sprint se migraron a `/api/sprint-inicio/*` y `/api/sprint-fin/*` respectivamente.
- **Reintento**: `extractor.service.ts` ahora corre `config.schema.safeParse(parsed)` explícitamente tras cada llamada a OpenAI; si falla, reintenta hasta `MAX_REINTENTOS_EXTRACCION = 3` veces (4 intentos en total), reenviando el markdown original con el motivo exacto del fallo (`campo: mensaje`, de `ZodError.issues`) anexado como nota de sistema. El `uso` (tokens/costo) reportado suma todos los intentos.
- **Rangos endurecidos, solo en `sprint-inicio` por ahora**: `objetivo`/`equipo.*`/`riesgoTransversal.*` con `.min()` + `.max()` con margen de tolerancia (-30/+20 sobre el rango exacto que pide el prompt — ej. `objetivo` 450-520 en vez de 480-500 justo), `initials` con regex de 2 letras mayúsculas, `sprintName` con regex de año de 4 dígitos. `epica` y `sprint-fin` **no** se tocaron (siguen solo con `.max()`, ver Caso borde A de `docs/BUSINESS_FLOWS.md`) — quedan como candidatos a la misma auditoría más adelante, y ya heredan el mecanismo de reintento gratis cuando se les aplique.

## Consecuencias positivas

- `sprint-inicio` queda con un schema y un prompt genuinamente más simples — menos campos que la IA tiene que estructurar, menos superficie de error.
- El reintento por validación de schema es reutilizable por cualquier `docType` futuro sin código adicional, y ya protege a `epica`/`sprint-fin` aunque hoy casi nunca lo disparen (sus rangos son solo `.max()`, generosos).
- Verificado con extracciones reales contra `/api/sprint-inicio/extraer`: el margen de tolerancia importaba en la práctica, no solo en teoría — `equipo.quien` salió con 54 caracteres (bajo el rango exacto de 60-90 del prompt) y `riesgoTransversal.mitigacion` cayó justo en 160 (el prompt pide 100-140); un schema exacto-al-prompt hubiera fallado ambas veces.
- La auditoría de nodos de n8n para `sprint-inicio` (49 de 63 nodos, 22% eliminado) se hizo posible/más precisa gracias a tener un schema real más chico contra el cual verificar qué es necesario — no hubiera sido tan clara con el schema compartido viejo.

## Consecuencias negativas

- Rompe el contrato de API existente: `/api/sprint/*` ya no existe. Cualquier consumidor externo no migrado (no hay ninguno conocido más allá de los 2 workflows de n8n y el frontend, ya migrados) recibiría `404 NOT_FOUND` en vez de `200`.
- Dos schemas Zod que mantener en sincronía conceptual donde antes había uno — `equipo`/`riesgoTransversal` viven duplicados (con rangos ligeramente distintos) en `SprintInicioSchema` y `SprintSchema`. Un cambio de negocio a ese bloque conceptual (ej. agregar un campo nuevo a `equipo`) ahora requiere tocar dos archivos, no uno.
- `epica` y `sprint-fin` quedan con el mismo problema documentado en Caso borde A de `docs/BUSINESS_FLOWS.md` sin resolver — la inconsistencia entre "un `docType` tiene rangos estrictos, los otros dos no" es una deuda explícita, no accidental, pero deuda al fin.
- Cada reintento de extracción duplica tokens/costo de esa llamada — aceptado porque el tope de 3 reintentos acota el peor caso, y el costo real (bajo, `gpt-4o-mini`) se refleja en `uso.costoEstimadoUsd` en vez de ocultarse.

## Notas de seguimiento

- Aplicar el mismo endurecimiento de rangos (`.min()` con margen de tolerancia) a `epica` y `sprint-fin` cuando se audite cada uno — el reintento de `extractor.service.ts` ya los cubre sin trabajo adicional.
- Evaluar si el mecanismo de reintento necesita un límite de costo/tiempo agregado (ej. abortar si el costo acumulado supera un umbral) si en la práctica se observa que dispara seguido — hoy el tope de 3 reintentos es la única salvaguarda.
- Decidir si `equipo`/`riesgoTransversal`, duplicados entre `sprint-inicio` y `sprint-fin`, ameritan factorizarse en un helper compartido (ej. un builder de schema Zod parametrizado por rango) si un tercer `docType` llegara a necesitar el mismo bloque conceptual con rangos propios.
