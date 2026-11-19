# Fase 112C: implementación local controlada y pruebas

18 de noviembre de 2026. Rama `ajustes-docente-v4`; HEAD conservado en `a573c15d322e7c3e8cec4aebe4e2e9b8e49d81bc`. Implementación autorizada de los puntos 1, 2 y 3. Sin commit, push, merge o despliegue de 112C.

**Estado vigente tras autorizar el complemento:** el módulo lateral Reportes y sus exportaciones PDF/Excel ya están implementados localmente, conforme al [plan ampliado](112C_PLAN_REPORTES_JEFE.md). El borrador técnico vuelve a admitir ASISTENTE/PRACTICANTE con asignación propia, incluso finalizada. Esta regla sustituye la exclusividad JEFE del borrador documentada en la entrega inicial que se conserva a continuación. Consultar [112C_REPORTES_IMPLEMENTACION_Y_PRUEBAS.md](112C_REPORTES_IMPLEMENTACION_Y_PRUEBAS.md) para los resultados actuales, pruebas nuevas e inventario adicional. Prioridad, autotoma y la decisión de no cambiar la reapertura se conservan; esta ampliación tampoco está publicada.

## Funciones implementadas

**Reporte institucional:** el endpoint existente de borrador solo admite JEFE, aunque un técnico haya tenido asignación histórica. El frontend expone la pestaña Informe institucional únicamente al JEFE en el detalle. Consulta datos reales de incidencia/intervenciones y duración; informa que es un borrador y no simula PDF, firma o archivo de documentos. Se conservaron el registro técnico, soluciones, cierre y consultas autorizadas para los demás roles. El resumen operativo del dashboard mantiene el acceso por rol/área.

**Sugerencia de prioridad:** Si → Alta, Parcialmente → Media, No → Baja, null → Pendiente de evaluación. El formulario muestra la orientación; el servidor calcula la sugerencia al consultar el contexto. Ninguna lectura ni el registro convierte esa sugerencia en prioridad oficial.

**Prioridad provisional:** solo ASISTENTE habilitado, responsable activo del ciclo por AUTOTOMA, con incidencia en revisión y sin prioridad oficial ni propuesta previa del ciclo. Registra propuesta inicial justificada, pendiente del JEFE. PRACTICANTE y REPRESENTANTE no pueden establecerla. La propuesta se almacena como evento versionado de historial; `incidencias.prioridad` continúa null. Los listados la identifican expresamente como provisional; nunca se presenta como confirmada.

**Revisión del JEFE:** puede confirmar la propuesta o elegir otra prioridad con justificación. Actualiza la prioridad oficial y registra el evento en una sola transacción. La propuesta deja de estar pendiente. La revisión también puede hacerse sobre una incidencia ya cerrada sin modificar su estado o los datos del cierre. El ASISTENTE no puede sustituir prioridades oficiales ni editar repetidamente su propuesta inicial.

**Trazabilidad/concurrencia:** actor obtenido de la identidad autorizada; fecha tomada de PostgreSQL con clock_timestamp después de adquirir el bloqueo de incidencia; anterior/nueva, rol al actuar, justificación, impacto considerado y ciclo en el evento. Ciclo, versión del evento y valor oficial anterior se validan antes de escribir. Una petición obsoleta devuelve 409. No se confía en actor, rol u oficialidad enviados por el navegador.

**Autotoma:** el detalle muestra disponibilidad consultada al servidor para JEFE/ASISTENTE/PRACTICANTE. Utiliza la ruta V3 existente para ciclo 1 y una operación nueva V4 para un ciclo ya reabierto. La nueva toma V4 verifica esquema completo, ciclo esperado, estado En revisión, observación del ciclo anterior y ausencia de responsable activo; bloquea la fila, crea asignación propia AUTOTOMA e historial atómicos. No reabre tickets ni reutiliza soluciones/asignaciones antiguas. REPRESENTANTE y perfiles deshabilitados quedan excluidos. El JEFE puede tomar y atender como responsable.

## Contratos nuevos de esta implementación local

| Ruta | Uso y permisos |
| --- | --- |
| `GET /api/incidencias/{id}/contexto-toma` | Capacidad y ruta de toma para personal TI habilitado, sin exponer la lista administrativa de técnicos |
| `POST /api/v4/incidencias/{id}/tomar` | Toma propia de ciclo >1 ya reabierto; cuerpo con ciclo esperado, sin técnico/actor del cliente |
| `GET /api/incidencias/{id}/contexto-prioridad` | Sugerida, oficial, provisional, revisión, versión y capacidad. REPRESENTANTE solo en su área |
| `POST /api/incidencias/{id}/prioridad` | Prioridad y justificación; ciclo/versión/anterior como precondiciones. El servidor decide confirmación JEFE o propuesta ASISTENTE |

Son rutas del código local, **no se han publicado**. La toma V3 y el borrador mantienen sus URLs existentes. El listado añade campos opcionales `prioridad_provisional` y `prioridad_revision_pendiente`; el campo prioridad conserva el significado oficial. No se requieren columnas nuevas para los puntos implementados: se reutilizan prioridad e historial existentes.

Se reutiliza la bandera frontend existente `VITE_PERMITIR_ASIGNACION_REAL` para las nuevas escrituras de toma/prioridad. No se cambió su valor ni se añadieron variables. Con false los controles quedan deshabilitados y explicados; la autorización de FastAPI se verifica independientemente de cualquier bandera del navegador.

## Archivos de la implementación

| Archivo | Cambio |
| --- | --- |
| `backend/app/prioridades.py` (nuevo) | Sugerencia, formato y lectura de auditoría/propuestas por ciclo |
| `backend/app/routes/operaciones_ti.py` (nuevo) | Contextos de toma/prioridad y escritura auditada con precondiciones |
| `backend/app/routes/v4_asignaciones.py` | Añade autotoma V4; conserva la asignación JEFE existente |
| `backend/app/routes/informes.py` | Reporte institucional exclusivo del JEFE |
| `backend/app/lecturas_incidencias.py` | Propuesta provisional por ciclo en listados, por lote |
| `backend/app/routes/incidencias.py` | Campos opcionales de lectura provisional; no modifica cierre/verificación |
| `backend/app/main.py` | Registro del router nuevo |
| `frontend/src/tiOperations.ts` (nuevo) | Contratos y transporte; validación de ruta/ciclo y descripción de auditoría |
| `frontend/src/RealTake.tsx` (nuevo) | Toma según capacidad real, revalidación y bandera existente |
| `frontend/src/RealPriority.tsx` (nuevo) | Sugerencia/propuesta/oficial, justificación y revisión por JEFE |
| `frontend/src/RealInstitutionalReport.tsx` (nuevo) | Consulta del borrador institucional real |
| `frontend/src/RealTicketDetail.tsx` | Integra componentes por rol, pestaña JEFE y auditoría legible |
| `frontend/src/RealRegister.tsx` | Sugerencia orientativa del impacto; no añade prioridad al envío |
| `frontend/src/RealTicketList.tsx` y `api.ts` | Campos/etiqueta provisional y búsqueda, conservando las siete cabeceras |
| `frontend/src/index.css` | Estilos locales de los nuevos paneles y formularios |
| `.github/scripts/probar_funcional_112c.py` (nuevo) | Pruebas FastAPI, permisos y concurrencia PostgreSQL V3/V4 aislados |
| `backend/tests/test_diagnostico_112c.py` | Convierte la caracterización de acceso técnico al reporte en regresión de exclusividad JEFE; conserva casos negativos y técnicos |
| `backend/tests/test_preentrega_111a.py` | Añade historial a la fixture de lecturas; conserva todas las aserciones previas |
| `frontend/tests/ti-operations.test.mjs` (nuevo) | Transporte, precondiciones y auditoría de las operaciones nuevas |
| `frontend/tests/ticket-list.test.mjs` | Añade comprobación de etiqueta provisional sin retirar pruebas anteriores |
| `.github/workflows/verificar-backend.yml` | Actualiza la expectativa del reporte a JEFE 200/técnicos 403; mantiene las comprobaciones del contenido y filtros |
| Este informe y `112C_IMPACTO_REAPERTURA_MANUAL.md` (nuevos) | Resultados actuales y propuesta separada pendiente |

Se conserva el diagnóstico inicial `112C_DIAGNOSTICO_Y_PLAN.md` como documento previo a la autorización. Los nueve archivos pendientes de 112A no se modificaron ni se incorporaron a una publicación.

## Pruebas ejecutadas

| Verificación | Resultado y alcance |
| --- | --- |
| `npm test` | **20/20**. Conserva las 15 anteriores y añade cinco casos de transporte/etiqueta provisional |
| `npm run build` | **Aprobada**, TypeScript y Vite estándar. El primer intento encontró el bloqueo de lectura del sandbox; el mismo comando completó con autorización de ejecución local |
| unittest discover backend/tests | **25/25**. Incluye 111A/112B y los diagnósticos disponibles, con datos aislados |
| `probar_funcional_112c.py --puerto 55432` | **28/28**, PostgreSQL real de QA: 11 casos V3 y 17 V4. Rol de conexión soporte_ti_api restringido, políticas originales reproducidas en las bases nuevas |
| Preentrega 110F | **28/28** rutas, autenticación, CORS y banderas |
| Workflows reproducidos localmente | **21 bloques aprobados, cero fallidos**. Siete bloques requieren Docker y no se ejecutaron con ese formato; las pruebas nuevas PostgreSQL no se contabilizan como aprobación de esos siete |
| Navegador con API/DB locales | Cuatro roles ficticios. Toma ASISTENTE, propuesta provisional sin oficial, revisión JEFE, informe JEFE, toma/atención disponible PRACTICANTE sin prioridad/reportes, sugerencia REPRESENTANTE sin envío, toma/propuesta del ciclo 2 e historial anterior visible |
| Responsive y teclado | **16 combinaciones**, cuatro roles por 1440/768/390/320 px. Sin desbordamiento de página, campos fuera del ancho o alertas en los estados medidos; foco visible por teclado en justificación |
| Variante con banderas false | Toma y justificación de prioridad deshabilitadas aun con capacidad JEFE válida; avisos visibles. Cero errores de consola capturados en el recorrido |
| Compilación Python y diff | compileall aprobado; revisión de diff, archivos nuevos y ausencia de cambios en los mecanismos excluidos |

Cobertura PostgreSQL destacada: dos tomas simultáneas; asignación JEFE frente a autotoma en V3 y V4; propuestas y confirmaciones concurrentes con una sola ganadora; versiones/ciclos obsoletos; actor falsificado/campos extra, enum y motivo inválidos; área ajena; usuario deshabilitado; rollback sin prioridad huérfana; historial por ciclo; ASISTENTE y JEFE tomando, interviniendo y cerrando como responsables, también en ciclo reabierto; reportes denegados a técnicos incluso con participación histórica.

Los fallos iniciales de pruebas se corrigieron en las fixtures/aserciones: representación de Headers del navegador y comparación de fechas equivalentes con distinto huso horario. No implicaron relajar permisos ni modificar la reapertura. Se conserva un aviso no bloqueante de deprecación Starlette/httpx en las dependencias de pruebas.

## Aislamiento y reproducción

La instalación PostgreSQL disponible carecía de archivos de servidor. Se extrajo un paquete completo del distribuidor enlazado por [PostgreSQL para Windows](https://www.postgresql.org/download/windows/), desde [EDB](https://productsdl.enterprisedb.com/download-postgresql-binaries), fuera del repositorio. Se creó un clúster nuevo de QA en loopback, con marcador `grocio.entorno_pruebas=112c_aislado`, sin usar el servicio ni bases existentes. El runner rechaza cualquier servidor sin ese marcador y no acepta un host o URL remotos.

Las fixtures crean bases de nombre aleatorio pruebas_112c y estructuras nuevas V3/V4 mediante CREATE TABLE, sin ejecutar la migración 03, sin ALTER de ciclos sobre registros existentes y sin modificar reglas RLS del proyecto. Auth se representa por una tabla y perfiles ficticios locales. Se ejecutan APIs reales y se reproducen las políticas existentes para el rol restringido dentro de esas bases. No hay cuentas Supabase ni credenciales municipales en este circuito.

El gateway privado para navegador usa identidades ficticias y el FastAPI local contra ese PostgreSQL. Las dos compilaciones QA definen exclusivamente localhost y guardan artefactos fuera de Git; no cambian .env ni Vercel. Capturas y matriz-ui-112c.json quedan fuera del repositorio. Al finalizar se detuvieron gateway y clúster QA.

Para repetir las pruebas PostgreSQL, preparar otro clúster aislado con el marcador indicado, rol local qa112c y ejecutar el runner con su puerto local. No apuntarlo a una instancia existente ni recrear perfiles municipales. Backend/frontend nuevos deben revisarse juntos antes de una futura publicación; confirmar permisos efectivos y esquema del destino mediante revisión autorizada, sin habilitar banderas automáticamente.

## Bloqueado y pendiente de aprobación específica

El objetivo de que una observación **no** reabra automáticamente todavía no está implementado. V3 conserva Cerrado; V4 sigue reabriendo automáticamente. No cambiaron verificaciones.py, v4_verificaciones.py, v4_reglas.py, v4_guardia.py ni los scripts SQL operativos. La nueva toma V4 opera después de que el ciclo ya exista.

Las regresiones documentan la conducta actual y un riesgo: en un caso legado sin evento CIERRE ni evidencia histórica completa, V4 limpia fecha/cerrador vigentes sin crear su snapshot. No se garantiza protección completa de ese caso con el mecanismo actual. La preservación explícita del cierre y la reapertura manual requieren la aprobación descrita en [impacto de reapertura manual](112C_IMPACTO_REAPERTURA_MANUAL.md), antes de cambiar el flujo o ejecutar migraciones.

PDF/firma/archivo de reportes, Brevo, adjuntos y administración completa siguen pendientes. No se validaron escrituras municipales ni nuevas sesiones de las titulares reales; esta entrega es local. No se tocaron autenticación/sesiones, cuentas, incidencias, credenciales, variables de entorno o RLS municipales.
