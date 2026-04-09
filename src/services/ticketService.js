import { prisma } from '@/lib/prisma';
import { fetchLegacyCustomerData } from './integrationService';
import { sendAcuseRecibo, sendCsat } from './notificationService';

/**
 * Crea un registro en el historial de estados (StatusHistory) y actualiza fechas
 */
async function transitionTicketStatus(tx, ticketId, oldStatus, newStatus, changedBy = null, isSystem = false) {
  await tx.statusHistory.create({
    data: {
      ticket_id: ticketId,
      previous_status: oldStatus,
      new_status: newStatus,
      changed_by: changedBy,
      is_system_action: isSystem
    }
  });

  const updateData = { status: newStatus };
  if (newStatus === 'CERRADO') {
    updateData.closed_at = new Date();
  }

  return await tx.ticket.update({
    where: { id: ticketId },
    data: updateData
  });
}

/**
 * Procesa un nuevo ticket entrante.
 * @param {Object} data - Datos parseados del webhook
 */
export async function createTicketFromWebhook(data) {
  // Deduplicación por Message-ID
  if (data.messageId) {
    const existingMessage = await prisma.message.findUnique({
      where: { message_id_header: data.messageId }
    });
    if (existingMessage) {
      return { duplicate: true, ticket: null };
    }
  }

  // Enriquecer datos con DB Legacy MySQL
  const legacyData = await fetchLegacyCustomerData(data.clientEmail);
  
  let enrichmentNote = null;
  let client_rut = null;
  let client_phone = null;
  let client_address = null;

  if (legacyData && legacyData.error) {
    enrichmentNote = "Error al consultar base de datos de clientes. Datos de contacto no disponibles.";
  } else if (!legacyData) {
    enrichmentNote = "Cliente no encontrado en la base de datos. RUT, Teléfono y Dirección no disponibles.";
  } else {
    // legacyData returned successfully
    client_rut = legacyData.rut;
    client_phone = legacyData.phone;
    client_address = legacyData.address;
    
    // Si algún campo quedó vacío
    let missing = [];
    if (!client_rut) missing.push("RUT");
    if (!client_phone) missing.push("Teléfono");
    if (!client_address) missing.push("Dirección");
    
    if (missing.length > 0) {
      enrichmentNote = `Cliente encontrado, pero no se encontraron los siguientes campos: ${missing.join(', ')}.`;
    }
  }

  // Ejecutar en transacción para atomicidad
  const ticket = await prisma.$transaction(async (tx) => {
    // 1. Crear el ticket
    const newTicket = await tx.ticket.create({
      data: {
        subject: data.subject,
        content: data.body, // Convertido a Markdown
        status: 'ABIERTO',
        client_email: data.clientEmail,
        client_rut,
        client_phone,
        client_address,
        enrichment_note: enrichmentNote,
        last_client_reply_at: new Date()
      }
    });

    // 2. Crear mensaje inicial
    const newMessage = await tx.message.create({
      data: {
        ticket_id: newTicket.id,
        sender_type: 'CLIENTE',
        body: data.body,
        message_id_header: data.messageId,
        send_status: 'ENVIADO'
      }
    });

    // 3. Crear adjuntos
    if (data.attachments && data.attachments.length > 0) {
      for (const att of data.attachments) {
        await tx.attachment.create({
          data: {
            message_id: newMessage.id,
            file_name: att.fileName,
            storage_path: att.storagePath,
            mime_type: att.mimeType,
            file_size: att.fileSize
          }
        });
      }
    }

    // 4. Crear StateHistory inicial
    await tx.statusHistory.create({
      data: {
        ticket_id: newTicket.id,
        previous_status: null,
        new_status: 'ABIERTO',
        changed_by: null,
        is_system_action: true
      }
    });

    return newTicket;
  });

  // 5. Disparar Acuse de Recibo en bg (fuera de la transacción)
  try {
    await sendAcuseRecibo(ticket, data.messageId);
  } catch (error) {
    console.error('Failed to send Acuse Recibo', error);
  }

  return { duplicate: false, ticket };
}

/**
 * Agrega un mensaje inbound a un hilo existente (cliente responde)
 */
export async function appendInboundMessage(ticketId, data) {
  // Deduplicación
  if (data.messageId) {
    const existingMessage = await prisma.message.findUnique({
      where: { message_id_header: data.messageId }
    });
    if (existingMessage) return { duplicate: true };
  }

  const result = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    const newMessage = await tx.message.create({
      data: {
        ticket_id: ticket.id,
        sender_type: 'CLIENTE',
        body: data.body,
        message_id_header: data.messageId,
        send_status: 'ENVIADO'
      }
    });

    if (data.attachments && data.attachments.length > 0) {
      for (const att of data.attachments) {
        await tx.attachment.create({
          data: {
            message_id: newMessage.id,
            file_name: att.fileName,
            storage_path: att.storagePath,
            mime_type: att.mimeType,
            file_size: att.fileSize
          }
        });
      }
    }

    // Actualizar last_client_reply_at y mover estado a EN_PROCESO_INTERNO si está EN_ESPERA_CLIENTE
    let newStatus = ticket.status;
    let oldStatus = ticket.status;
    
    if (ticket.status === 'EN_ESPERA_CLIENTE') {
      newStatus = 'EN_PROCESO_INTERNO';
      await tx.statusHistory.create({
        data: {
          ticket_id: ticket.id,
          previous_status: oldStatus,
          new_status: newStatus,
          is_system_action: true
        }
      });
    }

    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        last_client_reply_at: new Date(),
        status: newStatus
      }
    });

    return newMessage;
  });

  return { duplicate: false, message: result };
}

/**
 * Añade una respuesta enviada por un agente. (Asume que el correo ya fue enviado por emailService)
 */
export async function appendOutboundMessage(ticketId, agentId, body, messageIdHeader, sendStatus, originalTicketStatus, newTicketStatus) {
  return await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        ticket_id: ticketId,
        sender_type: 'AGENTE',
        author_id: agentId,
        body,
        message_id_header: messageIdHeader,
        send_status: sendStatus
      }
    });

    let updatedTicket = null;
    if (newTicketStatus && newTicketStatus !== originalTicketStatus) {
      updatedTicket = await transitionTicketStatus(tx, ticketId, originalTicketStatus, newTicketStatus, agentId, false);
    }
    
    // Si no cambiamos el estado, de todas formas actualizamos updated_at
    if (!updatedTicket) {
      updatedTicket = await tx.ticket.update({
        where: { id: ticketId },
        data: { updated_at: new Date() }
      });
    }

    return { message, updatedTicket };
  });
}
