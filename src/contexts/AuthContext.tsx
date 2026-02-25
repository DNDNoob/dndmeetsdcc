import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  onAuthChange,
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  isAuthenticatedUser,
  isGoogleUser,
} from '@/lib/firebase';
import { toast } from 'sonner';
import type { User } from 'firebase/auth';

interface AuthContextType {
  /** The current Firebase user (anonymous, Google, or email/password). Null while loading. */
  user: User | null;
  /** True if the user is authenticated (Google OR email/password — NOT anonymous). */
  isAuthenticated: boolean;
  /** True if the current user signed in with Google specifically. */
  isGoogle: boolean;
  /** True while the initial auth state is being resolved. */
  loading: boolean;
  /** Sign in with Google popup. */
  signInGoogle: () => Promise<void>;
  /** Create an account with email + password. */
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  /** Sign in with email + password. */
  signInEmail: (email: string, password: string) => Promise<boolean>;
  /** Sign out and revert to anonymous. */
  signOut: () => Promise<void>;
  /** Open the auth modal. */
  openAuthModal: () => void;
  /** Close the auth modal. */
  closeAuthModal: () => void;
  /** Whether the auth modal is open. */
  authModalOpen: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInGoogle = useCallback(async () => {
    try {
      const result = await signInWithGoogle();
      if (result) {
        setAuthModalOpen(false);
        toast.success(`Signed in as ${result.displayName || result.email}`);
      }
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

  const signUp = useCallback(async (email: string, password: string, displayName?: string): Promise<boolean> => {
    try {
      const result = await signUpWithEmail(email, password, displayName);
      if (result) {
        setAuthModalOpen(false);
        toast.success(`Account created! Welcome, ${displayName || email}.`);
        return true;
      }
      return false;
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      const code = firebaseError.code ?? '';
      if (code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists. Try signing in instead.');
      } else if (code === 'auth/weak-password') {
        toast.error('Password is too weak. Use at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        toast.error('Invalid email address.');
      } else {
        toast.error(firebaseError.message || 'Failed to create account.');
      }
      return false;
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await signInWithEmail(email, password);
      if (result) {
        setAuthModalOpen(false);
        toast.success(`Welcome back, ${result.displayName || result.email}!`);
        return true;
      }
      return false;
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      const code = firebaseError.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        toast.error('Too many failed attempts. Please wait a moment and try again.');
      } else {
        toast.error(firebaseError.message || 'Sign-in failed.');
      }
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    toast('Signed out');
  }, []);

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const isAuthenticated = isAuthenticatedUser(user);
  const isGoogle = isGoogleUser(user);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isGoogle,
      loading,
      signInGoogle,
      signUp,
      signInEmail,
      signOut,
      openAuthModal,
      closeAuthModal,
      authModalOpen,
    }}>
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
