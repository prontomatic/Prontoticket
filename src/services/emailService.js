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
  // Los correos de Outlook/Word traen bloques CSS enormes dentro de comentarios HTML
  // y conditional comments. Turndown no los elimina y terminan como texto visible.
  let cleanHtml = html
    // 1. Conditional comments de Outlook: <!--[if ...]>...<![endif]-->
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    // 2. Comentarios HTML normales Y malformados (cierre --> o -> o --->)
    .replace(/<!--[\s\S]*?-{1,2}>/g, '')
    // 3. Tags <style> y su contenido
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // 4. Tags de Office: <o:p>, <o:OfficeDocumentSettings>, etc.
    .replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, '')
    .replace(/<o:[^>]*\/>/gi, '')
    // 5. Atributos MSO en tags restantes (no elimina el tag, solo los atributos mso-*)
    .replace(/\s*mso-[^;"]*;?/gi, '')
    // 6. Tags <meta> de Word
    .replace(/<meta[^>]*name="?Generator"?[^>]*>/gi, '');

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
    // - hasta 500 chars para tolerar enlaces [email](mailto:email) largos
    // - `escrib.{1,2}:` tolera "escribió" correcto o con encoding corrupto (Ã³)
    // - sin anchor $ para tolerar contenido residual al final de línea
    /^El\s+.{1,500}?escrib.{1,2}:/im,

    // "On [date], [person] wrote:" (inglés, Gmail/Outlook)
    /^On\s+.{1,500}?wrote:/im,

    // Separadores clásicos de "Original Message" (tolerante a espacios)
    /^-{2,}\s*Original\s+Message\s*-{2,}/im,
    /^-{2,}\s*Mensaje\s+Original\s*-{2,}/im,
    /^-{2,}\s*Forwarded\s+Message\s*-{2,}/im,
    /^-{2,}\s*Mensaje\s+Reenviado\s*-{2,}/im,

    // Bloques de headers de Outlook en correos reenviados/respondidos.
    // Soporta "Enviado:" y "Enviado el:" (variante clásica de Outlook).
    /^From:\s*.+\n(?:Sent|Enviado)(?:\s+el)?:\s*.+\nTo:\s*.+/im,
    /^De:\s*.+\n(?:Enviado(?:\s+el)?|Sent):\s*.+\nPara:\s*.+/im,

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