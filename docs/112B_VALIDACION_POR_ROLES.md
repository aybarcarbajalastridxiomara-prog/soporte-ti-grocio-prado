# Fase 112B: validación publicada por roles y pendientes de cierre

Actualización: 16 de noviembre de 2026, America/Lima. Rama `ajustes-docente-v4`. Código publicado de referencia: `477379ab552185b547dfcc9e58a1acaaf7a7078e`.

Alias Preview autorizado: https://soporte-ti-git-540570-aybarcarbajalastridxiomara-3293s-projects.vercel.app/ . Referencia visual usada en las revisiones anteriores: Figma Make, versión 10 del archivo `qvgHjHgNUTv9i2GYdwh6nK`.

Este informe reúne las revisiones anteriores de JEFE y REPRESENTANTE, la confirmación inicial del operador sobre ASISTENTE y la posterior revisión directa del agente: cuatro vistas, filtros, teclado y 20 mediciones responsive. La titular inició sesión personalmente; el agente solo navegó y leyó. También se consultó public.usuarios mediante Table Editor para comprobar la existencia de PRACTICANTE, sin SQL ni ediciones. Las evidencias con datos de cuentas y capturas se mantienen fuera del repositorio; aquí se documentan roles, alcance y resultados sin correos, UUID de Auth o credenciales. El detalle actual está en [cierre visual ASISTENTE](112B_CIERRE_VISUAL_ASISTENTE.md).

## Criterios para interpretar la evidencia

- **Visual/navegación publicada:** presencia y distribución de pantallas, tarjetas, formularios, menú, vacíos y controles observados con sesión real. Un control visible no acredita su operación ni persistencia.
- **Interacción de lectura publicada:** búsqueda, selección de filtros o navegación efectivamente probadas y consignadas en los informes previos. Un listado vacío no acredita aislamiento frente a filas reales de otra área o técnico.
- **Prueba automatizada aislada:** código/backend con SQLite, PostgreSQL en memoria o transporte HTTP simulado. No equivale a un circuito sobre FastAPI y PostgreSQL municipales publicados.
- **Confirmación del operador:** el dato fue comunicado por quien realizó la revisión. No se presenta como una inspección independiente del agente ni como captura de solicitudes de red.
- **Pendiente remoto:** no se ejecutó o no hay evidencia suficiente para declararlo comprobado en el sistema publicado.

## Resumen por perfil

| Perfil y fuente | Visual y navegación confirmadas | Lecturas efectivamente probadas | Pendiente funcional o de diseño |
| --- | --- | --- | --- |
| JEFE; revisión autenticada anterior del agente y confirmación del operador | Seis pantallas: Panel principal, Incidencias, Asignaciones, Atención técnica, Usuarios y áreas, Mi cuenta. Cuatro ceros, vacíos reales, formulario de asignación, directorio real y dos tarjetas de cuenta. Nuevo usuario/Editar deshabilitados según capacidades | Búsqueda, filtro de estado, limpieza, navegación a listados, consulta propia vacía y búsqueda del directorio. 30 mediciones responsive: seis vistas por 1440/1024/768/390/320 px, sin desbordamientos en los estados observados | Tabla y detalle con registros reales; asignación e historial de un ticket; atención, solución y cierre por JEFE responsable; operación administrativa; cambio de contraseña y renovación efectiva de sesión |
| REPRESENTANTE de Tesorería; revisión autenticada anterior del agente | Menú Panel principal, Mis incidencias, Registrar incidencia y Mi cuenta. Cuatro ceros, formulario A–D, solicitante/área de solo lectura, adjuntos deshabilitados con explicación y tarjetas Mis datos/Seguridad | Búsqueda, filtro Cerrado y limpieza. Consulta de antecedentes sin registros; el envío queda bloqueado sin referencia válida. No se envió el formulario. 16 mediciones responsive: cuatro vistas por 1440/1024/768/390 px, sin desbordamientos en los estados observados | Registro y persistencia, tabla y detalle poblados, antecedente cerrado real, verificación del resultado, historial, aislamiento con datos reales de otras áreas, cambio de contraseña y renovación al vencimiento |
| ASISTENTE de Sistemas - Pruebas; acceso confirmado por el operador y revisión directa posterior del agente | Cuatro vistas y menú restringido confirmados. Panel con cuatro ceros; Incidencias y Mis atenciones vacíos; Mi cuenta con perfil esperado, ASISTENTE, Sistemas - Pruebas, Habilitado y tarjetas Mis datos/Seguridad | Búsqueda, Pendiente/En revisión/Cerrado y limpieza en los tres listados; Tab/Enter, foco azul, menú móvil y Escape con devolución de foco. 20 mediciones: cuatro vistas por 1440/1024/768/390/320 px, sin desbordamientos, campos fuera del ancho o controles visibles sin nombre accesible. Cero errores de consola capturados | Tabla y detalle con registros reales; Mis atenciones con asignación propia y exclusión de otro técnico/ciclo; intervención, solución final, cierre e historial; cambio de contraseña, renovación al vencimiento y auditoría completa de accesibilidad |

El acceso ASISTENTE deja de figurar como bloqueado por login. Esto no acredita el mecanismo usado para recuperar el acceso ni el funcionamiento del cambio de contraseña de Mi cuenta. La confirmación de login no se registra como prueba de actualización mediante Auth Admin API.

En los tres perfiles los ceros y vacíos observados se conservan. No se insertan registros para decorar el panel. La exactitud de los cambios de totales durante un flujo poblado sigue pendiente de la prueba integral real.

## Permisos y aislamiento: alcance comprobado

- El menú publicado respeta los roles observados. Su visibilidad no sustituye la autorización del backend.
- El código y las pruebas aisladas restringen REPRESENTANTE a su área; impiden usar `mis_atenciones=true` como REPRESENTANTE; filtran Mis atenciones por la identidad autenticada y las asignaciones activas del ciclo antes del límite.
- ASISTENTE puede consultar el listado general autorizado de TI entre áreas. El ámbito de Mis atenciones es distinto: solo sus asignaciones activas. No se exige limitar todo el listado técnico a su área como si fuera REPRESENTANTE.
- Las negativas de autenticación, jefatura, identidad ajena y perfiles deshabilitados tienen evidencia automatizada aislada. No se efectuó una nueva prueba negativa remota con cuentas/filas reales ni una auditoría RLS remota en esta actualización.
- No se activaron banderas de registro de operaciones, asignación, atención/cierre, verificación o administración. Se conserva la condición de permisos y configuración de cada acción.
- PRACTICANTE: se consultó public.usuarios sin filtro, una página y tres registros. Los roles presentes son JEFE, REPRESENTANTE y ASISTENTE, todos habilitados; no hay perfil PRACTICANTE autorizado. Su validación publicada queda bloqueada por ausencia de perfil, sin crear identidades ni modificar roles. La cobertura local aislada no sustituye una sesión propia.

## Atención por JEFE: pendiente concreto

El código permite intervención y cierre a JEFE cuando la asignación activa reconoce a ese usuario como responsable; no basta con tener el rol JEFE. El selector de asignación de la interfaz solo admite ASISTENTE/PRACTICANTE habilitados y no ofrece al JEFE como destinatario.

Existe una ruta de toma en el backend (`POST /api/asignaciones/{id}/tomar`) que contempla JEFE, ASISTENTE y PRACTICANTE, pero el frontend conciliado no expone ese botón. Esto no acredita un recorrido completo para que JEFE tome y atienda desde la interfaz publicada. Antes de proponer una solución mínima deben revisarse autorización, ausencia de asignación activa, estado, ciclo V3/V4, permisos efectivos y pruebas. No se invoca la ruta manualmente ni se habilita una acción nueva en este informe.

## Diferencias pendientes respecto a Figma

La lista recoge la comparación previa y la inspección actual de las cuatro vistas ASISTENTE de Make versión 10. Se contrastaron capturas y estilos efectivos; no se afirma igualdad de píxel entre un marco Figma embebido y el viewport completo del sistema.

| Diferencia | Estado / criterio de cierre |
| --- | --- |
| En el código publicado no aparecen cabeceras si el listado está vacío | Corregido y probado localmente: siete columnas y acciones presentes con resultado vacío; scroll interno móvil y teclado preservados. Publicación pendiente |
| Mis atenciones utiliza un mensaje vacío genérico en el Preview actual | Corregido localmente: No tienes incidencias asignadas para consulta propia vacía exitosa; errores y filtros sin coincidencias se distinguen. Publicación pendiente |
| Las tarjetas Mis datos y Seguridad tienen distintas alturas en el Preview | Corregido localmente con CSS: misma altura en escritorio, apiladas con altura natural en móvil. Sin cambios de Auth. Publicación pendiente |
| Bordes y tamaño de buscador/select difieren de Make | El sistema conserva borde #AEBFD0, radio 8 px, altura 44 px, separación 12 px y foco azul aprobados en 111B. Mantener esta mejora de legibilidad y teclado, sin volver al borde tenue del prototipo |
| Monograma, algunos iconos/etiquetas y cabecera institucional difieren | Diferencias menores documentadas; revisar o aceptar explícitamente su alcance visual |
| Botones Actualizar, avisos de configuración y límites visibles | Diferencias deliberadas del sistema real: preservar errores, alcance de búsqueda y límites de registros en lugar de imitar datos demostrativos |
| Usuario en el directorio en lugar de correo de otras cuentas | El contrato real no ofrece esos correos. Mantener el identificador real sin consultar Auth administrativo desde el navegador |
| Adjuntos visibles, carga deshabilitada | Almacenamiento privado, permisos por incidencia, validación/límites y descarga segura pendientes; no simular evidencia guardada |
| Antecedentes exigen una incidencia cerrada real del ámbito autorizado | Restricción de backend conservada; no usar referencias ficticias ni omitir la validación para reproducir el prototipo |
| Opciones de toma/reasignación y JEFE como destinatario | No se copiaron acciones demostrativas. Revisar el recorrido real y autorizar su implementación si se incluye en el cierre |
| Nuevo usuario/Editar e invitaciones deshabilitados según capacidades | Administración completa, credencial privada del backend, permisos/trigger/validación y correo operativo pendientes. Haber usado una herramienta administrativa privada no prueba que el backend esté configurado para invitaciones |
| Barra flotante de Vercel Preview | Puede superponerse en móvil; es externa a la interfaz municipal. No se cambió su configuración |

Brevo, adjuntos y administración completa se mantienen como pendientes de alcance explícito. No se habilitan para completar una comparación visual. Su eventual aceptación como fases posteriores debe quedar registrada y no equivale a declarar esas funciones operativas.

## Pruebas disponibles y sus límites

Resultados históricos del código publicado de referencia, documentados antes o durante la publicación; no se repitieron en esta actualización documental:

| Evidencia | Resultado registrado | Límite |
| --- | --- | --- |
| Frontend `npm test` y compilación estándar | 12/12 y build aprobados | No sustituyen una operación real de Auth o persistencia publicada |
| Backend de 111A/112B incluido en el commit | 14/14 aprobadas | Datos aislados y dependencias sustituidas |
| Preentrega y capacidades PostgreSQL | 28/28 y 5/5 aprobadas | Validaciones locales; PostgreSQL en memoria para capacidades |
| Workflows reproducidos localmente | 21 bloques aprobados; siete requerían Docker y no se ejecutaron localmente | No se presentan esos siete bloques locales como aprobados |
| GitHub Actions del SHA publicado | El informe de publicación registró seis ejecuciones satisfactorias | Resultado histórico de ese SHA; no se consultó nuevamente GitHub ni se dispararon Actions ahora |
| Navegador local con transporte simulado | Cuatro roles y recorrido UI registro/asignación/intervención/cierre/conformidad | No fue el circuito municipal publicado sobre Supabase PostgreSQL |
| Revisión publicada por roles | JEFE y REPRESENTANTE con interacción y mediciones previas; ASISTENTE revisado directamente con filtros/teclado y 20 mediciones propias | Solo lecturas y estados vacíos; no demuestra aislamiento con filas reales ni escritura |

La construcción y pruebas aisladas de la utilidad privada de recuperación pertenecen a otro procedimiento; no se cuentan como pruebas funcionales del sistema municipal.

Tras la autorización de las tres correcciones finales se repitieron pruebas en local: **15/15 frontend, build estándar aprobado, 14/14 backend y 28/28 preentrega**. Se comprobaron 20 combinaciones de vista/ancho, filtros, foco, scroll de tabla, error 503 sin falso vacío y detalle de un registro aislado. Estas nuevas pruebas no modifican la evidencia del Preview ni acreditan el ciclo municipal real. Archivos, resultados y límites en [correcciones finales locales](112B_CIERRE_VISUAL_ASISTENTE.md#correcciones-locales-autorizadas-y-pruebas-de-esta-entrega).

## Pasos para cerrar la Fase 112B

1. Revisión de lectura ASISTENTE completada: filtros, teclado y 20 mediciones propias documentadas. Mantener pendientes las pruebas pobladas y los límites de accesibilidad descritos en el informe específico.
2. Registrar el bloqueo PRACTICANTE: no existe un perfil autorizado en el proyecto consultado. El operador debe decidir por separado cómo incorporar ese rol o aceptar su aplazamiento; no crear o vincular cuentas automáticamente.
3. Revisar las tres correcciones visuales implementadas y probadas localmente; quedan pendientes de autorización independiente para commit/push/Preview. Revisar o aceptar las diferencias menores restantes, sin ampliar este paquete.
4. Antes de cualquier prueba de escritura, acreditar un entorno/backend/base aislados o conseguir autorización específica para una incidencia real y las operaciones sobre ella. El nombre Preview no acredita aislamiento de Auth o PostgreSQL. Revisar las capacidades, rutas del ciclo y banderas sin activarlas automáticamente ni ejecutar migraciones.
5. Con esa autorización, ejecutar y registrar el circuito real: REPRESENTANTE registra; JEFE consulta y asigna; ASISTENTE responsable registra intervención y solución; el responsable cierra; REPRESENTANTE verifica cuando corresponda. Comprobar detalle, historial, responsables, persistencia, transiciones de estado y cambios de totales. Usar un caso real autorizado y no datos de Figma o inserciones SQL.
6. Validar separadamente la capacidad de JEFE para atender una incidencia propia, con el recorrido de interfaz y reglas de ciclo aprobados. No darla por probada a partir de Mis atenciones vacío o de fixtures locales.
7. Mantener el cambio de contraseña de Mi cuenta y la renovación efectiva al vencimiento como no probados remotamente. Solo si forman parte del cierre funcional, planificar una prueba separada con el titular y autorización expresa; el login actual de ASISTENTE no las sustituye.
8. Registrar la decisión de alcance para Brevo/SMTP, adjuntos y administración completa: continúan pendientes hasta desarrollo, configuración y pruebas autorizados. Una fase posterior aceptada no debe ocultarse como función terminada.
9. Revisar observaciones sobre incidencias cerradas y la reapertura manual autorizada. Confirmar el comportamiento V3/V4 antes de enviar observaciones, pues V4 puede abrir un nuevo ciclo automáticamente. Definir permisos, motivo, historial, ciclo y nueva asignación para la operación manual; probarla solo en entorno aislado o con autorización específica. Esta entrega no implementa ni ejecuta transiciones de estado.

Estado de cierre: las revisiones publicadas de los tres perfiles indicados avanzaron satisfactoriamente, con la evidencia y límites anteriores. No se declara cerrada la validación funcional integral ni probado el ciclo municipal completo. Esta actualización no autoriza escrituras o publicación.

## Cambios de esta actualización

La consolidación original fue documental. La entrega posterior autorizada corrige RealTicketList, RealWork e index.css, añade ticket-list.test.mjs y actualiza estos tres informes; el [cierre visual ASISTENTE](112B_CIERRE_VISUAL_ASISTENTE.md) detalla los resultados actuales. No cambian backend, SQL, cuentas, contraseñas, datos, RLS, variables, banderas ni despliegues. Sin commit, push ni merge a main; los nueve archivos pendientes de 112A permanecen separados.
