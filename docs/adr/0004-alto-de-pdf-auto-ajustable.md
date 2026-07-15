# ADR-0004: El alto del PDF es un mínimo configurable que crece según `document.documentElement.scrollHeight`, en vez de un alto fijo

## Fecha
2026-07-13 (cambio presente en el árbol de trabajo actual de `backend/src/core/generators/pdf.generator.ts`, aún no commiteado — verificado con `git diff HEAD -- backend/src/core/generators/pdf.generator.ts`; mismo cambio que introduce el browser singleton de ADR-0003). El diseño anterior (alto fijo, tomado literalmente de `template.pdf.height`) estuvo vigente desde el commit `6e3a34c` (2026-06-25).

## Estado
Aceptado, parcialmente superseded por [ADR-0007](0007-altura-de-pdf-tambien-se-achica-no-solo-crece.md) (2026-07-15): la decisión de medir el alto real y ajustar la página sigue vigente, pero el mecanismo de medición (`document.documentElement.scrollHeight`) y la regla de "nunca se achica por debajo del mínimo" (Opción 2 de este ADR) se reemplazaron — ver ADR-0007 para el detalle y el porqué.

## Contexto

`CLAUDE.md` documenta explícitamente el problema que motivó este cambio: *"Antes el alto era fijo y el contenido que sobraba se recortaba silenciosamente."* Cada plantilla define un `pdf.height` propio (por ejemplo, `sprint`/`detail`: `1188px`; `epica` y las demás plantillas de `sprint`: `1050px` por defecto), pero el contenido real de un documento — la cantidad de miembros y issues en un sprint, el número de épicas, el largo de los textos extraídos por IA — puede superar esa altura de diseño de referencia. Con el alto fijo pasado literalmente a `page.pdf({ height })`, Chromium recorta cualquier contenido que no entre en esa página sin emitir ningún error: el PDF se genera "exitosamente" pero con datos faltantes, un fallo silencioso que solo se detecta si alguien revisa el documento completo.

## Opciones consideradas

1. **Alto fijo por plantilla** (diseño original: `pdf.height` se pasa literal a `page.pdf()`).
   - Pros: tamaño de PDF predecible siempre (mismo alto para todos los documentos de una misma plantilla); no requiere medir el layout renderizado antes de imprimir.
   - Contras: recorta contenido silenciosamente en cuanto el documento real es más largo que el diseño de referencia — bug ya confirmado y documentado explícitamente en `CLAUDE.md`; no hay ninguna señal en el resultado (ni en el PDF ni en la respuesta HTTP) de que se perdió contenido.

2. **Alto mínimo configurable + auto-ajuste al `document.documentElement.scrollHeight` real, tomando el máximo entre ambos.**
   - Pros: nunca se recorta contenido, porque `finalHeight = Math.max(contentHeight, viewportHeight)` — la página de PDF crece si hace falta y nunca se achica por debajo del alto de diseño configurado en la plantilla; el `pdf.height` de cada plantilla sigue siendo la referencia útil para el caso común (documentos que sí entran en el diseño pensado); no se rechaza ni falla el render de un documento grande, simplemente se genera una página más alta.
   - Contras: el tamaño final del PDF deja de ser 100% predecible de antemano — varía según el contenido real de cada request; requiere una llamada extra a `page.evaluate()` para medir el DOM (`document.documentElement.scrollHeight`) antes de imprimir, un costo marginal que ya corre dentro del mismo timeout de render existente.

3. **Paginación multi-página real, en vez de una sola página que crece de alto.**
   - No hay evidencia en el código de que se haya considerado: `pageRanges: "1"` fuerza explícitamente una sola página en ambos diseños (el anterior y el actual). Se documenta como opción no explorada, no como alternativa descartada tras comparación — sería la vía natural si en algún momento se necesitara un PDF de varias páginas en vez de una sola página muy alta.

## Decisión

Opción 2. El campo `pdf.height` de cada `template` en `config.ts` pasa a interpretarse como un **mínimo**, no como un valor fijo. Tras `page.setContent()` y la espera determinística a que las fuentes carguen (`document.fonts.ready`), se mide `document.documentElement.scrollHeight` y se usa `Math.max(contentHeight, viewportHeight)` como el alto real pasado a `page.pdf({ height: ... })`.

## Consecuencias positivas

- Elimina por completo la clase de bug ya confirmada de contenido recortado sin ningún aviso.
- Las plantillas con contenido de tamaño variable (en particular `sprint`/`detail`, donde el número de issues por miembro no tiene un techo fijo) ya no necesitan sobre-dimensionar su `pdf.height` "por si acaso" — el documento crece solo cuando el contenido real lo exige, y usa el alto de diseño normal en el caso común.

## Consecuencias negativas

- El tamaño final del PDF (el alto en puntos) deja de ser una constante conocida de antemano por plantilla, lo que complica cualquier prueba o expectativa que asuma un tamaño de página fijo.
- Un documento anormalmente largo (por ejemplo, un error de extracción por IA que dispare cientos de issues, o un bucle de datos mal formados) generaría un PDF de una sola página extremadamente alta en vez de fallar de forma visible — no existe hoy un techo máximo de alto configurado que corte ese caso.

## Notas de seguimiento

Si en la práctica aparecen documentos cuyo `scrollHeight` resulta desproporcionado (señal más probable de un error en los datos extraídos que de un documento legítimamente largo), evaluar agregar un techo máximo razonable de alto que sí falle explícitamente con un error claro, en vez de generar silenciosamente un PDF de tamaño desmedido.
