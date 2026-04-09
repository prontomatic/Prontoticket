import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';
import { prisma } from '@/lib/prisma';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

// PATCH — Editar usuario (rol, nombre, estado activo)
export async function PATCH(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  const targetId = id;
  const body = await request.json();

  const allowedFields = {};
  if (body.full_name !== undefined) allowedFields.full_name = body.full_name;
  if (body.role !== undefined) allowedFields.role = body.role;
  if (body.is_active !== undefined) allowedFields.is_active = body.is_active;

  try {
    const updated = await prisma.profile.update({
      where: { id: targetId },
      data: allowedFields
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

// POST — Restablecer contraseña de un usuario
export async function POST(request, context) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.profile.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  const targetId = id;

  // Verificar que el usuario objetivo existe
  const targetUser = await prisma.profile.findUnique({ where: { id: targetId } });
  if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  // Generar contraseña temporal de 10 caracteres
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let tempPassword = '';
  for (let i = 0; i < 10; i++) {
    tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(targetId, {
      password: tempPassword
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      success: true,
      tempPassword,
      message: `Contraseña restablecida para ${targetUser.email}. Comunique la contraseña temporal al usuario.`
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al restablecer contraseña' }, { status: 500 });
  }
}
