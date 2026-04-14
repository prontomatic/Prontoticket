import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // category_id puede ser null (para quitar categoría) o un número
  const categoryId = body.category_id;
  if (categoryId !== null && (typeof categoryId !== 'number' || !Number.isInteger(categoryId))) {
    return NextResponse.json({ error: 'category_id debe ser null o un número entero' }, { status: 400 });
  }

  // Validar que el ticket exista y no esté eliminado
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.deleted_at) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
  }

  // Permisos: AGENTE solo puede modificar sus propios tickets o los sin asignar
  if (user.profile.role === 'AGENTE' && ticket.assigned_to !== null && ticket.assigned_to !== user.id) {
    return NextResponse.json({ error: 'Forbidden. Ticket asignado a otro agente.' }, { status: 403 });
  }

  // Si categoryId no es null, validar que la categoría exista y esté activa
  if (categoryId !== null) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || !category.is_active) {
      return NextResponse.json({ error: 'Categoría no válida o inactiva' }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { category_id: categoryId },
      include: { category: true }
    });
    return NextResponse.json({ success: true, category: updated.category });
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    return NextResponse.json({ error: 'Error al actualizar categoría' }, { status: 500 });
  }
}
