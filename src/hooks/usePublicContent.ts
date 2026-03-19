import { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, deleteDoc, onSnapshot } from '@/lib/firebase';
import type { InventoryItem, Spell } from '@/lib/gameData';

/**
 * Manages reading and writing to the global root-level public content collections.
 * Public items and spells are stored in `publicItems` and `publicSpells` at the
 * Firestore root (not scoped to any campaign room).
 *
 * Only subscribes when `enabled` is true (i.e., the user has opted in to public content).
 */
export function usePublicContent(enabled: boolean) {
  const [publicItems, setPublicItems] = useState<InventoryItem[]>([]);
  const [publicSpells, setPublicSpells] = useState<Spell[]>([]);

  useEffect(() => {
    if (!enabled || !db) {
      setPublicItems([]);
      setPublicSpells([]);
      return;
    }

    const unsubItems = onSnapshot(
      collection(db, 'publicItems'),
      (snap) => {
        setPublicItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as InventoryItem));
      },
      (err) => console.error('[PublicContent] publicItems listener error:', err)
    );

    const unsubSpells = onSnapshot(
      collection(db, 'publicSpells'),
      (snap) => {
        setPublicSpells(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Spell));
      },
      (err) => console.error('[PublicContent] publicSpells listener error:', err)
    );

    return () => {
      unsubItems();
      unsubSpells();
    };
  }, [enabled]);

  const publishItem = async (item: InventoryItem) => {
    if (!db) return;
    try {
      await setDoc(doc(db, 'publicItems', item.id), { ...item, isPublic: true });
    } catch (err) {
      console.error('[PublicContent] Failed to publish item:', err);
      throw err;
    }
  };

  const unpublishItem = async (itemId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'publicItems', itemId));
    } catch (err) {
      console.error('[PublicContent] Failed to unpublish item:', err);
      throw err;
    }
  };

  const publishSpell = async (spell: Spell) => {
    if (!db) return;
    try {
      await setDoc(doc(db, 'publicSpells', spell.id), { ...spell, isPublic: true });
    } catch (err) {
      console.error('[PublicContent] Failed to publish spell:', err);
      throw err;
    }
  };

  const unpublishSpell = async (spellId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'publicSpells', spellId));
    } catch (err) {
      console.error('[PublicContent] Failed to unpublish spell:', err);
      throw err;
    }
  };

  return {
    publicItems,
    publicSpells,
    publishItem,
    unpublishItem,
    publishSpell,
    unpublishSpell,
  };
}
