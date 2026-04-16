/**
 * Utilidades compartidas para parsers de formularios web.
 *
 * Todas las funciones son case-insensitive y tolerantes a:
 * - múltiples espacios en los labels ("Razón  de  contacto" matchea igual que "Razón de contacto")
 * - formato markdown bold (**Label:** valor)
 * - mayúsculas/minúsculas arbitrarias
 */

/**
 * Normaliza un label para comparaciones (lowercase, espacios colapsados).
 */
function normalizeLabel(label) {
  return String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Elimina los tags [group ...] / [/group] del body.
 * Estos tags aparecen en los emails de formularios web pero no aportan información.
 */
export function cleanGroupTags(body) {
  if (!body) return '';
  return body
    .replace(/^\s*\[\/?group[^\]]*\]\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extrae el valor de un campo "Label: valor" (una sola línea) de un body.
 * Case-insensitive. Tolerante a espacios y a markdown bold.
 *
 * @param {string} body
 * @param {string} label - Ej: "Rut", "Teléfono", "Razón de contacto"
 * @returns {string|null} Valor limpio, o null si no existe o está vacío
 */
export function extractField(body, label) {
  if (!body || !label) return null;

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flexibleLabel = escapedLabel.replace(/\s+/g, '\\s+');

  const regex = new RegExp(
    `^\\s*\\*{0,2}\\s*${flexibleLabel}\\s*\\*{0,2}\\s*:\\s*(.*?)\\s*$`,
    'im'
  );
  const match = body.match(regex);
  if (!match) return null;

  const value = match[1].trim();
  return value.length > 0 ? value : null;
}

/**
 * Extrae todo el contenido después de un label hasta el siguiente label conocido
 * (o el fin del body). Útil para campos multilínea como "Mensaje:".
 *
 * @param {string} body
 * @param {string} label - Label del bloque a extraer (ej: "Mensaje")
 * @param {string[]} [nextLabels=[]] - Labels que cortarían el bloque si aparecen después
 * @returns {string|null}
 */
export function extractBlockAfterLabel(body, label, nextLabels = []) {
  if (!body || !label) return null;

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flexibleLabel = escapedLabel.replace(/\s+/g, '\\s+');

  const labelRegex = new RegExp(
    `^\\s*\\*{0,2}\\s*${flexibleLabel}\\s*\\*{0,2}\\s*:\\s*`,
    'im'
  );
  const labelMatch = body.match(labelRegex);
  if (!labelMatch || typeof labelMatch.index !== 'number') return null;

  const startIdx = labelMatch.index + labelMatch[0].length;
  let endIdx = body.length;

  for (const nextLabel of nextLabels) {
    const escaped = nextLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flexibleNext = escaped.replace(/\s+/g, '\\s+');
    const regex = new RegExp(
      `^\\s*\\*{0,2}\\s*${flexibleNext}\\s*\\*{0,2}\\s*:`,
      'im'
    );
    const substr = body.substring(startIdx);
    const match = substr.match(regex);
    if (match && typeof match.index === 'number') {
      const absoluteIdx = startIdx + match.index;
      if (absoluteIdx < endIdx) endIdx = absoluteIdx;
    }
  }

  const block = body.substring(startIdx, endIdx).trim();
  return block.length > 0 ? block : null;
}

/**
 * Extrae el email de strings como:
 *   "Gianni Jaramillo <juniorjaramillo5@gmail.com>" → "juniorjaramillo5@gmail.com"
 *   "Gianni [junior@gmail.com](mailto:junior@gmail.com)" → "junior@gmail.com" (Turndown)
 *   "junior@gmail.com" → "junior@gmail.com"
 */
export function extractEmailFromString(str) {
  if (!str) return null;

  const bracketMatch = str.match(/<([^>\s]+@[^>\s]+)>/);
  if (bracketMatch) return bracketMatch[1].trim();

  const plainMatch = str.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
  return plainMatch ? plainMatch[1].trim() : null;
}

/**
 * Extrae el nombre de strings como:
 *   "Gianni Jaramillo <email>" → "Gianni Jaramillo"
 *   "Gianni Jaramillo [email](mailto:email)" → "Gianni Jaramillo" (formato Turndown)
 *   "Solo un nombre" → "Solo un nombre"
 */
export function extractNameFromString(str) {
  if (!str) return null;

  // "Nombre <email>"
  const bracketMatch = str.match(/^([^<]+)</);
  if (bracketMatch) {
    const name = bracketMatch[1].trim();
    return name.length > 0 ? name : null;
  }

  // "Nombre [email](mailto:email)" (Turndown markdown)
  const markdownMatch = str.match(/^([^\[]+)\[/);
  if (markdownMatch) {
    const name = markdownMatch[1].trim();
    if (name.length > 0 && !name.includes('@')) return name;
  }

  // String sin email puede ser solo un nombre
  if (!str.includes('@')) {
    const trimmed = str.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

/**
 * Detecta campos "Label: valor" adicionales que NO están en coreLabels.
 * Solo busca en la sección previa al label "Mensaje:" para evitar capturar
 * contenido del mensaje del cliente como campos falsos.
 *
 * Ignora valores vacíos, tags [group] y strings que parezcan URLs.
 *
 * @param {string} body
 * @param {string[]} coreLabels - Labels que NO cuentan como extras
 * @returns {Array<{label: string, value: string}>}
 */
export function detectExtraFields(body, coreLabels) {
  if (!body) return [];

  // Construir set normalizado de labels core para comparación
  const normalizedCore = new Set(coreLabels.map(normalizeLabel));

  // Limitar búsqueda a la parte anterior a "Mensaje:"
  const mensajeMatch = body.match(/^\s*\*{0,2}\s*Mensaje\s*\*{0,2}\s*:/im);
  const searchArea =
    mensajeMatch && typeof mensajeMatch.index === 'number'
      ? body.substring(0, mensajeMatch.index)
      : body;

  const extras = [];
  const lines = searchArea.split('\n');

  for (const line of lines) {
    // Skip tags [group ...]
    if (/^\s*\[\/?group/i.test(line)) continue;

    // Matchea "Label: valor" (label corto, valor no vacío)
    const match = line.match(/^\s*\*{0,2}\s*([^:*\n][^:\n]{0,48}?)\s*\*{0,2}\s*:\s*(.+?)\s*$/);
    if (!match) continue;

    const label = match[1].trim();
    const value = match[2].trim();

    if (!value) continue;
    if (normalizedCore.has(normalizeLabel(label))) continue;
    // Skip líneas que son URLs (ej: "https://example.com" se parsearía como label "https" valor "//example.com")
    if (/https?:\/\//i.test(label) || label.includes('://')) continue;

    extras.push({ label, value });
  }

  return extras;
}
