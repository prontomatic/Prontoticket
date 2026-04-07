import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/authService';

export async function GET(request) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(user.profile);
}
