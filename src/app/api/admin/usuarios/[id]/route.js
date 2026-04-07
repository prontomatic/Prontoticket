import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

// PATCH — Editar usuario (rol, nombre, estado activo)
export async function PATCH(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  const targetId = id;
  const body = await request.json();

  const allowedFields = {};
  if (body.full_name !== undefined) allowedFields.full_name = body.full_name;
  if (body.role !== undefined) allowedFields.role = body.role;
  if (body.is_active !== undefined) allowedFields.is_active = body.is_active;

  try {
    const updated = await prisma.profile.update({
      where: { id: targetId },
      data: allowedFields
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}
