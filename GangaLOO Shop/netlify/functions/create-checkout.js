// netlify/functions/create-checkout.js
// Stripe Checkout session creator for GangaLoo store
// Deploy this file to: netlify/functions/create-checkout.js in your GitHub repo

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Exchange rate: DOP to EUR
// Update this to match your current rate or fetch dynamically
const DOP_TO_EUR = 0.01333; // 1 DOP = ~0.01333 EUR (75 DOP = 1 EUR)

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // CORS headers — allow your store domain
  const headers = {
    'Access-Control-Allow-Origin': 'https://gangaloo.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = JSON.parse(event.body);
    const { cart, customerEmail, customerName, totalDOP, deliveryMethod, address, orderId } = body;

    if (!cart || !cart.length || !totalDOP) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing cart or total' }) };
    }

    // Convert total to EUR cents (Stripe uses smallest currency unit)
    const totalEUR = Math.round(totalDOP * DOP_TO_EUR * 100); // in euro cents

    // Build line items for Stripe
    const line_items = cart.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          description: item.sku ? `SKU: ${item.sku}` : undefined,
          metadata: { sku: item.sku || '' },
        },
        // Convert each item price to EUR cents
        unit_amount: Math.round(item.price * DOP_TO_EUR * 100),
      },
      quantity: item.qty,
    }));

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail || undefined,
      line_items,
      metadata: {
        order_id: orderId || '',
        customer_name: customerName || '',
        customer_email: customerEmail || '',
        total_dop: totalDOP.toString(),
        delivery_method: deliveryMethod || 'pickup',
        address: address || '',
        gangaloo_order: 'true',
      },
      // Where to redirect after payment
      success_url: `https://gangaloo.netlify.app/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `https://gangaloo.netlify.app/?payment=cancelled`,
      // Show order summary
      custom_text: {
        submit: { message: `Total en DOP: RD$ ${totalDOP.toLocaleString('es-DO', { minimumFractionDigits: 2 })}` },
      },
      // Expire session after 30 minutes
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
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

