import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DungeonButton } from './ui/DungeonButton';
import { LogIn, LogOut } from 'lucide-react';

interface GoogleAuthButtonProps {
  compact?: boolean;
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ compact = false }) => {
  const { user, isAuthenticated, loading, signOut, openAuthModal } = useAuth();

  if (loading) return null;

  if (isAuthenticated && user) {
    const displayLabel = user.displayName || user.email || 'User';
    return (
      <div className="flex items-center gap-2">
        {!compact && (
          <div className="flex items-center gap-1.5">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt=""
                className="w-5 h-5 rounded-full"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="text-xs text-green-400 font-display truncate max-w-[120px]">
              {displayLabel}
            </span>
          </div>
        )}
        <DungeonButton
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="flex items-center gap-1"
          title={`Signed in as ${displayLabel} — click to sign out`}
        >
          <LogOut className="w-3 h-3" />
          <span className="hidden sm:inline text-xs">Sign Out</span>
        </DungeonButton>
      </div>
    );
  }

  return (
    <DungeonButton
      variant="ghost"
      size="sm"
      onClick={openAuthModal}
      className="flex items-center gap-1"
      title="Sign in to enable editing"
    >
      <LogIn className="w-3 h-3" />
      <span className="hidden sm:inline text-xs">Sign In</span>
    </DungeonButton>
  );
};

export default GoogleAuthButton;
