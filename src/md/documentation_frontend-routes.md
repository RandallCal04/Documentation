# Documentación de Rutas: Integración del Frontend, Procesos y Negocio de la API

Esta documentación detalla la arquitectura de enrutamiento de la aplicación (`src/api/routes/`), el mapeo de prefijos, la protección de endpoints y las instrucciones detalladas para que el equipo de frontend consuma y navegue de manera correcta por los endpoints disponibles.

---

## Sección 1: Documentación para el Frontend (Guía de Integración)

Las rutas exponen los canales de comunicación de la API. El frontend debe conocer las reglas de prefijos, parámetros y seguridad de la capa de enrutamiento.

### 1. Prefijo Global del Servidor
Todos los endpoints cuelgan del prefijo principal configurado en `app.ts`:
```http
http://localhost:3007/api-costeo
```

### 2. Convenciones de Enrutamiento y Parámetros Dinámicos
*   **Parámetros en Ruta (URL Params):** Definidos con dos puntos en Express (ej. `/:id` o `/:startDate/:endDate`). El frontend debe inyectar el valor directamente en el string de la URL.
    *   *Ejemplo de Trazabilidad por fechas:* `/api-costeo/traceability/2026-01-01/2026-02-16`
    *   *Ejemplo de búsqueda en catálogo con filtros:* `/api-costeo/catalogequipments/getLabelValueEquipmentWithFilter/busqueda_ejemplo`
*   **Parámetros en Query (Query Params):** Parámetros opcionales agregados después del signo de interrogación `?` (ej. `?limit=10&page=2&searchMonth=05`). Son muy utilizados en listados paginados como en el catálogo de TEBs o trazabilidad histórica.

### 3. Distribución del Middleware de Autenticación (`authMiddleware`)
Las rutas se clasifican según su requerimiento de autenticación:
*   **Rutas Protegidas:** La gran mayoría de las rutas operativas (`/departures`, `/reports`, `/traceability`, `/baseTebs`, `/catalogequipments`) tienen inyectado el `authMiddleware` en sus definiciones de ruta. El frontend debe enviar siempre el token en estas rutas.
*   **Rutas Públicas / Semi-Protegidas:** Ciertos endpoints técnicos de análisis inmediato o recepción directa del escáner físico de reportes (como `/api-costeo/ia-analyzer/analyze` o `/api-costeo/daily-reports/scan/scanner`) no bloquean el paso para permitir integraciones webhook de dispositivos de digitalización y scripts en segundo plano.

---

## Sección 2: Guía de Procesos y Negocio por Carpeta de Ruta

A continuación se detallan el enrutador principal y los 17 subdirectorios de enrutamiento bajo `src/api/routes/`.

---

### 0. Enrutador Raíz (`index.route.ts`)
*   **Propósito de Negocio:** Centraliza y distribuye los enrutadores por dominio o dominio de negocio (Features) bajo sus respectivos prefijos HTTP, asegurando un punto de entrada de enrutamiento limpio, unificado y mantenible.
*   **Estructura y Archivo Físico:** Ubicado en [src/api/routes/index.route.ts](file:///c:/Users/WinterOS/Downloads/api-costeo-prod/api-costeo-prod/src/api/routes/index.route.ts).
*   **Mapeo de Prefijos en Backend:**
    Aquí se detalla cómo se traduce cada ruta del frontend hacia su enrutador específico:

    | Prefijo Relativo | Sub-enrutador Asociado | Controlador Responsable | Propósito Operativo |
    | :--- | :--- | :--- | :--- |
    | `/resources` | `resource.route.ts` | `ResourceController` | Catálogos de insumos, herramientas y consumibles auxiliares. |
    | `/jorndays` | `jornDay.route.ts` | `JornDayController` | Configuración de turnos (matutino, nocturno, mixto) y ajustes de redondeo. |
    | `/departures` | `departure.route.ts` | `DepartureController` | Definición de partidas del contrato y asignación de equipos (`subitems`). |
    | `/catalogequipments` | `CatalogEquipment.route.ts` | `CatalogEquipmentController` | Catálogo de grúas, fletes, y perfiles de cabos/maniobristas. |
    | `/reports` | `report.route.ts` | `ReportController` | Registro de jornadas, subpartidas de mantenimiento y recálculos. |
    | `/activities` | `activity.route.ts` | `ActivityController` | Desglose de actividades diarias (Operación, Disponibilidad, MTTO). |
    | `/generator` | `Generator.routes.ts` | `GeneratorController` | Exportación directa y lógica visual de campos por tipo de equipo. |
    | `/connections` | `connection.route.ts` | `ConnectionController` | Perfiles de conexión y estado de sockets activos de escáneres Electron. |
    | `/baseTebs` | `BaseTeb.route.ts` | `BaseTebController` | Importación masiva, carga de plantillas Excel y vinculación de TEBs. |
    | `/traceability` | `Traceability.routes.ts` | `TraceabilityController` | Motor de trazabilidad contable, exportación asíncrona y sesiones temporales. |
    | `/configs` | `config.route.ts` | `ConfigController` | Listas dinámicas de instalaciones de servicio, instalaciones destino y barcos. |
    | `/anuncios` | `anuncio.route.ts` | `AnuncioController` | Creación de notificaciones globales en tiempo real en la plataforma. |
    | `/dashboard` | `dashboard.route.ts` | `dashboardController` | Feeds de métricas de costos, dispersión ECharts y metas contractuales. |
    | `/daily-reports/scan`| `DailyReportScanner.route.ts` | `DailyReportScannerController` | Carga de reportes físicos, colas de procesamiento OCR y almacenamiento temporal. |
    | `/ia-analyzer` | `ia.route.ts` | `IAController` | Auditoría estratégica de costos asistida por Claude 3.5/4.5 y Gemini. |
    | `/fictitioustebs` | `fictitiousTeb.route.ts` | `FictitiousTebController` | Creación y administración de folios provisionales de TEBs simulados. |
    | `/catalog-type-documents`| `CatalogTypeDocument.route.ts` | `CatalogTypeDocumentController` | Catálogo maestro de clasificaciones y etiquetas de documentos. |

*   **Flujo de Proceso y Middleware:**
    1. La petición HTTP llega a la aplicación Express configurada en `app.ts`.
    2. El middleware de ruteo global la deriva al prefijo `/api-costeo` (ej: `/api-costeo/reports/createReport`).
    3. `index.route.ts` analiza el prefijo del recurso (`/reports`) y lo redirige al sub-enrutador específico (`reportRoutes`).
    4. El sub-enrutador aplica filtros de seguridad (`authMiddleware`) si la ruta está protegida y finalmente ejecuta la función del controlador.

---

---

### 1. `ActivityRoutes` (Prefijo: `/activities`)
*   **Proceso de Negocio:** Expone los endpoints para crear, modificar, consultar y eliminar bloques de actividades diarias de los equipos.
*   **Rutas Clave:**
    *   `POST /createActivity`
    *   `GET /getAllActivities` / `GET /getActivityById/:id`
    *   `PUT /updateActivity/:id`
    *   `DELETE /deleteActivity/:id`
    *   `GET /getAllActivitiesHistory` (Historial detallado para auditoría).

---

### 2. `AnuncioRoutes` (Prefijo: `/anuncios`)
*   **Proceso de Negocio:** Publicación y visualización de notificaciones para el panel central.
*   **Rutas Clave:**
    *   `POST /` (Crear anuncio).
    *   `GET /` (Obtener anuncios activos).
    *   `PUT /:id` / `DELETE /:id`

---

### 3. `BaseTebRoutes` (Prefijo: `/baseTebs`)
*   **Proceso de Negocio:** Administra los flujos de carga masiva de catálogos y TEBs, vinculación de archivos PDF y reemplazo de valores en bloque.
*   **Rutas Clave:**
    *   `POST /uploadTebsManual` / `/uploadTebsScanner` (Usa Multer para recibir archivos).
    *   `POST /insertTebsMassive` (Inserción de JSON estructurado).
    *   `POST /importExcelChunk` (Lectura chunked de filas).
    *   `POST /generateFormatTebExcel/:dateFech` (Descarga plantilla en Excel).
    *   `GET /listTebsNotInActivity` (Muestra TEBs libres de actividades).
    *   `PUT /replaceTebValue` (Reemplazo masivo de un código TEB/CAB/CAX por otro en los reportes).

---

### 4. `CatalogConceptRoutes` (Prefijo: `/catalog-type-documents`)
*   **Proceso de Negocio:** Define la taxonomía y etiquetas del catálogo de tipos de documentos.
*   **Rutas Clave:**
    *   `POST /createTypeDocument/` / `GET /getAllTypeDocuments/`
    *   `POST /bulkCreateTypeDocument/`
    *   `GET /getLabelsValues/` (Etiquetas configuradas para visualización del frontend).

---

### 5. `CatalogEquipmentRoutes` (Prefijo: `/catalogequipments`)
*   **Proceso de Negocio:** Gestión del catálogo de recursos, asignación de cuadrillas de cabos y operarios, y validaciones contractuales de equipos.
*   **Rutas Clave:**
    *   `POST /createCatalogEquipment/` / `GET /getAllCatalogEquipments/`
    *   `GET /getLabelValueEquipment/:typeDeparture/:idPartida` (Selectores inteligentes del frontend).
    *   `GET /getCabosByShiftType/:shiftType` / `GET /getManiobristasByCaboId/:caboId`
    *   `POST /assignCaboAndManeuverer/` (Asocia un maniobrista a una cuadrilla).
    *   `GET /validateEquipmentToShip/:equipmentId/:blockDepartures` (Valida si un equipo está permitido operar en barcos bajo los bloques de partidas).

---

### 6. `ConfigRoutes` (Prefijo: `/configs`)
*   **Proceso de Negocio:** Catálogos paramétricos (instalaciones, embarcaciones) y configuraciones generales del servidor.
*   **Rutas Clave:**
    *   `POST /createCatalogList` / `POST /bulkCreateCatalogList`
    *   `GET /getListByCode/:code` (ej. `/getListByCode/ship` retorna la lista de barcos).
    *   `POST /createConfigurations` / `GET /getAllConfigurations`

---

### 7. `ConnectionRoutes` (Prefijo: `/connections`)
*   **Proceso de Negocio:** Estado de emparejamiento de los clientes Electron y perfiles de permisos.
*   **Rutas Clave:**
    *   `POST /createConnection` / `GET /getAllConnections`
    *   `GET /getProfiles` (Roles y permisos).

---

### 8. `DailyReportRoutes` (Prefijo: `/daily-reports/scan`)
*   **Proceso de Negocio:** Endpoints dedicados a la subida de PDFs físicos y digitalización en background con notificaciones en tiempo real.
*   **Rutas Clave:**
    *   `POST /upload` (Multer array upload, procesa en background, devuelve `sessionId`).
    *   `POST /scanner` (Recepción automatizada desde terminal física).
    *   `GET /session/:sessionId` (Estado de la extracción de reportes).
    *   `POST /temp-daily-reports` (Consulta reportes digitalizados temporales).

---

### 9. `DashboardRoutes` (Prefijo: `/dashboard`)
*   **Proceso de Negocio:** Rutas de consulta financiera de costes acumulados, metas y ejecución del cronjob del dashboard.
*   **Rutas Clave:**
    *   `GET /getActualCostsByCategory`
    *   `POST /loadDashBoardScatter` (Feeds para gráficas de dispersión).
    *   `GET /getTotalCostsComparedWithGoal`
    *   `POST /cronJob/refresh` (Fuerza la ejecución manual de actualización del dashboard).

---

### 10. `DepartureRoutes` (Prefijo: `/departures`)
*   **Proceso de Negocio:** Creación y edición de partidas presupuestales, asignación de subitems (recursos físicos) y vistas estructuradas de cobro mensual.
*   **Rutas Clave:**
    *   `POST /createDeparture` / `POST /addSubItem`
    *   `GET /getViewAll/:month/:year` (Vista mensual de grúas y equipos).
    *   `GET /getViewAllFlete/:month/:year` (Vista mensual de fletes operados).
    *   `GET /getViewAllLimit/:startDate/:endDate` (Obtiene el array aplanado de laborDays pre-trazabilidad).
    *   `GET /getHierarchicalData/:month/:year` (Estructura de árbol de partidas y costos).

---

### 11. `FictitiousTebRoutes` (Prefijo: `/fictitioustebs`)
*   **Proceso de Negocio:** Control de TEBs simulados generados temporalmente por el sistema.
*   **Rutas Clave:**
    *   `POST /createFictitiousTeb` (Con inyección de archivos Multer).
    *   `GET /getLastFolioTebFictitious` (Consulta el folio disponible).
    *   `GET /getAllFictitiousTebs`

---

### 12. `GeneratorRoutes` (Prefijo: `/generator`)
*   **Proceso de Negocio:** Rutas de compatibilidad de inputs por equipos y generación síncrona/directa de reportes Excel.
*   **Rutas Clave:**
    *   `GET /determinate-show-inputs/:equipmentId` (Determina qué inputs debe pintar el modal según el tipo de equipo).
    *   `POST /generateExcel` (Exporta Excel directo de equipos).
    *   `POST /generateExcelFlete` (Exporta Excel directo de fletes).

---

### 13. `JornDayRoutes` (Prefijo: `/jorndays`)
*   **Proceso de Negocio:** Horarios y reglas de redondeo de jornadas operativas.
*   **Rutas Clave:**
    *   `POST /createJornDay` / `GET /getAllJornDays`
    *   `GET /listJornDaysShort` (Shorthand para selectores).

---

### 14. `ReportRoutes` (Prefijo: `/reports`)
*   **Proceso de Negocio:** CRUD de reportes diarios físicos, búsqueda de duplicados e inicio de recálculos de precios/jornadas históricas.
*   **Rutas Clave:**
    *   `POST /createReport` / `PUT /updateReport/:id`
    *   `POST /validate-volume` (Validación de jornada límite de 1.0 para el recurso).
    *   `POST /bulk-recalculate-prices` (Recalcula los importes totales en base a los nuevos precios unitarios).
    *   `POST /normalize-fleet-blocks` (Normaliza los bloques de flete reportados).

---

### 15. `ResourceRoutes` (Prefijo: `/resources`)
*   **Proceso de Negocio:** Administra los consumos y recursos complementarios del contrato.
*   **Rutas Clave:**
    *   `POST /createResource/` / `GET /getAllResources/`
    *   `PUT /updateResource/:id` / `DELETE /deleteResource/:id`

---

### 16. `TraceabilityRoutes` (Prefijo: `/traceability`)
*   **Proceso de Negocio:** Rutas de control del motor de trazabilidad contable y el ciclo de la sesión temporal.
*   **Rutas Clave:**
    *   `POST /generate-temp-async` (Inicia generación asíncrona de sesión temporal).
    *   `GET /temp/:sessionId` (Consulta y filtra registros en previsualización temporal).
    *   `POST /commit/:sessionId` (Confirma y persiste la trazabilidad temporal en producción).
    *   `DELETE /temp/:sessionId` (Descarta la sesión temporal).
    *   `POST /traceabilityExcelReportAsync` (Genera Excel masivo en background).
    *   `GET /exportStatus/:taskId` (Consulta estado de tareas asíncronas).

---

### 17. `iaAnalistaRoutes` (Prefijo: `/ia-analyzer`)
*   **Proceso de Negocio:** Control del analizador multi-agente de Inteligencia Artificial.
*   **Rutas Clave:**
    *   `POST /analyze` (Inicia análisis de ECharts o focus específicos).
    *   `POST /analysis-live` (Inicia análisis completo del dashboard consultando base de datos).
    *   `GET /analyze/status/:jobId` (Polling de estado y recuperación del informe final validado).
