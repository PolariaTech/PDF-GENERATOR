import { EpicaData } from "./config";

export const epicaSampleData: EpicaData = {
  periodo: "JUNIO-JULIO",
  fechaInicio: "22 JUN",
  fechaFin: "20 JUL",
  duracion: "4 SEMANAS",
  epicas: [
    {
      nombreCorto: "Bodega Fria v2.0",
      subtitulo: "MEJORA DE OPERACIONES",
      responsable: "LUCHO",
      objetivo:
        "Desarrollar la aplicación web v2.0 para la bodega fría, mejorando la gestión de inventarios y evitando errores de duplicidad y concurrencia en el proceso.",
      alcance:
        "Implementar módulos de autenticación, mapa de bodega, ventas, transporte y reportería, asegurando un flujo operativo sin conflictos de datos.",
      kpis: ["100% MODULOS", "1 FLUJO COMPLETO", "9 ROLES FUNCIONANDO"],
      resultadoEsperado:
        "El 100% de los módulos operativos en producción, con un flujo de trabajo completo y sin conflictos en el manejo de datos de inventario.",
      riesgo:
        "El principal riesgo es no lograr el despliegue completo de los módulos, lo que podría afectar la operación de la bodega fría y generar retrasos en el servicio.",
    },
    {
      nombreCorto: "Mateo v2.0",
      subtitulo: "CONSULTAS HUMANIZADAS",
      responsable: "MAURO",
      objetivo:
        "Desarrollar una capacidad de consulta determinista en Mateo, permitiendo respuestas precisas y humanizadas a través de WhatsApp para los usuarios.",
      alcance:
        "Conectar 6 vistas normalizadas de Supabase para consultas sobre inventarios, compras y ventas, garantizando respuestas exactas y naturales.",
      kpis: ["6 VISTAS CONECTADAS", "90% PRECISION", "<5S RESPUESTA"],
      resultadoEsperado:
        "Obtener respuestas exactas y naturales en WhatsApp sobre Kardex, inventarios, compras y ventas, mejorando la experiencia del usuario.",
      riesgo:
        "El riesgo principal es no alcanzar la precisión deseada en las respuestas, lo que podría llevar a confusiones y decisiones erróneas por parte de los usuarios.",
    },
    {
      nombreCorto: "Mateo Support v1.2",
      subtitulo: "AUTOMATIZACION DE TICKETS",
      responsable: "DANI",
      objetivo:
        "Implementar Mateo Support para gestionar tickets automáticamente, permitiendo a los usuarios reportar problemas sin intervención manual.",
      alcance:
        "Desplegar módulos que permitan leer imágenes, consultar documentación y registrar tickets en Linear de forma autónoma desde WhatsApp.",
      kpis: ["3/3 MODULOS", "90% TICKETS CORRECTOS", "90% CONSULTAS CORRECTAS"],
      resultadoEsperado:
        "Mateo Support operando en producción, gestionando tickets y consultas de manera autónoma y eficiente, mejorando el soporte al usuario.",
      riesgo:
        "El riesgo principal es que los módulos no funcionen como se espera, lo que podría generar una carga adicional en el equipo de soporte y desorganización en la gestión de tickets.",
    },
  ],
  equipo: {
    quien:
      "Equipo enfocado (3 personas) - Lucho, Mauro y Dani, un objetivo cada uno",
    cuando: "22 jun a 20 jul, 4 semanas (28 dias)",
    donde: "Producción, WhatsApp, Linear, clientes Polaria / TCI JBR",
    como: "n8n, Cloudinary, Supabase",
  },
  riesgoTransversal: {
    texto:
      "El riesgo que afecta a todas las épicas es la posibilidad de no cumplir con los plazos de entrega, lo que podría generar retrasos en la operación y afectar la satisfacción del cliente.",
    mitigacion:
      "Se mitigará este riesgo estableciendo revisiones periódicas del avance de cada épica y priorizando las tareas críticas para asegurar el cumplimiento de los plazos.",
  },
};
