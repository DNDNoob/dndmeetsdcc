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

### 3. Enable Firebase Authentication

1. In Firebase Console, go to **Build > Authentication**
2. Click "Get started"
3. Go to the **Sign-in method** tab
4. Click on **Anonymous**
5. Toggle **Enable** and click **Save**

This allows users to join without creating accounts while still maintaining security.

### 4. Configure Firestore Security Rules

Go to **Firestore Database > Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only allow authenticated users (including anonymous)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Room-based access - users must be authenticated
    match /rooms/{roomId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click "Publish"

**Security Note**: These rules require users to be authenticated (even anonymously) before accessing data. This prevents unauthorized access while keeping the app easy to use.

### 5. Get Firebase Configuration

1. Go to **Project Settings** (⚙️ icon)
2. Scroll to "Your apps"
3. Click the **</>** (Web) icon
4. Register app with a nickname (e.g., "DnD Web App")
5. Copy the `firebaseConfig` values

### 6. Configure Environment Variables

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

### 7. Test Locally

```bash
npm run dev
```

Open the app and try:
- Creating a mob
- Creating a crawler
- Refresh the page - data should persist!
- Open in another browser/tab - changes sync in real-time!

### 8. Deploy to Production

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

### "Permission denied" errors
- Make sure you completed **Step 3** (Enable Anonymous Authentication)
- Verify security rules in **Step 4** allow `request.auth != null`
- Check browser console for auth initialization messages
- Try refreshing the page - authentication happens automatically

### "Quota exceeded"
- Free tier limits: 50K reads/day, 20K writes/day
- For production, upgrade to Blaze plan (pay-as-you-go)

## Security & Privacy

### Anonymous Authentication
- Users are automatically signed in without creating accounts
- Each user gets a unique anonymous ID
- No personal information is collected
- Sessions persist until browser data is cleared

### Firestore Rules
The security rules (`request.auth != null`) ensure:
- ✅ Only authenticated users can access data
- ✅ Prevents unauthorized access from bots/scripts
- ✅ No rate limiting issues from public access
- ✅ Better quota management

### Future Enhancements
You can later add:
- Email/password authentication
- Room-specific permissions (owners can delete, others can only read)
- User profiles and preferences

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
- [ ] Enable Anonymous Authentication
- [ ] Configure security rules
- [ ] Add environment variables
- [ ] Test locally
- [ ] Deploy to production
- [ ] (Optional) Add file storage for map images
- [ ] (Optional) Upgrade to email/password authentication
