import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { getAllTemplates, setTemplate, resetTemplate } from '@/services/templateService';

export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const templates = await getAllTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 });
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

  const { key, subject, body } = json;
  if (!key || !subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'key, subject y body son obligatorios' }, { status: 400 });
  }

  try {
    const updated = await setTemplate(key, subject.trim(), body.trim());
    return NextResponse.json(updated);
  } catch (error) {
    if (error.message.includes('desconocida')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al guardar plantilla' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key es obligatorio' }, { status: 400 });
  }

  try {
    const defaultTemplate = await resetTemplate(key);
    return NextResponse.json({ success: true, ...defaultTemplate });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
