// netlify/functions/aliexpress-api.js
const APP_KEY    = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;

const API_URL = 'https://api-sg.aliexpress.com/sync';

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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers, body: JSON.stringify({error:'Method not allowed'}) };

  // Always return env status so we can debug
  const envOk = !!APP_KEY && !!APP_SECRET;
  const envDebug = {
    has_key: !!APP_KEY,
    has_secret: !!APP_SECRET,
    key_preview: APP_KEY ? String(APP_KEY).substring(0,6)+'...' : 'MISSING',
    secret_preview: APP_SECRET ? String(APP_SECRET).substring(0,6)+'...' : 'MISSING',
  };

  if (!envOk) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({
        error: 'ENV VARS MISSING — add ALI_APP_KEY and ALI_APP_SECRET in Netlify → Site configuration → Environment variables, then redeploy.',
        env: envDebug
      })
    };
  }

  try {
    const { action, url } = JSON.parse(event.body || '{}');

    if (action !== 'getProduct') {
      return { statusCode:400, headers, body: JSON.stringify({error:'Unknown action'}) };
    }

    const productId = extractProductId(url || '');
    if (!productId) {
      return { statusCode:400, headers, body: JSON.stringify({error:'Cannot extract product ID from URL'}) };
    }

    // ── Try DS API first ──
    const dsParams = {
      app_key: APP_KEY,
      method: 'aliexpress.ds.product.get',
      sign_method: 'md5',
      timestamp: getTimestamp(),
      v: '2.0',
      product_id: productId,
      target_currency: 'USD',
      target_language: 'EN',
      ship_to_country: 'DO',
    };
    dsParams.sign = signRequest(dsParams);

    const dsResp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(dsParams).toString()
    });
    const dsData = await dsResp.json();
    console.log('[DS]', JSON.stringify(dsData).substring(0, 800));

    const dsResult = dsData?.aliexpress_ds_product_get_response?.result;

    if (dsResult && (!dsResult.rsp_code || dsResult.rsp_code === 200)) {
      const p = dsResult.result || dsResult;
      const title = p.ae_item_base_info_dto?.subject || '';
      const imgs = p.ae_multimedia_info_dto?.image_urls || '';
      const mainImage = imgs.split(';')[0].trim() || null;
      const skus = p.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || [];
      const cheapestSku = skus.reduce((min, s) => {
        const price = parseFloat(s.offer_sale_price || s.sku_price || '999999');
        return price < min.price ? {price, sku: s} : min;
      }, {price: 999999, sku: null});
      const salePrice = cheapestSku.sku ? cheapestSku.price.toFixed(2) : null;
      const variants = parseDsSkuProperties(p.ae_sku_property_dtos);

      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          product: {
            product_title: title,
            product_main_image_url: mainImage,
            target_sale_price: salePrice,
            product_detail_url: `https://www.aliexpress.com/item/${productId}.html`,
            product_id: productId,
          },
          variants,
          _source: 'dropship'
        })
      };
    }

    // ── Fallback: Affiliate API ──
    const afParams = {
      app_key: APP_KEY,
      method: 'aliexpress.affiliate.productdetail.get',
      sign_method: 'md5',
      timestamp: getTimestamp(),
      v: '2.0',
      fields: 'product_id,product_title,product_main_image_url,target_sale_price,target_original_price,product_detail_url',
      product_ids: productId,
      tracking_id: 'gangaloo',
      target_currency: 'USD',
      target_language: 'EN',
    };
    afParams.sign = signRequest(afParams);

    const afResp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(afParams).toString()
    });
    const afData = await afResp.json();
    console.log('[AF]', JSON.stringify(afData).substring(0, 800));

    const afResult = afData?.aliexpress_affiliate_productdetail_get_response?.resp_result;
    if (afResult?.resp_code === 200) {
      const afProduct = afResult.result?.products?.product?.[0];
      if (afProduct) {
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ product: afProduct, variants: {}, _source: 'affiliate' })
        };
      }
    }

    // Both failed — return everything for debugging
    return {
      statusCode: 400, headers,
      body: JSON.stringify({
        error: 'Ambas APIs fallaron. Ver detalle para diagnóstico.',
        env: envDebug,
        ds_response: dsData,
        af_response: afData,
      })
    };

  } catch(e) {
    return { statusCode:500, headers, body: JSON.stringify({error: e.message, stack: e.stack?.substring(0,300)}) };
  }
};
