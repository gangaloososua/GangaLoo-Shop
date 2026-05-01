// GangaLoo — AliExpress API Function (OAuth2 + DS API)
// Place at: GangaLOO Shop/netlify/functions/aliexpress-api.js

const crypto = require('crypto');

const APP_KEY    = process.env.ALI_APP_KEY    || '531948';
const APP_SECRET = process.env.ALI_APP_SECRET || 'TruXWPwvEwcYsOVyqXYTJ2tvjhKg42Bs';

// These are stored as Netlify env vars after first OAuth exchange
let ACCESS_TOKEN  = process.env.ALI_ACCESS_TOKEN  || '';
let REFRESH_TOKEN = process.env.ALI_REFRESH_TOKEN || '';

// ── Signature helper (HMAC-SHA256) ──────────────────────────────────────────
function signRequest(params) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  const toSign = APP_SECRET + sorted + APP_SECRET;
  return crypto.createHmac('sha256', APP_SECRET).update(toSign).digest('hex').toUpperCase();
}

// ── Generic DS API caller ────────────────────────────────────────────────────
async function callDsApi(method, extraParams = {}, token = ACCESS_TOKEN) {
  const params = {
    method,
    app_key:    APP_KEY,
    access_token: token,
    timestamp:  new Date().toISOString().replace('T', ' ').replace(/\..+/, ''),
    sign_method: 'sha256',
    ...extraParams,
  };
  params.sign = signRequest(params);

  const url = 'https://api-sg.aliexpress.com/sync';
  const body = new URLSearchParams(params).toString();

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return res.json();
}

// ── OAuth: exchange auth code for access_token ───────────────────────────────
// Uses the correct official endpoint: https://oauth.aliexpress.com/token
async function exchangeToken(code, redirectUri) {
  const url = 'https://oauth.aliexpress.com/token';
  const params = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     APP_KEY,
    client_secret: APP_SECRET,
    code,
    sp:            'ae',
    redirect_uri:  redirectUri || 'https://gangaloo.netlify.app/aliexpress.html',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return res.json();
}

// ── OAuth: refresh access_token ──────────────────────────────────────────────
async function refreshToken(refreshTk) {
  const url = 'https://oauth.aliexpress.com/token';
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     APP_KEY,
    client_secret: APP_SECRET,
    refresh_token: refreshTk,
    sp:            'ae',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return res.json();
}

// ── Extract product ID from URL ───────────────────────────────────────────────
function extractProductId(url) {
  const m = url.match(/\/(\d{10,})[_.]/) || url.match(/item\/(\d+)/) || url.match(/productId=(\d+)/) || url.match(/\/(\d{10,})/);
  return m ? m[1] : null;
}

// ── DS: get product details ───────────────────────────────────────────────────
async function getProductDS(productId, token) {
  return callDsApi('aliexpress.ds.product.get', {
    product_id: productId,
    ship_to_country: 'DO',
    target_currency: 'USD',
    target_language: 'ES',
  }, token);
}

// ── Lambda handler ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }, body: '' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { body = {}; }

  const { action } = body;

  // ── ACTION: exchangeToken ──────────────────────────────────────────────────
  if (action === 'exchangeToken') {
    const { code, redirect_uri } = body;
    if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing auth code' }) };

    try {
      const result = await exchangeToken(code, redirect_uri);

      // oauth.aliexpress.com returns error as { error, error_description }
      if (result.error || result.error_response) {
        return { statusCode: 400, headers, body: JSON.stringify({
          error: result.error_description || result.error || 'Token exchange failed',
          detail: result
        }) };
      }

      // Successful response fields from oauth.aliexpress.com/token
      return { statusCode: 200, headers, body: JSON.stringify({
        ok: true,
        access_token:  result.access_token,
        refresh_token: result.refresh_token || null,
        expire_time:   result.expire_time,
        user_nick:     result.user_nick || result.taobao_user_nickname || 'OK',
        message: '✅ Token obtained! Save as Netlify env vars: ALI_ACCESS_TOKEN and ALI_REFRESH_TOKEN'
      })};
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── ACTION: refreshToken ───────────────────────────────────────────────────
  if (action === 'refreshToken') {
    const refreshTk = body.refresh_token || REFRESH_TOKEN;
    if (!refreshTk) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No refresh token' }) };

    try {
      const result = await refreshToken(refreshTk);
      if (result.error_response) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Refresh failed', detail: result }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({
        ok: true,
        access_token:  result.access_token,
        refresh_token: result.refresh_token,
        expire_time:   result.expire_time,
        message: '✅ Token refreshed! Update Netlify env var ALI_ACCESS_TOKEN with new value.'
      })};
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── ACTION: getProduct ─────────────────────────────────────────────────────
  if (action === 'getProduct') {
    const token = body.access_token || ACCESS_TOKEN;
    if (!token) {
      return { statusCode: 400, headers, body: JSON.stringify({
        error: 'No access_token. Complete OAuth setup first.',
        oauth_needed: true,
        auth_url: `https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&client_id=${APP_KEY}&redirect_uri=https://gangaloo.netlify.app/aliexpress.html`
      })};
    }

    const { url, productId: directId } = body;
    let productId = directId;
    if (!productId && url) productId = extractProductId(url);
    if (!productId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot extract product ID from URL' }) };

    try {
      const result = await getProductDS(productId, token);

      if (result.error_response) {
        // Token expired? Try refresh
        const errCode = result.error_response.code;
        if (errCode === 'invalid-sessionkey' || errCode === 'token-expired') {
          return { statusCode: 401, headers, body: JSON.stringify({
            error: 'Access token expired',
            token_expired: true,
            detail: result
          })};
        }
        return { statusCode: 400, headers, body: JSON.stringify({
          error: result.error_response.msg || 'DS API error',
          detail: result
        })};
      }

      const p = result.aliexpress_ds_product_get_response?.result;
      if (!p) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Product not found', raw: result }) };

      // Normalize variants
      const variants = {};
      const skus = p.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || [];
      for (const sku of skus) {
        const props = sku.ae_sku_property_dtos?.ae_sku_property_d_t_o || [];
        for (const prop of props) {
          const key = prop.sku_property_name;
          if (!variants[key]) variants[key] = [];
          const exists = variants[key].find(v => v.value === prop.property_value_definition_name);
          if (!exists) variants[key].push({
            value: prop.property_value_definition_name || prop.property_value_id_long?.toString(),
            img:   prop.sku_image || null
          });
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({
        product: {
          product_id:            p.ae_item_base_info_dto?.product_id,
          product_title:         p.ae_item_base_info_dto?.subject,
          product_main_image_url: p.ae_multimedia_info_dto?.image_urls?.split(';')[0] || '',
          product_detail_url:    `https://www.aliexpress.com/item/${productId}.html`,
          target_sale_price:     p.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o?.[0]?.sku_price || '',
          target_original_price: p.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o?.[0]?.sku_price || '',
          category_name:         p.ae_item_base_info_dto?.category_id || '',
          images:                (p.ae_multimedia_info_dto?.image_urls || '').split(';').filter(Boolean),
        },
        variants: Object.keys(variants).length ? variants : null,
      })};
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── ACTION: testToken ──────────────────────────────────────────────────────
  if (action === 'testToken') {
    const token = body.access_token || ACCESS_TOKEN;
    if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No token to test' }) };
    // Test with a known product ID
    const result = await getProductDS('1005005673680888', token);
    const ok = !result.error_response;
    return { statusCode: 200, headers, body: JSON.stringify({
      ok,
      token_works: ok,
      has_token: !!token,
      detail: result.error_response || 'Token is valid ✅'
    })};
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
};
