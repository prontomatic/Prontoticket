import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';
import { sendCsat } from '@/services/notificationService';
import { z } from 'zod';

const bodySchema = z.object({
  status: z.enum(['EN_PROCESO_INTERNO', 'EN_ESPERA_CLIENTE', 'CERRADO'])
});

export async function PATCH(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  let json;
  try { json = await request.json(); } catch(e) { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const validation = bodySchema.safeParse(json);
  if (!validation.success) return NextResponse.json({ error: 'Validation Error' }, { status: 400 });

  const { status: newStatus } = validation.data;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (ticket.status === 'CERRADO') return NextResponse.json({ error: 'Already Closed' }, { status: 400 });

  if (user.profile.role === 'AGENTE' && ticket.assigned_to !== user.id) {
    return NextResponse.json({ error: 'Forbidden. No asignado.' }, { status: 403 });
  }

  if (ticket.status === newStatus) return NextResponse.json({ success: true });

  const updatedTicket = await prisma.$transaction(async (tx) => {
    await tx.statusHistory.create({
      data: {
        ticket_id: ticketId,
        previous_status: ticket.status,
        new_status: newStatus,
        changed_by: user.id,
        is_system_action: false
      }
    });

    return await tx.ticket.update({
      where: { id: ticketId },
      data: { 
        status: newStatus,
        closed_at: newStatus === 'CERRADO' ? new Date() : null 
      }
    });
  });

  // Notificación de CSAT si se cierra el ticket manualmente
  if (newStatus === 'CERRADO') {
    try {
      await sendCsat(updatedTicket);
    } catch(err) { console.error('Error enviando CSAT', err); }
  }

  return NextResponse.json({ success: true });
}
