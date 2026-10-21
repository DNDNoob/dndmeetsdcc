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
  arrayUnion,
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

// campaignInvites/{inviteCode} → { campaignId }. Only someone holding the code can look a
// campaign up; the campaign itself is readable by its owner and members only.
const INVITES = 'campaignInvites';

async function writeInvite(inviteCode: string, campaignId: string): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, INVITES, inviteCode), { campaignId, createdAt: Date.now() });
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

    const ensuredInvites = new Set<string>();
    const q = query(collection(db, 'campaigns'), where('ownerId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const campaigns = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
      setMyCampaigns(campaigns);
      setLoading(false);
      // Campaigns made before invite lookups existed get theirs on the owner's next visit
      for (const c of campaigns) {
        if (!c.inviteCode || ensuredInvites.has(c.inviteCode)) continue;
        ensuredInvites.add(c.inviteCode);
        getDoc(doc(db!, INVITES, c.inviteCode))
          .then(snap => (snap.exists() ? undefined : writeInvite(c.inviteCode, c.id)))
          .catch(err => console.error('[Campaigns] Error saving invite code:', err));
      }
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
      await writeInvite(campaign.inviteCode, id);
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
        'gameClock', 'combatState', 'wiki', 'quests', 'assignedQuests', 'crawlerStats',
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

      // Retire the invite code, then delete the campaign document itself
      const campaignSnap = await getDoc(doc(db, 'campaigns', campaignId));
      const inviteCode = campaignSnap.exists() ? (campaignSnap.data() as Campaign).inviteCode : '';
      if (inviteCode) await deleteDoc(doc(db, INVITES, inviteCode));
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
      await writeInvite(newCampaign.inviteCode, newId);

      // Copy room-scoped collections (except transient state)
      const collectionsToCopy = ['mobs', 'maps', 'episodes', 'lootBoxTemplates', 'wiki', 'quests', 'languages'];

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
      const inviteSnap = await getDoc(doc(db, INVITES, inviteCode));
      if (!inviteSnap.exists()) {
        toast.error('Invalid invite code');
        return null;
      }
      const campaignRef = doc(db, 'campaigns', (inviteSnap.data() as { campaignId: string }).campaignId);

      // Members can read the campaign; anyone else gets permission-denied until they join
      const existing = await getDoc(campaignRef).catch(() => null);
      if (existing?.exists() && (existing.data() as Campaign).memberIds.includes(userId)) {
        toast('You are already a member of this campaign');
        return { id: existing.id, ...existing.data() } as Campaign;
      }

      // The database checks the code and the member limit when adding us
      try {
        await updateDoc(campaignRef, {
          memberIds: arrayUnion(userId),
          lastJoinCode: inviteCode,
          updatedAt: Date.now(),
        });
      } catch (error) {
        console.error('[Campaigns] Join refused:', error);
        toast.error('This campaign is full or the invite code has changed');
        return null;
      }

      const joined = await getDoc(campaignRef);
      const campaign = { id: joined.id, ...joined.data() } as Campaign;
      toast.success(`Joined campaign "${campaign.name}"!`);
      return campaign;
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
      const campaignRef = doc(db, 'campaigns', campaignId);
      const snap = await getDoc(campaignRef);
      const oldCode = snap.exists() ? (snap.data() as Campaign).inviteCode : '';
      await updateDoc(campaignRef, {
        inviteCode: newCode,
        updatedAt: Date.now(),
      });
      await writeInvite(newCode, campaignId);
      if (oldCode) await deleteDoc(doc(db, INVITES, oldCode)).catch(() => undefined);
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
