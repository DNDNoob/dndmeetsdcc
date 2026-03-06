import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DungeonButton } from '@/components/ui/DungeonButton';
import { DungeonCard } from '@/components/ui/DungeonCard';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import {
  Plus, Crown, Users, Copy, Trash2, Link, RefreshCw,
  LogOut, UserMinus, X, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Campaign, UserProfile } from '@/lib/gameData';

interface CampaignSelectViewProps {
  myCampaigns: Campaign[];
  joinedCampaigns: Campaign[];
  loading: boolean;
  userProfile: UserProfile | null;
  onCreateCampaign: (name: string, description?: string) => Promise<Campaign | null>;
  onDeleteCampaign: (id: string) => Promise<void>;
  onCopyCampaign: (sourceId: string, newName: string) => Promise<Campaign | null>;
  onJoinCampaign: (inviteCode: string) => Promise<Campaign | null>;
  onLeaveCampaign: (id: string) => Promise<void>;
  onRegenerateInviteCode: (id: string) => Promise<string | null>;
  onSelectCampaign: (campaign: Campaign) => void;
  onSignOut: () => void;
}

const CampaignSelectView: React.FC<CampaignSelectViewProps> = ({
  myCampaigns,
  joinedCampaigns,
  loading,
  userProfile,
  onCreateCampaign,
  onDeleteCampaign,
  onCopyCampaign,
  onJoinCampaign,
  onLeaveCampaign,
  onRegenerateInviteCode,
  onSelectCampaign,
  onSignOut,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copyName, setCopyName] = useState('');
  const [showCopyForm, setShowCopyForm] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;
    setSubmitting(true);
    await onCreateCampaign(newCampaignName.trim(), newCampaignDesc.trim() || undefined);
    setNewCampaignName('');
    setNewCampaignDesc('');
    setShowCreateForm(false);
    setSubmitting(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    setSubmitting(true);
    const campaign = await onJoinCampaign(inviteCodeInput.trim());
    if (campaign) {
      setInviteCodeInput('');
      setShowJoinForm(false);
    }
    setSubmitting(false);
  };

  const handleCopy = async (sourceId: string) => {
    if (!copyName.trim()) return;
    setSubmitting(true);
    await onCopyCampaign(sourceId, copyName.trim());
    setCopyName('');
    setShowCopyForm(null);
    setSubmitting(false);
  };

  const handleCopyInviteLink = (campaign: Campaign) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}join/${campaign.inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Invite link copied!');
    });
  };

  const renderCampaignCard = (campaign: Campaign, isOwner: boolean) => {
    const isExpanded = expandedCampaign === campaign.id;

    return (
      <motion.div
        key={campaign.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        layout
      >
        <DungeonCard className="p-0 overflow-hidden">
          {/* Main clickable area */}
          <button
            onClick={() => onSelectCampaign(campaign)}
            className="w-full text-left p-4 hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm tracking-wider text-foreground truncate">
                    {campaign.name}
                  </h3>
                  {isOwner && (
                    <Crown className="w-3.5 h-3.5 text-accent flex-shrink-0" title="You are the DM" />
                  )}
                </div>
                {campaign.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{campaign.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {campaign.memberIds.length}/{campaign.maxMembers}
                  </span>
                  {isOwner && (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-accent" />
                      DM
                    </span>
                  )}
                  {!isOwner && (
                    <span className="text-muted-foreground">
                      DM: {campaign.ownerName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>

          {/* Action bar */}
          <div className="flex items-center border-t border-border px-2 py-1.5 gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setExpandedCampaign(isExpanded ? null : campaign.id); }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
            >
              {isExpanded ? 'Less' : 'More'}
            </button>
            {isOwner && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyInviteLink(campaign); }}
                  className="text-[10px] text-muted-foreground hover:text-primary px-2 py-1 transition-colors flex items-center gap-1"
                  title="Copy invite link"
                >
                  <Link className="w-3 h-3" />
                  <span className="hidden sm:inline">Invite</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCopyName(`${campaign.name} (Copy)`);
                    setShowCopyForm(campaign.id);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-primary px-2 py-1 transition-colors flex items-center gap-1"
                  title="Copy campaign"
                >
                  <Copy className="w-3 h-3" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(campaign.id); }}
                  className="text-[10px] text-muted-foreground hover:text-destructive px-2 py-1 transition-colors flex items-center gap-1 ml-auto"
                  title="Delete campaign"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
            {!isOwner && (
              <button
                onClick={(e) => { e.stopPropagation(); onLeaveCampaign(campaign.id); }}
                className="text-[10px] text-muted-foreground hover:text-destructive px-2 py-1 transition-colors flex items-center gap-1 ml-auto"
                title="Leave campaign"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            )}
          </div>

          {/* Expanded details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-border"
              >
                <div className="p-3 space-y-2 text-xs">
                  {campaign.description && (
                    <p className="text-muted-foreground">{campaign.description}</p>
                  )}
                  {isOwner && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Invite code:</span>
                      <code className="bg-muted px-2 py-0.5 font-mono text-[10px]">{campaign.inviteCode}</code>
                      <button
                        onClick={() => onRegenerateInviteCode(campaign.id)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Regenerate invite code"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    Members: {campaign.memberIds.length} / {campaign.maxMembers}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Created: {new Date(campaign.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DungeonCard>

        {/* Copy form modal */}
        {showCopyForm === campaign.id && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-background/90"
            onClick={() => setShowCopyForm(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-background border-2 border-primary p-4 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-sm text-primary mb-3">COPY CAMPAIGN</h3>
              <input
                type="text"
                value={copyName}
                onChange={(e) => setCopyName(e.target.value)}
                className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono mb-3 focus:border-primary focus:outline-none"
                placeholder="New campaign name"
                autoFocus
              />
              <div className="flex gap-2">
                <DungeonButton variant="menu" className="flex-1" onClick={() => setShowCopyForm(null)}>
                  Cancel
                </DungeonButton>
                <DungeonButton
                  variant="default"
                  className="flex-1"
                  onClick={() => handleCopy(campaign.id)}
                  disabled={submitting || !copyName.trim()}
                >
                  {submitting ? 'Copying...' : 'Copy'}
                </DungeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete confirmation modal */}
        {confirmDelete === campaign.id && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-background/90"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-background border-2 border-destructive p-4 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-sm text-destructive mb-2">DELETE CAMPAIGN</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete <strong>{campaign.name}</strong> and all its game data
                (episodes, mob placements, maps, etc.). This cannot be undone.
              </p>
              <div className="flex gap-2">
                <DungeonButton variant="menu" className="flex-1" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </DungeonButton>
                <DungeonButton
                  variant="admin"
                  className="flex-1 !border-destructive !text-destructive"
                  onClick={async () => {
                    await onDeleteCampaign(campaign.id);
                    setConfirmDelete(null);
                  }}
                >
                  Delete
                </DungeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary animate-pulse font-display tracking-widest">
          LOADING CAMPAIGNS...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex flex-col bg-background overflow-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl text-primary text-glow-cyan tracking-[0.2em]">
            CAMPAIGNS
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <GoogleAuthButton compact />
          {userProfile && (
            <span className="text-xs text-muted-foreground font-display">
              {userProfile.displayName}
            </span>
          )}
          <DungeonButton variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="w-3.5 h-3.5" />
          </DungeonButton>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Action buttons */}
        <div className="flex gap-2">
          <DungeonButton
            variant="default"
            className="flex items-center gap-2"
            onClick={() => { setShowCreateForm(true); setShowJoinForm(false); }}
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs">New Campaign</span>
          </DungeonButton>
          <DungeonButton
            variant="menu"
            className="flex items-center gap-2"
            onClick={() => { setShowJoinForm(true); setShowCreateForm(false); }}
          >
            <Users className="w-4 h-4" />
            <span className="text-xs">Join Campaign</span>
          </DungeonButton>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <DungeonCard className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-sm text-primary tracking-wider">CREATE CAMPAIGN</h2>
                  <button onClick={() => setShowCreateForm(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-muted-foreground font-display mb-1">CAMPAIGN NAME</label>
                    <input
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="e.g. Curse of the Crimson Throne"
                      className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                      disabled={submitting}
                      autoFocus
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground font-display mb-1">DESCRIPTION (OPTIONAL)</label>
                    <textarea
                      value={newCampaignDesc}
                      onChange={(e) => setNewCampaignDesc(e.target.value)}
                      placeholder="A brief description of your campaign..."
                      className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none resize-none"
                      rows={2}
                      disabled={submitting}
                      maxLength={300}
                    />
                  </div>
                  <DungeonButton
                    variant="default"
                    className="w-full"
                    type="submit"
                    disabled={submitting || !newCampaignName.trim()}
                  >
                    {submitting ? 'Creating...' : 'Create Campaign'}
                  </DungeonButton>
                </form>
              </DungeonCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Join form */}
        <AnimatePresence>
          {showJoinForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <DungeonCard className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-sm text-primary tracking-wider">JOIN CAMPAIGN</h2>
                  <button onClick={() => setShowJoinForm(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleJoin} className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-muted-foreground font-display mb-1">INVITE CODE</label>
                    <input
                      type="text"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      placeholder="Enter invite code..."
                      className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                      disabled={submitting}
                      autoFocus
                    />
                  </div>
                  <DungeonButton
                    variant="default"
                    className="w-full"
                    type="submit"
                    disabled={submitting || !inviteCodeInput.trim()}
                  >
                    {submitting ? 'Joining...' : 'Join Campaign'}
                  </DungeonButton>
                </form>
              </DungeonCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* My Campaigns */}
        {myCampaigns.length > 0 && (
          <div>
            <h2 className="font-display text-xs text-accent tracking-[0.2em] mb-3 flex items-center gap-2">
              <Crown className="w-3.5 h-3.5" />
              MY CAMPAIGNS (DM)
            </h2>
            <div className="space-y-2">
              {myCampaigns.map(c => renderCampaignCard(c, true))}
            </div>
          </div>
        )}

        {/* Joined Campaigns */}
        {joinedCampaigns.length > 0 && (
          <div>
            <h2 className="font-display text-xs text-primary tracking-[0.2em] mb-3 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              JOINED CAMPAIGNS
            </h2>
            <div className="space-y-2">
              {joinedCampaigns.map(c => renderCampaignCard(c, false))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {myCampaigns.length === 0 && joinedCampaigns.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm mb-2">No campaigns yet</p>
            <p className="text-muted-foreground text-xs">
              Create a new campaign to start as the DM, or join one with an invite code.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CampaignSelectView;
