import { sendOutboundEmail } from './emailService';
import { prisma } from '@/lib/prisma';

// DP-01 Placeholder
const CSAT_SURVEY_URL = process.env.CSAT_SURVEY_URL || 'https://forms.gle/placeholder';

/**
 * Registra un correo automático enviado como un Message del sistema
 */
async function logAutomaticMessage(ticketId, body, sendStatus = 'ENVIADO') {
  await prisma.message.create({
    data: {
      ticket_id: ticketId,
      sender_type: 'AGENTE',
      author_id: null, // Sistema
      body,
      send_status: sendStatus
    }
  });
}

/**
 * Template 1: Acuse de Recibo
 */
export async function sendAcuseRecibo(ticket, originalMessageId = null) {
  const subject = `[#${ticket.id}] Hemos recibido tu solicitud — ${ticket.subject}`;
  const text = `Hola,

Hemos recibido tu mensaje y hemos registrado tu solicitud de soporte en nuestro sistema.

Tu número de caso es: #${ticket.id}

Uno de nuestros agentes revisará tu caso a la brevedad y se pondrá en contacto contigo
para ayudarte a resolver el problema.

Si deseas agregar más información o hacer seguimiento a tu caso, puedes responder
directamente a este correo.

Gracias por contactarnos.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl`;

  const result = await sendOutboundEmail({
    to: ticket.client_email,
    subject,
    text,
    inReplyTo: originalMessageId,
    references: originalMessageId
  });

  await logAutomaticMessage(ticket.id, text, result.success ? 'ENVIADO' : 'ERROR');
  return result;
}

/**
 * Template 2: Aviso de Cierre Próximo (24h)
 */
export async function sendAviso24h(ticket, originalMessageId = null) {
  const horasRestantes = 24; // Dado que es el aviso a las 24h de 48h total
  const subject = `[#${ticket.id}] Tu caso se cerrará pronto por falta de respuesta`;
  const text = `Hola,

Te contactamos para informarte que tu caso de soporte #${ticket.id} lleva más de
24 horas sin actividad.

Asunto de tu caso: ${ticket.subject}

Si aún necesitas ayuda o tienes información adicional que compartir, por favor
responde a este correo antes de las próximas ${horasRestantes} horas para
evitar el cierre automático de tu caso.

Si tu problema ya fue resuelto, no es necesario que respondas. Tu caso se cerrará
automáticamente.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl`;

  const result = await sendOutboundEmail({
    to: ticket.client_email,
    subject,
    text,
    inReplyTo: originalMessageId,
    references: originalMessageId
  });

  await logAutomaticMessage(ticket.id, text, result.success ? 'ENVIADO' : 'ERROR');
  return result;
}

/**
 * Template 3: Notificación de Cierre Automático (48h)
 */
export async function sendCierre48h(ticket, originalMessageId = null) {
  // Formatear en America/Santiago
  const fecha = ticket.closed_at ? new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ticket.closed_at)) : 'recientemente';

  const subject = `[#${ticket.id}] Tu caso ha sido cerrado por inactividad`;
  const text = `Hola,

Tu caso de soporte #${ticket.id} ha sido cerrado automáticamente debido a que no
recibimos respuesta de tu parte en las últimas 48 horas.

Asunto de tu caso: ${ticket.subject}
Fecha de cierre: ${fecha}

Si tu problema fue resuelto, nos alegra haber podido ayudarte.

Si aún necesitas asistencia, puedes escribirnos nuevamente a contacto@prontomatic.cl
y con gusto abriremos un nuevo caso para ayudarte.

Gracias por contactarnos.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl`;

  const result = await sendOutboundEmail({
    to: ticket.client_email,
    subject,
    text,
    inReplyTo: originalMessageId,
    references: originalMessageId
  });

  await logAutomaticMessage(ticket.id, text, result.success ? 'ENVIADO' : 'ERROR');
  return result;
}

/**
 * Template 4: Encuesta CSAT
 */
export async function sendCsat(ticket, originalMessageId = null) {
  const subject = `[#${ticket.id}] ¿Cómo fue tu experiencia con nuestro soporte?`;
  const text = `Hola,

Tu caso de soporte #${ticket.id} ha sido cerrado.

Asunto: ${ticket.subject}

Nos importa mucho la calidad de nuestro servicio y nos gustaría conocer tu opinión
sobre la atención que recibiste.

¿Podrías tomarte un minuto para responder nuestra breve encuesta?

${CSAT_SURVEY_URL}

Tu opinión nos ayuda a mejorar continuamente para ofrecerte un mejor servicio.

Gracias por confiar en Prontomatic.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl`;

  const result = await sendOutboundEmail({
    to: ticket.client_email,
    subject,
    text,
    inReplyTo: originalMessageId,
    references: originalMessageId
  });

  await logAutomaticMessage(ticket.id, text, result.success ? 'ENVIADO' : 'ERROR');
  return result;
}
