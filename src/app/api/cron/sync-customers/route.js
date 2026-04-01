import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
          // Un único INSERT ... ON CONFLICT DO UPDATE para todo el lote
          // Esto es 1000x más rápido que hacer upsert/updateMany individual
          const now = new Date();

          await prisma.$executeRaw`
            INSERT INTO "Customer" (email, rut, telefono, direccion, synced_at)
            SELECT
              v.email,
              v.rut,
              v.telefono,
              v.direccion,
              ${now}::timestamp
            FROM json_to_recordset(${JSON.stringify(validRecords)}::json)
              AS v(email text, rut text, telefono text, direccion text)
            ON CONFLICT (email)
            DO UPDATE SET
              rut = EXCLUDED.rut,
              telefono = EXCLUDED.telefono,
              direccion = EXCLUDED.direccion,
              synced_at = EXCLUDED.synced_at
          `;

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
