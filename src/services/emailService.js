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

  // Pre-limpieza del HTML ANTES de Turndown:
  // 1. Eliminar comentarios HTML (incluye bloques CSS gigantes de Outlook/Word)
  //    Ej: <!-- /* Font Definitions */ @font-face {...} /* Style Definitions */ ... -->
  // 2. Eliminar tags <style> y su contenido (Outlook a veces los mete fuera de comentarios)
  // 3. Eliminar tags <o:p> de Office (párrafos vacíos de Word)
  let cleanHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '');

  const markdown = turndown.turndown(cleanHtml);

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
 * Notas técnicas:
 * - El límite de caracteres en los patrones está calibrado a 300 para soportar
 *   los enlaces de tipo [email](mailto:email) que Turndown genera al convertir
 *   correos HTML a Markdown, sin permitir matches arbitrariamente largos
 *   que puedan generar falsos positivos.
 * - Para citas de texto plano (líneas con ">"), exigimos al menos 2 líneas
 *   consecutivas para evitar cortar mensajes legítimos del cliente que usen
 *   ">" como separador o destacado puntual.
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
    // Acotamos a 300 caracteres por línea (suficiente para enlaces mailto largos)
    /^El\s+.{1,300}escribió:\s*$/im,

    // "On [date], [person] wrote:" (inglés, Gmail/Outlook)
    /^On\s+.{1,300}wrote:\s*$/im,

    // "El [fecha], [persona] <email> escribió:" — formato más específico con email
    /^El\s+.{1,300}<.{1,200}>\s*escribió:\s*$/im,

    // "On [date], [person] <email> wrote:" — variante en inglés con email
    /^On\s+.{1,300}<.{1,200}>\s*wrote:\s*$/im,

    // Separadores clásicos de "Original Message"
    /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
    /^-{2,}\s*Mensaje Original\s*-{2,}\s*$/im,
    /^-{2,}\s*Forwarded Message\s*-{2,}\s*$/im,
    /^-{2,}\s*Mensaje Reenviado\s*-{2,}\s*$/im,

    // Bloques de headers de Outlook en correos reenviados/respondidos
    /^From:\s*.+\nSent:\s*.+\nTo:\s*.+$/im,
    /^De:\s*.+\nEnviado:\s*.+\nPara:\s*.+$/im,

    // Citas de texto plano estilo Unix: requiere AL MENOS 2 líneas consecutivas con ">"
    // para evitar cortar mensajes legítimos donde el cliente use ">" puntualmente.
    /^>.*\n>.*$/m,
  ];

  let cutIndex = body.length;
  let matchedPattern = null;

  for (const marker of quoteMarkers) {
    const match = body.match(marker);
    if (match && match.index !== undefined) {
      // Tomar el corte más temprano (lo primero que aparece es lo que inicia la cita)
      if (match.index < cutIndex) {
        cutIndex = match.index;
        matchedPattern = marker.source;
      }
    }
  }

  // Cortar el body en el punto detectado
  let cleaned = body.substring(0, cutIndex).trim();

  // Colapsar múltiples saltos de línea
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  // Protección anti-falsos-positivos:
  // Si después del stripping queda un texto extremadamente corto pero el
  // body original era largo, es probable que hayamos cortado mal.
  // En ese caso, devolver el body original.
  if (cleaned.length < 10 && body.length > 50) {
    console.warn('[stripQuotedContent] Stripping descartado: resultado demasiado corto. Body original conservado.');
    return body;
  }

  if (matchedPattern) {
    console.info(`[stripQuotedContent] Cita detectada con patrón: ${matchedPattern}`);
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