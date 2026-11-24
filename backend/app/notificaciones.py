"""Cola duradera desde historial confirmado; ningún envío dentro del ciclo de incidencias.

Sin procesos al importar. El operador debe ejecutar preparar/procesar explícitamente
en un worker autorizado. No inicia tareas de correo desde FastAPI ni desde Vercel.
"""
import json,re
from html import escape
from datetime import datetime,timezone
from uuid import UUID
from sqlalchemy import text
from app.config import get_settings
from app.servicios_privados import origen_supabase,peticion_privada,cabeceras_supabase
from fastapi import HTTPException

ESTADOS={'CREACION':('Incidencia registrada','Pendiente'), 'ASIGNACION':('Responsable asignado','En revisión'),
    'REASIGNACION':('Responsable actualizado','En revisión'),'AUTOTOMA':('Atención iniciada','En revisión'),
    'SOLUCION':('Solución técnica registrada','En revisión al registrar la solución'),
    'CIERRE':('Cierre técnico registrado','Cerrado'),'REAPERTURA':('Reapertura por observación','En revisión'),
    'OBSERVACION':('Observación registrada','Consultar el ciclo vigente en el sistema'),
    'PRIORIDAD_CONFIRMADA':('Prioridad oficial evaluada','Sin cambio de estado por esta evaluación'),
    'PRIORIDAD_PROVISIONAL':('Propuesta provisional de prioridad','Pendiente de revisión del JEFE')}

def datos_plantilla(contenido):
    titulo,estado=ESTADOS[contenido['accion']]
    # El asunto de correo nunca admite saltos de línea/control. El cuerpo HTML
    # escapa todos los datos variables y no incluye enlaces ni contenido clínico/técnico.
    codigo=re.sub(r'[\x00-\x1f\x7f]', ' ', str(contenido['codigo']))[:25]
    campos=[('Código',codigo),('Asunto',str(contenido['asunto'])),
        ('Estado del evento',estado),('Ciclo',str(contenido['ciclo']))]
    if contenido['accion'] in {'PRIORIDAD_CONFIRMADA','PRIORIDAD_PROVISIONAL'}:
        prioridad=contenido.get('prioridad')
        campos.append(('Prioridad oficial' if contenido['accion']=='PRIORIDAD_CONFIRMADA' else 'Propuesta (no oficial)',
            prioridad if prioridad in {'Alta','Media','Baja'} else 'Consultar evaluación en el sistema'))
    return titulo,codigo,campos

def plantilla(contenido):
    titulo,codigo,campos=datos_plantilla(contenido)
    return (f'Soporte TI · {codigo} · {titulo}',
        'Municipalidad Distrital de Grocio Prado\nSistema de Gestión de Incidencias\n\n'+titulo+'\n'+
        '\n'.join(f'{nombre}: {valor}' for nombre,valor in campos)+
        '\n\nConsulta el sistema institucional para ver el detalle y el estado vigente. Este mensaje no implica conformidad del solicitante.')

def plantilla_html(contenido):
    titulo,_,campos=datos_plantilla(contenido)
    filas=''.join('<tr><th scope="row" style="padding:10px;text-align:left;border-bottom:1px solid #dbe4ee">'+
        escape(nombre)+'</th><td style="padding:10px;border-bottom:1px solid #dbe4ee;overflow-wrap:anywhere">'+
        escape(valor)+'</td></tr>' for nombre,valor in campos)
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>'
        '<body style="margin:0;background:#f4f7fb;color:#17324d;font-family:Arial,sans-serif">'
        '<main style="max-width:640px;margin:24px auto;padding:24px;background:white;border:1px solid #aebfd0;border-radius:8px">'
        '<p style="color:#125c9a;font-weight:bold">Municipalidad Distrital de Grocio Prado</p>'
        '<p>Sistema de Gestión de Incidencias</p><h1 style="font-size:22px">'+escape(titulo)+'</h1>'
        '<table style="width:100%;border-collapse:collapse"><caption style="text-align:left;padding-bottom:12px">Resumen del evento</caption>'+filas+'</table>'
        '<p>Consulta el sistema institucional para ver el detalle y el estado vigente. Este mensaje no implica conformidad del solicitante.</p>'
        '</main></body></html>')

def contenido_evento(row):
    contenido={k:row[k] for k in ['accion','codigo','asunto','ciclo']}
    if row['accion'] in {'PRIORIDAD_CONFIRMADA','PRIORIDAD_PROVISIONAL'}:
        # Se usa la evaluación histórica validada, nunca la prioridad actual de
        # una incidencia que pudo cambiar después. No se copian justificaciones.
        from app.prioridades import DatosPrioridad
        try:
            datos=DatosPrioridad.model_validate_json(row['descripcion'])
            provisional=row['accion']=='PRIORIDAD_PROVISIONAL'
            if datos.ciclo==row['ciclo'] and datos.provisional==provisional and datos.rol_actor==('ASISTENTE' if provisional else 'JEFE'):
                contenido['prioridad']=datos.nueva
        except ValueError:
            pass  # Evento legado no estructurado: aviso sin inventar su valor.
    return contenido

def preparar(db,desde,limite=100):
    """Solo eventos posteriores al corte explícito. UNIQUE evita duplicados entre workers."""
    if desde.tzinfo is None or not 1<=limite<=1000:raise ValueError('Corte con zona horaria y límite 1..1000 requeridos.')
    rows=db.execute(text("""SELECT h.id,
        CASE WHEN h.accion='INTERVENCION' THEN 'SOLUCION' ELSE h.accion END AS accion,
        h.descripcion,h.fecha_registro,i.id AS ticket,i.codigo,i.asunto,i.reportante_id,
        COALESCE((to_jsonb(h)->>'ciclo_atencion')::int,1) AS ciclo
        FROM public.historial_incidencias h JOIN public.incidencias i ON i.id=h.incidencia_id
        WHERE h.fecha_registro>=:desde AND h.accion IN ('CREACION','ASIGNACION','REASIGNACION','AUTOTOMA','CIERRE','REAPERTURA','OBSERVACION','PRIORIDAD_CONFIRMADA','PRIORIDAD_PROVISIONAL','INTERVENCION')
        -- No inferir una solución desde texto libre: la intervención debe ser
        -- final y corresponder inequívocamente a este actor, fecha y ciclo.
        AND (h.accion<>'INTERVENCION' OR (SELECT count(*) FROM public.intervenciones j
            WHERE j.incidencia_id=h.incidencia_id AND j.tecnico_id=h.usuario_id
            AND j.fecha_registro=h.fecha_registro AND j.es_solucion_final
            AND COALESCE((to_jsonb(j)->>'ciclo_atencion')::int,1)=COALESCE((to_jsonb(h)->>'ciclo_atencion')::int,1))=1)
        AND NOT EXISTS(SELECT 1 FROM public.notificaciones_salida n WHERE n.evento_id=h.id)
        ORDER BY h.fecha_registro,h.id LIMIT :limite"""),{'desde':desde,'limite':limite}).mappings().all()
    created=0
    for row in rows:
        recipients={row['reportante_id']}
        if row['accion'] in {'CREACION','REAPERTURA','OBSERVACION','PRIORIDAD_PROVISIONAL'}:
            recipients.update(db.execute(text("SELECT id FROM public.usuarios WHERE rol='JEFE' AND habilitado")).scalars())
        if row['accion'] in {'ASIGNACION','REASIGNACION','AUTOTOMA'}:
            # Responsable vigente a la fecha del evento, nunca el asignado posteriormente.
            assigned=db.execute(text("""SELECT tecnico_id FROM public.asignaciones WHERE incidencia_id=:id
                AND fecha_asignacion<=:fecha AND (fecha_fin IS NULL OR fecha_fin>=:fecha)
                AND COALESCE((to_jsonb(asignaciones)->>'ciclo_atencion')::int,1)=:ciclo
                ORDER BY fecha_asignacion DESC,id DESC LIMIT 1"""),{'id':row['ticket'],'fecha':row['fecha_registro'],'ciclo':row['ciclo']}).scalar_one_or_none()
            if assigned:recipients.add(assigned)
        contenido=json.dumps(contenido_evento(row),ensure_ascii=False)
        for recipient in recipients:
            created+=db.execute(text("""INSERT INTO public.notificaciones_salida(evento_id,destinatario_id,contenido)
                SELECT :evento,:usuario,CAST(:contenido AS jsonb) WHERE EXISTS(SELECT 1 FROM public.usuarios WHERE id=:usuario AND habilitado)
                ON CONFLICT(evento_id,destinatario_id) DO NOTHING"""),{'evento':row['id'],'usuario':recipient,'contenido':contenido}).rowcount
    db.commit();return created

def resolver_correo(usuario_id):
    s=get_settings();origin=origen_supabase(s.supabase_url)
    if not s.supabase_service_role_key:raise HTTPException(503,'Falta configuración privada de Auth para notificaciones.')
    code,body=peticion_privada(f'{origin}/auth/v1/admin/users/{UUID(str(usuario_id))}',headers=cabeceras_supabase(s.supabase_service_role_key))
    if code!=200:raise HTTPException(502,'Auth no confirmó el destinatario autorizado.')
    try:obj=json.loads(body);email=obj['email']
    except (ValueError,KeyError):raise HTTPException(502,'Auth no confirmó el destinatario autorizado.') from None
    if obj.get('id')!=str(usuario_id) or not obj.get('email_confirmed_at') or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):raise HTTPException(502,'Destinatario no confirmado.')
    return email

def mensaje_brevo(id_,correo,contenido,remitente,*,sandbox=False):
    asunto,cuerpo=plantilla(contenido)
    headers={'idempotencyKey':str(id_)}
    if sandbox:headers['X-Sib-Sandbox']='drop'
    return {'sender':{'name':'Municipalidad Distrital de Grocio Prado','email':remitente},'to':[{'email':correo}],
        'subject':asunto,'textContent':cuerpo,'htmlContent':plantilla_html(contenido),'headers':headers}

def validar_brevo_sandbox():
    """Solo validación oficial sin entrega. No consume ni marca la cola como enviada.

    Operación manual privada, nunca llamada por FastAPI o por el worker.
    Aun el sandbox exige una clave y un remitente válidos de una cuenta autorizada.
    """
    from uuid import uuid4
    s=get_settings()
    if not s.brevo_api_key or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',s.correo_remitente):
        raise HTTPException(503,'Falta configuración privada para validar sandbox.')
    mensaje=mensaje_brevo(uuid4(),'prueba@example.invalid',
        {'accion':'CREACION','codigo':'QA-SANDBOX','asunto':'Validación ficticia sin entrega','ciclo':1},s.correo_remitente,sandbox=True)
    code,_=peticion_privada('https://api.brevo.com/v3/smtp/email',method='POST',
        headers={'api-key':s.brevo_api_key,'Content-Type':'application/json','Accept':'application/json'},
        data=json.dumps(mensaje,ensure_ascii=False).encode())
    if code!=201:raise HTTPException(502,'Sandbox no validado; no reintentar automáticamente.')
    return {'validado_sandbox':True,'correos_enviados':0}

def enviar_brevo(id_,correo,contenido):
    s=get_settings()
    if not s.brevo_habilitado or not s.brevo_api_key or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',s.correo_remitente):raise HTTPException(503,'Brevo requiere habilitación, remitente verificado y clave privada del servidor.')
    code,body=peticion_privada('https://api.brevo.com/v3/smtp/email',method='POST',headers={'api-key':s.brevo_api_key,'Content-Type':'application/json','Accept':'application/json'},data=json.dumps({
        **mensaje_brevo(id_,correo,contenido,s.correo_remitente)},ensure_ascii=False).encode())
    if code in (200,201,202) or body==b'duplicate_parameter':return 'enviado'
    if code==429:return 'limitado'
    if code>=500:return 'incierto'
    return 'rechazado'

def procesar_uno(db,*,resolver=resolver_correo,enviar=enviar_brevo):
    s=get_settings()
    if not s.brevo_habilitado:raise HTTPException(503,'Notificaciones deshabilitadas.')
    # Una caída entre envío y confirmación nunca provoca reenvío ciego.
    db.execute(text("UPDATE public.notificaciones_salida SET estado='incierto',error_codigo='CONFIRMACION_PENDIENTE' WHERE estado='enviando' AND fecha_intento<now()-interval '5 minutes'"))
    row=db.execute(text("""SELECT n.* FROM public.notificaciones_salida n JOIN public.usuarios u ON u.id=n.destinatario_id
        WHERE n.estado='pendiente' AND n.intentos<3 AND u.habilitado
        AND (n.fecha_intento IS NULL OR n.fecha_intento<now()-interval '1 minute')
        ORDER BY n.fecha_creacion,n.id FOR UPDATE OF n SKIP LOCKED LIMIT 1""")).mappings().one_or_none()
    if not row:db.commit();return None
    id_=row['id'];db.execute(text("UPDATE public.notificaciones_salida SET estado='enviando',intentos=intentos+1,fecha_intento=now(),error_codigo=NULL WHERE id=:id"),{'id':id_});db.commit()
    try:
        correo=resolver(row['destinatario_id'])
    except Exception:
        estado,error='error','DESTINATARIO_NO_CONFIRMADO'
    else:
        try:result=enviar(id_,correo,row['contenido'])
        except Exception:result='incierto'
        if result=='enviado':estado,error='enviado',None
        elif result=='limitado' and row['intentos']<2:estado,error='pendiente','LIMITE_PROVEEDOR'
        elif result=='rechazado':estado,error='error','PROVEEDOR_RECHAZO'
        else:estado,error='incierto','REVISAR_PROVEEDOR_SIN_REENVIAR'
    db.execute(text("UPDATE public.notificaciones_salida SET estado=:estado,error_codigo=:error,fecha_envio=CASE WHEN :estado='enviado' THEN now() ELSE NULL END WHERE id=:id"),{'id':id_,'estado':estado,'error':error});db.commit()
    return {'id':str(id_),'estado':estado,'error_codigo':error}
