"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function MaestroClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [clienteSel, setClienteSel] = useState<any>({
    nombre_razon: '', rif_cedula: '', persona_contacto: '', telefono: '', email: '', direccion: '', condicion_pago: 'Contado', dias_credito: 0, limite_credito: 0, vendedor: '', estado: 'Activo'
  });

  useEffect(() => { cargarClientes(); }, []);

  const cargarClientes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&order=nombre_razon.asc`, { headers: SUPABASE_HEADERS });
      if (res.ok) setClientes(await res.json());
    } catch (error) { console.error(error); }
    setIsLoading(false);
  };

  const guardarCliente = async () => {
    if (!clienteSel.nombre_razon || !clienteSel.rif_cedula) return alert("Nombre/Razón y RIF/Cédula son obligatorios");
    
    const esEdicion = !!clienteSel.id;
    const metodo = esEdicion ? 'PATCH' : 'POST';
    const url = esEdicion ? `${SUPABASE_URL}/rest/v1/clientes?id=eq.${clienteSel.id}` : `${SUPABASE_URL}/rest/v1/clientes`;

    try {
      const res = await fetch(url, {
        method: metodo,
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({
          ...clienteSel,
          nombre_razon: clienteSel.nombre_razon.toUpperCase(),
          rif_cedula: clienteSel.rif_cedula.toUpperCase()
        })
      });
      if (res.ok) {
        alert(esEdicion ? "✅ Actualizado" : "✅ Cliente Creado");
        setModalOpen(false);
        cargarClientes();
      }
    } catch (error) { alert("❌ Error al guardar. Verifica que el RIF no esté duplicado."); }
  };

  // NUEVA FUNCIÓN: ELIMINAR CLIENTE
  const eliminarCliente = async (id: string, nombre: string) => {
    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al cliente "${nombre}"?\n\n⚠️ IMPORTANTE: Si este cliente ya tiene recibos, facturas o deudas asociadas en el sistema, no podrá ser eliminado por seguridad financiera.`);
    
    if (!confirmar) return;

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`, {
        method: 'DELETE',
        headers: SUPABASE_HEADERS
      });

      if (res.ok) {
        alert("✅ Cliente eliminado correctamente de la base de datos.");
        cargarClientes();
      } else {
        alert("❌ OPERACIÓN DENEGADA: No se puede eliminar este cliente porque ya tiene historial financiero, cuentas por cobrar o movimientos asociados a su nombre.");
      }
    } catch (error) { 
      alert("❌ Error de conexión al intentar eliminar."); 
    }
  };

  const filtrados = clientes.filter(c => 
    c.nombre_razon?.toLowerCase().includes(busqueda.toLowerCase()) || 
    c.rif_cedula?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8 pb-10 ml-2 lg:ml-8">
      <div className="flex items-center justify-between border-b border-[#334155] pb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👥</span>
          <div>
            <h2 className="text-2xl font-bold text-white">Maestro de Clientes</h2>
            <p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Base de Datos: Princess Travel</p>
          </div>
        </div>
        <div className="flex gap-4">
          <input type="text" placeholder="Buscar cliente..." className="bg-[#1e293b] border border-[#334155] rounded-lg py-2 px-4 text-sm text-white outline-none" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <button onClick={() => { setClienteSel({nombre_razon:'', rif_cedula:'', persona_contacto:'', telefono:'', email:'', direccion:'', condicion_pago:'Contado', dias_credito:0, limite_credito:0, vendedor:'', estado:'Activo'}); setModalOpen(true); }} className="bg-[#10b981] hover:bg-emerald-400 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase">+ Nuevo Cliente</button>
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-2xl border border-[#334155] shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0f172a] text-slate-400 uppercase tracking-widest border-b border-[#334155]">
            <tr>
              <th className="p-4">Nombre / RIF</th>
              <th className="p-4">Contacto</th>
              <th className="p-4">Condición</th>
              <th className="p-4">Vendedor</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]">
            {isLoading ? (<tr><td colSpan={5} className="p-10 text-center text-slate-500">Cargando datos...</td></tr>) : 
            filtrados.map(c => (
              <tr key={c.id} className="hover:bg-white/5 transition-colors text-white">
                <td className="p-4">
                  <div className="font-bold text-sm uppercase">{c.nombre_razon}</div>
                  <div className="text-[#38bdf8] font-mono text-[10px]">{c.rif_cedula}</div>
                </td>
                <td className="p-4 text-slate-400">
                  <div className="font-bold">{c.persona_contacto || '---'}</div>
                  <div className="text-[10px]">{c.email}</div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${c.condicion_pago === 'Crédito' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {c.condicion_pago}
                  </span>
                </td>
                <td className="p-4 text-slate-400 uppercase font-bold">{c.vendedor || '---'}</td>
                
                {/* BOTONES DE ACCIÓN (EDITAR Y ELIMINAR) */}
                <td className="p-4">
                  <div className="flex justify-center items-center gap-4">
                    <button onClick={() => { setClienteSel(c); setModalOpen(true); }} className="text-amber-400 font-bold hover:underline transition-all">EDITAR</button>
                    <span className="text-slate-600">|</span>
                    <button onClick={() => eliminarCliente(c.id, c.nombre_razon)} className="text-rose-400 font-bold hover:underline transition-all">ELIMINAR</button>
                  </div>
                </td>
                
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL PARA TUS COLUMNAS REALES */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] w-full max-w-3xl rounded-2xl border border-[#334155] shadow-2xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-[#334155] pb-4 uppercase font-black tracking-tighter">Ficha Maestra de Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre o Razón Social</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold" value={clienteSel.nombre_razon} onChange={(e)=>setClienteSel({...clienteSel, nombre_razon: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">RIF / Cédula</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono" value={clienteSel.rif_cedula} onChange={(e)=>setClienteSel({...clienteSel, rif_cedula: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Persona de Contacto</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={clienteSel.persona_contacto} onChange={(e)=>setClienteSel({...clienteSel, persona_contacto: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Vendedor Asignado</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase" value={clienteSel.vendedor} onChange={(e)=>setClienteSel({...clienteSel, vendedor: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                <input type="email" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={clienteSel.email} onChange={(e)=>setClienteSel({...clienteSel, email: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono" value={clienteSel.telefono} onChange={(e)=>setClienteSel({...clienteSel, telefono: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-2 md:col-span-2 bg-black/20 p-4 rounded-xl border border-[#334155]">
                 <div>
                    <label className="text-[10px] font-bold text-purple-400 uppercase">Condición</label>
                    <select className="w-full bg-black/40 border border-[#334155] rounded-lg p-2 mt-1 text-white text-xs" value={clienteSel.condicion_pago} onChange={(e)=>setClienteSel({...clienteSel, condicion_pago: e.target.value})}>
                        <option value="Contado" className="bg-[#0f172a]">Contado</option>
                        <option value="Crédito" className="bg-[#0f172a]">Crédito</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Días Crédito</label>
                    <input type="number" className="w-full bg-black/40 border border-[#334155] rounded-lg p-2 mt-1 text-white text-xs" value={clienteSel.dias_credito} onChange={(e)=>setClienteSel({...clienteSel, dias_credito: parseInt(e.target.value)})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-emerald-400 uppercase">Límite $</label>
                    <input type="number" className="w-full bg-black/40 border border-[#334155] rounded-lg p-2 mt-1 text-white text-xs" value={clienteSel.limite_credito} onChange={(e)=>setClienteSel({...clienteSel, limite_credito: parseFloat(e.target.value)})} />
                 </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Dirección Fiscal</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={clienteSel.direccion} onChange={(e)=>setClienteSel({...clienteSel, direccion: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-4 pt-4 border-t border-[#334155]">
              <button onClick={()=>setModalOpen(false)} className="text-slate-400 font-bold hover:text-white transition-colors">CANCELAR</button>
              <button onClick={guardarCliente} className="bg-[#10b981] text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-colors uppercase text-xs shadow-[0_0_15px_rgba(16,185,129,0.2)]">Guardar y Sincronizar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}