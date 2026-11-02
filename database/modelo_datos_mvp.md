
# Modelo de datos del sistema de Soporte TI

## Proyecto

Sistema de Gestión y Seguimiento de Incidencias de Soporte TI - Municipalidad Distrital de Grocio Prado.

## Objetivo

Definir las entidades principales de la base de datos necesarias para implementar los 13 requerimientos funcionales prioritarios del MVP.

## Tecnología propuesta

- PostgreSQL
- Supabase

## Entidades principales

### 1. areas
Almacena las áreas municipales que solicitan soporte tecnológico.

### 2. usuarios
Almacena las cuentas, roles, áreas y estados de habilitación de los usuarios autorizados.

### 3. incidencias
Almacena los tickets registrados, incluyendo código, asunto, descripción, categoría, prioridad y estado.

### 4. asignaciones
Registra los técnicos responsables de cada incidencia y los cambios de asignación.

### 5. intervenciones
Registra los diagnósticos, actividades técnicas y soluciones aplicadas.

### 6. verificaciones
Almacena las confirmaciones y observaciones de los representantes autorizados.

### 7. evidencias
Almacena las referencias y metadatos de fotografías y documentos asociados a una incidencia.

### 8. historial_incidencias
Registra las acciones importantes realizadas sobre cada incidencia, indicando usuario y fecha.

## Relaciones principales

- Un área puede tener varios usuarios.
- Un área puede registrar varias incidencias.
- Un usuario autorizado puede registrar varias incidencias.
- Una incidencia puede tener varias asignaciones.
- Una incidencia puede tener varias intervenciones.
- Una incidencia puede tener varias verificaciones.
- Una incidencia puede tener varias evidencias.
- Una incidencia puede tener varios eventos de historial.

## Alcance

El modelo contempla únicamente el registro, clasificación, asignación, atención, seguimiento y cierre de incidencias.

No incluye gestión de compras, inventario patrimonial, presupuestos ni informes técnicos avanzados.

## Estado

Diseño inicial de entidades. Pendiente de definir atributos, claves primarias, claves foráneas y restricciones.
