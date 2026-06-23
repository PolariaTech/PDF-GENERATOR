import { chromium } from "playwright";
import Handlebars from "handlebars";
import fs from "fs";
import path from "path";
import { DatosExtraidos, DatosResumen } from "./types";
import { HORAS_FIJAS, asignarPaleta } from "./constants";

const TEMPLATE_PATH = path.join(__dirname, "templates", "resumen-epica.template.html");

let compiledTemplate: HandlebarsTemplateDelegate | null = null;

function getTemplate(): HandlebarsTemplateDelegate {
  if (!compiledTemplate) {
    const source = fs.readFileSync(TEMPLATE_PATH, "utf-8");
    compiledTemplate = Handlebars.compile(source);
  }
  return compiledTemplate;
}

// Combina datos extraidos + paleta por epica + horas fijas -> objeto completo
export function componerDatos(extraidos: DatosExtraidos): DatosResumen {
  const epicasConColor = extraidos.epicas.map((ep, i) => {
    const paleta = asignarPaleta(i);
    return { ...ep, ...paleta };
  });

  return {
    ...extraidos,
    epicas: epicasConColor,
    ...HORAS_FIJAS
  };
}

export function generarHtml(datos: DatosResumen): string {
  return getTemplate()(datos);
}

export async function generarPdf(datos: DatosResumen): Promise<Buffer> {
  const html = generarHtml(datos);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    // espera extra para asegurar que la fuente web cargue antes de imprimir
    await page.waitForTimeout(500);

    const pdf = await page.pdf({
      printBackground: true,
      width: "1240px",   // 1240 contenido + 24*2 padding
      height: "1050px",
      pageRanges: "1"
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
