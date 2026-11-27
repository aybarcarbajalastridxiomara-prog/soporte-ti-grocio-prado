-- SOLO soporte-ti-grocio-qa-2 (vmtvttlmnqcucotskceh). REVISIÓN MANUAL.
-- No ejecutar en el proyecto municipal. Requiere 01..05 y la marca QA verificada.
-- Los UUID deben proceder de identidades ficticias creadas por Authentication.
-- No contiene UUID inventados, correos ni contraseñas. No escribe auth.users.
-- v_aplicar=false: valida sin modificar datos. No cambiar a true antes del OK.
BEGIN;
DO $$
DECLARE
    v_aplicar boolean := false;
    -- Completar solo en la sesión privada del operador, nunca subir a Git:
    -- {"qa_jefe":"UUID_REAL_QA", "qa_representante":"UUID_REAL_QA", ...}
    v_ids jsonb := '{}'::jsonb;
    v record;
    v_id uuid;
    v_area uuid;
    v_existente public.usuarios%ROWTYPE;
BEGIN
    IF current_database()<>'postgres' OR to_regclass('qa_control.entorno') IS NULL THEN
        RAISE EXCEPTION 'Destino QA no acreditado: sin cambios';
    END IF;
    IF (SELECT count(*) FROM qa_control.entorno)<>1 OR NOT EXISTS(
        SELECT 1 FROM qa_control.entorno WHERE singleton
          AND project_ref='vmtvttlmnqcucotskceh'
          AND project_url='https://vmtvttlmnqcucotskceh.supabase.co'
          AND project_name='soporte-ti-grocio-qa-2' AND database_name=current_database()
          AND format_version=1 AND created_by='postgres')
       OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='qa_control' AND c.relname='entorno' AND c.relrowsecurity
            AND pg_get_userbyid(c.relowner)='postgres' AND pg_get_userbyid(n.nspowner)='postgres') THEN
        RAISE EXCEPTION 'Control privado QA2 no acreditado: sin cambios';
    END IF;
    IF jsonb_typeof(v_ids)<>'object' OR
       (SELECT count(*) FROM jsonb_object_keys(v_ids))<>6 OR
       (SELECT count(DISTINCT value) FROM jsonb_each_text(v_ids))<>6 THEN
        RAISE EXCEPTION 'Se requieren seis UUID reales y distintos de Auth QA: sin cambios';
    END IF;
    IF EXISTS(SELECT 1 FROM public.usuarios WHERE usuario NOT LIKE 'qa\_%' ESCAPE '\' OR nombre_completo NOT LIKE 'QA %')
       OR EXISTS(SELECT 1 FROM public.areas WHERE nombre NOT IN ('QA Área A','QA Área B')) THEN
        RAISE EXCEPTION 'Hay datos fuera del inventario ficticio autorizado: sin cambios';
    END IF;
    FOR v IN SELECT * FROM (VALUES
        ('qa_jefe','JEFE','QA Área A'),
        ('qa_representante','REPRESENTANTE','QA Área A'),
        ('qa_asistente','ASISTENTE','QA Área A'),
        ('qa_practicante','PRACTICANTE','QA Área A'),
        ('qa_otro_representante','REPRESENTANTE','QA Área B'),
        ('qa_otro_asistente','ASISTENTE','QA Área A')
    ) AS p(alias,rol,area)
    LOOP
        IF NOT v_ids ? v.alias THEN RAISE EXCEPTION 'Falta un alias QA requerido: sin cambios'; END IF;
        v_id := (v_ids->>v.alias)::uuid;
        IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_id AND email_confirmed_at IS NOT NULL) THEN
            RAISE EXCEPTION 'Identidad QA no existente o no confirmada: sin cambios';
        END IF;
        SELECT id INTO v_area FROM public.areas WHERE nombre=v.area AND activo;
        IF v_area IS NULL AND EXISTS(SELECT 1 FROM public.areas WHERE nombre=v.area) THEN
            RAISE EXCEPTION 'Área QA existente inactiva: sin cambios';
        END IF;
        SELECT * INTO v_existente FROM public.usuarios WHERE id=v_id OR usuario=v.alias;
        IF FOUND AND (v_existente.id<>v_id OR v_existente.usuario<>v.alias OR v_existente.rol<>v.rol
             OR v_existente.area_id IS DISTINCT FROM v_area OR NOT v_existente.habilitado
             OR v_existente.nombre_completo<>'QA '||v.alias) THEN
            RAISE EXCEPTION 'Perfil QA existente distinto: no se sobrescribe';
        END IF;
        IF v_aplicar THEN
            INSERT INTO public.areas(nombre) VALUES(v.area) ON CONFLICT(nombre) DO NOTHING;
            SELECT id INTO STRICT v_area FROM public.areas WHERE nombre=v.area AND activo;
            INSERT INTO public.usuarios(id,area_id,nombre_completo,usuario,rol,habilitado)
                VALUES(v_id,v_area,'QA '||v.alias,v.alias,v.rol,true)
                ON CONFLICT(id) DO NOTHING;
        END IF;
    END LOOP;
    RAISE NOTICE 'Validación QA correcta. Aplicación solicitada: %. No se modificaron identidades Auth.',v_aplicar;
END;
$$;
COMMIT;

-- Solo resultados ficticios; sin correos, claves ni contraseñas.
SELECT u.usuario,u.rol,a.nombre AS area,u.habilitado
FROM public.usuarios u JOIN public.areas a ON a.id=u.area_id
WHERE u.usuario LIKE 'qa\_%' ESCAPE '\' ORDER BY u.usuario;
SELECT rol,count(*) AS perfiles FROM public.usuarios GROUP BY rol ORDER BY rol;
