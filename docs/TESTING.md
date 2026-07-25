# Documentación de testing

## Estado actual: no hay suite de tests automatizada

Este proyecto **no tiene** framework de testing configurado (`package.json` de `backend/` no declara Jest, Vitest ni Mocha), ni linter, ni pipeline de CI que ejecute nada automáticamente. Esto ya está señalado como pendiente en `CLAUDE.md` ("Pendiente de documentar: No hay suite de tests ni linter/formatter configurado — confirmar con el equipo si se planea agregar"). Este documento no resuelve esa decisión — solo describe cómo se verifica hoy el sistema en ausencia de tests automatizados, para que cualquier persona del equipo pueda hacerlo de forma consistente.

**Único comando de verificación real que existe hoy:**

```bash
cd backend
npm run build
```

Esto compila TypeScript (`tsc`) y falla si hay errores de tipos. No verifica comportamiento en runtime, solo que el código compila.

## Protocolo de verificación manual (sustituto actual de una suite automatizada)

Para cada uno de los dos tipos de documento (`epica`, `sprint`), verificar los 4 endpoints en este orden después de cualquier cambio en `backend/src/documents/<tipo>/` o en `backend/src/core/`:

### 1. `sample-preview` — sin IA, sin datos de usuario

```bash
curl "http://localhost:3001/api/sprint-fin/sample-preview?plantilla=detail"
```

**Resultado esperado**: HTML completo (empieza con `<!DOCTYPE html>` o `<html>`), sin errores. Es la verificación más rápida de que una plantilla renderiza — usa `sample-data.ts`, no depende de OpenAI ni de datos del usuario.

Repetir para cada plantilla registrada del tipo de documento (`detail`, `resumen-inicio`, `resumen`, `resumen-v2`, `resumen-v3` para `sprint`; `default` y `cierre` para `epica`).

### 2. `extraer` — con IA (consume tokens reales de OpenAI)

```bash
curl -X POST "http://localhost:3001/api/sprint-fin/extraer" \
  -F "archivo=@ruta/a/un/sprint-de-ejemplo.md"
```

**Resultado esperado**: `200` con `{"success":true,"datos":{...},"uso":{...}}`. El `datos` debe cumplir el schema Zod del tipo de documento (si no, `extractor.service.ts` habría fallado antes con un error de OpenAI). Verificar a ojo que los campos de texto libre (`objetivo`, `equipo.*`, `riesgoTransversal.*` en `sprint`) caen dentro de los rangos de caracteres que pide `SPRINT_SYSTEM_PROMPT` — el schema Zod solo impone topes máximos, no los rangos exactos (ver `docs/adr/` para el porqué).

### 3. `preview` — validación Zod + render sin PDF

```bash
curl -X POST "http://localhost:3001/api/sprint-fin/preview" \
  -H "Content-Type: application/json" \
  -d @datos-editados.json
```

**Resultado esperado**: `200` con HTML. Si el JSON no cumple el schema: `400` con `{"success":false,"code":"VALIDATION_ERROR","message":"...","details":{...}}` — el `details` trae el `flatten()` de Zod, útil para ver exactamente qué campo falló.

### 4. `pdf` — el camino completo, incluyendo Playwright

```bash
curl -X POST "http://localhost:3001/api/sprint-fin/pdf" \
  -H "Content-Type: application/json" \
  -d @datos-editados.json \
  -o salida.pdf
```

**Resultado esperado**: `salida.pdf` es un PDF válido y abre correctamente. Verificar especialmente después de cambiar cualquier plantilla `.html` o el CSS embebido: el contenido no debe recortarse (el alto de página se auto-ajusta, ver `pdf.generator.ts`) y las fuentes/íconos (Google Fonts, Tabler Icons vía CDN) deben cargar — si no hay conexión a internet, este paso puede fallar de forma distinta a un error de datos.

## Casos críticos que siempre deben verificarse manualmente antes de un cambio en `pdf.generator.ts`

Estos son los "tests de regresión" informales del proyecto — si algo de esto se rompe, es un problema serio, no un detalle:

1. **`await page.pdf(...)` se resuelve antes de cerrar el `context`/`browser`.** Ya causó fallos intermitentes en producción (ver el comentario correspondiente en `pdf.generator.ts` y en `CLAUDE.md`). Cualquier cambio en `generarPdf()` debe preservar este orden.
2. **El alto del PDF nunca recorta contenido.** Generar un `sprint`/`detail` con muchos miembros/issues y confirmar que el PDF final no corta la última fila.
3. **Un JSON inválido nunca produce un PDF corrupto.** `POST /pdf` con un body que no cumple el schema debe responder `400` JSON, nunca un archivo binario con contenido de error.

## Qué no existe hoy (para no asumirlo por error)

- No hay tests unitarios, de integración ni e2e.
- No hay mocks de OpenAI ni de Playwright — la verificación manual de arriba golpea los servicios reales.
- No hay medición de cobertura.
- No hay fixtures versionados más allá de `sample-data.ts` por tipo de documento.

## Si el equipo decide adoptar una suite automatizada

No es parte de este documento decidirlo (ver la nota pendiente en `CLAUDE.md`), pero si se adopta, el candidato más simple dado el stack actual (TypeScript + Express, sin framework de frontend) es **Vitest** o **Jest** con `ts-jest`, empezando por los puntos de mayor riesgo real ya identificados en este proyecto: `componerDatosSprint()`/`componerDatosEpica()` (lógica pura, fácil de testear sin mocks) y el `safeParse` de cada schema Zod contra casos límite conocidos (rangos de caracteres, enums de `estadoSprint`/`agregado`).
