# Guía de operación y preparación de entrega 112E

Estado: candidato **local**, actualizado 23/11/2026 (America/Lima). No es una certificación de producción. QA independiente autorizado para preparación; publicación, configuración municipal y envíos reales requieren autorización propia.

## Uso por rol

| Perfil | Recorrido y restricciones |
| --- | --- |
| JEFE | Consultar panel/incidencias; evaluar prioridad con justificación; asignar un técnico habilitado; consultar historial; tomar una incidencia libre para atenderla directamente. Reportes permite combinar fechas/área/estado/prioridad/responsable y descargar PDF/Excel. Los totales abarcan todas las coincidencias. Exportaciones: máximo 5.000 filas y 4 MB, sin truncado silencioso. |
| REPRESENTANTE | Registrar A–D con su perfil/área de sesión. La sugerencia por impacto no es prioridad oficial. Consultar su área y verificar un cierre: Conformidad conserva el cierre; Observación reabre automáticamente un ciclo V4, preservando el cierre anterior. No asigna, interviene ni administra usuarios. |
| ASISTENTE | Consultar casos libres y propios, incluidas participaciones históricas. Atender sus asignaciones; AUTOTOMA solo si FastAPI la autoriza. Puede proponer prioridad inicial provisional justificada cuando no existe prioridad oficial, pendiente de revisión JEFE. Registrar solución final antes del cierre; conservar ambos ciclos al atender una reapertura. |
| PRACTICANTE | Consultar y atender los casos autorizados; AUTOTOMA según capacidades del servidor. No confirma ni propone prioridad, no asigna a terceros y no administra. Conserva su informe técnico como participante. |

Los informes técnicos de participantes son consultas/borradores. No equivalen al reporte institucional del JEFE ni a documentos firmados. El silencio del solicitante no crea conformidad automática. No existe una operación de reapertura manual independiente.

## Adjuntos

Registrar primero la incidencia; después abrir su detalle, sección Fotografías y archivos. La carga aparece solo cuando el servidor confirma configuración, bucket privado y autorización. Solicitar un archivo JPEG/PNG/WebP/PDF, máximo **4 MB** (límite conservador frente al proxy), hasta diez por incidencia. El backend comprueba extensión, firma del tipo y tamaño; descarga como archivo, sin enlaces públicos ni rutas internas en las respuestas. No es un análisis antivirus ni una validación exhaustiva del contenido del documento.

REPRESENTANTE puede adjuntar en incidencias abiertas de su área; TI, únicamente cuando es responsable activo. Cerradas: consulta/descarga autorizada, sin nuevas cargas. Se guardan actor, ciclo y evento; un nuevo ciclo no elimina archivos anteriores. No se admiten rutas heredadas sin verificar su ubicación privada. Si el objeto se guarda y PostgreSQL falla, se intenta retirar exclusivamente ese objeto nuevo; una compensación fallida puede dejar un objeto huérfano privado, que exige conciliación autorizada, no borrado masivo.

Validado: HTTP/SQL y pantalla con adaptador de almacenamiento **QA local privado**. Falta la comprobación de Supabase Storage real, políticas del bucket, límites del despliegue y requisitos de análisis de archivos antes de activar producción.

## Acceso, recuperación y administración

- Mi cuenta verifica la contraseña actual mediante reautenticación para el cambio normal. Recuperación es un flujo separado de Supabase Auth: solicitud neutra, enlace con sesión validada, contraseña nueva sobre el UUID existente y regreso al login. No cambia correo, rol ni área. Los tokens permanecen en memoria y se retiran de la URL; enlaces expirados/incompatibles se rechazan. El callback implementado usa retorno con fragmento `type=recovery`; enlaces PKCE/token_hash requieren otro flujo y se limpian/rechazan expresamente.
- El enlace «Olvidé mi contraseña» explica la configuración pendiente y no permite enviar mientras esté deshabilitado. Antes de habilitarlo: Auth **de QA independiente**, SMTP de pruebas, Site URL y Redirect URLs exactas del entorno; confirmar requisitos de CAPTCHA/MFA/políticas. No reutilizar el Auth municipal para estas pruebas ni cambiar las claves del JEFE o de las usuarias reales. La [documentación de recuperación de Supabase](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail) y sus [redirecciones](https://supabase.com/docs/guides/auth/redirect-urls) son la referencia del operador.
- JEFE consulta usuarios/áreas. La edición requiere bandera privada y verificación SQL efectiva en la propia ruta: permisos, RLS, trigger de cupo y tabla de auditoría. Cambios permitidos dejan actor, objetivo, fecha y valores anteriores/nuevos de rol/área/habilitación, sin guardar correos ni credenciales en esa auditoría. Se protege el acceso del propio JEFE y el cupo de representantes; el cupo se comprueba antes de invitar para evitar altas externas que ya sabemos incompatibles.
- La invitación utiliza exclusivamente la API Admin del servidor. Auth y PostgreSQL no comparten una transacción: un fallo posterior de registro exige conciliación por el operador; la cuenta sin perfil no obtiene acceso. No reintentar indiscriminadamente ni editar `auth.users` por SQL. Invitaciones reales y recuperación real siguen pendientes de Auth/SMTP QA y consentimiento de destinatarios.

## Variables y migraciones propuestas

Solo se editó la **plantilla** `backend/.env.example`; no se modificaron archivos .env municipales ni Vercel.

| Configuración | Lugar/condición |
| --- | --- |
| `BREVO_HABILITADO=false`, `BREVO_API_KEY`, `CORREO_REMITENTE` | Privadas del backend/worker. Clave API Brevo y remitente/dominio autenticados; no usar prefijo VITE_. |
| `ADJUNTOS_HABILITADOS=false`, `ADJUNTOS_BUCKET` | Backend. Bucket existente y privado, acceso servidor validado y credencial secreta privada. Nunca crearlo automáticamente. |
| `ADMINISTRACION_PERFILES_HABILITADA=false` | Backend. Revisar 04 y 05, permisos/trigger/RLS y evidencia QA antes de habilitar. |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SMTP_CONFIGURADO=false` | Backend. Admin/consulta de destinatarios/invitación; SMTP de Auth se verifica aparte del envío HTTP de Brevo. |
| `VITE_RECUPERACION_HABILITADA` | Pública, false/ausente hasta validar Auth QA y redirecciones. No contiene claves administrativas. |
| Variables públicas API/Auth y banderas de asignación/atención/verificación | Conservar valores actuales hasta revisión autorizada. Un Preview puede compartir infraestructura municipal: no usarlo para escrituras de prueba. |

`database/05_complementos_112e.sql` es aditiva e idempotente; crea cola y auditoría con RLS y acceso solo del rol servidor. Añade UPDATE de la columna id de áreas para el bloqueo FOR UPDATE del trigger existente (no crea endpoint para alterar áreas). La edición de perfiles requiere también 04. Se probaron **solo en PostgreSQL QA**, incluida aplicación doble de 05. No aplicar al proyecto municipal; la preparación manual del QA independiente se detalla al final. No altera incidencias ni identidades Auth, no envía mensajes y no desactiva RLS.

## Correo institucional

La cola se prepara desde eventos ya confirmados y un **corte temporal explícito**; no se inserta ni se llama al proveedor dentro de la transacción del ticket. Avisos: registro, asignación/reasignación, autotoma, prioridad oficial, propuesta provisional, solución final, cierre, observación y reapertura. Una solución solo se identifica si existe exactamente una intervención final coincidente en incidencia, actor, fecha y ciclo; no se infiere desde texto libre ni se inventa un evento del historial. Los casos parciales/ambiguos no generan ese aviso. Destinatarios: reportante; JEFE para creación, observación, reapertura y propuestas; responsable a la fecha de asignación. Los correos se resuelven privadamente desde Auth y no se almacenan en la cola. El aviso muestra el estado del evento y remite al sistema para el vigente; no certifica conformidad ni entrega del correo.

Cada aviso tiene HTML y texto alternativo. Los datos variables se escapan, el asunto elimina controles/saltos y no se incluyen justificaciones, contraseñas, tokens ni enlaces inventados. La propuesta se identifica como **no oficial**. La observación y la reapertura mantienen sus ciclos diferentes; los avisos no cambian el mecanismo automático V4.

El remitente Gmail verificado se usa en QA. Para avisos institucionales, queda pendiente verificar un buzón del equipo y autenticar su dominio. El 24/11/2026, FastAPI registró una incidencia ficticia en Supabase QA (HTTP 201). El worker preparó dos avisos, cero duplicados al repetir y Brevo aceptó ambos en sandbox (HTTP 201 cada uno). Se simularon la identidad de sesión y los correos de destino. No hubo entregas y se revirtieron la incidencia y los avisos de prueba. También se confirmó en Gmail la recepción de un correo de prueba enviado desde el panel de Brevo. E04 sigue pendiente de comprobar una entrega real desde el backend. [Sandbox oficial de Brevo](https://developers.brevo.com/docs/using-sandbox-mode)

Desde `backend/`, con la clave y el remitente de la cuenta de pruebas configurados en una sesión privada, ejecutar `python -m app.worker_notificaciones --autorizar-operacion --validar-sandbox`. El comando funciona con `BREVO_HABILITADO=false`, no abre PostgreSQL y se ejecuta por separado de las acciones de la cola.

Unicidad evento/destinatario y UUID estable de idempotencia; workers SKIP LOCKED. Se registran estados e intentos sin credenciales ni cuerpo privado del proveedor. Un timeout o caída con envío no confirmado pasa a **incierto**, sin reenvío automático; una aceptación API no prueba entrega en bandeja. El límite del proveedor permite hasta tres intentos controlados. Pendientes/error/incierto requieren supervisión. Referencia: [API transaccional e idempotencia Brevo](https://developers.brevo.com/docs/heterogenous-versions-batch-emails).

Worker: `python -m app.worker_notificaciones`. Sin acción al importar ni tareas automáticas al iniciar FastAPI. Requiere `--autorizar-operacion` y una acción explícita (`--preparar-desde` con fecha/hora aprobada, o `--enviar`). **No ejecutar envío real ahora**: requiere proyecto/destinatario de pruebas confirmados y autorización separada. Falta decidir y configurar el servicio/scheduler de ejecución y el monitoreo fuera de las peticiones serverless; no se configuró un cron en producción.

## Instalación y mantenimiento

Frontend: `npm ci` en frontend con el lock portátil corregido (162 entradas, mismas 91 versiones anteriores y metadatos nativos de Linux). Node **22.23.5 portátil** pasó una instalación limpia sin scripts de instalación, las 31 pruebas y `npm run build` estándar en una copia QA sin .env/credenciales; Node global permanece intacto. QA anterior también se compiló con Node 24.21.0. La ejecución CI Linux/Docker sigue pendiente: incluir sus paquetes en el lock no equivale a ejecutarlos. Backend: Python 3.12, `backend/requirements-test.txt` para QA; PostgreSQL con rol API sin superusuario ni BYPASSRLS. No copiar credenciales de producción a la instalación de pruebas.

Controlador del QA existente, fuera de Git:
`C:/Users/sebas/.codex/visualizations/2026/11/16/01a1e23e-e9c4-75c0-9e26-d846aa1605ce/112c-qa/entorno-integral-3fe2186/qa_activo.py`

Usar el Python del venv QA `.../112b-qa/python-tests/Scripts/python.exe`, argumentos `iniciar-db`, `verificar`, `iniciar-web`, `detener`, en ese orden al iniciar/finalizar. El controlador comprueba rama, HEAD, hashes, puertos, ruta de datos y marca. No ejecutar activar/completar-estructura ni los scripts antiguos de carga sobre el QA poblado. No arrancar un backend de pruebas usando el .env municipal. Limpieza: conservar evidencia; cualquier borrado/reinicio de este clúster poblado exige alcance y ruta explícitos. No reutilizar la limpieza de la etapa vacía.

## Respaldo, revisión y reversión antes de publicar

1. Inventario selectivo y escaneo de secretos; revisar **todos** los archivos nuevos, incluido SQL y lock. Excluir nueve pendientes 112A y todos los artefactos privados QA. Selección/parche de revisión en índice privado, sin cambiar el índice real ni crear commit. Véase `seleccion-commit-20261123.json` fuera de Git.
2. Ejecutar Docker/PostgreSQL 16, incluido 109D6; completar Auth QA, Storage QA y correo real de prueba autorizado. Revisar el candidato frente a Figma y el frontend/API/commit/entorno efectivos de Vercel.
3. Operador autorizado: respaldo privado consistente de PostgreSQL (esquema/datos/permisos), archivos Storage y metadatos Auth necesarios, con prueba de restauración aislada. No guardar backups/contraseñas en Git ni compartirlos por chat. No exportar ni restaurar identidades por SQL improvisado.
4. Revisar por separado el SQL 04/05 y la configuración externa. Antes de cualquier prueba publicada, determinar si Preview comparte DB/Auth/Storage municipales; en tal caso, limitarse a lectura.
5. Autorizar commit/push/Preview por inventario y SHA; verificar ambos despliegues y CI. **Otra autorización** para merge/main/Production; ni la fecha ni este manual la sustituyen.
6. Reversión: preparar el último código/despliegue aprobado (base local actual `3fe2186...`), deshabilitar integraciones nuevas solo mediante configuración autorizada y conservar cola/auditoría/archivos/historial. No revertir borrando tablas ni cierres. Toda restauración de datos o Auth requiere plan y autorización propios; no restablecer contraseñas para «volver atrás».

Decisión actual: **NO APTO PARA MAIN**. Hay una versión local funcional con simuladores, pero faltan validaciones externas críticas y autorización de publicación. La evidencia de QA no equivale a validación de producción.

Restauración comprobada el 23/11: copia consistente del QA ficticio PG18 `127.0.0.1:55439` a un clúster nuevo en `127.0.0.1:55441`, directorio exclusivo. Coinciden hashes de diez tablas, identidades simuladas, 22 políticas, funciones, índices, secuencia y tres archivos locales; permisos de conexión de la base verificados por separado. Origen sin cambios y ambos clústeres detenidos. Evidencias privadas: `restauracion-ficticia-112f.json` y `restauracion-ficticia-parada-112f.json`. El dump y los archivos se conservan fuera del repositorio. No equivale a restaurar Supabase Auth/Storage ni acredita un respaldo municipal.

Vercel se revisó únicamente en lectura: frontend y backend actuales Ready/Preview del SHA `3fe2186`, Production asociada a `main` en ambos proyectos. No contienen este candidato local. El alias público respondió 302 hacia SSO de Vercel; no se eludió la protección ni se declaró salud/CORS aprobados. La reversión de código podrá referirse al SHA/despliegue previamente aprobado; restaurar datos o Auth es una operación distinta y necesita autorización.

## Supabase QA independiente — actualización del 24/11

Proyecto QA confirmado el 24/11/2026: **soporte-ti-grocio-qa-2**, [URL pública](https://vmtvttlmnqcucotskceh.supabase.co). Se aplicaron las migraciones 01–05 y se verificaron diez tablas con RLS. El bucket privado `incidencias-qa` admite PDF/JPEG/PNG de hasta 5 MB y tiene la política restrictiva `qa112f_solo_backend`. Se vincularon seis identidades ficticias con sus perfiles en dos áreas. El rol restringido `soporte_ti_api` se conectó con su credencial privada y comprobó el ciclo de la cola en una transacción que se revirtió. El frontend Preview actual usa Auth municipal. Usar el QA independiente para las pruebas con escrituras.

La API conserva un máximo de **4.000.000 bytes**; el bucket QA permite hasta 5 MB y solo PDF/JPEG/PNG. La carga y el selector usan la intersección efectiva de los límites/formatos del bucket: WebP no se ofrece ni se sube allí. La descarga anterior autorizada permanece disponible. El backend ahora respeta `sslmode=verify-full`/`verify-ca` indicados en la URL, conserva `require` como valor anterior por defecto y oculta parámetros de errores SQL.

### Orden de preparación manual (sin producción)

1. Abrir el proyecto **vmtvttlmnqcucotskceh** y confirmar nombre/URL en la interfaz antes de introducir credenciales o SQL. Un marcador SQL es una guarda adicional, no demuestra por sí solo el proyecto donde se abrió el editor. Revisar esquema/tablas existentes; detenerse si hay datos ajenos a QA.
2. Confirmar los atributos del rol exclusivo `soporte_ti_api`: NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION. En una conexión **privada de psql a QA**, el administrador puede establecer una contraseña específica de pruebas con `\password soporte_ti_api`. Solo después, habilitar `LOGIN` en el rol restringido. El editor SQL y el repositorio deben mantenerse libres de credenciales.
3. En este proyecto ya se aplicaron `01_esquema_mvp.sql`, `02_permisos_backend.sql`, `03_reapertura_v4.sql`, `04_administracion_perfiles.sql` y `05_complementos_112e.sql`. La transacción 02–05 concedió también `USAGE` sobre `public` al rol técnico. Registrar los SHA mediante `inventario`. Las migraciones 01–04 son de aplicación única.
4. El PostgreSQL administrado rechazó el parámetro personalizado anterior. La marca persistente del QA quedó en el comentario de `public.areas`, con el valor `grocio.qa_project=vmtvttlmnqcucotskceh`. Verificarlo con `SELECT obj_description(to_regclass('public.areas'), 'pg_class');`. El preflight también comprueba el destino del DSN y el rol de conexión.
5. Crear seis identidades **nuevas de pruebas**, con buzones controlados/consentidos y datos de perfil ficticios, mediante Supabase Authentication o su API Admin. Mantener confirmación de correo activa. No usar los UUID del simulador local, no copiar identidades municipales ni insertar/actualizar `auth.users` mediante SQL. Si no hay buzones/SMTP autorizados, detener esta parte; no simular su confirmación.
6. Revisar `database/qa/112f_perfiles_ficticios_revision.sql`. Completar **solo en la sesión privada** el objeto `v_ids` con los seis UUID reales de Auth QA y los alias del script. Ejecutar primero `v_aplicar=false`: debe validar sin inserciones. Después, la aplicación manual `true` inserta únicamente áreas/perfiles faltantes, rechaza perfiles diferentes y es idempotente; nunca sobrescribe un JEFE existente. Esperados: dos áreas ficticias y seis perfiles, roles JEFE=1, REPRESENTANTE=2, ASISTENTE=2, PRACTICANTE=1. El segundo REPRESENTANTE pertenece a QA Área B; los otros perfiles, a QA Área A.
7. Revisar `database/qa/112f_storage_privado_revision.sql` con `v_aplicar=false`, después aplicar manualmente `true` en QA. Exige bucket privado, PDF/JPEG/PNG, límite entre 4.000.000 y 5.242.880 bytes y RLS activa. Añade una política **restrictiva**, idempotente, que impide acceso directo de `anon`/`authenticated` a ese bucket incluso si otra política genérica es permisiva. No cambia otros buckets ni crea archivos. No habilitar políticas de propietario que permitan saltarse los permisos por incidencia de FastAPI.
8. Para enlaces de correo Auth en QA, el operador debe revisar/configurar Site URL y Redirect URL exactas `http://127.0.0.1:5174/`, SMTP y plantillas compatibles. El valor actual localhost:3000 no corresponde al frontend QA preparado. No aplicar estos valores al proyecto municipal ni habilitar recuperación hasta comprobar los enlaces. No se cambió esa configuración en esta revisión.

Las políticas públicas existentes del sistema permiten operaciones al **rol servidor restringido**, no a clientes Supabase; la autorización de los cuatro perfiles se aplica en FastAPI. El navegador no recibe `service_role`. Para Storage, la credencial del servidor evita las políticas de cliente según la [arquitectura oficial de Supabase](https://supabase.com/docs/guides/storage/security/access-control); por ello deben probarse los rechazos reales de FastAPI y también los accesos directos sin credencial administrativa. «Bucket privado» por sí solo no acredita aislamiento por área.

### Credenciales privadas y preflight (PowerShell del operador)

Utilizar una ventana privada, fuera del control de Codex, sin pantalla compartida/transcripción. Los valores se introducen con entrada oculta; permanecen temporalmente en memoria/entorno de ese proceso. No prometer borrado de todas las copias en RAM: cerrar la ventana al terminar. No usar `setx`, no guardar `.env.qa`, no pasar secretos como argumentos y no mostrar el entorno con Get-ChildItem.

Ruta mínima: revisar/completar el orden de preparación anterior; abrir PowerShell privado y ejecutar este único helper, que solicita los tres valores ocultos y llama a `configuracion` y `verificar`. **No lo ejecutó Codex.** No crea esquema/usuarios ni inicia servidores. Si falta preparación, se detiene con un mensaje no sensible; no debe forzarse para continuar.

```powershell
& 'C:\Users\sebas\.codex\visualizations\2026\11\16\01a1e23e-e9c4-75c0-9e26-d846aa1605ce\112c-qa\entorno-integral-3fe2186\configurar_qa_privado_112f.ps1'
```

| Entrada oculta | Obtener exclusivamente del proyecto QA |
|---|---|
| `GROCIO_QA_DATABASE_URL` | DSN del rol restringido `soporte_ti_api`, **base `postgres`**, host/pooler de Connect y TLS verify-full. No usar el usuario administrador postgres. |
| `GROCIO_QA_SERVICE_ROLE_KEY` | Settings → API Keys: secret key nueva o service_role legacy. Solo backend/preflight privado. |
| `GROCIO_QA_PUBLIC_KEY` | API Keys: publishable key o anon legacy. Es la única clave que podrá recibir el frontend QA. |

Las claves nuevas opacas `sb_secret_`/`sb_publishable_` no son JWT. El servidor usa `apikey` para `sb_secret_`, sin Authorization Bearer; la clave service_role legacy conserva sus cabeceras. Compatibilidad validada offline, no con secretos reales. Referencia: [claves oficiales de Supabase](https://supabase.com/docs/guides/getting-started/api-keys). No copiar las claves al chat, capturas ni código; el helper no imprime sus valores ni los guarda. Cerrar la ventana al terminar. Si una variable ya existe, no vuelve a solicitarla; para corregirla, retirar solo ese nombre del entorno privado y ejecutar de nuevo.

Alternativa manual equivalente, si se prefiere no usar el helper:

```powershell
Set-Location 'C:\Users\sebas\soporte-ti-grocio-prado'
$qaPython='C:\Users\sebas\.codex\visualizations\2026\11\16\01a1e23e-e9c4-75c0-9e26-d846aa1605ce\112b-qa\python-tests\Scripts\python.exe'
$qaRoot='C:\Users\sebas\.codex\visualizations\2026\11\16\01a1e23e-e9c4-75c0-9e26-d846aa1605ce\112c-qa\entorno-integral-3fe2186'
function Set-QaSecret([string]$Name) {
  $qaValue=Read-Host $Name -AsSecureString
  $qaPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($qaValue)
  try { [Environment]::SetEnvironmentVariable($Name,[Runtime.InteropServices.Marshal]::PtrToStringBSTR($qaPointer),'Process') }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($qaPointer); $qaValue.Dispose() }
}
$env:GROCIO_QA_SUPABASE_URL='https://vmtvttlmnqcucotskceh.supabase.co'
& $qaPython -B .github\scripts\qa_supabase_112f.py inventario
Set-QaSecret 'GROCIO_QA_DATABASE_URL'
Set-QaSecret 'GROCIO_QA_SERVICE_ROLE_KEY'
Set-QaSecret 'GROCIO_QA_PUBLIC_KEY'
& $qaPython -B .github\scripts\qa_supabase_112f.py configuracion
if ($LASTEXITCODE -ne 0) { throw 'Detener: configuración QA no válida' }
& $qaPython -B .github\scripts\qa_supabase_112f.py verificar
if ($LASTEXITCODE -ne 0) { throw 'Detener: QA todavía no preparado' }
```

El DSN debe usar `postgresql+psycopg`, base `postgres`, rol `soporte_ti_api`, host directo `db.vmtvttlmnqcucotskceh.supabase.co:5432` o el pooler oficial del QA con usuario `soporte_ti_api.vmtvttlmnqcucotskceh`, y `sslmode=verify-full`. Preparar el certificado raíz oficial de conexión en un archivo privado si la plataforma lo exige y referenciarlo con `sslrootcert`; nunca reducir TLS para aprobar. El preflight no acepta superusuario, proyectos distintos, opciones de sesión arbitrarias ni claves con otro ref/rol. Solo usa variables `GROCIO_QA_*`; ignora credenciales municipales heredadas y no lee .env.

`configuracion` no conecta. `verificar` hace únicamente GET a Auth/JWKS/bucket y SELECT en PostgreSQL en transacción de solo lectura: comprueba identidad/marca, rol sin privilegios excesivos ni membresías que permitan asumir otros roles, diez tablas con RLS, acceso directo cerrado, política Storage y seis perfiles ficticios. Imprime únicamente resultados no sensibles. No crea esquema, perfiles, mensajes ni objetos. Para ejecutar esta comprobación todavía hace falta la conexión privada del rol.

Preparados fuera de Git, sin secretos:

- `$qaRoot\qa_supabase_servidor_112f.py --autorizar-qa-ficticio`: vuelve a ejecutar preflight, limpia el entorno heredado, fija FastAPI en `127.0.0.1:8874` y usa Auth/JWT reales; **no lo iniciamos** por falta de configuración privada. Brevo, invitaciones y edición administrativa siguen apagados. Detener con Ctrl+C y cerrar la ventana privada.
- `$qaRoot\vite.supabase-112f.config.mjs`: frontend de la rama actual, API solo `http://127.0.0.1:8874`, Auth solo QA, sin .env ni autodetección VITE. Se lanza desde frontend con `npm exec -- vite --config <ruta privada completa>`. Utilizar **otra ventana** que tenga solo `GROCIO_QA_PUBLIC_KEY` y la URL pública: no heredar secretos administrativos al proceso frontend. Sirve únicamente en `127.0.0.1:5174`. Recuperación permanece deshabilitada inicialmente; no se compiló contra Auth real ni se arrancó esta pareja de servicios.

### Matriz de aceptación externa pendiente

| Área | Prueba real requerida | Criterio |
| --- | --- | --- |
| Auth | Login por los cuatro roles, usuario inexistente/no confirmado/deshabilitado, JWT incorrecto, expiración/refresh concurrente y revocado | Identidad y perfil reales QA; 401/403 correctos; un solo refresh; ningún token persistido/logueado |
| Contraseñas | Reautenticación incorrecta/correcta, cambio sobre UUID existente, enlace recovery expirado/usado/cancelado | Operador introduce contraseñas privadamente; UUID/rol/área conservados; sin falso éxito |
| Correo Auth | Site URL y Redirect URL exactas `http://127.0.0.1:5174/`, plantilla compatible con callback fragmento, buzones QA autorizados | Recepción consentida, sin seguimiento que altere enlaces; confirmar configuración SMTP y cuotas reales antes de activar recuperación |
| Storage | PDF/PNG/JPEG válidos; WebP/HTML/tipo falso/archivo vacío/exceso rechazados; diez adjuntos; descarga por dueño/área/TI participante | Bytes íntegros; sin URL pública; 401/403/404 para accesos ajenos; sin objeto/metadata ante rechazo |
| Storage directo | GET/listado/POST con clave pública y JWT de otro usuario sobre el bucket QA | Acceso rechazado, aunque FastAPI sí permita el caso autorizado; no usar service_role como prueba negativa |
| Cola | Sandbox oficial separado; después, solo con autorización, destinatario real QA | Sandbox no entrega ni marca cola como enviada; reintentos inciertos nunca automáticos; E04 sigue abierto |
| Dos ciclos | Repetir circuito solo en QA remoto una vez preparados Auth/Storage; no repetirlo en el clúster local ya aprobado | Dos cierres, conservación del primero, prioridad distinguida, historial e indicadores consistentes |

El servidor Auth por defecto puede restringir destinatarios y tasas. Revisar [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp) y [redirecciones](https://supabase.com/docs/guides/auth/redirect-urls); no asumir que habilitar Email basta para recuperación/invitación. No se modificaron SMTP, Site URL, redirecciones ni el bucket remoto.


## Inventario selectivo 112F — 44 archivos, sin staging

Los 39 anteriores se conservan y se amplían con cinco archivos del alcance QA/TLS autorizado. Esta lista es candidata para revisión, no autorización de commit. Nueve archivos 112A permanecen fuera; los scripts, capturas, credenciales y fixtures privados QA tampoco se incorporan.

```text
.github/scripts/probar_funcional_112c.py
.github/scripts/qa_supabase_112f.py
.github/workflows/verificar-backend.yml
backend/.env.example
backend/app/adjuntos.py
backend/app/config.py
backend/app/db.py
backend/app/lecturas_incidencias.py
backend/app/main.py
backend/app/models.py
backend/app/notificaciones.py
backend/app/routes/adjuntos.py
backend/app/routes/contexto_atencion.py
backend/app/routes/incidencias.py
backend/app/routes/intervenciones.py
backend/app/routes/operaciones_ti.py
backend/app/routes/usuarios.py
backend/app/routes/v4_intervenciones.py
backend/app/routes/v4_verificaciones.py
backend/app/routes/verificaciones.py
backend/app/servicios_privados.py
backend/app/supabase_admin.py
backend/app/worker_notificaciones.py
backend/tests/test_complementos_112e.py
backend/tests/test_conciliacion_112b.py
backend/tests/test_diagnostico_112c.py
backend/tests/test_preentrega_111a.py
backend/tests/test_preflight_112f.py
database/05_complementos_112e.sql
database/qa/112f_perfiles_ficticios_revision.sql
database/qa/112f_storage_privado_revision.sql
docs/112D_VALIDACION_QA_LOCAL.md
docs/GUIA_OPERACION_Y_ENTREGA_112E.md
docs/PLAN_CIERRE_20_23_NOV_2026.md
frontend/package-lock.json
frontend/src/RealAdministration.tsx
frontend/src/RealApp.tsx
frontend/src/RealAttachments.tsx
frontend/src/RealRegister.tsx
frontend/src/RealTicketDetail.tsx
frontend/src/api.ts
frontend/src/tiOperations.ts
frontend/tests/recovery.test.mjs
frontend/tests/ti-operations.test.mjs
```
