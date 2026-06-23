// Esquema de datos del Resumen de Epica.
// Es el contrato entre: extraccion por IA -> edicion en frontend -> render del PDF.

export interface KpiPill {
  texto: string; // etiqueta corta para el chip, ej "6/6 VISTAS"
}

export interface Epica {
  nombreCorto: string; // "Bodega Fria v2.0"
  subtitulo: string; // "MIGRACION A SAAS"
  responsable: string; // "LUCHO"
  objetivo: string; // resumen ejecutivo (What + Why condensado)
  alcance: string; // que entra en la epica este mes
  kpis: string[]; // 3 chips cortos del KPI del mes
  resultadoEsperado: string; // frase del criterio de exito / resultado
  riesgo: string; // riesgo principal de la epica
}

export interface SegmentoHoras {
  nombre: string;
  pct: number;
  horas: string;
  color: string;
  mostrarPct: boolean;
}

export interface BloqueEquipo {
  quien: string;
  cuando: string;
  donde: string;
  como: string;
}

export interface RiesgoTransversal {
  texto: string;
  mitigacion: string;
}

// Datos que SI se extraen del .md
export interface DatosExtraidos {
  periodo: string; // "JUNIO-JULIO"
  fechaInicio: string; // "22 JUN"
  fechaFin: string; // "20 JUL"
  duracion: string; // "4 SEMANAS"
  epicas: Epica[]; // 1..N
  equipo: BloqueEquipo;
  riesgoTransversal: RiesgoTransversal;
}

// Consumo de tokens de la llamada a OpenAI en /api/extraer.
// Se calcula en el backend y se devuelve junto a los datos extraidos,
// solo para mostrarlo en pantalla. No se usa para nada mas.
export interface UsoTokens {
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  tokensTotal: number;
  costoEstimadoUsd: number;
}

// Respuesta completa de /api/extraer
export interface RespuestaExtraccion {
  datos: DatosExtraidos;
  uso: UsoTokens;
}

// Datos FIJOS que no cambian mes a mes (no los toca la IA)
export interface DatosFijos {
  horas: {
    total: number;
    segmentos: SegmentoHoras[];
  };
}

// El objeto completo que recibe la plantilla
export type DatosResumen = DatosExtraidos &
  DatosFijos & {
    // paleta asignada por epica (calculada en backend, no por la IA)
    epicas: (Epica & {
      icono: string;
      colorAccent: string;
      colorBgIcon: string;
      colorBgBadge: string;
      colorBgResult: string;
    })[];
  };
