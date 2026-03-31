import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/cron/sync-customers
 *
 * Sincroniza la tabla users de NocoDB hacia la tabla Customer de Supabase.
 * Ejecutado automáticamente por Vercel Cron Job una vez al día a las 3 AM.
 * Protegido por CRON_SECRET para evitar ejecuciones no autorizadas.
 */
export async function GET(request) {
  // Verificación de seguridad: solo Vercel Cron puede invocar este endpoint
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NOCODB_BASE_URL;
  const apiToken = process.env.NOCODB_API_TOKEN;
  const tableId = process.env.NOCODB_TABLE_ID;

  if (!baseUrl || !apiToken || !tableId) {
    console.error('[SyncCustomers] Variables de entorno de NocoDB no configuradas.');
    return NextResponse.json(
      { error: 'NocoDB environment variables not configured' },
      { status: 500 }
    );
  }

  const results = { synced: 0, errors: 0, total: 0 };

  try {
    // NocoDB pagina los resultados. Iteramos hasta traer todos los registros.
    let offset = 0;
    const limit = 100; // Traer de a 100 registros por página
    let hasMore = true;

    while (hasMore) {
      const url = `${baseUrl}/api/v2/tables/${tableId}/records?limit=${limit}&offset=${offset}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xc-token': apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`[SyncCustomers] Error NocoDB API: ${response.status} ${response.statusText}`);
        return NextResponse.json(
          { error: `NocoDB API error: ${response.status}` },
          { status: 502 }
        );
      }

      const data = await response.json();
      const records = data.list || [];
      results.total += records.length;

      // Procesar cada registro con upsert (insertar si no existe, actualizar si ya existe)
      for (const record of records) {
        if (!record.email) continue; // Saltar registros sin email

        try {
          await prisma.customer.upsert({
            where: { email: record.email },
            update: {
              rut: record.rut || null,
              telefono: record.telefono || null,
              direccion: record.direccion || null,
              synced_at: new Date()
            },
            create: {
              email: record.email,
              rut: record.rut || null,
              telefono: record.telefono || null,
              direccion: record.direccion || null,
              synced_at: new Date()
            }
          });
          results.synced++;
        } catch (upsertError) {
          console.error(`[SyncCustomers] Error al hacer upsert del cliente ${record.email}:`, upsertError);
          results.errors++;
        }
      }

      // Verificar si hay más páginas
      // NocoDB devuelve pageInfo con isLastPage o se puede verificar si records < limit
      const pageInfo = data.pageInfo || {};
      hasMore = !pageInfo.isLastPage && records.length === limit;
      offset += limit;
    }

    console.log(`[SyncCustomers] Sincronización completada: ${results.synced} registros sincronizados, ${results.errors} errores de ${results.total} totales.`);
    return NextResponse.json({ success: true, results });

  } catch (error) {
    console.error('[SyncCustomers] Error general en sincronización:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}
