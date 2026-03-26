import { legacyPrisma } from '@/lib/prisma';

/**
 * Consulta la base de datos MySQL legacy para enriquecer los datos del cliente.
 * 
 * @param {string} email - El correo del remitente original
 * @returns {object|null} - Datos encontrados (rut, telefono, direccion) o null
 */
export async function fetchLegacyCustomerData(email) {
  try {
    const legacyUser = await legacyPrisma.legacyUser.findUnique({
      where: { email }
    });

    if (!legacyUser) {
      return null;
    }

    return {
      rut: legacyUser.rut || null,
      phone: legacyUser.telefono || null,
      address: legacyUser.direccion || null
    };
  } catch (error) {
    console.error('[IntegrationService] Error al consultar DB Legacy:', error);
    // Para cumplir el Principio de Aislamiento: si falla MySQL, no detenemos el proceso, devolvemos null ("no encontrado")
    return { error: true };
  }
}
