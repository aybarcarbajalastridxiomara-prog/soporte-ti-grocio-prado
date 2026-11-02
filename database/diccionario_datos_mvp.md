
# Diccionario de datos - Sistema de Soporte TI

## Proyecto
Sistema de Gestión y Seguimiento de Incidencias de Soporte TI - Municipalidad Distrital de Grocio Prado.

## Tabla 1: areas

Almacena las áreas municipales que utilizan el sistema.

| Campo | Tipo | Restricción |
|---|---|---|
| id | UUID | PK, NOT NULL |
| nombre | VARCHAR(100) | UNIQUE, NOT NULL |
| activo | BOOLEAN | NOT NULL, DEFAULT TRUE |
| fecha_creacion | TIMESTAMPTZ | NOT NULL |

## Tabla 2: usuarios

Almacena la información de los usuarios autorizados.

| Campo | Tipo | Restricción |
|---|---|---|
| id | UUID | PK, NOT NULL |
| area_id | UUID | FK a areas.id, NOT NULL |
| nombre_completo | VARCHAR(150) | NOT NULL |
| usuario | VARCHAR(80) | UNIQUE, NOT NULL |
| rol | VARCHAR(30) | NOT NULL |
| habilitado | BOOLEAN | NOT NULL, DEFAULT TRUE |
| fecha_creacion | TIMESTAMPTZ | NOT NULL |

## Relación

Un área municipal puede tener varios usuarios.

Cada usuario pertenece a un área municipal.

## Reglas de negocio

- Solo el jefe de Sistemas administra usuarios.
- Cada área puede tener como máximo dos representantes autorizados habilitados.
- Los usuarios deshabilitados no pueden iniciar sesión.
- El personal de Sistemas tiene permisos según su rol.
- Las contraseñas no se almacenarán en texto plano.

## Estado

## Tabla 3: incidencias

Almacena las incidencias tecnológicas reportadas por los usuarios autorizados de las áreas municipales.

| Campo | Tipo | Restricción |
|---|---|---|
| id | UUID | PK, NOT NULL |
| codigo | VARCHAR(25) | UNIQUE, NOT NULL |
| area_id | UUID | FK a areas.id, NOT NULL |
| reportante_id | UUID | FK a usuarios.id, NOT NULL |
| asunto | VARCHAR(200) | NOT NULL |
| descripcion | TEXT | NOT NULL |
| categoria | VARCHAR(80) | NULL |
| equipo_sistema_afectado | VARCHAR(150) | NULL |
| ubicacion | VARCHAR(150) | NULL |
| impacto | VARCHAR(20) | NULL |
| fecha_inicio_problema | DATE | NULL |
| estado | VARCHAR(20) | NOT NULL, DEFAULT 'Pendiente' |
| prioridad | VARCHAR(15) | NULL |
| fecha_registro | TIMESTAMPTZ | NOT NULL |
| fecha_cierre | TIMESTAMPTZ | NULL |
| cerrado_por_usuario_id | UUID | FK a usuarios.id, NULL |

## Relaciones de incidencias

- Un área municipal puede registrar muchas incidencias.
- Cada incidencia pertenece a una sola área.
- Un usuario autorizado puede registrar varias incidencias.
- Cada incidencia tiene un reportante.
- Una incidencia puede tener varias asignaciones e intervenciones.

## Reglas de negocio de incidencias

- Cada incidencia tendrá un código único.
- Los usuarios solo podrán registrar incidencias de su área autorizada.
- El asunto y la descripción serán obligatorios.
- Toda incidencia nueva comenzará en estado Pendiente.
- Los estados permitidos son Pendiente, En revisión y Cerrado.
- La prioridad se asignará posteriormente por personal autorizado de Sistemas.
- Los archivos adjuntos se registrarán en la tabla evidencias.
- El historial de cambios se almacenará por separado.
- El cierre deberá registrar fecha y usuario responsable.

## Estado del diseño de incidencias

Estructura preliminar del MVP. Pendiente de implementar las restricciones y claves foráneas mediante SQL.

Diseño preliminar de las tablas areas y usuarios.


## Tabla 4: asignaciones

Registra la asignación y reasignación de incidencias al personal de Sistemas.

| Campo | Tipo | Restricción |
|---|---|---|
| id | UUID | PK, NOT NULL |
| incidencia_id | UUID | FK a incidencias.id, NOT NULL |
| tecnico_id | UUID | FK a usuarios.id, NOT NULL |
| asignado_por_id | UUID | FK a usuarios.id, NOT NULL |
| fecha_asignacion | TIMESTAMPTZ | NOT NULL |
| fecha_fin | TIMESTAMPTZ | NULL |
| motivo_reasignacion | TEXT | NULL |

### Relaciones

- Una incidencia puede tener varias asignaciones a lo largo del tiempo.
- Cada asignación corresponde a un integrante de Sistemas.
- Cada asignación registra al usuario que la realizó.

### Reglas de negocio

- Una incidencia tendrá como máximo una asignación activa.
- Una asignación activa tendrá fecha_fin en NULL.
- Al reasignar, se finalizará la asignación anterior.
- Las asignaciones anteriores se conservarán.
- Solo los usuarios autorizados podrán asignar o reasignar incidencias.

## Tabla 5: intervenciones

Registra las actividades técnicas realizadas durante la atención de incidencias.

| Campo | Tipo | Restricción |
|---|---|---|
| id | UUID | PK, NOT NULL |
| incidencia_id | UUID | FK a incidencias.id, NOT NULL |
| tecnico_id | UUID | FK a usuarios.id, NOT NULL |
| diagnostico | TEXT | NOT NULL |
| acciones_realizadas | TEXT | NOT NULL |
| duracion_minutos | INTEGER | NULL |
| solucion_aplicada | TEXT | NULL |
| es_solucion_final | BOOLEAN | NOT NULL, DEFAULT FALSE |
| fecha_registro | TIMESTAMPTZ | NOT NULL |

### Relaciones

- Una incidencia puede tener varias intervenciones.
- Cada intervención es registrada por un integrante autorizado de Sistemas.
- Un integrante puede registrar intervenciones en diferentes incidencias.

### Reglas de negocio

- Cada intervención debe pertenecer a una incidencia existente.
- Se registrará quién realizó la intervención.
- El diagnóstico y las acciones realizadas serán obligatorios.
- La duración, cuando se registre, no podrá ser negativa.
- La solución aplicada se registrará cuando corresponda.
- Si es_solucion_final es TRUE, debe existir una solución_aplicada.
- Las intervenciones anteriores se conservarán para consulta.

## Estado del diseño

Tablas documentadas hasta el momento:

1. areas
2. usuarios
3. incidencias
4. asignaciones
5. intervenciones

Pendientes:

6. verificaciones
7. evidencias
8. historial_incidencias

El modelo continúa en fase de diseño.

