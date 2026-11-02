
# Reglas de Integridad y Seguridad del MVP

## Proyecto
Sistema de Gestión y Seguimiento de Incidencias de Soporte TI - Municipalidad Distrital de Grocio Prado.

## 1. Autenticación de usuarios

- Se utilizará Supabase Auth para gestionar las credenciales.
- usuarios.id se vinculará con auth.users.id.
- La tabla usuarios almacenará el perfil y los permisos.
- No se guardarán contraseñas en la tabla usuarios.
- Solo el jefe de Sistemas podrá administrar cuentas.
- La creación de cuentas deberá ejecutarse mediante un proceso administrativo seguro.
- Las cuentas deshabilitadas no podrán utilizar funciones del sistema.

## 2. Roles y permisos

### Jefe de Sistemas
- Consultar todas las incidencias.
- Administrar usuarios y roles.
- Asignar y reasignar incidencias.
- Clasificar y establecer prioridades.
- Registrar intervenciones propias.
- Supervisar las atenciones y el cierre.

### Asistente y practicante
- Consultar incidencias de las áreas municipales.
- Consultar sus asignaciones.
- Tomar incidencias sin responsable.
- Registrar intervenciones en sus tickets asignados.
- Registrar soluciones técnicas.
- No administrar usuarios.
- No asignar incidencias a otros integrantes.
- No cambiar prioridades.
- No reasignar incidencias.

### Representante municipal
- Registrar incidencias de su área.
- Consultar incidencias autorizadas de su área.
- Adjuntar evidencias opcionales.
- Registrar conformidad u observaciones cuando corresponda.
- No administrar asignaciones ni prioridades.

## 3. Reglas de usuarios

- Cada usuario tendrá un identificador único.
- Cada usuario pertenecerá a un área.
- Cada área tendrá como máximo dos representantes autorizados habilitados.
- Los cambios de rol deberán realizarse mediante operaciones autorizadas.
- No se permitirá al usuario modificar directamente su propio rol.

## 4. Reglas de incidencias

- Cada incidencia tendrá un código único.
- Asunto y descripción serán obligatorios.
- Toda incidencia nueva comenzará en estado Pendiente.
- Los estados permitidos serán Pendiente, En revisión y Cerrado.
- La prioridad podrá permanecer sin asignar hasta su evaluación.
- El reportante no podrá modificar la prioridad.
- Los tickets deberán conservar la referencia a su área y reportante.

## 5. Asignación y toma de incidencias

- Solo el jefe podrá asignar y reasignar incidencias a otros usuarios.
- El asistente y practicante podrán tomar incidencias sin asignación activa.
- Tomar una incidencia significa asignársela a uno mismo.
- No será necesario registrar la ausencia del jefe.
- Una incidencia tendrá como máximo una asignación activa.
- Las asignaciones históricas se conservarán.
- origen_asignacion aceptará JEFATURA o AUTOTOMA.
- Una AUTOTOMA tendrá el mismo usuario en tecnico_id y asignado_por_id.
- Solo el jefe podrá reasignar un ticket con responsable activo.
- La toma deberá ser atómica para impedir dos responsables simultáneos.

## 6. Intervenciones y soluciones

- Cada intervención pertenecerá a una incidencia existente.
- Cada intervención identificará al técnico responsable.
- El diagnóstico y las acciones realizadas serán obligatorios.
- La duración no podrá ser negativa.
- Una solución final requerirá registrar la solución aplicada.
- El historial técnico no podrá modificarse mediante operaciones ordinarias no autorizadas.

## 7. Verificación y cierre

- El representante autorizado podrá registrar conformidad u observaciones.
- Las observaciones deberán incluir una descripción.
- La condición SIN OBSERVACIONES no equivale a conformidad expresa.
- SIN OBSERVACIONES no producirá un cierre automático.
- El cierre registrará fecha y usuario responsable.
- El cierre requerirá cumplir las condiciones de autorización definidas para el MVP.

## 8. Evidencias

- Los archivos serán opcionales.
- Formatos propuestos: JPG, PNG, WebP y PDF.
- Tamaño máximo propuesto: 10 MB por archivo.
- Las evidencias se asociarán a una incidencia.
- Los archivos privados se guardarán en almacenamiento protegido.
- La base de datos conservará las referencias y metadatos.
- El acceso a evidencias respetará los permisos del ticket.

## 9. Seguridad de la base de datos

- Se habilitará Row Level Security (RLS) en las tablas expuestas.
- Las consultas estarán restringidas según usuario, rol y área.
- El backend verificará los permisos de las operaciones sensibles.
- Las credenciales administrativas no estarán disponibles en el frontend.
- Las operaciones de asignación deberán protegerse contra concurrencia.
- Se registrarán los eventos relevantes en historial_incidencias.

## 10. Estado

Reglas de diseño consolidadas para preparar el SQL del MVP.

Pendiente:
- Implementar restricciones en PostgreSQL.
- Definir políticas RLS.
- Probar autenticación y autorización.
- Validar asignaciones simultáneas.
- Verificar integridad con datos de prueba.
