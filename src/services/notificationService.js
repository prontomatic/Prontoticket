import { sendOutboundEmail } from './emailService';
import { prisma } from '@/lib/prisma';
import { getTemplate, replaceVariables, buildTemplateVariables } from './templateService';

/**
 * Registra un correo automático enviado como un Message del sistema
 */
async function logAutomaticMessage(ticketId, body, sendStatus = 'ENVIADO') {
  await prisma.message.create({
    data: {
      ticket_id: ticketId,
      sender_type: 'AGENTE',
      author_id: null,
      body,
      send_status: sendStatus
    }
  });
}

/**
 * Envía un correo usando una plantilla del sistema.
 * @param {string} templateKey - Clave de la plantilla (acuse_recibo, aviso_24h, cierre_48h, csat)
 * @param {Object} ticket - Objeto del ticket
 * @param {string|null} originalMessageId - Message-ID para mantener hilo de correo
 */
async function sendTemplatedEmail(templateKey, ticket, originalMessageId = null) {
  const template = await getTemplate(templateKey);
  const variables = await buildTemplateVariables(ticket);

  const subject = replaceVariables(template.subject, variables);
  const text = replaceVariables(template.body, variables);

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
 * Template 1: Acuse de Recibo
 */
export async function sendAcuseRecibo(ticket, originalMessageId = null) {
  return sendTemplatedEmail('acuse_recibo', ticket, originalMessageId);
}

/**
 * Template 2: Aviso de Cierre Próximo
 */
export async function sendAviso24h(ticket, originalMessageId = null) {
  return sendTemplatedEmail('aviso_24h', ticket, originalMessageId);
}

/**
 * Template 3: Notificación de Cierre Automático
 */
export async function sendCierre48h(ticket, originalMessageId = null) {
  return sendTemplatedEmail('cierre_48h', ticket, originalMessageId);
}

/**
 * Template 4: Encuesta CSAT
 */
export async function sendCsat(ticket, originalMessageId = null) {
  return sendTemplatedEmail('csat', ticket, originalMessageId);
}
