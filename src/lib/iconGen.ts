import type { IconLibraryEntry, InventoryItem, Mob, Spell } from '@/lib/gameData';

/**
 * Pixel-art icon helpers: prompt building, descriptor tags, library matching and the
 * call to the Cloudflare icon Worker (see icon-worker/). No Firebase access here.
 */

export type IconSubject =
  | { kind: 'item'; item: InventoryItem }
  | { kind: 'spell'; spell: Spell }
  | { kind: 'mob'; mob: Pick<Mob, 'name' | 'description'> & Partial<Mob> };

export const ICON_SIZE = 48;
/** Mob portraits are shown as map tokens, so they get more pixels than item icons. */
export const PORTRAIT_SIZE = 128;

function subjectTarget(subject: IconSubject): { name: string; description: string; tags?: string[] } {
  if (subject.kind === 'item') return subject.item;
  if (subject.kind === 'spell') return subject.spell;
  const { mob } = subject;
  return { name: mob.name, description: [mob.description, mob.strengths, mob.weaknesses].filter(Boolean).join('. ') };
}
/** The deployed icon Worker (icon-worker/); VITE_ICON_API_URL overrides it. Not a secret. */
const DEFAULT_ICON_API_URL = 'https://dndmeetsdcc-icons.icon-worker.workers.dev';
const ICON_API_URL = ((import.meta.env.VITE_ICON_API_URL as string | undefined) || DEFAULT_ICON_API_URL).replace(/\/$/, '');
const QUOTA_KEY = 'iconGen.quotaExhaustedUntil';

/** Canonical concept → words that mean it. Tags are stored as the canonical concept. */
const CONCEPTS: Record<string, string[]> = {
  sword: ['sword', 'blade', 'katana', 'saber', 'sabre', 'rapier', 'scimitar', 'longsword', 'shortsword', 'cutlass', 'broadsword', 'claymore'],
  dagger: ['dagger', 'knife', 'shiv', 'dirk', 'stiletto', 'shank'],
  axe: ['axe', 'hatchet', 'tomahawk', 'cleaver'],
  hammer: ['hammer', 'mace', 'maul', 'club', 'cudgel', 'flail', 'morningstar', 'bat'],
  spear: ['spear', 'polearm', 'halberd', 'lance', 'pike', 'trident', 'glaive', 'javelin'],
  bow: ['bow', 'longbow', 'shortbow', 'arrow', 'arrows', 'quiver'],
  crossbow: ['crossbow', 'bolt', 'bolts'],
  gun: ['gun', 'pistol', 'rifle', 'shotgun', 'firearm', 'firearms', 'revolver', 'blaster', 'musket', 'bullet', 'bullets', 'ammo'],
  explosive: ['bomb', 'grenade', 'explosive', 'dynamite', 'tnt', 'mine', 'explosion', 'explode', 'blast'],
  whip: ['whip', 'lash', 'chain'],
  staff: ['staff', 'wand', 'rod', 'scepter', 'sceptre', 'stave'],
  shield: ['shield', 'buckler', 'ward', 'barrier', 'protection', 'protect', 'block'],
  helmet: ['helmet', 'helm', 'hat', 'cap', 'hood', 'crown', 'circlet', 'tiara', 'mask', 'head'],
  armor: ['armor', 'armour', 'chestplate', 'breastplate', 'mail', 'vest', 'tunic', 'robe', 'cloak', 'jacket', 'shirt', 'coat', 'chest'],
  pants: ['pants', 'trousers', 'leggings', 'greaves', 'legs', 'shorts', 'skirt'],
  boots: ['boots', 'boot', 'shoes', 'shoe', 'sandals', 'feet', 'sneakers', 'slippers'],
  gloves: ['gloves', 'glove', 'gauntlet', 'gauntlets', 'bracers', 'hand', 'hands', 'fist'],
  ring: ['ring', 'band', 'signet'],
  amulet: ['amulet', 'necklace', 'pendant', 'talisman', 'charm', 'locket', 'medallion'],
  potion: ['potion', 'elixir', 'flask', 'vial', 'tonic', 'brew', 'draught', 'bottle', 'drink', 'philter'],
  food: ['food', 'meat', 'bread', 'apple', 'ration', 'rations', 'snack', 'cheese', 'jerky', 'meal', 'cookie', 'candy', 'mushroom'],
  scroll: ['scroll', 'parchment', 'map', 'letter', 'note', 'paper', 'page'],
  book: ['book', 'tome', 'grimoire', 'spellbook', 'journal', 'manual', 'codex'],
  key: ['key', 'keycard', 'lockpick', 'lock'],
  coin: ['coin', 'coins', 'gold', 'money', 'treasure', 'currency', 'cash'],
  gem: ['gem', 'jewel', 'crystal', 'diamond', 'ruby', 'emerald', 'sapphire', 'shard', 'stone', 'orb'],
  box: ['box', 'chest', 'crate', 'bag', 'pouch', 'sack', 'backpack', 'container', 'lootbox'],
  tool: ['tool', 'tools', 'wrench', 'pickaxe', 'shovel', 'rope', 'torch', 'lantern', 'kit'],
  tech: ['tech', 'device', 'gadget', 'robot', 'drone', 'computer', 'mechanical', 'gear', 'cyber', 'implant', 'upgrade'],
  fire: ['fire', 'flame', 'flames', 'burn', 'burning', 'blaze', 'inferno', 'ember', 'embers', 'lava', 'magma', 'heat', 'fireball', 'scorch'],
  ice: ['ice', 'frost', 'frozen', 'freeze', 'cold', 'snow', 'blizzard', 'chill', 'glacial'],
  lightning: ['lightning', 'electric', 'electricity', 'shock', 'thunder', 'storm', 'spark', 'volt', 'static', 'zap'],
  poison: ['poison', 'poisonous', 'toxic', 'venom', 'acid', 'disease', 'plague', 'sickness', 'rot'],
  radiation: ['radiation', 'radioactive', 'nuclear', 'atomic', 'glow'],
  water: ['water', 'wave', 'ocean', 'sea', 'rain', 'tide', 'bubble'],
  wind: ['wind', 'air', 'gust', 'tornado', 'whirlwind', 'breeze'],
  earth: ['earth', 'rock', 'boulder', 'quake', 'earthquake', 'mud', 'sand'],
  nature: ['nature', 'plant', 'vine', 'vines', 'tree', 'leaf', 'flower', 'thorn', 'thorns', 'root', 'herb', 'druid'],
  shadow: ['shadow', 'dark', 'darkness', 'void', 'night', 'shade', 'curse', 'cursed', 'hex'],
  light: ['light', 'holy', 'radiant', 'divine', 'sun', 'sunlight', 'blessed', 'bless', 'angel'],
  death: ['death', 'necromancy', 'necrotic', 'skull', 'bone', 'bones', 'undead', 'zombie', 'skeleton', 'ghost', 'soul', 'drain'],
  healing: ['healing', 'heal', 'heals', 'cure', 'restore', 'regenerate', 'regeneration', 'health', 'medkit', 'bandage', 'bandages', 'mend'],
  mind: ['mind', 'psychic', 'emotional', 'emotion', 'charm', 'enchantment', 'enchant', 'confuse', 'fear', 'sleep', 'dream', 'hypnosis', 'brain'],
  illusion: ['illusion', 'invisible', 'invisibility', 'disguise', 'mirror', 'phantom', 'stealth'],
  spirit: ['spirit', 'spiritual', 'ethereal', 'astral', 'aura'],
  arcane: ['arcane', 'magic', 'magical', 'mana', 'rune', 'runes', 'sigil', 'missile', 'evocation', 'enchanted'],
  summon: ['summon', 'conjure', 'conjuration', 'portal', 'teleport', 'teleportation', 'familiar', 'gate'],
  transform: ['transmutation', 'transform', 'polymorph', 'shapeshift', 'alchemy', 'alter'],
  vision: ['divination', 'eye', 'see', 'sight', 'detect', 'scry', 'reveal', 'vision', 'foresight', 'insight'],
  speed: ['speed', 'haste', 'fast', 'quick', 'swift', 'dash', 'run'],
  strength: ['strength', 'strong', 'might', 'power', 'rage', 'berserk', 'muscle'],
  goblin: ['goblin', 'goblins', 'hobgoblin', 'kobold', 'imp', 'gremlin', 'gnome', 'gnomes'],
  orc: ['orc', 'orcs', 'ogre', 'troll', 'brute', 'barbarian'],
  giant: ['giant', 'titan', 'colossus', 'golem', 'cyclops'],
  humanoid: ['human', 'man', 'woman', 'person', 'merchant', 'shopkeeper', 'guard', 'soldier', 'knight', 'bandit', 'thief', 'wizard', 'mage', 'priest', 'king', 'queen', 'villager', 'elf', 'dwarf', 'halfling'],
  demon: ['demon', 'devil', 'fiend', 'infernal', 'hellhound'],
  slime: ['slime', 'ooze', 'blob', 'jelly', 'goo'],
  insect: ['insect', 'bug', 'beetle', 'ant', 'wasp', 'scorpion', 'centipede', 'mantis', 'roach', 'cockroach'],
  animal: ['animal', 'beast', 'wolf', 'bear', 'cat', 'dog', 'bird', 'snake', 'spider', 'rat', 'dragon', 'fang', 'claw', 'feather', 'scale'],
};

const WORD_TO_CONCEPT = new Map<string, string>();
for (const [concept, words] of Object.entries(CONCEPTS)) {
  for (const w of words) if (!WORD_TO_CONCEPT.has(w)) WORD_TO_CONCEPT.set(w, concept);
}

const SLOT_CONCEPT: Record<string, string> = {
  head: 'helmet', chest: 'armor', legs: 'pants', feet: 'boots', leftHand: 'shield',
  rightHand: 'gloves', ringFinger: 'ring', weapon: 'sword',
};

const WEAPON_TYPE_CONCEPT: Record<string, string> = {
  Arcane: 'staff', Bows: 'bow', Crossbows: 'crossbow', Firearms: 'gun', 'Heavy weapons': 'hammer',
  'Light weapons': 'dagger', Polearms: 'spear', Throwing: 'dagger', Whips: 'whip',
  Mechanical: 'tech', 'Body Upgrade': 'tech', Improvised: 'tool',
};

const DAMAGE_CONCEPT: Record<string, string> = {
  Fire: 'fire', Electric: 'lightning', Poison: 'poison', Disease: 'poison', Radiation: 'radiation',
  Spiritual: 'spirit', Emotional: 'mind', Healing: 'healing',
};

const SCHOOL_CONCEPT: Record<string, string> = {
  Evocation: 'arcane', Necromancy: 'death', Illusion: 'illusion', Conjuration: 'summon',
  Abjuration: 'shield', Divination: 'vision', Transmutation: 'transform', Enchantment: 'mind',
};

function words(text: string | undefined): string[] {
  return (text || '').toLowerCase().match(/[a-z]+/g) || [];
}

function conceptsIn(text: string | undefined): string[] {
  const found: string[] = [];
  for (const w of words(text)) {
    const c = WORD_TO_CONCEPT.get(w) ?? WORD_TO_CONCEPT.get(w.replace(/(es|s)$/, ''));
    if (c) found.push(c);
  }
  return found;
}

/** Weighted descriptor tags: name concepts count most, then explicit tags and stats, then description. */
export function getIconTags(subject: IconSubject): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (tag: string | undefined, w: number) => {
    if (tag) weights.set(tag, Math.max(weights.get(tag) ?? 0, w));
  };
  const target = subjectTarget(subject);
  conceptsIn(target.description).forEach(c => add(c, 1));
  (target.tags || []).forEach(t => conceptsIn(t).forEach(c => add(c, 2)));

  if (subject.kind === 'item') {
    const { item } = subject;
    if (item.equipSlot) add(SLOT_CONCEPT[item.equipSlot], 2);
    if (item.weaponData) {
      add(WEAPON_TYPE_CONCEPT[item.weaponData.weaponType], 2);
      add(DAMAGE_CONCEPT[item.weaponData.damageType], 2);
    }
    if (item.isSpellTome) add('book', 3);
  } else if (subject.kind === 'mob') {
    const { mob } = subject;
    if (mob.boss) add('strength', 1);
    if (mob.kind === 'character' && !weights.size) add('humanoid', 1);
  } else {
    const { spellData } = subject.spell;
    add(SCHOOL_CONCEPT[spellData?.school], 2);
    if (spellData?.damageType) add(DAMAGE_CONCEPT[spellData.damageType], 2);
  }
  conceptsIn(target.name).forEach(c => add(c, 3));
  return weights;
}

/** Text prompt for the image model, built from everything known about the item or spell. */
export function buildIconPrompt(subject: IconSubject): string {
  const target = subjectTarget(subject);
  const desc = (target.description || '').replace(/\s+/g, ' ').trim().slice(0, 220).replace(/([^.!?])$/, '$1.');
  let detail = '';
  if (subject.kind === 'mob') {
    const { mob } = subject;
    const bits = [mob.boss && 'fearsome boss', mob.level && `level ${mob.level}`, mob.kind === 'character' ? 'unique named character' : 'creature'].filter(Boolean);
    return `16-bit pixel art RPG character portrait of ${target.name} (${bits.join(', ')}). ${desc} ` +
      'Full body, facing the viewer, centered, bold dark outline, limited color palette, crisp pixels, plain dark background, no text, no border.';
  }
  if (subject.kind === 'item') {
    const { item } = subject;
    const bits = [
      item.weaponData && `${item.weaponData.damageType !== 'Basic' ? item.weaponData.damageType.toLowerCase() + ' ' : ''}${item.weaponData.weaponType.toLowerCase().replace(/s$/, '')}`,
      item.isSpellTome && 'magic spell tome',
      item.equipSlot && !item.weaponData && `worn on the ${item.equipSlot.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
    ].filter(Boolean);
    detail = bits.length ? ` (${bits.join(', ')})` : '';
  } else {
    const sd = subject.spell.spellData;
    detail = ` (${[sd?.school, sd?.damageType && sd.damageType !== 'Basic' ? sd.damageType : '', 'spell effect'].filter(Boolean).join(' ').toLowerCase()})`;
  }
  return `16-bit pixel art RPG inventory icon of ${target.name}${detail}. ${desc} ` +
    'Single centered object, bold dark outline, limited color palette, crisp pixels, plain dark background, no text, no border.';
}

/**
 * Best existing icon for a new item/spell: weighted tag overlap, a small bonus for the same kind,
 * and a bonus when the source names share a word. Returns undefined when nothing relates.
 */
export function matchLibraryIcon(subject: IconSubject, library: IconLibraryEntry[]): IconLibraryEntry | undefined {
  const tags = getIconTags(subject);
  const target = subjectTarget(subject);
  const nameWords = new Set(words(target.name).filter(w => w.length > 3));
  let best: IconLibraryEntry | undefined;
  let bestScore = 0;
  for (const entry of library) {
    // Mob portraits and item/spell icons are different sizes and framings, so they never mix
    if ((entry.kind === 'mob') !== (subject.kind === 'mob')) continue;
    let score = 0;
    for (const t of entry.tags) score += tags.get(t) ?? 0;
    if (score === 0) continue;
    if (entry.kind === subject.kind) score += 0.5;
    if (words(entry.sourceName).some(w => nameWords.has(w))) score += 1;
    score -= entry.tags.length * 0.05; // prefer focused icons over ones tagged with everything
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

export function isIconGenerationConfigured(): boolean {
  return !!ICON_API_URL;
}

function quotaExhausted(): boolean {
  try {
    return Date.now() < Number(localStorage.getItem(QUOTA_KEY) || 0);
  } catch {
    return false;
  }
}

function markQuotaExhausted() {
  // Workers AI free allocation resets at 00:00 UTC
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  try {
    localStorage.setItem(QUOTA_KEY, String(reset.getTime()));
  } catch {
    // storage unavailable; the Worker will just answer 429 again
  }
}

/** Downscale a generated image to a small pixel-art PNG data URL. */
async function pixelate(base64Jpeg: string, size: number): Promise<string> {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${base64Jpeg}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, size, size);
  // Posterize to a limited palette so the result reads as pixel art
  const data = ctx.getImageData(0, 0, size, size);
  const step = 32;
  for (let i = 0; i < data.data.length; i += 4) {
    for (let c = 0; c < 3; c++) data.data[i + c] = Math.min(255, Math.round(data.data[i + c] / step) * step);
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Ask the icon Worker for a new icon. Resolves to a PNG data URL, or null when generation is
 * unavailable (not configured, daily free quota used up, or any error) so callers can fall back.
 */
export async function generateIconImage(prompt: string, idToken: string, size = ICON_SIZE): Promise<string | null> {
  if (!ICON_API_URL || quotaExhausted()) return null;
  try {
    const res = await fetch(`${ICON_API_URL}/icon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ prompt }),
    });
    if (res.status === 429) {
      markQuotaExhausted();
      return null;
    }
    if (!res.ok) return null;
    const { image } = await res.json() as { image?: string };
    return image ? await pixelate(image, size) : null;
  } catch (err) {
    console.warn('[IconGen] generation failed, falling back to library match', err);
    return null;
  }
}
