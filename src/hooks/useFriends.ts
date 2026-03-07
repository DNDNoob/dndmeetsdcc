import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@/lib/firebase';
import { toast } from 'sonner';
import type { FriendRequest, UserProfile } from '@/lib/gameData';

export function useFriends(userId: string | null) {
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to friend requests sent by this user
  useEffect(() => {
    if (!userId || !db) {
      setSentRequests([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'friendRequests'), where('fromUserId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
      setSentRequests(requests);
      setLoading(false);
    }, (error) => {
      console.error('[Friends] Error subscribing to sent requests:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  // Subscribe to friend requests received by this user
  useEffect(() => {
    if (!userId || !db) {
      setReceivedRequests([]);
      return;
    }

    const q = query(collection(db, 'friendRequests'), where('toUserId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
      setReceivedRequests(requests);
    }, (error) => {
      console.error('[Friends] Error subscribing to received requests:', error);
    });

    return unsubscribe;
  }, [userId]);

  // Derived: accepted friends (from both sent and received)
  const friends = useMemo(() => {
    const accepted = [
      ...sentRequests.filter(r => r.status === 'accepted'),
      ...receivedRequests.filter(r => r.status === 'accepted'),
    ];
    return accepted;
  }, [sentRequests, receivedRequests]);

  // Derived: pending requests received (need action)
  const pendingReceived = useMemo(() => {
    return receivedRequests.filter(r => r.status === 'pending');
  }, [receivedRequests]);

  // Derived: pending requests sent (waiting for response)
  const pendingSent = useMemo(() => {
    return sentRequests.filter(r => r.status === 'pending');
  }, [sentRequests]);

  // Send a friend request by username
  const sendFriendRequest = useCallback(async (
    targetUsername: string,
    myProfile: UserProfile,
  ): Promise<boolean> => {
    if (!userId || !db) return false;

    // Look up the target user by username
    const q = query(collection(db, 'userProfiles'), where('username', '==', targetUsername));
    let targetProfile: UserProfile;
    try {
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        toast.error(`User "${targetUsername}" not found`);
        return false;
      }
      targetProfile = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UserProfile;
    } catch (error) {
      console.error('[Friends] Error looking up user:', error);
      toast.error('Failed to look up user');
      return false;
    }

    // Can't friend yourself
    if (targetProfile.id === userId) {
      toast.error("You can't send a friend request to yourself");
      return false;
    }

    // Check for existing friendship or pending request (in either direction)
    const allRequests = [...sentRequests, ...receivedRequests];
    const existing = allRequests.find(r =>
      (r.fromUserId === userId && r.toUserId === targetProfile.id) ||
      (r.fromUserId === targetProfile.id && r.toUserId === userId)
    );

    if (existing) {
      if (existing.status === 'accepted') {
        toast('You are already friends with this user');
      } else if (existing.status === 'pending') {
        toast('A friend request already exists with this user');
      } else if (existing.status === 'declined') {
        // Allow re-sending after a decline — update the existing request
        try {
          await updateDoc(doc(db, 'friendRequests', existing.id), {
            status: 'pending',
            fromUserId: userId,
            fromUsername: myProfile.username,
            fromDisplayName: myProfile.displayName,
            fromAvatarUrl: myProfile.avatarUrl || null,
            toUserId: targetProfile.id,
            toUsername: targetProfile.username,
            toDisplayName: targetProfile.displayName,
            toAvatarUrl: targetProfile.avatarUrl || null,
            updatedAt: Date.now(),
          });
          toast.success(`Friend request re-sent to ${targetProfile.displayName}`);
          return true;
        } catch (error) {
          console.error('[Friends] Error re-sending friend request:', error);
          toast.error('Failed to send friend request');
          return false;
        }
      }
      return false;
    }

    // Create new friend request
    const id = crypto.randomUUID();
    const now = Date.now();
    const request: FriendRequest = {
      id,
      fromUserId: userId,
      fromUsername: myProfile.username,
      fromDisplayName: myProfile.displayName,
      fromAvatarUrl: myProfile.avatarUrl,
      toUserId: targetProfile.id,
      toUsername: targetProfile.username,
      toDisplayName: targetProfile.displayName,
      toAvatarUrl: targetProfile.avatarUrl,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'friendRequests', id), request);
      toast.success(`Friend request sent to ${targetProfile.displayName}`);
      return true;
    } catch (error) {
      console.error('[Friends] Error sending friend request:', error);
      toast.error('Failed to send friend request');
      return false;
    }
  }, [userId, sentRequests, receivedRequests]);

  // Accept a friend request
  const acceptFriendRequest = useCallback(async (requestId: string): Promise<void> => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'accepted',
        updatedAt: Date.now(),
      });
      toast.success('Friend request accepted!');
    } catch (error) {
      console.error('[Friends] Error accepting friend request:', error);
      toast.error('Failed to accept friend request');
    }
  }, []);

  // Decline a friend request
  const declineFriendRequest = useCallback(async (requestId: string): Promise<void> => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'declined',
        updatedAt: Date.now(),
      });
      toast('Friend request declined');
    } catch (error) {
      console.error('[Friends] Error declining friend request:', error);
      toast.error('Failed to decline friend request');
    }
  }, []);

  // Remove a friend (delete the accepted request)
  const removeFriend = useCallback(async (requestId: string): Promise<void> => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'friendRequests', requestId));
      toast.success('Friend removed');
    } catch (error) {
      console.error('[Friends] Error removing friend:', error);
      toast.error('Failed to remove friend');
    }
  }, []);

  // Cancel a pending sent request
  const cancelFriendRequest = useCallback(async (requestId: string): Promise<void> => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'friendRequests', requestId));
      toast('Friend request cancelled');
    } catch (error) {
      console.error('[Friends] Error cancelling friend request:', error);
      toast.error('Failed to cancel friend request');
    }
  }, []);

  return {
    friends,
    pendingReceived,
    pendingSent,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    cancelFriendRequest,
  };
}
