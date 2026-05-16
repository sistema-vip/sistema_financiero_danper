"use client";
import React, { useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function CuentasPorCobrarPage() {
  const [cxc, setCxc] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modales
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [modalAbonoOpen, setModalAbonoOpen] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<any>(null);

  // Formularios (Añadido el campo "categoria")
  const [nuevoDoc, setNuevoDoc] = useState({
    categoria: 'Clientes', cliente: '', nro_documento: '', concepto: '', monto_total: '', moneda: 'USD', fecha_emision: '', fecha_vencimiento: ''
  });
  const [abono, setAbono] = useState('');
  const [refAbono, setRefAbono] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setIsLoading(true);
    try {
      const resCxC = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_por_cobrar?select=*&order=fecha_vencimiento.asc`, { headers: SUPABASE_HEADERS });
      if (resCxC.ok) setCxc(await resCxC.json());

      const resClientes = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=nombre_razon,rif_cedula&order=nombre_razon.asc`, { headers: SUPABASE_HEADERS });
      if (resClientes.ok) setClientes(await resClientes.json());
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const parsearMonto = (valor: string) => parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
  const formatearMonto = (valor: number) => valor.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const guardarNuevoDocumento = async () => {
    const montoNum = parsearMonto(nuevoDoc.monto_total);
    if (!nuevoDoc.cliente || montoNum <= 0 || !nuevoDoc.fecha_emision || !nuevoDoc.fecha_vencimiento) {
      return alert("⚠️ Faltan datos obligatorios.");
    }

    try {
      const payload = {
        categoria: nuevoDoc.categoria,
        cliente: nuevoDoc.cliente.toUpperCase(),
        nro_documento: nuevoDoc.nro_documento || 'S/N',
        concepto: nuevoDoc.concepto,
        monto_total: montoNum,
        saldo_pendiente: montoNum, 
        moneda: nuevoDoc.moneda,
        fecha_emision: nuevoDoc.fecha_emision,
        fecha_vencimiento: nuevoDoc.fecha_vencimiento,
        estatus: 'Pendiente'
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_por_cobrar`, {
        method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("✅ Cuenta por cobrar registrada.");
        setModalNuevoOpen(false);
        setNuevoDoc({ categoria: 'Clientes', cliente: '', nro_documento: '', concepto: '', monto_total: '', moneda: 'USD', fecha_emision: '', fecha_vencimiento: '' });
        cargarDatos();
      } else alert("❌ Error al guardar.");
    } catch (e) { alert("Error de conexión"); }
  };

  const procesarAbono = async () => {
    const montoAbono = parsearMonto(abono);
    if (montoAbono <= 0) return alert("⚠️ Ingrese un monto válido.");
    if (montoAbono > registroSeleccionado.saldo_pendiente) return alert("⚠️ El abono no puede ser mayor a la deuda.");

    const nuevoSaldo = registroSeleccionado.saldo_pendiente - montoAbono;
    let nuevoEstatus = 'Parcial';
    if (nuevoSaldo === 0) nuevoEstatus = 'Pagado';

    let docActualizado = registroSeleccionado.nro_documento;
    if (refAbono.trim() !== '') {
      const r = refAbono.trim().toUpperCase();
      docActualizado = (!docActualizado || docActualizado === 'S/N' || docActualizado === 'S/R') ? `COBRO: ${r}` : `${docActualizado} | COBRO: ${r}`;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_por_cobrar?id=eq.${registroSeleccionado.id}`, {
        method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify({
          saldo_pendiente: nuevoSaldo,
          estatus: nuevoEstatus,
          nro_documento: docActualizado
        })
      });

      if (res.ok) {
        alert(`✅ Abono registrado. Saldo restante: ${formatearMonto(nuevoSaldo)}`);
        setModalAbonoOpen(false);
        setAbono('');
        setRefAbono('');
        cargarDatos();
      } else alert("❌ Error al registrar abono.");
    } catch (e) { alert("Error de conexión"); }
  };

  const colorEstatus = (estatus: string) => {
    if (estatus === 'Pagado') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (estatus === 'Parcial') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/20 text-rose-400 border-rose-500/30'; 
  };

  // Colores para las categorías
  const colorCategoria = (categoria: string) => {
    if (categoria === 'Clientes') return 'text-[#38bdf8] bg-[#38bdf8]/10';
    if (categoria === 'Préstamos Empleados') return 'text-purple-400 bg-purple-500/10';
    if (categoria === 'Préstamos Socios') return 'text-amber-400 bg-amber-500/10';
    return 'text-slate-400 bg-slate-500/10';
  };

  const filtrados = cxc.filter(c => 
    c.cliente.toLowerCase().includes(busqueda.toLowerCase()) || 
    c.nro_documento?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalPendienteUSD = cxc.filter(c => c.moneda === 'USD' && c.estatus !== 'Pagado').reduce((acc, el) => acc + parseFloat(el.saldo_pendiente), 0);

  return (
    <div className="animate-in fade-in duration-300 max-w-[95%] mx-auto space-y-8 pb-10 ml-2 lg:ml-8">
      
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#334155] pb-4 mt-6">
        <div className="flex items-center gap-3">
          <span className="text-4xl">📥</span>
          <div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Cuentas por Cobrar (CxC)</h2>
            <p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Gestión de Cobranzas y Préstamos</p>
          </div>
        </div>

        <div className="flex gap-6 items-center">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total por Cobrar (USD)</p>
            <p className="text-2xl font-black font-mono text-rose-400">${formatearMonto(totalPendienteUSD)}</p>
          </div>
          <button 
            onClick={() => setModalNuevoOpen(true)}
            className="bg-[#38bdf8] hover:bg-sky-400 text-slate-900 px-6 py-3 rounded-lg font-black text-xs uppercase transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)]"
          >
            + Registrar Deuda
          </button>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="relative w-full md:w-96">
        <input 
          type="text" 
          placeholder="Buscar por nombre, factura o categoría..." 
          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg py-3 px-4 text-sm text-white focus:border-[#38bdf8] outline-none"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <span className="absolute right-4 top-3 opacity-30">🔍</span>
      </div>

      {/* TABLA */}
      <div className="bg-[#1e293b] rounded-2xl border border-[#334155] shadow-xl overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-[#0f172a] text-slate-400 uppercase tracking-widest border-b border-[#334155]">
            <tr>
              <th className="p-4">ESTATUS</th>
              <th className="p-4">DEUDOR / CATEGORÍA</th>
              <th className="p-4">DOCUMENTO / CONCEPTO</th>
              <th className="p-4">FECHAS</th>
              <th className="p-4 text-right">MONTO ORIGINAL</th>
              <th className="p-4 text-right">SALDO DEUDOR</th>
              <th className="p-4 text-center">ACCIÓN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]">
            {isLoading ? (
              <tr><td colSpan={7} className="p-10 text-center text-slate-500">Cargando registros financieros...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} className="p-10 text-center text-slate-500">No hay cuentas por cobrar registradas.</td></tr>
            ) : filtrados.map(item => (
              <tr key={item.id} className="hover:bg-white/5 transition-colors text-white">
                <td className="p-4">
                  <span className={`px-3 py-1 rounded border text-[10px] font-black uppercase tracking-widest ${colorEstatus(item.estatus)}`}>
                    {item.estatus}
                  </span>
                </td>
                <td className="p-4">
                  <div className="font-bold text-sm uppercase text-white">{item.cliente}</div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${colorCategoria(item.categoria || 'Clientes')}`}>
                    {item.categoria || 'Clientes'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="font-bold text-slate-300">Doc: {item.nro_documento}</div>
                  <div className="text-slate-400 text-[10px] uppercase truncate max-w-[200px]">{item.concepto}</div>
                </td>
                <td className="p-4 font-mono text-[10px]">
                  <div className="text-slate-300">Emi: {item.fecha_emision}</div>
                  <div className={`mt-0.5 ${new Date(item.fecha_vencimiento) < new Date() && item.estatus !== 'Pagado' ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                    Vence: {item.fecha_vencimiento}
                  </div>
                </td>
                <td className="p-4 text-right font-mono text-slate-400">
                  {formatearMonto(item.monto_total)} {item.moneda}
                </td>
                <td className="p-4 text-right font-mono font-bold text-rose-400 text-sm bg-rose-500/5">
                  {formatearMonto(item.saldo_pendiente)} {item.moneda}
                </td>
                <td className="p-4 text-center">
                  {item.estatus !== 'Pagado' ? (
                    <button 
                      onClick={() => { setRegistroSeleccionado(item); setModalAbonoOpen(true); }}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-colors"
                    >
                      Abonar
                    </button>
                  ) : (
                    <span className="text-slate-500 text-[10px] font-bold">CERRADA</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL: NUEVA DEUDA */}
      {modalNuevoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-[#334155] shadow-2xl p-8 animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-[#334155] pb-4 uppercase tracking-tighter">
              Registrar Nueva Cuenta por Cobrar
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-[#38bdf8] uppercase">Categoría de la Deuda</label>
                <select className="w-full bg-[#0f172a] border border-[#38bdf8]/30 rounded-lg p-3 mt-1 text-white font-bold outline-none" value={nuevoDoc.categoria} onChange={(e)=>setNuevoDoc({...nuevoDoc, categoria: e.target.value})}>
                  <option value="Clientes">Facturación a Clientes</option>
                  <option value="Préstamos Empleados">Préstamos a Empleados</option>
                  <option value="Préstamos Socios">Préstamos a Socios</option>
                  <option value="Otros">Otros Deudores</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre del Deudor (Cliente, Empleado, etc.)</label>
                <input list="listaCxcClientes" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold" value={nuevoDoc.cliente} onChange={(e)=>setNuevoDoc({...nuevoDoc, cliente: e.target.value})} placeholder="Escribe el nombre o búscalo en la lista..." />
                <datalist id="listaCxcClientes">
                  {clientes.map((c, i) => <option key={i} value={c.nombre_razon}>{c.rif_cedula}</option>)}
                </datalist>
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nro. Documento / Referencia</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={nuevoDoc.nro_documento} onChange={(e)=>setNuevoDoc({...nuevoDoc, nro_documento: e.target.value})} placeholder="Ej: Factura 001" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-rose-400 uppercase">Monto Total a Cobrar</label>
                <div className="flex mt-1">
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-l-lg p-3 text-white font-mono" value={nuevoDoc.monto_total} onChange={(e)=>setNuevoDoc({...nuevoDoc, monto_total: e.target.value})} placeholder="0,00" />
                  <select className="bg-[#0f172a] border border-l-0 border-[#334155] rounded-r-lg px-3 text-white font-bold" value={nuevoDoc.moneda} onChange={(e)=>setNuevoDoc({...nuevoDoc, moneda: e.target.value})}>
                    <option value="USD">USD</option>
                    <option value="Bs">Bs</option>
                  </select>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Concepto / Motivo</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={nuevoDoc.concepto} onChange={(e)=>setNuevoDoc({...nuevoDoc, concepto: e.target.value})} placeholder="Ej: Boleto Caracas-Miami o Adelanto de Quincena" />
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Emisión</label>
                <input type="date" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white [color-scheme:dark]" value={nuevoDoc.fecha_emision} onChange={(e)=>setNuevoDoc({...nuevoDoc, fecha_emision: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Vencimiento (Límite)</label>
                <input type="date" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white [color-scheme:dark]" value={nuevoDoc.fecha_vencimiento} onChange={(e)=>setNuevoDoc({...nuevoDoc, fecha_vencimiento: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-4 border-t border-[#334155] pt-4">
              <button onClick={()=>setModalNuevoOpen(false)} className="text-slate-400 font-bold hover:text-white">CANCELAR</button>
              <button onClick={guardarNuevoDocumento} className="bg-[#38bdf8] text-slate-900 px-6 py-2 rounded-lg font-black uppercase text-xs">REGISTRAR DEUDA</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROCESAR ABONO */}
      {modalAbonoOpen && registroSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-[#334155] shadow-2xl p-8 animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-emerald-400 mb-2 uppercase tracking-tighter">Registrar Abono</h3>
            <p className="text-xs text-slate-400 mb-6">Deudor: <span className="text-white font-bold">{registroSeleccionado.cliente}</span></p>
            
            <div className="bg-black/20 p-4 rounded-lg border border-[#334155] mb-6 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Deuda Pendiente Actual</p>
              <p className="text-3xl font-black font-mono text-rose-400">{formatearMonto(registroSeleccionado.saldo_pendiente)} {registroSeleccionado.moneda}</p>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold text-emerald-400 uppercase">Monto a Cobrar ({registroSeleccionado.moneda})</label>
              <input type="text" className="w-full bg-black/40 border border-emerald-500/30 focus:border-emerald-500 rounded-lg p-4 mt-1 text-white font-mono text-xl text-center outline-none" value={abono} onChange={(e)=>setAbono(e.target.value)} placeholder="0,00" autoFocus />
            </div>

            <div className="mb-6">
              <label className="text-[10px] font-bold text-slate-300 uppercase">Referencia / Cómo se abonó</label>
              <input type="text" className="w-full bg-black/40 border border-[#334155] focus:border-emerald-500 rounded-lg p-3 mt-1 text-white font-mono text-sm text-center outline-none uppercase placeholder:text-slate-600 transition-colors" placeholder="EJ: TRANSF-BANESCO, ZELLE-9988..." value={refAbono} onChange={(e)=>setRefAbono(e.target.value)} />
            </div>

            <div className="flex justify-end gap-4 border-t border-[#334155] pt-4">
              <button onClick={()=>{setModalAbonoOpen(false); setAbono(''); setRefAbono('');}} className="text-slate-400 font-bold hover:text-white">CANCELAR</button>
              <button onClick={procesarAbono} className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-black uppercase text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)]">APLICAR COBRO</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}