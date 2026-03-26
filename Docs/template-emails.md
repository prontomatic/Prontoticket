# Templates de Correos Automáticos — ProntoTicket

## 1. Introducción

ProntoTicket envía **cuatro correos automáticos** al cliente a lo largo del ciclo de vida de un ticket. Ninguno de estos correos requiere intervención manual del agente: todos son disparados automáticamente por el sistema en respuesta a eventos específicos.

| # | Template | Trigger | Responsable del disparo |
|---|---|---|---|
| 1 | **Acuse de Recibo** | Creación de un nuevo ticket (webhook de ingesta procesado exitosamente) | `ticketService.js` al crear el ticket |
| 2 | **Aviso de Cierre Próximo** | Ticket en `EN_ESPERA_CLIENTE` por más de 24 horas sin respuesta del cliente | `notificationService.js` vía Vercel Cron Job |
| 3 | **Notificación de Cierre Automático** | Ticket cerrado automáticamente por el sistema al cumplirse 48 horas de inactividad | `notificationService.js` vía Vercel Cron Job |
| 4 | **Encuesta CSAT** | Ticket pasando a estado `CERRADO` (por cierre manual del agente o cierre automático) | `notificationService.js` al detectar transición a `CERRADO` |

**Remitente de todos los correos automáticos:**
```
De: Prontomatic Soporte <contacto@prontomatic.cl>
```

Los correos automáticos siempre incluyen los headers `In-Reply-To` y `References` correspondientes al hilo del ticket, de modo que el cliente los visualiza dentro de la misma conversación en su cliente de correo (Gmail, Outlook, Apple Mail, etc.).

---

## 2. Template 1: Acuse de Recibo (Creación de Ticket)

### 2.1. Propósito

Confirmar al cliente que su correo fue recibido y que se ha creado un caso de soporte en el sistema. Genera confianza inmediata y establece las expectativas del cliente respecto a la atención que recibirá.

### 2.2. Trigger

Se dispara **inmediatamente** tras la creación exitosa del ticket en la base de datos, como parte del mismo flujo de procesamiento del webhook de SendGrid. No espera ninguna acción del agente.

### 2.3. Asunto del Correo

```
[#{{ticket_id}}] Hemos recibido tu solicitud — {{ticket_subject}}
```

**Ejemplo:** `[#142] Hemos recibido tu solicitud — Problema con máquina dispensadora piso 3`

### 2.4. Cuerpo del Correo (Texto Plano)

```
Hola,

Hemos recibido tu mensaje y hemos registrado tu solicitud de soporte en nuestro sistema.

Tu número de caso es: #{{ticket_id}}

Uno de nuestros agentes revisará tu caso a la brevedad y se pondrá en contacto contigo
para ayudarte a resolver el problema.

Si deseas agregar más información o hacer seguimiento a tu caso, puedes responder
directamente a este correo.

Gracias por contactarnos.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl
```

### 2.5. Variables Dinámicas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `{{ticket_id}}` | Número de ticket autoincremental | `142` |
| `{{ticket_subject}}` | Asunto del correo original del cliente | `Problema con máquina dispensadora piso 3` |

---

## 3. Template 2: Aviso de Cierre Próximo (24h sin respuesta)

### 3.1. Propósito

Notificar al cliente que su caso está próximo a cerrarse automáticamente por falta de respuesta, dándole la oportunidad de retomar la comunicación antes de que el ticket sea cerrado definitivamente.

### 3.2. Trigger

Se dispara cuando un ticket en estado `EN_ESPERA_CLIENTE` lleva **más de 24 horas** sin recibir un nuevo mensaje del cliente, evaluado por el Vercel Cron Job que se ejecuta cada hora. Solo se envía una vez por ticket (el sistema registra que la notificación fue enviada para no repetirla).

### 3.3. Asunto del Correo

```
[#{{ticket_id}}] Tu caso se cerrará pronto por falta de respuesta
```

**Ejemplo:** `[#142] Tu caso se cerrará pronto por falta de respuesta`

### 3.4. Cuerpo del Correo (Texto Plano)

```
Hola,

Te contactamos para informarte que tu caso de soporte #{{ticket_id}} lleva más de
24 horas sin actividad.

Asunto de tu caso: {{ticket_subject}}

Si aún necesitas ayuda o tienes información adicional que compartir, por favor
responde a este correo antes de las próximas {{horas_restantes}} horas para
evitar el cierre automático de tu caso.

Si tu problema ya fue resuelto, no es necesario que respondas. Tu caso se cerrará
automáticamente.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl
```

### 3.5. Variables Dinámicas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `{{ticket_id}}` | Número de ticket | `142` |
| `{{ticket_subject}}` | Asunto del correo original | `Problema con máquina dispensadora piso 3` |
| `{{horas_restantes}}` | Horas que quedan hasta el cierre automático (48h total - tiempo transcurrido) | `22` |

---

## 4. Template 3: Notificación de Cierre Automático (48h)

### 4.1. Propósito

Informar al cliente que su caso fue cerrado automáticamente por el sistema debido a la falta de respuesta. El correo debe ser claro respecto a que el cierre ocurrió sin intervención del agente, y debe indicar cómo puede reabrir el caso si aún necesita asistencia.

### 4.2. Trigger

Se dispara cuando el Vercel Cron Job ejecuta el cierre automático de un ticket, es decir, cuando un ticket en estado `EN_ESPERA_CLIENTE` supera las **48 horas** sin respuesta del cliente. Se envía inmediatamente después de que el sistema cambia el estado del ticket a `CERRADO`.

### 4.3. Asunto del Correo

```
[#{{ticket_id}}] Tu caso ha sido cerrado por inactividad
```

**Ejemplo:** `[#142] Tu caso ha sido cerrado por inactividad`

### 4.4. Cuerpo del Correo (Texto Plano)

```
Hola,

Tu caso de soporte #{{ticket_id}} ha sido cerrado automáticamente debido a que no
recibimos respuesta de tu parte en las últimas 48 horas.

Asunto de tu caso: {{ticket_subject}}
Fecha de cierre: {{fecha_cierre}}

Si tu problema fue resuelto, nos alegra haber podido ayudarte.

Si aún necesitas asistencia, puedes escribirnos nuevamente a contacto@prontomatic.cl
y con gusto abriremos un nuevo caso para ayudarte.

Gracias por contactarnos.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl
```

### 4.5. Variables Dinámicas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `{{ticket_id}}` | Número de ticket | `142` |
| `{{ticket_subject}}` | Asunto del correo original | `Problema con máquina dispensadora piso 3` |
| `{{fecha_cierre}}` | Fecha y hora del cierre automático en formato legible, hora de Chile (America/Santiago) | `16 de marzo de 2025, 09:00` |

---

## 5. Template 4: Encuesta de Satisfacción CSAT (Post-Cierre)

### 5.1. Propósito

Medir la satisfacción del cliente con la atención recibida una vez que el caso ha sido resuelto. Se envía tanto cuando el cierre es manual (por el agente) como cuando es automático (por el sistema).

### 5.2. Trigger

Se dispara inmediatamente tras cualquier transición al estado `CERRADO`, independientemente del origen del cierre (manual por agente, manual por supervisor, o automático por inactividad).

> **Decisión pendiente (DP-01):** El destino del enlace de la encuesta no está definido aún. La opción candidata es Google Forms. Ver `alcance-funcional.md` sección 8, ítem DP-01. Este template debe actualizarse cuando se resuelva esta decisión, reemplazando el placeholder `{{url_encuesta}}` con la URL real.

### 5.3. Asunto del Correo

```
[#{{ticket_id}}] ¿Cómo fue tu experiencia con nuestro soporte?
```

**Ejemplo:** `[#142] ¿Cómo fue tu experiencia con nuestro soporte?`

### 5.4. Cuerpo del Correo (Texto Plano)

```
Hola,

Tu caso de soporte #{{ticket_id}} ha sido cerrado.

Asunto: {{ticket_subject}}

Nos importa mucho la calidad de nuestro servicio y nos gustaría conocer tu opinión
sobre la atención que recibiste.

¿Podrías tomarte un minuto para responder nuestra breve encuesta?

{{url_encuesta}}

Tu opinión nos ayuda a mejorar continuamente para ofrecerte un mejor servicio.

Gracias por confiar en Prontomatic.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl
```

### 5.5. Variables Dinámicas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `{{ticket_id}}` | Número de ticket | `142` |
| `{{ticket_subject}}` | Asunto del correo original | `Problema con máquina dispensadora piso 3` |
| `{{url_encuesta}}` | URL del formulario de encuesta CSAT | `https://forms.gle/...` *(pendiente de definición — ver DP-01)* |

---

## 6. Variables Dinámicas Disponibles

Resumen de todas las variables dinámicas disponibles para los templates, con su fuente de datos:

| Variable | Fuente | Tabla/Campo en PostgreSQL |
|---|---|---|
| `{{ticket_id}}` | Base de datos | `Ticket.id` |
| `{{ticket_subject}}` | Base de datos | `Ticket.subject` |
| `{{horas_restantes}}` | Calculado en tiempo de ejecución | `48 - (now() - Ticket.last_client_reply_at)` en horas |
| `{{fecha_cierre}}` | Base de datos | `Ticket.closed_at` (formateado a zona horaria `America/Santiago`) |
| `{{url_encuesta}}` | Variable de entorno o configuración del sistema | Pendiente de definición (DP-01) |

**Implementación en `notificationService.js`:**

Los templates se implementan como funciones que reciben un objeto con los datos del ticket y retornan el asunto y cuerpo del correo como strings, para luego ser pasados al cliente de SendGrid:

```javascript
// Ejemplo de implementación del template 1
function buildAcuseReciboEmail(ticket) {
  return {
    subject: `[#${ticket.id}] Hemos recibido tu solicitud — ${ticket.subject}`,
    text: `Hola,\n\nHemos recibido tu mensaje y hemos registrado tu solicitud...`
    // (texto completo del template)
  };
}
```

---

## 7. Consideraciones Técnicas de Envío

### 7.1. Consistencia del Hilo de Conversación

Todos los correos automáticos deben incluir los headers de hilo para que el cliente los vea dentro de la misma conversación en su cliente de correo:

```javascript
// Headers requeridos en todos los correos automáticos
headers: {
  'In-Reply-To': mensaje_original_message_id,
  'References': mensaje_original_message_id,
}
```

El `message_id_header` del mensaje original se obtiene desde el primer `Message` de tipo `CLIENTE` del ticket.

### 7.2. Remitente Fijo

Todos los correos automáticos deben enviarse con el remitente institucional, sin excepción:

```javascript
from: {
  email: 'contacto@prontomatic.cl',
  name: 'Prontomatic Soporte'
}
```

### 7.3. Zona Horaria

Las fechas y horas que aparecen en los correos (como `{{fecha_cierre}}`) deben formatearse en la zona horaria local de Chile (`America/Santiago`), no en UTC. Esto evita confusión en el cliente al mostrar horarios coherentes con su realidad local.

```javascript
// Formateo de fecha en zona horaria de Chile
const fecha = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date(ticket.closed_at));
// Resultado: "16 de marzo de 2025, 09:00"
```

### 7.4. Registro en Base de Datos

Cada correo automático enviado debe registrarse como un nuevo `Message` en la tabla correspondiente de PostgreSQL:

| Campo | Valor para correos automáticos |
|---|---|
| `sender_type` | `AGENTE` (el sistema actúa en nombre de Prontomatic) |
| `author_id` | `null` (no fue enviado por un agente individual) |
| `body` | Contenido del correo en texto plano |
| `send_status` | `ENVIADO` o `ERROR` según resultado de la llamada a SendGrid |
| `sent_at` | Timestamp del momento del envío |

### 7.5. Conversión HTML → Markdown (Librería `turndown`)

Para los correos **entrantes** del cliente, el sistema convierte el cuerpo HTML a Markdown antes de almacenarlo. La librería seleccionada es **`turndown`**.

**Justificación:** `turndown` es la librería más utilizada del ecosistema Node.js para conversión HTML→Markdown, con soporte activo, amplia configurabilidad (reglas personalizadas) y manejo correcto de estructuras HTML complejas como las que generan clientes de correo como Gmail y Outlook (tablas de firma, estilos inline, divs anidados).

**Alternativas consideradas y descartadas:**
- `node-html-markdown`: Más rápida pero menos configurable para casos edge de HTML de correo.
- `rehype-remark`: Parte del ecosistema unifiedjs, más potente pero con mayor complejidad de configuración innecesaria para este caso.

**Implementación básica en `emailService.js`:**

```javascript
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',      // Usa # para headings
  codeBlockStyle: 'fenced', // Usa ``` para bloques de código
  bulletListMarker: '-'     // Usa - para listas
});

// Regla adicional: eliminar elementos de firma de correo comunes
turndown.addRule('removeSignatureDividers', {
  filter: node => node.nodeName === 'HR',
  replacement: () => '\n---\n'
});

export function htmlToMarkdown(html) {
  if (!html) return '';
  return turndown.turndown(html);
}
```
