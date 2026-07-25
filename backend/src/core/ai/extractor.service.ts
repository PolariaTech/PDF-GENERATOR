import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ZodError } from "zod";
import { DocumentConfig } from "../../documents/types";
import { PRECIO_GPT4OMINI } from "../../constants";

// timeout/maxRetries: evita que un request colgado bloquee el handler Express
// indefinidamente (esto lo invoca tambien un workflow de n8n que necesita
// comportamiento predecible). El SDK oficial `openai` (v4.104.0, ver
// node_modules/openai/core.js, metodo `shouldRetry` ~L402-423) ya distingue
// errores transitorios de permanentes por defecto: solo reintenta HTTP
// 408/409/429 y >=500 (o timeouts/errores de red, manejados aparte en
// `makeRequest` ~L326-332), y NO reintenta 400/401/403/404/422 (request mal
// formado o auth invalida) porque `shouldRetry` devuelve `false` para esos
// status. No hace falta pasar `shouldRetry` custom. Este `maxRetries` es
// para fallos de transporte/HTTP -- el reintento de MAX_REINTENTOS_EXTRACCION
// mas abajo es un mecanismo distinto, para cuando la respuesta SI llega pero
// no cumple el schema (rangos de caracteres, formato).
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60_000,
  maxRetries: 1,
});

// Cuantas veces se le vuelve a pedir la extraccion a OpenAI si la respuesta
// no cumple el schema (Zod) -- ademas del intento original, no en su lugar.
// Existio un mecanismo asi en el workflow de n8n (ver ADR-0006) y se elimino
// tras el pilot porque nunca hizo falta en la practica; se reintroduce aca
// (centralizado en el backend, no en n8n) porque sprint-inicio ahora valida
// rangos de caracteres estrictos y los LLM no cuentan caracteres con
// precision -- sin esto, un objetivo de 478 caracteres en vez de 480-500
// tiraria 500 INTERNAL_ERROR sin ninguna oportunidad de corregirse. Vive acá
// (no en cada workflow de n8n) para que beneficie a los 4 workflows Y al
// flujo manual del frontend a la vez, sin duplicar logica.
const MAX_REINTENTOS_EXTRACCION = 3;

export interface UsoTokens {
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  tokensTotal: number;
  costoEstimadoUsd: number;
}

export interface ResultadoExtraccion<T> {
  datos: T;
  uso: UsoTokens;
}

type IntentoExtraccion<T> =
  | { exito: true; datos: T; uso: UsoTokens }
  | { exito: false; motivo: string; uso: UsoTokens };

function calcularUso(completion: OpenAI.Chat.Completions.ChatCompletion): UsoTokens {
  const tokensEntrada = completion.usage?.prompt_tokens ?? 0;
  const tokensSalida = completion.usage?.completion_tokens ?? 0;
  const tokensTotal = completion.usage?.total_tokens ?? tokensEntrada + tokensSalida;

  return {
    modelo: PRECIO_GPT4OMINI.modelo,
    tokensEntrada,
    tokensSalida,
    tokensTotal,
    costoEstimadoUsd:
      (tokensEntrada / 1_000_000) * PRECIO_GPT4OMINI.usdPorMillonEntrada +
      (tokensSalida / 1_000_000) * PRECIO_GPT4OMINI.usdPorMillonSalida,
  };
}

function sumarUso(usos: UsoTokens[]): UsoTokens {
  return usos.reduce((acumulado, uso) => ({
    modelo: uso.modelo,
    tokensEntrada: acumulado.tokensEntrada + uso.tokensEntrada,
    tokensSalida: acumulado.tokensSalida + uso.tokensSalida,
    tokensTotal: acumulado.tokensTotal + uso.tokensTotal,
    costoEstimadoUsd: acumulado.costoEstimadoUsd + uso.costoEstimadoUsd,
  }));
}

// Resume los issues de un ZodError en una linea por campo (path + mensaje),
// pensada para pegarse de vuelta en el prompt como feedback concreto -- no
// alcanza con "corrigelo", el modelo necesita saber exactamente que campo y
// que regla violo para tener una oportunidad real de arreglarlo.
function resumirErroresZod(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
    .join(" | ");
}

async function intentarExtraer<T>(
  mensajeUsuario: string,
  config: DocumentConfig<T>,
): Promise<IntentoExtraccion<T>> {
  const completion = await openai.beta.chat.completions.parse({
    model: PRECIO_GPT4OMINI.modelo,
    temperature: 0.2,
    response_format: zodResponseFormat(config.schema, `${config.id}_schema`),
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: mensajeUsuario },
    ],
  });

  const uso = calcularUso(completion);
  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    return { exito: false, motivo: "OpenAI no devolvio datos parseados.", uso };
  }

  // Re-validamos explicitamente contra el schema en vez de confiar en que
  // `parsed` ya viene garantizado: la Structured Output API de OpenAI no
  // necesariamente hace cumplir minLength/maxLength durante la generacion
  // (el soporte de esas palabras clave de JSON Schema no es un contrato
  // documentado establo), asi que la unica fuente de verdad confiable sobre
  // si de verdad cumple los rangos es correr el propio schema Zod aca.
  const validado = config.schema.safeParse(parsed);
  if (!validado.success) {
    return { exito: false, motivo: resumirErroresZod(validado.error), uso };
  }

  return { exito: true, datos: validado.data, uso };
}

export async function extraer<T>(
  markdown: string,
  config: DocumentConfig<T>,
): Promise<ResultadoExtraccion<T>> {
  const usos: UsoTokens[] = [];
  let mensajeUsuario = markdown;
  let ultimoMotivo = "";

  for (let intento = 1; intento <= MAX_REINTENTOS_EXTRACCION + 1; intento++) {
    const resultado = await intentarExtraer(mensajeUsuario, config);
    usos.push(resultado.uso);

    if (resultado.exito) {
      return { datos: resultado.datos, uso: sumarUso(usos) };
    }

    ultimoMotivo = resultado.motivo;
    mensajeUsuario = `${markdown}\n\n[NOTA DEL SISTEMA -- intento ${intento} fallo la validacion, corrige exactamente esto en tu proxima respuesta: ${ultimoMotivo}]`;
  }

  throw new Error(
    `OpenAI no devolvio datos validos para ${config.id} tras ${MAX_REINTENTOS_EXTRACCION} reintentos (${
      MAX_REINTENTOS_EXTRACCION + 1
    } intentos en total). Ultimo motivo: ${ultimoMotivo}`,
  );
}
