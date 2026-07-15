# ADR-0007: El alto del PDF se mide con `document.body.scrollHeight` y se usa tal cual (crece o se achica), en vez de `document.documentElement.scrollHeight` con un piso mínimo

## Fecha
2026-07-15

## Estado
Aceptado. Reemplaza el mecanismo de medición descrito en [ADR-0004](0004-alto-de-pdf-auto-ajustable.md) (la decisión de auto-ajustar el alto según el contenido real sigue vigente; lo que cambia es cómo se mide y si existe un piso mínimo).

## Contexto

Tras ADR-0004, `generarPdf()` medía `document.documentElement.scrollHeight` (el `<html>`) y usaba `Math.max(contentHeight, viewportHeight)` como alto final — nunca por debajo del `pdf.height` configurado en la plantilla.

Se reportó que la plantilla `resumen-inicio` de `sprint` salía siempre con espacio en blanco de más al final del PDF, a diferencia de `detail`/`resumen`. La investigación (comparando manualmente el alto real del contenido contra el PDF generado, con Playwright fuera del server) encontró que el problema no era específico de esa plantilla: **`document.documentElement.scrollHeight` nunca puede reportar un valor menor al alto del viewport**, por comportamiento estándar del navegador (el `<html>` se estira para llenar al menos el viewport inicial, sin importar cuánto contenido real tenga el `<body>`). Esto hacía que el `Math.max(...)` de ADR-0004 fuera redundante en la práctica para el caso de achicar: la medición ya venía "pisada" al viewport por el propio navegador antes de que el código aplicara su propio mínimo.

`resumen-inicio` lo sufría más que `resumen`/`detail` porque su contenido típico (tarjetas de miembro con objetivo + donut de estado, sin lista de issues item por item) suele ocupar bastante menos que el alto de diseño de 1050px, mientras que `resumen` y sobre todo `detail` (que sí itemiza cada issue) suelen acercarse o superar ese alto con datos reales — el "sobrante" era menos visible ahí, pero el mecanismo de medición tenía el mismo problema de fondo en los tres casos.

## Opciones consideradas

1. **Mantener `document.documentElement.scrollHeight` + `Math.max(contentHeight, viewportHeight)`** (ADR-0004, estado antes de este ADR).
   - Pros: nunca genera una página más baja que el alto de diseño pensado para la plantilla, incluso si algo en la medición fallara.
   - Contras: el "nunca se achica" no era en realidad una decisión de producto cumplida — era un efecto secundario del bug de medición (el `<html>` ya venía pisado al viewport). Documentos con poco contenido real (`resumen-inicio` típico) quedaban con espacio en blanco de más, sin forma de evitarlo.

2. **Medir `document.body.scrollHeight` y usarlo tal cual, sin `Math.max` contra el viewport** (esta decisión).
   - Pros: `document.body.scrollHeight` sí refleja el alto real del contenido en ambos sentidos (crece si el contenido no entra, se achica si sobra espacio) — verificado con PDFs reales generados en un backend de prueba: `resumen-inicio` con datos de ejemplo pasó de 1050px fijos a ~880px (el alto real de ese contenido), y siguió creciendo correctamente a >1250px con datos que fuerzan overflow (6 miembros, texto largo). Aplica igual a los cuatro tipos de plantilla de `sprint` y a `epica`, sin casos especiales por tipo de documento.
   - Contras: el `pdf.height` configurado en cada plantilla deja de ser un piso mínimo garantizado — pasa a ser solo una referencia de diseño sin efecto real en el alto final. Si algún día se quisiera un mínimo real (por ejemplo, por consistencia visual de marca en documentos muy cortos), habría que reintroducirlo explícitamente como un `Math.max` deliberado, no como efecto secundario de la medición.

3. **Medir un contenedor interno específico de cada plantilla** (ej. un `.page`/`.container` con `id` fijo), en vez de `document.body`.
   - Descartada por invasiva: requeriría que las cuatro plantillas de `sprint` y la de `epica` mantengan un mismo selector/estructura para que `pdf.generator.ts` (compartido entre todos los `docType`) sepa qué medir, acoplando el generador genérico a detalles de layout de cada plantilla HTML. `document.body.scrollHeight` ya resuelve el problema sin ese acoplamiento.

## Decisión

Opción 2. En `generarPdf()` (`backend/src/core/generators/pdf.generator.ts`):
```ts
const contentHeight = await page.evaluate(() => document.body.scrollHeight);
const finalHeight = contentHeight;
```
Reemplaza a `document.documentElement.scrollHeight` + `Math.max(contentHeight, viewportHeight)`. El `pdf.height` de cada plantilla en `config.ts` sigue existiendo (se usa para fijar el `viewport` inicial de Playwright antes de medir), pero ya no actúa como piso mínimo del resultado final.

Cambio global: afecta a `generarPdf()`, compartida por todos los `docType` (`epica` y `sprint`, las cuatro plantillas), no solo a `resumen-inicio`.

## Consecuencias positivas

- Elimina el espacio en blanco sobrante en documentos con contenido real más corto que el alto de diseño de la plantilla (caso típico de `resumen-inicio`).
- Un solo mecanismo de medición, sin casos especiales por plantilla o tipo de documento.
- Verificado con PDFs reales (no solo HTML sin renderizar a PDF) contra datos de ejemplo y datos sintéticos de overflow, para `resumen-inicio`, `resumen` y `epica`.

## Consecuencias negativas

- El `pdf.height` configurado por plantilla en `config.ts` ya no garantiza un alto mínimo — un documento con muy poco contenido (caso extremo, no visto en la práctica todavía) podría generar una página visualmente muy corta. Si esto se vuelve un problema real, ver Notas de seguimiento.
- Mismo riesgo ya documentado en ADR-0004: un documento anormalmente largo (error de extracción, datos mal formados) sigue sin un techo máximo que falle explícitamente — este ADR no lo resuelve, solo corrige el caso de achicar.

## Notas de seguimiento

- Si en la práctica aparece un documento legítimo que quede visualmente demasiado corto (por ejemplo, un sprint con un solo miembro y objetivo breve), evaluar reintroducir un `Math.max` explícito contra un mínimo razonable — pero como decisión de diseño consciente, documentada aparte, no como efecto secundario de la medición como pasaba antes de este ADR.
- Sigue pendiente (heredado de ADR-0004) evaluar un techo máximo de alto para el caso de datos anormalmente largos.
