import path from "path";
import { z } from "zod";
import { asignarPaleta, construirGradiente, formatearHoras } from "../../constants";
import { DocumentConfig } from "../types";

// Schema deliberadamente minimo: solo los campos que template-resumen-inicio.html
// renderiza hoy. A diferencia de SprintFinSchema (documents/sprint-fin/config.ts),
// este NO tiene agregado por issue, desviaciones por miembro, riesgoTransversalResultado,
// estadoSprint/porcentajeCompletado a nivel de documento, horasPlaneadas por segmento,
// horas individuales por miembro, ni type/priority por issue -- ninguno de esos
// conceptos aplica a un sprint que todavia no arranco (ver conversacion de partición
// 2026-07-25: en el arranque TODO es lo planeado, no hay "antes/despues" de un corte,
// no hay desviacion posible todavia, y el template nunca los muestra).
export const IssueStatusSchema = z.enum([
  "Todo",
  "In Progress",
  "In Review",
  "Done",
  "Cancelled",
]);

// Rangos de min()/max() de este schema: no son los rangos "objetivo" que pide
// SPRINT_INICIO_SYSTEM_PROMPT tal cual (ej. objetivo pide EXACTAMENTE 480-500),
// sino ese mismo rango con un margen de tolerancia (-30 en el piso, +20 en el
// techo) para no fallar la extraccion por errores de conteo de 1-2 caracteres
// del LLM (los LLM no cuentan caracteres con precision). El objetivo real que
// se le pide al modelo sigue siendo el rango exacto del prompt; el schema solo
// atrapa los casos claramente fuera de rango (un objetivo de 10 caracteres,
// uno de 900), no exige perfeccion. Ver extractor.service.ts: si el LLM cae
// fuera de este margen, se reintenta hasta 3 veces con el motivo exacto antes
// de fallar la extraccion.
export const SprintInicioSchema = z.object({
  sprintName: z
    .string()
    .regex(/\d{4}$/, 'sprintName debe terminar en un año de 4 dígitos, ej. "1 JUNIO-JULIO 2026"')
    .toUpperCase(),
  dateStart: z.string(),
  dateEnd: z.string(),
  weekNumber: z.string(),
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
      // 2 letras mayusculas (primer nombre, primer apellido) -- mismo formato
      // que ya exige sprint-fin, ver regla en SPRINT_INICIO_SYSTEM_PROMPT.
      initials: z.string().regex(/^[A-Z]{2}$/, "initials debe ser exactamente 2 letras mayúsculas"),
      // Prompt pide EXACTAMENTE 480-500 -- margen de tolerancia -30/+20.
      objetivo: z.string().min(450).max(520),
      projects: z.array(
        z.object({
          name: z.string(),
          issues: z.array(
            z.object({
              title: z.string().min(1),
              status: IssueStatusSchema,
            }),
          ).min(1),
        }),
      ).min(1),
    }),
  ).min(1),
  equipo: z.object({
    // Prompt pide 60-90 -- margen -30/+20.
    quien: z.string().min(30).max(110),
    // Prompt pide 30-50 -- margen -20/+20 (el piso de -30 daria 0, sin sentido).
    cuando: z.string().min(10).max(70),
    // Prompt pide 50-80 -- margen -30/+20.
    donde: z.string().min(20).max(100),
    // Prompt pide 40-70 -- margen -30/+20.
    como: z.string().min(10).max(90),
  }),
  riesgoTransversal: z.object({
    // Prompt pide 180-230 -- margen -30/+20.
    texto: z.string().min(150).max(250),
    // Prompt pide 100-140 -- margen -30/+20.
    mitigacion: z.string().min(70).max(160),
  }),
});

export type SprintInicioData = z.infer<typeof SprintInicioSchema>;

// Las 9 categorias de estado estilo Linear que muestra el donut "Por estado" de
// template-resumen-inicio.html. Mismo set que sprint-fin (Triage/Bloqueado/
// Duplicado/Backlog quedan en 0 hasta que el esquema los soporte).
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

const STATUS_TO_BUCKET: Record<string, string> = {
  Todo: "Todo",
  "In Progress": "En progreso",
  "In Review": "En revisión",
  Done: "Completado",
  Cancelled: "Cancelado",
};

// Colores ciclicos para los segmentos del bloque "horas" (orden de aparicion en el JSON).
const COLORES_HORAS = ["#0b1430", "#94a3c4", "#e08a2e", "#8b5cf6", "#ec4899"];

function aTituloCase(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter((palabra) => palabra.length > 0)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(" ");
}

// Version simplificada de construirBloqueHoras (sprint-fin/config.ts): sin
// horasPlaneadas ni el KPI de horas real/planeada -- resumen-inicio siempre
// muestra el badge fijo "ESTIMADO", nunca compara contra un plan.
function construirBloqueHoras(segmentos: { nombre: string; horas: number }[]) {
  const totalHoras = segmentos.reduce((suma, segmento) => suma + segmento.horas, 0);
  const segmentosCompuestos = segmentos.map((segmento, indice) => ({
    nombre: segmento.nombre,
    horas: formatearHoras(segmento.horas),
    pct: totalHoras > 0 ? Math.round((segmento.horas / totalHoras) * 100) : 0,
    color: COLORES_HORAS[indice % COLORES_HORAS.length],
    mostrarPct: indice === 0,
  }));

  return {
    total: formatearHoras(totalHoras),
    segmentos: segmentosCompuestos,
  };
}

export const SPRINT_INICIO_SYSTEM_PROMPT = `Eres un extractor de datos para el resumen de INICIO de un Sprint (planning). Recibes Markdown de un sprint que todavia no ocurrio y debes devolver solo un objeto estructurado para el esquema indicado. Todo el texto narrativo se redacta siempre en futuro o presente proyectivo -- el sprint todavia no ocurre, se esta planificando ("se implementara", "se resolvera", "se trabajara en") -- nunca en pasado.

Reglas:
- Identifica sprintName, dateStart, dateEnd y weekNumber desde el documento. Usa strings cortos. sprintName debe incluir el año al final, por ejemplo "1 JUNIO-JULIO 2026".
- Agrupa el trabajo por members, luego por projects, luego por issues.
- Cada issue puede incluir, ademas del titulo, una "Descripcion" y una lista de "Comentarios" tomados de Linear: usalos como fuente principal de contexto real al redactar objetivo/equipo/riesgoTransversal. No te bases solo en el titulo del issue si hay descripcion o comentarios disponibles.
- Cada member debe tener un campo "objetivo": un resumen, en lenguaje simple, de en que se va a enfocar esa persona durante el sprint. Debe tener EXACTAMENTE entre 480 y 500 caracteres, contando espacios. Si el contenido disponible es mas corto, amplialo con detalle real del documento (no relleno generico) hasta llegar al rango; si es mas largo, resume sin perder los puntos mas importantes hasta caer dentro del rango.
- Cada issue debe tener title y status.
- status solo puede ser Todo, In Progress, In Review, Done o Cancelled -- al inicio del sprint casi todos deberian ser Todo, salvo que el documento indique explicitamente que alguno ya arranco o viene de antes.
- Usa initials de exactamente 2 letras en mayusculas (primera letra del primer nombre + primera letra del primer apellido, ej. "Luis Cantillo" -> "LC").
- Ademas, devuelve un bloque "equipo" con: quien (quien ejecuta el sprint, menciona solo a los miembros con trabajo asignado, 60-90 caracteres), cuando (ventana de tiempo del sprint, 30-50 caracteres), donde (entornos y canales donde va a correr el trabajo, 50-80 caracteres) y como (stack tecnico a usar, 40-70 caracteres).
- Y un bloque "riesgoTransversal" con: texto (el riesgo transversal de un sprint es siempre el mismo tipo: que aparezcan incidencias no planeadas durante el sprint que consuman las horas reservadas para el segmento "Incidencias" del bloque horas, afectando el avance de los issues planeados de Proyectos. Redactalo en lenguaje simple, sin jerga tecnica y sin citar cifras exactas, 180-230 caracteres) y mitigacion (explica que esas horas de Incidencias ya estan reservadas de antemano como colchon, precisamente para poder absorber ese riesgo sin afectar lo planeado, 100-140 caracteres).
- Si el documento no menciona explicitamente el bloque de equipo (quien/cuando/donde/como), infierelo a partir del conjunto de members y projects de la forma mas razonable y concreta posible, respetando los mismos rangos de caracteres.
- "horas": un bloque con "segmentos" (array), cada uno con "nombre" y "horas" (numero). Esto es la distribucion de tiempo estimada del equipo, NO se extrae normalmente del documento de issues. Salvo que el documento indique explicitamente otra distribucion, usa siempre estos 3 segmentos por defecto: {"nombre":"Proyectos (3 objetivos)","horas":94.4}, {"nombre":"Reuniones","horas":9.6}, {"nombre":"Incidencias","horas":16}.
- No agregues datos que no esten en el documento; si un estado no aparece, usa "Todo".`;

export function componerDatosInicio(datosExtraidos: SprintInicioData) {
  const members = datosExtraidos.members.map((member, indice) => {
    const allIssues = member.projects.flatMap((project) => project.issues);
    const totalIssues = allIssues.length;
    const estadoConteos = ESTADO_DONUT_CFG.map((cfg) => ({
      ...cfg,
      valor: allIssues.filter((issue) => STATUS_TO_BUCKET[issue.status] === cfg.key).length,
    }));
    const paleta = asignarPaleta(indice);

    return {
      ...member,
      name: aTituloCase(member.name),
      accentColor: "#00B5A3",
      accentBg: "rgba(0,181,163,0.12)",
      nameColor: "#16213D",
      totalIssues,
      projectCount: member.projects.length,
      icono: paleta.icono,
      colorAccent: paleta.colorAccent,
      colorBgIcon: paleta.colorBgIcon,
      colorBgBadge: paleta.colorBgBadge,
      estadoConteos,
      estadoGradient: construirGradiente(
        estadoConteos.map((cfg) => ({ color: cfg.color, valor: cfg.valor })),
        totalIssues,
      ),
    };
  });

  return {
    ...datosExtraidos,
    teamSize: String(members.length),
    members,
    horas: construirBloqueHoras(datosExtraidos.horas.segmentos),
  };
}

export const sprintInicioConfig: DocumentConfig<SprintInicioData> = {
  id: "sprint-inicio",
  schema: SprintInicioSchema,
  systemPrompt: SPRINT_INICIO_SYSTEM_PROMPT,
  componerDatos: componerDatosInicio,
  templates: {
    "resumen-inicio": {
      path: path.join(__dirname, "template-resumen-inicio.html"),
      pdf: { width: "1240px", height: "1050px" },
    },
  },
  defaultTemplate: "resumen-inicio",
};
