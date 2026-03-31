import { prisma } from '@/lib/prisma';

/**
 * Consulta la tabla Customer local en Supabase para enriquecer los datos del cliente.
 * Esta tabla es sincronizada desde NocoDB una vez al día por el cron job sync-customers.
 *
 * @param {string} email - El correo del remitente original
 * @returns {object|null} - Datos encontrados (rut, phone, address) o null si no existe
 */
export async function fetchLegacyCustomerData(email) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { email }
    });

    if (!customer) {
      return null; // Cliente no encontrado en la tabla local
    }

    return {
      rut: customer.rut || null,
      phone: customer.telefono || null,
      address: customer.direccion || null
    };

  } catch (error) {
    console.error('[IntegrationService] Error al consultar tabla Customer en Supabase:', error);
    // Principio de aislamiento: si falla la consulta, no bloqueamos la creación del ticket
    return { error: true };
  }
}
