import { prisma } from '@/lib/prisma';

// Umbral de puntuación a partir del cual un correo se considera spam/automático
const SPAM_THRESHOLD = 70;

// Dominios conocidos de envío masivo/marketing
const MASS_MAIL_DOMAINS = [
  'sendgrid.net',
  'mailchimp.com',
  'mailgun.org',
  'amazonses.com',
  'sparkpostmail.com',
  'mandrillapp.com',
  'postmarkapp.com',
  'sendinblue.com',
  'mailjet.com',
  'smtpserver.cl',
  'smtpservice.cl',
];

// Subdominios que delatan correos automatizados
const SUSPICIOUS_SUBDOMAINS = [
  'notificaciones.',
  'notification.',
  'notifications.',
  'mailing.',
  'newsletter.',
  'news.',
  'mktg.',
  'marketing.',
  'campaigns.',
  'campaign.',
  'noticias.',
  'emailmkt.',
  'email.mail.',
  'mail.email.',
  'bulk.',
  'mass.',
];

// Remitentes típicos de sistemas automáticos
const AUTOMATED_FROM_PATTERNS = [
  'mailer-daemon',
  'postmaster',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'notifications@',
  'notification@',
  'automatico@',
  'automated@',
  'system@',
  'daemon@',
];

// Palabras clave de marketing en el asunto (suman pero no deciden solas)
const MARKETING_KEYWORDS = [
  'cupos limitados',
  'oferta',
  'promoción',
  'promocion',
  'descuento',
  'webinar',
  'reserva tu cupo',
  'inscríbete',
  'inscribete',
  'últimos cupos',
  'ultimos cupos',
  'nueva capacitación',
  'nueva capacitacion',
  'capacítate',
  'capacitate',
  'curso gratis',
  'curso gratuito',
  'newsletter',
  'boletín',
  'boletin',
];

// Asuntos típicos de respuestas automáticas y bounces
const AUTO_SUBJECT_PATTERNS = [
  { pattern: /^auto:/i, score: 90 },
  { pattern: /out of office/i, score: 90 },
  { pattern: /fuera de (la )?oficina/i, score: 90 },
  { pattern: /automatic reply/i, score: 90 },
  { pattern: /respuesta automática/i, score: 90 },
  { pattern: /undelivered mail returned/i, score: 100 },
  { pattern: /delivery status notification/i, score: 100 },
  { pattern: /mail delivery failed/i, score: 100 },
  { pattern: /undeliverable/i, score: 100 },
  { pattern: /mensaje no entregado/i, score: 100 },
];

/**
 * Extrae el email del campo "from" (formato "Nombre <email@dominio.com>" o "email@dominio.com")
 */
function extractEmail(fromField) {
  if (!fromField) return '';
  const match = fromField.match(/<([^>]+)>/);
  return (match ? match[1] : fromField).toLowerCase().trim();
}

/**
 * Extrae el nombre del campo "from" si existe
 */
function extractName(fromField) {
  if (!fromField) return null;
  const match = fromField.match(/^([^<]+)</);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

/**
 * Busca un header específico dentro del string de headers del correo.
 * @param {string} headersString - String completo de headers
 * @param {string} headerName - Nombre del header a buscar
 * @returns {string|null} Valor del header o null
 */
function getHeader(headersString, headerName) {
  if (!headersString) return null;
  const regex = new RegExp(`^${headerName}:\\s*(.+)$`, 'im');
  const match = headersString.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Evalúa un correo entrante y devuelve un análisis con su puntuación y motivos.
 * @param {Object} emailData - { from, subject, headersString, body }
 * @returns {Object} { score, reasons, shouldFilter }
 */
export function analyzeEmail(emailData) {
  const { from, subject, headersString, body } = emailData;
  const fromEmail = extractEmail(from);
  const fromDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : '';
  const subjectLower = (subject || '').toLowerCase();

  let score = 0;
  const reasons = [];

  // 1. Headers muy confiables (100 puntos cada uno)
  const autoSubmitted = getHeader(headersString, 'Auto-Submitted');
  if (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') {
    score += 100;
    reasons.push(`Header Auto-Submitted: ${autoSubmitted}`);
  }

  const xAutoreply = getHeader(headersString, 'X-Autoreply');
  if (xAutoreply && xAutoreply.toLowerCase() === 'yes') {
    score += 100;
    reasons.push('Header X-Autoreply: yes');
  }

  const xAutoRespond = getHeader(headersString, 'X-Autorespond');
  if (xAutoRespond) {
    score += 100;
    reasons.push('Header X-Autorespond presente');
  }

  const precedence = getHeader(headersString, 'Precedence');
  if (precedence && ['bulk', 'junk', 'list'].includes(precedence.toLowerCase())) {
    score += 100;
    reasons.push(`Header Precedence: ${precedence}`);
  }

  const returnPath = getHeader(headersString, 'Return-Path');
  if (returnPath === '<>' || returnPath === '') {
    score += 100;
    reasons.push('Return-Path vacío (típico de bounces)');
  }

  const xAutoSuppress = getHeader(headersString, 'X-Auto-Response-Suppress');
  if (xAutoSuppress) {
    score += 90;
    reasons.push('Header X-Auto-Response-Suppress presente');
  }

  // 2. List-Unsubscribe (newsletter/marketing) — 80 puntos
  const listUnsubscribe = getHeader(headersString, 'List-Unsubscribe');
  if (listUnsubscribe) {
    score += 80;
    reasons.push('Header List-Unsubscribe presente (newsletter/marketing)');
  }

  // 3. Remitente automático (100 puntos)
  for (const pattern of AUTOMATED_FROM_PATTERNS) {
    if (fromEmail.includes(pattern)) {
      score += 100;
      reasons.push(`Remitente automático: contiene "${pattern}"`);
      break; // Solo contar una vez
    }
  }

  // 4. Dominio de envío masivo conocido (70 puntos)
  for (const domain of MASS_MAIL_DOMAINS) {
    if (fromDomain === domain || fromDomain.endsWith('.' + domain)) {
      score += 70;
      reasons.push(`Dominio de envío masivo: ${domain}`);
      break;
    }
  }

  // 5. Subdominio sospechoso (60 puntos)
  for (const subdomain of SUSPICIOUS_SUBDOMAINS) {
    if (fromDomain.startsWith(subdomain)) {
      score += 60;
      reasons.push(`Subdominio sospechoso: ${subdomain}`);
      break;
    }
  }

  // 6. Asuntos típicos de auto-respuesta/bounce
  for (const { pattern, score: patternScore } of AUTO_SUBJECT_PATTERNS) {
    if (pattern.test(subjectLower)) {
      score += patternScore;
      reasons.push(`Asunto automático detectado`);
      break;
    }
  }

  // 7. Palabras clave de marketing (30 puntos cada una, máximo 60 puntos sumados por este factor)
  let marketingScore = 0;
  const matchedKeywords = [];
  for (const keyword of MARKETING_KEYWORDS) {
    if (subjectLower.includes(keyword)) {
      marketingScore += 30;
      matchedKeywords.push(keyword);
      if (marketingScore >= 60) break; // Tope para no sobre-contar
    }
  }
  if (marketingScore > 0) {
    score += marketingScore;
    reasons.push(`Palabras clave de marketing en asunto: ${matchedKeywords.join(', ')}`);
  }

  return {
    score,
    reasons,
    shouldFilter: score >= SPAM_THRESHOLD,
    threshold: SPAM_THRESHOLD
  };
}

/**
 * Registra un correo filtrado en la tabla FilteredEmail para auditoría.
 */
export async function logFilteredEmail({ from, subject, body, score, reasons }) {
  const fromEmail = extractEmail(from);
  const fromName = extractName(from);
  const bodyPreview = (body || '').substring(0, 500);
  const reasonsString = reasons.join(' | ');

  try {
    await prisma.filteredEmail.create({
      data: {
        from_email: fromEmail,
        from_name: fromName,
        subject: subject || '(Sin Asunto)',
        body_preview: bodyPreview,
        score,
        reasons: reasonsString
      }
    });
    console.info(`[SpamFilter] Correo filtrado de ${fromEmail} (score: ${score})`);
  } catch (error) {
    console.error('[SpamFilter] Error registrando correo filtrado:', error);
  }
}
