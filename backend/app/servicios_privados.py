"""HTTP de servidor: destinos configurados validados, sin proxies/redirecciones/logs."""
import json
from urllib.parse import urlsplit
from urllib.request import Request,build_opener,ProxyHandler,HTTPRedirectHandler
from urllib.error import HTTPError,URLError
from fastapi import HTTPException

class SinRedireccion(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def cabeceras_supabase(clave):
    """Claves secretas opacas por apikey; compatibilidad del service_role JWT.

    Una clave sb_secret no es un JWT de usuario. Nunca se envía como bearer.
    No registra valores y rechaza claves públicas en operaciones privadas.
    """
    if not isinstance(clave,str) or not clave or clave.startswith('sb_publishable_') or any(ord(c)<33 or ord(c)>126 for c in clave):
        raise HTTPException(503,'La credencial privada de Supabase no es válida.')
    headers={'apikey':clave}
    if not clave.startswith('sb_secret_'):headers['Authorization']='Bearer '+clave
    return headers

def origen_supabase(url):
    try:
        parts=urlsplit(url);port=parts.port
    except ValueError:
        raise HTTPException(503,'El destino privado de Supabase requiere validación del operador.') from None
    if parts.scheme!='https' or not parts.hostname or not parts.hostname.endswith('.supabase.co') or parts.username or parts.password or port not in (None,443) or parts.path not in ('','/') or parts.query or parts.fragment:
        raise HTTPException(503,'El destino privado de Supabase requiere validación del operador.')
    return url.rstrip('/')

def peticion_privada(url,*,method='GET',headers=None,data=None,max_bytes=1_000_000):
    # http.client incluye valores inválidos en ValueError; rechazarlos antes
    # evita que una clave mal copiada aparezca en un traceback del servidor.
    if any(not isinstance(v,str) or any(ord(c)<32 or ord(c)>126 for c in v) for v in (headers or {}).values()):
        raise HTTPException(503,'La configuración privada contiene una cabecera no válida.')
    try:
        with build_opener(ProxyHandler({}),SinRedireccion()).open(Request(url,method=method,headers=headers or {},data=data),timeout=15) as response:
            body=response.read(max_bytes+1)
            if len(body)>max_bytes:raise HTTPException(502,'Respuesta del proveedor fuera de límite.')
            return response.status,body
    except HTTPError as error:
        # Leer solo para clasificar; nunca propagar cuerpo ni cabeceras privadas.
        body=error.read(4096)
        try:code=json.loads(body).get('code','')
        except (ValueError,AttributeError):code=''
        return error.code, str(code).encode() if code=='duplicate_parameter' else b''
    except (URLError,TimeoutError,OSError):
        raise HTTPException(502,'No se pudo confirmar la operación del proveedor privado.') from None
