// netlify/functions/aliexpress-auth.js
const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  const code = (event.queryStringParameters || {}).code;
  if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'code required' }) };

  const results = {};

  // Try 1: /auth/token/create with redirect_uri
  try {
    const p1 = new URLSearchParams({ app_key: APP_KEY, app_secret: APP_SECRET, code, grant_type: 'authorization_code', redirect_uri: 'https://gangaloo.netlify.app/aliexpress.html' });
    const r1 = await fetch('https://api-sg.aliexpress.com/auth/token/create', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'}, body: p1.toString() });
    results.try1_status = r1.status;
    results.try1 = await r1.text();
  } catch(e) { results.try1_err = e.message; }

  // Try 2: /auth/token/create WITHOUT redirect_uri
  try {
    const p2 = new URLSearchParams({ app_key: APP_KEY, app_secret: APP_SECRET, code, grant_type: 'authorization_code' });
    const r2 = await fetch('https://api-sg.aliexpress.com/auth/token/create', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'}, body: p2.toString() });
    results.try2_status = r2.status;
    results.try2 = await r2.text();
  } catch(e) { results.try2_err = e.message; }

  // Try 3: /sync endpoint with method name
  try {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const crypto = require('crypto');
    const params3 = { app_key: APP_KEY, code, grant_type: 'authorization_code', method: 'aliexpress.system.oauth.token.create', redirect_uri: 'https://gangaloo.netlify.app/aliexpress.html', sign_method: 'md5', timestamp: ts, v: '2.0' };
    const sortedStr = Object.keys(params3).sort().map(k => k + params3[k]).join('');
    params3.sign = crypto.createHash('md5').update(APP_SECRET + sortedStr + APP_SECRET, 'utf8').digest('hex').toUpperCase();
    const r3 = await fetch('https://api-sg.aliexpress.com/sync', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'}, body: new URLSearchParams(params3).toString() });
    results.try3_status = r3.status;
    results.try3 = await r3.text();
  } catch(e) { results.try3_err = e.message; }

  return { statusCode: 200, headers, body: JSON.stringify(results, null, 2) };
};
