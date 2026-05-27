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

          // 3. Guardar en Supabase (movimientos_por_aprobar)
          if (SUPABASE_URL) {
            const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_por_aprobar`, {
              method: 'POST',
              headers: SUPABASE_HEADERS,
              body: JSON.stringify({
                estado: 'Pendiente',
                imagen_base64: base64Image,
                referencia: caption || `TG-${update.message.message_id}`,
                metadata: {
                  telegram_user_id: userId,
                  telegram_username: update.message.from.username,
                  chat_id: chatId
                }
              })
            });

            if (!insertRes.ok) {
              const err = await insertRes.text();
              console.error('Error insertando en Supabase:', err);
              await sendMessage(chatId, `Hubo un error al guardar el comprobante en el sistema:\n\n${err}`);
            } else {
              await sendMessage(chatId, "✅ Comprobante recibido y enviado a la cola 'Por Aprobar'.");
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
