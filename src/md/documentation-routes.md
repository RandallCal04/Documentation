# Guía Exhaustiva de Rutas de la API (HTTP Endpoints, Middlewares y Lógica de Procesos)

Este documento detalla la arquitectura de la capa de **Rutas** (`src/api/routes/`) de **API Costeo**, especificando cada endpoint expuesto, su verbo HTTP, los middlewares de seguridad y carga de archivos asociados, las firmas de los controladores y las reglas operativas que desencadenan.

---

## Rutas Globales de la Aplicación (Express Router)

El enrutamiento de la aplicación está centralizado en el archivo `index.route.ts` ([Ver index.route.ts](file:///c:/Users/WinterOS/Downloads/api-costeo-prod/api-costeo-prod/src/api/routes/index.route.ts)), el cual actúa como el enrutador maestro. Este archivo importa los submódulos de ruteo y los monta sobre prefijos lógicos de URL.

### Prefijos de Montaje Globales
La API de Costeo expone 17 conjuntos de rutas bajo los siguientes prefijos base:
1.  `/resources` -> `ResourceRoutes/resource.route.ts` (Especificaciones físicas).
2.  `/jorndays` -> `JornDayRoutes/jornDay.route.ts` (Horarios y turnos).
3.  `/departures` -> `DepartureRoutes/departure.route.ts` (Partidas del contrato).
4.  `/catalogequipments` -> `CatalogEquipmentRoutes/CatalogEquipment.route.ts` (Inventario de activos).
5.  `/reports` -> `ReportRoutes/report.route.ts` (Bitácoras y reportes diarios).
6.  `/activities` -> `ActivityRoutes/activity.route.ts` (Desglose de horas por actividad).
7.  `/generator` -> `GeneratorRoutes/Generator.routes.ts` (Exportación directa a Excel).
8.  `/connections` -> `ConnectionRoutes/connection.route.ts` (Gestión de sucursales).
9.  `/baseTebs` -> `BaseTebRoutes/BaseTeb.route.ts` (Presupuestos del cliente).
10. `/traceability` -> `TraceabilityRoutes/Traceability.routes.ts` (Conciliación contable).
11. `/configs` -> `ConfigRoutes/config.route.ts` (Catálogos dinámicos).
12. `/anuncios` -> `AnuncioRoutes/anuncio.route.ts` (Avisos del dashboard).
13. `/dashboard` -> `DashboardRoutes/dashboard.route.ts` (Gráficas y cronjobs de alerta).
14. `/daily-reports/scan` -> `DailyReportRoutes/DailyReportScanner.route.ts` (Digitalización OCR).
15. `/ia-analyzer` -> `iaAnalistaRoutes/ia.route.ts` (Auditoría por Gemini/Claude).
16. `/fictitioustebs` -> `FictitiousTebRoutes/fictitiousTeb.route.ts` (Folios provisionales).
17. `/catalog-type-documents` -> `CatalogConceptRoutes/CatalogTypeDocument.route.ts` (Tipificación de archivos).

### Enrutador Maestro (`index.route.ts`)
El archivo principal `index.route.ts` es el único punto de acoplamiento entre el servidor global de Express (`app.ts`) y los submódulos de ruteo de cada entidad.

*   **Lógica de Proceso y Negocio**:
    *   **Punto de Entrada Unificado**: Actúa como la puerta de enlace central de la API. Consolida el acceso a las funciones operativas de Nicolás/Cicsa (trazabilidad, OCR, presupuestos, cuadrillas) bajo un solo árbol estructurado de endpoints.
    *   **Modularidad de Negocio**: Al encapsular y delegar el ruteo a sub-archivos de rutas, permite que el equipo de desarrollo cree, modifique o remueva módulos de negocio (como el procesador de IA o el de fletes) de manera aislada, garantizando la estabilidad operativa del backend sin modificar el archivo de arranque de la aplicación.
*   **Especificación Técnica de Backend**:
    *   Instancia el constructor `Router` de Express.
    *   Registra cada submódulo mediante el método `router.use()` asociándolo a su correspondiente prefijo semántico.
    *   Exporta por defecto la instancia configurada de `router` para que sea consumida en `app.ts` e instalada globalmente bajo el prefijo `/api`.

---

## Capas de Middleware Transversales en Rutas

### 1. Control de Acceso (`authMiddleware`)
*   **Propósito**: Protege los endpoints de manipulación de costos, catálogos contractuales y aprobación de bitácoras.
*   **Funcionamiento**: Descifra el token de portador (Bearer JWT) provisto por el proveedor de identidad corporativo. Al validar la firma, inyecta la información del capturista (`userId`, `userName`, `emailUser`) en el objeto `req.user` para su posterior consumo por los controladores.

### 2. Carga de Archivos (`multer`)
*   **Propósito**: Permite la ingesta de documentos PDF, Excel y archivos escaneados de bitácoras físicas.
*   **Configuración**: Utiliza `multer.memoryStorage()`, lo que significa que el archivo subido no se guarda en el disco local del servidor, sino que se mantiene en un buffer en memoria RAM (`req.files`). Esto acelera el procesamiento directo por Azure Form Recognizer, pdf-lib, o Gemini, y posterior subida segura a Cloudinary sin dejar archivos residuales en el servidor.

---

## Desglose Exhaustivo de Módulos de Enrutamiento

---

### 1. Trazabilidad Financiera (`TraceabilityRoutes`)
Controla la consulta, cálculo y guardado de celdas de trazabilidad contable definitiva y estimaciones temporales.

*   **Archivo**: `TraceabilityRoutes/Traceability.routes.ts`
*   **Lógica de Proceso**: Habilita la exportación masiva y el sandbox de simulación. Es donde el capturista consolida el costo real imputado a un equipo contra un presupuesto TEB aprobado.
*   **Endpoints Técnicos**:
    *   `GET` `/pending-session` (Autenticado): Obtiene la sesión de trazabilidad activa que aún está en borrador.
    *   `POST` `/generate-temp` (Autenticado): Inicia el cálculo sincrónico y almacena las filas en la base temporal.
    *   `POST` `/generate-temp-async` (Autenticado): Ejecuta el cálculo en segundo plano de manera asíncrona para periodos largos.
    *   `GET` `/temp/:sessionId` (Autenticado): Lista los registros de la simulación del sandbox.
    *   `POST` `/commit/:sessionId` (Autenticado): Escribe de manera permanente las filas temporales en `TrazabilityHistory`, aplicando las validaciones de índice compuesto único para prevenir doble cobro.
    *   `DELETE` `/temp/:sessionId` (Autenticado): Descarta el borrador y limpia la base.
    *   `GET` `/findAll` (Autenticado): Obtiene todo el histórico contable.
    *   `GET` `/` (Autenticado): Lista histórica con límites y paginación para pantallas de consulta.
    *   `POST` `/createIndividual` / `/updateIndividual` (Autenticado): Creación y edición manual de filas de cobro por parte de administradores.
    *   `POST` `/createMassive` / `/updateMassive` (Autenticado): Carga e importación en lotes desde plantillas contables.
    *   `POST` `/traceabilityExcelReport` (Autenticado): Retorna un flujo de archivo binario (Excel) de trazabilidad en tiempo real.
    *   `POST` `/traceabilityExcelReportAsync` (Autenticado): Inicia la exportación contable asíncrona de Excel en segundo plano.
    *   `GET` `/exportStatus/:taskId` (Autenticado): Retorna el progreso (0-100%) y la URL de Cloudinary del reporte Excel asíncrono.
    *   `GET` `/:startDate/:endDate` (Autenticado): Obtiene datos consolidados delimitados por un rango de fechas.

---

### 2. Escaneo y OCR de Bitácoras (`DailyReportRoutes`)
Orquesta la recepción física de bitácoras en PDF y la extracción automatizada de sus tablas a través de inteligencia artificial.

*   **Archivo**: `DailyReportRoutes/DailyReportScanner.route.ts`
*   **Lógica de Proceso**: Habilita el canal de digitalización manual desde la aplicación web y el canal directo para escáneres físicos de red corporativos.
*   **Endpoints Técnicos**:
    *   `POST` `/upload` (Autenticado, `multer.array('files')`): Endpoint para que los analistas suban lotes de PDFs desde el navegador. Ejecuta el OCR de Gemini y almacena borradores en `TemporaryDailyReport`.
    *   `POST` `/scanner` (Público/Sin Auth, `multer.array('files')`): Diseñado para que impresoras/escáneres multifuncionales de la red interna de Nicolás envíen archivos PDF directamente al servidor mediante peticiones POST automatizadas.
    *   `POST` `/temp-daily-reports` (Público/Sin Auth): Obtiene reportes temporales pendientes vinculados a un socket para mostrarlos en la pantalla de previsualización.
    *   `GET` `/session/:sessionId` (Autenticado): Monitorea cuántas páginas del PDF del lote han sido procesadas exitosamente por la cola asíncrona de OCR.

---

### 3. Presupuestos y TEBs (`BaseTebRoutes`)
Administra los archivos físicos, importaciones Excel y catálogo de presupuestos cargados por el cliente.

*   **Archivo**: `BaseTebRoutes/BaseTeb.route.ts`
*   **Lógica de Proceso**: Habilita la carga de solicitudes autorizadas, asociación de PDFs firmados, y generación de reportes "White Paper" para facturación.
*   **Endpoints Técnicos**:
    *   `POST` `/uploadTebsManual` (Autenticado, `multer.array('files')`): Carga manual de archivos PDF y XLS de TEBs por parte de analistas.
    *   `POST` `/uploadTebsScanner` (Autenticado, `multer.array('files')`): Recepción asíncrona de presupuestos escaneados.
    *   `POST` `/insertTebsMassive` (Autenticado): Inserta de forma masiva presupuestos importados.
    *   `POST` `/create` (Autenticado): Crea un registro manual de TEB individual.
    *   `GET` `/` (Autenticado): Obtiene el catálogo completo de presupuestos autorizados.
    *   `PUT` `/updateOne/:_id` (Autenticado): Actualiza campos contables del presupuesto.
    *   `POST` `/uploadDocument/:_id` (Autenticado, `multer.array('files')`): Adjunta el PDF firmado por el cliente a un TEB para cambiar su estatus a "APROBADO" para cobro.
    *   `POST` `/updateMassive` (Autenticado): Modificaciones grupales sobre TEBs.
    *   `POST` `/importExcelChunk` (Autenticado): Procesa fracciones de Excel de presupuestos en cola asíncrona para evitar saturación de memoria.
    *   `POST` `/generateFormatTebExcel/:dateFech` (Autenticado): Genera plantilla con formato específico de importación.
    *   `POST` `/generateTebWhitePaper` (Autenticado): Exporta y genera un archivo ZIP con los PDFs compilados y firmados de las órdenes del periodo.
    *   `POST` `/verigenerateTebWhitePaper` (Autenticado): Valida el estatus de la tarea de empaquetado ZIP de los PDFs.
    *   `GET` `/listTebsShowNotBaseTeb` (Autenticado): Lista presupuestos ficticios/provisionales que no han sido regularizados.
    *   `GET` `/listTebsNotInActivity` (Autenticado): Filtra TEBs disponibles que aún no han sido asignados a ninguna actividad operativa.
    *   `PUT` `/replaceTebValue` (Autenticado): Reemplaza una clave presupuestal en las actividades cuando se regulariza un folio provisional.

---

### 4. Inteligencia Artificial Analista (`iaAnalistaRoutes`)
Expone los endpoints que desencadenan las auditorías inteligentes de costos y anomalías mediante modelos LLM.

*   **Archivo**: `iaAnalistaRoutes/ia.route.ts`
*   **Lógica de Proceso**: Habilita los procesos de análisis Micro y Macro. Evalúa desvíos de presupuesto, cuadre de decimales de jornadas y reporta incidencias por correo electrónico.
*   **Endpoints Técnicos**:
    *   `POST` `/analyze`: Inicia un análisis global de IA (Macro o Micro) sobre la facturación del mes y genera la cola del proceso asíncrono.
    *   `POST` `/analysis-live`: Ejecuta auditoría en tiempo real y retorna la respuesta narrada inmediatamente.
    *   `GET` `/analyze/status/:jobId`: Consulta el progreso y estado final del análisis solicitado.

---

### 5. Partidas Contractuales (`DepartureRoutes`)
Gestiona la estructura de cobros, precios unitarios y sub-items de equipos asignados a las partidas del contrato.

*   **Archivo**: `DepartureRoutes/departure.route.ts`
*   **Lógica de Proceso**: Esencial para configurar el esqueleto financiero del contrato. Asocia equipos del catálogo con su tarifa específica y calcula acumulados.
*   **Endpoints Técnicos**:
    *   `POST` `/createDeparture` (Autenticado): Registra una partida contractual nueva (código, costo unitario, tipo de cobro).
    *   `GET` `/getAllDepartures` (Autenticado): Retorna la lista completa de partidas registradas.
    *   `POST` `/addSubItem` / `/addMultipleSubItems` (Autenticado): Asocia un activo económico a una partida contable.
    *   `GET` `/findOneDeparture/:_id` (Autenticado): Detalle de una partida, incluyendo populates de sub-items y días operativos.
    *   `DELETE` `/deleteSubItem/:_idDeparture/:_idCatalogSubItem` (Autenticado): Remueve un activo de una partida.
    *   `DELETE` `/deleteDeparture/:_id` (Autenticado): Elimina una partida y desvincula sus dependencias.
    *   `PUT` `/updateDeparture/:_id` (Autenticado): Edita costos unitarios o tipo de moneda.
    *   `GET` `/getViewAll/:month/:year` (Autenticado): Retorna el consolidado tabular de días de operation de activos agrupados por partida para pantallas de cierre mensual.
    *   `GET` `/getViewAllFlete/:month/:year` (Autenticado): Retorna el consolidado de kilometrajes y fletes por partida.
    *   `GET` `/findOneDepartureSearch/:month/:year/:search` (Autenticado): Búsqueda dinámica de partidas operativas.
    *   `GET` `/findOneFleteSearch/:month/:year/:search` (Autenticado): Búsqueda dinámica de fletes contractuales.
    *   `GET` `/getViewAllLimit/:startDate/:endDate` (Autenticado): Consulta delimitada de partidas en rango de fechas.
    *   `GET` `/getDepartureByTargetInstallation/:month/:year/:targetInstallation/:typeDeparture` (Autenticado): Filtra partidas imputadas a una instalación destino específica (utilizado para conciliaciones geográficas).
    *   `GET` `/getAllDeparturesForSelect` (Autenticado): Catálogo simplificado para menús desplegables.
    *   `GET` `/getHierarchicalData/:month/:year` (Autenticado): Retorna el árbol contable estructurado (Partidas -> Equipos -> Días Operativos) para renderizado jerárquico.
    *   `GET` `/findOneDeparturesIsCatalog/:_idCatalog` (Autenticado): Comprueba si un equipo del catálogo ya está asignado a alguna partida.
    *   `POST` `/getViewIds` / `/getViewIdsFlete` (Autenticado): Retorna IDs filtrados para exportaciones selectivas.
    *   `POST` `/getDeparturesByReportId` (Autenticado): Cruza bitácoras diarias con partidas afectadas.

---

### 6. Bitácoras y Reportes Diarios (`ReportRoutes`)
Controla la captura de partes diarios de trabajo, validación de volumen decimal del 1.0, y recálculos contables en cascada.

*   **Archivo**: `ReportRoutes/report.route.ts`
*   **Lógica de Proceso**: Habilita la entrada manual de información de campo y los procesos de mantenimiento de consistencia matemática de la base de datos.
*   **Endpoints Técnicos**:
    *   `GET` `/` (Autenticado): Lista de reportes del periodo.
    *   `POST` `/createReport` (Autenticado): Guarda un reporte diario cabecera y crea sus actividades embebidas, verificando la regla de cuadrillas y consistencia.
    *   `POST` `/createReportFromUploadMassive` (Autenticado): Inserta reportes masivos provenientes de la digitalización OCR.
    *   `GET` `/getAllReports` (Autenticado): Lista histórica de reportes diarios.
    *   `GET` `/getReportById/:id` (Autenticado): Obtiene el documento detallado de un reporte y sus actividades.
    *   `PUT` `/updateReport/:id` (Autenticado): Modifica un reporte diario y actualiza de forma automática el cálculo de fracciones operativas.
    *   `DELETE` `/deleteReport/:id` (Autenticado): Elimina físicamente la bitácora y sus actividades de forma limpia.
    *   `GET` `/getReportByIdCatalog/:id` (Autenticado): Obtiene reportes asociados a un recurso del catálogo.
    *   `POST` `/validate-volume` (Autenticado): Valida en tiempo real si el acumulado de cobro del activo en la fecha dada superará el límite contractual de `1.00`.
    *   `POST` `/bulk-recalculate` (Público): Recalcula masivamente los días de operación y mantenimientos de todo el sistema.
    *   `POST` `/bulk-recalculate-by-departure` (Público): Fuerza la recalculación de costos de una partida contractual específica.
    *   `POST` `/bulk-recalculate-by-equipments` (Público): Recalcula el historial de celdas de un grupo de equipos.
    *   `POST` `/bulk-recalculate-prices` (Autenticado): Actualiza los importes monetarios históricos de trazabilidad tras una modificación en el costo unitario de una partida.
    *   `GET` `/bulk-duplicates` (Público): Detecta bitácoras duplicadas (mismo equipo, fecha y turno).
    *   `DELETE` `/bulk-duplicates` (Público): Borra bitácoras redundantes.
    *   `GET` `/getLastFolio` (Autenticado): Obtiene el folio del último reporte guardado.
    *   `GET` `/validateExistFreightBorrowed/:equipmentId` (Autenticado): Verifica si un equipo tiene préstamos de fletes activos.
    *   `GET` `/listDeparturesByEquipmentBorrowed/:equipmentId` (Autenticado): Lista partidas en préstamo asociadas al activo.
    *   `POST` `/normalize-fleet-blocks` (Autenticado): Normaliza la asignación de bloques horarios para flotas de fletes.

---

### 7. Generador de Hojas de Cálculo (`GeneratorRoutes`)
Puntos de entrada especializados en la exportación inmediata de archivos de Excel estructurados de costos.

*   **Archivo**: `GeneratorRoutes/Generator.routes.ts`
*   **Lógica de Proceso**: Habilita la descarga de sábanas contables de Excel con formato Cicsa para conciliación física.
*   **Endpoints Técnicos**:
    *   `GET` `/determinate-show-inputs/:equipmentId`: Retorna qué campos del formulario de flete deben mostrarse en el frontend basándose en el tipo de activo (ej. si requiere campos de grúa o solo de kilometraje).
    *   `GET` `/get-jorn-day-by-equipment/:equipmentId`: Retorna el tipo de turno y horario contractual preconfigurado del activo.
    *   `POST` `/generateExcel` (Autenticado): Genera el reporte de Excel consolidado de cobro operativo de equipos.
    *   `POST` `/generateExcelFlete` (Autenticado): Genera el reporte Excel especializado en tramos, kilometrajes y fletes del periodo.

---

### 8. Horarios y Turnos de Trabajo (`JornDayRoutes`)
Administra los turnos de trabajo permitidos en el contrato de Nicolás.

*   **Archivo**: `JornDayRoutes/jornDay.route.ts`
*   **Lógica de Proceso**: Configura las ventanas horarias oficiales y define qué turno absorbe el residuo del redondeo decimal.
*   **Endpoints Técnicos**:
    *   `POST` `/createJornDay` (Autenticado): Crea un turno (diurno, mixto, nocturno) indicando su duración y el flag de ajuste de decimales (`isAdjustment`).
    *   `GET` `/getAllJornDays` (Autenticado): Lista todos los turnos disponibles.
    *   `GET` `/getJornDayById/:id` (Autenticado): Consulta a detalle un turno específico.
    *   `PUT` `/updateJornDay/:id` (Autenticado): Edita horarios del turno y variables de ajuste.
    *   `DELETE` `/deleteJornDay/:id` (Autenticado): Elimina un turno si no tiene dependencias activas.
    *   `GET` `/listJornDaysShort` (Autenticado): Retorna lista corta optimizada para filtros de interfaz.

---

### 9. Catálogo de Activos (`CatalogEquipmentRoutes`)
Controla el alta, importación y asignación jerárquica de la cuadrilla (Cabo - Maniobrista).

*   **Archivo**: `CatalogEquipmentRoutes/CatalogEquipment.route.ts`
*   **Lógica de Proceso**: Gestiona los activos del contrato. Controla las cuadrillas vinculando maniobristas a cabos líderes.
*   **Endpoints Técnicos**:
    *   `POST` `/createCatalogEquipment` (Autenticado): Agrega un activo (equipo o persona) al catálogo central.
    *   `POST` `/bulkCreateCatalogEquipment` / `/bulkUpdateCatalogEquipment` (Autenticado): Inserción y edición masiva de activos desde Excel.
    *   `GET` `/getAllCatalogEquipments` (Autenticado): Lista todos los activos del catálogo.
    *   `GET` `/getCatalogEquipmentById/:id` (Autenticado): Detalle de un activo.
    *   `PUT` `/updateCatalogEquipment/:id` (Autenticado): Edita descripción o códigos del activo.
    *   `DELETE` `/deleteCatalogEquipment/:id` (Autenticado): Baja física de un recurso del catálogo.
    *   `POST` `/createCatalogConcept` / `GET` `/getAllCatalogConcepts` (Autenticado): Creación y consulta de conceptos contractuales.
    *   `GET` `/getLabelValueEquipment/:typeDeparture/:idPartida` (Autenticado): Filtra equipos del catálogo que son compatibles con la partida y tipo de cobro indicados.
    *   `GET` `/getLabelValueEquipmentWithFilter/:searchParam` (Autenticado): Filtro de autocompletado en formularios de captura.
    *   `GET` `/getCabosByShiftType/:shiftType` (Autenticado): Lista los cabos disponibles para un turno específico.
    *   `GET` `/getManiobristasByCaboId/:caboId` (Autenticado): Retorna la cuadrilla de maniobristas asignados al cabo.
    *   `GET` `/getTractos` / `/getTractosDetails` (Autenticado): Lista específica de tractocamiones.
    *   `GET` `/getTractosDetails/` (Autenticado): Obtiene especificaciones avanzadas de capacidad de tractocamiones.
    *   `POST` `/assignCaboAndManeuverer` (Autenticado): Crea la relación jerárquica Cabo-Maniobrista en `CatalogCaboManeuverer`.
    *   `GET` `/getCaboAndManiobristasByManeuvererId/:maneuvererId` (Autenticado): Obtiene el cabo líder asignado a un maniobrista.
    *   `DELETE` `/deleteCaboAndManiobristas/:caboId/:maneuvererId` (Autenticado): Disuelve la relación jerárquica.
    *   `GET` `/getOnlyCabos` (Autenticado): Filtra recursos clasificados estrictamente como Cabos.
    *   `GET` `/getManiobristasWithoutCabo` (Autenticado): Retorna maniobristas que no pertenecen a ninguna cuadrilla.
    *   `POST` `/getCabosByActivityRange` (Autenticado): Busca cabos con horas de actividad disponibles.
    *   `GET` `/validateEquipmentToShip/:equipmentId/:blockDepartures` (Autenticado): Comprueba si un equipo puede operar en barco según su categoría.
    *   `GET` `/validateEquipmentBlockDepartures/:equipmentId` (Autenticado): Comprueba exclusiones del activo.

---

### 10. Actividades Individuales (`ActivityRoutes`)
Controla el ciclo de vida del desglose de horas por actividad de cada reporte diario.

*   **Archivo**: `ActivityRoutes/activity.route.ts`
*   **Lógica de Proceso**: Habilita la edición fina de las actividades que justifican las horas de cobro de un reporte diario.
*   **Endpoints Técnicos** (Públicos/Sin Auth):
    *   `POST` `/createActivity`: Agrega actividad vinculada a un reporte (`idReport`).
    *   `GET` `/getAllActivities`: Retorna la lista global de actividades.
    *   `GET` `/getActivityById/:id`: Obtiene el detalle de la actividad.
    *   `PUT` `/updateActivity/:id`: Actualiza descripción, horas o presupuestos asociados.
    *   `DELETE` `/deleteActivity/:id`: Elimina la actividad y recalcula las proporciones horarias del reporte.
    *   `GET` `/getAllActivitiesHistory`: Retorna histórico de actividades.

---

### 11. TEBs Ficticios / Provisionales (`FictitiousTebRoutes`)
Permite registrar y controlar los presupuestos ficticios temporales generados en campo.

*   **Archivo**: `FictitiousTebRoutes/fictitiousTeb.route.ts`
*   **Lógica de Proceso**: Canal de captura contingente para evitar paros operativos por retrasos administrativos de la orden formal.
*   **Endpoints Técnicos** (Autenticados):
    *   `POST` `/createFictitiousTeb` (`multer.array('files')`): Crea el TEB provisional, adjuntando la orden interna y auto-generando el folio `TEBF000000000X`.
    *   `GET` `/getLastFolioTebFictitious`: Consecutivo de la secuencia de folios provisionales.
    *   `GET` `/getAllFictitiousTebs` / `/getAll`: Lista de TEBs provisionales y su estado (`CREATED` / `LINKED`).
    *   `GET` `/getTebFalseOne/:id`: Consulta individual de TEB provisional.
    *   `PUT` `/updateFictitiousTeb/:id` (`multer.array('files')`): Edita variables provisionales y actualiza archivos adjuntos.
    *   `DELETE` `/:id`: Baja física del TEB provisional.

---

### 12. Métricas y Alarmas del Dashboard (`DashboardRoutes`)
Gestiona los parámetros límites de costos y los cronjobs que disparan correos automáticos.

*   **Archivo**: `DashboardRoutes/dashboard.route.ts`
*   **Lógica de Proceso**: Provee los datos de consumo del contrato para las gráficas y controla la ejecución de crons de control interno.
*   **Endpoints Técnicos** (Públicos/Sin Auth):
    *   `POST` `/createUpdateDashboard`: Almacena el estado de colapsado/scroll de la UI del capturista.
    *   `GET` `/getDashboardByUserId/:userId`: Recupera el estado de UI guardado.
    *   `GET` `/getMetrics` / `/upsertMetric` / `/deleteMetric/:metricId`: Obtiene, crea/actualiza o elimina metas financieras y prompts de Gemini/Claude.
    *   `POST` `/cronJob/test/:metricId`: Ejecuta manualmente la comprobación de desvíos y envío de correo para verificar el flujo SMTP.
    *   `POST` `/cronJob/refresh`: Recarga en memoria del servidor las tareas programadas de node-cron.
    *   `GET` `/getActualCostsByCategory` / `/getActualCostsOutServiceByCategory` / `/getActualCostMaintenanceByCategory`: Agregaciones de costos productivos, fuera de servicio y de mantenimiento del mes en curso.
    *   `POST` `/loadDashBoardScatter`: Agrega datos financieros para renderizar el diagrama de dispersión de costos.
    *   `GET` `/loadDashBoardByDeparture`: Agrega costos agrupados por partidas contractuales para la gráfica de barras.
    *   `GET` `/getMinMaxCostsByDateRange`: Compara los consumos reales del periodo contra las alarmas de umbral mínimo y máximo.
    *   `GET` `/getTotalCostsComparedWithGoal`: Muestra el avance del consumo contractual contra la meta financiera general.
    *   `GET` `/getMetricByDataSource/:dataSource`: Obtiene la métrica parametrizada filtrada por su fuente.

---

### 13. Conexiones y Oficinas (`ConnectionRoutes`)
Rutas para la administración de credenciales y perfiles de base de datos MongoDB y sockets.

*   **Archivo**: `ConnectionRoutes/connection.route.ts`
*   **Lógica de Proceso**: Habilita la conexión inicial de sucursales a la API Costeo.
*   **Endpoints Técnicos** (Públicos/Sin Auth):
    *   `POST` `/createConnection`: Registra perfil de conexión de sucursal.
    *   `GET` `/getAllConnections`: Lista las sucursales enlazadas.
    *   `GET` `/getConnectionById/:id`: Obtiene datos de conexión de una sucursal específica.
    *   `PUT` `/updateConnection/:id` / `/deleteConnection/:id`: Gestión administrativa de la conexión.
    *   `GET` `/getProfiles`: Catálogo de perfiles de bases de datos disponibles.

---

### 14. Catálogos Dinámicos (`ConfigRoutes`)
Gestión de catálogos generales editables (barcos, instalaciones de servicio).

*   **Archivo**: `ConfigRoutes/config.route.ts`
*   **Endpoints Técnicos** (Autenticados):
    *   `POST` `/createCatalogList` / `/bulkCreateCatalogList`: Inserta un elemento o lote de elementos de catálogo dinámico (ej. nuevas instalaciones).
    *   `GET` `/getAllCatalogLists` / `/getCatalogListById/:id`: Consulta de listas dinámicas.
    *   `PUT` `/updateCatalogList/:id` / `/deleteCatalogList/:id`: Edición y borrado.
    *   `GET` `/getListByCode/:code`: Obtiene todos los elementos de una clave de catálogo (ej. `installationDestination`).
    *   `GET` `/getListByCodeFillter/:code`: Obtiene lista con filtros.
    *   `POST` `/createConfigurations` / `GET` `/getAllConfigurations` / `PUT` `/updateConfigurations/:id`: Gestión de configuraciones del sistema.

---

### 15. Recursos y Capacidades (`ResourceRoutes`)
Controla el alta de capacidades y tonelaje de equipos del contrato.

*   **Archivo**: `ResourceRoutes/resource.route.ts`
*   **Endpoints Técnicos** (Públicos/Sin Auth):
    *   `POST` `/createResource` / `GET` `/getAllResources`: Alta y consulta de capacidades físicas de grúas/tractores.
    *   `GET` `/getResourceById/:id` / `PUT` `/updateResource/:id` / `DELETE` `/deleteResource/:id`: Mantenimiento del recurso.

---

### 16. Tipo de Documento de Catálogo (`CatalogConceptRoutes`)
*   **Archivo**: `CatalogConceptRoutes/CatalogTypeDocument.route.ts`
*   **Endpoints Técnicos** (Autenticados):
    *   `POST` `/createTypeDocument` / `GET` `/getAllTypeDocuments` / `PUT` `/updateTypeDocument/:id` / `DELETE` `/deleteTypeDocument/:id`: ABM de tipología de documentos de bitácora (Fletes, Reportes, etc.).
    *   `POST` `/bulkCreateTypeDocument` / `PUT` `/bulkUpdateTypeDocument`: Carga masiva de tipos de documentos.
    *   `GET` `/getLabelsValues`: Retorna listado llave-valor para selectores de interfaz.

---

### 17. Avisos e Informativos (`AnuncioRoutes`)
*   **Archivo**: `AnuncioRoutes/anuncio.route.ts`
*   **Endpoints Técnicos** (Públicos/Sin Auth):
    *   `GET` `/`: Obtiene todos los banners informativos activos vigentes.
    *   `POST` `/`: Crea un banner informativo (administrador).
