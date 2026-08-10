import { SprintInicioData } from "./config";

export const sprintInicioSampleData: SprintInicioData = {
  sprintName: "1 JUNIO-JULIO 2026",
  dateStart: "Jun 22",
  dateEnd: "Jun29",
  weekNumber: "1",
  horas: {
    segmentos: [
      { nombre: "Proyectos (3 objetivos)", horas: 94.4 },
      { nombre: "Reuniones", horas: 9.6 },
      { nombre: "Incidencias", horas: 16 },
    ],
  },
  members: [
    {
      name: "LUIS DANIEL CANTILLO OSPINO",
      initials: "LC",
      objetivo:
        "Luis levantara la base operativa de la nueva app web de Polaria version 2.0. Disenara el esquema de base de datos para bodegas, catalogos, ordenes y estado de almacen, y configurara el modelo multi-tenant con seguridad a nivel de fila en Supabase. En paralelo construira el backend modular en NestJS, el modulo de autenticacion y avanzara en el shell multi-rol del frontend en Next.js, dejando la base lista para que el equipo conecte los modulos de compras y configuracion el proximo sprint.",
      projects: [
        {
          name: "Polaria App - Construir aplicación web v2.0",
          issues: [
            {
              title:
                "Esquema BD operativo V2 (bodegas, catálogos, órdenes, warehouse_state)",
              status: "Todo",
            },
            {
              title: "Configurar multi-tenant y RLS base en Supabase",
              status: "Todo",
            },
            {
              title:
                "Base frontend Next.js y shell multi-rol (dashboard + configurador)",
              status: "Todo",
            },
            {
              title:
                "Desarrollar módulo de autenticación para Polaria web v2.0",
              status: "Todo",
            },
          ],
        },
      ],
    },
    {
      name: "Mauricio Jose Manjarres Duque",
      initials: "MM",
      objetivo:
        "Mauricio se enfocara en dejar listas las consultas deterministas de Mateo para Polaria y para el cliente TCI. Mapeara e integrara las vistas de kardex, facturacion, ventas y compras revisando de cerca el flujo entre la inteligencia artificial y las herramientas conectadas. Construira los casos de uso principales para los tres indicadores clave de cada cliente, validando que cada respuesta del asistente coincida con los datos reales antes de marcarlos como completados para el cierre del sprint.",
      projects: [
        {
          name: "Mateo - Desplegar consultas deterministas en Supabase",
          issues: [
            {
              title:
                "Mapeo e Integración de la Vista de Kardex y Facturación - Revisar Flujo IA/Tool",
              status: "Todo",
            },
            {
              title:
                "Construir Casos de Uso Mateo Polaria — Compras y Ventas (KPI1, KPI2 y KPI3)",
              status: "Todo",
            },
            {
              title: "Construir Casos de Uso Mateo TCI (KPI1, KPI2 y KPI3)",
              status: "Todo",
            },
          ],
        },
      ],
    },
    {
      name: "Daniel De Jesus Galvis Zambrano",
      initials: "DG",
      objetivo:
        "Daniel concentrara su semana en preparar a Mateo Support para produccion sobre Supabase. Migrara la base de datos operativa desde MySQL, construira la infraestructura de RAG con pgvector y conectara el manual de usuario al flujo de consulta para que cada ticket se resuelva con contexto real antes de escalar. Tambien activara el manejador de errores en produccion, corregira el identificador de numero telefonico y dejara resuelta la deuda tecnica pendiente antes del despliegue de la version 1.2.0.",
      projects: [
        {
          name: "Mateo Support - Desplegar v1.2.0 en producción",
          issues: [
            {
              title:
                "MEJORA-004: Agregar discriminador channel a Verificar Usuario Registrado",
              status: "Todo",
            },
            {
              title: "Activar Error Handler de Mateo Support en producción",
              status: "Todo",
            },
            {
              title:
                "Conectar manual de usuario al flujo de consulta de Mateo Support",
              status: "Todo",
            },
            {
              title: "Consultar el manual antes de crear cada ticket",
              status: "Todo",
            },
            {
              title:
                "Migrar base de datos operativa de Mateo Support de MySQL a Supabase",
              status: "Todo",
            },
          ],
        },
      ],
      personalizacion: [
        { title: "Ajustar plantilla de factura para cliente Fridem", status: "In Progress" },
        { title: "Configurar acceso VPN puntual para soporte externo", status: "Todo" },
        { title: "Revisar integración puntual con bodega externa", status: "Done" },
      ],
    },
  ],
  equipo: {
    quien:
      "Equipo enfocado (3 personas) - Dani, Mauro y Lucho, un proyecto cada uno",
    cuando: "22 jun a 29 jun, 1 semana (7 dias)",
    donde: "Produccion, WhatsApp, Linear, clientes Mateo Support / Polaria",
    como: "NestJS, Supabase, n8n, Next.js, Linear",
  },
  riesgoTransversal: {
    texto:
      "El riesgo de este sprint es que aparezcan incidencias no planeadas que consuman las horas reservadas para eso, dejando menos tiempo del previsto para avanzar en los proyectos de cada persona.",
    mitigacion:
      "Ese tiempo para incidencias ya esta reservado de antemano como colchon, justo para poder absorber ese riesgo sin afectar lo planeado en Proyectos.",
  },
};
