# Guía de Integración de Servicios Externos (PHP Document Generator & Backend Boundaries)

Este documento detalla la arquitectura de integración de la capa de **Servicios Externos** (`src/api/servicesExtern/`) de **API Costeo**, especificando la comunicación con el microservicio externo PHP para la generación de reportes y plantillas contables oficiales.

---

## Arquitectura del Límite del Backend (External Boundaries)

En el diseño de la API Costeo, ciertas tareas pesadas de renderizado de archivos estructurados (PDFs de Costeo y sábanas de Excel heredadas) están delegadas a un microservicio externo programado en PHP.
*   **Aislamiento de Recursos**: La generación sincrónica de archivos binarios grandes puede consumir considerables recursos de CPU. Al delegar estas tareas a un microservicio PHP separado (`API_DOCUMENTS_PHP`), se protege el event loop del servidor Node.js/Express, manteniendo una alta concurrencia y un bajo tiempo de respuesta para las capturas de campo en tiempo real.
*   **Plantillas Legacy**: PHP cuenta con librerías nativas adaptadas para rellenar formatos preestablecidos en Excel y PDF solicitados por los auditores de Nicolás/Cicsa. El backend de Express actúa simplemente como un orquestador que recopila los datos de MongoDB y los envía mediante peticiones HTTP estructuradas al generador PHP.

---

## Cliente HTTP de Integración (`api-documents.ts`)

El archivo central `api-documents.ts` ([Ver api-documents.ts](file:///c:/Users/WinterOS/Downloads/api-costeo-prod/api-costeo-prod/src/api/servicesExtern/api-documents.ts)) expone un cliente de Axios configurado dinámicamente:
*   **Base URL**: `process.env.API_DOCUMENTS_PHP`.
*   **Formato de Respuesta**: Todas las llamadas están configuradas con `responseType: 'arraybuffer'`. Esto permite que el backend Express reciba los datos binarios directamente como buffers de Node.js, listos para ser transmitidos al navegador cliente mediante cabeceras HTTP de adjunto de archivo (`Content-Disposition: attachment`).

---

## Detalle de Funciones y Procesos de Negocio

A continuación se detallan las 5 integraciones expuestas por el cliente HTTP externo:

### 1. Generación de Reporte de Trazabilidad (`generateTrazabilityExcel`)
*   **PHP Endpoint**: `services/generateExcel`
*   **Lógica de Proceso y Negocio**:
    *   Este proceso toma las filas consolidadas del mes (datos de Trazabilidad Histórica y Prorrateo) y las envía al microservicio PHP.
    *   PHP inyecta estos datos en una sábana de cálculo altamente estructurada que incluye las pestañas contables requeridas para la conciliación de cobros con el cliente.
*   **Parámetros y Retorno**: Envía un objeto con las filas de trazabilidad procesadas y retorna un buffer de archivo Excel (`.xlsx`).

### 2. Generación de Días Operativos por Partida (`generateGeneratorExcel`)
*   **PHP Endpoint**: `services/generateDeparture`
*   **Lógica de Proceso y Negocio**:
    *   Genera la matriz mensual de días operativos por partida contractual. Mapea la cuadrícula de equipos y sus correspondientes días en operación o mantenimiento.
*   **Parámetros y Retorno**: Recibe el desglose jerárquico de partidas y retorna el buffer binario del reporte Excel.

### 3. Reporte de Kilometrajes y Fletes (`generateTebExcelFlete`)
*   **PHP Endpoint**: `services/generateFreightExcel`
*   **Lógica de Proceso y Negocio**:
    *   Genera la sábana de conciliación exclusiva para fletes y movilizaciones. Incluye las distancias recorridas en kilómetros, indicando si los tránsitos fueron redondos o con carga plana.
*   **Parámetros y Retorno**: Recibe el consolidado de actividades de fletes y retorna el buffer del Excel.

### 4. Plantilla de Importación de TEBs (`generateFormatTebExcel`)
*   **PHP Endpoint**: `services/generateTebExcel`
*   **Lógica de Proceso y Negocio**:
    *   Genera el archivo plantilla en blanco de Excel con las columnas parametrizadas necesarias para que el analista llene y vuelva a subir el catálogo de presupuestos BaseTebs sin cometer errores de formato.
*   **Parámetros y Retorno**: Recibe metadatos del periodo y retorna el Excel plantilla.

### 5. Formato de Costeo PDF Oficial (`formatCosteoPdf`)
*   **PHP Endpoint**: `services/generateCosteoFormat`
*   **Lógica de Proceso y Negocio**:
    *   Construye la sábana o reporte maestro final de estimación de costos en formato PDF. Es la orden de cobro definitiva firmada físicamente por los supervisores.
*   **Parámetros y Retorno**: Recibe el consolidado financiero del mes y retorna un buffer del PDF listo para su visualización o impresión.
