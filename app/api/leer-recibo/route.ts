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
    const { imageBase64, mimeType } = await req.json();

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

    const prompt = `Analiza este comprobante o capture bancario y extrae EXACTAMENTE estos 5 datos en formato JSON plano, sin texto adicional, sin markdown, sin bloques de código:
{
  "fecha": "<fecha de la operación en formato YYYY-MM-DD>",
  "beneficiario": "<nombre completo de la persona o empresa que RECIBE el dinero. Buscar etiquetas como 'Para', 'A', 'Destinatario', 'Beneficiario', 'Cliente', 'Pagado a'. Si es una transferencia recibida, usa el remitente ('De', 'Origen', 'Remitente'). Devuelve SOLO el nombre, en MAYÚSCULAS>",
  "referencia": "<número de operación, referencia, comprobante, autorización o transacción>",
  "monto": <número decimal sin separadores de miles, ejemplo: 1500.50>,
  "descripcion": "<concepto, motivo o descripción de la operación. Buscar etiquetas como 'Concepto', 'Motivo', 'Descripción', 'Detalle', 'Asunto'. Si no aparece, usa una descripción corta tipo 'Transferencia desde [BANCO]' o 'Pago móvil'>",
  "banco": "<nombre del banco emisor del comprobante, opcional>"
}
Reglas:
- Si no puedes determinar un valor con certeza, usa null (no inventes).
- "beneficiario" debe ser una persona/empresa, NO un banco ni un número de cuenta.
- "monto" debe ser número (no string), sin símbolos de moneda.
Responde SOLO el JSON, sin texto extra.`;

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
