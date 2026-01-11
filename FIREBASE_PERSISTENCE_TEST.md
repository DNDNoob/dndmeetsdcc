# 🧪 Firebase Data Persistence Testing Guide

## Prerequisites

Make sure your `.env` file is configured with Firebase credentials:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Test Checklist

### 1. Authentication Initialization
- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Look for this message: `✅ Authentication ready`
- [ ] Look for: `📂 Setting up real-time sync...`
- [ ] Look for: `✅ Real-time sync active`
- [ ] No auth errors should appear

**Expected Result:** App automatically signs you in anonymously

### 2. Create Test Data (Mob)

1. [ ] Navigate to the Mobs section of the app
2. [ ] Click "Create Mob" or "Add Mob" button
3. [ ] Fill in the form:
   - Name: "Test Dragon"
   - HP: "50"
   - AC: "14"
   - Any other required fields
4. [ ] Click Save
5. [ ] Check browser console for: `✅ Added item: mobs`

**Expected Result:** Mob appears in the list immediately

### 3. Verify Persistence

1. [ ] Refresh the page (F5)
2. [ ] Wait for real-time sync to initialize
3. [ ] Check if "Test Dragon" mob still appears

**Expected Result:** Mob persists after refresh ✅

### 4. Real-time Sync Test

1. [ ] Open the app in a **new browser tab** at same URL
2. [ ] Go to the Mobs section in both tabs
3. [ ] In Tab 1: Create a new mob "Test Sync"
4. [ ] Check Tab 2 - does the mob appear instantly?

**Expected Result:** Mob appears in Tab 2 automatically ✅

### 5. Edit/Update Test

1. [ ] In Tab 1: Edit "Test Dragon" - change HP to "75"
2. [ ] In Tab 2: Check if HP changed automatically

**Expected Result:** Edit syncs in real-time across tabs ✅

### 6. Delete Test

1. [ ] In Tab 1: Delete "Test Sync" mob
2. [ ] In Tab 2: Check if mob disappears automatically

**Expected Result:** Delete syncs in real-time ✅

### 7. Verify in Firebase Console

1. [ ] Go to https://console.firebase.google.com
2. [ ] Select your project
3. [ ] Click **Firestore Database**
4. [ ] Look for collections:
   - [ ] `mobs` collection exists
   - [ ] "Test Dragon" document is there
   - [ ] Contains the correct HP value (75)
5. [ ] Check document data matches what's in the app

**Expected Result:** All data visible in Firebase ✅

### 8. Browser Console - Final Check

In DevTools Console, verify:
- [ ] No red errors
- [ ] No Firebase permission errors
- [ ] Messages show successful sync operations

**Expected Logs:**
```
✅ Authentication ready
📂 Setting up real-time sync... { roomId: null }
✅ Real-time sync active
🔄 Real-time update: mobs [data...]
✅ Added item: mobs [id]
```

## Success Criteria

✅ **All tests passed if:**

1. ✅ Authentication initializes automatically
2. ✅ Data creates and appears immediately
3. ✅ Data persists after page refresh
4. ✅ Changes sync across tabs in real-time
5. ✅ Data visible in Firebase console
6. ✅ No console errors
7. ✅ All CRUD operations work (Create, Read, Update, Delete)

## Troubleshooting

### Error: "Missing or insufficient permissions"
- Check your Firestore Security Rules
- Should be: `allow read, write: if request.auth != null;`
- Make sure Anonymous auth is enabled

### Error: "User attempted to access non-existent route"
- This is a React Router issue, not Firebase
- Check browser DevTools Network tab

### Error: "Cannot read property 'xxx' of undefined"
- Check if Firebase config is correct in `.env`
- Verify all VITE_FIREBASE_* variables are set

### Data not syncing across tabs
- Make sure you're in the same room (no `?room=` in URL for default room)
- Check browser console for sync messages
- Try refreshing both tabs

### Data visible locally but not in Firebase Console
- Check your Firestore database location (us-central1 by default)
- Verify you're in the right project
- Try refreshing the Firestore page

## Files to Check

- **Dev Server Logs:** Look for `[FirebaseStore]` messages
- **Browser Console:** F12 → Console tab
- **Firebase Console:** Firestore Database collections and documents
- **Network Tab:** Check for API calls (F12 → Network)

## Quick Test Command

```bash
# Start dev server
npm run dev

# In another terminal, run diagnostic
./diagnostic.sh
```

---

**Created:** 2026-01-11
**Last Updated:** Testing Guide v1
