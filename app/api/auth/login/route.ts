// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, password } = body;

  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  if (!adminUser || !adminPass || !secret) {
    return NextResponse.json(
      { error: 'Configuración del servidor incompleta.' },
      { status: 500 }
    );
  }

  if (username === adminUser && password === adminPass) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set('danper_session', secret, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      // 8 horas de sesión
      maxAge: 60 * 60 * 8,
    });
    return response;
  }

  return NextResponse.json(
    { error: 'Usuario o contraseña incorrectos.' },
    { status: 401 }
  );
}
