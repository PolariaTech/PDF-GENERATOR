import fs from "fs";
import Handlebars from "handlebars";
import path from "path";
import { Browser, chromium } from "playwright";
import { DocumentConfig, DocumentTemplate } from "../../documents/types";

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

function resolveTemplate(
  config: DocumentConfig<any>,
  templateKey?: string,
): DocumentTemplate {
  const key =
    templateKey && config.templates[templateKey]
      ? templateKey
      : config.defaultTemplate;
  return config.templates[key];
}

function getTemplate(templatePath: string): HandlebarsTemplateDelegate {
  const resolvedPath = resolveTemplatePath(templatePath);
  const cached = templateCache.get(resolvedPath);
  if (cached) {
    return cached;
  }

  const source = fs.readFileSync(resolvedPath, "utf-8");
  const compiled = Handlebars.compile(source);
  templateCache.set(resolvedPath, compiled);
  return compiled;
}

function resolveTemplatePath(templatePath: string): string {
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  const distSegment = `${path.sep}dist${path.sep}`;
  if (templatePath.includes(distSegment)) {
    const srcPath = templatePath.replace(distSegment, `${path.sep}src${path.sep}`);
    if (fs.existsSync(srcPath)) {
      return srcPath;
    }
  }

  return templatePath;
}

export function generarHtml<T>(
  datos: T,
  config: DocumentConfig<any>,
  templateKey?: string,
): string {
  const template = resolveTemplate(config, templateKey);
  return getTemplate(template.path)(datos);
}

// ---------------------------------------------------------------------------
// Browser singleton
// ---------------------------------------------------------------------------
// Lanzar un chromium.launch() por request es el cuello de botella critico bajo
// carga concurrente (cada launch es un proceso de Chromium completo -> riesgo
// de OOM). En su lugar mantenemos un unico browser a nivel de modulo, lanzado
// de forma perezosa la primera vez que se necesita, y cada request abre solo
// su propio BrowserContext/Page (mucho mas baratos) sobre ese browser.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch().catch((err) => {
      // Si el lanzamiento falla, no dejamos la promesa rota cacheada: el
      // siguiente request debe poder reintentar el launch desde cero.
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

/**
 * Cierra el browser singleton, si llego a lanzarse. Pensado para usarse desde
 * el manejo de apagado ordenado del proceso (SIGTERM/SIGINT en server.ts). Si
 * el browser nunca se lanzo (no hubo ningun render todavia), resuelve sin
 * hacer nada.
 */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) {
    return;
  }
  const pendingBrowserPromise = browserPromise;
  browserPromise = null;
  const browser = await pendingBrowserPromise;
  await browser.close();
}

// ---------------------------------------------------------------------------
// Cola de concurrencia (semaforo hecho a mano, sin dependencias nuevas)
// ---------------------------------------------------------------------------
// Cada render concurrente es un BrowserContext + Page nuevos sobre el mismo
// browser: son livianos comparados con un browser completo, pero siguen
// consumiendo memoria/CPU (fuentes, layout, rasterizado a PDF). Limitamos a 4
// renders simultaneos como compromiso entre throughput y uso de memoria en un
// server que probablemente corre en una instancia modesta (1-2 vCPU); es facil
// de subir/bajar segun el hardware real sin tocar el resto de la logica.
const MAX_CONCURRENT_RENDERS = 4;
let activeRenders = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeRenders++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRenders--;
  const next = waitQueue.shift();
  if (next) {
    next();
  }
}

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------
// Acotado pero generoso: el setContent puede depender de CDNs externos (Google
// Fonts, Tabler Icons) y el pdf() de documentos largos (sprint/detail con
// muchos issues). 15s evita que un request cuelgue el slot de la cola para
// siempre sin ser tan corto que corte renders legitimos de documentos grandes.
const RENDER_TIMEOUT_MS = 15_000;

/**
 * page.pdf() no expone una opcion `timeout` nativa (a diferencia de
 * setContent, que si la tiene) porque no es una "accion" de Playwright sino
 * un comando directo al protocolo CDP. Envolvemos la promesa manualmente para
 * darle el mismo timeout acotado y evitar que un render colgado retenga un
 * slot de la cola indefinidamente.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout de ${ms}ms superado en ${label}`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function generarPdf<T>(
  datos: T,
  config: DocumentConfig<any>,
  templateKey?: string,
): Promise<Buffer> {
  const template = resolveTemplate(config, templateKey);
  const html = generarHtml(datos, config, templateKey);
  const width = template.pdf?.width ?? "1240px";
  const height = template.pdf?.height ?? "1050px";
  const viewportWidth = Number.parseInt(width, 10) || 1240;
  const viewportHeight = Number.parseInt(height, 10) || 1050;

  await acquireSlot();
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
    });
    try {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: "load", timeout: RENDER_TIMEOUT_MS });

      // Espera deterministica a que las fuentes terminen de cargar (sea cual sea
      // su origen: Google Fonts, Tabler Icons, etc.), en vez de un
      // waitForTimeout(300) fijo a ciegas que podia quedarse corto o de mas.
      await page.evaluate(() => document.fonts.ready);

      // El contenido (ej. la lista de issues de sprint/detail) puede ser mas chico o
      // mas grande que el alto configurado en la plantilla. Medimos el alto real
      // renderizado y lo usamos tal cual, para que la pagina se ajuste al contenido
      // real en ambos sentidos (crece si no entra, se achica si sobra espacio) en
      // vez de quedar con blanco de mas o recortar contenido. Usamos
      // document.body.scrollHeight, NO document.documentElement.scrollHeight: el
      // <html> siempre se estira para llenar al menos el viewport (comportamiento
      // por defecto del navegador), asi que nunca reporta menos que el alto del
      // viewport aunque el contenido real sea mas chico — eso rompia el achique.
      const contentHeight = await page.evaluate(() => document.body.scrollHeight);
      // Colchon minimo antes de pasarle el alto a page.pdf(): un finalHeight EXACTO
      // (sin margen) puede caer justo en el limite de una pagina para el motor de
      // impresion de Chromium, que a veces mide el contenido con una fraccion de
      // pixel de mas que el scrollHeight medido en pantalla. Cuando eso pasa, el
      // ultimo bloque completo del documento (ej. el footer-row entero, no solo el
      // pixel de mas) se corre a una "pagina 2" fantasma que pageRanges: "1"
      // descarta en silencio -- reproducido y confirmado con template-resumen-inicio
      // al agregar la seccion de personalizacion (contentHeight=880 exacto perdia
      // el footer completo; +2px ya lo resolvia). 4px es margen de sobra sin crear
      // espacio en blanco visible.
      const finalHeight = contentHeight + 4;

      // El await de page.pdf() debe resolver ANTES de cerrar el render surface que
      // lo genero (antes era browser.close(), ahora es context.close() porque el
      // browser es un singleton compartido entre requests) — cerrarlo antes de que
      // esta promesa resuelva rompe la llamada al protocolo CDP de forma
      // intermitente y puede tirar el browser compartido para todos los requests
      // en curso. El context.close() vive en el finally de abajo, nunca antes de
      // este await.
      const pdf = await withTimeout(
        page.pdf({
          printBackground: true,
          width,
          height: `${finalHeight}px`,
          pageRanges: "1",
        }),
        RENDER_TIMEOUT_MS,
        "page.pdf()",
      );
      return pdf;
    } finally {
      await context.close();
    }
  } finally {
    releaseSlot();
  }
}
