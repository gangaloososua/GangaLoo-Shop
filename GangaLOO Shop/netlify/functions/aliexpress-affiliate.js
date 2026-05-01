// GangaLoo — AliExpress Affiliates API Function
// Place at: GangaLOO Shop/netlify/functions/aliexpress-affiliate.js
// Uses AppKey 531720 (Affiliates API — no OAuth needed)

const crypto = require('crypto');

const APP_KEY    = process.env.ALI_AFF_KEY    || '531720';
const APP_SECRET = process.env.ALI_AFF_SECRET || '98Lm9UyKT81kSxaIy9BGj2ISZIHn7A0w';
const TRACKING_ID = process.env.ALI_TRACKING_ID || 'gangaloo_dr';

function signRequest(params) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  const toSign = APP_SECRET + sorted + APP_SECRET;
  return crypto.createHmac('sha256', APP_SECRET).update(toSign).digest('hex').toUpperCase();
}

async function callAffApi(method, extra = {}) {
  const params = {
    method,
    app_key:     APP_KEY,
    timestamp:   new Date().toISOString().replace('T', ' ').replace(/\..+/, ''),
    sign_method: 'sha256',
    ...extra,
  };
  params.sign = signRequest(params);

  const res = await fetch('https://api-sg.aliexpress.com/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  const { action, keywords, category, page = 1, pageSize = 20 } = body;

  // ── Search/query affiliate products ──────────────────────────────────────
  if (!action || action === 'search') {
    try {
      const result = await callAffApi('aliexpress.affiliate.product.query', {
        keywords:          keywords || 'hair extension wig',
        category_ids:      category || '',
        tracking_id:       TRACKING_ID,
        page_no:           page,
        page_size:         pageSize,
        sort:              'SALE_PRICE_ASC',
        target_currency:   'USD',
        target_language:   'EN',
        ship_to_country:   'DO',
        fields: 'product_id,product_title,product_main_image_url,product_detail_url,target_sale_price,target_original_price,sale_price_discount_rate,evaluate_rate,lastest_volume',
      });

      const resp = result?.aliexpress_affiliate_product_query_response?.resp_result;
      if (!resp || resp.resp_code !== 200) {
        return { statusCode: 400, headers, body: JSON.stringify({
          error: resp?.resp_msg || 'API error',
          raw: result,
        })};
      }

      const products = resp.result?.products?.product || [];
      const normalized = products.map(p => ({
        id:          p.product_id,
        title:       p.product_title,
        image:       p.product_main_image_url,
        url:         p.product_detail_url,   // already has affiliate tracking
        price:       p.target_sale_price,
        origPrice:   p.target_original_price,
        discount:    p.sale_price_discount_rate,
        rating:      p.evaluate_rate,
        sold:        p.lastest_volume,
      }));

      return { statusCode: 200, headers, body: JSON.stringify({
        products: normalized,
        total: resp.result?.total_record_count || normalized.length,
        page,
      })};
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
};
