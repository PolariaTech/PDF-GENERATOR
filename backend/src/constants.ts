import { DatosFijos } from "./types";

// Precio de OpenAI por millon de tokens (USD). Verificado en openai.com/api/pricing.
// Si OpenAI cambia el precio o migras de modelo, se actualiza aqui, en un solo lugar.
export const PRECIO_GPT4OMINI = {
  modelo: "gpt-4o-mini",
  usdPorMillonEntrada: 0.15,
  usdPorMillonSalida: 0.6,
};

// Bloque de horas FIJO. No se extrae del .md, no cambia mes a mes.
// Si el equipo cambia su distribucion de tiempo, se edita aqui una sola vez.
export const HORAS_FIJAS: DatosFijos = {
  horas: {
    total: 120,
    segmentos: [
      {
        nombre: "Proyectos (3 objetivos)",
        pct: 65,
        horas: "78",
        color: "#0b1430",
        mostrarPct: true,
      },
      {
        nombre: "Reuniones",
        pct: 8,
        horas: "9.6",
        color: "#94a3c4",
        mostrarPct: false,
      },
      {
        nombre: "Incidencias",
        pct: 11,
        horas: "13.2",
        color: "#e08a2e",
        mostrarPct: false,
      },
      {
        nombre: "Personalizaciones",
        pct: 11,
        horas: "13.2",
        color: "#8b5cf6",
        mostrarPct: false,
      },
      {
        nombre: "Team building",
        pct: 5,
        horas: "6",
        color: "#ec4899",
        mostrarPct: false,
      },
    ],
  },
};

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
