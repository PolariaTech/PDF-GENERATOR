import path from "path";
import { z } from "zod";
import { HORAS_FIJAS, asignarPaleta, construirGradiente } from "../../constants";
import { DocumentConfig } from "../types";

// Un sprint dentro del ciclo de esta epica (normalmente 4 sprints semanales
// por epica mensual). Solo se llena en el flujo de CIERRE, igual que
// "cumplimiento" -- ver mas abajo.
const EpicaSprintSchema = z.object({
  nombre: z.string(),
  estado: z.enum(["CUMPLIDO", "NO CUMPLIDO"]),
});

const EpicaItemSchema = z.object({
  nombreCorto: z.string(),
  subtitulo: z.string(),
  responsable: z.string(),
  objetivo: z.string().max(260),
  alcance: z.string().max(200),
  kpis: z.array(z.string()).min(1),
  resultadoEsperado: z.string().max(200),
  riesgo: z.string().max(200),
  // Solo se llena en el flujo de CIERRE (no en el de inicio): narrativa
  // cualitativa de que tanto se logro vs lo planeado en objetivo/alcance.
  // Editable a mano; NO es un % calculado (la formula de cumplimiento global
  // todavia no la aprueba el equipo administrativo, ver memoria
  // sprint_kpi_global -- misma decision aplica aqui).
  cumplimiento: z.string().max(320).nullable().optional(),
  // Solo se llena en el flujo de CIERRE: los sprints que compusieron el ciclo
  // de esta epica y si cada uno se cumplio o no. Alimenta el donut de
  // "Sprints del ciclo" en template-cierre.html.
  sprints: z.array(EpicaSprintSchema).nullable().optional(),
});

export const EpicaSchema = z.object({
  periodo: z.string(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  duracion: z.string(),
  epicas: z.array(EpicaItemSchema).min(1),
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
  // Solo se llena en el flujo de CIERRE: si el riesgo transversal previsto en
  // el resumen de inicio se materializo o no, y que paso. Editable a mano.
  riesgoTransversalResultado: z.string().max(260).nullable().optional(),
});

export type EpicaData = z.infer<typeof EpicaSchema>;

export const EPICA_SYSTEM_PROMPT = `Eres un extractor de datos. Recibes el contenido de un documento Markdown que describe las epicas mensuales de un equipo de producto (Polaria). Tu trabajo es leerlo y devolver UNICAMENTE un objeto JSON valido, sin texto antes ni despues, sin bloques de codigo, sin explicaciones.

El JSON debe tener esta estructura exacta:

{
  "periodo": "string. OBLIGATORIO terminar en un año de 4 digitos, sin excepcion, incluso si el documento fuente no lo menciona explicitamente (en ese caso infierelo del contexto: fechas del documento, año actual, u otras referencias). Ej: JUNIO-JULIO 2026. En mayusculas. NUNCA devuelvas 'periodo' sin año: es un campo usado por integraciones externas para calcular festivos del ciclo y un año faltante rompe ese calculo.",
  "fechaInicio": "string corto. Ej: 22 JUN",
  "fechaFin": "string corto. Ej: 20 JUL",
  "duracion": "string. Ej: 4 SEMANAS",
  "epicas": [
    {
      "nombreCorto": "string. Nombre legible y corto de la epica. Entre 12 y 22 caracteres. Ej: Bodega Fria v2.0",
      "subtitulo": "string corto en mayusculas. Entre 10 y 20 caracteres. Ej: MIGRACION A SAAS",
      "responsable": "string en mayusculas. Usa el apodo oficial: DANI (para Daniel), MAURO (para Mauricio) o LUCHO (para Luis). Ej: LUCHO",
      "objetivo": "string en lenguaje simple, sin jerga tecnica (ver reglas abajo). Resumen ejecutivo de 1 a 2 frases que condensa el objetivo (What + Why). Entre 160 y 170 caracteres, contando espacios. REGLA: Evita explicaciones redundantes para mantener la homogeneidad visual.",
      "alcance": "string en lenguaje simple, sin jerga tecnica. Que entra en la epica este mes, en frase corta con separadores. Entre 120 y 130 caracteres, contando espacios. REGLA: Sintetiza y agrupa los entregables, NO listes excesivamente pantallas o sub-módulos para evitar asimetría visual.",
      "kpis": ["array de exactamente 3 strings MUY cortos para chips. Cada uno entre 10 y 18 caracteres, en mayusculas. Ej: 6/6 VISTAS, >90% PRECISION, <5S RESPUESTA."],
      "resultadoEsperado": "string en lenguaje simple, sin jerga tecnica. La condicion de exito o resultado esperado en 1 frase. Entre 100 y 130 caracteres, contando espacios.",
      "riesgo": "string en lenguaje simple, sin jerga tecnica. El riesgo principal de esta epica en 1 frase. Entre 100 y 130 caracteres, contando espacios.",
      "cumplimiento": "OPCIONAL, string en lenguaje simple. SOLO incluye este campo si el documento describe resultados reales de la epica (issues completados/cancelados/duplicados, un cierre o status update de un lead). Si el documento es solo un plan/planificacion sin resultados reales, OMITE este campo por completo. Cuando SI apliques, resume que tanto se logro frente a lo planeado y que se desvio (se agrego algo no planeado, quedo algo pendiente), en 1 a 2 frases. Entre 220 y 300 caracteres, contando espacios. NO calcules ni inventes un porcentaje de cumplimiento: describe el resultado en palabras, nunca con un numero.",
      "sprints": "OPCIONAL, array de objetos {\"nombre\": string, \"estado\": \"CUMPLIDO\" o \"NO CUMPLIDO\"}. SOLO incluye este campo si el documento identifica los sprints individuales que compusieron el ciclo de esta epica (normalmente varios sprints semanales dentro del mes) y si cada uno se cumplio o no. Si el documento no distingue sprints por separado, OMITE este campo por completo. nombre debe ser corto (ej. 'Sprint 1', 'S2'). No inventes sprints que no esten en el documento."
    }
  ],
  "equipo": {
    "quien": "string. Quien ejecuta. Menciona SOLO a los apodos que realmente tienen una epica asignada este mes. Entre 60 y 90 caracteres. Ej: Equipo enfocado (2 personas) - Lucho y Mauro, un objetivo cada uno",
    "cuando": "string. Ventana de tiempo. Entre 30 y 50 caracteres. Ej: 22 jun a 20 jul, 4 semanas (28 dias)",
    "donde": "string. Entornos y canales. Entre 50 y 80 caracteres. Ej: Produccion, WhatsApp, Linear, clientes Polaria / TCI JBR",
    "como": "string. Stack tecnico, aqui SI se permiten nombres de herramientas. Entre 40 y 70 caracteres. Ej: NestJS, Supabase, n8n, Cloudinary, WhatsApp, Linear"
  },
  "riesgoTransversal": {
    "texto": "string en lenguaje simple, sin jerga tecnica. El riesgo que afecta a todas las epicas a la vez. Entre 180 y 230 caracteres, contando espacios.",
    "mitigacion": "string en lenguaje simple, sin jerga tecnica. Como se mitiga ese riesgo transversal. Entre 100 y 140 caracteres, counting spaces."
  },
  "riesgoTransversalResultado": "OPCIONAL, string en lenguaje simple. SOLO incluye este campo si el documento describe resultados reales del periodo (mismo criterio que 'cumplimiento' de cada epica). Cuando SI apliques, di si el riesgo transversal se materializo o no y que paso en la practica. Entre 180 y 250 caracteres, contando espacios."
}

Reglas de lenguaje simple (aplica SOLO a: objetivo, alcance, resultadoEsperado, riesgo y cumplimiento de cada epica, y a riesgoTransversal.texto/mitigacion y riesgoTransversalResultado. NO aplica a "equipo", ahi los nombres de herramientas estan permitidos):
- Cero jerga tecnica. No uses nombres de tecnologias, frameworks, ni terminos de arquitectura: nada de Supabase, NestJS, RLS, multi-tenant, n8n, vistas normalizadas, Kardex tecnico, balance de masa, API, backend, etc.
- En su lugar describe QUE hace o QUE resuelve, en terminos que cualquier persona sin conocimiento tecnico entienda en una lectura. Ejemplo: en vez de "bloqueos en tiempo real con RLS en Supabase" escribe "evitar que dos personas editen lo mismo al mismo tiempo, con cada cliente viendo solo su propia informacion".
- Si el documento original trae un termino tecnico clave para el significado, tradúcelo a su efecto practico, no lo copies literal.
- El objetivo final es que una persona sin contexto tecnico entienda en pocos segundos en que se esta trabajando y por que importa.

Reglas generales y de control de longitud:
- REGLA DE AÑO EN "periodo": antes de devolver el JSON, revisa que "periodo" termine en un año de 4 digitos. Si el documento no lo dice explicitamente, usalo del año de "fechaInicio"/"fechaFin" si aparece ahi, o del año en que se redacto el documento; si no hay ninguna pista, usa el año actual. Esto no es opcional.
- REGLA DE SIMETRÍA Y SÍNTESIS: Todas las épicas procesadas deben quedar perfectamente balanceadas en longitud. No permitas que una épica se extienda demasiado en "alcance" o "objetivo" listando elementos de más. Toma como estándar de concisión y síntesis el ejemplo de la épica de "Mateo v2.0".
- Uso de Apodos y Participantes: Mapea los nombres estrictamente así: Daniel = DANI, Mauricio = MAURO, Luis = LUCHO. Solo debes mencionar e incluir en las respuestas a las personas que aparezcan explícitamente en el documento asignadas a alguna épica. Si alguien no tiene tareas en este periodo, exclúyelo por completo.
- Una entrada en "epicas" por cada epica que encuentres en el documento. Puede haber 1, 2, 3 o mas.
- Cada campo de texto DEBE caer dentro del rango de caracteres indicado para ese campo. Esto aplica a TODAS las epicas por igual: si "objetivo" pide 150-180 caracteres, eso vale tanto para la primera epica como para la quinta. El objetivo es que todas las tarjetas se vean del mismo tamano visual, sin una mas corta o mas larga que las demas.
- Si el contenido original es mas corto que el minimo del rango, amplialo con detalle real del documento (no relleno generico) hasta llegar al rango. Si es mas largo que el maximo, resume sin perder el dato mas importante hasta caer dentro del rango.
- No inventes datos. Ajusta longitud usando unicamente informacion que SI esta en el documento.
- NO uses guion largo (raya). Usa guion corto o coma.
- Los KPIs deben ser etiquetas cortas tipo chip, no frases. Extrae lo esencial del KPI (la metrica y su meta), no el plan de contingencia.
- Si el documento no menciona explicitamente el riesgo transversal o el bloque de equipo (quien/cuando/donde/como), infiere los valores a partir del conjunto de epicas de la forma mas razonable y concreta posible, respetando los mismos rangos de caracteres.
- Responde solo con el JSON.`;

// Colores del donut "Sprints del ciclo" en template-cierre.html.
const SPRINTS_CICLO_CFG = {
  cumplido: "#0f766e",
  noCumplido: "#dc2626",
};

// La IA no siempre respeta la instruccion del prompt de incluir el año en
// "periodo" (probado 2026-07-20: fallo en varias corridas reales pese a
// reforzar el prompt), asi que se garantiza en codigo: si no trae un año de
// 4 digitos, se le agrega uno. Preferimos el año que la IA haya podido dejar
// en fechaInicio/fechaFin (por si en algun caso si lo incluye, aunque el
// prompt les pide formato corto sin año) antes de caer al año del sistema.
// Esto es lo que consume n8n para calcular festivos del ciclo (ver
// epica_workflow_drive en memoria) y lo que se muestra en el encabezado del PDF.
function asegurarAnioEnPeriodo(periodo: string, fechaInicio: string, fechaFin: string): string {
  if (/\d{4}/.test(periodo)) return periodo;
  const anio =
    fechaInicio.match(/\d{4}/)?.[0] ?? fechaFin.match(/\d{4}/)?.[0] ?? String(new Date().getFullYear());
  return `${periodo} ${anio}`;
}

const MESES_ABREV = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function parsearFechaCorta(fecha: string, anio: number): Date | null {
  const [diaStr, mesAbrev] = fecha.trim().toUpperCase().split(/\s+/);
  const mes = MESES_ABREV.indexOf(mesAbrev);
  const dia = parseInt(diaStr, 10);
  if (mes === -1 || Number.isNaN(dia)) return null;
  return new Date(anio, mes, dia);
}

function formatearFechaCorta(fecha: Date): string {
  return `${fecha.getDate()} ${MESES_ABREV[fecha.getMonth()]}`;
}

// La IA a veces calcula "fechaFin" sumando un mes calendario en vez de la
// duracion real del ciclo (probado 2026-07-20: "20 JUL" + "4 SEMANAS" dio
// "20 AGO" -- un mes calendario -- en vez de "17 AGO", que es lo correcto a
// 28 dias exactos). Se recalcula en codigo a partir de fechaInicio + la
// cantidad de semanas que diga "duracion", en vez de confiar en la aritmetica
// de fechas de la IA. Si duracion o fechaInicio no tienen el formato
// esperado, se deja el fechaFin que devolvio la IA sin tocar.
function corregirFechaFin(fechaInicio: string, fechaFin: string, duracion: string, anio: number): string {
  const inicio = parsearFechaCorta(fechaInicio, anio);
  const semanas = duracion.match(/(\d+)\s*SEMANA/i);
  if (!inicio || !semanas) return fechaFin;
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + parseInt(semanas[1], 10) * 7);
  return formatearFechaCorta(fin);
}

export function componerDatosEpica(datosExtraidos: EpicaData) {
  const periodo = asegurarAnioEnPeriodo(datosExtraidos.periodo, datosExtraidos.fechaInicio, datosExtraidos.fechaFin);
  const anio = parseInt(periodo.match(/\d{4}/)![0], 10);

  return {
    ...datosExtraidos,
    periodo,
    fechaFin: corregirFechaFin(datosExtraidos.fechaInicio, datosExtraidos.fechaFin, datosExtraidos.duracion, anio),
    epicas: datosExtraidos.epicas.map((epica, indice) => {
      const sprintsTotal = epica.sprints?.length ?? 0;
      const sprintsCumplidos =
        epica.sprints?.filter((sprint) => sprint.estado === "CUMPLIDO").length ?? 0;
      const sprintsNoCumplidos = sprintsTotal - sprintsCumplidos;

      return {
        ...epica,
        ...asignarPaleta(indice),
        sprintsTotal,
        sprintsCumplidos,
        sprintsNoCumplidos,
        sprintsCumplidoColor: SPRINTS_CICLO_CFG.cumplido,
        sprintsNoCumplidoColor: SPRINTS_CICLO_CFG.noCumplido,
        sprintsGradient: construirGradiente(
          [
            { color: SPRINTS_CICLO_CFG.cumplido, valor: sprintsCumplidos },
            { color: SPRINTS_CICLO_CFG.noCumplido, valor: sprintsNoCumplidos },
          ],
          sprintsTotal,
        ),
      };
    }),
    ...HORAS_FIJAS,
  };
}

export const epicaConfig: DocumentConfig<EpicaData> = {
  id: "epica",
  schema: EpicaSchema,
  systemPrompt: EPICA_SYSTEM_PROMPT,
  componerDatos: componerDatosEpica,
  templates: {
    default: { path: path.join(__dirname, "template.html") },
    cierre: { path: path.join(__dirname, "template-cierre.html") },
  },
  defaultTemplate: "default",
};
