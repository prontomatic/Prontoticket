import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, { params }) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ticketId = parseInt(params.id, 10);

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (ticket.status === 'CERRADO') return NextResponse.json({ error: 'Ticket Closed' }, { status: 400 });
  if (ticket.assigned_to) return NextResponse.json({ error: 'Already assigned' }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: { assigned_to: user.id }
    });
    
    // Si estaba ABIERTO, pasa a EN_PROCESO_INTERNO automáticamente al tomarlo
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

  return NextResponse.json({ success: true });
}
