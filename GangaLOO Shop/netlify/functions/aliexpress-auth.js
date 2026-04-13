// netlify/functions/aliexpress-auth.js
// TEMPORARY: hardcoded code for one-time token exchange
const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  // Try every possible way to get the code
  let code = null;
  
  // From query string
  const qs = event.queryStringParameters || {};
  const mqs = event.multiValueQueryStringParameters || {};
  code = qs.code || qs['code'] || null;
  
  // From body
  if (!code && event.body) {
    try {
      const b = JSON.parse(event.body);
      code = b.code;
    } catch(e) {
      try {
        const b = new URLSearchParams(event.body);
        code = b.get('code');
      } catch(e2) {}
    }
  }

  // Debug dump if no code found
  if (!code) {
    return { statusCode: 200, headers, body: JSON.stringify({
      error: 'code not found',
      method: event.httpMethod,
      qs: qs,
      body: event.body,
      path: event.path,
      rawUrl: event.rawUrl,
    })};
  }

  try {
    const params = new URLSearchParams({
      app_key:      APP_KEY,
      app_secret:   APP_SECRET,
      code:         code,
      grant_type:   'authorization_code',
      redirect_uri: 'https://gangaloo.netlify.app/aliexpress.html',
    });

    const resp = await fetch('https://api-sg.aliexpress.com/auth/token/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: params.toString()
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }
    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
