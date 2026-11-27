
-- GRUPO 4 - MIGRACION V4
-- Reapertura de incidencias observadas
--
-- BORRADOR PARA PRUEBAS.
-- NO EJECUTAR EN SUPABASE REAL.
-- Primero validar en PostgreSQL temporal de GitHub.
--
-- Objetivo:
-- Registrar multiples ciclos de atencion
-- conservando toda la informacion anterior.

BEGIN;

-- 1. Ciclo vigente de cada incidencia.
-- Los tickets existentes comienzan en ciclo 1.

ALTER TABLE public.incidencias
ADD COLUMN ciclo_actual INTEGER NOT NULL
DEFAULT 1 CHECK (ciclo_actual >= 1);

-- 2. Identificar el ciclo de cada asignacion.

ALTER TABLE public.asignaciones
ADD COLUMN ciclo_atencion INTEGER NOT NULL
DEFAULT 1 CHECK (ciclo_atencion >= 1);

-- 3. Identificar el ciclo de cada intervencion.

ALTER TABLE public.intervenciones
ADD COLUMN ciclo_atencion INTEGER NOT NULL
DEFAULT 1 CHECK (ciclo_atencion >= 1);

-- 4. Permitir verificaciones en distintos ciclos.

ALTER TABLE public.verificaciones
ADD COLUMN ciclo_atencion INTEGER NOT NULL
DEFAULT 1 CHECK (ciclo_atencion >= 1);

-- 5. Conservar la relacion de evidencias
-- con cada ciclo de atencion.

ALTER TABLE public.evidencias
ADD COLUMN ciclo_atencion INTEGER NOT NULL
DEFAULT 1 CHECK (ciclo_atencion >= 1);

-- 6. Identificar cada evento del historial.

ALTER TABLE public.historial_incidencias
ADD COLUMN ciclo_atencion INTEGER NOT NULL
DEFAULT 1 CHECK (ciclo_atencion >= 1);

-- 7. Sustituir la unicidad por incidencia
-- por una verificacion unica por ciclo.
-- Los registros existentes se conservan.

DROP INDEX public.ux_verificaciones_incidencia;

CREATE UNIQUE INDEX ux_verificaciones_incidencia_ciclo
ON public.verificaciones (
    incidencia_id,
    ciclo_atencion
);

COMMIT;

-- IMPORTANTE:
-- Este archivo NO implementa la reapertura por si solo.
-- El backend debera administrar los ciclos,
-- actualizar el estado y verificar los permisos.
--
-- No aplicarlo a Supabase hasta aprobar
-- migracion, pruebas y respaldo de datos.
