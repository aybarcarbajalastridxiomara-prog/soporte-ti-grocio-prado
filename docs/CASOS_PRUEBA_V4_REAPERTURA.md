
# Grupo 4 - Casos de prueba V4

## Reapertura de incidencias
Sistema de Soporte TI - Municipalidad de Grocio Prado

Estado: Pendiente de implementación.
Ambiente de pruebas: PostgreSQL temporal.
No ejecutar sobre Supabase real todavía.

## A. Flujo de atención

### CP-01 - Reapertura por observación
Dado un ticket cerrado de su área,
cuando el representante registra una observación,
entonces:
- Se conserva el mismo ID y código.
- El estado cambia a "En revisión".
- Se crea un nuevo ciclo de atención.
- Se conserva el cierre técnico anterior.

### CP-02 - Conformidad
Cuando el representante registra conformidad:
- El ticket permanece Cerrado.
- Se registra quién verificó y cuándo.
- No se abre otro ciclo.

### CP-03 - Nueva asignación
Después de reabrir:
- No se reactiva una asignación antigua.
- Se permite una nueva asignación o autotoma.
- Solo existe una asignación activa por ticket.

### CP-04 - Nueva intervención
El técnico asignado registra:
- Diagnóstico.
- Acciones realizadas.
- Solución aplicada.
- Fecha y responsable.

Las intervenciones anteriores se conservan.

### CP-05 - Segundo cierre
El técnico puede cerrar nuevamente
solo si existe una solución final válida
registrada en el ciclo actual.

No se puede reutilizar una solución antigua.

### CP-06 - Segunda verificación
Después de un nuevo cierre:
- El representante puede verificar otra vez.
- Las verificaciones anteriores se conservan.
- Solo se admite una verificación por ciclo.

## B. Seguridad y validación

### CP-07 - Usuario sin autorización
Un usuario con rol no autorizado
no puede registrar verificaciones.
Resultado esperado: HTTP 403.

### CP-08 - Incidencia de otra área
Un representante no puede verificar
una incidencia ajena a su área.
Resultado esperado: HTTP 404.

### CP-09 - Incidencia sin cerrar
No se puede registrar conformidad u observación
si el ticket no está Cerrado.
Resultado esperado: HTTP 409.

### CP-10 - Observación sin motivo
No se acepta una observación vacía.
Resultado esperado: validación rechazada.

### CP-11 - Verificación duplicada
Dos verificaciones sobre el mismo cierre
no pueden registrarse correctamente.
Solo una debe ser aceptada.

### CP-12 - Concurrencia
Si dos representantes verifican simultáneamente:
- Se registra solo una respuesta por ciclo.
- No aparecen verificaciones duplicadas.
- El historial conserva consistencia.

## C. Integridad de información

### CP-13 - Historial completo
Deben conservarse:
- Registro original.
- Todas las asignaciones.
- Todas las intervenciones.
- Todos los cierres.
- Todas las observaciones y conformidades.
- Responsables y fechas.

### CP-14 - Datos de cierre
Al reabrir una incidencia:
- El estado cambia a En revisión.
- Los campos del cierre vigente se limpian.
- Los cierres anteriores permanecen en historial.

### CP-15 - Error durante la operación
Si falla el registro de una reapertura:
- Se revierte toda la transacción.
- No queda una verificación parcial.
- El ticket conserva su estado anterior.

### CP-16 - Migración de datos existentes
La migración debe conservar:
- Los IDs y códigos existentes.
- Las verificaciones anteriores.
- Las intervenciones y asignaciones.
- Las restricciones de seguridad.

## D. Reglas de aprobación

1. Probar primero sobre PostgreSQL temporal.
2. No modificar la base real durante las pruebas.
3. No eliminar pruebas de la versión anterior.
4. Actualizar las pruebas antiguas que dependan
   del flujo V3, conservando su cobertura.
5. Todas las pruebas deben quedar verdes.
6. Revisar respaldo y migración antes de Supabase.
7. No realizar Merge hasta aprobar V4.

## Resultado actual

16 casos definidos.
0 casos V4 ejecutados.
Implementación pendiente.

## Punto seguro anterior

main: c074ce3
ajustes-docente-v4: 6dbeb1e
