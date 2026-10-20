import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DungeonButton } from './ui/DungeonButton';
import { useAuth } from '@/contexts/AuthContext';
import { X, Chrome } from 'lucide-react';

// Google only: the Firestore rules accept saves from Google sign-ins, so email
// accounts could sign in but never save a profile or anything else.
const AuthModal: React.FC = () => {
  const { authModalOpen, closeAuthModal, signInGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (!authModalOpen) return null;

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
            SIGN IN
          </h2>
          <button
            onClick={closeAuthModal}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <DungeonButton
            variant="default"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleGoogleClick}
            disabled={submitting}
          >
            <Chrome className="w-4 h-4" />
            <span className="text-xs">{submitting ? 'Please wait...' : 'Continue with Google'}</span>
          </DungeonButton>

          <p className="text-[10px] text-muted-foreground text-center mt-4">
            New here? Continue with Google creates your account.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AuthModal;
