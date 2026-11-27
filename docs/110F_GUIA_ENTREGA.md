# 110F — Auditoría y preparación de entrega

**Proyecto:** Sistema de Gestión y Seguimiento de Incidencias de Soporte TI — Municipalidad Distrital de Grocio Prado (2026).

**Fecha de revisión inicial:** 13/11/2026. **Entrega objetivo:** lunes 16/11/2026.

## Estado sustentado en GitHub

- Rama de trabajo: `ajustes-docente-v4`, punto seguro revisado `350a71b`.
- Rama `main`: `c074ce3` (sin cambios al momento de la revisión).
- Fase 110E: 43 comprobaciones de API con PostgreSQL temporal y compilación React aprobadas.
- La aprobación de CI **no** equivale a una prueba manual del navegador ni a validar Vercel/Supabase real.

## Riesgos críticos detectados

1. `frontend/src/main.tsx` inicia por defecto en **modo demostración**. Para probar la interfaz real en un preview autorizado se requiere `VITE_MODO_REAL=true` en ese despliegue; mantener el modo demo si el objetivo es solo mostrar el prototipo.
2. No se observa `vercel.json` ni otro manifiesto de despliegue en la rama auditada. Esto **no** demuestra que Vercel esté mal configurado: la configuración puede residir en el proyecto de Vercel. Es necesario verificar el directorio raíz, comando y URL en Vercel.
3. En CI se simula la identidad de los usuarios y se usa PostgreSQL temporal: no se ha probado un acceso real con Supabase Auth/JWKS y usuarios habilitados.
4. La API admite por CORS únicamente el valor exacto configurado en `FRONTEND_URL`. El dominio del preview debe coincidir, incluido esquema (`https://`) y sin `/` final.
5. Las escrituras de la interfaz real dependen de banderas de compilación. **No activarlas en producción ni sobre la base real sin ambiente de pruebas aprobado.**
6. El repositorio no contiene `frontend/.env.example`. Se recomienda documentar variables públicas sin publicar claves privadas. No subir `.env`, `.env.local`, `.env.production` ni credenciales.
7. No se ha confirmado la URL pública del backend ni la configuración del directorio raíz para FastAPI en Vercel. Confirmar que `/api/health` responde antes de demostrar autenticación.

## Variables de ambiente para preview de frontend autorizado

| Nombre | Uso | Criterio |
|---|---|---|
| `VITE_MODO_REAL` | Selecciona `RealApp` | `true` **solo** en preview para pruebas reales |
| `VITE_API_BASE_URL` | URL base de la API | HTTPS, sin agregar `/api` al final |
| `VITE_SUPABASE_URL` | URL pública Supabase Auth | Debe corresponder al proyecto de pruebas |
| `VITE_SUPABASE_ANON_KEY` | Clave pública de cliente | Solo clave anon/publicable, nunca service role |
| `VITE_CONSULTA_CICLOS_V4` | Consulta de actuaciones de V4 | `false` hasta validar la migración V4 en la base de pruebas |
| `VITE_PERMITIR_ASIGNACION_REAL` | Envía asignaciones | `false` hasta autorizar pruebas de escritura |
| `VITE_PERMITIR_ATENCION_REAL` | Envía intervenciones y cierres | `false` hasta autorizar pruebas de escritura |
| `VITE_PERMITIR_VERIFICACION_REAL` | Envía verificaciones y reaperturas | `false` hasta autorizar pruebas de escritura |

**Atención:** `VITE_*` se inserta en el bundle enviado al navegador. Nunca definir secretos en esas variables.

## Variables del backend (servidor, privadas)

- `SUPABASE_URL`: URL del proyecto de autenticación.
- `DATABASE_URL`: cadena de PostgreSQL del entorno autorizado. **No imprimir ni compartir**.
- `FRONTEND_URL`: origen exacto del frontend de pruebas permitido por CORS.
- `APP_ENV`: entorno; no controla por sí solo el acceso a datos.

## Secuencia de validación de la demostración

Marcar cada caso únicamente tras observarlo en una URL de prueba con cuentas autorizadas:

- [ ] 1. Backend preview: `GET /api/health` devuelve HTTP 200; `base_datos` debe indicar `conectada` en entorno con DB de pruebas.
- [ ] 2. Frontend preview presenta login real cuando corresponde, no el prototipo; diseño visible en escritorio y móvil.
- [ ] 3. Correo y contraseña de cuenta de pruebas autorizada acceden; credenciales erróneas no ingresan.
- [ ] 4. El representante crea un ticket y lo encuentra en su lista; no visualiza tickets de otra área.
- [ ] 5. El jefe puede ver técnicos y asignar uno; el representante no ve controles de jefatura.
- [ ] 6. El técnico asignado puede registrar diagnóstico, solución final y cierre; el no asignado no.
- [ ] 7. El representante observa el cierre y, solo en entorno con V4 habilitada, el ticket pasa al ciclo 2.
- [ ] 8. El jefe reasigna el ciclo 2; el técnico atiende y cierra; el representante registra conformidad.
- [ ] 9. Reabrir no elimina el historial del ciclo anterior.
- [ ] 10. Verificar responsive, mensajes de error, actualización del estado y cierre de sesión.
- [ ] 11. Desactivar banderas de escritura antes de publicar un enlace meramente demostrativo.
- [ ] 12. Tomar capturas de evidencia y registrar URL, fecha, usuario de prueba y resultado de cada paso.

## Instalación del paquete

1. En rama `ajustes-docente-v4`, subir `.github/scripts/preentrega_110f.py`.
2. Subir `.github/workflows/preentrega-110f.yml`.
3. En **Actions** verificar que **110F - Auditoria segura de preentrega** tenga **dos jobs verdes**.
4. No hacer merge a `main` ni cambios en Supabase real.

**Advertencia:** el workflow comprueba contratos, arranque API sin DB y compilación de ambos modos con URLs ficticias. No despliega ni prueba credenciales reales, sesiones, rutas en Vercel, ni bases productivas.
