-- ============================================================
-- SISTEMA FINANCIERO DANPER / PRINCESS TRAVEL
-- Script SQL completo para crear todas las tablas en Supabase
-- Generado: 2026-03-28
-- 
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Haz clic en "SQL Editor" en el menú lateral
-- 3. Pega TODO este contenido y haz clic en "Run"
-- ============================================================


-- ============================================================
-- 1. TABLA: clientes
-- Maestro de clientes de la agencia
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_razon      TEXT NOT NULL,
    rif_cedula        TEXT NOT NULL UNIQUE,
    persona_contacto  TEXT,
    telefono          TEXT,
    email             TEXT,
    direccion         TEXT,
    condicion_pago    TEXT DEFAULT 'Contado',   -- 'Contado' | 'Crédito'
    dias_credito      INTEGER DEFAULT 0,
    limite_credito    NUMERIC(18, 2) DEFAULT 0,
    vendedor          TEXT,
    estado            TEXT DEFAULT 'Activo',    -- 'Activo' | 'Inactivo'
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON public.clientes (nombre_razon);
CREATE INDEX IF NOT EXISTS idx_clientes_rif    ON public.clientes (rif_cedula);


-- ============================================================
-- 2. TABLA: proveedores
-- Maestro de proveedores (hoteles, aerolíneas, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proveedores (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo           TEXT,
    razon_social     TEXT NOT NULL,
    nombre_comercial TEXT,
    rif              TEXT NOT NULL UNIQUE,
    direccion        TEXT,
    telefono         TEXT,
    correo           TEXT,
    tipo             TEXT DEFAULT 'PROVEEDOR GENERAL',
    -- Valores: 'HOTEL' | 'POSADA' | 'AEROLINEA' | 'COMPAÑIA DE SEGURO'
    --          'AGENCIA DE TRASLADO' | 'MAYORISTA' | 'PROVEEDOR GENERAL'
    pais             TEXT,
    ciudad           TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_razon  ON public.proveedores (razon_social);
CREATE INDEX IF NOT EXISTS idx_proveedores_rif    ON public.proveedores (rif);
CREATE INDEX IF NOT EXISTS idx_proveedores_tipo   ON public.proveedores (tipo);


-- ============================================================
-- 3. TABLA: pasajeros
-- Base de datos de pasajeros / huéspedes frecuentes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pasajeros (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_apellido    TEXT NOT NULL,
    cedula_pasaporte   TEXT NOT NULL UNIQUE,
    telefono           TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pasajeros_nombre  ON public.pasajeros (nombre_apellido);
CREATE INDEX IF NOT EXISTS idx_pasajeros_cedula  ON public.pasajeros (cedula_pasaporte);


-- ============================================================
-- 4. TABLA: cajas
-- Cuentas bancarias, cajas de efectivo y billeteras digitales
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cajas (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre         TEXT NOT NULL,
    moneda         TEXT NOT NULL DEFAULT 'USD',   -- 'USD' | 'Bs'
    numero_cuenta  TEXT,
    tipo_cuenta    TEXT DEFAULT 'Corriente',
    -- Valores: 'Corriente' | 'Ahorro' | 'Efectivo' | 'Digital'
    saldo_inicial  NUMERIC(18, 2) DEFAULT 0,
    saldo_actual   NUMERIC(18, 2) DEFAULT 0,
    descripcion    TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cajas_nombre  ON public.cajas (nombre);


-- ============================================================
-- 5. TABLA: clasificaciones
-- Catálogo de clasificaciones para los movimientos de caja
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clasificaciones (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre     TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clasificaciones iniciales del sistema
INSERT INTO public.clasificaciones (nombre) VALUES
    ('COBRANZA'),
    ('BOLETO'),
    ('HOSPEDAJE'),
    ('TRASLADO'),
    ('SEGURO'),
    ('PRESTAMO'),
    ('NÓMINA'),
    ('GASTOS OPERATIVOS'),
    ('MOVIMIENTO SOCIO'),
    ('PROVISION'),
    ('TRF INTERNA'),
    ('OTROS')
ON CONFLICT (nombre) DO NOTHING;


-- ============================================================
-- 6. TABLA: movimientos
-- Registro central de todos los ingresos y egresos de caja
-- Es el corazón del sistema financiero
-- ============================================================
CREATE TABLE IF NOT EXISTS public.movimientos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nro_recibo           TEXT,
    fecha                DATE NOT NULL,
    caja_id              UUID REFERENCES public.cajas(id) ON DELETE SET NULL,
    tipo                 TEXT NOT NULL,
    -- Valores: 'Recibo de Ingreso' | 'Recibo de Egreso' | 'Transferencia Interna'
    persona              TEXT,                    -- Beneficiario o Pagador
    monto                NUMERIC(18, 2) NOT NULL,
    moneda               TEXT DEFAULT 'USD',      -- 'USD' | 'Bs'
    tasa                 NUMERIC(18, 4) DEFAULT 1,
    referencia           TEXT,
    clasificacion        TEXT,
    descripcion          TEXT,

    -- Control de facturación
    estatus_facturacion  TEXT DEFAULT 'No Aplica',
    -- Valores: 'Pendiente' | 'Presupuestado' | 'Facturado' | 'No Aplica'
    nro_presupuesto      TEXT,
    nro_factura          TEXT,

    -- Control de conciliación bancaria
    estado_conciliacion  TEXT DEFAULT 'Pendiente',
    -- Valores: 'Pendiente' | 'Conciliado' | 'En Diferencia' | 'No Aplica'

    -- Enlace a CxC cuando se concilia un pago
    cxc_id_aplicado      UUID,

    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_id    ON public.movimientos (caja_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha      ON public.movimientos (fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo       ON public.movimientos (tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_clasif     ON public.movimientos (clasificacion);
CREATE INDEX IF NOT EXISTS idx_movimientos_est_fact   ON public.movimientos (estatus_facturacion);
CREATE INDEX IF NOT EXISTS idx_movimientos_est_conc   ON public.movimientos (estado_conciliacion);


-- ============================================================
-- 7. TABLA: cuentas_por_cobrar
-- Deudas de clientes, préstamos a empleados y socios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cuentas_por_cobrar (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria         TEXT DEFAULT 'Clientes',
    -- Valores: 'Clientes' | 'Préstamos Empleados' | 'Préstamos Socios' | 'Otros'
    cliente           TEXT NOT NULL,             -- Nombre del deudor
    nro_documento     TEXT DEFAULT 'S/N',
    concepto          TEXT,
    monto_total       NUMERIC(18, 2) NOT NULL,
    saldo_pendiente   NUMERIC(18, 2) NOT NULL,
    moneda            TEXT DEFAULT 'USD',        -- 'USD' | 'Bs'
    fecha_emision     DATE,
    fecha_vencimiento DATE,
    estatus           TEXT DEFAULT 'Pendiente',
    -- Valores: 'Pendiente' | 'Parcial' | 'Pagado'
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cxc_cliente   ON public.cuentas_por_cobrar (cliente);
CREATE INDEX IF NOT EXISTS idx_cxc_estatus   ON public.cuentas_por_cobrar (estatus);
CREATE INDEX IF NOT EXISTS idx_cxc_categoria ON public.cuentas_por_cobrar (categoria);


-- ============================================================
-- 8. TABLA: cuentas_por_pagar
-- Obligaciones con proveedores, bancos y socios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cuentas_por_pagar (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria         TEXT DEFAULT 'Proveedores',
    -- Valores: 'Proveedores' | 'Préstamos Bancarios' | 'Préstamos Socios' | 'Otros'
    proveedor         TEXT NOT NULL,             -- Nombre del acreedor
    nro_documento     TEXT DEFAULT 'S/N',
    concepto          TEXT,
    monto_total       NUMERIC(18, 2) NOT NULL,
    saldo_pendiente   NUMERIC(18, 2) NOT NULL,
    moneda            TEXT DEFAULT 'USD',        -- 'USD' | 'Bs'
    fecha_emision     DATE,
    fecha_vencimiento DATE,
    estatus           TEXT DEFAULT 'Pendiente',
    -- Valores: 'Pendiente' | 'Parcial' | 'Pagado'
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cxp_proveedor  ON public.cuentas_por_pagar (proveedor);
CREATE INDEX IF NOT EXISTS idx_cxp_estatus    ON public.cuentas_por_pagar (estatus);
CREATE INDEX IF NOT EXISTS idx_cxp_categoria  ON public.cuentas_por_pagar (categoria);


-- ============================================================
-- 9. TABLA: cuentas_socios
-- Control de cambios de divisas y traspasos entre socios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cuentas_socios (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio             TEXT NOT NULL,
    tipo              TEXT NOT NULL DEFAULT 'Por Cobrar',
    -- Valores: 'Por Cobrar' | 'Por Pagar'
    nro_documento     TEXT DEFAULT 'S/N',
    concepto          TEXT,
    monto_total       NUMERIC(18, 2) NOT NULL,
    saldo_pendiente   NUMERIC(18, 2) NOT NULL,
    moneda            TEXT DEFAULT 'USD',        -- 'USD' | 'Bs'
    tasa              NUMERIC(18, 4) DEFAULT 1,  -- Tasa de cambio acordada
    equivalente       NUMERIC(18, 2),            -- Valor en la otra moneda
    moneda_equivalente TEXT,                     -- 'USD' | 'Bs'
    fecha_emision     DATE,
    estatus           TEXT DEFAULT 'Pendiente',
    -- Valores: 'Pendiente' | 'Parcial' | 'Compensado'
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socios_socio   ON public.cuentas_socios (socio);
CREATE INDEX IF NOT EXISTS idx_socios_estatus ON public.cuentas_socios (estatus);
CREATE INDEX IF NOT EXISTS idx_socios_tipo    ON public.cuentas_socios (tipo);


-- ============================================================
-- 10. TABLA: presupuestos
-- Cotizaciones y presupuestos emitidos a clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.presupuestos (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nro_presupuesto       TEXT NOT NULL,
    fecha                 DATE NOT NULL,

    -- Datos del cliente en el momento de la emisión
    cliente_rif           TEXT,
    cliente_razon_social  TEXT,
    cliente_direccion     TEXT,
    cliente_telefono      TEXT,
    atencion              TEXT,                  -- Persona de atención

    -- Totales financieros
    total                 NUMERIC(18, 2) DEFAULT 0,
    total_usd             NUMERIC(18, 2) DEFAULT 0,
    moneda                TEXT DEFAULT 'Bs',     -- 'Bs' | 'USD'

    -- Estado del presupuesto
    estatus               TEXT DEFAULT 'Borrador',
    -- Valores: 'Borrador' | 'Enviado' | 'Aprobado' | 'Rechazado'

    -- Detalle de servicios (JSON con todos los ítems de la cotización)
    -- Cada ítem puede ser: BOLETO, HOSPEDAJE, TRASLADO, SEGURO, OTROS, FEE
    detalles              JSONB DEFAULT '[]'::jsonb,

    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presupuestos_nro      ON public.presupuestos (nro_presupuesto);
CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente  ON public.presupuestos (cliente_razon_social);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estatus  ON public.presupuestos (estatus);
CREATE INDEX IF NOT EXISTS idx_presupuestos_fecha    ON public.presupuestos (fecha);


-- ============================================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security)
-- Permite acceso público a través de la API Key de Supabase
-- IMPORTANTE: Ajusta esto según tus necesidades de seguridad
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pasajeros          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cajas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clasificaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_por_pagar  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_socios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos       ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso total (para uso con anon key desde el frontend)
-- Estas políticas permiten que la API key pública pueda leer y escribir.
-- Si en el futuro agregas autenticación de usuarios, deberás restringirlas.

CREATE POLICY "Acceso total clientes"           ON public.clientes           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total proveedores"        ON public.proveedores        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total pasajeros"          ON public.pasajeros          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total cajas"              ON public.cajas              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total clasificaciones"    ON public.clasificaciones    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total movimientos"        ON public.movimientos        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total cuentas_por_cobrar" ON public.cuentas_por_cobrar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total cuentas_por_pagar"  ON public.cuentas_por_pagar  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total cuentas_socios"     ON public.cuentas_socios     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total presupuestos"       ON public.presupuestos       FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- FIN DEL SCRIPT
-- Tablas creadas: 10
--   1. clientes
--   2. proveedores
--   3. pasajeros
--   4. cajas
--   5. clasificaciones  (con datos iniciales)
--   6. movimientos
--   7. cuentas_por_cobrar
--   8. cuentas_por_pagar
--   9. cuentas_socios
--  10. presupuestos
-- ============================================================
