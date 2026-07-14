import path from "path";
import { z } from "zod";
import { asignarPaleta, formatearHoras } from "../../constants";
import { DocumentConfig } from "../types";

export const IssueTypeSchema = z.enum(["Bug", "Feature", "Improvement"]);
export const IssuePrioritySchema = z.enum(["Urgent", "High", "Medium", "Low"]);
export const IssueStatusSchema = z.enum([
  "Todo",
  "In Progress",
  "In Review",
  "Done",
  "Cancelled",
]);

export const SprintSchema = z.object({
  sprintName: z.string().toUpperCase(),
  dateStart: z.string(),
  dateEnd: z.string(),
  weekNumber: z.string(),
  estadoSprint: z.enum(["CUMPLIDO", "NO CUMPLIDO"]),
  porcentajeCompletado: z.number().min(0).max(100),
  horas: z.object({
    segmentos: z.array(
      z.object({
        nombre: z.string(),
        horas: z.number().nonnegative(),
      }),
    ).min(1),
  }),
  members: z.array(
    z.object({
      name: z.string(),
      initials: z.string(),
      objetivo: z.string().max(600),
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
  // Reemplaza al riesgo transversal en el resumen final (template-resumen-v2):
  // en un sprint cerrado el riesgo ya no aplica, se explican las desviaciones de
  // alcance (planeado vs. realmente hecho). Ver daily 2026-07-07 (Edgar).
  desviaciones: z.object({
    logrado: z.string().max(320),
    motivo: z.string().max(200),
  }),
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

function construirGradiente(
  segmentos: { color: string; valor: number }[],
  total: number,
): string {
  if (total <= 0) {
    return "conic-gradient(#e3e7ef 0% 100%)";
  }
  let acumulado = 0;
  const partes = segmentos
    .filter((seg) => seg.valor > 0)
    .map((seg) => {
      const inicio = (acumulado / total) * 100;
      acumulado += seg.valor;
      const fin = (acumulado / total) * 100;
      return `${seg.color} ${inicio}% ${fin}%`;
    });
  return `conic-gradient(${partes.join(", ")})`;
}

export const SPRINT_SYSTEM_PROMPT = `Eres un extractor de datos para resumen de Sprint v2. Recibes Markdown de un sprint y debes devolver solo un objeto estructurado para el esquema indicado.

Reglas:
- Identifica sprintName, dateStart, dateEnd y weekNumber desde el documento. Usa strings cortos. sprintName debe incluir el año al final, por ejemplo "1 JUNIO-JULIO 2026".
- El documento incluye un campo "tiempoVerbal" (Futuro o Pasado) que indica en que tiempo verbal debes redactar TODO el texto narrativo (el "objetivo" de cada member, equipo.quien/cuando/donde/como, riesgoTransversal.texto/mitigacion y desviaciones.logrado/motivo). Si es "Pasado", escribe como si el sprint ya hubiera ocurrido ("se implemento", "se resolvio", "se trabajo en"). Si es "Futuro", escribe en futuro o presente proyectivo, como si el sprint todavia no ocurriera y se estuviera planificando ("se implementara", "se resolvera", "se trabajara en").
- Agrupa el trabajo por members, luego por projects, luego por issues.
- Cada issue puede incluir, ademas del titulo, una "Descripcion" y una lista de "Comentarios" tomados de Linear: usalos como fuente principal de contexto real (que se hizo o se planea hacer, que se decidio, que bloqueos hubo) al redactar objetivo/equipo/riesgoTransversal/desviaciones. No te bases solo en el titulo del issue si hay descripcion o comentarios disponibles.
- TECNICA OBLIGATORIA para todo campo de texto con un rango de caracteres indicado mas abajo: escribi el texto, despues contalo caracter por caracter (incluyendo espacios) en bloques de 10, y compara el total contra el rango pedido. Apunta siempre al VALOR CENTRAL del rango indicado junto a cada campo, nunca a sus limites superior o inferior — el limite es un margen de seguridad ante tu propio error de conteo, no un objetivo a rozar. Si el conteo no cae dentro del rango, reescribi el texto (ampliando con detalle real o resumiendo sin perder los puntos clave) y volve a contar antes de responder. No entregues un campo sin haber hecho este conteo.
- Cada member debe tener ademas un campo "objetivo": un resumen, en lenguaje simple, de en que se enfoco esa persona durante el sprint. Debe tener entre 430 y 620 caracteres, contando espacios (apunta a unos 525). Si el contenido disponible es mas corto, amplialo con detalle real del documento (no relleno generico) hasta acercarte al valor central; si es mas largo, resume sin perder los puntos mas importantes.
- Cada issue debe tener title, type, priority, status y agregado.
- type solo puede ser Bug, Feature o Improvement.
- priority solo puede ser Urgent, High, Medium o Low.
- status solo puede ser Todo, In Progress, In Review, Done o Cancelled.
- agregado es un booleano: true si el issue se agrego durante el sprint (no estaba planeado al inicio), false si estaba planeado desde el inicio. Si el documento no lo indica explicitamente, usa false.
- Usa initials de 2 a 3 letras en mayusculas.
- Ademas, devuelve un bloque "equipo" con: quien (quien ejecuta el sprint, menciona solo a los miembros con trabajo asignado, 40-100 caracteres, apunta a unos 70), cuando (ventana de tiempo del sprint, 20-60 caracteres, apunta a unos 40), donde (entornos y canales donde corre el trabajo, 35-95 caracteres, apunta a unos 65) y como (stack tecnico usado, 25-85 caracteres, apunta a unos 55).
- Y un bloque "riesgoTransversal" con: texto (el riesgo que afecta a todo el sprint a la vez, en lenguaje simple sin jerga tecnica, 150-330 caracteres, apunta a unos 240) y mitigacion (como se mitiga ese riesgo, 70-220 caracteres, apunta a unos 145).
- Y un bloque "desviaciones" (usado en el resumen final del sprint, donde el riesgo ya no aplica porque el sprint cerro) con: logrado (respuesta transparente a "se logro lo planificado?": si o no y por que, comparando lo planeado con lo realmente hecho, lenguaje simple, 150-330 caracteres, apunta a unos 240) y motivo (por que se agregaron issues no planeados y/o por que quedaron planeados sin completar, 70-190 caracteres, apunta a unos 130). El objetivo es explicar las desviaciones de alcance, no medir si el equipo trabajo. Si el documento no lo menciona, infierelo del conteo de issues planeados (agregado=false) vs agregados (agregado=true) y de sus estados.
- Si el documento no menciona explicitamente el equipo o el riesgo transversal, infierelos a partir del conjunto de members y projects de la forma mas razonable y concreta posible, respetando los mismos rangos de caracteres.
- "porcentajeCompletado": numero entero de 0 a 100, el porcentaje de issues con status Done sobre el total de issues del sprint.
- "estadoSprint": resultado del sprint segun porcentajeCompletado. Solo dos valores posibles: CUMPLIDO si es 90 o mas, NO CUMPLIDO si es menor a 90.
- "horas": un bloque con "segmentos" (array), cada uno con "nombre" y "horas" (numero). Esto es la distribucion de tiempo del equipo, NO se extrae normalmente del documento de issues. Salvo que el documento indique explicitamente otra distribucion, usa siempre estos 3 segmentos por defecto: {"nombre":"Proyectos (3 objetivos)","horas":94.4}, {"nombre":"Reuniones","horas":9.6}, {"nombre":"Incidencias","horas":16}. (Personalizaciones y Team building estan ocultos temporalmente: sus horas ya se redistribuyeron proporcionalmente en Proyectos e Incidencias; no los incluyas salvo que el documento los mencione explicitamente).
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
    const paleta = asignarPaleta(indice);

    return {
      ...member,
      name: aTituloCase(member.name),
      accentColor: "#00B5A3",
      accentBg: "rgba(0,181,163,0.12)",
      nameColor: "#16213D",
      totalIssues,
      projectCount: projects.length,
      projects,
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
      estadoGradient: construirGradiente(
        estadoConteos.map((cfg) => ({ color: cfg.color, valor: cfg.valor })),
        totalIssues,
      ),
    };
  });

  const totalHoras = datosExtraidos.horas.segmentos.reduce(
    (suma, segmento) => suma + segmento.horas,
    0,
  );
  const horas = {
    total: formatearHoras(totalHoras),
    segmentos: datosExtraidos.horas.segmentos.map((segmento, indice) => ({
      nombre: segmento.nombre,
      horas: formatearHoras(segmento.horas),
      pct: totalHoras > 0 ? Math.round((segmento.horas / totalHoras) * 100) : 0,
      color: COLORES_HORAS[indice % COLORES_HORAS.length],
      mostrarPct: indice === 0,
    })),
  };

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

  return {
    ...datosExtraidos,
    horas,
    teamSize: String(members.length),
    members,
    planPorcentajeCompletado: planKpi.porcentaje,
    planEstadoSprint: planKpi.estado,
    planEstadoColor: planKpi.color,
    planEstadoBg: planKpi.bg,
    agregadoPorcentajeCompletado: agregadoKpi.porcentaje,
    agregadoEstadoSprint: agregadoKpi.estado,
    agregadoEstadoColor: agregadoKpi.color,
    agregadoEstadoBg: agregadoKpi.bg,
    globalPorcentaje: globalPorcentaje,
    globalEstadoSprint: globalKpi.estado,
    globalEstadoColor: globalKpi.color,
    globalEstadoBg: globalKpi.bg,
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
  },
  defaultTemplate: "detail",
};
