# Notas de migración entre versiones mayores

**Prioridad: Baja.** Estado real: **no aplica todavía — no ha habido ningún cambio MAJOR**, porque no hay una versión `1.0.0` con contrato público congelado en el sentido que exige la política de versionado (ver `docs/VERSIONING.md`). Este documento no está vacío por omisión: se deja preparado para el primer cambio que sí lo amerite.

## Por qué no hay entradas todavía

- No hay base de datos (no hay schema que migrar).
- No hay historial de versiones taggeadas (`git tag` no devuelve nada al día de escribir esto).
- Los cambios de schema Zod que sí hubo hasta ahora (ej. agregar `desviaciones` y la plantilla `resumen-v2` a `SprintSchema`) fueron aditivos — campos nuevos, no cambios incompatibles sobre contratos ya consumidos externamente. No calzan como MAJOR según `docs/VERSIONING.md`.

## Cuándo este documento deja de estar vacío

La próxima vez que ocurra un cambio de los que `docs/VERSIONING.md` clasifica como MAJOR — por ejemplo, renombrar o quitar un campo requerido de `EpicaSchema`/`SprintSchema`, o cambiar el contrato de respuesta de algún endpoint de `backend/src/api/document.routes.ts` — se debe agregar acá una entrada siguiendo esta plantilla:

```markdown
## Migración de vX.x a vY.0 — <descripción corta>

**Impacto**: quién/qué se ve afectado (ej. el workflow de n8n que llama a /api/sprint-fin/pdf).
**Prerrequisitos**: qué debe existir antes de migrar (backups si aplica, versión mínima de algo).

### Pasos de migración
1. ...

**Cómo verificar que la migración fue exitosa**: ...
**Cómo hacer rollback**: ...
**Tiempo estimado / downtime**: ...
```

## Caso más probable de MAJOR a futuro

El caso con más probabilidad real de ocurrir, dado el estado del proyecto: una vez que el workflow de n8n (`docs/planning/PLAN-N8N-SPRINT-WORKFLOW.md`) dependa en producción de `POST /api/sprint-fin/pdf`, cualquier cambio incompatible en `SprintSchema` o en el formato de respuesta de ese endpoint pasa a tener un consumidor externo real que migrar — a partir de ese momento, este documento deja de ser teórico.
