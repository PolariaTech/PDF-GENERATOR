import { z } from "zod";
import { PRECIO_GPT54MINI, verificarMiembrosCompletos } from "../../constants";
import {
  desviacionesSchema,
  equipoSchema,
  objetivoSchema,
  riesgoTransversalResultadoSchema,
  riesgoTransversalSchema,
} from "./config";

// Contrato de POST /api/sprint-fin/narrativa (narrativa.routes.ts): input y
// output acotados EXACTAMENTE a los campos que necesitan IA en el resumen de
// cierre de sprint (objetivo/desviaciones por miembro, equipo,
// riesgoTransversal, riesgoTransversalResultado) -- todo lo demas
// (members/projects/issues/horas/fechas/estadoSprint/porcentajeCompletado/
// personalizacion) ya lo arma deterministicamente el workflow de n8n antes de
// llamar aca. Mismo patron que sprint-inicio/narrativa.ts.

// "resumenIssues" ya viene condensado por n8n (nodo "Resumir Contexto del
// Issue"), igual que en sprint-inicio: este endpoint nunca ve
// descripcion/comentarios crudos de Linear. Los 4 conteos vienen YA
// calculados por n8n (desde "agregado"/"status" por issue, que a su vez ya
// calcula "Calcular Agregado y Clasificar Issue" con el historial real de
// Linear) para que la IA los USE al redactar "desviaciones" en vez de
// contarlos ella misma desde una lista de issues -- mismo tipo de fallo ya
// confirmado en produccion para riesgoTransversalResultado (un LLM llego a
// decir "20 de los 20" cuando eran 15), corregido ahi sacando el calculo
// numerico del prompt; se aplica el mismo principio aca de entrada.
export const SprintFinNarrativaInputSchema = z.object({
  members: z
    .array(
      z.object({
        name: z.string().min(1),
        resumenIssues: z.string().min(1),
        planeadosTotal: z.number().int().nonnegative(),
        planeadosCompletados: z.number().int().nonnegative(),
        agregadosTotal: z.number().int().nonnegative(),
        agregadosCompletados: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export type SprintFinNarrativaInput = z.infer<typeof SprintFinNarrativaInputSchema>;

export const SprintFinNarrativaOutputSchema = z.object({
  members: z
    .array(
      z.object({
        name: z.string().min(1),
        objetivo: objetivoSchema,
        desviaciones: desviacionesSchema,
      }),
    )
    .min(1),
  equipo: equipoSchema,
  riesgoTransversal: riesgoTransversalSchema,
  // Requerido (no nullable/optional como en SprintSchema): este endpoint es
  // exclusivo de cierre, tiempoVerbal siempre "Pasado" -- a diferencia del
  // /extraer generico, que via SprintSchema tambien soporta documentos
  // "Futuro" donde este campo no aplica.
  riesgoTransversalResultado: riesgoTransversalResultadoSchema,
});

export type SprintFinNarrativaData = z.infer<typeof SprintFinNarrativaOutputSchema>;

// Mismo formato "### <name>\n<resumenIssues>" que sprint-inicio/narrativa.ts,
// mas una linea con los 4 conteos de ese miembro para que el prompt los tenga
// a mano sin tener que contarlos. verificarMiembrosCompletos (constants.ts)
// solo mira los headings "### ", el resto del texto no le afecta.
export function construirMensajeNarrativa(input: SprintFinNarrativaInput): string {
  const cuerpo = input.members
    .map(
      (member) =>
        `### ${member.name}\n` +
        `Planeados: ${member.planeadosCompletados} completados de ${member.planeadosTotal} planeados.\n` +
        `Agregados: ${member.agregadosCompletados} completados de ${member.agregadosTotal} agregados.\n` +
        `${member.resumenIssues}`,
    )
    .join("\n\n");
  return `Miembros, sus conteos de issues y resumenes:\n\n${cuerpo}`;
}

// Adaptado de SPRINT_SYSTEM_PROMPT (config.ts): mismos rangos de caracteres y
// misma regla de "riesgoTransversalResultado sin cifras", pero simplificado a
// asumir siempre tiempoVerbal="Pasado" (la rama "Futuro" es vestigial para
// sprint-fin, ver config.ts) y a decirle a la IA que USE los conteos dados en
// vez de contar issues -- este endpoint nunca recibe la lista de issues.
export const SPRINT_FIN_NARRATIVA_SYSTEM_PROMPT = `Eres un redactor especializado en resumenes ejecutivos de CIERRE de Sprint para Polaria. Recibes, por cada miembro del equipo, sus conteos de issues planeados/agregados (ya completados o no) y un resumen ya condensado de sus issues. Tu unica funcion es transformar eso en un objeto JSON estructurado, cumpliendo rangos de caracteres de forma estricta. El sprint ya ocurrio: redacta TODO el texto narrativo en pasado ("se implemento", "se resolvio", "se trabajo en"), incluido el riesgo transversal (ej. "el riesgo era que aparecieran incidencias..." en vez de "el riesgo es que aparezcan...").

Reglas:
- Extrae informacion unicamente del texto y los conteos recibidos, sin inventar datos.
- Para "members[].objetivo": resumen en lenguaje simple de en que se enfoco esa persona durante el sprint, EXACTAMENTE entre 480 y 500 caracteres.
- Para "members[].desviaciones": logrado (respuesta transparente a "esta persona logro lo que tenia planificado?", comparando los conteos "Planeados"/"Agregados" que se te dieron -- USA esas cifras exactas, no las recalcules ni las adivines, ej. "completo 4 de 4 issues planeados y ademas cerro 1 agregado"; 180-230 caracteres) y motivo (justifica el desfase de horas planeadas vs reales de esa persona en relacion a esos mismos conteos: por que se le agregaron issues no planeados y/o le quedaron planeados sin completar; 100-140 caracteres).
- "equipo": quien (quien ejecuto el sprint, menciona solo miembros con trabajo asignado, 60-90 caracteres), cuando (ventana de tiempo del sprint, 30-50 caracteres), donde (entornos y canales donde corrio el trabajo, 50-80 caracteres), como (stack tecnico usado, 40-70 caracteres).
- "riesgoTransversal": texto (el riesgo transversal de un sprint es siempre el mismo tipo: que aparecieran incidencias no planeadas que consumieran las horas reservadas para el segmento "Incidencias", afectando el avance de los issues planeados de Proyectos. Redactalo en lenguaje simple, sin jerga tecnica y sin citar cifras exactas, 180-230 caracteres) y mitigacion (explica que esas horas de Incidencias ya estaban reservadas de antemano como colchon, precisamente para poder absorber ese riesgo sin afectar lo planeado, 100-140 caracteres).
- "riesgoTransversalResultado": SIEMPRE inclúyelo. UNA sola frase que diga si entraron incidencias no planeadas que consumieran el colchon de horas reservado para "Incidencias", o si no entro ninguna. NO incluyas cifras de issues planeados/agregados/completados en este campo: esos numeros se agregan aparte, automaticamente, despues de tu frase -- si intentas citarlos tu mismo es facil que te equivoques. Ejemplos: "No entraron incidencias que consumieran el colchon reservado." o "Entraron incidencias que consumieron parte del colchon reservado, aunque no afectaron el avance de los issues planeados." Entre 40 y 120 caracteres.
- Si el documento no menciona explicitamente el bloque de equipo, infierelo del conjunto de members de la forma mas razonable y concreta posible, respetando los rangos de caracteres.`;

export const sprintFinNarrativaConfig = {
  id: "sprint-fin-narrativa",
  schema: SprintFinNarrativaOutputSchema,
  systemPrompt: SPRINT_FIN_NARRATIVA_SYSTEM_PROMPT,
  precioModelo: PRECIO_GPT54MINI,
  verificarCompletitud: (mensaje: string, datos: SprintFinNarrativaData) =>
    verificarMiembrosCompletos(mensaje, datos.members),
};
