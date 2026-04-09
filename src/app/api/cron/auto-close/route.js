import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCierre48h, sendAviso24h, sendCsat } from '@/services/notificationService';
import { getConfigNumber } from '@/services/configService';

export async function GET(request) {
  // Verificación simple de Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Leer umbrales desde la configuración del sistema
  const avisoHoras = await getConfigNumber('cierre_aviso_horas');
  const cierreHoras = await getConfigNumber('cierre_auto_horas');

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

  const results = { closed: 0, warned: 0, errors: [], config: { avisoHoras, cierreHoras } };

  for (const ticket of ticketsWaiting) {
    const lastTransition = ticket.status_history[0];
    const referenceDate = lastTransition
      ? new Date(lastTransition.changed_at)
      : new Date(ticket.updated_at);
    const diffHours = (now - referenceDate) / (1000 * 60 * 60);

    try {
      if (diffHours >= cierreHoras) {
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

        await sendCierre48h(updated);
        try {
          await sendCsat(updated);
        } catch (csatError) {
          console.error(`[Cron] Error enviando CSAT para ticket #${ticket.id}:`, csatError);
        }
        results.closed++;
      } else if (diffHours >= avisoHoras && diffHours < avisoHoras + 1) {
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
