import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function GET(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, deleted_at: null },
      include: {
        category: true,
        agent: { select: { full_name: true } },
        messages: {
          include: { attachments: true, author: { select: { full_name: true } } },
          orderBy: { sent_at: 'asc' }
        },
        status_history: {
          include: { agent: { select: { full_name: true } } },
          orderBy: { changed_at: 'desc' }
        }
      }
    });

    if (!ticket) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    // Permisos: Agente solo ve si está asignado a él, si no tiene agente, o si el Agente es él
    if (user.profile.role === 'AGENTE' && ticket.assigned_to !== null && ticket.assigned_to !== user.id) {
      return NextResponse.json({ error: 'Forbidden. Assigned to another agent' }, { status: 403 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
