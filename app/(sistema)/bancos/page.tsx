"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config'; 

function PresupuestoForm() {
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('id');
  const printParam = searchParams.get('print');

  const [editId, setEditId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [nroPresupuesto, setNroPresupuesto] = useState('011301'); 
  const [isSaving, setIsSaving] = useState(false);
  const [moneda, setMoneda] = useState('Bs');

  const [cliente, setCliente] = useState({
    rif_cedula: '', codigo: '', razon_social: '', direccion: '', telefono: '', atencion: ''
  });
  const [clientesBD, setClientesBD] = useState<any[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [mostrarBuscadorCliente, setMostrarBuscadorCliente] = useState(false);

  const [pasajerosBD, setPasajerosBD] = useState<any[]>([]);
  const [proveedoresBD, setProveedoresBD] = useState<any[]>([]);
  const [modalPaxOpen, setModalPaxOpen] = useState(false);
  
  const [filaActivaPax, setFilaActivaPax] = useState<{id: number, index?: number} | null>(null); 
  const [nuevoPax, setNuevoPax] = useState({ nombre_apellido: '', cedula_pasaporte: '', telefono: '' });

  const [servicios, setServicios] = useState<any[]>([
    { 
      id: Date.now(), tipo: 'BOLETO', 
      pax_nombre: '', pax_cedula: '', mostrarBuscadorPax: false, mostrarBuscadorHotel: false, mostrarBuscadorCompania: false,
      aerolinea: '', ruta: '', nro_ticket: '', monto_neto: '', tipo_iva: 'NACIONAL', xts: '', 
      precio_unitario: '', ciudad: '', hotel: '', hotel_rif: '', cant_hab: 1, tipo_hab: '',
      noches: 1, cantidad: 1, cant_huespedes: 1, incluye: '', 
      compania: '', compania_rif: '', 
      huespedes: [{ nombre: '', cedula: '', mostrarBuscadorPax: false }]
    }
  ]);

  useEffect(() => {
    const inicializar = async () => {
      const resC = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&order=nombre_razon.asc`, { headers: SUPABASE_HEADERS });
      if (resC.ok) setClientesBD(await resC.json());
      
      const resP = await fetch(`${SUPABASE_URL}/rest/v1/pasajeros?select=*&order=nombre_apellido.asc`, { headers: SUPABASE_HEADERS });
      if (resP.ok) setPasajerosBD(await resP.json());

      const resProv = await fetch(`${SUPABASE_URL}/rest/v1/proveedores?select=*`, { headers: SUPABASE_HEADERS });
      if (resProv.ok) setProveedoresBD(await resProv.json());

      if (editIdParam) {
        const resPres = await fetch(`${SUPABASE_URL}/rest/v1/presupuestos?id=eq.${editIdParam}&select=*`, { headers: SUPABASE_HEADERS });
        const dataP = await resPres.json();
        if (dataP.length > 0) {
          const p = dataP[0];
          setEditId(p.id);
          const soloNumeros = String(p.nro_presupuesto).replace(/\D/g, '');
          setNroPresupuesto(soloNumeros || '011301');
          setFecha(p.fecha);
          setMoneda(p.moneda || 'Bs');
          
          setCliente({
            rif_cedula: p.cliente_rif || '',
            codigo: p.cliente_rif ? p.cliente_rif.replace(/\D/g, '').substring(0, 8) : '',
            razon_social: p.cliente_razon_social || '',
            direccion: p.cliente_direccion || '',
            telefono: p.cliente_telefono || '',
            atencion: p.atencion || ''
          });
          setServicios(p.detalles || []);
          if (printParam === 'true') setTimeout(() => window.print(), 800);
        }
      } else {
        const resN = await fetch(`${SUPABASE_URL}/rest/v1/presupuestos?select=nro_presupuesto&order=nro_presupuesto.desc&limit=1`, { headers: SUPABASE_HEADERS });
        const dataN = await resN.json();
        if (dataN.length > 0) {
          const ultimoStr = String(dataN[0].nro_presupuesto).replace(/\D/g, '');
          let ultimo = parseInt(ultimoStr, 10) || 0;
          if (ultimo < 11300) ultimo = 11300;
          setNroPresupuesto((ultimo + 1).toString().padStart(6, '0'));
        } else {
          setNroPresupuesto('011301');
        }
      }
    };
    inicializar();
  }, [editIdParam]);

  const seleccionarCliente = (c: any) => {
    setCliente({
      rif_cedula: c.rif_cedula,
      codigo: c.id_cliente || c.rif_cedula.replace(/\D/g, '').substring(0, 8),
      razon_social: c.nombre_razon,
      direccion: c.direccion || '',
      telefono: c.telefono || '',
      atencion: c.persona_contacto || ''
    });
    setMostrarBuscadorCliente(false);
    setBusquedaCliente('');
  };

  const formatearDocumento = (valor: string) => {
    let limpio = valor.toUpperCase().replace(/[^JVEGP0-9]/g, ''); 
    if (limpio.length > 1) limpio = limpio.substring(0, 1) + '-' + limpio.substring(1);
    if (limpio.length > 10 && (limpio.startsWith('J') || limpio.startsWith('G'))) limpio = limpio.substring(0, 10) + '-' + limpio.substring(10, 11);
    return limpio.substring(0, 12);
  };

  const guardarNuevoPax = async () => {
    if (!nuevoPax.nombre_apellido || !nuevoPax.cedula_pasaporte) return alert("⚠️ Nombre y Cédula/Pasaporte son obligatorios");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pasajeros`, {
        method: 'POST', headers: { ...SUPABASE_HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify({ 
          nombre_apellido: nuevoPax.nombre_apellido.toUpperCase(), 
          cedula_pasaporte: formatearDocumento(nuevoPax.cedula_pasaporte),
          telefono: nuevoPax.telefono
        })
      });
      if (res.ok) {
        const data = await res.json();
        const paxCreado = data[0];
        setPasajerosBD([...pasajerosBD, paxCreado]); 
        
        if (filaActivaPax !== null) {
          if (filaActivaPax.index !== undefined) {
            actualizarHuesped(filaActivaPax.id, filaActivaPax.index, 'nombre', paxCreado.nombre_apellido);
            actualizarHuesped(filaActivaPax.id, filaActivaPax.index, 'cedula', paxCreado.cedula_pasaporte);
          } else {
            actualizarFila(filaActivaPax.id, 'pax_nombre', paxCreado.nombre_apellido);
            actualizarFila(filaActivaPax.id, 'pax_cedula', paxCreado.cedula_pasaporte);
          }
        }

        setModalPaxOpen(false);
        setNuevoPax({ nombre_apellido: '', cedula_pasaporte: '', telefono: '' });
        setFilaActivaPax(null);
      }
    } catch (e) { alert("Error al guardar pasajero"); }
  };

  const eliminarPasajeroBD = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas borrar este pasajero de la base de datos?")) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pasajeros?id=eq.${id}`, {
        method: 'DELETE',
        headers: SUPABASE_HEADERS
      });
      if (res.ok) {
        setPasajerosBD(prev => prev.filter(p => p.id !== id));
      } else {
        alert("Error al borrar el pasajero.");
      }
    } catch (e) {
      alert("Error de conexión.");
    }
  };

  const agregarFila = () => {
    setServicios(prev => [...prev, { 
      id: Date.now(), tipo: 'BOLETO', pax_nombre: '', pax_cedula: '', mostrarBuscadorPax: false, mostrarBuscadorHotel: false, mostrarBuscadorCompania: false, aerolinea: '', ruta: '', 
      nro_ticket: '', monto_neto: '', tipo_iva: 'NACIONAL', xts: '', precio_unitario: '', 
      ciudad: '', hotel: '', hotel_rif: '', cant_hab: 1, tipo_hab: '', noches: 1, cantidad: 1, cant_huespedes: 1, incluye: '', 
      compania: '', compania_rif: '', huespedes: [{ nombre: '', cedula: '', mostrarBuscadorPax: false }]
    }]);
  };

  const actualizarFila = (id: number, campo: string, valor: any) => {
    setServicios(prev => prev.map(s => s.id === id ? { ...s, [campo]: valor } : s));
  };

  const cambiarCantHuespedes = (id: number, cant: number) => {
    const nuevaCant = cant > 0 ? cant : 1;
    setServicios(prev => prev.map(s => {
      if (s.id !== id) return s;
      const newHuespedes = [...(s.huespedes || [{ nombre: '', cedula: '', mostrarBuscadorPax: false }])];
      if (nuevaCant > newHuespedes.length) {
        for (let i = newHuespedes.length; i < nuevaCant; i++) newHuespedes.push({ nombre: '', cedula: '', mostrarBuscadorPax: false });
      } else if (nuevaCant < newHuespedes.length) {
        newHuespedes.splice(nuevaCant);
      }
      return { ...s, cant_huespedes: nuevaCant, cantidad: nuevaCant, huespedes: newHuespedes };
    }));
  };

  const actualizarHuesped = (idSrv: number, indexHuesped: number, campo: string, valor: any) => {
    setServicios(prev => prev.map(s => {
      if (s.id !== idSrv) return s;
      const newHuespedes = [...s.huespedes];
      newHuespedes[indexHuesped] = { ...newHuespedes[indexHuesped], [campo]: typeof valor === 'string' ? valor.toUpperCase() : valor };
      return { ...s, huespedes: newHuespedes };
    }));
  };

  const eliminarFila = (id: number) => {
    if (servicios.length > 1) setServicios(prev => prev.filter(s => s.id !== id));
  };

  const parseMonto = (valor: any) => {
    if (!valor) return 0;
    let v = String(valor).trim();
    if (v === '') return 0;

    const lastDot = v.lastIndexOf('.');
    const lastComma = v.lastIndexOf(',');
    const lastSep = Math.max(lastDot, lastComma);

    if (lastSep === -1) return parseFloat(v) || 0;

    const charsAfterSep = v.length - 1 - lastSep;
    
    if (charsAfterSep === 1 || charsAfterSep === 2) {
       const integerPart = v.substring(0, lastSep).replace(/[.,]/g, '');
       const decimalPart = v.substring(lastSep + 1);
       return parseFloat(`${integerPart}.${decimalPart}`) || 0;
    } else {
       return parseFloat(v.replace(/[.,]/g, '')) || 0;
    }
  };

  const calcularTotalFila = (srv: any) => {
    const neto = parseMonto(srv.monto_neto || srv.precio_unitario);
    const cant = srv.tipo === 'HOSPEDAJE' ? ((srv.noches || 1) * (srv.cant_hab || 1)) : (srv.cantidad || 1);
    let iva = 0;
    if (srv.tipo_iva === '16%') iva = neto * 0.16;
    else if (srv.tipo_iva === 'NACIONAL') iva = neto * 0.08;
    else if (srv.tipo_iva === 'INTERNACIONAL') iva = neto * 0.075;
    const xts = parseMonto(srv.xts);
    return (neto * cant) + iva + xts;
  };

  const calcularTotales = () => {
    let exento = 0, base_16 = 0, base_8 = 0, base_75 = 0, iva_16 = 0, iva_8 = 0, iva_75 = 0;
    
    servicios.forEach(srv => {
      const neto = parseMonto(srv.monto_neto || srv.precio_unitario);
      const cant = srv.tipo === 'HOSPEDAJE' ? ((srv.noches || 1) * (srv.cant_hab || 1)) : (srv.cantidad || 1);
      const sub = neto * cant;
      const xts = parseMonto(srv.xts);
      
      if (srv.tipo_iva === 'EXENTO') {
        exento += sub + xts;
      } else {
        if (srv.tipo_iva === '16%') { base_16 += sub; iva_16 += sub * 0.16; }
        else if (srv.tipo_iva === 'NACIONAL') { base_8 += sub; iva_8 += sub * 0.08; }
        else if (srv.tipo_iva === 'INTERNACIONAL') { base_75 += sub; iva_75 += sub * 0.075; }
        exento += xts; 
      }
    });
    
    const iva_total = iva_16 + iva_8 + iva_75;
    const gravado = base_16 + base_8 + base_75;
    return { base_16, base_8, base_75, gravado, exento, iva_16, iva_8, iva_75, iva_total, total: gravado + exento + iva_total };
  };

  const t = calcularTotales();

  const guardarPresupuestoBD = async (estatus: string) => {
    if (!cliente.razon_social) {
      alert("⚠️ Debes seleccionar o escribir la Razón Social del cliente antes de emitir.");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const totalGeneral = parseFloat(t.total.toFixed(2));
      
      const payload = {
        nro_presupuesto: nroPresupuesto, 
        fecha, 
        cliente_rif: cliente.rif_cedula,
        cliente_razon_social: cliente.razon_social, 
        cliente_direccion: cliente.direccion,
        cliente_telefono: cliente.telefono, 
        total: totalGeneral,           
        total_usd: totalGeneral,       
        moneda, 
        estatus, 
        detalles: servicios, 
        atencion: cliente.atencion
      };

      const url = editId ? `${SUPABASE_URL}/rest/v1/presupuestos?id=eq.${editId}` : `${SUPABASE_URL}/rest/v1/presupuestos`;
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { ...SUPABASE_HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setTimeout(() => {
          window.print();
          window.location.href = '/ventas/listado';
        }, 300);
      } else {
        const errorData = await res.json();
        alert(`❌ ERROR DE BASE DE DATOS:\n\nNo se pudo guardar. El servidor respondió:\n${errorData.message || JSON.stringify(errorData)}\n\nRevisa si te falta alguna columna en la tabla de presupuestos.`);
      }
    } catch (e) {
      alert("❌ ERROR DE RED:\n\nHubo un problema de conexión intentando guardar el presupuesto.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 1cm; }
          body * { visibility: hidden !important; }
          #zona-impresion, #zona-impresion * { visibility: visible !important; color: black !important; font-family: Arial, Helvetica, sans-serif !important; }
          #zona-impresion { position: absolute; left: 0; top: 0; width: 100%; background: white; }
          .ocultar-impresion { display: none !important; }
          table.tabla-print { width: 100%; border-collapse: collapse; }
          table.tabla-print th, table.tabla-print td { border: 1px solid black; padding: 4px 6px; font-size: 10px; text-align: left; }
          table.tabla-print th { background-color: #e5e7eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-style: italic; text-transform: uppercase; }
          .linea-punteada { border-bottom: 1px dotted black; flex-grow: 1; margin: 0 5px; position: relative; top: -4px; }
          .print-nro-rojo { color: #cc0000 !important; font-weight: bold; font-family: monospace; }
          .print-header-rif { font-size: 9px; font-weight: bold; text-transform: uppercase; margin-top: 3px; }
          
          /* Estilos específicos para la tabla de presupuesto en la esquina superior derecha */
          .tabla-presupuesto-corner {
            border-collapse: collapse;
            margin-right: -2px; 
            margin-top: -2px;
          }
          .tabla-presupuesto-corner td, .tabla-presupuesto-corner th {
            border: 1px solid black;
          }
          .tabla-presupuesto-corner tr:first-child td, .tabla-presupuesto-corner tr:first-child th {
            border-top: none;
          }
          .tabla-presupuesto-corner td:last-child, .tabla-presupuesto-corner th:last-child {
            border-right: none;
          }
          .tabla-presupuesto-corner .borde-sencillo-l {
             border-left: 1px solid black;
          }
          .tabla-presupuesto-corner .borde-sencillo-b {
             border-bottom: 1px solid black;
          }
        }
      `}</style>

      {/* --- VISTA DE IMPRESIÓN --- */}
      <div id="zona-impresion" className="hidden print:block bg-white p-0">
        <table className="w-full mb-3" style={{ border: 'none' }}>
          <tbody>
            <tr>
              <td className="align-bottom p-0" style={{ border: 'none', width: '60%' }}>
                <img src="/Princess.png" alt="Logo" className="h-[55px] w-auto object-contain" />
                <div className="text-[10px] font-bold mt-1 uppercase pl-1">RIF: J-29948481-4</div>
              </td>
              <td className="align-bottom text-right p-0" style={{ border: 'none', width: '40%' }}>
                <div className="text-[10px] font-bold">Calle comercio, C.C. Palo verde Plaza, Piso 7, Ofic. 12, Caracas</div>
                <div className="text-[10px] mt-1">Telefonos: 0424,123,5268 / 0424,146,2990 / 0424,1349363</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Marco con borde doble */}
        <div className="border-[3px] border-double border-black mb-4">
          <table className="w-full" style={{ border: 'none', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td className="align-top p-2" style={{ border: 'none', width: '70%' }}>
                  <div className="text-[13px] space-y-1.5 leading-tight">
                    {/* Estructura alineada en dos columnas principales */}
                    {/* Fila 1 */}
                    <div className="flex">
                      {/* Columna Etiquetas - ancho fijo para alineación */}
                      <div className="flex flex-col w-[190px] shrink-0 space-y-1.5">
                        <span className="font-bold uppercase">Codigo Cliente:</span>
                        <span className="font-bold uppercase">Direccion:</span>
                        <span className="font-bold uppercase tracking-tight">Rif / C.I.:</span>
                        <span className="font-bold uppercase">Atencion:</span>
                      </div>
                      
                      {/* Columna Valores - flex-1 */}
                      <div className="flex flex-col flex-1 space-y-1.5">
                        {/* Valor Fila 1 (Aquí ya NO existe la etiqueta "Razon social:") */}
                        <div className="flex font-bold uppercase items-center">
                          <span className="mr-6">{cliente.codigo || 'S/N'}</span> {/* Espacio tras código */}
                          {/* El nombre del cliente comienza directamente aquí */}
                          <span>{cliente.razon_social || 'N/A'}</span>
                        </div>
                        
                        {/* Valor Fila 2 */}
                        <span className="uppercase">{cliente.direccion || 'N/A'}</span>
                        
                        {/* Valor Fila 3 - complejo con teléfonos alineados */}
                        <div className="flex">
                          <span className="uppercase w-[180px] shrink-0">{cliente.rif_cedula || 'N/A'}</span> {/* Valor 1 */}
                          <span className="font-bold uppercase mr-2 shrink-0">Telefonos:</span> {/* Etiqueta 2 */}
                          <span className="uppercase flex-1">{cliente.telefono || 'N/A'}</span> {/* Valor 2 */}
                        </div>
                        
                        {/* Valor Fila 4 */}
                        <span className="uppercase">{cliente.atencion || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </td>
                
                <td className="align-top p-0 text-right" style={{ border: 'none', width: '30%' }}>
                  <table className="w-full text-center text-[13px] border-l border-b border-black tabla-presupuesto-corner" style={{ borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td colSpan={2} className="font-bold uppercase py-0.5 px-1.5 borde-sencillo-l border-b border-black" style={{ WebkitPrintColorAdjust: 'exact' }}>PRESUPUESTO</td>
                      </tr>
                      <tr>
                        <td className="text-left font-bold py-0.5 px-2 w-1/2 borde-sencillo-l border-b border-r border-black">Número:</td>
                        <td className="text-left font-bold py-0.5 px-2 w-1/2 border-b border-black">Del:</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold font-mono text-red-600 py-0.5 px-2 borde-sencillo-l border-r border-black">{nroPresupuesto}</td>
                        <td className="text-center font-mono py-0.5 px-2">{fecha.split('-').reverse().join('/')}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="tabla-print">
          <thead>
            <tr className="italic uppercase text-[10px]">
              <th className="text-center" style={{width:'60%'}}>C o n c e p t o s</th>
              <th className="text-right">Pr. Unitario</th>
              <th className="text-right">Montos</th>
              <th className="text-center">% Alic.</th>
            </tr>
          </thead>
          <tbody className="text-[10px]">
            {servicios.map((srv, i) => (
              <tr key={i}>
                <td className="align-top">
                  <span className="font-bold uppercase">{srv.tipo}</span>: 
                  <div className="uppercase ml-1 inline">
                    {srv.tipo === 'FEE' && 'SERV. DE EMISI. CONF. Y RECONFIRMACION'}
                    {srv.tipo === 'BOLETO' && `${srv.pax_nombre} ${srv.pax_cedula ? `(CI: ${srv.pax_cedula})` : ''} ${srv.ruta ? srv.ruta : ''} ${srv.aerolinea ? srv.aerolinea : ''} ${srv.nro_ticket ? `TKT: ${srv.nro_ticket}` : ''}`}
                    
                    {['TRASLADO', 'SEGURO', 'OTROS'].includes(srv.tipo) && (
                      <div className="mt-1">
                        <div className="font-bold">{srv.pax_nombre}</div>
                        <div className="text-[9px] text-gray-700">
                           {srv.compania} {srv.compania_rif && `(RIF: ${srv.compania_rif})`}
                        </div>
                        {srv.huespedes && srv.huespedes.length > 0 && (
                          <div className="text-[8.5px] mt-0.5 italic text-gray-700">
                            PAX: {srv.huespedes.map((h: any) => `${h.nombre} ${h.cedula ? `(${h.cedula})` : ''}`).filter((t: string) => t.trim() !== '').join(', ')}
                          </div>
                        )}
                      </div>
                    )}

                    {srv.tipo === 'HOSPEDAJE' && (
                      <div className="mt-1">
                        <div className="font-bold">{srv.hotel} {srv.hotel_rif && `(RIF: ${srv.hotel_rif})`} - {srv.ciudad}</div>
                        <div className="text-[9px]">
                          {srv.cant_hab} HAB. {srv.tipo_hab} | {srv.noches} NOCHES {srv.incluye && `| INCLUYE: ${srv.incluye}`}
                        </div>
                        {srv.huespedes && srv.huespedes.length > 0 && (
                          <div className="text-[8.5px] mt-0.5 italic text-gray-700">
                            PAX: {srv.huespedes.map((h: any) => `${h.nombre} ${h.cedula ? `(${h.cedula})` : ''}`).filter((t: string) => t.trim() !== '').join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="text-right align-top font-mono">{(parseFloat(String(srv.monto_neto || srv.precio_unitario || '0').replace(/\./g, '').replace(',', '.'))).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td className="text-right align-top font-bold font-mono">{calcularTotalFila(srv).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td className="text-center align-top font-mono">{srv.tipo_iva === '16%' ? '16,00' : (srv.tipo_iva === 'NACIONAL' ? '8,00' : (srv.tipo_iva === 'INTERNACIONAL' ? '7,50' : '0,00'))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-[340px] border border-black p-3 text-[10px]">
            {t.base_16 > 0 && <div className="flex items-end mb-1"><span className="uppercase">Base Imponible 16%:</span><div className="linea-punteada"></div><span className="font-mono font-bold">{t.base_16.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (BS)</span></div>}
            {t.base_8 > 0 && <div className="flex items-end mb-1"><span className="uppercase">Base Imponible 8%:</span><div className="linea-punteada"></div><span className="font-mono font-bold">{t.base_8.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (BS)</span></div>}
            {t.base_75 > 0 && <div className="flex items-end mb-1"><span className="uppercase">Base Imponible 7.5%:</span><div className="linea-punteada"></div><span className="font-mono font-bold">{t.base_75.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (BS)</span></div>}
            
            <div className="flex items-end mb-1"><span className="uppercase">Ventas No Sujetas / XTs:</span><div className="linea-punteada"></div><span className="font-mono font-bold">{t.exento.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (BS)</span></div>
            <div className="flex items-end mb-1 border-t border-dotted border-black pt-1"><span className="font-bold uppercase">Sub Total:</span><div className="linea-punteada"></div><span className="font-mono font-bold">{(t.gravado + t.exento).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (BS)</span></div>
            
            {t.iva_16 > 0 && <div className="flex items-end mb-1 italic"><span className="uppercase">I.V.A. 16%:</span><div className="linea-punteada"></div><span className="font-mono font-bold">{t.iva_16.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (BS)</span></div>}
            {t.iva_8 > 0 && <div className="flex items-end mb-1 italic"><span className="uppercase">I.V.A. 8%:</span><div className="linea-punteada"></div><span className="font-mono font-bold">{t.iva_8.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (BS)</span></div>}
            {t.iva_75 > 0 && <div className="flex items-end mb-2 italic"><span className="uppercase">I.V.A. 7.5%:</span><div className="linea-punteada"></div><span className="font-mono font-bold">{t.iva_75.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (BS)</span></div>}

            <div className="flex justify-between border-t-2 border-black pt-1.5 text-[12px] font-black uppercase"><span>Total General:</span><span className="font-mono">{t.total.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {moneda}</span></div>
          </div>
        </div>

        <div className="mt-24 flex justify-between px-10 text-center text-[10px]">
          <div><p className="border-t border-black w-[200px] pt-1 font-bold uppercase">Firma Autorizada</p><p className="uppercase">Princess Travel</p></div>
          <div><p className="border-t border-black w-[200px] pt-1 font-bold uppercase">Aceptación Cliente</p><p className="uppercase">Firma y Sello</p></div>
        </div>
      </div>

      {/* --- INTERFAZ DE TRABAJO (SISTEMA) --- */}
      <div className="ocultar-impresion p-4 md:p-8 bg-[#0f172a] min-h-screen text-white">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div className="flex items-center gap-3 mb-4 md:mb-0"><span className="text-3xl">📝</span><div><h2 className="text-xl font-bold uppercase tracking-widest text-sky-400">Generador de Presupuestos</h2></div></div>
            <div className="flex gap-4">
              <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Fecha</label><input type="date" className="bg-black/40 p-2 rounded border border-slate-600 outline-none text-sm" value={fecha} onChange={(e)=>setFecha(e.target.value)} /></div>
              <div className="text-right">
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Presupuesto Nro.</label>
                <p className="text-xl font-mono text-emerald-400 font-black tracking-tighter">N° {nroPresupuesto}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl space-y-6">
            <h3 className="text-sm font-bold text-sky-400 uppercase tracking-widest border-b border-slate-700 pb-2">1. Datos del Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 relative z-50">
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Buscar Razón Social</label>
                <input type="text" className="w-full bg-black/40 p-3 rounded border border-slate-600 uppercase text-sm" placeholder="Escriba para buscar..." value={cliente.razon_social || busquedaCliente} onChange={(e)=>{setBusquedaCliente(e.target.value); setMostrarBuscadorCliente(true);}} />
                {mostrarBuscadorCliente && busquedaCliente.length > 1 && (
                  <div className="absolute z-[9999] w-full bg-[#0f172a] border border-sky-500 mt-1 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                    {clientesBD.filter(c => c.nombre_razon.toUpperCase().includes(busquedaCliente.toUpperCase())).map(c => (
                      <div key={c.id} className="p-3 hover:bg-sky-900 cursor-pointer text-xs border-b border-slate-700/50 transition-colors" onClick={()=>seleccionarCliente(c)}><strong className="block text-sky-300">{c.nombre_razon}</strong><span className="text-slate-400 font-mono">{c.rif_cedula}</span></div>
                    ))}
                  </div>
                )}
              </div>
              <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Cód. Interno</label><input type="text" className="w-full bg-black/20 p-3 rounded border border-slate-700 uppercase text-sm text-slate-400 cursor-not-allowed" placeholder="Automático" value={cliente.codigo} readOnly /></div>
              <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">RIF / C.I.</label><input type="text" className="w-full bg-black/40 p-3 rounded border border-slate-600 uppercase text-sm" value={cliente.rif_cedula} onChange={(e)=>setCliente({...cliente, rif_cedula: e.target.value})} /></div>
              <div className="md:col-span-3"><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Dirección Fiscal</label><input type="text" className="w-full bg-black/40 p-3 rounded border border-slate-600 uppercase text-sm" value={cliente.direccion} onChange={(e)=>setCliente({...cliente, direccion: e.target.value.toUpperCase()})} /></div>
              <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Teléfonos</label><input type="text" className="w-full bg-black/40 p-3 rounded border border-slate-600 uppercase text-sm" value={cliente.telefono} onChange={(e)=>setCliente({...cliente, telefono: e.target.value})} /></div>
              <div className="md:col-span-4"><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Atención a:</label><input type="text" className="w-full bg-black/40 p-3 rounded border border-slate-600 uppercase text-sm" value={cliente.atencion} onChange={(e)=>setCliente({...cliente, atencion: e.target.value.toUpperCase()})} /></div>
            </div>

            <div className="pt-6 border-t border-slate-700">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-sky-400 uppercase tracking-widest">2. Servicios a Cotizar</h3>
              </div>
              
              <div className="space-y-4">
                {servicios.map((srv, index) => (
                  <div key={srv.id} className="bg-black/30 p-4 rounded-xl border border-slate-600 relative group transition-all" style={{ zIndex: 100 - index }}>
                    <button onClick={()=>eliminarFila(srv.id)} className="absolute -right-2 -top-2 bg-rose-600 hover:bg-rose-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">×</button>
                    
                    <div className="mb-3 w-48 relative z-50">
                      <label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">Servicio</label>
                      <select className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase font-bold outline-none focus:border-sky-500 text-sky-300" value={srv.tipo} onChange={(e) => {
                        const val = e.target.value;
                        actualizarFila(srv.id, 'tipo', val);
                        if (val === 'FEE') actualizarFila(srv.id, 'pax_nombre', 'SERV. DE EMISI. CONF. Y RECONFIRMACION');
                        else if (['HOSPEDAJE', 'BOLETO', 'TRASLADO', 'SEGURO', 'OTROS'].includes(val)) actualizarFila(srv.id, 'pax_nombre', '');
                      }}>
                        <option value="BOLETO">✈️ Aéreo</option>
                        <option value="HOSPEDAJE">🏨 Hospedaje</option>
                        <option value="TRASLADO">🚕 Traslado</option>
                        <option value="SEGURO">🛡️ Seguro</option>
                        <option value="OTROS">🧩 Otros Servicios</option>
                        <option value="FEE">🎫 FEE Emisión</option>
                      </select>
                    </div>

                    {/* --- BOLETO AÉREO --- */}
                    {srv.tipo === 'BOLETO' && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3 relative z-50">
                          <div className="md:col-span-4 relative">
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[9px] text-sky-400 uppercase font-bold block">Apellido / Nombre</label>
                              <button onClick={() => { setFilaActivaPax({id: srv.id}); setModalPaxOpen(true); }} className="bg-sky-600 hover:bg-sky-500 text-white text-[9px] px-2 py-0.5 rounded font-bold transition-colors shadow">+ NUEVO PAX</button>
                            </div>
                            <input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-sky-900 uppercase outline-none focus:border-sky-500" placeholder="PÉREZ / JUAN" value={srv.pax_nombre} onChange={(e) => { actualizarFila(srv.id, 'pax_nombre', e.target.value.toUpperCase()); actualizarFila(srv.id, 'mostrarBuscadorPax', true); }} onFocus={() => actualizarFila(srv.id, 'mostrarBuscadorPax', true)} onBlur={() => setTimeout(() => actualizarFila(srv.id, 'mostrarBuscadorPax', false), 200)} />
                            
                            {srv.mostrarBuscadorPax && (
                              <div className="absolute z-[99999] w-full bg-[#0f172a] border border-sky-500 mt-1 rounded-lg shadow-2xl max-h-40 overflow-y-auto">
                                {pasajerosBD.filter(p => p.nombre_apellido.includes(srv.pax_nombre) || p.cedula_pasaporte.includes(srv.pax_nombre)).map(pax => (
                                  <div key={pax.id} className="p-2 hover:bg-sky-900 cursor-pointer text-xs border-b border-slate-700/50 flex justify-between items-center transition-colors" onMouseDown={(e) => e.preventDefault()} onClick={() => { actualizarFila(srv.id, 'pax_nombre', pax.nombre_apellido); actualizarFila(srv.id, 'pax_cedula', pax.cedula_pasaporte); actualizarFila(srv.id, 'mostrarBuscadorPax', false); }}>
                                    <div><strong className="block text-sky-300">{pax.nombre_apellido}</strong><span className="text-slate-400 font-mono">{pax.cedula_pasaporte}</span></div>
                                    <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); eliminarPasajeroBD(pax.id); }} className="text-rose-500 hover:text-rose-400 p-2 text-sm bg-black/20 rounded hover:bg-rose-900/50 transition-colors" title="Borrar Pasajero">🗑️</button>
                                  </div>
                                ))}
                                {pasajerosBD.filter(p => p.nombre_apellido.includes(srv.pax_nombre) || p.cedula_pasaporte.includes(srv.pax_nombre)).length === 0 && (
                                  <div className="p-3 text-xs text-slate-400 text-center italic">No se encontraron pasajeros</div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">C.I / Pasaporte</label><input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500 font-mono" placeholder="V-12345678" value={srv.pax_cedula} onChange={(e)=>actualizarFila(srv.id, 'pax_cedula', e.target.value.toUpperCase())} /></div>
                          
                          {/* BUSCADOR DE AEROLÍNEA CON NOMBRE COMERCIAL */}
                          <div className="md:col-span-2 relative z-[99999]">
                            <label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">Aerolínea</label>
                            <input
                              className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500"
                              placeholder="EJ: COPA"
                              value={srv.aerolinea}
                              onChange={(e) => { actualizarFila(srv.id, 'aerolinea', e.target.value.toUpperCase()); actualizarFila(srv.id, 'mostrarBuscadorCompania', true); }}
                              onFocus={() => actualizarFila(srv.id, 'mostrarBuscadorCompania', true)}
                              onBlur={() => setTimeout(() => actualizarFila(srv.id, 'mostrarBuscadorCompania', false), 200)}
                            />
                            {srv.mostrarBuscadorCompania && (
                              <div className="absolute z-[99999] w-full bg-[#0f172a] border border-sky-500 mt-1 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                                {proveedoresBD.filter(p => {
                                  // Buscamos por el nombre corto o nombre comercial
                                  const nombreProv = String(p.nombre_comercial || p.nombre_razon || p.razon_social || p.nombre || '').toUpperCase();
                                  const busqueda = String(srv.aerolinea || '').toUpperCase();
                                  const categoria = String(p.categoria || p.tipo_proveedor || p.tipo || p.rubro || p.clasificacion || '').toUpperCase();
                                  return categoria.includes('AEROLINEA') && (busqueda === '' || nombreProv.includes(busqueda));
                                }).map(prov => {
                                  // Asignamos el nombre_comercial como prioridad para mostrar en la lista y guardar
                                  const n = prov.nombre_comercial || prov.nombre_razon || prov.razon_social || prov.nombre || '';
                                  return (
                                    <div key={prov.id} className="p-3 hover:bg-sky-900 cursor-pointer text-xs border-b border-slate-700/50 transition-colors" onMouseDown={(e) => e.preventDefault()} onClick={() => { actualizarFila(srv.id, 'aerolinea', n); actualizarFila(srv.id, 'mostrarBuscadorCompania', false); }}>
                                      <strong className="block text-sky-300">{n}</strong>
                                    </div>
                                  );
                                })}
                                {proveedoresBD.filter(p => String(p.categoria || p.tipo_proveedor || p.tipo || p.rubro || p.clasificacion || '').toUpperCase().includes('AEROLINEA') && (srv.aerolinea === '' || String(p.nombre_comercial || p.nombre_razon || p.razon_social || p.nombre || '').toUpperCase().includes(String(srv.aerolinea).toUpperCase()))).length === 0 && (
                                  <div className="p-3 text-xs text-slate-400 text-center italic">No hay aerolíneas registradas</div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">Ruta</label><input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" placeholder="CCS/MAD/CCS" value={srv.ruta} onChange={(e) => {
                            const raw = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                            const partes: string[] = [];
                            for (let i = 0; i < raw.length && partes.length < 4; i += 3) { partes.push(raw.substring(i, i + 3)); }
                            actualizarFila(srv.id, 'ruta', partes.join('/'));
                          }} /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          <div className="md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">Nro Boleto</label><input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase font-mono outline-none focus:border-sky-500" placeholder="000-0000000000" value={srv.nro_ticket} onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '').substring(0, 13);
                            actualizarFila(srv.id, 'nro_ticket', raw.length > 3 ? raw.substring(0, 3) + '-' + raw.substring(3) : raw);
                          }} /></div>
                          <div className="md:col-span-3"><label className="text-[9px] text-emerald-400 uppercase font-bold mb-1 block">Precio / Monto Neto</label><input className="w-full bg-black/50 p-2.5 rounded-lg text-xs border border-emerald-900/50 font-mono text-right outline-none focus:border-emerald-500" placeholder="0,00" value={srv.monto_neto} onChange={(e)=>actualizarFila(srv.id, 'monto_neto', e.target.value)} /></div>
                          <div className="md:col-span-3"><label className="text-[9px] text-rose-400 uppercase font-bold mb-1 block">XTs (Impuestos)</label><input className="w-full bg-black/50 p-2.5 rounded-lg text-xs border border-rose-900/50 font-mono text-right outline-none focus:border-rose-500" placeholder="0,00" value={srv.xts} onChange={(e)=>actualizarFila(srv.id, 'xts', e.target.value)} /></div>
                          <div className="md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">I.V.A.</label><select className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" value={srv.tipo_iva} onChange={(e)=>actualizarFila(srv.id, 'tipo_iva', e.target.value)}><option value="NACIONAL">8% (Nac)</option><option value="INTERNACIONAL">7.5% (Int)</option><option value="16%">16% (Gral)</option><option value="EXENTO">Exento</option></select></div>
                        </div>
                      </>
                    )}

                    {/* --- TRASLADO / SEGURO / OTROS (FORMATO DETALLADO CON PAX OPTIMIZADO) --- */}
                    {['TRASLADO', 'SEGURO', 'OTROS'].includes(srv.tipo) && (
                      <div className="flex flex-col gap-3 relative z-50">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 relative z-50">
                          {/* BUSCADOR DE COMPAÑÍA / PROVEEDOR */}
                          <div className="md:col-span-8 relative z-[99999]">
                            <label className="text-[9px] text-sky-400 uppercase font-bold mb-1 block">
                                {srv.tipo === 'TRASLADO' ? 'Compañía / Chofer' : 'Compañía / Proveedor'}
                            </label>
                            <input 
                              className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" 
                              placeholder={srv.tipo === 'TRASLADO' ? "Buscar o Escribir Compañía/Chofer..." : "Buscar o Escribir Proveedor..."}
                              value={srv.compania} 
                              onChange={(e)=> {
                                actualizarFila(srv.id, 'compania', e.target.value.toUpperCase());
                                actualizarFila(srv.id, 'mostrarBuscadorCompania', true);
                              }} 
                              onFocus={() => actualizarFila(srv.id, 'mostrarBuscadorCompania', true)} 
                              onBlur={() => setTimeout(() => actualizarFila(srv.id, 'mostrarBuscadorCompania', false), 200)} 
                            />
                            {srv.mostrarBuscadorCompania && (
                              <div className="absolute z-[99999] w-full bg-[#0f172a] border border-sky-500 mt-1 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                                {proveedoresBD.filter(p => {
                                  const nombreProv = String(p.nombre_razon || p.razon_social || p.nombre || '').toUpperCase();
                                  const busqueda = String(srv.compania || '').toUpperCase();
                                  return busqueda === '' || nombreProv.includes(busqueda);
                                }).map(prov => {
                                  const n = prov.nombre_razon || prov.razon_social || prov.nombre || '';
                                  const r = prov.rif_cedula || prov.rif || prov.cedula || '';
                                  return (
                                    <div key={prov.id} className="p-3 hover:bg-sky-900 cursor-pointer text-xs border-b border-slate-700/50 flex justify-between items-center transition-colors" onMouseDown={(e) => e.preventDefault()} onClick={() => { 
                                      actualizarFila(srv.id, 'compania', n); 
                                      actualizarFila(srv.id, 'compania_rif', r); 
                                      actualizarFila(srv.id, 'mostrarBuscadorCompania', false); 
                                    }}>
                                      <div><strong className="block text-sky-300">{n}</strong><span className="text-slate-400 font-mono">{r}</span></div>
                                    </div>
                                  )
                                })}
                                {proveedoresBD.filter(p => {
                                  const nombreProv = String(p.nombre_razon || p.razon_social || p.nombre || '').toUpperCase();
                                  const busqueda = String(srv.compania || '').toUpperCase();
                                  return busqueda === '' || nombreProv.includes(busqueda);
                                }).length === 0 && (
                                  <div className="p-3 text-xs text-slate-400 text-center italic">No hay proveedores registrados con ese nombre</div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="md:col-span-4">
                            <label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">
                                RIF / C.I. {srv.tipo === 'TRASLADO' ? 'Compañía' : 'Proveedor'}
                            </label>
                            <input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500 font-mono" placeholder="J-12345678-9" value={srv.compania_rif} onChange={(e)=>actualizarFila(srv.id, 'compania_rif', e.target.value.toUpperCase())} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          <div className="md:col-span-10"><label className="text-[9px] text-sky-400 uppercase font-bold mb-1 block">Descripción del Servicio</label><input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-sky-900 uppercase outline-none focus:border-sky-500" placeholder={`EJ: DETALLES DEL ${srv.tipo}...`} value={srv.pax_nombre} onChange={(e)=>actualizarFila(srv.id, 'pax_nombre', e.target.value.toUpperCase())} /></div>
                          <div className="md:col-span-2"><label className="text-[9px] text-sky-400 uppercase font-bold mb-1 block">Cantidad PAX</label><input type="number" min="1" className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-sky-600 text-center font-mono outline-none focus:border-sky-500" value={srv.cant_huespedes} onChange={(e)=>cambiarCantHuespedes(srv.id, parseInt(e.target.value)||1)} /></div>
                        </div>

                        <div className="space-y-2 mt-2 relative z-40">
                          <label className="text-[9px] text-emerald-400 uppercase font-bold block mb-1">Registro de Pasajeros ({srv.tipo})</label>
                          {srv.huespedes && srv.huespedes.map((h: any, index: number) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-black/20 p-2.5 rounded border border-slate-700/50 relative">
                              <div className="md:col-span-8 relative">
                                <div className="flex justify-between items-center mb-1">
                                  <label className="text-[9px] text-emerald-400 uppercase font-bold block">Pasajero {index + 1} - Apellido / Nombre</label>
                                  <button onClick={() => { setFilaActivaPax({id: srv.id, index}); setModalPaxOpen(true); }} className="bg-sky-600 hover:bg-sky-500 text-white text-[9px] px-2 py-0.5 rounded font-bold transition-colors shadow">+ NUEVO PAX</button>
                                </div>
                                <input 
                                  className="w-full bg-slate-800 p-2 rounded text-xs border border-slate-600 uppercase outline-none focus:border-emerald-500" 
                                  placeholder="PÉREZ / JUAN" 
                                  value={h.nombre} 
                                  onChange={(e)=>{ actualizarHuesped(srv.id, index, 'nombre', e.target.value); actualizarHuesped(srv.id, index, 'mostrarBuscadorPax', true); }}
                                  onFocus={() => actualizarHuesped(srv.id, index, 'mostrarBuscadorPax', true)} 
                                  onBlur={() => setTimeout(() => actualizarHuesped(srv.id, index, 'mostrarBuscadorPax', false), 200)} 
                                />
                                {h.mostrarBuscadorPax && h.nombre.length > 0 && (
                                  <div className="absolute z-[99999] w-full bg-[#0f172a] border border-sky-500 mt-1 rounded-lg shadow-2xl max-h-40 overflow-y-auto">
                                    {pasajerosBD.filter(p => p.nombre_apellido.includes(h.nombre) || p.cedula_pasaporte.includes(h.nombre)).map(pax => (
                                      <div key={pax.id} className="p-2 hover:bg-sky-900 cursor-pointer text-xs border-b border-slate-700/50 flex justify-between items-center transition-colors" onMouseDown={(e) => e.preventDefault()} onClick={() => { actualizarHuesped(srv.id, index, 'nombre', pax.nombre_apellido); actualizarHuesped(srv.id, index, 'cedula', pax.cedula_pasaporte); actualizarHuesped(srv.id, index, 'mostrarBuscadorPax', false); }}>
                                        <div><strong className="block text-sky-300">{pax.nombre_apellido}</strong><span className="text-slate-400 font-mono">{pax.cedula_pasaporte}</span></div>
                                        <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); eliminarPasajeroBD(pax.id); }} className="text-rose-500 hover:text-rose-400 p-2 text-sm bg-black/20 rounded hover:bg-rose-900/50 transition-colors" title="Borrar Pasajero">🗑️</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="md:col-span-4">
                                <label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">C.I / Pasaporte</label>
                                <input className="w-full bg-slate-800 p-2 rounded text-xs border border-slate-600 uppercase font-mono outline-none focus:border-emerald-500" placeholder="V-12345678" value={h.cedula} onChange={(e)=>actualizarHuesped(srv.id, index, 'cedula', e.target.value.toUpperCase())} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-2 border-t border-slate-700 pt-3">
                          <div className="md:col-span-8"></div> 
                          <div className="md:col-span-2"><label className="text-[9px] text-emerald-400 uppercase font-bold mb-1 block">Precio Unitario / PAX</label><input className="w-full bg-black/50 p-2.5 rounded-lg text-xs border border-emerald-900/50 font-mono text-right outline-none focus:border-emerald-500" placeholder="0,00" value={srv.precio_unitario} onChange={(e)=>actualizarFila(srv.id, 'precio_unitario', e.target.value)} /></div>
                          <div className="md:col-span-2"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">I.V.A.</label><select className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" value={srv.tipo_iva} onChange={(e)=>actualizarFila(srv.id, 'tipo_iva', e.target.value)}><option value="16%">16% (Gral)</option><option value="EXENTO">Exento</option><option value="NACIONAL">8% (Nac)</option><option value="INTERNACIONAL">7.5% (Int)</option></select></div>
                        </div>
                      </div>
                    )}

                    {/* --- FEE EMISIÓN (LÍNEA COMPACTA NO EDITABLE) --- */}
                    {srv.tipo === 'FEE' && (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-4">
                          <label className="text-[9px] text-sky-400 uppercase font-bold mb-1 block">Descripción Fija</label>
                          <input className="w-full bg-slate-800/50 p-2.5 rounded-lg text-xs border border-slate-700 uppercase text-slate-400 cursor-not-allowed" value="SERV. DE EMISI. CONF. Y RECONFIRMACION" readOnly />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">Cantidad</label>
                          <input type="number" min="1" className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 text-center font-mono outline-none focus:border-sky-500" value={srv.cantidad} onChange={(e)=>actualizarFila(srv.id, 'cantidad', parseInt(e.target.value)||1)} />
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-[9px] text-emerald-400 uppercase font-bold mb-1 block">Precio / Monto Neto</label>
                          <input className="w-full bg-black/50 p-2.5 rounded-lg text-xs border border-emerald-900/50 font-mono text-right outline-none focus:border-emerald-500" placeholder="0,00" value={srv.precio_unitario} onChange={(e)=>actualizarFila(srv.id, 'precio_unitario', e.target.value)} />
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">I.V.A.</label>
                          <select className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" value={srv.tipo_iva} onChange={(e)=>actualizarFila(srv.id, 'tipo_iva', e.target.value)}><option value="NACIONAL">8% (Nac)</option><option value="INTERNACIONAL">7.5% (Int)</option><option value="16%">16% (Gral)</option><option value="EXENTO">Exento</option></select>
                        </div>
                      </div>
                    )}

                    {/* --- HOSPEDAJE --- */}
                    {srv.tipo === 'HOSPEDAJE' && (
                      <div className="flex flex-col gap-3 relative z-50">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 relative z-50">
                          <div className="md:col-span-3"><label className="text-[9px] text-sky-400 uppercase font-bold mb-1 block">Ciudad</label><input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" placeholder="EJ: CARACAS" value={srv.ciudad} onChange={(e)=>actualizarFila(srv.id, 'ciudad', e.target.value.toUpperCase())} /></div>
                          
                          <div className="md:col-span-6 relative z-[99999]">
                            <label className="text-[9px] text-sky-400 uppercase font-bold mb-1 block">Hotel</label>
                            <input 
                              className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" 
                              placeholder="Buscar o Escribir Hotel..." 
                              value={srv.hotel} 
                              onChange={(e)=> {
                                actualizarFila(srv.id, 'hotel', e.target.value.toUpperCase());
                                actualizarFila(srv.id, 'mostrarBuscadorHotel', true);
                              }} 
                              onFocus={() => actualizarFila(srv.id, 'mostrarBuscadorHotel', true)} 
                              onBlur={() => setTimeout(() => actualizarFila(srv.id, 'mostrarBuscadorHotel', false), 200)} 
                            />
                            {srv.mostrarBuscadorHotel && (
                              <div className="absolute z-[99999] w-full bg-[#0f172a] border border-sky-500 mt-1 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                                {proveedoresBD.filter(p => {
                                  const nombreProv = String(p.nombre_razon || p.razon_social || p.nombre || '').toUpperCase();
                                  const busqueda = String(srv.hotel || '').toUpperCase();
                                  const categoria = String(p.categoria || p.tipo_proveedor || p.tipo || p.rubro || p.clasificacion || '').toUpperCase();
                                  const esHotel = categoria.includes('HOTEL') || categoria.includes('HOSPEDAJE');
                                  return esHotel && (busqueda === '' || nombreProv.includes(busqueda));
                                }).map(prov => {
                                  const n = prov.nombre_razon || prov.razon_social || prov.nombre || '';
                                  const r = prov.rif_cedula || prov.rif || prov.cedula || '';
                                  const c = prov.ciudad || prov.direccion || ''; 
                                  
                                  return (
                                    <div key={prov.id} className="p-3 hover:bg-sky-900 cursor-pointer text-xs border-b border-slate-700/50 flex justify-between items-center transition-colors" onMouseDown={(e) => e.preventDefault()} onClick={() => { 
                                      actualizarFila(srv.id, 'hotel', n); 
                                      actualizarFila(srv.id, 'hotel_rif', r); 
                                      if (c) actualizarFila(srv.id, 'ciudad', c.toUpperCase());
                                      actualizarFila(srv.id, 'mostrarBuscadorHotel', false); 
                                    }}>
                                      <div><strong className="block text-sky-300">{n}</strong><span className="text-slate-400 font-mono">{r}</span></div>
                                    </div>
                                  )
                                })}
                                {proveedoresBD.filter(p => {
                                  const nombreProv = String(p.nombre_razon || p.razon_social || p.nombre || '').toUpperCase();
                                  const busqueda = String(srv.hotel || '').toUpperCase();
                                  const categoria = String(p.categoria || p.tipo_proveedor || p.tipo || p.rubro || p.clasificacion || '').toUpperCase();
                                  const esHotel = categoria.includes('HOTEL') || categoria.includes('HOSPEDAJE');
                                  return esHotel && (busqueda === '' || nombreProv.includes(busqueda));
                                }).length === 0 && (
                                  <div className="p-3 text-xs text-slate-400 text-center italic">No hay hoteles registrados con ese nombre</div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">RIF Hotel</label><input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500 font-mono" placeholder="J-12345678-9" value={srv.hotel_rif} onChange={(e)=>actualizarFila(srv.id, 'hotel_rif', e.target.value.toUpperCase())} /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          <div className="md:col-span-2"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">Cant. Habitaciones</label><input type="number" min="1" className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 text-center font-mono outline-none focus:border-sky-500" value={srv.cant_hab} onChange={(e)=>actualizarFila(srv.id, 'cant_hab', parseInt(e.target.value)||1)} /></div>
                          <div className="md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">Tipo de Habitaciones</label><input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" placeholder="EJ: DOBLE ESTANDAR" value={srv.tipo_hab} onChange={(e)=>actualizarFila(srv.id, 'tipo_hab', e.target.value.toUpperCase())} /></div>
                          <div className="md:col-span-2"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">Cant. Noches</label><input type="number" min="1" className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 text-center font-mono outline-none focus:border-sky-500" value={srv.noches} onChange={(e)=>actualizarFila(srv.id, 'noches', parseInt(e.target.value)||1)} /></div>
                          <div className="md:col-span-2"><label className="text-[9px] text-sky-400 uppercase font-bold mb-1 block">Cant. Huéspedes</label><input type="number" min="1" className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-sky-600 text-center font-mono outline-none focus:border-sky-500" value={srv.cant_huespedes} onChange={(e)=>cambiarCantHuespedes(srv.id, parseInt(e.target.value)||1)} /></div>
                          <div className="md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">Incluye</label><input className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" placeholder="EJ: DESAYUNOS" value={srv.incluye} onChange={(e)=>actualizarFila(srv.id, 'incluye', e.target.value.toUpperCase())} /></div>
                        </div>

                        <div className="space-y-2 mt-2 relative z-40">
                          <label className="text-[9px] text-emerald-400 uppercase font-bold block mb-1">Registro de Huéspedes</label>
                          {srv.huespedes && srv.huespedes.map((h: any, index: number) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-black/20 p-2.5 rounded border border-slate-700/50 relative">
                              <div className="md:col-span-8 relative">
                                <div className="flex justify-between items-center mb-1">
                                  <label className="text-[9px] text-emerald-400 uppercase font-bold block">Huésped {index + 1} - Apellido / Nombre</label>
                                  <button onClick={() => { setFilaActivaPax({id: srv.id, index}); setModalPaxOpen(true); }} className="bg-sky-600 hover:bg-sky-500 text-white text-[9px] px-2 py-0.5 rounded font-bold transition-colors shadow">+ NUEVO PAX</button>
                                </div>
                                <input 
                                  className="w-full bg-slate-800 p-2 rounded text-xs border border-slate-600 uppercase outline-none focus:border-emerald-500" 
                                  placeholder="PÉREZ / JUAN" 
                                  value={h.nombre} 
                                  onChange={(e)=>{ actualizarHuesped(srv.id, index, 'nombre', e.target.value); actualizarHuesped(srv.id, index, 'mostrarBuscadorPax', true); }}
                                  onFocus={() => actualizarHuesped(srv.id, index, 'mostrarBuscadorPax', true)} 
                                  onBlur={() => setTimeout(() => actualizarHuesped(srv.id, index, 'mostrarBuscadorPax', false), 200)} 
                                />
                                {h.mostrarBuscadorPax && h.nombre.length > 0 && (
                                  <div className="absolute z-[99999] w-full bg-[#0f172a] border border-sky-500 mt-1 rounded-lg shadow-2xl max-h-40 overflow-y-auto">
                                    {pasajerosBD.filter(p => p.nombre_apellido.includes(h.nombre) || p.cedula_pasaporte.includes(h.nombre)).map(pax => (
                                      <div key={pax.id} className="p-2 hover:bg-sky-900 cursor-pointer text-xs border-b border-slate-700/50 flex justify-between items-center transition-colors" onMouseDown={(e) => e.preventDefault()} onClick={() => { actualizarHuesped(srv.id, index, 'nombre', pax.nombre_apellido); actualizarHuesped(srv.id, index, 'cedula', pax.cedula_pasaporte); actualizarHuesped(srv.id, index, 'mostrarBuscadorPax', false); }}>
                                        <div><strong className="block text-sky-300">{pax.nombre_apellido}</strong><span className="text-slate-400 font-mono">{pax.cedula_pasaporte}</span></div>
                                        <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); eliminarPasajeroBD(pax.id); }} className="text-rose-500 hover:text-rose-400 p-2 text-sm bg-black/20 rounded hover:bg-rose-900/50 transition-colors" title="Borrar Pasajero">🗑️</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="md:col-span-4">
                                <label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">C.I / Pasaporte</label>
                                <input className="w-full bg-slate-800 p-2 rounded text-xs border border-slate-600 uppercase font-mono outline-none focus:border-emerald-500" placeholder="V-12345678" value={h.cedula} onChange={(e)=>actualizarHuesped(srv.id, index, 'cedula', e.target.value.toUpperCase())} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-2 border-t border-slate-700 pt-3">
                          <div className="md:col-span-8"></div> 
                          <div className="md:col-span-2"><label className="text-[9px] text-emerald-400 uppercase font-bold mb-1 block">Precio Unitario (Noche x Hab)</label><input className="w-full bg-black/50 p-2.5 rounded-lg text-xs border border-emerald-900/50 font-mono text-right outline-none focus:border-emerald-500" placeholder="0,00" value={srv.precio_unitario} onChange={(e)=>actualizarFila(srv.id, 'precio_unitario', e.target.value)} /></div>
                          <div className="md:col-span-2"><label className="text-[9px] text-slate-400 uppercase font-bold mb-1 block">I.V.A.</label><select className="w-full bg-slate-800 p-2.5 rounded-lg text-xs border border-slate-600 uppercase outline-none focus:border-sky-500" value={srv.tipo_iva} onChange={(e)=>actualizarFila(srv.id, 'tipo_iva', e.target.value)}><option value="16%">16% (Gral)</option><option value="EXENTO">Exento</option><option value="NACIONAL">8% (Nac)</option><option value="INTERNACIONAL">7.5% (Int)</option></select></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-4">
                <button onClick={agregarFila} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-lg text-xs font-black uppercase shadow-lg transition-colors">+ Añadir Servicio</button>
              </div>

            </div>

            {/* --- SECCIÓN INFERIOR REDISEÑADA (RESUMEN Y BOTÓN) --- */}
            <div className="flex flex-col items-end pt-8 border-t border-slate-700 gap-4 relative z-10">
              <div className="w-full md:w-96 bg-black/40 border border-slate-700 p-5 rounded-2xl space-y-2">
                
                {t.base_16 > 0 && (
                  <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>Base Imponible 16%:</span>
                    <span className="font-mono">{t.base_16.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {t.base_8 > 0 && (
                  <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>Base Imponible 8% (Nac):</span>
                    <span className="font-mono">{t.base_8.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {t.base_75 > 0 && (
                  <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>Base Imponible 7.5% (Int):</span>
                    <span className="font-mono">{t.base_75.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                  <span>Exento / XTs:</span>
                  <span className="font-mono">{t.exento.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                
                {t.iva_16 > 0 && (
                  <div className="flex justify-between text-xs text-slate-400 font-bold uppercase mt-2">
                    <span>I.V.A. 16%:</span>
                    <span className="font-mono">{t.iva_16.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {t.iva_8 > 0 && (
                  <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>I.V.A. 8% (Nac):</span>
                    <span className="font-mono">{t.iva_8.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {t.iva_75 > 0 && (
                  <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>I.V.A. 7.5% (Int):</span>
                    <span className="font-mono">{t.iva_75.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                
                <div className="border-t border-slate-600 mt-3 pt-3 flex justify-between items-center">
                  <span className="text-[10px] text-sky-400 font-bold uppercase tracking-widest">Gran Total a Cotizar</span>
                  <div className="text-3xl font-black text-sky-400 font-mono tracking-tighter">
                    {t.total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm">{moneda}</span>
                  </div>
                </div>
              </div>
              
              <button onClick={()=>guardarPresupuestoBD('Enviado')} disabled={isSaving} className="w-full md:w-96 bg-sky-500 hover:bg-sky-400 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all">
                {isSaving ? 'Guardando...' : 'Generar Presupuesto'}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* --- MODAL NUEVO PASAJERO (Z-[999999]) --- */}
      {modalPaxOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-white uppercase mb-4 border-b border-slate-700 pb-2 flex items-center gap-2"><span>🛂</span> Registrar Pasajero / Huésped</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-sky-400 uppercase">Apellido / Nombre</label>
                <input type="text" className="w-full bg-black/40 border border-slate-600 rounded-lg p-3 mt-1 text-white uppercase focus:border-sky-500 outline-none" placeholder="EJ: PEREZ / JUAN" value={nuevoPax.nombre_apellido} onChange={(e)=>setNuevoPax({...nuevoPax, nombre_apellido: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Cédula / Pasaporte</label>
                <input type="text" className="w-full bg-black/40 border border-slate-600 rounded-lg p-3 mt-1 text-white font-mono uppercase focus:border-sky-500 outline-none" placeholder="V-0000000" value={nuevoPax.cedula_pasaporte} onChange={(e)=>setNuevoPax({...nuevoPax, cedula_pasaporte: formatearDocumento(e.target.value)})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono (Opcional)</label>
                <input type="text" className="w-full bg-black/40 border border-slate-600 rounded-lg p-3 mt-1 text-white font-mono focus:border-sky-500 outline-none" placeholder="0414-0000000" value={nuevoPax.telefono} onChange={(e)=>setNuevoPax({...nuevoPax, telefono: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button onClick={() => { setModalPaxOpen(false); setFilaActivaPax(null); }} className="text-slate-400 font-bold hover:text-white uppercase text-xs px-4 transition-colors">Cancelar</button>
              <button onClick={guardarNuevoPax} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-black uppercase text-xs shadow-lg transition-colors">Guardar Pasajero</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() { return <Suspense fallback={<div className="text-white p-10 font-bold text-center">Cargando...</div>}><PresupuestoForm /></Suspense>; }