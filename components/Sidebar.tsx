"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  
  const [menusAbiertos, setMenusAbiertos] = useState<string[]>(['finanzas', 'conciliaciones', 'comercial', 'facturacion']);

  const toggleMenu = (menu: string) => {
    if (menusAbiertos.includes(menu)) {
      setMenusAbiertos(menusAbiertos.filter(m => m !== menu));
    } else {
      setMenusAbiertos([...menusAbiertos, menu]);
    }
  };

  const isMenuOpen = (menu: string) => menusAbiertos.includes(menu);
  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-72 h-screen bg-[#0f172a] text-slate-300 flex flex-col fixed left-0 top-0 border-r border-[#1e293b] shadow-2xl z-50">
      
      {/* LOGO */}
      <div className="p-6 border-b border-[#1e293b] bg-black/10">
        <h1 className="text-2xl font-black text-white tracking-tight">
          SISTEMA<span className="text-[#10b981]">VIP</span>
        </h1>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
          Princess Travel Management
        </p>
      </div>

      {/* NAVEGACIÓN DESPLEGABLE */}
      <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-2 custom-scrollbar">
        
        {/* DEPARTAMENTO: FINANZAS */}
        <div>
          <button 
            onClick={() => toggleMenu('finanzas')}
            className={`w-full flex items-center justify-between px-6 py-4 transition-all hover:bg-[#1e293b] ${isMenuOpen('finanzas') ? 'bg-[#1e293b] border-l-4 border-[#10b981]' : 'border-l-4 border-transparent'}`}
          >
            <div className="flex items-center gap-3 font-bold text-sm text-white">
              <span className="text-lg">🏦</span> Admin. y Finanzas
            </div>
            <span className={`text-xs transition-transform duration-300 ${isMenuOpen('finanzas') ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 bg-black/20 ${isMenuOpen('finanzas') ? 'max-h-[500px]' : 'max-h-0'}`}>
            <Link href="/administracion-finanzas" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/administracion-finanzas') ? 'text-[#10b981] bg-[#10b981]/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              💸 Nuevo Movimiento
            </Link>

            <Link href="/cuentas-por-cobrar" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/cuentas-por-cobrar') ? 'text-[#10b981] bg-[#10b981]/5' : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'}`}>
              📥 Cuentas por Cobrar
            </Link>

            <Link href="/cuentas-por-pagar" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/cuentas-por-pagar') ? 'text-[#10b981] bg-[#10b981]/5' : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'}`}>
              📤 Cuentas por Pagar
            </Link>
            
            <Link href="/administracion-finanzas/cajas" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/administracion-finanzas/cajas') ? 'text-[#10b981] bg-[#10b981]/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              💳 Cajas y Bancos (Config.)
            </Link>

            <Link href="/bancos" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/bancos') ? 'text-[#10b981] bg-[#10b981]/5' : 'text-slate-400 hover:text-[#38bdf8] hover:bg-[#38bdf8]/5'}`}>
              🏦 Gestión de Bancos
            </Link>

            <Link href="/caja" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/caja') ? 'text-[#10b981] bg-[#10b981]/5' : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/5'}`}>
              💰 Estado de Cuenta
            </Link>

            <Link href="/proveedores" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/proveedores') ? 'text-[#10b981] bg-[#10b981]/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              👥 Proveedores
            </Link>
          </div>
        </div>

        {/* DEPARTAMENTO: COMERCIAL */}
        <div>
          <button 
            onClick={() => toggleMenu('comercial')}
            className={`w-full flex items-center justify-between px-6 py-4 transition-all hover:bg-[#1e293b] ${isMenuOpen('comercial') ? 'bg-[#1e293b] border-l-4 border-[#10b981]' : 'border-l-4 border-transparent'}`}
          >
            <div className="flex items-center gap-3 font-bold text-sm text-white">
              <span className="text-lg">🤝</span> Gestión Comercial
            </div>
            <span className={`text-xs transition-transform duration-300 ${isMenuOpen('comercial') ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 bg-black/20 ${isMenuOpen('comercial') ? 'max-h-[500px]' : 'max-h-0'}`}>
            <Link href="/clientes" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/clientes') ? 'text-[#10b981] bg-[#10b981]/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              👥 Clientes
            </Link>
            <Link href="/ventas" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/ventas') ? 'text-[#10b981] bg-[#10b981]/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              📄 Generar Presupuestos
            </Link>
            
            {/* NUEVO: LISTADO DE PRESUPUESTOS */}
            <Link href="/ventas/listado" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all ${isActive('/ventas/listado') ? 'text-[#38bdf8] bg-[#38bdf8]/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              🗂️ Listado de Presupuestos
            </Link>
          </div>
        </div>

        {/* DEPARTAMENTO: FACTURACIÓN Y COBRANZAS */}
        <div>
          <button 
            onClick={() => toggleMenu('facturacion')}
            className={`w-full flex items-center justify-between px-6 py-4 transition-all hover:bg-[#1e293b] ${isMenuOpen('facturacion') ? 'bg-[#1e293b] border-l-4 border-[#10b981]' : 'border-l-4 border-transparent'}`}
          >
            <div className="flex items-center gap-3 font-bold text-sm text-white">
              <span className="text-lg">🧾</span> Facturación
            </div>
            <span className={`text-xs transition-transform duration-300 ${isMenuOpen('facturacion') ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 bg-black/20 ${isMenuOpen('facturacion') ? 'max-h-[500px]' : 'max-h-0'}`}>
            <Link href="/facturacion/pendientes" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all flex items-center gap-2 ${isActive('/facturacion/pendientes') ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className={`w-2 h-2 rounded-full ${isActive('/facturacion/pendientes') ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`}></span>
              Servicios por Facturar
            </Link>
            
            {/* NUEVO: LIBRO DE VENTAS */}
            <Link href="/facturacion/libro-ventas" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all flex items-center gap-2 ${isActive('/facturacion/libro-ventas') ? 'text-[#38bdf8] bg-[#38bdf8]/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              📚 Libro de Ventas
            </Link>
          </div>
        </div>

        {/* DEPARTAMENTO: CONCILIACIONES */}
        <div>
          <button 
            onClick={() => toggleMenu('conciliaciones')}
            className={`w-full flex items-center justify-between px-6 py-4 transition-all hover:bg-[#1e293b] ${isMenuOpen('conciliaciones') ? 'bg-[#1e293b] border-l-4 border-[#10b981]' : 'border-l-4 border-transparent'}`}
          >
            <div className="flex items-center gap-3 font-bold text-sm text-white">
              <span className="text-lg">⚖️</span> Conciliaciones
            </div>
            <span className={`text-xs transition-transform duration-300 ${isMenuOpen('conciliaciones') ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 bg-black/20 ${isMenuOpen('conciliaciones') ? 'max-h-[500px]' : 'max-h-0'}`}>
            
            <Link href="/conciliaciones/bancaria" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all flex items-center gap-2 ${isActive('/conciliaciones/bancaria') ? 'text-[#38bdf8] bg-[#38bdf8]/10' : 'text-slate-400 hover:text-[#38bdf8] hover:bg-[#38bdf8]/5'}`}>
              ⚖️ Conciliación Bancaria
            </Link>

            <Link href="/conciliaciones/pagos" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all flex items-center gap-2 ${isActive('/conciliaciones/pagos') ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              🔗 Conciliación de Pagos
            </Link>

            <Link href="/cuentas-socios" className={`block pl-14 pr-6 py-3 text-xs font-bold transition-all flex items-center gap-2 ${isActive('/cuentas-socios') ? 'text-purple-400 bg-purple-500/10' : 'text-slate-400 hover:text-purple-400 hover:bg-purple-500/10'}`}>
              🔄 Compensación Socios
            </Link>

          </div>
        </div>

      </nav>

      {/* FOOTER */}
      <div className="p-6 border-t border-[#1e293b] text-center bg-black/10">
        <div className="inline-flex items-center justify-center gap-2 bg-[#1e293b] rounded-full px-4 py-2 border border-[#334155]">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_8px_#10b981]"></span>
          <span className="text-[10px] font-bold text-slate-300 tracking-widest">SISTEMA ONLINE</span>
        </div>
      </div>

    </aside>
  );
}