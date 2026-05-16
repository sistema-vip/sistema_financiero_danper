"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function ConciliacionPagosPage() {
  const [pagosPendientes, setPagosPendientes] = useState<any[]>([]);
  const [cxcPendientes, setCxcPendientes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState<any>(null);
  const [cxcSeleccionada, setCxcSeleccionada] = useState<string>('');
  const [busquedaCxc, setBusquedaCxc] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setIsLoading(true);
    try {
      // 1. Cargar Pagos Pendientes por Conciliar (Clasificación COBRANZA)
      const resPagos = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?estado_conciliacion=eq.Pendiente&clasificacion=eq.COBRANZA&order=fecha.asc`, { headers: SUPABASE_HEADERS });
      if (resPagos.ok) setPagosPendientes(await resPagos.json());

      // 2. Cargar CxC (Deudas vivas de clientes)
      const resCxc = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_por_cobrar?estatus=neq.Pagado&order=cliente.asc`, { headers: SUPABASE_HEADERS });
      if (resCxc.ok) setCxcPendientes(await resCxc.json());
      
    } catch (e) {
      console.error("Error al cargar datos:", e);
    }
    setIsLoading(false);
  };

  const formatearMonto = (valor: number) => valor.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const calcularEquivalenteDolares = (pago: any) => {
    const monto = parseFloat(pago.monto);
    const tasa = parseFloat(pago.tasa) || 1;
    return pago.moneda === 'Bs' ? (monto / tasa) : monto;
  };

  const procesarConciliacion = async () => {
    if (!cxcSeleccionada) return alert("Selecciona la factura a la que pertenece este pago.");
    
    const cxcObj = cxcPendientes.find(c => c.id === cxcSeleccionada);
    if (!cxcObj) return;

    // Calculamos el valor real del pago en USD para descontarlo a la factura
    const abonoUSD = calcularEquivalenteDolares(pagoSeleccionado);
    
    if (abonoUSD > parseFloat(cxcObj.saldo_pendiente) + 0.5) { 
      // Damos 50 centavos de holgura por temas de decimales en la tasa
      return alert("⚠️ El pago ingresado es mayor a la deuda de la factura seleccionada.");
    }

    const nuevoSaldoCxc = Math.max(0, parseFloat(cxcObj.saldo_pendiente) - abonoUSD);
    const nuevoEstatusCxc = nuevoSaldoCxc < 0.1 ? 'Pagado' : 'Parcial';

    try {
      // 1. Actualizamos la Factura (CxC)
      const res1 = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_por_cobrar?id=eq.${cxcObj.id}`, {
        method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify({
          saldo_pendiente: nuevoSaldoCxc,
          estatus: nuevoEstatusCxc
        })
      });

      // 2. Actualizamos el Movimiento (Lo marcamos como Conciliado)
      const res2 = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?id=eq.${pagoSeleccionado.id}`, {
        method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify({
          estado_conciliacion: 'Conciliado',
          cxc_id_aplicado: cxcObj.id
        })
      });

      if (res1.ok && res2.ok) {
        alert("✅ Pago conciliado exitosamente. La factura ha sido rebajada.");
        setModalOpen(false);
        setCxcSeleccionada('');
        setPagoSeleccionado(null);
        cargarDatos();
      } else {
        alert("❌ Ocurrió un error en la base de datos.");
      }
    } catch (e) {
      alert("Error de conexión");
    }
  };

  const cxcFiltradas = cxcPendientes.filter(c => 
    c.cliente.toLowerCase().includes(busquedaCxc.toLowerCase()) || 
    c.nro_documento?.toLowerCase().includes(busquedaCxc.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-300 max-w-6xl mx-auto space-y-8 pb-10 mt-6 px-4 lg:px-0 ml-2 lg:ml-8">
      
      <div className="flex items-center gap-3 border-b border-[#334155] pb-4 mt-6">
        <span className="text-4xl">🔗</span>
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Conciliación de Pagos</h2>
          <p className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Aplicación de Cobranzas a Facturas</p>
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-2xl border border-[#334155] shadow-xl overflow-hidden">
        <div className="bg-[#0f172a] p-4 border-b border-[#334155]">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Bandeja de Entradas (Pagos sin aplicar)</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#1e293b] text-slate-400 uppercase tracking-wider border-b border-[#334155]">
              <tr>
                <th className="p-4">FECHA DEPÓSITO</th>
                <th className="p-4">CLIENTE / PAGADOR</th>
                <th className="p-4">REFERENCIA / BANCO</th>
                <th className="p-4 text-right">MONTO RECIBIDO</th>
                <th className="p-4 text-center">ACCIÓN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {isLoading ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500">Cargando pagos...</td></tr>
              ) : pagosPendientes.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-emerald-500 font-bold">🎉 No hay pagos pendientes. Todo está conciliado.</td></tr>
              ) : pagosPendientes.map(pago => (
                <tr key={pago.id} className="hover:bg-white/5 transition-colors text-white">
                  <td className="p-4 font-mono text-slate-300">{pago.fecha}</td>
                  <td className="p-4 font-bold text-emerald-400 uppercase">{pago.persona}</td>
                  <td className="p-4">
                    <div className="font-bold">Ref: {pago.referencia}</div>
                    <div className="text-slate-400 text-[10px] truncate max-w-[200px]">{pago.descripcion}</div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-mono font-bold text-sm text-emerald-400">
                      {formatearMonto(parseFloat(pago.monto))} {pago.moneda}
                    </div>
                    {pago.moneda === 'Bs' && (
                      <div className="text-[10px] text-slate-400 font-mono mt-1">
                        Equiv: ${formatearMonto(calcularEquivalenteDolares(pago))} (Tasa: {pago.tasa})
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => { setPagoSeleccionado(pago); setModalOpen(true); }}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      Aplicar a Factura
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CONCILIACIÓN */}
      {modalOpen && pagoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] w-full max-w-3xl rounded-2xl border border-[#334155] shadow-2xl p-6 flex flex-col max-h-[90vh]">
            
            <div className="border-b border-[#334155] pb-4 mb-4">
              <h3 className="text-lg font-bold text-emerald-400 uppercase tracking-tighter">Enlazar Pago a Factura</h3>
              <p className="text-xs text-slate-400">Selecciona a qué cuenta por cobrar pertenece este ingreso.</p>
            </div>
            
            {/* Resumen del Pago */}
            <div className="bg-black/30 p-4 rounded-xl border border-emerald-500/20 mb-6 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Pagador Registrado</p>
                <p className="font-bold text-white uppercase">{pagoSeleccionado.persona}</p>
                <p className="text-[10px] text-slate-500 mt-1">Ref: {pagoSeleccionado.referencia}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Valor a Descontar (USD)</p>
                <p className="text-2xl font-black font-mono text-emerald-400">
                  ${formatearMonto(calcularEquivalenteDolares(pagoSeleccionado))}
                </p>
              </div>
            </div>

            {/* Buscador de Facturas */}
            <div className="relative mb-4">
              <input 
                type="text" 
                placeholder="Buscar cliente o factura..." 
                className="w-full bg-black/40 border border-[#334155] rounded-lg py-3 px-4 text-sm text-white focus:border-emerald-500 outline-none"
                value={busquedaCxc}
                onChange={(e) => setBusquedaCxc(e.target.value)}
              />
            </div>

            {/* Lista de CxC */}
            <div className="flex-1 overflow-y-auto min-h-[200px] bg-black/20 rounded-lg border border-[#334155] p-2 custom-scrollbar">
              {cxcFiltradas.length === 0 ? (
                <p className="text-center text-slate-500 p-6 text-sm">No hay facturas pendientes o que coincidan con la búsqueda.</p>
              ) : (
                <div className="space-y-2">
                  {cxcFiltradas.map(cxc => (
                    <div 
                      key={cxc.id} 
                      onClick={() => setCxcSeleccionada(cxc.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all flex justify-between items-center ${cxcSeleccionada === cxc.id ? 'bg-emerald-500/10 border-emerald-500' : 'bg-[#0f172a] border-[#334155] hover:border-slate-400'}`}
                    >
                      <div>
                        <p className="font-bold text-sm text-white uppercase">{cxc.cliente}</p>
                        <p className="text-[10px] text-slate-400">Doc: {cxc.nro_documento} | Emisión: {cxc.fecha_emision}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Saldo Deudor</p>
                        <p className="font-mono font-bold text-rose-400">${formatearMonto(parseFloat(cxc.saldo_pendiente))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 border-t border-[#334155] pt-4 mt-4">
              <button onClick={()=>{setModalOpen(false); setCxcSeleccionada('');}} className="text-slate-400 font-bold hover:text-white transition-colors text-sm">CANCELAR</button>
              <button 
                onClick={procesarConciliacion}
                disabled={!cxcSeleccionada} 
                className={`px-6 py-2 rounded-lg font-black uppercase text-xs transition-colors ${cxcSeleccionada ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
              >
                APLICAR PAGO Y CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}