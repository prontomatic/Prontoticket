import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { getAllConfigs, setConfig } from '@/services/configService';

export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const configs = await getAllConfigs();
    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let json;
  try { json = await request.json(); } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, value } = json;
  if (!key || value === undefined || value === null) {
    return NextResponse.json({ error: 'key y value son obligatorios' }, { status: 400 });
  }

  try {
    const updated = await setConfig(key, String(value));
    return NextResponse.json(updated);
  } catch (error) {
    if (error.message.includes('desconocida')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
  }
}
