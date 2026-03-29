// netlify/functions/create-checkout.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Fetch live DOP to EUR rate — fallback: 1 EUR = 68 DOP
async function getDOPtoEURRate() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR');
    const data = await res.json();
    if (data && data.rates && data.rates.DOP) {
      return 1 / data.rates.DOP;
    }
  } catch(e) {
    console.warn('Rate fetch failed, using fallback 68:', e.message);
  }
  return 1 / 68;
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = JSON.parse(event.body);
    const { cart, customerEmail, customerName, totalDOP, deliveryMethod, address, orderId } = body;

    if (!cart || !cart.length || !totalDOP) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing cart or total' }) };
    }

    const DOP_TO_EUR = await getDOPtoEURRate();
    const rateDisplay = (1 / DOP_TO_EUR).toFixed(2);
    console.log(`Rate: 1 EUR = ${rateDisplay} DOP`);

    const line_items = cart.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          description: item.sku ? `SKU: ${item.sku}` : undefined,
        },
        unit_amount: Math.round(item.price * DOP_TO_EUR * 100),
      },
      quantity: item.qty,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail || undefined,
      line_items,
      metadata: {
        order_id: String(orderId || ''),
        customer_name: customerName || '',
        total_dop: String(totalDOP),
        rate_used: `1 EUR = ${rateDisplay} DOP`,
        delivery_method: deliveryMethod || 'pickup',
      },
      custom_text: {
        submit: {
          message: `Total en DOP: RD$ ${Number(totalDOP).toLocaleString('es-DO', { minimumFractionDigits: 2 })} (tasa: 1 EUR = ${rateDisplay} DOP)`
        },
      },
      success_url: `https://gangaloo.netlify.app/store.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://gangaloo.netlify.app/store.html?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sessionId: session.id, url: session.url, rateUsed: `1 EUR = ${rateDisplay} DOP` }),
    };

  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
