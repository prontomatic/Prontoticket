import { prisma } from '@/lib/prisma';

// Valores por defecto del sistema. Si una clave no existe en la BD,
// se usa el valor de aquí. Esto permite que el sistema funcione
// incluso antes de que el admin configure algo.
const DEFAULTS = {
  'cierre_aviso_horas': { value: '24', description: 'Horas sin respuesta del cliente antes de enviar aviso de cortesía' },
  'cierre_auto_horas': { value: '48', description: 'Horas sin respuesta del cliente antes del cierre automático' },
  'csat_survey_url': { value: 'https://forms.gle/placeholder', description: 'URL del formulario de encuesta de satisfacción (CSAT)' },
};

/**
 * Obtiene un valor de configuración. Si no existe en la BD, devuelve el default.
 * @param {string} key - Clave de configuración
 * @returns {Promise<string>} Valor de la configuración
 */
export async function getConfig(key) {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key } });
    if (config) return config.value;
  } catch (error) {
    console.error(`Error reading config "${key}":`, error);
  }
  return DEFAULTS[key]?.value || '';
}

/**
 * Obtiene un valor de configuración como número.
 * @param {string} key - Clave de configuración
 * @returns {Promise<number>} Valor numérico
 */
export async function getConfigNumber(key) {
  const value = await getConfig(key);
  return parseFloat(value) || 0;
}

/**
 * Obtiene todas las configuraciones (existentes en BD + defaults para las faltantes).
 * @returns {Promise<Array>} Lista de configuraciones
 */
export async function getAllConfigs() {
  const stored = await prisma.systemConfig.findMany();
  const storedMap = {};
  stored.forEach(c => { storedMap[c.key] = c; });

  const allConfigs = Object.entries(DEFAULTS).map(([key, def]) => ({
    key,
    value: storedMap[key]?.value || def.value,
    description: def.description,
    updated_at: storedMap[key]?.updated_at || null,
    isDefault: !storedMap[key]
  }));

  return allConfigs;
}

/**
 * Actualiza un valor de configuración (upsert).
 * @param {string} key - Clave
 * @param {string} value - Valor nuevo
 */
export async function setConfig(key, value) {
  if (!DEFAULTS[key]) throw new Error(`Clave de configuración desconocida: ${key}`);

  return await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value, description: DEFAULTS[key].description }
  });
}
