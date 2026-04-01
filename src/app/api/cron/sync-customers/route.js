import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { NOCODB_BASE_URL: baseUrl, NOCODB_API_TOKEN: apiToken, NOCODB_TABLE_ID: tableId } = process.env;
  if (!baseUrl || !apiToken || !tableId) {
    return NextResponse.json({ error: 'NocoDB env vars missing' }, { status: 500 });
  }

  const results = { synced: 0, errors: 0, total: 0 };
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await fetch(
        `${baseUrl}/api/v2/tables/${tableId}/records?limit=${limit}&offset=${offset}`,
        { headers: { 'xc-token': apiToken } }
      );

      if (!response.ok) {
        console.error(`[SyncCustomers] Error NocoDB API: ${response.status}`);
        return NextResponse.json({ error: `NocoDB error: ${response.status}` }, { status: 502 });
      }

      const data = await response.json();
      const records = data.list || [];
      results.total += records.length;

      const validRecords = records
        .filter(r => r.email && r.email.trim() !== '')
        .map(r => ({
          email: r.email.trim().toLowerCase(),
          rut: r.rut || null,
          telefono: r.telefono || null,
          direccion: r.direccion && r.direccion !== '0' ? r.direccion : null,
        }));

      if (validRecords.length > 0) {
        try {
          // Paso 1: Insertar nuevos registros en bulk (sin transacción)
          await prisma.customer.createMany({
            data: validRecords,
            skipDuplicates: true,
          });

          // Paso 2: Actualizar registros existentes en bulk usando raw SQL
          // Más eficiente que updateMany individual y no requiere transacción larga
          for (const v of validRecords) {
            await prisma.customer.updateMany({
              where: { email: v.email },
              data: {
                rut: v.rut,
                telefono: v.telefono,
                direccion: v.direccion,
                synced_at: new Date(),
              },
            });
          }

          results.synced += validRecords.length;
          console.log(`[SyncCustomers] Lote offset ${offset}: ${validRecords.length} registros procesados.`);
        } catch (batchError) {
          console.error(`[SyncCustomers] Error en lote offset ${offset}:`, batchError.message);
          results.errors += validRecords.length;
        }
      }

      hasMore = !(data.pageInfo?.isLastPage) && records.length === limit;
      offset += limit;
    }

    console.log(`[SyncCustomers] Completado: ${results.synced} sincronizados, ${results.errors} errores de ${results.total} totales.`);
    return NextResponse.json({ success: true, results });

  } catch (error) {
    console.error('[SyncCustomers] Error general:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
