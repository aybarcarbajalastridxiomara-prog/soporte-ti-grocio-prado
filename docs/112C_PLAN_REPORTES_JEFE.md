# Fase 112C: complemento del módulo Reportes del JEFE

18 de noviembre de 2026. Rama `ajustes-docente-v4`, HEAD `a573c15d322e7c3e8cec4aebe4e2e9b8e49d81bc`. Revisión de código local y planificación; sin consultas municipales, instalación de dependencias, modificación funcional, SQL remoto, cambios de entorno, commit, push o despliegue.

**Estado posterior a la aprobación:** este plan se conserva como antecedente. El módulo ya está implementado y probado localmente, sin publicación. Resultados, archivos, dependencias y límites actuales en [112C_REPORTES_IMPLEMENTACION_Y_PRUEBAS.md](112C_REPORTES_IMPLEMENTACION_Y_PRUEBAS.md). Las expresiones «todavía inexistentes» o «pendiente de implementación» siguientes corresponden al momento de planificación, no a la entrega final.

## Alcance y estado real

El JEFE necesita una vista propia **Reportes** en el menú lateral para consultar estadísticas e incidencias reales, aplicar fecha/área/estado/prioridad/responsable y descargar PDF y Excel. Las consultas institucionales, su generación y cada descarga deben comprobar JEFE habilitado en FastAPI. El dashboard y los informes técnicos autorizados de otros roles se conservan.

La implementación local previa de 112C solo añadió una pestaña por incidencia y restringió el borrador técnico al JEFE. **El módulo solicitado no está implementado.** Este complemento sustituye la clasificación del borrador técnico como único reporte institucional. La autorización para prioridad/autotoma y la decisión de no cambiar todavía la reapertura se conservan.

## Inventario comprobado en el repositorio

| Recurso existente | Alcance y reutilización |
| --- | --- |
| `GET /api/incidencias` | Lista real con estado, mis_atenciones y límite 50 por defecto/100 máximo. No tiene rango de fechas, área, prioridad, responsable ni paginación completa. Reutilizar modelos y enriquecimiento; no exportar solamente las filas descargadas por el dashboard |
| `GET /api/incidencias/resumen` | Conteos completos total/pendientes/en revisión/cerradas. REPRESENTANTE restringido por área. No aplica los cinco filtros institucionales; conservar su acceso operativo y reutilizar el patrón de agregación, no sus resultados como resumen filtrado |
| `GET /api/incidencias/{id}/informe-tecnico/borrador` | JSON de una incidencia, intervenciones y duración; requiere intervenciones o devuelve 409. Sin PDF/Excel. En HEAD publicado admite JEFE y ASISTENTE/PRACTICANTE con alguna asignación propia, incluso finalizada; el cambio local 112C lo restringe a JEFE |
| `GET /api/incidencias/{id}/intervenciones` y `/{id}/historial` | Consultas técnicas existentes con sus reglas de autorización. Conservarlas, así como registro, solución y cierre autorizados; no convertirlas en rutas institucionales |
| `GET /api/areas` y `GET /api/usuarios` | Catálogos reales, ya exclusivos de JEFE mediante require_roles. Reutilizables para filtros sin leer Supabase Auth ni habilitar edición/invitaciones |
| `GET /api/seguimiento/observadas` | Ya exige JEFE, pero solo incluye Cerrado con última evaluación Observación. No es un inventario completo de observaciones V4 ni una fuente suficiente de estadísticas institucionales |
| `get_current_user` / `require_roles("JEFE")` | Validan identidad, perfil habilitado y rol en PostgreSQL. Reutilizar en todas las rutas institucionales, incluidas descargas directas |
| `condicion_ciclo` / `enriquecer_incidencias` | Resuelven área, responsable activo del ciclo o cerrador y prioridad provisional diferenciada de la oficial. Reutilizar por lote y con detección V3/V4 existente |
| `RealApp.tsx` | Sin vista/opción Reportes. Incorporar navegación JEFE y control de vista permitido, además de la protección del servidor |
| `solicitarAPI` | Transporte autenticado con renovación, actualmente decodifica JSON. La descarga necesita un transporte de bytes que conserve sus comprobaciones, renovación y tratamiento de errores |
| Dependencias y exportadores | requirements.txt y package.json no declaran generadores PDF/XLSX; no se encontraron rutas de exportación ni descarga conectadas en el frontend real. Un archivo PDF admitido como adjunto no es un generador de reportes |

## Separación de informes técnicos e institucionales

Antes de completar el nuevo módulo, corregir la restricción local del borrador técnico para conservar el permiso técnico anterior, con pruebas de participación/asignación y rechazo de técnicos ajenos. No abrirlo a REPRESENTANTE ni ampliar su alcance por el simple hecho de tener un rol TI. Mantener intacta la autenticación y la consulta de perfil habilitado.

La pestaña técnica deberá nombrarse y mostrarse según ese permiso técnico; su disponibilidad no otorga acceso al módulo institucional. Los endpoints institucionales nuevos no deben llamar ni redirigir a una ruta técnica como sustituto de su propia autorización. Las expectativas de pruebas/workflow que se cambiaron a JEFE exclusivo para el borrador deben ajustarse a esta distinción, conservando sus aserciones de contenido, errores y rechazo de accesos indebidos.

| Perfil | Dashboard/consultas técnicas existentes | Borrador técnico por incidencia | Reportes institucionales y PDF/Excel |
| --- | --- | --- | --- |
| JEFE habilitado | Según reglas existentes | Permitido | Permitido |
| ASISTENTE/PRACTICANTE habilitados | Según reglas existentes | Solo con asignación propia conforme al permiso técnico previo | 403, aunque hayan atendido la incidencia |
| REPRESENTANTE habilitado | Según área y reglas existentes | No permitido | 403 |
| Sin sesión o perfil no habilitado | Rechazado por la autenticación vigente | Rechazado | Rechazado, sin generar documento |

## Primera versión propuesta

Vista **Reportes**, solo JEFE: filtros con etiquetas accesibles, Aplicar/Limpiar, indicadores del conjunto filtrado, desglose por estado/área/prioridad/responsable y tabla paginada con Código, Asunto, Área, Registro, Prioridad y Estado oficiales, y Responsable. Mantener cabeceras con cero filas; distinguir vacío, carga y error. Botones **Exportar PDF** y **Exportar Excel** solo cuando el backend y el formato estén disponibles. Ningún contador ni documento usará datos del prototipo o totales calculados sobre una sola página.

Todos los filtros se combinan mediante AND y se validan en el servidor:

- Fecha: inicialmente fecha de registro, claramente etiquetada. Desde/hasta como días de America/Lima, límites inclusivos para el operador y consulta >= inicio / < día siguiente al fin, con conversión coherente a UTC. Rango invertido o inválido rechazado. No presentar estas cifras como estados históricos a una fecha: describen el estado vigente de incidencias registradas en ese período.
- Área: UUID real de public.areas, incluyendo inactivas cuando tengan historia; sin crear áreas. Todas las áreas solo para JEFE.
- Estado: Pendiente, En revisión o Cerrado; Todos sin predicado adicional.
- Prioridad: oficial Alta, Media, Baja o Pendiente de evaluación/null. Mostrar provisional y revisión pendiente como datos separados; una propuesta ASISTENTE no equivale a prioridad oficial. No excluir silenciosamente valores legados que no coincidan con el catálogo: contabilizarlos como no clasificados y mostrarlos para revisión, sin corregirlos automáticamente.
- Responsable: criterio visible **responsable actual o de cierre**. En abiertas, asignación activa del ciclo; en cerradas, cerrado_por_usuario_id; Sin responsable cuando corresponda. Incluir JEFE y técnicos deshabilitados si tienen registros históricos. No usar solo el selector de asignación que ofrece ASISTENTE/PRACTICANTE habilitados. Participantes históricos o responsables de ciclos anteriores requerirían un filtro distinto y quedan fuera de la primera versión.

La consulta base y los predicados se compartirán entre resumen, tabla y exportadores. Evitar multiplicar incidencias por sus asignaciones/intervenciones: usar EXISTS/subconsulta de responsable o una relación única por incidencia; contar incidencias distintas. Orden estable fecha_registro/id y paginación validada. El resumen abarca todas las coincidencias, no la página. Cada generación debe usar una instantánea coherente de lectura para resumen/detalle y declarar fecha de corte; si hay cambios entre consulta y descarga, el documento representa su propia fecha de corte.

No añadir SLA, promedios de resolución, tasas de conformidad o conteos retrospectivos por ciclo sin definir su semántica y validar la conservación de cierres. El riesgo legado y el mecanismo V4 descritos en 112C_IMPACTO_REAPERTURA_MANUAL.md no se resuelven con un reporte.

### Contratos sugeridos, todavía inexistentes

Router propio `/api/reportes`, con require_roles("JEFE") en todas sus rutas. Nombres propuestos para revisar al implementar:

| Ruta propuesta | Respuesta |
| --- | --- |
| `GET /api/reportes/incidencias` | Filtros normalizados, fecha de corte, total, indicadores/desgloses y página de incidencias |
| `GET /api/reportes/incidencias/exportar?formato=pdf` | Documento PDF generado por el backend sobre el conjunto filtrado autorizado |
| `GET /api/reportes/incidencias/exportar?formato=xlsx` | Libro Excel real, mismo alcance y definición que PDF/consulta |

Las rutas aún no existen y no se han probado. No guardar documentos públicos ni ofrecer URLs que eludan autorización. El servidor obtiene actor/rol desde la sesión, nunca desde parámetros. Cache-Control: no-store, nombre de descarga controlado y Content-Disposition attachment. Token solo en Authorization, nunca en URL. El frontend solicitará bytes autenticados y liberará el objeto de descarga; no guardará tokens o documentos en almacenamiento persistente. No es necesario ampliar CORS: puede usar un nombre de archivo controlado sin leer encabezados no expuestos.

## Viabilidad PDF y Excel

**Viables para implementar y probar localmente; no están disponibles ni certificadas todavía.** No necesitan credenciales administrativas, modificar datos, RLS, variables de entorno ni tablas nuevas para una primera versión de consulta/descarga. La generación puede hacerse por solicitud sin archivo público ni registro persistente de reportes. Archivo institucional permanente, firma, numeración oficial y auditoría persistente de descargas son ampliaciones distintas pendientes de definición/aprobación.

- **Excel `.xlsx`:** evaluar openpyxl como dependencia backend. Hojas Resumen, Incidencias y Filtros/fecha de corte; tipos reales de fecha/número, anchos, autofiltro y cabeceras congeladas. Escribir texto del usuario como texto literal y verificar que no se convierta en fórmulas ni enlaces externos. No renombrar CSV/HTML como Excel ni incluir macros. Sin correos Auth ni otros datos personales innecesarios.
- **PDF:** evaluar ReportLab con tablas paginadas, cabecera institucional, filtros, resumen, siete columnas, fecha de corte y numeración de páginas. Verificar tildes, caracteres, textos largos y repetición de cabeceras. Escapar texto antes de usarlo en elementos con marcado; no cargar imágenes, fuentes o contenido desde URLs aportadas por usuarios. No simular firma, sello ni validez de un documento emitido oficialmente.
- **Dependencias y archivos:** antes de incorporarlas, revisar compatibilidad y versiones, fijarlas y ensayar instalación/build reproducible del backend. Usar buffer de salida en memoria y gestionar/cerrar cualquier temporal que genere la librería; no guardar documentos en el repositorio. No instalar ni modificar requirements en esta planificación.
- **Límites:** medir filas, bytes, memoria y duración con datos ficticios. Vercel documenta un límite de respuesta de 4,5 MB; mantener margen y un máximo de filas medido, informar si se requiere reducir el rango, sin truncar silenciosamente. No asumir que streaming elimina el límite ni aumentar duración/memoria/plan automáticamente. Las condiciones del proyecto desplegado deberán confirmarse antes de publicar; un archivo válido local no certifica viabilidad en Preview.

Fuentes oficiales consultadas para esta evaluación: [ReportLab](https://docs.reportlab.com/reportlab/userguide/ch2_graphics/), [openpyxl: guardado de libros](https://openpyxl.readthedocs.io/en/stable/tutorial.html#saving-to-a-file), [implementación del escritor openpyxl](https://openpyxl.readthedocs.io/en/stable/_modules/openpyxl/writer/excel.html), [respuestas FastAPI](https://fastapi.tiangolo.com/advanced/custom-response/) y [límite de respuesta Vercel](https://vercel.com/docs/errors/function_response_payload_too_large). Son viabilidad y diseño, no evidencia de integración ya realizada.

## Ejecución por prioridades y aceptación

| Orden | Trabajo local propuesto | Evidencia necesaria |
| --- | --- | --- |
| P0 | Separar permisos técnicos/institucionales, conservar el borrador técnico autorizado y añadir router protegido | Matriz de roles, perfil deshabilitado, sin sesión y rechazo directo de consulta/descarga; ningún documento se genera antes de autorizar |
| P1 | Consulta compartida, cinco filtros, indicadores completos y tabla paginada; catálogos reales de lectura | PostgreSQL aislado: >100 incidencias ficticias, combinaciones y límites de fecha Lima, null/legados, responsables JEFE/inhabilitados/sin asignar, varios ciclos sin duplicar conteos |
| P1 | Añadir Reportes a menú/ruta permitida JEFE, conservar resto de navegación | Pruebas por cuatro roles, acceso programático rechazado, vacíos/errores, filtros, teclado/foco y 1440/768/390/320 px |
| P2 | Excel real y PDF con la consulta común y transporte de bytes autenticado | Archivos abiertos/releídos con verificadores, contenido/totales coherentes en datos estáticos, filtros/fecha de corte, múltiples páginas, Unicode y texto potencialmente interpretado como fórmula |
| P2 | Sesión y descarga, límites de exportación y actualizaciones concurrentes | Token inválido/vencido, renovación única, 403 no convertido en descarga, abortar/reintentar sin filtrar credenciales; límite explícito, instantánea coherente por generación y recursos liberados |
| Cierre local | Compilación y regresiones anteriores más pruebas nuevas | npm test/build, backend, permisos, prioridad y autotoma/concurrencia anteriores. No retirar pruebas técnicas por sustituirlas por comprobaciones del menú |

Archivos previsibles: nuevo router/servicio de consultas y exportación en backend, registro del router, esquemas y pruebas; corrección focalizada de informes.py y sus regresiones; RealReports.tsx, navegación RealApp/RealUI, transporte de descargas, estilos y pruebas frontend. La lista final dependerá de la implementación; no son archivos creados en esta revisión.

## Qué puede hacerse localmente y qué queda pendiente

**Siguiente paquete local propuesto:** implementar la separación de permisos, menú, consulta, filtros y totales; después incorporar los exportadores con dependencias verificadas. Todo puede probarse con FastAPI/PostgreSQL aislados y datos ficticios sin tocar el proyecto municipal. Este complemento solo prepara el plan: no ejecuta ese paquete ni modifica el código ya probado.

**Pendiente de implementación/pruebas:** módulo completo, recuperación del permiso técnico previo en el cambio local, integración PDF/Excel, volumen/tiempos, revisión visual, compatibilidad real del backend desplegado y permisos efectivos de lectura del destino. No confundir los resultados de 112C anterior con aprobación de estas funciones nuevas.

**Pendiente de aprobación independiente:** publicación Preview después de pruebas locales; cualquier modificación de configuración/infraestructura si los límites impiden exportar; archivo/firma/numeración/auditoría persistente si se requieren; acceso de validación a datos reales. La reapertura manual conserva su aprobación específica pendiente y no se modifica en este paquete. No se ejecutarán migraciones ni se habilitarán banderas existentes automáticamente.

Esta entrega solo actualiza 112C_DIAGNOSTICO_Y_PLAN.md, 112C_IMPLEMENTACION_LOCAL_Y_PRUEBAS.md y este plan nuevo. No modifica producción, main, cuentas, datos, RLS, credenciales ni variables. No hay commit, push o despliegue.
