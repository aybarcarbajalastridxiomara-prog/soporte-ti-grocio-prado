# Fase 112B: implementación local y pruebas

16 de noviembre de 2026, America/Lima. Rama: `ajustes-docente-v4`.
Commit de base conservado: `e8da34856d724c81f463201f8e4aef631491d742`.

Implementación terminada y revisada localmente. El operador autorizó posteriormente la revisión final, el commit de esta fase y su publicación exclusivamente en Vercel Preview. Este informe describe las pruebas previas a esa publicación. No se ejecutó SQL remoto ni se modificaron cuentas/datos municipales, se repitió la vinculación de 112A, se cambiaron variables configuradas o se desactivó RLS. Las pruebas locales no consultaron ni modificaron los perfiles institucionales existentes.

## Comportamiento terminado

| Vista | Resultado |
|---|---|
| Panel principal | Cuatro indicadores completos de `/api/incidencias/resumen`, incluidos ceros; composición de Figma, búsqueda/filtro, actividad reciente y vacío honesto. Una consulta fallida conserva error/indicador no disponible, no inventa un cero |
| Incidencias | Tabla común: Código, Asunto, Área, Registro, Prioridad, Estado, Responsable y acción Ver. Fecha/hora de Lima, nombres devueltos por backend y prioridad nula como Sin definir. Búsqueda local en los registros cargados, con su alcance visible |
| REPRESENTANTE | Menú Panel principal, Mis incidencias, Registrar incidencia y Mi cuenta; resumen y registros limitados por área en el backend. Nombre/área del formulario derivados del perfil, no editables |
| Registro | Secciones A–D. Asunto, descripción, categoría, equipo, ubicación, impacto, fecha/hora de inicio y recurrencia conectados al POST existente. Antecedentes consultados con estado Cerrado, máximo 100 y mismo ámbito de área. Archivo deshabilitado con explicación |
| Asignaciones | Dos selectores, contexto real y lista de técnicos autorizados, submit condicionado a flag/rol/estado/ciclo. Reconsulta antes de enviar. Historial de asignaciones leído del historial existente, sin reconstruir eventos ficticios |
| Atención técnica | Mis atenciones desde `mis_atenciones=true` en la API. Solo asignaciones activas del usuario autenticado y ciclo vigente, antes del límite. JEFE también puede atender una incidencia de la que ya sea responsable. Se reutilizan intervención, solución final, cierre y verificación existentes |
| Usuarios y áreas | Disposición del directorio conciliada, áreas reales y botones Nuevo usuario/Editar condicionados a permisos verificados. Mantiene Usuario real en lugar de inventar Correo. No hay consultas administrativas de Auth en el navegador |
| Mi cuenta | Tarjetas Mis datos y Seguridad; perfil administrativo de solo lectura, correo propio obtenido de Auth, botón para actualizar perfil. Cambio de clave con sesión vigente, comprobación de identidad y reautenticación de contraseña actual en Supabase |
| Móvil y teclado | Formularios y tarjetas apilados; tabla con scroll dentro de su región; filtros de 111B conservados; foco visible y Escape para cerrar menú y devolver foco al botón. Menú cerrado fuera del orden de foco mediante visibilidad CSS |

Las siete columnas son datos más una columna de acción, como en el prototipo. Los listados conservan el límite visible de 50 y el dashboard muestra hasta cinco filas; los indicadores no se calculan a partir de esas filas.

## Contratos y seguridad

El listado `GET /api/incidencias` conserva sus campos, orden, `estado` y `limite`. Añade `area_nombre`, `responsable_id`, `responsable_nombre`, `responsable_tipo` y el filtro booleano `mis_atenciones`.

- REPRESENTANTE continúa restringido a su área; solicitar Mis atenciones como REPRESENTANTE devuelve 403.
- La identidad para Mis atenciones viene del perfil validado del backend, nunca de un técnico arbitrario pasado en query.
- El responsable activo se obtiene de las asignaciones del ciclo; para Cerrado se identifica al usuario que cerró, etiquetado Cerrado por. Una reapertura V4 completa sin asignación nueva no arrastra al responsable anterior.
- Los nombres se obtienen en consultas por lotes. No se abre `/api/usuarios` ni `/api/areas` a otros roles para rellenar la tabla.
- Si el listado está vacío se evita consultar metadatos y asignaciones: se conserva una sola consulta, compatible con las pruebas históricas.
- No se agregaron columnas ni migraciones. El esquema V4 solo se referencia después del detector existente; se conserva V3.

La configuración administrativa devuelve además `permisos_verificados`. Con el flag de administración false no se habilita nada. Cuando es true, la comprobación de solo lectura exige rol restringido, privilegios de columnas, bloqueo de áreas, políticas RLS compatibles y el trigger de cupo conocido habilitado como invocador; una configuración desconocida/fallida, trigger adicional no revisado o política restrictiva mantiene los botones bloqueados. No aplica GRANT, no modifica triggers ni corrige automáticamente el problema de 112A.

El cambio de contraseña verifica el usuario propio de Auth, reautentica con su correo canónico y contraseña actual, comprueba de nuevo la identidad y que la sesión original no haya sido reemplazada, y envía el cambio a `/auth/v1/user`. La sesión temporal se revoca con alcance local. Tras éxito confirmado, la interfaz limpia su sesión y solicita nuevo login. No se almacena la contraseña, no se escribe en Auth por SQL y no se usa una clave privada del servidor. No se cambia ninguna contraseña por abrir la pantalla o durante las pruebas de cuentas reales.

Se conservan las banderas de asignación, atención/cierre y verificación: siguen exigiendo el valor explícito true, contexto autorizado y una acción del usuario. La compilación de QA usa definiciones propias únicamente contra `127.0.0.1`, fuera del repositorio, para probar formularios sin habilitar escrituras del despliegue.

## Diferencias y bloqueos conservados

1. **Adjuntos:** sección visible, carga deshabilitada. Faltan endpoints y almacenamiento privado con autorización por incidencia, límites, descarga segura y manejo de errores. No se guardan nombres de archivos como si fueran evidencias.
2. **Antecedente sin referencia:** Figma permite información simulada sin código. El backend exige una incidencia cerrada de la misma área; esa regla se conserva. No se reabre automáticamente el antecedente.
3. **Administración completa, invitaciones y Brevo:** no se habilitaron. Persisten las condiciones privadas de servidor/SMTP y la revisión del trigger y permisos. La comprobación de capacidades no sustituye aprobar una ampliación de privilegios ni probar envío real.
4. **Correo de otras cuentas:** el contrato del directorio no lo ofrece. Se muestra Usuario; no se inventan correos ni se concede acceso a Auth para llenar una columna.
5. **JEFE como destinatario/reasignación/toma:** no se copian las opciones demostrativas que cambian las reglas reales. Asignar admite ASISTENTE/PRACTICANTE habilitados; el JEFE atiende cuando ya es responsable. No se añadieron botones de toma o reasignación.
6. **Reautenticación adicional:** si Supabase exige nonce/OTP, la interfaz informa el bloqueo sin alterar su política o improvisar SMTP. El cambio normal se reautentica con contraseña actual; la configuración efectiva del proveedor y una prueba de cambio real quedan a cargo del titular después de autorización independiente.
7. **Equivalencia visual:** se concilió la organización y paleta del Make inspeccionado. Se mantienen mensajes de errores, límites, seguridad y datos ausentes necesarios para el sistema real. No se afirma igualdad de píxel ni funcionamiento de acciones bloqueadas por configuración.

## Pruebas realizadas

| Verificación | Resultado y límite |
|---|---|
| `npm test` en frontend | 12/12 aprobadas: siete anteriores y cinco nuevas de reautenticación/identidad/logout/políticas/filtros |
| `npm run build` estándar | TypeScript y Vite aprobados, sin modificar vite.config ni dependencias. El sandbox inicialmente negó acceso a directorios de esbuild; se repitió con permiso local de lectura y pasó |
| Compilación RealApp para QA | Aprobada con configuración de prueba externa, claves ficticias y orígenes exclusivamente localhost. No cambia `.env` ni Vercel; no es artefacto de publicación |
| Backend de esta fase, `python -m unittest test_preentrega_111a test_conciliacion_112b -v`, PYTHONPATH=backend;backend/tests | 14/14 aprobadas: siete anteriores de 111A y siete nuevas. Roles, áreas, límite antes del filtrado propio, ciclo V4, cierre, perfiles inactivos, campos admitidos y cero registros |
| Descubrimiento completo local, `python -m unittest discover -s backend/tests -v`, PYTHONPATH=backend | 17/17 aprobadas; incluye además tres pruebas pendientes de 112A que no forman parte del commit de 112B |
| `.github/scripts/preentrega_110f.py` | 28/28 aprobadas, sin servicios externos ni base real |
| `.github/scripts/probar_workflows_local.py` | 21 bloques aprobados, cero fallidos. Siete bloques necesitan Docker y no se ejecutaron localmente; no se despacharon Actions remotas |
| `.github/scripts/probar_permisos_112b.mjs` | Cinco comprobaciones en PostgreSQL WASM en memoria: bloqueo con 02/04, capacidad con permisos explícitos de fixture, rechazo del trigger deshabilitado, rechazo de política restrictiva y ausencia de perfiles creados |
| Navegador local, cuatro roles | Menús y alcance de Mis atenciones verificados. Recorrido de UI registro → asignación → intervención final → cierre → conformidad completado con transporte HTTP local y datos sintéticos de QA, no con Auth/PostgreSQL municipal |
| Responsive | 30 comprobaciones: seis pantallas × 1440/1024/768/390/320 px, sin desbordamiento de página ni campos fuera de pantalla. Registro A–D también comprobado en los cinco anchos |
| Teclado y filtros | Búsqueda sin coincidencias y limpieza; foco visible en select; menú móvil abierto/cerrado con Escape y foco devuelto al disparador |
| Estado cero | Cuatro ceros y vacío elegante confirmados en la fixture; no se añadieron incidencias para llenar el dashboard |
| `git diff --check` | Sin errores de espacios; Git advierte conversión normal LF/CRLF en algunos archivos Windows |

Se corrigieron dos incidencias encontradas durante las pruebas: consulta innecesaria de metadatos al listar cero filas (rompía dos dobles de prueba históricos) y manejo de eventos de fecha/hora que perdía valores en el transporte de pruebas. La última comprobación HTTP local recibió fecha `2026-01-01` y hora `09:30`, junto al impacto correcto. También se conserva la confirmación de asignación al recargar su contexto y se limpian avisos de otro ticket al abrir el detalle.

Las pruebas anteriores de 111A conservan todas sus aserciones; su fixture incorpora asignaciones y simula el detector V3 porque SQLite no tiene los catálogos PostgreSQL. No se presentan los siete bloques Docker como aprobados. La compatibilidad de capacidades PostgreSQL se comprobó aparte en memoria, sin reemplazar una prueba real de concurrencia o del proveedor Supabase.

## Archivos de esta fase

12 archivos modificados y nueve nuevos de 112B, incluyendo este informe. Los nueve pendientes de 112A permanecen separados y no se publicaron.

| Archivo | Cambio |
|---|---|
| `backend/app/routes/incidencias.py` | Contrato enriquecido y filtrado propio seguro |
| `backend/app/lecturas_incidencias.py` (nuevo) | Lecturas de área/responsable por lote y ciclo |
| `backend/app/routes/usuarios.py` | Capacidades administrativas conservadoras |
| `backend/tests/test_preentrega_111a.py` | Adaptación de fixture, sin retirar aserciones |
| `backend/tests/test_conciliacion_112b.py` (nuevo) | Siete regresiones de contratos/permisos |
| `frontend/src/RealApp.tsx` | Navegación por rol e integración de vistas |
| `frontend/src/RealDashboard.tsx` | Indicadores y listado conciliados |
| `frontend/src/RealTicketList.tsx` (nuevo) | Tabla y filtros compartidos |
| `frontend/src/RealRegister.tsx` | Formulario A–D y campos admitidos |
| `frontend/src/RealAssignment.tsx` | Formulario reutilizable y contexto seguro |
| `frontend/src/RealAssignmentsPage.tsx` (nuevo) | Selector de incidencia e historial |
| `frontend/src/RealWork.tsx` (nuevo) | Mis atenciones desde servidor |
| `frontend/src/RealAccount.tsx` (nuevo) | Mis datos y Seguridad |
| `frontend/src/RealAdministration.tsx` | Directorio y bloqueo por capacidades |
| `frontend/src/RealTicketDetail.tsx` | Fecha/hora/antecedente en el detalle |
| `frontend/src/api.ts` | Nuevas lecturas y operación de contraseña |
| `frontend/src/session.ts` | Comprobar pertenencia de una sesión sin reemplazarla |
| `frontend/src/index.css` | Composición, responsive y foco bajo `.real-app` |
| `frontend/tests/account.test.mjs` (nuevo) | Cinco pruebas de transporte de Auth/filtros |
| `.github/scripts/probar_permisos_112b.mjs` (nuevo) | Pruebas de SQL de capacidades en memoria |
| `docs/112B_IMPLEMENTACION_Y_PRUEBAS.md` (nuevo) | Este informe |

No cambiaron App.tsx, main.tsx, las migraciones/SQL operativos, modelos de tablas, claves, CORS, URLs, archivos de entorno, dependencias ni workflows. Los datos y las identidades utilizados para las pruebas están en fixtures aisladas, nunca en el frontend de producción.

## Evidencia y reproducción

Capturas y registros de QA conservados fuera del repositorio y del artefacto publicado:

- `dashboard-cero-desktop.jpg` / `dashboard-cero-mobile.jpg`: estado vacío con cuatro ceros.
- `dashboard-final-desktop.jpg`, `incidencias-final-desktop.jpg`, `asignaciones-final-desktop.jpg`, `atencion-final-desktop.jpg`, `usuarios-final-desktop.jpg`, `cuenta-final-desktop.jpg`: composición de las seis vistas con fixture.
- `registro-desktop.jpg`, `registro-mobile.jpg`: organización A–D.
- `cuenta-final-mobile.jpg`: tarjetas apiladas.
- `matriz-responsive-final.json`: 30 resultados de dimensiones.
- `roles.json`, `recorrido-local.json`, `workflows.log`: menús, peticiones sin contraseñas/tokens y verificaciones históricas.
- `vite.qa.config.mjs`, `fixture.py`: transporte exclusivamente local, fuera del repositorio y sin conexión SQL. Sus constantes de QA no son configuración del despliegue.

Reproducir build/pruebas desde los directorios indicados, con dependencias existentes. La prueba PostgreSQL acepta como argumento la ruta al módulo oficial PGlite instalado en un directorio temporal; no añade una dependencia a producción ni acepta DATABASE_URL.

Antes del push se comprobó en Vercel que ambos proyectos mantienen `main` como rama de producción y `ajustes-docente-v4` como Preview. La revisión del despliegue será de solo lectura: no se ha acreditado aislamiento de la base de datos, por lo que no se harán registros, cambios de contraseña, invitaciones ni modificaciones de prueba en remoto. No se modificarán variables de entorno ni se promoverá el Preview a producción.
