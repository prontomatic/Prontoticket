import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const status = searchParams.get('status');
  const assignedTo = searchParams.get('assigned_to');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

  // Si la búsqueda es muy corta y no hay filtros, devolver vacío
  if (q.length < 2 && !status && !assignedTo && !dateFrom && !dateTo) {
    return NextResponse.json([]);
  }

  const where = { AND: [] };

  // Búsqueda de texto en múltiples campos
  if (q.length >= 2) {
    const textConditions = [
      { subject: { contains: q, mode: 'insensitive' } },
      { client_email: { contains: q, mode: 'insensitive' } },
      { client_rut: { contains: q, mode: 'insensitive' } },
      { agent: { full_name: { contains: q, mode: 'insensitive' } } },
    ];

    // Si el query es un número (o empieza con #), buscar también por ID
    const numericMatch = q.match(/^#?(\d+)$/);
    if (numericMatch) {
      const ticketId = parseInt(numericMatch[1], 10);
      if (!isNaN(ticketId)) {
        textConditions.push({ id: ticketId });
      }
    }

    where.AND.push({ OR: textConditions });
  }

  // Filtros adicionales
  if (status) where.AND.push({ status });
  if (assignedTo) {
    where.AND.push({
      assigned_to: assignedTo === 'unassigned' ? null : assignedTo
    });
  }
  if (dateFrom) {
    where.AND.push({ created_at: { gte: new Date(dateFrom) } });
  }
  if (dateTo) {
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    where.AND.push({ created_at: { lte: endOfDay } });
  }

  // Permisos por rol: AGENTE solo ve tickets sin asignar o propios
  if (user.profile.role === 'AGENTE') {
    where.AND.push({
      OR: [
        { assigned_to: null },
        { assigned_to: user.id }
      ]
    });
  }

  // Si no se agregó ningún AND, limpiar el objeto
  if (where.AND.length === 0) delete where.AND;

  try {
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        category: { select: { name: true } },
        agent: { select: { full_name: true } }
      },
      orderBy: { updated_at: 'desc' },
      take: limit
    });
    return NextResponse.json(tickets);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Error en búsqueda' }, { status: 500 });
  }
}
