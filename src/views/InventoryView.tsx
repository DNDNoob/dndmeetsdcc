import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Crawler, InventoryItem, EquipmentSlot as SlotType, StatModifiers } from "@/lib/gameData";
import { Coins, Package, Sword, Shield, Plus, Trash2, Edit2, Save, HardHat, Search, BookOpen } from "lucide-react";
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
  const [newItem, setNewItem] = useState<{ crawlerId: string; name: string; description: string; equipSlot?: SlotType; goldValue?: number; statModifiers?: StatModifiers }>({
    crawlerId: "",
    name: "",
    description: "",
    equipSlot: undefined,
    goldValue: undefined,
    statModifiers: undefined,
  });

  // Library item form state
  const [newLibraryItem, setNewLibraryItem] = useState<{ name: string; description: string; equipSlot?: SlotType; goldValue?: number; statModifiers?: StatModifiers }>({
    name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined,
  });
  // Editing library item state
  const [editingLibraryItemId, setEditingLibraryItemId] = useState<string | null>(null);
  const [editingLibraryItem, setEditingLibraryItem] = useState<{ name: string; description: string; equipSlot?: SlotType; goldValue?: number; statModifiers?: StatModifiers }>({
    name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined,
  });
  // Per-crawler search queries
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

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

  const handleAddItem = (crawlerId: string) => {
    if (!newItem.name.trim()) return;
    const items = getCrawlerInventory(crawlerId);
    const mods = newItem.statModifiers
      ? Object.fromEntries(Object.entries(newItem.statModifiers).filter(([, v]) => v !== 0 && v !== undefined))
      : undefined;
    const item: InventoryItem = {
      id: crypto.randomUUID(),
      name: newItem.name,
      description: newItem.description,
      equipSlot: newItem.equipSlot,
      goldValue: newItem.goldValue,
      ...(mods && Object.keys(mods).length > 0 ? { statModifiers: mods } : {}),
    };
    onUpdateInventory(crawlerId, [...items, item]);
    setNewItem({ crawlerId: "", name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined });
  };

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
  const handleAddLibraryItem = () => {
    if (!newLibraryItem.name.trim()) return;
    const items = getSharedInventory();
    const mods = newLibraryItem.statModifiers
      ? Object.fromEntries(Object.entries(newLibraryItem.statModifiers).filter(([, v]) => v !== 0 && v !== undefined))
      : undefined;
    const item: InventoryItem = {
      id: crypto.randomUUID(),
      name: newLibraryItem.name,
      description: newLibraryItem.description,
      equipSlot: newLibraryItem.equipSlot,
      goldValue: newLibraryItem.goldValue,
      ...(mods && Object.keys(mods).length > 0 ? { statModifiers: mods } : {}),
    };
    onUpdateSharedInventory([...items, item]);
    setNewLibraryItem({ name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined });
  };

  const handleRemoveLibraryItem = (itemId: string) => {
    const items = getSharedInventory();
    onUpdateSharedInventory(items.filter((i) => i.id !== itemId));
  };

  const handleStartEditLibraryItem = (item: InventoryItem) => {
    setEditingLibraryItemId(item.id);
    setEditingLibraryItem({
      name: item.name,
      description: item.description,
      equipSlot: item.equipSlot,
      goldValue: item.goldValue,
      statModifiers: item.statModifiers,
    });
  };

  const handleSaveEditLibraryItem = () => {
    if (!editingLibraryItemId || !editingLibraryItem.name.trim()) return;
    const items = getSharedInventory();
    const mods = editingLibraryItem.statModifiers
      ? Object.fromEntries(Object.entries(editingLibraryItem.statModifiers).filter(([, v]) => v !== 0 && v !== undefined))
      : undefined;
    const updated = items.map(item =>
      item.id === editingLibraryItemId
        ? {
            ...item,
            name: editingLibraryItem.name,
            description: editingLibraryItem.description,
            equipSlot: editingLibraryItem.equipSlot,
            goldValue: editingLibraryItem.goldValue,
            ...(mods && Object.keys(mods).length > 0 ? { statModifiers: mods } : { statModifiers: undefined }),
          }
        : item
    );
    onUpdateSharedInventory(updated);
    setEditingLibraryItemId(null);
    setEditingLibraryItem({ name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined });
  };

  const handleCancelEditLibraryItem = () => {
    setEditingLibraryItemId(null);
    setEditingLibraryItem({ name: "", description: "", equipSlot: undefined, goldValue: undefined, statModifiers: undefined });
  };

  const handleAddLibraryItemToCrawler = (crawlerId: string, libraryItem: InventoryItem) => {
    const items = getCrawlerInventory(crawlerId);
    const copy: InventoryItem = { ...libraryItem, id: crypto.randomUUID() };
    onUpdateInventory(crawlerId, [...items, copy]);
  };

  const libraryItems = getSharedInventory();

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
                  {editingLibraryItemId === item.id ? (
                    // Edit form
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input type="text" placeholder="Item name" value={editingLibraryItem.name}
                          onChange={(e) => setEditingLibraryItem({ ...editingLibraryItem, name: e.target.value })}
                          className="bg-muted border border-border px-2 py-1 text-sm flex-1" />
                      </div>
                      <input type="text" placeholder="Description" value={editingLibraryItem.description}
                        onChange={(e) => setEditingLibraryItem({ ...editingLibraryItem, description: e.target.value })}
                        className="bg-muted border border-border px-2 py-1 text-sm w-full" />
                      <div className="flex gap-2">
                        <select value={editingLibraryItem.equipSlot || ""}
                          onChange={(e) => setEditingLibraryItem({ ...editingLibraryItem, equipSlot: e.target.value as SlotType || undefined })}
                          className="bg-muted border border-border px-2 py-1 text-sm flex-1">
                          <option value="">No Slot</option>
                          <option value="weapon">Weapon</option>
                          <option value="head">Head</option>
                          <option value="chest">Chest</option>
                          <option value="legs">Legs</option>
                          <option value="feet">Feet</option>
                          <option value="leftHand">Left Hand</option>
                          <option value="rightHand">Right Hand</option>
                          <option value="ringFinger">Ring</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <Coins className="w-4 h-4 text-accent" />
                          <input type="number" placeholder="Val" value={editingLibraryItem.goldValue !== undefined ? editingLibraryItem.goldValue : ""}
                            onChange={(e) => setEditingLibraryItem({ ...editingLibraryItem, goldValue: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="bg-muted border border-border px-2 py-1 text-sm w-16" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Stat Modifiers</p>
                        <div className="grid grid-cols-3 gap-1">
                          {(['str', 'dex', 'con', 'int', 'cha', 'hp', 'maxHP', 'mana', 'maxMana'] as const).map((stat) => (
                            <div key={stat} className="flex items-center gap-1">
                              <label className="text-xs text-muted-foreground w-10 uppercase">{stat}</label>
                              <input type="number" value={editingLibraryItem.statModifiers?.[stat] ?? ""}
                                onChange={(e) => setEditingLibraryItem({
                                  ...editingLibraryItem,
                                  statModifiers: { ...editingLibraryItem.statModifiers, [stat]: e.target.value ? parseInt(e.target.value) : undefined },
                                })}
                                placeholder="0" className="w-12 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <DungeonButton variant="default" size="sm" onClick={handleSaveEditLibraryItem}>
                          <Save className="w-3 h-3 mr-1" /> Save
                        </DungeonButton>
                        <DungeonButton variant="danger" size="sm" onClick={handleCancelEditLibraryItem}>
                          Cancel
                        </DungeonButton>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <>
                      {item.equipSlot === 'weapon' ? (
                        <Sword className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      ) : item.equipSlot ? (
                        <HardHat className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      ) : (
                        <Package className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
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
                          <button onClick={() => handleStartEditLibraryItem(item)} className="text-primary hover:text-primary/80">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemoveLibraryItem(item.id)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {editMode && (
            <div className="space-y-2 pt-3 border-t border-border/50">
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
                <DungeonButton variant="default" size="sm" onClick={handleAddLibraryItem}>
                  <Plus className="w-4 h-4" />
                </DungeonButton>
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
                      <div className="border border-border bg-background mt-1 max-h-40 overflow-y-auto">
                        {libraryItems
                          .filter(li => li.name.toLowerCase().includes(searchQueries[crawler.id].toLowerCase()))
                          .map(li => (
                            <div key={li.id} className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-muted/50 border-b border-border/30 last:border-0">
                              <div className="flex items-center gap-2">
                                <span>{li.name}</span>
                                {li.equipSlot && <span className="text-xs text-accent">({li.equipSlot})</span>}
                              </div>
                              <DungeonButton variant="default" size="sm" onClick={() => {
                                handleAddLibraryItemToCrawler(crawler.id, li);
                                setSearchQueries(prev => ({ ...prev, [crawler.id]: "" }));
                              }}>
                                <Plus className="w-3 h-3 mr-1" /> Add
                              </DungeonButton>
                            </div>
                          ))}
                        {libraryItems.filter(li => li.name.toLowerCase().includes(searchQueries[crawler.id].toLowerCase())).length === 0 && (
                          <p className="text-muted-foreground text-xs italic px-3 py-2">No matching items</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {items.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic mb-3">No items in inventory</p>
                ) : (
                  <ul className="space-y-2 mb-3">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 text-sm py-2 border-b border-border/50 last:border-0"
                      >
                        {/* Item type icon */}
                        {item.equipSlot === 'weapon' ? (
                          <Sword className="w-4 h-4 text-destructive shrink-0" />
                        ) : item.equipSlot ? (
                          <HardHat className="w-4 h-4 text-accent shrink-0" />
                        ) : (
                          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
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
                            onClick={() => handleRemoveItem(crawler.id, item.id)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add new item form */}
                {editMode && (
                  <div className="space-y-2 mt-3 pt-3 border-t border-border/50">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={newItem.crawlerId === crawler.id ? newItem.name : ""}
                        onChange={(e) =>
                          setNewItem({ crawlerId: crawler.id, name: e.target.value, description: newItem.crawlerId === crawler.id ? newItem.description : "", equipSlot: newItem.crawlerId === crawler.id ? newItem.equipSlot : undefined })
                        }
                        className="bg-muted border border-border px-2 py-1 text-sm flex-1"
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={newItem.crawlerId === crawler.id ? newItem.description : ""}
                        onChange={(e) =>
                          setNewItem({ ...newItem, crawlerId: crawler.id, description: e.target.value })
                        }
                        className="bg-muted border border-border px-2 py-1 text-sm flex-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={newItem.crawlerId === crawler.id ? newItem.equipSlot || "" : ""}
                        onChange={(e) =>
                          setNewItem({ ...newItem, crawlerId: crawler.id, equipSlot: e.target.value as SlotType || undefined })
                        }
                        className="bg-muted border border-border px-2 py-1 text-sm flex-1"
                      >
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
                        <input
                          type="number"
                          placeholder="Value"
                          value={newItem.crawlerId === crawler.id && newItem.goldValue !== undefined ? newItem.goldValue : ""}
                          onChange={(e) =>
                            setNewItem({ ...newItem, crawlerId: crawler.id, goldValue: e.target.value ? parseInt(e.target.value) : undefined })
                          }
                          className="bg-muted border border-border px-2 py-1 text-sm w-20"
                        />
                      </div>
                      <DungeonButton
                        variant="default"
                        size="sm"
                        onClick={() => handleAddItem(crawler.id)}
                      >
                        <Plus className="w-4 h-4" />
                      </DungeonButton>
                    </div>
                    {/* Stat Modifiers */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Stat Modifiers (when equipped)</p>
                      <div className="grid grid-cols-3 gap-1">
                        {(['str', 'dex', 'con', 'int', 'cha', 'hp', 'maxHP', 'mana', 'maxMana'] as const).map((stat) => (
                          <div key={stat} className="flex items-center gap-1">
                            <label className="text-xs text-muted-foreground w-12 uppercase">{stat}</label>
                            <input
                              type="number"
                              value={(newItem.crawlerId === crawler.id && newItem.statModifiers?.[stat]) ?? ""}
                              onChange={(e) => setNewItem({
                                ...newItem,
                                crawlerId: crawler.id,
                                statModifiers: {
                                  ...newItem.statModifiers,
                                  [stat]: e.target.value ? parseInt(e.target.value) : undefined,
                                },
                              })}
                              placeholder="0"
                              className="w-14 bg-muted border border-border px-1 py-0.5 text-xs text-center"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default InventoryView;
