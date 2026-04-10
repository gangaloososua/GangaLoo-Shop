// netlify/functions/aliexpress-api.js
const APP_KEY     = process.env.ALI_APP_KEY;
const APP_SECRET  = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID || 'gangaloo';

if (!APP_KEY || !APP_SECRET) {
  console.error('Missing ALI_APP_KEY or ALI_APP_SECRET environment variables');
}

const API_URL = 'https://api-sg.aliexpress.com/sync';

// ── MD5 (no external deps) ──
function md5(str) {
  function safeAdd(x,y){const lsw=(x&0xffff)+(y&0xffff);const msw=(x>>16)+(y>>16)+(lsw>>16);return(msw<<16)|(lsw&0xffff);}
  function bitRotateLeft(num,cnt){return(num<<cnt)|(num>>>(32-cnt));}
  function md5cmn(q,a,b,x,s,t){return safeAdd(bitRotateLeft(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b);}
  function md5ff(a,b,c,d,x,s,t){return md5cmn((b&c)|((~b)&d),a,b,x,s,t);}
  function md5gg(a,b,c,d,x,s,t){return md5cmn((b&d)|(c&(~d)),a,b,x,s,t);}
  function md5hh(a,b,c,d,x,s,t){return md5cmn(b^c^d,a,b,x,s,t);}
  function md5ii(a,b,c,d,x,s,t){return md5cmn(c^(b|(~d)),a,b,x,s,t);}
  function strToUTF8Arr(str){const arr=[];for(let i=0;i<str.length;i++){let c=str.charCodeAt(i);if(c<128)arr.push(c);else if(c<2048){arr.push(192+(c>>6));arr.push(128+(c&63));}else{arr.push(224+(c>>12));arr.push(128+((c>>6)&63));arr.push(128+(c&63));}}return arr;}
  const bytes=strToUTF8Arr(str);const len8=bytes.length;const len32=Math.ceil((len8+9)/64)*16;
  const M=new Array(len32).fill(0);
  for(let i=0;i<len8;i++)M[i>>2]|=bytes[i]<<((i%4)*8);
  M[len8>>2]|=0x80<<((len8%4)*8);M[len32-2]=len8*8;
  let a=1732584193,b=-271733879,c=-1732584194,d=271733878;
  for(let i=0;i<len32;i+=16){const[oa,ob,oc,od]=[a,b,c,d];
    a=md5ff(a,b,c,d,M[i],7,-680876936);d=md5ff(d,a,b,c,M[i+1],12,-389564586);c=md5ff(c,d,a,b,M[i+2],17,606105819);b=md5ff(b,c,d,a,M[i+3],22,-1044525330);
    a=md5ff(a,b,c,d,M[i+4],7,-176418897);d=md5ff(d,a,b,c,M[i+5],12,1200080426);c=md5ff(c,d,a,b,M[i+6],17,-1473231341);b=md5ff(b,c,d,a,M[i+7],22,-45705983);
    a=md5ff(a,b,c,d,M[i+8],7,1770035416);d=md5ff(d,a,b,c,M[i+9],12,-1958414417);c=md5ff(c,d,a,b,M[i+10],17,-42063);b=md5ff(b,c,d,a,M[i+11],22,-1990404162);
    a=md5ff(a,b,c,d,M[i+12],7,1804603682);d=md5ff(d,a,b,c,M[i+13],12,-40341101);c=md5ff(c,d,a,b,M[i+14],17,-1502002290);b=md5ff(b,c,d,a,M[i+15],22,1236535329);
    a=md5gg(a,b,c,d,M[i+1],5,-165796510);d=md5gg(d,a,b,c,M[i+6],9,-1069501632);c=md5gg(c,d,a,b,M[i+11],14,643717713);b=md5gg(b,c,d,a,M[i],20,-373897302);
    a=md5gg(a,b,c,d,M[i+5],5,-701558691);d=md5gg(d,a,b,c,M[i+10],9,38016083);c=md5gg(c,d,a,b,M[i+15],14,-660478335);b=md5gg(b,c,d,a,M[i+4],20,-405537848);
    a=md5gg(a,b,c,d,M[i+9],5,568446438);d=md5gg(d,a,b,c,M[i+14],9,-1019803690);c=md5gg(c,d,a,b,M[i+3],14,-187363961);b=md5gg(b,c,d,a,M[i+8],20,1163531501);
    a=md5gg(a,b,c,d,M[i+13],5,-1444681467);d=md5gg(d,a,b,c,M[i+2],9,-51403784);c=md5gg(c,d,a,b,M[i+7],14,1735328473);b=md5gg(b,c,d,a,M[i+12],20,-1926607734);
    a=md5hh(a,b,c,d,M[i+5],4,-378558);d=md5hh(d,a,b,c,M[i+8],11,-2022574463);c=md5hh(c,d,a,b,M[i+11],16,1839030562);b=md5hh(b,c,d,a,M[i+14],23,-35309556);
    a=md5hh(a,b,c,d,M[i+1],4,-1530992060);d=md5hh(d,a,b,c,M[i+4],11,1272893353);c=md5hh(c,d,a,b,M[i+7],16,-155497632);b=md5hh(b,c,d,a,M[i+10],23,-1094730640);
    a=md5hh(a,b,c,d,M[i+13],4,681279174);d=md5hh(d,a,b,c,M[i],11,-358537222);c=md5hh(c,d,a,b,M[i+3],16,-722521979);b=md5hh(b,c,d,a,M[i+6],23,76029189);
    a=md5hh(a,b,c,d,M[i+9],4,-640364487);d=md5hh(d,a,b,c,M[i+12],11,-421815835);c=md5hh(c,d,a,b,M[i+15],16,530742520);b=md5hh(b,c,d,a,M[i+2],23,-995338651);
    a=md5ii(a,b,c,d,M[i],6,-198630844);d=md5ii(d,a,b,c,M[i+7],10,1126891415);c=md5ii(c,d,a,b,M[i+14],15,-1416354905);b=md5ii(b,c,d,a,M[i+5],21,-57434055);
    a=md5ii(a,b,c,d,M[i+12],6,1700485571);d=md5ii(d,a,b,c,M[i+3],10,-1894986606);c=md5ii(c,d,a,b,M[i+10],15,-1051523);b=md5ii(b,c,d,a,M[i+1],21,-2054922799);
    a=md5ii(a,b,c,d,M[i+8],6,1873313359);d=md5ii(d,a,b,c,M[i+15],10,-30611744);c=md5ii(c,d,a,b,M[i+6],15,-1560198380);b=md5ii(b,c,d,a,M[i+13],21,1309151649);
    a=md5ii(a,b,c,d,M[i+4],6,-145523070);d=md5ii(d,a,b,c,M[i+11],10,-1120210379);c=md5ii(c,d,a,b,M[i+2],15,718787259);b=md5ii(b,c,d,a,M[i+9],21,-343485551);
    a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od);
  }
  return [a,b,c,d].map(n=>{const h=[];for(let i=0;i<4;i++)h.push(('0'+((n>>(i*8))&0xff).toString(16)).slice(-2));return h.join('');}).join('');
}

function signRequest(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return md5(APP_SECRET + sorted + APP_SECRET).toUpperCase();
}

function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function extractProductId(url) {
  const match = url.match(/\/item\/(\d+)\.html/) || url.match(/\/(\d+)\.html/) || url.match(/id=(\d+)/);
  return match ? match[1] : null;
}

// ── Parse SKU attributes into clean groups ──
// Returns e.g. { Color: ['Red','Blue'], Size: ['S','M','L'], Length: ['10"','12"'] }
function parseSkuAttributes(skuInfo) {
  const groups = {};
  try {
    const props = skuInfo?.aeop_sku_property_dtos?.aeop_sku_property_d_t_o || [];
    props.forEach(prop => {
      const name = prop.sku_property_name;
      const values = prop.aeop_sku_property_value_dtos?.aeop_sku_property_value_d_t_o || [];
      if (name && values.length) {
        groups[name] = values.map(v => ({
          value: v.sku_property_value_name || v.property_value_definition_name || '',
          image: v.sku_image || null,
          id: v.property_value_id || null
        })).filter(v => v.value);
      }
    });
  } catch(e) {
    console.error('SKU parse error:', e.message);
  }
  return groups;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const action = body.action;

    // ── GET PRODUCT + SKU VARIANTS ──
    if (action === 'getProduct') {
      const { url } = body;
      const productId = extractProductId(url);
      if (!productId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Could not extract product ID from URL' }) };

      // Call both APIs in parallel
      const [productResp, skuResp] = await Promise.all([
        // 1. Standard affiliate product detail
        (async () => {
          const params = {
            app_key: APP_KEY,
            method: 'aliexpress.affiliate.productdetail.get',
            sign_method: 'md5',
            timestamp: getTimestamp(),
            v: '2.0',
            fields: 'product_id,product_title,product_main_image_url,product_small_image_urls,target_sale_price,target_original_price,target_sale_price_currency,commission_rate,shop_id,shop_url,product_detail_url,evaluate_rate,lastest_volume',
            product_ids: productId,
            tracking_id: TRACKING_ID,
            target_currency: 'USD',
            target_language: 'EN',
          };
          params.sign = signRequest(params);
          const r = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
            body: new URLSearchParams(params).toString()
          });
          return r.json();
        })(),

        // 2. SKU Dimension API — product detail at SKU level
        (async () => {
          try {
            const params = {
              app_key: APP_KEY,
              method: 'aliexpress.affiliate.product.smartmatch',
              sign_method: 'md5',
              timestamp: getTimestamp(),
              v: '2.0',
              product_id: productId,
              target_currency: 'USD',
              target_language: 'EN',
              tracking_id: TRACKING_ID,
            };
            // Try SKU detail method
            const skuParams = {
              app_key: APP_KEY,
              method: 'aliexpress.ds.product.get',
              sign_method: 'md5',
              timestamp: getTimestamp(),
              v: '2.0',
              product_id: productId,
              ship_to_country: 'US',
              target_currency: 'USD',
              target_language: 'en',
            };
            skuParams.sign = signRequest(skuParams);
            const r = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
              body: new URLSearchParams(skuParams).toString()
            });
            return r.json();
          } catch(e) {
            return null;
          }
        })()
      ]);

      // Parse standard product
      const result = productResp?.aliexpress_affiliate_productdetail_get_response?.resp_result;
      if (!result || result.resp_code !== 200) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: result?.resp_msg || 'API error', raw: productResp }) };
      }
      const products = result.result?.products?.product;
      if (!products || !products.length) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Product not found' }) };
      }
      const product = products[0];

      // Parse SKU attributes from DS product response
      let variants = {};
      let skuList = [];
      try {
        const dsResult = skuResp?.aliexpress_ds_product_get_response?.result;
        if (dsResult) {
          const skuInfo = dsResult.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || [];
          // Get property names from first SKU
          const propNames = {};
          if (skuInfo.length > 0) {
            const firstSku = skuInfo[0];
            (firstSku.ae_sku_property_dtos?.ae_sku_property_d_t_o || []).forEach(p => {
              propNames[p.property_id] = p.sku_property_name;
            });
          }
          // Group all unique values per property
          skuInfo.forEach(sku => {
            (sku.ae_sku_property_dtos?.ae_sku_property_d_t_o || []).forEach(prop => {
              const name = prop.sku_property_name || propNames[prop.property_id] || ('Attr '+prop.property_id);
              if (!variants[name]) variants[name] = [];
              const val = prop.property_value_definition_name || prop.sku_property_value;
              if (val && !variants[name].find(v => v.value === val)) {
                variants[name].push({
                  value: val,
                  image: prop.sku_image || null
                });
              }
            });
            // Also collect SKU list with prices
            skuList.push({
              skuId: sku.sku_id,
              price: sku.sku_price,
              salePrice: sku.offer_sale_price,
              stock: sku.sku_available_stock,
              attrs: (sku.ae_sku_property_dtos?.ae_sku_property_d_t_o || []).map(p => ({
                name: p.sku_property_name,
                value: p.property_value_definition_name || p.sku_property_value
              }))
            });
          });
        }
      } catch(e) {
        console.error('SKU parse error:', e.message);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ product, variants, skuList })
      };
    }

    // ── GENERATE AFFILIATE LINK ──
    if (action === 'getLink') {
      const { url } = body;
      const params = {
        app_key: APP_KEY,
        method: 'aliexpress.affiliate.link.generate',
        sign_method: 'md5',
        timestamp: getTimestamp(),
        v: '2.0',
        promotion_link_type: '0',
        source_values: url,
        tracking_id: TRACKING_ID,
      };
      params.sign = signRequest(params);
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams(params).toString()
      });
      const data = await resp.json();
      const result = data?.aliexpress_affiliate_link_generate_response?.resp_result;
      if (!result || result.resp_code !== 200) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: result?.resp_msg || 'API error' }) };
      }
      const links = result.result?.promotion_links?.promotion_link;
      return { statusCode: 200, headers, body: JSON.stringify({ link: links?.[0]?.promotion_link || url }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
