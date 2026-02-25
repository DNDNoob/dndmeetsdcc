import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DungeonButton } from './ui/DungeonButton';
import { useAuth } from '@/contexts/AuthContext';
import { X, Mail, Chrome } from 'lucide-react';

type AuthTab = 'signin' | 'signup';

const AuthModal: React.FC = () => {
  const { authModalOpen, closeAuthModal, signInGoogle, signUp, signInEmail } = useAuth();
  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!authModalOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setSubmitting(false);
  };

  const handleTabSwitch = (newTab: AuthTab) => {
    setTab(newTab);
    resetForm();
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (tab === 'signup') {
        await signUp(email, password, displayName || undefined);
      } else {
        await signInEmail(email, password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setSubmitting(true);
    try {
      await signInGoogle();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/90"
      onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal(); }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background border-2 border-primary shadow-lg shadow-primary/20 max-w-sm w-full mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg text-primary text-glow-cyan tracking-wider">
            {tab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </h2>
          <button
            onClick={closeAuthModal}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => handleTabSwitch('signin')}
            className={`flex-1 py-2 text-xs font-display tracking-wider transition-colors ${
              tab === 'signin'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            SIGN IN
          </button>
          <button
            onClick={() => handleTabSwitch('signup')}
            className={`flex-1 py-2 text-xs font-display tracking-wider transition-colors ${
              tab === 'signup'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            CREATE ACCOUNT
          </button>
        </div>

        <div className="p-4">
          {/* Google sign-in */}
          <DungeonButton
            variant="default"
            className="w-full flex items-center justify-center gap-2 mb-4"
            onClick={handleGoogleClick}
            disabled={submitting}
          >
            <Chrome className="w-4 h-4" />
            <span className="text-xs">Continue with Google</span>
          </DungeonButton>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground font-display">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {tab === 'signup' && (
              <div>
                <label className="block text-[10px] text-muted-foreground font-display mb-1">
                  DISPLAY NAME
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                  disabled={submitting}
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] text-muted-foreground font-display mb-1">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                required
                disabled={submitting}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground font-display mb-1">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'signup' ? 'At least 6 characters' : 'Enter password'}
                className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                required
                minLength={tab === 'signup' ? 6 : undefined}
                disabled={submitting}
              />
            </div>

            <DungeonButton
              variant="default"
              className="w-full flex items-center justify-center gap-2"
              type="submit"
              disabled={submitting || !email || !password}
            >
              <Mail className="w-4 h-4" />
              <span className="text-xs">
                {submitting
                  ? 'Please wait...'
                  : tab === 'signup'
                    ? 'Create Account'
                    : 'Sign In'}
              </span>
            </DungeonButton>
          </form>

          {/* Footer hint */}
          <p className="text-[10px] text-muted-foreground text-center mt-4">
            {tab === 'signin'
              ? "Don't have an account? Click CREATE ACCOUNT above."
              : 'Already have an account? Click SIGN IN above.'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AuthModal;
