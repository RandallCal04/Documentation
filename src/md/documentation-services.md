# Guía Exhaustiva de Servicios de Negocio (Backend Core & Lógica de Procesos)

Este documento detalla la arquitectura de la capa de **Servicios** (`src/api/services/`) de **API Costeo**. La capa de servicios contiene de forma aislada toda la lógica de negocio, las reglas de cálculo contable contractual y las integraciones con servicios externos (Inteligencia Artificial, OCR y generación de hojas de cálculo).

---

## Filosofía y Arquitectura de la Capa de Servicios

En cumplimiento de las directrices del proyecto:
1.  **Servicios Robustos ("Fat Services")**: Los controladores son meros enrutadores HTTP; toda la orquestación lógica, la validación matemática de jornadas, y la mutación de la base de datos se ejecuta en los servicios.
2.  **Aislamiento del Protocolo**: Los servicios son agnósticos a Express. Ningún método en la capa de servicios recibe ni conoce la existencia de los objetos `Request`, `Response` o `NextFunction`. Operan únicamente con parámetros tipados de TypeScript y retornan datos estructurados o lanzan excepciones.

---

## Mecanismos y Algoritmos Core del Backend

### 1. Balanceador de Carga de Azure OCR Pool (`AzureOcrPoolService`)
Para digitalizar solicitudes de presupuesto de forma masiva sin experimentar bloqueos por tasa límite de peticiones (rate limiting) de Microsoft Azure, el sistema implementa un pool de clientes de OCR balanceado en memoria.
*   **Balanceo**: Soporta estrategias de `round-robin` (circular) y `least-busy` (enviar a la instancia con menos solicitudes activas).
*   **Failover**: Si un nodo del pool (ej. servidor principal) retorna error de cuota o caída de conexión, el servicio captura la excepción e instantáneamente reintenta la extracción en un servidor secundario de respaldo.

### 2. Cascada de Auditoría de IA (Claude + Gemini)
El análisis operativo combina dos de los modelos de lenguaje más avanzados del mercado bajo un patrón de auditoría ciega:
1.  **Generación (Claude)**: Anthropic Claude analiza el archivo consolidado del mes para estructurar hallazgos de dispersión contable (micro) o reportes estratégicos generales (macro).
2.  **Validación (Gemini Cascade)**: Un servicio validador en cascada envía el JSON generado por Claude a Gemini (`gemini-3-pro-preview` -> `gemini-3-flash` -> `gemini-2.5-flash`). Gemini valida los números descritos contra los arrays de datos crudos reales (`enrichedData`) para corregir alucinaciones o errores numéricos directamente en la prosa del texto de forma invisible para el usuario.

### 3. Redistribución de Horas y Redondeo de Ajuste
*   **Redistribución**: Si un activo opera bajo múltiples órdenes presupuestales en la misma jornada, el servicio agrupa las actividades. Si algunas de estas actividades no coinciden con un presupuesto TEB del catálogo, su volumen (horas) se redistribuye equitativamente entre aquellas que sí son válidas para evitar pérdida de volumen contable.
*   **Largest Remainder Method (Redondeo de Resto Mayor)**: Al consolidar trazabilidad mensual, el servicio suma los decimales diarios y los redondea a 2 dígitos utilizando prioridades de negocio: Operación (Máxima prioridad) > Disponibilidad > Resto. Esto asegura que la sumatoria diaria siempre equivalga exactamente a 1.00 o su valor fraccional correcto.

---

## Detalle Exhaustivo de los Módulos de Servicios

---

### 1. Desglose de Actividades (`ActivityServices`)
*   **Archivo**: `ActivityServices/activity.service.ts`
*   **Lógica de Negocio y Procesos**:
    *   Gestiona el ciclo de vida de los registros de actividades de un reporte.
    *   **Recálculo en Cascada**: Al crear, actualizar o eliminar una actividad, el servicio recalcula automáticamente la duración en minutos de la tarea y propaga el valor fraccional a las tablas de trazabilidad y días de operación de la partida.
*   **Especificación Técnica**:
    *   `createActivity(data)` / `updateActivity(id, data)` / `deleteActivity(id)`.
    *   Realiza consultas a `ReportModel` para verificar la existencia de la bitácora madre e invoca a `ReportService` para reajustar los acumulados de jornada.

---

### 2. Conciliación y Trazabilidad (`BaseTebsAndTraceability`)
Contiene los dos motores más grandes del sistema: la gestión del catálogo de presupuestos autorizados y el procesador de trazabilidad contable.

*   **Archivos**:
    *   `BaseTebsAndTraceability.service.ts`: Importación masiva, validación de campos, fusión (merge) de OCR y exportaciones de presupuestos.
    *   `trazabilityService.service.ts`: Motor de cruce financiero de actividades vs TEBs, redondeos, auditoría de modificaciones y exportación asíncrona de ExcelJS.
*   **Lógica de Negocio**:
    *   **Fusión de Escaneo OCR (`summarizeTebResults`)**: Cuando el OCR de Azure lee múltiples hojas de un presupuesto, el servicio las agrupa por el identificador único `Orden TEB`. Si hay coincidencias, fusiona los arrays de materiales y concatena las URLs de Cloudinary en un solo registro consolidado.
    *   **Generación de Trazabilidad (`generateTraceability`)**: Toma una fecha de inicio y fin, solicita las partidas acumuladas del periodo y realiza el cruce en memoria contra los TEBs utilizando Hash Maps (`tebMap`) para optimizar el rendimiento.
    *   **Sandbox de Simulación**: Permite previsualizar la trazabilidad del mes. Si el flag `isSimulated` es verdadero, mockea registros virtuales para los TEBs inexistentes para que el usuario visualice el 100% de sus filas operativas sin pérdida de datos.
    *   **Historial de Auditoría (`modifiedBy`)**: Al actualizar una fila de trazabilidad, el servicio compara campo por campo el objeto anterior con el nuevo. Si detecta diferencias, guarda en el arreglo `modifiedBy` el nombre del editor, la fecha y el nombre específico de las columnas modificadas.
*   **Especificación Técnica**:
    *   `bulkWrite` de Mongoose para inserciones rápidas en lotes.
    *   `generateExcelAsync`: Genera hojas de cálculo complejas de trazabilidad usando `ExcelJS`. Aplica colores corporativos, une celdas superiores para agrupar datos presupuestales, mapea IDs a nombres legibles de barcos e instalaciones y reporta el progreso (0-100%) a la colección `ExportTask`. Sube el Excel binario a Cloudinary usando Streams.

---

### 3. Conceptos del Catálogo (`CatalogConceptServices`)
*   **Archivo**: `CatalogConceptServices/CatalogTypeDocument.service.ts`
*   **Lógica de Negocio**:
    *   Gestiona la parametrización de las tipologías de documentos del contrato (ej. Bitácoras, Reportes de Fletes).
*   **Especificación Técnica**:
    *   CRUD estándar implementado sobre `CatalogTypeDocumentModel`.

---

### 4. Inventario de Activos del Contrato (`CatalogEquipmentServices`)
*   **Archivo**: `CatalogEquipmentServices/CatalogEquipment.service.ts`
*   **Lógica de Negocio**:
    *   Administra los recursos autorizados en el contrato general (equipos y cuadrillas).
    *   **Estructura de Cuadrillas**: Asocia maniobristas a cabos líderes. Provee búsquedas inteligentes de cuadrillas vigentes basadas en el tipo de turno y rango de horas de las actividades del reporte.
*   **Especificación Técnica**:
    *   `assignCaboAndManeuverer(caboId, maneuvererId)`: Enlaza maniobristas a un cabo líder.
    *   `getCabosByActivityRange(startTime, endTime)`: Identifica cabos disponibles para un horario dado consultando los turnos vigentes.

---

### 5. Catálogos Dinámicos (`ConfigServices`)
*   **Archivo**: `ConfigServices/configService.service.ts`
*   **Lógica de Negocio**:
    *   Carga listas dinámicas de instalaciones y embarcaciones en memoria para alimentar formularios de captura rápida.
*   **Especificación Técnica**:
    *   CRUD sobre `CatalogListModel` y `ConfigurationsModel`.

---

### 6. Central de Conexiones por Oficina (`ConnectionServices`)
*   **Archivo**: `ConnectionServices/connection.service.ts`
*   **Lógica de Negocio**:
    *   Permite orquestar el aislamiento multi-sucursal inicializando perfiles de bases de datos.
*   **Especificación Técnica**:
    *   Administra las credenciales en `ConnectionModel` y `ProfileModel`.

---

### 7. Pantallas y Alertas de Dashboard (`DashboardSerivces`)
*   **Archivos**:
    *   `dashboard.service.ts`: Agregación de costos productivos, fuera de servicio y mantenimiento. Feeds de gráficas de barras y scatter plots.
    *   `dashboardMetric.service.ts`: Lógica de crons de monitoreo contable.
*   **Lógica de Negocio**:
    *   **Monitoreo Automático de Presupuesto (Cron Jobs)**: Analiza el consumo total del mes contra el presupuesto objetivo general y los límites min/max. Si se superan los umbrales de peligro establecidos, recopila las direcciones del campo `emailsToNotify` y envía correos de alerta automáticos mediante plantillas HTML.
*   **Especificación Técnica**:
    *   `testCronJob(metricId)`: Ejecución manual de alertas.
    *   Utiliza agregaciones de MongoDB (`$group`, `$sum`, `$match`) para agrupar costos históricos por partida contractual.

---

### 8. Partidas del Contrato (`DepartureServices`)
*   **Archivo**: `DepartureServices/departure.service.ts`
*   **Lógica de Negocio**:
    *   Orquesta la asignación de activos a las líneas del contrato general y calcula la disponibilidad de días acumulados.
    *   **Procesamiento de laborDays**: Genera e inyecta objetos `SubItemLaborDay` en la colección. Si el sub-item tiene la bandera `isOutside` habilitada, computa automáticamente un descuento del 75% sobre la tarifa de la partida.
*   **Especificación Técnica**:
    *   CRUD de partidas (`DepartureModel`) y asignación de sub-items (`SubItemsModel`).
    *   Populates estructurados con pre-find hooks para traer de forma transparente el historial de días laborados de los equipos.

---

### 9. Cache de Estimación de Costos (`EstimatedCostServices`)
*   **Archivo**: `EstimatedCostServices/estimatedCost.service.ts`
*   **Lógica de Negocio**:
    *   Optimiza el tiempo de carga del dashboard contable. Lee y escribe los costos estimados por jornada y los asocia a llaves de sub-items y días de operación de manera estática.

---

### 10. TEBs Ficticios y regularizaciones (`FictitiousTebServices`)
*   **Archivo**: `FictitiousTebServices/fictitiousTeb.service.ts`
*   **Lógica de Negocio**:
    *   Gestiona los presupuestos temporales de campo.
    *   **Regularización**: Cuando el capturista asocia un TEB real a un TEB provisional, este servicio actualiza masivamente todos los registros en `ActivityModel` reemplazando los folios de contingencia por los oficiales.
*   **Especificación Técnica**:
    *   Administra `FictitiousTebModel` y `FictitiousTebPivotModel`.

---

### 11. Inteligencia Artificial Analista (`iaAnalistaServices`)
*   **Archivos**:
    *   `claude.service.ts`: Integración con Anthropic Claude para reportes ejecutivos.
    *   `validator.service.ts`: Auditoría numérica y corrección ciega con Gemini Cascade.
    *   `iaJob.service.ts`: Control de trabajos en segundo plano y actualización de avance.
    *   `transformer.service.ts`: Normalizador de datos de base de datos a formato apto para lectura de LLMs.
*   **Lógica de Negocio**:
    *   **Análisis Macro y Micro**: Claude genera reportes narrativos detallados sobre desvíos o resúmenes de rendimiento para directivos. El servicio `ValidatorService` realiza un ciclo inmediato de auditoría con Gemini sobre el texto generado por Claude para comprobar que ningún número o porcentaje haya sido alucinado.
*   **Especificación Técnica**:
    *   SDK `@anthropic-ai/sdk` y `@google/generative-ai`.
    *   Cascada multi-modelo de Gemini: prueba `gemini-3-pro-preview` -> `gemini-3-flash` -> `gemini-2.5-flash` en caso de fallos de cuota o caídas de servidor.

---

### 12. Turnos y Horarios Contractuales (`JornDayServices`)
*   **Archivo**: `JornDayServices/jornDay.service.ts`
*   **Lógica de Negocio**:
    *   Gestiona la configuración horaria de turnos y calcula si un horario cae dentro de las ventanas de validez del contrato.

---

### 13. Partes Diarios y Bitácoras (`ReportServices`)
*   **Archivos**:
    *   `report.service.ts`: Inserción y edición de bitácoras, validación de cuadrillas y verificación del límite diario 1.0.
    *   `reportSync.service.ts`: Sincronización en cascada de cambios en bitácoras hacia trazabilidad contable.
    *   `tempDailyReports.service.ts`: Almacenamiento borrador de las bitácoras digitalizadas por OCR.
*   **Lógica de Negocio**:
    *   **Validación de Jornada (`validateReportVolume`)**: Antes de guardar, comprueba si las horas imputadas al activo en la fecha y turno exceden el límite acumulado de `1.0`. Si se excede, rechaza la inserción e informa qué folios están colisionando.
    *   **Sincronización de Cambios (`reportSync`)**: Si una bitácora se edita, el servicio de sincronización actualiza de forma automática las tablas de trazabilidad definitiva, agregando un log en `modifiedBy` indicando el folio del reporte modificado.

---

### 14. Capacidades y Fletes (`ResourceServices`)
*   **Archivo**: `ResourceServices/resource.service.ts`
*   **Lógica de Negocio**:
    *   Valida la capacidad física de grúas y camiones para determinar si pueden ejecutar fletes o movilizaciones específicas en el muelle.

---

### 15. Ingesta y OCR Digitalizador (`ScannerServices`)
*   **Archivos**:
    *   `gemini-daily-report-service.ts`: Procesador OCR principal de bitácoras físicas mediante Gemini Multimodal.
    *   `azure-ocr.service.ts`: Ingesta estructurada de presupuestos TEBs usando Azure.
    *   `azure-ocr-pool.service.ts`: Balanceador de carga OCR de Azure con failover automático.
*   **Lógica de Negocio**:
    *   **OCR de Bitácoras (`gemini-daily-report-service`)**: Descarga los archivos de red, los envía codificados a Gemini, e interpreta la tabla de actividades. Realiza búsquedas difusas sobre los números económicos de los activos sugeridos y calcula la jornada que solapa mejor con las horas leídas.
