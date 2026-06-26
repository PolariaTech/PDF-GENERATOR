import path from "path";
import { z } from "zod";
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
  sprintName: z.string(),
  dateStart: z.string(),
  dateEnd: z.string(),
  weekNumber: z.string(),
  members: z.array(
    z.object({
      name: z.string(),
      initials: z.string(),
      projects: z.array(
        z.object({
          name: z.string(),
          issues: z.array(
            z.object({
              title: z.string(),
              type: IssueTypeSchema,
              priority: IssuePrioritySchema,
              status: IssueStatusSchema,
            }),
          ),
        }),
      ),
    }),
  ).min(1),
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

const STA_CFG = {
  Todo: { color: "#64748B", bg: "#F1F5F9" },
  "In Progress": { color: "#1D4ED8", bg: "#DBEAFE" },
  "In Review": { color: "#92400E", bg: "#FEF3C7" },
  Done: { color: "#065F46", bg: "#D1FAE5" },
  Cancelled: { color: "#991B1B", bg: "#FEE2E2" },
} as const;

export const SPRINT_SYSTEM_PROMPT = `Eres un extractor de datos para resumen de Sprint v2. Recibes Markdown de un sprint y debes devolver solo un objeto estructurado para el esquema indicado.

Reglas:
- Identifica sprintName, dateStart, dateEnd y weekNumber desde el documento. Usa strings cortos.
- Agrupa el trabajo por members, luego por projects, luego por issues.
- Cada issue debe tener title, type, priority y status.
- type solo puede ser Bug, Feature o Improvement.
- priority solo puede ser Urgent, High, Medium o Low.
- status solo puede ser Todo, In Progress, In Review, Done o Cancelled.
- Usa initials de 2 a 3 letras en mayusculas.
- No agregues datos que no esten en el documento; si un estado o prioridad no aparece, infiere el valor mas prudente desde el contexto.`;

export function componerDatosSprint(datosExtraidos: SprintData) {
  const members = datosExtraidos.members.map((member) => {
    const projects = member.projects.map((project) => ({
      ...project,
      issues: project.issues.map((issue) => ({
        ...issue,
        typeColor: TYPE_CFG[issue.type].color,
        typeBg: TYPE_CFG[issue.type].bg,
        typeIcon: TYPE_CFG[issue.type].icon,
        priorityColor: PRI_CFG[issue.priority].color,
        priorityIcon: PRI_CFG[issue.priority].icon,
        statusColor: STA_CFG[issue.status].color,
        statusBg: STA_CFG[issue.status].bg,
      })),
    }));

    return {
      ...member,
      accentColor: "#00B5A3",
      accentBg: "rgba(0,181,163,0.12)",
      nameColor: "#16213D",
      totalIssues: projects.reduce(
        (total, project) => total + project.issues.length,
        0,
      ),
      projectCount: projects.length,
      projects,
    };
  });

  return {
    ...datosExtraidos,
    teamSize: String(members.length),
    members,
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
  templatePath: path.join(__dirname, "template.html"),
  pdf: {
    width: "840px",
    height: "1188px",
  },
};
