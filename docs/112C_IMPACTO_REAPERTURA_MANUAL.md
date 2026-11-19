# Fase 112C: impacto de observaciones sin reapertura automática

18 de noviembre de 2026. **Propuesta pendiente de aprobación específica.** No implementa ni publica el cambio del mecanismo V3/V4. Base a573c15 y cambios locales autorizados de reportes/prioridad/autotoma.

## Conducta vigente y evidencia

V3 registra Observación en verificaciones e historial, dejando Cerrado y sus datos de cierre. V4 registra evaluación e historial y reabre automáticamente a En revisión, incrementando ciclo y limpiando fecha/cerrador del cierre vigente. Se mantiene una evaluación por incidencia en V3 o por ciclo en V4.

Las nuevas pruebas PostgreSQL y las de caracterización conservan esa diferencia y confirman:

- Un cierre normal deja historial, intervención/solución y asignación finalizada. Después de la reapertura actual esas actuaciones permanecen; la autotoma V4 añade una asignación nueva del ciclo y permite otra solución/cierre.
- La reapertura V4 actual no archiva expresamente los valores del cierre vigente antes de limpiarlos. El caso ficticio legado sin historial de cierre confirmó que esos valores pueden quedar sin una instantánea recuperable. Es un riesgo existente que no se corrigió dentro de los puntos 1–3.
- La migración 03 añade ciclos e índice, pero no reconstruye ni archiva cierres faltantes. No debe usarse para dar por protegidos todos los registros existentes.

No se consultó ni alteró PostgreSQL municipal. No se puede afirmar que sus casos legados estén completos o protegidos sin una revisión de lectura autorizada y una estrategia de conservación aprobada.

## Dependencias afectadas

| Componente | Impacto de eliminar la reapertura automática |
| --- | --- |
| v4_reglas.py y v4_verificaciones.py | Observación deberá confirmar evaluación/historial dejando estado/ciclo/cierre intactos. No borrar el camino actual antes de aprobar la transición |
| contexto_verificacion.py y RealVerification | Ajustar textos de resultado/confirmación y mostrar observación pendiente de revisión; conservar la prohibición de evaluar dos veces un mismo cierre |
| seguimiento.py y vista JEFE | Distinguir pendientes, revisadas y reaperturas ejecutadas. El filtro actual solo muestra Cerrado con última Observación; no prueba una revisión del JEFE |
| Operación manual nueva | No existe en FastAPI. Necesitará contrato, autorización JEFE, motivo, precondiciones y transacción; no se propone una URL como si estuviera implementada |
| v4_asignaciones/intervenciones/cierres y autotoma nueva | Requieren ciclo vigente y observación anterior. Deben seguir rechazando responsabilidades y soluciones antiguas; el ciclo solo se abriría tras aprobación manual |
| Historial y reporte institucional | Distinguir cierre, observación, decisión JEFE y reapertura, conservando autores/fechas por ciclo. El contrato de historial actual no expone ciclo como campo independiente |
| Dashboard y listados | Observación pendiente seguirá contando como Cerrado. El cambio a En revisión y sus indicadores ocurrirá al ejecutar la reapertura autorizada |
| Prioridad | Conservar la prioridad oficial ya establecida y sus eventos; no trasladar una propuesta provisional de un ciclo anterior como si fuera del nuevo |
| Esquema V3/V4 y permisos | No habilitar ciclos sobre una estructura incompatible. Preparar cualquier ampliación necesaria como script revisable separado, con respaldo y autorización; sin cambiar RLS automáticamente |
| Pruebas y workflows | Actualizar expectativas de observación automática solo tras aprobación; conservar controles de unicidad, rollback, aislamiento y concurrencia |

## Flujo manual propuesto

1. REPRESENTANTE del área registra Observación sobre un cierre sin evaluar. Se guarda evaluación y evento; el ticket permanece Cerrado, con igual ciclo, fecha y cerrador. Un indicador derivado puede señalar Pendiente de revisión; no hace falta inventar un nuevo estado de incidencia.
2. JEFE revisa la observación y las actuaciones. Registra su decisión con motivo. Si decide conservar el cierre, registrar la revisión sin convertir la Observación original en Conformidad ni reescribirla.
3. Para reabrir, el servidor verifica JEFE habilitado, ticket Cerrado, observación pendiente del ciclo vigente y versión esperada. Bloquea la incidencia, conserva explícitamente todos los datos del cierre anterior y registra quién autorizó la reapertura y cuándo.
4. Solo dentro de esa misma transacción se abre el nuevo ciclo y se limpian los campos del cierre vigente; se conserva el archivo/historial anterior. No reactivar asignaciones antiguas. Si falla el snapshot o cualquier escritura, rollback completo.
5. JEFE asigna o personal TI autorizado toma el ciclo nuevo mediante capacidades comprobadas. Solo la solución final del ciclo permite cerrarlo; el REPRESENTANTE puede evaluar ese nuevo cierre conforme a la unicidad por ciclo.

La estructura de preservación debe conservar, al menos, incidencia/ciclo cerrado, fecha original, cerrador original, asignación y solución de referencia, resumen y procedencia de los datos. Registrar el actor de la conservación por separado del autor del cierre. No fabricar eventos CIERRE retroactivos ni completar UUID, autores o fechas por suposición. Si no puede reconstruirse coherentemente un caso legado, bloquear su reapertura y remitirlo a revisión del operador.

## Regresiones necesarias para autorizar el cambio

| Caso | Resultado esperado después del cambio autorizado |
| --- | --- |
| Observación válida V4 | Evaluación/historial nuevos; Cerrado, ciclo y cierre sin cambios |
| Observación duplicada, otro rol o área | Rechazo sin nuevos eventos o cambios de estado |
| Reapertura por ASISTENTE/PRACTICANTE/REPRESENTANTE o deshabilitado | 403, aunque la interfaz haya sido manipulada |
| JEFE sin observación pendiente, versión/ciclo obsoletos o ticket ya abierto | Conflicto; ninguna reapertura adicional |
| Dos reaperturas simultáneas | Una sola decisión efectiva, un incremento de ciclo y un snapshot; la otra petición se rechaza |
| Error al conservar cierre/historial | Rollback de todo el proceso; el ticket conserva íntegro el cierre anterior |
| Caso legado completo/incompleto | Completo preservado; incompleto bloqueado sin limpiar información |
| Segundo cierre y evaluación | Dos cierres recuperables, actuaciones por ciclo y una evaluación por cada ciclo |
| Toma/asignación concurrentes del nuevo ciclo | Un responsable activo; ninguna actuación reutilizada del anterior |
| Prioridad e indicadores | Prioridad oficial/auditoría preservadas; propuesta anterior no heredada; totales cambian al reabrir, no al observar |
| Compatibilidad V3 | Comportamiento de observación V3 preservado; no intentar ciclos nuevos sin esquema aprobado |

Las pruebas añadidas en esta entrega que esperan reapertura automática describen el comportamiento que debe permanecer intacto hasta la aprobación. Después deberán convertirse expresamente a la nueva expectativa; no se eliminarán para ocultar regresiones.

## Preparación para proteger los registros existentes

Antes de implementar/publicar el mecanismo: aprobar contrato y formato del snapshot; revisar solo en lectura el esquema y los cierres/historiales del destino; identificar casos legados y procedimientos de bloqueo; validar permisos efectivos; disponer de respaldo verificado conforme a la política del operador, fuera del repositorio; ensayar la transición en una copia autorizada o base aislada con casos equivalentes. Cualquier preparación SQL y su ejecución requieren autorización separada.

Esta propuesta no autoriza operaciones municipales ni ejecución de migraciones. El Preview puede compartir datos/Auth con producción. Reportes, prioridad y autotoma quedan implementados solo en local; el cambio de observaciones/reapertura sigue detenido para revisión.
