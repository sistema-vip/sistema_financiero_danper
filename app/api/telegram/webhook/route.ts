import { NextResponse } from 'next/server';
import { SUPABASE_URL, SUPABASE_HEADERS } from '@/app/config';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

// Para restringir quién puede enviar, el usuario puede configurar esto en su .env
const envAllowedUsers = process.env.TELEGRAM_ALLOWED_USERS || process.env.AUTHORIZED_TELEGRAM_USERS;
const AUTHORIZED_USERS = envAllowedUsers
  ? envAllowedUsers.split(',').map(id => id.trim())
  : [];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'setup') {
    if (!TELEGRAM_BOT_TOKEN || !NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'Faltan variables de entorno (TELEGRAM_BOT_TOKEN o NEXT_PUBLIC_APP_URL)' }, { status: 500 });
    }

    const webhookUrl = `${NEXT_PUBLIC_APP_URL}/api/telegram/webhook`;
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

    try {
      const res = await fetch(telegramApiUrl);
      const data = await res.json();
      return NextResponse.json({ message: 'Webhook configurado', data });
    } catch (error) {
      return NextResponse.json({ error: 'Error configurando webhook', details: error }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Telegram Webhook Endpoint' });
}

export async function POST(request: Request) {
  try {
    const update = await request.json();

    // Verificamos si es un mensaje con foto o documento
    if (update.message) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id.toString();

      // Verificar autorización si está configurada
      if (AUTHORIZED_USERS.length > 0 && !AUTHORIZED_USERS.includes(userId)) {
        await sendMessage(chatId, "No estás autorizado para enviar comprobantes a este sistema.");
        return NextResponse.json({ status: 'unauthorized' });
      }

      let fileId = null;
      let caption = update.message.caption || '';

      if (update.message.photo) {
        // Tomar la foto de mayor resolución (la última del array)
        fileId = update.message.photo[update.message.photo.length - 1].file_id;
      } else if (update.message.document) {
        // Asegurarnos de que sea una imagen o pdf
        fileId = update.message.document.file_id;
      }

      if (fileId) {
        // 1. Obtener la ruta del archivo en Telegram
        const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();

        if (fileData.ok) {
          const filePath = fileData.result.file_path;
          
          // 2. Descargar el archivo
          const fileDownloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
          const imageRes = await fetch(fileDownloadUrl);
          const arrayBuffer = await imageRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Image = buffer.toString('base64');

          // 2.5 Llamar a Gemini (IA) directamente para extraer datos
          let datosIA: any = {};
          let msgIA = '';
          try {
            const apiKey = (process.env.GEMINI_API_KEY ?? '').trim().replace(/["']/g, '').replace(/[\r\n\t]/g, '');
            if (apiKey) {
              const hoy = new Date().toISOString().split('T')[0];
              const prompt = `Eres un asistente financiero avanzado de una empresa venezolana. Tu trabajo es extraer datos financieros de DOS tipos de entrada:

TIPO 1 — IMAGEN: Si recibes una imagen de un comprobante bancario, léela y extrae todos los datos visibles.
TIPO 2 — FORMULARIO DE TEXTO: Si recibes texto escrito por el usuario (con viñetas, guiones, pares clave:valor, o texto libre), interpreta cada línea como un campo del registro financiero.

Texto del usuario: "${caption || ''}"
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

              const payloadGemini = {
                contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: base64Image } }] }]
              };

              const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
              const geminiRes = await fetch(urlGemini, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadGemini)
              });

              if (geminiRes.ok) {
                const resJson = await geminiRes.json();
                const textoGenerado = resJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                const match = textoGenerado.match(/\{[\s\S]*\}/);
                if (match) {
                  datosIA = JSON.parse(match[0]);
                  msgIA = `\n🤖 Leído: ${datosIA.beneficiario || '-'} | ${datosIA.monto ? (datosIA.moneda || 'Bs') + ' ' + datosIA.monto : '-'}`;
                }
              }
            }
          } catch (e) {
            console.error('Error llamando a Gemini directamente:', e);
          }

          // 3. Guardar en Supabase (movimientos_por_aprobar)
          if (SUPABASE_URL) {
            const fallbackRef = `TG-${userId}-${update.message.message_id}`;
            const payload: any = {
              estado: 'Pendiente',
              imagen_base64: base64Image,
              referencia: datosIA.referencia || fallbackRef,
              fecha: datosIA.fecha || undefined,
              persona: datosIA.beneficiario || undefined,
              monto: datosIA.monto ? parseFloat(datosIA.monto) : undefined,
              descripcion: datosIA.descripcion || undefined,
              moneda: datosIA.moneda || undefined,
              clasificacion: datosIA.clasificacion || undefined,
              metodo: datosIA.metodo || undefined,
              banco_target: datosIA.banco_target || undefined,
              categoria: datosIA.categoria || undefined,
              estatus: datosIA.estatus || undefined
            };
            
            // Eliminar claves undefined para evitar errores
            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

            const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_por_aprobar`, {
              method: 'POST',
              headers: SUPABASE_HEADERS,
              body: JSON.stringify(payload)
            });

            if (!insertRes.ok) {
              const err = await insertRes.text();
              console.error('Error insertando en Supabase:', err);
              await sendMessage(chatId, `Hubo un error al guardar el comprobante en el sistema:\n\n${err}`);
            } else {
              await sendMessage(chatId, `✅ Comprobante recibido y enviado a la cola 'Por Aprobar'.${msgIA}`);
            }
          } else {
             console.error('Faltan credenciales de Supabase en el webhook de Telegram');
             await sendMessage(chatId, "Error interno: Faltan credenciales de Base de Datos.");
          }
        }
      } else {
         // Si envían texto podemos responder algo útil
         if (update.message.text === '/start') {
           await sendMessage(chatId, `Hola! Bienvenido al bot de Danper.\nTu ID de Telegram es: ${userId}\nSi estás autorizado, puedes enviarme imágenes de comprobantes y las mandaré a la cola "Por Aprobar".`);
         }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error procesando webhook de Telegram:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function sendMessage(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
