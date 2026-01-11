# Firebase Authentication Setup

## What Changed

Your app now uses **Firebase Anonymous Authentication** for better security. This means:

✅ **Secure by default** - Only authenticated users can access your data
✅ **No login required** - Users are automatically signed in anonymously
✅ **Better protection** - Prevents unauthorized bots and scripts from accessing your database
✅ **No user data collected** - Anonymous authentication doesn't require email, password, or any personal info

## How It Works

### 1. Automatic Sign-In
When a user opens your app:
1. App checks if user is authenticated
2. If not, automatically signs them in anonymously
3. User gets a unique anonymous ID
4. All database operations use this authenticated session

### 2. Security Rules
Your Firestore rules now require authentication:
```
allow read, write: if request.auth != null;
```

This replaces the old insecure rules:
```
allow read, write: if true;  // ❌ Old - anyone could access
```

## Setup Steps

### In Firebase Console

1. **Enable Anonymous Authentication** (Step 3 in FIREBASE_SETUP.md)
   - Go to: Build > Authentication > Sign-in method
   - Enable "Anonymous" provider
   - Click Save

2. **Update Security Rules** (Step 4 in FIREBASE_SETUP.md)
   - Go to: Build > Firestore Database > Rules
   - Replace the rules with the secure version
   - Click Publish

### In Your Code

The following files were updated to support authentication:

- **src/lib/firebase.ts** - Added `initAuth()` function
- **src/hooks/useFirebaseStore.ts** - Calls `initAuth()` before accessing Firestore

No other changes needed! 🎉

## Testing

After enabling anonymous auth in Firebase:

1. Run `npm run dev`
2. Open browser console
3. Look for: `✅ Authentication ready`
4. Try creating/editing data
5. Should work normally!

## Troubleshooting

### Error: "Missing or insufficient permissions"

**Cause:** Security rules require authentication but anonymous auth isn't enabled

**Fix:**
1. Go to Firebase Console > Authentication
2. Click "Get started" if you see it
3. Enable Anonymous sign-in method
4. Refresh your app

### Error: "PERMISSION_DENIED"

**Cause:** Security rules are too restrictive or auth failed

**Fix:**
1. Check Firestore rules match the ones in Step 4
2. Make sure the rule is: `if request.auth != null`
3. Check browser console for auth errors
4. Try clearing browser cache and refreshing

### Authentication isn't initializing

**Fix:**
1. Check your Firebase config in `.env`
2. Make sure `VITE_FIREBASE_AUTH_DOMAIN` is set
3. Verify project settings in Firebase Console
4. Check browser console for specific error messages

## User Experience

### What Users See
- **No change!** The app works exactly the same
- No login screen or authentication prompts
- Automatic, seamless authentication in the background

### What Users Don't See
- Anonymous authentication happens automatically
- Each browser gets a unique anonymous ID
- Sessions persist until browser data is cleared

## Privacy & Security

### What We Store
- Anonymous user ID (randomly generated)
- No email, name, or personal information
- No tracking or analytics (unless you add it)

### Session Management
- Sessions persist in browser localStorage
- Clearing browser data signs the user out
- New anonymous ID is created on next visit

### Data Access
- Only authenticated users can read/write data
- Bots and scripts are blocked
- Better protection against abuse

## Future Enhancements

Want to add more authentication options later?

### Email/Password Authentication
```typescript
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

// Sign up
await createUserWithEmailAndPassword(auth, email, password);

// Sign in
await signInWithEmailAndPassword(auth, email, password);
```

### Room-Based Permissions
Update Firestore rules to allow only room owners to delete:
```
match /rooms/{roomId}/{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && 
    (request.auth.uid == resource.data.ownerId || !exists(/databases/$(database)/documents/rooms/$(roomId)));
}
```

### User Profiles
Store user preferences:
```typescript
await setDoc(doc(db, 'users', auth.currentUser.uid), {
  displayName: 'Dungeon Master',
  theme: 'dark',
  createdAt: new Date()
});
```

## Migration Notes

If you had the old insecure rules (`if true`):

1. **Before:** Anyone could read/write your data
2. **After:** Only authenticated users (even anonymous) can access data
3. **Impact:** Existing users will auto-authenticate - no action needed
4. **Benefit:** Much better security and quota management

## Questions?

Check the [Firebase Authentication Docs](https://firebase.google.com/docs/auth/web/anonymous-auth) for more details.
