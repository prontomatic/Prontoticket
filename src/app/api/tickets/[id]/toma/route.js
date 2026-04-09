import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);

// Primero verificar existencia básica del ticket
const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
if (!ticket) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
if (ticket.status === 'CERRADO') return NextResponse.json({ error: 'Ticket Closed' }, { status: 400 });

// La verificación de assigned_to ocurre DENTRO de la transacción mediante
// una condición atómica (where: assigned_to = null), eliminando la condición
// de carrera entre agentes que intentan tomar el mismo ticket simultáneamente.
try {
  await prisma.$transaction(async (tx) => {
    // updateMany con condición: solo actualiza si assigned_to sigue siendo null
    const result = await tx.ticket.updateMany({
      where: {
        id: ticketId,
        assigned_to: null  // Condición atómica: solo toma si nadie lo tomó antes
      },
      data: { assigned_to: user.id }
    });

    // Si count = 0, otro agente tomó el ticket entre el findUnique y esta transacción
    if (result.count === 0) {
      throw new Error('ALREADY_ASSIGNED');
    }

    // Si estaba ABIERTO, transicionar a EN_PROCESO_INTERNO
    if (ticket.status === 'ABIERTO') {
      await tx.statusHistory.create({
        data: {
          ticket_id: ticketId,
          previous_status: 'ABIERTO',
          new_status: 'EN_PROCESO_INTERNO',
          changed_by: user.id,
          is_system_action: false
        }
      });
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'EN_PROCESO_INTERNO' }
      });
    }
  });
} catch (error) {
  if (error.message === 'ALREADY_ASSIGNED') {
    return NextResponse.json(
      { error: 'ALREADY_ASSIGNED', message: 'El ticket ya fue tomado por otro agente.' },
      { status: 409 }
    );
  }
  throw error; // Re-lanzar errores no esperados
}

  return NextResponse.json({ success: true });
}
