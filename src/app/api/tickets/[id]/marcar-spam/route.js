import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function POST(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['SUPERVISOR', 'ADMINISTRADOR'].includes(user.profile.role)) {
    return NextResponse.json({ error: 'Forbidden. Solo SUPERVISOR o ADMINISTRADOR pueden marcar como spam.' }, { status: 403 });
  }

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Cargar ticket con su primer mensaje (para tomar el body original)
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      messages: {
        where: { sender_type: 'CLIENTE' },
        orderBy: { sent_at: 'asc' },
        take: 1
      }
    }
  });

  if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
  if (ticket.deleted_at) {
    return NextResponse.json({ error: 'Ticket ya eliminado' }, { status: 400 });
  }

  const firstMessage = ticket.messages[0];
  const bodyPreview = firstMessage ? firstMessage.body.substring(0, 500) : '';
  const userName = user.profile.full_name || user.profile.email || 'Usuario';

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Crear registro en FilteredEmail con marca de "marcado manualmente"
      await tx.filteredEmail.create({
        data: {
          from_email: ticket.client_email,
          from_name: ticket.client_name,
          subject: ticket.subject,
          body_preview: bodyPreview,
          score: -1, // -1 indica "marcado manualmente" (no por score automático)
          reasons: `Marcado manualmente como spam por ${userName} (Ticket #${ticket.id})`
        }
      });

      // 2. Eliminación lógica del ticket
      await tx.ticket.update({
        where: { id: ticketId },
        data: { deleted_at: new Date() }
      });
    });

    console.info(`[Tickets] Ticket #${ticketId} marcado como spam por ${userName}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marcando como spam:', error);
    return NextResponse.json({ error: 'Error al marcar como spam' }, { status: 500 });
  }
}
