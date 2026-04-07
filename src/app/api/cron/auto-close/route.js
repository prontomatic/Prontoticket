import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCierre48h, sendAviso24h, sendCsat } from '@/services/notificationService';

export async function GET(request) {
  // Verificación simple de Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Buscar tickets en estado "Esperando Cliente"
  const ticketsWaiting = await prisma.ticket.findMany({
    where: { status: 'EN_ESPERA_CLIENTE' },
    include: {
      status_history: {
        where: { new_status: 'EN_ESPERA_CLIENTE' },
        orderBy: { changed_at: 'desc' },
        take: 1
      }
    }
  });

  const results = { closed: 0, warned: 0, errors: [] };

  for (const ticket of ticketsWaiting) {
    // La referencia es cuándo el ticket entró en EN_ESPERA_CLIENTE (última transición a ese estado).
    // Fallback a updated_at si por alguna razón no hay registro en StatusHistory.
    const lastTransition = ticket.status_history[0];
    const referenceDate = lastTransition
      ? new Date(lastTransition.changed_at)
      : new Date(ticket.updated_at);
    const diffHours = (now - referenceDate) / (1000 * 60 * 60);

    try {
      if (diffHours >= 48) {
        const updated = await prisma.$transaction(async (tx) => {
          await tx.statusHistory.create({
            data: {
              ticket_id: ticket.id,
              previous_status: ticket.status,
              new_status: 'CERRADO',
              is_system_action: true
            }
          });
          return await tx.ticket.update({
            where: { id: ticket.id },
            data: { status: 'CERRADO', closed_at: now }
          });
        });

        // Enviar notificación de cierre automático
        await sendCierre48h(updated);
        // Enviar encuesta CSAT
        try {
          await sendCsat(updated);
        } catch (csatError) {
          console.error(`[Cron] Error enviando CSAT para ticket #${ticket.id}:`, csatError);
        }
        results.closed++;
      } else if (diffHours >= 24 && diffHours < 25) {
        // Aviso preventivo a las 24 hrs (asumiendo que cron corre cada 1h)
        await sendAviso24h(ticket);
        results.warned++;
      }
    } catch (err) {
      console.error(`Error procesando ticket #${ticket.id} en Cron:`, err);
      results.errors.push({ id: ticket.id, error: err.message });
    }
  }

  return NextResponse.json({ success: true, results });
}
