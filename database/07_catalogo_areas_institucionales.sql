-- Catálogo institucional. Conserva los identificadores y referencias existentes.
BEGIN;

LOCK TABLE public.areas IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    id_anterior uuid;
    id_informatica uuid;
BEGIN
    SELECT id INTO id_anterior
    FROM public.areas WHERE nombre = 'Sistemas - Pruebas';

    SELECT id INTO id_informatica
    FROM public.areas WHERE nombre = 'Unidad de Racionalización e Informática';

    IF id_anterior IS NOT NULL AND id_informatica IS NOT NULL THEN
        RAISE EXCEPTION 'Ya existen ambas áreas de Informática. Revise las referencias antes de unificarlas.';
    ELSIF id_anterior IS NOT NULL THEN
        UPDATE public.areas SET nombre = 'Unidad de Racionalización e Informática'
        WHERE id = id_anterior;
    ELSIF id_informatica IS NULL THEN
        INSERT INTO public.areas(nombre) VALUES ('Unidad de Racionalización e Informática');
    END IF;
END
$$;

INSERT INTO public.areas(nombre)
SELECT catalogo.nombre
FROM (VALUES
    ('Alcaldía'), ('Gerencia Municipal'), ('Secretaría General'),
    ('Administración y Finanzas'), ('Planificación y Presupuesto'), ('Recursos Humanos'),
    ('Tesorería'), ('Contabilidad'), ('Logística y Control Patrimonial'),
    ('Administración Tributaria'), ('Trámite Documentario y Archivo'), ('Registro Civil'),
    ('Desarrollo Urbano'), ('Imagen Institucional')
) AS catalogo(nombre)
WHERE NOT EXISTS (
    SELECT 1 FROM public.areas AS area
    WHERE translate(lower(btrim(area.nombre)), 'áéíóúü', 'aeiouu')
        = translate(lower(catalogo.nombre), 'áéíóúü', 'aeiouu')
);

COMMIT;
