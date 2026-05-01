// GangaLoo — AliExpress DS API Function
// Place at: GangaLOO Shop/netlify/functions/aliexpress-api.js
// Set in Netlify env vars: ALI_APP_KEY, ALI_APP_SECRET, ALI_ACCESS_TOKEN, ALI_REFRESH_TOKEN

const crypto = require('crypto');

const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const ACCESS_TOKEN  = process.env.ALI_ACCESS_TOKEN || '';
const REFRESH_TOKEN = process.env.ALI_REFRESH_TOKEN || '';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function signRequest(params) {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  const str = APP_SECRET + sorted + APP_SECRET;
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex').toUpperCase();
}

function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ` +
         `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

async function callDsApi(method, extraParams = {}, token = ACCESS_TOKEN) {
  const params = {
    method,
    app_key:      APP_KEY,
    access_token: token,
    timestamp:    getTimestamp(),
    sign_method:  'sha256',
    ...extraParams,
  };
  params.sign = signRequest(params);

  const url = 'https://api-sg.aliexpress.com/sync';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

function extractProductId(url) {
  const m = url.match(/\/(\d{10,})[_.]/) || url.match(/item\/(\d+)/) || url.match(/productId=(\d+)/) || url.match(/\/(\d{10,})/);
  return m ? m[1] : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (!APP_KEY || !APP_SECRET) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing ALI_APP_KEY or ALI_APP_SECRET env vars' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  const { action } = body;

  if (action === 'testToken') {
    const token = body.access_token || ACCESS_TOKEN;
    if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No token to test' }) };
    const result = await callDsApi('aliexpress.ds.product.get', { product_id: '1005005673680888', ship_to_country: 'DO', target_currency: 'USD', target_language: 'ES' }, token);
    const ok = !result.error_response;
    return { statusCode: 200, headers, body: JSON.stringify({ ok, token_works: ok, detail: result.error_response || 'Token is valid ✅' }) };
  }

  if (action === 'getProduct') {
    const token = body.access_token || ACCESS_TOKEN;
    if (!token) {
      return { statusCode: 400, headers, body: JSON.stringify({
        error: 'No access_token. Complete OAuth setup first.',
        oauth_needed: true,
      })};
    }
    const { url, productId: directId } = body;
    let productId = directId;
    if (!productId && url) productId = extractProductId(url);
    if (!productId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot extract product ID' }) };

    try {
      const result = await callDsApi('aliexpress.ds.product.get', {
        product_id:      productId,
        ship_to_country: 'DO',
        target_currency: 'USD',
        target_language: 'ES',
      }, token);

      if (result.error_response) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: result.error_response.msg, detail: result }) };
      }

      const p = result.aliexpress_ds_product_get_response?.result;
      if (!p) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Product not found', raw: result }) };

      return { statusCode: 200, headers, body: JSON.stringify({
        product: {
          product_id:             p.ae_item_base_info_dto?.product_id,
          product_title:          p.ae_item_base_info_dto?.subject,
          product_main_image_url: p.ae_multimedia_info_dto?.image_urls?.split(';')[0] || '',
          target_sale_price:      p.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o?.[0]?.sku_price || '',
          images:                 (p.ae_multimedia_info_dto?.image_urls || '').split(';').filter(Boolean),
        },
      })};
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
};
