import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/tickets/asignables
 *
 * Devuelve la lista de usuarios activos disponibles para asignar un ticket.
 * Usado por el selector de reasignación en el detalle del ticket.
 *
 * Accesible para: SUPERVISOR y ADMINISTRADOR.
 * Devuelve solo campos mínimos: id, full_name, role.
 */
export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = user.profile.role;
  if (role !== 'SUPERVISOR' && role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const users = await prisma.profile.findMany({
      where: { is_active: true },
      select: { id: true, full_name: true, role: true },
      orderBy: { full_name: 'asc' }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Assignable users fetch error:', error);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}
