import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { appendOutboundMessage } from '@/services/ticketService';
import { sendOutboundEmail } from '@/services/emailService';
import { uploadAttachment, downloadAsBase64 } from '@/services/storageService';
import { prisma } from '@/lib/prisma';

// Límites de archivos (alineados con SendGrid Mail Send)
const MAX_FILE_SIZE = 25 * 1024 * 1024;  // 25 MB por archivo
const MAX_FILES = 5;                      // Máximo 5 archivos por respuesta
const MAX_TOTAL_SIZE = 28 * 1024 * 1024; // 28 MB total (margen bajo el límite de 30 MB de SendGrid)

const VALID_STATUSES = ['EN_PROCESO_INTERNO', 'EN_ESPERA_CLIENTE', 'CERRADO'];

export async function POST(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
  }

  // Detectar si la petición es multipart (con adjuntos) o JSON (sin adjuntos)
  const contentType = request.headers.get('content-type') || '';
  let body, set_status, files = [];

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      body = formData.get('body')?.toString() || '';
      set_status = formData.get('set_status')?.toString() || null;

      // Extraer archivos
      const fileEntries = formData.getAll('files');
      for (const entry of fileEntries) {
        if (entry && typeof entry === 'object' && 'size' in entry && entry.size > 0) {
          files.push(entry);
        }
      }
    } catch (e) {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }
  } else {
    // Compatibilidad con JSON puro (sin adjuntos)
    try {
      const json = await request.json();
      body = json.body || '';
      set_status = json.set_status || null;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  // Validaciones de body
  if (!body || !body.trim()) {
    return NextResponse.json({ error: 'El cuerpo del mensaje es obligatorio' }, { status: 400 });
  }
  if (set_status && !VALID_STATUSES.includes(set_status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  // Validaciones de archivos
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Máximo ${MAX_FILES} archivos por respuesta` }, { status: 400 });
  }

  let totalSize = 0;
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `El archivo "${file.name}" supera el límite de 25 MB`
      }, { status: 400 });
    }
    totalSize += file.size;
  }
  if (totalSize > MAX_TOTAL_SIZE) {
    return NextResponse.json({
      error: 'El tamaño total de los adjuntos supera 28 MB. SendGrid puede rechazar el correo.'
    }, { status: 400 });
  }

  // Validar ticket y permisos
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

  // Crear el mensaje del agente PRIMERO (sin adjuntos aún) para tener un message.id
  const { message: createdMessage } = await appendOutboundMessage(
    ticketId,
    user.id,
    body,
    null,
    'PENDIENTE',  // Status temporal; se actualiza después de enviar
    ticket.status,
    set_status || ticket.status
  );

  // Subir adjuntos a Storage y preparar payload para SendGrid
  const uploadedAttachments = [];  // Para la BD
  const sendgridAttachments = [];  // Para SendGrid

  for (const file of files) {
    const uploadResult = await uploadAttachment(file, ticketId, createdMessage.id);

    if (uploadResult.success) {
      // Guardar registro en BD
      uploadedAttachments.push({
        message_id: createdMessage.id,
        file_name: file.name,
        storage_path: uploadResult.storagePath,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
        upload_status: 'OK',
        upload_error: null
      });

      // Preparar para SendGrid (descargar como base64 desde Storage)
      const downloadResult = await downloadAsBase64(uploadResult.storagePath);
      if (downloadResult.success) {
        sendgridAttachments.push({
          content: downloadResult.content,
          filename: file.name,
          type: file.type || 'application/octet-stream'
        });
      } else {
        console.error(`No se pudo descargar el archivo ${file.name} para enviar por SendGrid`);
      }
    } else {
      // Registrar el error en BD para que el agente sepa
      uploadedAttachments.push({
        message_id: createdMessage.id,
        file_name: file.name,
        storage_path: '',
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
        upload_status: 'ERROR',
        upload_error: uploadResult.error || 'Error desconocido'
      });
    }
  }

  // Persistir adjuntos en BD
  if (uploadedAttachments.length > 0) {
    await prisma.attachment.createMany({ data: uploadedAttachments });
  }

  // Enviar correo con adjuntos
  const emailResult = await sendOutboundEmail({
    to: ticket.client_email,
    subject: outboundSubject,
    text: body,
    inReplyTo: originalMessageId,
    references: originalMessageId,
    attachments: sendgridAttachments
  });

  const finalStatus = emailResult.success ? 'ENVIADO' : 'ERROR';

  // Actualizar el send_status del mensaje del agente
  await prisma.message.update({
    where: { id: createdMessage.id },
    data: { send_status: finalStatus }
  });

  return NextResponse.json({
    success: true,
    sendStatus: finalStatus,
    attachmentsUploaded: uploadedAttachments.filter(a => a.upload_status === 'OK').length,
    attachmentsFailed: uploadedAttachments.filter(a => a.upload_status === 'ERROR').length
  });
}
