"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function CajasBancosPage() {
  const [cajas, setCajas] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Estado del formulario
  const [form, setForm] = useState({
    id: '',
    fecha: new Date().toISOString().split('T')[0],
    nombre: '',
    moneda: 'USD',
    numero_cuenta: '',
    tipo_cuenta: 'Corriente',
    saldo_inicial: '',
    descripcion: ''
  });

  useEffect(() => {
    cargarCajas();
  }, []);

  const cargarCajas = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/cajas?select=*&order=created_at.desc`, {
        headers: SUPABASE_HEADERS
      });
      const data = await response.json();
      
      if (response.ok) {
        setCajas(data);
      } else {
        console.error("Error de Supabase:", data);
      }
    } catch (error) {
      console.error("Error de red:", error);
    }
    setIsLoading(false);
  };

  const guardarCaja = async () => {
    if (!form.nombre) {
      alert("⚠️ El nombre de la caja o banco es obligatorio.");
      return;
    }

    const payload = {
      nombre: form.nombre.toUpperCase(),
      moneda: form.moneda,
      numero_cuenta: form.numero_cuenta,
      tipo_cuenta: form.tipo_cuenta,
      saldo_inicial: parseFloat(form.saldo_inicial) || 0,
      saldo_actual: parseFloat(form.saldo_inicial) || 0
    };

    try {
      let url = `${SUPABASE_URL}/rest/v1/cajas`;
      let metodo = 'POST';

      if (isEditing && form.id) {
        url = `${SUPABASE_URL}/rest/v1/cajas?id=eq.${form.id}`;
        metodo = 'PATCH';
      }

      const response = await fetch(url, {
        method: metodo,
        headers: SUPABASE_HEADERS,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert(isEditing ? "✅ Caja actualizada correctamente" : "✅ Caja registrada exitosamente");
        cancelarEdicion();
        cargarCajas();
      } else {
        const errorData = await response.json();
        alert(`❌ Error de Supabase: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Error guardando:", error);
    }
  };

  const prepararEdicion = (c: any) => {
    setForm({
      id: c.id,
      fecha: new Date().toISOString().split('T')[0],
      nombre: c.nombre,
      moneda: c.moneda || 'USD',
      numero_cuenta: c.numero_cuenta || '',
      tipo_cuenta: c.tipo_cuenta || 'Corriente',
      saldo_inicial: c.saldo_inicial,
      descripcion: ''
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const cancelarEdicion = () => {
    setForm({ 
      id: '', 
      fecha: new Date().toISOString().split('T')[0], 
      nombre: '', 
      moneda: 'USD', 
      numero_cuenta: '', 
      tipo_cuenta: 'Corriente', 
      saldo_inicial: '', 
      descripcion: '' 
    });
    setIsEditing(false);
  };

  const eliminarCaja = async (id: string, nombre: string) => {
    if (!confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente: ${nombre}?`)) {
      return;
    }
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/cajas?id=eq.${id}`, {
        method: 'DELETE',
        headers: SUPABASE_HEADERS
      });
      if (response.ok) {
        alert("🗑️ Caja eliminada.");
        cargarCajas();
      }
    } catch (error) {
      alert("Error al intentar eliminar.");
    }
  };

  return (
    <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8 pb-10 ml-2 lg:ml-8">
      
      <div className="flex items-center gap-3 mb-8 border-b border-[#334155] pb-4">
        <span className="text-3xl">🏦</span>
        <div>
          <h2 className="text-2xl font-bold text-white">Gestión de Cajas y Bancos</h2>
          <p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Tesorería Principal</p>
        </div>
      </div>

      <div className={`bg-[#1e293b] p-8 rounded-2xl border ${isEditing ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-[#334155] shadow-xl'} mb-8 relative overflow-hidden transition-all duration-300`}>
        <div className="flex justify-between items-center mb-8 border-b border-[#334155] pb-4 relative z-10">
          <h3 className="text-xl font-bold text-white tracking-tight">
            {isEditing ? '✏️ Editando Caja o Banco' : '➕ Crear Nueva Caja o Banco'}
          </h3>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({...form, fecha: e.target.value})} className="w-full bg-black/30 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none transition-colors [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Moneda</label>
              <select value={form.moneda} onChange={(e) => setForm({...form, moneda: e.target.value})} className="w-full bg-black/30 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none transition-colors appearance-none font-bold">
                <option value="USD">Dólares (USD)</option>
                <option value="Bs">Bolívares (Bs)</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre de la Caja / Banco</label>
              <input type="text" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} placeholder="EJ: BANESCO PRINCIPAL" className="w-full bg-black/30 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none transition-colors font-bold uppercase placeholder:text-slate-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de Cuenta</label>
              <select value={form.tipo_cuenta} onChange={(e) => setForm({...form, tipo_cuenta: e.target.value})} className="w-full bg-black/30 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none transition-colors appearance-none">
                <option value="Corriente">Corriente</option>
                <option value="Ahorro">Ahorro</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Digital">Digital (Zelle, etc.)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Número de Cuenta / ID</label>
              <input type="text" value={form.numero_cuenta} onChange={(e) => setForm({...form, numero_cuenta: e.target.value})} placeholder="Nro. Cuenta o Correo Electrónico" className="w-full bg-black/30 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none transition-colors font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-[11px] font-bold text-[#38bdf8] uppercase tracking-wider mb-2">Saldo Inicial</label>
              <input 
                type="number" 
                value={form.saldo_inicial} 
                onChange={(e) => setForm({...form, saldo_inicial: e.target.value})} 
                disabled={isEditing} 
                placeholder="0.00" 
                className={`w-full rounded-lg p-3 text-lg font-mono font-black outline-none transition-colors ${isEditing ? 'bg-transparent border-b border-[#334155] text-slate-500 cursor-not-allowed' : 'bg-black/50 border border-[#38bdf8]/30 text-white focus:border-[#38bdf8]'}`} 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Descripción (Opcional)</label>
              <input type="text" value={form.descripcion} onChange={(e) => setForm({...form, descripcion: e.target.value})} placeholder="Ej: Cuenta para nómina..." className="w-full bg-black/30 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none transition-colors" />
            </div>
          </div>

          {/* AQUÍ ESTÁ EL CAMBIO: justify-center para centrar el botón */}
          <div className="flex justify-center gap-4 pt-6 mt-6 border-t border-[#334155]">
            <button onClick={guardarCaja} className={`px-16 font-black py-4 rounded-xl transition-all tracking-widest uppercase text-sm ${isEditing ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-[#10b981] hover:bg-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'}`}>
              {isEditing ? '💾 ACTUALIZAR' : '💾 GUARDAR'}
            </button>
            {isEditing && (
              <button onClick={cancelarEdicion} className="px-8 bg-transparent border border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white font-bold py-4 rounded-xl transition-all uppercase text-sm">
                CANCELAR
              </button>
            )}
          </div>

        </div>
      </div>

      <div className="bg-[#1e293b] rounded-2xl border border-[#334155] overflow-hidden shadow-xl overflow-x-auto">
        <div className="p-4 bg-black/20 border-b border-[#334155]">
          <h3 className="font-bold text-slate-300 text-sm uppercase tracking-widest">Cuentas Registradas</h3>
        </div>
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-[#0f172a] text-slate-400 text-[10px] uppercase tracking-wider border-b border-[#334155]">
            <tr>
              <th className="p-4">Banco / Caja</th>
              <th className="p-4">Nro. Cuenta</th>
              <th className="p-4 text-center">Tipo</th>
              <th className="p-4 text-center">Moneda</th>
              <th className="p-4 text-right">Saldo Inicial</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Cargando desde Supabase...</td></tr>
            ) : cajas.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay cajas registradas aún.</td></tr>
            ) : (
              cajas.map((c: any) => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold text-white uppercase">{c.nombre}</td>
                  <td className="p-4 text-slate-400 font-mono text-xs">{c.numero_cuenta || '---'}</td>
                  <td className="p-4 text-center text-slate-400">{c.tipo_cuenta || '---'}</td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded text-[10px] font-bold ${c.moneda === 'USD' ? 'bg-[#38bdf8]/10 text-[#38bdf8]' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {c.moneda || '---'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-slate-300">
                    {c.saldo_inicial != null ? parseFloat(c.saldo_inicial).toLocaleString('de-DE', { minimumFractionDigits: 2 }) : '0,00'}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-4 text-lg">
                      <button onClick={() => prepararEdicion(c)} className="text-amber-400 hover:text-amber-300 transition-transform hover:scale-110" title="Editar">✏️</button>
                      <button onClick={() => eliminarCaja(c.id, c.nombre)} className="text-rose-500 hover:text-rose-400 transition-transform hover:scale-110" title="Eliminar">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}