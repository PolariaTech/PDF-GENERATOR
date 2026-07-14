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
// Entrada cacheada: $0.025/millon (no se usa en el calculo de costo actual, que no
// distingue tokens cacheados; queda anotado por si se agrega esa granularidad despues).
export const PRECIO_GPT5MINI = {
  modelo: "gpt-5-mini",
  usdPorMillonEntrada: 0.25,
  usdPorMillonSalida: 2.0,
};

// Bloque de horas FIJO, en base MENSUAL (4 semanas). No se extrae del .md,
// no cambia mes a mes. Si el equipo cambia su distribucion de tiempo, se
// edita aqui una sola vez (mantener el total y cada "horas" en base mensual).
//
// Personalizaciones y Team building estan ocultos temporalmente (2026-07-06):
// sus 76.8h (52.8 + 24) se redistribuyeron proporcionalmente al peso previo de
// Proyectos e Incidencias (312 vs 52.8). Para revertir: descomentar esos dos
// segmentos y devolver Proyectos a pct:65/horas:"312" e Incidencias a
// pct:11/horas:"52.8".
export const HORAS_FIJAS: DatosFijos = {
  horas: {
    total: 480,
    segmentos: [
      {
        nombre: "Proyectos (3 objetivos)",
        pct: 79,
        horas: "377.7",
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
        pct: 13,
        horas: "63.9",
        color: "#e08a2e",
        mostrarPct: false,
      },
      // {
      //   nombre: "Personalizaciones",
      //   pct: 11,
      //   horas: "52.8",
      //   color: "#8b5cf6",
      //   mostrarPct: false,
      // },
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
