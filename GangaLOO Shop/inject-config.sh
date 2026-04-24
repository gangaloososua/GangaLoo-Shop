#!/bin/bash
# Place this file inside: GangaLOO Shop/inject-config.sh
# Set these in Netlify: Site config → Environment variables:
#   SUPABASE_URL  = https://xnbkwczolkinurohloxj.supabase.co
#   SUPABASE_KEY  = your anon key
#   WA_PHONE      = +18292867868

set -e

SHOP="GangaLOO Shop"

echo "Injecting config into HTML files..."

for FILE in \
  "$SHOP/gangaloo-client-form.html" \
  "$SHOP/admin-v2.html" \
  "$SHOP/pos.html"
do
  if [ -f "$FILE" ]; then
    echo "  → $FILE"
    sed -i "s|SUPABASE_URL_PLACEHOLDER|${SUPABASE_URL}|g" "$FILE"
    sed -i "s|SUPABASE_KEY_PLACEHOLDER|${SUPABASE_KEY}|g" "$FILE"
    sed -i "s|WAPHONE_PLACEHOLDER|${WA_PHONE}|g" "$FILE"
  fi
done

echo "Done!"
