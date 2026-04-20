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

/**
 * Construye el filtro WHERE de fechas priorizando rango personalizado sobre preset.
 */
function buildDateWhere(period, dateFrom, dateTo) {
    // Prioridad 1: rango personalizado (date_from / date_to)
    if (dateFrom || dateTo) {
        const where = {};
        if (dateFrom) where.gte = new Date(dateFrom);
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            where.lte = end;
        }
        return { created_at: where };
    }
    // Prioridad 2: preset
    const periodStart = getPeriodStart(period);
    return periodStart ? { created_at: { gte: periodStart } } : {};
}

export async function GET(request) {
    const user = await authenticateUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['SUPERVISOR', 'ADMINISTRADOR'].includes(user.profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const periodWhere = buildDateWhere(period, dateFrom, dateTo);
    const effectiveStart = periodWhere.created_at?.gte || null;
    const baseWhere = { ...periodWhere, deleted_at: null };

    try {
        const t0 = Date.now();

        // ============================================================
        // BLOQUE A — Queries independientes en PARALELO
        // Antes: 8 queries secuenciales ~1.5-2s
        // Ahora: se ejecutan todas al mismo tiempo, el total es el tiempo
        // de la query más lenta (~200-400ms)
        // ============================================================
        const [
            totalTickets,
            openTickets,
            closedTicketsData,
            ticketsWithFirstResponse,
            byStatusRaw,
            ticketDates,
            agents,
            byCategoryRaw,
            categories,
            // Agregaciones por agente (reemplazan el loop N+1)
            agentAssignedCounts,
            agentClosedData,
            agentFirstResponseData
        ] = await Promise.all([
            // 1. Total de tickets en el período
            prisma.ticket.count({ where: baseWhere }),

            // 2. Tickets abiertos (global, no depende del período)
            prisma.ticket.count({ where: { status: { not: 'CERRADO' }, deleted_at: null } }),

            // 3. Tickets cerrados del período: created_at y closed_at para calcular promedio
            prisma.ticket.findMany({
                where: { status: 'CERRADO', closed_at: { not: null }, ...baseWhere },
                select: { created_at: true, closed_at: true, assigned_to: true }
            }),

            // 4. Primera respuesta de agente por ticket (para tiempo promedio global)
            prisma.ticket.findMany({
                where: baseWhere,
                select: {
                    created_at: true,
                    assigned_to: true,
                    messages: {
                        where: { sender_type: 'AGENTE', author_id: { not: null } },
                        orderBy: { sent_at: 'asc' },
                        take: 1,
                        select: { sent_at: true, author_id: true }
                    }
                }
            }),

            // 5. Distribución por estado
            prisma.ticket.groupBy({
                by: ['status'],
                _count: true,
                where: baseWhere
            }),

            // 6. Fechas de creación de tickets para tendencia diaria
            prisma.ticket.findMany({
                where: baseWhere,
                select: { created_at: true },
                orderBy: { created_at: 'asc' }
            }),

            // 7. Agentes activos (metadata, NO consulta de tickets)
            prisma.profile.findMany({
                where: { is_active: true },
                select: { id: true, full_name: true, role: true }
            }),

            // 8. Distribución por categoría
            prisma.ticket.groupBy({
                by: ['category_id'],
                _count: true,
                where: baseWhere
            }),

            // 9. Catálogo de categorías para mapear nombres
            prisma.category.findMany({ select: { id: true, name: true } }),

            // ============================================================
            // AGREGACIONES POR AGENTE — reemplazan el loop N+1 (4 queries × N agentes)
            // por 3 queries totales con groupBy a nivel de BD
            // ============================================================

            // 10. Tickets asignados a cada agente (NO cerrados, global)
            prisma.ticket.groupBy({
                by: ['assigned_to'],
                _count: true,
                where: {
                    assigned_to: { not: null },
                    status: { not: 'CERRADO' },
                    deleted_at: null
                }
            }),

            // 11. Tickets cerrados en el período por agente (para count y avg resolución)
            //     Traemos filas mínimas y agregamos en JS (necesitamos calcular avg sobre el
            //     diff closed_at - created_at, que Prisma no soporta directo)
            prisma.ticket.findMany({
                where: {
                    ...baseWhere,
                    status: 'CERRADO',
                    closed_at: { not: null },
                    assigned_to: { not: null }
                },
                select: {
                    assigned_to: true,
                    created_at: true,
                    closed_at: true
                }
            }),

            // 12. Primera respuesta de agente en el período (para avg first response por agente)
            prisma.ticket.findMany({
                where: { ...baseWhere, assigned_to: { not: null } },
                select: {
                    created_at: true,
                    assigned_to: true,
                    messages: {
                        where: { sender_type: 'AGENTE', author_id: { not: null } },
                        orderBy: { sent_at: 'asc' },
                        take: 1,
                        select: { sent_at: true, author_id: true }
                    }
                }
            })
        ]);

        console.info(`[Metricas] Queries paralelas completadas en ${Date.now() - t0}ms`);

        // ============================================================
        // BLOQUE B — Cálculos en memoria (sin queries adicionales)
        // ============================================================

        // KPIs
        const avgResolutionHours = closedTicketsData.length > 0
            ? closedTicketsData.reduce((sum, t) => sum + (new Date(t.closed_at) - new Date(t.created_at)) / (1000 * 60 * 60), 0) / closedTicketsData.length
            : 0;

        const ticketsWithResp = ticketsWithFirstResponse.filter(t => t.messages.length > 0);
        const avgFirstResponseHours = ticketsWithResp.length > 0
            ? ticketsWithResp.reduce((sum, t) => sum + (new Date(t.messages[0].sent_at) - new Date(t.created_at)) / (1000 * 60 * 60), 0) / ticketsWithResp.length
            : 0;

        // Distribución por estado
        const byStatus = byStatusRaw.map(item => ({ status: item.status, count: item._count }));

        // Tendencia diaria
        const trendMap = {};
        ticketDates.forEach(t => {
            const day = new Date(t.created_at).toISOString().split('T')[0];
            trendMap[day] = (trendMap[day] || 0) + 1;
        });
        if (effectiveStart) {
            const current = new Date(effectiveStart);
            const endDate = dateTo ? new Date(dateTo) : new Date();
            while (current <= endDate) {
                const key = current.toISOString().split('T')[0];
                if (!trendMap[key]) trendMap[key] = 0;
                current.setDate(current.getDate() + 1);
            }
        }
        const trend = Object.entries(trendMap).sort().map(([date, count]) => ({ date, count }));

        // Distribución por categoría
        const byCategory = byCategoryRaw.map(item => ({
            name: item.category_id
                ? categories.find(c => c.id === item.category_id)?.name || 'Desconocida'
                : 'Sin categoría',
            count: item._count
        }));

        // ============================================================
        // BLOQUE C — Desempeño por agente (cálculo en memoria, sin queries)
        // Los 3 datasets (agentAssignedCounts, agentClosedData, agentFirstResponseData)
        // ya traen todo lo necesario. Solo agrupamos en JS por assigned_to.
        // ============================================================

        // Mapa: agent_id → count de asignados abiertos
        const assignedByAgent = {};
        agentAssignedCounts.forEach(item => {
            if (item.assigned_to) assignedByAgent[item.assigned_to] = item._count;
        });

        // Mapa: agent_id → { count cerrados, suma horas resolución }
        const closedByAgent = {};
        agentClosedData.forEach(t => {
            const agentId = t.assigned_to;
            if (!agentId) return;
            if (!closedByAgent[agentId]) closedByAgent[agentId] = { count: 0, sumHours: 0 };
            closedByAgent[agentId].count += 1;
            closedByAgent[agentId].sumHours += (new Date(t.closed_at) - new Date(t.created_at)) / (1000 * 60 * 60);
        });

        // Mapa: agent_id → { count con respuesta, suma horas primera respuesta }
        // Solo contamos la primera respuesta si fue hecha por el agente asignado
        // (coincide con la lógica original que filtraba author_id = agent.id)
        const firstRespByAgent = {};
        agentFirstResponseData.forEach(t => {
            const agentId = t.assigned_to;
            if (!agentId || t.messages.length === 0) return;
            const firstMsg = t.messages[0];
            if (firstMsg.author_id !== agentId) return;
            if (!firstRespByAgent[agentId]) firstRespByAgent[agentId] = { count: 0, sumHours: 0 };
            firstRespByAgent[agentId].count += 1;
            firstRespByAgent[agentId].sumHours += (new Date(firstMsg.sent_at) - new Date(t.created_at)) / (1000 * 60 * 60);
        });

        // Construir stats final por agente
        const agentStats = agents.map(agent => {
            const closedData = closedByAgent[agent.id] || { count: 0, sumHours: 0 };
            const firstRespData = firstRespByAgent[agent.id] || { count: 0, sumHours: 0 };

            const avgRes = closedData.count > 0 ? closedData.sumHours / closedData.count : 0;
            const avgFirstResp = firstRespData.count > 0 ? firstRespData.sumHours / firstRespData.count : 0;

            return {
                name: agent.full_name,
                role: agent.role,
                assigned: assignedByAgent[agent.id] || 0,
                closed: closedData.count,
                avgResolutionHours: Math.round(avgRes * 10) / 10,
                avgFirstResponseHours: Math.round(avgFirstResp * 10) / 10
            };
        });

        console.info(`[Metricas] Total endpoint: ${Date.now() - t0}ms`);

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