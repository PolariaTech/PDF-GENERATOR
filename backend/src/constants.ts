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
