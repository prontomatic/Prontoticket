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

    const bodyStr = body || '';
    // Detección relajada: sin anchors de línea (^), sin exigir markdown bold.
    // Solo verificamos que los labels existan EN ALGUNA PARTE del body.
    // La combinación sender + estructura es suficiente para evitar falsos positivos.
    const hasDe = /\bDe\s*:/i.test(bodyStr);
    const hasMensaje = /\bMensaje\s*:/i.test(bodyStr);
    // .{0,2} para acentos: cubre 0 chars (sin acento), 1 char (acento o ó), 2 chars (Ã©)
    const hasFormFields = /(?:Tel.{0,2}fono|Raz.{0,2}n\s+de\s+contacto|Email|Rut|Edificio)\s*:/i.test(bodyStr);
    const structureMatches = hasDe && hasMensaje && hasFormFields;

    // Asunto: solo verificar presencia de "Prontomatic" (señal complementaria)
    const subjectMatches = /Prontomatic/i.test(subject || '');

    // Logging diagnóstico — visible en Vercel → Logs filtrando por [WebFormParser]
    console.info(
      `[WebFormParser:matches] sender=${senderMatches} hasDe=${hasDe} hasMensaje=${hasMensaje} hasFields=${hasFormFields} subject=${subjectMatches} | from="${fromLower.substring(0, 50)}" subj="${(subject || '').substring(0, 60)}"`
    );

    if (senderMatches && structureMatches) {
      return true;
    }

    if (senderMatches && !structureMatches) {
      // Loguear los primeros 200 chars del body para diagnóstico
      console.warn(
        `[WebFormParser] Remitente coincide pero estructura NO matchea. body_preview="${bodyStr.substring(0, 200).replace(/\n/g, '\\n')}"`
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
    let rawBody = body || '';

    // ============================================================
    // PIPELINE DE SANITIZACIÓN AGRESIVA
    // El body llega con basura de Outlook, encoding roto, escapes
    // de Turndown, y tags de formulario inline. Limpiamos TODO
    // antes de extraer cualquier campo.
    // ============================================================

    // PASO 1: Cortar todo antes de "De:" (elimina CSS de Outlook, headers residuales, etc.)
    // Sabemos que el formulario SIEMPRE empieza con "De:", así que todo lo anterior es basura.
    const deIndex = rawBody.search(/\bDe\s*:/i);
    if (deIndex > 0) {
      console.info(`[WebFormParser:parse] Cortando ${deIndex} chars de basura antes de "De:"`);
      rawBody = rawBody.substring(deIndex);
    }

    // PASO 2: Revertir escapes de Turndown (\[ → [, \] → ], \> → >)
    rawBody = rawBody
      .replace(/\\\[/g, '[')
      .replace(/\\\]/g, ']')
      .replace(/\\>/g, '>');

    // PASO 3: Convertir links Markdown a texto plano: [text](url) → text
    // Turndown convierte emails HTML a [email@x.com](mailto:email@x.com)
    rawBody = rawBody.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

    // PASO 4: Eliminar tags [group ...] y [/group] en CUALQUIER posición
    // (no solo en líneas propias — a veces están inline con otros campos)
    rawBody = rawBody.replace(/\[\/?group[^\]]*\]/gi, '');

    // PASO 5: Normalizar acentos corruptos
    // .{0,2} cubre: 0 chars (sin acento), 1 char (é, ó, ú, ñ, o ó), 2 chars (Ã©, Ã³)
    rawBody = rawBody
      .replace(/Tel.{0,2}fono/gi, 'Teléfono')
      .replace(/Raz.{0,2}n(\s)/gi, 'Razón$1')
      .replace(/N.{0,2}mero/gi, 'Número')
      .replace(/Opci.{0,2}n(\s)/gi, 'Opción$1');

    // PASO 6: Limpiar espacios y líneas vacías excesivas
    rawBody = rawBody.replace(/\n{3,}/g, '\n\n').trim();

    console.info(`[WebFormParser:parse] Body sanitizado (${rawBody.length} chars). Preview: "${rawBody.substring(0, 150).replace(/\n/g, '\\n')}"`);

    const cleanBody = rawBody;

    // ============================================================
    // EXTRACCIÓN DE DATOS (sobre body ya limpio y normalizado)
    // ============================================================

    const deRaw = extractField(cleanBody, 'De');
    const emailRaw = extractField(cleanBody, 'Email');
    const rut = extractField(cleanBody, 'Rut');
    const telefono = extractField(cleanBody, 'Teléfono');
    const edificio = extractField(cleanBody, 'Edificio');
    const razonContacto = extractField(cleanBody, 'Razón de contacto');

    // Log de extracción para diagnóstico
    console.info(`[WebFormParser:parse] Extraído → de="${deRaw}" email="${emailRaw}" rut="${rut}" tel="${telefono}" edificio="${edificio}" razon="${razonContacto}"`);

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

    console.info(`[WebFormParser:parse] Cliente → name="${clientName}" email="${clientEmail}" mensaje="${(mensaje || '').substring(0, 80)}"`);

    // --- Validación de campos críticos ---
    if (!clientEmail) {
      console.error('[WebFormParser] FALLO: No se pudo extraer email del cliente');
      missingCritical.push('Email del cliente');
    }
    if (!clientName) {
      console.error('[WebFormParser] FALLO: No se pudo extraer nombre del cliente');
      missingCritical.push('Nombre del cliente');
    }
    if (!mensaje) {
      console.error('[WebFormParser] FALLO: No se pudo extraer el mensaje del cliente');
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
