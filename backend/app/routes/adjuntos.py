from uuid import UUID,uuid4
from urllib.parse import quote
from fastapi import APIRouter,Depends,HTTPException,Query,Request
from fastapi.responses import Response
from sqlalchemy import select,text,func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.auth import get_current_user, require_roles
from app.db import get_db
from app.config import get_settings
from app.models import Incidencia,Evidencia,Usuario,Asignacion
from app.lecturas_incidencias import condicion_visibilidad
from app.v4_esquema import esquema_v4_disponible
from app.adjuntos import MAX_BYTES,TIPOS,get_storage,validar_archivo,limites_storage

router=APIRouter(prefix='/api/incidencias',tags=['Adjuntos privados'])

def ticket_autorizado(db,id_,usuario,bloquear=False):
    query=select(Incidencia).where(Incidencia.id==id_,condicion_visibilidad(usuario))
    ticket=db.scalar(query.with_for_update() if bloquear else query)
    if ticket is None:raise HTTPException(404,'Incidencia no encontrada.')
    return ticket

def puede_adjuntar(db,ticket,usuario):
    if ticket.estado=='Cerrado':return False
    if usuario.rol=='REPRESENTANTE':return ticket.area_id==usuario.area_id
    if usuario.rol not in {'JEFE','ASISTENTE','PRACTICANTE'}:return False
    return db.scalar(select(Asignacion.id).where(Asignacion.incidencia_id==ticket.id,Asignacion.tecnico_id==usuario.id,Asignacion.fecha_fin.is_(None)).limit(1)) is not None

def metadata(e):
    return {k:getattr(e,k) for k in ['id','nombre_archivo','tipo_archivo','tamano_bytes','usuario_id','fecha_registro']}

def configuracion_carga():
    habilitado=get_settings().adjuntos_habilitados
    tipos,maximo=list(TIPOS),MAX_BYTES
    motivo='Carga pendiente de configurar y validar el almacenamiento privado.'
    if habilitado:
        try:
            tipos,maximo=limites_storage(get_storage().verificar_privacidad())
            motivo='Almacenamiento privado verificado.'
        except HTTPException:habilitado=False;motivo='El almacenamiento privado no está verificado; la carga permanece deshabilitada.'
    return {'carga_habilitada':habilitado,'maximo_bytes':maximo,'tipos':tipos,'motivo':motivo}


@router.get('/adjuntos/configuracion-registro')
def configuracion_registro(_usuario: Usuario = Depends(require_roles("REPRESENTANTE"))):
    return configuracion_carga()


@router.get('/{incidencia_id}/adjuntos')
def listar(incidencia_id:UUID,usuario:Usuario=Depends(get_current_user),db:Session=Depends(get_db)):
    ticket=ticket_autorizado(db,incidencia_id,usuario)
    rows=db.scalars(select(Evidencia).where(Evidencia.incidencia_id==incidencia_id).order_by(Evidencia.fecha_registro,Evidencia.id)).all()
    config = configuracion_carga()
    if config['carga_habilitada'] and not puede_adjuntar(db,ticket,usuario):
        config.update(carga_habilitada=False, motivo='Solo el área solicitante o el responsable activo pueden adjuntar a una incidencia abierta.')
    return {'archivos':[metadata(e) for e in rows],**config}

@router.post('/{incidencia_id}/adjuntos',status_code=201)
async def subir(incidencia_id:UUID,request:Request,nombre:str=Query(min_length=1,max_length=200),usuario:Usuario=Depends(get_current_user),db:Session=Depends(get_db)):
    ticket=ticket_autorizado(db,incidencia_id,usuario)
    if not puede_adjuntar(db,ticket,usuario):raise HTTPException(403,'Solo el área solicitante o el responsable activo pueden adjuntar a una incidencia abierta.')
    storage=get_storage()  # Falla cerrado si no existe configuración privada.
    data=bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data)>MAX_BYTES:raise HTTPException(413,'El archivo supera 4 MB.')
    tipo=request.headers.get('content-type','').split(';')[0].strip().lower()
    validar_archivo(nombre,tipo,data)
    ticket=ticket_autorizado(db,incidencia_id,usuario,bloquear=True)
    db.refresh(ticket)
    if not puede_adjuntar(db,ticket,usuario):raise HTTPException(409,'La disponibilidad cambió; actualiza la incidencia antes de adjuntar.')
    if db.scalar(select(func.count()).select_from(Evidencia).where(Evidencia.incidencia_id==incidencia_id))>=10:raise HTTPException(409,'Máximo de diez adjuntos por incidencia.')
    id_=uuid4();key=f'{incidencia_id}/{id_.hex}'
    v4=esquema_v4_disponible(db)
    ciclo=db.execute(text('SELECT ciclo_actual FROM public.incidencias WHERE id=:id'),{'id':incidencia_id}).scalar_one() if v4 else 1
    storage.guardar(key,tipo,bytes(data))
    try:
        # La tabla y sus permisos INSERT ya existen. V4 escribe el ciclo real.
        columnas=',ciclo_atencion' if v4 else '';valores=',:ciclo' if v4 else ''
        db.execute(text(f'''INSERT INTO public.evidencias(id,incidencia_id,usuario_id,nombre_archivo,tipo_archivo,tamano_bytes,ruta_archivo{columnas})
            VALUES(:id,:ticket,:usuario,:nombre,:tipo,:tamano,:key{valores})'''),{'id':id_,'ticket':incidencia_id,'usuario':usuario.id,'nombre':nombre,'tipo':tipo,'tamano':len(data),'key':key,'ciclo':ciclo})
        db.execute(text(f'''INSERT INTO public.historial_incidencias(incidencia_id,usuario_id,accion,descripcion{columnas})
            VALUES(:ticket,:usuario,'ADJUNTO_REGISTRADO',:detalle{valores})'''),{'ticket':incidencia_id,'usuario':usuario.id,'detalle':f'Adjunto privado {id_}; tipo {tipo}; {len(data)} bytes.','ciclo':ciclo})
        db.commit()
    except Exception:
        db.rollback()
        try:storage.descartar(key)
        except Exception:pass  # Posible objeto huérfano privado; no afirmar atomicidad entre servicios.
        raise HTTPException(503,'No se confirmó el registro del adjunto. Revisa el listado antes de reintentar.') from None
    return {'id':id_,'nombre_archivo':nombre,'tipo_archivo':tipo,'tamano_bytes':len(data)}

@router.get('/{incidencia_id}/adjuntos/{adjunto_id}/descargar')
def descargar(incidencia_id:UUID,adjunto_id:UUID,usuario:Usuario=Depends(get_current_user),db:Session=Depends(get_db)):
    ticket_autorizado(db,incidencia_id,usuario)
    e=db.scalar(select(Evidencia).where(Evidencia.id==adjunto_id,Evidencia.incidencia_id==incidencia_id))
    if e is None:raise HTTPException(404,'Adjunto no encontrado.')
    if e.ruta_archivo!=f'{incidencia_id}/{adjunto_id.hex}':raise HTTPException(503,'El archivo anterior necesita validación de su ubicación privada.')
    data=get_storage().leer(e.ruta_archivo)
    if len(data)!=e.tamano_bytes:raise HTTPException(502,'El almacenamiento no confirmó el tamaño registrado.')
    validar_archivo(e.nombre_archivo,e.tipo_archivo,data)
    return Response(data,media_type=e.tipo_archivo,headers={'Content-Disposition':"attachment; filename*=UTF-8''"+quote(e.nombre_archivo,safe=''),
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"})
