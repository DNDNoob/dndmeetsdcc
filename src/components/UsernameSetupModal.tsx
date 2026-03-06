import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DungeonButton } from './ui/DungeonButton';
import { useAuth } from '@/contexts/AuthContext';
import { User } from 'lucide-react';

const UsernameSetupModal: React.FC = () => {
  const { needsUsername, user, saveUserProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(() => user?.displayName || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!needsUsername) return null;

  const validateUsername = (value: string): string | null => {
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 24) return 'Username must be 24 characters or less';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    setSubmitting(true);
    setError('');
    const success = await saveUserProfile(username, displayName.trim());
    if (!success) {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/95"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background border-2 border-primary shadow-lg shadow-primary/20 max-w-sm w-full mx-4"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg text-primary text-glow-cyan tracking-wider">
            SET UP PROFILE
          </h2>
        </div>

        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Choose a username and display name to get started.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] text-muted-foreground font-display mb-1">
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="e.g. DragonSlayer42"
                className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                disabled={submitting}
                autoFocus
                maxLength={24}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Letters, numbers, and underscores only. 3-24 characters.
              </p>
            </div>

            <div>
              <label className="block text-[10px] text-muted-foreground font-display mb-1">
                DISPLAY NAME
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setError('');
                }}
                placeholder="Your name"
                className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                disabled={submitting}
                maxLength={50}
              />
            </div>

            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}

            <DungeonButton
              variant="default"
              className="w-full"
              type="submit"
              disabled={submitting || !username || !displayName.trim()}
            >
              {submitting ? 'Saving...' : 'Continue'}
            </DungeonButton>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default UsernameSetupModal;
