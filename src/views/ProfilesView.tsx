import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { HealthBar } from "@/components/ui/HealthBar";
import { EquipmentSlot } from "@/components/ui/EquipmentSlot";
import { Crawler, InventoryItem, createEmptyCrawler, EquipmentSlot as SlotType, getEquippedModifiers, StatModifiers, SentLootBox, getLootBoxTierColor } from "@/lib/gameData";
import { Shield, Zap, Heart, Brain, Sparkles, Save, Plus, Trash2, Coins, Sword, User, Upload, Edit2, Backpack, HardHat, Package, Lock, Unlock, ChevronDown, ChevronUp, Check } from "lucide-react";

interface ProfilesViewProps {
  crawlers: Crawler[];
  onUpdateCrawler: (id: string, updates: Partial<Crawler>) => void;
  onAddCrawler: (crawler: Crawler) => void;
  onDeleteCrawler: (id: string) => void;
  getCrawlerInventory: (crawlerId: string) => InventoryItem[];
  onUpdateCrawlerInventory: (crawlerId: string, items: InventoryItem[]) => void;
  partyGold: number;
  onStatRoll?: (crawlerName: string, crawlerId: string, stat: string, totalStat: number) => void;
  getCrawlerLootBoxes?: (crawlerId: string) => SentLootBox[];
  claimLootBoxItems?: (lootBoxId: string, crawlerId: string, itemIds: string[]) => Promise<void>;
}

// Loot Box display section for crawler profiles
const LootBoxSection: React.FC<{
  boxes: SentLootBox[];
  crawlerId: string;
  claimLootBoxItems?: (lootBoxId: string, crawlerId: string, itemIds: string[]) => Promise<void>;
}> = ({ boxes, crawlerId, claimLootBoxItems }) => {
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  return (
    <div>
      <h3 className="font-display text-lg text-amber-400 mb-4 flex items-center gap-2">
        <Package className="w-5 h-5" />
        LOOT BOXES ({boxes.length})
      </h3>
      <div className="space-y-2">
        {boxes.map(box => {
          const isExpanded = expandedBoxId === box.id;
          return (
            <div
              key={box.id}
              className="border rounded-lg overflow-hidden"
              style={{ borderColor: getLootBoxTierColor(box.tier) }}
            >
              <button
                onClick={() => {
                  setExpandedBoxId(isExpanded ? null : box.id);
                  setSelectedItemIds([]);
                }}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" style={{ color: getLootBoxTierColor(box.tier) }} />
                  <span className="font-semibold text-sm">{box.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: getLootBoxTierColor(box.tier) + '30', color: getLootBoxTierColor(box.tier) }}>
                    {box.tier}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {box.locked ? (
                    <Lock className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Unlock className="w-4 h-4 text-green-500" />
                  )}
                  <span className="text-xs text-muted-foreground">{box.items.length} items</span>
                  {!box.locked && (isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                </div>
              </button>

              {/* Locked state */}
              {box.locked && isExpanded && (
                <div className="px-3 pb-3 text-center text-sm text-muted-foreground">
                  <Lock className="w-6 h-6 mx-auto mb-1 text-amber-500" />
                  This loot box is locked. The DM will unlock it when ready.
                </div>
              )}

              {/* Unlocked expanded state */}
              {!box.locked && isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {box.items.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 p-2 rounded border transition-colors cursor-pointer ${
                        selectedItemIds.includes(item.id)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-muted/20 border-border hover:bg-muted/40'
                      }`}
                      onClick={() => setSelectedItemIds(prev =>
                        prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                      )}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedItemIds.includes(item.id) ? 'bg-primary border-primary' : 'border-muted-foreground'
                      }`}>
                        {selectedItemIds.includes(item.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{item.name}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </div>
                    </div>
                  ))}
                  {claimLootBoxItems && selectedItemIds.length > 0 && (
                    <button
                      onClick={async () => {
                        await claimLootBoxItems(box.id, crawlerId, selectedItemIds);
                        setSelectedItemIds([]);
                        if (selectedItemIds.length === box.items.length) {
                          setExpandedBoxId(null);
                        }
                      }}
                      className="w-full py-2 bg-primary text-primary-foreground rounded text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Claim {selectedItemIds.length} item{selectedItemIds.length !== 1 ? 's' : ''} to Inventory
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProfilesView: React.FC<ProfilesViewProps> = ({
  crawlers,
  onUpdateCrawler,
  onAddCrawler,
  onDeleteCrawler,
  getCrawlerInventory,
  onUpdateCrawlerInventory,
  partyGold,
  onStatRoll,
  getCrawlerLootBoxes,
  claimLootBoxItems,
}) => {
  const [selectedId, setSelectedId] = useState(crawlers[0]?.id || "");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Crawler>>({});
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Inventory item editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemFormData, setItemFormData] = useState<Partial<InventoryItem>>({});
  const [expandedItems, setExpandedItems] = useState(false);

  const selected = crawlers.find((c) => c.id === selectedId) || crawlers[0];
  const inventory = selected ? getCrawlerInventory(selected.id) : [];

  const handleEdit = () => {
    if (selected) {
      setEditData({ ...selected });
      setEditMode(true);
    }
  };

  const handleSave = () => {
    if (selected && editData) {
      // Remove id from editData since it's already passed as first parameter
      const { id, ...updates } = editData;
      onUpdateCrawler(selected.id, updates);
      setEditMode(false);
    }
  };

  const handleNewCrawler = () => {
    const newCrawler = createEmptyCrawler();
    onAddCrawler(newCrawler);
    setSelectedId(newCrawler.id);
    setEditData({ ...newCrawler });
    setEditMode(true);
  };

  const handleDelete = () => {
    if (selected && crawlers.length > 1) {
      const newSelected = crawlers.find(c => c.id !== selected.id);
      onDeleteCrawler(selected.id);
      if (newSelected) {
        setSelectedId(newSelected.id);
      }
      setEditMode(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const MAX_AVATAR_SIZE = 500_000; // 500KB in base64

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;

        const processAvatar = (avatarData: string) => {
          // Always update editData - never directly update Firestore during upload
          // User must click "Save Changes" to persist
          setEditData({ ...editData, avatar: avatarData });

          // Auto-enter edit mode if not already in it
          if (!editMode) {
            setEditMode(true);
          }
        };

        // If image is small enough, use it directly
        if (base64.length <= MAX_AVATAR_SIZE) {
          console.log('[ProfilesView] Avatar size OK:', {
            sizeInKB: (base64.length / 1000).toFixed(2)
          });
          processAvatar(base64);
          return;
        }

        // Otherwise, resize the image
        const img = new Image();
        img.onload = () => {
          // Start with reasonable dimensions and reduce until under size limit
          let quality = 0.8;
          let maxDimension = 512;

          const resizeAndCompress = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Scale down to maxDimension
            if (width > height && width > maxDimension) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            } else if (height > maxDimension) {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              return canvas.toDataURL('image/jpeg', quality);
            }
            return base64;
          };

          let resizedBase64 = resizeAndCompress();

          // Keep reducing quality/size until under limit
          while (resizedBase64.length > MAX_AVATAR_SIZE && quality > 0.1) {
            quality -= 0.1;
            if (quality <= 0.3 && maxDimension > 256) {
              maxDimension = Math.floor(maxDimension * 0.75);
            }
            resizedBase64 = resizeAndCompress();
          }

          console.log('[ProfilesView] Resized avatar:', {
            originalSize: base64.length,
            resizedSize: resizedBase64.length,
            finalQuality: quality,
            finalDimension: maxDimension,
            sizeInKB: (resizedBase64.length / 1000).toFixed(2)
          });

          processAvatar(resizedBase64);
        };

        img.src = base64;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEquipItem = (slot: SlotType, itemId: string) => {
    const equippedItems = editMode
      ? (editData.equippedItems ?? selected.equippedItems ?? {})
      : (selected.equippedItems ?? {});

    const updatedEquipped = { ...equippedItems, [slot]: itemId };

    if (editMode) {
      setEditData({ ...editData, equippedItems: updatedEquipped });
    } else {
      onUpdateCrawler(selected.id, { equippedItems: updatedEquipped });
    }
  };

  const handleUnequipItem = (slot: SlotType) => {
    const equippedItems = editMode
      ? (editData.equippedItems ?? selected.equippedItems ?? {})
      : (selected.equippedItems ?? {});

    const updatedEquipped = { ...equippedItems };
    delete updatedEquipped[slot];

    if (editMode) {
      setEditData({ ...editData, equippedItems: updatedEquipped });
    } else {
      onUpdateCrawler(selected.id, { equippedItems: updatedEquipped });
    }
  };

  const getEquippedItem = (slot: SlotType): InventoryItem | undefined => {
    const equippedItems = editMode
      ? (editData.equippedItems ?? selected.equippedItems)
      : selected.equippedItems;

    const itemId = equippedItems?.[slot];
    if (!itemId) return undefined;

    return inventory.find(item => item.id === itemId);
  };

  const handleAddItem = () => {
    setIsAddingItem(true);
    setItemFormData({
      name: "",
      description: "",
      equipSlot: undefined,
      goldValue: undefined,
    });
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setItemFormData({ ...item });
  };

  const handleSaveItem = () => {
    if (!selected) return;

    if (isAddingItem) {
      // Strip zero-value modifiers
      const mods = itemFormData.statModifiers
        ? Object.fromEntries(Object.entries(itemFormData.statModifiers).filter(([, v]) => v !== 0 && v !== undefined))
        : undefined;
      const newItem: InventoryItem = {
        id: crypto.randomUUID(),
        name: itemFormData.name || "New Item",
        description: itemFormData.description || "",
        equipSlot: itemFormData.equipSlot,
        goldValue: itemFormData.goldValue,
        ...(mods && Object.keys(mods).length > 0 ? { statModifiers: mods } : {}),
      };
      onUpdateCrawlerInventory(selected.id, [...inventory, newItem]);
    } else if (editingItemId) {
      const editMods = itemFormData.statModifiers
        ? Object.fromEntries(Object.entries(itemFormData.statModifiers).filter(([, v]) => v !== 0 && v !== undefined))
        : undefined;
      const cleanedFormData = {
        ...itemFormData,
        statModifiers: editMods && Object.keys(editMods).length > 0 ? editMods : undefined,
      };
      const updatedInventory = inventory.map((item) =>
        item.id === editingItemId
          ? { ...item, ...cleanedFormData }
          : item
      );
      onUpdateCrawlerInventory(selected.id, updatedInventory);
    }

    setIsAddingItem(false);
    setEditingItemId(null);
    setItemFormData({});
  };

  const handleCancelItemEdit = () => {
    setIsAddingItem(false);
    setEditingItemId(null);
    setItemFormData({});
  };

  const handleDeleteItem = (itemId: string) => {
    if (!selected) return;
    const updatedInventory = inventory.filter((item) => item.id !== itemId);
    onUpdateCrawlerInventory(selected.id, updatedInventory);
  };

  if (!selected) return null;

  const currentAvatar = editMode ? (editData.avatar ?? selected.avatar) : selected.avatar;
  const currentGold = editMode ? (editData.gold ?? selected.gold ?? 0) : (selected.gold ?? 0);
  const equippedMods = getEquippedModifiers(selected, inventory);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-full px-4 md:px-6 py-4"
    >
      {/* Header controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setEditMode(false);
            }}
            className="bg-background border border-primary text-primary px-4 py-2 font-mono"
          >
            {crawlers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          
          <DungeonButton variant="default" size="sm" onClick={handleNewCrawler}>
            <Plus className="w-4 h-4 mr-1" /> New
          </DungeonButton>
        </div>

        {/* Party Gold Display */}
        <div className="flex items-center gap-2 bg-accent/10 border border-accent px-4 py-2">
          <Coins className="w-5 h-5 text-accent" />
          <span className="font-display text-accent text-glow-gold">PARTY GOLD: {Math.floor(partyGold)}G</span>
        </div>

        <div className="flex gap-2">
          {editMode && crawlers.length > 1 && (
            <DungeonButton variant="danger" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </DungeonButton>
          )}
          <DungeonButton
            variant="admin"
            size="sm"
            onClick={editMode ? handleSave : handleEdit}
          >
            {editMode ? (
              <>
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </>
            ) : (
              "Admin Override"
            )}
          </DungeonButton>
        </div>
      </div>

      <DungeonCard className="min-h-[400px] overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Equipment Slots - Left Side */}
          <div className="flex flex-col gap-3 lg:min-w-[280px]">
            <h3 className="font-display text-primary text-base mb-2">EQUIPMENT</h3>

            {/* Head (center column) */}
            <div className="grid grid-cols-3 gap-2">
              <div></div>
              <EquipmentSlot
                slot="head"
                label="Head"
                equippedItem={getEquippedItem('head')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={false}
              />
              <div></div>
            </div>

            {/* Left Hand, Chest, Right Hand */}
            <div className="grid grid-cols-3 gap-2">
              <EquipmentSlot
                slot="leftHand"
                label="Left Hand"
                equippedItem={getEquippedItem('leftHand')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={false}
              />
              <EquipmentSlot
                slot="chest"
                label="Chest"
                equippedItem={getEquippedItem('chest')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={false}
              />
              <EquipmentSlot
                slot="rightHand"
                label="Right Hand"
                equippedItem={getEquippedItem('rightHand')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={false}
              />
            </div>

            {/* Ring, Legs, Weapon */}
            <div className="grid grid-cols-3 gap-2">
              <EquipmentSlot
                slot="ringFinger"
                label="Ring"
                equippedItem={getEquippedItem('ringFinger')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={false}
              />
              <EquipmentSlot
                slot="legs"
                label="Legs"
                equippedItem={getEquippedItem('legs')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={false}
              />
              <EquipmentSlot
                slot="weapon"
                label="Weapon"
                equippedItem={getEquippedItem('weapon')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={false}
              />
            </div>

            {/* Feet (center column) */}
            <div className="grid grid-cols-3 gap-2">
              <div></div>
              <EquipmentSlot
                slot="feet"
                label="Feet"
                equippedItem={getEquippedItem('feet')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={false}
              />
              <div></div>
            </div>
          </div>

          {/* Character Info - Center/Right */}
          <div className="flex-1 min-w-0">
            {/* Character header with avatar */}
            <div className="flex gap-6 mb-6">
              {/* Avatar section */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-2 border-primary bg-muted/50 flex items-center justify-center overflow-hidden">
                  {currentAvatar ? (
                    <img src={currentAvatar} alt={selected.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-xs text-primary mt-2 hover:underline flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" /> Upload
                </button>
              </div>

          {/* Name and info */}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl text-primary text-glow-cyan mb-1 break-words">
              {editMode ? (
                <input
                  type="text"
                  value={editData.name || ""}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="bg-transparent border-b border-primary w-full"
                />
              ) : (
                selected.name
              )}
            </h1>
            {editMode ? (
              <div className="flex flex-wrap gap-2 mt-2">
                <input
                  type="text"
                  value={editData.race || ""}
                  onChange={(e) => setEditData({ ...editData, race: e.target.value })}
                  placeholder="Race"
                  className="bg-muted border border-border px-2 py-1 w-24 text-sm"
                />
                <input
                  type="text"
                  value={editData.job || ""}
                  onChange={(e) => setEditData({ ...editData, job: e.target.value })}
                  placeholder="Job"
                  className="bg-muted border border-border px-2 py-1 w-32 text-sm"
                />
                <input
                  type="number"
                  value={editData.level ?? ""}
                  onChange={(e) => setEditData({ ...editData, level: parseInt(e.target.value) || 1 })}
                  placeholder="Level"
                  className="bg-muted border border-border px-2 py-1 w-20 text-sm"
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm break-words">
                {selected.race} | {selected.job} | Level {selected.level}
              </p>
            )}

            {/* Crawler Gold */}
            <div className="flex items-center gap-2 mt-3">
              <Coins className="w-4 h-4 text-accent" />
              {editMode ? (
                <input
                  type="number"
                  value={editData.gold ?? 0}
                  onChange={(e) => setEditData({ ...editData, gold: parseInt(e.target.value) || 0 })}
                  className="bg-muted border border-border px-2 py-1 w-24 text-sm"
                />
              ) : (
                <span className="text-accent font-display">{Math.floor(currentGold)}G</span>
              )}
            </div>
          </div>
        </div>

        {/* HP Bar */}
        <div className="mb-4">
          {(() => {
            const baseHP = editMode ? (editData.hp ?? selected.hp) : selected.hp;
            const baseMaxHP = editMode ? (editData.maxHP ?? selected.maxHP) : selected.maxHP;
            const hpMod = equippedMods.hp ?? 0;
            const maxHPMod = equippedMods.maxHP ?? 0;
            const effectiveHP = baseHP + hpMod;
            const effectiveMaxHP = baseMaxHP + maxHPMod;
            return (
              <>
                <HealthBar
                  current={effectiveHP}
                  max={effectiveMaxHP}
                  label={`HP: ${effectiveHP}/${effectiveMaxHP}`}
                />
                {(hpMod !== 0 || maxHPMod !== 0) && (
                  <div className="text-xs mt-1 ml-1">
                    <span className="text-muted-foreground">Base: {baseHP}/{baseMaxHP}</span>
                    {hpMod !== 0 && <span className={hpMod > 0 ? "text-green-400" : "text-red-400"}> (HP {hpMod > 0 ? `+${hpMod}` : hpMod})</span>}
                    {maxHPMod !== 0 && <span className={maxHPMod > 0 ? "text-green-400" : "text-red-400"}> (MaxHP {maxHPMod > 0 ? `+${maxHPMod}` : maxHPMod})</span>}
                  </div>
                )}
              </>
            );
          })()}
          {editMode && (
            <div className="flex gap-4 mt-2">
              <input
                type="number"
                value={editData.hp ?? ""}
                onChange={(e) => setEditData({ ...editData, hp: parseInt(e.target.value) || 0 })}
                placeholder="Current HP"
                className="bg-muted border border-border px-2 py-1 w-24 text-sm"
              />
              <input
                type="number"
                value={editData.maxHP ?? ""}
                onChange={(e) => setEditData({ ...editData, maxHP: parseInt(e.target.value) || 0 })}
                placeholder="Max HP"
                className="bg-muted border border-border px-2 py-1 w-24 text-sm"
              />
            </div>
          )}
        </div>

        {/* Mana Bar */}
        <div className="mb-8">
          {(() => {
            const baseMana = editMode ? (editData.mana ?? selected.mana) : selected.mana;
            const baseMaxMana = editMode ? (editData.maxMana ?? selected.maxMana) : selected.maxMana;
            const manaMod = equippedMods.mana ?? 0;
            const maxManaMod = equippedMods.maxMana ?? 0;
            const effectiveMana = baseMana + manaMod;
            const effectiveMaxMana = baseMaxMana + maxManaMod;
            return (
              <>
                <HealthBar
                  current={effectiveMana}
                  max={effectiveMaxMana}
                  label={`Mana: ${effectiveMana}/${effectiveMaxMana}`}
                  variant="mana"
                />
                {(manaMod !== 0 || maxManaMod !== 0) && (
                  <div className="text-xs mt-1 ml-1">
                    <span className="text-muted-foreground">Base: {baseMana}/{baseMaxMana}</span>
                    {manaMod !== 0 && <span className={manaMod > 0 ? "text-green-400" : "text-red-400"}> (Mana {manaMod > 0 ? `+${manaMod}` : manaMod})</span>}
                    {maxManaMod !== 0 && <span className={maxManaMod > 0 ? "text-green-400" : "text-red-400"}> (MaxMana {maxManaMod > 0 ? `+${maxManaMod}` : maxManaMod})</span>}
                  </div>
                )}
              </>
            );
          })()}
          {editMode && (
            <div className="flex gap-4 mt-2">
              <input
                type="number"
                value={editData.mana ?? ""}
                onChange={(e) => setEditData({ ...editData, mana: parseInt(e.target.value) || 0 })}
                placeholder="Current Mana"
                className="bg-muted border border-border px-2 py-1 w-24 text-sm"
              />
              <input
                type="number"
                value={editData.maxMana ?? ""}
                onChange={(e) => setEditData({ ...editData, maxMana: parseInt(e.target.value) || 0 })}
                placeholder="Max Mana"
                className="bg-muted border border-border px-2 py-1 w-24 text-sm"
              />
            </div>
          )}
        </div>

        {/* Stats and Achievements row */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-display text-primary text-xl mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 shrink-0" /> STATS
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "str", label: "STR", icon: Zap },
                { key: "dex", label: "DEX", icon: Zap },
                { key: "con", label: "CON", icon: Heart },
                { key: "int", label: "INT", icon: Brain },
                { key: "cha", label: "CHA", icon: Sparkles },
              ].map(({ key, label }) => {
                const base = (selected as any)[key] as number;
                const mod = equippedMods[key as keyof StatModifiers] ?? 0;
                return editMode ? (
                  <div key={key} className="flex items-center justify-between bg-muted/50 px-4 py-3 rounded">
                    <span className="text-muted-foreground text-base">{label}</span>
                    <input
                      type="number"
                      value={(editData as any)[key] ?? (selected as any)[key]}
                      onChange={(e) =>
                        setEditData({ ...editData, [key]: parseInt(e.target.value) || 0 })
                      }
                      className="bg-transparent border-b border-primary w-14 text-right text-lg"
                    />
                  </div>
                ) : (
                  <button
                    key={key}
                    onClick={() => onStatRoll?.(selected.name, selected.id, label, base + mod)}
                    className="flex items-center justify-between bg-muted/50 px-4 py-3 rounded hover:bg-primary/20 transition-colors cursor-pointer group text-left w-full"
                    title={`Roll d20 + ${label} modifier`}
                  >
                    <span className="text-muted-foreground text-base group-hover:text-primary transition-colors">{label}</span>
                    {mod !== 0 ? (
                      <span className="font-bold text-lg">
                        <span className="text-foreground">{base}</span>
                        <span className={mod > 0 ? "text-green-400" : "text-red-400"}>
                          {mod > 0 ? ` +${mod}` : ` ${mod}`}
                        </span>
                        <span className="text-orange-400"> = {base + mod}</span>
                      </span>
                    ) : (
                      <span className="text-foreground font-bold text-lg">{base}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-display text-accent text-xl mb-4 flex items-center gap-2 text-glow-gold">
              <Sparkles className="w-6 h-6 shrink-0" /> ACHIEVEMENTS
            </h3>
            {editMode ? (
              <textarea
                value={editData.achievements || ""}
                onChange={(e) => setEditData({ ...editData, achievements: e.target.value })}
                className="w-full bg-muted border border-border p-4 min-h-[150px] text-base rounded"
                placeholder="Enter achievements..."
              />
            ) : (
              <div className="bg-muted/30 border border-border/50 rounded p-4 min-h-[150px]">
                <p className="text-accent text-base leading-relaxed break-words whitespace-pre-wrap">{selected.achievements || "No achievements yet..."}</p>
              </div>
            )}
          </div>
        </div>

        {/* Inventory section - full width */}
        <div>
          <div className="flex items-center justify-between mb-4 gap-4">
            <h3 className="font-display text-primary text-xl flex items-center gap-2">
              <Backpack className="w-6 h-6 shrink-0" /> INVENTORY
            </h3>
            <div className="flex gap-2 shrink-0">
              <DungeonButton variant="nav" size="sm" onClick={() => setExpandedItems(!expandedItems)}>
                {expandedItems ? 'Collapse' : 'Expand'}
              </DungeonButton>
              <DungeonButton variant="default" size="sm" onClick={handleAddItem}>
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </DungeonButton>
            </div>
          </div>

          {/* Item Form */}
          {(isAddingItem || editingItemId) && (
            <div className="mb-4 p-4 border border-accent bg-accent/10 rounded">
              <h4 className="text-sm font-bold text-accent mb-3">
                {isAddingItem ? "New Item" : "Edit Item"}
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Item Name"
                  value={itemFormData.name || ""}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                  className="w-full bg-muted border border-border px-3 py-2 text-sm rounded"
                />
                <textarea
                  placeholder="Description"
                  value={itemFormData.description || ""}
                  onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                  className="w-full bg-muted border border-border px-3 py-2 text-sm min-h-[80px] rounded"
                />
                <div className="flex gap-3">
                  <select
                    value={itemFormData.equipSlot || ""}
                    onChange={(e) => setItemFormData({ ...itemFormData, equipSlot: e.target.value as SlotType || undefined })}
                    className="flex-1 bg-muted border border-border px-3 py-2 text-sm rounded"
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
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-accent" />
                    <input
                      type="number"
                      placeholder="Gold Value"
                      value={itemFormData.goldValue ?? ""}
                      onChange={(e) => setItemFormData({ ...itemFormData, goldValue: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-24 bg-muted border border-border px-3 py-2 text-sm rounded"
                    />
                  </div>
                </div>
                {/* Stat Modifiers */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Stat Modifiers (when equipped)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['str', 'dex', 'con', 'int', 'cha', 'hp', 'maxHP', 'mana', 'maxMana'] as const).map((stat) => (
                      <div key={stat} className="flex items-center gap-1">
                        <label className="text-xs text-muted-foreground w-12 uppercase">{stat}</label>
                        <input
                          type="number"
                          value={itemFormData.statModifiers?.[stat] ?? ""}
                          onChange={(e) => setItemFormData({
                            ...itemFormData,
                            statModifiers: {
                              ...itemFormData.statModifiers,
                              [stat]: e.target.value ? parseInt(e.target.value) : undefined,
                            },
                          })}
                          placeholder="0"
                          className="w-16 bg-muted border border-border px-2 py-1 text-xs rounded text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                    <DungeonButton variant="admin" size="sm" onClick={handleSaveItem}>
                      <Save className="w-4 h-4 mr-1" /> Save Item
                    </DungeonButton>
                    <DungeonButton variant="default" size="sm" onClick={handleCancelItemEdit}>
                      Cancel
                    </DungeonButton>
                  </div>
                </div>
              </div>
            )}

          {inventory.length === 0 ? (
            <div className="bg-muted/30 border border-border/50 rounded p-6 text-center">
              <p className="text-muted-foreground text-base italic">No items in inventory</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventory.map((item) => {
                const isEquipped = Object.values(selected.equippedItems || {}).includes(item.id);
                const isEditing = editingItemId === item.id;

                return (
                  <div
                    key={item.id}
                    draggable={!!item.equipSlot && !isEditing}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify(item));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className={`bg-muted/50 p-4 rounded-lg ${
                      item.equipSlot && !isEditing ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${isEditing ? 'border-2 border-accent' : 'border border-border'}`}
                  >
                    {/* Item header with action buttons */}
                    <div className="flex items-start gap-2 mb-2">
                      {/* Item type icon */}
                      {item.equipSlot === 'weapon' ? (
                        <Sword className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      ) : item.equipSlot ? (
                        <HardHat className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      ) : (
                        <Package className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      {/* Item name and actions */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground font-semibold text-base truncate" title={item.name}>
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="text-primary hover:text-primary/80 p-1"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-destructive hover:text-destructive/80 p-1"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Item badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {item.equipSlot && (
                        <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">
                          {item.equipSlot === 'weapon' ? 'Weapon' :
                           item.equipSlot === 'leftHand' ? 'Left Hand' :
                           item.equipSlot === 'rightHand' ? 'Right Hand' :
                           item.equipSlot === 'ringFinger' ? 'Ring' :
                           item.equipSlot.charAt(0).toUpperCase() + item.equipSlot.slice(1)}
                        </span>
                      )}
                      {isEquipped && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Equipped</span>
                      )}
                      {item.goldValue !== undefined && item.goldValue > 0 && (
                        <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {item.goldValue}G
                        </span>
                      )}
                    </div>

                    {/* Item description */}
                    {expandedItems && (
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {item.description || "No description"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Loot Boxes section */}
        {getCrawlerLootBoxes && selected && (() => {
          const boxes = getCrawlerLootBoxes(selected.id);
          if (boxes.length === 0) return null;
          return (
            <LootBoxSection
              boxes={boxes}
              crawlerId={selected.id}
              claimLootBoxItems={claimLootBoxItems}
            />
          );
        })()}
          </div>
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default ProfilesView;
