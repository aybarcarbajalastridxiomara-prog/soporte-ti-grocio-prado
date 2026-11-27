"""Preflight QA: inventario local o verificaciones exclusivamente de lectura.

No lee .env, no crea identidades/buckets/esquema y no imprime valores privados.
Ejecutar desde el PowerShell privado del operador, nunca con credenciales municipales.
"""
import argparse
from dataclasses import dataclass, field
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

REPO=Path(__file__).resolve().parents[2]
PROJECT='vmtvttlmnqcucotskceh'
ORIGIN=f'https://{PROJECT}.supabase.co'
PROJECT_NAME='soporte-ti-grocio-qa-2'
BUCKET='incidencias-qa'
TABLES={'areas','usuarios','incidencias','asignaciones','intervenciones','verificaciones',
    'evidencias','historial_incidencias','notificaciones_salida','auditoria_administrativa'}
MIGRATIONS=['01_esquema_mvp.sql','02_permisos_backend.sql','03_reapertura_v4.sql',
    '04_administracion_perfiles.sql','05_complementos_112e.sql']

class QANoPreparado(Exception):
    pass

@dataclass(frozen=True)
class ConfigQA:
    database_url: str=field(repr=False)
    service_key: str=field(repr=False)
    public_key: str=field(repr=False)

def configuracion(env):
    # Se ignoran DATABASE_URL/SUPABASE_* heredadas y todos los archivos .env.
    if env.get('GROCIO_QA_SUPABASE_URL',ORIGIN)!=ORIGIN:
        raise QANoPreparado('Proyecto QA distinto al autorizado.')
    values=[env.get('GROCIO_QA_'+k,'').strip() for k in ('DATABASE_URL','SERVICE_ROLE_KEY','PUBLIC_KEY')]
    if not all(values):raise QANoPreparado('Falta configuración privada QA; no se realizó ninguna conexión.')
    if any(any(ord(c)<32 for c in v) for v in values):raise QANoPreparado('Configuración QA inválida.')
    from sqlalchemy.engine import make_url
    try:
        url=make_url(values[0])
        if url.drivername!='postgresql+psycopg' or url.database!='postgres' or not url.password:
            raise ValueError()
        direct=url.host==f'db.{PROJECT}.supabase.co' and url.username=='soporte_ti_api' and (url.port or 5432)==5432
        pooler=bool(re.fullmatch(r'aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com',url.host or '')) and url.username==f'soporte_ti_api.{PROJECT}' and url.port in (5432,6543)
        if not (direct or pooler) or url.query.get('sslmode')!='verify-full' or set(url.query)-{'sslmode','sslrootcert'}:
            raise ValueError()
        if any(not isinstance(v,str) for v in url.query.values()):raise ValueError()
        # Un JWT service_role legado debe corresponder al proyecto QA. Las claves
        # secretas nuevas son opacas: su pertenencia se confirma al consultar QA.
        import base64
        for key,role in [(values[1],'service_role'),(values[2],'anon')]:
            if key.count('.')==2:
                payload=key.split('.')[1];obj=json.loads(base64.urlsafe_b64decode(payload+'='*((-len(payload))%4)))
                if obj.get('ref')!=PROJECT or obj.get('role')!=role:raise ValueError()
            elif not key.startswith('sb_secret_' if role=='service_role' else 'sb_publishable_'):
                raise ValueError()
    except Exception:
        raise QANoPreparado('DSN o claves QA incompatibles. No se mostraron sus valores.') from None
    return ConfigQA(*values)

def inventario():
    return {'proyecto':PROJECT,'url_publica':ORIGIN,'bucket':BUCKET,
        'migraciones_ordenadas':[{'archivo':'database/'+f,'sha256':hashlib.sha256((REPO/'database'/f).read_bytes()).hexdigest()} for f in MIGRATIONS],
        'nota':'01/02/03/04 son de aplicación única sobre un QA nuevo; 05 es idempotente. Este preflight no ejecuta SQL de escritura.'}

def verificar_marca(con):
    """Marca secundaria privada; la identidad externa se fija por URL/DSN/TLS.

    No modifica parámetros, objetos ni filas. La cuenta API solo lee la marca.
    """
    from sqlalchemy import text
    driver=con.connection.driver_connection
    info=driver.info
    direct=info.host==f'db.{PROJECT}.supabase.co' and info.user=='soporte_ti_api' and int(info.port)==5432
    pooler=bool(re.fullmatch(r'aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com',info.host or '')) and info.user==f'soporte_ti_api.{PROJECT}' and int(info.port) in (5432,6543)
    if not driver.pgconn.ssl_in_use or info.dbname!='postgres' or not (direct or pooler):
        raise QANoPreparado('Destino de conexión o TLS QA2 no confirmado; sin mostrar sus valores.')
    identity=con.execute(text(
        "SELECT current_database(),current_user,current_setting('transaction_read_only')")).one()
    if tuple(identity)!=('postgres','soporte_ti_api','on'):
        raise QANoPreparado('Identidad de sesión QA2 no confirmada.')
    control=con.execute(text("""SELECT pg_get_userbyid(n.nspowner),pg_get_userbyid(c.relowner),
        c.relkind,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='qa_control' AND c.relname='entorno'""")).one_or_none()
    if control is None or tuple(control)!=('postgres','postgres','r',True,False):
        raise QANoPreparado('Falta el control privado QA2 o su propietario/RLS no coincide.')
    rows=con.execute(text("""SELECT project_ref,project_url,project_name,database_name,
        format_version,created_by FROM qa_control.entorno""")).all()
    expected=(PROJECT,ORIGIN,PROJECT_NAME,'postgres',1,'postgres')
    if len(rows)!=1 or tuple(rows[0])!=expected:
        raise QANoPreparado('Marca QA2 ausente, duplicada o distinta; sin cambios.')
    forbidden=con.execute(text("""SELECT
        has_schema_privilege(current_user,'qa_control','CREATE'),
        has_table_privilege(current_user,'qa_control.entorno','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
        EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')
          AND (has_schema_privilege(r.oid,'qa_control','USAGE,CREATE')
            OR has_table_privilege(r.oid,'qa_control.entorno','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))),
        EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
          WHERE m.roleid=(SELECT oid FROM pg_roles WHERE rolname=current_user)
            AND r.rolname<>'postgres'),
        has_schema_privilege(current_user,'public','CREATE'),
        has_database_privilege(current_user,current_database(),'CREATE')""")).one()
    if any(forbidden):
        raise QANoPreparado('Control QA2 con acceso de escritura o cliente no permitido.')
    policies=con.execute(text("""SELECT cmd,roles,qual,with_check,permissive FROM pg_policies
        WHERE schemaname='qa_control' AND tablename='entorno'""")).all()
    if len(policies)!=1:
        raise QANoPreparado('Políticas de control QA2 distintas de la revisión.')
    p=policies[0]
    if p[0]!='SELECT' or set(p[1])!={'soporte_ti_api'} or p[2]!='singleton' or p[3] is not None or p[4]!='PERMISSIVE':
        raise QANoPreparado('Política de control QA2 distinta de la revisión.')

def verificar_remoto(config):
    # Red exclusivamente hacia el proyecto pinneado y su conexión PostgreSQL QA.
    # Todas las solicitudes HTTP son GET. Nunca se siguen redirecciones ni proxies.
    sys.path.insert(0,str(REPO/'backend'))
    from app.servicios_privados import peticion_privada,cabeceras_supabase
    from sqlalchemy import create_engine,text
    for path in ['/auth/v1/settings','/auth/v1/.well-known/jwks.json']:
        status,body=peticion_privada(ORIGIN+path,headers={'apikey':config.public_key})
        if status!=200:raise QANoPreparado('Auth QA no confirmó su configuración pública.')
        obj=json.loads(body)
        if 'jwks' in path and not any(k.get('alg') in {'ES256','RS256'} for k in obj.get('keys',[])):
            raise QANoPreparado('Falta firma asimétrica compatible con FastAPI (ES256/RS256).')
    status,body=peticion_privada(ORIGIN+'/storage/v1/bucket/'+BUCKET,
        headers=cabeceras_supabase(config.service_key))
    meta=json.loads(body)
    if status!=200 or meta.get('id')!=BUCKET or meta.get('public') is not False:
        raise QANoPreparado('Bucket QA privado no confirmado.')
    if set(meta.get('allowed_mime_types') or [])!={'application/pdf','image/jpeg','image/png'} or not 4_000_000<=int(meta.get('file_size_limit') or 0)<=5_242_880:
        raise QANoPreparado('Formatos o límite del bucket QA distintos de lo previsto.')
    engine=create_engine(config.database_url,echo=False,hide_parameters=True,
        connect_args={'connect_timeout':5,'prepare_threshold':None,'application_name':'grocio_qa_preflight'})
    try:
        with engine.connect() as con:
            con.exec_driver_sql("SET TRANSACTION READ ONLY")
            verificar_marca(con)
            flags=con.execute(text('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit,rolreplication FROM pg_roles WHERE rolname=current_user')).one()
            if any(flags):raise QANoPreparado('El rol API QA tiene privilegios excesivos.')
            if con.execute(text('SELECT count(*) FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)')).scalar_one():
                raise QANoPreparado('El rol API QA no debe heredar ni poder asumir otros roles.')
            tables=dict(con.execute(text("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public'")).all())
            if not TABLES<=set(tables) or not all(tables[t] for t in TABLES):
                raise QANoPreparado('Esquema QA incompleto o RLS no habilitada.')
            policy=con.execute(text("SELECT permissive,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='qa112f_solo_backend'")).one_or_none()
            condition="(bucket_id <> 'incidencias-qa'::text)"
            if policy is None or policy.permissive!='RESTRICTIVE' or policy.cmd!='ALL' or set(policy.roles)!={'anon','authenticated'} or policy.qual!=condition or policy.with_check!=condition:
                raise QANoPreparado('Falta la restricción QA de acceso directo a objetos.')
            if con.execute(text("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename=ANY(:tablas) AND (has_table_privilege('anon',quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT,INSERT,UPDATE,DELETE'))"),{'tablas':list(TABLES)}).scalar_one():
                raise QANoPreparado('Acceso directo de cliente a tablas QA detectado.')
            if con.execute(text("SELECT count(*) FROM public.usuarios WHERE usuario NOT LIKE 'qa\\_%' ESCAPE '\\' OR nombre_completo NOT LIKE 'QA %'")).scalar_one():
                raise QANoPreparado('Perfiles fuera del inventario ficticio QA detectados.')
            profiles=con.execute(text('SELECT rol,count(*) FROM public.usuarios GROUP BY rol')).all()
            if dict(profiles)!={'JEFE':1,'REPRESENTANTE':2,'ASISTENTE':2,'PRACTICANTE':1}:
                raise QANoPreparado('Faltan los seis perfiles ficticios autorizados de QA.')
            # Nunca mostrar UUID, correo, DSN, tokens ni cuerpos del proveedor.
            return {'solo_lectura':True,'proyecto':PROJECT,'auth_jwks':True,'bucket_privado':True,
                'rls_tablas':len(TABLES),'perfiles_por_rol':dict(profiles),'envios':0,'escrituras':0}
    finally:engine.dispose()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('accion',choices=['inventario','configuracion','verificar'])
    args=p.parse_args()
    if args.accion=='inventario':result=inventario()
    else:
        config=configuracion(os.environ)
        result=({'configuracion_local_valida':True,'conexiones':0} if args.accion=='configuracion' else verificar_remoto(config))
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    try:main()
    except QANoPreparado as error:raise SystemExit('QA NO PREPARADO: '+str(error))
    except Exception:raise SystemExit('QA NO PREPARADO: verificación incompleta; sin mostrar datos privados. No se ejecutaron escrituras.')
