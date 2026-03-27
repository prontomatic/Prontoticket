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
    where: { status: 'EN_ESPERA_CLIENTE' }
  });

  const results = { closed: 0, warned: 0, errors: [] };

  for (const ticket of ticketsWaiting) {
    // Si no hay respuesta de cliente, se evalúa respecto a la fecha de creación o el último cambio a este estado
    // Prontomatic rule: 48h since the agent replied (which triggers EN_ESPERA_CLIENTE).
    // The ticketService sets updated_at. Let's use updated_at since the status changed.
    // Usar last_client_reply_at: campo diseñado específicamente para medir
    // inactividad del cliente. updated_at se reinicia con cualquier cambio del ticket.
    const referenceDate = ticket.last_client_reply_at
      ? new Date(ticket.last_client_reply_at)
      : new Date(ticket.created_at);
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
        // Enviar encuesta CSAT — debe dispararse en todo cierre de ticket
        try {
          await sendCsat(updated);
        } catch (csatError) {
          console.error(`[Cron] Error enviando CSAT para ticket #${ticket.id}:`, csatError);
        }
        results.closed++;
      } else if (diffHours >= 24 && diffHours < 25) {
         // Aviso preventivo a las 24 hrs. (asumiendo que cron corre cada 1h)
         await sendAviso24h(ticket);
         results.warned++;
      }
    } catch(err) {
      console.error(`Error procesando ticket #${ticket.id} en Cron:`, err);
      results.errors.push({ id: ticket.id, error: err.message });
    }
  }

  return NextResponse.json({ success: true, results });
}
