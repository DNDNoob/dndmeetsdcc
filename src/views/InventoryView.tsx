import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Crawler, InventoryItem, EquipmentSlot as SlotType, StatModifiers } from "@/lib/gameData";
import { EquipmentSlot } from "@/components/ui/EquipmentSlot";
import { Coins, Package, Sword, Shield, Plus, Trash2, Edit2, Save, HardHat, Search, BookOpen, Gem, Footprints, Shirt, Hand } from "lucide-react";

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

  // Library item form state
  const [newLibraryItem, setNewLibraryItem] = useState<{ name: string; description: string; equipSlot?: SlotType; goldValue?: number; statModifiers?: StatModifiers }>({
    name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined,
  });
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
    });
  };

  const handleSaveOrAddLibraryItem = () => {
    if (!newLibraryItem.name.trim()) return;
    const items = getSharedInventory();
    const mods = newLibraryItem.statModifiers
      ? Object.fromEntries(Object.entries(newLibraryItem.statModifiers).filter(([, v]) => v !== 0 && v !== undefined))
      : undefined;

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
            }
          : item
      );
      onUpdateSharedInventory(updated);

      // Sync edits to all crawler inventories that have copies of this item
      if (oldItem) {
        const oldSig = getItemSignature(oldItem);
        crawlers.forEach(crawler => {
          const crawlerItems = getCrawlerInventory(crawler.id);
          let hasMatch = false;
          const updatedCrawlerItems = crawlerItems.map(ci => {
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
      };
      onUpdateSharedInventory([...items, item]);
    }
    setEditingLibraryItemId(null);
    setNewLibraryItem({ name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined });
  };

  const handleCancelEditLibraryItem = () => {
    setEditingLibraryItemId(null);
    setNewLibraryItem({ name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined });
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

  const handleEquipItem = (crawlerId: string, slot: SlotType, itemId: string) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler) return;
    const updatedEquipped = { ...(crawler.equippedItems ?? {}), [slot]: itemId };
    onUpdateCrawler(crawlerId, { equippedItems: updatedEquipped });
  };

  const handleUnequipItem = (crawlerId: string, slot: SlotType) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler) return;
    const updatedEquipped = { ...(crawler.equippedItems ?? {}) };
    delete updatedEquipped[slot];
    onUpdateCrawler(crawlerId, { equippedItems: updatedEquipped });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      <DungeonCard>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-primary text-glow-cyan flex items-center gap-3">
            <Package className="w-6 h-6" />
            CRAWLER INVENTORY
          </h2>
          <DungeonButton
            variant="admin"
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

                <div className="flex gap-4">
                  {/* Items list */}
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
                              className={`flex items-center gap-3 text-sm py-2 border-b border-border/50 last:border-0${item.equipSlot ? ' cursor-grab' : ''}`}
                              draggable={!!item.equipSlot}
                              onDragStart={item.equipSlot ? (e) => {
                                e.dataTransfer.setData('application/json', JSON.stringify(item));
                              } : undefined}
                              onDoubleClick={item.equipSlot ? () => {
                                const slot = item.equipSlot!;
                                handleEquipItem(crawler.id, slot, item.id);
                              } : undefined}
                            >
                              {/* Item type icon */}
                              {getEquipmentIcon(item.equipSlot)}
                              <div className="flex flex-col flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {consolidated.count > 1 && (
                                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">
                                      x{consolidated.count}
                                    </span>
                                  )}
                                  <span className="text-foreground">{item.name}</span>
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
                                {item.description && (
                                  <span className="text-muted-foreground text-xs">({item.description})</span>
                                )}
                              </div>
                              {editMode && (
                                <button
                                  onClick={() => handleRemoveItem(crawler.id, consolidated.ids[0])}
                                  className="text-destructive hover:text-destructive/80"
                                  title={consolidated.count > 1 ? "Remove one" : "Remove"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Equipment Slots - Right Side */}
                  <div className="bg-muted/30 border border-border rounded-lg p-3 shrink-0" style={{ width: '180px' }}>
                    <h4 className="font-display text-primary text-xs mb-2">EQUIPMENT</h4>
                    <div className="flex flex-col items-center gap-1">
                      <EquipmentSlot slot="head" label="Head" equippedItem={items.find(i => i.id === crawler.equippedItems?.head)} onDrop={(slot, itemId) => handleEquipItem(crawler.id, slot, itemId)} onUnequip={(slot) => handleUnequipItem(crawler.id, slot)} />
                      <div className="grid grid-cols-3 gap-1" style={{ width: '168px' }}>
                        <EquipmentSlot slot="leftHand" label="L.Hand" equippedItem={items.find(i => i.id === crawler.equippedItems?.leftHand)} onDrop={(slot, itemId) => handleEquipItem(crawler.id, slot, itemId)} onUnequip={(slot) => handleUnequipItem(crawler.id, slot)} />
                        <EquipmentSlot slot="chest" label="Chest" equippedItem={items.find(i => i.id === crawler.equippedItems?.chest)} onDrop={(slot, itemId) => handleEquipItem(crawler.id, slot, itemId)} onUnequip={(slot) => handleUnequipItem(crawler.id, slot)} />
                        <EquipmentSlot slot="rightHand" label="R.Hand" equippedItem={items.find(i => i.id === crawler.equippedItems?.rightHand)} onDrop={(slot, itemId) => handleEquipItem(crawler.id, slot, itemId)} onUnequip={(slot) => handleUnequipItem(crawler.id, slot)} />
                      </div>
                      <div className="grid grid-cols-3 gap-1" style={{ width: '168px' }}>
                        <EquipmentSlot slot="ringFinger" label="Ring" equippedItem={items.find(i => i.id === crawler.equippedItems?.ringFinger)} onDrop={(slot, itemId) => handleEquipItem(crawler.id, slot, itemId)} onUnequip={(slot) => handleUnequipItem(crawler.id, slot)} />
                        <EquipmentSlot slot="legs" label="Legs" equippedItem={items.find(i => i.id === crawler.equippedItems?.legs)} onDrop={(slot, itemId) => handleEquipItem(crawler.id, slot, itemId)} onUnequip={(slot) => handleUnequipItem(crawler.id, slot)} />
                        <EquipmentSlot slot="weapon" label="Weapon" equippedItem={items.find(i => i.id === crawler.equippedItems?.weapon)} onDrop={(slot, itemId) => handleEquipItem(crawler.id, slot, itemId)} onUnequip={(slot) => handleUnequipItem(crawler.id, slot)} />
                      </div>
                      <EquipmentSlot slot="feet" label="Feet" equippedItem={items.find(i => i.id === crawler.equippedItems?.feet)} onDrop={(slot, itemId) => handleEquipItem(crawler.id, slot, itemId)} onUnequip={(slot) => handleUnequipItem(crawler.id, slot)} />
                    </div>
                  </div>
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
