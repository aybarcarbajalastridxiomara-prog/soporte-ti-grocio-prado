
# Grupo 4 - Plan V4: Reapertura de incidencias

## Estado
Propuesta de implementación.
No ejecutar migraciones sobre Supabase todavía.

## Objetivo
Permitir que un representante municipal registre
observaciones y que el mismo ticket vuelva a
atenderse hasta obtener conformidad.

## Reglas del flujo

1. Conservar los estados:
   Pendiente, En revisión y Cerrado.

2. El representante solo puede evaluar una
   incidencia cerrada de su propia área.

3. Si registra conformidad, el ticket permanece
   Cerrado.

4. Si registra una observación, el ticket vuelve
   a En revisión, conservando su código original.

5. Cada reapertura inicia un nuevo ciclo de atención.

6. Deben conservarse las intervenciones,
   asignaciones, verificaciones y cierres anteriores.

7. La asignación técnica finalizada no se reactivará
   automáticamente. Se requerirá una nueva asignación
   o autotoma autorizada.

8. Para cerrar nuevamente, debe existir una solución
   final registrada en el ciclo actual. No puede
   reutilizarse una intervención antigua.

9. Solo se admite una verificación por ciclo.
   Los ciclos anteriores permanecen consultables.

10. Las operaciones deben ser transaccionales,
    controlar concurrencia y respetar los roles.

11. Cada reapertura y cierre se registrará en el
    historial con usuario, fecha y motivo.

## Cambios técnicos previstos

- Migración incremental de PostgreSQL.
- Identificación de ciclos de atención.
- Actualización controlada de verificaciones.
- Actualización de cierre y reapertura.
- Ajustes en seguimiento e informes.
- Actualización del flujo visual de React.
- Pruebas de regresión y permisos.

## Validación obligatoria

Primero probar en PostgreSQL temporal de GitHub.
Después revisar migración y respaldo.
Aplicar en Supabase únicamente tras aprobar pruebas.

No volver a ejecutar 01_esquema_mvp.sql.

## Punto seguro inicial

main: c074ce3
ajustes-docente-v4: 4c2f6de

## Estado de implementación

Pendiente de desarrollo y validación.
