import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { documentRouter, sendError, apiKeyAuth } from "./api/document.routes";
import { sprintHistoricoRouter } from "./documents/sprint/historico.routes";
import { closeBrowser } from "./core/generators/pdf.generator";

if (!process.env.OPENAI_API_KEY) {
  console.error(
    "Falta la variable de entorno OPENAI_API_KEY. Definila en backend/.env antes de arrancar el servidor.",
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Clase dedicada (en vez de un Error generico) para que el error-handler de
// abajo pueda distinguirla de forma robusta (instanceof) de cualquier otro
// error que pase por la cadena de middlewares, sin depender de matchear texto.
class ArchivoInvalidoError extends Error {}

const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB, suficiente para un .md
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".md") || file.mimetype === "text/markdown" || file.mimetype === "text/plain") {
      cb(null, true);
    } else {
      cb(new ArchivoInvalidoError("Solo se aceptan archivos .md"));
    }
  }
});

// Antes esto era cors() a secas, que refleja cualquier Origin (equivalente a
// "*"): cualquier sitio abierto en el navegador de un usuario podia golpear
// la API vulnerando localhost. Restringimos a un allowlist explicito, pero
// dejamos pasar requests SIN header Origin (curl, o un caller servidor-a-
// servidor como n8n, que no aplica CORS) y el origen "null" que mandan los
// navegadores cuando frontend/index.html se abre como file:// (ver CLAUDE.md).
const CORS_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origen) => origen.trim())
  : [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`, "null"];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origen no permitido por CORS"));
    },
  }),
);
app.use(express.json({ limit: "2mb" }));
// Autenticacion por API key (no-op si API_KEY no esta definida en .env, ver
// apiKeyAuth). Va antes de multer para no procesar archivos subidos por un
// caller no autenticado cuando la instancia esta expuesta publicamente.
app.use("/api", apiKeyAuth);
app.use("/api/:docType/extraer", upload.single("archivo"));
app.use("/api", sprintHistoricoRouter);
app.use("/api", documentRouter);
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.sendStatus(204);
});
app.use(express.static(path.join(__dirname, "..", "..", "frontend")));

// Middleware de manejo de errores de Multer (4 argumentos: Express lo reconoce
// como error-handler por la arity, no por el nombre). Sin esto, un archivo
// invalido o demasiado grande producia un 500 en HTML por defecto, rompiendo
// el res.json() que espera el frontend/los workflows de n8n.
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    console.error("Error de Multer al procesar el archivo subido:", err);
    sendError(res, status, "UPLOAD_ERROR", "Error al procesar el archivo subido.");
    return;
  }

  // El fileFilter de multer rechaza con `cb(new ArchivoInvalidoError(...))`;
  // no es instancia de MulterError pero es el mismo tipo de fallo de subida.
  if (err instanceof ArchivoInvalidoError) {
    console.error("Error de validacion de archivo subido:", err);
    sendError(res, 400, "UPLOAD_ERROR", "Error al procesar el archivo subido.");
    return;
  }

  next(err);
});

// Handler generico final: cualquier otro error no capturado cae aca. Loguea
// el error completo en servidor y responde con la misma forma estandar que
// el resto de la API, para que un workflow de automatizacion siempre reciba
// JSON parseable en vez de un 500 en HTML.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error no manejado:", err);
  if (res.headersSent) {
    return;
  }
  sendError(res, 500, "INTERNAL_ERROR", "Error interno del servidor.");
});

const server = app.listen(PORT, () => {
  console.log(`Servidor de documentos corriendo en http://localhost:${PORT}`);
});

function shutdown(signal: string) {
  console.log(`Recibida ${signal}, cerrando servidor de forma ordenada...`);
  const forceExit = setTimeout(() => {
    console.error("Cierre ordenado colgado, forzando salida del proceso.");
    process.exit(1);
  }, 10000);

  closeBrowser()
    .catch((err) => {
      console.error("Error al cerrar el browser de Playwright:", err);
    })
    .finally(() => {
      server.close(() => {
        clearTimeout(forceExit);
        process.exit(0);
      });
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
