import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function POST(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    // upsert: si existe el registro lo actualiza (refresca viewed_at), si no lo crea
    await prisma.ticketView.upsert({
      where: {
        user_id_ticket_id: {
          user_id: user.id,
          ticket_id: ticketId
        }
      },
      update: {
        viewed_at: new Date()
      },
      create: {
        user_id: user.id,
        ticket_id: ticketId,
        viewed_at: new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking ticket as viewed:', error);
    return NextResponse.json({ error: 'Error al marcar como visto' }, { status: 500 });
  }
}
