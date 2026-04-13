// netlify/functions/aliexpress-api.js
const APP_KEY      = process.env.ALI_APP_KEY;
const APP_SECRET   = process.env.ALI_APP_SECRET;
const ACCESS_TOKEN = process.env.ALI_ACCESS_TOKEN;
const REFRESH_TOKEN = process.env.ALI_REFRESH_TOKEN;
const crypto       = require('crypto');

const REST_URL = 'https://api-sg.aliexpress.com/rest';

// ── Signing for /rest endpoint (sha256, path prepended) ──
function restSign(method, params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  const toSign = method + sorted;
  return crypto.createHmac('sha256', APP_SECRET).update(toSign).digest('hex').toUpperCase();
}

function extractProductId(url) {
  const m = url.match(/\/item\/(\d+)/) || url.match(/\/(\d{10,})/) || url.match(/id=(\d+)/);
  return m ? m[1] : null;
}

function parseDsSkuProperties(dto) {
  const groups = {};
  try {
    const props = dto?.ae_sku_property_d_t_o || [];
    props.forEach(prop => {
      const name = prop.sku_property_name;
      const vals = prop.sku_property_value_dtos?.ae_sku_property_value_d_t_o || [];
      if (name && vals.length) {
        groups[name] = vals.map(v => ({
          value: v.property_value_definition_name || v.sku_property_value_name || '',
          image: v.sku_image || null
        })).filter(v => v.value);
      }
    });
  } catch(e) {}
  return groups;
}

async function callRestApi(method, extraParams) {
  const params = {
    app_key:      APP_KEY,
    timestamp:    String(Date.now()),
    sign_method:  'sha256',
    access_token: ACCESS_TOKEN,
    ...extraParams,
  };
  params.sign = restSign(method, params);

  const resp = await fetch(`${REST_URL}${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(params).toString()
  });
  return resp.json();
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const envOk = !!APP_KEY && !!APP_SECRET && !!ACCESS_TOKEN;
  if (!envOk) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({
        error: 'Missing env vars',
        has_key: !!APP_KEY,
        has_secret: !!APP_SECRET,
        has_token: !!ACCESS_TOKEN,
      })
    };
  }

  try {
    const { action, url } = JSON.parse(event.body || '{}');

    if (action !== 'getProduct') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }

    const productId = extractProductId(url || '');
    if (!productId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot extract product ID from URL' }) };
    }

    console.log('[DS] Fetching product:', productId);

    const data = await callRestApi('/ds/product/get', {
      product_id:      productId,
      target_currency: 'USD',
      target_language: 'EN',
      ship_to_country: 'DO',
    });

    console.log('[DS] Response:', JSON.stringify(data).substring(0, 600));

    const result = data?.aliexpress_ds_product_get_response?.result;
    if (!result || (result.rsp_code && result.rsp_code !== 200)) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({
          error: result?.rsp_msg || 'DS API error',
          code: result?.rsp_code,
          raw: data
        })
      };
    }

    const p = result.result || result;

    // Title
    const title = p.ae_item_base_info_dto?.subject || '';

    // Main image
    const imgs = p.ae_multimedia_info_dto?.image_urls || '';
    const mainImage = imgs.split(';')[0].trim() || null;

    // Lowest price from SKUs
    const skus = p.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || [];
    let salePrice = null;
    if (skus.length) {
      const prices = skus
        .map(s => parseFloat(s.offer_sale_price || s.sku_price || '0'))
        .filter(p => p > 0);
      if (prices.length) salePrice = Math.min(...prices).toFixed(2);
    }

    // Variants from sku properties
    const variants = parseDsSkuProperties(p.ae_sku_property_dtos);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        product: {
          product_title:          title,
          product_main_image_url: mainImage,
          target_sale_price:      salePrice,
          product_detail_url:     `https://www.aliexpress.com/item/${productId}.html`,
          product_id:             productId,
        },
        variants,
        _source: 'dropship'
      })
    };

  } catch(e) {
    console.error('[DS] Error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
