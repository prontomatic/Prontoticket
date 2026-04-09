import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMINISTRADOR', 'SUPERVISOR'].includes(user.profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const categorias = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(categorias);
}

export async function POST(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, description } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });

  try {
    const categoria = await prisma.category.create({
      data: { name: name.trim(), description: description?.trim() || null }
    });
    return NextResponse.json(categoria, { status: 201 });
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 });
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}
