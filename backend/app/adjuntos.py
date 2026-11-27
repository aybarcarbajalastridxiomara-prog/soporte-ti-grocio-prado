"""Contrato de adjuntos privados. Sin rutas locales, URLs públicas ni claves cliente."""
import json,re
from pathlib import PurePath
from urllib.parse import quote
from fastapi import HTTPException
from app.config import get_settings
from app.servicios_privados import origen_supabase,peticion_privada,cabeceras_supabase

MAX_BYTES=4_000_000  # Inferior al límite del proxy serverless; BD admite hasta 10 MiB.
TIPOS={'image/jpeg':{'.jpg','.jpeg'},'image/png':{'.png'},'image/webp':{'.webp'},'application/pdf':{'.pdf'}}

def limites_storage(info):
    """Intersección de la política del bucket con el límite conservador de la API."""
    info=info or {}
    tipos=info.get('allowed_mime_types')
    limite=info.get('file_size_limit')
    if tipos is not None and (not isinstance(tipos,list) or any(not isinstance(t,str) for t in tipos)):
        raise HTTPException(503,'No se pudo verificar la política de formatos del almacenamiento.')
    if limite is not None and (isinstance(limite,bool) or not isinstance(limite,int) or limite<=0):
        raise HTTPException(503,'No se pudo verificar el límite del almacenamiento.')
    permitidos=[t for t in TIPOS if tipos is None or t in tipos or t.split('/')[0]+'/*' in tipos or '*/*' in tipos]
    if not permitidos:raise HTTPException(503,'El almacenamiento no admite los formatos del sistema.')
    return permitidos,min(MAX_BYTES,limite or MAX_BYTES)

def validar_archivo(nombre,tipo,datos):
    if not nombre or len(nombre)>200 or any(ord(c)<32 for c in nombre) or '/' in nombre or '\\' in nombre or nombre in {'.','..'} or PurePath(nombre).suffix.lower() not in TIPOS.get(tipo,set()):
        raise HTTPException(422,'Nombre, extensión o tipo de archivo no permitido.')
    if not datos or len(datos)>MAX_BYTES:raise HTTPException(413,'El archivo debe contener datos y no superar 4 MB.')
    valido=(tipo=='image/jpeg' and datos.startswith(b'\xff\xd8\xff') or tipo=='image/png' and datos.startswith(b'\x89PNG\r\n\x1a\n') or
        tipo=='image/webp' and len(datos)>=12 and datos[:4]==b'RIFF' and datos[8:12]==b'WEBP' or
        tipo=='application/pdf' and datos.startswith(b'%PDF-') and b'%%EOF' in datos[-1024:])
    if not valido:raise HTTPException(422,'El contenido no corresponde al tipo declarado.')

class StoragePrivado:
    def __init__(self):
        s=get_settings()
        if not s.adjuntos_habilitados or not s.supabase_service_role_key or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}',s.adjuntos_bucket):
            raise HTTPException(503,'Adjuntos pendientes de almacenamiento privado y configuración del servidor.')
        self.origen=origen_supabase(s.supabase_url);self.bucket=s.adjuntos_bucket
        self.headers=cabeceras_supabase(s.supabase_service_role_key)
    def verificar_privacidad(self):
        status,body=peticion_privada(f'{self.origen}/storage/v1/bucket/{self.bucket}',headers=self.headers)
        try:obj=json.loads(body)
        except ValueError:obj={}
        if status!=200 or obj.get('id')!=self.bucket or obj.get('public') is not False:raise HTTPException(503,'El almacenamiento debe existir y estar confirmado como privado.')
        return obj
    def ruta(self,key):
        if not re.fullmatch(r'[a-f0-9-]{36}/[a-f0-9]{32}',key):raise HTTPException(503,'Referencia de archivo no disponible.')
        return f'{self.origen}/storage/v1/object/{self.bucket}/{key}'
    def guardar(self,key,tipo,datos):
        tipos,limite=limites_storage(self.verificar_privacidad())
        if tipo not in tipos:raise HTTPException(422,'El formato no está habilitado en el almacenamiento privado.')
        if len(datos)>limite:raise HTTPException(413,'El archivo supera el límite del almacenamiento privado.')
        status,_=peticion_privada(self.ruta(key),method='POST',headers={**self.headers,'Content-Type':tipo,'x-upsert':'false'},data=datos)
        if status not in (200,201):raise HTTPException(502,'El almacenamiento no confirmó el archivo. No se registró un adjunto.')
    def leer(self,key):
        self.verificar_privacidad()
        status,body=peticion_privada(self.ruta(key),headers=self.headers,max_bytes=MAX_BYTES)
        if status!=200:raise HTTPException(502,'No se pudo recuperar el archivo privado.')
        return body
    def descartar(self,key):
        # Solo compensación del objeto recién creado, nunca archivos anteriores.
        peticion_privada(self.ruta(key),method='DELETE',headers=self.headers)

def get_storage():return StoragePrivado()
