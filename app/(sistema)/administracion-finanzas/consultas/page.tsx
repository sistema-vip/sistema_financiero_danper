"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [cajas, setCajas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fecha de hoy
  const hoy = new Date().toISOString().split('T')[0];

  // Estados de Filtros
  const [filtroCaja, setFiltroCaja] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroDesde, setFiltroDesde] = useState(hoy);
  const [filtroHasta, setFiltroHasta] = useState(hoy);
  const [filtroMesRapido, setFiltroMesRapido] = useState(''); 

  const [totales, setTotales] = useState({ usd: 0, bs: 0 });

  // NUEVOS ESTADOS PARA EDICIÓN E IMPRESIÓN INDIVIDUAL
  const [modoImpresion, setModoImpresion] = useState<'tabla' | 'recibo'>('tabla');
  const [ticketImpresion, setTicketImpresion] = useState<any>(null);
  
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [movEditable, setMovEditable] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setIsLoading(true);
    try {
      const resCajas = await fetch(`${SUPABASE_URL}/rest/v1/cajas?select=*`, { headers: SUPABASE_HEADERS });
      const dataCajas = await resCajas.json();
      setCajas(dataCajas || []);

      const resMov = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?select=*&order=fecha.asc,id.asc`, { headers: SUPABASE_HEADERS });
      let dataMov = await resMov.json();
      dataMov = dataMov || [];

      let totalUsd = 0;
      let totalBs = 0;
      const saldosPorCaja: Record<string, number> = {};

      dataCajas.forEach((c: any) => {
        if (c.moneda === 'USD') totalUsd += parseFloat(c.saldo_inicial || 0);
        if (c.moneda === 'Bs') totalBs += parseFloat(c.saldo_inicial || 0);
        saldosPorCaja[c.id] = parseFloat(c.saldo_inicial || 0);
      });

      const movimientosCalculados = dataMov.map((mov: any) => {
        const monto = parseFloat(mov.monto || 0);
        const esIngreso = mov.tipo === 'Recibo de Ingreso';
        
        if (mov.moneda === 'USD') {
          totalUsd = esIngreso ? totalUsd + monto : totalUsd - monto;
        } else if (mov.moneda === 'Bs') {
          totalBs = esIngreso ? totalBs + monto : totalBs - monto;
        }

        if (saldosPorCaja[mov.caja_id] !== undefined) {
          saldosPorCaja[mov.caja_id] = esIngreso 
            ? saldosPorCaja[mov.caja_id] + monto 
            : saldosPorCaja[mov.caja_id] - monto;
        }

        return {
          ...mov,
          saldo_fila: saldosPorCaja[mov.caja_id] || 0,
          nombre_caja: dataCajas.find((c:any) => c.id === mov.caja_id)?.nombre || 'Caja Desconocida'
        };
      });

      setTotales({ usd: totalUsd, bs: totalBs });
      setMovimientos(movimientosCalculados.reverse());

    } catch (error) {
      console.error("Error cargando datos:", error);
    }
    setIsLoading(false);
  };

  const eliminarMovimiento = async (id: string) => {
    if (!confirm("⚠️ ¿Estás seguro de que deseas eliminar este movimiento? Esto recalculará los saldos automáticamente.")) return;
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?id=eq.${id}`, { method: 'DELETE', headers: SUPABASE_HEADERS });
      if (response.ok) { alert("🗑️ Movimiento eliminado."); cargarDatos(); }
    } catch (error) {}
  };

  // --- NUEVAS FUNCIONES DE EDICIÓN ---
  const abrirModalEditar = (mov: any) => {
    setMovEditable({ ...mov });
    setModalEditarOpen(true);
  };

  const guardarEdicion = async () => {
    setIsSaving(true);
    try {
      // Limpiamos el monto por si el usuario le puso comas o puntos extra
      let montoLimpio = movEditable.monto.toString().replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
      const montoFinal = parseFloat(montoLimpio) || 0;

      const response = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?id=eq.${movEditable.id}`, {
        method: 'PATCH',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({
          fecha: movEditable.fecha,
          persona: movEditable.persona.toUpperCase(),
          descripcion: movEditable.descripcion,
          referencia: movEditable.referencia,
          monto: montoFinal
        })
      });

      if (response.ok) {
        alert("✅ Movimiento actualizado exitosamente.");
        setModalEditarOpen(false);
        cargarDatos();
      } else {
        alert("❌ Error al guardar en la base de datos.");
      }
    } catch (error) {
      alert("❌ Error de conexión.");
    }
    setIsSaving(false);
  };

  // --- NUEVAS FUNCIONES DE IMPRESIÓN ---
  const imprimirTabla = () => {
    setModoImpresion('tabla');
    setTimeout(() => window.print(), 100);
  };

  const imprimirRecibo = (mov: any) => {
    setModoImpresion('recibo');
    setTicketImpresion(mov);
    setTimeout(() => window.print(), 100);
  };

  const manejarCambioMes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorMes = e.target.value; 
    setFiltroMesRapido(valorMes);
    if (valorMes) {
      const año = parseInt(valorMes.split('-')[0]);
      const mes = parseInt(valorMes.split('-')[1]);
      const primerDia = `${año}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDia = new Date(año, mes, 0).toISOString().split('T')[0];
      setFiltroDesde(primerDia);
      setFiltroHasta(ultimoDia);
    }
  };

  const movimientosFiltrados = movimientos.filter(mov => {
    const coincideCaja = mov.caja_id.toString() === filtroCaja; 
    const coincideBusqueda = filtroBusqueda === '' || 
      mov.persona?.toLowerCase().includes(filtroBusqueda.toLowerCase()) || 
      mov.descripcion?.toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
      mov.referencia?.toLowerCase().includes(filtroBusqueda.toLowerCase());
    const coincideDesde = filtroDesde === '' || mov.fecha >= filtroDesde;
    const coincideHasta = filtroHasta === '' || mov.fecha <= filtroHasta;
    return coincideCaja && coincideBusqueda && coincideDesde && coincideHasta;
  });

  return (
    <>
      {/* CSS MÁGICO: Cambia de comportamiento si imprimes la tabla o el recibo */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          
          ${modoImpresion === 'tabla' ? `
            /* ESTILOS PARA IMPRIMIR LA TABLA (HORIZONTAL) */
            @page { size: landscape; margin: 10mm; }
            #zona-impresion, #zona-impresion * { visibility: visible !important; color: black !important; }
            #zona-impresion { position: fixed !important; left: 0 !important; top: 0 !important; width: 100vw !important; margin: 0 !important; padding: 0 !important; background-color: white !important; }
            table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; margin-top: 15px !important; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; }
            th, td { border: 1px solid #666 !important; padding: 6px !important; text-align: left !important; font-size: 9px !important; white-space: normal !important; word-wrap: break-word !important; }
            th { background-color: #f3f4f6 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            th:nth-child(1), td:nth-child(1) { width: 8% !important; } 
            th:nth-child(2), td:nth-child(2) { width: 18% !important; } 
            th:nth-child(3), td:nth-child(3) { width: 22% !important; } 
            th:nth-child(4), td:nth-child(4) { width: 12% !important; } 
            th:nth-child(5), td:nth-child(5) { width: 12% !important; text-align: right !important; } 
            th:nth-child(6), td:nth-child(6) { width: 6% !important; text-align: center !important; } 
            th:nth-child(7), td:nth-child(7) { width: 8% !important; text-align: center !important; } 
            th:nth-child(8), td:nth-child(8) { width: 14% !important; text-align: right !important; } 
            .ocultar-print { display: none !important; }
          ` : `
            /* ESTILOS PARA IMPRIMIR EL RECIBO (FORMATO DOCUMENTO) */
            @page { size: auto; margin: 0; }
            #recibo-impresion, #recibo-impresion * { visibility: visible !important; color: black !important; }
            #recibo-impresion { position: fixed !important; left: 0 !important; top: 0 !important; width: 100vw !important; height: 100vh !important; margin: 0 !important; padding: 20mm !important; background-color: white !important; z-index: 999999 !important; border: none !important; }
            .border-gray-200 { border-color: #e5e7eb !important; border-style: solid !important; border-width: 1px !important;}
            .border-gray-100 { border-color: #f3f4f6 !important; border-style: solid !important; border-width: 1px !important;}
            .border-black { border-color: black !important; border-style: solid !important;}
            .border-b-2 { border-bottom-width: 2px !important;}
            .border-t-2 { border-top-width: 2px !important;}
          `}
        }
      `}</style>

      <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8 pb-10 ml-2 lg:ml-8 print:hidden">
        
        <div className="flex items-center gap-3 mb-8 border-b border-[#334155] pb-4">
          <span className="text-3xl">🔍</span>
          <div>
            <h2 className="text-2xl font-bold text-white">Movimientos</h2>
            <p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Auditoría y Búsqueda</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl flex items-center gap-6 relative overflow-hidden">
            <div className="absolute left-0 top-0 w-2 h-full bg-emerald-500"></div>
            <div className="pl-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total General USD</p>
              <p className="text-4xl font-black text-white font-mono">$ {totales.usd.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl flex items-center gap-6 relative overflow-hidden">
            <div className="absolute left-0 top-0 w-2 h-full bg-[#38bdf8]"></div>
            <div className="pl-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total General BS</p>
              <p className="text-4xl font-black text-white font-mono">Bs {totales.bs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl flex flex-wrap lg:flex-nowrap gap-4 items-end">
          <div className="w-full lg:w-48">
            <label className="block text-[10px] font-bold text-[#38bdf8] uppercase tracking-widest mb-2">1. Caja / Banco</label>
            <div className="relative">
              <select className="w-full bg-black/40 border border-[#38bdf8]/50 rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] outline-none appearance-none font-bold cursor-pointer" value={filtroCaja} onChange={(e) => setFiltroCaja(e.target.value)}>
                <option value="" className="bg-[#0f172a]">-- Requerido --</option>
                {cajas.map(c => <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.nombre}</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#38bdf8]">▼</div>
            </div>
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Buscar</label>
            <input type="text" placeholder="Nombre, Referencia..." className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none font-bold" value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} disabled={!filtroCaja} />
          </div>

          <div className="w-full sm:w-36">
            <label className="block text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">Mes Rápido</label>
            <input type="month" className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-sm text-purple-400 outline-none [color-scheme:dark] font-bold cursor-pointer" value={filtroMesRapido} onChange={manejarCambioMes} onClick={(e: any) => e.target.showPicker()} disabled={!filtroCaja} />
          </div>

          <div className="w-full sm:w-36">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Desde</label>
            <input type="date" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white outline-none [color-scheme:dark] cursor-pointer" value={filtroDesde} onChange={(e) => {setFiltroDesde(e.target.value); setFiltroMesRapido('');}} onClick={(e: any) => e.target.showPicker()} disabled={!filtroCaja} />
          </div>

          <div className="w-full sm:w-36">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Hasta</label>
            <input type="date" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white outline-none [color-scheme:dark] cursor-pointer" value={filtroHasta} onChange={(e) => {setFiltroHasta(e.target.value); setFiltroMesRapido('');}} onClick={(e: any) => e.target.showPicker()} disabled={!filtroCaja} />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg disabled:opacity-50" title="Refrescar" onClick={cargarDatos} disabled={!filtroCaja}>🔄</button>
            <button onClick={imprimirTabla} className="flex-1 sm:flex-none bg-[#38bdf8] hover:bg-sky-400 text-white p-3 rounded-lg disabled:opacity-50 shadow-[0_0_15px_rgba(56,189,248,0.3)]" title="Imprimir Estado de Cuenta" disabled={!filtroCaja}>🖨️</button>
          </div>
        </div>

        {/* TABLA DE MOVIMIENTOS */}
        <div id={modoImpresion === 'tabla' ? 'zona-impresion' : ''} className="bg-[#1e293b] rounded-2xl border border-[#334155] overflow-hidden shadow-xl overflow-x-auto print:shadow-none print:border-none print:bg-white print:overflow-visible">
          <div className="hidden print:block text-center mb-6 border-b-2 border-black pb-4 pt-4">
            <h1 className="text-2xl font-black italic">PRINCESS TRAVEL</h1>
            <p className="text-xs font-bold tracking-widest uppercase mt-1">ESTADO DE CUENTA: {cajas.find(c => c.id.toString() === filtroCaja)?.nombre || '---'}</p>
            <p className="text-[10px] mt-1">Período: {filtroDesde} al {filtroHasta} | Generado: {new Date().toLocaleDateString()}</p>
          </div>

          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#0f172a] text-slate-400 text-[10px] uppercase tracking-wider border-b border-[#334155] print:bg-white print:text-black">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Beneficiario</th>
                <th className="p-4">Concepto</th>
                <th className="p-4">Ref.</th>
                <th className="p-4 text-right">Monto</th>
                <th className="p-4 text-center">Mon.</th>
                <th className="p-4 text-center">Tipo</th>
                <th className="p-4 text-center ocultar-print">Clasif.</th>
                <th className="p-4 text-right font-black text-white print:text-black">Saldo</th>
                <th className="p-4 text-center ocultar-print">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155] print:text-black print:divide-gray-300">
              {isLoading ? (
                <tr><td colSpan={10} className="p-12 text-center text-slate-400">Cargando auditoría...</td></tr>
              ) : !filtroCaja ? (
                <tr className="print:hidden">
                  <td colSpan={10} className="p-16 text-center">
                    <div className="text-5xl mb-4">🏦</div><h3 className="text-xl font-bold text-white mb-2">Seleccione una cuenta</h3><p className="text-slate-400">Elija un Banco o Caja en los filtros de arriba para generar el estado de cuenta.</p>
                  </td>
                </tr>
              ) : movimientosFiltrados.length === 0 ? (
                <tr><td colSpan={10} className="p-12 text-center text-slate-400 print:text-black">No se encontraron movimientos.</td></tr>
              ) : (
                movimientosFiltrados.map((mov: any) => {
                  const esIngreso = mov.tipo === 'Recibo de Ingreso';
                  return (
                    <tr key={mov.id} className="hover:bg-white/5 transition-colors print:hover:bg-transparent">
                      <td className="p-4 text-slate-400 print:text-black font-mono text-[11px]">{mov.fecha}</td>
                      <td className="p-4 font-bold text-white uppercase print:text-black">{mov.persona}</td>
                      <td className="p-4 text-slate-400 print:text-black uppercase text-[10px] truncate max-w-[150px] print:max-w-none">{mov.descripcion || '---'}</td>
                      <td className="p-4 text-[#38bdf8] print:text-black font-mono font-bold text-[10px]">{mov.referencia || '---'}</td>
                      <td className={`p-4 text-right font-mono font-bold ${esIngreso ? 'text-emerald-400 print:text-black' : 'text-rose-400 print:text-black'}`}>
                        {esIngreso ? '+ ' : '- '}{parseFloat(mov.monto).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center text-slate-400 print:text-black font-bold">{mov.moneda}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${esIngreso ? 'bg-emerald-500/10 text-emerald-500 print:text-black' : 'bg-rose-500/10 text-rose-500 print:text-black'} print:bg-transparent border print:border-none border-transparent`}>{esIngreso ? 'Ingreso' : 'Egreso'}</span>
                      </td>
                      <td className="p-4 text-center text-slate-400 text-[9px] uppercase ocultar-print">{mov.clasificacion}</td>
                      <td className="p-4 text-right font-mono font-black text-white bg-black/20 print:bg-transparent print:text-black text-sm">
                        {mov.saldo_fila.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center ocultar-print">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => abrirModalEditar(mov)} className="text-slate-400 hover:text-[#38bdf8] transition-colors" title="Editar Movimiento">✏️</button>
                          <button onClick={() => imprimirRecibo(mov)} className="text-slate-400 hover:text-emerald-400 transition-colors" title="Imprimir Recibo de este Movimiento">🖨️</button>
                          <button onClick={() => eliminarMovimiento(mov.id)} className="text-slate-400 hover:text-rose-500 transition-colors" title="Eliminar Movimiento">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EDICIÓN */}
      {modalEditarOpen && movEditable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-[#334155] shadow-2xl p-6 animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-4 uppercase border-b border-[#334155] pb-3">Editar Movimiento</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Beneficiario / Pagador</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold outline-none focus:border-[#38bdf8]" value={movEditable.persona} onChange={(e)=>setMovEditable({...movEditable, persona: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Monto ({movEditable.moneda})</label>
                  <input type="text" className="w-full bg-black/40 border border-[#38bdf8]/50 rounded-lg p-3 mt-1 text-white font-mono outline-none focus:border-[#38bdf8]" value={movEditable.monto} onChange={(e)=>setMovEditable({...movEditable, monto: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha</label>
                  <input type="date" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white [color-scheme:dark] outline-none focus:border-[#38bdf8]" value={movEditable.fecha} onChange={(e)=>setMovEditable({...movEditable, fecha: e.target.value})} onClick={(e: any) => e.target.showPicker()} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Referencia</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono uppercase outline-none focus:border-[#38bdf8]" value={movEditable.referencia || ''} onChange={(e)=>setMovEditable({...movEditable, referencia: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Concepto</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white outline-none focus:border-[#38bdf8]" value={movEditable.descripcion || ''} onChange={(e)=>setMovEditable({...movEditable, descripcion: e.target.value})} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#334155]">
              <button onClick={()=>setModalEditarOpen(false)} disabled={isSaving} className="px-4 py-2 text-slate-400 font-bold hover:text-white transition-colors text-xs">CANCELAR</button>
              <button onClick={guardarEdicion} disabled={isSaving} className={`px-6 py-2 rounded-lg font-bold text-white uppercase text-xs shadow-lg transition-colors ${isSaving ? 'bg-slate-600' : 'bg-[#38bdf8] hover:bg-sky-400'}`}>
                {isSaving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECIBO INDIVIDUAL (SOLO VISIBLE AL IMPRIMIR UNA FILA) */}
      {modoImpresion === 'recibo' && ticketImpresion && (
        <div id="recibo-impresion" className="hidden print:block font-sans">
          <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-5">
            <div>
              <h1 className="text-base font-black italic m-0 p-0 text-black">PRINCESS TRAVEL</h1>
              <p className="text-[8px] font-bold tracking-[0.2em] uppercase m-0 p-0 text-black">Management & Tourism</p>
            </div>
            <div className="text-right">
              <h2 className="text-sm font-black uppercase border border-black px-3 py-1 rounded inline-block m-0 text-black">{ticketImpresion.tipo}</h2>
              <p className="text-xs font-mono mt-1 text-black">Ref/Comprobante: {ticketImpresion.referencia || 'S/N'}</p>
            </div>
          </div>
          <div className="space-y-4 text-xs mb-8">
            <div className="grid grid-cols-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-black m-0"><span className="text-[9px] font-bold text-gray-500 block uppercase mb-0.5">Fecha de Operación</span> {ticketImpresion.fecha}</p>
              <p className="text-right text-black m-0"><span className="text-[9px] font-bold text-gray-500 block uppercase mb-0.5">Cuenta / Origen</span> {ticketImpresion.nombre_caja}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5 m-0">Beneficiario / Pagador</p>
              <p className="text-sm font-black uppercase border-b border-gray-200 pb-1 m-0 text-black">{ticketImpresion.persona}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5 m-0">Monto Operación</p>
              <p className="text-2xl font-black text-black m-0">
                {parseFloat(ticketImpresion.monto).toLocaleString('de-DE', { minimumFractionDigits: 2 })} {ticketImpresion.moneda}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-1 m-0">Concepto / Descripción</p>
              <p className="text-xs font-medium leading-relaxed text-black m-0">{ticketImpresion.descripcion || 'Sin descripción detallada.'}</p>
            </div>
          </div>
          <div className="flex justify-between mt-24 px-8 pt-6 border-t border-gray-100">
            <div className="w-56 border-t-2 border-black pt-1.5 text-center text-[10px] font-bold uppercase text-black">Administración Princess Travel</div>
            <div className="w-56 border-t-2 border-black pt-1.5 text-center text-[10px] font-bold uppercase text-black">Firma Recibido / Conforme</div>
          </div>
        </div>
      )}
    </>
  );
}