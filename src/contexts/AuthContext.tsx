import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { onAuthChange, signInWithGoogle, signOutGoogle, isGoogleUser } from '@/lib/firebase';
import { toast } from 'sonner';
import type { User } from 'firebase/auth';

interface AuthContextType {
  /** The current Firebase user (anonymous or Google). Null while loading. */
  user: User | null;
  /** True if the current user signed in with Google. */
  isGoogle: boolean;
  /** True while the initial auth state is being resolved. */
  loading: boolean;
  /** Sign in with Google popup. */
  signIn: () => Promise<void>;
  /** Sign out from Google and revert to anonymous. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      const firebaseError = error as { code?: string };
      const code = firebaseError.code ?? '';
      if (code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized for Google sign-in. Ask the admin to add it in Firebase Console.');
      } else {
        toast.error('Google sign-in failed. Please try again.');
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutGoogle();
  }, []);

  const isGoogle = isGoogleUser(user);

  return (
    <AuthContext.Provider value={{ user, isGoogle, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
