/**
 * Punto de entrada del sistema de parseo de formularios web.
 *
 * Registry de parsers: cada parser declara su propio `matches()` y `parse()`.
 * `detectAndParse` itera sobre todos hasta encontrar uno que matchee.
 *
 * Para agregar un formulario nuevo:
 *   1. Crear un archivo en ./parsers/nombre.js exportando un objeto con
 *      { name, matches(emailData), parse(emailData) }
 *   2. Importarlo aquí y añadirlo al array PARSERS en el orden deseado
 *      (el primero que matchee gana).
 */

import { prontopayAppParser } from './parsers/prontopayApp.js';
import { kiosoftWashboardParser } from './parsers/kiosoftWashboard.js';

const PARSERS = [
  prontopayAppParser,
  kiosoftWashboardParser
  // Agregar aquí nuevos parsers cuando surjan otros formularios
];

/**
 * Detecta si un email entrante viene de un formulario web conocido y, de ser así,
 * devuelve los datos parseados listos para crear un ticket.
 *
 * @param {Object} emailData
 * @param {string} emailData.from - Remitente tal como llega (puede ser "Nombre <email>")
 * @param {string} emailData.subject - Asunto original
 * @param {string} emailData.body - Body en markdown (ya convertido por htmlToMarkdown)
 * @returns {Object} { isWebForm: true, parserName, ...campos } | { isWebForm: false }
 */
export function detectAndParse(emailData) {
  for (const parser of PARSERS) {
    try {
      if (parser.matches(emailData)) {
        console.info(`[WebFormParser] Formulario detectado: ${parser.name}`);
        const parsed = parser.parse(emailData);
        return {
          isWebForm: true,
          parserName: parser.name,
          ...parsed
        };
      }
    } catch (error) {
      console.error(`[WebFormParser] Error ejecutando parser ${parser.name}:`, error);
      // Continuar con el siguiente parser
    }
  }
  return { isWebForm: false };
}
