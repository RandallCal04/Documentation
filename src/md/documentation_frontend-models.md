# Documentación de Modelos de Datos: Integración del Frontend, Procesos y Negocio de la API

Este documento describe de manera exhaustiva el esquema y estructura de datos del proyecto (`src/api/models/`), explicando la lógica relacional entre colecciones de MongoDB (Mongoose), las restricciones y tipos de datos esperados para la integración con el frontend, y las implicaciones de negocio de cada modelo.

---

## Sección 1: Documentación para el Frontend (Guía de Integración)

El frontend interactúa con los modelos de datos serializados en formato JSON. Para asegurar que las peticiones no sean rechazadas por validaciones del backend o generen incoherencias financieras, se deben seguir estas directrices:

### 1. Formatos y Tipos de Datos Estrictos
*   **Fechas (Dates):** Se manejan de dos formas según el caso:
    *   *Fechas operativas:* Ciertos modelos almacenan la fecha como un string con formato `YYYY-MM-DD` (ej. `dailyReportDate` o en `LaborDayType.day`) para evitar desfasamientos por zona horaria.
    *   *Fechas del sistema:* Los campos automáticos (`createdAt`, `updatedAt`, `expiresAt`) son objetos `Date` de MongoDB tratados como UTC medianoche.
*   **Horarios (Time):** Todos los intervalos de horas en las actividades se definen como string bajo el formato de 24 horas `"HH:mm"` (ej. `"08:00"`, `"17:30"`).
*   **Valores Fraccionarios (Volumes):** Los campos que representan porciones de jornada (`valueOperation`, `valueAvailable`, etc.) son valores decimales del `0.00` al `1.00`. Al enviarse al backend, la suma acumulada debe dar exactamente `1.00`.

### 2. Relaciones y Búsquedas (ObjectIds)
Para las llaves foráneas en MongoDB (referencias a otras colecciones), el frontend debe proveer el `_id` de Mongoose (string hexadecimal de 24 caracteres).
*   *Evitar Lookup N+1:* En listados optimizados (ej. Trazabilidad), el backend devuelve el nombre resuelto (como `shipName` o `targetName`). Sin embargo, para escrituras, se requiere obligatoriamente el `ObjectId` del catálogo.

### 3. Restricciones de Índices Únicos (Evitar Duplicados)
El frontend debe prevenir envíos duplicados que violen los índices únicos a nivel de base de datos. Los principales índices únicos son:
*   **`TrazabilityHistoryModel`:** Clave compuesta por `{ lineItem, equipment, serviceDate, requestNo }`. No se pueden registrar dos filas de costo definitivas para el mismo equipo en la misma fecha bajo la misma partida y número de TEB.
*   **`DepartureModel`:** El código de la partida presupuestal (`code`) es único.
*   **`ResourceModel`:** El código del recurso (`catalog.code`) es único.
*   **`FictitiousTeb`:** El folio autogenerado del TEB ficticio (`folio`) es único.

---

## Sección 2: Guía de Procesos y Negocio por Carpeta de Modelo

A continuación se detallan las 22 carpetas de modelos dentro de `src/api/models/`, indicando su relevancia operativa y campos clave.

---

### 1. `ActivityModels` (`ActivityModel`)
*   **Importancia de Negocio:** Detalla cada bloque de actividad horaria de un equipo o cabo durante su jornada diaria.
*   **Campos Clave:**
    *   `idReport` (Ref → `Report`): Reporte diario al que pertenece.
    *   `activityType`: Tipo de actividad (`"OP"` = Operación, `"DISP"` = Disponibilidad, `"MTTO"` = Mantenimiento, `"FS"` = Fuera de Servicio).
    *   `startTime` / `endTime`: Horario del bloque (formato `"HH:mm"`).
    *   `listTeb` / `listCab` / `listCax`: Arreglo de strings conteniendo los códigos de documentos asociados.
    *   `targetInstallationActivie` / `shipActivie` / `serviceInstallationActivie` (Refs → `CatalogList`): Sobrescriben las instalaciones base del reporte para esta actividad.

---

### 2. `Anuncios` (`AnuncioModel`)
*   **Importancia de Negocio:** Define banners o notificaciones que se muestran en el dashboard del frontend para comunicar alertas operativas.
*   **Campos Clave:**
    *   `title` / `description`: Textos principales del anuncio.
    *   `badgeVariant`: Estilo del tag (`"default"`, `"success"`, `"warning"`, `"info"`).
    *   `active`: Estado booleano de publicación.
    *   `expiresAt`: Fecha límite de visibilidad.

---

### 3. `BaseTebsModels` (`BaseTebsModel`)
*   **Importancia de Negocio:** Almacena la base de datos contractual de TEBs, CABs y CAXs cargada por administración. Define dónde se deben facturar los recursos.
*   **Campos Clave:**
    *   `requestService`: Número de solicitud de servicio (TEB).
    *   `cab` / `cax`: Códigos de soporte presupuestal asociados.
    *   `placeServiceProvided`: Instalación asignada contractualmente para el servicio.
    *   `budgetProgram` (PEP) / `element` (EPEP): Datos contables estructurados.

---

### 4. `CatalogConceptModels` (`CatalogConceptModel` / `CatalogTypeDocumentModel`)
*   **Importancia de Negocio:** Define las tipologías de los documentos cargados al sistema y las clasificaciones del catálogo de conceptos financieros.
*   **Campos Clave:**
    *   `typeDocument`: Código de tipo (ej. `"TEB"`, `"CAB"`, `"CAX"`).
    *   `description`: Explicación del tipo de documento.

---

### 5. `CatalogEquipmentsModels` (`CatalogEquipmentModel`)
*   **Importancia de Negocio:** Catálogo maestro de equipos físicos y perfiles de operarios autorizados en el contrato.
*   **Campos Clave:**
    *   `code`: Código interno del equipo (ej. `"GR-01"`).
    *   `description`: Nombre o detalle técnico.
    *   `typeEquipment`: Categoría (grúa, hiab, cabo, maniobrista, tractocamion).

---

### 6. `ConfigModels` (`CatalogListModel` / `ConfigurationsModel`)
*   **Importancia de Negocio:** Alberga los diccionarios dinámicos configurables del sistema (catálogos de barcos, instalaciones de servicio e instalaciones destino) y variables globales del sistema.
*   **Campos Clave (`CatalogList`):**
    *   `key`: Tipo de catálogo (`"ship"`, `"installationDestination"`, `"serviceInstallation"`).
    *   `value`: Nombre legible.

---

### 7. `ConnectionModels` (`ProfilesModel` / `ConnectionModel`)
*   **Importancia de Negocio:** Gestiona la conectividad activa de los clientes (especialmente escáneres Electron) y los perfiles de usuario.
*   **Campos Clave (`Connection`):**
    *   `idOffice`: Oficina asociada (ej. `"MTY"`).
    *   `idSocket`: ID del socket asignado en tiempo de ejecución.
    *   `StatusSocket`: Estado de conexión (`"CONNECTED"`, `"DISCONNECTED"`).

---

### 8. `DashboardModels` (`DashboardModel` / `DashboardMetricModel` / `IAJobModel`)
*   **Importancia de Negocio:** Almacena layouts de visualización de usuarios, metas de KPI y la cola de procesamiento asíncrono del analista de IA.
*   **Campos Clave (`IAJob`):**
    *   `jobId`: UUID de la tarea en segundo plano.
    *   `status`: Estado del job (`"pending"`, `"processing"`, `"completed"`, `"failed"`).
    *   `result`: JSON final generado por Claude y Gemini.

---

### 9. `DepartureModels` (`DepartureModel` / `SubItemsModel` / `RelationDepartureEquipmentTypeModel`)
*   **Importancia de Negocio:** Estructura las partidas del contrato y los laborDays trabajados.
*   **Campos Clave (`SubItems`):**
    *   `idDeparture` (Ref → `Departure`): Partida a la que pertenece.
    *   `idCatalogEquipment` (Ref → `CatalogEquipment`): Equipo asociado.
    *   `laborDays` (LaborDayType[]): Días laborados por el equipo, incluyendo el desglose proporcional de actividades (`activitiesBreakdown`).

---

### 10. `EditModeModels` (`EditModeModel`)
*   **Importancia de Negocio:** Bitácora histórica (Audit Log) de las modificaciones de datos clave realizadas por los usuarios.
*   **Campos Clave:**
    *   `typeModification`: Tipo de cambio realizado.
    *   `nameProperty`: Propiedad o campo afectado.
    *   `actualDate`: Fecha del cambio.

---

### 11. `EstimatedCostModels` (`EstimatedCostModel`)
*   **Importancia de Negocio:** Mapea proyecciones de costes asignadas a laborDays individuales para estimaciones previas a la trazabilidad final.

---

### 12. `ExportTaskModel` (`ExportTaskModel`)
*   **Importancia de Negocio:** Monitorea las solicitudes de generación asíncrona de archivos Excel pesados.
*   **Campos Clave:**
    *   `type`: Tipo de exportación (ej. `"traceability"`).
    *   `status`: `"PENDING"`, `"PROCESSING"`, `"COMPLETED"`, `"FAILED"`.
    *   `fileUrl`: Enlace de descarga una vez generado.

---

### 13. `FictitiousTeb` (`FictitiousTebModel` / `FictitiousTebPivotModel`)
*   **Importancia de Negocio:** TEBs provisionales generados para no bloquear el flujo de trazabilidad cuando un reporte refiere a un documento de soporte no cargado aún.
*   **Campos Clave (`FictitiousTeb`):**
    *   `folio`: Código correlativo autogenerado (Prefijo `"TEBF"` + 10 dígitos mediante trigger pre-save).
    *   `status`: Estado actual (`"CREATED"`, `"APPROVED"`, `"REJECTED"`).

---

### 14. `JornDayModels` (`JornDayModel`)
*   **Importancia de Negocio:** Estructura de turnos asignados a las partidas para delimitar la jornada operativa normal de los recursos.

---

### 15. `RegisterInfo` (`saveInfo.ts`)
*   **Importancia de Negocio:** Estructuras tipo comunes para auditoría del creador/modificador del registro en Mongoose. Almacena `userId`, `userName` y `emailUser`.

---

### 16. `ReportModels` (`ReportModel`)
*   **Importancia de Negocio:** Cabecera del reporte de actividad diario de un equipo o cuadrilla de cabos.
*   **Campos Clave:**
    *   `folio`: Folio consecutivo del reporte.
    *   `assetNumber`: Número económico del equipo.
    *   `dailyReportDate`: Fecha operativa de la jornada.
    *   `valueOperation` / `valueAvailable` / `valueMaintenance` / `valueOutOfService`: Fracciones decimales de jornada.

---

### 17. `ResourceModels` (`ResourceModel`)
*   **Importancia de Negocio:** Catálogo de recursos consumibles (combustibles, maniobras auxiliares) asociados a partidas.

---

### 18. `ScannerModels` (`DailyReportScannerSessionModel`)
*   **Importancia de Negocio:** Controla las sesiones de escaneo por OCR/IA en segundo plano.
*   **Particularidad:** Implementa un **índice TTL** (`expireAfterSeconds: 24 * 60 * 60`) sobre `createdAt` para eliminar sesiones viejas automáticamente después de 24 horas y evitar sobrecarga en la base de datos.

---

### 19. `SequenceFolioModels` (`SequenceFolioModel`)
*   **Importancia de Negocio:** Tabla de contadores atómicos utilizada para autoincrementar folios personalizados en MongoDB (como folios de reportes o TEBs ficticios) evitando colisiones de concurrencia.

---

### 20. `TempModels` (`TemporaryDailyReportModel`)
*   **Importancia de Negocio:** Estructuras temporales extraídas por la IA a partir del OCR de PDFs físicos antes de ser confirmadas por el usuario.
*   **Campos Clave:**
    *   `socketId` / `officeId`: Enrutamiento y pertenencia del reporte temporal.
    *   `suggestedEquipment`: Arreglo de equipos sugeridos ordenados por similitud fonética.

---

### 21. `TrazabilityHistoryModel` (`TrazabilityHistoryModel` / `TraceabilityProrrateoModel`)
*   **Importancia de Negocio:** Almacén definitivo de los registros contables de la trazabilidad. Cruza costo de equipos y fletes con TEBs reales (`TrazabilityHistory`) o TEBs vacíos/prorrateados (`TraceabilityProrrateo`).

---

### 22. `TrazabilityTempModel` (`TrazabilityTempModel`)
*   **Importancia de Negocio:** Contenedor temporal de registros de trazabilidad para vista previa y corrección del usuario antes del commit definitivo.
