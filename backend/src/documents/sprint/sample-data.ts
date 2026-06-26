import { SprintData } from "./config";

export const sprintSampleData: SprintData = {
  sprintName: "1 JUNIO-JULIO",
  dateStart: "2026-06-22",
  dateEnd: "2026-06-29",
  weekNumber: "1",
  members: [
    {
      name: "Daniel De Jesus Galvis Zambrano",
      initials: "DG",
      projects: [
        {
          name: "Mateo Support - Desplegar v1.2.0 en producción",
          issues: [
            {
              title:
                "MEJORA-004: Agregar discriminador channel a Verificar Usuario Registrado",
              type: "Improvement",
              priority: "Low",
              status: "Todo",
            },
            {
              title: "Activar Error Handler de Mateo Support en producción",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
            {
              title:
                "Conectar manual de usuario al flujo de consulta de Mateo Support",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
            {
              title: "Consultar el manual antes de crear cada ticket",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
            {
              title:
                'MEJORA-001: Cambiar sessionId a user_phone + timestamp para evitar colisión de contextos"',
              type: "Improvement",
              priority: "Medium",
              status: "Done",
            },
            {
              title:
                "MEJORA-002: Renombrar 3 nodos con nombres genéricos en Mateo Support",
              type: "Improvement",
              priority: "Medium",
              status: "Done",
            },
            {
              title:
                "MEJORA-003: Verificar y corregir Phone Number ID en Error Handler",
              type: "Improvement",
              priority: "High",
              status: "Done",
            },
            {
              title: "Resolver deuda técnica pre-producción de Mateo Support",
              type: "Improvement",
              priority: "Medium",
              status: "In Progress",
            },
            {
              title:
                "Validar RAG con queries de prueba antes de integrar a Mateo",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
            {
              title: "Construir workflow de ingesta de documentos RAG en n8n",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
            {
              title:
                "Crear infraestructura DB para RAG en Supabase (pgvector + tabla + función)",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
            {
              title:
                "Migrar base de datos operativa de Mateo Support de MySQL a Supabase",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
          ],
        },
      ],
    },
    {
      name: "Mauricio Jose Manjarres Duque",
      initials: "MM",
      projects: [
        {
          name: "Mateo - Desplegar consultas deterministas en Supabase",
          issues: [
            {
              title:
                "Mapeo e Integración de la Vista de Kardex y Facturación - Revisar Flujo IA/Tool",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
            {
              title:
                "Construir Casos de Uso Mateo Polaria — Compras y Ventas (KPI1, KPI2 y KPI3)",
              type: "Feature",
              priority: "Medium",
              status: "Todo",
            },
            {
              title:
                "Mapeo e Integración de Vistas de Ventas y Compras - Revisar Flujo IA/Tool",
              type: "Feature",
              priority: "High",
              status: "Todo",
            },
            {
              title: "Construir Casos de Uso Mateo TCI (KPI1, KPI2 y KPI3)",
              type: "Feature",
              priority: "Medium",
              status: "Done",
            },
          ],
        },
      ],
    },
    {
      name: "LUIS DANIEL CANTILLO OSPINO",
      initials: "LC",
      projects: [
        {
          name: "Polaria App - Construir aplicación web v2.0",
          issues: [
            {
              title:
                "Esquema BD operativo V2 (bodegas, catálogos, órdenes, warehouse_state)",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
            {
              title: "Configurar multi-tenant y RLS base en Supabase",
              type: "Feature",
              priority: "Medium",
              status: "Done",
            },
            {
              title:
                "Base frontend Next.js y shell multi-rol (dashboard + configurador)",
              type: "Feature",
              priority: "High",
              status: "In Progress",
            },
            {
              title:
                "Desarrollar módulo de autenticación para Polaria web v2.0",
              type: "Feature",
              priority: "High",
              status: "Done",
            },
            {
              title: "Base backend modular NestJS para Polaria web v2.0",
              type: "Feature",
              priority: "Medium",
              status: "Done",
            },
          ],
        },
      ],
    },
  ],
};
