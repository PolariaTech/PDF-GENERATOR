import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { DocumentConfig } from "../../documents/types";
import { PRECIO_GPT5MINI } from "../../constants";

// timeout/maxRetries: evita que un request colgado bloquee el handler Express
// indefinidamente (esto lo invoca tambien un workflow de n8n que necesita
// comportamiento predecible). El SDK oficial `openai` (v4.104.0, ver
// node_modules/openai/core.js, metodo `shouldRetry` ~L402-423) ya distingue
// errores transitorios de permanentes por defecto: solo reintenta HTTP
// 408/409/429 y >=500 (o timeouts/errores de red, manejados aparte en
// `makeRequest` ~L326-332), y NO reintenta 400/401/403/404/422 (request mal
// formado o auth invalida) porque `shouldRetry` devuelve `false` para esos
// status. No hace falta pasar `shouldRetry` custom.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60_000,
  maxRetries: 1,
});

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

export async function extraer<T>(
  markdown: string,
  config: DocumentConfig<T>,
): Promise<ResultadoExtraccion<T>> {
  const completion = await openai.beta.chat.completions.parse({
    model: PRECIO_GPT5MINI.modelo,
    temperature: 0.2,
    response_format: zodResponseFormat(config.schema, `${config.id}_schema`),
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: markdown },
    ],
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error(`OpenAI no devolvio datos parseados para ${config.id}.`);
  }

  const tokensEntrada = completion.usage?.prompt_tokens ?? 0;
  const tokensSalida = completion.usage?.completion_tokens ?? 0;
  const tokensTotal =
    completion.usage?.total_tokens ?? tokensEntrada + tokensSalida;

  const costoEstimadoUsd =
    (tokensEntrada / 1_000_000) * PRECIO_GPT5MINI.usdPorMillonEntrada +
    (tokensSalida / 1_000_000) * PRECIO_GPT5MINI.usdPorMillonSalida;

  return {
    datos: parsed,
    uso: {
      modelo: PRECIO_GPT5MINI.modelo,
      tokensEntrada,
      tokensSalida,
      tokensTotal,
      costoEstimadoUsd,
    },
  };
}
