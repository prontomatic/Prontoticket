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
  return turndown.turndown(html);
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
export async function sendOutboundEmail({ to, subject, text, inReplyTo, references }) {
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

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    return { success: false, error };
  }
}
