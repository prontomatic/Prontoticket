# Modelo de Datos - Sistema ProntoTicket

## 1. Arquitectura de Datos e Integración de Motores
 
El sistema ProntoTicket utiliza una **arquitectura de persistencia híbrida** gestionada a través de Prisma ORM. Esta configuración permite interactuar con dos motores de base de datos completamente independientes, cada uno con una responsabilidad bien delimitada:
 
| Motor | Proveedor | Modo de Acceso | Responsabilidad |
|---|---|---|---|
| **PostgreSQL** | Supabase | Lectura y escritura | Base de datos operativa principal de ProntoTicket. Almacena toda la lógica interna: usuarios, categorías, tickets, mensajes, adjuntos y auditoría. |
| **MySQL** | Legacy Prontomatic | Solo lectura | Acceso a los datos maestros de clientes de Prontomatic para el proceso de enriquecimiento de tickets. ProntoTicket nunca escribe en esta base de datos. |
 
### 1.1. Principio de Aislamiento
 
Ambas bases de datos operan de forma completamente aislada entre sí. **No existe ninguna clave foránea cruzada entre PostgreSQL y MySQL.** El vínculo entre un ticket y los datos del cliente de la base MySQL se materializa en el momento de la creación del ticket: los campos `client_rut`, `client_phone` y `client_address` se copian desde MySQL hacia la tabla `Ticket` en PostgreSQL. A partir de ese momento, el ticket es autónomo y no depende de la disponibilidad de la base MySQL para su consulta o gestión.
 
Este principio garantiza que si la base de datos MySQL legacy de Prontomatic estuviera temporalmente inaccesible, los tickets ya creados pueden seguir siendo gestionados con normalidad, y los tickets nuevos se crean igualmente con los campos de enriquecimiento marcados como no encontrados.
 
---
 
## 2. Convenciones del Modelo
 
Las siguientes convenciones aplican a todas las entidades del modelo de datos de ProntoTicket:
 
| Convención | Detalle |
|---|---|
| **Nomenclatura de tablas** | PascalCase para entidades Prisma (`Ticket`, `Message`, `Profile`). La tabla MySQL legacy conserva su nombre original (`usuarios`). |
| **Nomenclatura de campos** | snake_case para todos los campos (`client_email`, `created_at`, `storage_path`). |
| **IDs en PostgreSQL** | Los IDs de tipo `Int` son autoincrementales (`@id @default(autoincrement())`). Los IDs de tipo `UUID` se generan con `@default(uuid())`. Ver detalle por tabla. |
| **Timestamps** | Todas las entidades principales incluyen `created_at` con valor por defecto `now()`. Las entidades que se modifican incluyen `updated_at` con `@updatedAt`. |
| **Campos opcionales** | Los campos `Nullable` en Prisma se declaran con el operador `?` y permiten almacenar `null` cuando el dato no está disponible. |
| **Soft Delete** | El sistema no implementa soft delete en esta versión. Los registros eliminados se borran físicamente de la base de datos. |
| **Zona horaria** | Todos los timestamps se almacenan en UTC. La conversión a hora local de Chile (America/Santiago) se realiza en la capa de presentación. |
 
---
 
## 3. Entidades en PostgreSQL (Supabase)
 
### 3.1. Tabla: `Profile` — Perfiles de Usuario
 
Gestiona la identidad y el rol de cada usuario interno del sistema (agentes, supervisores y administradores). Esta tabla está directamente vinculada a **Supabase Auth**: cada registro en `Profile` corresponde a un usuario autenticado en Supabase, y su `id` es el mismo UUID que Supabase Auth asigna al usuario durante el registro.
 
**Cuándo se crea un registro:** Un registro en `Profile` se crea únicamente cuando el Administrador del sistema da de alta a un nuevo usuario desde el panel de administración. No existe autoregistro.
 
**Cuándo se actualiza:** Cuando el Administrador modifica el nombre, rol o estado activo del usuario.
 
| Campo | Tipo Prisma | Restricciones | Descripción |
|---|---|---|---|
| `id` | `String` (UUID) | `@id` — Primary Key | UUID generado por Supabase Auth al crear el usuario. Es el mismo ID que identifica al usuario en toda la plataforma Supabase. |
| `email` | `String` | `@unique`, Required | Correo institucional del usuario. Debe corresponder exactamente al correo registrado en Supabase Auth. |
| `full_name` | `String` | Required | Nombre completo del usuario, utilizado para mostrar la identidad del agente en el dashboard y en los logs de auditoría. |
| `role` | `UserRole` (Enum) | `@default(AGENTE)` | Rol del usuario en el sistema. Determina los permisos de acceso. Ver enum `UserRole` en sección 6. |
| `is_active` | `Boolean` | `@default(true)` | Indica si el usuario puede iniciar sesión y operar en el sistema. Un usuario inactivo no puede tomar tickets ni responder. El Administrador puede desactivar usuarios sin eliminarlos. |
| `created_at` | `DateTime` | `@default(now())` | Fecha y hora en que el usuario fue registrado en el sistema. |
 
**Relaciones:**
- Un `Profile` puede tener muchos `Ticket` asignados (`assigned_to`).
- Un `Profile` puede ser el autor de muchos `Message` (outbound).
- Un `Profile` puede tener muchos registros en `StatusHistory` (como `changed_by`).
 
---
 
### 3.2. Tabla: `Category` — Categorización de Tickets
 
Permite clasificar los tickets por tipo de caso para facilitar el triaje, la priorización y la obtención de métricas operativas (cuántos tickets por categoría, cuál categoría tarda más en resolverse, etc.).
 
**Cuándo se crea un registro:** Las categorías son creadas y gestionadas exclusivamente por el rol Administrador desde el panel de configuración del sistema. No se crean automáticamente.
 
**Estado inicial:** Las categorías específicas para Prontomatic están pendientes de definición por parte del equipo. La tabla estará vacía hasta que el Administrador las configure antes de la puesta en producción.
 
| Campo | Tipo Prisma | Restricciones | Descripción |
|---|---|---|---|
| `id` | `Int` | `@id @default(autoincrement())` — Primary Key | Identificador numérico autoincremental de la categoría. |
| `name` | `String` | `@unique`, Required | Nombre de la categoría. Debe ser único y descriptivo. Ejemplos orientativos: `"Falla de Maquinaria"`, `"Problema con App"`, `"Consulta de Recaudación"`, `"Solicitud de Servicio Técnico"`. Los nombres exactos serán definidos por Prontomatic. |
| `description` | `String?` | Nullable | Descripción detallada de qué tipos de casos abarca esta categoría. Útil para que los agentes puedan clasificar correctamente los tickets. |
| `is_active` | `Boolean` | `@default(true)` | Permite desactivar una categoría sin eliminarla, de modo que ya no esté disponible para nuevos tickets pero los tickets históricos con esa categoría conserven su referencia. |
| `created_at` | `DateTime` | `@default(now())` | Fecha de creación de la categoría. |
 
**Relaciones:**
- Una `Category` puede estar asociada a muchos `Ticket`.
 
---
 
### 3.3. Tabla: `Ticket` — Entidad Central
 
Es la entidad más importante del sistema. Representa un caso de soporte completo: desde el correo original del cliente hasta su resolución. Cada correo entrante válido que supera la etapa de validación y deduplicación genera exactamente un registro en esta tabla.
 
**Cuándo se crea un registro:** Automáticamente al procesar un correo entrante válido desde el webhook de SendGrid Inbound Parse.
 
**ID como número de caso:** El campo `id` es un entero autoincremental, lo que significa que los tickets tendrán números de caso legibles por los agentes: `#1`, `#2`, `#3`, etc. Este número es el identificador que los agentes utilizarán para referirse a un caso tanto internamente como en comunicaciones con el cliente.
 
| Campo | Tipo Prisma | Restricciones | Descripción |
|---|---|---|---|
| `id` | `Int` | `@id @default(autoincrement())` — Primary Key | Número de caso autoincremental. Legible por el agente. Ejemplo: ticket `#142`. |
| `subject` | `String` | Required | Asunto del correo original, tal como fue recibido desde SendGrid. Se utiliza como título del ticket en el dashboard. |
| `content` | `String` | Required | Cuerpo del correo original, convertido de HTML a Markdown por el servicio de normalización. Es el mensaje inicial del cliente. |
| `status` | `TicketStatus` (Enum) | `@default(ABIERTO)` | Estado actual del ticket en su ciclo de vida. Ver enum `TicketStatus` en sección 6. |
| `client_email` | `String` | Required | Dirección de correo electrónico del remitente original. Es el identificador principal del cliente en el sistema. |
| `client_rut` | `String?` | Nullable | RUT del cliente, recuperado de la base de datos MySQL legacy durante el enriquecimiento. Es `null` si no se encontró el cliente o si el campo no existía en MySQL. |
| `client_phone` | `String?` | Nullable | Teléfono de contacto del cliente, recuperado de MySQL. Es `null` si no se encontró. |
| `client_address` | `String?` | Nullable | Dirección física del cliente o comunidad, recuperada de MySQL. Es `null` si no se encontró. |
| `enrichment_note` | `String?` | Nullable | Nota de enriquecimiento generada automáticamente por el sistema cuando uno o más campos del cliente no se encontraron en MySQL. Ejemplo: `"Teléfono no encontrado. Dirección no encontrada."`. Visible para el agente en la vista del ticket. |
| `category_id` | `Int?` | Foreign Key → `Category.id`, Nullable | Categoría asignada al ticket. Es `null` inicialmente; el agente la asigna al tomar el ticket. |
| `assigned_to` | `String?` (UUID) | Foreign Key → `Profile.id`, Nullable | ID del agente que tomó el ticket desde el dashboard. Es `null` mientras el ticket no haya sido tomado por ningún agente. |
| `created_at` | `DateTime` | `@default(now())` | Fecha y hora exacta en que el webhook de SendGrid disparó la creación del ticket. |
| `updated_at` | `DateTime` | `@updatedAt` | Fecha y hora de la última modificación del ticket (cambio de estado, asignación, nuevo mensaje). Actualizado automáticamente por Prisma. |
| `closed_at` | `DateTime?` | Nullable | Fecha y hora exacta en que el ticket pasó al estado `CERRADO`. Se popula al momento del cierre (manual por el agente o automático por inactividad). Es `null` mientras el ticket esté abierto. Utilizado para el cálculo de tiempo total de resolución (SLA). |
| `last_client_reply_at` | `DateTime?` | Nullable | Fecha y hora del último mensaje recibido desde el cliente (inbound). Es el campo que el sistema evalúa para determinar si han pasado más de 48 horas de inactividad del cliente y activar el protocolo de cierre automático. |
 
**Relaciones:**
- Un `Ticket` tiene muchos `Message` (el hilo de conversación completo).
- Un `Ticket` tiene muchos registros en `StatusHistory` (el historial de cambios de estado).
- Un `Ticket` pertenece a una `Category` (opcional hasta que el agente lo categorice).
- Un `Ticket` está asignado a un `Profile` (opcional hasta que un agente lo tome).
 
---
 
### 3.4. Tabla: `Message` — Hilo de Conversación
 
Registra de forma cronológica e inmutable todas las interacciones asociadas a un ticket: tanto los mensajes entrantes del cliente (`CLIENTE`) como las respuestas salientes del agente (`AGENTE`). Cada mensaje es un registro independiente vinculado a su ticket raíz.
 
**Cuándo se crea un registro de tipo `CLIENTE`:** Automáticamente al procesar el correo entrante desde el webhook de SendGrid. El primer mensaje de tipo `CLIENTE` es siempre el correo original que dio origen al ticket. Los correos de seguimiento del cliente (respuestas al hilo) también generan nuevos registros de tipo `CLIENTE`.
 
**Cuándo se crea un registro de tipo `AGENTE`:** Cuando el agente redacta y envía una respuesta desde el dashboard del ticket.
 
| Campo | Tipo Prisma | Restricciones | Descripción |
|---|---|---|---|
| `id` | `Int` | `@id @default(autoincrement())` — Primary Key | Identificador numérico autoincremental del mensaje. |
| `ticket_id` | `Int` | Foreign Key → `Ticket.id`, Required | Referencia al ticket al que pertenece este mensaje. |
| `sender_type` | `SenderType` (Enum) | Required | Indica el origen del mensaje: `CLIENTE` para mensajes entrantes (inbound) o `AGENTE` para respuestas salientes (outbound). Ver enum `SenderType` en sección 6. |
| `author_id` | `String?` (UUID) | Foreign Key → `Profile.id`, Nullable | ID del agente que redactó el mensaje. Solo se popula cuando `sender_type` es `AGENTE`. Para mensajes de tipo `CLIENTE`, este campo es `null`. |
| `body` | `String` | Required | Contenido del mensaje en formato Markdown. Para mensajes inbound, es el resultado de la conversión HTML → Markdown. Para mensajes outbound, es el texto redactado por el agente en el dashboard. |
| `message_id_header` | `String?` | `@unique`, Nullable | El valor del header `Message-ID` del correo electrónico original, tal como fue recibido por SendGrid. Se utiliza para la deduplicación (evitar procesar el mismo correo dos veces) y para la construcción de los headers `In-Reply-To` y `References` al enviar respuestas, garantizando la consistencia del hilo en el cliente de correo del cliente. Es `null` para mensajes outbound generados internamente. |
| `send_status` | `SendStatus` (Enum) | `@default(ENVIADO)` | Estado del envío del mensaje. Aplica principalmente a mensajes outbound. Ver enum `SendStatus` en sección 6. |
| `sent_at` | `DateTime` | `@default(now())` | Fecha y hora de envío (outbound) o recepción (inbound) del mensaje. |
 
**Relaciones:**
- Un `Message` pertenece a un `Ticket`.
- Un `Message` puede tener muchos `Attachment`.
- Un `Message` puede estar vinculado a un `Profile` (el agente autor, solo para outbound).
 
---
 
### 3.5. Tabla: `Attachment` — Archivos Adjuntos
 
Gestiona los metadatos de los archivos adjuntos enviados por los clientes en sus correos. El archivo físico se almacena en un bucket privado de **Supabase Storage**; esta tabla solo guarda la referencia (path) para poder recuperarlo.
 
**Cuándo se crea un registro:** Durante el procesamiento del webhook de SendGrid, si el payload incluye archivos adjuntos. Cada archivo genera un registro independiente en esta tabla.
 
**Tipos de archivo comunes en el contexto de Prontomatic:** Fotografías de máquinas dispensadoras con fallas, capturas de pantalla de errores en la aplicación, comprobantes de recaudación en PDF, documentos de contrato o garantía.
 
| Campo | Tipo Prisma | Restricciones | Descripción |
|---|---|---|---|
| `id` | `Int` | `@id @default(autoincrement())` — Primary Key | Identificador numérico autoincremental del adjunto. |
| `message_id` | `Int` | Foreign Key → `Message.id`, Required | Referencia al mensaje al que pertenece el archivo adjunto. Un mensaje puede tener múltiples adjuntos. |
| `file_name` | `String` | Required | Nombre original del archivo tal como fue enviado por el cliente. Ejemplo: `"foto_maquina_averiada.jpg"`, `"comprobante_octubre.pdf"`. |
| `storage_path` | `String` | Required | Ruta interna completa del archivo dentro del bucket privado de Supabase Storage. Ejemplo: `"tickets/142/adjuntos/foto_maquina_averiada.jpg"`. Esta ruta es la que se utiliza para generar los Signed URLs de acceso temporal desde el dashboard. |
| `mime_type` | `String` | Required | Tipo MIME del archivo. Ejemplos: `"image/jpeg"`, `"image/png"`, `"application/pdf"`, `"image/webp"`. Utilizado para determinar el ícono o visor adecuado en la interfaz del agente. |
| `file_size` | `Int?` | Nullable | Tamaño del archivo en bytes. Informativo, útil para mostrar al agente antes de descargar el archivo. |
| `created_at` | `DateTime` | `@default(now())` | Fecha y hora en que el adjunto fue procesado y almacenado. |
 
**Relaciones:**
- Un `Attachment` pertenece a un `Message`.
 
---
 
## 4. Auditoría y Trazabilidad Operativa
 
### 4.1. Tabla: `StatusHistory` — Historial de Estados
 
Registra de forma **inmutable y cronológica** cada cambio de estado que atraviesa un ticket a lo largo de su ciclo de vida. Esta tabla es la base de datos para la auditoría de agentes, el cálculo de SLA, el análisis de tiempos de permanencia en cada estado y la revisión histórica de cualquier caso.
 
**Cuándo se crea un registro:** Cada vez que el estado de un ticket cambia, ya sea por acción de un agente (manual) o por el sistema (automático, como el cierre por inactividad). La creación del ticket también genera el primer registro en esta tabla, con `previous_status` en `null` y `new_status` en `ABIERTO`.
 
**Inmutabilidad:** Los registros en esta tabla **nunca se modifican ni se eliminan**. Son el registro histórico oficial de todo lo que ocurrió con cada ticket. Esta característica es lo que hace posible una auditoría confiable.
 
| Campo | Tipo Prisma | Restricciones | Descripción |
|---|---|---|---|
| `id` | `Int` | `@id @default(autoincrement())` — Primary Key | Identificador numérico autoincremental del registro de auditoría. |
| `ticket_id` | `Int` | Foreign Key → `Ticket.id`, Required | Ticket sobre el cual se realizó el cambio de estado. |
| `previous_status` | `TicketStatus?` (Enum) | Nullable | Estado que tenía el ticket antes del cambio. Es `null` únicamente en el primer registro de auditoría de cada ticket (el de creación), ya que no existía un estado anterior. |
| `new_status` | `TicketStatus` (Enum) | Required | Estado al que transitó el ticket. |
| `changed_by` | `String?` (UUID) | Foreign Key → `Profile.id`, Nullable | ID del agente que realizó el cambio de estado manualmente. Es `null` cuando el cambio fue ejecutado automáticamente por el sistema (ej: cierre automático por inactividad de 48 horas, apertura del ticket por el webhook). |
| `is_system_action` | `Boolean` | `@default(false)` | Indica explícitamente si el cambio fue ejecutado por el sistema de forma automática (`true`) o por un agente de forma manual (`false`). Complementa la información de `changed_by` y facilita el filtrado en los reportes de auditoría. |
| `changed_at` | `DateTime` | `@default(now())` | Fecha y hora exacta del cambio de estado. Es el dato fundamental para calcular cuánto tiempo permaneció el ticket en cada estado. |
 
**Casos de uso de auditoría habilitados por esta tabla:**
 
- **Tiempo de primera respuesta:** Diferencia entre el `changed_at` del primer registro con `new_status = EN_PROCESO_INTERNO` y el `changed_at` del registro de creación (`new_status = ABIERTO`).
- **Tiempo total de resolución:** Diferencia entre el `changed_at` del registro con `new_status = CERRADO` y el `changed_at` del registro de creación.
- **Tiempo en espera del cliente:** Suma de los períodos en que el ticket estuvo en estado `EN_ESPERA_CLIENTE`.
- **Identificación de cierres automáticos:** Filtrar registros donde `new_status = CERRADO` y `is_system_action = true`.
- **Historial completo de un caso:** Consultar todos los registros de `StatusHistory` para un `ticket_id` dado, ordenados por `changed_at`.
 
**Relaciones:**
- Un `StatusHistory` pertenece a un `Ticket`.
- Un `StatusHistory` puede estar vinculado a un `Profile` (el agente que realizó el cambio, si aplica).
 
---
 
## 5. Entidades en MySQL (Consulta Externa — Solo Lectura)
 
### 5.1. Tabla: `users` — Maestro de Clientes Prontomatic
 
Esta tabla pertenece a la base de datos MySQL **preexistente** de Prontomatic y es accedida por ProntoTicket **únicamente en modo de solo lectura** durante la fase de enriquecimiento de tickets. ProntoTicket no escribe, modifica ni elimina ningún dato en esta tabla ni en ninguna otra tabla de la base de datos MySQL legacy.
 
**Cuándo se consulta:** Inmediatamente después de que el webhook de SendGrid entrega un nuevo correo y antes de crear el registro del ticket en PostgreSQL. El campo de búsqueda es el correo electrónico del remitente (`email`), que actúa como clave de cruce entre ambos sistemas.
 
> ✅ **Esquema confirmado:** Los nombres de tabla y columnas documentados a continuación han sido **verificados y confirmados** directamente contra la base de datos MySQL de Prontomatic. No requieren ajustes adicionales al configurar el modelo en `schema.prisma`.
 
| Campo | Tipo de Dato | Descripción |
|---|---|---|
| `id` | `INT` (autoincremental) | Identificador primario del registro de cliente en la base MySQL. ProntoTicket no utiliza este campo directamente, pero es la clave primaria de la tabla. |
| `email` | `VARCHAR` | Dirección de correo electrónico del cliente. Es el campo utilizado para el cruce de datos con el correo del remitente del ticket entrante. Campo de búsqueda principal de la consulta de enriquecimiento. |
| `rut` | `VARCHAR` | RUT del cliente para identificación legal en Chile. Formato almacenado: string (puede incluir guiones y dígito verificador). |
| `direccion` | `VARCHAR` | Dirección física asociada al cliente o a la comunidad/edificio donde está instalada la maquinaria de Prontomatic. |
| `telefono` | `VARCHAR` | Número de contacto telefónico principal del cliente. Almacenado como string para preservar formatos con guiones, paréntesis o código de país. |
 
**Consulta ejecutada por ProntoTicket durante el enriquecimiento:**
 
```sql
SELECT rut, telefono, direccion
FROM users
WHERE email = :email_remitente
LIMIT 1;
```
 
**Mapeo en `schema.prisma`:**
 
El modelo Prisma para esta tabla usa `@@map("users")` para hacer referencia al nombre real de la tabla en MySQL:
 
```prisma
model LegacyUser {
  id        Int     @id @default(autoincrement())
  email     String  @unique
  rut       String?
  direccion String?
  telefono  String?
 
  @@map("users")
}
```
 
**Comportamiento ante ausencia de datos:**
 
| Escenario | Comportamiento del sistema |
|---|---|
| Cliente encontrado con todos los campos | Los valores se almacenan en `client_rut`, `client_phone` y `client_address` del ticket. El campo `enrichment_note` queda `null`. |
| Cliente encontrado pero con campos vacíos o `null` | Los campos faltantes se almacenan como `null` en el ticket. El sistema genera una nota en `enrichment_note` indicando qué campos no se encontraron. |
| Cliente no encontrado (sin coincidencia de email) | Los tres campos quedan `null`. El sistema genera `enrichment_note` con el texto: `"Cliente no encontrado en la base de datos. RUT, Teléfono y Dirección no disponibles."` |
| Base de datos MySQL inaccesible (error de conexión) | El ticket se crea igualmente con los tres campos en `null`. El sistema genera `enrichment_note` con el texto: `"Error al consultar base de datos de clientes. Datos de contacto no disponibles."` El error se registra en los logs del servidor. |
 
---
 
## 6. Enums y Tipos de Datos Globales
 
Los siguientes enums se definen en el archivo `schema.prisma` y son compartidos por las entidades del modelo.
 
### `TicketStatus` — Estados del Ticket
 
Define el ciclo de vida completo de un ticket dentro del sistema.
 
| Valor | Descripción | ¿Quién lo asigna? |
|---|---|---|
| `ABIERTO` | Estado inicial. El ticket fue creado por el sistema al procesar el correo entrante. Aún no ha sido tomado por ningún agente. | Sistema (automático al crear el ticket) |
| `EN_PROCESO_INTERNO` | El ticket fue tomado por un agente y está siendo gestionado activamente. El agente está trabajando en la resolución o esperando información interna. | Agente (manual, al tomar el ticket) |
| `EN_ESPERA_CLIENTE` | El agente envió una respuesta o solicitó información adicional al cliente. El sistema espera respuesta del cliente. Este estado activa el contador de inactividad de 48 horas. | Agente (manual, al enviar una respuesta) |
| `CERRADO` | El caso fue resuelto. El ticket fue cerrado manualmente por el agente/supervisor o automáticamente por el sistema tras 48 horas de inactividad en estado `EN_ESPERA_CLIENTE`. Detiene el contador de SLA. | Agente (manual) o Sistema (automático por inactividad) |
 
**Diagrama de transiciones de estado:**
 
```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
[Correo entrante] ──► ABIERTO ──► EN_PROCESO_INTERNO ──► EN_ESPERA_CLIENTE
                                         │                    │
                                         │                    │ (>48h sin respuesta
                                         │                    │  del cliente)
                                         ▼                    ▼
                                       CERRADO ◄─────────── CERRADO
                                    (manual por            (automático
                                      agente)             por sistema)
                                         │
                                         │ (cliente responde por correo
                                         │  a un ticket cerrado)
                                         ▼
                                  Nuevo ticket creado
                                  (ticket original no
                                   se reabre)
```
 
**Matriz completa de transiciones permitidas:**
 
| Estado origen | Estado destino | Quién puede ejecutarlo | Condición |
|---|---|---|---|
| `ABIERTO` | `EN_PROCESO_INTERNO` | Agente, Supervisor, Admin | Al tomar el ticket (`PATCH /toma`). El ticket debe tener `assigned_to = null`. |
| `EN_PROCESO_INTERNO` | `EN_ESPERA_CLIENTE` | Agente (propio), Supervisor, Admin | Al enviar una respuesta con `set_status: EN_ESPERA_CLIENTE` o via `PATCH /estado`. |
| `EN_PROCESO_INTERNO` | `CERRADO` | Agente (propio), Supervisor, Admin | Al cerrar manualmente el ticket. |
| `EN_ESPERA_CLIENTE` | `EN_PROCESO_INTERNO` | Sistema (automático) | Cuando el cliente responde y se detecta un mensaje inbound nuevo. |
| `EN_ESPERA_CLIENTE` | `CERRADO` | Agente (propio), Supervisor, Admin, Sistema | Manual por agente, o automático por el sistema al cumplirse 48h de inactividad. |
| `CERRADO` | `ABIERTO` | ❌ No permitido | Un ticket cerrado **nunca se reabre**. Ver nota a continuación. |
 
> **Comportamiento ante respuesta de cliente a ticket cerrado:** Si un cliente responde por correo a un ticket en estado `CERRADO`, el sistema **no reabre el ticket existente**. En su lugar, crea un **nuevo ticket** con el correo del cliente como mensaje inicial, manteniendo el contexto histórico en el asunto (que incluirá el `[#NNN]` del ticket original). El agente verá el nuevo ticket en el dashboard como un caso `ABIERTO` independiente. Esta decisión de diseño garantiza la inmutabilidad del historial de tickets cerrados y simplifica la lógica de estado del sistema.
 
---
 
### `UserRole` — Roles de Usuario
 
| Valor | Descripción |
|---|---|
| `AGENTE` | Rol operativo. Acceso al dashboard, toma de tickets y gestión de la comunicación con el cliente. |
| `SUPERVISOR` | Rol de control. Todas las facultades del agente más acceso a métricas, auditoría y supervisión del equipo. |
| `ADMINISTRADOR` | Rol de configuración total. Gestión de usuarios, roles, categorías y parámetros del sistema. |
 
---
 
### `SenderType` — Tipo de Remitente en Mensajes
 
| Valor | Descripción |
|---|---|
| `CLIENTE` | El mensaje fue recibido desde el cliente vía correo electrónico (inbound). Procesado automáticamente por el webhook de SendGrid. |
| `AGENTE` | El mensaje fue enviado por un agente desde el dashboard de ProntoTicket (outbound). Enviado a través de la API de SendGrid Mail Send. |
 
---
 
### `SendStatus` — Estado de Envío de Mensajes Outbound
 
| Valor | Descripción |
|---|---|
| `ENVIADO` | El mensaje fue enviado exitosamente a través de la API de SendGrid. |
| `ERROR` | El envío falló. La API de SendGrid retornó un error. El agente debe ser notificado para reintentar manualmente. |
| `PENDIENTE` | El mensaje está en cola de envío (estado transitorio durante el procesamiento). |
 
---
 
## 7. Diagrama de Relaciones (ERD Textual)
 
El siguiente diagrama representa las relaciones entre las entidades del modelo de datos de PostgreSQL. La entidad MySQL (`usuarios`) se representa de forma separada por no tener relaciones de clave foránea con el resto del modelo.
 
```
┌─────────────────┐         ┌─────────────────────────────────────────────────┐
│    Category     │         │                     Ticket                      │
│─────────────────│         │─────────────────────────────────────────────────│
│ id (PK)         │◄────────│ id (PK)              Int   autoincrement        │
│ name            │  0..*   │ subject              String                     │
│ description     │         │ content              String                     │
│ is_active       │         │ status               TicketStatus               │
│ created_at      │         │ client_email         String                     │
└─────────────────┘         │ client_rut           String?                    │
                            │ client_phone         String?                    │
                            │ client_address       String?                    │
┌─────────────────┐         │ enrichment_note      String?                    │
│    Profile      │         │ category_id          Int? (FK → Category)       │
│─────────────────│         │ assigned_to          String? (FK → Profile)     │
│ id (PK)  UUID   │◄────────│ created_at           DateTime                   │
│ email           │  0..*   │ updated_at           DateTime                   │
│ full_name       │         │ closed_at            DateTime?                  │
│ role            │         │ last_client_reply_at DateTime?                  │
│ is_active       │         └──────────┬──────────────────────┬───────────────┘
│ created_at      │                    │ 1                    │ 1
└────────┬────────┘                    │                      │
         │                            │ 1..*                 │ 1..*
         │ 1                          ▼                      ▼
         │                  ┌──────────────────┐   ┌──────────────────────┐
         │ 1..*             │    Message       │   │    StatusHistory     │
         └─────────────────►│──────────────────│   │──────────────────────│
                            │ id (PK)          │   │ id (PK)              │
                            │ ticket_id (FK)   │   │ ticket_id (FK)       │
                            │ sender_type      │   │ previous_status      │
                            │ author_id (FK?)  │   │ new_status           │
                            │ body             │   │ changed_by (FK?)     │
                            │ message_id_header│   │ is_system_action     │
                            │ send_status      │   │ changed_at           │
                            │ sent_at          │   └──────────────────────┘
                            └────────┬─────────┘
                                     │ 1
                                     │ 0..*
                                     ▼
                            ┌──────────────────┐
                            │   Attachment     │
                            │──────────────────│
                            │ id (PK)          │
                            │ message_id (FK)  │
                            │ file_name        │
                            │ storage_path     │
                            │ mime_type        │
                            │ file_size        │
                            │ created_at       │
                            └──────────────────┘
 
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  MYSQL LEGACY (Solo Lectura — Sin FK cruzadas)
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 
                            ┌──────────────────┐
                            │      users       │
                            │──────────────────│
                            │ id               │
                            │ email            │◄── Consulta por email
                            │ rut              │    del remitente
                            │ direccion        │    al crear ticket
                            │ telefono         │
                            └──────────────────┘
```
 
---
 
## 8. Esquema Prisma Completo
 
El siguiente bloque representa el archivo `schema.prisma` completo del proyecto, con todos los modelos, relaciones, enums y configuraciones de datasource definidos.
 
```prisma
// ─── Datasources ─────────────────────────────────────────────────────────────
 
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
 
datasource legacy {
  provider = "mysql"
  url      = env("LEGACY_DATABASE_URL")
}
 
// ─── Generator ───────────────────────────────────────────────────────────────
 
generator client {
  provider = "prisma-client-js"
}
 
// ─── Enums ───────────────────────────────────────────────────────────────────
 
enum TicketStatus {
  ABIERTO
  EN_PROCESO_INTERNO
  EN_ESPERA_CLIENTE
  CERRADO
}
 
enum UserRole {
  AGENTE
  SUPERVISOR
  ADMINISTRADOR
}
 
enum SenderType {
  CLIENTE
  AGENTE
}
 
enum SendStatus {
  ENVIADO
  ERROR
  PENDIENTE
}
 
// ─── Modelos PostgreSQL ───────────────────────────────────────────────────────
 
model Profile {
  id         String    @id                // UUID de Supabase Auth
  email      String    @unique
  full_name  String
  role       UserRole  @default(AGENTE)
  is_active  Boolean   @default(true)
  created_at DateTime  @default(now())
 
  // Relaciones
  assigned_tickets  Ticket[]        @relation("AssignedAgent")
  messages          Message[]       @relation("MessageAuthor")
  status_changes    StatusHistory[] @relation("StatusChanger")
}
 
model Category {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  description String?
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
 
  // Relaciones
  tickets Ticket[]
}
 
model Ticket {
  id                   Int           @id @default(autoincrement())
  subject              String
  content              String
  status               TicketStatus  @default(ABIERTO)
  client_email         String
  client_rut           String?
  client_phone         String?
  client_address       String?
  enrichment_note      String?
  category_id          Int?
  assigned_to          String?       // UUID → Profile.id
  created_at           DateTime      @default(now())
  updated_at           DateTime      @updatedAt
  closed_at            DateTime?
  last_client_reply_at DateTime?
 
  // Relaciones
  category       Category?       @relation(fields: [category_id], references: [id])
  agent          Profile?        @relation("AssignedAgent", fields: [assigned_to], references: [id])
  messages       Message[]
  status_history StatusHistory[]
}
 
model Message {
  id                Int        @id @default(autoincrement())
  ticket_id         Int
  sender_type       SenderType
  author_id         String?    // UUID → Profile.id (solo outbound)
  body              String
  message_id_header String?    @unique
  send_status       SendStatus @default(ENVIADO)
  sent_at           DateTime   @default(now())
 
  // Relaciones
  ticket      Ticket       @relation(fields: [ticket_id], references: [id])
  author      Profile?     @relation("MessageAuthor", fields: [author_id], references: [id])
  attachments Attachment[]
}
 
model Attachment {
  id           Int      @id @default(autoincrement())
  message_id   Int
  file_name    String
  storage_path String
  mime_type    String
  file_size    Int?
  created_at   DateTime @default(now())
 
  // Relaciones
  message Message @relation(fields: [message_id], references: [id])
}
 
model StatusHistory {
  id              Int           @id @default(autoincrement())
  ticket_id       Int
  previous_status TicketStatus?
  new_status      TicketStatus
  changed_by      String?       // UUID → Profile.id (null si fue el sistema)
  is_system_action Boolean      @default(false)
  changed_at      DateTime      @default(now())
 
  // Relaciones
  ticket  Ticket   @relation(fields: [ticket_id], references: [id])
  agent   Profile? @relation("StatusChanger", fields: [changed_by], references: [id])
}
 
// ─── Modelo MySQL Legacy (Solo Lectura) ──────────────────────────────────────
 
// NOTA: Esquema verificado y confirmado contra la base de datos MySQL de Prontomatic.
 
model LegacyUser {
  id        Int     @id @default(autoincrement())
  email     String  @unique
  rut       String?
  direccion String?
  telefono  String?
 
  @@map("users")
}
```
 
---
 
## 9. Índices y Consideraciones de Rendimiento
 
Los siguientes índices son recomendados para garantizar el rendimiento de las consultas más frecuentes del sistema, considerando el volumen estimado de operación (30-40 tickets diarios activos).
 
| Tabla | Campo(s) | Tipo | Justificación |
|---|---|---|---|
| `Ticket` | `status` | Simple | El dashboard filtra tickets por estado constantemente. Sin índice, cada carga del dashboard requiere un full scan. |
| `Ticket` | `assigned_to` | Simple | Permite al supervisor filtrar tickets por agente eficientemente en el panel de métricas. |
| `Ticket` | `client_email` | Simple | Permite consultar el historial de tickets de un cliente específico. |
| `Ticket` | `created_at` | Simple | Usado para ordenar el dashboard por fecha de creación y para consultas de métricas por período. |
| `Ticket` | `last_client_reply_at` | Simple | El job de cierre automático consulta este campo periódicamente para encontrar tickets con más de 48 horas de inactividad. Un índice aquí es crítico para el rendimiento de ese proceso. |
| `Message` | `ticket_id` | Simple | Consulta frecuente: obtener todos los mensajes de un ticket. |
| `Message` | `message_id_header` | Único | Ya definido como `@unique` en el modelo. Garantiza deduplicación y acelera la búsqueda por Message-ID. |
| `StatusHistory` | `ticket_id` | Simple | Consulta frecuente: obtener el historial completo de estados de un ticket. |
| `LegacyUsuario` (MySQL) | `email` | Único (externo) | Debe existir en la base MySQL de Prontomatic. Si no existe, la consulta de enriquecimiento hará un full scan en cada correo entrante, lo que puede impactar el rendimiento. |
 
---
 
## 10. Reglas de Integridad y Restricciones de Negocio
 
Las siguientes reglas definen el comportamiento esperado del modelo de datos en situaciones específicas y deben ser respetadas tanto en la capa de repositorios como en la capa de servicios.
 
| # | Regla | Capa de Aplicación |
|---|---|---|
| **RI-01** | Un ticket solo puede tener un agente asignado (`assigned_to`) a la vez. Cuando un agente toma un ticket, el campo `assigned_to` se actualiza al ID de ese agente y se registra el cambio en `StatusHistory`. | `ticketService.js` + `ticketRepo.js` |
| **RI-02** | El campo `closed_at` solo puede popularse cuando el estado del ticket transiciona a `CERRADO`. En cualquier otro cambio de estado, `closed_at` debe permanecer `null`. | `ticketService.js` |
| **RI-03** | Cada cambio de estado del ticket debe generar obligatoriamente un registro en `StatusHistory`. No está permitido cambiar el estado de un ticket sin registrar la transición. | `ticketService.js` + `auditRepo.js` |
| **RI-04** | El campo `message_id_header` en la tabla `Message` es único. Antes de crear un nuevo mensaje inbound, el sistema debe verificar que el `Message-ID` del correo no exista ya en la tabla. Si existe, se descarta el mensaje sin crear duplicado. | `ticketService.js` + `messageRepo.js` |
| **RI-05** | Los registros en `StatusHistory` son inmutables. No se permite ninguna operación `UPDATE` ni `DELETE` sobre esta tabla desde la aplicación. | `auditRepo.js` |
| **RI-06** | ProntoTicket nunca ejecuta operaciones de escritura (`INSERT`, `UPDATE`, `DELETE`) sobre la base de datos MySQL legacy. Solo se permiten operaciones `SELECT`. | `customerRepo.js` |
| **RI-07** | Un usuario con `is_active = false` no puede tomar tickets ni enviar respuestas. La validación debe realizarse en la capa de servicios antes de procesar cualquier acción del agente. | `authService.js` |
| **RI-08** | La categoría de un ticket (`category_id`) solo puede ser asignada a una categoría con `is_active = true`. No se puede categorizar un ticket con una categoría desactivada. | `ticketService.js` |
| **RI-09** | El campo `last_client_reply_at` debe actualizarse cada vez que se recibe un mensaje nuevo de tipo `CLIENTE` (inbound). Este campo es la fuente de verdad para el cálculo del tiempo de inactividad del protocolo de cierre automático. | `ticketService.js` |
| **RI-10** | El cierre automático por inactividad solo puede activarse cuando el ticket está en estado `EN_ESPERA_CLIENTE`. Tickets en estado `ABIERTO` o `EN_PROCESO_INTERNO` no están sujetos al protocolo de cierre automático por inactividad. | `ticketService.js` |