"use client";
import React, { useState, useEffect, useRef } from 'react';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

export default function AdminFinanzasPage() {
  const [cajasBD, setCajasBD] = useState<any[]>([]);
  const [clasificacionesBD, setClasificacionesBD] = useState<any[]>([]);
  const [proveedoresBD, setProveedoresBD] = useState<any[]>([]);
  const [clientesBD, setClientesBD] = useState<any[]>([]);
  const [nroRecibo, setNroRecibo] = useState<string>("00000"); 
  const [isSaving, setIsSaving] = useState(false);
  const [ticketImpresion, setTicketImpresion] = useState<any>(null);
  const [saldoActual, setSaldoActual] = useState<number | null>(null);
  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [isProcessingCapture, setIsProcessingCapture] = useState(false);
  const captureInputRef = useRef<HTMLInputElement>(null);

  // Modales
  const [modalProvOpen, setModalProvOpen] = useState(false);
  const [nuevoProv, setNuevoProv] = useState({ 
    codigo: '', razon_social: '', nombre_comercial: '', rif: '', direccion: '', telefono: '', correo: '',
    tipo: 'HOTEL', pais: '', ciudad: '' 
  });
  
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_razon: '', rif_cedula: '', telefono: '', email: '' });

  // Modal cruzar movimiento
  const [dropdownCruzarOpen, setDropdownCruzarOpen] = useState(false);
  const [modalCruzarOpen, setModalCruzarOpen] = useState(false);
  const [tipoCruce, setTipoCruce] = useState<'cxc'|'cxp'|'socio-cobrar'|'socio-pagar'>('cxc');
  const [pendientesCruce, setPendientesCruce] = useState<any[]>([]);
  const [itemsCruceTarget, setItemsCruceTarget] = useState<any[]>([]);
  const [loadingCruce, setLoadingCruce] = useState(false);
  const [cruces, setCruces] = useState<{item: any, tabla: string, nuevoEstatus: string}[]>([]);
  const [busquedaCruce, setBusquedaCruce] = useState('');

  // Cola "Por Aprobar"
  const [colaPorAprobar, setColaPorAprobar] = useState<any[]>([]);
  const [activoPorAprobar, setActivoPorAprobar] = useState<any>(null);
  const [loadingCola, setLoadingCola] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const cargarColaPorAprobar = async () => {
    setLoadingCola(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_por_aprobar?estado=eq.Pendiente&order=created_at.desc`, { headers: SUPABASE_HEADERS });
      if (res.ok) setColaPorAprobar(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCola(false);
    }
  };

  const seleccionarParaAprobar = (item: any) => {
    setActivoPorAprobar(item);
    
    // Auto-detectar tipo según la IA (clasificacion) o el monto
    let tipoEstimado = item.monto < 0 ? 'Recibo de Egreso' : 'Recibo de Ingreso';
    if (item.clasificacion === 'Egreso') tipoEstimado = 'Recibo de Egreso';
    if (item.clasificacion === 'Ingreso') tipoEstimado = 'Recibo de Ingreso';

    const montoAbsVal = Math.abs(item.monto || 0);

    // Mapear categoría a clasificación del formulario si existe, sino usar clasificación de IA
    let clasifForm = item.categoria || item.clasificacion || '';
    if (clasifForm === 'Egreso' || clasifForm === 'Ingreso') clasifForm = '';

    setMovimiento(prev => ({
      ...prev,
      fecha: item.fecha || new Date().toISOString().split('T')[0],
      caja_id: prev.caja_id || '', // Preservar la caja seleccionada si la hay
      caja_destino_id: '',
      referencia: item.referencia || '',
      persona: (item.persona || '').toUpperCase(),
      monto: montoAbsVal > 0 ? montoAbsVal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
      moneda: item.moneda || 'Bs',
      tipo: tipoEstimado,
      clasificacion: clasifForm.toUpperCase(),
      descripcion: item.descripcion || ''
    }));
  };

  const rechazarPorAprobar = async (id: string) => {
    if (!confirm("⚠️ ¿Estás seguro de que deseas rechazar y descartar este comprobante?")) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_por_aprobar?id=eq.${id}`, {
        method: 'PATCH',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({ estado: 'Rechazado' })
      });
      if (res.ok) {
        alert("❌ Comprobante descartado.");
        if (activoPorAprobar?.id === id) setActivoPorAprobar(null);
        cargarColaPorAprobar();
      } else {
        alert("Ocurrió un error al descartar el comprobante.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const guardarComoPorAprobar = async () => {
    const montoNum = parsearNumeroBD(movimiento.monto);
    if (montoNum <= 0) return alert("⚠️ Ingrese un monto válido para guardar en cola");
    
    setIsSavingDraft(true);
    try {
      const payloadDraft = {
        fecha: movimiento.fecha,
        persona: movimiento.persona.toUpperCase() || 'MANUAL DRAFT',
        referencia: movimiento.referencia || 'S/R',
        monto: movimiento.tipo === 'Recibo de Egreso' ? -montoNum : montoNum,
        moneda: movimiento.moneda,
        descripcion: movimiento.descripcion || 'Borrador guardado manualmente',
        estado: 'Pendiente'
      };
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_por_aprobar`, {
        method: 'POST',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify(payloadDraft)
      });
      
      if (res.ok) {
        alert("📥 Borrador guardado con éxito en la cola 'Por aprobar'.");
        setMovimiento({ ...movimiento, persona: '', monto: '', descripcion: '', referencia: '', clasificacion: '', caja_destino_id: '' });
        cargarColaPorAprobar();
      } else {
        const err = await res.json();
        throw new Error(err.message || 'Error de esquema');
      }
    } catch (e: any) {
      alert("❌ Error al guardar borrador:\n" + e.message);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Estado principal
  const [movimiento, setMovimiento] = useState({
    fecha: new Date().toISOString().split('T')[0], caja_id: '', caja_destino_id: '', referencia: '',
    persona: '', monto: '', moneda: 'Bs', tasa: '36,500', tipo: 'Recibo de Ingreso', clasificacion: '', descripcion: '' 
  });

  useEffect(() => {
    cargarCajas(); cargarClasificaciones(); cargarProveedores(); cargarClientes(); obtenerUltimoRecibo();
    cargarColaPorAprobar();
  }, []);

  useEffect(() => {
    if (!movimiento.caja_id || cajasBD.length === 0) { setSaldoActual(null); return; }
    const calcularSaldoEnVivo = async () => {
      try {
        const caja = cajasBD.find(c => c.id.toString() === movimiento.caja_id);
        if (!caja) return;
        let saldo = parseFloat(caja.saldo_inicial || 0);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?caja_id=eq.${movimiento.caja_id}&select=monto,tipo`, { headers: SUPABASE_HEADERS });
        if (res.ok) {
          const movs = await res.json();
          movs.forEach((m: any) => {
            if (m.tipo === 'Recibo de Ingreso') saldo += parseFloat(m.monto || 0);
            else saldo -= parseFloat(m.monto || 0);
          });
        }
        setSaldoActual(saldo);
      } catch (error) { console.error(error); }
    };
    calcularSaldoEnVivo();
  }, [movimiento.caja_id, cajasBD, isSaving]);

  const cargarCajas = async () => { const res = await fetch(`${SUPABASE_URL}/rest/v1/cajas?select=*&order=nombre.asc`, { headers: SUPABASE_HEADERS }); if (res.ok) setCajasBD(await res.json()); };
  const cargarClasificaciones = async () => { const res = await fetch(`${SUPABASE_URL}/rest/v1/clasificaciones?select=*&order=nombre.asc`, { headers: SUPABASE_HEADERS }); if (res.ok) setClasificacionesBD(await res.json()); };
  const cargarProveedores = async () => { const res = await fetch(`${SUPABASE_URL}/rest/v1/proveedores?select=*&order=razon_social.asc`, { headers: SUPABASE_HEADERS }); if (res.ok) setProveedoresBD(await res.json()); };
  const cargarClientes = async () => { const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&order=nombre_razon.asc`, { headers: SUPABASE_HEADERS }); if (res.ok) setClientesBD(await res.json()); };

  const obtenerUltimoRecibo = async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?select=nro_recibo&order=nro_recibo.desc&limit=1`, { headers: SUPABASE_HEADERS });
    const data = await response.json();
    if (response.ok && data.length > 0) setNroRecibo((parseInt(data[0].nro_recibo, 10) + 1).toString().padStart(5, '0'));
    else setNroRecibo("00001");
  };

  const agregarClasificacion = async () => {
    const nueva = window.prompt("➕ Escribe la nueva clasificación (Ej: COBRANZA, BOLETO):");
    if (!nueva || nueva.trim() === '') return;
    const nombreMayus = nueva.trim().toUpperCase();
    if (clasificacionesBD.some(c => c.nombre === nombreMayus)) return alert("⚠️ Ya existe.");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clasificaciones`, { method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify({ nombre: nombreMayus }) });
      if (res.ok) { cargarClasificaciones(); setMovimiento({...movimiento, clasificacion: nombreMayus}); } 
    } catch (e) {}
  };

  const eliminarClasificacion = async () => {
    if (!movimiento.clasificacion || movimiento.clasificacion === 'TRF INTERNA') return;
    if (!window.confirm(`¿Eliminar: "${movimiento.clasificacion}"?`)) return;
    const clasifObj = clasificacionesBD.find(c => c.nombre === movimiento.clasificacion);
    if (!clasifObj) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clasificaciones?id=eq.${clasifObj.id}`, { method: 'DELETE', headers: SUPABASE_HEADERS });
      if (res.ok) { setMovimiento({...movimiento, clasificacion: ''}); cargarClasificaciones(); }
    } catch (e) {}
  };

  // MAGIA: Formateador Inteligente de RIF y Cédula (en el modal de finanzas)
  const manejarCambioRifNuevoProv = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setNuevoProv({ ...nuevoProv, rif: valorRif, codigo: soloNumeros });
  };

  const crearProveedor = async () => {
    if (!nuevoProv.razon_social || !nuevoProv.rif) return alert("Razón Social y RIF son obligatorios");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/proveedores`, {
        method: 'POST', headers: { ...SUPABASE_HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify({ 
          ...nuevoProv, 
          razon_social: nuevoProv.razon_social.toUpperCase(), 
          rif: nuevoProv.rif.toUpperCase(),
          pais: nuevoProv.pais.toUpperCase(),
          ciudad: nuevoProv.ciudad.toUpperCase()
        })
      });
      if (res.ok) {
        const data = await res.json();
        setProveedoresBD([...proveedoresBD, data[0]]); 
        setMovimiento({ ...movimiento, persona: data[0].razon_social }); 
        setModalProvOpen(false);
        setNuevoProv({ codigo: '', razon_social: '', nombre_comercial: '', rif: '', direccion: '', telefono: '', correo: '', tipo: 'HOTEL', pais: '', ciudad: '' });
      }
    } catch (e) {}
  };

  const crearCliente = async () => {
    if (!nuevoCliente.nombre_razon || !nuevoCliente.rif_cedula) return alert("Nombre y RIF son obligatorios");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
        method: 'POST', headers: { ...SUPABASE_HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify({ ...nuevoCliente, nombre_razon: nuevoCliente.nombre_razon.toUpperCase(), rif_cedula: nuevoCliente.rif_cedula.toUpperCase() })
      });
      if (res.ok) {
        const data = await res.json();
        setClientesBD([...clientesBD, data[0]]); setMovimiento({ ...movimiento, persona: data[0].nombre_razon }); setModalClienteOpen(false);
      }
    } catch (e) {}
  };

  const formatearEnVivo = (valor: string, decimales: number) => {
    if (!valor) return '';
    let limpio = valor.replace(/[^0-9.,]/g, '').replace(/\./g, '');
    if (limpio.includes(',')) {
      const partes = limpio.split(',');
      return partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1].substring(0, decimales);
    }
    return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const parsearNumeroBD = (valor: string) => parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
  function aplicarFormatoEstricto(valor: string, decimales: number) {
    if (!valor) return '';
    return (parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0).toLocaleString('de-DE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  }

  const montoNumVivo = parsearNumeroBD(movimiento.monto);
  const tasaNumVivo = parsearNumeroBD(movimiento.tasa) || 1;
  const valorEqVivo = movimiento.moneda === 'Bs' ? (montoNumVivo / tasaNumVivo) : (montoNumVivo * tasaNumVivo);
  const monedaEqViva = movimiento.moneda === 'Bs' ? 'USD' : 'Bs';
  const valorCalculado = valorEqVivo.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + " " + monedaEqViva;

  const guardarMovimiento = async () => {
    if (isSaving) return;
    const montoNum = parsearNumeroBD(movimiento.monto);
    const tasaNum = parsearNumeroBD(movimiento.tasa) || 1;
    const valorEquivalente = movimiento.moneda === 'Bs' ? (montoNum / tasaNum) : (montoNum * tasaNum);
    const monedaEquivalente = movimiento.moneda === 'Bs' ? 'USD' : 'Bs';
    const valorCalculadoFinal = valorEquivalente.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + " " + monedaEquivalente;
    const esTransferencia = movimiento.tipo === 'Transferencia Interna';
    
    if (!movimiento.caja_id || montoNum <= 0) return alert("⚠️ Faltan datos obligatorios");
    if (!esTransferencia && !movimiento.persona) return alert("⚠️ Indique el Beneficiario o Pagador");
    if (esTransferencia && !movimiento.caja_destino_id) return alert("⚠️ Seleccione la cuenta destino");

    setIsSaving(true);
    const clasifNorm = movimiento.clasificacion.toUpperCase();

    let estatusFact = 'No Aplica'; 
    if (clasifNorm.includes('BOLETO') || clasifNorm.includes('HOSPEDAJE') || clasifNorm.includes('SERVICIO') || clasifNorm.includes('PAQUETE') || clasifNorm.includes('SEGURO')) {
      estatusFact = 'Pendiente'; 
    }

    let estatusConciliacion = 'No Aplica';
    if (clasifNorm === 'COBRANZA' && movimiento.tipo === 'Recibo de Ingreso') {
      estatusConciliacion = 'Pendiente';
    }

    try {
      let datosTicket = null;

      if (esTransferencia) {
        const cajaOrigen = cajasBD.find(c => c.id.toString() === movimiento.caja_id);
        const cajaDestino = cajasBD.find(c => c.id.toString() === movimiento.caja_destino_id);
        const nroReciboIngreso = (parseInt(nroRecibo, 10) + 1).toString().padStart(5, '0');
        
        const payloadEgreso = { nro_recibo: nroRecibo, fecha: movimiento.fecha, caja_id: movimiento.caja_id, referencia: movimiento.referencia || 'TRF-INT', persona: `TRASPASO A: ${cajaDestino.nombre}`, monto: montoNum, moneda: movimiento.moneda, tasa: tasaNum, tipo: 'Recibo de Egreso', clasificacion: 'TRF INTERNA', descripcion: movimiento.descripcion || 'Movimiento entre cuentas', estado_conciliacion: 'No Aplica' };
        const payloadIngreso = { ...payloadEgreso, nro_recibo: nroReciboIngreso, caja_id: movimiento.caja_destino_id, persona: `TRASPASO DESDE: ${cajaOrigen.nombre}`, tipo: 'Recibo de Ingreso' };

        const res1 = await fetch(`${SUPABASE_URL}/rest/v1/movimientos`, { method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(payloadEgreso) });
        const res2 = await fetch(`${SUPABASE_URL}/rest/v1/movimientos`, { method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(payloadIngreso) });
        
        if (!res1.ok || !res2.ok) throw new Error("La base de datos rechazó la transferencia.");
        
        datosTicket = { ...payloadEgreso, tipo: 'TRANSFERENCIA INTERNA', nombre_caja: `${cajaOrigen.nombre} ➔ ${cajaDestino.nombre}`, valor_calculado: valorCalculadoFinal };
      } else {
        const refsCruces = cruces.map(c => c.item.nro_documento || c.item.referencia || 'S/N').join(', ');
        const descCruce = cruces.length > 0 ? ` [Cruzado con: ${refsCruces}]` : '';
        const payload = { 
          nro_recibo: nroRecibo, fecha: movimiento.fecha, caja_id: movimiento.caja_id, referencia: movimiento.referencia || 'S/R', 
          persona: movimiento.persona.toUpperCase(), monto: montoNum, moneda: movimiento.moneda, tasa: tasaNum, 
          tipo: movimiento.tipo, clasificacion: movimiento.clasificacion, descripcion: (movimiento.descripcion || '') + descCruce, 
          estatus_facturacion: estatusFact,
          estado_conciliacion: estatusConciliacion 
        };
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos`, { method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(payload) });
        
        if (!res.ok) {
           const errorDB = await res.json();
           throw new Error(`Supabase rechazó el movimiento: ${errorDB.message || 'Error de esquema'}.`);
        }
        
        datosTicket = { ...payload, nombre_caja: cajasBD.find(c => c.id.toString() === movimiento.caja_id)?.nombre, valor_calculado: valorCalculadoFinal };

        if (cruces.length > 0) {
          for (const cruce of cruces) {
            await fetch(`${SUPABASE_URL}/rest/v1/${cruce.tabla}?id=eq.${cruce.item.id}`, {
              method: 'PATCH', headers: SUPABASE_HEADERS,
              body: JSON.stringify({ saldo_pendiente: 0, estatus: cruce.nuevoEstatus })
            });
          }
        } else {
          if (clasifNorm.includes('PRESTAMO') || clasifNorm.includes('PRÉSTAMO')) {
            if (movimiento.tipo === 'Recibo de Ingreso') {
              await fetch(`${SUPABASE_URL}/rest/v1/cuentas_por_pagar`, {
                method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify({
                  categoria: 'Préstamos Recibidos', proveedor: movimiento.persona.toUpperCase(), nro_documento: movimiento.referencia || `REC-${nroRecibo}`,
                  concepto: `Auto-Generado: ${movimiento.descripcion || 'Préstamo recibido'}`, monto_total: montoNum, saldo_pendiente: montoNum,
                  moneda: movimiento.moneda, fecha_emision: movimiento.fecha, fecha_vencimiento: movimiento.fecha, estatus: 'Pendiente'
                })
              });
            } else if (movimiento.tipo === 'Recibo de Egreso') {
              await fetch(`${SUPABASE_URL}/rest/v1/cuentas_por_cobrar`, {
                method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify({
                  categoria: 'Préstamos Otorgados', cliente: movimiento.persona.toUpperCase(), nro_documento: movimiento.referencia || `REC-${nroRecibo}`,
                  concepto: `Auto-Generado: ${movimiento.descripcion || 'Préstamo otorgado'}`, monto_total: montoNum, saldo_pendiente: montoNum,
                  moneda: movimiento.moneda, fecha_emision: movimiento.fecha, fecha_vencimiento: movimiento.fecha, estatus: 'Pendiente'
                })
              });
            }
          }

          if (clasifNorm.includes('MOVIMIENTO SOCIO') || clasifNorm.includes('PROVISION') || clasifNorm.includes('PROVISIÓN')) {
            const tipoCompensacion = movimiento.tipo === 'Recibo de Egreso' ? 'Por Pagar' : 'Por Cobrar';
            await fetch(`${SUPABASE_URL}/rest/v1/cuentas_socios`, {
              method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify({
                socio: movimiento.persona.toUpperCase(), tipo: tipoCompensacion, nro_documento: movimiento.referencia || `REC-${nroRecibo}`,
                concepto: `Auto-Generado: Cambio/Traspaso - ${movimiento.descripcion || 'Mover fondos'}`, monto_total: montoNum,
                saldo_pendiente: montoNum, moneda: movimiento.moneda, tasa: tasaNum, equivalente: valorEquivalente,
                moneda_equivalente: monedaEquivalente, fecha_emision: movimiento.fecha, estatus: 'Pendiente'
              })
            });
          }
        }
      }

      // Si proviene de la cola de aprobación, marcarla como aprobada
      if (activoPorAprobar) {
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_por_aprobar?id=eq.${activoPorAprobar.id}`, {
          method: 'PATCH',
          headers: SUPABASE_HEADERS,
          body: JSON.stringify({ estado: 'Aprobado' })
        });
        if (!patchRes.ok) {
          console.error("Error al actualizar estado en cola:", await patchRes.text());
        }
        setActivoPorAprobar(null);
        cargarColaPorAprobar();
      }

      setTicketImpresion(datosTicket); 
      setMovimiento({ ...movimiento, persona: '', monto: '', descripcion: '', referencia: '', clasificacion: '', caja_destino_id: '' });
      setCruces([]);
      obtenerUltimoRecibo(); 
      
      setTimeout(() => { 
        window.print(); 
        setTicketImpresion(null); 
        setIsSaving(false); 
      }, 800);
      
    } catch (e: any) { 
      alert("❌ " + e.message);
      setIsSaving(false); 
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingCapture(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Convertir en chunks para evitar stack overflow en imágenes grandes
      let base64 = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        base64 += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      base64 = btoa(base64);

      const res = await fetch('/api/leer-recibo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const datos = await res.json();
      console.log('Respuesta del backend:', datos);
      if (!res.ok) {
        const detalle = datos.urlIntentada ? `\nURL: ${datos.urlIntentada}` : '';
        throw new Error((datos.error || `Error HTTP ${res.status}`) + detalle);
      }
      // Fallback: si no hay descripcion explícita pero sí banco, usar banco como descripción
      const descripcionFinal = datos.descripcion ?? (datos.banco ? `Transferencia desde ${datos.banco}` : null);
      setMovimiento(prev => ({
        ...prev,
        ...(datos.monto != null ? { monto: Number(datos.monto).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } : {}),
        ...(datos.referencia ? { referencia: datos.referencia } : {}),
        ...(datos.fecha ? { fecha: datos.fecha } : {}),
        ...(datos.beneficiario ? { persona: String(datos.beneficiario).toUpperCase() } : {}),
        ...(descripcionFinal ? { descripcion: descripcionFinal } : {}),
      }));
    } catch (err: any) {
      console.error('Error handleCapture:', err);
      alert('❌ Error al procesar el capture:\n' + (err.message ?? 'Error desconocido'));
    } finally {
      setIsProcessingCapture(false);
      if (captureInputRef.current) captureInputRef.current.value = '';
    }
  };

  const fmtLiq = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const abrirCruzar = async (tipo: 'cxc'|'cxp'|'socio-cobrar'|'socio-pagar') => {
    setModalCruzarOpen(true);
    setTipoCruce(tipo);
    setItemsCruceTarget([]);
    setBusquedaCruce('');
    setLoadingCruce(true);
    const urls: Record<string, string> = {
      'cxc': `${SUPABASE_URL}/rest/v1/cuentas_por_cobrar?estatus=neq.Pagado&order=fecha_vencimiento.asc`,
      'cxp': `${SUPABASE_URL}/rest/v1/cuentas_por_pagar?estatus=neq.Pagado&order=fecha_vencimiento.asc`,
      'socio-cobrar': `${SUPABASE_URL}/rest/v1/cuentas_socios?tipo=eq.Por%20Cobrar&estatus=neq.Compensado&order=fecha_emision.desc`,
      'socio-pagar': `${SUPABASE_URL}/rest/v1/cuentas_socios?tipo=eq.Por%20Pagar&estatus=neq.Compensado&order=fecha_emision.desc`,
    };
    try {
      const res = await fetch(urls[tipo], { headers: SUPABASE_HEADERS });
      setPendientesCruce(res.ok ? await res.json() : []);
    } catch { setPendientesCruce([]); }
    setLoadingCruce(false);
  };

  const confirmarCruce = async () => {
    if (itemsCruceTarget.length === 0) return;
    const esSocio = tipoCruce.startsWith('socio');
    const tabla = esSocio ? 'cuentas_socios' : tipoCruce === 'cxc' ? 'cuentas_por_cobrar' : 'cuentas_por_pagar';
    const nuevoEstatus = esSocio ? 'Compensado' : 'Pagado';
    
    const nuevosCruces = itemsCruceTarget.map(item => ({ item, tabla, nuevoEstatus }));
    setCruces(prev => [...prev, ...nuevosCruces]);
    
    alert(`✅ ${nuevosCruces.length} cruce(s) vinculado(s). Se aplicarán al registrar el movimiento.`);
    setModalCruzarOpen(false);
    setItemsCruceTarget([]);
  };

  const esTransferencia = movimiento.tipo === 'Transferencia Interna';
  const filtroTexto = movimiento.persona.toLowerCase();
  const directorioUniversal = [
    ...clientesBD.map(c => ({ id: `C-${c.id}`, tipo: 'CLIENTE', razonLegal: c.nombre_razon, nombreComercial: '', rif: c.rif_cedula, colorTipo: 'bg-emerald-500/20 text-emerald-400' })),
    ...proveedoresBD.map(p => ({ id: `P-${p.id}`, tipo: 'PROVEEDOR', razonLegal: p.razon_social, nombreComercial: p.nombre_comercial || '', rif: p.rif, colorTipo: 'bg-amber-500/20 text-amber-400' }))
  ];
  const personasFiltradas = directorioUniversal.filter(item => item.razonLegal?.toLowerCase().includes(filtroTexto) || item.nombreComercial?.toLowerCase().includes(filtroTexto) || item.rif?.toLowerCase().includes(filtroTexto));

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #seccion-recibo-imprimir, #seccion-recibo-imprimir * { visibility: visible !important; color: black !important; }
          #seccion-recibo-imprimir { position: fixed !important; left: 0 !important; top: 0 !important; width: 100vw !important; height: 100vh !important; margin: 0 !important; padding: 20mm !important; background-color: white !important; z-index: 999999 !important; border: none !important; }
          #seccion-recibo-imprimir .border-gray-200 { border-color: #e5e7eb !important; border-style: solid !important; border-width: 1px !important;}
          #seccion-recibo-imprimir .border-gray-100 { border-color: #f3f4f6 !important; border-style: solid !important; border-width: 1px !important;}
          #seccion-recibo-imprimir .border-black { border-color: black !important; border-style: solid !important;}
          #seccion-recibo-imprimir .border-b-2 { border-bottom-width: 2px !important;}
          #seccion-recibo-imprimir .border-t-2 { border-top-width: 2px !important;}
          #seccion-recibo-imprimir .border-b { border-bottom-width: 1px !important;}
          #seccion-recibo-imprimir .border-t { border-top-width: 1px !important;}
        }
      `}</style>
      
      <div className="animate-in fade-in duration-300 max-w-7xl mx-auto px-4 space-y-8 pb-10 print:hidden mt-6">
        <div className="flex items-center gap-3 mb-8 border-b border-[#334155] pb-4">
          <span className="text-3xl">💸</span>
          <div><h2 className="text-2xl font-bold text-white uppercase tracking-tight">Registro de Movimiento</h2><p className="text-[#38bdf8] text-xs font-bold tracking-widest uppercase">Admin. y Finanzas</p></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Columna Izquierda: Formulario (2/3 de ancho) */}
          <div className="lg:col-span-2 bg-[#1e293b] p-8 rounded-2xl border border-[#334155] shadow-xl relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-[#334155] pb-4 gap-4">
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setMovimiento({...movimiento, tipo: 'Recibo de Ingreso', caja_destino_id: ''})} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all ${movimiento.tipo === 'Recibo de Ingreso' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>📥 Ingreso</button>
              <button onClick={() => setMovimiento({...movimiento, tipo: 'Recibo de Egreso', caja_destino_id: ''})} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all ${movimiento.tipo === 'Recibo de Egreso' ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>📤 Egreso</button>
              <button onClick={() => setMovimiento({...movimiento, tipo: 'Transferencia Interna', persona: ''})} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all ${movimiento.tipo === 'Transferencia Interna' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>🔄 Transferencia</button>
              <input ref={captureInputRef} type="file" accept="image/*" className="hidden" onChange={handleCapture} />
              <button
                onClick={() => captureInputRef.current?.click()}
                disabled={isProcessingCapture}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all border ${isProcessingCapture ? 'bg-violet-900/40 border-violet-500/30 text-violet-300 cursor-not-allowed' : 'bg-violet-600/20 border-violet-500/40 text-violet-300 hover:bg-violet-600/40 hover:border-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.2)]'}`}
              >
                {isProcessingCapture ? (
                  <><span className="animate-spin inline-block">⏳</span> Procesando...</>
                ) : (
                  <>📸 Cargar Capture</>
                )}
              </button>
              <div className="relative flex flex-wrap gap-2">
                {cruces.length > 0 && cruces.map((cruce, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/40 rounded-lg pr-1">
                    <span className="px-3 py-2 font-bold text-[10px] uppercase text-emerald-400">
                      🔗 Cruzado: {cruce.item.nro_documento || cruce.item.referencia || 'S/N'}
                    </span>
                    <button onClick={() => setCruces(prev => prev.filter((_, i) => i !== idx))} className="px-2 py-1.5 rounded-md text-rose-400 hover:bg-rose-500/10 transition-colors" title="Quitar cruce">✖</button>
                  </div>
                ))}
                
                <button onClick={() => setDropdownCruzarOpen(v => !v)} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all border border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400">
                  🔗 Cruzar con... {dropdownCruzarOpen ? '▲' : '▾'}
                </button>
                {dropdownCruzarOpen && (
                  <div className="absolute z-50 left-0 top-full mt-1 flex flex-col bg-[#1e293b] border border-[#334155] rounded-xl shadow-2xl overflow-hidden w-52">
                    <button onClick={() => { setDropdownCruzarOpen(false); abrirCruzar('cxc'); }} className="px-4 py-3 text-left text-xs font-bold text-[#38bdf8] hover:bg-[#38bdf8]/10 transition-colors">📥 Cuenta por Cobrar</button>
                    <button onClick={() => { setDropdownCruzarOpen(false); abrirCruzar('cxp'); }} className="px-4 py-3 text-left text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors">📤 Cuenta por Pagar</button>
                    <button onClick={() => { setDropdownCruzarOpen(false); abrirCruzar('socio-cobrar'); }} className="px-4 py-3 text-left text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors">🟢 Socio: Por Recibir</button>
                    <button onClick={() => { setDropdownCruzarOpen(false); abrirCruzar('socio-pagar'); }} className="px-4 py-3 text-left text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition-colors">🔴 Socio: Por Entregar</button>
                  </div>
                )}
              </div>
            </div>
            {saldoActual !== null && (
              <div className="text-right bg-black/20 px-4 py-2 rounded-lg border border-[#334155]">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Saldo Disponible</p>
                <p className="text-xl font-bold font-mono text-emerald-400">{saldoActual.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {movimiento.moneda}</p>
              </div>
            )}
          </div>
          {/* Indicador de comprobante seleccionado */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase">{esTransferencia ? '1. Caja Origen (Sale)' : '1. Caja o Banco'}</label>
              <div className="relative">
                <select className="w-full h-[46px] px-4 bg-black/40 border border-[#334155] rounded-lg text-white font-bold appearance-none cursor-pointer outline-none focus:border-[#38bdf8] transition-colors" value={movimiento.caja_id} onChange={(e) => setMovimiento({...movimiento, caja_id: e.target.value, moneda: cajasBD.find(c=>c.id.toString()===e.target.value)?.moneda})}>
                  <option value="" className="bg-[#0f172a]">-- Seleccione --</option>
                  {cajasBD.map(c => <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.nombre} ({c.moneda})</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Fecha</label>
              <input type="date" className="w-full h-[46px] px-4 bg-black/40 border border-[#334155] rounded-lg text-white font-bold [color-scheme:dark] cursor-pointer hover:border-[#38bdf8] outline-none transition-colors" value={movimiento.fecha} onChange={(e) => setMovimiento({...movimiento, fecha: e.target.value})} onClick={(e: any) => e.target.showPicker()} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2">
              {esTransferencia ? (
                <>
                  <label className="block text-[11px] font-bold text-emerald-400 mb-2 uppercase">2. Cuenta Destino (Entra)</label>
                  <div className="relative">
                    <select className="w-full h-[46px] px-4 bg-black/40 border border-emerald-500/30 rounded-lg text-white font-bold appearance-none cursor-pointer outline-none focus:border-emerald-500 transition-colors" value={movimiento.caja_destino_id} onChange={(e) => setMovimiento({...movimiento, caja_destino_id: e.target.value})}>
                      <option value="" className="bg-[#0f172a]">-- Seleccione Destino --</option>
                      {cajasBD.filter(c => c.id.toString() !== movimiento.caja_id).map(c => <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.nombre}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500/50 text-xs">▼</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Beneficiario / Pagador</label>
                    <div className="flex gap-4">
                      <button onClick={() => setModalClienteOpen(true)} className="text-[10px] text-emerald-400 font-bold hover:text-white transition-colors">+ NUEVO CLIENTE</button>
                      <button onClick={() => setModalProvOpen(true)} className="text-[10px] text-amber-400 font-bold hover:text-white transition-colors">+ NUEVO PROVEEDOR</button>
                    </div>
                  </div>
                  <div className="relative">
                    <input type="text" className="w-full h-[46px] px-4 bg-black/40 border border-[#334155] rounded-lg text-white font-bold uppercase focus:border-[#38bdf8] outline-none transition-colors" value={movimiento.persona} onChange={(e) => { setMovimiento({...movimiento, persona: e.target.value}); setMostrarBuscador(true); }} onFocus={() => setMostrarBuscador(true)} onBlur={() => setTimeout(() => setMostrarBuscador(false), 200)} placeholder="BUSCAR O ESCRIBIR NOMBRE..." />
                    <span className="absolute right-4 top-4 text-xs text-slate-400 pointer-events-none">▼</span>
                    {mostrarBuscador && personasFiltradas.length > 0 && (
                      <ul className="absolute z-50 w-full bg-[#1e293b] border border-[#334155] max-h-60 overflow-y-auto rounded-lg mt-1 shadow-2xl custom-scrollbar">
                        {personasFiltradas.map((item) => (
                          <li key={item.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setMovimiento({...movimiento, persona: item.razonLegal}); setMostrarBuscador(false); }} className="px-4 py-3 hover:bg-[#334155] cursor-pointer border-b border-[#334155]/50 last:border-0 transition-colors">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-white text-xs uppercase">{item.nombreComercial ? `${item.nombreComercial} (${item.razonLegal})` : item.razonLegal}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${item.colorTipo}`}>{item.tipo}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">RIF: {item.rif}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Referencia</label>
              <input type="text" className="w-full h-[46px] px-4 bg-black/40 border border-[#334155] rounded-lg text-white font-bold" value={movimiento.referencia} onChange={(e) => setMovimiento({...movimiento, referencia: e.target.value})} placeholder="NRO. OPERACIÓN" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 bg-black/20 p-5 rounded-xl border border-[#334155]">
            <div>
              <label className="block text-[11px] font-bold text-[#38bdf8] mb-2 uppercase tracking-widest">Monto</label>
              <input type="text" className="w-full h-[46px] px-4 bg-black/50 border border-[#38bdf8]/30 rounded-lg text-lg font-mono text-white" value={movimiento.monto} onChange={(e) => setMovimiento({...movimiento, monto: formatearEnVivo(e.target.value, 2)})} onBlur={() => setMovimiento({...movimiento, monto: aplicarFormatoEstricto(movimiento.monto, 2)})} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase text-center">Tasa</label>
              <input type="text" className="w-full h-[46px] px-4 bg-black/40 border border-[#334155] rounded-lg text-white font-mono text-center" value={movimiento.tasa} onChange={(e) => setMovimiento({...movimiento, tasa: formatearEnVivo(e.target.value, 3)})} onBlur={() => setMovimiento({...movimiento, tasa: aplicarFormatoEstricto(movimiento.tasa, 3)})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-emerald-400 mb-2 uppercase tracking-widest">Equivalente</label>
              <div className="h-[46px] flex items-center justify-center bg-emerald-500/10 border border-emerald-500/30 rounded-lg font-mono font-bold text-emerald-400 text-xl">{valorCalculado}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">Clasificación</label>
                <div className="text-[10px]"><button onClick={agregarClasificacion} disabled={esTransferencia} className="text-emerald-400 font-bold hover:text-white">+ Agregar</button></div>
              </div>
              <div className="relative">
                <select className="w-full h-[46px] px-4 bg-black/40 border border-[#334155] rounded-lg text-white font-bold appearance-none cursor-pointer outline-none focus:border-[#38bdf8] transition-colors disabled:opacity-50" value={movimiento.clasificacion} onChange={(e) => setMovimiento({...movimiento, clasificacion: e.target.value})} disabled={esTransferencia}>
                  <option value="" className="bg-[#0f172a]">-- Seleccione --</option>
                  {clasificacionesBD.map(cl => <option key={cl.id} value={cl.nombre} className="bg-[#0f172a]">{cl.nombre}</option>)}
                  {esTransferencia && <option value="TRF INTERNA" className="bg-[#0f172a]">TRF INTERNA</option>}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase">Concepto / Descripción</label>
              <input type="text" className="w-full h-[46px] px-4 bg-black/40 border border-[#334155] rounded-lg text-white" value={movimiento.descripcion} onChange={(e) => setMovimiento({...movimiento, descripcion: e.target.value})} placeholder="DETALLES ADICIONALES..." />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-4 border-t border-[#334155] pt-6">
            <button 
              onClick={guardarComoPorAprobar} 
              disabled={isSaving || isSavingDraft} 
              className={`px-6 py-4 text-slate-300 font-bold rounded-xl transition-all border border-[#334155] hover:bg-slate-800 uppercase tracking-widest text-xs ${isSavingDraft ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSavingDraft ? 'GUARDANDO...' : '📥 Guardar como "Por Aprobar"'}
            </button>
            <button 
              onClick={guardarMovimiento} 
              disabled={isSaving || isSavingDraft} 
              className={`px-10 py-4 text-white font-black rounded-xl transition-all shadow-lg uppercase tracking-widest text-xs ${isSaving ? 'bg-slate-600' : 'bg-[#10b981] hover:bg-emerald-400'}`}>
              {isSaving ? 'PROCESANDO E IMPRIMIENDO...' : 'REGISTRAR E IMPRIMIR MOVIMIENTO'}
            </button>
          </div>
        </div>

        {/* Columna Derecha: Cola "Por Aprobar" */}
        <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl flex flex-col gap-6 lg:col-span-1">
          <div>
            <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-2">
              📥 Por Aprobar
              <span className="bg-amber-500/20 text-amber-400 text-xs px-2.5 py-0.5 rounded-full font-mono font-black border border-amber-500/30">
                {colaPorAprobar.length}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed">
              Comprobantes escaneados vía Telegram o borradores manuales esperando validación.
            </p>
          </div>

          {loadingCola ? (
            <div className="text-center py-8 text-xs text-slate-400 font-bold">
              ⏳ Cargando cola de aprobación...
            </div>
          ) : colaPorAprobar.length === 0 ? (
            <div className="text-center py-8 px-4 border border-dashed border-[#334155] rounded-xl text-xs text-slate-500 font-bold bg-black/10">
              ✨ No hay comprobantes pendientes.
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
              {colaPorAprobar.map((item) => {
                const isSelected = activoPorAprobar?.id === item.id;
                const formatMonto = Number(Math.abs(item.monto || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2 });
                const esEgreso = item.monto < 0;

                return (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col gap-2 ${
                      isSelected 
                        ? 'bg-[#38bdf8]/10 border-[#38bdf8] shadow-[0_0_15px_rgba(56,189,248,0.15)] animate-pulse' 
                        : 'bg-black/30 border-[#334155] hover:border-slate-400 hover:bg-black/50'
                    }`}
                    onClick={() => seleccionarParaAprobar(item)}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                        esEgreso ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {esEgreso ? 'Egreso' : 'Ingreso'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{item.fecha}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-[11px] uppercase truncate" title={item.persona}>
                        {item.persona || 'Socio o Tercero'}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        {item.descripcion || 'Sin descripción'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-[#334155]/50 pt-2 mt-1">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 font-bold uppercase font-mono">Monto</span>
                        <span className={`text-xs font-black font-mono ${esEgreso ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {formatMonto} {item.moneda || 'Bs'}
                        </span>
                      </div>
                      {item.referencia && item.referencia !== 'S/R' && (
                        <div className="text-right">
                          <span className="text-[9px] text-slate-500 font-bold uppercase block">Ref.</span>
                          <span className="text-[10px] font-bold font-mono text-slate-300">{item.referencia}</span>
                        </div>
                      )}
                    </div>

                    {/* Botón de descarte */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); rechazarPorAprobar(item.id); }} 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white text-[10px] font-bold rounded transition-all border border-rose-500/30"
                      title="Descartar de la cola"
                    >
                      ✖
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Botón rápido para refrescar */}
          <button 
            onClick={cargarColaPorAprobar} 
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-[#334155] rounded-xl font-bold text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
          >
            🔄 Sincronizar Cola
          </button>
        </div>
      </div>
    </div>

      {/* MODAL NUEVO PROVEEDOR ACTUALIZADO */}
      {modalProvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] w-full max-w-3xl rounded-2xl border border-[#334155] shadow-2xl p-8 animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-[#334155] pb-4 uppercase tracking-tighter">Crear Nuevo Proveedor Rápido</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              
              <div className="md:col-span-3 grid grid-cols-3 gap-4 bg-black/20 p-4 rounded-xl border border-[#334155] mb-2">
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-emerald-400 uppercase">Código Interno</label>
                  <input type="text" className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mt-1 text-emerald-400 font-mono font-bold" value={nuevoProv.codigo} onChange={(e)=>setNuevoProv({...nuevoProv, codigo: e.target.value})} placeholder="Auto-Generado" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">RIF (Dato Fiscal)</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono uppercase placeholder:text-slate-600" value={nuevoProv.rif} onChange={manejarCambioRifNuevoProv} placeholder="Ej: J-12345678-9" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-[#38bdf8] uppercase">Categoría / Tipo</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-[#0f172a] border border-[#38bdf8]/50 rounded-lg p-3 mt-1 text-white font-bold uppercase outline-none focus:border-[#38bdf8] appearance-none" 
                      value={nuevoProv.tipo} 
                      onChange={(e)=>setNuevoProv({...nuevoProv, tipo: e.target.value})}
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
                <input type="text" placeholder="Ej: Hotel Posada del Mar" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold text-lg" value={nuevoProv.nombre_comercial || ''} onChange={(e)=>setNuevoProv({...nuevoProv, nombre_comercial: e.target.value})} />
              </div>
              
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Razón Social (Legal / SENIAT)</label>
                <input type="text" placeholder="Ej: INVERSIONES MAR AZUL C.A." className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold" value={nuevoProv.razon_social} onChange={(e)=>setNuevoProv({...nuevoProv, razon_social: e.target.value})} />
              </div>

              <div className="md:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">País</label>
                <input type="text" placeholder="Ej: VENEZUELA" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase" value={nuevoProv.pais} onChange={(e)=>setNuevoProv({...nuevoProv, pais: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Ciudad (Súper importante para los Hoteles)</label>
                <input type="text" placeholder="Ej: ISLA DE MARGARITA" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase" value={nuevoProv.ciudad} onChange={(e)=>setNuevoProv({...nuevoProv, ciudad: e.target.value})} />
              </div>

              <div className="md:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono" value={nuevoProv.telefono} onChange={(e)=>setNuevoProv({...nuevoProv, telefono: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Correo Electrónico</label>
                <input type="email" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={nuevoProv.correo} onChange={(e)=>setNuevoProv({...nuevoProv, correo: e.target.value})} />
              </div>
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Dirección Física Exacta</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white" value={nuevoProv.direccion} onChange={(e)=>setNuevoProv({...nuevoProv, direccion: e.target.value})} />
              </div>

            </div>
            
            <div className="flex justify-end gap-4 pt-4 border-t border-[#334155]">
              <button onClick={()=>setModalProvOpen(false)} className="text-slate-400 font-bold hover:text-white transition-colors">CANCELAR</button>
              <button onClick={crearProveedor} className="bg-[#10b981] text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-colors uppercase text-xs shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                GUARDAR Y SELECCIONAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CLIENTE (Sin cambios) */}
      {modalClienteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] w-full max-w-xl rounded-2xl border border-[#334155] shadow-2xl p-8 animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-emerald-400 mb-4 uppercase">Rápido: Nuevo Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><input type="text" placeholder="Nombre o Razón Social *" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-white" value={nuevoCliente.nombre_razon} onChange={(e)=>setNuevoCliente({...nuevoCliente, nombre_razon: e.target.value})} /></div>
              <div><input type="text" placeholder="RIF / Cédula *" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-white" value={nuevoCliente.rif_cedula} onChange={(e)=>setNuevoCliente({...nuevoCliente, rif_cedula: e.target.value})} /></div>
              <div><input type="text" placeholder="Teléfono" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 text-white" value={nuevoCliente.telefono} onChange={(e)=>setNuevoCliente({...nuevoCliente, telefono: e.target.value})} /></div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={()=>setModalClienteOpen(false)} className="text-slate-400 font-bold hover:text-white">CANCELAR</button>
              <button onClick={crearCliente} className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-400">GUARDAR</button>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL CRUZAR CON... */}
      {modalCruzarOpen && (() => {
        const labelTipo: Record<string, string> = {
          'cxc': '📥 Cuentas por Cobrar',
          'cxp': '📤 Cuentas por Pagar',
          'socio-cobrar': '🟢 Socio — Por Recibir',
          'socio-pagar': '🔴 Socio — Por Entregar',
        };
        const filtrados = pendientesCruce.filter(item => {
          const nombre = (item.cliente || item.proveedor || item.socio || '').toLowerCase();
          const concepto = (item.concepto || '').toLowerCase();
          const ref = (item.nro_documento || '').toLowerCase();
          return nombre.includes(busquedaCruce.toLowerCase()) || concepto.includes(busquedaCruce.toLowerCase()) || ref.includes(busquedaCruce.toLowerCase());
        });
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-[#334155] shadow-2xl animate-in zoom-in duration-200">
              <div className="flex items-center justify-between p-6 border-b border-[#334155]">
                <div>
                  <h3 className="text-lg font-bold text-purple-400 uppercase tracking-tighter">🔗 Cruzar Movimiento</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-bold">{labelTipo[tipoCruce]}</p>
                </div>
                <button onClick={() => { setModalCruzarOpen(false); setItemsCruceTarget([]); }} className="text-slate-500 hover:text-white text-xl transition-colors">✕</button>
              </div>

              <div className="px-4 pt-4">
                <input
                  type="text"
                  placeholder="Buscar por nombre, concepto o referencia..."
                  className="w-full bg-black/40 border border-[#334155] rounded-lg px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none transition-colors placeholder:text-slate-600"
                  value={busquedaCruce}
                  onChange={e => setBusquedaCruce(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="p-4 max-h-[52vh] overflow-y-auto space-y-2">
                {loadingCruce ? (
                  <p className="text-center text-slate-400 py-8">Cargando pendientes...</p>
                ) : filtrados.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">No hay registros pendientes.</p>
                ) : filtrados.map(item => {
                  const nombre = item.cliente || item.proveedor || item.socio || '—';
                  const ref = item.nro_documento || 'S/R';
                  const fecha = item.fecha_vencimiento || item.fecha_emision || '—';
                  const isSelected = itemsCruceTarget.some(i => i.id === item.id);
                  return (
                    <button key={item.id} onClick={() => {
                      setItemsCruceTarget(prev => 
                        prev.some(i => i.id === item.id) 
                          ? prev.filter(i => i.id !== item.id) 
                          : [...prev, item]
                      )
                    }} className={`w-full text-left bg-black/30 hover:bg-purple-500/10 border ${isSelected ? 'border-purple-500 bg-purple-500/20' : 'border-[#334155] hover:border-purple-500/40'} rounded-xl p-4 transition-all relative`}>
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-[#1e293b]">✓</div>
                      )}
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-white text-sm uppercase">{nombre}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[260px]">{(item.concepto || '—').replace(/^auto-generado:\s*/i, '')}</p>
                          <p className="text-[10px] font-mono text-[#38bdf8] mt-1">{ref} · {fecha}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-black font-mono text-sm text-white">{fmtLiq(parseFloat(item.saldo_pendiente))} <span className="text-[10px] font-normal">{item.moneda}</span></p>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded mt-1 inline-block bg-amber-500/20 text-amber-400">{(item.estatus || 'Pendiente').toUpperCase()}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <div className="p-4 border-t border-[#334155] bg-black/20 flex justify-between items-center rounded-b-2xl">
                <span className="text-xs text-slate-400 font-bold">Seleccionados: <span className="text-white">{itemsCruceTarget.length}</span></span>
                <button 
                  onClick={confirmarCruce} 
                  disabled={itemsCruceTarget.length === 0}
                  className={`px-6 py-2 rounded-lg font-black uppercase text-xs shadow-lg transition-colors ${itemsCruceTarget.length > 0 ? 'bg-purple-500 text-white hover:bg-purple-400' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                >
                  🔗 Confirmar Cruce
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EL RECIBO DE IMPRESIÓN */}
      {ticketImpresion && (
        <div id="seccion-recibo-imprimir" className="hidden print:block font-sans">
          <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-5">
            <div>
              <h1 className="text-xl print:text-base font-black italic m-0 p-0 text-black">PRINCESS TRAVEL</h1>
              <p className="text-[8px] font-bold tracking-[0.2em] uppercase m-0 p-0 text-black">Management & Tourism</p>
            </div>
            <div className="text-right">
              <h2 className="text-lg print:text-sm font-black uppercase border border-black px-3 py-1 rounded inline-block m-0 text-black">{ticketImpresion.tipo}</h2>
              <p className="text-base print:text-xs font-mono mt-1 text-black">Nº {ticketImpresion.nro_recibo}</p>
            </div>
          </div>
          <div className="space-y-4 text-sm print:text-xs mb-8">
            <div className="grid grid-cols-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-black m-0"><span className="text-[9px] font-bold text-gray-500 block uppercase mb-0.5">Fecha</span> {ticketImpresion.fecha}</p>
              <p className="text-right text-black m-0"><span className="text-[9px] font-bold text-gray-500 block uppercase mb-0.5">Cuenta/Caja</span> {ticketImpresion.nombre_caja}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5 m-0">Beneficiario / Pagador</p>
              <p className="text-xl print:text-sm font-black uppercase border-b border-gray-200 pb-1 m-0 text-black">{ticketImpresion.persona}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5 m-0">Monto Total</p>
              <p className="text-3xl print:text-2xl font-black text-black m-0">
                {ticketImpresion.monto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {ticketImpresion.moneda}
              </p>
              <p className="text-[10px] text-gray-600 mt-1 font-mono italic bg-gray-50 px-2 py-1 inline-block rounded m-0">
                Equivalente: {ticketImpresion.valor_calculado} (Tasa: {ticketImpresion.tasa})
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-1 m-0">Concepto / Descripción</p>
              <p className="text-base print:text-xs font-medium leading-relaxed text-black m-0">{ticketImpresion.descripcion || 'Sin descripción detallada.'}</p>
              <p className="text-[10px] text-gray-500 mt-2 m-0">Ref: {ticketImpresion.referencia}</p>
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