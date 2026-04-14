import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function DELETE(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['SUPERVISOR', 'ADMINISTRADOR'].includes(user.profile.role)) {
    return NextResponse.json({ error: 'Forbidden. Solo SUPERVISOR o ADMINISTRADOR pueden eliminar tickets.' }, { status: 403 });
  }

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
  if (ticket.deleted_at) {
    return NextResponse.json({ error: 'Ticket ya eliminado' }, { status: 400 });
  }

  try {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { deleted_at: new Date() }
    });
    console.info(`[Tickets] Ticket #${ticketId} eliminado lógicamente por usuario ${user.id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando ticket:', error);
    return NextResponse.json({ error: 'Error al eliminar ticket' }, { status: 500 });
  }
}
