'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (res.ok) {
          router.push('/');
          router.refresh();
        } else {
          const data = await res.json();
          setError(data.error || 'Error al iniciar sesión.');
        }
      } catch {
        setError('Error de conexión. Intenta de nuevo.');
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Fondo animado con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#0c1a2e] to-[#0f172a]" />

      {/* Esferas decorativas de fondo */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-[#10b981]/8 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-[#38bdf8]/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#10b981]/3 rounded-full blur-[80px]" />

      {/* Tarjeta de login */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div
          className="bg-[#0f172a]/80 border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden"
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center border-b border-[#1e293b]/60">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#0ea572] shadow-lg shadow-[#10b981]/20 mb-5">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M6 24L16 8L26 24H6Z" stroke="white" strokeWidth="2" strokeLinejoin="round" fill="none"/>
                <path d="M10 24L16 14L22 24" stroke="white" strokeWidth="1.5" strokeLinejoin="round" strokeOpacity="0.6" fill="none"/>
                <circle cx="16" cy="8" r="2" fill="white"/>
              </svg>
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight">
              SISTEMA<span className="text-[#10b981]">VIP</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Princess Travel Management
            </p>
            <p className="text-slate-400 text-sm mt-3">
              Accede con tus credenciales de administrador
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 animate-in fade-in">
                <span className="text-rose-400 text-lg">⚠️</span>
                <p className="text-rose-400 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Campo: Usuario */}
            <div className="space-y-2">
              <label htmlFor="login-username" className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                Usuario
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">👤</span>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  required
                  className="w-full bg-[#1e293b] border border-[#334155] rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/40 transition-all"
                />
              </div>
            </div>

            {/* Campo: Contraseña */}
            <div className="space-y-2">
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔑</span>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  required
                  className="w-full bg-[#1e293b] border border-[#334155] rounded-xl pl-11 pr-12 py-3.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-sm"
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Botón */}
            <button
              id="btn-ingresar"
              type="submit"
              disabled={isPending}
              className="w-full bg-gradient-to-r from-[#10b981] to-[#0ea572] hover:from-[#0ea572] hover:to-[#059669] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-[#10b981]/20 hover:shadow-[#10b981]/30 hover:-translate-y-0.5 active:translate-y-0 mt-2"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : (
                '🔐 Ingresar al Sistema'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-8 pb-7 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                Sistema Seguro — Acceso Restringido
              </span>
            </div>
          </div>
        </div>

        {/* Año */}
        <p className="text-center text-slate-700 text-xs mt-4">
          © {new Date().getFullYear()} SISTEMA VIP · Princess Travel
        </p>
      </div>
    </div>
  );
}
