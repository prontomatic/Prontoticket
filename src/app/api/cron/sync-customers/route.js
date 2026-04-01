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
  const limit = 1000; // Aumentado de 100 a 1000 para reducir número de requests
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

      // Filtrar registros válidos (con email)
      const validRecords = records.filter(r => r.email && r.email.trim() !== '');

      if (validRecords.length > 0) {
        // Bulk upsert usando INSERT ... ON CONFLICT para procesar todos los registros del lote en una sola query
        const values = validRecords.map(r => ({
          email: r.email.trim().toLowerCase(),
          rut: r.rut || null,
          telefono: r.telefono || null,
          direccion: r.direccion && r.direccion !== '0' ? r.direccion : null,
        }));

        try {
          // Usar createMany con skipDuplicates para insertar nuevos registros
          // y luego updateMany para actualizar los existentes
          await prisma.$transaction(async (tx) => {
            // Paso 1: Insertar nuevos registros (ignorar duplicados)
            await tx.customer.createMany({
              data: values,
              skipDuplicates: true,
            });

            // Paso 2: Actualizar registros existentes uno por uno solo si hay cambios
            // Esto es necesario porque createMany con skipDuplicates no actualiza existentes
            for (const v of values) {
              await tx.customer.updateMany({
                where: { email: v.email },
                data: {
                  rut: v.rut,
                  telefono: v.telefono,
                  direccion: v.direccion,
                  synced_at: new Date(),
                },
              });
            }
          });

          results.synced += validRecords.length;
        } catch (batchError) {
          console.error(`[SyncCustomers] Error en lote offset ${offset}:`, batchError);
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
