import { sendOutboundEmail } from './emailService';
import { prisma } from '@/lib/prisma';
import { getTemplate, replaceVariables, buildTemplateVariables } from './templateService';
import { getConfig } from './configService';

/**
 * Verifica si un envío automático está habilitado en la configuración del sistema.
 * @param {string} configKey - Clave de la configuración (ej: 'auto_send_acuse_recibo')
 * @returns {Promise<boolean>}
 */
async function isAutoSendEnabled(configKey) {
  const value = await getConfig(configKey);
  // Si no existe la config, asumimos habilitado por defecto (comportamiento actual)
  if (value === null || value === undefined) return true;
  return String(value).toLowerCase() === 'true';
}

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
 * Busca el Message-ID del primer mensaje del cliente del ticket.
 * Este Message-ID es el que se usa como In-Reply-To/References en todos los
 * correos automáticos para que Gmail/Outlook los agrupen en el mismo hilo
 * que el correo original del cliente.
 *
 * @param {number} ticketId
 * @returns {Promise<string|null>} Message-ID con formato <...@...> o null si no se encontró.
 */
async function findOriginalMessageId(ticketId) {
  const firstMessage = await prisma.message.findFirst({
    where: {
      ticket_id: ticketId,
      sender_type: 'CLIENTE'
    },
    orderBy: { sent_at: 'asc' },
    select: { message_id_header: true }
  });
  return firstMessage?.message_id_header || null;
}

/**
 * Envía un correo usando una plantilla del sistema.
 *
 * Si no se proporciona originalMessageId, lo busca desde el primer mensaje del
 * cliente del ticket. Esto garantiza que el correo se enlace al hilo original
 * incluso si el llamador no se acuerda de pasarlo.
 *
 * @param {string} templateKey - Clave de la plantilla (acuse_recibo, aviso_24h, cierre_48h, csat)
 * @param {Object} ticket - Objeto del ticket
 * @param {string|null} originalMessageId - Si se pasa explícitamente, se usa ese.
 *                                          Si no, se busca el del primer mensaje del ticket.
 */
async function sendTemplatedEmail(templateKey, ticket, originalMessageId = null) {
  const template = await getTemplate(templateKey);
  const variables = await buildTemplateVariables(ticket);

  const subject = replaceVariables(template.subject, variables);
  const text = replaceVariables(template.body, variables);

  // Si no nos pasaron el messageId explícitamente, lo buscamos.
  // Caso típico: sendAcuseRecibo lo pasa explícito (lo tiene a mano del webhook),
  // sendCsat / sendAviso24h / sendCierre48h no lo pasan y necesitamos buscarlo.
  const threadMessageId = originalMessageId || await findOriginalMessageId(ticket.id);

  const result = await sendOutboundEmail({
    to: ticket.client_email,
    subject,
    text,
    inReplyTo: threadMessageId,
    references: threadMessageId
  });

  await logAutomaticMessage(ticket.id, text, result.success ? 'ENVIADO' : 'ERROR');
  return result;
}

/**
 * Template 1: Acuse de Recibo
 */
export async function sendAcuseRecibo(ticket, originalMessageId = null) {
  if (!(await isAutoSendEnabled('auto_send_acuse_recibo'))) {
    console.info(`[Notifications] Acuse de recibo desactivado. Ticket #${ticket.id} no recibirá correo.`);
    return { skipped: true };
  }
  return sendTemplatedEmail('acuse_recibo', ticket, originalMessageId);
}

/**
 * Template 2: Aviso de Cierre Próximo
 */
export async function sendAviso24h(ticket, originalMessageId = null) {
  if (!(await isAutoSendEnabled('auto_send_aviso_cortesia'))) {
    console.info(`[Notifications] Aviso de cortesía desactivado. Ticket #${ticket.id} no recibirá correo.`);
    return { skipped: true };
  }
  return sendTemplatedEmail('aviso_24h', ticket, originalMessageId);
}

/**
 * Template 3: Notificación de Cierre Automático
 */
export async function sendCierre48h(ticket, originalMessageId = null) {
  if (!(await isAutoSendEnabled('auto_send_cierre_automatico'))) {
    console.info(`[Notifications] Cierre automático desactivado. Ticket #${ticket.id} no recibirá correo.`);
    return { skipped: true };
  }
  return sendTemplatedEmail('cierre_48h', ticket, originalMessageId);
}

/**
 * Template 4: Encuesta CSAT
 */
export async function sendCsat(ticket, originalMessageId = null) {
  if (!(await isAutoSendEnabled('auto_send_csat'))) {
    console.info(`[Notifications] Encuesta CSAT desactivada. Ticket #${ticket.id} no recibirá correo.`);
    return { skipped: true };
  }
  return sendTemplatedEmail('csat', ticket, originalMessageId);
}
