
# Diagrama Entidad-Relación - Sistema de Soporte TI

## Proyecto

Sistema de Gestión y Seguimiento de Incidencias de Soporte TI - Municipalidad Distrital de Grocio Prado.

## Modelo entidad-relación del MVP

El modelo contempla ocho entidades principales para registrar, asignar, atender y dar seguimiento a las incidencias tecnológicas.

```mermaid
erDiagram
    areas ||--o{ usuarios : tiene
    areas ||--o{ incidencias : registra
    usuarios ||--o{ incidencias : reporta

    incidencias ||--o{ asignaciones : tiene
    usuarios ||--o{ asignaciones : tecnico
    usuarios ||--o{ asignaciones : asignador

    incidencias ||--o{ intervenciones : tiene
    usuarios ||--o{ intervenciones : realiza

    incidencias ||--o{ verificaciones : recibe
    usuarios ||--o{ verificaciones : verifica

    incidencias ||--o{ evidencias : tiene
    usuarios ||--o{ evidencias : adjunta

    incidencias ||--o{ historial_incidencias : registra
    usuarios ||--o{ historial_incidencias : ejecuta

    areas {
        UUID id PK
        VARCHAR nombre
        BOOLEAN activo
    }

    usuarios {
        UUID id PK
        UUID area_id FK
        VARCHAR nombre_completo
        VARCHAR usuario
        VARCHAR rol
        BOOLEAN habilitado
    }

    incidencias {
        UUID id PK
        VARCHAR codigo
        UUID area_id FK
        UUID reportante_id FK
        VARCHAR asunto
        TEXT descripcion
        VARCHAR estado
        VARCHAR prioridad
    }
    
    asignaciones {
        UUID id PK
        UUID incidencia_id FK
        UUID tecnico_id FK
        UUID asignado_por_id FK
        VARCHAR origen_asignacion
        TIMESTAMPTZ fecha_asignacion
        TIMESTAMPTZ fecha_fin
        TEXT motivo_reasignacion
    }

    intervenciones {
        UUID id PK
        UUID incidencia_id FK
        UUID tecnico_id FK
        TEXT diagnostico
        TEXT acciones_realizadas
        BOOLEAN es_solucion_final
    }

    verificaciones {
        UUID id PK
        UUID incidencia_id FK
        UUID usuario_id FK
        VARCHAR resultado
        TEXT observaciones
    }

    evidencias {
        UUID id PK
        UUID incidencia_id FK
        UUID usuario_id FK
        VARCHAR nombre_archivo
        TEXT ruta_archivo
    }

    historial_incidencias {
        UUID id PK
        UUID incidencia_id FK
        UUID usuario_id FK
        VARCHAR accion
        TIMESTAMPTZ fecha_registro
    }
```

## Consideraciones

- Cada incidencia pertenece a un área municipal.
- Cada incidencia tiene un usuario reportante.
- Una incidencia puede tener varias asignaciones e intervenciones.
- Cada asignación identifica al técnico y al usuario que asignó.
- Las evidencias y verificaciones están vinculadas a una incidencia.
- El historial permite consultar las acciones realizadas.
- El diagrama presenta atributos principales; el diccionario contiene el detalle completo.

### Asignación y toma de incidencias

- El jefe de Sistemas puede asignar y reasignar incidencias.
- El asistente y practicante pueden tomar incidencias sin responsable.
- Una incidencia solo puede tener una asignación activa.
- El origen de la asignación será JEFATURA o AUTOTOMA.
- Una incidencia tomada por un técnico quedará asignada a ese mismo usuario.
- Solo el jefe podrá reasignar incidencias previamente asignadas.
- Todas las asignaciones y reasignaciones conservarán su historial.
- No es necesario controlar la ausencia o disponibilidad del jefe.


## Estado

Modelo entidad-relación preliminar del MVP.

Pendiente de validar las restricciones de integridad y generar el script SQL de PostgreSQL.
