import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const assigned_to = searchParams.get('assigned_to');

  const where = { deleted_at: null };
  if (status) where.status = status;
  if (assigned_to) {
    where.assigned_to = assigned_to === 'unassigned' ? null : assigned_to;
  }

  if (user.profile.role === 'AGENTE') {
    where.OR = [
      { assigned_to: null },
      { assigned_to: user.id }
    ];
  }

  try {
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        category: { select: { name: true } },
        agent: { select: { full_name: true } },
        // Incluir solo la vista del usuario actual (si existe)
        views: {
          where: { user_id: user.id },
          select: { viewed_at: true }
        }
      },
      orderBy: { updated_at: 'desc' }
    });

    // Calcular flag is_unread por ticket
    // Un ticket es "no leído" para el usuario si:
    //   - Nunca lo vio (no existe TicketView), O
    //   - Lo vio pero después hubo respuesta del cliente (viewed_at < last_client_reply_at)
    // Solo aplica para tickets no cerrados; los CERRADO nunca aparecen como no leídos.
    const ticketsWithFlag = tickets.map(ticket => {
      const userView = ticket.views[0];
      let is_unread = false;

      if (ticket.status !== 'CERRADO') {
        if (!userView) {
          // Nunca lo vio
          is_unread = true;
        } else {
          // Lo vio. ¿Hay actividad nueva del cliente posterior?
          const lastReply = ticket.last_client_reply_at || ticket.created_at;
          if (new Date(lastReply) > new Date(userView.viewed_at)) {
            is_unread = true;
          }
        }
      }

      // Quitar el campo views del response para no enviar info innecesaria
      const { views, ...ticketClean } = ticket;
      return { ...ticketClean, is_unread };
    });

    return NextResponse.json(ticketsWithFlag);
  } catch (error) {
    console.error('Tickets fetch error:', error);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}
