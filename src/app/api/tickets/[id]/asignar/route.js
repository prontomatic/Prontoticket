import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/tickets/[id]/asignar
 *
 * Reasigna un ticket a otro usuario, o lo deja sin asignar.
 *
 * Accesible solo para: SUPERVISOR y ADMINISTRADOR.
 *
 * Body: { assigned_to: string | null }
 *   - string: UUID de un usuario activo del sistema.
 *   - null: el ticket queda sin asignar (disponible para ser tomado).
 *
 * No se puede reasignar un ticket CERRADO (no tiene sentido operativo).
 *
 * Esta versión no registra la reasignación en un historial auxiliar — la
 * trazabilidad puede agregarse en una iteración futura si se vuelve necesaria.
 */
export async function PATCH(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = user.profile.role;
  if (role !== 'SUPERVISOR' && role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { assigned_to } = body;

  // Validar el valor recibido: debe ser null o un string (UUID).
  if (assigned_to !== null && typeof assigned_to !== 'string') {
    return NextResponse.json({ error: 'assigned_to debe ser un UUID o null' }, { status: 400 });
  }

  try {
    // Verificar que el ticket existe y no está eliminado
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, deleted_at: null },
      select: { id: true, status: true, assigned_to: true }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    // No permitir reasignar tickets cerrados
    if (ticket.status === 'CERRADO') {
      return NextResponse.json({ error: 'No se puede reasignar un ticket cerrado' }, { status: 400 });
    }

    // Si se asigna a un usuario específico, validar que exista y esté activo
    if (assigned_to !== null) {
      const target = await prisma.profile.findUnique({
        where: { id: assigned_to },
        select: { id: true, is_active: true }
      });
      if (!target) {
        return NextResponse.json({ error: 'Usuario destino no existe' }, { status: 400 });
      }
      if (!target.is_active) {
        return NextResponse.json({ error: 'Usuario destino no está activo' }, { status: 400 });
      }
    }

    // Si el valor es el mismo que ya tiene el ticket, responder OK sin escribir en BD
    if (ticket.assigned_to === assigned_to) {
      return NextResponse.json({ success: true, unchanged: true });
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { assigned_to }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ticket reassign error:', error);
    return NextResponse.json({ error: 'Error al reasignar ticket' }, { status: 500 });
  }
}
