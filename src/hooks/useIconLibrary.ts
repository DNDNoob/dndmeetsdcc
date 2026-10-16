import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import { db, collection, doc, setDoc, onSnapshot } from '@/lib/firebase';
import type { IconLibraryEntry } from '@/lib/gameData';
import { buildIconPrompt, generateIconImage, getIconTags, matchLibraryIcon, type IconSubject } from '@/lib/iconGen';

/**
 * The global pixel-art icon library (top-level `iconLibrary` collection, shared by every campaign).
 *
 * `assignIcon` gives a new item or spell an icon: it generates one through the Cloudflare icon
 * Worker and adds it to the library, or, when generation is unavailable (free quota used up,
 * not configured, not signed in with Google), picks the best existing icon by descriptor tags.
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

  const assignIcon = useCallback(async (subject: IconSubject): Promise<string | undefined> => {
    const target = subject.kind === 'item' ? subject.item : subject.spell;
    if (canGenerate && user && db) {
      const prompt = buildIconPrompt(subject);
      const image = await generateIconImage(prompt, await user.getIdToken());
      if (image) {
        const entry: IconLibraryEntry = {
          id: crypto.randomUUID(),
          image,
          tags: [...getIconTags(subject).keys()],
          kind: subject.kind,
          sourceName: target.name,
          prompt,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
        };
        try {
          await setDoc(doc(db, 'iconLibrary', entry.id), entry);
          return entry.id;
        } catch (err) {
          console.error('[IconLibrary] failed to save generated icon:', err);
        }
      }
    }
    return matchLibraryIcon(subject, iconsRef.current)?.id;
  }, [user, canGenerate]);

  return { icons, iconImages, assignIcon };
}
