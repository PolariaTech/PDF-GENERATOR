import { Router } from "express";
import { sendError } from "../../api/document.routes";
import { extraer } from "../../core/ai/extractor.service";
import {
  SprintInicioNarrativaInputSchema,
  construirMensajeNarrativa,
  sprintInicioNarrativaConfig,
} from "./narrativa";

// Ruta especifica de sprint-inicio, fuera del patron generico de
// document.routes.ts (mismo motivo que sprint-fin/historico.routes.ts):
// aisla la generacion de objetivo/equipo/riesgoTransversal en un endpoint
// propio para que el workflow de n8n pueda armar el resto del payload 100%
// deterministico (members/projects/issues/horas/fechas/personalizacion) y
// delegar solo estos 3 campos al backend, sin arriesgar /extraer, /preview ni
// /pdf de sprint-inicio que ya funcionan en produccion.
export const sprintInicioNarrativaRouter = Router();

function getPayload(body: any) {
  return body?.datos ?? body;
}

sprintInicioNarrativaRouter.post("/sprint-inicio/narrativa", async (req, res) => {
  try {
    const parsed = SprintInicioNarrativaInputSchema.safeParse(getPayload(req.body));
    if (!parsed.success) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Datos invalidos para sprint-inicio/narrativa.",
        parsed.error.flatten(),
      );
      return;
    }

    const mensaje = construirMensajeNarrativa(parsed.data);
    const resultado = await extraer(mensaje, sprintInicioNarrativaConfig);
    res.json({ success: true, datos: resultado.datos, uso: resultado.uso });
  } catch (err: any) {
    console.error("Error en POST /api/sprint-inicio/narrativa:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Error al generar la narrativa del sprint.");
  }
});
