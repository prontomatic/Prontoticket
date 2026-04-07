import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, { params }) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = parseInt(params.id, 10);
  const body = await request.json();

  const allowedFields = {};
  if (body.name !== undefined) allowedFields.name = body.name.trim();
  if (body.description !== undefined) allowedFields.description = body.description?.trim() || null;
  if (body.is_active !== undefined) allowedFields.is_active = body.is_active;

  try {
    const updated = await prisma.category.update({ where: { id }, data: allowedFields });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar categoría' }, { status: 500 });
  }
}
