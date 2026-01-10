# Firebase Migration Guide

## What Changed

✅ **Switched from file-based storage to Firebase Firestore**
✅ **Real-time multiplayer support** - Changes sync instantly across all players
✅ **Cloud storage** - No server needed, works on any static host
✅ **Room-based gameplay** - Multiple games can run simultaneously

## Setup Steps

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Name it (e.g., "dndmeetsdcc")
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Set up Firestore Database

1. In Firebase Console, go to **Build > Firestore Database**
2. Click "Create database"
3. **Start in production mode** (we'll set rules next)
4. Choose a location (e.g., us-central)
5. Click "Enable"

### 3. Configure Firestore Security Rules

Go to **Firestore Database > Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write to all documents (you can add auth later)
    match /{document=**} {
      allow read, write: if true;
    }
    
    // Room-based access (optional, for future use)
    match /rooms/{roomId}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

Click "Publish"

### 4. Get Firebase Configuration

1. Go to **Project Settings** (⚙️ icon)
2. Scroll to "Your apps"
3. Click the **</>** (Web) icon
4. Register app with a nickname (e.g., "DnD Web App")
5. Copy the `firebaseConfig` values

### 5. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Firebase values in `.env`:
   ```
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456:web:abcdef
   ```

3. **IMPORTANT**: Never commit `.env` to Git (it's in `.gitignore`)

### 6. Test Locally

```bash
npm run dev
```

Open the app and try:
- Creating a mob
- Creating a crawler
- Refresh the page - data should persist!
- Open in another browser/tab - changes sync in real-time!

### 7. Deploy to Production

#### Option A: GitHub Pages

1. Add environment variables to GitHub Secrets:
   - Go to your repo > Settings > Secrets and variables > Actions
   - Add each `VITE_FIREBASE_*` variable

2. Deploy:
   ```bash
   npm run build
   npm run deploy
   ```

#### Option B: Netlify/Vercel

1. Connect your GitHub repo
2. Add environment variables in the dashboard
3. Deploy automatically on push

## Multiplayer Rooms

### Create a Room

```typescript
const { setRoomId } = useGame();

// Create a unique room ID
const roomId = crypto.randomUUID();
setRoomId(roomId);

// Share this URL with players:
const inviteUrl = `${window.location.origin}?room=${roomId}`;
```

### Join a Room

```typescript
// In your app startup
const params = new URLSearchParams(window.location.search);
const roomId = params.get('room');

if (roomId) {
  setRoomId(roomId);
}
```

## Data Migration

To migrate existing data from the old system:

```typescript
// Old data (from localStorage or server file)
const oldData = JSON.parse(localStorage.getItem('dcc_game_data'));

// Import to Firebase
const { addItem } = useGame();

for (const mob of oldData.mobs) {
  await addItem('mobs', mob);
}

for (const crawler of oldData.crawlers) {
  await addItem('crawlers', crawler);
}

// etc.
```

## Troubleshooting

### "Missing or insufficient permissions"
- Check Firestore Rules - make sure read/write is allowed
- Verify you're using the correct Firebase config

### "Firebase not defined"
- Make sure `.env` file exists with all variables
- Restart the dev server after changing `.env`

### Data not syncing
- Check browser console for errors
- Verify internet connection
- Check Firebase Console > Firestore for data

### "Quota exceeded"
- Free tier limits: 50K reads/day, 20K writes/day
- For production, upgrade to Blaze plan (pay-as-you-go)

## Cost Estimate

**Free Tier (Spark Plan):**
- ✅ 50K document reads/day
- ✅ 20K document writes/day
- ✅ 1GB storage
- ✅ Good for 10-20 active players

**Paid Tier (Blaze - Pay as you go):**
- $0.036 per 100K reads
- $0.108 per 100K writes
- $0.18/GB storage
- Example: 100 active players = ~$1-5/month

## Next Steps

- [ ] Set up Firebase project
- [ ] Configure Firestore
- [ ] Add environment variables
- [ ] Test locally
- [ ] Deploy to production
- [ ] (Optional) Add authentication
- [ ] (Optional) Add file storage for map images
