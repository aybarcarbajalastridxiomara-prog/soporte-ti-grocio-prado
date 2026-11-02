
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

Diseño preliminar de las tablas areas y usuarios.

Pendiente: definir el mecanismo de autenticación y completar las demás entidades antes de generar el SQL.
