import path from "path";
import { z } from "zod";
import { asignarPaleta, construirGradiente, formatearHoras } from "../../constants";
import { DocumentConfig } from "../types";
import { leerHistorico } from "./historico";

// Total de horas de una persona en una semana: siempre 8h x dias habiles, y
// TODOS los miembros del sprint deben sumar exactamente el mismo total. Solo
// un festivo en la semana lo baja de 40 (5 dias) a 32 (4 dias); ese calculo ya
// lo resuelve n8n desde el Sheet antes de armar el JSON -- aqui solo
// validamos que lo que llegue sea uno de estos dos valores, igual para todos
// (ver superRefine en SprintSchema).
const CAPACIDADES_VALIDAS_HORAS_MIEMBRO = [40, 32] as const;
const TOLERANCIA_HORAS = 0.01;

function esCapacidadValida(total: number): boolean {
  return CAPACIDADES_VALIDAS_HORAS_MIEMBRO.some(
    (capacidad) => Math.abs(total - capacidad) < TOLERANCIA_HORAS,
  );
}

export const IssueTypeSchema = z.enum(["Bug", "Feature", "Improvement"]);
export const IssuePrioritySchema = z.enum(["Urgent", "High", "Medium", "Low"]);
export const IssueStatusSchema = z.enum([
  "Todo",
  "In Progress",
  "In Review",
  "Done",
  "Cancelled",
]);

// Mismo shape para el bloque de horas del documento (equipo completo) y el de
// cada member (horas individuales) -- ver construirBloqueHoras().
// Factory (no una instancia compartida): zodResponseFormat hoistea a $ref
// cualquier schema Zod reutilizado por identidad, y esa dedupe rompe la
// conversion a JSON Schema cuando el schema reutilizado tiene un campo
// nullable/optional (produce un $ref auto-referenciado que OpenAI rechaza
// con "Invalid schema for response_format"). Cada llamada crea una instancia
// nueva para que el documento y cada member obtengan definiciones inline
// independientes.
function crearHorasSegmentoSchema() {
  return z.object({
    nombre: z.string(),
    horas: z.number().nonnegative(),
    // Solo aplica al segmento "Proyectos (3 objetivos)": horas que se habian
    // planeado para Proyectos al inicio del sprint (documento: copiadas del
    // resumen-inicio del mismo sprint; member: la porcion de esa persona).
    // No lo llena la IA -- ver SPRINT_SYSTEM_PROMPT.
    horasPlaneadas: z.number().nonnegative().nullable().optional(),
  });
}

export const SprintSchema = z.object({
  sprintName: z.string().toUpperCase(),
  dateStart: z.string(),
  dateEnd: z.string(),
  weekNumber: z.string(),
  estadoSprint: z.enum(["CUMPLIDO", "NO CUMPLIDO"]),
  porcentajeCompletado: z.number().min(0).max(100),
  horas: z.object({
    segmentos: z.array(crearHorasSegmentoSchema()).min(1),
  }),
  members: z.array(
    z.object({
      name: z.string(),
      initials: z.string(),
      objetivo: z.string().max(600),
      // Reemplaza al riesgo transversal en el resumen final (template-resumen-v2):
      // en un sprint cerrado el riesgo ya no aplica, se explican las desviaciones
      // de alcance de ESTE miembro (planeado vs. realmente hecho por el/ella).
      // Ver daily 2026-07-07 (Edgar) y decision de moverlo a nivel de miembro (2026-07-17).
      desviaciones: z.object({
        logrado: z.string().max(320),
        motivo: z.string().max(200),
      }),
      // Horas individuales de esta persona, mismo shape que el bloque "horas"
      // del documento. Opcional: no lo llena la IA, se agrega despues a mano o
      // por integracion (ver SPRINT_SYSTEM_PROMPT). Sin este dato, la tarjeta
      // simplemente no muestra la seccion de horas para ese miembro. La suma de
      // todos los segmentos (Proyectos + Reuniones + Incidencias + cualquier
      // otro) debe dar exactamente 40 u 32, y TODOS los miembros deben coincidir
      // en el mismo total -- se valida en el superRefine de SprintSchema, no
      // aqui, porque requiere comparar entre members.
      horas: z
        .object({
          segmentos: z.array(crearHorasSegmentoSchema()).min(1),
        })
        .nullable()
        .optional(),
      projects: z.array(
        z.object({
          name: z.string(),
          issues: z.array(
            z.object({
              title: z.string(),
              type: IssueTypeSchema,
              priority: IssuePrioritySchema,
              status: IssueStatusSchema,
              agregado: z.boolean(),
            }),
          ).min(1),
        }),
      ).min(1),
    }),
  ).min(1),
  equipo: z.object({
    quien: z.string().max(150),
    cuando: z.string().max(150),
    donde: z.string().max(150),
    como: z.string().max(150),
  }),
  riesgoTransversal: z.object({
    texto: z.string().max(320),
    mitigacion: z.string().max(200),
  }),
  // Solo se llena en el flujo de CIERRE (template-resumen-v2): si el riesgo
  // transversal previsto en resumen-inicio se materializo o no, y que paso.
  // Editable a mano. Mismo patron que epica (ver epica/config.ts).
  riesgoTransversalResultado: z.string().max(260).nullable().optional(),
}).superRefine((datos, ctx) => {
  const totalesPorMiembro = datos.members
    .map((member, indice) => ({
      indice,
      total: member.horas?.segmentos.reduce((suma, segmento) => suma + segmento.horas, 0),
    }))
    .filter(
      (entrada): entrada is { indice: number; total: number } => entrada.total !== undefined,
    );

  if (totalesPorMiembro.length === 0) return;

  for (const { indice, total } of totalesPorMiembro) {
    if (!esCapacidadValida(total)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["members", indice, "horas"],
        message: `Las horas totales de este miembro deben sumar exactamente 40 (semana normal) o 32 (semana con festivo); suman ${total}.`,
      });
    }
  }

  const totalesDistintos = new Set(
    totalesPorMiembro.map(({ total }) => Math.round(total * 100) / 100),
  );
  if (totalesDistintos.size > 1) {
    for (const { indice } of totalesPorMiembro) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["members", indice, "horas"],
        message: `Todos los miembros deben sumar el mismo total de horas (40 u 32); hay valores distintos entre members: ${[...totalesDistintos].join(", ")}.`,
      });
    }
  }
});

export type SprintData = z.infer<typeof SprintSchema>;

const TYPE_CFG = {
  Bug: { color: "#C0392B", bg: "#FADBD8", icon: "ti-bug" },
  Feature: { color: "#00B5A3", bg: "#E0F7F4", icon: "ti-sparkles" },
  Improvement: {
    color: "#1E6B3C",
    bg: "#D5F0E3",
    icon: "ti-trending-up",
  },
} as const;

const PRI_CFG = {
  Urgent: { color: "#C0392B", icon: "ti-alert-circle" },
  High: { color: "#E07B24", icon: "ti-arrow-up" },
  Medium: { color: "#3B82F6", icon: "ti-minus" },
  Low: { color: "#94A3B8", icon: "ti-arrow-down" },
} as const;

// Mismo patron que TYPE_CFG: color = texto saturado, bg = tinte claro del mismo
// tono. Los tonos parten de los colores de estado pedidos (Todo #e2e2e2,
// In Progress #f2c94c, In Review #f2994a, Done #4cb782, Cancelled #95a2b3),
// oscurecidos para que el texto tenga contraste legible sobre el bg claro.
const STA_CFG = {
  Todo: { color: "#6b6f76", bg: "#eeeeee", icon: "ti-circle-dashed" },
  "In Progress": { color: "#8a6d1f", bg: "#fdf3d6", icon: "ti-progress" },
  "In Review": { color: "#8a5320", bg: "#fce6d2", icon: "ti-eye" },
  Done: { color: "#2f7a52", bg: "#dcf2e6", icon: "ti-circle-check" },
  Cancelled: { color: "#525962", bg: "#e7eaee", icon: "ti-circle-x" },
} as const;

// Colores del donut "Planeados vs Agregados" en la plantilla resumen.
const PLAN_AGREGADO_CFG = {
  planeados: "#0b1430",
  agregados: "#2dd4bf",
};

// Estado del sprint segun % de issues Done, con su badge de color. Se usa en
// template-resumen-v2.html para los dos KPIs (Planeados / Agregados). Solo hay
// dos estados: CUMPLIDO si el porcentaje es >=90, NO CUMPLIDO si es <90.
const ESTADO_SPRINT_CFG = {
  CUMPLIDO: { color: "#0f766e", bg: "#d7f6f0" },
  "NO CUMPLIDO": { color: "#b3261e", bg: "#fbe2e1" },
} as const;

function resolverEstadoSprint(porcentaje: number) {
  const estado = porcentaje >= 90 ? "CUMPLIDO" : "NO CUMPLIDO";
  return { estado, ...ESTADO_SPRINT_CFG[estado] };
}

// Escala de rango para el KPI global (planeacion) del resumen-v2: mide el total
// de issues Done sobre los planeados, por lo que puede superar el 100% cuando se
// completan agregados. Edgar (daily 2026-07-07): verde 95-105, amarillo 85-95 y
// 105-115, rojo <85 o >115. Sobrecumplir por mucho tambien es mala planeacion.
const ESTADO_GLOBAL_CFG = {
  ÓPTIMO: { color: "#0f766e", bg: "#d7f6f0" },
  ACEPTABLE: { color: "#7a5c12", bg: "#fdf3da" },
  DESVIADO: { color: "#b3261e", bg: "#fbe2e1" },
} as const;

function resolverEstadoGlobal(porcentaje: number) {
  let estado: keyof typeof ESTADO_GLOBAL_CFG;
  if (porcentaje >= 95 && porcentaje <= 105) {
    estado = "ÓPTIMO";
  } else if (
    (porcentaje >= 85 && porcentaje < 95) ||
    (porcentaje > 105 && porcentaje <= 115)
  ) {
    estado = "ACEPTABLE";
  } else {
    estado = "DESVIADO";
  }
  return { estado, ...ESTADO_GLOBAL_CFG[estado] };
}

// Semaforo unificado (ÓPTIMO/ACEPTABLE/DESVIADO, mismos colores que
// resolverEstadoGlobal) para porcentajes de completado 0-100 (Planeados /
// Agregados) -- exclusivo de template-resumen-v3: reemplaza ahi el semaforo
// binario CUMPLIDO/NO CUMPLIDO de resolverEstadoSprint (que se queda sin
// cambios para resumen/resumen-v2) para que las 4 tarjetas de KPI del header
// compartan un solo vocabulario. Umbrales propios (no simetricos alrededor de
// 100 como resolverEstadoGlobal, porque un % completado no puede pasar de 100).
function resolverEstadoCompletado(porcentaje: number) {
  let estado: keyof typeof ESTADO_GLOBAL_CFG;
  if (porcentaje >= 90) {
    estado = "ÓPTIMO";
  } else if (porcentaje >= 75) {
    estado = "ACEPTABLE";
  } else {
    estado = "DESVIADO";
  }
  return { estado, ...ESTADO_GLOBAL_CFG[estado] };
}

// Orden de severidad para el semaforo agregado de salud del sprint (v3): el
// peor estado entre los KPIs aplicables domina el veredicto general.
const SEVERIDAD_ESTADO: Record<string, number> = { ÓPTIMO: 0, ACEPTABLE: 1, DESVIADO: 2 };

// Categorias de estado que el schema de Sprint realmente puede producir hoy
// (ver IssueStatusSchema) -- usado solo por template-resumen-v3 para no
// mostrar en el donut "Resultado" las 4 categorias estilo Linear (Triage,
// Bloqueado, Duplicado, Backlog) que siempre estan en 0 porque el schema no
// las soporta. resumen-v2 sigue mostrando las 9 sin cambios.
const ESTADO_DONUT_KEYS_V3 = ["Todo", "En progreso", "En revisión", "Completado", "Cancelado"];

// Calcula % de issues Done y su estado sobre un subconjunto de issues (planeados
// o agregados). Grupo vacio => 0% / EN RIESGO.
function calcularKpiCompletado(issues: { status: string }[]) {
  const total = issues.length;
  const done = issues.filter((issue) => issue.status === "Done").length;
  const porcentaje = total > 0 ? Math.round((done / total) * 100) : 0;
  return { porcentaje, ...resolverEstadoSprint(porcentaje) };
}

// Etiqueta por issue (planeado/agregado) en la plantilla detail.
const AGREGADO_TAG_CFG = {
  false: { label: "Planeado", color: "#334155", bg: "#e2e8f0", icon: "ti-calendar-check" },
  true: { label: "Agregado", color: "#0f766e", bg: "#ccfbf1", icon: "ti-plus" },
} as const;

// Las 9 categorias de estado estilo Linear que se muestran en el donut "Por estado"
// de la plantilla resumen. El esquema de Sprint solo extrae 5 estados (STA_CFG);
// Triage, Bloqueado, Duplicado y Backlog quedan en 0 hasta que el esquema los soporte.
const ESTADO_DONUT_CFG = [
  { key: "Triage", label: "Triage", color: "#F54927" },
  { key: "Todo", label: "Todo", color: "#e2e2e2" },
  { key: "Bloqueado", label: "Bloqueado", color: "#eb5757" },
  { key: "Completado", label: "Completado", color: "#4cb782" },
  { key: "Duplicado", label: "Duplicado", color: "#95a2b3" },
  { key: "Backlog", label: "Backlog", color: "#bec2c8" },
  { key: "En progreso", label: "En progreso", color: "#f2c94c" },
  { key: "En revisión", label: "En revisión", color: "#f2994a" },
  { key: "Cancelado", label: "Cancelado", color: "#95a2b3" },
] as const;

// Colores ciclicos para los segmentos del bloque "horas" (orden de aparicion en el JSON).
const COLORES_HORAS = ["#0b1430", "#94a3c4", "#e08a2e", "#8b5cf6", "#ec4899"];

const STATUS_TO_BUCKET: Record<string, string> = {
  Todo: "Todo",
  "In Progress": "En progreso",
  "In Review": "En revisión",
  Done: "Completado",
  Cancelled: "Cancelado",
};

// Normaliza un nombre a Title Case: "LUIS DANIEL CANTILLO OSPINO" ->
// "Luis Daniel Cantillo Ospino". Cada palabra con la primera en mayuscula y el
// resto en minuscula.
function aTituloCase(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter((palabra) => palabra.length > 0)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(" ");
}

// Compone un bloque "horas" (total formateado, segmentos con pct/color, y el
// KPI de horas reales/planeadas del segmento "Proyectos") -- reusado tanto
// para el bloque del documento como para el de cada member (ver SprintSchema).
function construirBloqueHoras(
  segmentos: { nombre: string; horas: number; horasPlaneadas?: number | null }[],
) {
  const totalHoras = segmentos.reduce((suma, segmento) => suma + segmento.horas, 0);
  const segmentosCompuestos = segmentos.map((segmento, indice) => {
    const tienePlaneadas = segmento.horasPlaneadas != null;
    return {
      nombre: segmento.nombre,
      horas: formatearHoras(segmento.horas),
      // Horas planeadas de ESTE segmento, para mostrar "planeadas -> reales" en la
      // seccion de desviacion. Las llena la integracion (n8n desde el Sheet), no la
      // IA: reuniones e incidencias son fijas por persona y Proyectos es el resto
      // hasta la capacidad semanal (40/32). null si el segmento no trae planeadas.
      horasPlaneadas: tienePlaneadas ? formatearHoras(segmento.horasPlaneadas!) : null,
      tienePlaneadas,
      pct: totalHoras > 0 ? Math.round((segmento.horas / totalHoras) * 100) : 0,
      color: COLORES_HORAS[indice % COLORES_HORAS.length],
      mostrarPct: indice === 0,
    };
  });
  // Solo mostramos el comparativo planeadas-vs-reales si al menos un segmento trae
  // horasPlaneadas; si no, la leyenda cae al formato anterior (pct + horas reales).
  const planeadasDisponibles = segmentosCompuestos.some((seg) => seg.tienePlaneadas);

  const segmentoProyectos = segmentos.find((segmento) =>
    segmento.nombre.toLowerCase().includes("proyecto"),
  );
  const kpiDisponible =
    segmentoProyectos?.horasPlaneadas != null && segmentoProyectos.horasPlaneadas > 0;
  const porcentaje = kpiDisponible
    ? Math.round((segmentoProyectos!.horas / segmentoProyectos!.horasPlaneadas!) * 100)
    : 0;
  const kpi = resolverEstadoGlobal(porcentaje);

  return {
    total: formatearHoras(totalHoras),
    segmentos: segmentosCompuestos,
    planeadasDisponibles,
    kpiDisponible,
    porcentaje,
    estadoSprint: kpi.estado,
    estadoColor: kpi.color,
    estadoBg: kpi.bg,
  };
}

export const SPRINT_SYSTEM_PROMPT = `Eres un extractor de datos para resumen de Sprint v2. Recibes Markdown de un sprint y debes devolver solo un objeto estructurado para el esquema indicado.

Reglas:
- Identifica sprintName, dateStart, dateEnd y weekNumber desde el documento. Usa strings cortos. sprintName debe incluir el año al final, por ejemplo "1 JUNIO-JULIO 2026".
- El documento incluye un campo "tiempoVerbal" (Futuro o Pasado) que indica en que tiempo verbal debes redactar TODO el texto narrativo (el "objetivo" y "desviaciones.logrado/motivo" de cada member, equipo.quien/cuando/donde/como, riesgoTransversal.texto/mitigacion y riesgoTransversalResultado). Si es "Pasado", escribe como si el sprint ya hubiera ocurrido ("se implemento", "se resolvio", "se trabajo en") -- para riesgoTransversal.texto/mitigacion en particular, describe tambien el riesgo en pasado, como algo que existia o podia pasar durante el sprint, nunca en presente/subjuntivo (ej. "el riesgo era que aparecieran incidencias que consumieran las horas reservadas" en vez de "el riesgo es que aparezcan incidencias"; "ese tiempo ya estaba reservado" en vez de "ya esta reservado"). Si es "Futuro", escribe en futuro o presente proyectivo, como si el sprint todavia no ocurriera y se estuviera planificando ("se implementara", "se resolvera", "se trabajara en"). Todo documento que describa resultados reales del sprint (issues ya completados/cancelados, un cierre real -- el tipo de documento usado para los resumenes finales, ver "riesgoTransversalResultado" mas abajo) debe traer tiempoVerbal "Pasado"; nunca mezcles tiempos verbales dentro del mismo documento.
- Agrupa el trabajo por members, luego por projects, luego por issues.
- Cada issue puede incluir, ademas del titulo, una "Descripcion" y una lista de "Comentarios" tomados de Linear: usalos como fuente principal de contexto real (que se hizo o se planea hacer, que se decidio, que bloqueos hubo) al redactar objetivo/desviaciones/equipo/riesgoTransversal. No te bases solo en el titulo del issue si hay descripcion o comentarios disponibles.
- Cada member debe tener ademas un campo "objetivo": un resumen, en lenguaje simple, de en que se enfoco esa persona durante el sprint. Debe tener EXACTAMENTE entre 480 y 500 caracteres, contando espacios. Si el contenido disponible es mas corto, amplialo con detalle real del documento (no relleno generico) hasta llegar al rango; si es mas largo, resume sin perder los puntos mas importantes hasta caer dentro del rango.
- Cada member debe tener tambien un bloque "desviaciones" (usado en el resumen final del sprint) propio de ESA persona, no del sprint completo, con: logrado (respuesta transparente a "esta persona logro lo que tenia planificado?": si o no y por que, comparando SUS issues planeados con lo que realmente completo, lenguaje simple, 180-230 caracteres) y motivo (justifica el desfase de horas planeadas vs reales en relacion con los issues logrados: por que se le agregaron issues no planeados y/o le quedaron planeados sin completar, y como eso explica que dedicara mas o menos horas a Proyectos de lo planeado; 100-140 caracteres). El objetivo es explicar las desviaciones de alcance y de horas de esa persona, no medir si trabajo o no. Las horas planeadas por persona son fijas cada semana: 3.5h de reuniones y 3h de incidencias, y Proyectos es el resto de su capacidad (personalizaciones solo si la semana las incluye); si sus horas reales de Proyectos difieren de las planeadas, di que lo causo (p.ej. incidencias o issues agregados que consumieron tiempo). Basate en los issues de ESE member con agregado=false vs agregado=true y sus estados; si el documento no lo menciona explicitamente, infierelo de ese conteo.
- Cada issue debe tener title, type, priority, status y agregado.
- type solo puede ser Bug, Feature o Improvement.
- priority solo puede ser Urgent, High, Medium o Low.
- status solo puede ser Todo, In Progress, In Review, Done o Cancelled.
- agregado es un booleano: true si el issue se agrego durante el sprint (no estaba planeado al inicio), false si estaba planeado desde el inicio. Si el documento no lo indica explicitamente, usa false.
- Usa initials de 2 a 3 letras en mayusculas.
- Ademas, devuelve un bloque "equipo" con: quien (quien ejecuta el sprint, menciona solo a los miembros con trabajo asignado, 60-90 caracteres), cuando (ventana de tiempo del sprint, 30-50 caracteres), donde (entornos y canales donde corre el trabajo, 50-80 caracteres) y como (stack tecnico usado, 40-70 caracteres).
- Y un bloque "riesgoTransversal" con: texto (el riesgo transversal de un sprint es siempre el mismo tipo: que aparezcan incidencias no planeadas durante el sprint que consuman las horas reservadas para el segmento "Incidencias" del bloque horas, afectando el avance de los issues planeados de Proyectos. Redactalo en lenguaje simple, sin jerga tecnica y sin citar cifras exactas, 180-230 caracteres) y mitigacion (explica que esas horas de Incidencias ya estan reservadas de antemano como colchon, precisamente para poder absorber ese riesgo sin afectar lo planeado, 100-140 caracteres).
- "riesgoTransversalResultado" (opcional, string en lenguaje simple, sin jerga tecnica): inclúyelo SIEMPRE que "tiempoVerbal" sea "Pasado" -- no lo omitas en ese caso. Solo omite este campo por completo si "tiempoVerbal" es "Futuro" (un plan sin resultados reales todavia). Cuando "tiempoVerbal" sea "Pasado", escribe UNA sola frase que diga si entraron incidencias no planeadas que consumieran el colchon de horas reservado para el segmento "Incidencias", o si no entro ninguna -- basate en las horas reales de Incidencias vs. lo reservado si el documento lo menciona, o en el criterio general si no lo menciona. NO incluyas cifras de issues planeados/agregados/completados en este campo: esos numeros se calculan aparte en codigo a partir de los issues que ya extrajiste, y se agregan automaticamente despues de tu frase -- si intentas contarlos tu mismo es facil que te equivoques. Ejemplos: "No entraron incidencias que consumieran el colchon reservado." o "Entraron incidencias que consumieron parte del colchon reservado, aunque no afectaron el avance de los issues planeados." Entre 40 y 120 caracteres, contando espacios.
- Si el documento no menciona explicitamente el bloque de equipo (quien/cuando/donde/como), infierelo a partir del conjunto de members y projects de la forma mas razonable y concreta posible, respetando los mismos rangos de caracteres.
- "porcentajeCompletado": numero entero de 0 a 100, el porcentaje de issues con status Done sobre el total de issues del sprint.
- "estadoSprint": resultado del sprint segun porcentajeCompletado. Solo dos valores posibles: CUMPLIDO si es 90 o mas, NO CUMPLIDO si es menor a 90.
- "horas": un bloque con "segmentos" (array), cada uno con "nombre" y "horas" (numero). Esto es la distribucion de tiempo del equipo, NO se extrae normalmente del documento de issues. Salvo que el documento indique explicitamente otra distribucion, usa siempre estos 3 segmentos por defecto: {"nombre":"Proyectos (3 objetivos)","horas":94.4}, {"nombre":"Reuniones","horas":9.6}, {"nombre":"Incidencias","horas":16}. (Personalizaciones y Team building estan ocultos temporalmente: sus horas ya se redistribuyeron proporcionalmente en Proyectos e Incidencias; no los incluyas salvo que el documento los mencione explicitamente).
- "horasPlaneadas" (opcional, puede venir en cualquier segmento): son las horas que se habian planeado para ese segmento (reuniones e incidencias son fijas por persona, Proyectos es el resto de la capacidad). NO lo completes: lo agrega la integracion (n8n desde el Sheet) despues de la extraccion, no se infiere del markdown.
- Cada member puede tener opcionalmente un bloque "horas" con el mismo formato que el "horas" del documento (segmentos con nombre/horas/horasPlaneadas), pero con las horas dedicadas por ESA persona. NO lo completes salvo que el documento lo indique explicitamente: igual que horasPlaneadas, normalmente se agrega despues a mano o por integracion.
- No agregues datos que no esten en el documento; si un estado o prioridad no aparece, infiere el valor mas prudente desde el contexto.`;

export function componerDatosSprint(datosExtraidos: SprintData) {
  const members = datosExtraidos.members.map((member, indice) => {
    const projects = member.projects.map((project) => ({
      ...project,
      issues: project.issues.map((issue) => {
        const agregadoTag = issue.agregado ? AGREGADO_TAG_CFG.true : AGREGADO_TAG_CFG.false;
        return {
          ...issue,
          typeColor: TYPE_CFG[issue.type].color,
          typeBg: TYPE_CFG[issue.type].bg,
          typeIcon: TYPE_CFG[issue.type].icon,
          priorityColor: PRI_CFG[issue.priority].color,
          priorityIcon: PRI_CFG[issue.priority].icon,
          statusColor: STA_CFG[issue.status].color,
          statusBg: STA_CFG[issue.status].bg,
          statusIcon: STA_CFG[issue.status].icon,
          agregadoLabel: agregadoTag.label,
          agregadoColor: agregadoTag.color,
          agregadoBg: agregadoTag.bg,
          agregadoIcon: agregadoTag.icon,
        };
      }),
    }));

    const allIssues = projects.flatMap((project) => project.issues);
    const totalIssues = allIssues.length;
    const planeados = allIssues.filter((issue) => !issue.agregado).length;
    const agregados = totalIssues - planeados;
    const estadoConteos = ESTADO_DONUT_CFG.map((cfg) => ({
      ...cfg,
      valor: allIssues.filter(
        (issue) => STATUS_TO_BUCKET[issue.status] === cfg.key,
      ).length,
    }));
    // Version sin las categorias siempre-en-0 (ver ESTADO_DONUT_KEYS_V3) -- solo
    // la usa template-resumen-v3.
    const estadoConteosV3 = estadoConteos.filter((cfg) =>
      ESTADO_DONUT_KEYS_V3.includes(cfg.key),
    );
    // Issues que estaban planeados (agregado=false) y no llegaron a Done al
    // cierre del sprint -- dato retrospectivo, no requiere campo nuevo en el
    // schema. Cancelled queda afuera: cancelar es una decision explicita, no
    // un pendiente sin resolver. Solo lo usa template-resumen-v3.
    const vencidos = allIssues.filter(
      (issue) => !issue.agregado && issue.status !== "Done" && issue.status !== "Cancelled",
    );
    const paleta = asignarPaleta(indice);
    const horasMiembro = member.horas
      ? construirBloqueHoras(member.horas.segmentos)
      : undefined;

    return {
      ...member,
      name: aTituloCase(member.name),
      accentColor: "#00B5A3",
      accentBg: "rgba(0,181,163,0.12)",
      nameColor: "#16213D",
      totalIssues,
      projectCount: projects.length,
      projects,
      vencidos,
      horas: horasMiembro,
      icono: paleta.icono,
      colorAccent: paleta.colorAccent,
      colorBgIcon: paleta.colorBgIcon,
      colorBgBadge: paleta.colorBgBadge,
      planeados,
      agregados,
      planColor: PLAN_AGREGADO_CFG.planeados,
      agregadoColor: PLAN_AGREGADO_CFG.agregados,
      planGradient: construirGradiente(
        [
          { color: PLAN_AGREGADO_CFG.planeados, valor: planeados },
          { color: PLAN_AGREGADO_CFG.agregados, valor: agregados },
        ],
        totalIssues,
      ),
      estadoConteos,
      estadoConteosV3,
      estadoGradient: construirGradiente(
        estadoConteos.map((cfg) => ({ color: cfg.color, valor: cfg.valor })),
        totalIssues,
      ),
    };
  });

  // Bloque de horas del documento (equipo completo); incluye el KPI de horas
  // reales/planeadas del segmento "Proyectos" si el documento trae horasPlaneadas.
  const horas = construirBloqueHoras(datosExtraidos.horas.segmentos);

  // KPIs a nivel documento para template-resumen-v2: dos porcentajes/estados
  // independientes calculados sobre todos los issues del sprint segun `agregado`.
  const todosLosIssues = datosExtraidos.members.flatMap((member) =>
    member.projects.flatMap((project) => project.issues),
  );
  const planKpi = calcularKpiCompletado(
    todosLosIssues.filter((issue) => !issue.agregado),
  );
  const agregadoKpi = calcularKpiCompletado(
    todosLosIssues.filter((issue) => issue.agregado),
  );
  // KPI global de planeacion: total de issues Done (planeados + agregados) sobre
  // los planeados. Supera el 100% cuando se completan agregados. Base = planeados.
  const planeadosTotal = todosLosIssues.filter((issue) => !issue.agregado).length;
  const totalDone = todosLosIssues.filter((issue) => issue.status === "Done").length;
  const globalPorcentaje =
    planeadosTotal > 0 ? Math.round((totalDone / planeadosTotal) * 100) : 0;
  const globalKpi = resolverEstadoGlobal(globalPorcentaje);

  // Cifras del cierre para riesgoTransversalResultado: se calculan aqui, nunca se
  // confian al conteo del LLM (vino "20 de los 20" cuando en realidad eran 15
  // planeados -- el LLM solo redacta la parte cualitativa sobre el colchon de
  // incidencias, ver SPRINT_SYSTEM_PROMPT).
  const planeadosCompletados = todosLosIssues.filter(
    (issue) => !issue.agregado && issue.status === "Done",
  ).length;
  const agregadosTotalCount = todosLosIssues.length - planeadosTotal;
  const agregadosCompletados = todosLosIssues.filter(
    (issue) => issue.agregado && issue.status === "Done",
  ).length;
  const planeadosPlural = planeadosTotal === 1 ? "" : "s";
  const partePlaneados =
    planeadosCompletados === planeadosTotal
      ? `completó todos los ${planeadosTotal} issue${planeadosPlural} planeado${planeadosPlural}`
      : `completó ${planeadosCompletados} de los ${planeadosTotal} issue${planeadosPlural} planeado${planeadosPlural}`;

  let parteAgregados = "";
  if (agregadosTotalCount > 0) {
    const agregadosPlural = agregadosTotalCount === 1 ? "" : "s";
    if (agregadosCompletados === agregadosTotalCount) {
      parteAgregados =
        agregadosTotalCount === 1
          ? " y, gracias al avance más rápido de lo esperado, sumó 1 issue agregado, el cual también fue completado"
          : ` y, gracias al avance más rápido de lo esperado, sumó ${agregadosTotalCount} issues agregados, los cuales también fueron completados`;
    } else {
      parteAgregados = ` y, gracias al avance más rápido de lo esperado, sumó ${agregadosTotalCount} issue${agregadosPlural} agregado${agregadosPlural}, de los cuales completó ${agregadosCompletados}`;
    }
  }
  const resumenNumericoCierre = `El equipo ${partePlaneados}${parteAgregados}.`;
  const riesgoTransversalResultado = datosExtraidos.riesgoTransversalResultado
    ? `${datosExtraidos.riesgoTransversalResultado} ${resumenNumericoCierre}`
    : datosExtraidos.riesgoTransversalResultado;

  // Semaforos unificados (ÓPTIMO/ACEPTABLE/DESVIADO) de Planeados/Agregados y
  // salud general del sprint -- exclusivos de template-resumen-v3 (ver
  // resolverEstadoCompletado). El resto de campos de arriba (planEstadoSprint,
  // agregadoEstadoSprint, etc., vocabulario CUMPLIDO/NO CUMPLIDO) se quedan
  // sin cambios para resumen/resumen-v2.
  const planKpiV3 = resolverEstadoCompletado(planKpi.porcentaje);
  const agregadoKpiV3 = resolverEstadoCompletado(agregadoKpi.porcentaje);
  const estadosParaSalud = [planKpiV3.estado, agregadoKpiV3.estado, globalKpi.estado];
  if (horas.kpiDisponible) estadosParaSalud.push(horas.estadoSprint);
  const saludEstado = estadosParaSalud.reduce((peor, actual) =>
    SEVERIDAD_ESTADO[actual] > SEVERIDAD_ESTADO[peor] ? actual : peor,
  ) as keyof typeof ESTADO_GLOBAL_CFG;
  const saludCfg = ESTADO_GLOBAL_CFG[saludEstado];

  // Tendencia + proyeccion (Fase 3, exclusivo de template-resumen-v3): lee el
  // historico local (backend/data/sprint-historico.json, ver historico.ts) --
  // solo lectura, nunca escribe, asi que es seguro tambien para /preview. Se
  // excluye el sprint actual del historico por si ya estaba registrado (evita
  // que se compare contra si mismo). No hay pronostico de "fecha de cierre de
  // la epica": el schema de Sprint no trackea alcance total de la epica, asi
  // que la proyeccion es solo tendencia del % global contra el promedio de los
  // ultimos sprints, no una fecha estimada de entrega.
  const historicoPrevio = leerHistorico()
    .filter(
      (h) =>
        !(h.sprintName === datosExtraidos.sprintName && h.weekNumber === datosExtraidos.weekNumber),
    )
    .sort((a, b) => a.registradoEn.localeCompare(b.registradoEn))
    .slice(-3);
  const tendenciaDisponible = historicoPrevio.length > 0;
  const tendencia = [
    ...historicoPrevio.map((entrada) => ({
      weekNumber: entrada.weekNumber,
      globalPorcentaje: entrada.globalPorcentaje,
      ...resolverEstadoGlobal(entrada.globalPorcentaje),
      esActual: false,
    })),
    {
      weekNumber: datosExtraidos.weekNumber,
      globalPorcentaje,
      ...globalKpi,
      esActual: true,
    },
  ];
  let proyeccion:
    | { promedioGlobal: number; direccion: string; color: string; bg: string }
    | undefined;
  if (tendenciaDisponible) {
    const promedioGlobal = Math.round(
      historicoPrevio.reduce((suma, entrada) => suma + entrada.globalPorcentaje, 0) /
        historicoPrevio.length,
    );
    const diferencia = globalPorcentaje - promedioGlobal;
    let direccion: string;
    let colorDireccion: string;
    let bgDireccion: string;
    if (diferencia > 5) {
      direccion = "MEJORANDO";
      colorDireccion = ESTADO_GLOBAL_CFG.ÓPTIMO.color;
      bgDireccion = ESTADO_GLOBAL_CFG.ÓPTIMO.bg;
    } else if (diferencia < -5) {
      direccion = "EMPEORANDO";
      colorDireccion = ESTADO_GLOBAL_CFG.DESVIADO.color;
      bgDireccion = ESTADO_GLOBAL_CFG.DESVIADO.bg;
    } else {
      direccion = "ESTABLE";
      colorDireccion = ESTADO_GLOBAL_CFG.ACEPTABLE.color;
      bgDireccion = ESTADO_GLOBAL_CFG.ACEPTABLE.bg;
    }
    proyeccion = { promedioGlobal, direccion, color: colorDireccion, bg: bgDireccion };
  }

  return {
    ...datosExtraidos,
    riesgoTransversalResultado,
    horas,
    teamSize: String(members.length),
    members,
    planPorcentajeCompletado: planKpi.porcentaje,
    planEstadoSprint: planKpi.estado,
    planEstadoColor: planKpi.color,
    planEstadoBg: planKpi.bg,
    planEstadoV3: planKpiV3.estado,
    planEstadoColorV3: planKpiV3.color,
    planEstadoBgV3: planKpiV3.bg,
    agregadoPorcentajeCompletado: agregadoKpi.porcentaje,
    agregadoEstadoSprint: agregadoKpi.estado,
    agregadoEstadoColor: agregadoKpi.color,
    agregadoEstadoBg: agregadoKpi.bg,
    agregadoEstadoV3: agregadoKpiV3.estado,
    agregadoEstadoColorV3: agregadoKpiV3.color,
    agregadoEstadoBgV3: agregadoKpiV3.bg,
    globalPorcentaje: globalPorcentaje,
    globalEstadoSprint: globalKpi.estado,
    globalEstadoColor: globalKpi.color,
    globalEstadoBg: globalKpi.bg,
    saludEstado,
    saludColor: saludCfg.color,
    saludBg: saludCfg.bg,
    tendenciaDisponible,
    tendencia,
    proyeccion,
    typeLegend: [
      { label: "Bug", icon: TYPE_CFG.Bug.icon, color: TYPE_CFG.Bug.color, bg: TYPE_CFG.Bug.bg },
      { label: "Feature", icon: TYPE_CFG.Feature.icon, color: TYPE_CFG.Feature.color, bg: TYPE_CFG.Feature.bg },
      { label: "Improvement", icon: TYPE_CFG.Improvement.icon, color: TYPE_CFG.Improvement.color, bg: TYPE_CFG.Improvement.bg },
    ],
  };
}

export const sprintConfig: DocumentConfig<SprintData> = {
  id: "sprint",
  schema: SprintSchema,
  systemPrompt: SPRINT_SYSTEM_PROMPT,
  componerDatos: componerDatosSprint,
  templates: {
    detail: {
      path: path.join(__dirname, "template-detail.html"),
      pdf: { width: "900px", height: "1188px" },
    },
    "resumen-inicio": {
      path: path.join(__dirname, "template-resumen-inicio.html"),
      pdf: { width: "1240px", height: "1050px" },
    },
    resumen: {
      path: path.join(__dirname, "template-resumen.html"),
      pdf: { width: "1240px", height: "1050px" },
    },
    "resumen-v2": {
      path: path.join(__dirname, "template-resumen-v2.html"),
      pdf: { width: "1240px", height: "1050px" },
    },
    "resumen-v3": {
      path: path.join(__dirname, "template-resumen-v3.html"),
      pdf: { width: "1240px", height: "1050px" },
    },
  },
  defaultTemplate: "detail",
};
