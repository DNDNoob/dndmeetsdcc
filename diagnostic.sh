#!/bin/bash
# Diagnostic script to check deployed site

echo "🔍 D&D Meets DCC Deployment Diagnostic"
echo "======================================"
echo ""

# Check if index.html loads
echo "1️⃣ Checking index.html..."
RESPONSE=$(curl -s -w "\n%{http_code}" https://dndnoob.github.io/dndmeetsdcc/)
STATUS=$(echo "$RESPONSE" | tail -n1)
CONTENT=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "✅ index.html loads successfully (HTTP 200)"
else
  echo "❌ index.html failed (HTTP $STATUS)"
  exit 1
fi

# Extract asset references
echo ""
echo "2️⃣ Checking asset references in HTML..."
JS_FILE=$(echo "$CONTENT" | grep -oP 'src="/dndmeetsdcc/assets/[^"]+\.js"' | sed 's/.*src="//;s/"$//')
CSS_FILE=$(echo "$CONTENT" | grep -oP 'href="/dndmeetsdcc/assets/[^"]+\.css"' | sed 's/.*href="//;s/"$//')

if [ -z "$JS_FILE" ]; then
  echo "⚠️ No JavaScript file found"
else
  echo "  JavaScript: $JS_FILE"
fi

if [ -z "$CSS_FILE" ]; then
  echo "⚠️ No CSS file found"
else
  echo "  CSS: $CSS_FILE"
fi

# Check if assets exist
echo ""
echo "3️⃣ Checking if assets are accessible..."

if [ -n "$JS_FILE" ]; then
  JS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://dndnoob.github.io$JS_FILE")
  if [ "$JS_STATUS" = "200" ]; then
    echo "✅ JavaScript asset accessible (HTTP 200)"
  else
    echo "❌ JavaScript asset failed (HTTP $JS_STATUS)"
  fi
fi

if [ -n "$CSS_FILE" ]; then
  CSS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://dndnoob.github.io$CSS_FILE")
  if [ "$CSS_STATUS" = "200" ]; then
    echo "✅ CSS asset accessible (HTTP 200)"
  else
    echo "❌ CSS asset failed (HTTP $CSS_STATUS)"
  fi
fi

# Check favicon
echo ""
echo "4️⃣ Checking favicon..."
FAVICON_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://dndnoob.github.io/dndmeetsdcc/favicon.svg")
if [ "$FAVICON_STATUS" = "200" ]; then
  echo "✅ Favicon accessible (HTTP 200)"
else
  echo "⚠️ Favicon not found (HTTP $FAVICON_STATUS) - This is usually OK"
fi

echo ""
echo "✅ Site appears to be deployed correctly!"
echo "📝 If you're seeing 404 errors in the browser, try:"
echo "   1. Clear browser cache (Ctrl+Shift+Delete)"
echo "   2. Do a hard refresh (Ctrl+Shift+R)"
echo "   3. Try incognito/private mode"
