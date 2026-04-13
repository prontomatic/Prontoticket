import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';
import { fetchLegacyCustomerData } from '@/services/integrationService';
import { sendAcuseRecibo } from '@/services/notificationService';

export async function POST(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['SUPERVISOR', 'ADMINISTRADOR'].includes(user.profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const filteredId = parseInt(id, 10);
  if (isNaN(filteredId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // Buscar el correo filtrado
  const filteredEmail = await prisma.filteredEmail.findUnique({
    where: { id: filteredId }
  });

  if (!filteredEmail) {
    return NextResponse.json({ error: 'Correo filtrado no encontrado' }, { status: 404 });
  }

  // Enriquecer con datos del cliente si existe en NocoDB/Customer
  const legacyData = await fetchLegacyCustomerData(filteredEmail.from_email);
  let enrichmentNote = null;
  let client_rut = null;
  let client_phone = null;
  let client_address = null;

  if (legacyData && !legacyData.error) {
    client_rut = legacyData.rut;
    client_phone = legacyData.phone;
    client_address = legacyData.address;
  } else {
    enrichmentNote = 'Cliente no encontrado en la base de datos. RUT, Teléfono y Dirección no disponibles.';
  }

  try {
    const ticket = await prisma.$transaction(async (tx) => {
      // 1. Crear el ticket con los datos del correo filtrado
      const newTicket = await tx.ticket.create({
        data: {
          subject: filteredEmail.subject,
          content: `[Reactivado desde correo filtrado el ${new Date().toLocaleString('es-CL')}]\n\n${filteredEmail.body_preview}\n\n---\n\nNOTA: Este ticket fue reactivado desde un correo que el sistema filtró automáticamente. El contenido mostrado puede estar truncado (máx. 500 caracteres). Si requiere la información completa o los adjuntos originales, solicítelos al cliente.`,
          status: 'ABIERTO',
          client_email: filteredEmail.from_email,
          client_rut,
          client_phone,
          client_address,
          enrichment_note: enrichmentNote,
          last_client_reply_at: new Date()
        }
      });

      // 2. Crear mensaje inicial con el body_preview
      await tx.message.create({
        data: {
          ticket_id: newTicket.id,
          sender_type: 'CLIENTE',
          body: filteredEmail.body_preview,
          send_status: 'ENVIADO'
        }
      });

      // 3. StateHistory inicial
      await tx.statusHistory.create({
        data: {
          ticket_id: newTicket.id,
          previous_status: null,
          new_status: 'ABIERTO',
          changed_by: user.id,
          is_system_action: false
        }
      });

      // 4. Eliminar el registro filtrado
      await tx.filteredEmail.delete({ where: { id: filteredId } });

      return newTicket;
    });

    // Enviar acuse de recibo al cliente
    try {
      await sendAcuseRecibo(ticket);
    } catch (error) {
      console.error('Error enviando acuse en reactivación:', error);
    }

    return NextResponse.json({ success: true, ticketId: ticket.id });
  } catch (error) {
    console.error('Error reactivando correo filtrado:', error);
    return NextResponse.json({ error: 'Error al reactivar correo' }, { status: 500 });
  }
}
