# Checklist maestra de documentación

Estado real de los 20 puntos de `GUIA_DOCUMENTACION_EXTENDIDA.md` aplicados al proyecto Polaria PDF Generator. Actualizar esta tabla cada vez que se complete, cree o retire un punto — es la práctica que la propia guía exige.

| # | Elemento de documentación | Prioridad | Estado | Dónde vive |
|---|---|---|---|---|
| 1 | README.md — Portada del proyecto | Alta | ✅ Hecho | `README.md` |
| 2 | Diagrama de arquitectura del sistema | Alta | ✅ Hecho | `docs/architecture/README.md` |
| 3 | Documentación de API | Alta | ✅ Hecho | `docs/API.md` |
| 4 | Variables de entorno y configuración | Alta | ✅ Hecho | `docs/ENV_VARS.md` + `backend/.env.example` |
| 5 | Guía de instalación y ejecución local | Alta | ✅ Hecho | `docs/INSTALL.md` |
| 6 | CONTRIBUTING.md | Alta | ✅ Hecho | `CONTRIBUTING.md` |
| 7 | Glosario de términos del negocio | Alta | ✅ Hecho | `docs/GLOSSARY.md` |
| 8 | Flujos de negocio end-to-end | Alta | ✅ Hecho | `docs/BUSINESS_FLOWS.md` |
| 9 | Architecture Decision Records (ADRs) | Media | ✅ Hecho (7 ADRs) | `docs/adr/0001` a `0007` |
| 10 | Documentación de testing | Media | ⚠️ Hecho como honestidad, no como suite | `docs/TESTING.md` — no hay framework automatizado; documenta el protocolo de verificación manual vigente |
| 11 | Runbooks de operación y deployment | Media | ✅ Hecho | `docs/RUNBOOKS.md` |
| 12 | Guía de onboarding para nuevos desarrolladores | Media | ✅ Hecho | `docs/ONBOARDING.md` |
| 13 | CHANGELOG.md | Media | ✅ Hecho | `CHANGELOG.md` |
| 14 | Documentación de seguridad y autenticación | Media | ✅ Hecho | `docs/SECURITY.md` |
| 15 | Definición de entornos | Media | ✅ Hecho | `docs/ENVIRONMENTS.md` — hoy solo existe un entorno (local) |
| 16 | Guía de observabilidad y monitoreo | Baja | ⚠️ Documentado el estado mínimo real | `docs/OBSERVABILITY.md` — no hay métricas/alertas, solo `console.error` |
| 17 | Política de versionado semántico (SemVer) | Baja | ✅ Hecho | `docs/VERSIONING.md` |
| 18 | Notas de migración entre versiones mayores | Baja | ⚠️ No aplica todavía | `docs/MIGRATIONS.md` — sin cambios MAJOR en el historial |
| 19 | Storybook o catálogo de componentes UI | Baja | ❌ No aplica | `docs/UI_COMPONENTS.md` — frontend estático sin framework de componentes |
| 20 | Compliance y normativas aplicables | Baja | ⚠️ Evaluación preliminar, pendiente de confirmación legal | `docs/COMPLIANCE.md` |

**Leyenda**: ✅ Hecho y aplica tal como lo pide la guía · ⚠️ Resuelto documentando honestamente una limitación/ausencia real (no es un placebo) · ❌ No aplica a este proyecto, con la razón explícita en el propio documento.

## Notas de mantenimiento

- Esta checklist, igual que el resto de `docs/`, se actualiza en el mismo PR que el cambio que la afecta (principio "Docs as Code" de la guía) — no es un proyecto con fecha de cierre.
- Los puntos marcados ⚠️/❌ no son deuda oculta: cada uno documenta explícitamente por qué está así y qué señal debería disparar su reevaluación (ver la sección final de cada archivo correspondiente).
- Si se agrega un tipo de documento nuevo (`backend/src/documents/<tipo>/`) o una plantilla nueva, actualizar como mínimo: `README.md` (estructura del proyecto), `docs/API.md` (si cambia el contrato), `docs/GLOSSARY.md` (términos nuevos) y `docs/BUSINESS_FLOWS.md` (si agrega un flujo).
