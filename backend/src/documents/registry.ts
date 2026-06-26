import { epicaConfig } from "./epica/config";
import { epicaSampleData } from "./epica/sample-data";
import { sprintConfig } from "./sprint/config";
import { sprintSampleData } from "./sprint/sample-data";
import { DocumentConfig } from "./types";

export const documentRegistry: Record<string, DocumentConfig<any>> = {
  [epicaConfig.id]: epicaConfig,
  [sprintConfig.id]: sprintConfig,
};

export function getDocumentConfig(docType: string): DocumentConfig<any> | null {
  return documentRegistry[docType] ?? null;
}

export const documentSamples: Record<string, unknown> = {
  [epicaConfig.id]: epicaSampleData,
  [sprintConfig.id]: sprintSampleData,
};

export function getDocumentSample(docType: string): unknown | null {
  return documentSamples[docType] ?? null;
}
