/**
 * Parser del formulario web de Kiosoft/Washboard.
 *
 * Kiosoft es la plataforma de lavandería automatizada que gestiona las máquinas
 * en los locales de Prontomatic. Cuando un cliente reporta un problema con una
 * lavadora/secadora desde la app de Kiosoft, se envía un correo automático al
 * buzón contacto@prontomatic.cl con el siguiente formato:
 *
 *   De: Washboard <latam-cleanstore@kiosoft.com>
 *   Asunto: Problem Reported at [CODIGO] - [NOMBRE LOCAL] ([ID])
 *
 *   ## Problem reported at ...
 *   **Washer 13** is issuing a problem.
 *   **Location Address:**
 *   [direccion del local]
 *   **Room Name:**
 *   [sala o N/A]
 *   **Site Code - Location ID:**
 *   [codigos internos]
 *   **Reader Serial #:**
 *   [serial de la máquina]
 *   **Problem:**
 *   [descripción corta]
 *   **Other information reported:**
 *   [texto libre del cliente]
 *   **User contact number:**
 *   [teléfono del cliente]
 *
 *   This problem was reported by [email_cliente]@dominio.com. Please check and advise the resident.
 *
 * Identificación: remitente `latam-cleanstore@kiosoft.com` + estructura reconocible.
 *
 * IMPORTANTE — Email del cliente:
 * El remitente del correo es latam-cleanstore@kiosoft.com (la plataforma Kiosoft),
 * NO el cliente real. El email del cliente aparece al final del body, en la línea
 * "This problem was reported by X. Please check and advise the resident."
 * Si no se extrae ese email, las respuestas del agente irían a Kiosoft en vez del
 * cliente real, lo que no tiene sentido.
 */

import { extractEmailFromString } from '../utils.js';

const KIOSOFT_SENDER = 'latam-cleanstore@kiosoft.com';

/**
 * Extrae el valor que sigue a un label en formato markdown bold:
 *   **Label:**
 *
 *   valor
 * El valor puede estar en la misma línea, en la siguiente, o varias líneas después.
 * Se considera terminado cuando aparece otro label **X:** o el final del body.
 *
 * @param {string} body
 * @param {string} label - Label exacto (sin los asteriscos), ej: "Location Address"
 * @returns {string|null}
 */
function extractKiosoftField(body, label) {
  if (!body || !label) return null;

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Patrón: **Label:** seguido de cualquier cosa hasta el siguiente **Label:** o fin
  const regex = new RegExp(
    `\\*\\*\\s*${escapedLabel}\\s*:\\s*\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*[^*]+:\\*\\*|\\n\\s*This problem was reported|$)`,
    'i'
  );

  const match = body.match(regex);
  if (!match) return null;

  const value = match[1]
    .trim()
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return value.length > 0 ? value : null;
}

/**
 * Extrae el identificador de la máquina (ej: "Washer 13", "Dryer 5") de la línea:
 *   **Washer 13** is issuing a problem.
 */
function extractMachineName(body) {
  if (!body) return null;
  const match = body.match(/\*\*([^*]+)\*\*\s+is\s+issuing\s+a\s+problem/i);
  return match ? match[1].trim() : null;
}

/**
 * Extrae el email del cliente de la línea:
 *   This problem was reported by X@Y.com. Please check and advise the resident.
 */
function extractReporterEmail(body) {
  if (!body) return null;
  // Buscar patrón "reported by ... Please check"
  const match = body.match(/reported\s+by\s+(.+?)\.\s*Please\s+check/i);
  if (!match) return null;
  // El match puede contener un link markdown [email](mailto:email) — extraer el email real
  return extractEmailFromString(match[1]) || match[1].trim();
}

/**
 * Deriva un nombre de cliente a partir del local part del email.
 * Ej: karlitag1998o@gmail.com → "karlitag1998o"
 * No es ideal pero es mejor que dejar null en el Kanban.
 */
function deriveNameFromEmail(email) {
  if (!email || !email.includes('@')) return null;
  const localPart = email.split('@')[0].trim();
  return localPart.length > 0 ? localPart : null;
}

export const kiosoftWashboardParser = {
  name: 'kiosoft-washboard-v1',

  /**
   * Determina si un correo proviene de Kiosoft.
   * Señal primaria: remitente `latam-cleanstore@kiosoft.com`.
   * Señal secundaria: estructura del body con "Problem reported at" o "is issuing a problem".
   */
  matches({ from, subject, body }) {
    const fromLower = String(from || '').toLowerCase();
    const senderMatches = fromLower.includes(KIOSOFT_SENDER);

    const bodyStr = body || '';
    const hasProblemReported = /Problem\s+reported\s+at/i.test(bodyStr);
    const hasIssuingProblem = /is\s+issuing\s+a\s+problem/i.test(bodyStr);
    const structureMatches = hasProblemReported || hasIssuingProblem;

    // Señal adicional: asunto típico
    const subjectMatches = /Problem\s+Reported\s+at/i.test(subject || '');

    console.info(
      `[WebFormParser:kiosoft-matches] sender=${senderMatches} problemReported=${hasProblemReported} isIssuing=${hasIssuingProblem} subject=${subjectMatches} | from="${fromLower.substring(0, 50)}"`
    );

    if (senderMatches && structureMatches) {
      return true;
    }

    if (senderMatches && !structureMatches) {
      console.warn(
        `[WebFormParser] Remitente Kiosoft detectado pero estructura no matchea. body_preview="${bodyStr.substring(0, 200).replace(/\n/g, '\\n')}"`
      );
    }

    return false;
  },

  /**
   * Extrae los datos estructurados del reporte de Kiosoft.
   */
  parse({ subject, body }) {
    const missingCritical = [];
    const rawBody = body || '';

    console.info(`[WebFormParser:kiosoft-parse] Body length=${rawBody.length}`);

    // ============================================================
    // EXTRACCIÓN DE CAMPOS
    // ============================================================

    const machine = extractMachineName(rawBody);
    const locationAddress = extractKiosoftField(rawBody, 'Location Address');
    const roomName = extractKiosoftField(rawBody, 'Room Name');
    const siteCode = extractKiosoftField(rawBody, 'Site Code - Location ID');
    const readerSerial = extractKiosoftField(rawBody, 'Reader Serial #');
    const problem = extractKiosoftField(rawBody, 'Problem');
    const otherInfo = extractKiosoftField(rawBody, 'Other information reported');
    const userPhone = extractKiosoftField(rawBody, 'User contact number');

    const clientEmail = extractReporterEmail(rawBody);

    console.info(
      `[WebFormParser:kiosoft-parse] Extraído → machine="${machine}" problem="${problem}" email="${clientEmail}" phone="${userPhone}"`
    );

    // ============================================================
    // VALIDACIÓN DE CAMPOS CRÍTICOS
    // ============================================================

    if (!clientEmail) {
      console.error('[WebFormParser] FALLO Kiosoft: No se pudo extraer email del cliente (línea "reported by")');
      missingCritical.push('Email del cliente');
    }
    if (!problem && !otherInfo) {
      console.error('[WebFormParser] FALLO Kiosoft: No se pudo extraer descripción del problema');
      missingCritical.push('Descripción del problema');
    }

    // ============================================================
    // CONSTRUCCIÓN DEL TICKET
    // ============================================================

    // Nombre del cliente: derivado del local part del email (no ideal pero mejor que null)
    const clientName = clientEmail ? deriveNameFromEmail(clientEmail) : null;

    // Asunto: mantener tal cual viene (incluye código de local útil para búsqueda)
    const finalSubject = subject;

    // Teléfono → columna client_phone del ticket
    const clientPhone = userPhone;

    // Dirección del local NO va a client_address porque no es la dirección del cliente,
    // es la dirección del local de Prontomatic. Va al body como info contextual.
    const clientAddress = null;
    const clientRut = null;

    // Construir body en español, limpio, con los campos del mensaje real del cliente
    // arriba y el resto como información adicional del formulario.
    const mainBodyParts = [];
    if (machine) {
      mainBodyParts.push(`**Máquina:** ${machine}`);
    }
    if (problem) {
      mainBodyParts.push(`**Problema:** ${problem}`);
    }
    if (otherInfo) {
      mainBodyParts.push(`**Información adicional reportada:** ${otherInfo}`);
    }

    const extraInfoParts = [];
    if (locationAddress) extraInfoParts.push(`- **Dirección del local:** ${locationAddress}`);
    if (roomName && roomName.toUpperCase() !== 'N/A') extraInfoParts.push(`- **Sala:** ${roomName}`);
    if (siteCode) extraInfoParts.push(`- **Código de local:** ${siteCode}`);
    if (readerSerial) extraInfoParts.push(`- **Serial del equipo:** ${readerSerial}`);
    if (userPhone) extraInfoParts.push(`- **Teléfono del cliente:** ${userPhone}`);

    let finalBody = mainBodyParts.join('\n\n');

    if (extraInfoParts.length > 0) {
      if (finalBody.length > 0) finalBody += '\n\n';
      finalBody += '---\n\n**Información adicional del formulario**\n\n';
      finalBody += extraInfoParts.join('\n');
    }

    // Si faltan campos críticos, anteponer advertencia visible
    if (missingCritical.length > 0) {
      const fallbackContent = finalBody || rawBody;
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
      clientRut,
      clientPhone,
      clientAddress,
      subject: finalSubject,
      body: finalBody,
      missingCritical
    };
  }
};
