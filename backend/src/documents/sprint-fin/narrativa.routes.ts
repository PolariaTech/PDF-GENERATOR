import { Router } from "express";
import { sendError } from "../../api/document.routes";
import { extraer } from "../../core/ai/extractor.service";
import {
  SprintFinNarrativaInputSchema,
  construirMensajeNarrativa,
  sprintFinNarrativaConfig,
} from "./narrativa";

// Ruta especifica de sprint-fin, fuera del patron generico de
// document.routes.ts (mismo motivo que historico.routes.ts y
// sprint-inicio/narrativa.routes.ts): aisla la generacion de
// objetivo/desviaciones/equipo/riesgoTransversal/riesgoTransversalResultado
// en un endpoint propio para que el workflow de n8n pueda armar el resto del
// payload 100% deterministico y delegar solo estos campos al backend, sin
// arriesgar /extraer, /preview, /pdf ni /historico de sprint-fin que ya
// funcionan en produccion.
export const sprintFinNarrativaRouter = Router();

function getPayload(body: any) {
  return body?.datos ?? body;
}

sprintFinNarrativaRouter.post("/sprint-fin/narrativa", async (req, res) => {
  try {
    const parsed = SprintFinNarrativaInputSchema.safeParse(getPayload(req.body));
    if (!parsed.success) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Datos invalidos para sprint-fin/narrativa.",
        parsed.error.flatten(),
      );
      return;
    }

    const mensaje = construirMensajeNarrativa(parsed.data);
    const resultado = await extraer(mensaje, sprintFinNarrativaConfig);
    res.json({ success: true, datos: resultado.datos, uso: resultado.uso });
  } catch (err: any) {
    console.error("Error en POST /api/sprint-fin/narrativa:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Error al generar la narrativa del sprint.");
  }
});
