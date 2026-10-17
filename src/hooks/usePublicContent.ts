import { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from '@/lib/firebase';
import type { InventoryItem, Spell, PublicMap, PublicMob, PublicEpisode, PublicEpisodeAssets, Mob } from '@/lib/gameData';
import { stripNpcSecret } from '@/lib/gameData';

/**
 * Manages reading and writing to the global root-level public content collections.
 * Public content is stored in root-level collections (not scoped to any campaign room):
 * `publicItems`, `publicSpells`, `publicMaps`, `publicMobs`, `publicEpisodes`.
 * Episode images live in `publicEpisodes/{id}/maps` and `publicEpisodes/{id}/mobs`.
 *
 * Only subscribes when `enabled` is true (i.e., the user has opted in to public content).
 */
export function usePublicContent(enabled: boolean) {
  const [publicItems, setPublicItems] = useState<InventoryItem[]>([]);
  const [publicSpells, setPublicSpells] = useState<Spell[]>([]);
  const [publicMaps, setPublicMaps] = useState<PublicMap[]>([]);
  const [publicMobs, setPublicMobs] = useState<PublicMob[]>([]);
  const [publicEpisodes, setPublicEpisodes] = useState<PublicEpisode[]>([]);

  useEffect(() => {
    if (!enabled || !db) {
      setPublicItems([]);
      setPublicSpells([]);
      setPublicMaps([]);
      setPublicMobs([]);
      setPublicEpisodes([]);
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

    const unsubMaps = onSnapshot(
      collection(db, 'publicMaps'),
      (snap) => setPublicMaps(snap.docs.map(d => ({ ...d.data(), id: d.id }) as PublicMap)),
      (err) => console.error('[PublicContent] publicMaps listener error:', err)
    );

    const unsubMobs = onSnapshot(
      collection(db, 'publicMobs'),
      (snap) => setPublicMobs(snap.docs.map(d => ({ ...d.data(), id: d.id }) as PublicMob)),
      (err) => console.error('[PublicContent] publicMobs listener error:', err)
    );

    const unsubEpisodes = onSnapshot(
      collection(db, 'publicEpisodes'),
      (snap) => setPublicEpisodes(snap.docs.map(d => ({ ...d.data(), id: d.id }) as PublicEpisode)),
      (err) => console.error('[PublicContent] publicEpisodes listener error:', err)
    );

    return () => {
      unsubItems();
      unsubSpells();
      unsubMaps();
      unsubMobs();
      unsubEpisodes();
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

  const publishMap = async (map: PublicMap) => {
    if (!db) return;
    await setDoc(doc(db, 'publicMaps', map.id), map);
  };

  const unpublishMap = async (publicId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'publicMaps', publicId));
  };

  const publishMob = async (mob: PublicMob) => {
    if (!db) return;
    await setDoc(doc(db, 'publicMobs', mob.id), stripNpcSecret({ ...mob, isPublic: true }));
  };

  const unpublishMob = async (publicId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'publicMobs', publicId));
  };

  /** Delete an episode's asset subcollections (maps/mobs). */
  const deleteEpisodeAssets = async (publicId: string) => {
    if (!db) return;
    for (const sub of ['maps', 'mobs']) {
      const snap = await getDocs(collection(db, 'publicEpisodes', publicId, sub));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
  };

  /**
   * Publish (or republish) an episode bundle. Assets are written one doc at a time
   * (each image can be ~1 MB) before the episode doc, so the episode only appears
   * in the community list once it's importable.
   */
  const publishEpisode = async (episode: PublicEpisode, assets: PublicEpisodeAssets) => {
    if (!db) return;
    await deleteEpisodeAssets(episode.id);
    for (let i = 0; i < assets.maps.length; i++) {
      await setDoc(doc(db, 'publicEpisodes', episode.id, 'maps', String(i)), { index: i, ...assets.maps[i] });
    }
    for (const mob of assets.mobs) {
      await setDoc(doc(db, 'publicEpisodes', episode.id, 'mobs', mob.id), mob);
    }
    await setDoc(doc(db, 'publicEpisodes', episode.id), episode);
  };

  const unpublishEpisode = async (publicId: string) => {
    if (!db) return;
    // Remove the episode doc first so nobody starts importing a half-deleted bundle
    await deleteDoc(doc(db, 'publicEpisodes', publicId));
    await deleteEpisodeAssets(publicId);
  };

  const fetchEpisodeAssets = async (publicId: string): Promise<PublicEpisodeAssets> => {
    if (!db) return { maps: [], mobs: [] };
    const [mapsSnap, mobsSnap] = await Promise.all([
      getDocs(collection(db, 'publicEpisodes', publicId, 'maps')),
      getDocs(collection(db, 'publicEpisodes', publicId, 'mobs')),
    ]);
    const maps = mapsSnap.docs
      .map(d => d.data() as { index: number; name: string; image: string })
      .sort((a, b) => a.index - b.index)
      .map(({ name, image }) => ({ name, image }));
    const mobs = mobsSnap.docs.map(d => ({ ...d.data(), id: d.id }) as Mob);
    return { maps, mobs };
  };

  return {
    publicItems,
    publicSpells,
    publicMaps,
    publicMobs,
    publicEpisodes,
    publishItem,
    unpublishItem,
    publishSpell,
    unpublishSpell,
    publishMap,
    unpublishMap,
    publishMob,
    unpublishMob,
    publishEpisode,
    unpublishEpisode,
    fetchEpisodeAssets,
  };
}
