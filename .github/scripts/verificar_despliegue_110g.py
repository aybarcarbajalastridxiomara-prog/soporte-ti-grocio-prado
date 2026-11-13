"""110G: comprobación EXTERNA, de SOLO LECTURA, de Vercel/API.
No usa tokens, no crea usuarios, no modifica Supabase y no realiza migraciones.
Ejecutar en GitHub Actions. Las URL se definen como variables no secretas.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

API = os.getenv('API_PUBLICA', 'https://soporte-ti-grocio-prado-api.vercel.app').strip().rstrip('/')
FRONT = os.getenv('FRONTEND_PUBLICO', 'https://soporte-ti-grocio-prado.vercel.app').strip().rstrip('/')
OUT = Path('artifacts/110g_status.json')
resultados: list[dict[str, object]] = []


def verificar(condicion: bool, titulo: str, detalle: str = '') -> None:
    estado = 'OK' if condicion else 'FALLO'
    resultados.append({'control': titulo, 'estado': estado, 'detalle': detalle[:300]})
    print(f'[{estado}] {titulo}' + (f' - {detalle}' if detalle else ''), flush=True)


def pedir(url: str, metodo: str = 'GET', headers: dict[str, str] | None = None):
    req = Request(url, method=metodo, headers={'Accept': 'application/json, text/html', **(headers or {})})
    try:
        with urlopen(req, timeout=12) as r:
            return r.status, dict(r.headers.items()), r.read(50000).decode('utf-8', errors='replace')
    except HTTPError as exc:
        return exc.code, dict(exc.headers.items()), exc.read(10000).decode('utf-8', errors='replace')
    except (URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(f'Error de conexión ({type(exc).__name__}); revisar DNS, Vercel o acceso público') from exc


def cabecera(headers: dict[str, str], nombre: str) -> str:
    return next((str(v) for k, v in headers.items() if k.lower() == nombre.lower()), '')


def evaluar(nombre: str, funcion):
    try:
        funcion()
    except Exception as exc:
        verificar(False, nombre, f'{type(exc).__name__}: {str(exc)[:170]}')


def urls_seguras():
    for nombre, url in [('API', API), ('Frontend', FRONT)]:
        info = urlparse(url)
        verificar(info.scheme == 'https' and bool(info.netloc) and not info.username, f'{nombre}: URL HTTPS válida')


def frontend():
    codigo, encabezados, cuerpo = pedir(FRONT + '/')
    verificar(codigo == 200 and 'text/html' in cabecera(encabezados, 'content-type').lower(), 'Frontend: HTML accesible', f'HTTP {codigo}')
    verificar('id="root"' in cuerpo or "id='root'" in cuerpo, 'Frontend: contenedor React presente')


def api_salud():
    codigo, _, cuerpo = pedir(API + '/api/health')
    verificar(codigo == 200, 'API: /api/health responde HTTP 200', f'HTTP {codigo}')
    try:
        datos = json.loads(cuerpo)
    except json.JSONDecodeError:
        verificar(False, 'API: respuesta JSON válida', 'La respuesta no es JSON (posible página de error/protección Vercel)')
        return
    verificar(datos.get('estado') == 'ok', 'API: servicio operativo', f"estado={datos.get('estado')}")
    verificar(datos.get('base_datos') == 'conectada', 'API: PostgreSQL conectado', f"base_datos={datos.get('base_datos')}")


def sin_sesion():
    for ruta in ('/api/me', '/api/incidencias'):
        codigo, _, _ = pedir(API + ruta)
        verificar(codigo == 401, f'Seguridad: {ruta} rechaza acceso anónimo', f'HTTP {codigo}; esperado 401')


def cors():
    origen = FRONT
    opts = {'Origin': origen, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization'}
    codigo, headers, _ = pedir(API + '/api/health', 'OPTIONS', opts)
    permitido = cabecera(headers, 'access-control-allow-origin')
    verificar(codigo == 200 and permitido == origen, 'CORS: frontend autorizado', f'HTTP {codigo}; origen={permitido or "no permitido"}')
    no_permitido = 'https://origen-no-autorizado.invalid'
    opts['Origin'] = no_permitido
    codigo, headers, _ = pedir(API + '/api/health', 'OPTIONS', opts)
    permitido = cabecera(headers, 'access-control-allow-origin')
    verificar(codigo == 400 and not permitido, 'CORS: origen no autorizado bloqueado', f'HTTP {codigo}')


def guardar():
    OUT.parent.mkdir(exist_ok=True, parents=True)
    resumen = {'etapa': '110G1', 'fecha_utc': datetime.now(timezone.utc).isoformat(),
               'api': API, 'frontend': FRONT,
               'aprobados': sum(v['estado'] == 'OK' for v in resultados),
               'total': len(resultados), 'resultados': resultados,
               'nota': 'Diagnóstico de infraestructura. NO prueba login real, permisos de roles ni operaciones de escritura.'}
    OUT.write_text(json.dumps(resumen, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    summary = os.getenv('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as f:
            f.write('## Grupo 4 · Fase 110G1 — Vercel/API (solo lectura)\n\n')
            f.write('| Control | Estado | Detalle |\n|---|---|---|\n')
            for item in resultados:
                detalle = str(item['detalle']).replace('|', '/').replace('\n', ' ')
                f.write(f"| {item['control']} | {item['estado']} | {detalle} |\n")
            f.write('\n**No equivale a prueba manual de acceso ni a validación de producción.**\n')
    print(f"\nFASE 110G1: {resumen['aprobados']}/{resumen['total']} controles aprobados", flush=True)
    return resumen['aprobados'] == resumen['total']


if __name__ == '__main__':
    evaluar('Configuración HTTPS', urls_seguras)
    evaluar('Frontend desplegado', frontend)
    evaluar('API y base de datos', api_salud)
    evaluar('Autorización de endpoints', sin_sesion)
    evaluar('Política de CORS', cors)
    sys.exit(0 if guardar() else 1)
