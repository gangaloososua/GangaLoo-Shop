// netlify/functions/capture-paypal.js
// Called when customer returns from PayPal — captures the payment

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET    = process.env.PAYPAL_SECRET;
const PAYPAL_BASE_URL  = process.env.PAYPAL_ENV === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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

  try {
    const body = JSON.parse(event.body);
    const { paypalOrderId, supabaseOrderId } = body;

    if (!paypalOrderId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing PayPal order ID' }) };
    }

    const accessToken = await getAccessToken();

    // Capture the payment
    const captureRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await captureRes.json();
    console.log('PayPal capture:', captureData.status);

    if (captureData.status === 'COMPLETED') {
      // Update order in Supabase
      if (supabaseOrderId) {
        await sb.from('online_orders')
          .update({ status: 'approved', stripe_session_id: paypalOrderId })
          .eq('id', supabaseOrderId);
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, status: 'COMPLETED' }),
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Payment not completed', status: captureData.status }),
      };
    }

  } catch (err) {
    console.error('Capture error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
