"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function CuentasSociosPage() {
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [modalAbonoOpen, setModalAbonoOpen] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<any>(null);

  const [nuevoDoc, setNuevoDoc] = useState({ 
    socio: '', tipo: 'Por Cobrar', nro_documento: '', concepto: '', monto_total: '', moneda: 'USD', tasa: '36,500', fecha_emision: '' 
  });
  const [abono, setAbono] = useState('');
  
  // NUEVO ESTADO: Para capturar la referencia al momento de liquidar
  const [refLiquidacion, setRefLiquidacion] = useState('');

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_socios?select=*&order=fecha_emision.desc`, { headers: SUPABASE_HEADERS });
      if (res.ok) setCuentas(await res.json());
    } catch (e) {}
    setIsLoading(false);
  };

  const parsearMonto = (valor: string) => parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
  const formatearMonto = (valor: number) => valor.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatearEnVivo = (valor: string, decimales: number) => {
    if (!valor) return '';
    let limpio = valor.replace(/[^0-9.,]/g, '').replace(/\./g, '');
    if (limpio.includes(',')) { const partes = limpio.split(','); return partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1].substring(0, decimales); }
    return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  function aplicarFormatoEstricto(valor: string, decimales: number) {
    if (!valor) return ''; return (parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0).toLocaleString('de-DE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  }

  const montoNumVivo = parsearMonto(nuevoDoc.monto_total);
  const tasaNumVivo = parsearMonto(nuevoDoc.tasa) || 1;
  const valorEqVivo = nuevoDoc.moneda === 'Bs' ? (montoNumVivo / tasaNumVivo) : (montoNumVivo * tasaNumVivo);
  const monedaEqViva = nuevoDoc.moneda === 'Bs' ? 'USD' : 'Bs';

  const guardarNuevoDocumento = async () => {
    const montoNum = parsearMonto(nuevoDoc.monto_total);
    const tasaNum = parsearMonto(nuevoDoc.tasa) || 1;
    if (!nuevoDoc.socio || montoNum <= 0 || !nuevoDoc.fecha_emision) return alert("⚠️ Faltan datos obligatorios.");

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_socios`, {
        method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify({
          socio: nuevoDoc.socio.toUpperCase(),
          tipo: nuevoDoc.tipo, nro_documento: nuevoDoc.nro_documento || 'S/N', concepto: nuevoDoc.concepto || 'Registro Manual',
          monto_total: montoNum, saldo_pendiente: montoNum, moneda: nuevoDoc.moneda,
          tasa: tasaNum, equivalente: nuevoDoc.moneda === 'Bs' ? (montoNum / tasaNum) : (montoNum * tasaNum), moneda_equivalente: nuevoDoc.moneda === 'Bs' ? 'USD' : 'Bs',
          fecha_emision: nuevoDoc.fecha_emision, estatus: 'Pendiente'
        })
      });
      if (res.ok) {
        alert("✅ Registro guardado."); setModalNuevoOpen(false);
        setNuevoDoc({ socio: '', tipo: 'Por Cobrar', nro_documento: '', concepto: '', monto_total: '', moneda: 'USD', tasa: '36,500', fecha_emision: '' });
        cargarDatos();
      } else alert("❌ Error al guardar.");
    } catch (e) {}
  };

  const procesarAbono = async () => {
    const montoAbono = parsearMonto(abono);
    if (montoAbono <= 0 || montoAbono > registroSeleccionado.saldo_pendiente) return alert("⚠️ Monto inválido o mayor a lo pendiente.");
    const nuevoSaldo = registroSeleccionado.saldo_pendiente - montoAbono;
    const nuevoEstatus = nuevoSaldo === 0 ? 'Compensado' : 'Parcial';

    // MAGIA: Anexamos la referencia de liquidación al documento actual
    let docActualizado = registroSeleccionado.nro_documento;
    if (refLiquidacion.trim() !== '') {
      const refLimpia = refLiquidacion.trim().toUpperCase();
      docActualizado = (!docActualizado || docActualizado === 'S/R' || docActualizado === 'S/N') 
        ? `LIQ: ${refLimpia}` 
        : `${docActualizado} | LIQ: ${refLimpia}`;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_socios?id=eq.${registroSeleccionado.id}`, {
        method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify({ 
          saldo_pendiente: nuevoSaldo, 
          estatus: nuevoEstatus,
          nro_documento: docActualizado // Actualizamos el campo para que se vea en la tabla
        })
      });
      if (res.ok) {
        alert("✅ Compensación registrada exitosamente."); 
        setModalAbonoOpen(false); 
        setAbono(''); 
        setRefLiquidacion(''); // Limpiamos el campo
        cargarDatos();
      }
    } catch (e) {}
  };

  const handleImprimir = () => {
    window.print();
  };

  // MAGIA: Filtramos la búsqueda y además ORDENAMOS para mandar los "Compensados" al final
  const filtrados = cuentas
    .filter(c => c.socio.toLowerCase().includes(busqueda.toLowerCase()) || c.concepto?.toLowerCase().includes(busqueda.toLowerCase()) || c.nro_documento?.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => {
      // Si "a" está compensado y "b" no, "a" va al fondo (1)
      if (a.estatus === 'Compensado' && b.estatus !== 'Compensado') return 1;
      // Si "b" está compensado y "a" no, "b" va al fondo (-1)
      if (a.estatus !== 'Compensado' && b.estatus === 'Compensado') return -1;
      // Si ambos son iguales, se quedan como estaban (ordenados por fecha desc)
      return 0;
    });

  const renderTipoAccion = (tipo: string) => {
    if (tipo === 'Por Cobrar') return <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 font-black text-[10px] tracking-wider border border-emerald-500/30">📥 PENDIENTE RECIBIR</span>;
    return <span className="px-3 py-1 rounded bg-rose-500/20 text-rose-400 font-black text-[10px] tracking-wider border border-rose-500/30">📤 PENDIENTE ENTREGAR</span>;
  };

  const totalPorCobrar = cuentas.filter(c => c.moneda === 'USD' && c.tipo === 'Por Cobrar' && c.estatus !== 'Pagado').reduce((acc, el) => acc + parseFloat(el.saldo_pendiente), 0);
  const totalPorPagar = cuentas.filter(c => c.moneda === 'USD' && c.tipo === 'Por Pagar' && c.estatus !== 'Pagado').reduce((acc, el) => acc + parseFloat(el.saldo_pendiente), 0);

  return (
    <>
      {/* ESTILOS DE IMPRESIÓN (MANTENIDOS INTACTOS) */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body * { visibility: hidden !important; }
          #zona-impresion, #zona-impresion * { visibility: visible !important; color: black !important; }
          #zona-impresion { position: fixed !important; left: 0 !important; top: 0 !important; width: 100vw !important; margin: 0 !important; padding: 0 !important; background-color: white !important; border: none !important; box-shadow: none !important; box-sizing: border-box !important; }
          table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; margin-top: 15px !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          .truncate { white-space: normal !important; overflow: visible !important; max-width: none !important; }
          th, td { border: 1px solid #666 !important; padding: 6px !important; text-align: left !important; font-size: 9px !important; white-space: normal !important; word-wrap: break-word !important; }
          th { background-color: #f3f4f6 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          th:nth-child(1), td:nth-child(1) { width: 8% !important; }   
          th:nth-child(2), td:nth-child(2) { width: 22% !important; }  
          th:nth-child(3), td:nth-child(3) { width: 12% !important; }  
          th:nth-child(4), td:nth-child(4) { width: 10% !important; }  
          th:nth-child(5), td:nth-child(5) { width: 12% !important; text-align: right !important; } 
          th:nth-child(6), td:nth-child(6) { width: 12% !important; text-align: right !important; } 
          th:nth-child(7), td:nth-child(7) { width: 14% !important; text-align: right !important; } 
          th:nth-child(8), td:nth-child(8) { width: 10% !important; text-align: center !important; } 
          .ocultar-print, .print\\:hidden { display: none !important; }
          .bg-emerald-500\\/5, .bg-rose-500\\/5, .bg-emerald-500\\/20, .bg-rose-500\\/20, .bg-\\[\\#0f172a\\] { background-color: transparent !important; }
        }
      `}</style>

      <div className="animate-in fade-in duration-300 max-w-[98%] mx-auto space-y-8 pb-10 ml-2 lg:ml-8 relative">
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-[#334155] pb-4 mt-6 print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🔄</span>
            <div><h2 className="text-2xl font-bold text-white uppercase tracking-tight">Compensación (Socios)</h2><p className="text-purple-400 text-xs font-bold tracking-widest uppercase">Control de Cambios y Traspasos</p></div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="text-right border-r border-[#334155] pr-4">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">A Favor (Cobrar)</p>
              <p className="text-xl font-black font-mono text-emerald-400">${formatearMonto(totalPorCobrar)}</p>
            </div>
            <div className="text-right border-r border-[#334155] pr-4">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">En Contra (Pagar)</p>
              <p className="text-xl font-black font-mono text-rose-400">${formatearMonto(totalPorPagar)}</p>
            </div>
            
            <button onClick={handleImprimir} className="flex items-center gap-2 bg-[#38bdf8] hover:bg-sky-400 text-white px-4 py-3 rounded-lg font-bold text-xs uppercase shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all">
              <span className="text-base">🖨️</span> IMPRIMIR
            </button>

            <button onClick={() => setModalNuevoOpen(true)} className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-3 rounded-lg font-black text-xs uppercase shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              + Registro Manual
            </button>
          </div>
        </div>

        <div className="relative w-full md:w-96 print:hidden">
          <input type="text" placeholder="Buscar socio, concepto o referencia..." className="w-full bg-[#1e293b] border border-[#334155] rounded-lg py-3 px-4 text-sm text-white focus:border-purple-400 outline-none" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>

        {/* ZONA DE IMPRESIÓN DE LA TABLA */}
        <div id="zona-impresion" className="bg-[#1e293b] rounded-2xl border border-[#334155] shadow-xl overflow-x-auto">
          
          <div className="hidden print:block text-center mb-6 border-b-2 border-black pb-4 pt-4">
            <h1 className="text-2xl font-black italic">PRINCESS TRAVEL</h1>
            <p className="text-xs font-bold tracking-widest uppercase mt-1">Reporte de Compensación (Socios) - Control de Cambios</p>
            <p className="text-[10px] mt-1">Fecha de Emisión: {new Date().toLocaleDateString()}</p>
            <div className="flex justify-center gap-10 mt-4 text-xs font-bold">
              <span className="text-black border border-black px-3 py-1 rounded">A FAVOR (POR COBRAR): ${formatearMonto(totalPorCobrar)}</span>
              <span className="text-black border border-black px-3 py-1 rounded">EN CONTRA (POR PAGAR): ${formatearMonto(totalPorPagar)}</span>
            </div>
          </div>

          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#0f172a] text-slate-400 uppercase tracking-widest border-b border-[#334155]">
              <tr>
                <th className="p-4">FECHA</th>
                <th className="p-4">SOCIO / CONCEPTO</th>
                <th className="p-4">CAJA / BANCO</th>
                <th className="p-4">REFERENCIA</th>
                <th className="p-4 text-right">MONTO REGISTRADO</th>
                <th className="p-4 text-right">PENDIENTE (BASE)</th>
                <th className="p-4 text-right">CONTRAPARTE (CALCULADA)</th>
                <th className="p-4 text-center">ESTADO</th>
                <th className="p-4 text-center ocultar-print">GESTIÓN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {isLoading ? <tr><td colSpan={9} className="p-10 text-center">Cargando...</td></tr> : filtrados.map(item => {
                
                const eqCalculado = item.equivalente ? item.equivalente : (item.moneda === 'Bs' ? (item.monto_total / (item.tasa || 1)) : (item.monto_total * (item.tasa || 1)));
                const monEqCalculada = item.moneda_equivalente || (item.moneda === 'USD' ? 'Bs' : 'USD');

                return (
                <tr key={item.id} className={`hover:bg-white/5 transition-colors text-white ${item.estatus === 'Compensado' ? 'opacity-40' : ''}`}>
                  <td className="p-4 font-mono text-[11px] text-slate-300">{item.fecha_emision}</td>
                  <td className="p-4">
                    <div className="font-bold text-sm uppercase text-white">{item.socio}</div>
                    <div className="text-slate-400 text-[10px] uppercase truncate max-w-[150px] mt-1" title={item.concepto}>{item.concepto}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-300 text-[10px] font-bold uppercase bg-[#0f172a] px-2 py-1 rounded inline-block border border-[#334155]">
                      {item.concepto?.includes('Auto-Generado') ? 'Movimiento Automático' : 'Registro Manual'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-mono text-[11px] font-bold text-[#38bdf8] uppercase">
                      {item.nro_documento || 'S/R'}
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-slate-400 text-sm">
                    {formatearMonto(item.monto_total)} <span className="text-[10px]">{item.moneda}</span>
                  </td>
                  <td className="p-4 text-right font-mono text-slate-300 font-bold">
                    {formatearMonto(item.saldo_pendiente)} <span className="text-[10px]">{item.moneda}</span>
                  </td>
                  <td className={`p-4 text-right font-mono font-bold text-sm ${item.tipo === 'Por Cobrar' ? 'text-emerald-400 bg-emerald-500/5' : 'text-rose-400 bg-rose-500/5'}`}>
                    {formatearMonto(eqCalculado)} <span className="text-[10px]">{monEqCalculada}</span>
                    <div className="text-[9px] text-slate-500 font-normal mt-1">Tasa: {formatearMonto(item.tasa || 1)}</div>
                  </td>
                  <td className="p-4 text-center">
                    {item.estatus !== 'Compensado' ? renderTipoAccion(item.tipo) : <span className="text-slate-500 text-[10px] font-bold border border-slate-600 px-2 py-1 rounded">COMPENSADO</span>}
                  </td>
                  <td className="p-4 text-center ocultar-print">
                    {item.estatus !== 'Compensado' ? (
                      <button onClick={() => { 
                        setRegistroSeleccionado(item); 
                        setAbono(formatearMonto(item.saldo_pendiente)); 
                        setRefLiquidacion(''); // Reseteamos la referencia al abrir
                        setModalAbonoOpen(true); 
                      }} className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded text-[10px] font-black uppercase transition-colors shadow-lg">
                        Liquidar
                      </button>
                    ) : <span className="text-slate-500 text-[10px] font-bold">CERRADO</span>}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {/* MODAL MANUAL */}
        {modalNuevoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-[#334155] shadow-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6 border-b border-[#334155] pb-4 uppercase tracking-tighter">Traspaso Manual de Socio</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-purple-400 uppercase">¿Qué está pasando?</label>
                  <select className="w-full bg-[#0f172a] border border-purple-400/30 rounded-lg p-3 mt-1 text-white font-bold" value={nuevoDoc.tipo} onChange={(e)=>setNuevoDoc({...nuevoDoc, tipo: e.target.value})}>
                    <option value="Por Cobrar">Yo entregué dinero ➔ ESTOY PENDIENTE DE RECIBIR</option>
                    <option value="Por Pagar">A mi me dieron dinero ➔ ESTOY PENDIENTE DE ENTREGAR</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre del Socio / Persona</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold" value={nuevoDoc.socio} onChange={(e)=>setNuevoDoc({...nuevoDoc, socio: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Referencia / Comprobante</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono uppercase" value={nuevoDoc.nro_documento} onChange={(e)=>setNuevoDoc({...nuevoDoc, nro_documento: e.target.value})} placeholder="Ej: REF-5432" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha</label>
                  <input type="date" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white [color-scheme:dark]" value={nuevoDoc.fecha_emision} onChange={(e)=>setNuevoDoc({...nuevoDoc, fecha_emision: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Monto Base (El que se movió hoy)</label>
                  <div className="flex mt-1">
                    <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-l-lg p-3 text-white font-mono" value={nuevoDoc.monto_total} onChange={(e)=>setNuevoDoc({...nuevoDoc, monto_total: formatearEnVivo(e.target.value, 2)})} onBlur={()=>setNuevoDoc({...nuevoDoc, monto_total: aplicarFormatoEstricto(nuevoDoc.monto_total, 2)})} />
                    <select className="bg-[#0f172a] border border-l-0 border-[#334155] rounded-r-lg px-3 text-white font-bold" value={nuevoDoc.moneda} onChange={(e)=>setNuevoDoc({...nuevoDoc, moneda: e.target.value})}>
                      <option value="USD">USD</option><option value="Bs">Bs</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tasa de Cambio Acordada</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono text-center" value={nuevoDoc.tasa} onChange={(e)=>setNuevoDoc({...nuevoDoc, tasa: formatearEnVivo(e.target.value, 3)})} onBlur={()=>setNuevoDoc({...nuevoDoc, tasa: aplicarFormatoEstricto(nuevoDoc.tasa, 3)})} />
                </div>
                <div className="md:col-span-2 bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg flex justify-between items-center">
                  <span className="text-[10px] font-bold text-purple-400 uppercase">CONTRAPARTE CALCULADA QUE DEBE MOVERSE:</span>
                  <span className="text-2xl font-black font-mono text-purple-400">{valorEqVivo.toLocaleString('de-DE', {minimumFractionDigits:2})} {monedaEqViva}</span>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Concepto / Notas Adicionales</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={nuevoDoc.concepto} onChange={(e)=>setNuevoDoc({...nuevoDoc, concepto: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-4 border-t border-[#334155] pt-4">
                <button onClick={()=>setModalNuevoOpen(false)} className="text-slate-400 font-bold hover:text-white">CANCELAR</button>
                <button onClick={guardarNuevoDocumento} className="bg-purple-500 text-white px-6 py-2 rounded-lg font-black uppercase text-xs">GUARDAR REGISTRO</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL LIQUIDAR (COMPENSAR) CON EL NUEVO CAMPO DE REFERENCIA */}
        {modalAbonoOpen && registroSeleccionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-[#334155] shadow-2xl p-8 animate-in zoom-in duration-200">
              <h3 className="text-lg font-bold text-purple-400 mb-2 uppercase tracking-tighter">Liquidar Operación</h3>
              <p className="text-xs text-slate-400 mb-6">Confirmar liquidación con <span className="text-white font-bold">{registroSeleccionado.socio}</span></p>
              
              <div className="mb-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-purple-400 uppercase">Monto Base a Liquidar ({registroSeleccionado.moneda})</label>
                  <input type="text" className="w-full bg-black/40 border border-purple-500/30 focus:border-purple-500 rounded-lg p-4 mt-1 text-white font-mono text-xl text-center outline-none transition-colors" value={abono} onChange={(e)=>setAbono(e.target.value)} />
                </div>
                
                {/* AQUÍ ESTÁ EL NUEVO CAMPO DE REFERENCIA */}
                <div>
                  <label className="text-[10px] font-bold text-slate-300 uppercase">Referencia de Pago (Opcional)</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] focus:border-purple-500 rounded-lg p-3 mt-1 text-white font-mono text-sm text-center outline-none uppercase placeholder:text-slate-600 transition-colors" placeholder="EJ: ZELLE-9988" value={refLiquidacion} onChange={(e)=>setRefLiquidacion(e.target.value)} />
                </div>

                <p className="text-[10px] text-slate-500 mt-2 text-center leading-relaxed">Esto indica que la contraparte de divisas ha sido entregada o recibida satisfactoriamente.</p>
              </div>

              <div className="flex justify-end gap-4 border-t border-[#334155] pt-4">
                <button onClick={()=>{setModalAbonoOpen(false);}} className="text-slate-400 font-bold hover:text-white transition-colors">CANCELAR</button>
                <button onClick={procesarAbono} className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-black uppercase text-xs hover:bg-emerald-400 shadow-lg">✔ CONFIRMAR</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}