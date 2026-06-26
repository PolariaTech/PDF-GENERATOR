import { Router } from "express";
import { extraer } from "../core/ai/extractor.service";
import { generarHtml, generarPdf } from "../core/generators/pdf.generator";
import { getDocumentConfig, getDocumentSample } from "../documents/registry";

export const documentRouter = Router();

function getConfigOrRespond(docType: string, res: any) {
  const config = getDocumentConfig(docType);
  if (!config) {
    res.status(404).json({ error: `Tipo de documento no registrado: ${docType}` });
    return null;
  }
  return config;
}

function getPayload(body: any) {
  return body?.datos ?? body;
}

documentRouter.get("/:docType/sample-preview", (req, res) => {
  try {
    const config = getConfigOrRespond(req.params.docType, res);
    if (!config) {
      return;
    }

    const sample = getDocumentSample(req.params.docType);
    if (!sample) {
      res.status(404).json({
        error: `No hay datos de ejemplo para ${req.params.docType}.`,
      });
      return;
    }

    const parsed = config.schema.parse(sample);
    const datos = config.componerDatos(parsed);
    const html = generarHtml(datos, config);
    res.type("html").send(html);
  } catch (err: any) {
    console.error(
      `Error en /api/${req.params.docType}/sample-preview:`,
      err.message,
    );
    res.status(500).json({
      error: err.message || "Error al generar preview de ejemplo.",
    });
  }
});

documentRouter.post("/:docType/extraer", async (req, res) => {
  try {
    const config = getConfigOrRespond(req.params.docType, res);
    if (!config) {
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No se recibio ningun archivo .md." });
      return;
    }

    const markdown = req.file.buffer.toString("utf-8");
    if (!markdown.trim()) {
      res.status(400).json({ error: "El archivo esta vacio." });
      return;
    }

    const resultado = await extraer(markdown, config);
    res.json(resultado);
  } catch (err: any) {
    console.error(`Error en /api/${req.params.docType}/extraer:`, err.message);
    res.status(500).json({ error: err.message || "Error al extraer datos." });
  }
});

documentRouter.post("/:docType/preview", (req, res) => {
  try {
    const config = getConfigOrRespond(req.params.docType, res);
    if (!config) {
      return;
    }

    const parsed = config.schema.safeParse(getPayload(req.body));
    if (!parsed.success) {
      res.status(400).json({
        error: "Datos invalidos para el documento solicitado.",
        details: parsed.error.flatten(),
      });
      return;
    }

    const datos = config.componerDatos(parsed.data);
    const html = generarHtml(datos, config);
    res.type("html").send(html);
  } catch (err: any) {
    console.error(`Error en /api/${req.params.docType}/preview:`, err.message);
    res.status(500).json({ error: err.message || "Error al generar preview." });
  }
});

documentRouter.post("/:docType/pdf", async (req, res) => {
  try {
    const config = getConfigOrRespond(req.params.docType, res);
    if (!config) {
      return;
    }

    const parsed = config.schema.safeParse(getPayload(req.body));
    if (!parsed.success) {
      res.status(400).json({
        error: "Datos invalidos para el documento solicitado.",
        details: parsed.error.flatten(),
      });
      return;
    }

    const datos = config.componerDatos(parsed.data);
    const pdf = await generarPdf(datos, config);
    const baseName = `${config.id}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${baseName}.pdf"`,
    );
    res.send(pdf);
  } catch (err: any) {
    console.error(`Error en /api/${req.params.docType}/pdf:`, err.message);
    res.status(500).json({ error: err.message || "Error al generar PDF." });
  }
});
