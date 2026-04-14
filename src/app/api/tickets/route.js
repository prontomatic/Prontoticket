import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const assigned_to = searchParams.get('assigned_to');
  
  const query = {
    include: {
      category: { select: { name: true }},
      agent: { select: { full_name: true } }
    },
    orderBy: { updated_at: 'desc' }
  };

  const where = { deleted_at: null };
  if (status) where.status = status;
  if (assigned_to) {
    where.assigned_to = assigned_to === 'unassigned' ? null : assigned_to;
  }
  
  if (user.profile.role === 'AGENTE') {
      where.OR = [
          { assigned_to: null },
          { assigned_to: user.id }
      ];
  }

  query.where = where;

  try {
    const tickets = await prisma.ticket.findMany(query);
    return NextResponse.json(tickets);
  } catch (error) {
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}
