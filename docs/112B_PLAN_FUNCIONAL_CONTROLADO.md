# Fase 112B: publicación Preview y plan funcional controlado

16 de noviembre de 2026. Repositorio soporte-ti-grocio-prado; rama exclusiva `ajustes-docente-v4`. Preparación sobre `477379ab552185b547dfcc9e58a1acaaf7a7078e`.

## Alcance de la publicación autorizada

Tres correcciones ya aprobadas: cabeceras en tablas vacías, mensaje propio de Mis atenciones separado de errores/filtros y altura de las tarjetas de cuenta en escritorio. Se incluyen sus pruebas e informes de 112B. Los nueve archivos locales pendientes de 112A quedan fuera del commit; no se publican SQL, datos de perfiles, herramientas privadas, respaldos o capturas con información de cuentas.

Antes del commit se comprobó en Vercel que los proyectos `soporte-ti-grocio-prado` y `soporte-ti-grocio-prado-api` tienen Production asociado a `main` y Preview a todas las ramas Git no asignadas. No existen entornos personalizados asignados a esta rama. La producción del frontend figura en el SHA `c074ce3d840f90eb4487d27c516fa2a9c9bba468`; el remoto main conserva ese mismo SHA. Se publica mediante push exclusivamente a ajustes-docente-v4, sin promoción de despliegues, cambios de dominios, variables o entorno.

La URL y el SHA nuevos se registrarán en la entrega después de comprobar el despliegue Ready/Preview y sus recursos públicos. El alias para revisión autenticada sigue siendo el Preview autorizado; no se amplía CORS para admitir URLs efímeras.

## Inspección de observaciones y reapertura: resultado real

Se revisaron los routers registrados en `backend/app/main.py`, el inventario OpenAPI construido localmente sin base remota, `verificaciones.py`, `v4_verificaciones.py`, `contexto_verificacion.py`, `seguimiento.py`, las reglas/guardia V4 y RealVerification.

| Operación existente | Contrato y controles actuales | Estado de validación |
| --- | --- | --- |
| `GET /api/incidencias/{id}/contexto-verificacion` | Informa esquema/ciclo, evaluación actual, puede_verificar y ruta válida; exige perfil y ámbito autorizado | Implementada; su respuesta determina V3/V4 antes de cualquier envío |
| `POST /api/incidencias/{id}/verificaciones` | REPRESENTANTE, misma área, incidencia Cerrado, una evaluación por incidencia en V3; resultado Conformidad u Observación. Registra evaluación e historial y conserva Cerrado | Implementada; no ejecutada contra datos municipales en esta entrega |
| `POST /api/v4/incidencias/{id}/verificaciones` | REPRESENTANTE, misma área, esquema V4 disponible, cierre vigente y una evaluación por ciclo. Conformidad conserva el cierre. Observación reabre automáticamente a En revisión, incrementa ciclo y exige nueva asignación; registra historial | Implementada en código, condicionada al esquema real. No se presume activa por existir la ruta ni se ejecutó |
| `GET /api/seguimiento/observadas` | Consulta de observaciones para JEFE, con autorización en backend | Implementada; no se presume integrada en una pantalla propia ni probada con observaciones reales |
| Reapertura manual independiente | No hay endpoint de reapertura manual ni actualización genérica de estado en el inventario de escrituras de FastAPI. Tomar/asignar/reasignar rechazan incidencias cerradas; no son sustitutos de reapertura | **No implementada en FastAPI vigente**. No inventar `/reabrir`, usar SQL o modificar estados para simularla |

RealVerification reconsulta el contexto antes de enviar, valida ruta/estado/ciclo y distingue el efecto V3/V4. La guardia impide usar verificación V3 cuando la base ya es V4. Se mantienen banderas y permisos sin alteración. La presencia del código V4 no acredita que PostgreSQL tenga sus columnas, índices, permisos y triggers validados.

## Revisión de alcance pendiente, 17 de noviembre de 2026

El intento anterior de commit no se ejecutó por un fallo de la revisión automática de aprobación al alcanzar el límite de uso. HEAD local y remoto de ajustes-docente-v4 conservan `477379ab552185b547dfcc9e58a1acaaf7a7078e`; main conserva `c074ce3d840f90eb4487d27c516fa2a9c9bba468`. No se publicó un Preview de las correcciones finales. Las pruebas aprobadas no se repitieron. La siguiente tabla amplía únicamente el plan; no cambia contratos, permisos, estados o interfaz.

| Requisito por revisar | Código vigente comprobado | Pendiente y criterio funcional |
| --- | --- | --- |
| Reportes exclusivos del JEFE | Existe `GET /api/incidencias/{id}/informe-tecnico/borrador`, sin pantalla conectada en RealApp. JEFE puede consultar cualquier ticket; ASISTENTE/PRACTICANTE también pueden consultar si tuvieron asignación en ese ticket. REPRESENTANTE recibe 403; sin intervenciones devuelve 409 | **La exclusividad JEFE no está implementada.** Distinguir un borrador técnico de reportes de gestión/exportación y aprobar su alcance. No cerrar el permiso técnico existente como parte de una corrección visual. Una futura implementación debe comprobar acceso JEFE y rechazo de los demás roles, ámbito, filtros, datos e historial reales, sin exportaciones simuladas |
| Asignación de prioridad | El modelo/lecturas contienen prioridad. El registro del REPRESENTANTE la fija a null y rechaza campos adicionales; la tabla muestra Sin definir. No hay endpoint de actualización de prioridad ni control conectado en el frontend real | **La asignación de prioridad no está implementada.** Definir rol autorizado, catálogo, reglas y trazabilidad antes de desarrollar. Propuesta a revisar: asignación por JEFE mediante una operación protegida. Comprobar persistencia, rechazo a roles ajenos y que el impacto no se convierta en prioridad automática |
| Atención ante ausencia del JEFE | `POST /api/asignaciones/{id}/tomar` permite AUTOTOMA a JEFE/ASISTENTE/PRACTICANTE de un ticket no cerrado y sin responsable activo; bloquea la fila y registra historial. No verifica ausencia del JEFE ni está conectado a un botón en RealApp. La guardia V4 impide usar esa ruta antigua en ciclos posteriores al primero | **El recorrido completo no está disponible en la interfaz.** Aprobar protocolo de atención sin jefatura, disponibilidad del ticket y compatibilidad V3/V4 antes de habilitarlo. Probar responsable único, concurrencia, rechazo si cerrado/asignado y persistencia de AUTOTOMA. No sustituir la ausencia por una bandera inventada ni permitir saltarse ciclos |
| Observaciones sobre cierres | V3 conserva Cerrado; V4 reabre automáticamente tras Observación válida, con nuevo ciclo e historial | Confirmar esquema/contexto real y ejecutar la prueba solo en el entorno aislado autorizado. No conformar y observar el mismo cierre |
| Reapertura manual autorizada | No existe una operación independiente en FastAPI vigente | Mantenerla como función pendiente de diseño/autorización; no presentar la reapertura automática V4 como manual ni cambiar estados mediante SQL |

Estos faltantes funcionales se mantienen separados del paquete visual ya aprobado. Su desarrollo requeriría una autorización y pruebas específicas; no se añaden silenciosamente al commit de las tres correcciones.

## Revisión visual publicada preparada, solo lectura

Cada titular inicia sesión directamente, sin entregar contraseñas/códigos. No se envían formularios de registro, asignación, atención, verificación, administración o contraseña. La revisión no certifica esos flujos de escritura.

| Perfil | Pantallas y verificaciones de lectura |
| --- | --- |
| JEFE | Seis vistas; cabeceras en Panel/Incidencias/Atención técnica vacíos, indicadores reales, filtros y navegación. Revisar formulario/historial de Asignaciones sin enviar; directorio y controles condicionados; tarjetas de cuenta iguales en escritorio |
| REPRESENTANTE de Tesorería | Panel, Mis incidencias, Registrar incidencia y Mi cuenta. Perfil/área correctos y ámbito del listado; cabeceras y filtros vacíos; formulario A–D solo inspección, campos no soportados deshabilitados; cuenta apilada en móvil |
| ASISTENTE de Sistemas - Pruebas | Panel, Incidencias, Mis atenciones y Mi cuenta; mensaje propio ante lista vacía exitosa; ausencia de acciones JEFE/REPRESENTANTE; siete cabeceras, foco/teclado y tarjetas. Un vacío no prueba exclusión de asignaciones ajenas |

Usar el alias Preview autorizado en escritorio y móvil, confirmar SHA/recursos nuevos y revisar 1440/1024/768/390/320 px. Las tablas mantienen desplazamiento interno; no deben desbordar la página. Registrar los errores como errores, nunca como ausencia de asignaciones. Para probar errores o permisos negativos usar fixtures locales, sin manipular el servicio municipal.

## Entorno necesario antes del ciclo de escritura

Esta autorización permite publicar y leer; **no permite ejecutar el circuito de escritura**. Un Preview puede seguir utilizando el backend, Auth o PostgreSQL municipales. Hasta acreditar aislamiento se tratan sus datos como producción.

Se necesita un FastAPI de pruebas con PostgreSQL de pruebas existentes y aislados, con esquema compatible y RLS/permisos revisados, y cuentas/perfiles autorizados de pruebas para los roles y áreas requeridos. Preferir también Auth aislado. No crear proyectos, identidades ni vincular perfiles automáticamente. Confirmar destinos del frontend/API y conexión de base mediante el operador, sin revelar credenciales ni cambiar variables en esta entrega.

El operador debe aprobar el entorno, los casos y responsables, las banderas necesarias y la estrategia de conservación de evidencia. Disponer de respaldo/snapshot del entorno de prueba según sus políticas, fuera del repositorio, y conservar los casos e historial de validación; no eliminar ni restaurar datos municipales. Si falta V4, revisar su preparación/migración por separado: no ejecutarla como requisito automático de esta publicación.

## Secuencia funcional propuesta, no ejecutada

| Paso | Acción autorizable en el entorno aislado | Evidencia y negativas necesarias |
| --- | --- | --- |
| 1. Registro | REPRESENTANTE registra desde su formulario real con datos válidos de un caso autorizado | POST existente, código/área/solicitante/estado procedentes de backend; recarga conserva datos; rechazo de campos controlados y acceso de otra área |
| 2. Asignación | JEFE selecciona incidencia y ASISTENTE/PRACTICANTE habilitado mediante el formulario real | Contexto/ruta V3 o V4 vigentes, responsable único, En revisión e historial; aparece en Mis atenciones del asignado y no de otro técnico; rechazo a rol no JEFE o técnico inhabilitado |
| 3. Atención | Responsable activo registra diagnóstico, acciones y duración permitida | Intervención persistida y ligada al usuario/ciclo; otro técnico no puede intervenir |
| 4. Solución y cierre | Responsable registra solución final válida y cierra mediante la ruta indicada por contexto | Rechazo sin solución final del ciclo, Cerrado y datos de cierre persistidos; historial conserva registro/asignación/atenciones/cierre |
| 5. Verificación | REPRESENTANTE del área consulta el cierre y registra Conformidad o una Observación justificada | Una evaluación por incidencia/ciclo según esquema; duplicados rechazados, aislamiento de área e historial persistente |
| 6. Observaciones | En un cierre todavía no evaluado, registrar Observación con su texto y confirmación | V3: conserva Cerrado e historial OBSERVACION. V4: una sola transacción genera evaluación, REAPERTURA, En revisión y ciclo nuevo sin reutilizar solución/responsable anteriores |
| 7. Reapertura manual | Comprobar primero el inventario real de rutas y la política del JEFE | Actualmente bloqueada: no existe endpoint independiente. Registrar esta limitación; una función manual requeriría diseño, autorización, desarrollo y pruebas en una fase separada, sin SQL manual como sustituto |
| 8. Persistencia e indicadores | Recargar/reiniciar sesión de las titulares y consultar detalle, historial, listados, Mis atenciones y resumen | Comparar transiciones/totales de `/api/incidencias/resumen` con los casos autorizados y su ámbito, sin depender del límite de 50 filas. En V4 reasignar y atender/cerrar el nuevo ciclo antes de su verificación |

No registrar Conformidad y después Observación sobre el mismo cierre: la unicidad lo impide. Para cubrir ambos resultados, aprobar dos casos diferentes o, si V4 está validado, observar el primer cierre y conformar el cierre del siguiente ciclo. No repetir evaluaciones para fabricar la demostración.

La atención por JEFE requiere una prueba separada: el backend V3 tiene `POST /api/asignaciones/{id}/tomar`, pero la interfaz no expone la toma y el selector de responsables solo ofrece ASISTENTE/PRACTICANTE. No dar por validado ese recorrido, invocar rutas a mano o habilitar controles nuevos dentro de esta corrección visual.

## Pendientes de cierre

El código/pruebas aisladas y las revisiones publicadas anteriores no sustituyen el circuito municipal real. Permanecen pendientes las lecturas autenticadas de los tres perfiles sobre el nuevo artefacto, los casos poblados y negativos, el circuito autorizado, la decisión sobre PRACTICANTE sin perfil existente y las diferencias cosméticas menores documentadas. Cambio de contraseña y renovación efectiva al vencimiento no se declaran probados con estas correcciones. Brevo/SMTP, adjuntos y administración completa siguen fuera de alcance.
