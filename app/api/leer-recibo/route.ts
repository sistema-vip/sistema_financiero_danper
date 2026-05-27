import { NextRequest, NextResponse } from 'next/server';

const MODELO = 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function limpiarKey(): string {
  return (process.env.GEMINI_API_KEY ?? '')
    .trim()
    .replace(/["']/g, '')
    .replace(/[\r\n\t]/g, '');
}

// GET diagnóstico: visita http://localhost:3001/api/leer-recibo en el navegador
// para ver qué modelos admite tu API key
export async function GET() {
  const apiKey = limpiarKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
  }
  try {
    const res = await fetch(`${API_BASE}/models?key=${apiKey}`);
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: 'Google rechazó ListModels', detalle: data }, { status: 500 });
    }
    const modelosCompatibles = (data.models ?? [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({ name: m.name, displayName: m.displayName }));
    return NextResponse.json({
      modeloActualEnUso: MODELO,
      totalCompatibles: modelosCompatibles.length,
      modelos: modelosCompatibles,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let urlIntentada = '(no construida)';
  try {
    const { imageBase64, mimeType, textoAdicional = '' } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 });
    }

    const apiKey = limpiarKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada en el servidor' }, { status: 500 });
    }

    console.log('🔑 Key OK | longitud:', apiKey.length, '| prefijo:', apiKey.substring(0, 6) + '...');

    urlIntentada = `${API_BASE}/models/${MODELO}:generateContent?key=${apiKey}`;
    const urlLog = urlIntentada.replace(apiKey, '***KEY***');
    console.log('🌐 POST →', urlLog);

    const hoy = new Date().toISOString().split('T')[0];
    const prompt = `Eres un asistente financiero avanzado de una empresa venezolana. Tu trabajo es extraer datos financieros de DOS tipos de entrada:

TIPO 1 — IMAGEN: Si recibes una imagen de un comprobante bancario, léela y extrae todos los datos visibles.
TIPO 2 — FORMULARIO DE TEXTO: Si recibes texto escrito por el usuario (con viñetas, guiones, pares clave:valor, o texto libre), interpreta cada línea como un campo del registro financiero.

Texto del usuario: "${textoAdicional}"
Fecha actual de referencia: ${hoy}

REGLAS DE PRIORIDAD ABSOLUTA DEL TEXTO SOBRE LA IMAGEN (CORRECCIONES MANUALES):
1. El "Texto del usuario" representa correcciones o especificaciones manuales y TIENE PRIORIDAD ABSOLUTA (100%) sobre cualquier información visual presente en la imagen.
2. Si existe alguna discrepancia o conflicto entre lo que dice la imagen y lo que escribe el usuario, debes elegir SIEMPRE el dato especificado por el usuario para sobreescribir el campo correspondiente.
3. EJEMPLOS CRÍTICOS DE PRIORIDAD:
   - Si la imagen muestra un beneficiario que es un número de cédula, RIF, número de cuenta o un nombre genérico (como "PAGO MOVIL"), pero el usuario escribe un nombre en su texto (ej. "Pedro Pérez" o "beneficiario: Pedro Pérez"), el campo "beneficiario" DEBE ser "Pedro Pérez".
   - Si la imagen muestra un concepto genérico como "Pago", "Transferencia" o "Débito", pero el usuario escribe algo específico (ej. "pago de electricidad" o "concepto: pago de electricidad"), el campo "descripcion" DEBE ser "pago de electricidad".
   - Si la imagen muestra un monto de "100" pero el usuario escribe "monto: 50" o "fueron 50", el campo "monto" DEBE ser 50.00.
   - Si la imagen muestra una fecha pero el usuario escribe "esto fue ayer" o "fecha: 2026-05-25", debes usar la fecha indicada por el usuario (calculada adecuadamente si usa términos relativos como "hoy", "ayer" o "antier" a partir de la fecha de referencia ${hoy}).
4. Fusión Inteligente: Los campos de datos que NO hayan sido corregidos o especificados en el "Texto del usuario" deben ser leídos y extraídos con normalidad desde la imagen. Ambas fuentes se complementan, pero el texto del usuario tiene la última palabra.

REGLAS DE INTERPRETACIÓN DE TEXTO:
- Si el usuario escribe "pago a [nombre]" o "pagué a [nombre]", entonces beneficiario = [nombre] y clasificacion = "Egreso".
- Si el usuario escribe "cobro de [nombre]" o "cobré a [nombre]" o "me pagó [nombre]", entonces beneficiario = [nombre] y clasificacion = "Ingreso".
- Las líneas con formato "clave: valor", "clave - valor", o "- clave: valor" deben interpretarse como campos del formulario.
- Sinónimos comunes: "persona" o "cliente" o "proveedor" = beneficiario. "ref" o "nro" o "comprobante" = referencia. "concepto" o "motivo" o "por" = descripcion. "tipo" = clasificacion.

REGLAS DE DATOS:
1. "monto": SIEMPRE positivo, sin símbolos de moneda. Usa punto para decimales (ej: 1500.50).
2. "moneda": Si ves "$", "USD", "dólares" o "Zelle" → "USD". Si no se especifica → "Bs".
3. "fecha": Formato YYYY-MM-DD. Acepta formatos como "24/05/2025", "24-05-2025", "mayo 24", "hoy", "ayer". Si no se menciona fecha, usa ${hoy}.
4. "beneficiario": Nombre de la persona o empresa. NUNCA dejar vacío si el usuario mencionó algún nombre.
5. "referencia": Número de referencia, comprobante o confirmación. Si no hay, devuelve null.
6. "banco_target": Banco receptor (Banesco, Mercantil, Provincial, BDV, Venezuela, Bicentenario, Tesoro, Exterior, etc.).
7. "descripcion": Resumen breve de la operación.
8. "clasificacion": "Ingreso" o "Egreso". Si dice pago/pagué/compra/gasto → Egreso. Si dice cobro/venta/ingreso/me pagaron → Ingreso.
9. "metodo": Detectar método de pago:
   - Número de teléfono (04XX) o "Pago Móvil" → "Pago Móvil"
   - "Transferencia" o número de cuenta → "Transferencia"
   - "Zelle" → "Zelle"
   - "Tarjeta de débito" o "TDD" o "débito" → "Tarjeta de Débito"
   - "Tarjeta de crédito" o "TDC" o "crédito" → "Tarjeta de Crédito"
   - "Efectivo" o "cash" → "Efectivo"
   - "Cheque" → "Cheque"
   - Si no se especifica → null
10. "categoria": Clasificación general (Servicios, Nómina, Ventas, Compras, Alquiler, Cuentas por Pagar, Cuentas por Cobrar, Impuestos, Otros).
11. "estatus": "Pagado" si es egreso confirmado. "Cobrado" si es ingreso confirmado. "Por Pagar" o "Por Cobrar" si se menciona como pendiente.

Si falta información y no se puede inferir, usa null para ese campo.
Retorna SOLAMENTE un objeto JSON plano, sin backticks de markdown ni bloques de código.

{
  "fecha": "YYYY-MM-DD",
  "monto": 0.00,
  "moneda": "Bs",
  "beneficiario": null,
  "referencia": null,
  "banco_target": null,
  "descripcion": null,
  "clasificacion": null,
  "metodo": null,
  "categoria": null,
  "estatus": null
}`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
    };

    const googleRes = await fetch(urlIntentada, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const respuestaTexto = await googleRes.text();

    if (!googleRes.ok) {
      console.error('❌ Google respondió no-OK:', googleRes.status, respuestaTexto);
      let mensajeGoogle = respuestaTexto;
      try {
        const errJson = JSON.parse(respuestaTexto);
        mensajeGoogle = errJson?.error?.message || respuestaTexto;
      } catch {}
      return NextResponse.json(
        {
          error: `Google API ${googleRes.status}: ${mensajeGoogle}`,
          urlIntentada: urlLog,
          tip: 'Visita /api/leer-recibo en el navegador para ver modelos disponibles',
        },
        { status: 500 }
      );
    }

    const respuestaJson = JSON.parse(respuestaTexto);
    const textoGenerado: string = respuestaJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    console.log('✅ Texto generado:', textoGenerado);

    if (!textoGenerado) {
      return NextResponse.json(
        { error: 'Google no retornó contenido en la respuesta', raw: respuestaJson },
        { status: 500 }
      );
    }

    const match = textoGenerado.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json(
        { error: 'No se pudo extraer JSON de la respuesta de Gemini', raw: textoGenerado },
        { status: 500 }
      );
    }

    const datosExtraidos = JSON.parse(match[0]);
    console.log('📦 Datos extraídos:', datosExtraidos);

    return NextResponse.json(datosExtraidos);
  } catch (error: any) {
    console.error('❌ Error en API leer-recibo:', error);
    return NextResponse.json(
      {
        error: error?.message ?? 'Error interno del servidor',
        urlIntentada: urlIntentada.replace(/key=[^&]+/, 'key=***'),
        tipo: error?.constructor?.name ?? 'Error',
      },
      { status: 500 }
    );
  }
}
