import fs from "fs";
import path from "path";

// Archivo JSON local (no versionado, ver .gitignore) con un registro por
// sprint cerrado -- unica fuente de "memoria" del generador, que por lo
// demas es completamente stateless (cada request de /preview o /pdf es
// independiente). Solo template-resumen-v3 lo consume, para tendencia y
// proyeccion; el resto de plantillas de sprint no lo tocan.
const HISTORICO_PATH = path.join(__dirname, "..", "..", "..", "data", "sprint-historico.json");

export interface SprintHistoricoEntry {
  sprintName: string;
  weekNumber: string;
  dateStart: string;
  dateEnd: string;
  planPorcentajeCompletado: number;
  agregadoPorcentajeCompletado: number;
  globalPorcentaje: number;
  horasPorcentaje: number | null;
  saludEstado: string;
  registradoEn: string;
}

export function leerHistorico(): SprintHistoricoEntry[] {
  try {
    const contenido = fs.readFileSync(HISTORICO_PATH, "utf-8");
    const datos = JSON.parse(contenido);
    return Array.isArray(datos) ? datos : [];
  } catch {
    // No existe todavia (primer sprint registrado) o esta corrupto -- en
    // ambos casos, arrancar de una lista vacia es la salida segura: nunca
    // debe tumbar un /preview o /pdf por un problema de lectura del historico.
    return [];
  }
}

// Upsert por sprintName+weekNumber: si el mismo sprint se registra de nuevo
// (regenerar el PDF final tras un ajuste), actualiza la entrada existente en
// vez de duplicarla.
export function registrarSprintCerrado(entry: SprintHistoricoEntry): SprintHistoricoEntry[] {
  const historico = leerHistorico();
  const indiceExistente = historico.findIndex(
    (h) => h.sprintName === entry.sprintName && h.weekNumber === entry.weekNumber,
  );
  if (indiceExistente >= 0) {
    historico[indiceExistente] = entry;
  } else {
    historico.push(entry);
  }
  fs.mkdirSync(path.dirname(HISTORICO_PATH), { recursive: true });
  fs.writeFileSync(HISTORICO_PATH, JSON.stringify(historico, null, 2), "utf-8");
  return historico;
}
