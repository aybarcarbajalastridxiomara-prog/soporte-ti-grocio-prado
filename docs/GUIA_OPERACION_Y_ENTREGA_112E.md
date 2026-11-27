# Guía de operación y preparación de entrega 112E

**Preparación SMTP/Preview, 25/11 (sin cambios remotos):** operador acredita remitente Gmail verificado, con advertencia DKIM y sin dominio propio confirmado; es solo candidato QA, no prueba de entrega ni dominio autenticado. Conexión local real a Brevo 587: EHLO/STARTTLS/QUIT con certificado válido y TLSv1.3, sin AUTH ni envío. Procedimiento privado QA2_ACTIVACION_PASO_SIGUIENTE.txt y verificador sin envíos preparados; cuatro tests offline del verificador aprobados. Cotejo actual de Vercel: frontend y backend c721734 Ready/Preview, pero VITE_SUPABASE_URL sigue apuntando al proyecto municipal. No usar esos Preview para QA2. Fuentes c721734 clonadas fuera del repositorio de trabajo, conservando los cambios recientes. Adaptador privado QA corregido para Settings.environment, siete pruebas aprobadas; no instalado/desplegado. Faltan autorización de Preview independiente/conexión QA restringida, configuración privada SMTP y retorno HTTPS real; después autorización de invitaciones. Ningún envío, publicación, alteración de rol ni configuración ejecutados. **31/40**; no se repiten pruebas de Storage sin cambios ni se acredita E08 sin transferencias reales con JWT QA.

**Estado vigente, 25/11: seis cuentas nuevas vinculadas.** El operador ejecutó el alta privada: seis identidades distintas pendientes, seis anteriores preservadas y cero envíos. Codex leyó los UUID únicamente del registro privado, cotejó el host oficial QA2 y validó el SQL revisado b28fa3eef5468a32d9b70351fcbc56246e7c2e6be94b8c91dfc50d658bc71632 con READ ONLY/ROLLBACK. La transacción autorizada insertó solo dos áreas y seis perfiles; comprobación posterior e idempotencia en lectura aprobadas. Totales: doce Auth, doce perfiles, cuatro áreas; seis nuevas cuentas aún pendientes. Huellas anteriores de Auth, perfiles, áreas y los ocho conjuntos de datos protegidos idénticas; estructura, RLS, Storage y soporte_ti_api NOLOGIN conservados. Evidencias privadas qa2-vinculacion-precondiciones-readonly.json, qa2-vinculacion-posterior-readonly.json y qa2-seis-perfiles-verificados-25nov.jpg. No ejecutar de nuevo el alta ni modificar las seis cuentas excluidas.

**Activación pendiente:** lectura actual confirma SMTP personalizado deshabilitado, Site URL http://localhost:3000 y ninguna Redirect URL. Antes de enviar: remitente/dominio Brevo acreditados, configuración SMTP exclusiva QA2 con entrada privada de la credencial SMTP y retorno hacia frontend/API exclusivos QA2. La clave API del backend y la credencial SMTP son distintas. Configuración, publicación QA, invitaciones, recuperación y notificaciones requieren sus autorizaciones respectivas; ningún envío solicitado. La invitación admite la identidad pendiente existente; no crear otras seis cuentas. Establecimiento de contraseña exclusivamente por el titular. Rama remota leída en c72173401f32f4c2c5a8f9b3f27494f252779422, de ChavezChoqueMaria; copia local b8c9a0d preservada, sin reset, sobrescritura ni publicación. **31/40, NO APTO PARA MAIN**: vincular perfiles no acredita E06/E08/E10/F10/E04. Los bloques siguientes conservan su contexto histórico anterior.

**Alta de seis cuentas AUTORIZADA, pendiente de ejecución privada:** el operador autorizó las seis identidades nuevas pendientes, dos áreas y seis perfiles con el SQL v2 exacto SHA256 b28fa3eef5468a32d9b70351fcbc56246e7c2e6be94b8c91dfc50d658bc71632. No pedir de nuevo ese permiso si las precondiciones siguen correctas. Preflight real nuevo READ ONLY aprobó control/NOLOGIN, trece huellas y ocho hashes de datos, seis alias libres; Auth Hooks muestra el estado vacío, sin hooks configurados. No se crearon identidades, áreas ni perfiles nuevos en este bloque. La interfaz de alta requiere contraseña; no se utilizará para saltar el procedimiento pendiente/sin contraseña. En el proceso de Codex no están configuradas GROCIO_QA_SERVICE_ROLE_KEY, GROCIO_QA_SUPABASE_URL ni GROCIO_QA_PUBLIC_KEY; no se buscaron valores de claves en el navegador, archivos municipales o logs.

Ejecutor privado fuera de Git: qa2_crear_cuentas_privado.py y qa2-alta-privada.ps1, paquete qa2-alta-privada-manifiesto.json. Once pruebas offline de creación simulada/control de alcance aprobaron, sin tráfico a Auth real. Verifica hashes de seis archivos y rama/HEAD; el preflight tiene validez de una hora. Solo GET de listado y seis POST /auth/v1/admin/users al host QA2 fijo, con los correos consentidos y marca Admin; email_confirm=false, sin password, invitaciones, recover, confirmaciones, update/delete o SQL. TLS verificado, sin proxies/redirecciones; rechaza aliases ajenos, preexistentes o UUID antiguos. El modo verificar solo hace GET. Registro parcial provoca detención, no reintento ni borrado. Guarda únicamente los UUID reales devueltos y una huella de las seis identidades previas en qa2-nuevos-uuid-privados.json fuera de Git; nunca correos, claves ni tokens. El archivo aún no existe: **cero altas ejecutadas**.

Paso manual imprescindible: abrir PowerShell privado fuera de Codex, sin grabación/transcripción, y ejecutar el .ps1 con -Accion Crear desde la carpeta privada de evidencias. Pedirá el Gmail base consentido y la clave existente service_role/secret de **QA2**, ambos con entrada oculta. Obtenerla privadamente en Settings > API Keys del proyecto vmtvttlmnqcucotskceh; no crear/revocar claves, no usar la municipal ni enviar valores al chat. Si la política de PowerShell bloquea el .ps1, usar directamente el Python privado con qa2_crear_cuentas_privado.py --crear; no cambiar la política de seguridad. Comunicar solo el JSON no sensible. Si hay error/registro parcial, usar Verificar y detener altas; si caducó el preflight, actualizar únicamente la lectura, sin repetir migraciones. Después Codex podrá leer los UUID ficticios del archivo privado, verificar nuevamente destino/b28, validar READ ONLY y aplicar únicamente los seis perfiles/dos áreas ya autorizados. No dar por creados perfiles hasta esa comprobación. Activación posterior: SMTP QA2 con Brevo y retorno QA válido, invitaciones consentidas autorizadas por separado y contraseña establecida privadamente por titular. No cerrar E06/E08/E10/F10/E04 sin sus pruebas reales.

**ADOPCIÓN QA2 COMPLETADA Y VERIFICADA, 25/11:** autorización limitada del operador ejecutada únicamente en vmtvttlmnqcucotskceh. Dashboard/host oficial Connect cotejados inmediatamente antes; revisión íntegra SHA256 652166751e983d052f5e92bde9e6d64b43a02683153e61fe142a3473ac025b48 y validación READ ONLY previa aprobadas. Copia aplicada SHA256 0a77e6f1365d4e87d324c24838ea01e3354d2dcc3c56794708a8ee96a334e058: solo cinco controles de ejecución completados, sentencias/huellas sin cambios. BEGIN/COMMIT terminó Success. No rows returned. Se restauró soporte_ti_api NOLOGIN y se creó qa_control.entorno, una marca, RLS y SELECT/USAGE privados. La comprobación posterior READ ONLY completa también aprobó: trece huellas esperadas, ocho hashes de filas, propiedad/ACL/política privada y cero conexiones API. **Preservados íntegramente 8 incidencias, 6 asignaciones, 2 intervenciones, 24 eventos; seis Auth/perfiles, diez tablas/22 políticas y Storage privado sin cambios.** Sin usuarios nuevos, correos, migraciones 01–05, cambios municipales, main ni despliegues. No volver a ejecutar la copia de aplicación. Evidencia qa2-conciliacion-aplicacion-resultado.json y qa2-adopcion-aplicada-verificada-25nov.jpg. Las discrepancias LOGIN/pending inferiores son históricas.

Siguiente bloque preparado, **no autorizado ni ejecutado**: seis Auth nuevos con email_confirm=false, sin password ni envío, marca administrativa de aprovisionamiento y seis alias ya consentidos; después dos áreas y seis perfiles nuevos con UUID devueltos realmente por Admin API. Archivos privados qa2_altas_pendientes_preparacion.py y qa2-perfiles-nuevos-v2-pendientes-revision.sql (SHA256 b28fa3eef5468a32d9b70351fcbc56246e7c2e6be94b8c91dfc50d658bc71632). Cinco tests de preparación nuevos aprobados; no equivalen a altas, Auth o correo reales. El SQL v2 admite únicamente el correo consentido y la marca app_metadata administrativa del alta nueva, incluso pendiente, y conserva los anteriores. Esto evita depender de confirmar el correo antes de vincular el perfil que exige la pantalla de activación. No usar el SQL v1 que exigía confirmación previa en este recorrido. Antes de ejecutar altas: comprobar hooks Auth para descartar efectos externos, destino, colisiones y credencial privada; ninguna clave en chat/navegador/repositorio/log. Las invitaciones y contraseñas de titular son posteriores, con SMTP/retornos QA y permiso de envío separado. **31/40**; siguen pendientes las pruebas reales y la habilitación privada de una conexión QA segura.

**Conciliación puntual vigente del 25/11, sin escrituras:** diferencias identificadas y reconstruidas por MD5: soporte_ti_api pasó de NOLOGIN a LOGIN; hay 8 incidencias, 6 asignaciones, 2 intervenciones y 24 eventos, antes cero. No cambiaron los seis perfiles, dos áreas ni los timestamps de Auth; siguen sin logins Auth. Otros once componentes (estructura, RLS, grants, funciones y Storage) coinciden. Las nuevas filas referencian perfiles QA antiguos: esto no acredita sesiones Auth ni legitimidad del proceso; no se usarán para aprobar el ciclo real. pg_stat_statements permite atribuir dos INSERT operativos al rol API, no a una persona ni a todas las filas; no se pudo atribuir el cambio LOGIN. Cero conexiones del rol API observadas. Se conservan todas las filas. Las notas inferiores que indican NOLOGIN o cero incidencias describen el estado anterior.

Propuesta nueva, fuera de Git: `qa2-conciliar-nologin-y-adoptar-revision.sql`, SHA256 **652166751e983d052f5e92bde9e6d64b43a02683153e61fe142a3473ac025b48**. Único cambio adicional al control privado: ALTER ROLE soporte_ti_api NOLOGIN; no cambia contraseña, membresías ni grants existentes. Trece huellas estructurales/del estado y ocho hashes completos de filas protegen antes/después; rechaza conexiones API existentes sin terminarlas. La copia final READ ONLY, false/ROLLBACK y consulta posterior de alias aprobaron; nueve tests estáticos adicionales aprobaron. **No aplicada; requiere autorización nueva expresa de NOLOGIN + adopción**, conforme a la instrucción vigente. Comprobación posterior de solo lectura preparada, sin utilizar el antiguo resumen que esperaba cero datos. Reversión atómica por error antes del COMMIT; después no eliminar controles ni restaurar LOGIN automáticamente.

Seis alias Gmail consentidos preparados privadamente, sin guardar direcciones en Git: consulta real sin conflictos (ninguno existe); índice Auth utiliza el correo completo, y las fuentes oficiales revisadas conservan la etiqueta + al identificar usuarios. Esto acredita compatibilidad/preparación, no seis UUID nuevos ni entrega. Herramienta `qa2_aliases_privados.py` solo prepara en memoria, no crea ni envía; cuatro tests locales aprobados. `qa2_restriccion_identidades.py` prepara una restricción adicional a los seis UUID nuevos después de la verificación JWT original; cinco tests unitarios aprobados, no instalada ni prueba de Auth real. **No arrancar servidor/preflight antiguos**: esperan los perfiles qa_ excluidos; el próximo preflight debe seleccionar solo qa2_ nuevos, conservando los anteriores. Plan independiente `qa2-preview-cuentas-controladas-plan.json`: sin URL inventada, servicios arrancados ni despliegue.

**Correo actual:** el panel QA2 volvió a cargar sin ERR_ADDRESS_UNREACHABLE y muestra Toggle SMTP=false; SMTP personalizado está deshabilitado. El error anterior era de acceso a la página, no una prueba de transporte SMTP ni de contraseña SMTP. Falta configurar privadamente SMTP de Supabase Auth con credencial SMTP/remitente, URL de retorno QA válida y autorización de envíos; API de Brevo para notificaciones requiere su clave API, remitente/dominio y prueba consentida separada. Ninguna credencial leída, ningún cambio ni envío. Evidencias privadas qa2-conciliacion-diferencias-resuelta.json, qa2-conciliacion-validacion-readonly.json, qa2-aliases-disponibilidad-readonly.json y qa2-smtp-estado-readonly-25nov.json. **31/40, NO APTO PARA MAIN**; no se acreditan E04/E06/E08/E10/F10 por estas lecturas o tests estáticos.

Estado vigente: candidato **b8c9a0d publicado en Preview**, actualizado 24/11/2026 (America/Lima), 31/40 hitos. CI publicado 10/10; no es una certificación de producción ni de las herramientas QA locales sin publicar. QA2 contiene ahora una estructura e identidades de origen pendiente de aclaración; intento 00b detenido por su guarda, sin aplicar. Main, configuración municipal y envíos reales requieren autorización propia. El checklist y sus criterios originales se conservan en `PLAN_CIERRE_20_23_NOV_2026.md`.

**Conciliación READ ONLY del estado existente:** comparación contra 01–05 confirma diez tablas con RLS, 90 columnas/tipos/nulabilidad, 63 restricciones, 32 defaults, 25 índices y 22 políticas coincidentes; grants de tablas/columnas esperados y dos funciones/triggers MVP correctos. Cero acceso de anon/authenticated, incluso parcial por columnas. Hay seis perfiles que coinciden exactamente con el inventario QA, dos áreas permitidas y seis identidades vinculadas/confirmadas, sin login previo; esta coincidencia no certifica control ni consentimiento de sus buzones. No hay incidencias, actuaciones, historial, cola ni objetos Storage. Bucket incidencias-qa privado, 5 MB y PDF/JPEG/PNG; política restrictiva y RLS correctas, sin prueba de carga/descarga. Falta qa_control.entorno y el rol API permanece NOLOGIN.

Evidencia de origen disponible, hora Lima del 24/11: bucket por API a las 10:33; logs DDL de ocho tablas a las 10:36 y dos complementarias a las 11:42 bajo postgres/aplicación registrada como Dashboard; seis POST Auth Admin aceptados a las 11:55 y eventos user_signedup con actor técnico service_role; perfiles/áreas guardan timestamp 12:31. La estadística registra además ALTER ROLE soporte_ti_api NOLOGIN exacto bajo supabase_admin a las 11:42. No identifica a la persona, integración ni causa del cambio. No hay ledger supabase_migrations de la aplicación; versiones internas Auth/Storage no acreditan 01–05. auth.audit_log_entries está vacío, pero sí hay auditoría externa en logs de Auth. rls_auto_enable/ensure_rls es un event trigger adicional compatible con el patrón publicado por Supabase, no parte del MVP ni motivo para quitar RLS. Informe privado agregado: qa2-auditoria-readonly-conclusion.json, sin correos, UUID ni credenciales.

**Decisión vigente del 25/11:** el operador no puede acreditar las seis cuentas existentes y ordena no utilizarlas, modificarlas ni eliminarlas. Se retira su acreditación como requisito para adoptar solo el control privado: la nueva propuesta `qa2-adoptar-sin-usar-cuentas-previas-revision.sql` exige confirmar su exclusión, conserva las trece huellas y NOLOGIN, y requiere autorización específica; preparada, no validada otra vez remotamente ni aplicada. El script anterior queda histórico y no se ejecutará. Preparados `qa2-cuentas-nuevas-plan.json` y `qa2-perfiles-nuevos-revision.sql`: seis alias qa2_ nuevos, dos áreas QA2 Controlada A/B distintas de las previas, solo UUID reales confirmados y ninguna sobrescritura. Seis pruebas estáticas nuevas aprobadas. Antes de crear: operador aporta privadamente seis direcciones distintas controladas y consiente el uso; autorización agrupada para Auth y perfiles/áreas, con envíos aprobados por separado. El Preview/API independiente debe admitir solo los UUID QA nuevos autorizados. La habilitación del rol servidor/credencial restringida también necesita etapa privada específica. No reinstalar, no ejecutar la instalación vacía ni los scripts antiguos de vinculación qa_. **31/40, sin nuevos cierres ni escrituras remotas.**

**Bloque vigente de adopción y servicios:** `qa2-adoptar-control-revision.sql`, fuera de Git en la carpeta privada de evidencias, SHA256 **e34318faaa940afef07f65f7f73126a4a63cff37ff378beec870ac4feb8f31a2**. La copia de validación con READ ONLY, false y ROLLBACK terminó **Success. No rows returned**, cotejando trece huellas del estado auditado. Evidencia `qa2-adopcion-validacion-readonly.json` y `qa2-adopcion-validada-readonly.jpg`. Ocho pruebas estáticas adicionales comprueban alcance privado, guardas, rechazo de cambios de rol/datos públicos/RLS y equivalencia de esa copia. No se aplicó la adopción: requiere acreditación humana de identidades y autorización específica. Su único alcance es crear qa_control.entorno, una marca, RLS y permisos SELECT privados; conserva NOLOGIN. Reversión por transacción ante diferencia; no eliminar controles automáticamente tras COMMIT. Comprobación posterior preparada en `qa2-adoptar-comprobar-readonly.sql`, no ejecutada.

Brevo: `brevo_qa_solo_lectura.py` y `configurar_brevo_qa_privado.ps1` preparados fuera de Git; **11 pruebas offline aprobadas**, sintaxis PowerShell correcta sin ejecutar los prompts. El operador puede ejecutar manualmente el .ps1 desde una ventana privada: pide clave API/remitente con entrada oculta, usa solo variables de proceso y las retira al terminar; valida el hash del verificador antes de pedir valores. No usar el entorno controlado por Codex ni compartir valores. Consulta solo GET de cuenta/remitentes/dominio, sin envíos ni cambios; devuelve booleanos, no respuestas del proveedor. Aún no se realizaron esas consultas reales. La lectura del panel SMTP QA quedó bloqueada por ERR_ADDRESS_UNREACHABLE: **configuración SMTP no verificada**, no inferir que está habilitada o deshabilitada. SMTP de Supabase Auth usa credencial SMTP propia; la API del backend usa clave API Brevo. Se requieren remitente/dominio autenticados, buzones consentidos y autorización de envío para cerrar E04/E10; Brevo es obligatorio para la aceptación final.

Disponibilidad pública comprobada desde navegador: JWKS QA2 con una clave pública ES256, login del Preview publicado accesible y health de API con base conectada. No acredita login real, correo ni aislamiento del Preview: el Preview publicado usa servicios municipales y no se utilizará para escrituras QA. No existe aún un Preview independiente QA2. Estado **31/40, NO APTO PARA MAIN**; sin escrituras remotas, envíos, cambios de entorno ni publicación nueva.

**Incidencia vigente posterior a esa preparación:** se intentó el 00b exacto SHA256 125127aa4999790d1eb0d827373f0f8961d1f0812b0a38801174d302e38dfd9a, con destino cotejado de nuevo en Connect. Se detuvo antes de su primera escritura con P0001: bootstrap solo antes de migraciones y datos. La lectura posterior real confirma diez tablas públicas, 22 políticas, seis identidades Auth, un bucket y cero objetos; marca privada ausente, rol soporte_ti_api existente con LOGIN=false y los demás atributos privilegiados false. No se aplicaron 00b ni 01–05 por Codex. La autorización de 01–05 fue condicionada a bootstrap correcto y no se cumplió. **No ejecutar la instalación inicial sobre este estado ni alterar el rol:** falta aclarar el procedimiento que preparó QA2 y confirmar que las identidades son ficticias. Evidencia privada qa2-00b-resultado-24nov.json y qa2-estado-existente-24nov.jpg. Los pasos de instalación de esta guía describen un QA vacío y quedan suspendidos hasta esa conciliación; no se considera certificada la estructura existente por contar tablas/políticas.

## Uso por rol

**Adopción autorizada del 25/11, detenida sin escrituras:** SQL exacto SHA256 948ef0c5de3f95e2adce685c48559e3bbfa2366da2aa458f608bae65a12adf67 y destino QA2/host oficial Connect cotejados nuevamente. La validación nueva READ ONLY íntegra falló con P0001 en huellas **fixtures, rol_api**. No se modificó el SQL para aceptar el cambio ni se ejecutó la copia de aplicación. Evidencia privada `qa2-adopcion-diferencias-25nov.json`. Hace falta conciliar el nuevo estado y cualquier preparación concurrente antes de usar la autorización condicionada; no reinstalar. Alias Gmail + son una alternativa documentada para seis direcciones en un buzón controlado, no seis buzones: fuentes oficiales de Google y consultas de identidad por email completo en Supabase revisadas, sin crear identidades ni probar todavía la versión desplegada en QA2. Referencias privadas `qa2-alias-plus-verificacion-fuentes.json`. **31/40 sin cierres adicionales.**

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

Frontend: `npm ci` en frontend con el lock portátil corregido (162 entradas, mismas 91 versiones anteriores y metadatos nativos de Linux). Node **22.23.5 portátil** pasó instalación limpia, 31 pruebas y `npm run build` estándar sin .env/credenciales; Node global permanece intacto. CI Linux y los siete bloques Docker/PostgreSQL 16, incluido 109D6, aprobaron en b8c9a0d. Backend: 50 tests versionados y 48 comprobaciones del flujo integral aprobados; Python 3.12 y `backend/requirements-test.txt` para QA. Rol API sin superusuario ni BYPASSRLS. No copiar credenciales de producción a la instalación de pruebas.

Controlador histórico del QA PostgreSQL ficticio existente, fuera de Git:
`C:/Users/sebas/.codex/visualizations/2026/11/16/01a1e23e-e9c4-75c0-9e26-d846aa1605ce/112c-qa/entorno-integral-3fe2186/qa_activo.py`

Este controlador conserva deliberadamente el HEAD 3fe2186 de sus evidencias y **no debe usarse para arrancar b8c9a0d** ni relajarse para saltar sus guardas. Clústeres conservados y detenidos. No ejecutar activar/completar-estructura ni scripts antiguos de carga sobre el QA poblado. Para las futuras pruebas Auth/Storage se preparó la pareja independiente `qa-publicado-b8/servidor.py` y `qa-publicado-b8/vite.config.mjs`, con manifiesto de 98 fuentes del SHA publicado. No se iniciaron servicios. No arrancar usando el .env municipal. Cualquier borrado/reinicio del clúster poblado requiere alcance y ruta explícitos.

## Respaldo, revisión y reversión antes de publicar

1. Selección autorizada ya publicada: c5ebc7c de 44 archivos; b8c9a0d de tres archivos de corrección de tests. Nueve pendientes 112A y artefactos privados QA excluidos. Índice vacío; documentación actualizada localmente sin otro commit. No rehacer ni ampliar la selección sin revisar su alcance.
2. CI Docker/PostgreSQL 16 ya aprobado, incluido 109D6. Faltan Auth QA, Storage QA, correo/invitación consentidos y ciclo en Preview QA independiente. El Preview municipal actual solo admite pruebas de lectura; Figma local y lectura JEFE se conservan sin repetir pruebas aprobadas.
3. Operador autorizado: respaldo privado consistente de PostgreSQL (esquema/datos/permisos), archivos Storage y metadatos Auth necesarios, con prueba de restauración aislada. No guardar backups/contraseñas en Git ni compartirlos por chat. No exportar ni restaurar identidades por SQL improvisado.
4. Revisar por separado el SQL 04/05 y la configuración externa. Antes de cualquier prueba publicada, determinar si Preview comparte DB/Auth/Storage municipales; en tal caso, limitarse a lectura.
5. Integración preparada, no ejecutada: origen b8c9a0d, destino main c074ce3d840f90eb4487d27c516fa2a9c9bba468. main es antecesor (70 commits ahead/0 behind), por lo que no hay divergencia que resolver en esta comparación. Antes de aprobar PR/merge: revalidar refs, diff completo, CI del candidato efectivo, QA externo, respaldo y configuración pública Production de ambos proyectos. Un cambio futuro de SHA invalida esta autorización por candidato. **Merge a main activa los dos proyectos Production automáticamente**: requiere autorización conjunta de integración y despliegue; no tratarlo como operación aislada de Git.
6. Reversión de código preparada: conservar el par Production actualmente Ready de c074ce3 (tabla siguiente). Solo con autorización, revertir ambos proyectos al par compatible mediante Vercel y verificar salud/login/lecturas. Una promoción/restauración de código no restaura variables ni datos. Conservar cola, auditoría, archivos, cierres e historial. No usar reset/force-push, DROP ni migraciones inversas para simular rollback; reconciliar Git mediante PR revisado. Restaurar PostgreSQL, Auth o Storage requiere respaldo privado, ensayo aislado y autorización independientes.

Decisión actual: **NO APTO PARA MAIN**. El núcleo local/CI y el Preview de lectura aprobaron; faltan validaciones externas críticas y autorización para Production. Brevo, adjuntos e invitaciones pueden permanecer deshabilitados sin impedir el núcleo, pero sus hitos originales E04/E08/E10 y la aceptación P03 no se consideran completados por deshabilitarlos.

Restauración comprobada el 23/11: copia consistente del QA ficticio PG18 `127.0.0.1:55439` a un clúster nuevo en `127.0.0.1:55441`, directorio exclusivo. Coinciden hashes de diez tablas, identidades simuladas, 22 políticas, funciones, índices, secuencia y tres archivos locales; permisos de conexión de la base verificados por separado. Origen sin cambios y ambos clústeres detenidos. Evidencias privadas: `restauracion-ficticia-112f.json` y `restauracion-ficticia-parada-112f.json`. El dump y los archivos se conservan fuera del repositorio. No equivale a restaurar Supabase Auth/Storage ni acredita un respaldo municipal.

Vercel se reconfirmó únicamente en lectura el 23/11: ambos Preview Ready en b8c9a0d y Production asociada a main, sin cambios observados de rama ni despliegue productivo. No se abrió ninguna clave ni se modificaron variables. La comparación no certifica hashes de secretos productivos no leídos. Se conservan las comprobaciones de salud/CORS/login JEFE ya aprobadas del alias operativo, sin volver a ejecutarlas.

### Registro histórico de la preparación del 24/11 publicado por la compañera

## Supabase QA independiente — actualización del 24/11

Proyecto QA confirmado el 24/11/2026: **soporte-ti-grocio-qa-2**, [URL pública](https://vmtvttlmnqcucotskceh.supabase.co). Se aplicaron las migraciones 01–05 y se verificaron diez tablas con RLS. El bucket privado `incidencias-qa` admite PDF/JPEG/PNG de hasta 5 MB y tiene la política restrictiva `qa112f_solo_backend`. Se vincularon seis identidades ficticias con sus perfiles en dos áreas. El rol restringido `soporte_ti_api` se conectó con su credencial privada y comprobó el ciclo de la cola en una transacción que se revirtió. El frontend Preview actual usa Auth municipal. Usar el QA independiente para las pruebas con escrituras.

Ese registro conserva su alcance histórico; las seis identidades anteriores siguen excluidas por decisión del operador. La lectura vigente acreditó NOLOGIN y seis cuentas nuevas pendientes vinculadas. No repetir instalación ni acreditar login/entrega por ese registro.

| Uso | Frontend | Backend | SHA |
|---|---|---|---|
| Candidato Preview | `7LxGLHEdqB9J6a1MEHSkwvJuBzvu` · `soporte-ti-grocio-prado-g2pcasyvh.vercel.app` | `5RLr5eX98TNNMqrFMRby2qc9ZmMn` · `soporte-ti-grocio-prado-i07z58kov.vercel.app` | b8c9a0d056bb48e56d878491d5ea30191c14fcf2 |
| Production conservada / referencia de reversión | `7uRjjdtPwqiQjE7mzZnfxhAXh4mR` · `soporte-ti-grocio-prado-b471bn3ih.vercel.app` | `AGte9vQo5pUgfPrGRkiSGNz8rAXA` · `soporte-ti-grocio-prado-6kj0prk4j.vercel.app` | c074ce3d840f90eb4487d27c516fa2a9c9bba468 |

Las referencias productivas conservan el comportamiento anterior; no se presentan como aceptación funcional de las ampliaciones b8. La restauración ficticia PG18 anterior sigue válida dentro de su alcance y no se repite. GitHub informa `protected=false` para main y no hay PR abierto de ajustes-docente-v4 a main; no se creó ninguno ni se cambió protección. Usar revisión y aprobación expresas, sin auto-merge. Se preparó fuera de Git `integracion-main-b8-revision.patch` con los **120 archivos** de diferencia del candidato completo frente a main (no confundir con los 44 del último inventario selectivo).

## Supabase QA2 independiente — preparación vigente tras el error 42501

Destino confirmado en el dashboard **y en Connect**, sin copiar claves: **soporte-ti-grocio-qa-2**, referencia **vmtvttlmnqcucotskceh**, [URL pública](https://vmtvttlmnqcucotskceh.supabase.co), host directo oficial **db.vmtvttlmnqcucotskceh.supabase.co:5432**, base postgres. Tras el fallo 42501 informado por el operador, Codex ejecutó exclusivamente una transacción READ ONLY con ROLLBACK en el SQL Editor de ese proyecto: PostgreSQL 17.12, operador postgres sin superusuario, CREATE de esquemas y CREATEROLE disponibles, cero tablas públicas, identidades Auth, buckets y objetos; rol soporte_ti_api ausente, marca anterior NULL y esquema qa_control ausente. Estos resultados acreditan que el bootstrap fallido no dejó sus cambios persistentes. Evidencias privadas: `qa2-rollback-42501.json` y `qa2-vmtvttlmnqcucotskceh-b8/rollback-42501.jpg`. No se reintentó ALTER DATABASE ni se elevaron privilegios. Email y Confirm email habilitados según el operador; Site URL observado anteriormente http://localhost:3000, sin Redirect URLs. No se revelaron claves ni se modificó configuración. El QA anterior sygfauunjvhaoyczdhuu queda histórico; no usarlo ni usar los otros proyectos.

Paquete operativo privado nuevo, fuera de Git: `C:/Users/sebas/.codex/visualizations/2026/11/16/01a1e23e-e9c4-75c0-9e26-d846aa1605ce/112c-qa/entorno-integral-3fe2186/qa2-control-v1-b8/`. Contiene preflight, verificador de fuentes, servidor, configuración Vite, helper PowerShell y SQL. Candidato **qa2-control-privado-v1**, base b8c9a0d, con 100 fuentes y 16 utilidades/SQL verificadas por hash; las modificaciones locales de herramientas QA no heredan la aprobación CI del SHA publicado. Las cinco migraciones siguen siendo copias byte a byte de sus originales. Bootstrap, perfiles y política conservan v_aplicar=false. **14 pruebas offline aprobadas**, análisis SQL/PLpgSQL y sintaxis Vite/PowerShell válidos; ninguna de estas pruebas conecta ni escribe en una base. Los 17 puntos de entrada antiguos incompatibles se retiraron con fallo inmediato; sus originales y hashes se archivaron fuera de Git en historico-guc-42501-retirado.json. No ejecutar el antiguo 00b_aplicar_manual_revisado.sql. La evidencia histórica y las pruebas nativas anteriores se conservan, pero no son el recorrido activo Supabase QA2.

La nueva marca es **qa_control.entorno**: esquema y tabla de postgres, una fila de metadatos QA2, RLS habilitada y una política SELECT para soporte_ti_api. Ese rol solo recibe USAGE/SELECT en el control; PUBLIC, anon, authenticated y service_role no reciben acceso al control. No se cambian parámetros del servidor ni políticas municipales. El marcador es secundario: el preflight exige además URL fija QA2, DSN oficial del proyecto, TLS verify-full, host/usuario/base/puerto reales del driver y sesión READ ONLY. Una referencia escrita manualmente no acredita el destino por sí sola. El propietario postgres puede administrar su propia tabla; esto no es una barrera contra un administrador malintencionado.

El nuevo proyecto evita depender de instalar Docker/Podman en Windows. No se instaló software ni se iniciaron servicios locales o remotos durante esta preparación.

La API conserva un máximo de **4.000.000 bytes**; el bucket QA permite hasta 5 MB y solo PDF/JPEG/PNG. La carga y el selector usan la intersección efectiva de los límites/formatos del bucket: WebP no se ofrece ni se sube allí. La descarga anterior autorizada permanece disponible. El backend ahora respeta `sslmode=verify-full`/`verify-ca` indicados en la URL, conserva `require` como valor anterior por defecto y oculta parámetros de errores SQL.

### Orden de preparación manual (sin producción)

1. Abrir **QA2 vmtvttlmnqcucotskceh** y cotejar nombre, host oficial de Connect y marca privada antes de una conexión. Los seis perfiles nuevos ya están vinculados; no repetir altas ni modificar los seis anteriores.
2. El rol soporte_ti_api permanece **NOLOGIN**. Preparar credencial nueva mediante psql privado con `\password soporte_ti_api`; no usar la credencial anterior desconocida. Habilitar LOGIN solo tras autorización específica del SQL revisado y validación de destino, atributos restrictivos y preservación de filas.
3. Las diez tablas y 22 políticas coinciden con 01–05. **No ejecutar nuevamente migraciones ni bootstrap 00b**. Conservar el esquema adoptado y verificar los SHA de los originales, sin volver a instalarlos.
4. El control vigente es **qa_control.entorno**, con RLS y permisos SELECT restringidos. El comentario grocio.qa_project de public.areas, propuesto en una preparación anterior, no sustituye este control ni acredita el destino. Verificar también URL/DSN reales, TLS verify-full e identidad del driver.
5. Crear seis identidades **nuevas de pruebas**, con buzones controlados/consentidos y datos de perfil ficticios, mediante Supabase Authentication o su API Admin. Mantener confirmación de correo activa. No usar los UUID del simulador local, no copiar identidades municipales ni insertar/actualizar `auth.users` mediante SQL. Si no hay buzones/SMTP autorizados, detener esta parte; no simular su confirmación.
6. Revisar la copia QA2 `sql/112f_perfiles_ficticios_revision.sql`. Completar **solo en la sesión privada** `v_ids` con los seis UUID reales de Auth QA2 y los alias preparados; no usar UUID simulados. Primero false, después true exclusivamente con autorización: inserta faltantes, rechaza perfiles diferentes y no sobrescribe un JEFE. Esperados: dos áreas ficticias y seis perfiles, roles JEFE=1, REPRESENTANTE=2, ASISTENTE=2, PRACTICANTE=1; segundo REPRESENTANTE en QA Área B, restantes en QA Área A.
7. Crear manualmente, solo con autorización, el bucket **incidencias-qa**, privado, 5 MB, PDF/JPEG/PNG. Revisar la copia QA2 `sql/112f_storage_privado_revision.sql`: false primero, true autorizado después. Exige límites entre 4.000.000 y 5.242.880 bytes, formatos exactos y RLS activa; añade la política restrictiva de anon/authenticated. No crea bucket/archivos ni altera otros buckets. No añadir políticas de propietario que salten los permisos de FastAPI.
8. Para enlaces de correo Auth en QA, el operador debe revisar/configurar Site URL y Redirect URL exactas `http://127.0.0.1:5174/`, SMTP y plantillas compatibles. El valor actual localhost:3000 no corresponde al frontend QA preparado. No aplicar estos valores al proyecto municipal ni habilitar recuperación hasta comprobar los enlaces. No se cambió esa configuración en esta revisión.

Las políticas públicas existentes del sistema permiten operaciones al **rol servidor restringido**, no a clientes Supabase; la autorización de los cuatro perfiles se aplica en FastAPI. El navegador no recibe `service_role`. Para Storage, la credencial del servidor evita las políticas de cliente según la [arquitectura oficial de Supabase](https://supabase.com/docs/guides/storage/security/access-control); por ello deben probarse los rechazos reales de FastAPI y también los accesos directos sin credencial administrativa. «Bucket privado» por sí solo no acredita aislamiento por área.

### Paquete de migraciones QA2 preparado, no autorizado

Fuera de Git, en la raíz privada de evidencias: qa2-migraciones-01-05-revision.sql y qa2-migraciones-plan.json. Conserva los cinco archivos originales intactos y cotejados por SHA256; el paquete integra sus cuerpos en el mismo orden y sustituye exclusivamente sus BEGIN/COMMIT individuales por una sola transacción. La guarda inicial, cerrada con v_aplicar=false, aborta antes de DDL. No ejecutar ahora. Con autorización independiente y destino externo cotejado, exige primero la marca privada/rol válidos y QA2 sin tablas públicas, identidades ni Storage. Antes del COMMIT comprueba diez tablas con RLS, 22 políticas públicas exclusivas del rol API, ciclos, índices únicos y los dos triggers. La comprobación posterior separada es qa2-migraciones-verificar-solo-lectura.sql. Análisis SQL/PLpgSQL aprobado localmente; **ninguna migración ejecutada en QA2**.

| Orden | Alcance y riesgo |
| --- | --- |
| 01 | Ocho tablas, secuencia, restricciones, dos triggers y RLS cerrada; instalación única sobre QA vacío. |
| 02 | SELECT/INSERT/UPDATE necesarios y 16 políticas para el rol servidor; el aislamiento de perfiles/áreas se verifica en FastAPI. |
| 03 | Columnas de ciclo y unicidad de verificación por incidencia/ciclo; reemplaza un índice. No cambia la reapertura automática V4 del backend. |
| 04 | Permisos de columnas/políticas para administrar perfiles; no activa la bandera de administración ni modifica identidades. |
| 05 | Cola y auditoría, cuatro políticas adicionales y UPDATE(id) de áreas para FOR UPDATE del trigger; no envía correos. |

Reversión: un error antes del COMMIT revierte conjuntamente las cinco migraciones. Conservar primero las evidencias 00c del bootstrap y el paquete/hash aplicado. Si se detecta una diferencia después de COMMIT, detenerse: no borrar objetos ni eliminar columnas/ciclos automáticamente. Restauración o limpieza exclusivamente QA2 requiere nueva autorización y comprobar que aún no hay datos; el rollback no implica modificar Auth/Storage ni producción. Antes de cargar fixtures se revisará el esquema real y los permisos efectivos del rol servidor. No se ha ensayado la instalación remota y no se presenta el análisis estático como prueba de aplicación.

### Brevo y correo: preparación obligatoria pendiente

Se mantienen dos vías: **notificaciones** por API HTTPS de Brevo y worker explícito; **confirmación, recuperación e invitaciones** por Supabase Auth usando SMTP Brevo. Las credenciales son distintas. Configuración manual futura, solo QA2: Authentication → Emails → SMTP Settings; host smtp-relay.brevo.com, puerto 587 con STARTTLS, login exacto que indique la pestaña SMTP de Brevo y clave SMTP introducida privadamente. El remitente debe estar verificado y autorizado; revisar autenticación del dominio y límites de la cuenta. La clave API para BREVO_API_KEY queda únicamente en el proceso backend/worker privado, nunca en VITE ni en SQL. Referencias: [Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [SMTP Auth de Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

Bloqueos actuales: no se acreditaron una clave API/SMTP QA disponible, remitente/dominio autorizado, buzones QA consentidos ni recepción real. El lanzador QA mantiene Brevo, SMTP e invitaciones desactivados; el frontend QA mantiene recuperación desactivada. Preparar su habilitación específica en un proceso QA requiere otra revisión/autorización después de validar SMTP y redirects exactos. No basta poner una bandera en true. Debe comprobarse recepción y activación sobre el UUID esperado, recuperación con enlace válido/expirado/usado y notificaciones desde eventos QA con corte temporal explícito. No enviar mientras falte consentimiento de destinatarios. Un sandbox aceptado o HTTP 201 no acredita recepción. Falta además ensayar la ejecución/monitoreo del worker fuera de peticiones serverless y tratar estados inciertos sin reenvío ciego.

CI local: las nuevas pruebas de la guarda SQL usan pglast; se añadió a backend/requirements-test.txt para instalarlo **antes** de unittest en Verificar backend. No se cambia requirements.txt productivo. No se repiten ni se invalidan los 10 workflows aprobados para b8; las modificaciones QA locales necesitan CI propio si se decide publicarlas.

### Credenciales privadas y preflight (PowerShell del operador)

Utilizar una ventana privada, fuera del control de Codex, sin pantalla compartida/transcripción. Los valores se introducen con entrada oculta; permanecen temporalmente en memoria/entorno de ese proceso. No prometer borrado de todas las copias en RAM: cerrar la ventana al terminar. No usar `setx`, no guardar `.env.qa`, no pasar secretos como argumentos y no mostrar el entorno con Get-ChildItem.

Ruta mínima: revisar/completar el orden de preparación anterior; abrir PowerShell privado y ejecutar este único helper, que solicita los tres valores ocultos y llama a `configuracion` y `verificar`. **No lo ejecutó Codex.** No crea esquema/usuarios ni inicia servidores. Si falta preparación, se detiene con un mensaje no sensible; no debe forzarse para continuar.

```powershell
& 'C:\Users\sebas\.codex\visualizations\2026\11\16\01a1e23e-e9c4-75c0-9e26-d846aa1605ce\112c-qa\entorno-integral-3fe2186\qa2-control-v1-b8\configurar_privado.ps1'
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
& $qaPython -B "$qaRoot\qa2-control-v1-b8\preflight.py" configuracion
if ($LASTEXITCODE -ne 0) { throw 'Detener: configuración QA no válida' }
& $qaPython -B "$qaRoot\qa2-control-v1-b8\preflight.py" verificar
if ($LASTEXITCODE -ne 0) { throw 'Detener: QA todavía no preparado' }
```

El DSN debe usar `postgresql+psycopg`, base `postgres`, rol `soporte_ti_api`, host directo `db.vmtvttlmnqcucotskceh.supabase.co:5432` o el pooler oficial de Connect QA2 con usuario `soporte_ti_api.vmtvttlmnqcucotskceh`, y `sslmode=verify-full`. Preparar el certificado raíz oficial privado si se exige y referenciarlo con sslrootcert; no reducir TLS. El preflight privado QA2 rechaza superusuario, QA anterior, proyecto municipal, otros proyectos y opciones arbitrarias; solo lee GROCIO_QA_* y no lee .env. Los valores nunca se imprimen ni se guardan en archivos.

`configuracion` no conecta. `verificar` hace únicamente GET a Auth/JWKS/bucket y SELECT en PostgreSQL en transacción de solo lectura: comprueba identidad/marca, rol sin privilegios excesivos ni membresías que permitan asumir otros roles, diez tablas con RLS, acceso directo cerrado, política Storage y seis perfiles ficticios. Imprime únicamente resultados no sensibles. No crea esquema, perfiles, mensajes ni objetos. Para ejecutar esta comprobación todavía hace falta la conexión privada del rol.

Preparados fuera de Git, sin secretos:

- `$qaRoot\qa2-control-v1-b8\servidor.py --autorizar-qa-ficticio`: verifica rama/SHA base y candidato local, 100 fuentes y 16 herramientas/SQL, ejecuta preflight privado QA2, limpia entorno heredado y fija FastAPI en `127.0.0.1:8874`; usa Auth/JWT reales, sin simulación. **No iniciado**. No depende del controlador histórico. Brevo, invitaciones y administración siguen apagados. Detener con Ctrl+C y cerrar la ventana privada.
- `$qaRoot\qa2-control-v1-b8\vite.config.mjs`: frontend b8 con herramientas QA locales verificadas, API solo `http://127.0.0.1:8874`, Auth solo QA2, sin .env/autodetección VITE. Desde frontend: `npm exec -- vite --config <ruta privada completa>`. Utilizar otra ventana con solo GROCIO_QA_PUBLIC_KEY y URL pública: rechaza secretos/DSN heredados. Sirve solo en `127.0.0.1:5174`; recuperación deshabilitada hasta validar SMTP/redirects consentidos. **No iniciado ni compilado con credenciales reales**. Cambiar SHA/proyecto exige revisar manifiesto/guardas.

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

### Integración de código del 26/11/2026

El candidato conserva los commits remotos de ambas integrantes, incluido `d534044`, y añade el alcance opcional del worker y los controles de lectura QA2 que estaban locales. `qa-hitos` permanece separado: su build del frontend con escrituras QA habilitadas y su configuración de Vercel no se trasladan a los proyectos municipales. No se incorporan claves, certificados, conexiones privadas, respaldos ni los nueve archivos locales 112A pendientes.

Esta integración no ejecuta SQL ni migra automáticamente la base. La migración `06_acciones_administracion.sql` es manual, requiere revisión/autorización independiente y no se aplica como parte del merge. Brevo, adjuntos y administración mantienen sus bloqueos por configuración y permisos; no se activan para publicar código. Las pruebas reales de correo, Auth/Storage, invitaciones y dos ciclos en Preview QA siguen pendientes: el merge no acredita esos hitos.

Vercel está conectado a `main` como rama Production en ambos proyectos municipales y asigna sus dominios automáticamente. Por ello, la aprobación final debe incluir ese despliegue. Las variables existentes no se sustituyen por valores QA2. El frontend Production no tenía variables configuradas durante esta revisión: el modo real sigue requiriendo configuración explícita y no se declara validado allí.

Reversión de código: conservar `c074ce3d840f90eb4487d27c516fa2a9c9bba468` y el despliegue Production anterior de cada proyecto. Ante una regresión, restaurar ambos despliegues anteriores o crear un revert del merge (`git revert -m 1 <SHA_DEL_MERGE>`) y revisar CI; no usar reset ni force push. Revertir código no revierte datos. Cualquier respaldo/restauración municipal de PostgreSQL requiere su autorización independiente; el bundle de Git y el respaldo de archivos locales no sustituyen ese respaldo.
