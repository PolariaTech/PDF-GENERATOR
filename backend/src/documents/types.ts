import { z } from "zod";

export interface DocumentTemplate {
  path: string;
  pdf?: {
    width: string;
    height: string;
  };
  // Marca las plantillas que usan cards-grid (--card-columns / {{pdfWidth}} en
  // el <body>, ver ADR-0009). generarPdf() solo aplica el pdfWidth calculado
  // por resolverGridCards() en componerDatos() cuando esta plantilla lo pide
  // -- sin esto, un docType con templates mixtas (ej. sprint-fin: detail NO es
  // cards-grid pero resumen/resumen-v2/resumen-v3 SI) terminaba forzando el
  // ancho de grid tambien en la plantilla fija (bug real: detail se generaba
  // con 1240px en vez de sus 900px declarados, dejando espacio en blanco).
  cardsGrid?: boolean;
}

export interface DocumentConfig<T> {
  id: string;
  schema: z.ZodSchema<T>;
  systemPrompt: string;
  componerDatos(datosExtraidos: T): any;
  templates: Record<string, DocumentTemplate>;
  defaultTemplate: string;
  // Modelo/precio a usar en extractor.service.ts para este documento. Default
  // PRECIO_GPT4OMINI si se omite (ver constants.ts). sprint-fin/sprint-inicio
  // lo pisan con PRECIO_GPT54MINI -- gpt-4o-mini resulto no confiable con
  // varios miembros por documento (ver PRECIO_GPT54MINI en constants.ts).
  precioModelo?: { modelo: string; usdPorMillonEntrada: number; usdPorMillonSalida: number };
  // Chequeo opcional, posterior a la validacion de schema: compara el markdown
  // fuente contra los datos ya validados para detectar omisiones que Zod no
  // puede atrapar (ej. la IA devuelve menos miembros de los que el documento
  // realmente tiene -- un array mas corto sigue siendo un schema valido). Si
  // devuelve un string, extractor.service.ts lo trata como fallo de validacion
  // y reintenta con ese mensaje como feedback; si devuelve null, la extraccion
  // se da por completa.
  verificarCompletitud?(markdown: string, datosExtraidos: T): string | null;
}
