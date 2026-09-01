import { z } from "zod";
import { PRECIO_GPT54MINI, verificarMiembrosCompletos } from "../../constants";
import { equipoSchema, objetivoSchema, riesgoTransversalSchema } from "./config";

// Contrato de POST /api/sprint-inicio/narrativa (narrativa.routes.ts): input y
// output acotados EXACTAMENTE a los 3 campos que necesitan IA en el resumen de
// inicio de sprint (objetivo por miembro, equipo, riesgoTransversal) -- todo lo
// demas (members/projects/issues/horas/fechas/personalizacion) ya lo arma
// deterministicamente el workflow de n8n antes de llamar aca. Ver
// docs/adr para el detalle de por que se separo de SprintInicioSchema/`/extraer`
// en vez de reusar el endpoint generico.

// "resumenIssues" ya viene condensado por n8n (nodo "Resumir Contexto del
// Issue", un AI Agent chico que resume descripcion+comentarios de Linear por
// issue) -- ese paso se queda en n8n a proposito, no se duplica aca. Este
// endpoint nunca ve descripcion/comentarios crudos.
export const SprintInicioNarrativaInputSchema = z.object({
  members: z
    .array(
      z.object({
        name: z.string().min(1),
        resumenIssues: z.string().min(1),
      }),
    )
    .min(1),
});

export type SprintInicioNarrativaInput = z.infer<typeof SprintInicioNarrativaInputSchema>;

export const SprintInicioNarrativaOutputSchema = z.object({
  members: z
    .array(
      z.object({
        name: z.string().min(1),
        objetivo: objetivoSchema,
      }),
    )
    .min(1),
  equipo: equipoSchema,
  riesgoTransversal: riesgoTransversalSchema,
});

export type SprintInicioNarrativaData = z.infer<typeof SprintInicioNarrativaOutputSchema>;

// Mismo formato "### <name>\n<resumenIssues>" que hoy arma a mano el nodo
// "Preparar Body OpenAI" del workflow de n8n -- se preserva para no cambiar lo
// que la IA ve, y porque verificarMiembrosCompletos (constants.ts) ya sabe
// extraer nombres esperados de headings "### " en el texto que se le pasa como
// `markdown` a extraer().
export function construirMensajeNarrativa(input: SprintInicioNarrativaInput): string {
  const cuerpo = input.members
    .map((member) => `### ${member.name}\n${member.resumenIssues}`)
    .join("\n\n");
  return `Miembros y sus resumenes de issues:\n\n${cuerpo}`;
}

// Adaptado del prompt que hoy vive hardcodeado en el nodo "Preparar Body
// OpenAI" del workflow de n8n (mismos rangos exactos, misma regla de apodos)
// -- se preserva el comportamiento de produccion actual. A diferencia de
// SPRINT_INICIO_SYSTEM_PROMPT (config.ts), este prompt no extrae sprintName/
// fechas/status/horas: recibe solo el resumen de issues por miembro y devuelve
// unicamente objetivo/equipo/riesgoTransversal.
export const SPRINT_INICIO_NARRATIVA_SYSTEM_PROMPT = `Eres un redactor especializado en resumenes ejecutivos de planificacion de Sprints (Planning) para Polaria. Recibes, por cada miembro del equipo, un resumen ya condensado de sus issues del sprint. Tu unica funcion es transformar ese texto en un objeto JSON estructurado, cumpliendo rangos de caracteres de forma estricta.

Reglas:
- Extrae informacion unicamente del texto recibido, sin inventar datos.
- Redacta los objetivos en tiempo futuro o presente proyectivo -- el sprint todavia no ocurre, se esta planificando.
- Para "equipo.quien", sustituye los nombres reales por sus apodos: Luis -> Lucho, Mauricio -> Mauro, Daniel -> Dani (cualquier otro nombre: conserva su primer nombre real). En "members[].name" manten el nombre tal cual fue recibido.
- Respeta ESTRICTAMENTE estos rangos de caracteres (contando espacios) para cada campo:
  - members[].objetivo: entre 480 y 500 caracteres.
  - equipo.quien: entre 60 y 90 caracteres.
  - equipo.cuando: entre 30 y 50 caracteres.
  - equipo.donde: entre 50 y 80 caracteres.
  - equipo.como: entre 40 y 70 caracteres.
  - riesgoTransversal.texto: entre 180 y 230 caracteres. Debe describir que pueden aparecer incidencias no planeadas que consuman las horas reservadas del bloque "Incidencias", afectando el avance de los issues planeados de Proyectos. Sin jerga tecnica ni cifras exactas.
  - riesgoTransversal.mitigacion: entre 100 y 140 caracteres. Debe explicar que esas horas de Incidencias ya estan reservadas de antemano como colchon, precisamente para poder absorber ese riesgo sin afectar lo planeado.
- Si un texto queda corto, amplialo con detalle real de los resumenes recibidos (nunca relleno generico); si queda largo, resume sin perder los puntos mas importantes.`;

// DocumentConfig-shaped (subconjunto real, ver ConfigExtraccion en
// extractor.service.ts) para poder llamar extraer() sin modificarlo: se
// hereda gratis el loop de reintentos, la re-validacion con Zod y el calculo
// de costo/uso. verificarCompletitud reusa verificarMiembrosCompletos tal
// cual (mismo chequeo que ya usa sprintInicioConfig) porque el mensaje que
// arma construirMensajeNarrativa tiene el mismo formato "### <name>" que
// espera esa funcion.
export const sprintInicioNarrativaConfig = {
  id: "sprint-inicio-narrativa",
  schema: SprintInicioNarrativaOutputSchema,
  systemPrompt: SPRINT_INICIO_NARRATIVA_SYSTEM_PROMPT,
  precioModelo: PRECIO_GPT54MINI,
  verificarCompletitud: (mensaje: string, datos: SprintInicioNarrativaData) =>
    verificarMiembrosCompletos(mensaje, datos.members),
};
