/**
 * Parser del formulario web de "Prontopay (APP)" que envía correos al buzón
 * contacto@prontomatic.cl con el siguiente formato:
 *
 *   De: Nombre <email>
 *   Rut: XXXXXXXX-X
 *   Teléfono: XXXXXXXXX
 *   Email: email@dominio.com
 *   Edificio: Nombre del edificio
 *   Razón de contacto: Prontopay (APP)
 *   [group opcion-paymatic]
 *   Número de tarjeta:
 *   [/group]
 *
 *   Mensaje:
 *   (mensaje real del cliente, potencialmente multilínea)
 *
 * Identificación: combinación de tres señales
 *   (1) Remitente = contacto@prontomatic.cl
 *   (2) Estructura del body (presencia de "De:" y "Mensaje:")
 *   (3) Asunto con patrón "Prontomatic «...»"
 */

import {
  cleanGroupTags,
  extractField,
  extractBlockAfterLabel,
  extractEmailFromString,
  extractNameFromString,
  detectExtraFields
} from '../utils.js';

// Labels "core" que van a campos específicos del ticket (no al bloque de info adicional)
const CORE_LABELS = ['De', 'Rut', 'Teléfono', 'Email', 'Edificio', 'Razón de contacto', 'Mensaje'];

// Correo del buzón interno que recibe los formularios
const INTERNAL_INBOX = 'contacto@prontomatic.cl';

export const prontopayAppParser = {
  name: 'prontopay-app-v1',

  /**
   * Determina si un correo entrante proviene de este formulario.
   * Requiere: remitente interno + estructura del body reconocible.
   * El patrón del asunto se usa como señal adicional para logging.
   */
  matches({ from, subject, body }) {
    const fromLower = String(from || '').toLowerCase();
    const senderMatches = fromLower.includes(INTERNAL_INBOX);

    // Estructura mínima: campos "De:" y "Mensaje:" presentes
    const hasDe = /^\s*\*{0,2}\s*De\s*\*{0,2}\s*:/im.test(body || '');
    const hasMensaje = /^\s*\*{0,2}\s*Mensaje\s*\*{0,2}\s*:/im.test(body || '');
    const structureMatches = hasDe && hasMensaje;

    // Patrón del asunto (señal complementaria, no bloqueante)
    const subjectMatches = /Prontomatic\s*«.+»/i.test(subject || '');

    if (senderMatches && structureMatches) {
      if (!subjectMatches) {
        console.info(
          `[WebFormParser] Formulario prontopay-app detectado pero el asunto no matchea el patrón esperado (subject="${subject}")`
        );
      }
      return true;
    }

    if (senderMatches && !structureMatches) {
      console.warn(
        '[WebFormParser] Remitente coincide (contacto@prontomatic.cl) pero la estructura del cuerpo no matchea el formulario prontopay-app'
      );
    }

    return false;
  },

  /**
   * Extrae los datos estructurados del formulario.
   *
   * @returns {Object} Campos parseados + metadata del parseo
   */
  parse({ subject, body }) {
    const missingCritical = [];

    // Limpiar tags [group ...] antes de procesar
    const cleanBody = cleanGroupTags(body);

    // --- Extracción de campos estructurados ---
    const deRaw = extractField(cleanBody, 'De');
    const emailRaw = extractField(cleanBody, 'Email');
    const rut = extractField(cleanBody, 'Rut');
    const telefono = extractField(cleanBody, 'Teléfono');
    const edificio = extractField(cleanBody, 'Edificio');
    const razonContacto = extractField(cleanBody, 'Razón de contacto');

    // "Mensaje:" es multilínea hasta fin del body (o hasta otro label core si reaparece)
    const mensaje = extractBlockAfterLabel(
      cleanBody,
      'Mensaje',
      CORE_LABELS.filter(l => l !== 'Mensaje')
    );

    // --- Nombre del cliente: viene del campo "De:" (formato "Nombre <email>") ---
    let clientName = deRaw ? extractNameFromString(deRaw) : null;

    // --- Email del cliente: preferir campo "Email:" explícito, fallback al "De:" ---
    let clientEmail = null;
    if (emailRaw) {
      clientEmail = extractEmailFromString(emailRaw) || emailRaw;
    }
    if (!clientEmail && deRaw) {
      clientEmail = extractEmailFromString(deRaw);
    }

    // --- Validación de campos críticos ---
    if (!clientEmail) {
      console.error('[WebFormParser] No se pudo extraer email del cliente del formulario prontopay-app');
      missingCritical.push('Email del cliente');
    }
    if (!clientName) {
      console.error('[WebFormParser] No se pudo extraer nombre del cliente del formulario prontopay-app');
      missingCritical.push('Nombre del cliente');
    }
    if (!mensaje) {
      console.error('[WebFormParser] No se pudo extraer el mensaje del cliente del formulario prontopay-app');
      missingCritical.push('Mensaje del cliente');
    }

    // --- Asunto final: la razón de contacto tal cual (ej: "Prontopay (APP)") ---
    const finalSubject = razonContacto || subject;

    // --- Detectar campos extras CON valor (ej: "Número de tarjeta: 1234") ---
    const extras = detectExtraFields(cleanBody, CORE_LABELS);

    // --- Construir body final del primer mensaje ---
    let finalBody = mensaje || '';

    // Adjuntar bloque de "Información adicional" solo si hay extras CON valor
    if (extras.length > 0) {
      finalBody += '\n\n---\n\n**Información adicional del formulario**\n\n';
      for (const { label, value } of extras) {
        finalBody += `- **${label}:** ${value}\n`;
      }
      finalBody = finalBody.trimEnd();
    }

    // Si hubo problemas extrayendo campos críticos, anteponer advertencia visible
    if (missingCritical.length > 0) {
      const fallbackContent = finalBody || cleanBody || body;
      finalBody =
`⚠️ FORMULARIO WEB DETECTADO — EXTRACCIÓN INCOMPLETA
No se pudo extraer: ${missingCritical.join(', ')}
Por favor revisar el contenido original abajo y completar manualmente.

---

${fallbackContent}`;
    }

    return {
      clientEmail,
      clientName,
      clientRut: rut,
      clientPhone: telefono,
      clientAddress: edificio,
      subject: finalSubject,
      body: finalBody,
      missingCritical
    };
  }
};
