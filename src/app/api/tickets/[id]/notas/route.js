import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

const MAX_BODY_LENGTH = 5000;

/**
 * Verifica si el usuario tiene permiso para acceder al ticket dado.
 * Reproduce la misma lógica que el GET de /api/tickets/[id]:
 *   - SUPERVISOR y ADMINISTRADOR pueden ver cualquier ticket no eliminado.
 *   - AGENTE solo puede ver tickets sin asignar o asignados a él mismo.
 *
 * Devuelve { ticket, error } donde ticket es null si no se permite el acceso
 * y error es un NextResponse listo para devolver.
 */
async function checkTicketAccess(ticketId, user) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, deleted_at: null },
    select: { id: true, assigned_to: true, status: true }
  });

  if (!ticket) {
    return { ticket: null, error: NextResponse.json({ error: 'Not Found' }, { status: 404 }) };
  }

  if (user.profile.role === 'AGENTE'
      && ticket.assigned_to !== null
      && ticket.assigned_to !== user.id) {
    return {
      ticket: null,
      error: NextResponse.json({ error: 'Forbidden. Assigned to another agent' }, { status: 403 })
    };
  }

  return { ticket, error: null };
}

/**
 * GET /api/tickets/[id]/notas
 *
 * Lista las notas internas del ticket, ordenadas por fecha de creación
 * descendente (las más recientes primero).
 *
 * Permisos: cualquier usuario autenticado que pueda ver el ticket.
 *   - SUPERVISOR y ADMINISTRADOR ven todos los tickets.
 *   - AGENTE solo ve tickets sin asignar o asignados a sí mismo.
 */
export async function GET(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { ticket, error } = await checkTicketAccess(ticketId, user);
  if (error) return error;

  try {
    const notes = await prisma.internalNote.findMany({
      where: { ticket_id: ticketId },
      include: {
        author: { select: { id: true, full_name: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json(notes);
  } catch (err) {
    console.error('Internal notes fetch error:', err);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}

/**
 * POST /api/tickets/[id]/notas
 *
 * Crea una nueva nota interna en el ticket. Las notas son INMUTABLES:
 * no hay endpoint para editar ni borrar. Si una nota tiene errores,
 * agregar una nueva nota corrigiendo el contenido anterior.
 *
 * Permisos: cualquier usuario autenticado que pueda ver el ticket.
 * Bloqueo adicional: no se permiten notas en tickets CERRADOS (solo lectura).
 *
 * Body: { body: string } — máximo 5000 caracteres.
 */
export async function POST(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { ticket, error } = await checkTicketAccess(ticketId, user);
  if (error) return error;

  // No permitir agregar notas en tickets cerrados
  if (ticket.status === 'CERRADO') {
    return NextResponse.json(
      { error: 'No se pueden agregar notas a un ticket cerrado' },
      { status: 400 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const body = typeof payload?.body === 'string' ? payload.body.trim() : '';

  if (!body) {
    return NextResponse.json({ error: 'El contenido de la nota no puede estar vacío' }, { status: 400 });
  }

  if (body.length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { error: `La nota excede el límite de ${MAX_BODY_LENGTH} caracteres` },
      { status: 400 }
    );
  }

  try {
    const note = await prisma.internalNote.create({
      data: {
        ticket_id: ticketId,
        author_id: user.id,
        body
      },
      include: {
        author: { select: { id: true, full_name: true } }
      }
    });

    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error('Internal note create error:', err);
    return NextResponse.json({ error: 'Error al crear la nota' }, { status: 500 });
  }
}
