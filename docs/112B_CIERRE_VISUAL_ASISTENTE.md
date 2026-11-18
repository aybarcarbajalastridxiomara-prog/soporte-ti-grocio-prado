# Fase 112B: revisión ASISTENTE y correcciones visuales finales locales

16 de noviembre de 2026, America/Lima. Rama `ajustes-docente-v4`. Código publicado revisado: `477379ab552185b547dfcc9e58a1acaaf7a7078e`.

Alias utilizado exclusivamente: https://soporte-ti-git-540570-aybarcarbajalastridxiomara-3293s-projects.vercel.app/ . La titular inició sesión personalmente en la pestaña preparada. No se solicitaron credenciales, leyeron tokens del sistema municipal ni enviaron formularios de escritura.

## Resultado de las cuatro vistas

| Vista | Comprobaciones publicadas realizadas | Límite de la prueba |
| --- | --- | --- |
| Panel principal | Perfil ASISTENTE, cuatro indicadores en cero, actividad reciente vacía. Actualizar consultó de nuevo sin alerta. Búsqueda sin coincidencias, estados Pendiente/En revisión/Cerrado y restauración. Tab llevó al select; Tab y Enter permitieron limpiar filtros | Sin filas reales no se prueba el detalle, responsables ni variación de los totales |
| Incidencias | Navegación con Enter; búsqueda, los tres estados, Sin coincidencias y limpieza/restauración. Ámbito de registros cargados visible | No hay registros para probar una coincidencia positiva o contraste entre áreas |
| Mis atenciones | Vista y título propios del perfil, descripción de asignaciones activas propias consultadas en el servidor, vacío sin errores. Búsqueda, los tres estados y limpieza/restauración | El vacío no prueba la exclusión de una asignación ajena, la atención, solución o cierre |
| Mi cuenta | Tarjetas Mis datos y Seguridad, perfil ASISTENTE habilitado en Sistemas - Pruebas, seis campos administrativos readonly y carga del correo propio desde Auth. Tres campos de contraseña con etiquetas; actual requerida y autocomplete=current-password; nueva/confirmación requeridas, mínimo 12 y autocomplete=new-password | No se introdujo ni envió ninguna contraseña. No se acredita el cambio, reautenticación, nonce/OTP o renovación al vencer la sesión |

Menú comprobado: Panel principal, Incidencias, Mis atenciones y Mi cuenta. No se ofrecen registro, asignaciones o administración al ASISTENTE. Se mantuvieron los ceros, vacíos y datos existentes, sin reemplazarlos por datos de Figma.

## Responsive y accesibilidad básica

Matriz final: **20 pares únicos válidos**, cuatro vistas por cinco anchos CSS efectivos: 1440, 1024, 768, 390 y 320 px. Se comprobaron título de vista y ancho efectivo de cada fila. Se descartaron las capturas tomadas durante transiciones del menú; solo se contabiliza la matriz final.

- Cero desbordamientos horizontales de página, cero campos fuera del ancho, cero alertas en los estados registrados y cero errores de consola capturados.
- Cero controles de formulario o botones visibles sin nombre accesible en la muestra. Documento en español y un h1 por vista.
- Indicadores en una fila en escritorio y 2×2 en tableta/móvil; filtros apilados a ancho móvil con separación de 12 px. Tarjetas de cuenta en dos columnas en escritorio y una desde tableta. La tarjeta Seguridad se inspeccionó mediante desplazamiento de página, sin escribir en sus campos.
- Buscador con borde continuo #AEBFD0 y radio 8 px; input interno sin borde/sombra; foco azul en el contenedor mediante focus-within y en el select mediante Tab/focus-visible.
- Menú móvil abierto con Enter; Tab recorre sus opciones; Escape cierra y devuelve foco a Abrir menú, con aria-expanded=false. Tras la transición, el sidebar y sus botones están ocultos; el siguiente Tab accede al control de cuenta fuera del menú.
- La sesión se dejó en Panel principal con filtros iniciales y tamaño normal del navegador restaurado. No se cerró sesión.

Esto es una revisión básica de estructura, nombres, foco, teclado y geometría. No es una certificación WCAG ni una prueba con lector de pantalla. Continúan pendientes la auditoría completa de contraste/zoom, los anuncios de resultados dinámicos y estados con tablas, errores o formularios técnicos poblados. Añadir una región aria-live para el contador de resultados es una mejora de accesibilidad posible sin alterar la consulta.

## Comparación actual con Figma

Referencia: https://www.figma.com/make/qvgHjHgNUTv9i2GYdwh6nK/Sistema-de-Gesti%C3%B3n-de-Incidencias , versión 10 visible. Se inspeccionaron sus cuatro vistas con el acceso demostrativo del prototipo y se conservaron capturas/estilos fuera del repositorio. Ninguno de sus datos se trasladó a PostgreSQL o a la aplicación real.

Coinciden la organización del menú, jerarquía de las cuatro vistas, paleta azul, sidebar de 250 px en escritorio, tipografía Inter/Arial, h1 de 17 px y h2 de 22 px en escritorio, tarjetas blancas con radio 11 px y organización de Mis datos/Seguridad. Las diferencias de ancho de una captura del marco Figma no se interpretan como discrepancias de píxeles del viewport real.

| Diferencia observada | Corrección visual posible o decisión de alcance |
| --- | --- |
| En el código publicado no aparecen las cabeceras cuando el listado está vacío | Corregido localmente: siete cabeceras y columna de acciones conservadas en consultas exitosas vacías. El mensaje queda fuera del contenedor desplazable para seguir visible en móvil; tbody permanece vacío, sin filas ficticias |
| Mis atenciones utiliza un título vacío genérico | Corregido localmente: No tienes incidencias asignadas solo para la consulta propia vacía disponible y sin filtros activos. Los filtros sin coincidencias y los errores conservan mensajes distintos |
| Las tarjetas de Mi cuenta tienen alturas distintas en escritorio | Corregido localmente mediante align-items:stretch en la cuadrícula real. Móvil/tableta conservan una columna y alturas naturales; no se modificó el formulario de seguridad |
| Monograma TI frente a GM; título Panel principal frente a Dashboard general; algunos iconos/etiquetas | Revisar o aceptar esas diferencias cosméticas. No cambiar roles internos ni inventar un escudo oficial |
| Bordes de filtros más oscuros, radio 8 px y altura 44 px en el sistema | Mantener lo aprobado en 111B y el foco accesible; no reproducir los bordes tenues de Make |
| Actualizar, alcance de los últimos 50 registros, conteos completos y avisos de seguridad adicionales | Mantener información real y controles útiles. El prototipo usa datos demostrativos; no imitar sus totales |
| Seguridad añade explicación de reautenticación y datos administrativos con apariencia readonly | Preservar estas garantías. La distribución puede ajustarse sin relajar validaciones ni cambiar Auth |
| Barra flotante de Vercel sobre el borde derecho en móvil | Elemento externo a la aplicación; no se modificó configuración para ocultarla |

La inspección publicada identificó las tres diferencias anteriores. Su corrección fue autorizada después y está implementada y probada únicamente en local, sin publicar. Adjuntos, Brevo y administración completa continúan pendientes y no se habilitaron como parte del ajuste visual.

## PRACTICANTE

Se consultó public.usuarios desde Supabase Table Editor en modo de lectura: búsqueda vacía, una página, tres registros. Los tres perfiles están habilitados y sus roles son JEFE, REPRESENTANTE y ASISTENTE. **No existe un perfil PRACTICANTE autorizado en la tabla consultada.** No se crearon identidades, vincularon perfiles o modificaron cuentas. Una identidad de Auth sin perfil público autorizado tampoco permitiría validar ese rol en el sistema.

Su revisión publicada queda bloqueada hasta una decisión del operador sobre ese alcance y una preparación autorizada por separado. La cobertura previa de PRACTICANTE con pruebas locales aisladas no se registra como validación de una cuenta municipal real.

## Pruebas funcionales aún necesarias

1. Con entorno aislado acreditado o autorización específica para un caso real: REPRESENTANTE registra y se comprueba persistencia, código, área, solicitante y estado inicial.
2. JEFE consulta y asigna a un técnico habilitado; se comprueban responsable, estado e historial, y que la incidencia aparezca en Mis atenciones del asignado y no de otro técnico.
3. Responsable registra intervención y solución final, cierra conforme a las reglas del ciclo y conserva el historial. Verificar separadamente el recorrido del JEFE cuando deba atender como responsable.
4. REPRESENTANTE verifica el resultado cuando corresponda; dashboard y listados reflejan las transiciones y totales de PostgreSQL. Contrastar el aislamiento de área y permisos con filas reales autorizadas.
5. Revisar las observaciones sobre incidencias cerradas y preparar la reapertura manual autorizada. Antes de probar escrituras, confirmar el esquema/ruta V3 o V4: V3 registra la observación sin cambiar Cerrado; V4 puede reabrir automáticamente un nuevo ciclo. Definir separadamente quién puede autorizar/ejecutar una reapertura manual, motivo, estados válidos, historial, nuevo ciclo y nueva asignación; comprobar rechazo de repeticiones y responsables del ciclo anterior. Esta entrega no implementa ni ejecuta cambios de estado, nuevas rutas o botones de reapertura.

El cambio de contraseña de Mi cuenta y la renovación efectiva de sesión requieren una prueba separada y autorizada. El acceso actual no demuestra esos flujos. No se deben activar banderas, ejecutar migraciones, simular casos municipales o escribir contra una base potencialmente compartida solo por usar un Preview.

## Correcciones locales autorizadas y pruebas de esta entrega

Base de trabajo: `477379ab552185b547dfcc9e58a1acaaf7a7078e`, rama `ajustes-docente-v4`. Se conservó la consulta del servidor y el estado disponible/error de RealWork; solo se añade su título vacío al componente compartido.

| Archivo | Cambio de esta entrega |
| --- | --- |
| `frontend/src/RealTicketList.tsx` | Conserva la tabla en resultados disponibles vacíos; título vacío opcional y estado accesible del mensaje. Mantiene filtros, datos, columnas, región desplazable con teclado y callback de detalle |
| `frontend/src/RealWork.tsx` | Proporciona el mensaje No tienes incidencias asignadas, sin cambiar la consulta ni los permisos |
| `frontend/src/index.css` | Estira las tarjetas reales de cuenta en la fila de escritorio; conserva el breakpoint de una columna |
| `frontend/tests/ticket-list.test.mjs` | Tres pruebas del componente real: cabeceras sin filas ficticias, vacío frente a carga/error, y datos/detalle de lista poblada |
| Este informe, `112B_VALIDACION_POR_ROLES.md` y `112B_IMPLEMENTACION_Y_PRUEBAS.md` | Resultados actuales, límites y plan funcional posterior |

| Verificación ejecutada ahora | Resultado |
| --- | --- |
| `npm test` en frontend | **15/15 aprobadas**, incluidas las 12 anteriores sin retirar aserciones |
| `npm run build` en frontend | **Aprobada**, TypeScript sin emisión y Vite estándar. El primer intento fue bloqueado por permisos de lectura del sandbox; el mismo comando completó con permiso de ejecución local |
| unittest: test_preentrega_111a + test_conciliacion_112b | **14/14 aprobadas**, SQLite en memoria y dependencias sustituidas, sin Auth/PostgreSQL municipales |
| `.github/scripts/preentrega_110f.py` | **28/28 aprobadas**, rutas, autenticación, banderas y CORS aislados |
| Navegador local, cuatro vistas ASISTENTE × 1440/1024/768/390/320 px | **20 combinaciones**, cero desbordamientos horizontales de página, campos fuera del ancho o alertas en las consultas exitosas vacías |
| Cuenta en escritorio | Alturas iguales: **485,75/485,75 px a 1440** y **503,90/503,90 px a 1024**. En 768/390/320 px quedan apiladas con altura natural |
| Filtros/teclado móvil | Sin coincidencias al buscar/filtrar; limpieza restaura el vacío propio. Cabeceras presentes. Tab alcanza select y región de tabla con foco azul; flecha derecha desplaza internamente la tabla |
| Error de consulta simulado localmente | HTTP 503 muestra alerta y Listado no disponible; **no** muestra No tienes incidencias asignadas. Reintento exitoso vuelve a mostrar los datos |
| Lista poblada aislada | Conserva siete columnas y acciones; Ver abre el detalle. No se enviaron operaciones sobre incidencias |

Python 3.12 y dependencias de prueba se prepararon en un entorno aislado fuera del repositorio; dotenv se deshabilitó para esos procesos. Se registró un aviso no bloqueante de deprecación Starlette/httpx; no hubo fallos. No cambiaron dependencias, archivos de entorno o configuración del proyecto. No se lanzaron GitHub Actions ni publicaciones adicionales.

La comprobación visual usó una segunda compilación de QA con API/Auth exclusivamente en `127.0.0.1:8767`, fuera del repositorio. El transporte local bloqueó escrituras de incidencias y presentó respuestas vacías, error o registros en memoria para observar la interfaz real; no es evidencia de operaciones municipales. Las capturas y `correcciones-finales-112b.json` se conservan fuera de Git. Se inspeccionaron las tarjetas en escritorio y su apilado móvil, además de la tabla vacía y sus focos. La comparación conserva la referencia Figma versión 10 ya documentada y los estilos legibles aprobados en 111B.

## Siguiente paso recomendado

Revisar los cambios locales y sus capturas. Las tres correcciones autorizadas están terminadas y probadas; cualquier commit, push o Preview requiere otra autorización. Continúan las diferencias cosméticas menores y los límites de accesibilidad ya descritos. Mantener el bloqueo de PRACTICANTE y decidir por separado el entorno/caso real del circuito funcional, incluida la revisión de observaciones y la reapertura manual autorizada.

El cierre visual de los tres perfiles revisados puede evaluarse con las diferencias aceptadas o corregidas. No se declara completado el alcance original de cuatro roles ni el ciclo funcional real.

## Evidencia y cambios

Matriz e interacciones publicadas anteriores, estilos comparados y capturas se conservan fuera del repositorio. Los archivos con el perfil/correo de la titular no se incorporan a Git. Esta entrega modifica tres archivos de interfaz, añade tres pruebas en un archivo nuevo y actualiza estos tres informes. Se conservan los resultados históricos del [informe por roles](112B_VALIDACION_POR_ROLES.md) y del [informe de implementación](112B_IMPLEMENTACION_Y_PRUEBAS.md), diferenciados de las pruebas locales actuales. Los nueve archivos pendientes de 112A permanecen sin cambios.

Sin SQL remoto, cambios de cuentas/contraseñas, RLS, variables, banderas, datos municipales, commit, push, merge a main o despliegue.
