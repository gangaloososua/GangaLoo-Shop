// netlify/functions/aliexpress-auth.js
// One-time use: exchange code for access_token
const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;

function md5(str) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return md5(APP_SECRET + sorted + APP_SECRET);
}

function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const { code } = JSON.parse(event.body || '{}');
    if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'code required' }) };

    const params = {
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://gangaloo.netlify.app/aliexpress.html',
    };

    const resp = await fetch('https://api-sg.aliexpress.com/auth/token/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString()
    });
    const data = await resp.json();
    console.log('[AUTH]', JSON.stringify(data));
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
