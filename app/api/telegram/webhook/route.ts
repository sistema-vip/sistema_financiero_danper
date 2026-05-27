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
- Si el usuario escribe un nombre suelto (ej. "Juan Carlos"), asume que ese es el "beneficiario". NO lo pongas en "descripcion".
- Si el usuario escribe una nota o comentario (ej. "pago de la luz"), concaténalo a la "descripcion" existente de la imagen.
- Si el usuario escribe "pago a [nombre]" o "pagué a [nombre]", entonces beneficiario = [nombre] y clasificacion = "Egreso".
- Si el usuario escribe "cobro de [nombre]" o "cobré a [nombre]" o "me pagó [nombre]", entonces beneficiario = [nombre] y clasificacion = "Ingreso".
- Las líneas con formato "clave: valor", "clave - valor", o "- clave: valor" deben interpretarse directamente como el campo respectivo.
- Sinónimos comunes: "persona" o "cliente" o "proveedor" = beneficiario. "ref" o "nro" o "comprobante" = referencia. "concepto" o "motivo" o "por" o "nota" = descripcion. "tipo" = clasificacion.

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
