import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Crawler, InventoryItem, EquipmentSlot as SlotType, StatModifiers, WeaponData, DAMAGE_TYPES, WEAPON_TYPES, DamageType, WeaponType } from "@/lib/gameData";
import { Coins, Package, Sword, Shield, Plus, Trash2, Edit2, Save, HardHat, Search, BookOpen, Gem, Footprints, Shirt, Hand, Crosshair, ChevronDown, ChevronUp } from "lucide-react";

// Inline SVG for legs/pants slot
const LegsIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h12v6l-2 14h-2l-1-10h-2l-1 10H8L6 8V2z" />
  </svg>
);

// Helper to get the appropriate icon for an equipment slot
const getEquipmentIcon = (slot?: string, className: string = "w-4 h-4 shrink-0") => {
  switch (slot) {
    case 'weapon':
      return <Sword className={`${className} text-destructive`} />;
    case 'ringFinger':
      return <Gem className={`${className} text-purple-400`} />;
    case 'feet':
      return <Footprints className={`${className} text-amber-600`} />;
    case 'head':
      return <HardHat className={`${className} text-accent`} />;
    case 'chest':
      return <Shirt className={`${className} text-blue-400`} />;
    case 'leftHand':
    case 'rightHand':
      return <Hand className={`${className} text-accent`} />;
    case 'legs':
      return <LegsIcon className={`${className} text-green-400`} />;
    default:
      if (slot) return <HardHat className={`${className} text-accent`} />;
      return <Package className={`${className} text-muted-foreground`} />;
  }
};
import { useDebouncedCallback } from "@/hooks/useDebounce";

interface InventoryViewProps {
  crawlers: Crawler[];
  getCrawlerInventory: (crawlerId: string) => InventoryItem[];
  partyGold: number;
  onUpdateInventory: (crawlerId: string, items: InventoryItem[]) => void;
  onUpdateCrawler: (id: string, updates: Partial<Crawler>) => void;
  getSharedInventory: () => InventoryItem[];
  onUpdateSharedInventory: (items: InventoryItem[]) => void;
}

// Helper to create item signature for grouping
const getItemSignature = (item: InventoryItem): string => {
  const modifiersStr = item.statModifiers
    ? JSON.stringify(Object.entries(item.statModifiers).filter(([, v]) => v !== 0).sort())
    : '';
  return `${item.name}|${item.description || ''}|${item.equipSlot || ''}|${item.goldValue ?? 0}|${modifiersStr}`;
};

// Consolidate items by signature
interface ConsolidatedItem {
  item: InventoryItem;
  count: number;
  ids: string[];
}

const consolidateItems = (items: InventoryItem[]): ConsolidatedItem[] => {
  const groups = new Map<string, ConsolidatedItem>();
  for (const item of items) {
    const sig = getItemSignature(item);
    const existing = groups.get(sig);
    if (existing) {
      existing.count++;
      existing.ids.push(item.id);
    } else {
      groups.set(sig, { item, count: 1, ids: [item.id] });
    }
  }
  return Array.from(groups.values());
};

const InventoryView: React.FC<InventoryViewProps> = ({
  crawlers,
  getCrawlerInventory,
  partyGold,
  onUpdateInventory,
  onUpdateCrawler,
  getSharedInventory,
  onUpdateSharedInventory,
}) => {
  const [editMode, setEditMode] = useState(false);
  // Expanded item details state
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const toggleItemExpanded = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Individual item editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemData, setEditingItemData] = useState<{ name: string; description: string }>({ name: '', description: '' });

  const handleStartEditItem = (crawlerId: string, item: InventoryItem) => {
    setEditingItemId(`${crawlerId}:${item.id}`);
    setEditingItemData({ name: item.name, description: item.description });
  };

  const handleSaveEditItem = (crawlerId: string, itemId: string) => {
    const items = getCrawlerInventory(crawlerId);
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, name: editingItemData.name.trim() || item.name, description: editingItemData.description } : item
    );
    onUpdateInventory(crawlerId, updatedItems);
    setEditingItemId(null);
  };

  // Library item form state
  const [newLibraryItem, setNewLibraryItem] = useState<{ name: string; description: string; equipSlot?: SlotType; goldValue?: number; statModifiers?: StatModifiers; weaponData?: WeaponData }>({
    name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined, weaponData: undefined,
  });
  const [showWeaponConfig, setShowWeaponConfig] = useState(false);
  // Track which library item is being edited (null = adding new)
  const [editingLibraryItemId, setEditingLibraryItemId] = useState<string | null>(null);
  // Per-crawler search queries
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  // Quantity to add per library item
  const [addQuantities, setAddQuantities] = useState<Record<string, number>>({});

  // Local gold state for immediate UI updates (avoids lag while typing)
  const [localGold, setLocalGold] = useState<Record<string, number>>({});

  // Initialize local gold from crawlers
  useEffect(() => {
    const goldMap: Record<string, number> = {};
    crawlers.forEach(c => {
      goldMap[c.id] = c.gold || 0;
    });
    setLocalGold(goldMap);
  }, [crawlers]);

  // Debounced Firebase update (300ms delay to batch rapid changes)
  const debouncedGoldUpdate = useDebouncedCallback(
    (crawlerId: string, value: number) => {
      onUpdateCrawler(crawlerId, { gold: Math.max(0, Math.floor(value)) });
    },
    300
  );

  const handleRemoveItem = (crawlerId: string, itemId: string) => {
    const items = getCrawlerInventory(crawlerId);
    onUpdateInventory(crawlerId, items.filter((i) => i.id !== itemId));
  };

  const handleGoldChange = (crawlerId: string, delta: number) => {
    const currentGold = localGold[crawlerId] || 0;
    const newGold = Math.max(0, currentGold + delta);
    // Update local state immediately
    setLocalGold(prev => ({ ...prev, [crawlerId]: newGold }));
    // Debounce the Firebase update
    debouncedGoldUpdate(crawlerId, newGold);
  };

  const handleGoldSet = (crawlerId: string, value: number) => {
    const newGold = Math.max(0, Math.floor(value));
    setLocalGold(prev => ({ ...prev, [crawlerId]: newGold }));
    debouncedGoldUpdate(crawlerId, newGold);
  };

  // Library item handlers
  const handleRemoveLibraryItem = (itemId: string) => {
    const items = getSharedInventory();
    onUpdateSharedInventory(items.filter((i) => i.id !== itemId));
  };

  const handleStartEditLibraryItem = (item: InventoryItem) => {
    setEditingLibraryItemId(item.id);
    setNewLibraryItem({
      name: item.name,
      description: item.description,
      equipSlot: item.equipSlot,
      goldValue: item.goldValue,
      statModifiers: item.statModifiers,
      weaponData: item.weaponData,
    });
    setShowWeaponConfig(!!item.weaponData);
  };

  const handleSaveOrAddLibraryItem = () => {
    if (!newLibraryItem.name.trim()) return;
    const items = getSharedInventory();
    const mods = newLibraryItem.statModifiers
      ? Object.fromEntries(Object.entries(newLibraryItem.statModifiers).filter(([, v]) => v !== 0 && v !== undefined))
      : undefined;

    const weaponFields = newLibraryItem.weaponData
      ? { weaponData: newLibraryItem.weaponData }
      : { weaponData: undefined };

    if (editingLibraryItemId) {
      // Get the old item for matching in crawler inventories
      const oldItem = items.find(i => i.id === editingLibraryItemId);

      // Update existing item in library
      const updated = items.map(item =>
        item.id === editingLibraryItemId
          ? {
              ...item,
              name: newLibraryItem.name,
              description: newLibraryItem.description,
              equipSlot: newLibraryItem.equipSlot,
              goldValue: newLibraryItem.goldValue,
              ...(mods && Object.keys(mods).length > 0 ? { statModifiers: mods } : { statModifiers: undefined }),
              ...weaponFields,
            }
          : item
      );
      onUpdateSharedInventory(updated);

      // Sync edits to all crawler inventories that have NON-UPGRADED copies of this item
      if (oldItem) {
        const oldSig = getItemSignature(oldItem);
        crawlers.forEach(crawler => {
          const crawlerItems = getCrawlerInventory(crawler.id);
          let hasMatch = false;
          const updatedCrawlerItems = crawlerItems.map(ci => {
            // Don't sync changes to upgraded items - those are crawler-specific
            if (ci.isUpgraded) return ci;
            const ciSig = getItemSignature(ci);
            if (ciSig === oldSig) {
              hasMatch = true;
              return {
                ...ci,
                name: newLibraryItem.name,
                description: newLibraryItem.description,
                equipSlot: newLibraryItem.equipSlot,
                goldValue: newLibraryItem.goldValue,
                ...(mods && Object.keys(mods).length > 0 ? { statModifiers: mods } : { statModifiers: undefined }),
                ...weaponFields,
              };
            }
            return ci;
          });
          if (hasMatch) {
            onUpdateInventory(crawler.id, updatedCrawlerItems);
          }
        });
      }
    } else {
      // Add new item
      const item: InventoryItem = {
        id: crypto.randomUUID(),
        name: newLibraryItem.name,
        description: newLibraryItem.description,
        equipSlot: newLibraryItem.equipSlot,
        goldValue: newLibraryItem.goldValue,
        ...(mods && Object.keys(mods).length > 0 ? { statModifiers: mods } : {}),
        ...weaponFields,
      };
      onUpdateSharedInventory([...items, item]);
    }
    setEditingLibraryItemId(null);
    setNewLibraryItem({ name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined, weaponData: undefined });
    setShowWeaponConfig(false);
  };

  const handleCancelEditLibraryItem = () => {
    setEditingLibraryItemId(null);
    setNewLibraryItem({ name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined, weaponData: undefined });
    setShowWeaponConfig(false);
  };

  const handleAddLibraryItemToCrawler = (crawlerId: string, libraryItem: InventoryItem, quantity: number = 1) => {
    const items = getCrawlerInventory(crawlerId);
    const newItems: InventoryItem[] = [];
    for (let i = 0; i < quantity; i++) {
      newItems.push({ ...libraryItem, id: crypto.randomUUID() });
    }
    onUpdateInventory(crawlerId, [...items, ...newItems]);
  };

  const libraryItems = getSharedInventory();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-full px-4 md:px-6 py-4"
    >
      <DungeonCard>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-primary text-glow-cyan flex items-center gap-3">
            <Package className="w-6 h-6" />
            CRAWLER INVENTORY
          </h2>
          <DungeonButton
            variant="default"
            size="sm"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? (
              <>
                <Save className="w-4 h-4 mr-1" /> Done
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4 mr-1" /> Edit
              </>
            )}
          </DungeonButton>
        </div>

        {/* Party Gold (read-only sum) */}
        <div className="bg-accent/10 border border-accent p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Coins className="w-6 h-6 text-accent" />
              <span className="font-display text-accent text-glow-gold">TOTAL PARTY GOLD</span>
            </div>
            <span className="font-display text-2xl text-accent">{Math.floor(partyGold)}G</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Sum of all crawler gold</p>
        </div>

        {/* Item Library */}
        <div className="border border-primary/30 bg-muted/20 p-4 mb-6">
          <h3 className="font-display text-lg text-primary flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5" />
            ITEM LIBRARY
          </h3>
          {libraryItems.length === 0 ? (
            <p className="text-muted-foreground text-sm italic mb-3">No items in library</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
              {libraryItems.map((item) => (
                <div key={item.id} className={`flex items-start gap-2 text-sm py-2 px-3 border bg-background/50 ${editingLibraryItemId === item.id ? 'border-accent' : 'border-border/50'}`}>
                  {getEquipmentIcon(item.equipSlot, "w-4 h-4 shrink-0 mt-0.5")}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-foreground font-medium">{item.name}</span>
                      {item.equipSlot && (
                        <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                          {item.equipSlot === 'weapon' ? 'Weapon' :
                           item.equipSlot === 'leftHand' ? 'Left Hand' :
                           item.equipSlot === 'rightHand' ? 'Right Hand' :
                           item.equipSlot === 'ringFinger' ? 'Ring' :
                           item.equipSlot.charAt(0).toUpperCase() + item.equipSlot.slice(1)}
                        </span>
                      )}
                      {item.goldValue !== undefined && item.goldValue > 0 && (
                        <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Coins className="w-3 h-3" /> {item.goldValue}G
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <span className="text-muted-foreground text-xs block">({item.description})</span>
                    )}
                    {item.statModifiers && Object.keys(item.statModifiers).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(item.statModifiers).filter(([,v]) => v !== 0).map(([stat, val]) => (
                          <span key={stat} className={`text-xs px-1 rounded ${(val as number) > 0 ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                            {stat.toUpperCase()} {(val as number) > 0 ? '+' : ''}{val}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {editMode && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => handleStartEditLibraryItem(item)} className="text-primary hover:text-primary/80" title="Edit item">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleRemoveLibraryItem(item.id)} className="text-destructive hover:text-destructive/80" title="Delete item">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {editMode && (
            <div className={`space-y-2 pt-3 border-t ${editingLibraryItemId ? 'border-accent' : 'border-border/50'}`}>
              <p className="text-xs text-muted-foreground font-medium">
                {editingLibraryItemId ? '✏️ Editing Item' : '➕ Add New Item'}
              </p>
              <div className="flex gap-2">
                <input type="text" placeholder="Item name" value={newLibraryItem.name}
                  onChange={(e) => setNewLibraryItem({ ...newLibraryItem, name: e.target.value })}
                  className="bg-muted border border-border px-2 py-1 text-sm flex-1" />
                <input type="text" placeholder="Description" value={newLibraryItem.description}
                  onChange={(e) => setNewLibraryItem({ ...newLibraryItem, description: e.target.value })}
                  className="bg-muted border border-border px-2 py-1 text-sm flex-1" />
              </div>
              <div className="flex gap-2">
                <select value={newLibraryItem.equipSlot || ""}
                  onChange={(e) => setNewLibraryItem({ ...newLibraryItem, equipSlot: e.target.value as SlotType || undefined })}
                  className="bg-muted border border-border px-2 py-1 text-sm flex-1">
                  <option value="">No Equipment Slot</option>
                  <option value="weapon">Weapon</option>
                  <option value="head">Head</option>
                  <option value="chest">Chest</option>
                  <option value="legs">Legs</option>
                  <option value="feet">Feet</option>
                  <option value="leftHand">Left Hand</option>
                  <option value="rightHand">Right Hand</option>
                  <option value="ringFinger">Ring Finger</option>
                </select>
                <div className="flex items-center gap-1">
                  <Coins className="w-4 h-4 text-accent" />
                  <input type="number" placeholder="Value" value={newLibraryItem.goldValue !== undefined ? newLibraryItem.goldValue : ""}
                    onChange={(e) => setNewLibraryItem({ ...newLibraryItem, goldValue: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="bg-muted border border-border px-2 py-1 text-sm w-20" />
                </div>
                <DungeonButton variant="default" size="sm" onClick={handleSaveOrAddLibraryItem}>
                  {editingLibraryItemId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </DungeonButton>
                {editingLibraryItemId && (
                  <DungeonButton variant="danger" size="sm" onClick={handleCancelEditLibraryItem}>
                    Cancel
                  </DungeonButton>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Stat Modifiers (when equipped)</p>
                <div className="grid grid-cols-3 gap-1">
                  {(['str', 'dex', 'con', 'int', 'cha', 'hp', 'maxHP', 'mana', 'maxMana'] as const).map((stat) => (
                    <div key={stat} className="flex items-center gap-1">
                      <label className="text-xs text-muted-foreground w-12 uppercase">{stat}</label>
                      <input type="number" value={newLibraryItem.statModifiers?.[stat] ?? ""}
                        onChange={(e) => setNewLibraryItem({
                          ...newLibraryItem,
                          statModifiers: { ...newLibraryItem.statModifiers, [stat]: e.target.value ? parseInt(e.target.value) : undefined },
                        })}
                        placeholder="0" className="w-14 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Weapon Configuration */}
              {(newLibraryItem.equipSlot === 'weapon' || newLibraryItem.tags?.includes('weapon')) && (
                <div className="border border-destructive/30 bg-destructive/5 p-3 rounded space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!showWeaponConfig) {
                        setShowWeaponConfig(true);
                        if (!newLibraryItem.weaponData) {
                          setNewLibraryItem({
                            ...newLibraryItem,
                            weaponData: {
                              damageDice: [{ count: 1, sides: 6 }],
                              damageType: 'Basic',
                              weaponType: 'Light weapons',
                              isRanged: false,
                            },
                          });
                        }
                      } else {
                        setShowWeaponConfig(false);
                      }
                    }}
                    className="flex items-center gap-2 text-xs text-destructive font-display w-full"
                  >
                    <Crosshair className="w-4 h-4" />
                    WEAPON CONFIG
                    {showWeaponConfig ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                  </button>

                  {showWeaponConfig && newLibraryItem.weaponData && (() => {
                    const wd = newLibraryItem.weaponData!;
                    const updateWD = (updates: Partial<WeaponData>) => {
                      setNewLibraryItem({ ...newLibraryItem, weaponData: { ...wd, ...updates } });
                    };
                    return (
                      <div className="space-y-3">
                        {/* Weapon Type & Damage Type */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Weapon Type</label>
                            <select value={wd.weaponType} onChange={(e) => updateWD({ weaponType: e.target.value as WeaponType })}
                              className="bg-muted border border-border px-2 py-1 text-xs w-full">
                              {WEAPON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Damage Type</label>
                            <select value={wd.damageType} onChange={(e) => updateWD({ damageType: e.target.value as DamageType })}
                              className="bg-muted border border-border px-2 py-1 text-xs w-full">
                              {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Hit Die (bonus to attack roll) */}
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Bonus Hit Die (added to d20 attack roll)</label>
                          <div className="flex items-center gap-1">
                            <input type="number" min={0} max={10} value={wd.hitDie?.count ?? 0}
                              onChange={(e) => {
                                const count = parseInt(e.target.value) || 0;
                                updateWD({ hitDie: count > 0 ? { count, sides: wd.hitDie?.sides ?? 4 } : undefined });
                              }}
                              className="w-12 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                            <span className="text-xs text-muted-foreground">d</span>
                            <select value={wd.hitDie?.sides ?? 4}
                              onChange={(e) => updateWD({ hitDie: (wd.hitDie?.count ?? 0) > 0 ? { count: wd.hitDie!.count, sides: parseInt(e.target.value) } : undefined })}
                              className="bg-muted border border-border px-1 py-0.5 text-xs">
                              {[4, 6, 8, 10, 12, 20].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Damage Dice */}
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Damage Dice</label>
                          {wd.damageDice.map((die, i) => (
                            <div key={i} className="flex items-center gap-1 mb-1">
                              <input type="number" min={1} max={20} value={die.count}
                                onChange={(e) => {
                                  const updated = [...wd.damageDice];
                                  updated[i] = { ...die, count: parseInt(e.target.value) || 1 };
                                  updateWD({ damageDice: updated });
                                }}
                                className="w-12 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                              <span className="text-xs text-muted-foreground">d</span>
                              <select value={die.sides}
                                onChange={(e) => {
                                  const updated = [...wd.damageDice];
                                  updated[i] = { ...die, sides: parseInt(e.target.value) };
                                  updateWD({ damageDice: updated });
                                }}
                                className="bg-muted border border-border px-1 py-0.5 text-xs">
                                {[4, 6, 8, 10, 12, 20].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              {wd.damageDice.length > 1 && (
                                <button onClick={() => {
                                  const updated = wd.damageDice.filter((_, j) => j !== i);
                                  updateWD({ damageDice: updated });
                                }} className="text-destructive text-xs hover:underline">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => updateWD({ damageDice: [...wd.damageDice, { count: 1, sides: 6 }] })}
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add damage die
                          </button>
                        </div>

                        {/* Hit Roll Stat Modifiers */}
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Hit Roll Stat Modifiers</label>
                          <div className="grid grid-cols-5 gap-1">
                            {(['str', 'dex', 'con', 'int', 'cha'] as const).map((stat) => (
                              <div key={stat} className="flex flex-col items-center">
                                <label className="text-[9px] text-muted-foreground uppercase">{stat}</label>
                                <input type="number" value={wd.hitModifiers?.[stat] ?? ""}
                                  onChange={(e) => updateWD({
                                    hitModifiers: { ...wd.hitModifiers, [stat]: e.target.value ? parseInt(e.target.value) : undefined },
                                  })}
                                  placeholder="0" className="w-10 bg-muted border border-border px-1 py-0.5 text-[10px] text-center" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Damage Stat Modifiers */}
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Damage Stat Modifiers</label>
                          <div className="grid grid-cols-5 gap-1">
                            {(['str', 'dex', 'con', 'int', 'cha'] as const).map((stat) => (
                              <div key={stat} className="flex flex-col items-center">
                                <label className="text-[9px] text-muted-foreground uppercase">{stat}</label>
                                <input type="number" value={wd.damageModifiers?.[stat] ?? ""}
                                  onChange={(e) => updateWD({
                                    damageModifiers: { ...wd.damageModifiers, [stat]: e.target.value ? parseInt(e.target.value) : undefined },
                                  })}
                                  placeholder="0" className="w-10 bg-muted border border-border px-1 py-0.5 text-[10px] text-center" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Ranged/Melee Toggle */}
                        <div>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={wd.isRanged}
                              onChange={(e) => updateWD({ isRanged: e.target.checked })}
                              className="w-4 h-4" />
                            <span className="text-muted-foreground">Ranged Weapon</span>
                          </label>
                          {wd.isRanged && (
                            <div className="flex gap-2 mt-1">
                              <div>
                                <label className="text-[10px] text-muted-foreground block">Normal Range (ft)</label>
                                <input type="number" min={0} value={wd.normalRange ?? ""}
                                  onChange={(e) => updateWD({ normalRange: e.target.value ? parseInt(e.target.value) : undefined })}
                                  className="w-16 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground block">Max Range (ft)</label>
                                <input type="number" min={0} value={wd.maxRange ?? ""}
                                  onChange={(e) => updateWD({ maxRange: e.target.value ? parseInt(e.target.value) : undefined })}
                                  className="w-16 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Special Effects */}
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Special Effects (optional)</label>
                          <textarea value={wd.specialEffect ?? ""}
                            onChange={(e) => updateWD({ specialEffect: e.target.value || undefined })}
                            placeholder="e.g., On critical hit, target is stunned for 1 round"
                            className="w-full bg-muted border border-border px-2 py-1 text-xs resize-none h-12" />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Crawler inventories */}
        <div className="space-y-6">
          {crawlers.map((crawler) => {
            const items = getCrawlerInventory(crawler.id);
            return (
              <div key={crawler.id} className="border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg text-primary flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {crawler.name}'s Items
                  </h3>
                  {/* Individual crawler gold */}
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-accent" />
                    {editMode ? (
                      <div className="flex items-center gap-1">
                        <DungeonButton variant="danger" size="sm" onClick={() => handleGoldChange(crawler.id, -10)}>
                          -10
                        </DungeonButton>
                        <input
                          type="number"
                          value={localGold[crawler.id] ?? crawler.gold ?? 0}
                          onChange={(e) => handleGoldSet(crawler.id, parseInt(e.target.value) || 0)}
                          className="bg-background border border-accent px-2 py-1 w-20 text-right font-display text-accent text-sm"
                        />
                        <DungeonButton variant="default" size="sm" onClick={() => handleGoldChange(crawler.id, 10)}>
                          +10
                        </DungeonButton>
                      </div>
                    ) : (
                      <span className="font-display text-accent">{Math.floor(localGold[crawler.id] ?? crawler.gold ?? 0)}G</span>
                    )}
                  </div>
                </div>

                {/* Search library items */}
                {editMode && libraryItems.length > 0 && (
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search item library..."
                        value={searchQueries[crawler.id] || ""}
                        onChange={(e) => setSearchQueries(prev => ({ ...prev, [crawler.id]: e.target.value }))}
                        className="bg-muted border border-border px-2 py-1 pl-8 text-sm w-full"
                      />
                    </div>
                    {searchQueries[crawler.id] && (
                      <div className="border border-border bg-background mt-1 max-h-48 overflow-y-auto">
                        {libraryItems
                          .filter(li => li.name.toLowerCase().includes(searchQueries[crawler.id].toLowerCase()))
                          .map(li => (
                            <div key={li.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 border-b border-border/30 last:border-0">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="truncate">{li.name}</span>
                                {li.equipSlot && <span className="text-xs text-accent shrink-0">({li.equipSlot})</span>}
                                {li.goldValue && li.goldValue > 0 && (
                                  <span className="text-xs text-accent shrink-0">{li.goldValue}g</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={addQuantities[`${crawler.id}-${li.id}`] || 1}
                                  onChange={(e) => setAddQuantities(prev => ({
                                    ...prev,
                                    [`${crawler.id}-${li.id}`]: Math.max(1, Math.min(99, parseInt(e.target.value) || 1))
                                  }))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-12 bg-muted border border-border px-1 py-0.5 text-xs text-center rounded"
                                />
                                <DungeonButton variant="default" size="sm" onClick={() => {
                                  const qty = addQuantities[`${crawler.id}-${li.id}`] || 1;
                                  handleAddLibraryItemToCrawler(crawler.id, li, qty);
                                  setSearchQueries(prev => ({ ...prev, [crawler.id]: "" }));
                                  setAddQuantities(prev => ({ ...prev, [`${crawler.id}-${li.id}`]: 1 }));
                                }}>
                                  <Plus className="w-3 h-3 mr-1" /> Add
                                </DungeonButton>
                              </div>
                            </div>
                          ))}
                        {libraryItems.filter(li => li.name.toLowerCase().includes(searchQueries[crawler.id].toLowerCase())).length === 0 && (
                          <p className="text-muted-foreground text-xs italic px-3 py-2">No matching items</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                    {items.length === 0 ? (
                      <p className="text-muted-foreground text-sm italic mb-3">No items in inventory</p>
                    ) : (
                      <ul className="space-y-2 mb-3">
                        {consolidateItems(items).map((consolidated, idx) => {
                          const item = consolidated.item;
                          return (
                            <li
                              key={`${item.id}-${idx}`}
                              className="flex items-center gap-3 text-sm py-2 border-b border-border/50 last:border-0"
                            >
                              {/* Item type icon */}
                              {getEquipmentIcon(item.equipSlot)}
                              {editingItemId === `${crawler.id}:${item.id}` ? (
                                <div className="flex flex-col flex-1 gap-1">
                                  <input
                                    type="text"
                                    value={editingItemData.name}
                                    onChange={(e) => setEditingItemData(prev => ({ ...prev, name: e.target.value }))}
                                    className="bg-muted border border-border px-2 py-1 text-sm w-full"
                                    placeholder="Item name"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={editingItemData.description}
                                    onChange={(e) => setEditingItemData(prev => ({ ...prev, description: e.target.value }))}
                                    className="bg-muted border border-border px-2 py-1 text-xs w-full"
                                    placeholder="Description"
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleSaveEditItem(crawler.id, item.id)}
                                      className="text-primary hover:text-primary/80 text-xs flex items-center gap-0.5"
                                    >
                                      <Save className="w-3 h-3" /> Save
                                    </button>
                                    <button
                                      onClick={() => setEditingItemId(null)}
                                      className="text-muted-foreground hover:text-foreground text-xs"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {consolidated.count > 1 && (
                                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">
                                        x{consolidated.count}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => toggleItemExpanded(`${crawler.id}:${item.id}`)}
                                      className="text-foreground hover:text-primary transition-colors text-left flex items-center gap-1"
                                    >
                                      {item.name}
                                      {(item.description || item.statModifiers || item.weaponData || item.tags) && (
                                        expandedItems.has(`${crawler.id}:${item.id}`)
                                          ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                                          : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                      )}
                                    </button>
                                    {item.equipSlot && (
                                      <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                                        {item.equipSlot === 'weapon' ? 'Weapon' :
                                         item.equipSlot === 'leftHand' ? 'Left Hand' :
                                         item.equipSlot === 'rightHand' ? 'Right Hand' :
                                         item.equipSlot === 'ringFinger' ? 'Ring' :
                                         item.equipSlot.charAt(0).toUpperCase() + item.equipSlot.slice(1)}
                                      </span>
                                    )}
                                    {item.goldValue !== undefined && item.goldValue > 0 && (
                                      <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded flex items-center gap-1">
                                        <Coins className="w-3 h-3" /> {item.goldValue}G
                                      </span>
                                    )}
                                  </div>
                                  {!expandedItems.has(`${crawler.id}:${item.id}`) && item.description && (
                                    <span className="text-muted-foreground text-xs">({item.description})</span>
                                  )}
                                  {expandedItems.has(`${crawler.id}:${item.id}`) && (
                                    <div className="mt-2 space-y-1.5 text-xs border-l-2 border-primary/30 pl-3">
                                      {item.description && (
                                        <div>
                                          <span className="text-muted-foreground">Description: </span>
                                          <span className="text-foreground">{item.description}</span>
                                        </div>
                                      )}
                                      {item.goldValue !== undefined && item.goldValue > 0 && (
                                        <div>
                                          <span className="text-muted-foreground">Value: </span>
                                          <span className="text-accent">{item.goldValue}G</span>
                                        </div>
                                      )}
                                      {item.equipSlot && (
                                        <div>
                                          <span className="text-muted-foreground">Slot: </span>
                                          <span className="text-foreground">
                                            {item.equipSlot === 'weapon' ? 'Weapon' :
                                             item.equipSlot === 'leftHand' ? 'Left Hand' :
                                             item.equipSlot === 'rightHand' ? 'Right Hand' :
                                             item.equipSlot === 'ringFinger' ? 'Ring' :
                                             item.equipSlot.charAt(0).toUpperCase() + item.equipSlot.slice(1)}
                                          </span>
                                        </div>
                                      )}
                                      {item.tags && item.tags.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <span className="text-muted-foreground">Tags: </span>
                                          {item.tags.map(tag => (
                                            <span key={tag} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{tag}</span>
                                          ))}
                                        </div>
                                      )}
                                      {item.statModifiers && Object.keys(item.statModifiers).length > 0 && (
                                        <div>
                                          <span className="text-muted-foreground">Stat Modifiers: </span>
                                          <div className="flex flex-wrap gap-1 mt-0.5">
                                            {Object.entries(item.statModifiers).filter(([,v]) => v !== 0).map(([stat, val]) => (
                                              <span key={stat} className={`px-1.5 py-0.5 rounded ${(val as number) > 0 ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                                                {stat.toUpperCase()} {(val as number) > 0 ? '+' : ''}{val}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {item.weaponData && (
                                        <div className="border border-destructive/20 bg-destructive/5 p-2 rounded space-y-1">
                                          <span className="text-destructive font-display text-[10px]">WEAPON DATA</span>
                                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                            <div><span className="text-muted-foreground">Type: </span><span>{item.weaponData.weaponType}</span></div>
                                            <div><span className="text-muted-foreground">Damage: </span><span className="text-destructive">{item.weaponData.damageType}</span></div>
                                            <div><span className="text-muted-foreground">Dice: </span><span>{item.weaponData.damageDice.map(d => `${d.count}d${d.sides}`).join(' + ')}</span></div>
                                            <div><span className="text-muted-foreground">Range: </span><span>{item.weaponData.isRanged ? `${item.weaponData.normalRange ?? '?'}/${item.weaponData.maxRange ?? '?'} ft` : 'Melee'}</span></div>
                                            {item.weaponData.hitDie && (
                                              <div><span className="text-muted-foreground">Hit Die: </span><span>{item.weaponData.hitDie.count}d{item.weaponData.hitDie.sides}</span></div>
                                            )}
                                            {item.weaponData.splashDamage && (
                                              <div><span className="text-muted-foreground">Splash: </span><span className="text-accent">Yes</span></div>
                                            )}
                                          </div>
                                          {item.weaponData.specialEffect && (
                                            <div className="mt-1"><span className="text-muted-foreground">Special: </span><span className="text-accent italic">{item.weaponData.specialEffect}</span></div>
                                          )}
                                        </div>
                                      )}
                                      {item.isUpgraded && (
                                        <div>
                                          <span className="text-accent text-[10px] font-display">UPGRADED</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              {editMode && editingItemId !== `${crawler.id}:${item.id}` && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleStartEditItem(crawler.id, item)}
                                    className="text-primary hover:text-primary/80"
                                    title="Edit item"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveItem(crawler.id, consolidated.ids[0])}
                                    className="text-destructive hover:text-destructive/80"
                                    title={consolidated.count > 1 ? "Remove one" : "Remove"}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                </div>

              </div>
            );
          })}
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default InventoryView;
