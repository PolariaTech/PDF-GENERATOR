# Epica - Generar Resumen Final PDF - Google Drive

- **Workflow ID**: `sMMCR1cijPY1IFxt`
- **Proyecto n8n**: personal de Polaria Tech, carpeta de automatizaciones de PDF Generator
- **Trigger**: Schedule (cada 4 semanas) + manual
- **Genera**: `RESUMEN_FINAL_EPICA_<PERIODO>.PDF` (única plantilla: `cierre`)
- **Ver también**: [epica-inicio.md](./epica-inicio.md) (workflow gemelo, plantilla `default`), [README.md](./README.md)

## Estado actual

**Construido 2026-07-25, todavía sin probar de punta a punta.** A diferencia de `epica-inicio.md` (que parte de un PDF de planning), este workflow no tiene ningún documento fuente que describa resultados reales de cierre — no existía antes de esta construcción. Se decidió con el usuario que la fuente de esos datos es **Linear directamente**: la Initiative que agrupa las épicas del período y los Projects dentro de ella, no un segundo PDF subido a mano ni una re-lectura del PDF de planning original.

Es un duplicado de `epica-inicio.md` en el que se conservó la cola del pipeline (extraer → pdf → subir → notificar) y se reemplazó por completo la cabeza (que antes descargaba y leía texto de un PDF) por una cadena de llamadas a la API GraphQL de Linear.

**Verificación de nombres hecha contra datos reales antes de construir** (no es una suposición): las subcarpetas de `00_EPICAS` se llaman `EPICA <PERIODO>` (ej. `EPICA JUNIO-JULIO 2026`), las fuentes de inicio `EPICA_<PERIODO>.pdf` y sus resúmenes `RESUMEN_INICIO_EPICA_<PERIODO>.pdf` (confirmado vía Google Drive); la Initiative de Linear correspondiente se llama `ÉPICAS <PERIODO>` (con tilde y en plural, distinto del nombre de la carpeta) y ya existe con `status=Completed` para el período Junio-Julio 2026; los Cycles del equipo POLARIA se llaman `SPRINT N <PERIODO>` (confirmado vía Linear).

## Objetivo del flujo

Estado inicial → estado final: **Una Initiative de Linear (`ÉPICAS <PERIODO>`) con `status=Completed`, correspondiente a una subcarpeta de `00_EPICAS` que ya tiene `RESUMEN_INICIO_...` pero no `RESUMEN_FINAL_...`** → **un PDF de cierre de épica (`RESUMEN_FINAL_EPICA_<PERIODO>.pdf`) generado y subido a esa misma subcarpeta**, con los `sprints[]` (CUMPLIDO/NO CUMPLIDO por época) calculados en código a partir de los issues reales de Linear, no redactados por la IA.

## Actores involucrados

| Actor | Rol en este flujo |
|---|---|
| n8n (orquestador) | Detecta qué carpetas están listas para cierre, consulta Linear (Initiative → Projects → Issues/Cycles), calcula sprints CUMPLIDO/NO CUMPLIDO por proyecto, consolida un Markdown, llama a `POST /api/epica/extraer` y `POST /api/epica/pdf`, y sube el resultado a Drive |
| Google Drive (`00_EPICAS`) | Fuente para detectar qué carpetas ya iniciaron (`RESUMEN_INICIO_...`) y cuáles faltan cerrar (sin `RESUMEN_FINAL_...`); destino final del PDF |
| Linear — Initiative | Agrupa las épicas de un período (`ÉPICAS <PERIODO>`); su `status` (`Completed`) es el gate que decide si ya hay resultados reales que extraer |
| Linear — Projects | Cada Project dentro de la Initiative es una `epica` del `EpicaSchema` — aporta `name`/`description`/`lead` |
| Linear — Cycles + Issues | Los Cycles del equipo POLARIA (`SPRINT N <PERIODO>`) cruzados con los issues de cada Project dan, en código, si esa época se cumplió (todos los issues de ese proyecto en ese ciclo con `state.type=completed`) |
| Backend — extracción (`POST /api/epica/extraer`) | El mismo endpoint del flujo manual — aquí recibe un Markdown armado por n8n a partir de datos de Linear, no un PDF leído. Redacta solo la narrativa (`objetivo`, `alcance`, `cumplimiento`, `riesgoTransversalResultado`, etc.); los `sprints[]` que devuelva se descartan y se reemplazan por el cálculo determinístico |
| Backend — PDF (`POST /api/epica/pdf`, `plantilla=cierre`) | Valida y genera el PDF |

## Resumen del flujo en términos de negocio

1. El trigger (Schedule, cada 4 semanas, o manual) lista las subcarpetas de `00_EPICAS`.
2. Por cada subcarpeta con un archivo `RESUMEN_INICIO_...`: deriva el `periodo` del nombre de la carpeta (`EPICA <PERIODO>` → `<PERIODO>`) y el nombre de salida (mismo nombre del `RESUMEN_INICIO_` con el prefijo cambiado a `RESUMEN_FINAL_`).
3. Si ya existe un archivo con ese nombre de salida en la carpeta, se salta (ya se cerró antes) — mismo patrón de "ya existe" que `epica-inicio.md`.
4. n8n busca en Linear la Initiative `ÉPICAS <periodo>`. Si no existe, o existe pero su `status` no es `Completed`, se salta esa carpeta **en silencio** (sin correo de error) — es un estado esperado y frecuente (la mayoría de las corridas programadas van a encontrar épicas que todavía no cerraron), no una falla.
5. Con la Initiative confirmada, n8n lista sus Projects y, en paralelo, busca los Cycles del equipo POLARIA cuyo nombre contiene el `periodo` (los `SPRINT N <periodo>` de ese ciclo).
6. Por cada Project: n8n trae todos sus issues (con su `cycle` y `state` reales) y calcula, para cada Cycle del período, si ese proyecto tuvo trabajo en él y si todo ese trabajo quedó `completed` (CUMPLIDO) o no (NO CUMPLIDO). También cuenta issues completados/pendientes/cancelados totales del proyecto.
7. n8n arma un Markdown con esos resultados reales (uno por proyecto) y lo envía a `POST /api/epica/extraer` para que la IA redacte la narrativa de cierre.
8. n8n **pisa** el `sprints[]` que haya devuelto la IA con el calculado en el paso 6, emparejando por `responsable` (apodo DANI/MAURO/LUCHO derivado del `lead` del Project en Linear) — mismo criterio que el Caso borde C de `docs/BUSINESS_FLOWS.md` (Flujo 4): no confiar en que el LLM cuente/clasifique bien sobre una lista estructurada.
9. n8n llama a `POST /api/epica/pdf` con `plantilla=cierre`.
10. n8n confirma que la respuesta sea realmente un PDF antes de subir nada, calcula el nombre final y lo sube a la misma subcarpeta que el `RESUMEN_INICIO_`.
11. n8n envía un correo de informe (Polaria-branded) con la carpeta, el archivo generado, la Initiative de Linear como fuente, y un botón directo a Drive.

## Postcondiciones

- El PDF de cierre queda en la misma subcarpeta de `00_EPICAS` que el `RESUMEN_INICIO_`, con nombre `RESUMEN_FINAL_EPICA_<PERIODO>.pdf` (autoincremental si ya existía).
- Notificación por Gmail a `daniel.galvis@polaria.tech`: correo de éxito o de error. Sin Data Table de auditoría, igual que `epica-inicio.md`.
- El sistema no persiste nada más; el backend es sin estado.

## Casos de error y decisiones pendientes

- **Las 3 queries GraphQL nuevas contra Linear no están probadas contra la API real todavía** (`Buscar Initiative en Linear`, `Buscar Cycles del Periodo`, `Buscar Issues del Proyecto`) — se escribieron siguiendo el mismo patrón exacto de las queries que ya funcionan en `sprint-fin.md` (mismo `teamId` de POLARIA, mismo estilo `query X($var: Tipo) { ... }` + `variables`), pero hay que correr "Test step" sobre esos 3 nodos en la UI de n8n antes de confiar en el resto del pipeline.
- **Credenciales sin atar:** los 3 nodos HTTP contra Linear necesitan la credencial `Linear Auth` asignada a mano (el nodo de Drive nuevo sí se auto-asignó). Los nodos heredados de `epica-inicio.md` (Drive, Gmail, backend) ya tenían sus credenciales del duplicado original.
- **"Initiative no encontrada o no Completed" no envía correo de error a propósito** — si esto se vuelve ruidoso o silencioso de forma no deseada (por ejemplo, si la convención de nombres `ÉPICAS <PERIODO>` cambia y el workflow deja de encontrar nada, siempre en silencio), vale la pena agregar algún tipo de resumen periódico en vez de depender de revisar el historial de ejecuciones en n8n.
- **Sin fechaInicio/fechaFin de una fuente única:** a diferencia de `epica-inicio.md` (que las saca del PDF de planning), aquí se derivan del rango real de los Cycles encontrados (`startsAt` más temprano, `endsAt` más tardío) — si por algún motivo `Buscar Cycles del Periodo` no encuentra ningún Cycle para ese período, esas fechas quedan vacías (el resto del pipeline sigue funcionando, pero el PDF mostraría fechas en blanco).
- **`Obtener Festivos CO`/`Calcular Festivos del Ciclo` del workflow original no se llevaron a esta copia** — en `epica-inicio.md` ese cálculo se hacía pero nunca se enviaba al backend (`EpicaSchema` no tiene un campo `festivos`); es peso muerto heredado del diseño original, no algo que este workflow necesitara.

## Reglas de negocio que aplican

- El JSON final debe cumplir el mismo `EpicaSchema` que valida el flujo manual — no hay schema paralelo. `epicas[].cumplimiento`, `epicas[].sprints` y `riesgoTransversalResultado` (los tres campos exclusivos de cierre) se completan siempre en este flujo, a diferencia del flujo manual donde son opcionales según si el documento fuente describe resultados reales.
- Los `sprints[]` de cada época nunca quedan en manos del LLM — se calculan siempre en código a partir de Linear, mismo criterio que ya aplica a `riesgoTransversalResultado` de `sprint`/`resumen-v2`.
- `epica` no tiene bloque de horas editable: siempre usa `HORAS_FIJAS`, igual que `epica-inicio.md`.
- El endpoint que llama n8n es el mismo que usa el frontend manual: cualquier cambio de contrato afecta ambos flujos a la vez.

## Referencias

- Workflow gemelo de inicio: [epica-inicio.md](./epica-inicio.md)
- Patrón de query GraphQL contra Linear ya validado en producción: `sprint-fin.md`, nodos `Buscar Ciclo en Linear1`/`Listar Issues del Ciclo1`/`Obtener Historial de Issue1`
- Contrato de datos: `backend/src/documents/epica/config.ts` (`EpicaSchema`, campos de cierre: `epicas[].cumplimiento`, `epicas[].sprints`, `riesgoTransversalResultado`)
- Caso borde C (LLM no confiable contando/clasificando sobre una lista estructurada): `docs/BUSINESS_FLOWS.md`, Flujo 4
