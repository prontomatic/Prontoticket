## 1. Introducción y Estándares Técnicos
 
La API de ProntoTicket está diseñada siguiendo los principios **REST** y se implementa íntegramente mediante **Next.js API Routes** (`/app/api/`). Actúa como la capa de orquestación entre la interfaz de usuario (React), los servicios de mensajería (SendGrid) y la persistencia de datos (PostgreSQL vía Supabase y MySQL legacy).
 
### 1.1. Especificaciones Generales
 
| Atributo | Valor |
|---|---|
| **Base URL** | `https://ticketera.prontomatic.cl/api` |
| **Formato de datos** | `application/json` (excepto el endpoint de webhook, que usa `multipart/form-data`) |
| **Codificación** | `UTF-8` |
| **Protocolo** | `HTTPS` obligatorio en todos los entornos |
| **Versión de la API** | `v1` (sin prefijo de versión en la URL en la versión inicial) |
 
### 1.2. Convenciones de Nomenclatura
 
- Los endpoints utilizan **kebab-case** en minúsculas: `/tickets/[id]/responder`.
- Los parámetros de ruta dinámicos se expresan entre corchetes: `[id]`.
- Los parámetros de consulta (query params) utilizan **snake_case**: `?own_only=true`.
- Los campos en el cuerpo JSON de las peticiones y respuestas utilizan **snake_case**: `{ "set_status": "EN_ESPERA_CLIENTE" }`.
 
### 1.3. Estructura de Directorios de la API
 
Todos los endpoints residen bajo `/src/app/api/` siguiendo la convención de App Router de Next.js:
 
```
/src/app/api/
├── webhook/
│   └── ingesta/
│       └── route.js              # POST /api/webhook/ingesta
├── tickets/
│   ├── route.js                  # GET  /api/tickets
│   └── [id]/
│       ├── route.js              # GET  /api/tickets/[id]
│       ├── toma/
│       │   └── route.js          # PATCH /api/tickets/[id]/toma
│       ├── estado/
│       │   └── route.js          # PATCH /api/tickets/[id]/estado
│       ├── responder/
│       │   └── route.js          # POST  /api/tickets/[id]/responder
│       └── adjuntos/
│           └── route.js          # GET   /api/tickets/[id]/adjuntos
├── usuarios/
│   ├── route.js                  # GET / POST /api/usuarios
│   └── [id]/
│       └── route.js              # GET / PATCH /api/usuarios/[id]
├── categorias/
│   ├── route.js                  # GET / POST /api/categorias
│   └── [id]/
│       └── route.js              # PATCH /api/categorias/[id]
└── metrics/
    ├── performance/
    │   └── route.js              # GET /api/metrics/performance
    └── audit/
        └── route.js              # GET /api/metrics/audit
```
 
---
 
## 2. Seguridad y Autenticación
 
### 2.1. Autenticación de Usuarios (JWT — Supabase Auth)
 
Con excepción del endpoint de webhook (`/api/webhook/ingesta`), **todas las peticiones a la API requieren autenticación**. El mecanismo utilizado es un token JWT generado por Supabase Auth.
 
**Header requerido en todas las peticiones autenticadas:**
 
```
Authorization: Bearer <JWT_TOKEN>
```
 
El JWT contiene los siguientes claims relevantes para el sistema:
 
| Claim | Descripción |
|---|---|
| `sub` | UUID del usuario autenticado. Corresponde al `id` de su registro en la tabla `Profile`. |
| `email` | Correo institucional del usuario. |
| `role` | Rol del usuario en el sistema (`AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`). Utilizado por la capa de servicios para validar permisos RBAC. |
| `exp` | Timestamp de expiración del token. |
 
**Proceso de validación en cada API Route:**
1. El API Route extrae el token del header `Authorization`.
2. Verifica la firma del JWT usando la clave pública de Supabase (gestionada automáticamente por el SDK de Supabase).
3. Verifica que el token no haya expirado (`exp`).
4. Extrae el `role` del claims y lo pasa a la capa de servicios para la verificación de permisos.
5. Si cualquier validación falla, retorna `401 Unauthorized` antes de ejecutar cualquier lógica de negocio.
 
**Respuesta ante token inválido o ausente:**
```json
{
  "error": "AUTH_REQUIRED",
  "message": "El token de autenticación es inválido, ha expirado o no fue enviado."
}
```
 
### 2.2. Validación de Webhooks (SendGrid — Firma ECDSA)
 
El endpoint `/api/webhook/ingesta` es públicamente accesible (no requiere JWT), ya que es consumido por los servidores de SendGrid y no por usuarios del sistema. Para garantizar que las peticiones provienen exclusivamente de SendGrid, se implementa la **verificación de firma ECDSA** provista por el servicio.
 
**Headers de seguridad enviados por SendGrid en cada petición:**
 
| Header | Tipo | Descripción |
|---|---|---|
| `X-Twilio-Email-Event-Webhook-Signature` | `String` | Firma ECDSA del payload, generada por SendGrid con su clave privada. Sin este header, la verificación debe fallar inmediatamente. |
| `X-Twilio-Email-Event-Webhook-Timestamp` | `String` | Timestamp Unix (en segundos) del momento en que SendGrid generó la firma. **Indispensable:** sin este valor, la concatenación del paso 3 producirá un resultado diferente al que SendGrid firmó, haciendo que la verificación falle siempre. |
 
**Proceso de Verificación Digital (ECDSA) — 4 pasos:**
 
**Paso 1 — Captura de ambos headers:**
Se extraen simultáneamente la firma y el timestamp del request. Si cualquiera de los dos está ausente, se rechaza inmediatamente con `403 Forbidden` sin continuar.
 
```javascript
const signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature');
const timestamp = request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp');
 
if (!signature || !timestamp) {
  return Response.json({ error: 'INVALID_WEBHOOK_SIGNATURE' }, { status: 403 });
}
```
 
**Paso 2 — Obtención del Raw Body (crítico en Next.js App Router):**
Este es el paso más delicado del proceso. SendGrid firma los bytes exactos del cuerpo de la petición tal como los envió. Si el framework parsea o transforma el cuerpo antes de la verificación, la firma dejará de coincidir y la validación fallará siempre.
 
> ⚠️ **Advertencia importante para Next.js App Router:** A diferencia del Pages Router (donde se podía usar `config = { api: { bodyParser: false } }`), en el **App Router** el objeto `request` es una Web API `Request` estándar. El cuerpo **no se parsea automáticamente** hasta que el desarrollador lo solicite explícitamente. Por lo tanto, se debe leer el raw body **antes** de cualquier llamada a `request.formData()`, `request.json()` o cualquier otro método que consuma el stream.
 
```javascript
// Leer el cuerpo como bytes sin procesar (raw buffer)
const rawBody = await request.bytes(); // Uint8Array con los bytes exactos
// A partir de aquí, el stream ya fue consumido.
// El parseo de formData se realiza DESPUÉS de completar la verificación.
```
 
**Paso 3 — Ensamblado para verificación:**
Se concatena el valor del timestamp (como string) seguido inmediatamente por el raw body, sin espacios, saltos de línea ni caracteres adicionales entre ellos. Este es exactamente el mismo ensamblado que SendGrid utilizó para generar la firma.
 
```javascript
// Concatenación: timestamp (string) + rawBody (bytes)
// La librería @sendgrid/eventwebhook abstrae este paso internamente.
```
 
**Paso 4 — Validación criptográfica con la clave pública:**
Se utiliza la clave pública almacenada en la variable de entorno `SENDGRID_WEBHOOK_VERIFICATION_KEY` para verificar la firma ECDSA contra el ensamblado del paso anterior. Se recomienda usar el paquete oficial `@sendgrid/eventwebhook` para abstraer los detalles criptográficos.
 
```javascript
import { EventWebhook } from '@sendgrid/eventwebhook';
 
const eventWebhook = new EventWebhook();
const ecPublicKey = eventWebhook.convertPublicKeyToECDSA(
  process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY
);
const isValid = eventWebhook.verifySignature(ecPublicKey, rawBody, signature, timestamp);
 
if (!isValid) {
  // Registrar en logs: IP de origen + timestamp + motivo del rechazo
  console.error(`[WEBHOOK] Firma inválida. IP: ${request.headers.get('x-forwarded-for')} | Timestamp: ${new Date().toISOString()}`);
  return Response.json({ error: 'INVALID_WEBHOOK_SIGNATURE' }, { status: 403 });
}
 
// Solo aquí es seguro parsear el formData
const formData = await new Request(request.url, {
  method: 'POST',
  headers: request.headers,
  body: rawBody,
}).formData();
```
 
**Respuesta en caso de fallo:**
 
El endpoint retorna `403 Forbidden` sin incluir información descriptiva sobre el motivo del rechazo, para no exponer detalles de la lógica interna a posibles atacantes. Internamente, cada intento rechazado se registra en los logs del servidor con la IP de origen y el timestamp, lo que permite detectar patrones de ataque (intentos repetidos de inyección o denegación de servicio).
 
---
 
## 3. Validación de Esquemas (Zod)
 
ProntoTicket utiliza **Zod** como librería de validación de esquemas para todos los endpoints de la API.
 
### 3.1. Justificación de la Elección
 
Zod fue seleccionado sobre Joi por las siguientes razones específicas para este proyecto:
 
| Criterio | Zod | Joi |
|---|---|---|
| **Dependencias externas** | Cero dependencias | Múltiples dependencias |
| **Bundle size** | ~54KB | ~145KB |
| **Integración con Next.js App Router** | Nativa y directa | Requiere adaptadores |
| **Reutilización de schemas** | Los mismos schemas pueden usarse en API Routes (servidor) y en formularios del dashboard (cliente React), evitando duplicar reglas de validación | Diseñado exclusivamente para servidor; no apto para uso en el navegador |
| **Curva de aprendizaje** | Baja, API intuitiva | Media |
| **Mensajes de error** | Estructurados y fácilmente parseables para respuestas de API | Requieren transformación adicional |
 
> El proyecto utiliza JavaScript (`.js`), no TypeScript. Aunque Zod es conocido por su integración con TypeScript, funciona perfectamente en proyectos JavaScript y ofrece las ventajas listadas independientemente del lenguaje.
 
### 3.2. Patrón de Uso en API Routes
 
Cada API Route que recibe un cuerpo JSON define su schema Zod y valida el `request.body` antes de pasarlo a la capa de servicios:
 
```javascript
import { z } from 'zod';
 
const ResponderSchema = z.object({
  body: z.string().min(1, 'El cuerpo de la respuesta no puede estar vacío.'),
  set_status: z.enum(['EN_PROCESO_INTERNO', 'EN_ESPERA_CLIENTE', 'CERRADO']).optional(),
});
 
// En el API Route:
const result = ResponderSchema.safeParse(await request.json());
if (!result.success) {
  return Response.json(
    { error: 'INVALID_PAYLOAD', details: result.error.flatten() },
    { status: 400 }
  );
}
// result.data está validado y es seguro de usar
```
 
---
 
## 4. Estructura de Respuestas
 
### 4.1. Respuesta Exitosa
 
Todas las respuestas exitosas siguen la siguiente estructura base:
 
```json
{
  "data": { ... },
  "message": "Descripción opcional del resultado."
}
```
 
Para listados (arrays):
 
```json
{
  "data": [ ... ],
  "count": 42
}
```
 
### 4.2. Respuesta de Error
 
Todas las respuestas de error siguen la siguiente estructura:
 
```json
{
  "error": "CODIGO_ERROR",
  "message": "Descripción legible del error para el desarrollador.",
  "details": { ... }
}
```
 
El campo `details` es opcional y se incluye cuando el error provee información adicional útil, como los errores de validación de Zod (campos específicos que fallaron).
 
---
 
## 5. Endpoints de Ingesta (Webhook)
 
### `POST /webhook/ingesta`
 
Recibe y procesa los correos electrónicos entrantes dirigidos a `contacto@prontomatic.cl`, enviados por SendGrid Inbound Parse.
 
**Autenticación:** No requiere JWT. Requiere validación de firma HMAC/ECDSA de SendGrid.
 
**Content-Type:** `multipart/form-data`
 
#### Payload — Campos Clave del Payload de SendGrid
 
| Campo | Tipo | Descripción |
|---|---|---|
| `from` | `String` | Dirección de correo y nombre del remitente original. Ejemplo: `"Juan Pérez <juan@cliente.cl>"`. |
| `to` | `String` | Destinatario del correo. Debe ser `contacto@prontomatic.cl`. |
| `subject` | `String` | Asunto del correo. El sistema escanea este campo buscando el patrón `[#NNN]` para la detección de hilos. |
| `html` | `String` | Cuerpo del mensaje en formato HTML. El sistema lo convierte a Markdown. |
| `text` | `String` | Cuerpo del mensaje en texto plano. Utilizado como fallback si la conversión HTML → Markdown falla. |
| `headers` | `String` | Bloque completo de encabezados del correo. Contiene el `Message-ID`, `In-Reply-To` y `References` para la detección de hilo y deduplicación. |
| `attachments` | `Integer` | Número de archivos adjuntos incluidos en el correo. |
| `attachment-info` | `JSON String` | Metadatos de cada adjunto: nombre, tipo MIME y tamaño. |
| `spam_score` | `String` | Puntuación de spam asignada por SendGrid. |
 
#### Lógica de Procesamiento
 
Al recibir el payload, el sistema ejecuta el siguiente flujo en orden:
 
1. **Validación de firma ECDSA** — Si falla, retorna `403` inmediatamente.
2. **Filtrado por spam_score** — Si `spam_score >= 5.0` (umbral de SpamAssassin), el correo se descarta. Retorna `200 OK`.
3. **Filtrado por headers de protocolo** — Se evalúan los headers `Auto-Submitted`, `X-Autoreply`, `List-Unsubscribe`, `Precedence` y el remitente. Si alguno indica un correo automático, de rebote, newsletter o notificación de sistema, el correo se descarta. Retorna `200 OK`. Ver `alcance-funcional.md` sección 2.2 para la tabla completa de tipos y headers evaluados.
4. **Deduplicación** — Se verifica que el `Message-ID` no exista en la tabla `Message`. Si existe, retorna `200 OK` sin procesar.
5. **Detección de hilo** — Se evalúa el asunto (patrón `[#NNN]`) y los headers `In-Reply-To` / `References`.
6. **Normalización** — Conversión del cuerpo HTML a Markdown con `turndown`.
7. **Enriquecimiento** — Consulta a MySQL legacy (`users`) por el email del remitente.
8. **Creación del ticket o mensaje** — Según el resultado de la detección de hilo.
9. **Procesamiento de adjuntos** — Validación de tipo MIME y tamaño, subida a Supabase Storage y creación de registros en `Attachment`.
 
#### Respuestas
 
| Código | Condición |
|---|---|
| `200 OK` | Petición recibida y procesada correctamente. También se retorna `200` si el correo fue identificado como duplicado, para evitar reintentos de SendGrid. |
| `403 Forbidden` | Firma HMAC inválida. La petición no proviene de SendGrid. |
| `500 Internal Server Error` | Error inesperado durante el procesamiento. Se registra en los logs del servidor. |
 
> **Nota importante:** El endpoint siempre retorna `200 OK` ante correos duplicados (en lugar de `409 Conflict`) porque SendGrid reintenta el envío ante cualquier respuesta que no sea `2xx`, lo que generaría un bucle de reintentos innecesarios.
 
---
 
## 6. Endpoints de Tickets
 
### `GET /tickets`
 
Obtiene el listado de tickets para el dashboard principal, aplicando filtros de visibilidad según el rol del usuario autenticado.
 
**Autenticación:** JWT requerido. Roles permitidos: `AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`.
 
**Paginación:** No implementada en la versión inicial. Se retorna el listado completo de tickets visibles para el usuario. Dado el volumen operativo estimado (30-40 tickets activos diarios), esto es suficiente sin impacto en el rendimiento. Si el volumen crece significativamente en el futuro, se implementará paginación mediante los parámetros `page` y `limit`.
 
#### Parámetros de Consulta (Query Params)
 
| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `status` | `String` (Enum) | No | Filtra por estado del ticket. Valores: `ABIERTO`, `EN_PROCESO_INTERNO`, `EN_ESPERA_CLIENTE`, `CERRADO`. Si se omite, retorna todos los estados. |
| `category_id` | `Integer` | No | Filtra por ID de categoría. |
| `assigned_to` | `String` (UUID) | No | Filtra por agente asignado. Solo disponible para `SUPERVISOR` y `ADMINISTRADOR`. Si un `AGENTE` envía este parámetro, es ignorado. |
| `own_only` | `Boolean` | No | Si es `true`, retorna únicamente los tickets asignados al usuario autenticado. Útil para que el agente vea solo sus casos activos. |
| `order_by` | `String` | No | Campo de ordenamiento. Valores: `created_at`, `updated_at`, `last_client_reply_at`. Default: `created_at`. |
| `order_dir` | `String` | No | Dirección del ordenamiento. Valores: `asc`, `desc`. Default: `desc`. |
 
#### Lógica de Visibilidad por Rol
 
| Rol | Tickets retornados |
|---|---|
| `AGENTE` | Tickets en estado `ABIERTO` (sin asignar) + tickets con `assigned_to` igual al ID del agente autenticado. |
| `SUPERVISOR` | Todos los tickets del sistema, sin restricción. |
| `ADMINISTRADOR` | Todos los tickets del sistema, sin restricción. |
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": [
    {
      "id": 142,
      "subject": "Falla en máquina dispensadora piso 3",
      "status": "EN_PROCESO_INTERNO",
      "client_email": "juan@cliente.cl",
      "category": {
        "id": 1,
        "name": "Falla de Maquinaria"
      },
      "assigned_agent": {
        "id": "uuid-agente",
        "full_name": "María González"
      },
      "created_at": "2025-03-15T10:30:00Z",
      "updated_at": "2025-03-15T11:45:00Z",
      "last_client_reply_at": "2025-03-15T10:30:00Z"
    }
  ],
  "count": 1
}
```
 
---
 
### `GET /tickets/[id]`
 
Retorna el detalle completo de un ticket individual, incluyendo el hilo de mensajes, los datos de enriquecimiento del cliente, los adjuntos y el historial de estados.
 
**Autenticación:** JWT requerido. Roles permitidos: `AGENTE` (solo si el ticket le está asignado o está en estado `ABIERTO`), `SUPERVISOR`, `ADMINISTRADOR`.
 
#### Parámetros de Ruta
 
| Parámetro | Tipo | Descripción |
|---|---|---|
| `id` | `Integer` | Número de ticket (autoincremental). Ejemplo: `142`. |
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": {
    "id": 142,
    "subject": "Falla en máquina dispensadora piso 3",
    "content": "Buen día, la máquina del piso 3 no está dispensando...",
    "status": "EN_PROCESO_INTERNO",
    "client": {
      "email": "juan@cliente.cl",
      "rut": "12.345.678-9",
      "phone": "+56912345678",
      "address": "Av. Siempreviva 742, Santiago",
      "enrichment_note": null
    },
    "category": {
      "id": 1,
      "name": "Falla de Maquinaria"
    },
    "assigned_agent": {
      "id": "uuid-agente",
      "full_name": "María González",
      "role": "AGENTE"
    },
    "messages": [
      {
        "id": 1,
        "sender_type": "CLIENTE",
        "author": null,
        "body": "Buen día, la máquina del piso 3 no está dispensando...",
        "send_status": "ENVIADO",
        "sent_at": "2025-03-15T10:30:00Z",
        "attachments": [
          {
            "id": 1,
            "file_name": "foto_maquina.jpg",
            "mime_type": "image/jpeg",
            "file_size": 204800
          }
        ]
      },
      {
        "id": 2,
        "sender_type": "AGENTE",
        "author": {
          "id": "uuid-agente",
          "full_name": "María González"
        },
        "body": "Estimado Juan, hemos recibido su reporte...",
        "send_status": "ENVIADO",
        "sent_at": "2025-03-15T11:45:00Z",
        "attachments": []
      }
    ],
    "status_history": [
      {
        "id": 1,
        "previous_status": null,
        "new_status": "ABIERTO",
        "changed_by": null,
        "is_system_action": true,
        "changed_at": "2025-03-15T10:30:00Z"
      },
      {
        "id": 2,
        "previous_status": "ABIERTO",
        "new_status": "EN_PROCESO_INTERNO",
        "changed_by": {
          "id": "uuid-agente",
          "full_name": "María González"
        },
        "is_system_action": false,
        "changed_at": "2025-03-15T11:00:00Z"
      }
    ],
    "created_at": "2025-03-15T10:30:00Z",
    "updated_at": "2025-03-15T11:45:00Z",
    "closed_at": null
  }
}
```
 
#### Errores Específicos
 
| Código | Error | Condición |
|---|---|---|
| `404 Not Found` | `RESOURCE_NOT_FOUND` | El ticket con el ID especificado no existe. |
| `403 Forbidden` | `PERMISSION_DENIED` | Un agente intenta acceder a un ticket que no le corresponde. |
 
---
 
### `PATCH /tickets/[id]/toma`
 
Acción manual del agente para asignarse un ticket disponible del dashboard global.
 
**Autenticación:** JWT requerido. Roles permitidos: `AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`.
 
**Cuerpo de la petición:** Vacío. No se requiere body.
 
#### Precondiciones
 
- El ticket debe existir.
- El campo `assigned_to` del ticket debe ser `null` (el ticket no debe haber sido tomado por otro agente).
- El ticket debe estar en estado `ABIERTO`.
 
#### Efecto de la Operación (Atómico)
 
Al ejecutarse exitosamente, el sistema realiza las siguientes operaciones de forma atómica:
 
1. Actualiza `assigned_to` del ticket con el UUID del agente autenticado.
2. Cambia el `status` de `ABIERTO` a `EN_PROCESO_INTERNO`.
3. Actualiza `updated_at` del ticket.
4. Crea un registro en `StatusHistory`:
   - `previous_status: ABIERTO`
   - `new_status: EN_PROCESO_INTERNO`
   - `changed_by: [UUID del agente]`
   - `is_system_action: false`
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": {
    "id": 142,
    "status": "EN_PROCESO_INTERNO",
    "assigned_to": "uuid-agente"
  },
  "message": "Ticket #142 asignado correctamente."
}
```
 
#### Errores Específicos
 
| Código | Error | Condición |
|---|---|---|
| `404 Not Found` | `RESOURCE_NOT_FOUND` | El ticket no existe. |
| `409 Conflict` | `ALREADY_ASSIGNED` | El ticket ya fue tomado por otro agente entre el momento en que se cargó el dashboard y el momento en que el agente intentó tomarlo (condición de carrera). |
 
---
 
### `PATCH /tickets/[id]/estado`
 
Permite al agente, supervisor o administrador cambiar manualmente el estado de un ticket.
 
**Autenticación:** JWT requerido. Roles permitidos: `AGENTE` (solo tickets propios), `SUPERVISOR`, `ADMINISTRADOR`.
 
#### Cuerpo de la Petición
 
```json
{
  "status": "EN_ESPERA_CLIENTE"
}
```
 
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `status` | `String` (Enum) | Sí | Nuevo estado del ticket. Valores: `EN_PROCESO_INTERNO`, `EN_ESPERA_CLIENTE`, `CERRADO`. No es posible revertir manualmente un ticket a `ABIERTO`. |
 
#### Efecto de la Operación
 
1. Actualiza el `status` del ticket al valor indicado.
2. Si el nuevo estado es `CERRADO`: popula `closed_at` con el timestamp actual.
3. Si el nuevo estado es `EN_ESPERA_CLIENTE`: actualiza `last_client_reply_at` no aplica; el contador de inactividad comienza desde este momento.
4. Crea un registro en `StatusHistory` con los datos del cambio.
5. Si el nuevo estado es `CERRADO`: dispara el envío de la encuesta CSAT al cliente (asíncrono, no bloquea la respuesta).
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": {
    "id": 142,
    "status": "CERRADO",
    "closed_at": "2025-03-16T09:00:00Z"
  },
  "message": "Estado del ticket #142 actualizado a CERRADO."
}
```
 
#### Errores Específicos
 
| Código | Error | Condición |
|---|---|---|
| `400 Bad Request` | `INVALID_PAYLOAD` | El valor de `status` no es un estado válido. |
| `403 Forbidden` | `PERMISSION_DENIED` | Un agente intenta cambiar el estado de un ticket que no le está asignado. |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | El ticket no existe. |
 
---
 
### `GET /tickets/search`
 
Permite buscar tickets por términos de texto libre a través de asunto, correo del cliente o número de ticket. Utilizado por la barra de búsqueda global del header del dashboard.
 
**Autenticación:** JWT requerido. Roles permitidos: `AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`.
 
#### Parámetros de Consulta (Query Params)
 
| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `q` | `String` | Sí | Término de búsqueda. Mínimo 2 caracteres. El sistema busca coincidencias parciales en los campos `subject`, `client_email` y el número de ticket (`id`). |
 
#### Lógica de Búsqueda
 
La búsqueda evalúa el término `q` contra los siguientes campos:
 
| Campo buscado | Tipo de coincidencia | Ejemplo |
|---|---|---|
| `Ticket.id` | Coincidencia exacta si `q` es numérico | `q=142` encuentra el ticket `#142` |
| `Ticket.subject` | Coincidencia parcial, insensible a mayúsculas (`ILIKE`) | `q=lavadora` encuentra tickets con "Lavadora" en el asunto |
| `Ticket.client_email` | Coincidencia parcial, insensible a mayúsculas | `q=juan@` encuentra todos los tickets de ese cliente |
 
Los resultados se filtran además por las mismas reglas de visibilidad de rol que aplican en `GET /tickets` (un agente solo ve sus propios tickets y los abiertos).
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": [
    {
      "id": 142,
      "subject": "Falla en máquina dispensadora piso 3",
      "status": "EN_PROCESO_INTERNO",
      "client_email": "juan@cliente.cl",
      "created_at": "2025-03-15T10:30:00Z"
    }
  ],
  "count": 1,
  "query": "lavadora"
}
```
 
#### Errores Específicos
 
| Código | Error | Condición |
|---|---|---|
| `400 Bad Request` | `INVALID_PAYLOAD` | El parámetro `q` está ausente o tiene menos de 2 caracteres. |
 
---
 
## 7. Endpoints de Mensajes y Comunicación
 
### `POST /tickets/[id]/responder`
 
Envía una respuesta del agente al cliente y registra el mensaje en el hilo del ticket.
 
**Autenticación:** JWT requerido. Roles permitidos: `AGENTE` (solo tickets propios), `SUPERVISOR`, `ADMINISTRADOR`.
 
#### Cuerpo de la Petición
 
```json
{
  "body": "Estimado Juan, hemos revisado su caso y el técnico...",
  "set_status": "EN_ESPERA_CLIENTE"
}
```
 
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `body` | `String` | Sí | Contenido de la respuesta. Mínimo 1 carácter. Se almacena en Markdown. |
| `set_status` | `String` (Enum) | No | Si se incluye, el ticket cambia a este estado tras el envío. Valores válidos: `EN_PROCESO_INTERNO`, `EN_ESPERA_CLIENTE`, `CERRADO`. Si se omite, el estado del ticket no cambia. |
 
#### Proceso de Envío (Detalle Técnico)
 
1. Se valida el JWT y los permisos del agente sobre el ticket.
2. Se valida el cuerpo de la petición con el schema Zod correspondiente.
3. Se construye el payload para SendGrid Mail Send API:
   - `from.email`: `contacto@prontomatic.cl` (siempre fijo)
   - `from.name`: `Prontomatic Soporte`
   - `to`: correo del cliente (`client_email` del ticket)
   - `subject`: `[#NNN] Re: <asunto original del ticket>`
   - `In-Reply-To`: `message_id_header` del mensaje original del cliente
   - `References`: `message_id_header` del mensaje original del cliente
4. Se envía el correo a través de SendGrid.
5. Se crea el registro en la tabla `Message`:
   - `sender_type: AGENTE`
   - `author_id: [UUID del agente]`
   - `body: [contenido de la respuesta]`
   - `send_status: ENVIADO` (o `ERROR` si SendGrid falla)
6. Si se incluyó `set_status`, se actualiza el estado del ticket y se registra en `StatusHistory`.
7. Si `set_status` es `CERRADO`, se dispara la encuesta CSAT.
 
#### Respuesta Exitosa — `201 Created`
 
```json
{
  "data": {
    "message_id": 15,
    "ticket_id": 142,
    "send_status": "ENVIADO",
    "sent_at": "2025-03-16T08:30:00Z",
    "ticket_status": "EN_ESPERA_CLIENTE"
  },
  "message": "Respuesta enviada correctamente al cliente."
}
```
 
#### Errores Específicos
 
| Código | Error | Condición |
|---|---|---|
| `400 Bad Request` | `INVALID_PAYLOAD` | El campo `body` está vacío o el valor de `set_status` no es válido. |
| `403 Forbidden` | `PERMISSION_DENIED` | El agente no tiene asignado este ticket. |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | El ticket no existe. |
| `502 Bad Gateway` | `SENDGRID_ERROR` | La API de SendGrid retornó un error. El mensaje se registra con `send_status: ERROR` en la base de datos y se notifica al agente. |
 
---
 
### `GET /tickets/[id]/adjuntos`
 
Retorna la lista de archivos adjuntos de un ticket con sus Signed URLs temporales para descarga o visualización directa desde el dashboard.
 
**Autenticación:** JWT requerido. Roles permitidos: `AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`.
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": [
    {
      "id": 1,
      "message_id": 1,
      "file_name": "foto_maquina_averiada.jpg",
      "mime_type": "image/jpeg",
      "file_size": 204800,
      "signed_url": "https://storage.supabase.co/...?token=...&expires=...",
      "signed_url_expires_at": "2025-03-16T10:30:00Z"
    },
    {
      "id": 2,
      "message_id": 1,
      "file_name": "comprobante_recaudacion.pdf",
      "mime_type": "application/pdf",
      "file_size": 512000,
      "signed_url": "https://storage.supabase.co/...?token=...&expires=...",
      "signed_url_expires_at": "2025-03-16T10:30:00Z"
    }
  ],
  "count": 2
}
```
 
> **Nota:** Los Signed URLs tienen una validez de **60 minutos** desde su generación. Después de ese período, el cliente del dashboard debe solicitar nuevas URLs volviendo a llamar a este endpoint.
 
---
 
## 8. Endpoints de Usuarios
 
### `GET /usuarios`
 
Retorna el listado de todos los usuarios registrados en el sistema.
 
**Autenticación:** JWT requerido. Roles permitidos: `ADMINISTRADOR` únicamente.
 
#### Parámetros de Consulta (Query Params)
 
| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `role` | `String` (Enum) | No | Filtra por rol. Valores: `AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`. |
| `is_active` | `Boolean` | No | Filtra por estado activo/inactivo. Si se omite, retorna todos. |
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": [
    {
      "id": "uuid-usuario",
      "email": "maria@prontomatic.cl",
      "full_name": "María González",
      "role": "AGENTE",
      "is_active": true,
      "created_at": "2025-01-10T09:00:00Z"
    }
  ],
  "count": 1
}
```
 
---
 
### `POST /usuarios`
 
Crea un nuevo usuario en el sistema. Genera la cuenta en Supabase Auth y el perfil correspondiente en la tabla `Profile`.
 
**Autenticación:** JWT requerido. Roles permitidos: `ADMINISTRADOR` únicamente.
 
#### Cuerpo de la Petición
 
```json
{
  "email": "nuevo@prontomatic.cl",
  "full_name": "Carlos Pérez",
  "role": "AGENTE",
  "password": "contraseña_inicial_segura"
}
```
 
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `email` | `String` | Sí | Correo institucional del nuevo usuario. Debe ser único en el sistema. |
| `full_name` | `String` | Sí | Nombre completo del usuario. |
| `role` | `String` (Enum) | Sí | Rol asignado. Valores: `AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`. |
| `password` | `String` | Sí | Contraseña inicial. Mínimo 8 caracteres. Se recomienda que el usuario la cambie en su primer ingreso. |
 
#### Respuesta Exitosa — `201 Created`
 
```json
{
  "data": {
    "id": "uuid-nuevo-usuario",
    "email": "nuevo@prontomatic.cl",
    "full_name": "Carlos Pérez",
    "role": "AGENTE",
    "is_active": true,
    "created_at": "2025-03-16T10:00:00Z"
  },
  "message": "Usuario creado correctamente."
}
```
 
#### Errores Específicos
 
| Código | Error | Condición |
|---|---|---|
| `400 Bad Request` | `INVALID_PAYLOAD` | Campos requeridos ausentes, email con formato inválido o contraseña muy corta. |
| `409 Conflict` | `EMAIL_ALREADY_EXISTS` | Ya existe un usuario con ese correo electrónico. |
 
---
 
### `GET /usuarios/[id]`
 
Retorna el detalle de un usuario específico.
 
**Autenticación:** JWT requerido. Roles permitidos: `ADMINISTRADOR`. Un usuario también puede consultar su propio perfil (cualquier rol).
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": {
    "id": "uuid-usuario",
    "email": "maria@prontomatic.cl",
    "full_name": "María González",
    "role": "AGENTE",
    "is_active": true,
    "created_at": "2025-01-10T09:00:00Z"
  }
}
```
 
---
 
### `PATCH /usuarios/[id]`
 
Actualiza los datos de un usuario existente. Permite modificar nombre, rol y estado activo.
 
**Autenticación:** JWT requerido. Roles permitidos: `ADMINISTRADOR` únicamente.
 
#### Cuerpo de la Petición
 
Todos los campos son opcionales. Solo se actualizan los campos incluidos en el body.
 
```json
{
  "full_name": "María González Soto",
  "role": "SUPERVISOR",
  "is_active": false
}
```
 
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `full_name` | `String` | No | Nuevo nombre completo del usuario. |
| `role` | `String` (Enum) | No | Nuevo rol. Valores: `AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`. |
| `is_active` | `Boolean` | No | `false` para desactivar el acceso del usuario. `true` para reactivarlo. |
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": {
    "id": "uuid-usuario",
    "email": "maria@prontomatic.cl",
    "full_name": "María González Soto",
    "role": "SUPERVISOR",
    "is_active": false
  },
  "message": "Usuario actualizado correctamente."
}
```
 
---
 
## 9. Endpoints de Categorías
 
### `GET /categorias`
 
Retorna el listado de categorías disponibles en el sistema.
 
**Autenticación:** JWT requerido. Roles permitidos: `AGENTE`, `SUPERVISOR`, `ADMINISTRADOR`.
 
#### Parámetros de Consulta (Query Params)
 
| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `is_active` | `Boolean` | No | Si es `true`, retorna solo categorías activas. Default: `true`. |
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": [
    {
      "id": 1,
      "name": "Falla de Maquinaria",
      "description": "Problemas físicos o mecánicos con las máquinas dispensadoras.",
      "is_active": true,
      "created_at": "2025-01-15T09:00:00Z"
    }
  ],
  "count": 1
}
```
 
---
 
### `POST /categorias`
 
Crea una nueva categoría de tickets.
 
**Autenticación:** JWT requerido. Roles permitidos: `ADMINISTRADOR` únicamente.
 
#### Cuerpo de la Petición
 
```json
{
  "name": "Problema con App",
  "description": "Incidencias relacionadas con la aplicación móvil o web de Prontomatic."
}
```
 
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `name` | `String` | Sí | Nombre de la categoría. Debe ser único. |
| `description` | `String` | No | Descripción detallada de los casos que abarca esta categoría. |
 
#### Respuesta Exitosa — `201 Created`
 
```json
{
  "data": {
    "id": 2,
    "name": "Problema con App",
    "description": "Incidencias relacionadas con la aplicación móvil o web de Prontomatic.",
    "is_active": true,
    "created_at": "2025-03-16T10:00:00Z"
  },
  "message": "Categoría creada correctamente."
}
```
 
#### Errores Específicos
 
| Código | Error | Condición |
|---|---|---|
| `409 Conflict` | `CATEGORY_ALREADY_EXISTS` | Ya existe una categoría con ese nombre. |
 
---
 
### `PATCH /categorias/[id]`
 
Actualiza el nombre, descripción o estado activo de una categoría existente.
 
**Autenticación:** JWT requerido. Roles permitidos: `ADMINISTRADOR` únicamente.
 
#### Cuerpo de la Petición
 
```json
{
  "name": "Falla Técnica de Maquinaria",
  "description": "Descripción actualizada.",
  "is_active": false
}
```
 
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `name` | `String` | No | Nuevo nombre de la categoría. |
| `description` | `String` | No | Nueva descripción. |
| `is_active` | `Boolean` | No | `false` para desactivar la categoría. Los tickets históricos con esta categoría no se ven afectados. |
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": {
    "id": 1,
    "name": "Falla Técnica de Maquinaria",
    "is_active": false
  },
  "message": "Categoría actualizada correctamente."
}
```
 
---
 
## 10. Endpoints de Métricas y Auditoría
 
### `GET /metrics/performance`
 
Retorna estadísticas de desempeño operativo del equipo de soporte para el panel de supervisión.
 
**Autenticación:** JWT requerido. Roles permitidos: `SUPERVISOR`, `ADMINISTRADOR`.
 
#### Parámetros de Consulta (Query Params)
 
| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `from` | `String` (ISO 8601) | No | Fecha de inicio del período. Ejemplo: `2025-03-01T00:00:00Z`. Default: inicio del mes actual. |
| `to` | `String` (ISO 8601) | No | Fecha de fin del período. Ejemplo: `2025-03-31T23:59:59Z`. Default: momento actual. |
| `agent_id` | `String` (UUID) | No | Si se incluye, filtra las métricas por un agente específico. Si se omite, retorna métricas globales y por agente. |
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": {
    "period": {
      "from": "2025-03-01T00:00:00Z",
      "to": "2025-03-31T23:59:59Z"
    },
    "global": {
      "total_tickets": 87,
      "tickets_by_status": {
        "ABIERTO": 5,
        "EN_PROCESO_INTERNO": 8,
        "EN_ESPERA_CLIENTE": 3,
        "CERRADO": 71
      },
      "tickets_by_category": [
        { "category": "Falla de Maquinaria", "count": 45 },
        { "category": "Problema con App", "count": 22 }
      ],
      "avg_resolution_time_hours": 6.4,
      "auto_close_rate_percent": 12.5
    },
    "by_agent": [
      {
        "agent_id": "uuid-agente",
        "full_name": "María González",
        "tickets_taken": 32,
        "tickets_closed": 29,
        "avg_first_response_time_hours": 1.2,
        "avg_resolution_time_hours": 5.8,
        "auto_closed_tickets": 3
      }
    ]
  }
}
```
 
---
 
### `GET /metrics/audit`
 
Retorna el historial completo de cambios de estado de un ticket específico para auditoría.
 
**Autenticación:** JWT requerido. Roles permitidos: `SUPERVISOR`, `ADMINISTRADOR`.
 
#### Parámetros de Consulta (Query Params)
 
| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ticket_id` | `Integer` | Sí | ID del ticket a auditar. |
 
#### Respuesta Exitosa — `200 OK`
 
```json
{
  "data": {
    "ticket_id": 142,
    "subject": "Falla en máquina dispensadora piso 3",
    "total_resolution_time_hours": 22.5,
    "history": [
      {
        "id": 1,
        "previous_status": null,
        "new_status": "ABIERTO",
        "changed_by": null,
        "is_system_action": true,
        "changed_at": "2025-03-15T10:30:00Z",
        "duration_in_status_hours": 0.5
      },
      {
        "id": 2,
        "previous_status": "ABIERTO",
        "new_status": "EN_PROCESO_INTERNO",
        "changed_by": {
          "id": "uuid-agente",
          "full_name": "María González"
        },
        "is_system_action": false,
        "changed_at": "2025-03-15T11:00:00Z",
        "duration_in_status_hours": 20.5
      },
      {
        "id": 3,
        "previous_status": "EN_PROCESO_INTERNO",
        "new_status": "CERRADO",
        "changed_by": {
          "id": "uuid-agente",
          "full_name": "María González"
        },
        "is_system_action": false,
        "changed_at": "2025-03-16T07:30:00Z",
        "duration_in_status_hours": null
      }
    ]
  }
}
```
 
---
 
## 11. Tabla de Códigos de Error Globales
 
| Código HTTP | Código de Error | Descripción | Posible Causa |
|---|---|---|---|
| `400 Bad Request` | `INVALID_PAYLOAD` | Los datos enviados no cumplen con el esquema de validación de Zod. | Campos requeridos ausentes, tipos de datos incorrectos o valores fuera del rango permitido. |
| `401 Unauthorized` | `AUTH_REQUIRED` | El token JWT es inválido, ha expirado o no fue enviado. | Sesión caducada, token manipulado o header `Authorization` ausente. |
| `403 Forbidden` | `PERMISSION_DENIED` | El usuario autenticado no tiene el rol necesario para ejecutar esta acción. | Un agente intentando acceder a endpoints de supervisor/administrador. |
| `403 Forbidden` | `INVALID_WEBHOOK_SIGNATURE` | La firma HMAC del webhook de SendGrid es inválida. | Petición al endpoint de ingesta que no proviene de SendGrid. |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | El recurso solicitado no existe en la base de datos. | ID de ticket, usuario o categoría inexistente. |
| `409 Conflict` | `ALREADY_ASSIGNED` | Se intentó tomar un ticket que ya fue asignado a otro agente. | Condición de carrera entre dos agentes tomando el mismo ticket simultáneamente. |
| `409 Conflict` | `EMAIL_ALREADY_EXISTS` | El correo electrónico ya está registrado en el sistema. | Intento de crear un usuario con un email duplicado. |
| `409 Conflict` | `CATEGORY_ALREADY_EXISTS` | Ya existe una categoría con ese nombre. | Intento de crear una categoría con un nombre duplicado. |
| `500 Internal Server Error` | `DB_CONNECTION_FAILURE` | Fallo en la conexión con PostgreSQL (Supabase) o MySQL legacy. | Problemas de red, credenciales incorrectas o base de datos no disponible. |
| `502 Bad Gateway` | `SENDGRID_ERROR` | La API de SendGrid retornó un error al intentar enviar un correo. | Problema con la API Key, límite de envíos alcanzado o error del servicio externo. |
 
---
 
## 12. Resumen de Endpoints
 
| Método | Endpoint | Descripción | Roles |
|---|---|---|---|
| `POST` | `/webhook/ingesta` | Recepción de correos desde SendGrid | Sistema (no JWT) |
| `GET` | `/tickets` | Listado de tickets del dashboard | Agente, Supervisor, Admin |
| `GET` | `/tickets/search` | Búsqueda de tickets por texto libre | Agente, Supervisor, Admin |
| `GET` | `/tickets/[id]` | Detalle completo de un ticket | Agente*, Supervisor, Admin |
| `PATCH` | `/tickets/[id]/toma` | Tomar un ticket del dashboard | Agente, Supervisor, Admin |
| `PATCH` | `/tickets/[id]/estado` | Cambiar estado de un ticket | Agente*, Supervisor, Admin |
| `POST` | `/tickets/[id]/responder` | Enviar respuesta al cliente | Agente*, Supervisor, Admin |
| `GET` | `/tickets/[id]/adjuntos` | Listar adjuntos con Signed URLs | Agente, Supervisor, Admin |
| `GET` | `/usuarios` | Listado de usuarios del sistema | Admin |
| `POST` | `/usuarios` | Crear nuevo usuario | Admin |
| `GET` | `/usuarios/[id]` | Detalle de un usuario | Admin, propio perfil |
| `PATCH` | `/usuarios/[id]` | Actualizar datos de un usuario | Admin |
| `GET` | `/categorias` | Listado de categorías | Agente, Supervisor, Admin |
| `POST` | `/categorias` | Crear nueva categoría | Admin |
| `PATCH` | `/categorias/[id]` | Actualizar categoría | Admin |
| `GET` | `/metrics/performance` | Métricas de desempeño del equipo | Supervisor, Admin |
| `GET` | `/metrics/audit` | Historial de auditoría de un ticket | Supervisor, Admin |
| `GET` | `/cron/check-inactivity` | Job de cierre automático por inactividad (Vercel Cron, no uso público) | Sistema (Vercel Cron) |
 
> **\* Agente con restricción:** Los agentes solo pueden ejecutar estas acciones sobre tickets que tienen asignados (`assigned_to` igual a su UUID).