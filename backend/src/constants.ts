export interface SegmentoHoras {
  nombre: string;
  pct: number;
  horas: string;
  color: string;
  mostrarPct: boolean;
}

export interface DatosFijos {
  horas: {
    total: number;
    segmentos: SegmentoHoras[];
  };
}

// Precio de OpenAI por millon de tokens (USD). Verificado en openai.com/api/pricing.
// Si OpenAI cambia el precio o migras de modelo, se actualiza aqui, en un solo lugar.
export const PRECIO_GPT4OMINI = {
  modelo: "gpt-4o-mini",
  usdPorMillonEntrada: 0.15,
  usdPorMillonSalida: 0.6,
};

// gpt-5.4-mini: usado por sprint-fin/sprint-inicio (config.ts, campo
// precioModelo) en vez de PRECIO_GPT4OMINI. Confirmado el 2026-08-11: con
// varios miembros por sprint, cada uno con varios campos de texto a rango de
// caracteres exacto, gpt-4o-mini devolvia "finish_reason: stop" con solo 1 de
// 3 miembros -- no era un corte por limite de tokens, el modelo "creia" que
// esa respuesta parcial ya estaba completa. gpt-5.4-mini (y gpt-4o) resuelven
// los 3 miembros de forma consistente en el mismo intento. epica sigue en
// PRECIO_GPT4OMINI (menos miembros por documento, no reprodujo el problema).
export const PRECIO_GPT54MINI = {
  modelo: "gpt-5.4-mini",
  usdPorMillonEntrada: 0.75,
  usdPorMillonSalida: 4.5,
};

// Bloque de horas FIJO, en base MENSUAL (4 semanas). No se extrae del .md,
// no cambia mes a mes. Si el equipo cambia su distribucion de tiempo, se
// edita aqui una sola vez (mantener el total y cada "horas" en base mensual).
//
// Team building sigue oculto temporalmente (2026-07-06): sus 24h siguen
// redistribuidas dentro de Proyectos/Incidencias. Personalizaciones se
// reactivo el 2026-07-20 con horas reales (no el valor generico anterior de
// 52.8h): Daniel 47.25h (cronograma real del ciclo, ver
// CRONOGRAMA_20JUL-16AGO_2026.md en D:\POLARIA) + Mauro 48h (30% de su
// capacidad mensual de 160h) + Lucho 0h = 95.25h, redondeado a 95.3h. Esas
// horas se le restaron a Proyectos e Incidencias en la misma proporcion
// 85.53%/14.47% (peso 312 vs 52.8) con la que se les habia sumado al
// ocultar Personalizaciones. Si Personalizaciones vuelve a ocultarse o su
// valor cambia otra vez, recalcular Proyectos/Incidencias con esa misma
// proporcion para mantener el total en 480h.
export const HORAS_FIJAS: DatosFijos = {
  horas: {
    total: 480,
    segmentos: [
      {
        nombre: "Proyectos (3 objetivos)",
        pct: 62,
        horas: "296.2",
        color: "#0b1430",
        mostrarPct: true,
      },
      {
        nombre: "Reuniones",
        pct: 8,
        horas: "38.4",
        color: "#94a3c4",
        mostrarPct: false,
      },
      {
        nombre: "Incidencias",
        pct: 10,
        horas: "50.1",
        color: "#e08a2e",
        mostrarPct: false,
      },
      {
        nombre: "Personalizaciones",
        pct: 20,
        horas: "95.3",
        color: "#8b5cf6",
        mostrarPct: false,
      },
      // {
      //   nombre: "Team building",
      //   pct: 5,
      //   horas: "24",
      //   color: "#ec4899",
      //   mostrarPct: false,
      // },
    ],
  },
};

// Formatea un numero de horas sin decimales innecesarios (78 en vez de 78.0).
export function formatearHoras(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

// Escala HORAS_FIJAS (base mensual) a otro periodo, ej. una semana del sprint.
// Mantiene los porcentajes y solo recalcula el total y las horas de cada segmento.
export function escalarHoras(horasFijas: DatosFijos, factor: number): DatosFijos {
  return {
    horas: {
      total: Math.round(horasFijas.horas.total * factor),
      segmentos: horasFijas.horas.segmentos.map((segmento) => ({
        ...segmento,
        horas: formatearHoras(Number(segmento.horas) * factor),
      })),
    },
  };
}

// Paletas por epica. Se asignan en orden (epica 1 -> azul, 2 -> teal, 3 -> coral...).
// Soporta N epicas; si hay mas que paletas, cicla.
export interface Paleta {
  icono: string;
  colorAccent: string;
  colorBgIcon: string;
  colorBgBadge: string;
  colorBgResult: string;
}

export const PALETAS: Paleta[] = [
  {
    icono: "\u2744",
    colorAccent: "#2563eb",
    colorBgIcon: "#eff4ff",
    colorBgBadge: "#dbe7ff",
    colorBgResult: "#eaf1ff",
  }, // azul
  {
    icono: "\u25cb",
    colorAccent: "#0d9488",
    colorBgIcon: "#ecfdf8",
    colorBgBadge: "#cdf3e9",
    colorBgResult: "#e9faf3",
  }, // teal
  {
    icono: "\u29c9",
    colorAccent: "#dc2626",
    colorBgIcon: "#fef2f2",
    colorBgBadge: "#fde2e2",
    colorBgResult: "#fdeeee",
  }, // coral/rojo
  {
    icono: "\u25c8",
    colorAccent: "#7c3aed",
    colorBgIcon: "#f5f1fe",
    colorBgBadge: "#e7dcfb",
    colorBgResult: "#f1eafe",
  }, // morado
  {
    icono: "\u25b2",
    colorAccent: "#c2410c",
    colorBgIcon: "#fff4ed",
    colorBgBadge: "#fde0cc",
    colorBgResult: "#fef0e6",
  }, // ambar
];

export function asignarPaleta(indice: number): Paleta {
  return PALETAS[indice % PALETAS.length];
}

// Layout de tarjetas (cards-grid) compartido por epica/sprint-inicio/sprint-fin:
// 1-4 tarjetas -> 1 fila con esa cantidad de columnas (igual que hoy); 5-6 ->
// 2 filas x 3 columnas; 7-8 -> 2 filas x 4 columnas, ensanchando la pagina para
// que la tarjeta no vuelva a angostarse solo por estar de nuevo en 4 columnas
// (se mantiene el mismo ancho de tarjeta que en el caso de 3 columnas). El
// ancho se resuelve aca, ANTES de renderizar (a diferencia del alto, que se mide
// despues porque depende de texto que envuelve de forma impredecible) --
// determinista porque solo depende de la cantidad de tarjetas, ya conocida.
const CARD_GAP_PX = 16;
const BODY_PADDING_PX = 24; // a cada lado
const PAGINA_ANCHO_BASE_PX = 1240;

function anchoTarjeta(columnas: number, anchoPagina: number): number {
  return (anchoPagina - BODY_PADDING_PX * 2 - CARD_GAP_PX * (columnas - 1)) / columnas;
}

export interface GridCards {
  columns: number;
  rows: number;
  pdfWidth: number;
}

export function resolverGridCards(count: number): GridCards {
  if (count <= 4) {
    return { columns: Math.max(count, 1), rows: 1, pdfWidth: PAGINA_ANCHO_BASE_PX };
  }
  if (count <= 6) {
    return { columns: 3, rows: 2, pdfWidth: PAGINA_ANCHO_BASE_PX };
  }
  // 7-8: mismo ancho de tarjeta que el caso de 3 columnas, pero con 4
  // columnas -- se despeja el ancho de pagina necesario para lograrlo.
  const columns = 4;
  const anchoObjetivo = anchoTarjeta(3, PAGINA_ANCHO_BASE_PX);
  const pdfWidth = Math.round(
    anchoObjetivo * columns + CARD_GAP_PX * (columns - 1) + BODY_PADDING_PX * 2,
  );
  return { columns, rows: 2, pdfWidth };
}

// Arma el string conic-gradient para un donut a partir de segmentos
// {color, valor}. Compartido entre sprint (planeados/agregados, por estado) y
// epica (sprints cumplidos/no cumplidos del ciclo) para no duplicar la logica.
export function construirGradiente(
  segmentos: { color: string; valor: number }[],
  total: number,
): string {
  if (total <= 0) {
    return "conic-gradient(#e3e7ef 0% 100%)";
  }
  let acumulado = 0;
  const partes = segmentos
    .filter((seg) => seg.valor > 0)
    .map((seg) => {
      const inicio = (acumulado / total) * 100;
      acumulado += seg.valor;
      const fin = (acumulado / total) * 100;
      return `${seg.color} ${inicio}% ${fin}%`;
    });
  return `conic-gradient(${partes.join(", ")})`;
}

// Compara los headings "### <NOMBRE>" del markdown fuente (uno por miembro,
// bajo "## Trabajo por miembro" -- ver Consolidar Markdown del Sprint en n8n)
// contra los members que la IA realmente devolvio, para detectar tanto
// miembros omitidos como duplicados que Zod no puede atrapar (un array con
// menos o mas entradas de las esperadas sigue siendo un schema valido).
// Confirmado en produccion 2026-08-11: con markdown de 3 miembros (~17K
// tokens de entrada), gpt-4o-mini devolvio solo 1-2 -- casi siempre omitiendo
// al ultimo/mas denso -- sin ningun error, y "equipo.quien" en la misma
// respuesta sí enumeraba a los 3, confirmando que el modelo "sabia" que
// existian pero no los incluyo en el array. El mismo dia, ya con
// gpt-5.4-mini, se vio el caso inverso en otra ejecucion: devolvio 4 members
// con uno duplicado exacto (mismo nombre, mismo contenido) -- de ahi que este
// chequeo tambien valide duplicados, no solo faltantes. Compartido entre
// sprint-inicio y sprint-fin (unicos dos documentos con "### <miembro>" en su
// markdown).
export function verificarMiembrosCompletos(
  markdown: string,
  members: { name: string }[],
): string | null {
  const nombresEsperados = Array.from(markdown.matchAll(/^### (.+)$/gm)).map((m) =>
    m[1].trim(),
  );
  if (nombresEsperados.length === 0) return null;

  const nombresExtraidosLista = members.map((m) => m.name.trim().toLowerCase());
  const nombresExtraidos = new Set(nombresExtraidosLista);
  const faltantes = nombresEsperados.filter(
    (nombre) => !nombresExtraidos.has(nombre.toLowerCase()),
  );
  if (faltantes.length > 0) {
    return `El documento fuente tiene ${nombresEsperados.length} miembros (${nombresEsperados.join(", ")}) pero tu respuesta solo incluyo ${members.length}. Faltan por completo: ${faltantes.join(", ")}. Debes incluir a TODOS los miembros mencionados en el documento bajo "## Trabajo por miembro", con su objetivo/desviaciones/issues completos -- ninguno puede quedar omitido.`;
  }

  const conteo = new Map<string, number>();
  for (const nombre of nombresExtraidosLista) {
    conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
  }
  const duplicados = Array.from(conteo.entries())
    .filter(([, veces]) => veces > 1)
    .map(([nombre]) => nombre);
  if (duplicados.length > 0) {
    return `Tu respuesta incluyo a ${duplicados.join(", ")} repetido(s) mas de una vez en "members". El documento fuente tiene exactamente ${nombresEsperados.length} miembros (${nombresEsperados.join(", ")}), cada uno debe aparecer UNA sola vez en el array "members" -- elimina la entrada duplicada.`;
  }

  return null;
}
