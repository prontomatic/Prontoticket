# Arquitectura del Proyecto - Sistema ProntoTicket

## 1. Visión General de la Infraestructura
 
La arquitectura de ProntoTicket se define como una **solución Serverless Híbrida** construida sobre el ecosistema de Next.js. El término "híbrido" hace referencia a dos aspectos clave del sistema:
 
1. **Hibridez de bases de datos:** El sistema opera simultáneamente con dos motores de base de datos distintos — PostgreSQL (Supabase) para la gestión de tickets y MySQL (legacy de Prontomatic) para la consulta de datos maestros de clientes — comunicándose con ambos a través de Prisma ORM con conexiones configuradas independientemente.
 
2. **Hibridez de rendering:** Next.js permite mezclar Server Components (para lógica de servidor, consultas a base de datos y generación de vistas) con Client Components (para interactividad en el dashboard del agente), optimizando el rendimiento y reduciendo la carga de trabajo en el cliente.
 
### 1.1. Volumen Estimado de Operación
 
El sistema está diseñado para procesar un volumen estimado de entre **60 y 70 correos electrónicos diarios** entrantes en el buzón `contacto@prontomatic.cl`. De ese total, se estima que entre **30 y 40 correos corresponden a incidencias reales** que se convierten efectivamente en tickets de soporte activos. El resto corresponde a correos que son descartados durante la etapa de validación de entrada (spam, correos automáticos, notificaciones de sistemas, etc.).
 
Este volumen sitúa al sistema en una categoría de **carga baja-media**, lo que hace que la arquitectura serverless sea especialmente adecuada: no se requiere infraestructura dedicada activa las 24 horas, y los costos de operación se mantienen proporcionales al uso real.
 
### 1.2. Las Cinco Capas Críticas
 
La infraestructura se divide en cinco capas con responsabilidades claramente delimitadas:
 
| Capa | Responsabilidad Principal |
|---|---|
| **Ingesta (Inbound)** | Recepción y captura de correos entrantes vía SendGrid Inbound Parse |
| **Procesamiento** | Validación, normalización, enriquecimiento y persistencia del ticket |
| **Salida (Outbound)** | Envío de respuestas al cliente enmascaradas bajo la identidad institucional |
| **Persistencia** | Almacenamiento estructurado en PostgreSQL (Supabase) y MySQL (legacy) |
| **Identidad** | Autenticación de usuarios internos, gestión de sesiones y control de acceso por roles (RBAC) |
 
---
 
## 2. Capa de Ingesta (Inbound): SendGrid Inbound Parse
 
Para eliminar la gestión manual del buzón `contacto@prontomatic.cl`, se utiliza el servicio **Inbound Parse Webhook de SendGrid**. Este servicio actúa como intermediario entre el servidor de correo de Prontomatic y la aplicación ProntoTicket, convirtiendo cada correo entrante en una petición HTTP procesable por la API del sistema.
 
### 2.1. Flujo Técnico del Webhook de Entrada
 
El proceso de ingesta sigue los siguientes pasos en orden:
 
**Paso 1 — Recepción por SendGrid:**
SendGrid recibe el correo electrónico dirigido a `contacto@prontomatic.cl` a través del registro MX del dominio, que debe estar configurado para apuntar a los servidores de SendGrid. Este es el punto de entrada al sistema.
 
**Paso 2 — Deserialización del correo:**
SendGrid descompone el correo en sus partes constitutivas (encabezados, cuerpo en texto plano, cuerpo en HTML, archivos adjuntos, metadatos del remitente) y construye un payload con formato `multipart/form-data`.
 
**Paso 3 — Envío al endpoint de ingesta:**
SendGrid realiza una petición `POST` HTTP hacia el endpoint interno de ProntoTicket:
 
```
POST /api/webhook/ingesta
Content-Type: multipart/form-data
```
 
Los campos principales que incluye el payload de SendGrid son:
 
| Campo SendGrid | Descripción |
|---|---|
| `from` | Dirección de correo y nombre del remitente |
| `to` | Destinatario (debe ser `contacto@prontomatic.cl`) |
| `subject` | Asunto del correo |
| `text` | Cuerpo del correo en texto plano |
| `html` | Cuerpo del correo en formato HTML |
| `attachments` | Número de archivos adjuntos |
| `attachment-info` | Metadatos de cada adjunto (nombre, tipo MIME, tamaño) |
| `headers` | Encabezados completos del correo (incluye `Message-ID`, `In-Reply-To`, `References`) |
| `spam_score` | Puntuación de spam asignada por SendGrid |
| `spam_report` | Detalle del análisis de spam |
 
**Paso 4 — Procesamiento por la Capa de Servicio:**
El endpoint `/api/webhook/ingesta` actúa exclusivamente como controlador: valida la autenticidad de la petición y delega el payload a la capa de servicios (`ticketService.js`) para su procesamiento.
 
### 2.2. Seguridad del Endpoint de Ingesta
 
El endpoint `/api/webhook/ingesta` es un endpoint público por definición (debe ser accesible por los servidores de SendGrid), lo que lo convierte en un vector de ataque potencial si no se protege adecuadamente. Se implementan las siguientes medidas de seguridad:
 
**Verificación de firma HMAC (SendGrid Signature Verification):**
SendGrid firma cada petición de webhook con una clave privada usando el algoritmo ECDSA (Elliptic Curve Digital Signature Algorithm). El sistema verifica esta firma en cada petición antes de procesar cualquier dato, garantizando que el payload proviene efectivamente de SendGrid y no de una fuente externa que intente inyectar tickets falsos.
 
El proceso de verificación consiste en:
1. Extraer el header `X-Twilio-Email-Event-Webhook-Signature` y `X-Twilio-Email-Event-Webhook-Timestamp` de la petición.
2. Construir el payload de verificación concatenando el timestamp con el cuerpo raw de la petición.
3. Verificar la firma usando la clave pública de verificación provista por SendGrid (almacenada como variable de entorno).
4. Si la verificación falla, el endpoint retorna inmediatamente un `HTTP 403 Forbidden` sin procesar el contenido.
 
**Protección adicional:**
- El endpoint no retorna mensajes de error descriptivos en caso de fallo, para no exponer información sobre la lógica interna del sistema.
- Se registra en logs cada intento de petición rechazado, incluyendo IP de origen y timestamp, para auditoría de seguridad.
 
### 2.3. Lógica de Deduplicación de Correos
 
Un problema frecuente en sistemas de ingesta de correo es la recepción duplicada del mismo mensaje (por reenvíos automáticos, reintentos del servidor de correo, o rebotes). El sistema implementa la siguiente lógica de deduplicación:
 
- Cada correo posee un header `Message-ID` único asignado por el servidor de correo del remitente.
- Al procesar un correo entrante, el sistema consulta en PostgreSQL si ya existe un registro con ese `Message-ID` antes de crear un nuevo ticket o mensaje.
- Si el `Message-ID` ya existe, la petición se descarta silenciosamente y el endpoint retorna `HTTP 200 OK` para que SendGrid no reintente el envío.
 
---
 
## 3. Capa de Salida (Outbound): Gestión Centralizada de Respuestas
 
Esta capa es fundamental para mantener la **identidad institucional de Prontomatic** en todas las comunicaciones con los clientes. El sistema garantiza que el cliente siempre reciba las respuestas desde la dirección oficial `contacto@prontomatic.cl`, independientemente de qué agente esté operando el ticket o cuál sea su correo personal.
 
### 3.1. Flujo Técnico del Envío de Respuestas
 
Cuando un agente redacta una respuesta dentro del dashboard de ProntoTicket, el proceso técnico sigue los siguientes pasos:
 
**Paso 1 — Acción del agente en el dashboard:**
El agente escribe su respuesta en el área de texto del ticket dentro de la interfaz React del dashboard y presiona "Enviar respuesta".
 
**Paso 2 — Petición al API Route interno:**
La interfaz de usuario realiza una petición autenticada (con JWT en el header `Authorization`) al endpoint interno:
 
```
POST /api/tickets/[id]/responder
Authorization: Bearer <jwt_token>
Content-Type: application/json
```
 
**Paso 3 — Validación de sesión y permisos:**
El API Route verifica que el JWT sea válido y que el usuario autenticado tenga permiso para responder el ticket (debe ser el agente que tomó el ticket, un supervisor, o un administrador).
 
**Paso 4 — Enmascaramiento del emisor (Email Masking):**
El sistema construye el payload para la API de SendGrid Mail Send configurando estrictamente los siguientes parámetros:
 
```json
{
  "from": {
    "email": "contacto@prontomatic.cl",
    "name": "Prontomatic Soporte"
  },
  "reply_to": {
    "email": "contacto@prontomatic.cl"
  },
  "to": [{ "email": "<correo_del_cliente>" }],
  "subject": "Re: <asunto_original>",
  "content": [{ "type": "text/plain", "value": "<respuesta_del_agente>" }],
  "headers": {
    "In-Reply-To": "<message_id_del_correo_original>",
    "References": "<message_id_del_correo_original>"
  }
}
```
 
> **Nota sobre identidad del agente:** El nombre del agente no se incluye en ningún campo visible del correo electrónico enviado al cliente. El campo `from.name` siempre será `"Prontomatic Soporte"`, asegurando que el cliente interactúe con la marca institucional y no con la identidad personal del trabajador.
 
**Paso 5 — Consistencia del hilo de conversación:**
Los headers `In-Reply-To` y `References` se populan con el `Message-ID` del correo original del cliente. Esto garantiza que el cliente visualice la respuesta dentro de la misma conversación (hilo) en su cliente de correo electrónico (Gmail, Outlook, Apple Mail, etc.), y no como un correo nuevo e independiente.
 
**Paso 6 — Registro en la base de datos:**
Independientemente del resultado del envío, el sistema registra el intento en la tabla de mensajes (`Message`) de PostgreSQL, incluyendo el contenido de la respuesta, el ID del agente que la envió, el timestamp y el estado del envío (`enviado` / `error`).
 
### 3.2. Manejo de Errores en el Envío
 
Si la API de SendGrid retorna un error durante el envío de una respuesta, el sistema:
1. Registra el error en los logs del servidor con el código de error de SendGrid y el timestamp.
2. Actualiza el registro del mensaje en PostgreSQL con el estado `error`.
3. Retorna un mensaje de error claro a la interfaz del agente para que este sea notificado y pueda reintentar el envío manualmente.
 
El sistema **no reintenta automáticamente** los envíos fallidos, para evitar el envío duplicado de respuestas al cliente.
 
---
 
## 4. Capa de Persistencia e Integración Híbrida (SQL)
 
El sistema opera con **dos motores de base de datos distintos** gestionados a través de Prisma ORM, con conexiones configuradas de forma independiente en el `schema.prisma`. Esta separación permite aislar completamente los datos operativos del sistema de ticketing de los datos maestros preexistentes de Prontomatic.
 
### 4.1. PostgreSQL (Supabase) — Base de Datos Principal de ProntoTicket
 
Es la base de datos primaria y exclusiva del sistema de tickets. Todos los datos generados por ProntoTicket (tickets, mensajes, logs, etc.) residen aquí. Está alojada en **Supabase**, que provee además los servicios de autenticación y almacenamiento de archivos adjuntos.
 
Las entidades principales almacenadas son:
 
| Entidad | Descripción |
|---|---|
| `Ticket` | Registro central de cada caso: ID único, estado, prioridad, categoría, agente asignado, timestamps de creación, actualización y cierre, SLA. |
| `Message` | Hilo cronológico de mensajes de cada ticket. Incluye dirección (inbound/outbound), contenido, ID del agente si aplica, `Message-ID` del correo, y timestamps. |
| `Profile` | Datos del usuario interno (agente, supervisor, administrador): nombre, correo, rol, estado activo/inactivo. Vinculado a Supabase Auth. |
| `Customer` | Datos del cliente enriquecidos al momento de creación del ticket: correo, nombre inferido del correo, RUT, teléfono y dirección (obtenidos de MySQL). |
| `AuditLog` | Registro de todas las acciones realizadas sobre tickets: quién tomó el ticket, quién cambió su estado, timestamps de cada acción. Base para el cálculo de SLA y auditoría de agentes. |
| `Category` | Catálogo de categorías disponibles para clasificar los tickets. Administradas por el rol Administrador. |
 
> Para el detalle completo de campos, tipos de datos y relaciones entre entidades, ver [`modelo-de-datos.md`](./modelo-de-datos.md).
 
### 4.2. MySQL (Legacy) — Base de Datos de Datos Maestros de Prontomatic
 
Prontomatic opera con una base de datos MySQL preexistente que contiene los datos maestros de sus clientes (RUT, teléfono, dirección, entre otros). ProntoTicket se conecta a esta base de datos **en modo de solo lectura** para el proceso de enriquecimiento de tickets.
 
> **Estado actual del alojamiento:** La ubicación exacta del servidor MySQL (local/on-premise vs. hosting externo) está pendiente de confirmación. Este dato es relevante para la configuración del string de conexión en las variables de entorno y para evaluar la latencia esperada en las consultas de enriquecimiento.
 
**Proceso de enriquecimiento:**
 
1. Al recibir un correo entrante, el sistema extrae la dirección de correo del remitente.
2. Se ejecuta una consulta en la base de datos MySQL buscando un cliente cuyo correo electrónico coincida con el del remitente:
 
```sql
SELECT rut, telefono, direccion
FROM clientes
WHERE email = :email_remitente
LIMIT 1;
```
 
> **Nota:** Los nombres exactos de la tabla y columnas de la base de datos MySQL de Prontomatic deben ser confirmados y mapeados en el `schema.prisma` antes del desarrollo.
 
3. **Si se encuentra el cliente:** Los valores de `rut`, `telefono` y `direccion` se almacenan en la entidad `Customer` de PostgreSQL, vinculados al ticket recién creado.
4. **Si no se encuentra el cliente o faltan campos:** El sistema inserta avisos informativos directamente en el cuerpo del ticket para conocimiento del agente:
   - `"RUT no encontrado"`
   - `"Teléfono no encontrado"`
   - `"Dirección no encontrada"`
 
   Estos avisos no bloquean la creación del ticket. El ticket se crea con la información disponible y el agente es responsable de gestionar los datos faltantes durante la atención.
 
### 4.3. Configuración de Prisma para Múltiples Bases de Datos
 
Prisma soporta múltiples fuentes de datos en un único `schema.prisma` mediante la directiva `datasource`. La configuración contempla dos bloques `datasource` diferenciados:
 
```prisma
// Base de datos principal de ProntoTicket
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
 
// Base de datos legacy de Prontomatic (solo lectura)
datasource legacy {
  provider = "mysql"
  url      = env("LEGACY_DATABASE_URL")
}
```
 
> Cada base de datos tiene su propio string de conexión almacenado como variable de entorno independiente, evitando que las credenciales queden expuestas en el código fuente.
 
---
 
## 5. Identidad, Autenticación y Roles (RBAC)
 
El sistema de autenticación es el núcleo de seguridad que permite la trazabilidad completa de las acciones de cada agente y garantiza que cada petición a la API esté vinculada a un usuario identificado y autorizado.
 
### 5.1. Sistema de Autenticación: Supabase Auth
 
La autenticación de usuarios internos (agentes, supervisores, administradores) se gestiona íntegramente a través de **Supabase Auth**, que provee un sistema de identidad basado en correo institucional y contraseña.
 
**Flujo de autenticación:**
 
1. El usuario accede a la pantalla de login de ProntoTicket e ingresa su correo institucional y contraseña.
2. Las credenciales se envían a Supabase Auth, que las valida contra sus registros internos.
3. Supabase Auth retorna un **JSON Web Token (JWT)** firmado que contiene el ID del usuario, su rol y la fecha de expiración de la sesión.
4. El JWT se almacena de forma segura en el cliente (mediante cookies HttpOnly) y se incluye en el header `Authorization` de cada petición subsiguiente a la API interna de ProntoTicket.
5. Cada API Route de Next.js verifica la validez del JWT y extrae el rol del usuario antes de ejecutar cualquier lógica de negocio.
 
**Políticas de sesión:**
- Las sesiones expiran tras un período de inactividad configurable.
- No está habilitado el login por OAuth ni por proveedores externos (Google, Microsoft, etc.). Solo se admite autenticación por correo y contraseña institucional.
- La creación de nuevas cuentas de usuario es exclusiva del rol Administrador. Los agentes no pueden autoregistrarse.
 
### 5.2. Control de Acceso Basado en Roles (RBAC)
 
El sistema implementa **Role-Based Access Control (RBAC)** con tres roles diferenciados. El rol de cada usuario se almacena en la tabla `Profile` de PostgreSQL y se incluye en el JWT de sesión.
 
La siguiente matriz define los permisos por rol:
 
| Acción | Agente | Supervisor | Administrador |
|---|:---:|:---:|:---:|
| Ver dashboard de tickets | ✅ | ✅ | ✅ |
| Tomar un ticket | ✅ | ✅ | ✅ |
| Responder a un cliente | ✅ | ✅ | ✅ |
| Cambiar estado de un ticket | ✅ | ✅ | ✅ |
| Ver tickets de otros agentes | ❌ | ✅ | ✅ |
| Ver métricas de desempeño del equipo | ❌ | ✅ | ✅ |
| Ver panel de auditoría y SLA | ❌ | ✅ | ✅ |
| Gestionar usuarios (alta/baja/edición) | ❌ | ❌ | ✅ |
| Asignar y modificar roles | ❌ | ❌ | ✅ |
| Gestionar categorías de tickets | ❌ | ❌ | ✅ |
| Configurar parámetros del sistema | ❌ | ❌ | ✅ |
 
> La verificación de permisos se realiza en la **Capa de Aplicación (API Routes)**, no solo en el frontend. Un agente que intente acceder a un endpoint reservado para supervisores recibirá un `HTTP 403 Forbidden`, independientemente de lo que muestre o no muestre la interfaz.
 
---
 
## 6. Gestión de Archivos Adjuntos: Supabase Storage
 
Los clientes de Prontomatic frecuentemente adjuntan archivos a sus correos de soporte: fotografías de máquinas con fallas, capturas de pantalla de errores, comprobantes de pago, documentos PDF, entre otros. El sistema gestiona estos archivos a través de **Supabase Storage**.
 
### 6.1. Proceso de Almacenamiento
 
1. Al procesar el payload del webhook de SendGrid, el sistema detecta la presencia de archivos adjuntos a través del campo `attachment-info`.
2. Cada archivo adjunto se sube a un **bucket privado** de Supabase Storage, organizado bajo una ruta con la siguiente estructura:
 
```
tickets/{ticket_id}/adjuntos/{nombre_archivo}
```
 
3. El sistema almacena en la tabla `Message` de PostgreSQL la referencia (path) al archivo en Supabase Storage, no el archivo en sí.
 
### 6.2. Acceso a los Archivos desde el Dashboard
 
- Los archivos almacenados en el bucket privado **no son accesibles públicamente** mediante URL directa.
- Cuando un agente con sesión activa necesita visualizar un adjunto desde el dashboard, el sistema genera un **enlace de descarga temporal** (Signed URL) a través de la API de Supabase Storage.
- Los Signed URLs tienen una duración de validez limitada (configurable, por ejemplo 60 minutos), tras lo cual el enlace expira y debe generarse uno nuevo.
- Este mecanismo garantiza que los archivos adjuntos, que pueden contener información sensible de los clientes de Prontomatic, no queden expuestos públicamente en internet.
 
---
 
## 7. Resumen del Flujo de Datos
 
El siguiente diagrama describe el flujo completo de un correo desde su recepción hasta la respuesta al cliente:
 
```
ENTRADA
────────────────────────────────────────────────────────────────
Cliente
  └─► contacto@prontomatic.cl
        └─► SendGrid Inbound Parse
              └─► POST /api/webhook/ingesta
                    │
                    ▼
PROCESAMIENTO
────────────────────────────────────────────────────────────────
                    ├─► Validación de firma HMAC
                    ├─► Deduplicación por Message-ID
                    ├─► Normalización HTML → Markdown
                    ├─► Consulta MySQL Legacy (RUT, Teléfono, Dirección)
                    ├─► Subida de adjuntos a Supabase Storage
                    └─► Creación del Ticket en PostgreSQL (Supabase)
                          │
                          ▼
GESTIÓN
────────────────────────────────────────────────────────────────
                    Agente (sesión JWT activa)
                      └─► Dashboard ProntoTicket
                            ├─► Toma el ticket manualmente
                            ├─► Lee el hilo de mensajes
                            ├─► Visualiza adjuntos (Signed URL)
                            └─► Redacta respuesta
                                  │
                                  ▼
SALIDA
────────────────────────────────────────────────────────────────
                    POST /api/tickets/[id]/responder
                      └─► Validación JWT + permisos RBAC
                            └─► SendGrid Mail Send API
                                  └─► From: contacto@prontomatic.cl
                                        └─► Cliente (hilo de conversación)
```
 
---
 
## 8. Patrón Arquitectónico: Arquitectura por Capas (Layered Architecture)
 
ProntoTicket implementa una **arquitectura basada en la separación de responsabilidades mediante capas**. Este diseño garantiza que cada componente del sistema tenga una única responsabilidad bien definida, que la lógica de negocio esté completamente aislada de los detalles de infraestructura, y que los cambios en una capa (por ejemplo, cambiar el motor de base de datos MySQL por otra tecnología) no afecten a las capas superiores.
 
### 8.1. Descripción de las Capas
 
#### Capa de Presentación (Frontend — React / Next.js)
 
- **Responsabilidad:** Renderizado de la interfaz de usuario del dashboard, gestión del estado local de los componentes y captura de eventos del agente (clics, envío de formularios, etc.).
- **Tecnología:** Componentes funcionales de React con hooks personalizados. Utiliza Server Components de Next.js para la carga inicial de datos y Client Components para la interactividad.
- **Lo que NO hace:** No contiene lógica de negocio. No realiza consultas directas a la base de datos. No valida reglas del sistema (esas validaciones se replican en la capa de aplicación).
 
#### Capa de Aplicación / Rutas (Next.js API Routes)
 
- **Responsabilidad:** Actúa como el orquestador del sistema. Recibe las peticiones entrantes (desde el dashboard o desde el webhook de SendGrid), valida la autenticidad de cada petición (JWT, firma HMAC), aplica las verificaciones de permisos RBAC y delega la ejecución a la capa de servicios.
- **Tecnología:** API Routes de Next.js (`/app/api/`).
- **Lo que NO hace:** No contiene lógica de negocio compleja. No accede directamente a la base de datos. Su única responsabilidad es recibir, validar y delegar.
 
#### Capa de Lógica de Negocio (Servicios)
 
- **Responsabilidad:** Implementa todas las reglas específicas del negocio de Prontomatic. Es la capa más importante del sistema y la que concentra la mayor complejidad.
- **Ejemplos de lógica implementada en esta capa:**
  - Validación de si un correo entrante es spam o duplicado.
  - Conversión de HTML a Markdown para normalizar el contenido del correo.
  - Consulta de datos del cliente en MySQL y lógica de enriquecimiento del ticket.
  - Cálculo del tiempo transcurrido desde la última actividad de un ticket para determinar si se debe disparar el protocolo de cierre automático (regla de las 48 horas).
  - Construcción del payload de respuesta para SendGrid, incluyendo el enmascaramiento del emisor y la inserción de los headers de hilo.
  - Generación y envío de la encuesta de satisfacción tras el cierre del ticket.
- **Lo que NO hace:** No accede directamente a la base de datos. Llama a los repositorios para obtener o persistir datos.
 
#### Capa de Acceso a Datos — DAL (Repositorios — Prisma ORM)
 
- **Responsabilidad:** Es la única capa del sistema que "toca" las bases de datos. Abstrae completamente las consultas SQL mediante Prisma, exponiendo funciones semánticamente claras a la capa de servicios.
- **Ejemplos:** `findCustomerByEmail()`, `createTicket()`, `updateTicketStatus()`, `getTicketById()`, `createMessage()`.
- **Lo que NO hace:** No contiene lógica de negocio. No decide qué hacer con los datos; solo los obtiene o los guarda según lo que le instruya la capa de servicios.
 
#### Capa de Persistencia (Infraestructura)
 
- **Responsabilidad:** Almacenamiento físico de los datos.
- **Componentes:** PostgreSQL en Supabase (datos operativos de ProntoTicket) y MySQL Legacy de Prontomatic (datos maestros de clientes, solo lectura).
 
### 8.2. Ventajas de este Modelo para ProntoTicket
 
**Escalabilidad técnica:** Si en el futuro Prontomatic decide migrar su base de datos MySQL legacy a otro motor (PostgreSQL, MongoDB, una API REST propia), solo es necesario modificar los repositorios de la Capa de Acceso a Datos y actualizar la configuración de Prisma. El resto del sistema (servicios, API routes, dashboard) permanece intacto.
 
**Testabilidad:** La Capa de Servicios puede ser testeada de forma completamente aislada mediante mocks de los repositorios. Esto permite escribir tests unitarios para reglas críticas como el cierre automático por 48 horas sin necesidad de una base de datos real ni de renderizar la interfaz.
 
**Mantenibilidad:** Un desarrollador nuevo puede localizar rápidamente dónde vive cada responsabilidad. Si hay un bug en el cálculo del SLA, se busca en `services/`. Si hay un error en una consulta a la base de datos, se busca en `repositories/`. Si la interfaz no muestra datos correctamente, se busca en `app/dashboard/`.
 
**Seguridad por diseño:** Las validaciones de autenticación y permisos están centralizadas en la Capa de Aplicación (API Routes). Esto garantiza que ninguna lógica de negocio se ejecute sin haber pasado primero por la verificación de identidad y permisos, independientemente del origen de la petición.
 
---
 
## 9. Patrón de Diseño: Model-Controller-Service-Repository (MCSR)
 
Para garantizar la máxima mantenibilidad del sistema, ProntoTicket implementa el patrón **MCSR**. Este patrón extiende el clásico MVC incorporando una capa de servicios explícita y una capa de repositorios, lo que es especialmente crítico en este proyecto dado que el sistema opera con dos motores de base de datos distintos (PostgreSQL y MySQL) que deben mantenerse completamente aislados entre sí.
 
### 9.1. Definición de las Capas del Patrón
 
#### Model (Modelos)
 
- **Definición:** Representa la estructura de los datos del sistema.
- **Implementación en ProntoTicket:** Definidos en el archivo `schema.prisma`. Aquí residen todas las entidades del sistema: `Ticket`, `Message`, `Profile`, `Customer`, `AuditLog`, `Category`, y el mapeo de la tabla de clientes de la base de datos MySQL legacy.
- **Responsabilidad exclusiva:** Describir la forma de los datos. No contienen lógica.
 
#### Controller / Handler (Controladores)
 
- **Definición:** Punto de entrada del sistema. Recibe las peticiones HTTP entrantes y retorna las respuestas HTTP.
- **Implementación en ProntoTicket:** API Routes de Next.js, ubicados en `/src/app/api/`. Ejemplos:
  - `/api/webhook/ingesta` — Recibe el payload de SendGrid Inbound Parse.
  - `/api/tickets/[id]/responder` — Recibe la respuesta redactada por el agente.
  - `/api/tickets/[id]/estado` — Recibe el cambio de estado de un ticket.
- **Responsabilidad exclusiva:** Recibir la petición, validar que sea auténtica (JWT / firma HMAC), y pasarla a la capa de servicio correspondiente. No contienen lógica de negocio.
 
#### Service (Servicios — Lógica de Negocio)
 
- **Definición:** El "cerebro" del sistema. Concentra toda la lógica compleja y las reglas de negocio de Prontomatic.
- **Implementación en ProntoTicket:** Funciones de Node.js ubicadas en `/src/services/`. Los archivos principales son:
  - `ticketService.js` — Orquesta el ciclo de vida completo de un ticket: creación, enriquecimiento, cambios de estado, cierre automático por 48 horas, cálculo de SLA.
  - `emailService.js` — Gestiona la normalización de correos entrantes (HTML → Markdown) y la construcción del payload de respuesta para SendGrid.
  - `authService.js` — Gestiona la validación de roles y permisos en función del JWT recibido.
  - `notificationService.js` — Gestiona el envío de notificaciones automáticas: aviso de cierre por inactividad, encuesta de satisfacción post-cierre.
- **Responsabilidad exclusiva:** Implementar las reglas del negocio. Llaman a los repositorios para acceder a datos, pero no acceden directamente a la base de datos.
 
#### Repository (Repositorios — Capa de Acceso a Datos)
 
- **Definición:** La única capa que interactúa directamente con las bases de datos a través de Prisma.
- **Implementación en ProntoTicket:** Funciones ubicadas en `/src/repositories/`. Los archivos principales son:
  - `ticketRepo.js` — Operaciones CRUD sobre la entidad `Ticket` en PostgreSQL.
  - `messageRepo.js` — Operaciones sobre la entidad `Message` en PostgreSQL.
  - `customerRepo.js` — Consulta de datos de clientes en la base de datos MySQL legacy (solo lectura).
  - `auditRepo.js` — Escritura de registros en la entidad `AuditLog` en PostgreSQL.
  - `profileRepo.js` — Operaciones sobre la entidad `Profile` en PostgreSQL.
- **Responsabilidad exclusiva:** Ejecutar consultas a la base de datos. No contienen lógica de negocio; solo obtienen, crean, actualizan o eliminan datos según lo que el servicio les instruya.
 
### 9.2. Estructura de Carpetas del Directorio `src/`
 
```plaintext
/src
├── app/                              # Capa de Presentación y Controladores (Next.js)
│   ├── api/                          # API Routes (Controladores HTTP)
│   │   ├── webhook/
│   │   │   └── ingesta/
│   │   │       └── route.js          # Endpoint receptor del webhook de SendGrid
│   │   └── tickets/
│   │       └── [id]/
│   │           ├── responder/
│   │           │   └── route.js      # Endpoint para enviar respuesta al cliente
│   │           └── estado/
│   │               └── route.js      # Endpoint para actualizar el estado del ticket
│   ├── dashboard/                    # Páginas del dashboard del agente/supervisor
│   │   ├── page.js                   # Vista principal: listado de tickets
│   │   └── tickets/
│   │       └── [id]/
│   │           └── page.js           # Vista detalle de un ticket individual
│   ├── login/
│   │   └── page.js                   # Página de autenticación
│   └── layout.js                     # Layout raíz de la aplicación
│
├── services/                         # Capa de Lógica de Negocio
│   ├── ticketService.js              # Ciclo de vida del ticket, cierre automático, SLA
│   ├── emailService.js               # Normalización de correos, construcción de payloads
│   ├── authService.js                # Validación de JWT y verificación de permisos RBAC
│   └── notificationService.js        # Envío de notificaciones y encuestas automáticas
│
├── repositories/                     # Capa de Acceso a Datos (DAL)
│   ├── ticketRepo.js                 # CRUD de tickets en PostgreSQL
│   ├── messageRepo.js                # CRUD de mensajes en PostgreSQL
│   ├── customerRepo.js               # Consulta de clientes en MySQL legacy (read-only)
│   ├── auditRepo.js                  # Escritura de logs de auditoría en PostgreSQL
│   └── profileRepo.js                # CRUD de perfiles de usuario en PostgreSQL
│
├── components/                       # Componentes de React reutilizables
│   ├── tickets/
│   │   ├── TicketCard.js             # Tarjeta de ticket para el listado del dashboard
│   │   ├── TicketDetail.js           # Vista completa de un ticket
│   │   └── MessageThread.js          # Hilo de mensajes del ticket
│   └── ui/                           # Componentes de interfaz genéricos (botones, modales, etc.)
│
└── lib/                              # Configuraciones y clientes compartidos
    ├── prisma.js                     # Instancia singleton del cliente Prisma (PostgreSQL)
    ├── prismaLegacy.js               # Instancia singleton del cliente Prisma (MySQL legacy)
    └── sendgrid.js                   # Configuración e inicialización del cliente de SendGrid
```
 
---
 
## 10. Decisiones de Diseño y Justificaciones (ADR Resumidas)
 
Esta sección registra las decisiones arquitectónicas más relevantes tomadas durante la fase de planificación, junto con su justificación y las alternativas consideradas.
 
### ADR-001: Next.js como Framework Full-Stack
 
| | |
|---|---|
| **Decisión** | Usar Next.js (App Router) como único framework, tanto para el frontend como para los API Routes del backend. |
| **Justificación** | Permite que un único desarrollador mantenga el stack completo sin necesidad de gestionar repositorios o deploys separados para frontend y backend. Los API Routes de Next.js son suficientes para la carga de trabajo estimada (60-70 correos/día) sin necesidad de un servidor Express/NestJS independiente. |
| **Alternativas consideradas** | Next.js frontend + Express/NestJS backend separado. Descartado por añadir complejidad operativa innecesaria para el volumen actual. |
 
### ADR-002: Supabase como Plataforma de Infraestructura Principal
 
| | |
|---|---|
| **Decisión** | Usar Supabase como proveedor de PostgreSQL, autenticación (Auth) y almacenamiento de archivos (Storage). |
| **Justificación** | Supabase unifica en una sola plataforma tres servicios críticos que de otra forma requerirían tres proveedores separados (ej. AWS RDS + Auth0 + AWS S3). Esto reduce significativamente la complejidad de configuración y mantenimiento para un equipo de un solo desarrollador. |
| **Alternativas consideradas** | AWS RDS + Clerk Auth + AWS S3. Descartado por mayor complejidad de configuración y mayor costo operativo. |
 
### ADR-003: SendGrid como Plataforma de Email (Inbound y Outbound)
 
| | |
|---|---|
| **Decisión** | Usar SendGrid tanto para la recepción de correos entrantes (Inbound Parse Webhook) como para el envío de respuestas (Mail Send API). |
| **Justificación** | Centralizar el servicio de email en un único proveedor simplifica la configuración DNS, la gestión de credenciales y el monitoreo. SendGrid Inbound Parse es la solución más documentada y estable para la conversión de correos entrantes en webhooks. |
| **Alternativas consideradas** | Postmark, Mailgun. Descartados por preferencia de centralizar en un único proveedor con soporte tanto para inbound como outbound. |
 
### ADR-004: Prisma ORM para Múltiples Bases de Datos
 
| | |
|---|---|
| **Decisión** | Usar Prisma ORM como capa de abstracción para las dos bases de datos (PostgreSQL y MySQL). |
| **Justificación** | Prisma permite gestionar ambas conexiones desde un único punto (`schema.prisma`), con tipado estático, migraciones controladas (para PostgreSQL) y una API de consulta consistente para ambos motores. Esto reduce la curva de aprendizaje al no tener que aprender dos APIs de acceso a datos distintas. |
| **Alternativas consideradas** | Prisma solo para PostgreSQL + `mysql2` nativo para MySQL legacy. Descartado por la inconsistencia que introduce tener dos mecanismos de acceso a datos diferentes en el mismo proyecto. |
 
### ADR-005: Toma Manual de Tickets (Sin Asignación Automática)
 
| | |
|---|---|
| **Decisión** | Los tickets no se asignan automáticamente a un agente específico. Todos los tickets abiertos son visibles en el dashboard global y los agentes los toman manualmente según disponibilidad. |
| **Justificación** | Dado que el equipo opera con 2-3 agentes activos por turno, la asignación automática (round-robin, por carga, por especialidad) añade complejidad de configuración sin un beneficio claro a este escala. El modelo de toma manual es más flexible y permite que los agentes autoregulen su carga. |
| **Alternativas consideradas** | Asignación automática por round-robin. Reservado como mejora futura si el equipo crece y la carga de trabajo lo justifica. |
 
---
 
## 11. Variables de Entorno Requeridas
 
El sistema requiere las siguientes variables de entorno configuradas en el archivo `.env.local` del proyecto para su correcto funcionamiento. **Ninguna de estas variables debe ser commiteada al repositorio.**
 
```bash
# ─── Base de Datos Principal (PostgreSQL - Supabase) ─────────────────────────
DATABASE_URL="postgresql://..."           # String de conexión a PostgreSQL en Supabase
 
# ─── Base de Datos Legacy (MySQL - Prontomatic) ───────────────────────────────
LEGACY_DATABASE_URL="mysql://..."         # String de conexión a MySQL legacy de Prontomatic
 
# ─── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://..."    # URL pública del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."       # Clave pública anónima de Supabase
SUPABASE_SERVICE_ROLE_KEY="..."           # Clave de rol de servicio (solo en servidor, nunca en cliente)
 
# ─── SendGrid ─────────────────────────────────────────────────────────────────
SENDGRID_API_KEY="SG...."                 # API Key de SendGrid para Mail Send API
SENDGRID_WEBHOOK_VERIFICATION_KEY="..."  # Clave pública para verificación de firma HMAC del webhook
 
# ─── Aplicación ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="https://..."         # URL base de la aplicación desplegada
CRON_SECRET="..."                         # Clave secreta para autenticar las peticiones de Vercel Cron Jobs
```
 
> **Seguridad:** Las variables prefijadas con `NEXT_PUBLIC_` son accesibles desde el navegador del cliente. El resto son exclusivamente del lado del servidor. Las claves sensibles como `SUPABASE_SERVICE_ROLE_KEY` y `SENDGRID_API_KEY` **nunca** deben incluirse en variables con prefijo `NEXT_PUBLIC_`.
 
---
 
## 12. Flujo de Trabajo Git (Branching Strategy)
 
El repositorio de ProntoTicket sigue una estrategia de ramas estructurada en tres niveles de promoción, diseñada para separar claramente el desarrollo activo, la validación de calidad y el código en producción. El flujo está concebido para un desarrollador individual pero es escalable a un equipo pequeño si en el futuro se incorporan colaboradores.
 
### 12.1. Ramas del Repositorio
 
| Rama | Tipo | Descripción |
|---|---|---|
| `dev` | Desarrollo activo | Rama principal de trabajo diario. Aquí se desarrollan y consolidan todas las nuevas funcionalidades, correcciones y cambios del sistema. Es la rama más inestable del flujo: puede contener código incompleto o en proceso. Nunca debe estar en un estado roto por más de una sesión de trabajo. |
| `qa` | Control de calidad | Rama de validación. Recibe el código desde `dev` una vez que una funcionalidad o conjunto de cambios está listo para ser probado. En esta rama se realizan las pruebas funcionales del sistema antes de autorizar su paso a producción. El código en `qa` debe estar siempre en un estado ejecutable y testeable. |
| `main` | Producción | Rama protegida. Contiene únicamente el código que ha sido validado en `qa` y está listo para operar en el entorno de producción. Cada merge a `main` representa una nueva versión del sistema en producción. Esta rama nunca recibe commits directos; solo se actualiza mediante merges desde `qa`. |
 
### 12.2. Flujo de Promoción
 
El código siempre fluye en una única dirección a través de las ramas, nunca en sentido contrario:
 
```
dev ──────────► qa ──────────► main
  (feature lista)  (validada y aprobada)
```
 
**Paso 1 — Desarrollo en `dev`:**
Todo el trabajo de desarrollo ocurre en la rama `dev`. Una vez que una funcionalidad está completa y el desarrollador la considera lista para ser probada, se realiza un merge o push hacia `qa`.
 
**Paso 2 — Validación en `qa`:**
En la rama `qa` se realizan las pruebas funcionales del sistema: verificación del flujo de ingesta de correos, comportamiento del dashboard, cierre automático de tickets, envío de encuestas, entre otros. Si se detectan errores, las correcciones se realizan en `dev` y se vuelven a promover a `qa`. Solo cuando el conjunto de cambios pasa la validación se procede al siguiente paso.
 
**Paso 3 — Promoción a `main`:**
Una vez validado en `qa`, el código se fusiona hacia `main`. Este merge representa el despliegue oficial de una nueva versión del sistema. Se recomienda etiquetar cada merge a `main` con un tag de versión (ej: `v1.0.0`, `v1.1.0`) para mantener un historial de releases.
 
### 12.3. Reglas del Flujo
 
Las siguientes reglas deben respetarse en todo momento para mantener la integridad del flujo:
 
- **Nunca hacer commits directos a `main`.** La rama `main` es de solo promoción. Todo cambio, por pequeño que sea, debe pasar por `dev` → `qa` → `main`.
- **Nunca hacer commits directos a `qa`.** La rama `qa` recibe código exclusivamente desde `dev`. No se desarrolla en `qa`.
- **`dev` es la única rama de trabajo activo.** Si en el futuro se incorporan colaboradores, cada uno puede trabajar en ramas de feature individuales (ej: `feature/cierre-automatico`) que luego se fusionan a `dev` mediante Pull Requests.
- **`main` siempre debe estar en un estado desplegable.** Nunca debe existir código roto o incompleto en esta rama.
 
### 12.4. Consideraciones para Incorporación de Colaboradores
 
Si en el futuro se suma un colaborador al proyecto, se recomienda extender el flujo de la siguiente manera sin modificar la estructura base:
 
- Cada desarrollador trabaja en **ramas de feature** con el prefijo `feature/` creadas desde `dev`. Ejemplo: `feature/dashboard-supervisor`, `feature/encuesta-satisfaccion`.
- Las ramas de feature se integran a `dev` mediante **Pull Requests (PR)**, que permiten revisión de código antes del merge.
- Las correcciones urgentes en producción (`hotfix`) se trabajan en ramas con el prefijo `hotfix/` creadas desde `main`, y se fusionan tanto a `main` como a `dev` para mantener la sincronía.
 
---
 
## 13. Plataforma de Despliegue: Vercel
 
ProntoTicket se despliega en **Vercel**, la plataforma de infraestructura desarrollada por el mismo equipo de Next.js. Es el entorno nativo del framework y el que ofrece la mayor compatibilidad, menor fricción de configuración y mejor rendimiento para este stack.
 
### 13.1. Justificación de la Elección
 
| Criterio | Detalle |
|---|---|
| **Compatibilidad nativa con Next.js** | Vercel es creado y mantenido por el mismo equipo que desarrolla Next.js. Cada funcionalidad del framework (App Router, Server Components, API Routes, Image Optimization) está optimizada para ejecutarse en Vercel sin configuración adicional. |
| **Serverless automático** | Las API Routes de Next.js se despliegan automáticamente como **Vercel Functions** (funciones serverless), lo que confirma y materializa la arquitectura serverless definida en la sección 1 de este documento. No se requiere ninguna configuración de servidor. |
| **CI/CD integrado con Git** | Vercel se conecta directamente al repositorio Git del proyecto y despliega automáticamente ante cada push a las ramas configuradas, eliminando la necesidad de pipelines de CI/CD externos. |
| **Entornos separados por rama** | Vercel crea entornos de despliegue independientes para cada rama del flujo Git, permitiendo probar cambios en un entorno real antes de promoverlos a producción. |
 
### 13.2. Integración del Flujo Git con Vercel
 
Cada rama del flujo de trabajo Git (sección 12) tiene un entorno de despliegue asociado en Vercel:
 
| Rama Git | Entorno Vercel | URL de acceso | Trigger de despliegue |
|---|---|---|---|
| `main` | **Production** | `ticketera.prontomatic.cl` (dominio personalizado) | Automático en cada push o merge a `main`. |
| `qa` | **Preview (QA)** | URL generada por Vercel (ej: `prontoticket-qa.vercel.app`) | Automático en cada push a `qa`. |
| `dev` | **Preview (Dev)** | URL generada por Vercel (ej: `prontoticket-dev.vercel.app`) | Automático en cada push a `dev`. |
 
Este esquema permite que el entorno de `qa` en Vercel sea el entorno de validación real antes de aprobar el merge a `main`, ya que ejecuta el código exactamente como lo haría en producción.
 
**Flujo completo con Vercel integrado:**
 
```
Desarrollo local (dev)
  └─► push a rama dev
        └─► Vercel despliega Preview (Dev) automáticamente
              └─► Validación en entorno real
                    └─► merge a qa
                          └─► Vercel despliega Preview (QA) automáticamente
                                └─► QA aprobado
                                      └─► merge a main
                                            └─► Vercel despliega en Production automáticamente
                                                  └─► ticketera.prontomatic.cl actualizado
```
 
### 13.3. Vercel Cron Jobs — Job de Monitoreo de Inactividad
 
El proceso de fondo que evalúa tickets en estado `EN_ESPERA_CLIENTE` y ejecuta el cierre automático por inactividad de 48 horas (documentado en `alcance-funcional.md` sección 5.1) se implementa mediante **Vercel Cron Jobs**.
 
Un Vercel Cron Job es una tarea programada que invoca un endpoint de la API del proyecto en una frecuencia definida, sin necesidad de infraestructura adicional (no se requieren workers externos, queues ni servidores dedicados).
 
**Endpoint del cron job:**
 
Se crea un nuevo endpoint exclusivo para esta tarea:
 
```
GET /api/cron/check-inactivity
```
 
Este endpoint no es de uso público ni está documentado en la especificación de API para agentes. Es invocado exclusivamente por Vercel Cron y está protegido mediante una clave secreta en el header de autorización para evitar ejecuciones no autorizadas.
 
**Protección del endpoint de cron:**
 
```javascript
// /src/app/api/cron/check-inactivity/route.js
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Ejecutar lógica de cierre automático...
}
```
 
La variable `CRON_SECRET` debe agregarse a las variables de entorno del proyecto (ver sección 11 y 13.4).
 
**Configuración en `vercel.json`:**
 
El archivo `vercel.json` en la raíz del proyecto define la frecuencia de ejecución del cron job:
 
```json
{
  "crons": [
    {
      "path": "/api/cron/check-inactivity",
      "schedule": "0 * * * *"
    }
  ]
}
```
 
La expresión `"0 * * * *"` ejecuta el job al inicio de cada hora (cada 60 minutos), lo que garantiza que ningún ticket permanezca más de 60 minutos en el estado `EN_ESPERA_CLIENTE` después de que se cumplan las 48 horas.
 
> **Nota sobre el plan de Vercel:** Los Vercel Cron Jobs están disponibles en el plan gratuito (Hobby) con una limitación de hasta 2 cron jobs y frecuencia mínima de 1 vez por día. Para la frecuencia horaria requerida por ProntoTicket, se necesita el plan **Pro** de Vercel. Esto debe considerarse en el presupuesto operativo del proyecto.
 
### 13.4. Gestión de Variables de Entorno en Vercel
 
Además del archivo `.env.local` para el desarrollo local (sección 11), todas las variables de entorno deben configurarse en el **Dashboard de Vercel** para que estén disponibles en los entornos de despliegue.
 
**Cómo configurar las variables en Vercel:**
1. Acceder al proyecto en el Dashboard de Vercel: `vercel.com/dashboard`.
2. Ir a **Settings → Environment Variables**.
3. Agregar cada variable con su valor correspondiente.
4. Seleccionar en qué entornos aplica cada variable (Production, Preview, Development).
 
**Tabla de variables y sus entornos de Vercel:**
 
| Variable | Production | Preview (QA) | Preview (Dev) | Notas |
|---|:---:|:---:|:---:|---|
| `DATABASE_URL` | ✅ | ✅ | ✅ | Puede usar instancias de Supabase distintas por entorno si se desea aislamiento completo. |
| `LEGACY_DATABASE_URL` | ✅ | ⚠️ | ⚠️ | En entornos de preview, evaluar si se conecta a la base MySQL real o a una copia de prueba. |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ | Nunca exponer con prefijo `NEXT_PUBLIC_`. |
| `SENDGRID_API_KEY` | ✅ | ⚠️ | ❌ | En `dev` no se recomienda usar la API Key real para evitar envíos accidentales a clientes. |
| `SENDGRID_WEBHOOK_VERIFICATION_KEY` | ✅ | ✅ | ✅ | |
| `NEXT_PUBLIC_APP_URL` | ✅ | ✅ | ✅ | Valor diferente por entorno (dominio de producción vs. URL de preview). |
| `CRON_SECRET` | ✅ | ✅ | ❌ | Solo necesario en entornos donde el cron job está activo. |
 
> **Referencia:** La lista completa de variables requeridas con sus descripciones está en la sección 11 de este documento.
 
### 13.5. Optimización de Imágenes (Vercel Image Optimization)
 
Vercel y Next.js optimizan automáticamente las imágenes del proyecto (redimensionado, compresión, conversión a formatos modernos como WebP) a través del componente `<Image>` de Next.js.
 
**Alcance real de esta optimización en ProntoTicket:**
 
| Tipo de imagen | ¿Se beneficia de la optimización? | Motivo |
|---|---|---|
| Logo de ProntoTicket en el header | ✅ Sí | Es una imagen estática del proyecto, servida por Next.js. |
| Avatares e íconos del dashboard | ✅ Sí | Son recursos estáticos del proyecto. |
| Fotos y adjuntos enviados por clientes | ❌ No | Estos archivos se sirven desde **Supabase Storage** vía Signed URLs externas. Vercel no tiene acceso a ellos. La optimización no aplica. |
 
Para que los adjuntos de los clientes se mostraran optimizados, sería necesario implementar una ruta proxy en la propia API del proyecto (`/api/adjuntos/[id]`) que descargue el archivo desde Supabase y lo sirva a través de Next.js. Esto se deja como mejora futura y no está en el alcance de la versión inicial.