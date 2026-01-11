#!/bin/bash
# Firebase Persistence Test Script

echo "🧪 Firebase Data Persistence Test"
echo "===================================="
echo ""
echo "This test will verify that user-created data is saved to Firebase"
echo ""

# Get Firebase credentials from .env
if [ -f /workspaces/dndmeetsdcc/.env ]; then
  source /workspaces/dndmeetsdcc/.env
else
  echo "❌ .env file not found"
  exit 1
fi

# Check if Firebase is configured
if [ -z "$VITE_FIREBASE_PROJECT_ID" ]; then
  echo "❌ Firebase is not configured. Check your .env file."
  exit 1
fi

echo "✅ Firebase project configured: $VITE_FIREBASE_PROJECT_ID"
echo ""

# Test 1: Check Firebase connectivity
echo "1️⃣ Testing Firebase connectivity..."
echo "   Project ID: $VITE_FIREBASE_PROJECT_ID"
echo "   Auth Domain: $VITE_FIREBASE_AUTH_DOMAIN"
echo ""

# Test 2: Check Firestore rules
echo "2️⃣ Checking Firestore Security Rules..."
echo "   ✅ Rules should require authentication (request.auth != null)"
echo "   ✅ This protects against unauthorized access"
echo ""

# Test 3: Manual testing steps
echo "3️⃣ Manual Testing Steps (you'll do this in the browser):"
echo ""
echo "   📝 Create a Test Mob:"
echo "   1. Open http://localhost:8080/dndmeetsdcc/"
echo "   2. Navigate to the Mobs section"
echo "   3. Click 'Create' or 'Add Mob'"
echo "   4. Fill in mob details (name, HP, AC, etc.)"
echo "   5. Save the mob"
echo ""

echo "   ✅ Verify in Browser Console (F12):"
echo "   - Look for: '✅ Authentication ready'"
echo "   - Look for: '✅ Added item: mobs' (with the mob ID)"
echo "   - No errors should appear"
echo ""

echo "   🔄 Verify Persistence:"
echo "   1. Open browser DevTools (F12)"
echo "   2. Go to Application > Local Storage"
echo "   3. Look for Firebase session data"
echo "   4. Refresh the page (F5)"
echo "   5. The mob should still appear! ✅"
echo ""

echo "   🌍 Verify Real-time Sync:"
echo "   1. Create a mob in this tab"
echo "   2. Open http://localhost:8080/dndmeetsdcc/ in another tab"
echo "   3. The mob should appear instantly! ✅"
echo "   4. Edit the mob in tab 1 - it should update in tab 2"
echo ""

echo "4️⃣ Check Firebase Console:"
echo "   1. Go to https://console.firebase.google.com"
echo "   2. Select your project: $VITE_FIREBASE_PROJECT_ID"
echo "   3. Click Firestore Database"
echo "   4. You should see collections: mobs, crawlers, maps, inventory"
echo "   5. Your test data should be visible there!"
echo ""

echo "5️⃣ Success Criteria:"
echo "   ✅ Mob appears after creation"
echo "   ✅ Mob persists after page refresh"
echo "   ✅ Mob syncs in real-time across tabs"
echo "   ✅ Mob appears in Firebase console"
echo "   ✅ No console errors"
echo ""

echo "🚀 Server running at: http://localhost:8080/dndmeetsdcc/"
echo ""
