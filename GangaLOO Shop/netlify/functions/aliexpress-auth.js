// netlify/functions/aliexpress-auth.js
const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const crypto     = require('crypto');

function sha256sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

function md5sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHash('md5').update(APP_SECRET + sorted + APP_SECRET, 'utf8').digest('hex').toUpperCase();
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  const code = (event.queryStringParameters || {}).code;
  if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'code required' }) };

  const results = {};

  // Try 1: method="/auth/token/create" with sha256 (from official Brazilian docs)
  try {
    const params = {
      app_key:      APP_KEY,
      simplify:     'true',
      format:       'json',
      timestamp:    String(Date.now()),
      sign_method:  'sha256',
      method:       '/auth/token/create',
      code,
    };
    const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
    params.sign = crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();

    const r = await fetch('https://api-sg.aliexpress.com/rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString()
    });
    results.t1_status = r.status;
    results.t1 = await r.text();
  } catch(e) { results.t1_err = e.message; }

  // Try 2: same but POST to /rest/auth/token/create directly
  try {
    const params = {
      app_key:      APP_KEY,
      timestamp:    String(Date.now()),
      sign_method:  'sha256',
      code,
    };
    const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
    params.sign = crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();

    const r = await fetch('https://api-sg.aliexpress.com/rest/auth/token/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString()
    });
    results.t2_status = r.status;
    results.t2 = await r.text();
  } catch(e) { results.t2_err = e.message; }

  return { statusCode: 200, headers, body: JSON.stringify(results, null, 2) };
};
