
-- PASO 92: Permisos minimos para FastAPI.
-- NO EJECUTAR EN SUPABASE HASTA APROBAR PRUEBAS.
-- El rol soporte_ti_api es exclusivo del backend.
-- La autorizacion por usuario se aplica en FastAPI.

BEGIN;

-- Confirmar que existe el usuario restringido.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'soporte_ti_api'
          AND rolcanlogin
          AND NOT rolsuper
          AND NOT rolbypassrls
    ) THEN
        RAISE EXCEPTION
            'El usuario restringido no esta preparado';
    END IF;
END;
$$;

-- Permitir consultar las ocho tablas.
GRANT SELECT ON
    public.areas,
    public.usuarios,
    public.incidencias,
    public.asignaciones,
    public.intervenciones,
    public.verificaciones,
    public.evidencias,
    public.historial_incidencias
TO soporte_ti_api;

-- Permitir registrar operaciones del sistema.
GRANT INSERT ON
    public.incidencias,
    public.asignaciones,
    public.intervenciones,
    public.verificaciones,
    public.evidencias,
    public.historial_incidencias
TO soporte_ti_api;

-- Permitir actualizar tickets y asignaciones.
GRANT UPDATE ON
    public.incidencias,
    public.asignaciones
TO soporte_ti_api;

-- Permitir generar codigos de incidencia.
GRANT USAGE ON SEQUENCE
    public.incidencias_codigo_seq
TO soporte_ti_api;

-- Las politicas siguientes autorizan al backend,
-- no a los usuarios finales. FastAPI debe verificar
-- identidad, rol, area y permisos por operacion.

DO $$
DECLARE
    v_tabla TEXT;
BEGIN
    -- Lectura de las ocho tablas.
    FOREACH v_tabla IN ARRAY ARRAY[
        'areas',
        'usuarios',
        'incidencias',
        'asignaciones',
        'intervenciones',
        'verificaciones',
        'evidencias',
        'historial_incidencias'
    ]
    LOOP
        EXECUTE format(
            'CREATE POLICY api_lectura
             ON public.%I
             FOR SELECT
             TO soporte_ti_api
             USING (true)',
            v_tabla
        );
    END LOOP;

    -- Inserciones autorizadas para el backend.
    FOREACH v_tabla IN ARRAY ARRAY[
        'incidencias',
        'asignaciones',
        'intervenciones',
        'verificaciones',
        'evidencias',
        'historial_incidencias'
    ]
    LOOP
        EXECUTE format(
            'CREATE POLICY api_insercion
             ON public.%I
             FOR INSERT
             TO soporte_ti_api
             WITH CHECK (true)',
            v_tabla
        );
    END LOOP;

    -- Actualizaciones autorizadas para el backend.
    FOREACH v_tabla IN ARRAY ARRAY[
        'incidencias',
        'asignaciones'
    ]
    LOOP
        EXECUTE format(
            'CREATE POLICY api_actualizacion
             ON public.%I
             FOR UPDATE
             TO soporte_ti_api
             USING (true)
             WITH CHECK (true)',
            v_tabla
        );
    END LOOP;
END;
$$;

COMMIT;
