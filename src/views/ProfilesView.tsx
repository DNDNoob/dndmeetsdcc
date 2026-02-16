import { useState, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { HealthBar } from "@/components/ui/HealthBar";
import { EquipmentSlot } from "@/components/ui/EquipmentSlot";
import { Crawler, Mob, InventoryItem, createEmptyCrawler, EquipmentSlot as SlotType, getEquippedModifiers, StatModifiers, SentLootBox, getLootBoxTierColor, NoncombatTurnState, CombatState, WeaponData, DAMAGE_TYPES, WEAPON_TYPES, DamageType, WeaponType, WeaponDie } from "@/lib/gameData";
import type { DiceRollEntry } from "@/hooks/useGameState";
import { Shield, Zap, Heart, Brain, Sparkles, Save, Plus, Trash2, Coins, Sword, User, Upload, Backpack, HardHat, Package, Lock, Unlock, ChevronDown, ChevronUp, Check, Search, Send, BookOpen, Filter, X, Gem, Footprints, Shirt, Hand, Target, Swords, RefreshCw, Timer } from "lucide-react";

type SortOption = 'name-asc' | 'name-desc' | 'gold-desc' | 'gold-asc';

// Inline SVG for legs/pants slot (no lucide icon exists)
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

type ProfileTab = 'profile' | 'inventory' | 'actions' | 'spells' | 'reactions' | 'attacks' | 'bonus';

// Noncombat actions mapped to their associated ability score
const NONCOMBAT_ACTIONS: { label: string; stat: 'str' | 'dex' | 'con' | 'int' | 'cha' }[] = [
  { label: 'Acrobatics', stat: 'dex' },
  { label: 'Animal Handling', stat: 'cha' },
  { label: 'Athletics', stat: 'str' },
  { label: 'Deception', stat: 'cha' },
  { label: 'Intimidation', stat: 'cha' },
  { label: 'Medicine', stat: 'int' },
  { label: 'Performance', stat: 'cha' },
  { label: 'Persuasion', stat: 'cha' },
  { label: 'Sleight of Hand', stat: 'dex' },
  { label: 'Stealth', stat: 'dex' },
  { label: 'Survival', stat: 'con' },
  { label: 'Arcana', stat: 'int' },
];

const INTELLIGENCE_ACTIONS: { label: string; stat: 'int' }[] = [
  { label: 'Religion', stat: 'int' },
  { label: 'Nature', stat: 'int' },
  { label: 'Investigation', stat: 'int' },
  { label: 'History', stat: 'int' },
  { label: 'Memory', stat: 'int' },
];

const INITIATIVE_ACTION = { label: 'Initiative', stat: 'dex' as const };

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
  claimLootBoxItems?: (lootBoxId: string, crawlerId: string, itemIds: string[], claimGold?: boolean) => Promise<void>;
  noncombatTurnState?: NoncombatTurnState | null;
  getNoncombatRollsRemaining?: (crawlerId: string) => number;
  recordNoncombatRoll?: (crawlerId: string) => Promise<void>;
  currentPlayerId?: string;
  isShowtimeActive?: boolean;
  combatState?: CombatState | null;
  onRecordCombatInitiative?: (combatantId: string, roll: number) => Promise<void>;
  onRecordCombatAction?: (combatantId: string, actionType: 'action' | 'bonus') => Promise<void>;
  onApplyCombatDamage?: (targetId: string, targetType: 'crawler' | 'mob', damage: number) => Promise<void>;
  addDiceRoll?: (entry: DiceRollEntry) => Promise<void>;
  mobs?: Mob[];
}

// Loot Box display section for crawler profiles
const LootBoxSection: React.FC<{
  boxes: SentLootBox[];
  crawlerId: string;
  claimLootBoxItems?: (lootBoxId: string, crawlerId: string, itemIds: string[], claimGold?: boolean) => Promise<void>;
}> = ({ boxes, crawlerId, claimLootBoxItems }) => {
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Get all unlocked boxes with items or gold
  const unlockedBoxesWithContent = boxes.filter(b => !b.locked && (b.items.length > 0 || (b.gold && b.gold > 0)));
  const totalUnlockedItems = unlockedBoxesWithContent.reduce((sum, b) => sum + b.items.length, 0);
  const totalUnlockedGold = unlockedBoxesWithContent.reduce((sum, b) => sum + (b.gold || 0), 0);

  const handleClaimAll = async () => {
    if (!claimLootBoxItems) return;
    for (const box of unlockedBoxesWithContent) {
      await claimLootBoxItems(box.id, crawlerId, box.items.map(i => i.id), true);
    }
    setExpandedBoxId(null);
    setSelectedItemIds([]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg text-amber-400 flex items-center gap-2">
          <Package className="w-5 h-5" />
          LOOT BOXES ({boxes.length})
        </h3>
        {claimLootBoxItems && (totalUnlockedItems > 0 || totalUnlockedGold > 0) && (
          <button
            onClick={handleClaimAll}
            className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            Claim All ({totalUnlockedItems > 0 ? `${totalUnlockedItems} items` : ''}{totalUnlockedItems > 0 && totalUnlockedGold > 0 ? ' + ' : ''}{totalUnlockedGold > 0 ? `${totalUnlockedGold}g` : ''})
          </button>
        )}
      </div>
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
                  <span className="text-xs text-muted-foreground">
                    {box.items.length} items{box.gold ? (box.locked ? ' · ?g' : ` · ${box.gold}g`) : ''}
                  </span>
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
                  {/* Gold display */}
                  {box.gold && box.gold > 0 && (
                    <div className="flex items-center gap-2 p-2 rounded border border-amber-500/30 bg-amber-500/10">
                      <span className="text-amber-500 font-bold">{box.gold}g</span>
                      <span className="text-xs text-muted-foreground">Gold (claimed with items)</span>
                    </div>
                  )}
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
                  {claimLootBoxItems && (selectedItemIds.length > 0 || (box.items.length === 0 && box.gold)) && (
                    <button
                      onClick={async () => {
                        const claimAllItems = selectedItemIds.length === box.items.length;
                        await claimLootBoxItems(box.id, crawlerId, selectedItemIds, claimAllItems);
                        setSelectedItemIds([]);
                        if (claimAllItems && (!box.gold || box.gold === 0)) {
                          setExpandedBoxId(null);
                        }
                      }}
                      className="w-full py-2 bg-primary text-primary-foreground rounded text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      {selectedItemIds.length > 0
                        ? `Claim ${selectedItemIds.length} item${selectedItemIds.length !== 1 ? 's' : ''}${selectedItemIds.length === box.items.length && box.gold ? ` + ${box.gold}g` : ''}`
                        : box.gold ? `Claim ${box.gold}g` : 'Claim'}
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
  noncombatTurnState,
  getNoncombatRollsRemaining,
  recordNoncombatRoll,
  currentPlayerId,
  isShowtimeActive = false,
  combatState,
  onRecordCombatInitiative,
  onRecordCombatAction,
  onApplyCombatDamage,
  addDiceRoll,
  mobs: mobsProp,
}) => {
  const [selectedId, setSelectedId] = useState(crawlers[0]?.id || "");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Crawler>>({});
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Expanded items tracking
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [allItemsExpanded, setAllItemsExpanded] = useState(false);

  // Tab and filtering state
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'equipment' | 'consumable' | 'valuable'>('all');
  const [inventorySort, setInventorySort] = useState<SortOption>('name-asc');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);

  // Combat targeting state
  const [showDamageTargetModal, setShowDamageTargetModal] = useState(false);
  const [pendingDamageRoll, setPendingDamageRoll] = useState<{ dice: string; bonus: number; actionName: string } | null>(null);
  const [damageTargetId, setDamageTargetId] = useState<string>('');
  const [damageTargetType, setDamageTargetType] = useState<'crawler' | 'mob'>('mob');
  const [damageRollResult, setDamageRollResult] = useState<number | null>(null);

  // Weapon advantage/disadvantage menu
  const [weaponAdvMenu, setWeaponAdvMenu] = useState<{ weaponId: string; x: number; y: number } | null>(null);

  // Weapon upgrade modal
  const [upgradingWeapon, setUpgradingWeapon] = useState<InventoryItem | null>(null);
  const [upgradeForm, setUpgradeForm] = useState<WeaponData | null>(null);
  const [upgradeWeaponName, setUpgradeWeaponName] = useState('');

  // Send items/gold modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTargetId, setSendTargetId] = useState<string>('');
  const [sendGoldAmount, setSendGoldAmount] = useState(0);
  // Track quantity to send per consolidated group (key = item signature)
  const [sendQuantities, setSendQuantities] = useState<Record<string, number>>({});

  const selected = crawlers.find((c) => c.id === selectedId) || crawlers[0];
  const isOwnProfile = !currentPlayerId || currentPlayerId === selected?.id;
  const inventory = selected ? getCrawlerInventory(selected.id) : [];

  // Get all unique tags from inventory (dynamic)
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    inventory.forEach(item => {
      item.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [inventory]);

  // Filtered and sorted inventory for inventory tab
  const filteredInventory = useMemo(() => {
    let items = inventory;

    // Apply search
    if (inventorySearch) {
      const search = inventorySearch.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search)
      );
    }

    // Apply type filter
    if (inventoryFilter !== 'all') {
      items = items.filter(item => {
        if (inventoryFilter === 'equipment') return !!item.equipSlot;
        if (inventoryFilter === 'consumable') return !item.equipSlot;
        if (inventoryFilter === 'valuable') return (item.goldValue ?? 0) > 0;
        return true;
      });
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      items = items.filter(item =>
        selectedTags.some(tag => item.tags?.includes(tag))
      );
    }

    return items;
  }, [inventory, inventorySearch, inventoryFilter, selectedTags]);

  // Inventory summary for main profile tab
  const inventorySummary = useMemo(() => {
    const totalItems = inventory.length;
    const equippedCount = Object.values(selected?.equippedItems || {}).filter(Boolean).length;
    const totalValue = inventory.reduce((sum, item) => sum + (item.goldValue || 0), 0);
    const equipmentCount = inventory.filter(i => i.equipSlot).length;
    return { totalItems, equippedCount, totalValue, equipmentCount };
  }, [inventory, selected?.equippedItems]);

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

  // Helper to create item signature for consolidation
  const getItemSignature = (item: InventoryItem) => {
    const mods = item.statModifiers || {};
    const sortedMods = JSON.stringify(Object.keys(mods).sort().reduce((acc, key) => ({ ...acc, [key]: mods[key as keyof typeof mods] }), {}));
    return `${item.name}|${item.description || ''}|${item.equipSlot || ''}|${item.goldValue ?? 0}|${sortedMods}`;
  };

  // Consolidated inventory for display (groups identical items)
  const consolidatedInventory = useMemo(() => {
    const equippedItemIds = isOwnProfile 
      ? new Set(Object.values(selected?.equippedItems || {}))
      : new Set<string>(); // Don't show equipped state for other players' inventories

    // Keep equipped items separate (they always show individually)
    const equippedItems = filteredInventory.filter(item => equippedItemIds.has(item.id));
    const unequippedItems = filteredInventory.filter(item => !equippedItemIds.has(item.id));

    const groupedItems = new Map<string, InventoryItem[]>();
    unequippedItems.forEach(item => {
      const sig = getItemSignature(item);
      if (!groupedItems.has(sig)) groupedItems.set(sig, []);
      groupedItems.get(sig)!.push(item);
    });

    const displayItems: { item: InventoryItem; count: number; allIds: string[]; isEquipped: boolean; sig: string }[] = [];
    equippedItems.forEach(item => displayItems.push({ item, count: 1, allIds: [item.id], isEquipped: true, sig: getItemSignature(item) + '|equipped' }));
    groupedItems.forEach((items, sig) => displayItems.push({ item: items[0], count: items.length, allIds: items.map(i => i.id), isEquipped: false, sig }));

    // Apply sorting to the display items
    displayItems.sort((a, b) => {
      let primary: number;
      switch (inventorySort) {
        case 'name-asc': primary = a.item.name.localeCompare(b.item.name); break;
        case 'name-desc': primary = b.item.name.localeCompare(a.item.name); break;
        case 'gold-desc': primary = (b.item.goldValue ?? 0) - (a.item.goldValue ?? 0); break;
        case 'gold-asc': primary = (a.item.goldValue ?? 0) - (b.item.goldValue ?? 0); break;
        default: primary = 0;
      }
      if (primary !== 0) return primary;
      // Secondary: keep equipped items next to their unequipped group (same name together)
      const nameCmp = a.item.name.localeCompare(b.item.name);
      if (nameCmp !== 0) return nameCmp;
      // Equipped items come before unequipped
      return (a.isEquipped ? 0 : 1) - (b.isEquipped ? 0 : 1);
    });

    return displayItems;
  }, [filteredInventory, selected?.equippedItems, inventorySort, isOwnProfile]);

  // Double-click to equip an item
  const handleDoubleClickEquip = (item: InventoryItem) => {
    if (!item.equipSlot || !selected) return;
    const slot = item.equipSlot;
    const equippedItems = selected.equippedItems ?? {};
    const updatedEquipped = { ...equippedItems, [slot]: item.id };
    onUpdateCrawler(selected.id, { equippedItems: updatedEquipped });
  };

  // Consolidated inventory for send modal (groups identical unequipped items)
  const sendConsolidatedInventory = useMemo(() => {
    const equippedItemIds = new Set(Object.values(selected?.equippedItems || {}));
    // Only allow sending unequipped items
    const unequippedItems = inventory.filter(item => !equippedItemIds.has(item.id));

    const groupedItems = new Map<string, InventoryItem[]>();
    unequippedItems.forEach(item => {
      const sig = getItemSignature(item);
      if (!groupedItems.has(sig)) groupedItems.set(sig, []);
      groupedItems.get(sig)!.push(item);
    });

    const displayItems: { item: InventoryItem; count: number; allIds: string[]; sig: string }[] = [];
    groupedItems.forEach((items, sig) => displayItems.push({ item: items[0], count: items.length, allIds: items.map(i => i.id), sig }));
    displayItems.sort((a, b) => a.item.name.localeCompare(b.item.name));
    return displayItems;
  }, [inventory, selected?.equippedItems]);

  // Total items selected to send
  const totalItemsToSend = useMemo(() => {
    return Object.values(sendQuantities).reduce((sum, qty) => sum + qty, 0);
  }, [sendQuantities]);

  // Send gold/items to another player (with consolidated quantities)
  const handleSend = () => {
    if (!selected || !sendTargetId) return;

    const targetCrawler = crawlers.find(c => c.id === sendTargetId);
    if (!targetCrawler) return;

    // Transfer gold
    if (sendGoldAmount > 0 && sendGoldAmount <= (selected.gold || 0)) {
      onUpdateCrawler(selected.id, { gold: (selected.gold || 0) - sendGoldAmount });
      onUpdateCrawler(sendTargetId, { gold: (targetCrawler.gold || 0) + sendGoldAmount });
    }

    // Transfer items based on sendQuantities (key = item signature, value = quantity)
    const itemIdsToSend: string[] = [];
    for (const [sig, qty] of Object.entries(sendQuantities)) {
      if (qty <= 0) continue;
      const group = sendConsolidatedInventory.find(g => g.sig === sig);
      if (group) {
        // Take up to qty item IDs from this group
        itemIdsToSend.push(...group.allIds.slice(0, qty));
      }
    }

    if (itemIdsToSend.length > 0) {
      const idsToSendSet = new Set(itemIdsToSend);
      const itemsToSend = inventory.filter(item => idsToSendSet.has(item.id));
      const remainingItems = inventory.filter(item => !idsToSendSet.has(item.id));
      const targetInventory = getCrawlerInventory(sendTargetId);

      onUpdateCrawlerInventory(selected.id, remainingItems);
      onUpdateCrawlerInventory(sendTargetId, [...targetInventory, ...itemsToSend]);
    }

    // Reset modal state
    setShowSendModal(false);
    setSendTargetId('');
    setSendGoldAmount(0);
    setSendQuantities({});
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
        <div className="flex">
          {/* Tab buttons - Far Left */}
          <div className="flex flex-col border-r border-border/50 pr-2 mr-4">
            <button
              onClick={() => setActiveTab('profile')}
              className={`p-3 rounded-l-lg transition-colors flex items-center gap-2 ${
                activeTab === 'profile'
                  ? 'bg-primary/20 text-primary border-r-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Profile"
            >
              <User className="w-5 h-5" />
              <span className="hidden xl:inline text-sm font-medium">Profile</span>
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`p-3 rounded-l-lg transition-colors flex items-center gap-2 ${
                activeTab === 'inventory'
                  ? 'bg-primary/20 text-primary border-r-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Inventory"
            >
              <Backpack className="w-5 h-5" />
              <span className="hidden xl:inline text-sm font-medium">Inventory</span>
              {inventory.length > 0 && (
                <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full">{inventory.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`p-3 rounded-l-lg transition-colors flex items-center gap-2 ${
                activeTab === 'actions'
                  ? 'bg-primary/20 text-primary border-r-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Actions"
            >
              <Target className="w-5 h-5" />
              <span className="hidden xl:inline text-sm font-medium">Actions</span>
            </button>
            <button
              onClick={() => setActiveTab('spells')}
              className={`p-3 rounded-l-lg transition-colors flex items-center gap-2 ${
                activeTab === 'spells'
                  ? 'bg-primary/20 text-primary border-r-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Spells"
            >
              <BookOpen className="w-5 h-5" />
              <span className="hidden xl:inline text-sm font-medium">Spells</span>
            </button>
            <button
              onClick={() => setActiveTab('reactions')}
              className={`p-3 rounded-l-lg transition-colors flex items-center gap-2 ${
                activeTab === 'reactions'
                  ? 'bg-primary/20 text-primary border-r-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Reactions"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="hidden xl:inline text-sm font-medium">Reactions</span>
            </button>
            <button
              onClick={() => setActiveTab('attacks')}
              className={`p-3 rounded-l-lg transition-colors flex items-center gap-2 ${
                activeTab === 'attacks'
                  ? 'bg-primary/20 text-primary border-r-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Attacks"
            >
              <Swords className="w-5 h-5" />
              <span className="hidden xl:inline text-sm font-medium">Attacks</span>
            </button>
            <button
              onClick={() => setActiveTab('bonus')}
              className={`p-3 rounded-l-lg transition-colors flex items-center gap-2 ${
                activeTab === 'bonus'
                  ? 'bg-primary/20 text-primary border-r-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Bonus Actions"
            >
              <Timer className="w-5 h-5" />
              <span className="hidden xl:inline text-sm font-medium">Bonus</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'profile' && (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Equipment Slots - Left Side */}
          <div className="flex flex-col gap-3 lg:min-w-[330px]">
            <h3 className="font-display text-primary text-base mb-2">EQUIPMENT</h3>

            {/* Head (center column) */}
            <div className="grid grid-cols-3 gap-3">
              <div></div>
              <EquipmentSlot
                slot="head"
                label="Head"
                equippedItem={getEquippedItem('head')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={!isOwnProfile}
              />
              <div></div>
            </div>

            {/* Left Hand, Chest, Right Hand */}
            <div className="grid grid-cols-3 gap-3">
              <EquipmentSlot
                slot="leftHand"
                label="Left Hand"
                equippedItem={getEquippedItem('leftHand')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={!isOwnProfile}
              />
              <EquipmentSlot
                slot="chest"
                label="Chest"
                equippedItem={getEquippedItem('chest')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={!isOwnProfile}
              />
              <EquipmentSlot
                slot="rightHand"
                label="Right Hand"
                equippedItem={getEquippedItem('rightHand')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={!isOwnProfile}
              />
            </div>

            {/* Ring, Legs, Weapon */}
            <div className="grid grid-cols-3 gap-3">
              <EquipmentSlot
                slot="ringFinger"
                label="Ring"
                equippedItem={getEquippedItem('ringFinger')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={!isOwnProfile}
              />
              <EquipmentSlot
                slot="legs"
                label="Legs"
                equippedItem={getEquippedItem('legs')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={!isOwnProfile}
              />
              <EquipmentSlot
                slot="weapon"
                label="Weapon"
                equippedItem={getEquippedItem('weapon')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={!isOwnProfile}
              />
            </div>

            {/* Feet (center column) */}
            <div className="grid grid-cols-3 gap-3">
              <div></div>
              <EquipmentSlot
                slot="feet"
                label="Feet"
                equippedItem={getEquippedItem('feet')}
                onDrop={handleEquipItem}
                onUnequip={handleUnequipItem}
                disabled={!isOwnProfile}
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
                  baseMax={maxHPMod !== 0 ? baseMaxHP : undefined}
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
                  baseMax={maxManaMod !== 0 ? baseMaxMana : undefined}
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

        {/* Inventory Summary - on profile tab */}
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-primary text-lg flex items-center gap-2">
              <Backpack className="w-5 h-5" /> INVENTORY SUMMARY
            </h3>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View All <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-background/50 rounded p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{inventorySummary.totalItems}</p>
              <p className="text-muted-foreground text-xs">Total Items</p>
            </div>
            <div className="bg-background/50 rounded p-3 text-center">
              <p className="text-2xl font-bold text-primary">{inventorySummary.equippedCount}</p>
              <p className="text-muted-foreground text-xs">Equipped</p>
            </div>
            <div className="bg-background/50 rounded p-3 text-center">
              <p className="text-2xl font-bold text-accent">{inventorySummary.equipmentCount}</p>
              <p className="text-muted-foreground text-xs">Equipment</p>
            </div>
            <div className="bg-background/50 rounded p-3 text-center">
              <p className="text-2xl font-bold text-accent flex items-center justify-center gap-1">
                <Coins className="w-4 h-4" />{inventorySummary.totalValue}
              </p>
              <p className="text-muted-foreground text-xs">Total Value</p>
            </div>
          </div>
        </div>

        {/* Loot Boxes section */}
        {getCrawlerLootBoxes && selected && (() => {
          const boxes = getCrawlerLootBoxes(selected.id);
          if (boxes.length === 0) return null;
          return (
            <div className="mt-6">
              <LootBoxSection
                boxes={boxes}
                crawlerId={selected.id}
                claimLootBoxItems={claimLootBoxItems}
              />
            </div>
          );
        })()}
              </div>
            </div>
            )}

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div className="space-y-4">
                {/* Header with actions */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="font-display text-xl text-primary flex items-center gap-2">
                    <Backpack className="w-6 h-6" /> INVENTORY
                  </h2>
                  <div className="flex gap-2">
                    <DungeonButton
                      variant="default"
                      size="sm"
                      onClick={() => setShowSendModal(true)}
                      disabled={crawlers.length < 2}
                    >
                      <Send className="w-4 h-4 mr-1" /> Send
                    </DungeonButton>
                  </div>
                </div>

                {/* Filters */}
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded text-sm"
                      />
                      {inventorySearch && (
                        <button
                          onClick={() => setInventorySearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Sort dropdown */}
                    <select
                      value={inventorySort}
                      onChange={(e) => setInventorySort(e.target.value as SortOption)}
                      className="bg-muted border border-border rounded px-3 py-2 text-sm"
                    >
                      <option value="name-asc">Name A-Z</option>
                      <option value="name-desc">Name Z-A</option>
                      <option value="gold-desc">Value (High-Low)</option>
                      <option value="gold-asc">Value (Low-High)</option>
                    </select>

                    {/* Tag filter toggle */}
                    {availableTags.length > 0 && (
                      <button
                        onClick={() => setShowTagFilter(!showTagFilter)}
                        className={`flex items-center gap-1 px-3 py-2 text-sm rounded transition-colors ${
                          showTagFilter || selectedTags.length > 0
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                        Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
                      </button>
                    )}
                  </div>

                  {/* Type filter buttons */}
                  <div className="flex gap-1">
                    {(['all', 'equipment', 'consumable', 'valuable'] as const).map(filter => (
                      <button
                        key={filter}
                        onClick={() => setInventoryFilter(filter)}
                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                          inventoryFilter === filter
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Tag checkboxes (dynamic) */}
                  {showTagFilter && availableTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded border border-border">
                      <span className="text-xs text-muted-foreground mr-2">Filter by tag:</span>
                      {availableTags.map(tag => (
                        <label key={tag} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTags([...selectedTags, tag]);
                              } else {
                                setSelectedTags(selectedTags.filter(t => t !== tag));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-border"
                          />
                          <span className="text-xs">{tag}</span>
                        </label>
                      ))}
                      {selectedTags.length > 0 && (
                        <button
                          onClick={() => setSelectedTags([])}
                          className="text-xs text-primary hover:underline ml-2"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Equipment + Items side-by-side */}
                <div className="flex gap-4">
                  {/* Equipment Slots - Left Side */}
                  <div className="bg-muted/30 border border-border rounded-lg p-4 shrink-0" style={{ width: '340px' }}>
                    <h3 className="font-display text-primary text-sm mb-3">EQUIPMENT</h3>
                    <div className="flex flex-col items-center gap-2">
                      <EquipmentSlot slot="head" label="Head" equippedItem={getEquippedItem('head')} onDrop={handleEquipItem} onUnequip={handleUnequipItem} disabled={!isOwnProfile} />
                      <div className="grid grid-cols-3 gap-2" style={{ width: '316px' }}>
                        <EquipmentSlot slot="leftHand" label="L.Hand" equippedItem={getEquippedItem('leftHand')} onDrop={handleEquipItem} onUnequip={handleUnequipItem} disabled={!isOwnProfile} />
                        <EquipmentSlot slot="chest" label="Chest" equippedItem={getEquippedItem('chest')} onDrop={handleEquipItem} onUnequip={handleUnequipItem} disabled={!isOwnProfile} />
                        <EquipmentSlot slot="rightHand" label="R.Hand" equippedItem={getEquippedItem('rightHand')} onDrop={handleEquipItem} onUnequip={handleUnequipItem} disabled={!isOwnProfile} />
                      </div>
                      <div className="grid grid-cols-3 gap-2" style={{ width: '316px' }}>
                        <EquipmentSlot slot="ringFinger" label="Ring" equippedItem={getEquippedItem('ringFinger')} onDrop={handleEquipItem} onUnequip={handleUnequipItem} disabled={!isOwnProfile} />
                        <EquipmentSlot slot="legs" label="Legs" equippedItem={getEquippedItem('legs')} onDrop={handleEquipItem} onUnequip={handleUnequipItem} disabled={!isOwnProfile} />
                        <EquipmentSlot slot="weapon" label="Weapon" equippedItem={getEquippedItem('weapon')} onDrop={handleEquipItem} onUnequip={handleUnequipItem} disabled={!isOwnProfile} />
                      </div>
                      <EquipmentSlot slot="feet" label="Feet" equippedItem={getEquippedItem('feet')} onDrop={handleEquipItem} onUnequip={handleUnequipItem} disabled={!isOwnProfile} />
                    </div>
                    {/* Gold */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                      <Coins className="w-4 h-4 text-accent" />
                      <span className="text-accent font-display text-sm">{Math.floor(selected.gold || 0)}G</span>
                    </div>
                  </div>

                  {/* Items List - Right Side */}
                  <div className="flex-1 min-w-0">
                    {/* Expand All / Item Count */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground">
                        {consolidatedInventory.length} item{consolidatedInventory.length !== 1 ? 's' : ''}
                        {!isOwnProfile && (
                          <span className="ml-2">
                            <Coins className="w-3 h-3 inline text-accent" /> {Math.floor(selected.gold || 0)}G
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => {
                          if (allItemsExpanded) {
                            setExpandedItemIds(new Set());
                            setAllItemsExpanded(false);
                          } else {
                            setExpandedItemIds(new Set(consolidatedInventory.map(c => c.sig)));
                            setAllItemsExpanded(true);
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {allItemsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {allItemsExpanded ? 'Collapse All' : 'Expand All'}
                      </button>
                    </div>

                    {consolidatedInventory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {inventory.length === 0 ? 'No items in inventory' : 'No items match your filters'}
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-3">
                        {consolidatedInventory.map(({ item, count, allIds, isEquipped, sig }) => {
                          const isExpanded = expandedItemIds.has(sig) || allItemsExpanded;
                          return (
                            <div
                              key={sig}
                              draggable={isOwnProfile && !!item.equipSlot}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/json', JSON.stringify(item));
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDoubleClick={() => isOwnProfile && handleDoubleClickEquip(item)}
                              onClick={() => {
                                setAllItemsExpanded(false);
                                setExpandedItemIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(sig)) next.delete(sig);
                                  else next.add(sig);
                                  return next;
                                });
                              }}
                              onContextMenu={(e) => {
                                if (isOwnProfile && item.weaponData) {
                                  e.preventDefault();
                                  setUpgradingWeapon(item);
                                  setUpgradeForm({ ...item.weaponData });
                                  setUpgradeWeaponName(item.isUpgraded ? item.name : `${item.name} Upgraded`);
                                }
                              }}
                              className={`bg-muted/50 p-3 rounded-lg border transition-colors select-none ${
                                isEquipped ? 'border-primary/50' : 'border-border'
                              } ${isOwnProfile && item.equipSlot ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:bg-muted/70`}
                              title={isOwnProfile && item.equipSlot ? 'Drag to equip slot, or double-click to equip' + (item.weaponData ? '. Right-click to upgrade.' : '') : 'Click to expand'}
                            >
                              <div className="flex items-start gap-2">
                                {getEquipmentIcon(item.equipSlot, "w-4 h-4 shrink-0 mt-0.5")}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm truncate">{item.name}</span>
                                    {count > 1 && <span className="text-accent font-bold text-xs">x{count}</span>}
                                    {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {isEquipped && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Equipped</span>}
                                    {item.equipSlot && !isEquipped && (
                                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{item.equipSlot}</span>
                                    )}
                                    {(item.goldValue ?? 0) > 0 && (
                                      <span className="text-xs text-accent flex items-center gap-0.5">
                                        <Coins className="w-3 h-3" />{item.goldValue}g
                                      </span>
                                    )}
                                  </div>

                                  {/* Expanded detail */}
                                  {isExpanded && (
                                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                                      {item.description && (
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                      )}
                                      {item.statModifiers && Object.entries(item.statModifiers).some(([, v]) => v !== 0) && (
                                        <div className="flex flex-wrap gap-1">
                                          {Object.entries(item.statModifiers).filter(([, v]) => v !== 0).map(([stat, val]) => (
                                            <span key={stat} className={`text-xs px-1.5 py-0.5 rounded ${(val as number) > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                              {stat}: {(val as number) > 0 ? '+' : ''}{val}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {item.tags && item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {item.tags.map(tag => (
                                            <span key={tag} className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">{tag}</span>
                                          ))}
                                        </div>
                                      )}
                                      {/* Weapon data display */}
                                      {item.weaponData && (
                                        <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border/30 pt-1">
                                          <div className="flex flex-wrap gap-1">
                                            <span className="px-1.5 py-0.5 bg-destructive/20 text-destructive rounded">{item.weaponData.weaponType}</span>
                                            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">{item.weaponData.damageType}</span>
                                            <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded">{item.weaponData.isRanged ? 'Ranged' : 'Melee'}</span>
                                            {item.isUpgraded && <span className="px-1.5 py-0.5 bg-accent/20 text-accent rounded font-bold italic">Upgraded</span>}
                                          </div>
                                          <div>Damage: {item.weaponData.damageDice.map(d => `${d.count}d${d.sides}`).join(' + ')}</div>
                                          {item.weaponData.hitDie && <div>Hit Bonus: +{item.weaponData.hitDie.count}d{item.weaponData.hitDie.sides}</div>}
                                          {item.weaponData.isRanged && item.weaponData.normalRange && (
                                            <div>Range: {item.weaponData.normalRange}{item.weaponData.maxRange ? `/${item.weaponData.maxRange}` : ''} ft</div>
                                          )}
                                          {item.weaponData.specialEffect && <div className="italic text-accent/70">{item.weaponData.specialEffect}</div>}
                                        </div>
                                      )}
                                      <div className="flex gap-2 mt-1">
                                        {isOwnProfile && item.weaponData && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setUpgradingWeapon(item);
                                              setUpgradeForm({ ...item.weaponData! });
                                              setUpgradeWeaponName(item.isUpgraded ? item.name : `${item.name} Upgraded`);
                                            }}
                                            className="text-xs text-accent hover:underline flex items-center gap-0.5"
                                          >
                                            <Sword className="w-3 h-3" /> Upgrade
                                          </button>
                                        )}
                                        {isOwnProfile && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!confirm(`Delete ${count > 1 ? `all ${count} copies of ` : ''}"${item.name}"?`)) return;
                                              const remaining = inventory.filter(i => !allIds.includes(i.id));
                                              onUpdateCrawlerInventory(selected.id, remaining);
                                            }}
                                            className="text-xs text-destructive hover:underline flex items-center gap-0.5"
                                          >
                                            <Trash2 className="w-3 h-3" /> Delete{count > 1 ? ` (${count})` : ''}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === 'actions' && (() => {
              const rollsRemaining = getNoncombatRollsRemaining?.(selected.id) ?? 0;
              const hasActiveTurn = !!noncombatTurnState && isShowtimeActive;
              const isCombatActive = combatState?.active && combatState.phase !== 'ended';
              const isInitiativePhase = combatState?.active && combatState.phase === 'initiative';
              const isCombatPhase = combatState?.active && combatState.phase === 'combat';
              const myCombatant = combatState?.combatants.find(c => c.id === selected.id);
              const isMyTurn = isCombatPhase && combatState && combatState.combatants[combatState.currentTurnIndex]?.id === selected.id;
              const hasUsedAction = myCombatant?.hasUsedAction ?? false;

              // In combat: only allow rolls on your turn. Outside combat: normal rules
              const isTestMode = !hasActiveTurn && !isCombatActive;
              const canRoll = isCombatActive
                ? (isInitiativePhase || (isMyTurn && !hasUsedAction))
                : (isTestMode || rollsRemaining > 0);
              const maxRolls = noncombatTurnState?.maxRolls ?? 3;

              // Disable non-initiative action buttons during initiative phase
              const canUseActions = isCombatActive
                ? (isMyTurn && !hasUsedAction)
                : canRoll;

              const handleActionRoll = (actionLabel: string, stat: string, total: number) => {
                if (!canUseActions) return;
                onStatRoll?.(selected.name, selected.id, actionLabel, total);
                if (!isTestMode && !isCombatActive) {
                  recordNoncombatRoll?.(selected.id);
                }
                // Record as combat action
                if (isCombatActive && isMyTurn) {
                  onRecordCombatAction?.(selected.id, 'action');
                }
              };

              const handleCombatInitiativeRoll = () => {
                if (!isInitiativePhase || !myCombatant || myCombatant.hasRolledInitiative) return;
                const baseStat = selected.dex;
                const mod = equippedMods.dex ?? 0;
                const modifier = Math.floor(((baseStat + mod) - 10) / 2);
                const rawRoll = Math.floor(Math.random() * 20) + 1;
                const total = rawRoll + modifier;
                onRecordCombatInitiative?.(selected.id, total);
                // Also add to dice history
                if (addDiceRoll) {
                  addDiceRoll({
                    id: crypto.randomUUID(),
                    crawlerName: selected.name,
                    crawlerId: selected.id,
                    timestamp: Date.now(),
                    results: [{ dice: 'D20', result: rawRoll }],
                    total,
                    statRoll: { stat: 'Initiative', modifier, rawRoll },
                  });
                }
              };

              return (
              <div className="space-y-6">
                {/* Combat Initiative Banner */}
                {isInitiativePhase && myCombatant && (
                  <div className={`border-2 rounded-lg p-4 text-center ${
                    myCombatant.hasRolledInitiative
                      ? 'border-accent/50 bg-accent/10'
                      : 'border-destructive bg-destructive/10 animate-pulse'
                  }`}>
                    {myCombatant.hasRolledInitiative ? (
                      <div>
                        <p className="text-accent font-display text-lg">INITIATIVE: {myCombatant.initiative}</p>
                        <p className="text-muted-foreground text-xs">Waiting for other combatants...</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-destructive font-display text-lg mb-3">COMBAT INITIATED!</p>
                        <button
                          onClick={handleCombatInitiativeRoll}
                          className="px-8 py-3 bg-accent text-accent-foreground font-display text-lg rounded-lg hover:bg-accent/90 transition-colors"
                        >
                          <Zap className="w-5 h-5 inline mr-2" />
                          ROLL INITIATIVE
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Combat turn status */}
                {isCombatPhase && myCombatant && (
                  <div className={`border-2 rounded-lg px-4 py-2 ${
                    isMyTurn ? 'border-accent bg-accent/10' : 'border-border bg-muted/30'
                  }`}>
                    <span className={`text-sm font-display ${isMyTurn ? 'text-accent' : 'text-muted-foreground'}`}>
                      {isMyTurn ? 'YOUR TURN — Select an action' : 'Waiting for your turn...'}
                    </span>
                    {isMyTurn && hasUsedAction && (
                      <span className="text-xs text-muted-foreground ml-2">(Action used)</span>
                    )}
                  </div>
                )}

                <h2 className="font-display text-xl text-primary flex items-center gap-2">
                  <Target className="w-6 h-6" /> {isCombatActive ? 'COMBAT ACTIONS' : 'NONCOMBAT ACTIONS'}
                </h2>

                {/* Noncombat Turn status (only outside combat) */}
                {!isCombatActive && (isTestMode ? (
                  <div className="bg-muted/30 border border-border rounded-lg p-4 text-center">
                    <p className="text-muted-foreground text-sm font-display">TEST MODE — FREE ROLLS</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-4 py-2">
                    <span className="text-sm text-muted-foreground font-display">
                      TURN {noncombatTurnState!.turnNumber}
                    </span>
                    <span className={`text-sm font-display ${rollsRemaining > 0 ? 'text-primary' : 'text-destructive'}`}>
                      {rollsRemaining > 0 ? (
                        <>ROLLS: {rollsRemaining} / {maxRolls}</>
                      ) : (
                        <>NO ROLLS LEFT — WAITING FOR DM</>
                      )}
                    </span>
                  </div>
                ))}

                {/* General Actions */}
                <div>
                  <h3 className="font-display text-base text-accent mb-3">Actions</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {NONCOMBAT_ACTIONS.map(action => {
                      const baseStat = (selected as Record<string, unknown>)[action.stat] as number;
                      const mod = equippedMods[action.stat as keyof StatModifiers] ?? 0;
                      const total = baseStat + mod;
                      const disabled = !canUseActions;
                      return (
                        <button
                          key={action.label}
                          onClick={() => handleActionRoll(action.label, action.stat, total)}
                          disabled={disabled}
                          className={`flex flex-col items-center gap-1 p-3 border rounded-lg transition-colors text-left group ${
                            !disabled
                              ? 'bg-muted/50 border-border hover:bg-primary/20 hover:border-primary'
                              : 'bg-muted/20 border-border/50 opacity-50 cursor-not-allowed'
                          }`}
                          title={!disabled ? `Roll d20 + ${action.stat.toUpperCase()} (${total})` : isCombatActive ? 'Not your turn' : 'No rolls remaining'}
                        >
                          <span className={`text-sm font-semibold transition-colors ${!disabled ? 'text-foreground group-hover:text-primary' : 'text-muted-foreground'}`}>{action.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {action.stat.toUpperCase()} {mod !== 0 ? (
                              <span>
                                <span>{baseStat}</span>
                                <span className={mod > 0 ? 'text-green-400' : 'text-red-400'}>{mod > 0 ? `+${mod}` : mod}</span>
                                <span className="text-orange-400"> = {total}</span>
                              </span>
                            ) : (
                              <span className="font-bold">{total}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Intelligence Based Actions */}
                <div>
                  <h3 className="font-display text-base text-accent mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Intelligence Based
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {INTELLIGENCE_ACTIONS.map(action => {
                      const baseStat = selected.int;
                      const mod = equippedMods.int ?? 0;
                      const total = baseStat + mod;
                      const disabled = !canUseActions;
                      return (
                        <button
                          key={action.label}
                          onClick={() => handleActionRoll(action.label, action.stat, total)}
                          disabled={disabled}
                          className={`flex flex-col items-center gap-1 p-3 border rounded-lg transition-colors text-left group ${
                            !disabled
                              ? 'bg-muted/50 border-border hover:bg-primary/20 hover:border-primary'
                              : 'bg-muted/20 border-border/50 opacity-50 cursor-not-allowed'
                          }`}
                          title={!disabled ? `Roll d20 + INT (${total})` : isCombatActive ? 'Not your turn' : 'No rolls remaining'}
                        >
                          <span className={`text-sm font-semibold transition-colors ${!disabled ? 'text-foreground group-hover:text-primary' : 'text-muted-foreground'}`}>{action.label}</span>
                          <span className="text-xs text-muted-foreground">
                            INT {mod !== 0 ? (
                              <span>
                                <span>{baseStat}</span>
                                <span className={mod > 0 ? 'text-green-400' : 'text-red-400'}>{mod > 0 ? `+${mod}` : mod}</span>
                                <span className="text-orange-400"> = {total}</span>
                              </span>
                            ) : (
                              <span className="font-bold">{total}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Initiative - always visible but context-aware */}
                {!isInitiativePhase && (
                <div>
                  <h3 className="font-display text-base text-accent mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Initiative
                  </h3>
                  {(() => {
                    const baseStat = selected.dex;
                    const mod = equippedMods.dex ?? 0;
                    const total = baseStat + mod;
                    return (
                      <button
                        onClick={() => {
                          onStatRoll?.(selected.name, selected.id, INITIATIVE_ACTION.label, total);
                          if (!isTestMode && !isCombatActive) {
                            recordNoncombatRoll?.(selected.id);
                          }
                        }}
                        disabled={!canRoll}
                        className={`flex items-center gap-3 px-6 py-4 border-2 rounded-lg transition-colors group w-full max-w-xs ${
                          canRoll
                            ? 'bg-accent/10 border-accent hover:bg-accent/20'
                            : 'bg-muted/20 border-border/50 opacity-50 cursor-not-allowed'
                        }`}
                        title={canRoll ? `Roll d20 + DEX (${total})` : 'No rolls remaining'}
                      >
                        <Zap className={`w-6 h-6 ${canRoll ? 'text-accent' : 'text-muted-foreground'}`} />
                        <div>
                          <span className={`text-lg font-display ${canRoll ? 'text-accent group-hover:text-glow-gold' : 'text-muted-foreground'}`}>Initiative</span>
                          <div className="text-xs text-muted-foreground">
                            DEX {mod !== 0 ? (
                              <span>
                                <span>{baseStat}</span>
                                <span className={mod > 0 ? 'text-green-400' : 'text-red-400'}>{mod > 0 ? `+${mod}` : mod}</span>
                                <span className="text-orange-400"> = {total}</span>
                              </span>
                            ) : (
                              <span className="font-bold">{total}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })()}
                </div>
                )}
              </div>
              );
            })()}

            {/* Spells Tab */}
            {activeTab === 'spells' && (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-xl text-primary mb-2">Spells Coming Soon</h3>
                <p className="text-muted-foreground">
                  The spell system is currently under development.
                </p>
              </div>
            )}

            {/* Reactions Tab */}
            {activeTab === 'reactions' && (() => {
              // Reactions are ALWAYS clickable, regardless of turn
              const handleReactionRoll = (actionName: string, stat: 'str' | 'dex' | 'con' | 'int' | 'cha') => {
                const baseStat = (selected as Record<string, unknown>)[stat] as number;
                const mod = equippedMods[stat as keyof StatModifiers] ?? 0;
                const total = baseStat + mod;
                const modifier = Math.floor((total - 10) / 2);
                const rawRoll = Math.floor(Math.random() * 20) + 1;
                const rollTotal = rawRoll + modifier;

                onStatRoll?.(selected.name, selected.id, actionName, total);
                if (addDiceRoll) {
                  addDiceRoll({
                    id: crypto.randomUUID(),
                    crawlerName: selected.name,
                    crawlerId: selected.id,
                    timestamp: Date.now(),
                    results: [{ dice: 'D20', result: rawRoll }],
                    total: rollTotal,
                    statRoll: { stat: actionName, modifier, rawRoll },
                  });
                }
              };

              return (
                <div className="space-y-6">
                  <h2 className="font-display text-xl text-primary flex items-center gap-2">
                    <RefreshCw className="w-6 h-6" /> REACTIONS
                  </h2>
                  <p className="text-xs text-muted-foreground">Reactions can be used at any time, even when it is not your turn.</p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Trip Reaction */}
                    <button
                      onClick={() => handleReactionRoll('Trip', 'dex')}
                      className="flex flex-col items-center gap-2 p-4 border-2 border-accent/50 rounded-lg bg-accent/5 hover:bg-accent/20 hover:border-accent transition-colors group"
                    >
                      <Footprints className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-display text-accent">Trip</span>
                      <span className="text-[10px] text-muted-foreground">DEX check (d20 + modifier)</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Attacks Tab */}
            {activeTab === 'attacks' && (() => {
              const isAnyCombatActive = combatState?.active && combatState.phase !== 'ended';
              const isCombatPhaseLocal = combatState?.active && combatState.phase === 'combat';
              const isMyTurn = isCombatPhaseLocal && combatState && combatState.combatants[combatState.currentTurnIndex]?.id === selected.id;
              const myCombatant = combatState?.combatants.find(c => c.id === selected.id);
              const hasUsedAction = myCombatant?.hasUsedAction ?? false;
              const canAttack = !isAnyCombatActive || (isMyTurn && !hasUsedAction);

              const combatTargets = combatState?.combatants.filter(c => c.id !== selected.id) ?? [];

              // Get equipped weapons with weaponData
              const equippedWeapons: { item: InventoryItem; slot: string }[] = [];
              const equippedMap = selected.equippedItems ?? {};
              for (const [slot, itemId] of Object.entries(equippedMap)) {
                if (!itemId) continue;
                const item = inventory.find(i => i.id === itemId);
                if (item?.weaponData) {
                  equippedWeapons.push({ item, slot });
                }
              }

              // Helper to format dice notation
              const formatDice = (dice: WeaponDie[]): string => {
                return dice.map(d => `${d.count}d${d.sides}`).join(' + ');
              };

              // Helper to calculate total modifier from weapon stat modifiers
              const calcWeaponStatMod = (mods: StatModifiers | undefined): number => {
                if (!mods) return 0;
                let total = 0;
                for (const [stat, val] of Object.entries(mods)) {
                  if (val && ['str', 'dex', 'con', 'int', 'cha'].includes(stat)) {
                    const baseStat = (selected as Record<string, unknown>)[stat] as number ?? 10;
                    const equipMod = equippedMods[stat as keyof StatModifiers] ?? 0;
                    const totalStat = baseStat + equipMod;
                    const modifier = Math.floor((totalStat - 10) / 2);
                    total += modifier * val;
                  }
                }
                return total;
              };

              const handleAttackRoll = (attackName: string, stat: 'str' | 'dex', damageDice: string, damageBonus: number) => {
                if (!canAttack) return;
                const baseStat = (selected as Record<string, unknown>)[stat] as number;
                const mod = equippedMods[stat as keyof StatModifiers] ?? 0;
                const total = baseStat + mod;
                const modifier = Math.floor((total - 10) / 2);
                const rawRoll = Math.floor(Math.random() * 20) + 1;
                const rollTotal = rawRoll + modifier;

                onStatRoll?.(selected.name, selected.id, attackName, total);
                if (addDiceRoll) {
                  addDiceRoll({
                    id: crypto.randomUUID(),
                    crawlerName: selected.name,
                    crawlerId: selected.id,
                    timestamp: Date.now(),
                    results: [{ dice: 'D20', result: rawRoll }],
                    total: rollTotal,
                    statRoll: { stat: `${attackName} (Attack)`, modifier, rawRoll },
                  });
                }

                if (isCombatPhaseLocal && combatTargets.length > 0) {
                  setPendingDamageRoll({ dice: damageDice, bonus: damageBonus, actionName: attackName });
                  setShowDamageTargetModal(true);
                  setDamageRollResult(null);
                }

                if (isCombatPhaseLocal && isMyTurn) {
                  onRecordCombatAction?.(selected.id, 'action');
                }
              };

              const handleWeaponAttackRoll = (weapon: InventoryItem, advantage?: 'advantage' | 'disadvantage') => {
                if (!canAttack || !weapon.weaponData) return;
                const wd = weapon.weaponData;

                // Base d20 attack roll
                const roll1 = Math.floor(Math.random() * 20) + 1;
                const roll2 = advantage ? Math.floor(Math.random() * 20) + 1 : roll1;
                const rawRoll = advantage === 'advantage' ? Math.max(roll1, roll2) : advantage === 'disadvantage' ? Math.min(roll1, roll2) : roll1;

                // Bonus hit die
                let hitDieResult = 0;
                if (wd.hitDie && wd.hitDie.count > 0) {
                  for (let i = 0; i < wd.hitDie.count; i++) {
                    hitDieResult += Math.floor(Math.random() * wd.hitDie.sides) + 1;
                  }
                }

                // Stat modifiers for hit
                const hitStatMod = calcWeaponStatMod(wd.hitModifiers);
                const rollTotal = rawRoll + hitDieResult + hitStatMod;

                const results: { dice: string; result: number }[] = [];
                if (advantage) {
                  results.push({ dice: `D20${advantage === 'advantage' ? ' (Adv)' : ' (Dis)'}`, result: rawRoll });
                  results.push({ dice: 'D20 (other)', result: advantage === 'advantage' ? Math.min(roll1, roll2) : Math.max(roll1, roll2) });
                } else {
                  results.push({ dice: 'D20', result: rawRoll });
                }
                if (hitDieResult > 0 && wd.hitDie) {
                  results.push({ dice: `${wd.hitDie.count}d${wd.hitDie.sides} (hit bonus)`, result: hitDieResult });
                }

                if (addDiceRoll) {
                  addDiceRoll({
                    id: crypto.randomUUID(),
                    crawlerName: selected.name,
                    crawlerId: selected.id,
                    timestamp: Date.now(),
                    results,
                    total: rollTotal,
                    statRoll: { stat: `${weapon.name} (Attack)`, modifier: hitDieResult + hitStatMod, rawRoll },
                  });
                }

                if (isCombatPhaseLocal && combatTargets.length > 0) {
                  setPendingDamageRoll({ dice: formatDice(wd.damageDice), bonus: calcWeaponStatMod(wd.damageModifiers), actionName: weapon.name });
                  setShowDamageTargetModal(true);
                  setDamageRollResult(null);
                } else if (!isCombatPhaseLocal) {
                  // Outside combat: auto-roll damage alongside attack for convenience
                  let totalDamage = 0;
                  const dmgResults: { dice: string; result: number }[] = [];
                  for (const die of wd.damageDice) {
                    let dieTotal = 0;
                    for (let i = 0; i < die.count; i++) {
                      dieTotal += Math.floor(Math.random() * die.sides) + 1;
                    }
                    dmgResults.push({ dice: `${die.count}d${die.sides}`, result: dieTotal });
                    totalDamage += dieTotal;
                  }
                  const dmgStatMod = calcWeaponStatMod(wd.damageModifiers);
                  totalDamage += dmgStatMod;
                  if (addDiceRoll) {
                    addDiceRoll({
                      id: crypto.randomUUID(),
                      crawlerName: selected.name,
                      crawlerId: selected.id,
                      timestamp: Date.now(),
                      results: dmgResults,
                      total: totalDamage,
                      statRoll: { stat: `${weapon.name} (${wd.damageType} Damage)`, modifier: dmgStatMod, rawRoll: totalDamage - dmgStatMod },
                    });
                  }
                }

                if (isCombatPhaseLocal && isMyTurn) {
                  onRecordCombatAction?.(selected.id, 'action');
                }
              };

              const handleWeaponDamageRoll = (weapon: InventoryItem) => {
                if (!weapon.weaponData) return;
                const wd = weapon.weaponData;

                let totalDamage = 0;
                const results: { dice: string; result: number }[] = [];

                for (const die of wd.damageDice) {
                  let dieTotal = 0;
                  for (let i = 0; i < die.count; i++) {
                    dieTotal += Math.floor(Math.random() * die.sides) + 1;
                  }
                  results.push({ dice: `${die.count}d${die.sides}`, result: dieTotal });
                  totalDamage += dieTotal;
                }

                const dmgStatMod = calcWeaponStatMod(wd.damageModifiers);
                totalDamage += dmgStatMod;

                if (addDiceRoll) {
                  addDiceRoll({
                    id: crypto.randomUUID(),
                    crawlerName: selected.name,
                    crawlerId: selected.id,
                    timestamp: Date.now(),
                    results,
                    total: totalDamage,
                    statRoll: { stat: `${weapon.name} (${wd.damageType} Damage)`, modifier: dmgStatMod, rawRoll: totalDamage - dmgStatMod },
                  });
                }
              };

              return (
                <div className="space-y-6">
                  <h2 className="font-display text-xl text-primary flex items-center gap-2">
                    <Swords className="w-6 h-6" /> ATTACKS
                  </h2>

                  {isAnyCombatActive && (
                    <div className={`border-2 rounded-lg px-4 py-2 ${
                      isMyTurn && !hasUsedAction ? 'border-accent bg-accent/10' : 'border-border bg-muted/30'
                    }`}>
                      <span className={`text-sm font-display ${isMyTurn && !hasUsedAction ? 'text-accent' : 'text-muted-foreground'}`}>
                        {combatState?.phase === 'initiative'
                          ? 'Rolling initiative — attacks locked'
                          : isMyTurn ? (hasUsedAction ? 'Action already used this turn' : 'YOUR TURN — Select an attack') : 'Waiting for your turn...'}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Unarmed Strike */}
                    <button
                      onClick={() => handleAttackRoll('Unarmed Strike', 'str', 'd4', 0)}
                      disabled={!canAttack}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors group ${
                        canAttack
                          ? 'border-destructive/50 bg-destructive/5 hover:bg-destructive/20 hover:border-destructive'
                          : 'border-border/50 bg-muted/20 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Hand className={`w-8 h-8 ${canAttack ? 'text-destructive group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-display ${canAttack ? 'text-destructive' : 'text-muted-foreground'}`}>Unarmed Strike</span>
                      <span className="text-[10px] text-muted-foreground">STR check, d4 damage on hit</span>
                    </button>

                    {/* Equipped Weapons */}
                    {equippedWeapons.map(({ item }) => {
                      const wd = item.weaponData!;
                      const dmgStr = formatDice(wd.damageDice);
                      return (
                        <div key={item.id} className={`flex flex-col border-2 rounded-lg overflow-hidden transition-colors ${
                          canAttack
                            ? 'border-destructive/50 bg-destructive/5'
                            : 'border-border/50 bg-muted/20 opacity-50'
                        }`}>
                          {/* Weapon info header */}
                          <div className="px-3 pt-3 pb-1 text-center">
                            <Sword className={`w-6 h-6 mx-auto mb-1 ${canAttack ? 'text-destructive' : 'text-muted-foreground'}`} />
                            <span className={`text-sm font-display block ${canAttack ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {item.name}
                              {item.isUpgraded && <span className="text-accent font-bold italic ml-1 text-[10px]">Upgraded</span>}
                            </span>
                            <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
                              <div>{wd.weaponType} · {wd.isRanged ? 'Ranged' : 'Melee'} · {wd.damageType}</div>
                              <div>{dmgStr} damage{wd.hitDie ? ` · +${wd.hitDie.count}d${wd.hitDie.sides} to hit` : ''}</div>
                              {wd.isRanged && wd.normalRange && <div>Range: {wd.normalRange}{wd.maxRange ? `/${wd.maxRange}` : ''} ft</div>}
                              {wd.specialEffect && <div className="italic text-accent/70">{wd.specialEffect}</div>}
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="flex gap-1 p-2 mt-auto">
                            <button
                              onClick={() => handleWeaponAttackRoll(item)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                if (!canAttack) return;
                                // Show advantage/disadvantage menu
                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                setWeaponAdvMenu({ weaponId: item.id, x: rect.left, y: rect.top });
                              }}
                              disabled={!canAttack}
                              className={`flex-1 py-1.5 rounded text-[10px] font-display transition-colors ${
                                canAttack
                                  ? 'bg-destructive/20 text-destructive hover:bg-destructive/40'
                                  : 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                              }`}
                              title="Left click: normal roll. Right click: advantage/disadvantage"
                            >
                              ATTACK
                            </button>
                            <button
                              onClick={() => handleWeaponDamageRoll(item)}
                              className={`flex-1 py-1.5 rounded text-[10px] font-display transition-colors ${
                                'bg-accent/20 text-accent hover:bg-accent/40'
                              }`}
                            >
                              DAMAGE
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {equippedWeapons.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Equip weapons from your inventory to see weapon attacks here.</p>
                  )}
                </div>
              );
            })()}

            {/* Bonus Actions Tab */}
            {activeTab === 'bonus' && (() => {
              const isCombatActive = combatState?.active && combatState.phase !== 'ended';
              const isCombatPhaseLocal = combatState?.active && combatState.phase === 'combat';
              const isMyTurn = isCombatPhaseLocal && combatState && combatState.combatants[combatState.currentTurnIndex]?.id === selected.id;
              const myCombatant = combatState?.combatants.find(c => c.id === selected.id);
              const hasUsedBonusAction = myCombatant?.hasUsedBonusAction ?? false;
              const canUseBonus = !isCombatActive || (isMyTurn && !hasUsedBonusAction);

              const handleBonusActionRoll = (actionName: string, stat: 'str' | 'dex' | 'con' | 'int' | 'cha') => {
                if (!canUseBonus) return;
                const baseStat = (selected as Record<string, unknown>)[stat] as number;
                const mod = equippedMods[stat as keyof StatModifiers] ?? 0;
                const total = baseStat + mod;
                const modifier = Math.floor((total - 10) / 2);
                const rawRoll = Math.floor(Math.random() * 20) + 1;
                const rollTotal = rawRoll + modifier;

                onStatRoll?.(selected.name, selected.id, actionName, total);
                if (addDiceRoll) {
                  addDiceRoll({
                    id: crypto.randomUUID(),
                    crawlerName: selected.name,
                    crawlerId: selected.id,
                    timestamp: Date.now(),
                    results: [{ dice: 'D20', result: rawRoll }],
                    total: rollTotal,
                    statRoll: { stat: `${actionName} (Bonus)`, modifier, rawRoll },
                  });
                }
                if (isCombatPhaseLocal && isMyTurn) {
                  onRecordCombatAction?.(selected.id, 'bonus');
                }
              };

              return (
                <div className="space-y-6">
                  <h2 className="font-display text-xl text-primary flex items-center gap-2">
                    <Timer className="w-6 h-6" /> BONUS ACTIONS
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    You can take one bonus action on your turn. Bonus actions are separate from your main action.
                  </p>

                  {isCombatActive && (
                    <div className={`border-2 rounded-lg px-4 py-2 ${
                      isMyTurn && !hasUsedBonusAction ? 'border-accent bg-accent/10' : 'border-border bg-muted/30'
                    }`}>
                      <span className={`text-sm font-display ${isMyTurn && !hasUsedBonusAction ? 'text-accent' : 'text-muted-foreground'}`}>
                        {combatState?.phase === 'initiative'
                          ? 'Rolling initiative — bonus actions locked'
                          : isMyTurn ? (hasUsedBonusAction ? 'Bonus action already used this turn' : 'YOUR TURN — Select a bonus action') : 'Waiting for your turn...'}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Off-hand Attack */}
                    <button
                      onClick={() => handleBonusActionRoll('Off-hand Attack', 'str')}
                      disabled={!canUseBonus}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors group ${
                        canUseBonus
                          ? 'border-accent/50 bg-accent/5 hover:bg-accent/20 hover:border-accent'
                          : 'border-border/50 bg-muted/20 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Sword className={`w-8 h-8 ${canUseBonus ? 'text-accent group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-display ${canUseBonus ? 'text-accent' : 'text-muted-foreground'}`}>Off-hand Attack</span>
                      <span className="text-[10px] text-muted-foreground">STR check (dual wield)</span>
                    </button>

                    {/* Dash */}
                    <button
                      onClick={() => handleBonusActionRoll('Dash', 'dex')}
                      disabled={!canUseBonus}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors group ${
                        canUseBonus
                          ? 'border-accent/50 bg-accent/5 hover:bg-accent/20 hover:border-accent'
                          : 'border-border/50 bg-muted/20 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Zap className={`w-8 h-8 ${canUseBonus ? 'text-accent group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-display ${canUseBonus ? 'text-accent' : 'text-muted-foreground'}`}>Dash</span>
                      <span className="text-[10px] text-muted-foreground">Double movement speed</span>
                    </button>

                    {/* Disengage */}
                    <button
                      onClick={() => handleBonusActionRoll('Disengage', 'dex')}
                      disabled={!canUseBonus}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors group ${
                        canUseBonus
                          ? 'border-accent/50 bg-accent/5 hover:bg-accent/20 hover:border-accent'
                          : 'border-border/50 bg-muted/20 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <RefreshCw className={`w-8 h-8 ${canUseBonus ? 'text-accent group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-display ${canUseBonus ? 'text-accent' : 'text-muted-foreground'}`}>Disengage</span>
                      <span className="text-[10px] text-muted-foreground">No opportunity attacks</span>
                    </button>

                    {/* Hide */}
                    <button
                      onClick={() => handleBonusActionRoll('Hide', 'dex')}
                      disabled={!canUseBonus}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors group ${
                        canUseBonus
                          ? 'border-accent/50 bg-accent/5 hover:bg-accent/20 hover:border-accent'
                          : 'border-border/50 bg-muted/20 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Search className={`w-8 h-8 ${canUseBonus ? 'text-accent group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-display ${canUseBonus ? 'text-accent' : 'text-muted-foreground'}`}>Hide</span>
                      <span className="text-[10px] text-muted-foreground">DEX stealth check</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </DungeonCard>

      {/* Send Gold/Items Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <div className="bg-background border-2 border-primary rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg text-primary">Send Gold/Items</h3>
              <button onClick={() => { setShowSendModal(false); setSendTargetId(''); setSendGoldAmount(0); setSendQuantities({}); }}>
                <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Target Crawler */}
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Send to:</label>
                <select
                  value={sendTargetId}
                  onChange={(e) => setSendTargetId(e.target.value)}
                  className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
                >
                  <option value="">Select a crawler...</option>
                  {crawlers.filter(c => c.id !== selected.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Gold Amount */}
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  Gold (available: {Math.floor(selected.gold || 0)}G)
                </label>
                <input
                  type="number"
                  min={0}
                  max={selected.gold || 0}
                  value={sendGoldAmount}
                  onChange={(e) => setSendGoldAmount(Math.min(selected.gold || 0, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Items Selection - Consolidated with quantity */}
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  Items ({totalItemsToSend} selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-border rounded bg-muted/30">
                  {sendConsolidatedInventory.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">No items available to send</p>
                  ) : (
                    sendConsolidatedInventory.map(({ item, count, sig }) => {
                      const qty = sendQuantities[sig] || 0;
                      return (
                        <div
                          key={sig}
                          className={`flex items-center gap-2 p-2 border-b border-border/50 last:border-0 ${
                            qty > 0 ? 'bg-primary/10' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {getEquipmentIcon(item.equipSlot, "w-3.5 h-3.5 shrink-0")}
                              <span className="text-sm font-medium truncate">{item.name}</span>
                              {count > 1 && <span className="text-xs text-accent font-bold">x{count}</span>}
                            </div>
                            {item.goldValue != null && item.goldValue > 0 && (
                              <span className="text-xs text-accent ml-5">{item.goldValue}g each</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setSendQuantities(prev => {
                                const newQty = Math.max(0, (prev[sig] || 0) - 1);
                                if (newQty === 0) { const { [sig]: _, ...rest } = prev; return rest; }
                                return { ...prev, [sig]: newQty };
                              })}
                              disabled={qty === 0}
                              className="w-6 h-6 flex items-center justify-center text-xs rounded bg-muted border border-border hover:bg-muted/80 disabled:opacity-30"
                            >-</button>
                            <span className="w-6 text-center text-sm font-bold">{qty}</span>
                            <button
                              onClick={() => setSendQuantities(prev => ({
                                ...prev,
                                [sig]: Math.min(count, (prev[sig] || 0) + 1)
                              }))}
                              disabled={qty >= count}
                              className="w-6 h-6 flex items-center justify-center text-xs rounded bg-muted border border-border hover:bg-muted/80 disabled:opacity-30"
                            >+</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {sendConsolidatedInventory.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        const allMax: Record<string, number> = {};
                        sendConsolidatedInventory.forEach(g => { allMax[g.sig] = g.count; });
                        setSendQuantities(allMax);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Send all
                    </button>
                    {totalItemsToSend > 0 && (
                      <button
                        onClick={() => setSendQuantities({})}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Send Button */}
              <DungeonButton
                variant="admin"
                size="sm"
                onClick={handleSend}
                disabled={!sendTargetId || (sendGoldAmount === 0 && totalItemsToSend === 0)}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Send {sendGoldAmount > 0 && `${sendGoldAmount}G`}
                {sendGoldAmount > 0 && totalItemsToSend > 0 && ' + '}
                {totalItemsToSend > 0 && `${totalItemsToSend} item${totalItemsToSend !== 1 ? 's' : ''}`}
              </DungeonButton>
            </div>
          </div>
        </div>
      )}

      {/* Damage Target Modal */}
      {/* Advantage/Disadvantage context menu for weapon attacks */}
      {weaponAdvMenu && (() => {
        const weapon = inventory.find(i => i.id === weaponAdvMenu.weaponId);
        if (!weapon?.weaponData) return null;

        // Find the handleWeaponAttackRoll in scope - need reference from attacks tab
        const doRoll = (adv?: 'advantage' | 'disadvantage') => {
          const wd = weapon.weaponData!;
          const isCombatPhaseLocal = combatState?.active && combatState.phase === 'combat';
          const isMyTurn = isCombatPhaseLocal && combatState && combatState.combatants[combatState.currentTurnIndex]?.id === selected.id;

          // Base d20 attack roll
          const roll1 = Math.floor(Math.random() * 20) + 1;
          const roll2 = adv ? Math.floor(Math.random() * 20) + 1 : roll1;
          const rawRoll = adv === 'advantage' ? Math.max(roll1, roll2) : adv === 'disadvantage' ? Math.min(roll1, roll2) : roll1;

          let hitDieResult = 0;
          if (wd.hitDie && wd.hitDie.count > 0) {
            for (let i = 0; i < wd.hitDie.count; i++) {
              hitDieResult += Math.floor(Math.random() * wd.hitDie.sides) + 1;
            }
          }

          const calcMod = (mods: StatModifiers | undefined): number => {
            if (!mods) return 0;
            let total = 0;
            for (const [stat, val] of Object.entries(mods)) {
              if (val && ['str', 'dex', 'con', 'int', 'cha'].includes(stat)) {
                const baseStat = (selected as Record<string, unknown>)[stat] as number ?? 10;
                const equipMod = equippedMods[stat as keyof StatModifiers] ?? 0;
                const totalStat = baseStat + equipMod;
                total += Math.floor((totalStat - 10) / 2) * val;
              }
            }
            return total;
          };

          const hitStatMod = calcMod(wd.hitModifiers);
          const rollTotal = rawRoll + hitDieResult + hitStatMod;

          const results: { dice: string; result: number }[] = [];
          if (adv) {
            results.push({ dice: `D20${adv === 'advantage' ? ' (Adv)' : ' (Dis)'}`, result: rawRoll });
            results.push({ dice: 'D20 (other)', result: adv === 'advantage' ? Math.min(roll1, roll2) : Math.max(roll1, roll2) });
          } else {
            results.push({ dice: 'D20', result: rawRoll });
          }
          if (hitDieResult > 0 && wd.hitDie) {
            results.push({ dice: `${wd.hitDie.count}d${wd.hitDie.sides} (hit bonus)`, result: hitDieResult });
          }

          if (addDiceRoll) {
            addDiceRoll({
              id: crypto.randomUUID(),
              crawlerName: selected.name,
              crawlerId: selected.id,
              timestamp: Date.now(),
              results,
              total: rollTotal,
              statRoll: { stat: `${weapon.name} (Attack${adv ? ` - ${adv}` : ''})`, modifier: hitDieResult + hitStatMod, rawRoll },
            });
          }

          const combatTargets = combatState?.combatants.filter(c => c.id !== selected.id) ?? [];
          if (isCombatPhaseLocal && combatTargets.length > 0) {
            const formatDice = (dice: WeaponDie[]): string => dice.map(d => `${d.count}d${d.sides}`).join(' + ');
            setPendingDamageRoll({ dice: formatDice(wd.damageDice), bonus: calcMod(wd.damageModifiers), actionName: weapon.name });
            setShowDamageTargetModal(true);
            setDamageRollResult(null);
          } else if (!isCombatPhaseLocal) {
            // Outside combat: auto-roll damage alongside attack for convenience
            let totalDamage = 0;
            const dmgResults: { dice: string; result: number }[] = [];
            for (const die of wd.damageDice) {
              let dieTotal = 0;
              for (let i = 0; i < die.count; i++) {
                dieTotal += Math.floor(Math.random() * die.sides) + 1;
              }
              dmgResults.push({ dice: `${die.count}d${die.sides}`, result: dieTotal });
              totalDamage += dieTotal;
            }
            const dmgStatMod = calcMod(wd.damageModifiers);
            totalDamage += dmgStatMod;
            if (addDiceRoll) {
              addDiceRoll({
                id: crypto.randomUUID(),
                crawlerName: selected.name,
                crawlerId: selected.id,
                timestamp: Date.now(),
                results: dmgResults,
                total: totalDamage,
                statRoll: { stat: `${weapon.name} (${wd.damageType} Damage)`, modifier: dmgStatMod, rawRoll: totalDamage - dmgStatMod },
              });
            }
          }

          if (isCombatPhaseLocal && isMyTurn) {
            onRecordCombatAction?.(selected.id, 'action');
          }
          setWeaponAdvMenu(null);
        };

        return (
          <div className="fixed inset-0 z-50" onClick={() => setWeaponAdvMenu(null)}>
            <div
              className="absolute bg-background border-2 border-destructive rounded-lg shadow-xl p-2 space-y-1"
              style={{ left: weaponAdvMenu.x, top: weaponAdvMenu.y - 120 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[10px] text-muted-foreground font-display px-2 pb-1 border-b border-border">{weapon.name}</p>
              <button onClick={() => doRoll('advantage')}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-green-500/20 text-green-400 rounded transition-colors">
                Roll with Advantage (2d20, take highest)
              </button>
              <button onClick={() => doRoll('disadvantage')}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-destructive/20 text-destructive rounded transition-colors">
                Roll with Disadvantage (2d20, take lowest)
              </button>
              <button onClick={() => doRoll()}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground rounded transition-colors">
                Normal Roll
              </button>
            </div>
          </div>
        );
      })()}

      {/* Weapon Upgrade Modal */}
      {upgradingWeapon && upgradeForm && (() => {
        const updateUF = (updates: Partial<WeaponData>) => {
          setUpgradeForm(prev => prev ? { ...prev, ...updates } : prev);
        };

        const handleSaveUpgrade = () => {
          if (!upgradingWeapon || !upgradeForm) return;
          const updatedItems = inventory.map(item => {
            if (item.id !== upgradingWeapon.id) return item;
            const newName = upgradeWeaponName.trim() || item.name;
            return { ...item, name: newName, weaponData: upgradeForm, isUpgraded: true };
          });
          onUpdateCrawlerInventory(selected.id, updatedItems);
          setUpgradingWeapon(null);
          setUpgradeForm(null);
          setUpgradeWeaponName('');
        };

        return (
          <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
            <div className="bg-background border-2 border-accent rounded-lg p-6 max-w-lg w-full shadow-xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg text-accent">Upgrade {upgradingWeapon.name}</h3>
                <button onClick={() => { setUpgradingWeapon(null); setUpgradeForm(null); setUpgradeWeaponName(''); }}>
                  <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Weapon Name */}
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Weapon Name</label>
                  <input
                    type="text"
                    value={upgradeWeaponName}
                    onChange={(e) => setUpgradeWeaponName(e.target.value)}
                    className="bg-muted border border-border px-2 py-1 text-xs w-full"
                    placeholder={upgradingWeapon.name}
                  />
                </div>
                {/* Weapon Type & Damage Type */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Weapon Type</label>
                    <select value={upgradeForm.weaponType} onChange={(e) => updateUF({ weaponType: e.target.value as WeaponType })}
                      className="bg-muted border border-border px-2 py-1 text-xs w-full">
                      {WEAPON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Damage Type</label>
                    <select value={upgradeForm.damageType} onChange={(e) => updateUF({ damageType: e.target.value as DamageType })}
                      className="bg-muted border border-border px-2 py-1 text-xs w-full">
                      {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Hit Die */}
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Bonus Hit Die</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} max={10} value={upgradeForm.hitDie?.count ?? 0}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 0;
                        updateUF({ hitDie: count > 0 ? { count, sides: upgradeForm.hitDie?.sides ?? 4 } : undefined });
                      }}
                      className="w-12 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                    <span className="text-xs text-muted-foreground">d</span>
                    <select value={upgradeForm.hitDie?.sides ?? 4}
                      onChange={(e) => updateUF({ hitDie: (upgradeForm.hitDie?.count ?? 0) > 0 ? { count: upgradeForm.hitDie!.count, sides: parseInt(e.target.value) } : undefined })}
                      className="bg-muted border border-border px-1 py-0.5 text-xs">
                      {[4, 6, 8, 10, 12, 20].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Damage Dice */}
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Damage Dice</label>
                  {upgradeForm.damageDice.map((die, i) => (
                    <div key={i} className="flex items-center gap-1 mb-1">
                      <input type="number" min={1} max={20} value={die.count}
                        onChange={(e) => {
                          const updated = [...upgradeForm.damageDice];
                          updated[i] = { ...die, count: parseInt(e.target.value) || 1 };
                          updateUF({ damageDice: updated });
                        }}
                        className="w-12 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                      <span className="text-xs text-muted-foreground">d</span>
                      <select value={die.sides}
                        onChange={(e) => {
                          const updated = [...upgradeForm.damageDice];
                          updated[i] = { ...die, sides: parseInt(e.target.value) };
                          updateUF({ damageDice: updated });
                        }}
                        className="bg-muted border border-border px-1 py-0.5 text-xs">
                        {[4, 6, 8, 10, 12, 20].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {upgradeForm.damageDice.length > 1 && (
                        <button onClick={() => updateUF({ damageDice: upgradeForm.damageDice.filter((_, j) => j !== i) })}
                          className="text-destructive text-xs"><Trash2 className="w-3 h-3" /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => updateUF({ damageDice: [...upgradeForm.damageDice, { count: 1, sides: 6 }] })}
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add die
                  </button>
                </div>

                {/* Hit Stat Modifiers */}
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Hit Roll Stat Modifiers</label>
                  <div className="grid grid-cols-5 gap-1">
                    {(['str', 'dex', 'con', 'int', 'cha'] as const).map((stat) => (
                      <div key={stat} className="flex flex-col items-center">
                        <label className="text-[9px] text-muted-foreground uppercase">{stat}</label>
                        <input type="number" value={upgradeForm.hitModifiers?.[stat] ?? ""}
                          onChange={(e) => updateUF({ hitModifiers: { ...upgradeForm.hitModifiers, [stat]: e.target.value ? parseInt(e.target.value) : undefined } })}
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
                        <input type="number" value={upgradeForm.damageModifiers?.[stat] ?? ""}
                          onChange={(e) => updateUF({ damageModifiers: { ...upgradeForm.damageModifiers, [stat]: e.target.value ? parseInt(e.target.value) : undefined } })}
                          placeholder="0" className="w-10 bg-muted border border-border px-1 py-0.5 text-[10px] text-center" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ranged */}
                <div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={upgradeForm.isRanged}
                      onChange={(e) => updateUF({ isRanged: e.target.checked })}
                      className="w-4 h-4" />
                    <span className="text-muted-foreground">Ranged Weapon</span>
                  </label>
                  {upgradeForm.isRanged && (
                    <div className="flex gap-2 mt-1">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Normal Range (ft)</label>
                        <input type="number" min={0} value={upgradeForm.normalRange ?? ""}
                          onChange={(e) => updateUF({ normalRange: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-16 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Max Range (ft)</label>
                        <input type="number" min={0} value={upgradeForm.maxRange ?? ""}
                          onChange={(e) => updateUF({ maxRange: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-16 bg-muted border border-border px-1 py-0.5 text-xs text-center" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Special Effects */}
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Special Effects</label>
                  <textarea value={upgradeForm.specialEffect ?? ""}
                    onChange={(e) => updateUF({ specialEffect: e.target.value || undefined })}
                    className="w-full bg-muted border border-border px-2 py-1 text-xs resize-none h-12" />
                </div>

                <button onClick={handleSaveUpgrade}
                  className="w-full py-2 bg-accent text-accent-foreground font-display text-sm rounded hover:bg-accent/90 transition-colors">
                  SAVE UPGRADE
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showDamageTargetModal && pendingDamageRoll && combatState && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <div className="bg-background border-2 border-destructive rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg text-destructive">{pendingDamageRoll.actionName} — Select Target</h3>
              <button onClick={() => { setShowDamageTargetModal(false); setPendingDamageRoll(null); setDamageRollResult(null); }}>
                <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Target selection */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Target:</label>
                <div className="space-y-1">
                  {combatState.combatants.filter(c => c.id !== selected.id).map(c => {
                    const mobId = c.sourceId || c.id;
                    const mob = c.type === 'mob' ? (mobsProp ?? []).find(m => m.id === mobId) : null;
                    const displayHP = c.currentHP ?? mob?.hitPoints;
                    const crawler = c.type === 'crawler' ? crawlers.find(cr => cr.id === c.id) : null;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setDamageTargetId(c.id);
                          setDamageTargetType(c.type);
                        }}
                        className={`w-full text-left px-3 py-2 border rounded text-sm transition-colors ${
                          damageTargetId === c.id
                            ? 'bg-destructive/20 border-destructive text-destructive'
                            : 'bg-muted/30 border-border hover:border-destructive/50'
                        }`}
                      >
                        <span className={c.type === 'crawler' ? 'text-primary' : 'text-destructive'}>{c.name}</span>
                        {mob && displayHP != null && (
                          <span className="text-muted-foreground ml-2">({displayHP} HP)</span>
                        )}
                        {crawler && (
                          <span className="text-muted-foreground ml-2">({crawler.hp}/{crawler.maxHP} HP)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Damage roll */}
              {damageTargetId && (
                <div className="border border-border bg-muted/30 rounded p-3">
                  {damageRollResult === null ? (
                    <button
                      onClick={() => {
                        // Parse and roll damage dice (supports "1d6 + 2d4" format)
                        const diceStr = pendingDamageRoll.dice;
                        const diceParts = diceStr.split(/\s*\+\s*/);
                        let totalRoll = 0;
                        const results: { dice: string; result: number }[] = [];

                        for (const part of diceParts) {
                          const match = part.trim().match(/^(\d+)?d(\d+)$/i);
                          if (match) {
                            const count = parseInt(match[1] || '1');
                            const sides = parseInt(match[2]);
                            let dieTotal = 0;
                            for (let i = 0; i < count; i++) {
                              dieTotal += Math.floor(Math.random() * sides) + 1;
                            }
                            results.push({ dice: `${count}d${sides}`.toUpperCase(), result: dieTotal });
                            totalRoll += dieTotal;
                          } else {
                            // Fallback for simple dice like "d6"
                            const simpleMatch = part.trim().match(/^d(\d+)$/i);
                            const sides = simpleMatch ? parseInt(simpleMatch[1]) : 4;
                            const roll = Math.floor(Math.random() * sides) + 1;
                            results.push({ dice: `D${sides}`, result: roll });
                            totalRoll += roll;
                          }
                        }

                        const totalDmg = totalRoll + pendingDamageRoll.bonus;
                        setDamageRollResult(totalDmg);

                        if (addDiceRoll) {
                          addDiceRoll({
                            id: crypto.randomUUID(),
                            crawlerName: selected.name,
                            crawlerId: selected.id,
                            timestamp: Date.now(),
                            results,
                            total: totalDmg,
                            statRoll: { stat: `${pendingDamageRoll.actionName} (Damage)`, modifier: pendingDamageRoll.bonus, rawRoll: totalRoll },
                          });
                        }
                      }}
                      className="w-full py-3 bg-destructive text-destructive-foreground font-display rounded hover:bg-destructive/90 transition-colors"
                    >
                      ROLL {pendingDamageRoll.dice.toUpperCase()} DAMAGE
                    </button>
                  ) : (
                    <div className="text-center space-y-3">
                      <p className="font-display text-2xl text-destructive">{damageRollResult} DAMAGE</p>
                      <button
                        onClick={async () => {
                          await onApplyCombatDamage?.(damageTargetId, damageTargetType, damageRollResult);
                          setShowDamageTargetModal(false);
                          setPendingDamageRoll(null);
                          setDamageRollResult(null);
                          setDamageTargetId('');
                        }}
                        className="w-full py-2 bg-destructive text-destructive-foreground font-display text-sm rounded hover:bg-destructive/90 transition-colors"
                      >
                        APPLY DAMAGE
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ProfilesView;
