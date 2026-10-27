import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import { db, collection, doc, setDoc, onSnapshot } from '@/lib/firebase';
import type { IconLibraryEntry, Mob } from '@/lib/gameData';
import { buildIconPrompt, generateIconImage, getIconTags, matchLibraryIcon, PORTRAIT_SIZE, type IconSubject } from '@/lib/iconGen';

/**
 * The global pixel-art icon library (top-level `iconLibrary` collection, shared by every campaign).
 *
 * `assignIcon` gives a new item or spell an icon: it generates one through the Cloudflare icon
 * Worker and adds it to the library, or, when generation is unavailable (free quota used up,
 * not configured, not signed in with Google), picks the best existing icon by descriptor tags.
 * `regenerateIcon` makes a fresh one on request, and `generateMobImage` makes larger portraits for mob types.
 */
export function useIconLibrary(user: User | null, canGenerate: boolean) {
  const [icons, setIcons] = useState<IconLibraryEntry[]>([]);
  const iconsRef = useRef(icons);
  iconsRef.current = icons;

  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(
      collection(db, 'iconLibrary'),
      (snap) => setIcons(snap.docs.map(d => ({ ...d.data(), id: d.id }) as IconLibraryEntry)),
      (err) => console.error('[IconLibrary] listener error:', err),
    );
  }, [user]);

  const iconImages = useMemo(() => {
    const map: Record<string, string> = {};
    for (const icon of icons) map[icon.id] = icon.image;
    return map;
  }, [icons]);

  // Generate a new image and add it to the library; null when generation is unavailable
  const generateEntry = useCallback(async (subject: IconSubject, size?: number, extra?: string): Promise<IconLibraryEntry | null> => {
    if (!canGenerate || !user || !db) return null;
    const prompt = buildIconPrompt(subject, extra);
    // Item and spell icons lose their background so they sit on the page like the line icons;
    // mob portraits keep theirs
    const image = await generateIconImage(prompt, await user.getIdToken(), size, subject.kind !== 'mob');
    if (!image) return null;
    const entry: IconLibraryEntry = {
      id: crypto.randomUUID(),
      image,
      tags: [...getIconTags(subject).keys()],
      kind: subject.kind,
      sourceName: subject.kind === 'item' ? subject.item.name : subject.kind === 'spell' ? subject.spell.name : subject.mob.name,
      prompt,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    };
    try {
      await setDoc(doc(db, 'iconLibrary', entry.id), entry);
    } catch (err) {
      console.error('[IconLibrary] failed to save generated image:', err);
    }
    return entry;
  }, [user, canGenerate]);

  const assignIcon = useCallback(async (subject: IconSubject): Promise<string | undefined> => {
    const entry = await generateEntry(subject);
    if (entry) return entry.id;
    return matchLibraryIcon(subject, iconsRef.current)?.id;
  }, [generateEntry]);

  /** A fresh icon for an item or spell being edited (or upgraded: `extra` describes the new look), with no library fallback. */
  const regenerateIcon = useCallback(async (subject: IconSubject, extra?: string): Promise<{ id: string; image: string } | null> => {
    const entry = await generateEntry(subject, undefined, extra);
    return entry ? { id: entry.id, image: entry.image } : null;
  }, [generateEntry]);

  /**
   * Pixel portrait for a mob type (returned as an image, since mobs keep their own image field).
   * Falls back to a character's creature portrait, then the closest earlier mob portrait.
   */
  const generateMobImage = useCallback(async (mob: Pick<Mob, 'name' | 'description'> & Partial<Mob>, allMobs: Mob[]): Promise<string | undefined> => {
    const subject: IconSubject = { kind: 'mob', mob };
    const entry = await generateEntry(subject, PORTRAIT_SIZE);
    if (entry) return entry.image;
    const species = mob.speciesId ? allMobs.find(m => m.id === mob.speciesId) : undefined;
    if (species?.image) return species.image;
    return matchLibraryIcon(subject, iconsRef.current)?.image;
  }, [generateEntry]);

  return { icons, iconImages, assignIcon, regenerateIcon, generateMobImage };
}
