# Fase 112C: diagnóstico funcional y propuesta de implementación

18 de noviembre de 2026. Rama exclusiva `ajustes-docente-v4`, base publicada `a573c15d322e7c3e8cec4aebe4e2e9b8e49d81bc`.

**Actualización de alcance, complemento del módulo Reportes:** el diagnóstico siguiente se conserva como antecedente. La implementación local posterior se documenta en `112C_IMPLEMENTACION_LOCAL_Y_PRUEBAS.md`. La aclaración del usuario exige un apartado lateral **Reportes**, consultas institucionales con filtros y exportación PDF/Excel; restringir el borrador técnico no satisface ese objetivo. El plan vigente de esta ampliación está en [112C_PLAN_REPORTES_JEFE.md](112C_PLAN_REPORTES_JEFE.md). Sustituye la propuesta de reclasificar el borrador técnico como institucional: deberán conservarse sus accesos técnicos autorizados y protegerse por separado las nuevas consultas y descargas institucionales. Esta actualización es documental; no implementa el módulo ni cambia permisos en código.

**Implementación posterior del complemento aprobada y terminada localmente:** ver [112C_REPORTES_IMPLEMENTACION_Y_PRUEBAS.md](112C_REPORTES_IMPLEMENTACION_Y_PRUEBAS.md). Incluye menú Reportes JEFE, filtros/totales/paginación, PDF/XLSX y restauración del permiso técnico previo. El diagnóstico y sus resultados de caracterización siguientes son históricos; no describen la autorización final del borrador técnico.

Esta entrega revisa los cuatro objetivos nuevos y añade pruebas de caracterización aisladas. No implementa todavía cambios funcionales. No se repitieron las suites aprobadas de 112B ni se consultaron servicios/datos municipales. No se ejecutaron SQL remoto, cambios de RLS, credenciales, archivos de entorno, cuentas, incidencias, commit, push, merge o despliegue.

## 1. Reportes institucionales exclusivos del JEFE

| Salida | Implementación vigente | Diferencia frente al objetivo 112C |
| --- | --- | --- |
| Borrador de informe técnico por incidencia | `GET /api/incidencias/{id}/informe-tecnico/borrador`, en informes.py. Genera JSON con incidencia, prioridad, intervenciones y duración. JEFE accede a cualquier ticket; ASISTENTE/PRACTICANTE acceden si tuvieron alguna asignación, incluso finalizada. Exige intervenciones; sin ellas responde 409 | La exclusividad JEFE no está implementada. Se propone clasificar esta salida documental como institucional y protegerla con autorización JEFE en FastAPI |
| Seguimiento de observaciones | `GET /api/seguimiento/observadas`, en seguimiento.py. Ya exige JEFE. Filtra solo incidencias Cerrado cuya última evaluación es Observación | Con V4 deja fuera las ya reabiertas a En revisión. Debe definirse el alcance del seguimiento por estado/ciclo y exponerlo en la interfaz cuando corresponda |
| Resumen del dashboard | `GET /api/incidencias/resumen`, datos operativos por rol/área | Conservar el acceso actual para los cuatro roles. Restringirlo a JEFE rompería sus indicadores; un reporte institucional posterior debe tener autorización propia |
| Documentos PDF/Excel, emisión, firma o archivo de reportes | No hay generador/exportador conectado en el frontend real ni rutas de descarga en el backend inspeccionado | No presentarlos como funciones terminadas. Acordar formato/catálogo si entran en una ampliación posterior |

**Cambio mínimo propuesto:** exigir JEFE en la ruta de borrador y en cualquier futura generación, consulta o descarga institucional; el perfil habilitado y el rol se obtienen del backend. Incorporar el acceso en la interfaz JEFE una vez protegido el endpoint. Conservar el registro técnico, consulta autorizada de detalle/intervenciones, Mis atenciones, soluciones y cierre de ASISTENTE/PRACTICANTE. No cambiar sus roles ni limitar los listados técnicos al área de su perfil como si fueran REPRESENTANTE.

Pruebas futuras de aceptación: JEFE obtiene información real; sin sesión 401; REPRESENTANTE/ASISTENTE/PRACTICANTE 403 aunque hayan participado; perfil deshabilitado rechazado; las intervenciones propias siguen funcionando. No basta ocultar el menú. El acceso técnico al borrador actual es un permiso existente que debe cambiarse explícitamente para cumplir el objetivo nuevo.

## 2. Prioridad: regla propuesta y control de autorización

Existe `incidencias.prioridad` como texto nullable. El registro la fija a null; no hay operación de actualización ni selector conectado. El impacto admite `Si`, `Parcialmente`, `No` o null. El formulario informa correctamente que el impacto no determina automáticamente la prioridad. La documentación MVP reserva las prioridades al JEFE y prohíbe cambiarlas a ASISTENTE/PRACTICANTE.

Propuesta **aún no aprobada ni implementada**, sin asignar plazos/SLA municipales inexistentes:

| ¿Impide continuar las actividades? | Sugerencia del servidor |
| --- | --- |
| Sí (`Si`) | Alta |
| Parcialmente | Media |
| No | Baja |
| No especificado/null | Pendiente de evaluación; conservar prioridad null |

Es una sugerencia para revisión humana. La criticidad, alcance o diagnóstico pueden justificar otra selección con motivo obligatorio. No calcular una prioridad Baja por ausencia de información, ni transformar automáticamente el impacto declarado por el REPRESENTANTE en una decisión oficial.

| Actor | Política propuesta |
| --- | --- |
| JEFE habilitado | Establece, ratifica o cambia prioridad dentro de las condiciones operativas aprobadas, dejando motivo y trazabilidad |
| ASISTENTE habilitado y responsable activo por AUTOTOMA | Excepción a aprobar: establecer solamente la prioridad inicial cuando todavía sea null, con justificación y pendiente de revisión del JEFE. No modificar una prioridad ya establecida, ni operar sobre tickets/ciclos ajenos |
| PRACTICANTE | Conserva atención y solución de sus incidencias autorizadas. Sin permiso nuevo de prioridad en esta propuesta; cualquier delegación adicional requiere una decisión explícita |
| REPRESENTANTE | Informa impacto; no establece ni cambia prioridad |

La excepción ASISTENTE modifica la regla MVP y necesita aprobación expresa antes de desarrollarla. Su autorización dependería de rol habilitado, responsabilidad activa, origen AUTOTOMA y ciclo vigente verificados por FastAPI, no de una casilla «jefe ausente» enviada por el cliente. La documentación vigente no exige registrar presencia/ausencia; no se propone un módulo nuevo de asistencia ni deducir la ausencia porque el JEFE no haya iniciado sesión.

Implementación mínima propuesta: contrato tipado Alta/Media/Baja y motivo; operación protegida con bloqueo de la incidencia y revalidación de asignación/ciclo. Guardar el cambio y un evento de historial en la misma transacción. El actor proviene de la sesión; registrar usuario, rol al actuar, fecha, valor anterior/nuevo, impacto considerado, motivo, origen y ciclo. Los campos actuales de prioridad e historial permiten una primera implementación sin agregar columnas; revisar permisos efectivos de UPDATE/INSERT antes de habilitarla. Cualquier restricción SQL o ampliación estructurada posterior debe revisarse aparte, sin ejecutar migraciones aquí.

## 3. Atención sin JEFE y autotoma V3/V4

La autotoma actual `POST /api/asignaciones/{id}/tomar` admite JEFE/ASISTENTE/PRACTICANTE habilitados, rechaza REPRESENTANTE, incidencias cerradas y responsables activos existentes. Usa identidad del servidor, `FOR UPDATE`, origen AUTOTOMA, asignación a uno mismo e historial. La documentación MVP autoriza expresamente a asistentes/practicantes a tomar tickets libres y no exige registrar ausencia del JEFE. No equivale a autorizar a cualquier cuenta autenticada.

Faltantes:

- No hay botón ni capacidad de toma integrada en RealApp. El contexto de asignación y la lista de técnicos son exclusivos de JEFE; no deben abrirse indiscriminadamente para construir ese botón.
- La guardia bloquea la ruta V3 cuando el ciclo es mayor que 1. La operación V4 existente de asignar exige JEFE y usa origen JEFATURA; no hay autotoma V4 equivalente. El recorrido sin JEFE queda incompleto en una incidencia reabierta.
- La estructura actual no contiene un permiso adicional de suplencia. Si el operador quiere una lista de técnicos más estrecha que los roles TI autorizados del MVP, debe aprobarse un mecanismo persistente de autorización; no inventarlo a partir de un UUID, área de pruebas, bandera del navegador o cambio de entorno.

Propuesta: preservar la política documentada de autotoma por roles TI habilitados, con contexto de lectura específico que indique si el usuario puede tomar. Revalidar siempre en la escritura; controlar estado, ciclo, ausencia de responsable y concurrencia. Implementar la operación compatible con V4 después de aprobar su contrato, exigiendo observación del ciclo anterior, nueva asignación del ciclo actual y actor auténtico. Mantener la guardia V3; no reutilizar asignaciones/soluciones antiguas. No se presenta una URL de autotoma V4 como si ya existiera.

El JEFE puede atender si es responsable activo. La toma V3 contempla su rol, pero el selector de asignación por jefatura ofrece solo ASISTENTE/PRACTICANTE. El recorrido propio del JEFE también debe quedar cubierto al integrar el botón de toma.

## 4. Observaciones, reapertura y conservación del cierre

**V3:** el REPRESENTANTE del área evalúa una incidencia Cerrado, una vez por incidencia. La observación se guarda en verificaciones y genera OBSERVACION en historial. Conserva estado, fecha y usuario de cierre. La prueba nueva confirmó además que no se elimina el evento CIERRE anterior y se rechaza una segunda evaluación.

**V4:** la ruta de verificaciones exige esquema disponible, REPRESENTANTE del área y cierre sin evaluación del ciclo. Registra evaluación e historial; Observación cambia a En revisión, incrementa el ciclo, limpia fecha_cierre/cerrado_por_usuario_id vigentes y genera REAPERTURA; Conformidad conserva el cierre. Todo se confirma en una transacción y se revierte ante error. La guardia impide usar verificación V3 como alternativa cuando V4 está activo.

El código no elimina las asignaciones finalizadas, intervenciones, verificaciones o eventos CIERRE previos. El cierre normal deja responsable y fecha en la asignación finalizada, e historia con actor, resumen/solución y fecha del evento. Sin embargo, la reapertura **no toma una instantánea explícita del cierre anterior antes de limpiar sus campos**. No puede garantizarse conservación completa de sus valores para un ticket legado/inconsistente que no tenga historial de cierre o asignación finalizada. La migración 03 añade ciclos e índices; no archiva por sí sola esos valores ni reconstruye historia faltante.

Cambio propuesto antes de ampliar el uso de reapertura: preservar de forma explícita y atómica el ciclo cerrado, fecha, cerrador y referencia a solución/cierre antes de limpiar el estado vigente; verificar la evidencia previa y bloquear si no se puede conservar coherentemente. Usar un evento/estructura auditable aprobada y datos reales existentes; no fabricar eventos CIERRE con autores o fechas supuestos. Probar rollback y que el cierre posterior no sobrescriba el anterior. El contrato actual de historial tampoco expone ciclo_atencion como campo, por lo que conviene ampliarlo de manera compatible para distinguir ciclos en la interfaz.

No existe reapertura manual independiente en FastAPI. El diseño V4 actual es automático al registrar Observación. Si se requiere aprobación manual del JEFE, debe aprobarse un cambio explícito de flujo: observación pendiente, revisión y operación protegida de reapertura; no añadir un botón que llame SQL, reutilice asignar/tomar sobre Cerrado o afirme una operación inexistente. Hasta esa decisión se conserva el comportamiento actual.

## Orden de implementación propuesto

| Prioridad | Paquete local después de aprobación | Criterio para considerarlo terminado |
| --- | --- | --- |
| P0 | Reporte institucional protegido en FastAPI; preservar funciones técnicas | Matriz de autorización y pruebas negativas del endpoint, independientes de la visibilidad del menú |
| P0 | Conservación explícita del cierre y decisión automática/manual antes de ampliar reapertura | Historial/fechas/actores/solución preservados por ciclo, transacción y rollback validados en PostgreSQL aislado |
| P1 | Sugerencia de prioridad y operación auditada; excepción ASISTENTE solo si se aprueba | Datos persistentes, enum/motivo, control de rol/asignación/ciclo, rechazo de cambios ajenos y revisión por JEFE |
| P1 | Autotoma segura V3/V4 e integración por capacidades reales del servidor | Un responsable activo, rechazo de colisiones, estados y ciclos indebidos; JEFE/ASISTENTE/PRACTICANTE según política aprobada; REPRESENTANTE excluido |
| P2 | Integración de reportes/seguimiento y presentación de historial por ciclo | Datos reales, estados vacíos/error, teclado/responsive; observaciones reabiertas identificables sin confundirlas con cerradas pendientes |
| Cierre | Circuito de registro, prioridad, toma/asignación, intervención, solución, cierre, verificación/observación y nuevo ciclo | PostgreSQL/API aislados, perfiles ficticios autorizados, historial y totales persistentes; después, revisión independiente antes de publicación |

El primer paquete mínimo recomendado es autorización de reportes y prioridad auditada; no requiere activar V4 ni nuevas variables. Las operaciones de reapertura/autotoma de ciclos posteriores quedan condicionadas al paquete de conservación y a su validación PostgreSQL. No activar banderas existentes que estén en false como parte del desarrollo o las pruebas municipales.

## Pruebas nuevas ejecutadas y límites

Archivo: `backend/tests/test_diagnostico_112c.py`. **8/8 aprobadas**, ejecutadas únicamente contra SQLite en memoria, con UUID/perfiles/casos ficticios y dependencias de identidad sustituidas. El proceso de pruebas no carga .env ni usa credenciales municipales. No modifica la configuración de entorno del proyecto/Vercel.

1. Borrador accesible actualmente a JEFE y técnicos con asignaciones históricas: acredita la diferencia de autorización.
2. Borrador denegado a técnico ajeno, REPRESENTANTE, deshabilitado y sesión ausente.
3. Autotoma TI sin declarar ausencia, con responsable auténtico, origen e historial; prioridad queda null.
4. Autotoma denegada a REPRESENTANTE, Cerrado o ticket con responsable existente.
5. Guardia impide autotoma V3 sobre ciclo reabierto sin crear asignación.
6. Los cuatro valores de impacto siguen sin prioridad tras la autotoma actual.
7. Observación V3 persistida con historial y cierre anterior intacto; duplicado rechazado.
8. Seguimiento JEFE muestra cerradas observadas y omite las ya reabiertas; ASISTENTE recibe 403.

El primer intento encontró una incompatibilidad de la fixture con SQL textual PostgreSQL FOR UPDATE. Se adaptó exclusivamente esa lectura de ciclo a SQLite dentro de la prueba y el conjunto nuevo terminó 8/8. No se cambió la guardia de producción. SQLite no prueba los bloqueos, índices, triggers, RLS o transacciones PostgreSQL reales. Se conserva un aviso no bloqueante Starlette/httpx de las dependencias de pruebas.

Estas pruebas caracterizan el comportamiento actual; no certifican exclusividad JEFE ni prioridad/autotoma V4 futuras. Al implementar una política autorizada, las expectativas de caracterización correspondientes deben convertirse en regresiones de la nueva regla, sin retirar las comprobaciones técnicas/negativas pertinentes. No se repitieron 112B, frontend build ni sus suites porque no se cambió código de aplicación.

Quedan por ejecutar, después de aprobar la implementación, pruebas PostgreSQL aisladas de concurrencia, permisos efectivos, preservación del cierre anterior con y sin historia completa, múltiples ciclos, unicidad de evaluaciones, doble envío/rollback, asignación activa del ciclo y cierre con solución propia del ciclo. Las pruebas de servicios o datos municipales requieren autorización independiente; Preview no acredita aislamiento de PostgreSQL/Auth.

## Decisiones necesarias antes de implementar

Confirmar la excepción de prioridad inicial para ASISTENTE responsable por AUTOTOMA (PRACTICANTE permanece sin ese permiso), y elegir si la reapertura conserva la modalidad automática V4 o requiere un flujo nuevo de aprobación manual JEFE. El objetivo de reportes institucionales exclusivos del JEFE ya está definido; se propone aplicarlo al borrador documental y conservar el trabajo técnico separado.

Solo se añadieron este diagnóstico y las ocho pruebas nuevas; el frontend/backend funcional, SQL operativo y pruebas anteriores permanecen intactos. Los nueve pendientes de 112A siguen fuera de esta fase. No hay commit, push ni publicación de 112C.
