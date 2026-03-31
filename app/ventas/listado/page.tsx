"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function ListadoPresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('Todos');

  useEffect(() => {
    cargarPresupuestos();
  }, [filtroEstatus]);

  const cargarPresupuestos = async () => {
    setIsLoading(true);
    try {
      let url = `${SUPABASE_URL}/rest/v1/presupuestos?order=nro_presupuesto.desc`;
      if (filtroEstatus !== 'Todos') {
        url += `&estatus=eq.${filtroEstatus}`;
      }

      const res = await fetch(url, { headers: SUPABASE_HEADERS });
      if (res.ok) {
        setPresupuestos(await res.json());
      }
    } catch (error) {
      console.error("Error cargando presupuestos:", error);
    }
    setIsLoading(false);
  };

  const cambiarEstatus = async (id: string, nuevoEstatus: string) => {
    if (!confirm(`¿Estás seguro de marcar este presupuesto como ${nuevoEstatus}?`)) return;
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/presupuestos?id=eq.${id}`, {
        method: 'PATCH',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({ estatus: nuevoEstatus })
      });

      if (res.ok) {
        cargarPresupuestos(); 
      } else {
        alert("❌ Error al actualizar el estatus.");
      }
    } catch (error) {
      alert("❌ Error de conexión.");
    }
  };

  const eliminarPresupuesto = async (id: string) => {
    if (!confirm("⚠️ ¿Estás seguro de eliminar este presupuesto definitivamente?")) return;
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/presupuestos?id=eq.${id}`, {
        method: 'DELETE',
        headers: SUPABASE_HEADERS
      });

      if (res.ok) {
        cargarPresupuestos();
      }
    } catch (error) {
      alert("❌ Error al eliminar.");
    }
  };

  const filtrados = presupuestos.filter(p => 
    p.nro_presupuesto?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.cliente_razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.cliente_rif?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-300 max-w-[98%] mx-auto space-y-6 pb-10 ml-2 lg:ml-6 mt-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#334155] pb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🗂️</span>
          <div>
            <h2 className="text-2xl font-bold text-white">Gestión de Presupuestos</h2>
            <p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Área Comercial y Cotizaciones</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full md:w-64">
            <input 
              type="text" 
              placeholder="Buscar cliente, Nro o RIF..." 
              className="w-full bg-[#1e293b] border border-[#334155] rounded-lg py-2 px-4 text-sm text-white focus:border-[#38bdf8] outline-none transition-colors"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <span className="absolute right-3 top-2.5 opacity-30">🔍</span>
          </div>
          
          <a href="/ventas" className="bg-[#10b981] hover:bg-emerald-400 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all whitespace-nowrap text-center">
            + Nuevo Presupuesto
          </a>
        </div>
      </div>

      <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl overflow-hidden">
        
        {/* MENÚ DE FILTROS RÁPIDOS */}
        <div className="flex items-center gap-2 bg-[#0f172a] p-1.5 rounded-xl border border-[#334155] overflow-x-auto w-full mb-6">
          {['Todos', 'Borrador', 'Enviado', 'Aprobado', 'Rechazado'].map((estatus) => (
            <button 
              key={estatus}
              onClick={() => setFiltroEstatus(estatus)}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-[11px] font-black uppercase transition-all whitespace-nowrap ${
                filtroEstatus === estatus 
                  ? 'bg-slate-700 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {estatus}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#0f172a] text-slate-400 text-[10px] uppercase tracking-wider border-b border-[#334155]">
              <tr>
                <th className="p-4 w-28">Nro. Presup.</th>
                <th className="p-4 w-24">Fecha</th>
                <th className="p-4">Cliente / Razón Social</th>
                <th className="p-4 w-32 text-center">Estatus</th>
                <th className="p-4 w-32 text-right">Total</th>
                <th className="p-4 w-48 text-center">Gestión Comercial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {isLoading ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">Cargando presupuestos...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <div className="text-4xl mb-4">📭</div>
                    <p className="text-slate-400 font-bold text-sm">No hay presupuestos en esta categoría.</p>
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 font-mono font-black text-[#38bdf8] text-sm">{p.nro_presupuesto}</td>
                    <td className="p-4 text-slate-400 font-mono">{p.fecha}</td>
                    <td className="p-4">
                      <div className="font-bold text-white uppercase">{p.cliente_razon_social}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">RIF: {p.cliente_rif}</div>
                    </td>
                    <td className="p-4 text-center">
                      {p.estatus === 'Borrador' && <span className="bg-slate-600/30 text-slate-400 border border-slate-600/50 px-3 py-1 rounded text-[10px] font-bold uppercase">📝 Borrador</span>}
                      {p.estatus === 'Enviado' && <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1 rounded text-[10px] font-bold uppercase">✉️ Enviado</span>}
                      {p.estatus === 'Aprobado' && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded text-[10px] font-bold uppercase">✅ Aprobado</span>}
                      {p.estatus === 'Rechazado' && <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded text-[10px] font-bold uppercase">❌ Rechazado</span>}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-emerald-400 text-sm">
                      {p.moneda || 'Bs'} {parseFloat(p.total_usd).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      {/* BOTONES DE ACCIÓN ACTUALIZADOS */}
                      <div className="flex justify-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        
                        {p.estatus !== 'Aprobado' && (
                          <button onClick={() => cambiarEstatus(p.id, 'Aprobado')} className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white px-2 py-1.5 rounded transition-colors text-[10px] font-bold uppercase border border-emerald-500/50" title="Marcar como Aprobado">
                            ✅
                          </button>
                        )}
                        
                        <a href={`/ventas?id=${p.id}`} className="bg-slate-700 hover:bg-[#38bdf8] text-white px-2 py-1.5 rounded transition-colors text-[10px] font-bold uppercase border border-[#475569] flex items-center" title="Ver y Editar">
                          👁️ Edit
                        </a>

                        <a href={`/ventas?id=${p.id}&print=true`} className="bg-slate-700 hover:bg-emerald-500 text-white px-2 py-1.5 rounded transition-colors text-[10px] font-bold uppercase border border-[#475569] flex items-center" title="Imprimir PDF">
                          🖨️
                        </a>
                        
                        <button onClick={() => eliminarPresupuesto(p.id)} className="bg-slate-700 hover:bg-rose-500 text-white px-2 py-1.5 rounded transition-colors text-[10px] font-bold uppercase border border-[#475569] flex items-center" title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}