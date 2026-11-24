# 112C/112D — Validación funcional QA local

19 de noviembre de 2026 (America/Lima). Rama `ajustes-docente-v4`; HEAD base `3fe2186f9655dd4847e37864ef5033222b5fabd8`. Cambios locales sin publicar. No se declara cerrado el proyecto ni certificada la autenticación real.

## Implementación y alcance

- Lecturas ASISTENTE/PRACTICANTE limitadas desde FastAPI: casos libres para autotoma, asignaciones propias actuales/históricas y cierres propios. El JEFE conserva la consulta general; REPRESENTANTE, su área. Se restringen listado, indicadores, detalle, historial, intervenciones V3/V4, evaluaciones y contextos. Los informes técnicos de participantes conservan su autorización anterior. No cambia la política de escritura ni la asignación de roles.
- Antes de limpiar los campos de cierre en una observación V4, se agrega `CIERRE_PRESERVADO` con ciclo, fecha y autor originales existentes y actor de la conservación. Comparte transacción y bloqueo con la observación/reapertura; si faltan los datos del cierre, responde 409 y revierte. No fabrica un evento CIERRE antiguo, no elimina historia ni introduce reapertura manual. No requiere migración ni cambios de RLS.
- El historial frontend presenta ese evento como «Cierre anterior conservado». Se actualizan regresiones y cuatro fixtures de CI para la nueva restricción de lectura, añadiendo casos negativos.

Archivos de aplicación: `backend/app/lecturas_incidencias.py`; rutas `contexto_atencion.py`, `incidencias.py`, `intervenciones.py`, `operaciones_ti.py`, `v4_intervenciones.py`, `v4_verificaciones.py`, `verificaciones.py`; `frontend/src/RealTicketDetail.tsx`, `frontend/src/tiOperations.ts`.

Pruebas: `backend/tests/test_diagnostico_112c.py`, `frontend/tests/ti-operations.test.mjs`, `.github/scripts/probar_funcional_112c.py`, `.github/workflows/verificar-backend.yml`. Este informe es el único archivo nuevo de esta entrega dentro del repositorio. Los nueve pendientes de 112A permanecen separados y sin modificar.

## Resultados

| Comprobación | Resultado y evidencia |
| --- | --- |
| Backend | 31/31 aprobadas; 28 versionadas y 3 del archivo local previo 112A. SQLite/mocks, sin servicios externos. |
| Frontend | 27/27 aprobadas, incluida presentación del cierre conservado. |
| TypeScript/Vite | `npm run build -- --config <config QA privado>` aprobado; Node 24.21.0, Vite 7.3.8; destinos exclusivamente loopback. No certifica todavía Node 22 del CI remoto. |
| Contratos de workflows locales | 21 bloques Python aprobados; 7 que requieren Docker omitidos explícitamente. Cuatro fixtures antiguos fallaron inicialmente y pasaron después de adaptarlos a la política aprobada; no se relajaron permisos. |
| Preentrega 110F | 28 comprobaciones aprobadas: contratos, autenticación ausente, CORS exacto y banderas productivas deshabilitadas por defecto. |
| PostgreSQL adicional | 9/9 grupos aprobados, 87 solicitudes HTTP: preservación de legado, dos ciclos, rollback deliberado, observación concurrente 201/409, permisos y exportaciones. |
| Reportes | FastAPI devuelve 403 a REPRESENTANTE/ASISTENTE/PRACTICANTE para catálogos, consulta, PDF y Excel. Seis filtros contrastados con SQL, totales y páginas; PDF/XLSX auténticos con registros coincidentes y archivos vacíos válidos. |
| Volumen | 5.001 filas ficticias: 51 páginas de 100, última con una fila; exportaciones rechazadas con 422 sin truncar. Excel de exactamente 5.000 filas aprobado. Filas temporales retiradas exclusivamente de QA. |
| Interfaz y responsive | 14 muestras a 1440/768/390 px, sin desbordamiento del documento; tablas con desplazamiento interno y cabeceras. Filtros, teclado y foco visibles. Cuenta con tarjetas de igual altura en escritorio; apiladas en móvil. Consola: 0 advertencias/errores capturados. No es auditoría WCAG completa. |
| PRACTICANTE | Menú restringido; Mis atenciones vacío correcto; caso ajeno ausente; informe técnico de su participación histórica accesible. Permisos negativos cubiertos también en API. |
| Dependencias y Git | `pip check` y `git diff --check` aprobados; sin coincidencias de secretos en el escaneo de adiciones revisadas. Sin archivos de respaldo, credenciales o artefactos QA nuevos en el repositorio. Índice Git vacío. |

La suite inicial previa 29/29 se conserva como evidencia de su ejecución sobre el HEAD base, sin repetir cargas ni presentarla como nueva ejecución sobre el candidato. Cubre sugerencias, prioridad provisional/confirmación con actor/fecha/ciclo, JEFE atendiendo directamente, restricciones PRACTICANTE, autotoma/prioridad concurrentes, perfiles deshabilitados, SQL/RLS y sesiones simuladas. La regresión PostgreSQL versionada actualizada se conserva para futuras ejecuciones en su clúster específico; no se ejecutó contra este QA porque exige otra marca/usuario de servidor.

## Circuito completo desde la interfaz real

Incidencia **ficticia** `INC-2026-005018`, creada en QA mediante el formulario A–D. Persistieron área/reportante de la sesión, categoría, equipo, ubicación, inicio `2026-11-18 09:30`, impacto `Si`, código y fecha del servidor. Adjuntos permanecen deshabilitados con explicación.

REPRESENTANTE registra → JEFE confirma Alta con justificación y asigna → ASISTENTE documenta solución y cierra ciclo 1 → REPRESENTANTE observa → V4 conserva el cierre y reabre ciclo 2 → ASISTENTE realiza AUTOTOMA, segunda solución y cierre → REPRESENTANTE registra Conformidad.

Verificación SQL/HTTP final: **2 asignaciones, 2 intervenciones finales, 2 verificaciones, 12 eventos**; dos CIERRE con sus ciclos y autores, un CIERRE_PRESERVADO y una AUTOTOMA del ciclo 2. Permanece Cerrado, prioridad oficial Alta; no se introduce propuesta provisional cuando ya existe prioridad oficial. PDF y Excel descargados desde la pantalla incluyen solamente este caso al aplicar fecha/área/estado/prioridad/responsable. Totales generales finales: **16 incidencias: 3 pendientes, 6 en revisión, 7 cerradas**, coincidentes con PostgreSQL. Los indicadores técnicos siguen el alcance restringido de cada usuario.

## Seguridad y evidencias

QA exclusivo `127.0.0.1:55439`, base `qa_112c_integral`, PostgreSQL 18.7, marca `112c_integral_activo_v1`, directorio independiente `entorno-integral-3fe2186/data`. Identidad, ruta, puertos, conexiones loopback y hashes de fuentes/infraestructura se verificaron antes de las escrituras. Ocho tablas con RLS y 16 políticas; rol API sin superusuario, BYPASSRLS, creación de roles/bases ni herencia. Solo lectura por defecto; las sesiones QA autorizadas habilitan escritura después de verificar identidad. Red externa bloqueada en el servidor QA y sin archivos .env/credenciales reales. FastAPI/frontend locales en `127.0.0.1:8872`.

La identidad se simula exclusivamente en la dependencia `get_identity`; los perfiles, autorizaciones, restricciones, SQL y transacciones son los del sistema sobre PostgreSQL QA. No prueba Supabase Auth real, JWT/JWKS, MFA, cambio/recuperación de contraseña o correo SMTP.

Artefactos fuera de Git, en:
`C:/Users/sebas/.codex/visualizations/2026/11/16/01a1e23e-e9c4-75c0-9e26-d846aa1605ce/112c-qa/entorno-integral-3fe2186/`

- `resultados-112d.json`, `ciclo-interfaz-verificado-112d.json`, `evidencia-final-112d.json`, `responsive-interfaz-112d.json`.
- `pruebas-backend-112d.log`, `pruebas-frontend-112d.log`, `pruebas-workflows-112d.log`, `pruebas-preentrega-112d.log`.
- `interfaz-ciclo-completo-112d.txt/.png`, `reportes-filtrados-desktop-112d.png`, `reportes-filtrados-mobile-112d.png`, `practicante-informe-tecnico-112d.png`.
- `reporte-interfaz-ciclo-112d.pdf/.xlsx`, `reporte-filtrado-112d.pdf/.xlsx`; manifiestos con hashes y evidencia de parada `estado-detenido-112d.json`.

Los servicios web/PG QA se detienen al finalizar, conservando fixtures y evidencia (2 áreas, 6 perfiles, 16 incidencias, 77 eventos). Producción, Supabase, main, variables y banderas vigentes no fueron modificados. No hubo commit, push ni despliegue.

## Bloqueos y siguiente etapa mínima

1. **Docker/109D6:** los siete bloques originales requieren Docker, Bash y PostgreSQL 16. 109D6 requiere puerto 55435 libre, tablas/roles ficticios del workflow, detector V3, migración 03 en base temporal y pruebas de atomicidad/rollback. No se activó ni sustituyó por cambiar su comportamiento. La cobertura local PG18 es adicional, no certificación de esos workflows. Ejecutarlos en un runner aislado autorizado antes de publicación.
2. **Auth QA real:** preparar una instancia independiente autorizada, sin reutilizar sesiones/cuentas municipales. Validar JWT/JWKS, renovación/revocación y reautenticación. El cambio de contraseña del sistema tiene pruebas simuladas; no se ejecutó contra Auth real.
3. **Brevo y recuperación:** no existe servicio de notificaciones reutilizable ni integración Brevo. La invitación backend actual usa Supabase Auth Admin y se mantiene bloqueada por configuración. Definir eventos/plantillas, cola con reintentos e idempotencia, correo de prueba y remitente/dominio verificado; después configurar secretos solo en servidor con autorización separada. La recuperación necesita formulario real, callback de tipo recovery, redirecciones exactas y enlaces de un solo uso/expiración; el callback actual cubre invitaciones, no certifica recovery. No se envió correo ni se abrió una clave real.
4. **Adjuntos/administración:** tabla de metadatos existente, pero falta almacenamiento privado, autorización por incidencia, validación de tipos/tamaño y descarga segura. Directorio JEFE e invitación/edición protegidas existen; alta/administración completa siguen condicionadas a configuración privada y pruebas Auth independientes. No habilitar por apariencia del botón.
5. **Legado:** el nuevo evento protege futuras reaperturas que todavía tengan fecha/autor de cierre. No reconstruye valores ya perdidos por reaperturas anteriores; requieren inventario de lectura y recuperación desde evidencia auténtica aprobada. No inventar autores/fechas ni ejecutar reparación masiva.
6. **Revisión/publicación:** revisar estos 14 cambios funcionales/pruebas y este informe, ejecutar pendientes de entorno, autorizar commit selectivo y Preview por separado. Una integración posterior a main/Production requiere nueva autorización; no forma parte de esta etapa.
