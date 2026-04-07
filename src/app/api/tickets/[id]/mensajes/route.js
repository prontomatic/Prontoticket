import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { appendOutboundMessage } from '@/services/ticketService';
import { sendOutboundEmail } from '@/services/emailService';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const bodySchema = z.object({
  body: z.string().min(1),
  set_status: z.enum(['EN_PROCESO_INTERNO', 'EN_ESPERA_CLIENTE', 'CERRADO']).optional()
});

export async function POST(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  
  let json;
  try { json = await request.json(); } 
  catch(e) { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const validation = bodySchema.safeParse(json);
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation Error', details: validation.error }, { status: 400 });
  }

  const { body, set_status } = validation.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { sent_at: 'asc' }, take: 1 } }
  });

  if (!ticket) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (ticket.status === 'CERRADO') return NextResponse.json({ error: 'Ticket Closed' }, { status: 400 });

  if (user.profile.role === 'AGENTE' && ticket.assigned_to !== user.id) {
     return NextResponse.json({ error: 'Forbidden. No asignado.' }, { status: 403 });
  }

  const originalMessageId = ticket.messages.length > 0 ? ticket.messages[0].message_id_header : null;
  const outboundSubject = ticket.subject.startsWith('[#') ? ticket.subject : `[#${ticket.id}] ${ticket.subject}`;

  const emailResult = await sendOutboundEmail({
    to: ticket.client_email,
    subject: outboundSubject,
    text: body,
    inReplyTo: originalMessageId,
    references: originalMessageId
  });

  const sendStatus = emailResult.success ? 'ENVIADO' : 'ERROR';

  await appendOutboundMessage(
    ticketId, 
    user.id, 
    body, 
    null, 
    sendStatus,
    ticket.status,
    set_status || ticket.status
  );

  return NextResponse.json({ success: true, sendStatus });
}
