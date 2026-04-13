// netlify/functions/aliexpress-auth.js
const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const crypto     = require('crypto');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  const code = (event.queryStringParameters || {}).code;
  if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'code required' }) };

  const results = {};

  // The /rest endpoint signature includes the METHOD PATH prepended to sorted params
  // From docs: sign = HMAC-SHA256(secret, METHOD_PATH + sorted_key_value_pairs)
  const METHOD = '/auth/token/create';
  const timestamp = String(Date.now());

  // Try 1: path prepended to sorted string (standard REST signing)
  try {
    const params = {
      app_key:     APP_KEY,
      timestamp,
      sign_method: 'sha256',
      code,
    };
    const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
    const toSign = METHOD + sorted;
    params.sign = crypto.createHmac('sha256', APP_SECRET).update(toSign).digest('hex').toUpperCase();

    const r = await fetch(`https://api-sg.aliexpress.com/rest${METHOD}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString()
    });
    results.t1_status = r.status;
    results.t1 = await r.text();
  } catch(e) { results.t1_err = e.message; }

  // Try 2: same but include sign_method in signed params too, with simplify+format
  try {
    const params = {
      app_key:     APP_KEY,
      simplify:    'true',
      format:      'json',
      timestamp,
      sign_method: 'sha256',
      code,
    };
    const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
    const toSign = METHOD + sorted;
    params.sign = crypto.createHmac('sha256', APP_SECRET).update(toSign).digest('hex').toUpperCase();

    const r = await fetch('https://api-sg.aliexpress.com/rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ ...params, method: METHOD }).toString()
    });
    results.t2_status = r.status;
    results.t2 = await r.text();
  } catch(e) { results.t2_err = e.message; }

  // Try 3: MD5 with path prepended
  try {
    const params = {
      app_key:     APP_KEY,
      timestamp,
      sign_method: 'md5',
      code,
    };
    const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
    const toSign = METHOD + sorted;
    params.sign = crypto.createHash('md5').update(APP_SECRET + toSign + APP_SECRET).digest('hex').toUpperCase();

    const r = await fetch(`https://api-sg.aliexpress.com/rest${METHOD}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString()
    });
    results.t3_status = r.status;
    results.t3 = await r.text();
  } catch(e) { results.t3_err = e.message; }

  return { statusCode: 200, headers, body: JSON.stringify(results, null, 2) };
};
