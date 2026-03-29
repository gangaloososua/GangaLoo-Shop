// netlify/functions/create-paypal.js
// PayPal Orders API v2 — creates a payment and returns approval URL

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET    = process.env.PAYPAL_SECRET;
const PAYPAL_BASE_URL  = process.env.PAYPAL_ENV === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

// Fetch live DOP to USD rate — fallback: 1 USD = 58 DOP
async function getDOPtoUSDRate() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data && data.rates && data.rates.DOP) {
      return 1 / data.rates.DOP;
    }
  } catch(e) {
    console.warn('Rate fetch failed, using fallback 58:', e.message);
  }
  return 1 / 58;
}

// Get PayPal access token
async function getAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get PayPal access token');
  return data.access_token;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { cart, customerEmail, customerName, totalDOP, shipFee, paypalFee, orderId } = body;

    if (!cart || !cart.length || !totalDOP) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing cart or total' }) };
    }

    const DOP_TO_USD = await getDOPtoUSDRate();
    const rateDisplay = (1 / DOP_TO_USD).toFixed(2);
    console.log(`Rate: 1 USD = ${rateDisplay} DOP`);

    // Build item breakdown — use rounded cents to avoid AMOUNT_MISMATCH
    const items = cart.map(item => ({
      name: item.name.substring(0, 127),
      description: item.sku ? `SKU: ${item.sku}` : undefined,
      unit_amount: {
        currency_code: 'USD',
        value: (Math.round(item.price * DOP_TO_USD * 100) / 100).toFixed(2),
      },
      quantity: String(item.qty),
    }));

    // Sum item total from already-rounded unit amounts
    const itemTotalCents = cart.reduce((s, i) =>
      s + Math.round(i.price * DOP_TO_USD * 100) * i.qty, 0);

    // Shipping in USD cents
    const shipCents  = shipFee   ? Math.round(shipFee   * DOP_TO_USD * 100) : 0;
    const feeCents   = paypalFee ? Math.round(paypalFee * DOP_TO_USD * 100) : 0;

    // Grand total = sum of rounded parts (avoids floating point mismatch)
    const grandTotalCents = itemTotalCents + shipCents + feeCents;

    const breakdown = {
      item_total: { currency_code: 'USD', value: (itemTotalCents / 100).toFixed(2) },
      shipping:   { currency_code: 'USD', value: (shipCents  / 100).toFixed(2) },
      handling:   { currency_code: 'USD', value: (feeCents   / 100).toFixed(2) },
    };

    // Total derived from breakdown (not from totalDOP conversion)
    const totalUSD = (grandTotalCents / 100).toFixed(2);

    const accessToken = await getAccessToken();

    // Create PayPal order
    const orderRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': orderId || Date.now().toString(),
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: String(orderId || ''),
          description: `GangaLoo Order — ${customerName || ''}`,
          custom_id: String(orderId || ''),
          amount: {
            currency_code: 'USD',
            value: totalUSD,
            breakdown,
          },
          items,
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'GangaLoo',
              locale: 'es-DO',
              landing_page: 'LOGIN',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              return_url: `https://gangaloo.netlify.app/store.html?payment=paypal_success&order_id=${orderId}`,
              cancel_url: `https://gangaloo.netlify.app/store.html?payment=paypal_cancelled`,
            },
          },
        },
      }),
    });

    const orderData = await orderRes.json();
    if (!orderData.id) {
      console.error('PayPal error:', JSON.stringify(orderData));
      return { statusCode: 500, headers, body: JSON.stringify({ error: orderData.message || 'PayPal order failed' }) };
    }

    // Find approval URL
    const approveUrl = orderData.links?.find(l => l.rel === 'payer-action')?.href
                    || orderData.links?.find(l => l.rel === 'approve')?.href;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        paypalOrderId: orderData.id,
        url: approveUrl,
        rateUsed: `1 USD = ${rateDisplay} DOP`,
      }),
    };

  } catch (err) {
    console.error('PayPal error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
