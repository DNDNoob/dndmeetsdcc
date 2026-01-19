# Firebase Cloud Function Setup for Freesound API

## Problem
The Freesound API key was exposed in the client-side code, causing rate limiting (2000 requests/day shared across all users).

## Solution
Use a Firebase Cloud Function to proxy Freesound API requests. This:
- Hides the API key server-side
- Adds 1-hour caching to reduce API calls
- Works with your existing Firebase setup

## Setup Instructions

### 1. Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
firebase login
```

### 2. Initialize Firebase Functions (if not already done)
```bash
firebase init functions
```
Select:
- Use an existing project (select your Firebase project)
- TypeScript
- ESLint: Yes
- Install dependencies: Yes

### 3. Install dependencies
```bash
cd functions
npm install
cd ..
```

### 4. Set the Freesound API key as a Firebase secret
```bash
firebase functions:config:set freesound.apikey="YOUR_FREESOUND_API_KEY_HERE"
```

Replace `YOUR_FREESOUND_API_KEY_HERE` with your actual Freesound API key from https://freesound.org/apiv2/apply/

### 5. Deploy the function
```bash
firebase deploy --only functions
```

### 6. Get your function URL
After deployment, you'll see a URL like:
```
https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/freesoundSearch
```

### 7. Update your environment variable
In your `.env` file (or Vercel/deployment environment), set:
```
VITE_SOUND_API_BASE=https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net
```

The app will automatically use `/freesoundSearch?q=query` endpoint.

## Testing Locally

To test the function locally:
```bash
cd functions
npm run serve
```

Then set in your `.env.local`:
```
VITE_SOUND_API_BASE=http://localhost:5001/YOUR-PROJECT-ID/us-central1
```

## Cost
Firebase Cloud Functions free tier includes:
- 2M invocations/month
- 400K GB-seconds/month
- 200K CPU-seconds/month

With caching, this should be more than sufficient for your use case.
