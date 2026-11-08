-- PROYECTO: Sistema de Gestion y Seguimiento de Incidencias - Grocio Prado
-- VERSION: MVP / esquema inicial (8 tablas), 2026-II
-- DESTINO: PostgreSQL en un proyecto NUEVO de Supabase, despues de revision.
-- NO EJECUTAR AUN: faltan politicas RLS, flujo seguro de cuentas y pruebas.
-- NO incluye usuarios reales ni credenciales.
-- Ejecutar una sola vez en un entorno limpio; no es script de migracion incremental.

BEGIN;

-- 1. AREAS MUNICIPALES
CREATE TABLE public.areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PERFILES (la identidad y contrasena viven en Supabase Auth)
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
    nombre_completo VARCHAR(150) NOT NULL,
    usuario VARCHAR(80) NOT NULL UNIQUE,
    rol VARCHAR(30) NOT NULL CHECK (
        rol IN ('JEFE', 'ASISTENTE', 'PRACTICANTE', 'REPRESENTANTE')
    ),
    habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT usuarios_nombre_no_vacio CHECK (length(btrim(nombre_completo)) > 0),
    CONSTRAINT usuarios_login_no_vacio CHECK (length(btrim(usuario)) > 0)
);

-- Regla: maximo dos representantes habilitados en una misma area.
-- Bloquea la fila del area para serializar operaciones concurrentes.
CREATE FUNCTION public.validar_cupo_representantes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    total_existentes INTEGER;
BEGIN
    IF NEW.rol = 'REPRESENTANTE' AND NEW.habilitado THEN
        PERFORM 1 FROM public.areas WHERE id = NEW.area_id FOR UPDATE;

        SELECT count(*) INTO total_existentes
        FROM public.usuarios u
        WHERE u.area_id = NEW.area_id
          AND u.rol = 'REPRESENTANTE'
          AND u.habilitado = TRUE
          AND u.id IS DISTINCT FROM NEW.id;

        IF total_existentes >= 2 THEN
            RAISE EXCEPTION 'El area ya tiene dos representantes habilitados';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_cupo_representantes
BEFORE INSERT OR UPDATE OF area_id, rol, habilitado ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.validar_cupo_representantes();

-- 3. INCIDENCIAS

-- Secuencia global para generar codigos unicos.
CREATE SEQUENCE public.incidencias_codigo_seq
    AS BIGINT
    START WITH 1
    INCREMENT BY 1;

-- El backend generara un codigo unico (ej.: INC-2026-0001).
CREATE TABLE public.incidencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(25) NOT NULL UNIQUE
        DEFAULT (
            'INC-' ||
            to_char(CURRENT_TIMESTAMP, 'YYYY') ||
            '-' ||
            lpad(
                nextval(
                    'public.incidencias_codigo_seq'
                )::TEXT,
                6,
                '0'
            )
        ),
    area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
    reportante_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    asunto VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    categoria VARCHAR(80),
    equipo_sistema_afectado VARCHAR(150),
    ubicacion VARCHAR(150),
    impacto VARCHAR(20) CHECK (impacto IS NULL OR impacto IN ('Si', 'Parcialmente', 'No')),
    fecha_inicio_problema DATE, 
    hora_inicio_problema TIME WITHOUT TIME ZONE,
    incidencia_anterior_id UUID
        REFERENCES public.incidencias(id)
        ON DELETE RESTRICT,
    detalle_reincidencia TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente', 'En revisión', 'Cerrado')),
    prioridad VARCHAR(15),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_cierre TIMESTAMPTZ,
    cerrado_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT incidencias_asunto_no_vacio CHECK (length(btrim(asunto)) > 0),
    CONSTRAINT incidencias_descripcion_no_vacia CHECK (length(btrim(descripcion)) > 0),
    CONSTRAINT incidencias_cierre_consistente CHECK (
        (estado = 'Cerrado' AND fecha_cierre IS NOT NULL AND cerrado_por_usuario_id IS NOT NULL)
        OR
        (estado <> 'Cerrado' AND fecha_cierre IS NULL AND cerrado_por_usuario_id IS NULL)
    )
);


-- Validar el area y los permisos del reportante.
CREATE FUNCTION public.validar_reportante_incidencia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Las referencias inexistentes seran rechazadas
    -- por las claves foraneas de la tabla.

    IF EXISTS (
        SELECT 1
        FROM public.areas
        WHERE id = NEW.area_id
    )
    AND EXISTS (
        SELECT 1
        FROM public.usuarios
        WHERE id = NEW.reportante_id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.usuarios u
        WHERE u.id = NEW.reportante_id
          AND u.area_id = NEW.area_id
          AND u.rol = 'REPRESENTANTE'
          AND u.habilitado = TRUE
    ) THEN
        RAISE EXCEPTION
            'El reportante debe ser un representante habilitado del area'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'incidencias_reportante_area_valida';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_reportante_incidencia
BEFORE INSERT OR UPDATE OF area_id, reportante_id
ON public.incidencias
FOR EACH ROW
EXECUTE FUNCTION public.validar_reportante_incidencia();

-- 4. ASIGNACIONES
CREATE TABLE public.asignaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incidencia_id UUID NOT NULL REFERENCES public.incidencias(id) ON DELETE RESTRICT,
    tecnico_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    asignado_por_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    origen_asignacion VARCHAR(20) NOT NULL
        CHECK (origen_asignacion IN ('JEFATURA', 'AUTOTOMA')),
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_fin TIMESTAMPTZ,
    motivo_reasignacion TEXT,
    CONSTRAINT asignacion_toma_propia CHECK (
        origen_asignacion <> 'AUTOTOMA' OR tecnico_id = asignado_por_id
    ),
    CONSTRAINT asignacion_fechas_validas CHECK (
        fecha_fin IS NULL OR fecha_fin >= fecha_asignacion
    )
);

-- La restriccion UNIQUE es concurrente: nunca dos responsables activos.
CREATE UNIQUE INDEX ux_asignacion_activa_por_incidencia
    ON public.asignaciones (incidencia_id)
    WHERE fecha_fin IS NULL;

-- 5. INTERVENCIONES
CREATE TABLE public.intervenciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incidencia_id UUID NOT NULL REFERENCES public.incidencias(id) ON DELETE RESTRICT,
    tecnico_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    diagnostico TEXT NOT NULL,
    acciones_realizadas TEXT NOT NULL,
    duracion_minutos INTEGER CHECK (duracion_minutos IS NULL OR duracion_minutos >= 0),
    solucion_aplicada TEXT,
    es_solucion_final BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT intervencion_diagnostico_no_vacio CHECK (length(btrim(diagnostico)) > 0),
    CONSTRAINT intervencion_acciones_no_vacias CHECK (length(btrim(acciones_realizadas)) > 0),
    CONSTRAINT intervencion_solucion_final_valida CHECK (
        NOT es_solucion_final OR
        (solucion_aplicada IS NOT NULL AND length(btrim(solucion_aplicada)) > 0)
    )
);

-- 6. VERIFICACIONES DE SOLUCION
CREATE TABLE public.verificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incidencia_id UUID NOT NULL REFERENCES public.incidencias(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    resultado VARCHAR(20) NOT NULL CHECK (resultado IN ('Conformidad', 'Observación')),
    observaciones TEXT,
    fecha_verificacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT verificacion_observacion_con_motivo CHECK (
        resultado <> 'Observación' OR
        (observaciones IS NOT NULL AND length(btrim(observaciones)) > 0)
    )
);

-- 7. EVIDENCIAS (solo metadatos; archivos privados en Storage)
CREATE TABLE public.evidencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incidencia_id UUID NOT NULL REFERENCES public.incidencias(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(100) NOT NULL CHECK (
        tipo_archivo IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    ),
    tamano_bytes BIGINT NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 10485760),
    ruta_archivo TEXT NOT NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. HISTORIAL DE INCIDENCIAS
CREATE TABLE public.historial_incidencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incidencia_id UUID NOT NULL REFERENCES public.incidencias(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    accion VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices basicos para consultas por area, ticket, tecnico y fecha.
CREATE INDEX ix_usuarios_area ON public.usuarios(area_id);
CREATE INDEX ix_incidencias_area_estado ON public.incidencias(area_id, estado);
CREATE INDEX ix_incidencias_reportante ON public.incidencias(reportante_id);
CREATE INDEX ix_incidencias_fecha ON public.incidencias(fecha_registro DESC);
CREATE INDEX ix_asignaciones_tecnico ON public.asignaciones(tecnico_id);
CREATE INDEX ix_intervenciones_incidencia_fecha ON public.intervenciones(incidencia_id, fecha_registro DESC);
CREATE UNIQUE INDEX ux_verificaciones_incidencia ON public.verificaciones(incidencia_id);
CREATE INDEX ix_evidencias_incidencia ON public.evidencias(incidencia_id);
CREATE INDEX ix_historial_incidencia_fecha ON public.historial_incidencias(incidencia_id, fecha_registro DESC);

-- Seguridad cerrada por defecto: sin politicas RLS, API cliente sin acceso.
-- Los permisos reales se definiran y probaran en 02_seguridad_rls_mvp.sql.
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervenciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_incidencias ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.areas, public.usuarios, public.incidencias, public.asignaciones,
    public.intervenciones, public.verificaciones, public.evidencias,
    public.historial_incidencias
FROM anon, authenticated;

COMMIT;

-- OBSERVACIONES PENDIENTES ANTES DE INTEGRAR:
-- A. Politicas RLS y operaciones seguras para JEFE, ASISTENTE, PRACTICANTE y REPRESENTANTE.
-- B. Procedimiento de creacion de usuarios en Auth + public.usuarios (administracion solo JEFE).
-- C. Generacion atomica del codigo de ticket por el backend, sin duplicados.
-- D. Validacion transaccional de roles al asignar, tomar, intervenir y cerrar.
-- E. El silencio de un dia habil NO crea conformidad ni cierre automatico.
-- F. Verificar que el reportante pertenece al area de la incidencia.
-- G. Validar con pruebas automatizadas los casos de concurrencia y acceso denegado.
-- H. Sin politicas RLS, las peticiones de la API de datos no podran consultar las tablas.
