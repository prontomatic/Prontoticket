import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function DELETE(request, context) {
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

  try {
    await prisma.filteredEmail.delete({ where: { id: filteredId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar correo filtrado' }, { status: 500 });
  }
}
