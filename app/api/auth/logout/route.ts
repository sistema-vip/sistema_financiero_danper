// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Eliminar la cookie de sesión
  response.cookies.set('danper_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return response;
}
