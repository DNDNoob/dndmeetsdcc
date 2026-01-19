import { useState, useEffect, useCallback } from 'react';
import { db, getCollectionRef, getDocs, setDoc, doc, deleteDoc, updateDoc, onSnapshot, initAuth } from '../lib/firebase';
import type { CollectionName } from '../types/collections';

interface DataStore {
  [collectionName: string]: Record<string, unknown>[];
}

interface UseFirebaseStoreReturn {
  data: DataStore;
  loading: boolean;
  error: string | null;
  addItem: (collection: CollectionName, item: Record<string, unknown>) => Promise<void>;
  updateItem: (collection: CollectionName, id: string, updates: Record<string, unknown>) => Promise<void>;
  deleteItem: (collection: CollectionName, id: string) => Promise<void>;
  getCollection: <T = Record<string, unknown>>(collection: CollectionName) => T[];
  setCollection: (collection: CollectionName, items: Record<string, unknown>[]) => void;
  isLoaded: boolean;
  setRoomId: (roomId: string | null) => void;
  roomId: string | null;
}

/**
 * Firebase Data Store Hook - Real-time multiplayer support
 * 
 * @example
 * ```typescript
 * const { getCollection, addItem, setRoomId } = useGame();
 * 
 * // Set room for multiplayer
 * setRoomId('room-123');
 * 
 * // Get data
 * const mobs = getCollection('mobs');
 * 
 * // Add item - syncs in real-time!
 * addItem('mobs', { id: crypto.randomUUID(), name: 'Dragon' });
 * ```
 */
export function useFirebaseStore(): UseFirebaseStoreReturn {
  const [data, setData] = useState<DataStore>({});
  const [loading, setLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  // Collections to sync
  const collections: CollectionName[] = ['crawlers', 'mobs', 'maps', 'inventory', 'episodes', 'soundEffects'];

  // Load and subscribe to real-time updates
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    const setupRealtimeSync = async () => {
      setLoading(true);
      console.log('[FirebaseStore] � Initializing authentication...');

      try {
        // Initialize authentication first
        await initAuth();
        console.log('[FirebaseStore] ✅ Authentication ready');
        
        console.log('[FirebaseStore] 📂 Setting up real-time sync...', { roomId });

        // Set up real-time listeners for each collection
        for (const collectionName of collections) {
          const collectionRef = getCollectionRef(collectionName, roomId || undefined);
          const collectionPath = roomId ? `rooms/${roomId}/${collectionName}` : collectionName;

          const unsubscribe = onSnapshot(
            collectionRef,
            (snapshot) => {
              const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));

              console.log(`[FirebaseStore] 🔄 Real-time update: ${collectionPath}`, {
                count: items.length,
                ids: items.map(i => (i.id as string).substring(0, 8)).join(', '),
                items: collectionName === 'maps' ? items.map(i => ({
                  id: i.id,
                  imageLength: typeof (i as Record<string, unknown>).image === 'string' ? ((i as Record<string, unknown>).image as string).length : 0
                })) : undefined
              });

              setData(prevData => ({
                ...prevData,
                [collectionName]: items
              }));
            },
            (err) => {
              console.error(`[FirebaseStore] ❌ Listener error for ${collectionPath}:`, err);
              setError(err.message);
            }
          );

          unsubscribers.push(unsubscribe);
        }

        console.log('[FirebaseStore] ✅ Real-time sync active');
        setIsLoaded(true);
      } catch (err) {
        console.error('[FirebaseStore] ❌ Setup error:', err);
        setError(err instanceof Error ? err.message : 'Failed to setup Firebase');
        // Still mark as loaded even if Firebase fails, so the app can function offline
        setIsLoaded(true);
      } finally {
        setLoading(false);
      }
    };

    setupRealtimeSync();

    // Cleanup listeners on unmount or roomId change
    return () => {
      console.log('[FirebaseStore] 🧹 Cleaning up listeners');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [roomId]);

  // Remove undefined values before writing to Firestore
  const cleanObject = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj
        .map((v) => (typeof v === 'object' && v !== null ? cleanObject(v) : v))
        .filter((v) => v !== undefined);
    }
    if (typeof obj === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;
        out[key] = typeof value === 'object' && value !== null ? cleanObject(value) : value;
      }
      return out;
    }
    return obj;
  };

  const MAX_IMAGE_LENGTH = 5_000_000; // ~3.75 MB of raw image data once base64 is decoded
  const MAX_AVATAR_LENGTH = 500_000; // 500KB for avatars

  const addItem = useCallback(async (collection: CollectionName, item: Record<string, unknown>) => {
    try {
      const itemId = (item.id as string) || crypto.randomUUID();
      const itemWithId = { ...item, id: itemId };
      
      if (roomId) {
        itemWithId.roomId = roomId;
      }

      // Drop undefined/oversized image fields to satisfy Firestore
      if (itemWithId.image === undefined || itemWithId.image === null) {
        delete itemWithId.image;
      } else if (typeof itemWithId.image === 'string' && itemWithId.image.length > MAX_IMAGE_LENGTH) {
        console.warn('[FirebaseStore] ⚠️ Image too large; stripping before save', {
          collection,
          itemId,
          imageSize: (itemWithId.image as string).length,
          maxSize: MAX_IMAGE_LENGTH,
          sizeInMB: ((itemWithId.image as string).length / 1_000_000).toFixed(2)
        });
        delete itemWithId.image;
      } else if (typeof itemWithId.image === 'string' && collection === 'maps') {
        console.log('[FirebaseStore] ✅ Storing map image', {
          itemId,
          imageSize: (itemWithId.image as string).length,
          sizeInMB: ((itemWithId.image as string).length / 1_000_000).toFixed(2)
        });
      }

      // Drop undefined/oversized avatar fields to satisfy Firestore
      if (itemWithId.avatar === undefined || itemWithId.avatar === null) {
        delete itemWithId.avatar;
      } else if (typeof itemWithId.avatar === 'string' && itemWithId.avatar.length > MAX_AVATAR_LENGTH) {
        console.warn('[FirebaseStore] ⚠️ Avatar too large; stripping before save', {
          collection,
          itemId,
          avatarSize: (itemWithId.avatar as string).length,
          maxSize: MAX_AVATAR_LENGTH,
          sizeInKB: ((itemWithId.avatar as string).length / 1_000).toFixed(2)
        });
        delete itemWithId.avatar;
      } else if (typeof itemWithId.avatar === 'string') {
        console.log('[FirebaseStore] ✅ Storing avatar', {
          itemId,
          avatarSize: (itemWithId.avatar as string).length,
          sizeInKB: ((itemWithId.avatar as string).length / 1_000).toFixed(2)
        });
      }

      const collectionRef = getCollectionRef(collection, roomId || undefined);
      const docRef = doc(collectionRef, itemId);

      const cleaned = cleanObject(itemWithId);
      await setDoc(docRef, cleaned);
      console.log('[FirebaseStore] ✅ Added item:', collection, itemId);
    } catch (err) {
      console.error('[FirebaseStore] ❌ Add error:', err);
      setError(err instanceof Error ? err.message : 'Failed to add item');
      throw err;
    }
  }, [roomId]); // cleanObject is stable, doesn't need to be in dependencies

  const updateItem = useCallback(async (collection: CollectionName, id: string, updates: Record<string, unknown>) => {
    try {
      const collectionRef = getCollectionRef(collection, roomId || undefined);
      const docRef = doc(collectionRef, id);

        // Drop undefined/oversized image fields to satisfy Firestore
      const updatesCopy = { ...updates };
      if (updatesCopy.image === undefined || updatesCopy.image === null) {
        delete updatesCopy.image;
      } else if (typeof updatesCopy.image === 'string' && updatesCopy.image.length > MAX_IMAGE_LENGTH) {
        console.warn('[FirebaseStore] ⚠️ Image too large; stripping before update', {
          collection,
          id,
          imageSize: (updatesCopy.image as string).length,
          maxSize: MAX_IMAGE_LENGTH,
          sizeInMB: ((updatesCopy.image as string).length / 1_000_000).toFixed(2)
        });
        delete updatesCopy.image;
      }

      // Drop undefined/oversized avatar fields to satisfy Firestore
      if (updatesCopy.avatar === undefined || updatesCopy.avatar === null) {
        delete updatesCopy.avatar;
      } else if (typeof updatesCopy.avatar === 'string' && updatesCopy.avatar.length > MAX_AVATAR_LENGTH) {
        console.warn('[FirebaseStore] ⚠️ Avatar too large; stripping before update', {
          collection,
          id,
          avatarSize: (updatesCopy.avatar as string).length,
          maxSize: MAX_AVATAR_LENGTH,
          sizeInKB: ((updatesCopy.avatar as string).length / 1_000).toFixed(2)
        });
        delete updatesCopy.avatar;
      } else if (typeof updatesCopy.avatar === 'string') {
        console.log('[FirebaseStore] ✅ Updating avatar', {
          id,
          avatarSize: (updatesCopy.avatar as string).length,
          sizeInKB: ((updatesCopy.avatar as string).length / 1_000).toFixed(2)
        });
      }

      const cleanedFinal = cleanObject(updatesCopy);
      await updateDoc(docRef, cleanedFinal as Record<string, unknown>);
      console.log('[FirebaseStore] ✅ Updated item:', collection, id);
    } catch (err) {
      console.error('[FirebaseStore] ❌ Update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update item');
      throw err;
    }
  }, [roomId]); // cleanObject is stable, doesn't need to be in dependencies

  const deleteItem = useCallback(async (collection: CollectionName, id: string) => {
    try {
      const collectionRef = getCollectionRef(collection, roomId || undefined);
      const docRef = doc(collectionRef, id);

      await deleteDoc(docRef);
      console.log('[FirebaseStore] ✅ Deleted item:', collection, id);
    } catch (err) {
      console.error('[FirebaseStore] ❌ Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      throw err;
    }
  }, [roomId]);

  const getCollection = useCallback(<T = Record<string, unknown>>(collection: CollectionName): T[] => {
    return (data[collection] || []) as T[];
  }, [data]);

  const setCollection = useCallback((collection: CollectionName, items: Record<string, unknown>[]) => {
    setData(prevData => ({
      ...prevData,
      [collection]: items
    }));
  }, []);

  return {
    data,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    getCollection,
    setCollection,
    isLoaded,
    setRoomId,
    roomId
  };
}
