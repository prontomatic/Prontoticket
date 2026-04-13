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
  // Estas apuntan a imágenes inline del correo que ya vienen como adjuntos separados.
  // Ejemplos que se eliminan:
  //   ![](cid:ii_19d8779c7e7a43d0ab1)
  //   ![alt text](cid:image001.png@01D8A1B2.C3D4E5F0)
  //   [text](cid:something)
  return markdown
    .replace(/!\[[^\]]*\]\(cid:[^)]+\)/gi, '')  // Imágenes embebidas ![](cid:...)
    .replace(/\[[^\]]*\]\(cid:[^)]+\)/gi, '')   // Enlaces con cid:
    .replace(/\n{3,}/g, '\n\n')                  // Colapsar múltiples saltos de línea
    .trim();
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
