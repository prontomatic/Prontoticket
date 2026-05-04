import { NextResponse } from 'next/server';
import { verifySendGridSignature } from '@/lib/sendgrid-webhook';
import { htmlToMarkdown, stripQuotedContent } from '@/services/emailService';
import { createTicketFromWebhook, appendInboundMessage } from '@/services/ticketService';
import { analyzeEmail, logFilteredEmail } from '@/services/spamFilterService';
import { detectAndParse } from '@/services/webFormParser';
import { prisma } from '@/lib/prisma';

// Función auxiliar para extraer correo de un string "Nombre <correo@df.com>"
function extractEmail(fromField) {
  const match = fromField.match(/<([^>]+)>/);
  return match ? match[1] : fromField;
}

// Función auxiliar para extraer el nombre del remitente si viene en el header
// Ej: '"Ricardo Vásquez" <vasquez@gmail.com>' → 'Ricardo Vásquez'
// Si no hay nombre o es igual al email, devuelve null.
function extractName(fromField) {
  if (!fromField) return null;
  const match = fromField.match(/^([^<]+)</);
  if (!match) return null;
  const name = match[1].trim().replace(/^["']|["']$/g, '').trim();
  if (!name) return null;
  // Si el "nombre" es idéntico al email, no aporta información
  const email = extractEmail(fromField).toLowerCase();
  if (name.toLowerCase() === email) return null;
  return name;
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
    const clientName = extractName(from || '');
    const bodyMarkdown = html ? htmlToMarkdown(html) : text;
    
    // Extraer Message-ID y referencias.
    // Importante: NO usar toLowerCase() sobre headersString antes de extraer,
    // porque el dominio del Message-ID es case-sensitive en algunos servidores SMTP
    // y eso puede romper el threading de Gmail/Outlook.
    // Usamos el flag `i` en el regex para matching case-insensitive del nombre del header
    // pero preservando el casing original del valor capturado.
    let messageId = null;
    let inReplyTo = null;
    let ticketIdFromSubject = null;

    if (headersString) {
      const msgIdMatch = headersString.match(/^Message-ID:\s*(<[^>]+>)/im);
      if (msgIdMatch) messageId = msgIdMatch[1];

      const inReplyToMatch = headersString.match(/^In-Reply-To:\s*(<[^>]+>)/im);
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

    // Detección de formulario web (solo para tickets nuevos).
    // Si el correo viene de un formulario web conocido, NO pasa por el filtro de spam
    // porque por definición es un correo legítimo del sistema.
    let webFormResult = { isWebForm: false };
    if (!targetTicketId) {
      webFormResult = detectAndParse({ from, subject, body: bodyMarkdown });
    }

    // Filtrado de spam / correos automáticos
    // Solo aplica para correos nuevos que NO sean respuestas a tickets existentes ni formularios web.
    // Esto evita perder respuestas legítimas de clientes cuyo asunto/firma active el filtro por error.
    if (!targetTicketId && !webFormResult.isWebForm) {
      const analysis = await analyzeEmail({
        from,
        subject,
        headersString,
        body: bodyMarkdown
      });

      if (analysis.shouldFilter) {
        console.info(`[Webhook] Correo filtrado: score=${analysis.score}, razones=${analysis.reasons.join(', ')}`);
        await logFilteredEmail({
          from,
          subject,
          body: bodyMarkdown,
          score: analysis.score,
          reasons: analysis.reasons
        });
        // Responder 200 a SendGrid para que no reintente
        return NextResponse.json({ success: true, filtered: true, score: analysis.score });
      }
    }

    // Extraer adjuntos — pasar el objeto File en crudo, la subida a Storage se hará después
    const attachments = [];
    const attachmentsCount = parseInt(formData.get('attachments') || '0', 10);
    for (let i = 1; i <= attachmentsCount; i++) {
        const file = formData.get(`attachment${i}`);
        if (file && file.size > 0) {
            attachments.push({
                file,  // File object en crudo, storageService lo subirá
                fileName: file.name,
                mimeType: file.type,
                fileSize: file.size
            });
        }
    }

    // Limpiar historial citado del cuerpo (aplica tanto a tickets nuevos como a respuestas).
    // stripQuotedContent tiene fallback anti-falsos-positivos: si el stripping deja <10 chars
    // con un body original >50 chars, devuelve el body original intacto.
    const finalBody = stripQuotedContent(bodyMarkdown);

    let payload;
    if (webFormResult.isWebForm) {
      // Formulario web: usar datos parseados del formulario.
      // Si algún campo crítico falló en la extracción, fallback al valor del header del correo.
      // (ej: si clientEmail del parser es null, queda contacto@prontomatic.cl — y la advertencia
      // visible en el body alerta al agente de que hay que completar manualmente.)
      payload = {
        subject: webFormResult.subject || subject,
        body: webFormResult.body || finalBody,
        clientEmail: webFormResult.clientEmail || clientEmail,
        clientName: webFormResult.clientName || clientName,
        clientRut: webFormResult.clientRut,
        clientPhone: webFormResult.clientPhone,
        clientAddress: webFormResult.clientAddress,
        messageId,
        attachments,
        skipLegacyLookup: true
      };
    } else {
      payload = {
          subject,
          body: finalBody,
          clientEmail,
          clientName,
          messageId,
          attachments
      };
    }

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