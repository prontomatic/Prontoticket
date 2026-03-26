import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

/**
 * Verifica el token JWT en el header Authorization y retorna el usuario autenticado con su rol.
 * Retorna null si no es válido.
 */
export async function authenticateUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  
  // Verificar token contra Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }

  // Obtener el perfil con el rol para RBAC desde la tabla Profile
  const profile = await prisma.profile.findUnique({
    where: { id: user.id }
  });

  if (!profile || !profile.is_active) {
    return null;
  }

  return {
    ...user,
    profile // Contiene id, email, full_name, role, is_active
  };
}

/**
 * Función helper para verificar permisos RBAC
 */
export function hasRequiredRole(profile, allowedRoles) {
  if (!profile || !profile.role) return false;
  return allowedRoles.includes(profile.role);
}
