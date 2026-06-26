import { z } from "zod";

export interface DocumentConfig<T> {
  id: string;
  schema: z.ZodSchema<T>;
  systemPrompt: string;
  componerDatos(datosExtraidos: T): any;
  templatePath: string;
  pdf?: {
    width: string;
    height: string;
  };
}
