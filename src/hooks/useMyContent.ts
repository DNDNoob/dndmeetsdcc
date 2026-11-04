import { useState, useEffect, useCallback } from 'react';
import { db, collection, doc, setDoc, deleteDoc, onSnapshot } from '@/lib/firebase';
import { toast } from 'sonner';
import type { Ability, InventoryItem, Spell } from '@/lib/gameData';

/**
 * A user's personal content: items, spells and abilities linked only to their profile, not to any
 * campaign. Stored at `userContent/{uid}/items`, `.../spells` and `.../abilities`, readable
 * and writable only by that user. Copies can be added to any campaign the user plays in.
 */
type MyContentKind = 'items' | 'spells' | 'abilities';

export function useMyContent(uid: string | null, username?: string) {
  const [myItems, setMyItems] = useState<InventoryItem[]>([]);
  const [mySpells, setMySpells] = useState<Spell[]>([]);
  const [myAbilities, setMyAbilities] = useState<Ability[]>([]);

  useEffect(() => {
    setMyItems([]);
    setMySpells([]);
    setMyAbilities([]);
    if (!uid || !db) return;
    const unsubItems = onSnapshot(
      collection(db, 'userContent', uid, 'items'),
      (snap) => setMyItems(snap.docs.map(d => ({ ...d.data(), id: d.id }) as InventoryItem)),
      (err) => console.error('[MyContent] items listener error:', err),
    );
    const unsubSpells = onSnapshot(
      collection(db, 'userContent', uid, 'spells'),
      (snap) => setMySpells(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Spell)),
      (err) => console.error('[MyContent] spells listener error:', err),
    );
    const unsubAbilities = onSnapshot(
      collection(db, 'userContent', uid, 'abilities'),
      (snap) => setMyAbilities(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Ability)),
      (err) => console.error('[MyContent] abilities listener error:', err),
    );
    return () => {
      unsubItems();
      unsubSpells();
      unsubAbilities();
    };
  }, [uid]);

  const write = useCallback(async (kind: MyContentKind, id: string, data: Record<string, unknown> | null) => {
    if (!uid || !db) {
      toast.error('Sign in to save your own content', { id: 'auth-required' });
      return;
    }
    try {
      const ref = doc(db, 'userContent', uid, kind, id);
      if (data) {
        // Firestore rejects undefined values; a JSON round trip drops them at every level
        const clean = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
        await setDoc(ref, clean);
      } else {
        await deleteDoc(ref);
      }
    } catch (err) {
      console.error(`[MyContent] Failed to save ${kind}:`, err);
      toast.error('Failed to save to My Content. Please try again.', { id: 'my-content-error' });
      throw err;
    }
  }, [uid]);

  const creator = useCallback(() => ({
    createdBy: uid ?? '',
    ...(username ? { createdByUsername: username } : {}),
  }), [uid, username]);

  /** Save (create or replace) a personal item. Campaign/community bookkeeping is dropped. */
  const saveMyItem = useCallback(async (item: InventoryItem) => {
    const { isPublic: _p, equipped: _e, ...rest } = item;
    await write('items', item.id, { ...rest, ...creator() });
  }, [write, creator]);

  const deleteMyItem = useCallback((id: string) => write('items', id, null), [write]);

  const saveMySpell = useCallback(async (spell: Spell) => {
    const { isPublic: _p, ...rest } = spell as Spell & Record<string, unknown>;
    delete rest.roomId;
    await write('spells', spell.id, { ...rest, ...creator() });
  }, [write, creator]);

  const deleteMySpell = useCallback((id: string) => write('spells', id, null), [write]);

  const saveMyAbility = useCallback(async (ability: Ability) => {
    const rest = { ...ability } as Ability & Record<string, unknown>;
    delete rest.roomId;
    await write('abilities', ability.id, { ...rest, ...creator() });
  }, [write, creator]);

  const deleteMyAbility = useCallback((id: string) => write('abilities', id, null), [write]);

  /** Attach a pixel icon to a personal item or spell without touching its other fields. */
  const setMyContentIcon = useCallback(async (kind: MyContentKind, id: string, iconId: string) => {
    if (!uid || !db) return;
    await setDoc(doc(db, 'userContent', uid, kind, id), { iconId }, { merge: true })
      .catch(err => console.error(`[MyContent] Failed to set icon on ${kind}/${id}:`, err));
  }, [uid]);

  return { myItems, mySpells, myAbilities, saveMyItem, deleteMyItem, saveMySpell, deleteMySpell, saveMyAbility, deleteMyAbility, setMyContentIcon };
}
