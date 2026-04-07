# Documento 5: Alcance Funcional Detallado - Sistema ProntoTicket

## 1. Introducción al Alcance
 
El sistema ProntoTicket tiene como objetivo funcional transformar el flujo pasivo de correos del buzón `contacto@prontomatic.cl` en un flujo activo, trazable y auditable de gestión de incidencias de soporte técnico.
 
El alcance funcional abarca la totalidad del ciclo de vida de un caso de soporte, desde la captura automática del correo entrante hasta la generación de métricas de satisfacción post-cierre, garantizando que ninguna solicitud quede sin registro, sin responsable asignado o sin resolución documentada.
 
El sistema se organiza en **seis módulos funcionales** con responsabilidades claramente delimitadas:
 
| Módulo | Naturaleza | Descripción resumida |
|---|---|---|
| **Ingesta y Procesamiento** | Automático | Captura, normalización y enriquecimiento de correos entrantes |
| **Dashboard y Gestión** | Manual (agente) | Visualización, toma y gestión operativa de tickets |
| **Comunicación y Respuesta** | Manual (agente) | Redacción y envío de respuestas al cliente |
| **Automatización y SLAs** | Automático (background) | Cierre automático, notificaciones y encuesta CSAT |
| **Administración y Auditoría** | Manual (supervisor/admin) | Gestión de usuarios, métricas y auditoría |
| **Requerimientos No Funcionales** | Transversal | Seguridad, privacidad y escalabilidad |
 
---
 
## 2. Módulo de Ingesta y Procesamiento (Inbound)
 
Este módulo es el punto de entrada del sistema y opera de forma **completamente automatizada**, sin intervención de ningún agente. Se activa en el momento en que SendGrid Inbound Parse recibe un correo en `contacto@prontomatic.cl` y envía el payload al endpoint `/api/webhook/ingesta`.
 
### 2.1. Captura vía Webhook
 
- El endpoint `/api/webhook/ingesta` recibe la petición `POST` de SendGrid con el payload `multipart/form-data` que contiene el correo deserializado.
- Antes de procesar cualquier dato, el sistema valida la firma HMAC de la petición para garantizar que el origen es SendGrid y no una fuente externa maliciosa. Si la validación falla, la petición se rechaza con `HTTP 403` sin procesar su contenido.
- Si la validación es exitosa, el payload se pasa a la capa de servicios para iniciar el procesamiento.
 
### 2.2. Validación y Filtrado de Correos No Válidos
 
Esta etapa ocurre **inmediatamente después** de la validación de firma y **antes** de cualquier otro procesamiento. Su propósito es descartar correos que no corresponden a solicitudes de soporte reales, evitando la creación de tickets basura en el sistema.
 
El filtrado opera en **dos capas complementarias**: una automática provista por SendGrid y una propia implementada en `ticketService.js`.
 
#### Capa 1 — Filtrado Automático por SendGrid
 
Cuando la opción "Check incoming emails for spam" está activa en la configuración de Inbound Parse (ver `guia-instalacion.md` sección 3.2.2), SendGrid analiza cada correo entrante y adjunta al payload dos campos:
 
| Campo del payload | Descripción |
|---|---|
| `spam_score` | Puntuación numérica de spam. Valores más altos indican mayor probabilidad de spam. El umbral de descarte configurado es **`5.0`**. |
| `spam_report` | Detalle del análisis de spam (reglas activadas). Informativo, no se usa para tomar la decisión de descarte. |
 
Si `spam_score >= 5.0`, el correo se descarta silenciosamente y el endpoint retorna `HTTP 200 OK` sin crear ningún ticket. SendGrid no reintenta el envío.
 
> **Nota sobre el umbral:** El valor `5.0` es el umbral estándar de SpamAssassin, el motor de análisis de spam utilizado por SendGrid. Un score de 5.0 o más indica con alta fiabilidad que el correo es spam. Este valor es configurable en `ticketService.js` si en el futuro se necesita afinar la sensibilidad.
 
#### Capa 2 — Filtrado por Headers de Correo (Lógica Propia)
 
Los siguientes tipos de correos no son detectados como spam por SendGrid pero tampoco corresponden a solicitudes de soporte reales. Se identifican mediante headers estándar del protocolo de email que SendGrid incluye en el campo `headers` del payload.
 
El sistema evalúa estas condiciones en orden, descartando el correo ante la primera coincidencia:
 
| Tipo de correo | Header(s) evaluado(s) | Valor que activa el descarte |
|---|---|---|
| **Respuestas automáticas** (Out of Office, Fuera de oficina, Auto-reply) | `Auto-Submitted` | Cualquier valor distinto de `no` (ej: `auto-replied`, `auto-generated`) |
| **Respuestas automáticas** (detección alternativa) | `X-Autoreply` | Presente con cualquier valor |
| **Correos de rebote** (MAILER-DAEMON, Mail Delivery Failure) | `From` | Remitente que coincide con `MAILER-DAEMON@*`, `postmaster@*` o `noreply@*` |
| **Boletines, newsletters y marketing** | `List-Unsubscribe` | Presente con cualquier valor (indica envío masivo con opción de baja) |
| **Notificaciones de sistema** | `X-Mailer` | Valores que coincidan con patrones conocidos de herramientas automáticas (ej: `PHPMailer`, `Mailchimp`, `SendinBlue`, `HubSpot`) |
| **Notificaciones de sistema** (detección alternativa) | `Precedence` | Valores `bulk`, `list` o `junk` |
 
**Implementación en `ticketService.js`:**
 
```javascript
function isValidInboundEmail(headers, spamScore) {
  // Capa 1: filtro de spam por score de SendGrid
  if (parseFloat(spamScore) >= 5.0) return false;
 
  // Capa 2: filtro por headers de protocolo de email
  if (headers['auto-submitted'] && headers['auto-submitted'] !== 'no') return false;
  if (headers['x-autoreply']) return false;
  if (headers['list-unsubscribe']) return false;
  if (['bulk', 'list', 'junk'].includes(headers['precedence'])) return false;
 
  const from = headers['from'] || '';
  if (/^(mailer-daemon|postmaster|noreply|no-reply)@/i.test(from)) return false;
 
  return true;
}
```
 
**Comportamiento ante correo descartado:**
- El endpoint retorna `HTTP 200 OK` en todos los casos de descarte (independientemente del motivo), para evitar que SendGrid reintente el envío.
- El descarte se registra en los logs del servidor con el motivo (ej: `[FILTRO] Correo descartado: Auto-Submitted header detectado. Remitente: vacation@cliente.cl`).
- No se crea ningún ticket ni mensaje en la base de datos.
- No se envía ninguna notificación al remitente.
 
**Tabla resumen de todos los tipos de correo y su tratamiento:**
 
| Tipo de correo | Ejemplo de remitente / asunto | Mecanismo de detección | Acción |
|---|---|---|---|
| Spam genérico | Ofertas, phishing, sorteos | `spam_score >= 5.0` (SendGrid) | Descartar |
| Out of Office | "Estaré fuera hasta el lunes" | Header `Auto-Submitted: auto-replied` | Descartar |
| Rebote de correo | `MAILER-DAEMON@servidor.com` | Remitente `mailer-daemon@*` | Descartar |
| Newsletter / marketing | Boletín semanal, promoción | Header `List-Unsubscribe` presente | Descartar |
| Notificación de sistema | Alerta de servidor, CI/CD | Header `Precedence: bulk` | Descartar |
| Correo de soporte real | Cualquier cliente con un problema | Ninguno de los anteriores | Procesar → crear ticket |
 
### 2.3. Detección de Hilo: ¿Ticket Nuevo o Respuesta Existente?
 
Esta es la primera decisión lógica del sistema tras recibir un correo. El sistema debe determinar si el correo entrante es un nuevo caso de soporte o una respuesta del cliente a un ticket ya existente.
 
El mecanismo de detección opera en **dos capas complementarias**:
 
**Capa 1 — Escaneo de etiqueta de ID en el asunto:**
Cuando ProntoTicket envía una respuesta al cliente, el sistema inserta automáticamente una etiqueta con el número de ticket al inicio del asunto del correo. Por ejemplo, si el agente responde al ticket #142, el asunto del correo saliente será:
 
```
[#142] Re: Problema con máquina dispensadora piso 3
```
 
Cuando el cliente responde a ese correo, su cliente de correo (Gmail, Outlook, etc.) conservará el asunto modificado. El sistema escanea el asunto del correo entrante buscando el patrón `[#NNN]`. Si lo encuentra, extrae el número de ticket y lo utiliza para identificar el caso existente.
 
**Capa 2 — Headers de correo (In-Reply-To / References):**
Como mecanismo de respaldo, el sistema también evalúa los headers `In-Reply-To` y `References` del correo entrante, que los clientes de correo modernos populan automáticamente al responder un mensaje. Si el `Message-ID` referenciado coincide con un mensaje registrado en la tabla `Message`, el correo se vincula al ticket correspondiente.
 
**Resultado de la detección:**
 
| Escenario | Acción del sistema |
|---|---|
| Se detecta `[#NNN]` en el asunto **y** el ticket existe | El correo se añade como nuevo `Message` de tipo `CLIENTE` al hilo del ticket. Si el ticket estaba en estado `EN_ESPERA_CLIENTE`, el estado cambia automáticamente a `EN_PROCESO_INTERNO`. Se actualiza `last_client_reply_at` en el ticket. Se registra el cambio de estado en `StatusHistory`. |
| Se detecta `[#NNN]` en el asunto **pero** el ticket no existe | El sistema descarta la etiqueta y crea un nuevo ticket, tratando el correo como un caso nuevo. |
| No se detecta `[#NNN]` y no hay match por headers | Se crea un nuevo ticket con el correo como mensaje inicial. |
 
### 2.4. Deduplicación de Correos
 
Antes de crear cualquier ticket o mensaje nuevo, el sistema verifica que el `Message-ID` del correo entrante no exista ya en la tabla `Message` (campo `message_id_header`). Si existe, el correo se descarta silenciosamente y el endpoint retorna `HTTP 200 OK` para evitar reintentos de SendGrid. Esto previene la creación de tickets o mensajes duplicados por reintentos del servidor de correo.
 
### 2.5. Normalización de Contenido
 
Una vez identificado el correo como nuevo ticket o respuesta a uno existente, el sistema procesa su contenido:
 
- **Conversión HTML → Markdown:** El cuerpo del correo se recibe desde SendGrid en formato HTML. El sistema lo convierte a Markdown para garantizar una presentación uniforme y legible en el dashboard del agente, independientemente del cliente de correo que usó el cliente para redactar el mensaje.
- **Sanitización:** Se eliminan elementos HTML potencialmente problemáticos (scripts, iframes, estilos inline excesivos) antes de la conversión.
- **Preservación del texto plano:** Si SendGrid también provee el cuerpo en texto plano (`text`), se usa como fallback en caso de que la conversión HTML → Markdown falle o produzca un resultado degradado.
 
### 2.6. Gestión de Archivos Adjuntos
 
Si el correo entrante incluye archivos adjuntos (fotografías de máquinas con fallas, capturas de pantalla, comprobantes en PDF, etc.):
 
1. El sistema extrae los archivos del payload de SendGrid.
2. Cada archivo se sube al bucket privado de Supabase Storage bajo la ruta: `tickets/{ticket_id}/adjuntos/{nombre_archivo}`.
3. Se crea un registro en la tabla `Attachment` vinculado al mensaje correspondiente, almacenando el nombre del archivo, la ruta en Storage, el tipo MIME y el tamaño en bytes.
4. Los archivos **nunca** se almacenan en la base de datos PostgreSQL directamente; solo se guarda la referencia (path) al archivo en Supabase Storage.
 
**Tipos de archivo admitidos:** El sistema acepta cualquier tipo de archivo que SendGrid procese en el payload. No se implementa una lista de tipos permitidos en la versión inicial. Los agentes son responsables de evaluar la pertinencia de los adjuntos recibidos.
 
### 2.7. Enriquecimiento Automático de Datos del Cliente
 
Inmediatamente después de procesar el correo, el sistema realiza una consulta de solo lectura a la base de datos MySQL legacy de Prontomatic para enriquecer el ticket con los datos del cliente:
 
1. Se extrae el correo electrónico del remitente del campo `from` del payload de SendGrid.
2. Se ejecuta una consulta en la tabla `usuarios` de MySQL buscando coincidencia por email.
3. Los campos `rut`, `telefono` y `direccion` se almacenan en el ticket dentro de PostgreSQL.
 
**Comportamiento ante datos faltantes:**
 
| Situación | Comportamiento |
|---|---|
| Cliente encontrado, todos los campos presentes | Datos almacenados en el ticket. Campo `enrichment_note` queda `null`. |
| Cliente encontrado, uno o más campos vacíos | Campos disponibles almacenados. `enrichment_note` indica los campos faltantes. Ejemplo: `"Teléfono no encontrado. Dirección no encontrada."` |
| Cliente no encontrado en MySQL | Los tres campos quedan `null`. `enrichment_note`: `"Cliente no encontrado en la base de datos. RUT, Teléfono y Dirección no disponibles."` |
| Error de conexión con MySQL | Ticket creado igualmente. `enrichment_note`: `"Error al consultar base de datos de clientes. Datos de contacto no disponibles."` Error registrado en logs del servidor. |
 
> **Importante:** La ausencia de datos del cliente en MySQL **nunca bloquea la creación del ticket**. El ticket siempre se crea, con o sin datos de enriquecimiento.
 
---
 
## 3. Módulo de Gestión de Dashboard (Operativa del Agente)
 
Interfaz centralizada construida en React con Next.js que permite a los agentes y supervisores visualizar y gestionar el estado de todos los tickets del sistema.
 
### 3.1. Dashboard Global de Tickets
 
El dashboard es la pantalla principal del sistema y muestra el listado de todos los tickets visibles para el usuario autenticado según su rol.
 
**Comportamiento por rol:**
 
| Rol | Tickets visibles en el dashboard |
|---|---|
| `AGENTE` | Todos los tickets en estado `ABIERTO` (sin tomar) más los tickets que él mismo tiene asignados (`assigned_to` = su ID). |
| `SUPERVISOR` | Todos los tickets del sistema, independientemente de su estado o agente asignado. |
| `ADMINISTRADOR` | Todos los tickets del sistema, independientemente de su estado o agente asignado. |
 
**Información visible en la tarjeta de cada ticket en el listado:**
- Número de ticket (ej: `#142`)
- Asunto del correo original
- Correo electrónico del cliente
- Estado actual del ticket con indicador visual de color
- Categoría asignada (si aplica)
- Agente asignado (si aplica)
- Fecha y hora de creación
- Tiempo transcurrido desde la creación (ej: "hace 2 horas", "hace 3 días")
 
### 3.2. Actualización del Dashboard (Polling)
 
Dado el volumen operativo de ProntoTicket (30-40 tickets diarios activos) y la naturaleza del equipo (2-3 agentes por turno), el dashboard implementa un mecanismo de **polling ligero** para mantener los datos actualizados sin requerir recarga manual de la página:
 
- El dashboard realiza una consulta automática al servidor cada **60 segundos** para verificar si hay tickets nuevos o actualizaciones en los tickets existentes.
- Si se detectan cambios, la lista de tickets se actualiza automáticamente en la interfaz sin interrumpir la navegación del agente.
- Este enfoque es significativamente más simple que implementar WebSockets o Server-Sent Events (SSE), y es adecuado para el volumen actual. Si en el futuro el volumen de tickets crece considerablemente, puede migrarse a SSE sin cambios en la capa de presentación.
 
### 3.3. Filtros y Ordenamiento
 
El dashboard provee las siguientes opciones de filtrado y ordenamiento para facilitar la gestión de la cola de tickets:
 
**Filtros disponibles:**
 
| Filtro | Valores posibles |
|---|---|
| **Estado** | Todos / Abierto / En proceso interno / En espera de cliente / Cerrado |
| **Categoría** | Todas / [Lista de categorías activas configuradas por el Administrador] |
| **Agente asignado** | Todos / Sin asignar / [Lista de agentes activos] — Solo visible para Supervisor y Administrador |
 
**Ordenamiento disponible:**
 
| Criterio | Dirección |
|---|---|
| Fecha de creación | Más reciente primero / Más antiguo primero |
| Última actualización | Más reciente primero / Más antiguo primero |
| Tiempo sin respuesta | Mayor tiempo primero (útil para detectar tickets en riesgo de cierre automático) |
 
### 3.4. Mecanismo de Toma de Ticket (Asignación Manual)
 
Los tickets no se asignan automáticamente a ningún agente. El agente de turno es responsable de revisar el dashboard y tomar los tickets disponibles según su disponibilidad y criterio.
 
**Proceso de toma de ticket:**
 
1. El agente visualiza un ticket en estado `ABIERTO` en el dashboard.
2. El agente hace clic en "Tomar ticket" desde la tarjeta del ticket o desde la vista de detalle.
3. El sistema ejecuta las siguientes acciones de forma atómica:
   - Actualiza el campo `assigned_to` del ticket con el UUID del agente autenticado.
   - Cambia el estado del ticket de `ABIERTO` a `EN_PROCESO_INTERNO`.
   - Actualiza `updated_at` del ticket.
   - Crea un registro en `StatusHistory` con `previous_status: ABIERTO`, `new_status: EN_PROCESO_INTERNO`, `changed_by: [ID del agente]`, `is_system_action: false`.
4. El ticket desaparece del listado de tickets `ABIERTO` del dashboard global y queda visible en la sección de tickets propios del agente.
 
**Condición de carrera:** Si dos agentes intentan tomar el mismo ticket simultáneamente, el sistema debe garantizar que solo uno lo obtenga. Esto se resuelve mediante una operación de actualización condicional en PostgreSQL que verifica que `assigned_to` sea `null` en el momento de la escritura. El segundo agente que intente tomar el ticket recibirá un mensaje informando que el ticket ya fue tomado por otro agente.
 
### 3.5. Vista Detallada del Ticket
 
Al hacer clic en un ticket del listado, el agente accede a la vista de detalle, que consolida toda la información del caso en una sola pantalla:
 
**Panel de información del cliente:**
- Correo electrónico del remitente
- RUT (o aviso de "no encontrado")
- Teléfono (o aviso de "no encontrado")
- Dirección (o aviso de "no encontrado")
- Nota de enriquecimiento (si aplica)
 
**Panel de estado y metadatos del ticket:**
- Número de ticket
- Estado actual con selector para cambio manual de estado
- Categoría asignada con selector para modificarla
- Agente asignado
- Fecha de creación
- Fecha de última actualización
- Fecha de cierre (si aplica)
- Tiempo total abierto
 
**Hilo cronológico de mensajes:**
- Todos los mensajes del ticket ordenados cronológicamente del más antiguo al más reciente.
- Cada mensaje indica visualmente si es entrante del cliente (`CLIENTE`) o saliente del agente (`AGENTE`).
- Cada mensaje muestra la fecha y hora de envío/recepción.
- Los mensajes outbound muestran el nombre del agente que los envió.
- El contenido de cada mensaje se renderiza en Markdown.
 
**Visor de archivos adjuntos:**
- Lista de adjuntos vinculados a cada mensaje.
- Al hacer clic en un adjunto, el sistema genera un **Signed URL temporal** (válido por 60 minutos) desde Supabase Storage y abre el archivo para visualización o descarga.
- Se muestra el nombre del archivo, tipo y tamaño.
 
---
 
## 4. Módulo de Comunicación y Respuesta (Outbound)
 
Gestiona el envío de respuestas del agente hacia el cliente, garantizando la identidad institucional de Prontomatic en toda comunicación saliente.
 
### 4.1. Editor de Respuesta
 
El área de redacción de respuesta está disponible en la parte inferior de la vista de detalle del ticket y es accesible para el agente asignado, el supervisor y el administrador.
 
- El editor soporta texto plano. El contenido se envía tal como es redactado por el agente.
- El agente puede adjuntar archivos a su respuesta desde el editor (pendiente de definición en la versión inicial).
- El área de respuesta no es visible para usuarios con sesión no autenticada.
 
### 4.2. Proceso de Envío de Respuesta
 
Al presionar "Enviar respuesta", el sistema ejecuta el siguiente flujo:
 
1. La interfaz envía una petición autenticada a `/api/tickets/[id]/responder` con el contenido de la respuesta.
2. El API Route valida el JWT y verifica que el usuario tenga permiso para responder el ticket.
3. El sistema construye el payload para la API de SendGrid Mail Send:
   - `from`: `contacto@prontomatic.cl` (siempre, independientemente del agente)
   - `from.name`: `Prontomatic Soporte`
   - `to`: correo del cliente
   - `subject`: `[#NNN] Re: <asunto original>` (con la etiqueta de ID del ticket insertada)
   - `In-Reply-To` y `References`: headers del correo original para mantener el hilo
4. SendGrid envía el correo al cliente.
5. El sistema crea un registro en la tabla `Message` con `sender_type: AGENTE`, `author_id: [ID del agente]`, `body: [contenido]`, `send_status: ENVIADO`.
6. La interfaz muestra el nuevo mensaje en el hilo del ticket.
 
### 4.3. Enmascaramiento de Emisor
 
El cliente **nunca ve** el nombre ni el correo personal del agente que gestiona su ticket. Todas las respuestas del sistema llegan desde `Prontomatic Soporte <contacto@prontomatic.cl>`, garantizando consistencia de marca y protegiendo la privacidad del agente.
 
### 4.4. Cambio de Estado Post-Respuesta
 
Al enviar una respuesta, el agente tiene la opción de cambiar el estado del ticket en el mismo acto mediante un selector junto al botón de envío:
 
| Opción seleccionada | Estado resultante del ticket |
|---|---|
| "Enviar y mantener en proceso" | El ticket permanece en `EN_PROCESO_INTERNO` |
| "Enviar y esperar respuesta del cliente" | El ticket pasa a `EN_ESPERA_CLIENTE`. Se activa el contador de inactividad de 48 horas. |
| "Enviar y cerrar ticket" | El ticket pasa directamente a `CERRADO`. Se popula `closed_at`. Se dispara la encuesta CSAT. |
 
En todos los casos, el cambio de estado genera un registro en `StatusHistory`.
 
---
 
## 5. Módulo de Automatización y SLAs (Background)
 
Conjunto de procesos automáticos que operan en segundo plano para garantizar la higiene del sistema, el cumplimiento de los acuerdos de nivel de servicio y la comunicación proactiva con el cliente.
 
### 5.1. Job de Monitoreo de Inactividad (Regla de las 48 Horas)
 
El sistema ejecuta periódicamente un proceso de fondo que evalúa todos los tickets en estado `EN_ESPERA_CLIENTE` y verifica cuánto tiempo ha transcurrido desde la última respuesta del cliente (`last_client_reply_at`).
 
**Frecuencia de ejecución:** El job se ejecuta cada hora (configurable). Evalúa todos los tickets con `status = EN_ESPERA_CLIENTE`.
 
**Lógica del job:**
 
```
Para cada ticket en estado EN_ESPERA_CLIENTE:
  tiempo_inactivo = ahora() - last_client_reply_at
 
  Si tiempo_inactivo >= 24h Y notificación de cortesía NO enviada:
    → Enviar correo de aviso de cierre próximo al cliente
    → Registrar que la notificación fue enviada
 
  Si tiempo_inactivo >= 48h:
    → Cambiar estado del ticket a CERRADO
    → Popular closed_at con la hora actual
    → Crear registro en StatusHistory con is_system_action: true
    → Disparar encuesta CSAT al cliente
```
 
### 5.2. Notificación de Cortesía (Aviso de Cierre Próximo)
 
Antes del cierre automático, el sistema envía un correo de aviso al cliente para informarle que su ticket está próximo a cerrarse por inactividad. Este correo se envía cuando el ticket lleva entre 24 y 36 horas sin respuesta del cliente (el umbral exacto es configurable por el Administrador).
 
**Contenido del correo de aviso:**
- Referencia al número de ticket (`#NNN`) y asunto original.
- Indicación de que el caso será cerrado automáticamente por falta de respuesta.
- Instrucción para responder al correo si el cliente aún necesita asistencia.
- El correo se envía desde `contacto@prontomatic.cl` con los headers de hilo correspondientes para que aparezca dentro de la misma conversación en el cliente de correo del cliente.
 
> **Nota de implementación:** Para rastrear si la notificación de cortesía ya fue enviada a un ticket, se puede agregar el campo booleano `courtesy_notice_sent` a la tabla `Ticket`, o bien consultarlo a través de los registros de `StatusHistory`. La decisión de implementación queda a criterio del desarrollador.
 
### 5.3. Cierre Automático por Inactividad
 
Al cumplirse las 48 horas sin respuesta del cliente en un ticket con estado `EN_ESPERA_CLIENTE`:
 
1. El sistema cambia el estado del ticket a `CERRADO`.
2. Se popula el campo `closed_at` con el timestamp exacto del cierre.
3. Se crea un registro en `StatusHistory` con:
   - `previous_status: EN_ESPERA_CLIENTE`
   - `new_status: CERRADO`
   - `changed_by: null`
   - `is_system_action: true`
4. Se dispara el envío de la encuesta de satisfacción CSAT al cliente.
5. Se detiene el contador de SLA del ticket.
 
### 5.4. Encuesta de Satisfacción CSAT (Post-Cierre)
 
Inmediatamente tras el cierre de un ticket (ya sea por acción del agente o por el cierre automático), el sistema dispara el envío de un correo electrónico automatizado al cliente con una encuesta de satisfacción (CSAT — Customer Satisfaction Score).
 
**Trigger:** Cualquier transición al estado `CERRADO`, independientemente de si fue manual o automática.
 
**Mecanismo de envío:** Correo electrónico enviado a través de SendGrid Mail Send API desde `contacto@prontomatic.cl`.
 
**Contenido del correo:**
- Agradecimiento por contactar a Prontomatic.
- Referencia al caso cerrado (número de ticket y asunto).
- Enlace a la encuesta de satisfacción.
- El correo se envía con los headers de hilo para que aparezca dentro de la conversación original.
 
**Destino del enlace de la encuesta:** ⚠️ **Pendiente de definición.** La opción candidata actualmente es un formulario de Google Forms, por su simplicidad de implementación y sin costo adicional. La decisión final debe tomarse antes del inicio del desarrollo del módulo de notificaciones. Ver sección 8 (Decisiones Funcionales Pendientes).
 
**Respuestas de la encuesta:** Los resultados de la encuesta son externos al sistema en la versión inicial (se gestionan en la plataforma donde esté alojado el formulario). La integración de los resultados al panel de métricas de ProntoTicket queda como mejora futura.
 
---
 
## 6. Módulo de Administración y Auditoría (Supervisión)
 
Funcionalidades exclusivas para los roles `SUPERVISOR` y `ADMINISTRADOR`, orientadas al control operativo, la auditoría de agentes y la configuración del sistema.
 
### 6.1. Gestión de Usuarios y Roles (Solo Administrador)
 
El Administrador es el único rol con capacidad de gestionar los usuarios del sistema. Las operaciones disponibles son:
 
| Operación | Descripción |
|---|---|
| **Alta de usuario** | Crear una nueva cuenta de agente o supervisor en Supabase Auth y su perfil correspondiente en la tabla `Profile`. |
| **Asignación de rol** | Modificar el rol de un usuario existente (`AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`). |
| **Desactivación de usuario** | Establecer `is_active = false` en el perfil del usuario. El usuario pierde acceso al sistema inmediatamente pero sus registros históricos (tickets atendidos, mensajes enviados, cambios de estado) se conservan íntegramente para auditoría. |
| **Reactivación de usuario** | Restablecer `is_active = true` para que el usuario pueda volver a operar en el sistema. |
 
> No existe autoregistro. Ningún usuario puede crear su propia cuenta.
 
### 6.2. Gestión de Categorías (Solo Administrador)
 
El Administrador gestiona el catálogo de categorías disponibles para clasificar los tickets. Las operaciones disponibles son:
 
| Operación | Descripción |
|---|---|
| **Crear categoría** | Agregar una nueva categoría con nombre y descripción opcional. |
| **Editar categoría** | Modificar el nombre o descripción de una categoría existente. |
| **Desactivar categoría** | Establecer `is_active = false`. La categoría deja de aparecer como opción al clasificar nuevos tickets, pero los tickets históricos que la tenían asignada conservan su referencia. |
 
> Las categorías específicas para Prontomatic están pendientes de definición por el equipo antes de la puesta en producción.
 
### 6.3. Panel de Auditoría de Estados (Supervisor y Administrador)
 
Permite consultar el historial completo de cualquier ticket a través de la tabla `StatusHistory`, respondiendo las preguntas clave de auditoría:
 
- ¿Quién tomó el ticket y cuándo?
- ¿Cuánto tiempo estuvo el ticket en cada estado?
- ¿Cuándo y por qué se cerró el ticket?
- ¿El cierre fue manual (por un agente) o automático (por el sistema)?
- ¿Cuántos tickets de un agente específico fueron cerrados automáticamente (posible indicador de abandono de casos)?
 
**Información visible por cada registro de `StatusHistory`:**
 
| Campo | Descripción |
|---|---|
| Timestamp | Fecha y hora exacta del cambio |
| Estado anterior | Estado previo del ticket |
| Estado nuevo | Estado al que transitó el ticket |
| Responsable | Nombre del agente o "Sistema" si fue automático |
| Duración en estado anterior | Tiempo calculado entre este registro y el anterior |
 
### 6.4. Reportes de Desempeño (Supervisor y Administrador)
 
Panel de métricas operativas para evaluar el desempeño del equipo de soporte. Las métricas disponibles en la versión inicial son:
 
**Métricas por agente:**
 
| Métrica | Descripción |
|---|---|
| Tickets tomados | Cantidad de tickets tomados por el agente en el período seleccionado. |
| Tickets cerrados | Cantidad de tickets llevados al estado `CERRADO` por el agente. |
| Tiempo promedio de primera respuesta | Tiempo promedio entre la creación del ticket y el primer mensaje outbound del agente. |
| Tiempo promedio de resolución (MTTR) | Tiempo promedio entre `created_at` y `closed_at` de los tickets cerrados por el agente. |
| Tickets cerrados automáticamente | Cantidad de tickets asignados al agente que fueron cerrados por el sistema (indicador de seguimiento deficiente). |
 
**Métricas globales del sistema:**
 
| Métrica | Descripción |
|---|---|
| Total de tickets por período | Volumen total de tickets recibidos en el rango de fechas seleccionado. |
| Tickets por estado | Distribución de tickets según su estado actual. |
| Tickets por categoría | Distribución de tickets según categoría (requiere que los tickets estén categorizados). |
| Tiempo promedio de resolución global | MTTR considerando todos los tickets cerrados en el período. |
| Tasa de cierre automático | Porcentaje de tickets cerrados automáticamente por inactividad vs. cerrados manualmente. |
 
> **Nota:** Los resultados de las encuestas CSAT no se integran al panel de métricas en la versión inicial, dado que el formulario de encuesta es externo al sistema. Queda como mejora futura.
 
---
 
## 7. Requerimientos No Funcionales
 
Los siguientes requerimientos aplican de forma transversal a todos los módulos del sistema.
 
### 7.1. Seguridad
 
| Requerimiento | Detalle |
|---|---|
| **Autenticación obligatoria** | Todas las rutas del dashboard requieren sesión activa. Un usuario no autenticado es redirigido al login. No existe ninguna pantalla operativa accesible sin autenticación. |
| **Autorización por rol (RBAC)** | Cada endpoint de la API verifica el rol del usuario autenticado antes de ejecutar cualquier lógica. La verificación ocurre en el servidor, no solo en el cliente. |
| **Protección del webhook** | El endpoint `/api/webhook/ingesta` valida la firma HMAC de SendGrid en cada petición. Las peticiones sin firma válida se rechazan con `HTTP 403`. |
| **Tokens JWT seguros** | Las sesiones se mantienen mediante JWT almacenados en cookies `HttpOnly`, no accesibles desde JavaScript del cliente, previniendo ataques XSS. |
| **Variables de entorno** | Ninguna credencial (API keys, strings de conexión, claves privadas) se almacena en el código fuente. Todas se gestionan como variables de entorno y se excluyen del repositorio mediante `.gitignore`. |
 
### 7.2. Privacidad de Datos
 
| Requerimiento | Detalle |
|---|---|
| **Archivos adjuntos privados** | Los archivos almacenados en Supabase Storage residen en un bucket privado. No tienen URL pública permanente. El acceso se otorga únicamente mediante Signed URLs temporales generadas bajo sesión autenticada. |
| **Identidad del agente protegida** | El nombre y correo del agente nunca se expone en las comunicaciones con el cliente. Todas las respuestas salen bajo la identidad institucional `contacto@prontomatic.cl`. |
| **Datos de clientes en tránsito** | Toda la comunicación entre el cliente (navegador) y el servidor ocurre sobre HTTPS. |
 
### 7.3. Escalabilidad y Rendimiento
 
| Requerimiento | Detalle |
|---|---|
| **Arquitectura Serverless** | Next.js desplegado en una plataforma serverless (Vercel u similar) escala automáticamente ante picos de carga sin necesidad de gestión de infraestructura manual. |
| **Volumen objetivo** | El sistema está dimensionado para procesar entre 60 y 70 correos diarios y gestionar entre 30 y 40 tickets activos simultáneamente. |
| **Índices de base de datos** | Los campos consultados frecuentemente (`status`, `assigned_to`, `last_client_reply_at`) tienen índices definidos en PostgreSQL para garantizar tiempos de respuesta adecuados. Ver [`modelo-de-datos.md`](./modelo-de-datos.md) sección 9. |
| **Polling eficiente** | El mecanismo de actualización del dashboard realiza consultas ligeras (solo IDs y timestamps modificados) para minimizar el tráfico de red y la carga en la base de datos. |
 
### 7.4. Disponibilidad
 
| Requerimiento | Detalle |
|---|---|
| **Tolerancia a fallos de MySQL** | Si la base de datos MySQL legacy de Prontomatic no está disponible durante la ingesta de un correo, el ticket se crea igualmente con los campos de enriquecimiento en `null`. El sistema no es bloqueado por la indisponibilidad de la base de datos externa. |
| **Tolerancia a fallos de SendGrid (outbound)** | Si el envío de una respuesta falla, el error se registra en el campo `send_status` del mensaje y se notifica al agente. El agente puede reintentar manualmente. El sistema no reintenta automáticamente para evitar envíos duplicados. |
 
---
 
## 8. Decisiones Funcionales Pendientes
 
Las siguientes decisiones funcionales están identificadas pero no han sido finalizadas al momento de redacción de este documento. Deben resolverse antes del inicio del desarrollo del módulo correspondiente.
 
| # | Decisión pendiente | Módulo afectado | Opciones consideradas |
|---|---|---|---|
| **DP-01** | Destino del enlace de la encuesta CSAT | Módulo de Automatización (Sección 5.4) | Google Forms (candidato principal) / Formulario propio dentro de ProntoTicket / Otra herramienta externa (Typeform, etc.) |
| **DP-02** | Categorías específicas de tickets para Prontomatic | Módulo de Dashboard (Sección 3.3) y Administración (Sección 6.2) | Pendiente de definición por el equipo de Prontomatic antes de la puesta en producción. |
| **DP-03** | Umbral exacto de la notificación de cortesía (entre 24h y 36h) | Módulo de Automatización (Sección 5.2) | Configurable por el Administrador. Valor por defecto sugerido: 24 horas. |
| **DP-04** | Capacidad del agente de adjuntar archivos en respuestas outbound | Módulo de Comunicación (Sección 4.1) | No definido para la versión inicial. Evaluación pendiente. |
| **DP-05** | Plataforma de despliegue (hosting) de la aplicación Next.js | Transversal | Vercel (candidato principal por integración nativa con Next.js) / Otra plataforma serverless. |
 
---
 
## 9. Matriz de Funcionalidades por Rol
 
La siguiente matriz consolida todas las funcionalidades del sistema y los roles que tienen acceso a cada una.
 
| Funcionalidad | Agente | Supervisor | Administrador |
|---|:---:|:---:|:---:|
| **Ingesta y Procesamiento** | | | |
| Recepción automática de correos vía webhook | — | — | — |
| Creación automática de tickets | — | — | — |
| **Dashboard** | | | |
| Ver dashboard global de tickets | ✅ | ✅ | ✅ |
| Ver tickets de otros agentes | ❌ | ✅ | ✅ |
| Filtrar tickets por estado | ✅ | ✅ | ✅ |
| Filtrar tickets por categoría | ✅ | ✅ | ✅ |
| Filtrar tickets por agente | ❌ | ✅ | ✅ |
| Tomar un ticket | ✅ | ✅ | ✅ |
| Ver detalle completo de un ticket | ✅ | ✅ | ✅ |
| Ver datos enriquecidos del cliente | ✅ | ✅ | ✅ |
| Ver hilo de mensajes del ticket | ✅ | ✅ | ✅ |
| Ver y descargar archivos adjuntos | ✅ | ✅ | ✅ |
| **Comunicación** | | | |
| Redactar y enviar respuesta al cliente | ✅ | ✅ | ✅ |
| Cambiar estado del ticket manualmente | ✅ | ✅ | ✅ |
| Asignar categoría al ticket | ✅ | ✅ | ✅ |
| **Automatización** | | | |
| Configurar umbral de notificación de cortesía | ❌ | ❌ | ✅ |
| **Auditoría y Métricas** | | | |
| Ver historial de estados de un ticket | ❌ | ✅ | ✅ |
| Ver métricas de desempeño propias | ✅ | ✅ | ✅ |
| Ver métricas de desempeño del equipo | ❌ | ✅ | ✅ |
| Ver métricas globales del sistema | ❌ | ✅ | ✅ |
| **Administración** | | | |
| Crear y gestionar usuarios | ❌ | ❌ | ✅ |
| Asignar y modificar roles | ❌ | ❌ | ✅ |
| Crear y gestionar categorías | ❌ | ❌ | ✅ |
| Configurar parámetros del sistema | ❌ | ❌ | ✅ |
 
> **Nota:** Las filas marcadas con `—` corresponden a procesos automáticos del sistema que no son ejecutados por ningún rol de usuario.