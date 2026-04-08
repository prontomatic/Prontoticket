import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';

function getPeriodStart(period) {
    const now = new Date();
    switch (period) {
        case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        default: return null;
    }
}

export async function GET(request) {
    const user = await authenticateUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['SUPERVISOR', 'ADMINISTRADOR'].includes(user.profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const periodStart = getPeriodStart(period);
    const periodWhere = periodStart ? { created_at: { gte: periodStart } } : {};

    try {
        // 1. KPIs
        const totalTickets = await prisma.ticket.count({ where: periodWhere });
        const openTickets = await prisma.ticket.count({ where: { status: { not: 'CERRADO' } } });

        // Tiempo promedio de resolución
        const closedTickets = await prisma.ticket.findMany({
            where: { status: 'CERRADO', closed_at: { not: null }, ...periodWhere },
            select: { created_at: true, closed_at: true }
        });
        const avgResolutionHours = closedTickets.length > 0
            ? closedTickets.reduce((sum, t) => sum + (new Date(t.closed_at) - new Date(t.created_at)) / (1000 * 60 * 60), 0) / closedTickets.length
            : 0;

        // Tiempo promedio de primera respuesta (excluyendo mensajes automáticos del sistema donde author_id es null)
        const ticketsWithMessages = await prisma.ticket.findMany({
            where: periodWhere,
            select: {
                created_at: true,
                messages: {
                    where: { sender_type: 'AGENTE', author_id: { not: null } },
                    orderBy: { sent_at: 'asc' },
                    take: 1,
                    select: { sent_at: true }
                }
            }
        });
        const ticketsWithResponse = ticketsWithMessages.filter(t => t.messages.length > 0);
        const avgFirstResponseHours = ticketsWithResponse.length > 0
            ? ticketsWithResponse.reduce((sum, t) => sum + (new Date(t.messages[0].sent_at) - new Date(t.created_at)) / (1000 * 60 * 60), 0) / ticketsWithResponse.length
            : 0;

        // 2. Distribución por estado
        const byStatusRaw = await prisma.ticket.groupBy({
            by: ['status'],
            _count: true,
            where: periodWhere
        });
        const byStatus = byStatusRaw.map(item => ({ status: item.status, count: item._count }));

        // 3. Tendencia diaria (tickets creados por día)
        const ticketDates = await prisma.ticket.findMany({
            where: periodWhere,
            select: { created_at: true },
            orderBy: { created_at: 'asc' }
        });
        const trendMap = {};
        ticketDates.forEach(t => {
            const day = new Date(t.created_at).toISOString().split('T')[0];
            trendMap[day] = (trendMap[day] || 0) + 1;
        });
        // Rellenar días faltantes con 0
        if (periodStart) {
            const current = new Date(periodStart);
            const today = new Date();
            while (current <= today) {
                const key = current.toISOString().split('T')[0];
                if (!trendMap[key]) trendMap[key] = 0;
                current.setDate(current.getDate() + 1);
            }
        }
        const trend = Object.entries(trendMap).sort().map(([date, count]) => ({ date, count }));

        // 4. Desempeño por agente
        const agents = await prisma.profile.findMany({
            where: { is_active: true },
            select: { id: true, full_name: true, role: true }
        });

        const agentStats = [];
        for (const agent of agents) {
            const agentPeriodWhere = { assigned_to: agent.id, ...periodWhere };

            const assigned = await prisma.ticket.count({
                where: { assigned_to: agent.id, status: { not: 'CERRADO' } }
            });

            const closed = await prisma.ticket.count({
                where: { ...agentPeriodWhere, status: 'CERRADO' }
            });

            const agentClosed = await prisma.ticket.findMany({
                where: { ...agentPeriodWhere, status: 'CERRADO', closed_at: { not: null } },
                select: { created_at: true, closed_at: true }
            });
            const avgRes = agentClosed.length > 0
                ? agentClosed.reduce((s, t) => s + (new Date(t.closed_at) - new Date(t.created_at)) / (1000 * 60 * 60), 0) / agentClosed.length
                : 0;

            const agentTickets = await prisma.ticket.findMany({
                where: agentPeriodWhere,
                select: {
                    created_at: true,
                    messages: {
                        where: { sender_type: 'AGENTE', author_id: agent.id },
                        orderBy: { sent_at: 'asc' },
                        take: 1,
                        select: { sent_at: true }
                    }
                }
            });
            const withResp = agentTickets.filter(t => t.messages.length > 0);
            const avgFirstResp = withResp.length > 0
                ? withResp.reduce((s, t) => s + (new Date(t.messages[0].sent_at) - new Date(t.created_at)) / (1000 * 60 * 60), 0) / withResp.length
                : 0;

            agentStats.push({
                name: agent.full_name,
                role: agent.role,
                assigned,
                closed,
                avgResolutionHours: Math.round(avgRes * 10) / 10,
                avgFirstResponseHours: Math.round(avgFirstResp * 10) / 10
            });
        }

        // 5. Distribución por categoría
        const byCategoryRaw = await prisma.ticket.groupBy({
            by: ['category_id'],
            _count: true,
            where: periodWhere
        });
        const categories = await prisma.category.findMany();
        const byCategory = byCategoryRaw.map(item => ({
            name: item.category_id
                ? categories.find(c => c.id === item.category_id)?.name || 'Desconocida'
                : 'Sin categoría',
            count: item._count
        }));

        return NextResponse.json({
            kpis: {
                totalTickets,
                openTickets,
                avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
                avgFirstResponseHours: Math.round(avgFirstResponseHours * 10) / 10
            },
            byStatus,
            trend,
            agentStats,
            byCategory
        });
    } catch (error) {
        console.error('Metrics error:', error);
        return NextResponse.json({ error: 'Error fetching metrics' }, { status: 500 });
    }
}