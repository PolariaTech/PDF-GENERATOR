import { epicaConfig } from "./epica/config";
import { epicaSampleData } from "./epica/sample-data";
import { sprintInicioConfig } from "./sprint-inicio/config";
import { sprintInicioSampleData } from "./sprint-inicio/sample-data";
import { sprintFinConfig } from "./sprint-fin/config";
import { sprintFinSampleData } from "./sprint-fin/sample-data";
import { DocumentConfig } from "./types";

export const documentRegistry: Record<string, DocumentConfig<any>> = {
  [epicaConfig.id]: epicaConfig,
  [sprintInicioConfig.id]: sprintInicioConfig,
  [sprintFinConfig.id]: sprintFinConfig,
};

export function getDocumentConfig(docType: string): DocumentConfig<any> | null {
  return documentRegistry[docType] ?? null;
}

export const documentSamples: Record<string, unknown> = {
  [epicaConfig.id]: epicaSampleData,
  [sprintInicioConfig.id]: sprintInicioSampleData,
  [sprintFinConfig.id]: sprintFinSampleData,
};

export function getDocumentSample(docType: string): unknown | null {
  return documentSamples[docType] ?? null;
}
