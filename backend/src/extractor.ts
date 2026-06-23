import OpenAI from "openai";
import { DatosExtraidos, RespuestaExtraccion, UsoTokens } from "./types";
import { PRECIO_GPT4OMINI } from "./constants";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Eres un extractor de datos. Recibes el contenido de un documento Markdown que describe las epicas mensuales de un equipo de producto (Polaria). Tu trabajo es leerlo y devolver UNICAMENTE un objeto JSON valido, sin texto antes ni despues, sin bloques de codigo, sin explicaciones.

El JSON debe tener esta estructura exacta:

{
  "periodo": "string. Ej: JUNIO-JULIO. En mayusculas.",
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
      "riesgo": "string en lenguaje simple, sin jerga tecnica. El riesgo principal de esta epica en 1 frase. Entre 100 y 130 caracteres, contando espacios."
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
  }
}

Reglas de lenguaje simple (aplica SOLO a: objetivo, alcance, resultadoEsperado, riesgo de cada epica, y a riesgoTransversal.texto/mitigacion. NO aplica a "equipo", ahi los nombres de herramientas estan permitidos):
- Cero jerga tecnica. No uses nombres de tecnologias, frameworks, ni terminos de arquitectura: nada de Supabase, NestJS, RLS, multi-tenant, n8n, vistas normalizadas, Kardex tecnico, balance de masa, API, backend, etc.
- En su lugar describe QUE hace o QUE resuelve, en terminos que cualquier persona sin conocimiento tecnico entienda en una lectura. Ejemplo: en vez de "bloqueos en tiempo real con RLS en Supabase" escribe "evitar que dos personas editen lo mismo al mismo tiempo, con cada cliente viendo solo su propia informacion".
- Si el documento original trae un termino tecnico clave para el significado, tradúcelo a su efecto practico, no lo copies literal.
- El objetivo final es que una persona sin contexto tecnico entienda en pocos segundos en que se esta trabajando y por que importa.

Reglas generales y de control de longitud:
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

export async function extraerDatos(
  markdown: string,
): Promise<RespuestaExtraccion> {
  const completion = await openai.chat.completions.create({
    model: PRECIO_GPT4OMINI.modelo,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: markdown },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI no devolvio contenido.");
  }

  let parsed: DatosExtraidos;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      "La respuesta de OpenAI no es JSON valido: " + raw.slice(0, 200),
    );
  }

  if (!Array.isArray(parsed.epicas) || parsed.epicas.length === 0) {
    throw new Error("No se detectaron epicas en el documento.");
  }

  const tokensEntrada = completion.usage?.prompt_tokens ?? 0;
  const tokensSalida = completion.usage?.completion_tokens ?? 0;
  const tokensTotal =
    completion.usage?.total_tokens ?? tokensEntrada + tokensSalida;

  const costoEstimadoUsd =
    (tokensEntrada / 1_000_000) * PRECIO_GPT4OMINI.usdPorMillonEntrada +
    (tokensSalida / 1_000_000) * PRECIO_GPT4OMINI.usdPorMillonSalida;

  const uso: UsoTokens = {
    modelo: PRECIO_GPT4OMINI.modelo,
    tokensEntrada,
    tokensSalida,
    tokensTotal,
    costoEstimadoUsd,
  };

  return { datos: parsed, uso };
}
