// GangaLoo — AliExpress Affiliates API Function
// Place at: GangaLOO Shop/netlify/functions/aliexpress-affiliate.js

const crypto = require('crypto');

const APP_KEY     = process.env.ALI_AFF_KEY    || '531720';
const APP_SECRET  = process.env.ALI_AFF_SECRET || '98Lm9UyKT81kSxaIy9BGj2ISZIHn7A0w';
const TRACKING_ID = process.env.ALI_TRACKING_ID || 'gangaloo';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function signRequest(params) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const str = APP_SECRET + entries.map(([k, v]) => `${k}${v}`).join('') + APP_SECRET;
  return crypto.createHmac('sha256', APP_SECRET).update(str).digest('hex').toUpperCase();
}

async function callApi(method, extra = {}) {
  const filtered = Object.fromEntries(
    Object.entries(extra).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );
  const params = {
    method,
    app_key: APP_KEY,
    timestamp: new Date().toISOString().replace('T', ' ').replace(/\..+/, ''),
    sign_method: 'sha256',
    ...filtered,
  };
  params.sign = signRequest(params);

  const res = await fetch('https://api-sg.aliexpress.com/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const text = await res.text();
  try { return JSON.parse(text); } catch { return { parse_error: true, raw_text: text }; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  const { keywords = 'hair extension', page = 1, pageSize = 20 } = body;

  try {
    const result = await callApi('aliexpress.affiliate.product.query', {
      keywords,
      tracking_id: TRACKING_ID,
      page_no: page,
      page_size: Math.min(pageSize, 50),
      target_currency: 'USD',
      target_language: 'EN',
      ship_to_country: 'DO',
    });

    const resp = result?.aliexpress_affiliate_product_query_response?.resp_result;

    if (!resp) {
      return { statusCode: 400, headers, body: JSON.stringify({
        error: 'Unexpected API response',
        full_response: result,
        config: { app_key: APP_KEY, tracking_id: TRACKING_ID },
      })};
    }

    if (resp.resp_code !== 200) {
      return { statusCode: 400, headers, body: JSON.stringify({
        error: resp.resp_msg || 'AliExpress error',
        resp_code: resp.resp_code,
        full_response: result,
      })};
    }

    const products = (resp.result?.products?.product || []).map(p => ({
      id:       p.product_id,
      title:    p.product_title,
      image:    p.product_main_image_url,
      url:      p.product_detail_url,
      discount: p.sale_price_discount_rate,
      rating:   p.evaluate_rate,
      sold:     p.lastest_volume,
    }));

    return { statusCode: 200, headers, body: JSON.stringify({
      products,
      total: resp.result?.total_record_count || products.length,
      page,
    })};
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
