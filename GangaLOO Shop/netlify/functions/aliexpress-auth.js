// netlify/functions/aliexpress-auth.js
const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  const code = (event.queryStringParameters || {}).code;
  if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'code required' }) };

  // Use BOTH client_id and app_key as AliExpress expects both
  try {
    const p = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      client_id:     APP_KEY,
      client_secret: APP_SECRET,
      app_key:       APP_KEY,
      app_secret:    APP_SECRET,
      redirect_uri:  'https://gangaloo.netlify.app/aliexpress.html',
      sp:            'ae',
    });
    const r = await fetch('https://oauth.aliexpress.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: p.toString()
    });
    const text = await r.text();
    return { statusCode: 200, headers, body: text };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
