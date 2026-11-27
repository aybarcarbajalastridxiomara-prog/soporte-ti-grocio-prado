-- FASE 111A. Aplicación MANUAL tras validar en PostgreSQL temporal.
-- No amplía permisos de anon/authenticated ni modifica auth.users.
BEGIN;
GRANT INSERT (id, area_id, nombre_completo, usuario, rol, habilitado)
    ON public.usuarios TO soporte_ti_api;
GRANT UPDATE (area_id, nombre_completo, usuario, rol, habilitado)
    ON public.usuarios TO soporte_ti_api;

CREATE POLICY api_administracion_insercion ON public.usuarios
    FOR INSERT TO soporte_ti_api WITH CHECK (true);
CREATE POLICY api_administracion_actualizacion ON public.usuarios
    FOR UPDATE TO soporte_ti_api USING (true) WITH CHECK (true);
COMMIT;
