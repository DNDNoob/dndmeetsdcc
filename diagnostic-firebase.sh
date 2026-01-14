#!/bin/bash
# Firebase Connection Diagnostic Script

echo "🔍 Firebase Connection Diagnostics"
echo "=================================="
echo ""

echo "📝 Checking .env file..."
if [ -f .env ]; then
  echo "✅ .env file exists"
  echo ""
  echo "Environment variables:"
  grep "VITE_FIREBASE" .env | sed 's/=.*/=***/' || echo "❌ No Firebase variables found"
else
  echo "❌ .env file not found"
fi

echo ""
echo "=================================="
echo "🌐 Checking dev server..."
if curl -s http://localhost:8081/dndmeetsdcc/ > /dev/null 2>&1; then
  echo "✅ Dev server is running on port 8081"
else
  echo "❌ Dev server not responding"
fi

echo ""
echo "=================================="
echo "📦 Checking Firebase packages..."
if grep -q "firebase" package.json; then
  echo "✅ Firebase package in package.json"
  npm list firebase 2>/dev/null | grep firebase || echo "Package version unknown"
else
  echo "❌ Firebase not in package.json"
fi

echo ""
echo "=================================="
echo "🔥 Firebase Configuration Status:"
echo ""
echo "Config file: src/lib/firebase.ts"
if [ -f src/lib/firebase.ts ]; then
  echo "✅ Firebase config file exists"
  
  if grep -q "isFirebaseConfigured" src/lib/firebase.ts; then
    echo "✅ Offline mode support detected"
  fi
  
  if grep -q "import.meta.env.VITE_FIREBASE" src/lib/firebase.ts; then
    echo "✅ Using environment variables"
  fi
else
  echo "❌ Firebase config file not found"
fi

echo ""
echo "=================================="
echo "📊 Test Results:"
echo ""
echo "To test Firebase connection, open:"
echo "  http://localhost:8081/dndmeetsdcc/test-firebase.html"
echo ""
echo "To view the main app, open:"
echo "  http://localhost:8081/dndmeetsdcc/"
echo ""
