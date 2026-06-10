# Documentación de Servicios Externos: Integración del Frontend, Procesos y Negocio de la API

Esta documentación detalla el propósito de la carpeta `src/api/servicesExtern/`, la cual encapsula las conexiones de red HTTP con microservicios externos (especialmente el motor PHP de renderizado de documentos) y explica la lógica de integración para el frontend y los flujos de negocio implicados.

---

## Sección 1: Documentación para el Frontend (Descarga de Binarios)

Los métodos expuestos en `servicesExtern` no son consumidos directamente por el cliente; en su lugar, son llamados por los controladores locales del backend, los cuales actúan como puente (Proxy) y retornan los archivos listos para el navegador.

### 1. Pautas Obligatorias para Descargas desde el Frontend
Cuando el frontend realiza peticiones HTTP a rutas que consumen estos servicios externos (como `/api-costeo/traceability/traceabilityExcelReport` o `/api-costeo/generator/generateExcel`), la respuesta devuelta es un archivo binario.

*   **Configuración del Request (`responseType`):**
    Para evitar que el navegador corrompa los bytes del archivo de Excel o PDF al descargarlo, el frontend **debe especificar obligatoriamente** el tipo de respuesta como `blob` o `arraybuffer` en su cliente HTTP (Axios / Fetch).
    *   *Ejemplo con Axios:*
        ```javascript
        axios.post('/api-costeo/traceability/traceabilityExcelReport', payload, {
            responseType: 'blob', // OBLIGATORIO
            headers: {
                Authorization: `Bearer ${token}`
            }
        }).then((response) => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Trazabilidad.xlsx');
            document.body.appendChild(link);
            link.click();
        });
        ```

### 2. Cabeceras de Respuesta del Servidor (Headers)
La API devuelve los binarios configurando las siguientes cabeceras HTTP para indicarle al navegador que se trata de un archivo adjunto descargable:
*   `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (para hojas de Excel).
*   `Content-Disposition: attachment; filename=<Nombre_Archivo>.xlsx`.

---

## Sección 2: Guía de Procesos y Negocio de Servicios Externos

El directorio `servicesExtern` consta de un archivo de integración principal: `api-documents.ts`.

### 1. Propósito de Negocio (¿Por qué PHP?)
La generación de reportes financieros en Excel que contienen miles de filas con formato condicional, fórmulas complejas y celdas combinadas consume una gran cantidad de recursos de CPU. 
*   **Arquitectura Desacoplada:** Para evitar bloquear el hilo único de ejecución (Event Loop) del servidor Node.js (lo cual provocaría lentitud o cortes en las conexiones de sockets de otros usuarios), el sistema delega el renderizado visual de plantillas complejas a un microservicio en PHP especializado.
*   **Configuración:** La URL base de este servicio se establece mediante la variable de entorno `API_DOCUMENTS_PHP`.

---

### 2. Catálogo de Métodos de Integración

#### A. `generateTrazabilityExcel`
*   **Negocio:** Genera el reporte de Trazabilidad consolidado del contrato para auditoría contable.
*   **Flujo del Proceso:**
    1. El usuario solicita el reporte de trazabilidad.
    2. El backend procesa y aplana los datos en `TrazabilityService.transformTraceabilityData`.
    3. Envía el JSON transformado mediante una petición `POST` al endpoint `services/generateExcel` del microservicio PHP.
    4. El microservicio PHP dibuja la plantilla en base a los datos y devuelve el buffer binario (`arraybuffer`), el cual es enviado de vuelta al cliente.

#### B. `generateGeneratorExcel`
*   **Negocio:** Genera el Excel de estimaciones y desglose de partidas (Generadores) operadas por equipos.
*   **Flujo del Proceso:** Realiza una llamada `POST` al endpoint `services/generateDeparture` del microservicio PHP con la lista de subitems y laborDays, devolviendo el archivo de Excel formateado.

#### C. `generateTebExcelFlete`
*   **Negocio:** Genera el formato de Excel específico para las estimaciones del kilometraje y bloques de fletes.
*   **Flujo del Proceso:** Consume el endpoint `services/generateFreightExcel` del microservicio PHP enviando los bloques de flete validados.

#### D. `generateFormatTebExcel`
*   **Negocio:** Genera plantillas o reportes de TEB formateados para control presupuestal de subida manual.
*   **Flujo del Proceso:** Consume el endpoint `services/generateTebExcel` del microservicio PHP.

#### E. `formatCosteoPdf`
*   **Negocio:** Genera formatos oficiales de costeo en PDF (por ejemplo, reportes de cierre de mes de mantenimiento o metas operativas).
*   **Flujo del Proceso:** Envía el dataset estructurado en una petición `POST` al endpoint `services/generateCosteoFormat` del microservicio PHP y retorna la estructura binaria del PDF.
