import { Router } from "express";
import { sendError } from "../../api/document.routes";
import { sprintConfig } from "./config";
import { leerHistorico, registrarSprintCerrado, SprintHistoricoEntry } from "./historico";

// Ruta especifica de sprint, fuera del patron generico de document.routes.ts
// (ese patron es el mismo para cualquier docType y no debe llevar logica de
// negocio de un tipo en particular). Se llama de forma explicita cuando un
// sprint realmente cierra -- NO se dispara automaticamente al generar un PDF,
// para que probar/regenerar el PDF final no ensucie el historico por
// accidente. Ver ANALISIS_INFORME_EJECUTIVO_SPRINT_RESUMEN_V2.md, Fase 3.
export const sprintHistoricoRouter = Router();

function getPayload(body: any) {
  return body?.datos ?? body;
}

sprintHistoricoRouter.post("/sprint/historico", (req, res) => {
  try {
    const parsed = sprintConfig.schema.safeParse(getPayload(req.body));
    if (!parsed.success) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Datos invalidos para el documento solicitado.",
        parsed.error.flatten(),
      );
      return;
    }

    const datos = sprintConfig.componerDatos(parsed.data);
    const entry: SprintHistoricoEntry = {
      sprintName: datos.sprintName,
      weekNumber: datos.weekNumber,
      dateStart: datos.dateStart,
      dateEnd: datos.dateEnd,
      planPorcentajeCompletado: datos.planPorcentajeCompletado,
      agregadoPorcentajeCompletado: datos.agregadoPorcentajeCompletado,
      globalPorcentaje: datos.globalPorcentaje,
      horasPorcentaje: datos.horas?.kpiDisponible ? datos.horas.porcentaje : null,
      saludEstado: datos.saludEstado,
      registradoEn: new Date().toISOString(),
    };
    const historico = registrarSprintCerrado(entry);
    res.json({ success: true, entry, total: historico.length });
  } catch (err: any) {
    console.error("Error en POST /api/sprint/historico:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Error al registrar el sprint en el historico.");
  }
});

sprintHistoricoRouter.get("/sprint/historico", (_req, res) => {
  try {
    res.json({ success: true, historico: leerHistorico() });
  } catch (err: any) {
    console.error("Error en GET /api/sprint/historico:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Error al leer el historico.");
  }
});
