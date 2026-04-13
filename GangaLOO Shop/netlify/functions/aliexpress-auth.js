// netlify/functions/aliexpress-auth.js
const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const crypto     = require('crypto');

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return md5(APP_SECRET + sorted + APP_SECRET);
}

function timestamp() {
  const now = new Date();
  const p = n => String(n).padStart(2,'0');
  return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  const code = (event.queryStringParameters || {}).code;
  if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'code required' }) };

  // Use /sync endpoint with aliexpress.system.oauth.token.create method (same as ae_sdk)
  const params = {
    app_key:      APP_KEY,
    method:       'aliexpress.system.oauth.token.create',
    sign_method:  'md5',
    timestamp:    timestamp(),
    v:            '2.0',
    code,
    grant_type:   'authorization_code',
    redirect_uri: 'https://gangaloo.netlify.app/aliexpress.html',
  };
  params.sign = sign(params);

  try {
    const r = await fetch('https://api-sg.aliexpress.com/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString()
    });
    const text = await r.text();
    console.log('[TOKEN]', text.substring(0, 500));
    return { statusCode: 200, headers, body: text };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
