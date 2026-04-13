import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';
import { getSignedUrl } from '@/services/storageService';

export async function GET(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const attachmentId = parseInt(id, 10);
  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: 'Invalid attachment id' }, { status: 400 });
  }

  try {
    // Buscar attachment y su ticket asociado para validar permisos
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            ticket: { select: { assigned_to: true } }
          }
        }
      }
    });

    if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

    // Si el adjunto tuvo error de subida, no hay URL que generar
    if (attachment.upload_status !== 'OK' || !attachment.storage_path) {
      return NextResponse.json({ error: 'Attachment upload failed', status: attachment.upload_status }, { status: 410 });
    }

    // Permisos: AGENTE solo ve adjuntos de tickets asignados a él o sin asignar
    const ticket = attachment.message.ticket;
    if (user.profile.role === 'AGENTE' && ticket.assigned_to !== null && ticket.assigned_to !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generar URL firmada de 6 horas
    const result = await getSignedUrl(attachment.storage_path);
    if (!result.success) {
      return NextResponse.json({ error: 'Error generating signed URL' }, { status: 500 });
    }

    return NextResponse.json({
      url: result.url,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
      fileSize: attachment.file_size
    });
  } catch (error) {
    console.error('Attachment URL error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
