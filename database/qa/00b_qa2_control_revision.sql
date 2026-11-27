-- SOLO soporte-ti-grocio-qa-2: vmtvttlmnqcucotskceh.
-- Preparacion propuesta; NO EJECUTADA. No usa parametros del servidor.
-- Verificar externamente dashboard y Connect: db.vmtvttlmnqcucotskceh.supabase.co.
-- La referencia escrita y esta marca NO prueban por si solas el destino.
-- Validar primero en una transaccion READ ONLY, con v_aplicar=false.
-- Aplicacion true requiere una autorizacion NUEVA; no incluye migraciones 01-05.
BEGIN;
DO $qa_control$
DECLARE
    v_aplicar boolean := false;
    v_destino_externo_verificado boolean := false;
    v_ref_confirmada text := '';
    v_schema oid;
    v_table oid;
    v_role record;
    v_marker record;
    v_policy record;
BEGIN
    IF NOT v_destino_externo_verificado
       OR v_ref_confirmada IS DISTINCT FROM 'vmtvttlmnqcucotskceh'
       OR current_database()<>'postgres' OR current_user<>'postgres' THEN
        RAISE EXCEPTION 'QA2: comprobar destino externo y operador; sin cambios';
    END IF;
    IF NOT has_database_privilege(current_user,current_database(),'CREATE')
       OR NOT (SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user) THEN
        RAISE EXCEPTION 'QA2: faltan permisos ordinarios; no elevar privilegios';
    END IF;
    IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public')
       OR EXISTS(SELECT 1 FROM auth.users)
       OR EXISTS(SELECT 1 FROM storage.buckets)
       OR EXISTS(SELECT 1 FROM storage.objects) THEN
        RAISE EXCEPTION 'QA2: bootstrap solo antes de migraciones y datos';
    END IF;

    SELECT * INTO v_role FROM pg_roles WHERE rolname='soporte_ti_api';
    IF FOUND AND (NOT v_role.rolcanlogin OR v_role.rolsuper OR v_role.rolbypassrls
       OR v_role.rolcreatedb OR v_role.rolcreaterole OR v_role.rolinherit OR v_role.rolreplication
       OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=v_role.oid)
       OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
                 WHERE m.roleid=v_role.oid AND r.rolname<>'postgres')
       OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=v_role.oid)
       OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=v_role.oid)) THEN
        RAISE EXCEPTION 'QA2: rol existente incompatible; no se modifica';
    END IF;

    SELECT oid INTO v_schema FROM pg_namespace WHERE nspname='qa_control';
    IF v_schema IS NOT NULL THEN
        IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE oid=v_schema)<>'postgres'
           OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='soporte_ti_api') THEN
            RAISE EXCEPTION 'QA2: esquema existente o rol no reconocidos';
        END IF;
        SELECT oid INTO v_table FROM pg_class
        WHERE relnamespace=v_schema AND relname='entorno' AND relkind='r'
          AND relrowsecurity AND NOT relforcerowsecurity
          AND pg_get_userbyid(relowner)='postgres';
        IF v_table IS NULL
           OR (SELECT count(*) FROM pg_class WHERE relnamespace=v_schema)<>2
           OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace=v_schema) THEN
            -- Dos relaciones: tabla y su indice primario.
            RAISE EXCEPTION 'QA2: estructura privada no reconocida; sin cambios';
        END IF;
        IF (SELECT count(*) FROM pg_attribute WHERE attrelid=v_table AND attnum>0 AND NOT attisdropped)<>8
           OR (SELECT count(*) FROM qa_control.entorno)<>1 THEN
            RAISE EXCEPTION 'QA2: metadatos existentes incompletos o diferentes';
        END IF;
        SELECT * INTO STRICT v_marker FROM qa_control.entorno;
        IF v_marker.singleton IS DISTINCT FROM true
           OR v_marker.project_ref IS DISTINCT FROM 'vmtvttlmnqcucotskceh'
           OR v_marker.project_url IS DISTINCT FROM 'https://vmtvttlmnqcucotskceh.supabase.co'
           OR v_marker.project_name IS DISTINCT FROM 'soporte-ti-grocio-qa-2'
           OR v_marker.database_name IS DISTINCT FROM 'postgres'
           OR v_marker.format_version IS DISTINCT FROM 1
           OR v_marker.created_by IS DISTINCT FROM 'postgres'
           OR v_marker.created_at IS NULL THEN
            RAISE EXCEPTION 'QA2: marca ajena; no se reemplaza';
        END IF;
        IF EXISTS(SELECT 1 FROM pg_roles r
            WHERE r.rolname IN ('anon','authenticated','service_role')
              AND (has_schema_privilege(r.oid,v_schema,'USAGE,CREATE')
                   OR has_table_privilege(r.oid,v_table,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))
           OR has_schema_privilege('soporte_ti_api',v_schema,'CREATE')
           OR has_table_privilege('soporte_ti_api',v_table,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           OR NOT has_schema_privilege('soporte_ti_api',v_schema,'USAGE')
           OR NOT has_table_privilege('soporte_ti_api',v_table,'SELECT') THEN
            RAISE EXCEPTION 'QA2: permisos de control distintos; no se reparan automaticamente';
        END IF;
        SELECT polcmd,polpermissive,polroles,pg_get_expr(polqual,polrelid) AS qual,
               pg_get_expr(polwithcheck,polrelid) AS comprobacion
          INTO v_policy FROM pg_policy
          WHERE polrelid=v_table AND polname='qa_control_lectura_api';
        IF NOT FOUND OR (SELECT count(*) FROM pg_policy WHERE polrelid=v_table)<>1
           OR v_policy.polcmd<>'r' OR NOT v_policy.polpermissive
           OR v_policy.polroles<>ARRAY['soporte_ti_api'::regrole::oid]
           OR v_policy.qual IS DISTINCT FROM 'singleton'
           OR v_policy.comprobacion IS NOT NULL THEN
            RAISE EXCEPTION 'QA2: politica de control distinta; sin cambios';
        END IF;
    END IF;

    IF v_aplicar THEN
        IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='soporte_ti_api') THEN
            CREATE ROLE soporte_ti_api LOGIN NOSUPERUSER NOBYPASSRLS
                NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
        END IF;
        IF v_schema IS NULL THEN
            CREATE SCHEMA qa_control AUTHORIZATION postgres;
            REVOKE ALL ON SCHEMA qa_control FROM PUBLIC,anon,authenticated,service_role;
            CREATE TABLE qa_control.entorno (
                singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
                project_ref text NOT NULL CHECK(project_ref='vmtvttlmnqcucotskceh'),
                project_url text NOT NULL CHECK(project_url='https://vmtvttlmnqcucotskceh.supabase.co'),
                project_name text NOT NULL CHECK(project_name='soporte-ti-grocio-qa-2'),
                database_name name NOT NULL CHECK(database_name='postgres'),
                format_version smallint NOT NULL CHECK(format_version=1),
                created_by name NOT NULL DEFAULT current_user CHECK(created_by='postgres'),
                created_at timestamptz NOT NULL DEFAULT current_timestamp
            );
            REVOKE ALL ON qa_control.entorno FROM PUBLIC,anon,authenticated,service_role;
            ALTER TABLE qa_control.entorno ENABLE ROW LEVEL SECURITY;
            GRANT USAGE ON SCHEMA qa_control TO soporte_ti_api;
            GRANT SELECT ON qa_control.entorno TO soporte_ti_api;
            CREATE POLICY qa_control_lectura_api ON qa_control.entorno
                FOR SELECT TO soporte_ti_api USING(singleton);
            INSERT INTO qa_control.entorno
                (singleton,project_ref,project_url,project_name,database_name,format_version)
                VALUES(true,'vmtvttlmnqcucotskceh','https://vmtvttlmnqcucotskceh.supabase.co',
                       'soporte-ti-grocio-qa-2','postgres',1);
        END IF;
        GRANT USAGE ON SCHEMA public TO soporte_ti_api;
    END IF;
    RAISE NOTICE 'QA2 control v1 validado; aplicar=%. Sin parametros del servidor, password, usuarios Auth ni incidencias.',v_aplicar;
END;
$qa_control$;
COMMIT;
