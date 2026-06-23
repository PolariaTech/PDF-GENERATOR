import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { extraerDatos } from "./extractor";
import { componerDatos, generarHtml, generarPdf } from "./renderer";
import { DatosExtraidos } from "./types";

const app = express();
const PORT = process.env.PORT || 3001;

const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB, suficiente para un .md
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".md") || file.mimetype === "text/markdown" || file.mimetype === "text/plain") {
      cb(null, true);
    } else {
      cb(new Error("Solo se aceptan archivos .md"));
    }
  }
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Sirve el frontend estatico
app.use(express.static(path.join(__dirname, "..", "..", "frontend")));

// 1. Extraccion: recibe el .md, devuelve el JSON editable
app.post("/api/extraer", upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibio ningun archivo." });
    }
    const markdown = req.file.buffer.toString("utf-8");
    if (!markdown.trim()) {
      return res.status(400).json({ error: "El archivo esta vacio." });
    }
    const datos = await extraerDatos(markdown);
    res.json(datos);
  } catch (err: any) {
    console.error("Error en /api/extraer:", err.message);
    res.status(500).json({ error: err.message || "Error al extraer los datos." });
  }
});

// 2. Preview: recibe el JSON editado, devuelve el HTML renderizado (para vista previa en iframe)
app.post("/api/preview", (req, res) => {
  try {
    const extraidos = req.body as DatosExtraidos;
    if (!extraidos || !Array.isArray(extraidos.epicas)) {
      return res.status(400).json({ error: "Datos invalidos." });
    }
    const datos = componerDatos(extraidos);
    const html = generarHtml(datos);
    res.type("html").send(html);
  } catch (err: any) {
    console.error("Error en /api/preview:", err.message);
    res.status(500).json({ error: err.message || "Error al generar la vista previa." });
  }
});

// 3. PDF: recibe el JSON editado, devuelve el PDF para descarga
app.post("/api/pdf", async (req, res) => {
  try {
    const extraidos = req.body as DatosExtraidos;
    if (!extraidos || !Array.isArray(extraidos.epicas)) {
      return res.status(400).json({ error: "Datos invalidos." });
    }
    const datos = componerDatos(extraidos);
    const pdf = await generarPdf(datos);

    const nombre = `Resumen_Epica_${(extraidos.periodo || "mes").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
    res.send(pdf);
  } catch (err: any) {
    console.error("Error en /api/pdf:", err.message);
    res.status(500).json({ error: err.message || "Error al generar el PDF." });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Epica PDF Generator corriendo en http://localhost:${PORT}\n`);
});
