import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['SUPERVISOR', 'ADMINISTRADOR'].includes(user.profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30', 10);
  const search = searchParams.get('search')?.trim() || '';

  const since = new Date();
  since.setDate(since.getDate() - days);

  const where = { filtered_at: { gte: since } };

  if (search.length >= 2) {
    where.OR = [
      { from_email: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { from_name: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const emails = await prisma.filteredEmail.findMany({
      where,
      orderBy: { filtered_at: 'desc' },
      take: 200
    });
    return NextResponse.json(emails);
  } catch (error) {
    console.error('Error fetching filtered emails:', error);
    return NextResponse.json({ error: 'Error al obtener correos filtrados' }, { status: 500 });
  }
}
