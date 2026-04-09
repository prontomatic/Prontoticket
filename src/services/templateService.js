import { prisma } from '@/lib/prisma';
import { getConfig, getConfigNumber } from './configService';

// Plantillas por defecto. Si una clave no existe en la BD, se usa la de aquí.
// Variables disponibles: {{ticket_id}}, {{ticket_subject}}, {{client_email}},
// {{fecha_cierre}}, {{horas_restantes}}, {{csat_url}}
const DEFAULT_TEMPLATES = {
  'acuse_recibo': {
    description: 'Se envía automáticamente cuando un cliente crea un nuevo ticket por correo.',
    subject: '[#{{ticket_id}}] Hemos recibido tu solicitud — {{ticket_subject}}',
    body: `Hola,

Hemos recibido tu mensaje y hemos registrado tu solicitud de soporte en nuestro sistema.

Tu número de caso es: #{{ticket_id}}

Uno de nuestros agentes revisará tu caso a la brevedad y se pondrá en contacto contigo
para ayudarte a resolver el problema.

Si deseas agregar más información o hacer seguimiento a tu caso, puedes responder
directamente a este correo.

Gracias por contactarnos.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl`
  },
  'aviso_24h': {
    description: 'Se envía cuando un ticket en espera del cliente alcanza el umbral de aviso de cortesía.',
    subject: '[#{{ticket_id}}] Tu caso se cerrará pronto por falta de respuesta',
    body: `Hola,

Te contactamos para informarte que tu caso de soporte #{{ticket_id}} lleva más de
{{horas_restantes}} horas sin actividad.

Asunto de tu caso: {{ticket_subject}}

Si aún necesitas ayuda o tienes información adicional que compartir, por favor
responde a este correo antes de las próximas {{horas_restantes}} horas para
evitar el cierre automático de tu caso.

Si tu problema ya fue resuelto, no es necesario que respondas. Tu caso se cerrará
automáticamente.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl`
  },
  'cierre_48h': {
    description: 'Se envía cuando un ticket se cierra automáticamente por inactividad del cliente.',
    subject: '[#{{ticket_id}}] Tu caso ha sido cerrado por inactividad',
    body: `Hola,

Tu caso de soporte #{{ticket_id}} ha sido cerrado automáticamente debido a que no
recibimos respuesta de tu parte.

Asunto de tu caso: {{ticket_subject}}
Fecha de cierre: {{fecha_cierre}}

Si tu problema fue resuelto, nos alegra haber podido ayudarte.

Si aún necesitas asistencia, puedes escribirnos nuevamente a contacto@prontomatic.cl
y con gusto abriremos un nuevo caso para ayudarte.

Gracias por contactarnos.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl`
  },
  'csat': {
    description: 'Se envía después de cerrar un ticket para solicitar al cliente una encuesta de satisfacción.',
    subject: '[#{{ticket_id}}] ¿Cómo fue tu experiencia con nuestro soporte?',
    body: `Hola,

Tu caso de soporte #{{ticket_id}} ha sido cerrado.

Asunto: {{ticket_subject}}

Nos importa mucho la calidad de nuestro servicio y nos gustaría conocer tu opinión
sobre la atención que recibiste.

¿Podrías tomarte un minuto para responder nuestra breve encuesta?

{{csat_url}}

Tu opinión nos ayuda a mejorar continuamente para ofrecerte un mejor servicio.

Gracias por confiar en Prontomatic.

Equipo de Soporte
Prontomatic
contacto@prontomatic.cl`
  },
};

/**
 * Obtiene una plantilla. Si no existe en BD, devuelve el default.
 */
export async function getTemplate(key) {
  try {
    const template = await prisma.emailTemplate.findUnique({ where: { key } });
    if (template) return { subject: template.subject, body: template.body };
  } catch (error) {
    console.error(`Error reading template "${key}":`, error);
  }
  const def = DEFAULT_TEMPLATES[key];
  return def ? { subject: def.subject, body: def.body } : { subject: '', body: '' };
}

/**
 * Obtiene todas las plantillas (BD + defaults para las faltantes).
 */
export async function getAllTemplates() {
  const stored = await prisma.emailTemplate.findMany();
  const storedMap = {};
  stored.forEach(t => { storedMap[t.key] = t; });

  return Object.entries(DEFAULT_TEMPLATES).map(([key, def]) => ({
    key,
    subject: storedMap[key]?.subject || def.subject,
    body: storedMap[key]?.body || def.body,
    description: def.description,
    updated_at: storedMap[key]?.updated_at || null,
    isDefault: !storedMap[key]
  }));
}

/**
 * Actualiza una plantilla (upsert).
 */
export async function setTemplate(key, subject, body) {
  if (!DEFAULT_TEMPLATES[key]) throw new Error(`Plantilla desconocida: ${key}`);

  return await prisma.emailTemplate.upsert({
    where: { key },
    update: { subject, body },
    create: { key, subject, body, description: DEFAULT_TEMPLATES[key].description }
  });
}

/**
 * Restaura una plantilla a su valor por defecto eliminándola de la BD.
 */
export async function resetTemplate(key) {
  if (!DEFAULT_TEMPLATES[key]) throw new Error(`Plantilla desconocida: ${key}`);

  try {
    await prisma.emailTemplate.delete({ where: { key } });
  } catch (error) {
    // Si no existe en BD, ya está en default — ignorar
  }
  return DEFAULT_TEMPLATES[key];
}

/**
 * Reemplaza variables en un template string.
 * @param {string} text - Texto con variables {{variable}}
 * @param {Object} variables - Mapa de variables y sus valores
 */
export function replaceVariables(text, variables) {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

/**
 * Construye las variables disponibles para un ticket dado.
 */
export async function buildTemplateVariables(ticket) {
  const csatUrl = await getConfig('csat_survey_url');
  const avisoHoras = await getConfigNumber('cierre_aviso_horas');
  const cierreHoras = await getConfigNumber('cierre_auto_horas');

  const fechaCierre = ticket.closed_at ? new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ticket.closed_at)) : 'recientemente';

  return {
    ticket_id: String(ticket.id),
    ticket_subject: ticket.subject || '',
    client_email: ticket.client_email || '',
    fecha_cierre: fechaCierre,
    horas_restantes: String(cierreHoras - avisoHoras),
    csat_url: csatUrl,
  };
}
