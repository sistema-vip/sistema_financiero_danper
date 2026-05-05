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
  const [movOriginal, setMovOriginal] = useState<any>(null);
  const [clasificacionesBD, setClasificacionesBD] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Totales de la caja seleccionada
  const [saldoCaja, setSaldoCaja] = useState<{ saldoInicial: number; totalIngresos: number; totalEgresos: number; saldoFinal: number } | null>(null);

  // Modal liquidar compensación socio desde caja
  const [modalLiquidarSocioOpen, setModalLiquidarSocioOpen] = useState(false);
  const [cuentaSocioTarget, setCuentaSocioTarget] = useState<any>(null);
  const [abonoSocio, setAbonoSocio] = useState('');
  const [refLiquidacionSocio, setRefLiquidacionSocio] = useState('');

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
      const [resCajas, resMov, resClasif] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/cajas?select=*&order=nombre.asc`, { headers: SUPABASE_HEADERS }),
        fetch(`${SUPABASE_URL}/rest/v1/movimientos?select=*&order=fecha.asc,id.asc`, { headers: SUPABASE_HEADERS }),
        fetch(`${SUPABASE_URL}/rest/v1/clasificaciones?select=*&order=nombre.asc`, { headers: SUPABASE_HEADERS }),
      ]);
      const dataCajas = resCajas.ok ? await resCajas.json() : [];
      const dataMov = resMov.ok ? await resMov.json() : [];
      const dataClasif = resClasif.ok ? await resClasif.json() : [];
      setCajas(dataCajas);
      setMovimientos(dataMov);
      setClasificacionesBD(dataClasif);
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
    setMovOriginal({ ...mov }); // snapshot para detectar cambios de clasificacion/monto
    setModalEditarOpen(true);
  };

  // ============================================================
  // HELPERS DE PROPAGACION (mismo criterio que administracion-finanzas/page.tsx:185-260)
  // ============================================================

  const recalcularEstatusFacturacion = (clasifNorm: string, tipo: string): string => {
    if (tipo === 'Transferencia Interna') return 'No Aplica';
    if (clasifNorm.includes('TRASLADO') || clasifNorm.includes('TRF INTERNA')) return 'No Aplica';
    if (clasifNorm.includes('BOLETO') || clasifNorm.includes('HOSPEDAJE') ||
        clasifNorm.includes('SERVICIO') || clasifNorm.includes('PAQUETE') ||
        clasifNorm.includes('SEGURO')) return 'Pendiente';
    return 'No Aplica';
  };

  const recalcularEstadoConciliacion = (clasifNorm: string, tipo: string): string => {
    if (clasifNorm === 'COBRANZA' && tipo === 'Recibo de Ingreso') return 'Pendiente';
    return 'No Aplica';
  };

  // Identifica que tabla auto-creada corresponde a una clasificacion + tipo
  // Devuelve null si no aplica (clasificacion no auto-genera registro)
  const detectarAutoCreado = (clasifNorm: string, tipo: string): { tabla: string; payloadExtra: any } | null => {
    if (clasifNorm.includes('PRESTAMO') || clasifNorm.includes('PRÉSTAMO')) {
      if (tipo === 'Recibo de Ingreso') {
        return { tabla: 'cuentas_por_pagar', payloadExtra: { categoria: 'Préstamos Recibidos', personaCampo: 'proveedor', conceptoBase: 'Préstamo recibido' } };
      }
      if (tipo === 'Recibo de Egreso') {
        return { tabla: 'cuentas_por_cobrar', payloadExtra: { categoria: 'Préstamos Otorgados', personaCampo: 'cliente', conceptoBase: 'Préstamo otorgado' } };
      }
    }
    if (clasifNorm.includes('MOVIMIENTO SOCIO') || clasifNorm.includes('PROVISION') || clasifNorm.includes('PROVISIÓN')) {
      const tipoCompensacion = tipo === 'Recibo de Egreso' ? 'Por Cobrar' : 'Por Pagar';
      return { tabla: 'cuentas_socios', payloadExtra: { tipoCompensacion } };
    }
    return null;
  };

  const esSocio = (mov: any) => detectarAutoCreado((mov.clasificacion || '').toUpperCase(), mov.tipo)?.tabla === 'cuentas_socios';

  const abrirLiquidarSocio = async (mov: any) => {
    const nroDoc = mov.referencia || `REC-${mov.nro_recibo}`;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_socios?nro_documento=eq.${encodeURIComponent(nroDoc)}&limit=1`, { headers: SUPABASE_HEADERS });
      const data = res.ok ? await res.json() : [];
      if (!data.length) return alert('⚠️ No se encontró el registro de compensación asociado.');
      const cuenta = data[0];
      if (cuenta.estatus === 'Compensado') return alert('✅ Este movimiento ya fue liquidado en compensación.');
      setCuentaSocioTarget(cuenta);
      setAbonoSocio(fmt(parseFloat(cuenta.saldo_pendiente)));
      setRefLiquidacionSocio('');
      setModalLiquidarSocioOpen(true);
    } catch (e) { alert('❌ Error de conexión.'); }
  };

  const procesarLiquidacionSocio = async () => {
    const montoAbono = parseFloat(abonoSocio.replace(/\./g, '').replace(',', '.')) || 0;
    if (montoAbono <= 0 || montoAbono > parseFloat(cuentaSocioTarget.saldo_pendiente)) return alert('⚠️ Monto inválido o mayor al saldo pendiente.');
    const nuevoSaldo = parseFloat(cuentaSocioTarget.saldo_pendiente) - montoAbono;
    const nuevoEstatus = nuevoSaldo === 0 ? 'Compensado' : 'Parcial';
    let docActualizado = cuentaSocioTarget.nro_documento;
    if (refLiquidacionSocio.trim() !== '') {
      const r = refLiquidacionSocio.trim().toUpperCase();
      docActualizado = (!docActualizado || docActualizado === 'S/R' || docActualizado === 'S/N') ? `LIQ: ${r}` : `${docActualizado} | LIQ: ${r}`;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cuentas_socios?id=eq.${cuentaSocioTarget.id}`, {
        method: 'PATCH', headers: SUPABASE_HEADERS,
        body: JSON.stringify({ saldo_pendiente: nuevoSaldo, estatus: nuevoEstatus, nro_documento: docActualizado })
      });
      if (res.ok) {
        alert('✅ Compensación liquidada exitosamente.');
        setModalLiquidarSocioOpen(false);
        setAbonoSocio(''); setRefLiquidacionSocio(''); setCuentaSocioTarget(null);
      } else alert('❌ Error al liquidar.');
    } catch (e) { alert('❌ Error de conexión.'); }
  };

  // Sincroniza CxC/CxP/Socios cuando cambia clasificacion/monto/persona/tipo de un movimiento.
  // Retorna true si todo OK, false si el usuario aborto por warning de abonos parciales.
  const sincronizarAutoCreados = async (original: any, nuevo: any, montoNuevo: number, tasaNueva: number): Promise<boolean> => {
    const clasifVieja = (original.clasificacion || '').toUpperCase();
    const clasifNueva = (nuevo.clasificacion || '').toUpperCase();
    const tipoViejo = original.tipo;
    const tipoNuevo = nuevo.tipo;

    const autoViejo = detectarAutoCreado(clasifVieja, tipoViejo);
    const autoNuevo = detectarAutoCreado(clasifNueva, tipoNuevo);

    const nroDocOriginal = original.referencia || `REC-${original.nro_recibo}`;
    const nroDocNuevo = nuevo.referencia || `REC-${nuevo.nro_recibo}`;

    // Caso 1: viejo y nuevo apuntan a la MISMA tabla → PATCH si esta sin abonos
    if (autoViejo && autoNuevo && autoViejo.tabla === autoNuevo.tabla) {
      try {
        const resGet = await fetch(
          `${SUPABASE_URL}/rest/v1/${autoViejo.tabla}?nro_documento=eq.${encodeURIComponent(nroDocOriginal)}`,
          { headers: SUPABASE_HEADERS }
        );
        const registros = resGet.ok ? await resGet.json() : [];
        if (registros.length > 0) {
          const reg = registros[0];
          const sinAbonos = parseFloat(reg.saldo_pendiente) === parseFloat(reg.monto_total);
          if (!sinAbonos) {
            const ok = window.confirm(
              `⚠️ Este movimiento generó un registro en ${autoViejo.tabla.replace('_', ' ')} con abonos parciales.\n` +
              `No se actualizará automáticamente. Edítalo desde su módulo.\n\n¿Continuar guardando solo el movimiento?`
            );
            return ok;
          }
          // PATCH: actualizar persona, monto, fecha, referencia
          const personaCampo = autoViejo.tabla === 'cuentas_por_pagar' ? 'proveedor'
                            : autoViejo.tabla === 'cuentas_por_cobrar' ? 'cliente'
                            : 'socio';
          const patchPayload: any = {
            [personaCampo]: nuevo.persona?.toUpperCase(),
            nro_documento: nroDocNuevo,
            monto_total: montoNuevo,
            saldo_pendiente: montoNuevo,
            moneda: nuevo.moneda,
            fecha_emision: nuevo.fecha,
          };
          if (autoViejo.tabla !== 'cuentas_socios') patchPayload.fecha_vencimiento = nuevo.fecha;
          if (autoViejo.tabla === 'cuentas_socios') {
            patchPayload.tasa = tasaNueva;
            patchPayload.equivalente = nuevo.moneda === 'Bs' ? (montoNuevo / tasaNueva) : (montoNuevo * tasaNueva);
            patchPayload.moneda_equivalente = nuevo.moneda === 'Bs' ? 'USD' : 'Bs';
            patchPayload.tipo = tipoNuevo === 'Recibo de Egreso' ? 'Por Cobrar' : 'Por Pagar';
            patchPayload.caja_banco = cajas.find((c: any) => c.id.toString() === nuevo.caja_id?.toString())?.nombre || 'S/E';
          }
          await fetch(`${SUPABASE_URL}/rest/v1/${autoViejo.tabla}?id=eq.${reg.id}`, {
            method: 'PATCH', headers: SUPABASE_HEADERS, body: JSON.stringify(patchPayload),
          });
        }
      } catch (e) {
        console.error('Error sync auto-creado (PATCH):', e);
      }
      return true;
    }

    // Caso 2: viejo apunta a una tabla, nuevo a OTRA o a NINGUNA → eliminar viejo
    if (autoViejo) {
      try {
        const resGet = await fetch(
          `${SUPABASE_URL}/rest/v1/${autoViejo.tabla}?nro_documento=eq.${encodeURIComponent(nroDocOriginal)}`,
          { headers: SUPABASE_HEADERS }
        );
        const registros = resGet.ok ? await resGet.json() : [];
        if (registros.length > 0) {
          const reg = registros[0];
          const sinAbonos = parseFloat(reg.saldo_pendiente) === parseFloat(reg.monto_total);
          if (!sinAbonos) {
            const ok = window.confirm(
              `⚠️ Este movimiento generó un registro en ${autoViejo.tabla.replace('_', ' ')} con abonos parciales.\n` +
              `No se eliminará automáticamente. Edítalo manualmente desde su módulo.\n\n¿Continuar con la edición del movimiento?`
            );
            if (!ok) return false;
          } else {
            await fetch(`${SUPABASE_URL}/rest/v1/${autoViejo.tabla}?id=eq.${reg.id}`, {
              method: 'DELETE', headers: SUPABASE_HEADERS,
            });
          }
        }
      } catch (e) {
        console.error('Error sync auto-creado (DELETE viejo):', e);
      }
    }

    // Caso 3: nuevo apunta a una tabla y el viejo NO (o a otra) → crear nuevo
    if (autoNuevo) {
      try {
        const equivalente = nuevo.moneda === 'Bs' ? (montoNuevo / tasaNueva) : (montoNuevo * tasaNueva);
        const monedaEquivalente = nuevo.moneda === 'Bs' ? 'USD' : 'Bs';
        let payload: any = {};
        if (autoNuevo.tabla === 'cuentas_por_pagar') {
          payload = {
            categoria: autoNuevo.payloadExtra.categoria,
            proveedor: nuevo.persona?.toUpperCase(),
            nro_documento: nroDocNuevo,
            concepto: `Auto-Generado: ${nuevo.descripcion || autoNuevo.payloadExtra.conceptoBase}`,
            monto_total: montoNuevo, saldo_pendiente: montoNuevo,
            moneda: nuevo.moneda, fecha_emision: nuevo.fecha, fecha_vencimiento: nuevo.fecha, estatus: 'Pendiente',
          };
        } else if (autoNuevo.tabla === 'cuentas_por_cobrar') {
          payload = {
            categoria: autoNuevo.payloadExtra.categoria,
            cliente: nuevo.persona?.toUpperCase(),
            nro_documento: nroDocNuevo,
            concepto: `Auto-Generado: ${nuevo.descripcion || autoNuevo.payloadExtra.conceptoBase}`,
            monto_total: montoNuevo, saldo_pendiente: montoNuevo,
            moneda: nuevo.moneda, fecha_emision: nuevo.fecha, fecha_vencimiento: nuevo.fecha, estatus: 'Pendiente',
          };
        } else if (autoNuevo.tabla === 'cuentas_socios') {
          const cajaNombre = cajas.find((c: any) => c.id.toString() === nuevo.caja_id?.toString())?.nombre || 'S/E';
          payload = {
            socio: nuevo.persona?.toUpperCase(),
            tipo: autoNuevo.payloadExtra.tipoCompensacion,
            nro_documento: nroDocNuevo,
            concepto: `Auto-Generado: Cambio/Traspaso - ${nuevo.descripcion || 'Mover fondos'}`,
            monto_total: montoNuevo, saldo_pendiente: montoNuevo,
            moneda: nuevo.moneda, tasa: tasaNueva, equivalente, moneda_equivalente: monedaEquivalente,
            fecha_emision: nuevo.fecha, estatus: 'Pendiente',
            caja_banco: cajaNombre,
          };
        }
        await fetch(`${SUPABASE_URL}/rest/v1/${autoNuevo.tabla}`, {
          method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error('Error sync auto-creado (POST nuevo):', e);
      }
    }

    return true;
  };

  const guardarEdicion = async () => {
    if (!movEditable || !movOriginal) return;
    setIsSaving(true);
    try {
      const montoLimpio = parseFloat(movEditable.monto.toString().replace(/\./g, '').replace(',', '.')) || 0;
      const tasaLimpia = parseFloat((movEditable.tasa ?? '1').toString().replace(/\./g, '').replace(',', '.')) || 1;
      const clasifNorm = (movEditable.clasificacion || '').toUpperCase();
      const tipo = movEditable.tipo;

      // 1. Recalcular estatus en base a clasificacion + tipo nuevos
      let nuevoEstatusFact = recalcularEstatusFacturacion(clasifNorm, tipo);
      const nuevaConcil = recalcularEstadoConciliacion(clasifNorm, tipo);

      // 2. Preservar avance de facturacion (no degradar Facturado/Presupuestado a Pendiente)
      if (nuevoEstatusFact === 'Pendiente' &&
          ['Presupuestado', 'Facturado'].includes(movEditable.estatus_facturacion)) {
        nuevoEstatusFact = movEditable.estatus_facturacion;
      }

      // 3. Confirmar perdida de presupuesto/factura si degrada a No Aplica
      let limpiarPresupFact = false;
      if (nuevoEstatusFact === 'No Aplica' &&
          ['Presupuestado', 'Facturado'].includes(movEditable.estatus_facturacion) &&
          (movEditable.nro_presupuesto || movEditable.nro_factura)) {
        const ok = window.confirm(
          `⚠️ Este movimiento tiene Nº Presupuesto "${movEditable.nro_presupuesto || '—'}" ` +
          `y Nº Factura "${movEditable.nro_factura || '—'}".\n\n` +
          `Al cambiar la clasificación a "${movEditable.clasificacion}" se borrarán esos números ` +
          `y el movimiento saldrá del módulo Pendiente por Facturar.\n\n¿Confirmas?`
        );
        if (!ok) { setIsSaving(false); return; }
        limpiarPresupFact = true;
      }

      // 4. Sincronizar CxC / CxP / Socios
      const okSync = await sincronizarAutoCreados(movOriginal, movEditable, montoLimpio, tasaLimpia);
      if (!okSync) { setIsSaving(false); return; }

      // 5. PATCH del movimiento
      const payload: any = {
        fecha: movEditable.fecha,
        tipo: movEditable.tipo,
        caja_id: movEditable.caja_id,
        moneda: movEditable.moneda,
        tasa: tasaLimpia,
        persona: movEditable.persona?.toUpperCase(),
        descripcion: movEditable.descripcion,
        referencia: movEditable.referencia,
        clasificacion: movEditable.clasificacion,
        monto: montoLimpio,
        estatus_facturacion: nuevoEstatusFact,
        estado_conciliacion: nuevaConcil,
      };
      if (limpiarPresupFact) {
        payload.nro_presupuesto = null;
        payload.nro_factura = null;
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?id=eq.${movEditable.id}`, {
        method: 'PATCH',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert('✅ Movimiento actualizado y sincronizado.');
        setModalEditarOpen(false);
        cargarDatos();
      } else {
        const err = await res.text();
        console.error('PATCH movimiento falló:', err);
        alert('❌ Error al guardar.');
      }
    } catch (e) {
      console.error(e);
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
            @page { size: portrait; margin: 15mm 12mm; }
            #estado-cuenta-print, #estado-cuenta-print * { visibility: visible !important; }
            #estado-cuenta-print {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              color: #000 !important;
              box-sizing: border-box !important;
            }
            #estado-cuenta-print .no-salto { page-break-inside: avoid !important; break-inside: avoid !important; }
            #estado-cuenta-print .pie-pagina { page-break-inside: avoid !important; break-inside: avoid !important; }
            #estado-cuenta-print table { border-collapse: collapse !important; width: 100% !important; }
            #estado-cuenta-print thead { display: table-header-group !important; }
            #estado-cuenta-print tfoot { display: table-footer-group !important; }
            #estado-cuenta-print tr { page-break-inside: avoid !important; break-inside: avoid !important; }
            #estado-cuenta-print th {
              border: 1px solid #1e3a5f !important;
              padding: 4px 6px !important;
              font-size: 7px !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              background-color: #1e3a5f !important;
              color: white !important;
              font-weight: bold !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #estado-cuenta-print td {
              border: 1px solid #cbd5e1 !important;
              padding: 4px 6px !important;
              font-size: 7.5px !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
            }
            #estado-cuenta-print .fila-par { background-color: #f5f7fa !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            #estado-cuenta-print .fila-total { background-color: #e8f0fe !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: bold !important; }
            #estado-cuenta-print .badge-ingreso { color: #166534 !important; font-weight: bold !important; }
            #estado-cuenta-print .badge-egreso  { color: #991b1b !important; font-weight: bold !important; }
            #estado-cuenta-print .saldo-positivo { color: #166534 !important; font-weight: 900 !important; }
            #estado-cuenta-print .saldo-negativo { color: #991b1b !important; font-weight: 900 !important; }
            #estado-cuenta-print .cabecera-doc { page-break-after: avoid !important; break-after: avoid !important; }
            #estado-cuenta-print .resumen-saldos { page-break-after: avoid !important; break-after: avoid !important; }
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
                            {esSocio(mov) && (
                              <button onClick={() => abrirLiquidarSocio(mov)} className="text-slate-400 hover:text-purple-400 transition-colors text-base" title="Liquidar en Compensación Socios">🔄</button>
                            )}
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

      {/* ═══════════════════════════════════════════════════════════════
          ESTADO DE CUENTA — PLANTILLA DE IMPRESIÓN PROFESIONAL
          Visible SOLO al imprimir (hidden en pantalla).
          Está fuera del wrapper print:hidden para no quedar bloqueado.
      ═══════════════════════════════════════════════════════════════ */}
      {modoImpresion === 'tabla' && (
        <div id="estado-cuenta-print" style={{ display: 'none' }}>

          {/* ── CABECERA + DATOS + RESUMEN: agrupados para no cortarse ── */}
          <div className="no-salto cabecera-doc">

            {/* Cabecera institucional */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5px', border: 'none' }}>
              <tbody>
                <tr>
                  <td style={{ border: 'none', padding: '0', verticalAlign: 'bottom', width: '50%' }}>
                    <div style={{ fontSize: '18px', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.5px', color: '#1e3a5f' }}>PRINCESS TRAVEL</div>
                    <div style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#64748b', marginTop: '1px' }}>Management &amp; Tourism</div>
                  </td>
                  <td style={{ border: 'none', padding: '0', textAlign: 'right', verticalAlign: 'bottom', width: '50%' }}>
                    <div style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#1e3a5f' }}>Estado de Cuenta</div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569', marginTop: '2px' }}>{cajaActual?.nombre || '---'} &nbsp;|&nbsp; {cajaActual?.moneda || ''}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Línea azul */}
            <div style={{ height: '3px', background: 'linear-gradient(to right, #1e3a5f, #3b82f6)', marginBottom: '5px', borderRadius: '2px' }} />

            {/* Datos de la cuenta / período */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '7px', fontSize: '8px' }}>
              <tbody>
                <tr style={{ background: '#f1f5f9' }}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', fontSize: '7px' }}>Cuenta / Banco</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, color: '#1e293b' }}>{cajaActual?.nombre || '---'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', fontSize: '7px' }}>Moneda</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, color: '#1e293b' }}>{cajaActual?.moneda || '---'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', fontSize: '7px' }}>Período</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, color: '#1e293b' }}>{filtroDesde || '---'} al {filtroHasta || '---'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', fontSize: '7px' }}>Generado</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, color: '#1e293b' }}>{new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                </tr>
              </tbody>
            </table>

            {/* Resumen de saldos */}
            {saldoCaja && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '9px', border: '2px solid #1e3a5f' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '25%', border: '1px solid #1e3a5f', padding: '6px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '1px', marginBottom: '3px' }}>Saldo Inicial</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'monospace', color: '#1e293b' }}>{fmt(saldoCaja.saldoInicial)}</div>
                    </td>
                    <td style={{ width: '25%', border: '1px solid #1e3a5f', padding: '6px 10px', textAlign: 'center', background: '#f0fdf4' }}>
                      <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#166534', letterSpacing: '1px', marginBottom: '3px' }}>▲ Total Ingresos</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'monospace', color: '#166534' }}>+ {fmt(saldoCaja.totalIngresos)}</div>
                    </td>
                    <td style={{ width: '25%', border: '1px solid #1e3a5f', padding: '6px 10px', textAlign: 'center', background: '#fff1f2' }}>
                      <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#991b1b', letterSpacing: '1px', marginBottom: '3px' }}>▼ Total Egresos</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'monospace', color: '#991b1b' }}>- {fmt(saldoCaja.totalEgresos)}</div>
                    </td>
                    <td style={{ width: '25%', border: '2px solid #1e3a5f', padding: '6px 10px', textAlign: 'center', background: '#1e3a5f' }}>
                      <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#93c5fd', letterSpacing: '1px', marginBottom: '3px' }}>Saldo Final</div>
                      <div style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'monospace', color: saldoCaja.saldoFinal >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                        {fmt(saldoCaja.saldoFinal)} <span style={{ fontSize: '8px', fontWeight: 400, color: '#93c5fd' }}>{cajaActual?.moneda}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* ── TABLA DE MOVIMIENTOS (se pagina sola) ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5px', tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: '18mm' }}>Fecha</th>
                <th style={{ textAlign: 'left', width: '22%' }}>Beneficiario / Pagador</th>
                <th style={{ textAlign: 'left', width: '25%' }}>Concepto</th>
                <th style={{ textAlign: 'left', minWidth: '16mm' }}>Referencia</th>
                <th style={{ textAlign: 'center', minWidth: '14mm' }}>Categoría</th>
                <th style={{ textAlign: 'right', minWidth: '24mm' }}>Monto</th>
                <th style={{ textAlign: 'right', minWidth: '22mm' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.map((mov: any, idx: number) => {
                const esIngreso = mov.tipo === 'Recibo de Ingreso';
                const monto = parseFloat(mov.monto || 0);
                return (
                  <tr key={mov.id} className={idx % 2 === 1 ? 'fila-par' : ''} style={{ background: idx % 2 === 1 ? '#f5f7fa' : '#ffffff' }}>
                    {/* Fecha — nowrap, tamaño fijo */}
                    <td style={{ fontFamily: 'monospace', color: '#374151', whiteSpace: 'nowrap' }}>{mov.fecha}</td>
                    {/* Beneficiario — texto largo, permite wrap */}
                    <td style={{ fontWeight: 700, textTransform: 'uppercase', color: '#111827' }}>{mov.persona}</td>
                    {/* Concepto — texto largo, permite wrap */}
                    <td style={{ color: '#374151' }}>{mov.descripcion || '---'}</td>
                    {/* Referencia — nowrap */}
                    <td style={{ fontFamily: 'monospace', color: '#374151', whiteSpace: 'nowrap' }}>{mov.referencia || '---'}</td>
                    {/* Categoría — texto corto, permite wrap */}
                    <td style={{ textAlign: 'center', color: '#6b7280', textTransform: 'uppercase', fontSize: '7px' }}>{mov.clasificacion || '---'}</td>
                    {/* Monto — nowrap, número con signo */}
                    <td className={esIngreso ? 'badge-ingreso' : 'badge-egreso'} style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap', color: esIngreso ? '#166534' : '#991b1b' }}>
                      {esIngreso ? `+ ${fmt(monto)}` : `- ${fmt(monto)}`}
                    </td>
                    {/* Saldo — nowrap */}
                    <td className={mov.saldo_fila >= 0 ? 'saldo-positivo' : 'saldo-negativo'} style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, background: '#f8fafc', whiteSpace: 'nowrap', color: mov.saldo_fila >= 0 ? '#166534' : '#991b1b' }}>
                      {fmt(mov.saldo_fila)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* tfoot: aparece solo al final de la tabla, en la última página */}
            {saldoCaja && (
              <tfoot>
                <tr className="fila-total" style={{ background: '#e8f0fe' }}>
                  <td colSpan={5} style={{ border: '1px solid #94a3b8', padding: '5px 8px', fontWeight: 700, textTransform: 'uppercase', fontSize: '7.5px', color: '#1e3a5f' }}>
                    TOTAL DEL PERÍODO — {movimientosFiltrados.length} movimiento(s)
                  </td>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: '7px', lineHeight: 1.6 }}>
                    <span style={{ color: '#166534', display: 'block' }}>+{fmt(saldoCaja.totalIngresos)}</span>
                    <span style={{ color: '#991b1b', display: 'block' }}>-{fmt(saldoCaja.totalEgresos)}</span>
                  </td>
                  <td style={{ border: '2px solid #1e3a5f', padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, background: '#1e3a5f', color: saldoCaja.saldoFinal >= 0 ? '#6ee7b7' : '#fca5a5', whiteSpace: 'nowrap' }}>
                    {fmt(saldoCaja.saldoFinal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* ── PIE DE PÁGINA (última página, no se corta) ── */}
          <div className="pie-pagina" style={{ marginTop: '24px', borderTop: '1px solid #cbd5e1', paddingTop: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
              <tbody>
                <tr>
                  <td style={{ border: 'none', width: '40%', textAlign: 'center', paddingTop: '28px', paddingBottom: '2px' }}>
                    <div style={{ borderTop: '1.5px solid #374151', paddingTop: '4px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>Firma Tesorería</div>
                  </td>
                  <td style={{ border: 'none', width: '20%', textAlign: 'center', verticalAlign: 'bottom' }}>
                    <div style={{ fontSize: '6.5px', color: '#9ca3af', lineHeight: 1.5 }}>
                      <div>Documento generado por el sistema</div>
                      <div>{new Date().toLocaleString('es-PE')}</div>
                    </div>
                  </td>
                  <td style={{ border: 'none', width: '40%', textAlign: 'center', paddingTop: '28px', paddingBottom: '2px' }}>
                    <div style={{ borderTop: '1.5px solid #374151', paddingTop: '4px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>Firma Contabilidad</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* MODAL DE EDICIÓN */}
      {modalEditarOpen && movEditable && (() => {
        const esTransferencia = movEditable.tipo === 'Transferencia Interna' || (movEditable.clasificacion || '').toUpperCase() === 'TRF INTERNA';
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-[#1e293b] w-full max-w-3xl rounded-2xl border border-[#334155] shadow-2xl p-6 animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4 uppercase border-b border-[#334155] pb-3">✏️ Editar Movimiento</h3>

            {esTransferencia && (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 mb-4 text-amber-300 text-xs">
                ⚠️ <strong>Transferencia Interna:</strong> esta es una de las dos patas (egreso + ingreso) creadas en pareja.
                Editar tipo, caja, moneda, monto o tasa descuadra los saldos. Solo se permiten cambios menores (fecha, descripción, referencia).
              </div>
            )}

            <div className="space-y-4 mb-6">
              {/* Fila 1: Fecha · Tipo · Caja */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha</label>
                  <input type="date" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white [color-scheme:dark] outline-none focus:border-[#38bdf8]" value={movEditable.fecha} onChange={(e) => setMovEditable({ ...movEditable, fecha: e.target.value })} onClick={(e: any) => e.target.showPicker()} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
                  <select disabled={esTransferencia} className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white outline-none focus:border-[#38bdf8] disabled:opacity-50" value={movEditable.tipo || ''} onChange={(e) => setMovEditable({ ...movEditable, tipo: e.target.value })}>
                    <option value="Recibo de Ingreso" className="bg-[#0f172a]">Recibo de Ingreso</option>
                    <option value="Recibo de Egreso" className="bg-[#0f172a]">Recibo de Egreso</option>
                    {esTransferencia && <option value="Transferencia Interna" className="bg-[#0f172a]">Transferencia Interna</option>}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Caja / Banco</label>
                  <select disabled={esTransferencia} className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white outline-none focus:border-[#38bdf8] disabled:opacity-50" value={movEditable.caja_id || ''} onChange={(e) => setMovEditable({ ...movEditable, caja_id: e.target.value })}>
                    {cajas.map(c => <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.nombre} ({c.moneda})</option>)}
                  </select>
                </div>
              </div>

              {/* Fila 2: Persona · Referencia */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Beneficiario / Pagador</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase font-bold outline-none focus:border-[#38bdf8]" value={movEditable.persona || ''} onChange={(e) => setMovEditable({ ...movEditable, persona: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Referencia</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono uppercase outline-none focus:border-[#38bdf8]" value={movEditable.referencia || ''} onChange={(e) => setMovEditable({ ...movEditable, referencia: e.target.value })} />
                </div>
              </div>

              {/* Fila 3: Clasificación · Moneda · Tasa */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Clasificación</label>
                  <select disabled={esTransferencia} className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white uppercase outline-none focus:border-[#38bdf8] disabled:opacity-50" value={movEditable.clasificacion || ''} onChange={(e) => setMovEditable({ ...movEditable, clasificacion: e.target.value })}>
                    <option value="" className="bg-[#0f172a]">-- Seleccione --</option>
                    {clasificacionesBD.map(cl => <option key={cl.id} value={cl.nombre} className="bg-[#0f172a]">{cl.nombre}</option>)}
                    {/* Asegurar que la clasificacion actual aparezca aunque no esté en BD */}
                    {movEditable.clasificacion && !clasificacionesBD.some(c => c.nombre === movEditable.clasificacion) && (
                      <option value={movEditable.clasificacion} className="bg-[#0f172a]">{movEditable.clasificacion}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Moneda</label>
                  <select disabled={esTransferencia} className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white outline-none focus:border-[#38bdf8] disabled:opacity-50" value={movEditable.moneda || 'Bs'} onChange={(e) => setMovEditable({ ...movEditable, moneda: e.target.value })}>
                    <option value="Bs" className="bg-[#0f172a]">Bs</option>
                    <option value="USD" className="bg-[#0f172a]">USD</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tasa</label>
                  <input type="text" disabled={esTransferencia} className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white font-mono outline-none focus:border-[#38bdf8] disabled:opacity-50" value={movEditable.tasa ?? ''} onChange={(e) => setMovEditable({ ...movEditable, tasa: e.target.value })} />
                </div>
              </div>

              {/* Fila 4: Monto · Descripción */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[#38bdf8] uppercase">Monto ({movEditable.moneda})</label>
                  <input type="text" disabled={esTransferencia} className="w-full bg-black/40 border border-[#38bdf8]/50 rounded-lg p-3 mt-1 text-white font-mono outline-none focus:border-[#38bdf8] disabled:opacity-50" value={movEditable.monto} onChange={(e) => setMovEditable({ ...movEditable, monto: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Concepto / Descripción</label>
                  <input type="text" className="w-full bg-black/40 border border-[#334155] rounded-lg p-3 mt-1 text-white outline-none focus:border-[#38bdf8]" value={movEditable.descripcion || ''} onChange={(e) => setMovEditable({ ...movEditable, descripcion: e.target.value })} />
                </div>
              </div>

              {/* Info de estado actual de facturación / conciliación */}
              {(movEditable.estatus_facturacion && movEditable.estatus_facturacion !== 'No Aplica') && (
                <div className="bg-black/30 border border-[#334155] rounded-lg p-3 text-[11px] text-slate-300">
                  <strong className="text-[#38bdf8]">Estado actual:</strong> facturación = <span className="font-mono text-white">{movEditable.estatus_facturacion}</span>
                  {movEditable.nro_presupuesto && <> · presup: <span className="font-mono text-white">{movEditable.nro_presupuesto}</span></>}
                  {movEditable.nro_factura && <> · factura: <span className="font-mono text-white">{movEditable.nro_factura}</span></>}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#334155]">
              <button onClick={() => setModalEditarOpen(false)} disabled={isSaving} className="px-4 py-2 text-slate-400 font-bold hover:text-white transition-colors text-xs">CANCELAR</button>
              <button onClick={guardarEdicion} disabled={isSaving} className={`px-6 py-2 rounded-lg font-bold text-white uppercase text-xs transition-colors ${isSaving ? 'bg-slate-600' : 'bg-[#38bdf8] hover:bg-sky-400'}`}>
                {isSaving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* MODAL LIQUIDAR COMPENSACIÓN SOCIO */}
      {modalLiquidarSocioOpen && cuentaSocioTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-[#334155] shadow-2xl p-8 animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-purple-400 mb-2 uppercase tracking-tighter">Liquidar Operación</h3>
            <p className="text-xs text-slate-400 mb-6">Confirmar liquidación con <span className="text-white font-bold">{cuentaSocioTarget.socio}</span></p>
            <div className="mb-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-purple-400 uppercase">Monto Base a Liquidar ({cuentaSocioTarget.moneda})</label>
                <input type="text" className="w-full bg-black/40 border border-purple-500/30 focus:border-purple-500 rounded-lg p-4 mt-1 text-white font-mono text-xl text-center outline-none transition-colors" value={abonoSocio} onChange={(e) => setAbonoSocio(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-300 uppercase">Referencia de Pago (Opcional)</label>
                <input type="text" className="w-full bg-black/40 border border-[#334155] focus:border-purple-500 rounded-lg p-3 mt-1 text-white font-mono text-sm text-center outline-none uppercase placeholder:text-slate-600 transition-colors" placeholder="EJ: ZELLE-9988" value={refLiquidacionSocio} onChange={(e) => setRefLiquidacionSocio(e.target.value)} />
              </div>
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">Esto indica que la contraparte de divisas ha sido entregada o recibida satisfactoriamente.</p>
            </div>
            <div className="flex justify-end gap-4 border-t border-[#334155] pt-4">
              <button onClick={() => setModalLiquidarSocioOpen(false)} className="text-slate-400 font-bold hover:text-white transition-colors">CANCELAR</button>
              <button onClick={procesarLiquidacionSocio} className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-black uppercase text-xs hover:bg-emerald-400 shadow-lg">✔ CONFIRMAR</button>
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
