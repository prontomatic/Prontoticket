import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/categorias-disponibles
 *
 * Devuelve la lista de categorías activas disponibles para asignar a un ticket.
 * Usado por el selector de categoría en el detalle del ticket.
 *
 * Accesible a cualquier usuario autenticado (AGENTE, SUPERVISOR, ADMINISTRADOR),
 * porque los tres roles necesitan poder categorizar tickets.
 *
 * Devuelve solo campos mínimos: id, name.
 */
export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const categorias = await prisma.category.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(categorias);
  } catch (error) {
    console.error('Available categories fetch error:', error);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}
