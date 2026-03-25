# Definición Técnica del Sistema de Ticketera

Este documento describe la arquitectura lógica y los procesos técnicos del sistema de gestión de tickets de Prontomatic. El sistema opera a través del correo de contacto de la empresa mediante un servicio de webhook, en este caso sendgrid, que se encarga de recibir los correos y enviarlos al sistema.

---

## 1. Stack Tecnológico

El desarrollo se basa en un ecosistema de JavaScript moderno diseñado para la escalabilidad y el rendimiento:

- **Frontend & API:** Next.js (App Router)
- **Backend Runtime:** Node.js
- **Base de Datos:** PostgreSQL alojado en Supabase
- **ORM:** Prisma para el modelado y consulta de datos

---

## 2. Flujo de Ingesta y Normalización

El proceso se activa al recibir un correo electrónico en la casilla de contacto de la empresa.

### 2.1. Captura y Limpieza

- **Validación de Entrada:** Se descartan correos inválidos o identificados como spam en el primer nodo.
- **Normalización:** El motor de procesamiento captura el Asunto, Cuerpo, Remitente y Adjuntos. Se realiza una conversión de HTML a Markdown o texto plano para facilitar la lectura, el análisis y el almacenamiento del contenido.

### 2.2. Enriquecimiento de Datos mediante Prisma

Al identificar un nuevo remitente, el sistema utiliza Prisma para realizar una consulta en la base de datos de clientes.

- **Datos Requeridos:** El sistema busca obtener el RUT, Teléfono y Dirección del cliente.
- **Manejo de Datos Faltantes:** Si alguno de estos campos no se encuentra en la base de datos, el sistema simplemente insertará un mensaje informativo directamente en el cuerpo del ticket (ej: `"Teléfono no encontrado"`, `"Dirección no encontrada"`) para conocimiento del agente.

---

## 3. Gestión de Tickets y Asignación

El sistema rompe con el modelo de asignación dirigida para optimizar la carga de trabajo.

### 3.1. Dashboard Centralizado

- **Visibilidad:** Una vez creado, el ticket aparece en un panel de control global visible para todos los agentes.
- **Método de Toma:** No existe una regla de asignación automática a un individuo. Los agentes de turno son responsables de revisar el dashboard y tomar los tickets de forma manual según disponibilidad y prioridad.

---

## 4. Lógica de Contacto y Seguimiento

El agente inicia el diagnóstico basándose en la información recolectada.

### 4.1. Protocolo de Comunicación

- **Prioridad Telefónica:** Si existe un teléfono asociado, el agente realiza un único intento de llamada. Si el cliente contesta, se procede a la resolución directa; de lo contrario, la gestión continúa exclusivamente por el hilo de comunicación del ticket.
- **Solicitud de Información:** Si no hay datos de contacto, el agente envía una solicitud desde la plataforma.

### 4.2. Regla de Cierre por Inactividad (> 48h)

- Si un ticket permanece en estado `"Pendiente de respuesta del cliente"` por más de 48 horas, el sistema activará el protocolo de cierre.
- **Notificación Previa:** Antes del cierre automático, el sistema enviará un correo electrónico de notificación al cliente informando que su ticket será finalizado por falta de respuesta.

---

## 5. Finalización y Calidad

### 5.1. Cierre Automático y Feedback

- **Estado Cerrado:** Una vez que el agente o el sistema marcan el ticket como `"Cerrado"`, se detiene el contador de SLA.
- **Encuesta de Satisfacción:** Tras el cierre, el sistema dispara de forma automática un correo electrónico al cliente con una encuesta de satisfacción para evaluar la calidad de la atención recibida.