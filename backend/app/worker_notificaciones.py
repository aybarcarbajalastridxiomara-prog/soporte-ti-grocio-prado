"""Worker explícito. Importar no conecta, crea datos ni envía mensajes."""
import argparse
from datetime import datetime
from sqlalchemy.orm import Session
from app.db import get_engine
from app.notificaciones import preparar,procesar_uno

def main():
    p=argparse.ArgumentParser(description='Cola de correo institucional; operación privada del servidor.')
    p.add_argument('--preparar-desde',type=datetime.fromisoformat)
    p.add_argument('--enviar',action='store_true')
    p.add_argument('--autorizar-operacion',action='store_true')
    p.add_argument('--limite',type=int,default=25)
    args=p.parse_args()
    if not args.autorizar_operacion or not (args.preparar_desde or args.enviar) or not 1<=args.limite<=100:
        p.error('Requiere autorización explícita, acción y límite 1..100. Sin cambios.')
    with Session(get_engine()) as db:
        if args.preparar_desde:
            print('Registros preparados:',preparar(db,args.preparar_desde,args.limite))
        if args.enviar:
            for _ in range(args.limite):
                result=procesar_uno(db)
                if result is None:break
                print('Resultado:',result['estado'],result['error_codigo'] or 'OK')
if __name__=='__main__':
    try:main()
    except Exception:
        raise SystemExit('Operación no completada. Revisa configuración, cola y estado del proveedor; no reintentes envíos inciertos automáticamente.')
