# Fase 110G1 — Diagnóstico externo de Vercel y API

Proyecto: Sistema de Gestión de Incidencias — Municipalidad Distrital de Grocio Prado (Grupo 4).
Entrega objetivo: lunes 16/11/2026. Rama: `ajustes-docente-v4`.

## Instalación

1. Subir `.github/scripts/verificar_despliegue_110g.py` en su ruta exacta dentro de la rama `ajustes-docente-v4`.
2. Subir `.github/workflows/verificar-despliegue-110g.yml` en su ruta exacta dentro de la misma rama.
3. Ir a **GitHub > Actions > 110G1 - Validar despliegue Vercel y API** y abrir la ejecución (o pulsar **Run workflow**, seleccionar la rama de trabajo).
4. Leer el resumen de checks. Descargar el artifact `evidencia-110g1-despliegue` si se necesita el registro.
5. Si algún control falla, **no** modificar las pruebas para forzar verde: corregir Vercel/variables/despliegue y ejecutar de nuevo.

## URLs esperadas

- Frontend: `https://soporte-ti-grocio-prado.vercel.app`
- Backend: `https://soporte-ti-grocio-prado-api.vercel.app`

Si cambiaron, crear variables (no secretos) en GitHub > Settings > Secrets and variables > Actions > Variables:
`FRONTEND_PUBLICO`, `API_PUBLICA`. No publicar contraseñas ni cadenas de conexión.

## Controles automáticos

- Frontend servido como HTML React
- API `/api/health` devuelve 200 y JSON operativo
- PostgreSQL indica `conectada`
- `/api/me` y `/api/incidencias` devuelven 401 sin token
- CORS permite exactamente el origen del frontend declarado y rechaza un origen ajeno

Todo se hace sin acceso autenticado ni POST de datos, sin escrituras y sin migraciones.

## Interpretar fallas

- Frontend responde 401/403 o redirige a login de Vercel: Deployment Protection o URL distinta.
- `API /api/health` devuelve 404/HTML: revisar proyecto, Root Directory, build y rutas FastAPI.
- `base_datos=no_configurada`: falta `DATABASE_URL` en proyecto Backend de Vercel.
- `base_datos=no_disponible`: revisar credenciales/pooler/red sin compartir el valor de la URL.
- `CORS` falla: `FRONTEND_URL` del backend no coincide con origen exacto (incluido https y sin slash final).
- Endpoints no devuelven 401 anónimo: revisar autorización antes de pruebas reales.

## Una vez aprobado 110G1

La fase 110G2 debe probar MANUALMENTE en un **preview** de prueba (no usar credenciales reales en chats):

- Frontend en modo real: `VITE_MODO_REAL=true`; `VITE_API_BASE_URL` debe ser la URL del backend **sin /api**; `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` públicos correctos.
- Backend con `SUPABASE_URL`, `DATABASE_URL`, `FRONTEND_URL` correctos para el preview de pruebas.
- Autenticación con cuentas habilitadas de cuatro roles; acceso denegado cruzado, cierre de sesión, expiración y refresh.
- Solo en base de datos de pruebas y con aprobación: registro -> asignación -> intervención -> cierre -> verificación/reapertura V4.
- Probar página móvil/desktop y capturar evidencia por rol. Escribir datos solo con flags habilitados en entorno autorizado.

**No modificar `main`, no reejecutar `01_esquema_mvp.sql`, no activar escrituras reales ni marcar entrega final solo por CI verde.**
