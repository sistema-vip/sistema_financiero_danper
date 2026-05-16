"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function PendientesFacturacionPage() {
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [cajasBD, setCajasBD] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);

  // Estado para controlar qué pestaña estamos viendo
  const [filtroEstatus, setFiltroEstatus] = useState<'Pendiente' | 'Presupuestado' | 'Facturado'>('Pendiente');

  // Estados para Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [movSeleccionado, setMovSeleccionado] = useState<any>(null);
  const [inputPresupuesto, setInputPresupuesto] = useState('');
  const [inputFactura, setInputFactura] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<any>(null);

  useEffect(() => {
    cargarCajas();
  }, []);

  useEffect(() => {
    cargarMovimientos(filtroEstatus);
  }, [filtroEstatus]);

  const cargarCajas = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cajas?select=id,nombre`, { headers: SUPABASE_HEADERS });
      if (res.ok) setCajasBD(await res.json());
    } catch (e) { console.error("Error cargando cajas", e); }
  };

  const cargarMovimientos = async (estatus: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?estatus_facturacion=eq.${estatus}&order=fecha.desc`, { 
        headers: SUPABASE_HEADERS 
      });
      if (res.ok) {
        setPendientes(await res.json());
      }
    } catch (error) {
      console.error("Error cargando movimientos:", error);
    }
    setIsLoading(false);
  };

  const abrirModal = (mov: any) => {
    setMovSeleccionado(mov);
    setInputPresupuesto(mov.nro_presupuesto || '');
    setInputFactura(mov.nro_factura || '');
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setMovSeleccionado(null);
    setInputPresupuesto('');
    setInputFactura('');
  };

  const abrirDetalle = (mov: any) => {
    setDetalleSeleccionado(mov);
    setModalDetalleOpen(true);
  };

  const guardarProceso = async () => {
    if (!movSeleccionado) return;
    
    let nuevoEstatus = 'Pendiente';
    if (inputFactura.trim() !== '') {
      nuevoEstatus = 'Facturado'; 
    } else if (inputPresupuesto.trim() !== '') {
      nuevoEstatus = 'Presupuestado'; 
    }

    if (nuevoEstatus === 'Pendiente' && movSeleccionado.estatus_facturacion === 'Pendiente') {
      return alert("⚠️ Debes ingresar al menos un Número de Presupuesto o Factura.");
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?id=eq.${movSeleccionado.id}`, {
        method: 'PATCH',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({
          estatus_facturacion: nuevoEstatus,
          nro_presupuesto: inputPresupuesto.trim().toUpperCase() || null,
          nro_factura: inputFactura.trim().toUpperCase() || null
        })
      });

      if (res.ok) {
        cerrarModal();
        cargarMovimientos(filtroEstatus); 
      } else {
        alert("❌ Hubo un error al actualizar la base de datos.");
      }
    } catch (error) {
      alert("❌ Error de conexión.");
    }
    setIsSaving(false);
  };

  const handleImprimir = () => {
    window.print();
  };

  const tituloReporte = filtroEstatus === 'Pendiente' ? 'Servicios por Facturar (Pendientes)' : 
                        filtroEstatus === 'Presupuestado' ? 'Servicios Presupuestados' : 
                        'Servicios Facturados';

  // --- CÁLCULO MATEMÁTICO CORREGIDO ---
  let sumaBs = 0;
  let sumaUSD = 0;

  pendientes.forEach(mov => {
    // Tomamos el número flotante directamente como lo manda la base de datos
    const monto = parseFloat(mov.monto) || 0;
    
    if (mov.moneda?.toUpperCase() === 'BS' || mov.moneda === 'Bs') {
      sumaBs += monto;
    } else {
      sumaUSD += monto;
    }
  });

  return (
    <>
      <style>{`
        @media print {
          @page { size: portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          #zona-impresion, #zona-impresion * { visibility: visible !important; color: black !important; }
          #zona-impresion {
            position: fixed !important; left: 0 !important; top: 0 !important;
            width: 100vw !important; margin: 0 !important; padding: 0 !important; 
            background-color: white !important; border: none !important; 
            box-shadow: none !important; box-sizing: border-box !important;
          }
          table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; margin-top: 15px !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          .truncate { white-space: normal !important; overflow: visible !important; }
          th, td { border: 1px solid #666 !important; padding: 8px !important; text-align: left !important; font-size: 10px !important; white-space: normal !important; word-wrap: break-word !important; }
          th { background-color: #f3f4f6 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          
          th:nth-child(1), td:nth-child(1) { width: 10% !important; }  
          th:nth-child(2), td:nth-child(2) { width: 10% !important; }  
          th:nth-child(3), td:nth-child(3) { width: 20% !important; }  
          th:nth-child(4), td:nth-child(4) { width: 15% !important; }  
          th:nth-child(5), td:nth-child(5) { width: 20% !important; }  
          th:nth-child(6), td:nth-child(6) { width: 10% !important; text-align: center !important; }  
          th:nth-child(7), td:nth-child(7) { width: 15% !important; text-align: right !important; } 
          
          .ocultar-print, .print\\:hidden { display: none !important; }
          .bg-amber-400\\/10, .bg-rose-500\\/10 { background-color: transparent !important; }
        }
      `}</style>

      <div className="animate-in fade-in duration-300 max-w-[98%] mx-auto space-y-8 pb-10 ml-2 lg:ml-6 relative">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-[#334155] pb-4 print:hidden mt-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧾</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Control de Facturación</h2>
              <p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Seguimiento de Servicios</p>
            </div>
          </div>
          
          <button onClick={handleImprimir} className="flex items-center justify-center gap-2 bg-[#38bdf8] hover:bg-sky-400 text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase shadow-[0_0_15px_rgba(56,189,248,0.4)] transition-all">
            <span className="text-lg">🖨️</span> IMPRIMIR LISTADO
          </button>
        </div>

        <div id="zona-impresion" className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl relative overflow-hidden">
          
          <div className="hidden print:block text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black italic">PRINCESS TRAVEL</h1>
            <p className="text-xs font-bold tracking-widest uppercase mt-1">Reporte: {tituloReporte}</p>
            <p className="text-[10px] mt-1">Fecha de Emisión: {new Date().toLocaleDateString()}</p>
          </div>

          {/* MENÚ DE PESTAÑAS Y TOTALES INTEGADOS */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 print:hidden">
            
            <div className="flex items-center gap-2 bg-[#0f172a] p-1.5 rounded-xl border border-[#334155] overflow-x-auto w-full xl:w-auto">
              <button 
                onClick={() => setFiltroEstatus('Pendiente')}
                className={`flex-1 xl:flex-none px-6 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all whitespace-nowrap ${filtroEstatus === 'Pendiente' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                🔴 Pendientes
              </button>
              <button 
                onClick={() => setFiltroEstatus('Presupuestado')}
                className={`flex-1 xl:flex-none px-6 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all whitespace-nowrap ${filtroEstatus === 'Presupuestado' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                🟡 Presupuestados
              </button>
              <button 
                onClick={() => setFiltroEstatus('Facturado')}
                className={`flex-1 xl:flex-none px-6 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all whitespace-nowrap ${filtroEstatus === 'Facturado' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                🟢 Facturados
              </button>
            </div>

            <div className="flex items-center gap-4 w-full xl:w-auto justify-end">
              <div className="flex items-center gap-4 bg-black/20 border border-[#334155] px-4 py-2 rounded-lg">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block leading-none mb-1">Total Bs</span>
                  <span className="font-mono text-white text-sm font-bold leading-none">{sumaBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="h-6 w-px bg-[#334155]"></div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block leading-none mb-1">Total USD</span>
                  <span className="font-mono text-[#38bdf8] text-sm font-bold leading-none">{sumaUSD.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <span className="bg-slate-700 text-white px-4 py-3 rounded-lg text-xs font-bold shadow-inner flex-shrink-0">
                {pendientes.length} Registros
              </span>
            </div>

          </div>

          {/* TABLA OPTIMIZADA */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#0f172a] text-slate-400 text-[10px] uppercase tracking-wider border-b border-[#334155] print:bg-gray-200">
                <tr>
                  <th className="p-3 w-28">Estatus</th>
                  <th className="p-3 w-24">Fecha</th>
                  <th className="p-3">Cliente / Corporativo</th>
                  <th className="p-3 w-32">Caja / Banco</th>
                  <th className="p-3 w-40">Concepto</th>
                  <th className="p-3 w-24 text-center">Doc. Fiscal</th>
                  <th className="p-3 w-28 text-right">Monto</th>
                  <th className="p-3 w-36 text-center ocultar-print">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {isLoading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">Cargando bandeja...</td></tr>
                ) : pendientes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-16 text-center">
                      <div className="text-5xl mb-4">🏆</div>
                      <h3 className="text-xl font-bold text-white mb-2 print:text-black">¡Bandeja Limpia!</h3>
                      <p className="text-slate-400 print:text-black">No hay registros en esta categoría.</p>
                    </td>
                  </tr>
                ) : (
                  pendientes.map((mov: any) => {
                    const nombreCaja = cajasBD.find(c => c.id.toString() === mov.caja_id?.toString())?.nombre || 'No Identificada';
                    
                    return (
                      <tr key={mov.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          {mov.estatus_facturacion === 'Facturado' ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded text-[10px] uppercase">
                              ✔ Completado
                            </span>
                          ) : mov.estatus_facturacion === 'Presupuestado' ? (
                            <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-400/10 px-2 py-1 rounded text-[10px] uppercase">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ocultar-print"></span> S/Factura
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 px-2 py-1 rounded text-[10px] uppercase">
                              <span className="w-2 h-2 rounded-full bg-rose-500 ocultar-print"></span> Pendiente
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-400 font-mono print:text-black">{mov.fecha}</td>
                        <td className="p-3 font-bold text-white print:text-black uppercase truncate max-w-[180px]" title={mov.persona}>
                          {mov.persona}
                        </td>
                        <td className="p-3 font-bold text-[#38bdf8] text-[10px] uppercase print:text-black truncate max-w-[120px]" title={nombreCaja}>
                          {nombreCaja}
                        </td>
                        <td className="p-3 text-slate-400 print:text-black truncate max-w-[150px]" title={mov.descripcion}>
                          {mov.descripcion || 'Sin detalles'}
                        </td>
                        
                        <td className="p-3 font-mono print:text-black font-bold text-center text-[10px]">
                          {mov.nro_factura ? (
                            <span className="text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded" title="Factura">F: {mov.nro_factura}</span>
                          ) : mov.nro_presupuesto ? (
                            <span className="text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded" title="Presupuesto">P: {mov.nro_presupuesto}</span>
                          ) : (
                            <span className="text-slate-600">---</span>
                          )}
                        </td>

                        <td className="p-3 text-right font-mono font-bold text-white print:text-black truncate">
                          {parseFloat(mov.monto).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {mov.moneda}
                        </td>
                        <td className="p-3 text-center ocultar-print">
                          <div className="flex justify-center gap-1.5">
                            <button 
                              onClick={() => abrirDetalle(mov)}
                              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1.5 px-2 rounded transition-colors text-[9px] uppercase border border-[#475569]"
                              title="Ver Detalle"
                            >
                              👁️ Ver
                            </button>
                            <button 
                              onClick={() => abrirModal(mov)}
                              className="bg-[#334155] hover:bg-[#38bdf8] hover:text-white text-slate-300 font-bold py-1.5 px-2 rounded transition-colors text-[9px] uppercase border border-[#475569]"
                            >
                              {filtroEstatus === 'Facturado' ? 'Editar ➔' : 'Procesar ➔'}
                            </button>
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

        {/* --- MODALES --- */}
        {modalOpen && movSeleccionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
            <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-[#334155] shadow-2xl overflow-hidden flex flex-col">
              
              <div className="p-6 border-b border-[#334155] bg-black/20">
                <h3 className="text-xl font-bold text-white">Procesar Documentos</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Cliente: <span className="font-bold text-[#38bdf8] uppercase">{movSeleccionado.persona}</span>
                </p>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">1. Nro. de Presupuesto</label>
                  <input type="text" placeholder="Ej: PRES-0045" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-amber-400 outline-none transition-all font-bold placeholder:text-slate-600" value={inputPresupuesto} onChange={(e) => setInputPresupuesto(e.target.value)} />
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-[#334155]"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold uppercase">Y / O</span>
                  <div className="flex-grow border-t border-[#334155]"></div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2">2. Nro. de Factura Final</label>
                  <input type="text" placeholder="Ej: FACT-9988" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none transition-all font-bold placeholder:text-slate-600" value={inputFactura} onChange={(e) => setInputFactura(e.target.value)} />
                </div>
              </div>

              <div className="p-6 border-t border-[#334155] bg-black/20 flex justify-end gap-3">
                <button onClick={cerrarModal} className="px-6 py-2 rounded-lg text-sm font-bold text-slate-400 hover:bg-white/5 transition-colors" disabled={isSaving}>Cancelar</button>
                <button onClick={guardarProceso} className={`px-6 py-2 rounded-lg text-sm font-bold text-white transition-colors ${isSaving ? 'bg-slate-600 cursor-not-allowed' : 'bg-[#38bdf8] hover:bg-sky-400'}`} disabled={isSaving}>Guardar</button>
              </div>

            </div>
          </div>
        )}

        {modalDetalleOpen && detalleSeleccionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-[#334155] shadow-2xl overflow-hidden flex flex-col">
              
              <div className="p-6 border-b border-[#334155] bg-black/20 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight">Detalle del Gasto / Movimiento</h3>
                  <p className="text-xs text-slate-400 mt-1">Recibo Nro: <span className="font-bold font-mono text-emerald-400">{detalleSeleccionado.nro_recibo || 'S/N'}</span></p>
                </div>
                <button onClick={() => setModalDetalleOpen(false)} className="text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/20 p-5 rounded-xl border border-[#334155] mb-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Caja / Banco Origen</p>
                    <p className="font-bold text-[#38bdf8] uppercase text-sm mt-1">{cajasBD.find(c => c.id.toString() === detalleSeleccionado.caja_id?.toString())?.nombre || 'No Identificada'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Operación</p>
                    <p className={`font-bold uppercase text-sm mt-1 ${detalleSeleccionado.tipo === 'Recibo de Ingreso' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {detalleSeleccionado.tipo}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Beneficiario / Cliente Corporativo</p>
                    <p className="font-black text-white uppercase text-lg mt-1">{detalleSeleccionado.persona}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Categoría / Clasificación</p>
                    <p className="font-bold text-white uppercase text-sm mt-1">{detalleSeleccionado.clasificacion || 'Sin categoría'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Referencia de Pago</p>
                    <p className="font-mono text-amber-400 font-bold text-sm mt-1">{detalleSeleccionado.referencia || 'S/R'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Concepto Descriptivo</p>
                    <p className="text-slate-300 text-sm mt-1 leading-relaxed bg-black/40 p-3 rounded border border-[#334155]">
                      {detalleSeleccionado.descripcion || 'No se registraron detalles para este movimiento.'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Monto Total Pagado</p>
                    <p className="text-2xl font-black font-mono text-white mt-1">
                      {parseFloat(detalleSeleccionado.monto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} <span className="text-sm">{detalleSeleccionado.moneda}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Tasa Aplicada</p>
                    <p className="font-mono text-slate-300 text-sm mt-1">{parseFloat(detalleSeleccionado.tasa || 1).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[#334155] bg-black/20 flex justify-end">
                <button onClick={() => setModalDetalleOpen(false)} className="px-8 py-2.5 rounded-lg text-xs font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors uppercase tracking-widest shadow-lg">Cerrar Ficha</button>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}