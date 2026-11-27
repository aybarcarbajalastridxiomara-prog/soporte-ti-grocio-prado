-- Solo QA2 vmtvttlmnqcucotskceh. Revisión/aplicación MANUAL; no crea buckets.
-- Defensa explícita: el navegador no accede directamente al bucket QA.
-- FastAPI aplica los permisos por incidencia; service_role permanece solo en servidor.
BEGIN;
DO $$
DECLARE
    v_aplicar boolean := false;
    v_p record;
    v_condicion text := '(bucket_id <> ''incidencias-qa''::text)';
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
    IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='incidencias-qa' AND NOT public
        AND file_size_limit BETWEEN 4000000 AND 5242880
        AND allowed_mime_types @> ARRAY['application/pdf','image/jpeg','image/png']::text[]
        AND cardinality(allowed_mime_types)=3)
       OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity) THEN
        RAISE EXCEPTION 'Bucket privado, límites, formatos o RLS QA no confirmados';
    END IF;
    SELECT p.*,pg_get_expr(polqual,polrelid) AS condicion,
        pg_get_expr(polwithcheck,polrelid) AS comprobacion INTO v_p
        FROM pg_policy p WHERE polrelid='storage.objects'::regclass AND polname='qa112f_solo_backend';
    IF FOUND THEN
        IF v_p.polpermissive OR v_p.polcmd<>'*' OR cardinality(v_p.polroles)<>2
            OR NOT v_p.polroles @> ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid]
            OR v_p.condicion IS DISTINCT FROM v_condicion OR v_p.comprobacion IS DISTINCT FROM v_condicion THEN
            RAISE EXCEPTION 'Política QA existente distinta: no se reemplaza';
        END IF;
    ELSIF v_aplicar THEN
        CREATE POLICY qa112f_solo_backend ON storage.objects AS RESTRICTIVE
            FOR ALL TO anon,authenticated
            USING(bucket_id <> 'incidencias-qa') WITH CHECK(bucket_id <> 'incidencias-qa');
    ELSE
        RAISE NOTICE 'Validación correcta. Política QA pendiente de aplicación manual.';
    END IF;
END;
$$;
COMMIT;

SELECT policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
