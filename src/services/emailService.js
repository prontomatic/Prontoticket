import TurndownService from 'turndown';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

turndown.addRule('removeSignatureDividers', {
  filter: node => node.nodeName === 'HR',
  replacement: () => '\n---\n'
});

export function htmlToMarkdown(html) {
  if (!html) return '';
  const markdown = turndown.turndown(html);

  // Limpiar referencias a imágenes embebidas por Content-ID (cid:...)
  return markdown
    .replace(/!\[[^\]]*\]\(cid:[^)]+\)/gi, '')  // Imágenes embebidas ![](cid:...)
    .replace(/\[[^\]]*\]\(cid:[^)]+\)/gi, '')   // Enlaces con cid:
    .replace(/\n{3,}/g, '\n\n')                  // Colapsar múltiples saltos de línea
    .trim();
}

/**
 * Elimina el historial citado de un cuerpo de correo.
 *
 * Detecta y corta todo el contenido a partir de donde empieza la cita
 * del mensaje anterior. Funciona para los patrones más comunes de Gmail,
 * Outlook, Apple Mail y otros clientes de correo.
 *
 * Estrategia: buscar marcadores típicos de "respuesta citada" y cortar
 * el texto justo antes del primero que aparezca.
 *
 * @param {string} body - Cuerpo del mensaje en markdown/texto plano
 * @returns {string} Cuerpo limpio solo con la parte nueva del mensaje
 */
export function stripQuotedContent(body) {
  if (!body) return '';

  // Patrones que marcan el inicio del contenido citado.
  // Cada uno busca el inicio de una línea que coincida.
  const quoteMarkers = [
    // "El [día/fecha], [persona] escribió:" (español, Gmail/Outlook)
    /^El\s+.{1,80}escribió:\s*$/im,
    /^El\s+\d{1,2}\/\d{1,2}\/\d{2,4}.{1,80}escribió:\s*$/im,

    // "On [date], [person] wrote:" (inglés)
    /^On\s+.{1,80}wrote:\s*$/im,
    /^On\s+\d{1,2}\/\d{1,2}\/\d{2,4}.{1,80}wrote:\s*$/im,

    // "El [fecha] a las [hora], [persona] <email> escribió:"
    /^El\s+.{1,100}<[^>]+>\s*escribió:\s*$/im,

    // Separadores clásicos
    /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
    /^-{2,}\s*Mensaje Original\s*-{2,}\s*$/im,
    /^-{2,}\s*Forwarded Message\s*-{2,}\s*$/im,
    /^-{2,}\s*Mensaje Reenviado\s*-{2,}\s*$/im,

    // Bloques de headers de Outlook en correos reenviados
    /^From:\s*.+\nSent:\s*.+\nTo:\s*.+$/im,
    /^De:\s*.+\nEnviado:\s*.+\nPara:\s*.+$/im,

    // "> " al inicio de líneas consecutivas (cita de texto plano estilo Unix)
    // Detectamos cuando hay 2+ líneas seguidas empezando con ">"
    /^>.*\n>.*$/im,
  ];

  let cutIndex = body.length;

  for (const marker of quoteMarkers) {
    const match = body.match(marker);
    if (match && match.index !== undefined) {
      // Tomar el corte más temprano (lo primero que aparece es lo que inicia la cita)
      if (match.index < cutIndex) {
        cutIndex = match.index;
      }
    }
  }

  // Cortar el body en el punto detectado
  let cleaned = body.substring(0, cutIndex).trim();

  // Limpiar líneas que quedaron colgadas al final (saludos del cliente, firmas)
  // No removemos esto agresivamente — solo colapsamos saltos múltiples
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  // Caso especial: si después del stripping queda muy poco texto,
  // es probable que hayamos cortado mal. En ese caso, devolver el body original.
  if (cleaned.length < 10 && body.length > 50) {
    return body;
  }

  return cleaned;
}

/**
 * Envía un correo electrónico a través de SendGrid Mail Send API.
 * 
 * @param {Object} params
 * @param {string} params.to - Correo del destinatario (cliente)
 * @param {string} params.subject - Asunto del correo
 * @param {string} params.text - Cuerpo principal del correo (texto plano)
 * @param {string} [params.inReplyTo] - Message-ID original para mantener hilo
 * @param {string} [params.references] - Referencias para mantener hilo
 */
export async function sendOutboundEmail({ to, subject, text, inReplyTo, references, attachments }) {
  const msg = {
    to,
    from: {
      email: 'contacto@prontomatic.cl',
      name: 'Prontomatic Soporte'
    },
    subject,
    text,
    headers: {}
  };

  if (inReplyTo) {
    msg.headers['In-Reply-To'] = inReplyTo;
  }
  if (references) {
    msg.headers['References'] = references;
  }

  // Adjuntos en formato SendGrid:
  // Cada adjunto debe tener: { content (base64), filename, type, disposition }
  if (attachments && attachments.length > 0) {
    msg.attachments = attachments.map(att => ({
      content: att.content,
      filename: att.filename,
      type: att.type || 'application/octet-stream',
      disposition: 'attachment'
    }));
  }

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    return { success: false, error };
  }
}
