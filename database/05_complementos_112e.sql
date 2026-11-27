-- 112E. REVISIÓN/APLICACIÓN MANUAL. Probar solo en QA primero.
-- Aditiva e idempotente. No envía correos, no toca auth.users ni altera incidencias.
-- Para editar perfiles se necesita además 04_administracion_perfiles.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS public.notificaciones_salida (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES public.historial_incidencias(id),
    destinatario_id UUID NOT NULL REFERENCES public.usuarios(id),
    contenido JSONB NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviando','enviado','error','incierto')),
    intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 3),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_intento TIMESTAMPTZ,
    fecha_envio TIMESTAMPTZ,
    error_codigo TEXT,
    UNIQUE(evento_id, destinatario_id)
);
CREATE INDEX IF NOT EXISTS ix_notificaciones_pendientes ON public.notificaciones_salida(estado,fecha_creacion);
CREATE TABLE IF NOT EXISTS public.auditoria_administrativa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES public.usuarios(id),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id),
    accion TEXT NOT NULL CHECK (accion IN ('EDITAR_PERFIL','INVITAR_PERFIL')),
    anterior JSONB NOT NULL,
    nuevo JSONB NOT NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notificaciones_salida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_administrativa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notificaciones_salida,public.auditoria_administrativa FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.notificaciones_salida TO soporte_ti_api;
GRANT SELECT,INSERT ON public.auditoria_administrativa TO soporte_ti_api;
-- Permiso mínimo para el bloqueo FOR UPDATE del trigger de cupo existente.
GRANT UPDATE(id) ON public.areas TO soporte_ti_api;
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notificaciones_salida' AND policyname='api_cola_servidor') THEN
        CREATE POLICY api_cola_servidor ON public.notificaciones_salida TO soporte_ti_api USING(true) WITH CHECK(true);
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auditoria_administrativa' AND policyname='api_auditoria_lectura') THEN
        CREATE POLICY api_auditoria_lectura ON public.auditoria_administrativa FOR SELECT TO soporte_ti_api USING(true);
        CREATE POLICY api_auditoria_insertar ON public.auditoria_administrativa FOR INSERT TO soporte_ti_api WITH CHECK(true);
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='areas' AND policyname='api_bloqueo_area') THEN
        CREATE POLICY api_bloqueo_area ON public.areas FOR UPDATE TO soporte_ti_api USING(true) WITH CHECK(true);
    END IF;
END $$;
COMMIT;
