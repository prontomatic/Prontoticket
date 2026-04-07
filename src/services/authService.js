import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export async function authenticateUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: user.id }
  });

  if (!profile || !profile.is_active) return null;

  return { ...user, profile };
}

export function hasRequiredRole(profile, allowedRoles) {
  if (!profile || !profile.role) return false;
  return allowedRoles.includes(profile.role);
}
