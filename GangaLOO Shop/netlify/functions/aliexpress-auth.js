// netlify/functions/aliexpress-auth.js
const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  const code = (event.queryStringParameters || {}).code;
  if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'code required' }) };

  const results = {};

  // Try 1: oauth.aliexpress.com/token (correct endpoint per docs)
  try {
    const p = new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      client_id:    APP_KEY,
      client_secret: APP_SECRET,
      redirect_uri: 'https://gangaloo.netlify.app/aliexpress.html',
      sp:           'ae',
    });
    const r = await fetch('https://oauth.aliexpress.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: p.toString()
    });
    results.t1_status = r.status;
    results.t1 = await r.text();
  } catch(e) { results.t1_err = e.message; }

  // Try 2: same but with app_key/app_secret naming
  try {
    const p = new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      app_key:      APP_KEY,
      app_secret:   APP_SECRET,
      redirect_uri: 'https://gangaloo.netlify.app/aliexpress.html',
    });
    const r = await fetch('https://oauth.aliexpress.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: p.toString()
    });
    results.t2_status = r.status;
    results.t2 = await r.text();
  } catch(e) { results.t2_err = e.message; }

  return { statusCode: 200, headers, body: JSON.stringify(results, null, 2) };
};
