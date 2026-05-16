"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function MaestroProveedoresPage() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Estados para Modal 
  const [modalOpen, setModalOpen] = useState(false);
  const [provSeleccionado, setProvSeleccionado] = useState<any>({
    codigo: '', razon_social: '', nombre_comercial: '', rif: '', direccion: '', telefono: '', correo: '',
    tipo: 'HOTEL', pais: '', ciudad: '' 
  });

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/proveedores?select=*&order=razon_social.asc`, { 
        headers: SUPABASE_HEADERS 
      });
      if (res.ok) setProveedores(await res.json());
    } catch (error) {
      console.error("Error:", error);
    }
    setIsLoading(false);
  };

  const guardarProveedor = async () => {
    if (!provSeleccionado.razon_social || !provSeleccionado.rif) return alert("Razón Social y RIF son obligatorios");
    
    const esEdicion = !!provSeleccionado.id;
    const metodo = esEdicion ? 'PATCH' : 'POST';
    const url = esEdicion ? `${SUPABASE_URL}/rest/v1/proveedores?id=eq.${provSeleccionado.id}` : `${SUPABASE_URL}/rest/v1/proveedores`;

    const codigoFinal = provSeleccionado.codigo || provSeleccionado.rif.replace(/\D/g, '').substring(0, 8);

    try {
      const res = await fetch(url, {
        method: metodo,
        headers: { ...SUPABASE_HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify({
          codigo: codigoFinal,
          rif: provSeleccionado.rif.toUpperCase(),
          razon_social: provSeleccionado.razon_social.toUpperCase(),
          nombre_comercial: provSeleccionado.nombre_comercial ? provSeleccionado.nombre_comercial.toUpperCase() : null,
          direccion: provSeleccionado.direccion,
          telefono: provSeleccionado.telefono,
          correo: provSeleccionado.correo,
          tipo: provSeleccionado.tipo,
          pais: provSeleccionado.pais ? provSeleccionado.pais.toUpperCase() : null,
          ciudad: provSeleccionado.ciudad ? provSeleccionado.ciudad.toUpperCase() : null
        })
      });
      if (res.ok) {
        alert(esEdicion ? "✅ Datos actualizados" : "✅ Proveedor creado con éxito");
        setModalOpen(false);
        cargarProveedores();
      } else {
        alert("❌ Error al guardar. Verifica que el RIF no esté duplicado.");
      }
    } catch (error) {
      alert("❌ Error de conexión");
    }
  };

  const eliminarProveedor = async (id: string) => {
    if (!confirm("⚠️ ¿Estás seguro? Se eliminará el registro de este proveedor permanentemente.")) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/proveedores?id=eq.${id}`, {
        method: 'DELETE',
        headers: SUPABASE_HEADERS
      });
      if (res.ok) cargarProveedores();
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  const filtrados = proveedores.filter(p => 
    p.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.nombre_comercial?.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.rif?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.ciudad?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.tipo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // MAGIA: Formateador Inteligente de RIF y Cédula
  const manejarCambioRif = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valorRif = e.target.value.toUpperCase().replace(/[^JVEGP0-9]/g, '');
    
    if (valorRif.length > 1) {
      valorRif = valorRif.substring(0, 1) + '-' + valorRif.substring(1);
    }
    if (valorRif.length > 10) {
      valorRif = valorRif.substring(0, 10) + '-' + valorRif.substring(10, 11);
    }
    if (valorRif.length > 12) {
      valorRif = valorRif.substring(0, 12);
    }

    const soloNumeros = valorRif.replace(/\D/g, '').substring(0, 8);
    
    setProvSeleccionado({
      ...provSeleccionado,
      rif: valorRif,
      codigo: provSeleccionado.id ? provSeleccionado.codigo : soloNumeros
    });
  };

  return (
    <div className="animate-in fade-in duration-300 max-w-[95%] mx-auto space-y-8 pb-10 ml-2 lg:ml-8">
      
      {/* CABECERA */}
      <div className="flex items-center justify-between border-b border-[#334155] pb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👥</span>
          <div>
            <h2 className="text-2xl font-bold text-white">Maestro de Proveedores</h2>
            <p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Directorio Comercial VIP</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="relative w-72">
            <input 
              type="text" 
              placeholder="Buscar por código, nombre o RIF..." 
              className="w-full bg-[#1e293b] border border-[#334155] rounded-lg py-2 px-4 text-sm text-white focus:border-[#38bdf8] outline-none"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <span className="absolute right-3 top-2.5 opacity-30">🔍</span>
          </div>
          <button 
            onClick={() => { setProvSeleccionado({codigo: '', razon_social: '', nombre_comercial: '', rif: '', direccion: '', telefono: '', correo: '', tipo: 'HOTEL', pais: '', ciudad: ''}); setModalOpen(true); }}
            className="bg-[#10b981] hover:bg-emerald-400 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase transition-all shadow-lg"
          >
            + Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* TABLA REDISEÑADA */}
      <div className="bg-[#1e293b] rounded-2xl border border-[#334155] shadow-xl overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-[#0f172a] text-slate-400 uppercase tracking-widest border-b border-[#334155]">
            <tr>
              <th className="p-4">CÓDIGO</th>
              <th className="p-4">PROVEEDOR / DATOS FISCALES</th>
              <th className="p-4 text-center">CATEGORÍA</th>
              <th className="p-4">UBICACIÓN</th>
              <th className="p-4">TELÉFONO</th>
              <th className="p-4 text-center">ACCIONES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]">
            {isLoading ? (
              <tr><td colSpan={6} className="p-10 text-center text-slate-500">Cargando directorio...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={6} className="p-10 text-center text-slate-500">No hay proveedores registrados.</td></tr>
            ) : filtrados.map(p => (
              <tr key={p.id} className="hover:bg-white/5 transition-colors text-white">
                <td className="p-4">
                  <span className="text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                    {p.codigo}
                  </span>
                </td>
                <td className="p-4">
                  <div className="font-bold text-sm uppercase text-amber-400">{p.nombre_comercial || p.razon_social}</div>
                  {p.nombre_comercial && <div className="text-slate-400 text-[10px] uppercase mt-1">RS: {p.razon_social}</div>}
                  <div className="text-[#38bdf8] font-mono text-[10px] mt-1">RIF: {p.rif}</div>
                </td>
                <td className="p-4 text-center">
                  <span className="px-3 py-1 bg-[#0f172a] border border-[#334155] text-slate-300 rounded font-bold text-[10px] uppercase">
                    {p.tipo || 'NO ASIGNADO'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="text-slate-300 font-bold uppercase">{p.ciudad || '---'}</div>
                  <div className="text-slate-500 text-[10px] uppercase">{p.pais || '---'}</div>
                </td>
                <td className="p-4 text-slate-300 font-mono text-xs">
                  {p.telefono ? `📞 ${p.telefono}` : '---'}
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-3">
                    <button 
                      onClick={() => { setProvSeleccionado({
                        ...p, 
                        tipo: p.tipo || 'HOTEL', 
                        pais: p.pais || '', 
                        ciudad: p.ciudad || '' 
                      }); setModalOpen(true); }}
                      className="text-amber-400 hover:text-white transition-colors font-bold hover:underline text-xs"
                    >
                      EDITAR
                    </button>
                    <span className="text-slate-600">|</span>
                    <button 
                      onClick={() => eliminarProveedor(p.id)}
                      className="text-rose-500 hover:text-white transition-colors font-bold hover:underline text-xs"
                    >
                      ELIMINAR
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL (CREAR Y EDITAR) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] w-full max-w-3xl rounded-2xl border border-[#334155] shadow-2xl p-8 animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-[#334155] pb-4 uppercase tracking-tighter">
              {provSeleccionado.id ? 'Ficha de Proveedor' : 'Crear Nuevo Proveedor'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              
              <div className="md:col-span-3 grid grid-cols-3 gap-4 bg-black/20 p-4 rounded-xl border border-[#334155] mb-2">
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-emerald-400 uppercase">Código Interno</label>
                  <input type="text" className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mt-1 text-emerald-400 font-mono font-bold" value={provSeleccionado.codigo} onChange={(e)=>setProvSeleccionado({...provSeleccionado, codigo: e.target.value})} placeholder="Auto-Generado" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">RIF (Dato Fiscal)</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono uppercase placeholder:text-slate-600" value={provSeleccionado.rif} onChange={manejarCambioRif} placeholder="Ej: J-12345678-9" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-[#38bdf8] uppercase">Categoría / Tipo</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-[#0f172a] border border-[#38bdf8]/50 rounded-lg p-3 mt-1 text-white font-bold uppercase outline-none focus:border-[#38bdf8] appearance-none" 
                      value={provSeleccionado.tipo} 
                      onChange={(e)=>setProvSeleccionado({...provSeleccionado, tipo: e.target.value})}
                    >
                      <option value="HOTEL">🏨 HOTEL</option>
                      <option value="POSADA">🏡 POSADA</option>
                      <option value="AEROLINEA">✈️ AEROLÍNEA</option>
                      <option value="COMPAÑIA DE SEGURO">🛡️ COMPAÑÍA DE SEGUROS</option>
                      <option value="AGENCIA DE TRASLADO">🚕 AGENCIA TRASLADOS</option>
                      <option value="MAYORISTA">🌍 MAYORISTA / OPERADOR</option>
                      <option value="PROVEEDOR GENERAL">📦 PROVEEDOR GENERAL (OFICINA, OTROS)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 pointer-events-none text-[#38bdf8] text-[10px]">▼</div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-amber-400 uppercase">Nombre Comercial (Conocido como)</label>
                <input type="text" placeholder="Ej: Hotel Posada del Mar" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold text-lg" value={provSeleccionado.nombre_comercial || ''} onChange={(e)=>setProvSeleccionado({...provSeleccionado, nombre_comercial: e.target.value})} />
              </div>
              
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Razón Social (Legal / SENIAT)</label>
                <input type="text" placeholder="Ej: INVERSIONES MAR AZUL C.A." className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold" value={provSeleccionado.razon_social} onChange={(e)=>setProvSeleccionado({...provSeleccionado, razon_social: e.target.value})} />
              </div>

              <div className="md:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">País</label>
                <input type="text" placeholder="Ej: VENEZUELA" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase" value={provSeleccionado.pais} onChange={(e)=>setProvSeleccionado({...provSeleccionado, pais: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Ciudad (Súper importante para los Hoteles)</label>
                <input type="text" placeholder="Ej: ISLA DE MARGARITA" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase" value={provSeleccionado.ciudad} onChange={(e)=>setProvSeleccionado({...provSeleccionado, ciudad: e.target.value})} />
              </div>

              <div className="md:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono" value={provSeleccionado.telefono} onChange={(e)=>setProvSeleccionado({...provSeleccionado, telefono: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Correo Electrónico</label>
                <input type="email" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={provSeleccionado.correo} onChange={(e)=>setProvSeleccionado({...provSeleccionado, correo: e.target.value})} />
              </div>
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Dirección Física Exacta (Calle, Edificio...)</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={provSeleccionado.direccion} onChange={(e)=>setProvSeleccionado({...provSeleccionado, direccion: e.target.value})} />
              </div>

            </div>
            
            <div className="flex justify-end gap-4 pt-4 border-t border-[#334155]">
              <button onClick={()=>setModalOpen(false)} className="text-slate-400 font-bold hover:text-white transition-colors">CANCELAR</button>
              <button onClick={guardarProveedor} className="bg-[#10b981] text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-colors uppercase text-xs shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                GUARDAR PROVEEDOR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}