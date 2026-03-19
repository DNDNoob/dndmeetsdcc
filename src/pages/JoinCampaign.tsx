import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DungeonButton } from '@/components/ui/DungeonButton';
import { useAuth } from '@/contexts/AuthContext';
import { useCampaigns } from '@/hooks/useCampaigns';
import { Users, LogIn } from 'lucide-react';

const JoinCampaign: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { joinCampaignByCode } = useCampaigns(user?.uid ?? null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  // Auto-join once authenticated
  useEffect(() => {
    if (isAuthenticated && inviteCode && !joining && !joined) {
      handleJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, inviteCode]);

  const handleJoin = async () => {
    if (!inviteCode) return;
    setJoining(true);
    setError('');
    const campaign = await joinCampaignByCode(inviteCode);
    setJoining(false);
    if (campaign) {
      setJoined(true);
      // Navigate to the main page — the campaign will appear in their list
      setTimeout(() => navigate('/app', { replace: true }), 1500);
    } else {
      setError('Failed to join campaign. The invite code may be invalid or the campaign is full.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background border-2 border-primary shadow-lg shadow-primary/20 max-w-sm w-full mx-4 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="font-display text-xl text-primary text-glow-cyan tracking-wider">
            JOIN CAMPAIGN
          </h1>
        </div>

        {joined ? (
          <div className="text-center py-4">
            <p className="text-primary font-display tracking-wider mb-2">JOINED!</p>
            <p className="text-sm text-muted-foreground">Redirecting to campaigns...</p>
          </div>
        ) : joining ? (
          <div className="text-center py-4">
            <p className="text-primary animate-pulse font-display tracking-wider">JOINING...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need to sign in before joining a campaign.
            </p>
            <DungeonButton
              variant="default"
              className="w-full flex items-center justify-center gap-2"
              onClick={openAuthModal}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Join</span>
            </DungeonButton>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <div className="flex gap-2">
              <DungeonButton variant="menu" className="flex-1" onClick={() => navigate('/app', { replace: true })}>
                Go Home
              </DungeonButton>
              <DungeonButton variant="default" className="flex-1" onClick={handleJoin}>
                Retry
              </DungeonButton>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Processing invite...</p>
        )}
      </motion.div>
    </motion.div>
  );
};

export default JoinCampaign;
