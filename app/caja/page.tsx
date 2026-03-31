"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

// ============================================================
// MÓDULO: ESTADO DE CAJA
// Muestra el estado de cuenta detallado de cada caja/banco.
// Permite filtrar por período, buscar, editar y eliminar movimientos.
// Genera el estado de cuenta imprimible con saldo acumulado por fila.
// ============================================================

export default function CajaPage() {
  const [cajas, setCajas] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const hoy = new Date().toISOString().split('T')[0];
  const [filtroCaja, setFiltroCaja] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroDesde, setFiltroDesde] = useState(hoy);
  const [filtroHasta, setFiltroHasta] = useState(hoy);
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroTipo, setFiltroTipo] = useState(''); // 'Recibo de Ingreso' | 'Recibo de Egreso' | ''

  // Impresión
  const [modoImpresion, setModoImpresion] = useState<'tabla' | 'recibo'>('tabla');
  const [ticketImpresion, setTicketImpresion] = useState<any>(null);

  // Modal edición
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [movEditable, setMovEditable] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Totales de la caja seleccionada
  const [saldoCaja, setSaldoCaja] = useState<{ saldoInicial: number; totalIngresos: number; totalEgresos: number; saldoFinal: number } | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (filtroCaja && cajas.length > 0 && movimientos.length >= 0) {
      calcularTotalesCaja();
    } else {
      setSaldoCaja(null);
    }
  }, [filtroCaja, cajas, movimientos]);

  const cargarDatos = async () => {
    setIsLoading(true);
    try {
      const [resCajas, resMov] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/cajas?select=*&order=nombre.asc`, { headers: SUPABASE_HEADERS }),
        fetch(`${SUPABASE_URL}/rest/v1/movimientos?select=*&order=fecha.asc,id.asc`, { headers: SUPABASE_HEADERS }),
      ]);
      const dataCajas = resCajas.ok ? await resCajas.json() : [];
      const dataMov = resMov.ok ? await resMov.json() : [];
      setCajas(dataCajas);
      setMovimientos(dataMov);
    } catch (e) {
      console.error('Error cargando datos:', e);
    }
    setIsLoading(false);
  };

  const calcularTotalesCaja = () => {
    const caja = cajas.find((c) => c.id.toString() === filtroCaja);
    if (!caja) return;
    const saldoInicial = parseFloat(caja.saldo_inicial || 0);
    const movsCaja = movimientos.filter((m) => m.caja_id?.toString() === filtroCaja);
    let totalIngresos = 0;
    let totalEgresos = 0;
    movsCaja.forEach((m) => {
      const monto = parseFloat(m.monto || 0);
      if (m.tipo === 'Recibo de Ingreso') totalIngresos += monto;
      else totalEgresos += monto;
    });
    setSaldoCaja({ saldoInicial, totalIngresos, totalEgresos, saldoFinal: saldoInicial + totalIngresos - totalEgresos });
  };

  // Movimientos con saldo acumulado por fila (solo de la caja seleccionada, en orden cronológico)
  const movimientosConSaldo = (() => {
    if (!filtroCaja) return [];
    const caja = cajas.find((c) => c.id.toString() === filtroCaja);
    if (!caja) return [];
    let saldoAcum = parseFloat(caja.saldo_inicial || 0);
    return movimientos
      .filter((m) => m.caja_id?.toString() === filtroCaja)
      .map((m) => {
        const monto = parseFloat(m.monto || 0);
        if (m.tipo === 'Recibo de Ingreso') saldoAcum += monto;
        else saldoAcum -= monto;
        return { ...m, saldo_fila: saldoAcum, nombre_caja: caja.nombre };
      })
      .reverse(); // Más recientes primero para la vista
  })();

  // Aplicar filtros de fecha, búsqueda y tipo
  const movimientosFiltrados = movimientosConSaldo.filter((m) => {
    const coincideBusqueda =
      filtroBusqueda === '' ||
      m.persona?.toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
      m.descripcion?.toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
      m.referencia?.toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
      m.clasificacion?.toLowerCase().includes(filtroBusqueda.toLowerCase());
    const coincideDesde = filtroDesde === '' || m.fecha >= filtroDesde;
    const coincideHasta = filtroHasta === '' || m.fecha <= filtroHasta;
    const coincideTipo = filtroTipo === '' || m.tipo === filtroTipo;
    return coincideBusqueda && coincideDesde && coincideHasta && coincideTipo;
  });

  // Totales del período filtrado
  const totalesFiltro = movimientosFiltrados.reduce(
    (acc, m) => {
      const monto = parseFloat(m.monto || 0);
      if (m.tipo === 'Recibo de Ingreso') acc.ingresos += monto;
      else acc.egresos += monto;
      return acc;
    },
    { ingresos: 0, egresos: 0 }
  );

  const manejarCambioMes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFiltroMes(val);
    if (val) {
      const [anio, mes] = val.split('-').map(Number);
      const primer = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const ultimo = new Date(anio, mes, 0).toISOString().split('T')[0];
      setFiltroDesde(primer);
      setFiltroHasta(ultimo);
    }
  };

  const eliminarMovimiento = async (id: string) => {
    if (!confirm('⚠️ ¿Eliminar este movimiento? El saldo se recalculará automáticamente.')) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?id=eq.${id}`, { method: 'DELETE', headers: SUPABASE_HEADERS });
      if (res.ok) { alert('🗑️ Movimiento eliminado.'); cargarDatos(); }
    } catch (e) { alert('Error al eliminar.'); }
  };

  const abrirModalEditar = (mov: any) => {
    setMovEditable({ ...mov });
    setModalEditarOpen(true);
  };

  const guardarEdicion = async () => {
    if (!movEditable) return;
    setIsSaving(true);
    try {
      const montoLimpio = parseFloat(movEditable.monto.toString().replace(/\./g, '').replace(',', '.')) || 0;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?id=eq.${movEditable.id}`, {
        method: 'PATCH',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({
          fecha: movEditable.fecha,
          persona: movEditable.persona?.toUpperCase(),
          descripcion: movEditable.descripcion,
          referencia: movEditable.referencia,
          clasificacion: movEditable.clasificacion,
          monto: montoLimpio,
        }),
      });
      if (res.ok) {
        alert('✅ Movimiento actualizado.');
        setModalEditarOpen(false);
        cargarDatos();
      } else {
        alert('❌ Error al guardar.');
      }
    } catch (e) {
      alert('❌ Error de conexión.');
    }
    setIsSaving(false);
  };

  const imprimirTabla = () => {
    setModoImpresion('tabla');
    setTimeout(() => window.print(), 150);
  };

  const imprimirRecibo = (mov: any) => {
    setModoImpresion('recibo');
    setTicketImpresion(mov);
    setTimeout(() => window.print(), 150);
  };

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cajaActual = cajas.find((c) => c.id.toString() === filtroCaja);

  return (
    <>
      {/* ESTILOS DE IMPRESIÓN */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          ${modoImpresion === 'tabla' ? `
            @page { size: landscape; margin: 10mm; }
            #zona-impresion-caja, #zona-impresion-caja * { visibility: visible !important; color: black !important; }
            #zona-impresion-caja { position: fixed !important; left: 0 !important; top: 0 !important; width: 100vw !important; margin: 0 !important; padding: 0 !important; background-color: white !important; }
            table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; margin-top: 10px !important; }
            tr { page-break-inside: avoid !important; }
            th, td { border: 1px solid #666 !important; padding: 5px !important; font-size: 8px !important; white-space: normal !important; word-wrap: break-word !important; }
            th { background-color: #f3f4f6 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .ocultar-print { display: none !important; }
          ` : `
            @page { size: auto; margin: 0; }
            #recibo-caja, #recibo-caja * { visibility: visible !important; color: black !important; }
            #recibo-caja { position: fixed !important; left: 0 !important; top: 0 !important; width: 100vw !important; height: 100vh !important; margin: 0 !important; padding: 20mm !important; background-color: white !important; z-index: 999999 !important; }
          `}
        }
      `}</style>

      <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8 pb-10 ml-2 lg:ml-8 print:hidden">

        {/* CABECERA */}
        <div className="flex items-center gap-3 border-b border-[#334155] pb-4 mt-6">
          <span className="text-4xl">💳</span>
          <div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Estado de Caja</h2>
            <p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Movimientos · Saldos · Auditoría</p>
          </div>
        </div>

        {/* TARJETAS DE RESUMEN (solo si hay caja seleccionada) */}
        {saldoCaja && cajaActual && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-slate-500"></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3 mb-1">Saldo Inicial</p>
              <p className="text-xl font-black font-mono text-slate-300 pl-3">{fmt(saldoCaja.saldoInicial)}</p>
            </div>
            <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-emerald-500"></div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest pl-3 mb-1">Total Ingresos</p>
              <p className="text-xl font-black font-mono text-emerald-400 pl-3">+ {fmt(saldoCaja.totalIngresos)}</p>
            </div>
            <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-rose-500"></div>
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest pl-3 mb-1">Total Egresos</p>
              <p className="text-xl font-black font-mono text-rose-400 pl-3">- {fmt(saldoCaja.totalEgresos)}</p>
            </div>
            <div className="bg-[#1e293b] border border-emerald-500/40 rounded-xl p-4 relative overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <div className="absolute left-0 top-0 w-1 h-full bg-[#10b981]"></div>
              <p className="text-[10px] font-bold text-[#10b981] uppercase tracking-widest pl-3 mb-1">Saldo Actual</p>
              <p className={`text-xl font-black font-mono pl-3 ${saldoCaja.saldoFinal >= 0 ? 'text-[#10b981]' : 'text-rose-400'}`}>
                {fmt(saldoCaja.saldoFinal)} <span className="text-xs font-normal text-slate-400">{cajaActual.moneda}</span>
              </p>
            </div>
          </div>
        )}

        {/* BARRA DE FILTROS */}
        <div className="bg-[#1e293b] p-5 rounded-2xl border border-[#334155] shadow-xl flex flex-wrap gap-4 items-end">
          {/* Selector de Caja */}
          <div className="w-full md:w-52">
            <label className="block text-[10px] font-bold text-[#38bdf8] uppercase tracking-widest mb-2">1. Caja / Banco</label>
            <div className="relative">
              <select
                className="w-full bg-black/40 border border-[#38bdf8]/50 rounded-lg p-3 text-sm text-white font-bold focus:border-[#38bdf8] outline-none appearance-none cursor-pointer"
                value={filtroCaja}
                onChange={(e) => setFiltroCaja(e.target.value)}
              >
                <option value="">-- Seleccione --</option>
                {cajas.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.nombre} ({c.moneda})</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#38bdf8] text-xs">▼</div>
            </div>
          </div>

          {/* Tipo */}
          <div className="w-full md:w-44">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tipo</label>
            <div className="relative">
              <select
                className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none appearance-none"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                disabled={!filtroCaja}
              >
                <option value="">Todos</option>
                <option value="Recibo de Ingreso">Solo Ingresos</option>
                <option value="Recibo de Egreso">Solo Egresos</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Buscar</label>
            <input
              type="text"
              placeholder="Nombre, referencia, concepto..."
              className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none"
              value={filtroBusqueda}
              onChange={(e) => setFiltroBusqueda(e.target.value)}
              disabled={!filtroCaja}
            />
          </div>

          {/* Mes rápido */}
          <div className="w-full sm:w-36">
            <label className="block text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">Mes Rápido</label>
            <input
              type="month"
              className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-sm text-purple-400 outline-none [color-scheme:dark] cursor-pointer"
              value={filtroMes}
              onChange={manejarCambioMes}
              onClick={(e: any) => e.target.showPicker()}
              disabled={!filtroCaja}
            />
          </div>

          {/* Desde */}
          <div className="w-full sm:w-36">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Desde</label>
            <input
              type="date"
              className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white outline-none [color-scheme:dark] cursor-pointer"
              value={filtroDesde}
              onChange={(e) => { setFiltroDesde(e.target.value); setFiltroMes(''); }}
              onClick={(e: any) => e.target.showPicker()}
              disabled={!filtroCaja}
            />
          </div>

          {/* Hasta */}
          <div className="w-full sm:w-36">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Hasta</label>
            <input
              type="date"
              className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white outline-none [color-scheme:dark] cursor-pointer"
              value={filtroHasta}
              onChange={(e) => { setFiltroHasta(e.target.value); setFiltroMes(''); }}
              onClick={(e: any) => e.target.showPicker()}
              disabled={!filtroCaja}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button onClick={cargarDatos} disabled={!filtroCaja} className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg disabled:opacity-40 transition-colors" title="Refrescar">🔄</button>
            <button onClick={imprimirTabla} disabled={!filtroCaja} className="bg-[#38bdf8] hover:bg-sky-400 text-white p-3 rounded-lg disabled:opacity-40 shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-colors" title="Imprimir Estado de Cuenta">🖨️</button>
          </div>
        </div>

        {/* RESUMEN DEL PERÍODO FILTRADO */}
        {filtroCaja && movimientosFiltrados.length > 0 && (
          <div className="flex flex-wrap gap-4 items-center bg-black/20 border border-[#334155] rounded-xl px-5 py-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período seleccionado:</span>
            <span className="text-xs font-bold text-white">{movimientosFiltrados.length} movimientos</span>
            <div className="flex gap-4 ml-auto">
              <div className="text-right">
                <p className="text-[9px] text-slate-500 uppercase">Ingresos</p>
                <p className="font-mono font-bold text-emerald-400 text-sm">+ {fmt(totalesFiltro.ingresos)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500 uppercase">Egresos</p>
                <p className="font-mono font-bold text-rose-400 text-sm">- {fmt(totalesFiltro.egresos)}</p>
              </div>
              <div className="text-right border-l border-[#334155] pl-4">
                <p className="text-[9px] text-slate-500 uppercase">Neto Período</p>
                <p className={`font-mono font-black text-sm ${totalesFiltro.ingresos - totalesFiltro.egresos >= 0 ? 'text-[#10b981]' : 'text-rose-400'}`}>
                  {fmt(totalesFiltro.ingresos - totalesFiltro.egresos)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TABLA DE MOVIMIENTOS */}
        <div id="zona-impresion-caja" className="bg-[#1e293b] rounded-2xl border border-[#334155] overflow-hidden shadow-xl print:shadow-none print:border-none print:bg-white">

          {/* Encabezado de impresión */}
          <div className="hidden print:block text-center mb-4 border-b-2 border-black pb-4 pt-4">
            <h1 className="text-xl font-black italic">PRINCESS TRAVEL</h1>
            <p className="text-xs font-bold tracking-widest uppercase mt-1">ESTADO DE CUENTA: {cajaActual?.nombre || '---'}</p>
            <p className="text-[10px] mt-1">Período: {filtroDesde} al {filtroHasta} | Generado: {new Date().toLocaleDateString('es-VE')}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#0f172a] text-slate-400 text-[10px] uppercase tracking-wider border-b border-[#334155] print:bg-white print:text-black">
                <tr>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Nro.</th>
                  <th className="p-4">Beneficiario / Pagador</th>
                  <th className="p-4">Concepto</th>
                  <th className="p-4">Ref.</th>
                  <th className="p-4 text-center">Clasif.</th>
                  <th className="p-4 text-right">Ingreso</th>
                  <th className="p-4 text-right">Egreso</th>
                  <th className="p-4 text-right font-black text-white print:text-black">Saldo</th>
                  <th className="p-4 text-center ocultar-print">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155] print:divide-gray-300">
                {isLoading ? (
                  <tr><td colSpan={10} className="p-12 text-center text-slate-400">Cargando movimientos...</td></tr>
                ) : !filtroCaja ? (
                  <tr>
                    <td colSpan={10} className="p-16 text-center">
                      <div className="text-5xl mb-4">💳</div>
                      <h3 className="text-xl font-bold text-white mb-2">Seleccione una Caja o Banco</h3>
                      <p className="text-slate-400 text-sm">Elija una cuenta en los filtros de arriba para ver su estado de cuenta.</p>
                    </td>
                  </tr>
                ) : movimientosFiltrados.length === 0 ? (
                  <tr><td colSpan={10} className="p-12 text-center text-slate-400 print:text-black">No hay movimientos en el período seleccionado.</td></tr>
                ) : (
                  movimientosFiltrados.map((mov: any) => {
                    const esIngreso = mov.tipo === 'Recibo de Ingreso';
                    const monto = parseFloat(mov.monto || 0);
                    return (
                      <tr key={mov.id} className="hover:bg-white/5 transition-colors print:hover:bg-transparent">
                        <td className="p-4 font-mono text-[11px] text-slate-400 print:text-black">{mov.fecha}</td>
                        <td className="p-4 font-mono text-[10px] text-slate-500 print:text-black">{mov.nro_recibo || '---'}</td>
                        <td className="p-4 font-bold text-white uppercase print:text-black text-[11px]">{mov.persona}</td>
                        <td className="p-4 text-slate-400 print:text-black text-[10px] truncate max-w-[140px] print:max-w-none">{mov.descripcion || '---'}</td>
                        <td className="p-4 font-mono text-[10px] text-[#38bdf8] print:text-black font-bold">{mov.referencia || '---'}</td>
                        <td className="p-4 text-center text-[9px] text-slate-500 uppercase print:text-black">{mov.clasificacion || '---'}</td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-400 print:text-black">
                          {esIngreso ? fmt(monto) : ''}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-rose-400 print:text-black">
                          {!esIngreso ? fmt(monto) : ''}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-white bg-black/20 print:bg-transparent print:text-black text-sm">
                          {fmt(mov.saldo_fila)}
                        </td>
                        <td className="p-4 text-center ocultar-print">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => abrirModalEditar(mov)} className="text-slate-400 hover:text-[#38bdf8] transition-colors text-base" title="Editar">✏️</button>
                            <button onClick={() => imprimirRecibo(mov)} className="text-slate-400 hover:text-emerald-400 transition-colors text-base" title="Imprimir Recibo">🖨️</button>
                            <button onClick={() => eliminarMovimiento(mov.id)} className="text-slate-400 hover:text-rose-500 transition-colors text-base" title="Eliminar">🗑️</button>
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
      </div>

      {/* MODAL DE EDICIÓN */}
      {modalEditarOpen && movEditable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-[#334155] shadow-2xl p-6 animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-4 uppercase border-b border-[#334155] pb-3">✏️ Editar Movimiento</h3>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha</label>
                  <input type="date" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white [color-scheme:dark] outline-none focus:border-[#38bdf8]" value={movEditable.fecha} onChange={(e) => setMovEditable({ ...movEditable, fecha: e.target.value })} onClick={(e: any) => e.target.showPicker()} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#38bdf8] uppercase">Monto ({movEditable.moneda})</label>
                  <input type="text" className="w-full bg-black/40 border border-[#38bdf8]/50 rounded-lg p-3 mt-1 text-white font-mono outline-none focus:border-[#38bdf8]" value={movEditable.monto} onChange={(e) => setMovEditable({ ...movEditable, monto: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Beneficiario / Pagador</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold outline-none focus:border-[#38bdf8]" value={movEditable.persona || ''} onChange={(e) => setMovEditable({ ...movEditable, persona: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Referencia</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono uppercase outline-none focus:border-[#38bdf8]" value={movEditable.referencia || ''} onChange={(e) => setMovEditable({ ...movEditable, referencia: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Clasificación</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase outline-none focus:border-[#38bdf8]" value={movEditable.clasificacion || ''} onChange={(e) => setMovEditable({ ...movEditable, clasificacion: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Concepto / Descripción</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white outline-none focus:border-[#38bdf8]" value={movEditable.descripcion || ''} onChange={(e) => setMovEditable({ ...movEditable, descripcion: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#334155]">
              <button onClick={() => setModalEditarOpen(false)} disabled={isSaving} className="px-4 py-2 text-slate-400 font-bold hover:text-white transition-colors text-xs">CANCELAR</button>
              <button onClick={guardarEdicion} disabled={isSaving} className={`px-6 py-2 rounded-lg font-bold text-white uppercase text-xs transition-colors ${isSaving ? 'bg-slate-600' : 'bg-[#38bdf8] hover:bg-sky-400'}`}>
                {isSaving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECIBO INDIVIDUAL PARA IMPRESIÓN */}
      {modoImpresion === 'recibo' && ticketImpresion && (
        <div id="recibo-caja" className="hidden print:block font-sans">
          <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-5">
            <div>
              <h1 className="text-base font-black italic m-0 p-0 text-black">PRINCESS TRAVEL</h1>
              <p className="text-[8px] font-bold tracking-[0.2em] uppercase m-0 p-0 text-black">Management & Tourism</p>
            </div>
            <div className="text-right">
              <h2 className="text-sm font-black uppercase border border-black px-3 py-1 rounded inline-block m-0 text-black">{ticketImpresion.tipo}</h2>
              <p className="text-xs font-mono mt-1 text-black">Nro: {ticketImpresion.nro_recibo || 'S/N'}</p>
            </div>
          </div>
          <div className="space-y-4 text-xs mb-8">
            <div className="grid grid-cols-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-black m-0"><span className="text-[9px] font-bold text-gray-500 block uppercase mb-0.5">Fecha</span>{ticketImpresion.fecha}</p>
              <p className="text-right text-black m-0"><span className="text-[9px] font-bold text-gray-500 block uppercase mb-0.5">Cuenta / Caja</span>{ticketImpresion.nombre_caja}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5 m-0">Beneficiario / Pagador</p>
              <p className="text-sm font-black uppercase border-b border-gray-200 pb-1 m-0 text-black">{ticketImpresion.persona}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5 m-0">Monto</p>
              <p className="text-2xl font-black text-black m-0">{parseFloat(ticketImpresion.monto).toLocaleString('de-DE', { minimumFractionDigits: 2 })} {ticketImpresion.moneda}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-1 m-0">Concepto</p>
              <p className="text-xs font-medium text-black m-0">{ticketImpresion.descripcion || 'Sin descripción.'}</p>
              <p className="text-[10px] text-gray-500 mt-2 m-0">Ref: {ticketImpresion.referencia || 'S/R'} | Clasif: {ticketImpresion.clasificacion || '---'}</p>
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
