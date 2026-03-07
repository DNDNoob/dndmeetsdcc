import { useState, useEffect, useCallback } from 'react';
import {
  db,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
} from '@/lib/firebase';
import { toast } from 'sonner';
import type { Campaign, UserProfile } from '@/lib/gameData';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function useCampaigns(userId: string | null) {
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [joinedCampaigns, setJoinedCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to campaigns the user owns
  useEffect(() => {
    if (!userId || !db) {
      setMyCampaigns([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'campaigns'), where('ownerId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const campaigns = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
      setMyCampaigns(campaigns);
      setLoading(false);
    }, (error) => {
      console.error('[Campaigns] Error subscribing to owned campaigns:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  // Subscribe to campaigns the user has joined (as member, not owner)
  useEffect(() => {
    if (!userId || !db) {
      setJoinedCampaigns([]);
      return;
    }

    const q = query(collection(db, 'campaigns'), where('memberIds', 'array-contains', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const campaigns = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Campaign))
        // Filter out campaigns the user owns (they appear in myCampaigns)
        .filter(c => c.ownerId !== userId);
      setJoinedCampaigns(campaigns);
    }, (error) => {
      console.error('[Campaigns] Error subscribing to joined campaigns:', error);
    });

    return unsubscribe;
  }, [userId]);

  const createCampaign = useCallback(async (name: string, description?: string, userProfile?: UserProfile): Promise<Campaign | null> => {
    if (!userId || !db) return null;

    const id = crypto.randomUUID();
    const now = Date.now();
    const campaign: Campaign = {
      id,
      name,
      description: description || '',
      ownerId: userId,
      ownerName: userProfile?.displayName || 'Unknown',
      memberIds: [userId], // Owner is automatically a member
      maxMembers: 10,
      inviteCode: generateInviteCode(),
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'campaigns', id), campaign);
      toast.success(`Campaign "${name}" created!`);
      return campaign;
    } catch (error) {
      console.error('[Campaigns] Error creating campaign:', error);
      toast.error('Failed to create campaign');
      return null;
    }
  }, [userId]);

  const updateCampaign = useCallback(async (campaignId: string, updates: Partial<Campaign>): Promise<void> => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'campaigns', campaignId), {
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[Campaigns] Error updating campaign:', error);
      toast.error('Failed to update campaign');
    }
  }, []);

  const deleteCampaign = useCallback(async (campaignId: string): Promise<void> => {
    if (!db) return;
    try {
      // Delete all room-scoped collections for this campaign
      const roomCollections = [
        'crawlers', 'mobs', 'maps', 'inventory', 'episodes', 'soundEffects',
        'diceRolls', 'lootBoxes', 'lootBoxTemplates', 'noncombatTurns',
        'gameClock', 'combatState', 'wiki', 'quests', 'assignedQuests',
      ];

      for (const collName of roomCollections) {
        const colRef = collection(db, `rooms/${campaignId}/${collName}`);
        const snapshot = await getDocs(colRef);
        if (snapshot.size > 0) {
          const batch = writeBatch(db);
          snapshot.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      // Delete the campaign document itself
      await deleteDoc(doc(db, 'campaigns', campaignId));
      toast.success('Campaign deleted');
    } catch (error) {
      console.error('[Campaigns] Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    }
  }, []);

  const copyCampaign = useCallback(async (sourceCampaignId: string, newName: string, userProfile?: UserProfile): Promise<Campaign | null> => {
    if (!userId || !db) return null;

    const newId = crypto.randomUUID();
    const now = Date.now();

    try {
      // Read source campaign
      const sourceDoc = await getDoc(doc(db, 'campaigns', sourceCampaignId));
      if (!sourceDoc.exists()) {
        toast.error('Source campaign not found');
        return null;
      }

      const source = sourceDoc.data() as Campaign;

      // Create new campaign
      const newCampaign: Campaign = {
        id: newId,
        name: newName,
        description: source.description,
        ownerId: userId,
        ownerName: userProfile?.displayName || source.ownerName,
        memberIds: [userId],
        maxMembers: source.maxMembers,
        inviteCode: generateInviteCode(),
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'campaigns', newId), newCampaign);

      // Copy room-scoped collections (except transient state)
      const collectionsToCopy = ['mobs', 'maps', 'episodes', 'lootBoxTemplates', 'wiki', 'quests'];

      for (const collName of collectionsToCopy) {
        const sourceCol = collection(db, `rooms/${sourceCampaignId}/${collName}`);
        const snapshot = await getDocs(sourceCol);
        if (snapshot.size > 0) {
          const batch = writeBatch(db);
          snapshot.docs.forEach(d => {
            const targetRef = doc(db!, `rooms/${newId}/${collName}`, d.id);
            batch.set(targetRef, d.data());
          });
          await batch.commit();
        }
      }

      toast.success(`Campaign copied as "${newName}"`);
      return newCampaign;
    } catch (error) {
      console.error('[Campaigns] Error copying campaign:', error);
      toast.error('Failed to copy campaign');
      return null;
    }
  }, [userId]);

  const joinCampaignByCode = useCallback(async (inviteCode: string): Promise<Campaign | null> => {
    if (!userId || !db) return null;

    try {
      const q = query(collection(db, 'campaigns'), where('inviteCode', '==', inviteCode));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.error('Invalid invite code');
        return null;
      }

      const campaignDoc = snapshot.docs[0];
      const campaign = { id: campaignDoc.id, ...campaignDoc.data() } as Campaign;

      // Check if already a member
      if (campaign.memberIds.includes(userId)) {
        toast('You are already a member of this campaign');
        return campaign;
      }

      // Check member limit
      if (campaign.memberIds.length >= campaign.maxMembers) {
        toast.error('This campaign is full');
        return null;
      }

      // Add user to memberIds
      await updateDoc(doc(db, 'campaigns', campaign.id), {
        memberIds: [...campaign.memberIds, userId],
        updatedAt: Date.now(),
      });

      toast.success(`Joined campaign "${campaign.name}"!`);
      return { ...campaign, memberIds: [...campaign.memberIds, userId] };
    } catch (error) {
      console.error('[Campaigns] Error joining campaign:', error);
      toast.error('Failed to join campaign');
      return null;
    }
  }, [userId]);

  const leaveCampaign = useCallback(async (campaignId: string): Promise<void> => {
    if (!userId || !db) return;

    try {
      const campaignRef = doc(db, 'campaigns', campaignId);
      const campaignDoc = await getDoc(campaignRef);
      if (!campaignDoc.exists()) return;

      const campaign = campaignDoc.data() as Campaign;

      // Owner cannot leave their own campaign
      if (campaign.ownerId === userId) {
        toast.error('As the DM, you cannot leave your own campaign. Delete it instead.');
        return;
      }

      await updateDoc(campaignRef, {
        memberIds: campaign.memberIds.filter(id => id !== userId),
        updatedAt: Date.now(),
      });

      toast.success('Left campaign');
    } catch (error) {
      console.error('[Campaigns] Error leaving campaign:', error);
      toast.error('Failed to leave campaign');
    }
  }, [userId]);

  const removeMember = useCallback(async (campaignId: string, memberId: string): Promise<void> => {
    if (!userId || !db) return;

    try {
      const campaignRef = doc(db, 'campaigns', campaignId);
      const campaignDoc = await getDoc(campaignRef);
      if (!campaignDoc.exists()) return;

      const campaign = campaignDoc.data() as Campaign;

      // Only owner can remove members
      if (campaign.ownerId !== userId) {
        toast.error('Only the DM can remove members');
        return;
      }

      // Cannot remove yourself (the owner)
      if (memberId === userId) {
        toast.error('Cannot remove yourself from your own campaign');
        return;
      }

      await updateDoc(campaignRef, {
        memberIds: campaign.memberIds.filter(id => id !== memberId),
        updatedAt: Date.now(),
      });

      toast.success('Member removed');
    } catch (error) {
      console.error('[Campaigns] Error removing member:', error);
      toast.error('Failed to remove member');
    }
  }, [userId]);

  const regenerateInviteCode = useCallback(async (campaignId: string): Promise<string | null> => {
    if (!db) return null;
    const newCode = generateInviteCode();
    try {
      await updateDoc(doc(db, 'campaigns', campaignId), {
        inviteCode: newCode,
        updatedAt: Date.now(),
      });
      toast.success('Invite code regenerated');
      return newCode;
    } catch (error) {
      console.error('[Campaigns] Error regenerating invite code:', error);
      toast.error('Failed to regenerate invite code');
      return null;
    }
  }, []);

  return {
    myCampaigns,
    joinedCampaigns,
    loading,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    copyCampaign,
    joinCampaignByCode,
    leaveCampaign,
    removeMember,
    regenerateInviteCode,
  };
}
