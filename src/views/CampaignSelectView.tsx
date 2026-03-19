import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DungeonButton } from '@/components/ui/DungeonButton';
import { DungeonCard } from '@/components/ui/DungeonCard';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import {
  Plus, Crown, Users, Copy, Trash2, Link, RefreshCw,
  LogOut, UserMinus, X, Shield, UserPlus, Check, Clock,
  Heart, Settings, Globe, Lock, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Campaign, UserProfile, FriendRequest, UserDecision } from '@/lib/gameData';
import { db, collection, query, where, getDocs } from '@/lib/firebase';

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
  // Friends
  friends: FriendRequest[];
  pendingReceived: FriendRequest[];
  pendingSent: FriendRequest[];
  onSendFriendRequest: (username: string) => Promise<boolean>;
  onAcceptFriendRequest: (requestId: string) => Promise<void>;
  onDeclineFriendRequest: (requestId: string) => Promise<void>;
  onRemoveFriend: (requestId: string) => Promise<void>;
  onCancelFriendRequest: (requestId: string) => Promise<void>;
  onUpdateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onLogDecision: (action: string, label: string, opts?: { oldValue?: unknown; newValue?: unknown; context?: string }) => Promise<void>;
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
  friends,
  pendingReceived,
  pendingSent,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemoveFriend,
  onCancelFriendRequest,
  onUpdateUserProfile,
  onLogDecision,
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
  const [showFriends, setShowFriends] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [confirmRemoveFriend, setConfirmRemoveFriend] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAgeWarning, setShowAgeWarning] = useState(false);
  const [decisionHistory, setDecisionHistory] = useState<UserDecision[]>([]);
  const [showDecisionHistory, setShowDecisionHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load decision history when the user opens Account Settings
  useEffect(() => {
    if (!showSettings || !userProfile?.id || !db) return;
    setLoadingHistory(true);
    const q = query(collection(db, 'userDecisions'), where('userId', '==', userProfile.id));
    getDocs(q)
      .then((snap) => {
        const docs = snap.docs
          .map(d => d.data() as UserDecision)
          .sort((a, b) => b.timestamp - a.timestamp);
        setDecisionHistory(docs);
      })
      .catch((err) => console.error('[CampaignSelect] Failed to load decision history:', err))
      .finally(() => setLoadingHistory(false));
  }, [showSettings, userProfile?.id]);

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

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendUsername.trim()) return;
    setSubmitting(true);
    const success = await onSendFriendRequest(friendUsername.trim());
    if (success) {
      setFriendUsername('');
    }
    setSubmitting(false);
  };

  // Get the "other person" info from a friend request relative to current user
  const getFriendInfo = (req: FriendRequest) => {
    const isFromMe = req.fromUserId === userProfile?.id;
    return {
      displayName: isFromMe ? req.toDisplayName : req.fromDisplayName,
      username: isFromMe ? req.toUsername : req.fromUsername,
      avatarUrl: isFromMe ? req.toAvatarUrl : req.fromAvatarUrl,
    };
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
                  aria-label="Delete campaign"
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
      role="main"
      aria-label="Campaign selection"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
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
          <DungeonButton variant="ghost" size="sm" onClick={onSignOut} aria-label="Sign out">
            <LogOut className="w-3.5 h-3.5" />
          </DungeonButton>
        </div>
      </header>

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

        {/* Friends Section */}
        <div className="border-t border-border pt-6">
          <button
            onClick={() => setShowFriends(!showFriends)}
            className="flex items-center gap-2 w-full text-left mb-4"
          >
            <Heart className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm text-primary tracking-[0.2em]">
              FRIENDS
            </h2>
            {pendingReceived.length > 0 && (
              <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingReceived.length}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {showFriends ? 'Hide' : 'Show'}
            </span>
          </button>

          <AnimatePresence>
            {showFriends && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                {/* Add friend form */}
                <DungeonCard className="p-4">
                  <h3 className="font-display text-xs text-primary tracking-wider mb-3 flex items-center gap-2">
                    <UserPlus className="w-3.5 h-3.5" />
                    ADD FRIEND
                  </h3>
                  <form onSubmit={handleSendFriendRequest} className="flex gap-2">
                    <input
                      type="text"
                      value={friendUsername}
                      onChange={(e) => setFriendUsername(e.target.value)}
                      placeholder="Enter username..."
                      className="flex-1 bg-muted border border-border px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                      disabled={submitting}
                    />
                    <DungeonButton
                      variant="default"
                      type="submit"
                      disabled={submitting || !friendUsername.trim()}
                    >
                      <UserPlus className="w-4 h-4" />
                    </DungeonButton>
                  </form>
                </DungeonCard>

                {/* Pending received requests */}
                {pendingReceived.length > 0 && (
                  <div>
                    <h3 className="font-display text-xs text-accent tracking-[0.2em] mb-2 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      INCOMING REQUESTS ({pendingReceived.length})
                    </h3>
                    <div className="space-y-2">
                      {pendingReceived.map(req => {
                        const info = getFriendInfo(req);
                        return (
                          <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <DungeonCard className="p-3">
                              <div className="flex items-center gap-3">
                                {info.avatarUrl ? (
                                  <img src={info.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-display text-foreground truncate">{info.displayName}</p>
                                  <p className="text-[10px] text-muted-foreground">@{info.username}</p>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => onAcceptFriendRequest(req.id)}
                                    className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                                    title="Accept"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => onDeclineFriendRequest(req.id)}
                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    title="Decline"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </DungeonCard>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pending sent requests */}
                {pendingSent.length > 0 && (
                  <div>
                    <h3 className="font-display text-xs text-muted-foreground tracking-[0.2em] mb-2 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      SENT REQUESTS ({pendingSent.length})
                    </h3>
                    <div className="space-y-2">
                      {pendingSent.map(req => {
                        const info = getFriendInfo(req);
                        return (
                          <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <DungeonCard className="p-3">
                              <div className="flex items-center gap-3">
                                {info.avatarUrl ? (
                                  <img src={info.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-display text-foreground truncate">{info.displayName}</p>
                                  <p className="text-[10px] text-muted-foreground">@{info.username}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">Pending</span>
                                  <button
                                    onClick={() => onCancelFriendRequest(req.id)}
                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    title="Cancel request"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </DungeonCard>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Friend list */}
                {friends.length > 0 && (
                  <div>
                    <h3 className="font-display text-xs text-primary tracking-[0.2em] mb-2 flex items-center gap-2">
                      <Heart className="w-3.5 h-3.5" />
                      MY FRIENDS ({friends.length})
                    </h3>
                    <div className="space-y-2">
                      {friends.map(req => {
                        const info = getFriendInfo(req);
                        return (
                          <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <DungeonCard className="p-3">
                              <div className="flex items-center gap-3">
                                {info.avatarUrl ? (
                                  <img src={info.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-display text-foreground truncate">{info.displayName}</p>
                                  <p className="text-[10px] text-muted-foreground">@{info.username}</p>
                                </div>
                                {confirmRemoveFriend === req.id ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-destructive">Remove?</span>
                                    <button
                                      onClick={() => { onRemoveFriend(req.id); setConfirmRemoveFriend(null); }}
                                      className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setConfirmRemoveFriend(null)}
                                      className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmRemoveFriend(req.id)}
                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    title="Remove friend"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </DungeonCard>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty friends state */}
                {friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground text-xs">
                      No friends yet. Add a friend by entering their username above.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Account Settings Section */}
        {userProfile && (
          <div className="border-t border-border pt-6">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 w-full text-left mb-4"
            >
              <Settings className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm text-primary tracking-[0.2em]">
                ACCOUNT SETTINGS
              </h2>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {showSettings ? 'Hide' : 'Show'}
              </span>
            </button>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <DungeonCard className="p-4 space-y-3">
                    <h3 className="font-display text-xs text-primary tracking-wider flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" />
                      CONTENT PREFERENCES
                    </h3>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {userProfile.showPublicContent
                            ? <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                            : <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          }
                          <span className="text-sm font-display">
                            {userProfile.showPublicContent ? 'Public Content: On' : 'Public Content: Off'}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 ml-5">
                          {userProfile.showPublicContent
                            ? 'You can see items and spells shared publicly by other players.'
                            : 'Only see content from your own campaigns and friends.'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (!userProfile.showPublicContent) {
                            setShowAgeWarning(true);
                          } else {
                            onUpdateUserProfile({ showPublicContent: false });
                            onLogDecision('disable_public_content', 'Disabled public content', { oldValue: true, newValue: false });
                            toast('Public content disabled');
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                          userProfile.showPublicContent ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                        role="switch"
                        aria-checked={userProfile.showPublicContent ?? false}
                        aria-label="Toggle public content"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            userProfile.showPublicContent ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </DungeonCard>

                  {/* Decision history */}
                  <div className="mt-3">
                    <button
                      onClick={() => setShowDecisionHistory(!showDecisionHistory)}
                      className="flex items-center gap-2 w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-display tracking-wider">DECISION HISTORY</span>
                      <span className="ml-auto">{showDecisionHistory ? '▲' : '▼'}</span>
                    </button>

                    <AnimatePresence>
                      {showDecisionHistory && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-2"
                        >
                          {loadingHistory ? (
                            <p className="text-[11px] text-muted-foreground italic">Loading...</p>
                          ) : decisionHistory.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic">No decisions recorded yet.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                              {decisionHistory.map(d => (
                                <div key={d.id} className="flex items-start gap-2 text-[11px] border border-border/50 px-2 py-1.5 bg-muted/30">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-foreground">{d.label}</span>
                                    {d.oldValue !== undefined && d.newValue !== undefined && (
                                      <span className="text-muted-foreground ml-1">
                                        ({String(d.oldValue)} → {String(d.newValue)})
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-muted-foreground/60 shrink-0 whitespace-nowrap">
                                    {new Date(d.timestamp).toLocaleDateString()} {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Age Warning Modal */}
      <AnimatePresence>
        {showAgeWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90"
            onClick={() => setShowAgeWarning(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background border-2 border-accent p-5 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-accent shrink-0" />
                <h3 className="font-display text-sm text-accent tracking-wider">CONTENT WARNING</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Public content is created by other players and <strong className="text-foreground">may not be suitable for all ages</strong>.
                Items and spells shared publicly have not been reviewed or moderated.
              </p>
              <p className="text-xs text-muted-foreground mb-5">
                By enabling public content you confirm you are of appropriate age and agree to view user-generated content at your own discretion.
              </p>
              <div className="flex gap-2">
                <DungeonButton variant="menu" className="flex-1" onClick={() => setShowAgeWarning(false)}>
                  Cancel
                </DungeonButton>
                <DungeonButton
                  variant="default"
                  className="flex-1"
                  onClick={async () => {
                    await onUpdateUserProfile({ showPublicContent: true });
                    await onLogDecision('enable_public_content', 'Enabled public content (age warning acknowledged)', { oldValue: false, newValue: true });
                    setShowAgeWarning(false);
                    toast('Public content enabled');
                  }}
                >
                  I Understand, Enable
                </DungeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CampaignSelectView;
