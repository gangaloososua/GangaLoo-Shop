// netlify/functions/google-feed.js
// Generates a Google Merchant Center RSS 2.0 product feed from Supabase.
// Register this URL in Merchant Center → Data sources → Add product source → Scheduled fetch:
//   https://gangaloo.netlify.app/.netlify/functions/google-feed
//
// Env vars required (Netlify → Site config → Environment variables):
//   SUPABASE_URL   = https://xnbkwczolkinurohloxj.supabase.co
//   SUPABASE_KEY   = your anon key (read access to inventory_data is enough)
//   STORE_URL      = https://gangaloo.netlify.app   (no trailing slash)
//   STORE_BRAND    = GangaLoo                       (optional, fallback brand)
//   FEED_CURRENCY  = DOP                            (optional, default DOP)

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_KEY;
const STORE_URL     = (process.env.STORE_URL || 'https://gangaloo.netlify.app').replace(/\/$/, '');
const STORE_BRAND   = process.env.STORE_BRAND || 'GangaLoo';
const FEED_CURRENCY = process.env.FEED_CURRENCY || 'DOP';

// XML-escape helper
function xml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// CDATA wrapper for descriptions (allows free-form text)
function cdata(str) {
  const s = String(str == null ? '' : str);
  return '<![CDATA[' + s.replace(/]]>/g, ']]]]><![CDATA[>') + ']]>';
}

// Pick the best display price for a product
function getPrice(p) {
  const candidates = [p.price, p.finalPrice, p.calculatedPrice, p.salePrice];
  for (const v of candidates) {
    const n = parseFloat(v);
    if (n > 0) return n;
  }
  return 0;
}

function getSalePrice(p, basePrice) {
  const disc = parseFloat(p.discountPrice);
  if (disc > 0 && disc < basePrice) return disc;
  return null;
}

// Sum stock across all warehouses for a given product id
function totalStock(productId, purchases) {
  let total = 0;
  for (const lot of purchases) {
    if (String(lot.productId) !== String(productId)) continue;
    const qty = parseFloat(lot.quantity ?? lot.qty ?? lot.remainingQty ?? 0) || 0;
    total += qty;
  }
  return total;
}

exports.handler = async (event) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, body: 'Missing SUPABASE_URL or SUPABASE_KEY env vars' };
  }

  try {
    // Fetch latest inventory snapshot
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/inventory_data?select=products,purchases,categories&order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      return { statusCode: 502, body: `Supabase error: ${res.status} ${txt}` };
    }

    const rows = await res.json();
    if (!rows.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8' }, body: emptyFeed() };
    }

    const row = rows[0];
    const products   = JSON.parse(row.products   || '[]');
    const purchases  = JSON.parse(row.purchases  || '[]');
    const categories = JSON.parse(row.categories || '[]');
    const catById = new Map(categories.map(c => [String(c.id), c]));

    const items = [];

    for (const p of products) {
      // Skip hidden products
      if (p.visibleInStore === false) continue;

      const price = getPrice(p);
      if (price <= 0) continue;       // no price = skip
      if (!p.name) continue;          // no name = skip
      if (!p.imageUrl || !/^https?:\/\//i.test(p.imageUrl)) continue; // Google requires a valid image URL

      const salePrice = getSalePrice(p, price);
      const stock = totalStock(p.id, purchases);
      const availability = stock > 0 ? 'in stock' : 'out of stock';

      // Resolve product category name (for google's product_type field)
      const pCatIds = (p.categoryIds && p.categoryIds.length ? p.categoryIds : [p.categoryId])
        .filter(Boolean).map(String);
      const catNames = pCatIds.map(id => catById.get(id)?.name).filter(Boolean);
      const productType = catNames.join(' > ');

      const link = `${STORE_URL}/store.html?product=${encodeURIComponent(p.id)}`;
      const description = p.description || p.name;

      const parts = [];
      parts.push(`  <item>`);
      parts.push(`    <g:id>${xml(p.id)}</g:id>`);
      parts.push(`    <g:title>${xml(p.name)}</g:title>`);
      parts.push(`    <g:description>${cdata(description)}</g:description>`);
      parts.push(`    <g:link>${xml(link)}</g:link>`);
      parts.push(`    <g:image_link>${xml(p.imageUrl)}</g:image_link>`);
      parts.push(`    <g:availability>${availability}</g:availability>`);
      parts.push(`    <g:price>${price.toFixed(2)} ${FEED_CURRENCY}</g:price>`);
      if (salePrice) {
        parts.push(`    <g:sale_price>${salePrice.toFixed(2)} ${FEED_CURRENCY}</g:sale_price>`);
      }
      parts.push(`    <g:condition>new</g:condition>`);
      parts.push(`    <g:brand>${xml(p.brand || STORE_BRAND)}</g:brand>`);
      // No UPC/EAN/MPN — tell Google identifiers don't exist
      parts.push(`    <g:identifier_exists>false</g:identifier_exists>`);
      if (p.sku) parts.push(`    <g:mpn>${xml(p.sku)}</g:mpn>`);
      if (productType) parts.push(`    <g:product_type>${xml(productType)}</g:product_type>`);
      parts.push(`  </item>`);

      items.push(parts.join('\n'));
    }

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>GangaLoo</title>
    <link>${xml(STORE_URL)}</link>
    <description>Catálogo de productos GangaLoo</description>
${items.join('\n')}
  </channel>
</rss>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 1h cache; Merchant Center fetches once/day anyway
      },
      body: xmlBody,
    };
  } catch (err) {
    return { statusCode: 500, body: `Feed generation error: ${err.message}` };
  }
};

function emptyFeed() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>GangaLoo</title>
    <link>${STORE_URL}</link>
    <description>Empty feed</description>
  </channel>
</rss>`;
}
