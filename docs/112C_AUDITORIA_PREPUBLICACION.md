# Fase 112C: auditoría final para commit selectivo y Vercel Preview

18 de noviembre de 2026. Repositorio soporte-ti-grocio-prado. Rama exclusiva `ajustes-docente-v4`. Esta auditoría no autoriza ni ejecuta commit, push, merge, despliegue o escrituras municipales.

## Dictamen y estado de Git

El paquete funcional revisado es apto para preparar un **commit selectivo y un Preview de validación**, sujeto a autorización expresa del operador. No se encontraron regresiones en las verificaciones del candidato, cambios de autenticación/RLS/migraciones, secretos nuevos ni datos personales nuevos. No equivale a certificar el circuito municipal real o los siete bloques Docker pendientes.

HEAD local y rama remota ajustes-docente-v4: `a573c15d322e7c3e8cec4aebe4e2e9b8e49d81bc`. Main remoto: `c074ce3d840f90eb4487d27c516fa2a9c9bba468`. Referencias remotas comprobadas mediante lectura de GitHub, sin modificar refs. Índice Git vacío; no existe todavía un commit 112C.

El número 28 indicado al solicitar la auditoría no coincide con el inventario actual. Antes de añadir este informe se encontraron **48 rutas pendientes: 16 modificadas y 32 nuevas**. Se clasificaron 39 de 112C y nueve pendientes de 112A. Esta auditoría añade dos documentos: el informe y la lista de inclusión. Resultado propuesto: **41 archivos para el commit**, nueve excluidos y 50 rutas pendientes en total. El recuento inicial comunicado como 46/37 se corrigió al enumerar los dos archivos nuevos de pruebas frontend omitidos en esa suma; ambos fueron revisados y probados.

La lista exacta es `docs/112C_ARCHIVOS_PREPUBLICACION.txt`, una ruta por línea, sin comodines. Incluye los 39 archivos funcionales/de pruebas/documentación de 112C más estos dos documentos de auditoría. No se ejecutó git add.

## Clasificación de los cambios incluidos

| Grupo | Archivos / propósito |
| --- | --- |
| Prioridad y autotoma | prioridades.py, operaciones_ti.py, v4_asignaciones.py, lecturas_incidencias.py y los campos opcionales de incidencias.py; RealPriority, RealTake, tiOperations, sugerencia del registro, detalle/listado e historial legible |
| Reportes institucionales | reportes.py de consultas, rutas/reportes.py, exportaciones_reportes.py; RealReports, reportes.ts, menú JEFE, transporte JSON/binario e iconos/estilos |
| Informes técnicos | informes.py y RealTechnicalReport; permiso técnico por asignación propia actual o histórica, separado de los reportes JEFE |
| Integración/dependencias | Registro de routers en main.py; dependencias PDF/XLSX/zona horaria y requirements-test; sin cambios de configuración de servicios |
| Pruebas/CI | Dos runners PostgreSQL 112C, pruebas backend/frontend nuevas y regresiones existentes; workflow de backend instala dependencias de pruebas y ejecuta unittest |
| Documentación | Diagnóstico, planes, impacto de reapertura manual marcado como propuesta, implementación y auditoría. No hay implementación de reapertura manual ni SQL ejecutable nuevo en el paquete |

`backend/tests/test_preentrega_111a.py` se incluye a pesar de su nombre histórico: ya está versionado y su cambio 112C solo añade HistorialIncidencia a la fixture requerida por las lecturas nuevas. No se retiran sus aserciones anteriores. `frontend/tests/ticket-list.test.mjs` también es una regresión anterior ampliada para prioridad provisional. Excluir estos cambios por su antigüedad rompería o debilitaría el paquete nuevo.

RealInstitutionalReport.tsx fue un archivo local no publicado de la implementación intermedia; no se incluye. El archivo final se llama RealTechnicalReport.tsx. App.tsx, el prototipo demostrativo, permanece sin cambios.

## Nueve pendientes de 112A expresamente excluidos

```text
.github/scripts/diagnostico_112a.py
.github/scripts/probar_preparacion_112a.mjs
backend/tests/test_diagnostico_112a.py
database/112a_preparar_perfiles_revision.sql
database/112a_verificar_entorno.sql
docs/112A_VALIDACION_FUNCIONAL.md
docs/112A_VINCULACION_USUARIOS.md
docs/112A_diagnostico_preview.json
docs/112A_vercel_solo_lectura.json
```

Se conservan en el espacio local, sin borrarlos, modificarlos ni incorporarlos a la copia candidata. Sus huellas se compararon para verificar que esta auditoría los mantiene intactos. No se incluye ningún script de vinculación de cuentas o preparación municipal.

## Permisos y ausencia de regresiones

- Menú Reportes y vista permitida solo JEFE en RealApp. FastAPI exige JEFE habilitado independientemente de la interfaz para catálogos, consulta y ambas descargas; revalida el perfil en la instantánea de lectura antes de generar documentos. Sin sesión, técnico ajeno o perfil deshabilitado no se obtiene el reporte institucional.
- El borrador técnico conserva JEFE y ASISTENTE/PRACTICANTE con asignación propia en la incidencia, incluida una asignación finalizada. Un permiso técnico no habilita reportes institucionales. REPRESENTANTE y técnicos ajenos siguen rechazados.
- Prioridad sugerida no se convierte automáticamente en oficial. La propuesta ASISTENTE por AUTOTOMA es provisional, justificada y revisable por JEFE. PRACTICANTE no tiene ese permiso. Historial, actor, fecha, versión/ciclo y rechazo de concurrencia siguen comprobados.
- Autotoma V3/V4 exige rol y disponibilidad; no duplica responsable ni reutiliza el ciclo anterior. Se conservaron atención, solución y cierre por responsable autorizado, incluido JEFE.
- Observaciones y reapertura automática V4 permanecen como estaban. Auth, sesiones, modelos, configuración, scripts SQL y reglas/guardia de reapertura no tienen cambios. Las pruebas confirman la conservación normal del historial; el riesgo legado documentado no se declara resuelto.

## Pruebas de la copia exacta candidata

Se extrajo HEAD fuera del repositorio y se superpusieron solamente las 39 rutas de 112C, sin usar el índice ni crear un commit. Se compararon sus bytes/huellas con los originales. Los nueve archivos excluidos no existen en esa copia. Después se añadieron únicamente estos documentos de auditoría y se anonimizó una referencia nominal en el informe anterior; el código probado no cambió.

| Verificación del candidato | Resultado |
| --- | --- |
| Frontend npm test | **26/26** |
| Frontend npm run build estándar | **Aprobada**, TypeScript y Vite |
| Backend unittest discover | **26/26** |
| PostgreSQL: probar_reportes_112c.py | **23/23**, once casos V3 y doce V4 |
| PostgreSQL: probar_funcional_112c.py | **28/28**, prioridad/autotoma/asignación/concurrencia/cierre/observaciones/reapertura/historial |
| Diff, contenido, coherencia de la lista | Sin errores ni rutas ajenas seleccionadas; índice vacío |

Las 29 pruebas backend del informe anterior incluían tres casos de test_diagnostico_112a.py, que no se publicarán en este paquete. El resultado esperado del candidato es 26 y pasa completo; no se perdieron pruebas versionadas anteriores. El workflow actualizado ejecutará esta misma selección por descubrimiento.

Se conserva además la evidencia ya aprobada del mismo código: preentrega 110F 28/28, 21 bloques de workflows locales aprobados, 16 combinaciones responsive de cuatro roles/ancho CSS real 1440/768/390/320 y foco por teclado. PDF y Excel se generaron/releyeron con cero filas y con 5.000; 5.001 se rechazan expresamente sin truncar, manteniendo el total completo. La descarga de navegador de 142 incidencias se reabrió en ambos formatos y no dependió de las 42 filas de la página visible. La inspección visual PDF cubrió primera, segunda y última página. Estas evidencias y los artefactos ficticios permanecen fuera de Git.

## Secretos, datos y archivos accidentales

Se revisaron todos los archivos incluidos, los diff y los archivos nuevos, incluidos los dos tests frontend. No se detectaron claves privadas, JWT literales, claves de proveedores, correos personales nuevos, UUID de perfiles reales nuevos, documentos exportados, respaldos, temporales o binarios añadidos. No hay .env, dumps o backups versionados. El manifiesto tampoco contiene archivos SQL nuevos.

Las coincidencias iniciales del escáner fueron UUID de fixtures Docker y el correo genérico del placeholder de login, ya presentes sin cambios en HEAD; no son datos municipales nuevos. Los valores ficticios de tests con dominios .invalid son deliberados. Se retiraron los nombres de personas titulares de una frase del informe 112C anterior; no se modificaron cuentas ni código funcional para hacerlo. No se afirma limpiar metadatos históricos de Git ni archivos locales excluidos.

Capturas, libros/PDF, logs y clúster QA no forman parte del manifiesto. No se leyeron claves administrativas ni valores secretos de Vercel; solamente la URL pública de API, tras la verificación completada por el operador. Las huellas de auditoría quedan fuera del repositorio para no incorporar rutas o información privada del entorno local.

## Vercel: verificación actual de solo lectura

| Proyecto | Production | Preview | Entornos personalizados |
| --- | --- | --- | --- |
| soporte-ti-grocio-prado | main | All unassigned git branches | Ninguno |
| soporte-ti-grocio-prado-api | main | All unassigned git branches | Ninguno |

Las pantallas Environments de ambos proyectos fueron consultadas durante esta auditoría. ajustes-docente-v4 no está asignada a Production ni a un entorno personalizado, por lo que su publicación Git corresponde a Preview con esta configuración. No se cambiaron ramas, dominios o ajustes. No hay cambios en los workflows que ejecuten una promoción a Production o un despliegue con --prod.

Se leyó únicamente VITE_API_BASE_URL, alcance Preview y rama ajustes-docente-v4: `https://soporte-ti-git-0fd038-aybarcarbajalastridxiomara-3293s-projects.vercel.app`. Es el alias de backend ya utilizado por el sistema, no una URL inmutable de despliegue. No requiere una modificación de esa variable en esta preparación.

El alias frontend operativo que debe conservarse para la validación es `https://soporte-ti-git-540570-aybarcarbajalastridxiomara-3293s-projects.vercel.app`. Después de publicar se comprobará que ambos despliegues sean Ready/Preview del SHA nuevo y que los alias estén sirviendo ese código. No ampliar CORS ni modificar variables para habilitar dominios adicionales como parte de este paquete.

## Siete bloques Docker pendientes

Docker CLI no está disponible en el entorno local. Estos bloques no se ejecutaron en su formato original y las suites PostgreSQL nuevas no se contabilizan como su aprobación:

| Workflow | Bloque pendiente |
| --- | --- |
| probar-asignacion-v4.yml | Asignaciones por ciclo en PostgreSQL temporal |
| probar-cierre-v4.yml | Paso 109D8C: cierre V4 |
| probar-intervenciones-v4.yml | Paso 109D7F: intervenciones V4 |
| probar-proteccion-v3-v4.yml | Paso 109D9E: protección V3 y continuidad V4 |
| probar-ruta-reapertura-v4.yml | Paso 109D6: ruta FastAPI de reapertura automática |
| validar-integracion-v4.yml | Paso 109D4: detector/integración V4 |
| verificar-backend.yml | Paso 96: concurrencia y cuentas deshabilitadas |

Deben revisarse en GitHub Actions sobre el SHA candidato una vez autorizado el push, o en un entorno Docker aislado. No se instalaron servicios adicionales ni se ejecutaron workflows remotos desde esta auditoría.

## Pendientes para validar el sistema publicado

1. Autorización expresa para commit selectivo y push exclusivamente a ajustes-docente-v4. Usar la lista de inclusión, revisar el índice resultante contra ella y volver a comprobar que no entró ninguno de los nueve excluidos. Evitar una incorporación indiscriminada de archivos locales.
2. Comprobar los checks del SHA, Ready y etiqueta Preview de frontend y backend; nunca promover ni hacer merge a main. Verificar rutas nuevas, esquema/permisos efectivos de lectura y límites de tiempo/memoria del runtime real. Las exportaciones síncronas conservan límites de 5.000 filas y 4 MB; no se aumentarán automáticamente.
3. Validación de lectura del JEFE sobre Reportes y de los informes técnicos autorizados para los otros roles. Cada titular inicia sesión directamente. No descargar/publicar documentos con datos personales reales dentro del repositorio.
4. El Preview no demuestra aislamiento de Auth/PostgreSQL. Tratar sus datos como municipales hasta acreditar un entorno independiente. No registrar, asignar, intervenir, cambiar prioridad, cerrar u observar incidencias reales durante la validación de lectura.
5. El ciclo real completo sigue pendiente: registro, asignación/autotoma y prioridad autorizadas, intervención/solución/cierre, conformidad u observación, historial e indicadores. Requiere entorno FastAPI/PostgreSQL y preferentemente Auth de pruebas independientes, perfiles autorizados, casos/control de evidencias y autorización específica de escritura. No crear proyectos/cuentas ni ejecutar SQL de preparación automáticamente.
6. La observación V4 continúa reabriendo automáticamente. El riesgo de cierres legados sin evidencia histórica completa, y la reapertura manual propuesta, siguen en 112C_IMPACTO_REAPERTURA_MANUAL.md. No ejecutar cambios de estado sobre esos registros ni dar por aprobada la preservación completa de casos legados. Brevo, adjuntos, administración completa y firma/archivo formal de reportes permanecen fuera de alcance.

No se detectó un bloqueo nuevo que impida el commit selectivo y el Preview de validación. Las comprobaciones pendientes se mantienen explícitas; no se declara listo el uso de escritura con datos reales. Main, producción, cuentas, incidencias, RLS y variables permanecen intactos. El trabajo se detiene para aprobación antes de cualquier publicación.
