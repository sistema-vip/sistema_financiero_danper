"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

// ============================================================
// MÓDULO: CONCILIACIÓN BANCARIA
// Compara los movimientos del sistema contra el extracto bancario.
// Permite marcar movimientos como "Conciliados" o "En Diferencia".
// Genera el reporte de conciliación imprimible.
// ============================================================

type EstadoConciliacion = 'Pendiente' | 'Conciliado' | 'En Diferencia' | 'No Aplica';

export default function ConciliacionBancariaPage() {
  const [cajas, setCajas] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filtros
  const hoy = new Date().toISOString().split('T')[0];
  const mesActual = hoy.substring(0, 7);
  const [filtroCaja, setFiltroCaja] = useState('');
  const [filtroMes, setFiltroMes] = useState(mesActual);
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoConciliacion | ''>('');

  // Saldo del extracto bancario (ingresado manualmente)
  const [saldoExtracto, setSaldoExtracto] = useState('');
  const [mostrarResumen, setMostrarResumen] = useState(false);

  // Modal de detalle de movimiento
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [movDetalle, setMovDetalle] = useState<any>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  // Cuando cambia el mes rápido, actualiza las fechas
  useEffect(() => {
    if (filtroMes) {
      const [anio, mes] = filtroMes.split('-').map(Number);
      const primer = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const ultimo = new Date(anio, mes, 0).toISOString().split('T')[0];
      setFiltroDesde(primer);
      setFiltroHasta(ultimo);
    }
  }, [filtroMes]);

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

  // Movimientos filtrados por caja, período y estado
  const movimientosFiltrados = movimientos.filter((m) => {
    const coincideCaja = !filtroCaja || m.caja_id?.toString() === filtroCaja;
    const coincideDesde = !filtroDesde || m.fecha >= filtroDesde;
    const coincideHasta = !filtroHasta || m.fecha <= filtroHasta;
    const coincideEstado = !filtroEstado || m.estado_conciliacion === filtroEstado;
    // Excluimos los "No Aplica" de la vista principal (transferencias internas, etc.)
    const esRelevante = m.estado_conciliacion !== 'No Aplica';
    return coincideCaja && coincideDesde && coincideHasta && coincideEstado && esRelevante;
  });

  // Cálculos del resumen de conciliación
  const cajaActual = cajas.find((c) => c.id.toString() === filtroCaja);

  const movsCaja = movimientos.filter(
    (m) => m.caja_id?.toString() === filtroCaja && m.estado_conciliacion !== 'No Aplica'
  );

  const movsPeriodo = movsCaja.filter(
    (m) => (!filtroDesde || m.fecha >= filtroDesde) && (!filtroHasta || m.fecha <= filtroHasta)
  );

  const totalIngresosLibros = movsPeriodo
    .filter((m) => m.tipo === 'Recibo de Ingreso')
    .reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);

  const totalEgresosLibros = movsPeriodo
    .filter((m) => m.tipo === 'Recibo de Egreso')
    .reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);

  const saldoLibros = (cajaActual ? parseFloat(cajaActual.saldo_inicial || 0) : 0) + totalIngresosLibros - totalEgresosLibros;

  const movsConciliados = movsPeriodo.filter((m) => m.estado_conciliacion === 'Conciliado').length;
  const movsPendientes = movsPeriodo.filter((m) => m.estado_conciliacion === 'Pendiente').length;
  const movsEnDiferencia = movsPeriodo.filter((m) => m.estado_conciliacion === 'En Diferencia').length;

  const saldoExtractoNum = parseFloat(saldoExtracto.replace(/\./g, '').replace(',', '.')) || 0;
  const diferencia = saldoLibros - saldoExtractoNum;

  // Cambiar estado de conciliación de un movimiento
  const cambiarEstado = async (movId: string, nuevoEstado: EstadoConciliacion) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?id=eq.${movId}`, {
        method: 'PATCH',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({ estado_conciliacion: nuevoEstado }),
      });
      if (res.ok) {
        // Actualización optimista: cambiamos el estado localmente sin recargar todo
        setMovimientos((prev) =>
          prev.map((m) => (m.id === movId ? { ...m, estado_conciliacion: nuevoEstado } : m))
        );
      } else {
        alert('❌ Error al actualizar el estado.');
      }
    } catch (e) {
      alert('❌ Error de conexión.');
    }
    setIsSaving(false);
  };

  // Marcar TODOS los movimientos del período como Conciliados
  const conciliarTodo = async () => {
    const pendientes = movimientosFiltrados.filter((m) => m.estado_conciliacion === 'Pendiente');
    if (pendientes.length === 0) return alert('No hay movimientos pendientes en el período.');
    if (!confirm(`¿Marcar ${pendientes.length} movimientos como Conciliados?`)) return;

    setIsSaving(true);
    try {
      await Promise.all(
        pendientes.map((m) =>
          fetch(`${SUPABASE_URL}/rest/v1/movimientos?id=eq.${m.id}`, {
            method: 'PATCH',
            headers: SUPABASE_HEADERS,
            body: JSON.stringify({ estado_conciliacion: 'Conciliado' }),
          })
        )
      );
      alert(`✅ ${pendientes.length} movimientos conciliados.`);
      cargarDatos();
    } catch (e) {
      alert('❌ Error al conciliar.');
    }
    setIsSaving(false);
  };

  const imprimirReporte = () => {
    setMostrarResumen(true);
    setTimeout(() => window.print(), 200);
  };

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const colorEstado = (estado: EstadoConciliacion | string) => {
    if (estado === 'Conciliado') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (estado === 'En Diferencia') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (estado === 'Pendiente') return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const iconoEstado = (estado: string) => {
    if (estado === 'Conciliado') return '✅';
    if (estado === 'En Diferencia') return '⚠️';
    if (estado === 'Pendiente') return '🔴';
    return '⚪';
  };

  return (
    <>
      {/* ESTILOS DE IMPRESIÓN */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body * { visibility: hidden !important; }
          #zona-conciliacion, #zona-conciliacion * { visibility: visible !important; color: black !important; }
          #zona-conciliacion { position: fixed !important; left: 0 !important; top: 0 !important; width: 100vw !important; margin: 0 !important; padding: 0 !important; background-color: white !important; }
          table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; margin-top: 10px !important; }
          tr { page-break-inside: avoid !important; }
          th, td { border: 1px solid #666 !important; padding: 5px !important; font-size: 8px !important; white-space: normal !important; word-wrap: break-word !important; }
          th { background-color: #f3f4f6 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .ocultar-print { display: none !important; }
        }
      `}</style>

      <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8 pb-10 ml-2 lg:ml-8 print:hidden">

        {/* CABECERA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#334155] pb-4 mt-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⚖️</span>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Conciliación Bancaria</h2>
              <p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Libros vs. Extracto Bancario</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={conciliarTodo}
              disabled={isSaving || !filtroCaja}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-lg font-black text-xs uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-40"
            >
              ✅ Conciliar Todo el Período
            </button>
            <button
              onClick={imprimirReporte}
              disabled={!filtroCaja}
              className="bg-[#38bdf8] hover:bg-sky-400 text-white px-5 py-2.5 rounded-lg font-black text-xs uppercase transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] disabled:opacity-40"
            >
              🖨️ Imprimir Reporte
            </button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-[#1e293b] p-5 rounded-2xl border border-[#334155] shadow-xl flex flex-wrap gap-4 items-end">
          <div className="w-full md:w-56">
            <label className="block text-[10px] font-bold text-[#38bdf8] uppercase tracking-widest mb-2">1. Banco / Caja</label>
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

          <div className="w-full sm:w-36">
            <label className="block text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">Mes</label>
            <input
              type="month"
              className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-sm text-purple-400 outline-none [color-scheme:dark] cursor-pointer"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              onClick={(e: any) => e.target.showPicker()}
              disabled={!filtroCaja}
            />
          </div>

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

          <div className="w-full md:w-44">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Estado</label>
            <div className="relative">
              <select
                className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-sm text-white focus:border-[#38bdf8] outline-none appearance-none"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as EstadoConciliacion | '')}
                disabled={!filtroCaja}
              >
                <option value="">Todos</option>
                <option value="Pendiente">🔴 Pendientes</option>
                <option value="Conciliado">✅ Conciliados</option>
                <option value="En Diferencia">⚠️ En Diferencia</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
          </div>

          <button onClick={cargarDatos} disabled={!filtroCaja} className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg disabled:opacity-40 transition-colors" title="Refrescar">🔄</button>
        </div>

        {/* PANEL DE CONCILIACIÓN (solo si hay caja seleccionada) */}
        {filtroCaja && cajaActual && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* COLUMNA IZQUIERDA: Resumen de Libros */}
            <div className="lg:col-span-2 space-y-4">

              {/* Tarjetas de estado */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Pendientes</p>
                  <p className="text-3xl font-black text-rose-400">{movsPendientes}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Sin conciliar</p>
                </div>
                <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Conciliados</p>
                  <p className="text-3xl font-black text-emerald-400">{movsConciliados}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Verificados</p>
                </div>
                <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Diferencias</p>
                  <p className="text-3xl font-black text-amber-400">{movsEnDiferencia}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Requieren revisión</p>
                </div>
              </div>

              {/* Resumen financiero del período */}
              <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-[#334155] pb-2">
                  Resumen Financiero del Período — {cajaActual.nombre}
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Saldo Inicial de la Cuenta</span>
                    <span className="font-mono font-bold text-slate-300">{fmt(parseFloat(cajaActual.saldo_inicial || 0))} {cajaActual.moneda}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-emerald-400">+ Total Ingresos del Período</span>
                    <span className="font-mono font-bold text-emerald-400">+ {fmt(totalIngresosLibros)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-rose-400">- Total Egresos del Período</span>
                    <span className="font-mono font-bold text-rose-400">- {fmt(totalEgresosLibros)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-[#334155] pt-3 mt-2">
                    <span className="text-sm font-bold text-white uppercase tracking-wide">= Saldo Según Libros</span>
                    <span className={`font-mono font-black text-lg ${saldoLibros >= 0 ? 'text-[#10b981]' : 'text-rose-400'}`}>
                      {fmt(saldoLibros)} {cajaActual.moneda}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: Saldo del Extracto y Diferencia */}
            <div className="space-y-4">
              <div className="bg-[#1e293b] border border-[#38bdf8]/30 rounded-xl p-5 shadow-[0_0_20px_rgba(56,189,248,0.08)]">
                <h4 className="text-xs font-bold text-[#38bdf8] uppercase tracking-widest mb-4 border-b border-[#334155] pb-2">
                  Saldo del Extracto Bancario
                </h4>
                <p className="text-[10px] text-slate-400 mb-2">Ingresa el saldo que aparece en el estado de cuenta del banco:</p>
                <input
                  type="text"
                  value={saldoExtracto}
                  onChange={(e) => setSaldoExtracto(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-black/40 border border-[#38bdf8]/30 focus:border-[#38bdf8] rounded-lg p-4 text-2xl font-black font-mono text-white text-center outline-none transition-colors"
                />
                <p className="text-[9px] text-slate-500 mt-2 text-center">Moneda: {cajaActual.moneda}</p>
              </div>

              {/* Resultado de la Diferencia */}
              {saldoExtracto && (
                <div className={`rounded-xl p-5 border ${Math.abs(diferencia) < 0.01 ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]'}`}>
                  <h4 className={`text-xs font-bold uppercase tracking-widest mb-3 ${Math.abs(diferencia) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {Math.abs(diferencia) < 0.01 ? '✅ Conciliación Perfecta' : '⚠️ Existe una Diferencia'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Saldo Libros</span>
                      <span className="font-mono font-bold text-white">{fmt(saldoLibros)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Saldo Extracto</span>
                      <span className="font-mono font-bold text-white">{fmt(saldoExtractoNum)}</span>
                    </div>
                    <div className={`flex justify-between border-t border-current/20 pt-2 mt-1 ${Math.abs(diferencia) < 0.01 ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
                      <span className="font-bold text-white">Diferencia</span>
                      <span className={`font-mono font-black text-lg ${Math.abs(diferencia) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                      </span>
                    </div>
                  </div>
                  {Math.abs(diferencia) >= 0.01 && (
                    <p className="text-[10px] text-amber-300/70 mt-3 leading-relaxed">
                      Revisa los movimientos marcados como "En Diferencia" o verifica si hay transacciones no registradas.
                    </p>
                  )}
                </div>
              )}

              {/* Progreso de conciliación */}
              {movsPeriodo.length > 0 && (
                <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Progreso</h4>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">{movsConciliados} de {movsPeriodo.length} conciliados</span>
                    <span className="font-bold text-white">{movsPeriodo.length > 0 ? Math.round((movsConciliados / movsPeriodo.length) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-[#0f172a] rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${movsPeriodo.length > 0 ? (movsConciliados / movsPeriodo.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TABLA DE MOVIMIENTOS PARA CONCILIAR */}
        <div id="zona-conciliacion" className="bg-[#1e293b] rounded-2xl border border-[#334155] overflow-hidden shadow-xl print:shadow-none print:border-none print:bg-white">

          {/* Encabezado de impresión */}
          <div className="hidden print:block text-center mb-4 border-b-2 border-black pb-4 pt-4">
            <h1 className="text-xl font-black italic">PRINCESS TRAVEL</h1>
            <p className="text-xs font-bold tracking-widest uppercase mt-1">REPORTE DE CONCILIACIÓN BANCARIA: {cajaActual?.nombre || '---'}</p>
            <p className="text-[10px] mt-1">Período: {filtroDesde} al {filtroHasta} | Generado: {new Date().toLocaleDateString('es-VE')}</p>
            {saldoExtracto && (
              <div className="flex justify-center gap-8 mt-3 text-xs font-bold">
                <span className="border border-black px-3 py-1 rounded">SALDO LIBROS: {fmt(saldoLibros)} {cajaActual?.moneda}</span>
                <span className="border border-black px-3 py-1 rounded">SALDO EXTRACTO: {fmt(saldoExtractoNum)} {cajaActual?.moneda}</span>
                <span className="border border-black px-3 py-1 rounded">DIFERENCIA: {fmt(diferencia)} {cajaActual?.moneda}</span>
              </div>
            )}
          </div>

          <div className="p-4 bg-black/20 border-b border-[#334155] flex justify-between items-center print:hidden">
            <h3 className="font-bold text-slate-300 text-sm uppercase tracking-widest">
              Movimientos del Período
              {filtroCaja && <span className="text-slate-500 font-normal ml-2">({movimientosFiltrados.length} registros)</span>}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#0f172a] text-slate-400 text-[10px] uppercase tracking-wider border-b border-[#334155] print:bg-white print:text-black">
                <tr>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Nro.</th>
                  <th className="p-4">Beneficiario / Pagador</th>
                  <th className="p-4">Referencia</th>
                  <th className="p-4">Clasificación</th>
                  <th className="p-4 text-right">Ingreso</th>
                  <th className="p-4 text-right">Egreso</th>
                  <th className="p-4 text-center ocultar-print">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155] print:divide-gray-300">
                {isLoading ? (
                  <tr><td colSpan={9} className="p-12 text-center text-slate-400">Cargando movimientos...</td></tr>
                ) : !filtroCaja ? (
                  <tr>
                    <td colSpan={9} className="p-16 text-center">
                      <div className="text-5xl mb-4">⚖️</div>
                      <h3 className="text-xl font-bold text-white mb-2">Seleccione un Banco o Caja</h3>
                      <p className="text-slate-400 text-sm">Elija la cuenta a conciliar en los filtros de arriba.</p>
                    </td>
                  </tr>
                ) : movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center">
                      <div className="text-4xl mb-3">🎉</div>
                      <p className="text-emerald-400 font-bold">No hay movimientos pendientes en este período.</p>
                    </td>
                  </tr>
                ) : (
                  movimientosFiltrados.map((mov: any) => {
                    const esIngreso = mov.tipo === 'Recibo de Ingreso';
                    const monto = parseFloat(mov.monto || 0);
                    const estado: EstadoConciliacion = mov.estado_conciliacion || 'Pendiente';
                    return (
                      <tr
                        key={mov.id}
                        className={`hover:bg-white/5 transition-colors print:hover:bg-transparent ${estado === 'Conciliado' ? 'opacity-60' : ''}`}
                      >
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded border text-[10px] font-black uppercase tracking-wide ${colorEstado(estado)}`}>
                            {iconoEstado(estado)} {estado}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-[11px] text-slate-400 print:text-black">{mov.fecha}</td>
                        <td className="p-4 font-mono text-[10px] text-slate-500 print:text-black">{mov.nro_recibo || '---'}</td>
                        <td className="p-4 font-bold text-white uppercase print:text-black text-[11px] truncate max-w-[160px]">{mov.persona}</td>
                        <td className="p-4 font-mono text-[10px] text-[#38bdf8] print:text-black font-bold">{mov.referencia || '---'}</td>
                        <td className="p-4 text-[9px] text-slate-500 uppercase print:text-black">{mov.clasificacion || '---'}</td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-400 print:text-black">
                          {esIngreso ? fmt(monto) : ''}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-rose-400 print:text-black">
                          {!esIngreso ? fmt(monto) : ''}
                        </td>
                        <td className="p-4 text-center ocultar-print">
                          <div className="flex items-center justify-center gap-1">
                            {estado !== 'Conciliado' && (
                              <button
                                onClick={() => cambiarEstado(mov.id, 'Conciliado')}
                                disabled={isSaving}
                                className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 px-2 py-1 rounded text-[9px] font-black uppercase transition-all"
                                title="Marcar como Conciliado"
                              >
                                ✅ OK
                              </button>
                            )}
                            {estado !== 'En Diferencia' && (
                              <button
                                onClick={() => cambiarEstado(mov.id, 'En Diferencia')}
                                disabled={isSaving}
                                className="bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/30 px-2 py-1 rounded text-[9px] font-black uppercase transition-all"
                                title="Marcar como En Diferencia"
                              >
                                ⚠️ Dif.
                              </button>
                            )}
                            {estado !== 'Pendiente' && (
                              <button
                                onClick={() => cambiarEstado(mov.id, 'Pendiente')}
                                disabled={isSaving}
                                className="bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white px-2 py-1 rounded text-[9px] font-black uppercase transition-all"
                                title="Revertir a Pendiente"
                              >
                                ↩ Rev.
                              </button>
                            )}
                            <button
                              onClick={() => { setMovDetalle(mov); setModalDetalleOpen(true); }}
                              className="text-slate-500 hover:text-[#38bdf8] transition-colors text-base ml-1"
                              title="Ver Detalle"
                            >
                              👁️
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
      </div>

      {/* MODAL DETALLE DE MOVIMIENTO */}
      {modalDetalleOpen && movDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-[#334155] shadow-2xl p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-5 border-b border-[#334155] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Detalle del Movimiento</h3>
                <p className="text-[#38bdf8] text-xs font-bold mt-1">Recibo Nro: {movDetalle.nro_recibo || 'S/N'}</p>
              </div>
              <button onClick={() => setModalDetalleOpen(false)} className="text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/30 p-3 rounded-lg border border-[#334155]">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Fecha</p>
                  <p className="font-mono font-bold text-white">{movDetalle.fecha}</p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-[#334155]">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Estado Conciliación</p>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase ${colorEstado(movDetalle.estado_conciliacion)}`}>
                    {movDetalle.estado_conciliacion}
                  </span>
                </div>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-[#334155]">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Beneficiario / Pagador</p>
                <p className="font-bold text-white uppercase">{movDetalle.persona}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/30 p-3 rounded-lg border border-[#334155]">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Tipo</p>
                  <p className={`font-bold text-sm ${movDetalle.tipo === 'Recibo de Ingreso' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {movDetalle.tipo}
                  </p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-[#334155]">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Referencia</p>
                  <p className="font-mono font-bold text-[#38bdf8]">{movDetalle.referencia || 'S/R'}</p>
                </div>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-[#334155]">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Concepto</p>
                <p className="text-slate-300 text-sm">{movDetalle.descripcion || 'Sin descripción.'}</p>
              </div>

              <div className="bg-[#38bdf8]/10 border border-[#38bdf8]/30 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Clasificación</p>
                  <p className="font-bold text-white uppercase text-sm mt-0.5">{movDetalle.clasificacion || '---'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Monto</p>
                  <p className={`font-mono font-black text-xl ${movDetalle.tipo === 'Recibo de Ingreso' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {movDetalle.tipo === 'Recibo de Ingreso' ? '+' : '-'}{parseFloat(movDetalle.monto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} {movDetalle.moneda}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-5 pt-4 border-t border-[#334155]">
              <div className="flex gap-2">
                {movDetalle.estado_conciliacion !== 'Conciliado' && (
                  <button
                    onClick={() => { cambiarEstado(movDetalle.id, 'Conciliado'); setModalDetalleOpen(false); }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg font-black text-xs uppercase transition-colors"
                  >
                    ✅ Conciliar
                  </button>
                )}
                {movDetalle.estado_conciliacion !== 'En Diferencia' && (
                  <button
                    onClick={() => { cambiarEstado(movDetalle.id, 'En Diferencia'); setModalDetalleOpen(false); }}
                    className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg font-black text-xs uppercase transition-colors"
                  >
                    ⚠️ Diferencia
                  </button>
                )}
              </div>
              <button onClick={() => setModalDetalleOpen(false)} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-xs uppercase transition-colors">
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
