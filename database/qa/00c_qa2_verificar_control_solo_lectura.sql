-- QA2 vmtvttlmnqcucotskceh. Solo despues del bootstrap autorizado.
-- Sin password, datos personales ni modificacion de parametros.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS base,current_user AS operador,
       current_setting('transaction_read_only') AS solo_lectura;
SELECT singleton,project_ref,project_url,project_name,database_name,
       format_version,created_by,created_at FROM qa_control.entorno;
SELECT n.nspname,pg_get_userbyid(n.nspowner) AS propietario_esquema,
       c.relname,pg_get_userbyid(c.relowner) AS propietario_tabla,
       c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='qa_control' AND c.relname='entorno';
SELECT policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='qa_control' AND tablename='entorno';
SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolreplication
FROM pg_roles WHERE rolname='soporte_ti_api';
SELECT r.rolname,
       has_database_privilege(r.oid,current_database(),'CONNECT') AS conectar_base,
       has_database_privilege(r.oid,current_database(),'CREATE') AS crear_esquemas,
       has_database_privilege(r.oid,current_database(),'TEMP') AS crear_temporales,
       has_schema_privilege(r.oid,'public','USAGE') AS uso_public,
       has_schema_privilege(r.oid,'public','CREATE') AS crear_en_public,
       has_schema_privilege(r.oid,'qa_control','USAGE') AS uso_control,
       has_schema_privilege(r.oid,'qa_control','CREATE') AS crea_en_control,
       has_table_privilege(r.oid,'qa_control.entorno','SELECT') AS lee_marca,
       has_table_privilege(r.oid,'qa_control.entorno','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS cambia_marca
FROM pg_roles r WHERE r.rolname IN ('soporte_ti_api','anon','authenticated','service_role')
ORDER BY r.rolname;
SELECT parent.rolname AS rol_otorgado,member.rolname AS miembro
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
JOIN pg_roles member ON member.oid=m.member
WHERE parent.rolname='soporte_ti_api' OR member.rolname='soporte_ti_api';
SELECT (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS tablas_publicas,
       (SELECT count(*) FROM auth.users) AS usuarios_auth,
       (SELECT count(*) FROM storage.buckets) AS buckets,
       (SELECT count(*) FROM storage.objects) AS objetos_storage;
ROLLBACK;
