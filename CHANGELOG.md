# Changelog — Polaria PDF Generator

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) | Versionado: [Semantic Versioning](https://semver.org/lang/es/)

## [Unreleased]

Cambios acumulados sobre la versión `1.0.0` (`backend/package.json`), todavía sin taggear un release. Cualquier cambio de comportamiento visible para el usuario o para quien consuma la API debe agregarse acá en el mismo PR que lo origina.

### Added

- **Sprint — reintento de extracción por rangos de texto**: `extractor.service.ts` reintenta hasta 3 veces (4 intentos en total) cuando la respuesta de OpenAI no cumple el schema Zod del documento, reenviando el mismo markdown con el motivo exacto del fallo para que el modelo tenga una oportunidad real de corregirse. El `uso` (tokens/costo) reportado suma todos los intentos. Genérico por `docType`, no exclusivo de sprint.
- **`sprint-inicio` — rangos de texto endurecidos**: `objetivo`, `equipo.*` y `riesgoTransversal.*` ahora tienen `.min()` (con margen de tolerancia sobre el rango exacto que pide el prompt de IA), `initials` exige exactamente 2 letras mayúsculas y `sprintName` exige terminar en un año de 4 dígitos.
- **Épica — plantilla `cierre`**: nueva plantilla para el resumen de fin de ciclo (`?plantilla=cierre`), con tres campos opcionales nuevos en el schema — `epicas[].cumplimiento`, `epicas[].sprints[]` y `riesgoTransversalResultado` — que solo se completan cuando el documento fuente describe resultados reales (no un plan). La plantilla `default` no los muestra aunque vengan informados.
- **Sprint — plantillas de resumen**: además de `detail`, se agregaron `resumen-inicio` (arranque del sprint), `resumen` y `resumen-v2` (cierre) y `resumen-v3` (cierre con semáforo único de salud del sprint, badge de utilización de capacidad por miembro, issues "vencidos" y tendencia/proyección contra sprints anteriores). Todas seleccionables desde el tab "Plantilla" de la UI.
- **Sprint — `riesgoTransversalResultado`**: campo opcional nuevo en la API (máx. 260 caracteres) que narra al cierre si el riesgo de incidencias se materializó, con cifras reales de issues planeados/agregados completados. Lo muestra la plantilla `resumen-v2`.
- **Sprint — histórico de sprints**: nuevos endpoints `POST /api/sprint/historico` (registra un sprint cerrado) y `GET /api/sprint/historico` (lista), que alimentan la tendencia/proyección de `resumen-v3`. Se persiste en un archivo local no versionado (`backend/data/sprint-historico.json`); no se dispara automáticamente al generar un PDF.
- **Autenticación opcional por API key**: si se define `API_KEY` en el entorno, toda request a `/api/*` debe incluir el header `X-API-Key` o recibe `401 UNAUTHORIZED`. Si no se define, el comportamiento es el mismo que antes (uso local sin auth).

### Changed

- **BREAKING: `sprint` se partió en dos document types, `sprint-inicio` y `sprint-fin`** — `/api/sprint/*` ya no existe (responde `404 NOT_FOUND`). Usar `/api/sprint-inicio/*` (schema mínimo, solo plantilla `resumen-inicio`, sin `agregado`/`desviaciones`/`riesgoTransversalResultado`/`estadoSprint`/`porcentajeCompletado`) o `/api/sprint-fin/*` (schema completo sin cambios de forma, plantillas `detail`/`resumen`/`resumen-v2`/`resumen-v3`, incluye `/historico`). El frontend pasa de 1 tab "Sprint" a 2 ("Sprint Inicio"/"Sprint Fin"). Ver ADR-0008. Este es el tipo de cambio que sería MAJOR cuando el equipo decida taggear un release (ver `docs/VERSIONING.md`).
- **Alto del PDF auto-ajustable**: el alto de página ahora se ajusta al contenido real en ambos sentidos (crece si el contenido no entra y se achica si sobra), en vez de tratar el alto de la plantilla como un mínimo fijo. El ancho sigue siendo fijo por plantilla.
- **Sprint — redacción del resumen de cierre en pasado**: todo el texto narrativo de un resumen fin (incluido el riesgo transversal) se redacta en pasado, gobernado por el `tiempoVerbal` del documento fuente. El riesgo transversal de sprint quedó acotado a un único tema (incidencias que consumen las horas reservadas como colchón) en vez de un riesgo genérico inferido del documento.

### Fixed

- **Épica — encabezado**: el `periodo` garantiza siempre un año de 4 dígitos aunque la IA lo omita, y `fechaFin` se recalcula a partir de la duración real del ciclo en vez de confiar en la aritmética de fechas de la IA.
- Se ajustó el timeout de extracción con OpenAI para sprints grandes.

## [1.0.0] — 2026-06-26

Primera versión funcional del generador: genera PDFs de Épica y Sprint a partir de un Markdown, usando OpenAI para extraer/estructurar el contenido y Playwright para renderizar el PDF final.

### Added

- Se agregó la funcionalidad principal del generador: subir un archivo Markdown, extraer y estructurar su contenido con IA (OpenAI), y renderizar el resultado como PDF con el diseño oficial de Polaria (Handlebars + Playwright/Chromium).
- Se agregó soporte para dos tipos de documento, cada uno con su propio formulario de extracción y diseño: **Épica** (resumen ejecutivo mensual: objetivo, alcance, KPIs, riesgo, equipo y horas) y **Sprint** (resumen agrupado por miembro → proyecto → issue).
- Se agregó un endpoint de vista previa de ejemplo (`/api/:docType/sample-preview`) que muestra el diseño de cada documento con datos de muestra, sin necesidad de subir un Markdown ni de llamar a la IA.

### Changed

- Se mejoró la configuración de generación de PDF (tamaño de página por plantilla) usada al renderizar los documentos.

### Fixed

- Se corrigió un cierre prematuro del navegador (Chromium) durante la generación del PDF que podía interrumpir la descarga de forma intermitente.
