// GangaLOO Shop/netlify/functions/chat-proxy.js
// Proxies requests to Anthropic API to avoid CORS issues in the browser.
// Set ANTHROPIC_API_KEY in Netlify UI → Site config → Environment variables.

const SYSTEM_PROMPT = `Eres el asistente virtual de GangaLoo, una tienda especializada en pelucas y extensiones de cabello ubicada en República Dominicana (Sosúa, Puerto Plata).

SOBRE GANGALOO:
- Tienda de pelucas, extensiones y accesorios de cabello
- Productos de calidad (cabello 100% humano y sintético)
- Categorías: Pelucas Lacio, Ondulado, Rizado, Frontales, Cabellos 9a, 12a, Sintéticas, etc.
- Precios en pesos dominicanos (RD$)
- Envíos a toda República Dominicana
- Métodos de pago: efectivo, transferencia bancaria, tarjeta

PERSONALIDAD:
- Amable, profesional, entusiasta sobre cabello y belleza
- Responde en español dominicano natural y cálido
- Usa emojis con moderación (1-2 por mensaje)
- Respuestas cortas y útiles (máx 3-4 oraciones)
- Si no sabes algo específico, sugiere contactar directamente a la tienda

NO hagas:
- No inventes precios exactos si no los conoces
- No prometas tiempos de entrega específicos
- No menciones competidores`;

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  let messages;
  try {
    const body = JSON.parse(event.body || '{}');
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('bad messages');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Invalid request body' }),
    };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',   // fast + cheap for chat
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await res.json();

    return {
      statusCode: res.ok ? 200 : res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Upstream error: ' + err.message }),
    };
  }
};
