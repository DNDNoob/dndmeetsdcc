import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { HealthBar } from "@/components/ui/HealthBar";
import { Crawler, InventoryItem, createEmptyCrawler } from "@/lib/gameData";
import { Shield, Zap, Heart, Brain, Sparkles, Save, Plus, Trash2, Coins, Sword, User, Upload } from "lucide-react";

interface ProfilesViewProps {
  crawlers: Crawler[];
  onUpdateCrawler: (id: string, updates: Partial<Crawler>) => void;
  onAddCrawler: (crawler: Crawler) => void;
  onDeleteCrawler: (id: string) => void;
  getCrawlerInventory: (crawlerId: string) => InventoryItem[];
  partyGold: number;
}

const ProfilesView: React.FC<ProfilesViewProps> = ({ 
  crawlers, 
  onUpdateCrawler, 
  onAddCrawler,
  onDeleteCrawler,
  getCrawlerInventory,
  partyGold,
}) => {
  const [selectedId, setSelectedId] = useState(crawlers[0]?.id || "");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Crawler>>({});
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

        // If image is small enough, use it directly
        if (base64.length <= MAX_AVATAR_SIZE) {
          if (editMode) {
            setEditData({ ...editData, avatar: base64 });
          } else {
            onUpdateCrawler(selected.id, { avatar: base64 });
          }
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

          if (editMode) {
            setEditData({ ...editData, avatar: resizedBase64 });
          } else {
            onUpdateCrawler(selected.id, { avatar: resizedBase64 });
          }
        };

        img.src = base64;
      };
      reader.readAsDataURL(file);
    }
  };

  if (!selected) return null;

  const currentAvatar = editMode ? (editData.avatar ?? selected.avatar) : selected.avatar;
  const currentGold = editMode ? (editData.gold ?? selected.gold ?? 0) : (selected.gold ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
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

      <DungeonCard className="min-h-[400px]">
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
          <div className="flex-1">
            <h1 className="font-display text-3xl md:text-4xl text-primary text-glow-cyan mb-1">
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
              <div className="flex gap-2 mt-2">
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
              <p className="text-muted-foreground">
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
          <HealthBar
            current={editMode ? (editData.hp ?? selected.hp) : selected.hp}
            max={editMode ? (editData.maxHP ?? selected.maxHP) : selected.maxHP}
            label={`HP: ${editMode ? (editData.hp ?? selected.hp) : selected.hp}/${editMode ? (editData.maxHP ?? selected.maxHP) : selected.maxHP}`}
          />
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
          <HealthBar
            current={editMode ? (editData.mana ?? selected.mana) : selected.mana}
            max={editMode ? (editData.maxMana ?? selected.maxMana) : selected.maxMana}
            label={`Mana: ${editMode ? (editData.mana ?? selected.mana) : selected.mana}/${editMode ? (editData.maxMana ?? selected.maxMana) : selected.maxMana}`}
            variant="mana"
          />
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

        {/* Stats, Achievements, and Inventory grid */}
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-display text-primary text-lg mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" /> STATS
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { key: "str", label: "STR", icon: Zap },
                { key: "dex", label: "DEX", icon: Zap },
                { key: "con", label: "CON", icon: Heart },
                { key: "int", label: "INT", icon: Brain },
                { key: "cha", label: "CHA", icon: Sparkles },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between bg-muted/50 px-3 py-2">
                  <span className="text-muted-foreground">{label}</span>
                  {editMode ? (
                    <input
                      type="number"
                      value={(editData as any)[key] ?? (selected as any)[key]}
                      onChange={(e) =>
                        setEditData({ ...editData, [key]: parseInt(e.target.value) || 0 })
                      }
                      className="bg-transparent border-b border-primary w-12 text-right"
                    />
                  ) : (
                    <span className="text-foreground font-bold">{(selected as any)[key]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-display text-accent text-lg mb-4 flex items-center gap-2 text-glow-gold">
              <Sparkles className="w-5 h-5" /> ACHIEVEMENTS
            </h3>
            {editMode ? (
              <textarea
                value={editData.achievements || ""}
                onChange={(e) => setEditData({ ...editData, achievements: e.target.value })}
                className="w-full bg-muted border border-border p-3 min-h-[100px] text-sm"
                placeholder="Enter achievements..."
              />
            ) : (
              <p className="text-accent text-sm leading-relaxed">{selected.achievements}</p>
            )}
          </div>

          {/* Inventory section */}
          <div>
            <h3 className="font-display text-primary text-lg mb-4 flex items-center gap-2">
              <Sword className="w-5 h-5" /> INVENTORY
            </h3>
            {inventory.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">No items</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {inventory.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 bg-muted/50 px-3 py-2">
                    <Sword className="w-3 h-3 text-primary/60" />
                    <span className="text-foreground">{item.name}</span>
                    {item.equipped && (
                      <span className="text-xs bg-primary/20 text-primary px-1 py-0.5 ml-auto">E</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default ProfilesView;
