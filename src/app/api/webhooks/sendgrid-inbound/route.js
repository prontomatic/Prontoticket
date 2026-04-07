import { NextResponse } from 'next/server';
import { verifySendGridSignature } from '@/lib/sendgrid-webhook';
import { htmlToMarkdown } from '@/services/emailService';
import { createTicketFromWebhook, appendInboundMessage } from '@/services/ticketService';
import { prisma } from '@/lib/prisma';

// Función auxiliar para extraer correo de un string "Nombre <correo@df.com>"
function extractEmail(fromField) {
  const match = fromField.match(/<([^>]+)>/);
  return match ? match[1] : fromField;
}

export async function POST(request) {
  try {
    // 1. Verificación de Seguridad de SendGrid
    const publicKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
    let rawBodyBuffer;

    if (publicKey) {
      const signature = request.headers.get('x-twilio-email-event-webhook-signature');
      const timestamp = request.headers.get('x-twilio-email-event-webhook-timestamp');

      if (!signature || !timestamp) {
        console.warn('[Webhook] Petición rechazada: headers de firma ausentes.');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      rawBodyBuffer = await request.bytes();

      const isValid = verifySendGridSignature(publicKey, rawBodyBuffer, signature, timestamp);
      if (!isValid) {
        console.error('[Webhook] Firma ECDSA inválida. IP:', request.headers.get('x-forwarded-for'));
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      console.info('[Webhook] Verificación de firma omitida (key no configurada).');
      rawBodyBuffer = await request.bytes();
    }

    // 2. Parsear formData usando los bytes leídos
    const formData = await new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: rawBodyBuffer,
    }).formData();
    
    // SendGrid Inbound Parse params: https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
    const to = formData.get('to');
    const from = formData.get('from');
    const subject = formData.get('subject') || '(Sin Asunto)';
    const text = formData.get('text');
    const html = formData.get('html');
    const headersString = formData.get('headers');
    
    const clientEmail = extractEmail(from || '');
    const bodyMarkdown = html ? htmlToMarkdown(html) : text;
    
    // Extraer Message-ID y referencias
    let messageId = null;
    let inReplyTo = null;
    let ticketIdFromSubject = null;
    
    if (headersString) {
      const hdrs = headersString.toLowerCase();
      const msgIdMatch = hdrs.match(/message-id:\s*(<[^>]+>)/i);
      if (msgIdMatch) messageId = msgIdMatch[1];
      
      const inReplyToMatch = hdrs.match(/in-reply-to:\s*(<[^>]+>)/i);
      if (inReplyToMatch) inReplyTo = inReplyToMatch[1];
    }
    
    // Buscar si el subject contiene algo como [#142]
    const subjectMatch = subject.match(/\[#(\d+)\]/);
    if (subjectMatch) {
      ticketIdFromSubject = parseInt(subjectMatch[1], 10);
    }

    // Identificar si existe un ticket al que anexar
    let targetTicketId = null;
    if (ticketIdFromSubject) {
      // Validar que el ticket existe y pertenece al mismo cliente
      const existing = await prisma.ticket.findUnique({
        where: { id: ticketIdFromSubject }
      });
      // Si el ticket existe, pero está CERRADO, la regla de negocio dice que hay que crear uno NUEVO.
      if (existing && existing.client_email === clientEmail && existing.status !== 'CERRADO') {
        targetTicketId = existing.id;
      }
    }

    // Extraer adjuntos
    const attachments = [];
    const attachmentsCount = parseInt(formData.get('attachments') || '0', 10);
    for (let i = 1; i <= attachmentsCount; i++) {
        const file = formData.get(`attachment${i}`);
        if (file && file.size > 0) {
            attachments.push({
                fileName: file.name,
                storagePath: `tickets/temp/${file.name}`,
                mimeType: file.type,
                fileSize: file.size
            });
        }
    }

    const payload = {
        subject,
        body: bodyMarkdown,
        clientEmail,
        messageId,
        attachments
    };

    if (targetTicketId) {
        // Appendar a ticket existente
        await appendInboundMessage(targetTicketId, payload);
    } else {
        // Ticket Nuevo (ya sea porque no hay ref, o respondió a un CERRADO)
        await createTicketFromWebhook(payload);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}