/**
 * Merge helpers for arrays stored inside one Firestore document (e.g. an inventory's
 * `items`). Saving the whole array lets two people who edit at the same moment wipe out
 * each other's changes. Instead we diff what this client started from against what it
 * wants, and replay only that change onto the latest copy on the server.
 *
 * Elements are matched by `id`. Repeated ids (the same item twice) are matched by
 * occurrence, so removing one copy removes only one.
 */

type Element = Record<string, unknown>;

export interface ArrayDiff {
  added: { key: string; value: Element }[];
  removed: Set<string>;
  changed: Map<string, Element>;
}

const baseKey = (el: Element): string =>
  typeof el?.id === 'string' || typeof el?.id === 'number' ? `id:${String(el.id)}` : `json:${JSON.stringify(el)}`;

/** Key each element by id plus its occurrence number among elements with that id. */
const keyed = (arr: Element[]): { key: string; value: Element }[] => {
  const seen = new Map<string, number>();
  return arr.map((value) => {
    const k = baseKey(value);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return { key: `${k}#${n}`, value };
  });
};

export const diffById = (base: Element[], next: Element[]): ArrayDiff => {
  const baseMap = new Map(keyed(base).map(({ key, value }) => [key, value]));
  const nextKeyed = keyed(next);
  const nextKeys = new Set(nextKeyed.map(({ key }) => key));

  const added: ArrayDiff['added'] = [];
  const changed = new Map<string, Element>();
  for (const { key, value } of nextKeyed) {
    const before = baseMap.get(key);
    if (!before) added.push({ key, value });
    else if (JSON.stringify(before) !== JSON.stringify(value)) changed.set(key, value);
  }
  const removed = new Set([...baseMap.keys()].filter((k) => !nextKeys.has(k)));
  return { added, removed, changed };
};

export const isEmptyDiff = (d: ArrayDiff) => d.added.length === 0 && d.removed.size === 0 && d.changed.size === 0;

/** Apply a diff onto the server's current array. Server-side changes by others are kept. */
export const applyDiff = (server: Element[], diff: ArrayDiff): Element[] => {
  const result: Element[] = [];
  const present = new Set<string>();
  for (const { key, value } of keyed(server)) {
    present.add(key);
    if (diff.removed.has(key)) continue;
    result.push(diff.changed.get(key) ?? value);
  }
  for (const { key, value } of diff.added) {
    // Someone else already added this exact element (same id/occurrence): don't duplicate it
    if (present.has(key)) continue;
    result.push(value);
  }
  return result;
};
