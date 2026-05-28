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

REGLAS DE PRIORIDAD (TEXTO VS IMAGEN):
1. LA IMAGEN ES LA FUENTE PRIMARIA: Extrae todos los datos del comprobante gráfico como tu fuente principal.
2. SOBREESCRITURA EXPLICITA: El "Texto del usuario" SOLO sobreescribe o modifica un campo extraído de la imagen si incluye una ETIQUETA EXPLICITA en formato "clave: valor".
   Ejemplos válidos de etiquetas que reemplazan datos de la imagen:
   - "beneficiario: Pedro Pérez" -> Reemplaza el beneficiario.
   - "ref: 12345" o "referencia: 12345" -> Reemplaza la referencia.
   - "monto: 50" -> Reemplaza el monto.
   - "concepto: pago luz" o "descripcion: pago luz" -> Reemplaza la descripcion.
3. TEXTO LIBRE (SIN ETIQUETA): Si el usuario envía texto sin formato de "clave: valor" (ej. un nombre suelto "Pedro Pérez", un comentario "pago de luz", un número suelto "500"), NO modifiques los campos extraídos de la imagen. Solo concatena ese texto libre a la "descripcion" como una nota adicional. No intentes adivinar si el nombre suelto es el beneficiario a menos que use la etiqueta "beneficiario:".

REGLAS DE INTERPRETACIÓN DE TEXTO ETIQUETADO:
- Etiquetas válidas: "beneficiario", "persona", "cliente", "proveedor" (asignan a beneficiario); "ref", "referencia", "nro", "comprobante" (asignan a referencia); "concepto", "motivo", "por", "nota", "descripcion" (asignan a descripcion); "tipo", "clasificacion" (asignan a clasificacion); "fecha", "monto", "banco", "moneda".

REGLAS DE DATOS (PRECISIÓN OCR EXTREMA):
1. "monto": Extrae el monto EXACTO que aparece en el recibo. Usa punto para decimales (ej: 1500.50). NUNCA redondees.
2. "moneda": SIEMPRE asume "Bs" (Bolívares) para transferencias nacionales o Pago Móvil en Venezuela (ej. Banesco, Mercantil, BDV, etc.). Solo usa "USD" si el comprobante es de Zelle, Binance, o dice explícitamente dólares.
3. "fecha": Formato YYYY-MM-DD. Acepta formatos como "24/05/2025", "24-05-2025", "mayo 24", "hoy", "ayer". Si no se menciona fecha, usa ${hoy}.
4. "beneficiario": Nombre de la persona o empresa.
5. "referencia": Extrae EXACTAMENTE el número de referencia, confirmación o recibo, sin omitir ni inventar dígitos. Busca etiquetas como "Ref", "Referencia", "Recibo". Si no hay, devuelve null.
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
