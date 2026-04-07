import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

// GET — Listar todos los usuarios
export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const profiles = await prisma.profile.findMany({
    orderBy: { created_at: 'asc' }
  });

  return NextResponse.json(profiles);
}

// POST — Crear nuevo usuario
export async function POST(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, full_name, role, password } = await request.json();

  if (!email || !full_name || !role || !password) {
    return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
  }

  try {
    // Crear usuario en Supabase Auth usando service role
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    // Crear perfil en tabla Profile
    const profile = await prisma.profile.create({
      data: {
        id: authData.user.id,
        email,
        full_name,
        role,
        is_active: true
      }
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
