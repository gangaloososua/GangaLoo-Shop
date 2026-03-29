// netlify/functions/stripe-webhook.js
// Stripe calls this automatically when payment succeeds
// Add this URL in Stripe Dashboard → Developers → Webhooks

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // needs service role key — NOT anon key
);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const orderId = session.metadata?.order_id;
    const sessionId = session.id;

    console.log(`Payment completed for order: ${orderId}, session: ${sessionId}`);

    // Update order status to approved
    const { error } = await sb
      .from('online_orders')
      .update({ status: 'approved', stripe_session_id: sessionId })
      .eq('id', orderId);

    if (error) {
      console.error('Supabase update error:', error);
      return { statusCode: 500, body: 'DB update failed' };
    }

    console.log(`Order ${orderId} approved successfully`);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
