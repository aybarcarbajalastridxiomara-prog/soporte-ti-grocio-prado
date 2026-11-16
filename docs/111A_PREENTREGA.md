# Fase 111A — panel operativo y sesión

Rama de trabajo: `ajustes-docente-v4`. Cambios locales para la presentación del lunes 16 de noviembre de 2026. No se ejecutaron migraciones ni escrituras contra producción, no se enviaron correos y no se cambiaron URL, CORS ni variables de Vercel.

## Funciones implementadas

- `RealApp.tsx` conserva el acceso por Supabase Auth y ahora presenta navegación por rol, menú móvil, panel principal y cuenta institucional. El prototipo `App.tsx` permanece separado. El modo real sigue dependiendo de la configuración existente `VITE_MODO_REAL=true`.
- `RealDashboard.tsx` muestra cuatro indicadores desde `GET /api/incidencias/resumen`. El conteo se ejecuta completo en PostgreSQL, sin el límite de 50 filas; para REPRESENTANTE se filtra por el área autorizada en el backend. Si falla la consulta, se muestra `—`, nunca valores de demostración.
- La actividad reciente muestra cinco filas; el listado muestra los últimos 50 registros autorizados, con alcance explícito, búsqueda por código/asunto/prioridad y filtro de estado. La hora corresponde a la última consulta del listado completada, en Lima. Un error conserva la fecha anterior y muestra el fallo; no se presenta como un listado vacío consultado correctamente.
- Asignaciones (JEFE) y Atención técnica (JEFE/ASISTENTE/PRACTICANTE) permiten seleccionar una incidencia y abrir `RealTicketDetail`, con los formularios reales de asignación, intervención, cierre, verificación e historial. REPRESENTANTE conserva su formulario de registro. Las banderas de escritura existentes mantienen su comportamiento y permanecen desactivadas por defecto.
- `session.ts` mantiene los tokens solo en memoria, renueva antes del vencimiento, comparte una única renovación entre peticiones simultáneas y conserva el refresh token rotado. Un 401 reintenta la operación una sola vez tras renovar; un 403 mantiene la denegación. Un refresh revocado o un segundo 401 limpia el acceso y vuelve al login. Las respuestas tardías no restauran una sesión cerrada. Los fallos temporales de red permiten reintentar.
- Los enlaces de invitación compatibles de Supabase Auth retiran los tokens del fragmento de URL y permiten establecer la contraseña con la API de Auth, previa autorización del perfil. No se guardan contraseñas ni tokens en almacenamiento del navegador ni se escriben en logs.

## Administración segura

Rutas nuevas, todas con autorización JEFE consultada en PostgreSQL:

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/usuarios` | Consultar perfiles y habilitación |
| GET | `/api/areas` | Consultar áreas y estado |
| GET | `/api/administracion/configuracion` | Capacidades declaradas y configuración pendiente, sin secretos |
| PATCH | `/api/usuarios/{usuario_id}` | Actualizar nombre, usuario, rol, área y habilitación |
| POST | `/api/usuarios/invitar` | Invitar por Supabase Auth desde el servidor y registrar el perfil |

La edición valida rol, UUID, nombre, usuario y área activa; rechaza campos adicionales, nulos y booleanos enviados como texto. Protege el acceso del propio JEFE y bloquea los perfiles de jefatura en orden estable para evitar deshabilitaciones cruzadas concurrentes. La habilitación del perfil determina el acceso en cada petición; no representa confirmación de entrega de correo.

La invitación utiliza `POST /auth/v1/invite` desde `supabase_admin.py`. El navegador nunca recibe la credencial administrativa. Si Supabase acepta la invitación pero falla el registro PostgreSQL, se informa el resultado parcial; una cuenta sin perfil autorizado no obtiene acceso. El operador debe reconciliar esa cuenta antes de reintentar; no se elimina ni se sobrescribe automáticamente una identidad existente.

`models.py` declara únicamente la referencia de metadatos a la tabla existente `auth.users`, necesaria para resolver la clave foránea del mapper de perfiles al hacer INSERT/UPDATE. No se crea ni se consulta esa tabla por esta declaración.

## Configuración pendiente y bloqueos

Por defecto la consulta administrativa funciona, pero la edición y el alta permanecen deshabilitadas hasta la configuración del operador:

1. Validar `database/04_administracion_perfiles.sql` en PostgreSQL temporal y aplicar manualmente los permisos/políticas de INSERT y UPDATE de perfiles al usuario restringido `soporte_ti_api`. El script no modifica `auth.users`, ni otorga permisos a `anon` o `authenticated`. No se ha aplicado a producción.
2. Configurar en el **backend** `ADMINISTRACION_PERFILES_HABILITADA=true` únicamente después de validar dichos permisos. Se añadió con valor predeterminado `false`; no se habilitó durante esta fase.
3. Para invitaciones, configurar la variable privada de servidor `SUPABASE_SERVICE_ROLE_KEY` con la clave administrativa legacy `service_role` del mismo proyecto. Nunca usar prefijo `VITE_` ni incluirla en archivos versionados.
4. Configurar y probar SMTP en Supabase Auth y declarar `SUPABASE_SMTP_CONFIGURADO=true` en el backend. Este indicador es una confirmación del operador, no una comprobación automática de entrega. No se ha validado el envío real ni la configuración de producción.
5. Confirmar que el Site URL de Auth y su lista autorizada dirijan al frontend real existente, y probar invitación/activación con una cuenta autorizada cuando se apruebe esa prueba. No se cambiaron estos valores.

La conexión GitHub disponible en esta sesión informa `pull=true`, `push=false`. No se publicaron cambios ni se dispararon ejecuciones remotas. El workflow `.github/workflows/preentrega-111a.yml` queda preparado para la rama solicitada. Las pruebas completas con PostgreSQL temporal de los workflows anteriores requieren Docker, no disponible en este equipo. La migración administrativa no se declara validada en PostgreSQL hasta realizar esa comprobación.

## Validación realizada

- `npm run build` en modo prototipo y en modo real, con dominios `.invalid` y banderas de escritura `false`: aprobado.
- `npm test`: 7 pruebas de renovación, rotación, concurrencia, logout durante renovación, denegación 403, límite de reintentos 401 y activación de invitación: aprobadas.
- `python -m unittest discover -s backend/tests -v`, con `PYTHONPATH=backend`: 7 pruebas aisladas con SQLite en memoria, sin Auth ni base real. Incluyen 120 incidencias de prueba para verificar conteos completos, aislamiento de área, permisos de todos los roles, bloqueo sin credenciales/SMTP, actualización y deshabilitación, validación y protección de la identidad existente: aprobadas. No reemplazan la comprobación PostgreSQL de bloqueos y RLS.
- `.github/scripts/preentrega_110f.py`: 28 controles anteriores aprobados.
- `.github/scripts/probar_workflows_local.py`: 21 bloques Python de workflows anteriores aprobados, sin modificar esas pruebas. El ejecutor identifica 7 bloques Python que requieren Docker y no los ejecuta; tampoco sustituye los pasos shell/PostgreSQL de dichos workflows.
- `compileall` de `backend/app`, análisis de las 6 instrucciones de la migración administrativa con `pglast` y lectura estructural del workflow 111A: aprobados.
- `.github/scripts/comprobar_ui_111a.mjs`, Chrome sin interfaz visible: 16 combinaciones de cuatro roles con 320/375/768/1440 px. Login, visibilidad de opciones, filtros, apertura de detalle, historial, registro móvil, administración deshabilitada y regreso al login al fallar la renovación: aprobados, sin errores JavaScript ni desbordamiento horizontal de la página. Las respuestas se interceptan en memoria; no se crean datos en ningún servicio. Requiere Playwright y Chrome; `PLAYWRIGHT_MODULE` permite usar una instalación externa y `EVIDENCIA_DIR` seleccionar la carpeta de capturas.

## Archivos modificados o añadidos

- Interfaz: `frontend/src/RealApp.tsx`, `RealDashboard.tsx`, `RealAdministration.tsx`, `RealUI.tsx`, `RealRegister.tsx`, `api.ts`, `session.ts`, `index.css`.
- Backend: `backend/app/routes/incidencias.py`, `backend/app/routes/usuarios.py`, `backend/app/config.py`, `backend/app/models.py`, `backend/app/supabase_admin.py`, `backend/.env.example`.
- Permisos pendientes de aplicación: `database/04_administracion_perfiles.sql`.
- Pruebas y herramientas: `backend/tests/test_preentrega_111a.py`, `frontend/tests/session.test.mjs`, `frontend/package.json`, `.github/scripts/probar_workflows_local.py`, `.github/scripts/comprobar_ui_111a.mjs`, `.github/workflows/preentrega-111a.yml`.
- Entrega: `.gitignore` (excluye dependencias Node) y este informe.

Se conservaron `backend/app/auth.py`, `frontend/src/App.tsx`, `RealTicketDetail.tsx`, los formularios de asignación/atención/verificación y los workflows anteriores.

Referencias técnicas: [sesiones de Supabase Auth](https://supabase.com/docs/guides/auth/sessions), [invitaciones administrativas](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) y [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
