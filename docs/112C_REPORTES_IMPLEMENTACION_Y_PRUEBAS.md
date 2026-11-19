# Fase 112C: Reportes institucionales implementados localmente

18 de noviembre de 2026. Rama exclusiva `ajustes-docente-v4`; HEAD conservado en `a573c15d322e7c3e8cec4aebe4e2e9b8e49d81bc`. Sin commit, push, merge ni despliegue. Este informe sustituye el estado pendiente del plan de Reportes y corrige la clasificación inicial del borrador técnico.

## Funciones terminadas

- Sección lateral **Reportes**, solo para JEFE, con autorización adicional de vista y autorización independiente en FastAPI. No aparece para REPRESENTANTE, ASISTENTE o PRACTICANTE. Se reutilizan componentes, colores, tarjetas, tabla, controles y navegación del sistema conciliado con Figma. Es una extensión del diseño aprobado; el prototipo original de seis pantallas no aporta una pantalla específica de Reportes.
- Filtros por fecha de registro desde/hasta, área, estado, prioridad oficial y responsable actual o de cierre. Los catálogos proceden de PostgreSQL, incluyen áreas inactivas y responsables históricos/deshabilitados cuando corresponde. No se consultan correos de Supabase Auth ni se habilita administración.
- Cuatro indicadores completos y desgloses por área, prioridad y responsable. Se calculan en PostgreSQL sobre todas las coincidencias, antes de paginar. No se reutiliza el arreglo de los últimos 50/100 tickets del dashboard.
- Tabla con las siete columnas de información y acceso al detalle. Paginación de 25/50/100 filas por página, total completo, orden estable fecha/id y ajuste a la última página si cambia el número de resultados. Cabeceras conservadas con cero registros; carga, error y vacío diferenciados.
- PDF y Excel `.xlsx` reales, generados en el backend sobre todas las coincidencias dentro del límite explícito de exportación. Ambos identifican a la Municipalidad Distrital de Grocio Prado, período por fecha de registro, filtros, fecha de generación y zona horaria America/Lima. No incorporan firmas, sellos, numeración oficial ni información inventada.
- El PDF contiene tabla paginada, cabeceras repetidas y número de página. El Excel contiene Resumen, Filtros e Incidencias, fechas/números tipados, autofiltro y cabecera congelada. No es CSV/HTML renombrado.

## Rutas y autorización

| Ruta existente en el código local | Autorización y finalidad |
| --- | --- |
| `GET /api/reportes/catalogos` | JEFE habilitado; áreas y responsables reales para filtros |
| `GET /api/reportes/incidencias` | JEFE habilitado; filtros, resumen, desgloses, fecha de corte y página |
| `GET /api/reportes/incidencias/exportar?formato=pdf` | JEFE habilitado; PDF del conjunto filtrado |
| `GET /api/reportes/incidencias/exportar?formato=xlsx` | JEFE habilitado; libro Excel del conjunto filtrado |
| `GET /api/incidencias/{id}/informe-tecnico/borrador` | Permiso técnico previo restaurado: JEFE o ASISTENTE/PRACTICANTE que hayan tenido asignación propia en esa incidencia, incluso finalizada. REPRESENTANTE y técnicos ajenos rechazados |

Cada ruta institucional usa require_roles("JEFE") y revalida el perfil habilitado en la instantánea de lectura. No se confía en actor/rol enviados por el navegador y no se generan archivos para peticiones rechazadas. El permiso técnico no habilita reportes ni descargas institucionales. La pestaña del detalle se llama **Informe técnico**; el módulo institucional está separado.

Las consultas de detalle/intervenciones/historial, los indicadores por rol/área y las operaciones técnicas existentes conservan sus reglas. No se modificaron auth.py, session.ts, modelos, RLS ni el mecanismo de observaciones/reapertura.

## Coherencia, fechas y límites

La consulta compartida evita multiplicar incidencias por asignaciones históricas. En abiertas, responsable significa asignación activa del ciclo vigente; en Cerrado significa el cerrador registrado. No representa todos los participantes de todos los ciclos.

Desde/hasta son días inclusivos de America/Lima y se convierten a límites UTC >= inicio / < día siguiente al fin. Se rechazan fechas invertidas, UUID inválidos/inexistentes, estados/prioridades no admitidos, paginación inválida y parámetros extra. Las estadísticas describen **estados actuales de incidencias registradas en el período**, no una reconstrucción histórica de sus estados a esa fecha.

La sugerencia y la prioridad provisional siguen separadas de la oficial. Null es Pendiente de evaluación; los valores legados no reconocidos se pueden filtrar como No clasificada, sin modificarlos. Una propuesta provisional se identifica como tal y no cuenta como Alta/Media/Baja oficial.

En PostgreSQL, cada reporte abre una transacción propia REPEATABLE READ, READ ONLY, revalida al JEFE y consulta metadatos, conteos y filas en la misma instantánea. Finaliza con rollback de la lectura. No crea configuraciones persistentes ni retiene una segunda conexión del pool. Una prueba inserta otro registro ficticio entre resumen y página desde otra conexión: la respuesta mantiene su total y filas coherentes; la siguiente solicitud ve el registro nuevo. Se comprobó que la conexión vuelve a admitir las escrituras técnicas autorizadas después de finalizar la lectura.

La consulta/paginación no se limita a 100 incidencias totales. **La exportación síncrona admite hasta 5.000 coincidencias y 4.000.000 bytes**, con margen respecto al límite de respuesta de Vercel documentado en el plan. Si se excede, responde con error claro para reducir rango/filtros y no genera un archivo parcial. La pantalla sigue mostrando el total completo. La viabilidad con latencia y límites del proyecto Vercel concreto sigue pendiente de revisión Preview autorizada, sin cambiar su configuración.

## Seguridad de los archivos

Las descargas usan Authorization, renovación de sesión existente, validación de estado/MIME/tamaño y cancelación al salir. No se ponen tokens en URLs, se persisten documentos en el servidor ni se habilitan enlaces públicos. Respuestas institucionales no-store y archivos attachment/nosniff. No fue necesario ampliar CORS ni exponer Content-Disposition al navegador; el cliente usa un nombre controlado.

Texto de usuarios escrito como literal en Excel, incluso si empieza con =, +, -, @ o #REF!; pruebas reabren los libros y confirman ausencia de fórmulas, hipervínculos y macros. En PDF se escapa el marcado y se usan fuentes incluidas en ReportLab, sin cargar URLs de imágenes/fuentes suministradas por el usuario. No se exponen excepciones internas, SQL o rutas privadas en errores de generación.

Dependencias nuevas de aplicación: ReportLab 5.1.0, openpyxl 3.1.5 y tzdata 2026.6, fijadas en requirements.txt. Verificación de compatibilidad ejecutada con Python 3.12; pip check sin conflictos. pypdf 7.1.1 es verificador de pruebas en requirements-test.txt, no requisito de producción. Las instalaciones de QA se hicieron en el entorno privado de pruebas, fuera del repositorio y sin modificar servicios o configuración municipal.

## Archivos de este complemento

| Archivo | Cambio |
| --- | --- |
| `backend/app/reportes.py` (nuevo) | Contratos de filtros, fecha Lima, consulta base, totales/desgloses y filas compartidas |
| `backend/app/exportaciones_reportes.py` (nuevo) | PDF/Excel en memoria y disponibilidad de formatos |
| `backend/app/routes/reportes.py` (nuevo) | Autorización JEFE, instantánea, catálogos, consulta y descarga protegida |
| `backend/app/main.py` | Registra el router institucional |
| `backend/app/routes/informes.py` | Restaura el permiso técnico por participación; separado del módulo institucional |
| `backend/requirements.txt` | Dependencias de exportación y zona horaria fijadas |
| `backend/requirements-test.txt` (nuevo) | Dependencias reproducibles de pruebas, incluido pypdf |
| `backend/tests/test_reportes_112c.py` (nuevo) | Cuatro pruebas de contratos/archivos vacíos/texto literal |
| `backend/tests/test_diagnostico_112c.py` | Restaura la expectativa de acceso técnico autorizado, conservando negativas |
| `.github/scripts/probar_reportes_112c.py` (nuevo) | 23 casos PostgreSQL V3/V4 aislados de reportes, archivos y concurrencia de lectura |
| `.github/scripts/probar_funcional_112c.py` | Conserva regresiones de prioridad/autotoma; comprueba separación técnico/institucional |
| `.github/workflows/verificar-backend.yml` | Reutiliza requirements-test, añade unittest discover y conserva pruebas técnicas previas |
| `frontend/src/RealReports.tsx` (nuevo) | Vista, filtros, indicadores, desgloses, paginación y descargas |
| `frontend/src/reportes.ts` (nuevo) | Consultas y exportación con lista cerrada de filtros; no envía paginación al exportar |
| `frontend/src/RealApp.tsx` y `RealUI.tsx` | Menú/vista JEFE e iconos coherentes con el sistema |
| `frontend/src/api.ts` | Comparte transporte autenticado JSON/binario con la misma renovación y errores |
| `frontend/src/RealTechnicalReport.tsx` | Sustituye el archivo local no publicado RealInstitutionalReport.tsx y conserva la consulta técnica |
| `frontend/src/RealTicketDetail.tsx` | Pestaña técnica para JEFE/ASISTENTE/PRACTICANTE; servidor verifica participación |
| `frontend/src/index.css` | Estilos acotados del módulo; foco y responsive |
| `frontend/tests/reportes.test.mjs` (nuevo) | Seis pruebas de filtros/transporte, archivos, renovación/errores y render inicial |
| Documentos 112C de diagnóstico, implementación y plan | Notas de actualización con enlace a este estado vigente |

Los cambios anteriores de prioridad/autotoma siguen en el árbol de trabajo. Los nueve pendientes de 112A permanecen intactos y separados; no se incorporaron datos personales, SQL de vinculación, respaldos, capturas ni archivos generados al módulo.

## Resultados de pruebas

| Comprobación | Resultado |
| --- | --- |
| npm test | **26/26**: 20 anteriores conservadas y seis nuevas de reportes |
| npm run build estándar | **Aprobada**, TypeScript/Vite. También se compiló el modo real de QA apuntando exclusivamente a localhost, con artefactos fuera de Git |
| unittest discover backend/tests | **29/29**: 25 existentes y cuatro nuevas |
| probar_reportes_112c.py | **23/23** sobre PostgreSQL aislado: 11 V3 y 12 V4 |
| probar_funcional_112c.py | **28/28**: prioridad, autotoma, asignación, cierre, observaciones, reapertura automática V4 e historial |
| Preentrega 110F | **28/28**, incluidas autenticación, rutas, CORS y banderas |
| Bloques de workflows reproducibles localmente | **21 aprobados, cero fallidos**. Siete bloques requieren Docker y no se ejecutaron en su formato original; no se contabilizan como aprobados por las pruebas nuevas |
| Instalación/sintaxis/diff | pip check, compileall y git diff --check aprobados; sin cambios en los archivos protegidos del flujo V3/V4 |
| Navegador en compilación final | **16 combinaciones** con anchos CSS reales 1440/768/390/320: Reportes del JEFE y regresión de menú/vista de los otros tres roles, sin desbordamientos ni campos fuera del ancho |

Casos destacados: acceso directo 401/403, perfil deshabilitado, técnico autorizado al borrador pero no a reportes, cinco filtros combinados, límites de fecha Lima, 237 registros paginados sin duplicaciones, nulos/legados/provisionales, responsable JEFE/deshabilitado/ciclo reabierto, consulta read-only consistente ante otra inserción concurrente, errores SQL y de generadores sin detalles privados, ausencia de formatos, exportaciones vacías y límites explícitos de filas/bytes. PDF y Excel de 5.000 incidencias se generaron y releyeron; 5.001 se rechazan sin truncamiento y el total de consulta continúa completo.

Revisión visual PDF mediante Poppler: primera página, segunda y última del ejemplo QA de nueve páginas, con siete columnas, tildes, filtros, cabeceras repetidas y pies legibles, sin cortes/solapamientos. Lectura de contenido mediante pypdf y openpyxl. Las capturas y documentos ficticios permanecen fuera de Git.

En navegador, segunda página con tamaño 100 mostró 101–142 y 42 filas, conservando total 142. El PDF descargado contiene los 142 códigos y nueve páginas; el Excel descargado se reabrió con 142 filas y hojas Resumen/Filtros/Incidencias. La primera comprobación Excel solo acreditaba el mensaje de generación; se repitió esperando el evento y archivo de descarga y finalmente se verificó el libro guardado. No se declara una descarga confirmada solo por mostrar un aviso.

Se comprobaron filtros combinados desde/hasta/área/estado/prioridad/responsable, vacío con cuatro ceros y cabeceras, bloqueo de exportación mientras hay filtros pendientes y foco visible por teclado. Un error 503 inyectado únicamente en el gateway QA muestra cuatro «—», errores legibles y descargas deshabilitadas; Actualizar recupera la consulta. ASISTENTE conservó en pantalla su borrador técnico histórico; los otros roles no tienen entrada Reportes. Ninguna excepción JavaScript sin gestionar en la revisión final.

El fallo inicial del test PDF fue una comparación que no normalizaba saltos de línea válidos de tabla; se corrigió la aserción, no el contenido. El primer build encontró la restricción de lectura de esbuild del sandbox; el mismo comando estándar pasó con autorización de ejecución local. Las incidencias del gateway auxiliar de QA se corrigieron fuera del código del producto. Persiste un aviso no bloqueante de deprecación Starlette/httpx en el entorno de pruebas.

## Reproducción y aislamiento

1. Entorno Python de pruebas privado: instalar `backend/requirements-test.txt`. Frontend: dependencias del lockfile y npm test / npm run build.
2. Usar exclusivamente un clúster PostgreSQL **nuevo de QA**, loopback, con el marcador `grocio.entorno_pruebas=112c_aislado` y rol local qa112c. Los runners rechazan otro servidor y no aceptan hosts/URLs remotos.
3. Ejecutar `python .github/scripts/probar_reportes_112c.py --puerto 55432` y `python .github/scripts/probar_funcional_112c.py --puerto 55432`. Cada clase crea y elimina únicamente su base de nombre aleatorio guardado; reproduce el esquema/permisos existentes en tablas nuevas. No ejecuta migraciones sobre datos existentes. La tabla auth del fixture es un sustituto local para FK, no Supabase Authentication.
4. Backend: desde backend, `python -m unittest discover -s tests -v`. Las fixtures desactivan carga de .env y conexiones municipales. Los bloques históricos se revisaron mediante probar_workflows_local.py y preentrega_110f.py en ese mismo entorno aislado.
5. La prueba de navegador sirvió frontend/FastAPI reales en 127.0.0.1:8767 contra el clúster local marcado en 55432. Solo la identidad de autenticación se sustituyó por perfiles ficticios locales. No se usaron las sesiones ni las cuentas de las personas titulares ni se consultó el Preview municipal.

## Pendientes y conservación

No queda un fallo crítico abierto en las pruebas locales de este módulo. Falta la revisión del usuario y, con autorización independiente, publicación/validación en Preview, comprobación de permisos efectivos y límites del backend desplegado y recorridos de lectura con perfiles reales. Los workflows no se ejecutaron en GitHub porque no hubo push.

Firma, sello, numeración oficial, archivo institucional persistente, descargas asíncronas por encima del límite y auditoría persistente de emisiones no forman parte de esta primera versión. Brevo, adjuntos y administración completa siguen pendientes.

La reapertura automática V4 permanece intacta. El riesgo legado de cierres sin historial completo documentado en 112C_IMPACTO_REAPERTURA_MANUAL.md sigue pendiente de la aprobación específica del mecanismo manual; los reportes no alteran estados ni reparan esos registros. No se ejecutaron migraciones, SQL remoto, cambios de RLS, cuentas, contraseñas, credenciales, variables de entorno o datos municipales. Gateway y clúster de QA quedaron detenidos; las bases ficticias residuales se descartaron exclusivamente en el clúster marcado. Las evidencias ficticias quedan fuera del repositorio. Main y producción permanecen intactos.
