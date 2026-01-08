import { useState } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { HealthBar } from "@/components/ui/HealthBar";
import { Crawler } from "@/lib/gameData";
import { Shield, Zap, Heart, Brain, Eye, Sparkles, Save } from "lucide-react";

interface ProfilesViewProps {
  crawlers: Crawler[];
  onUpdateCrawler: (id: string, updates: Partial<Crawler>) => void;
}

const ProfilesView: React.FC<ProfilesViewProps> = ({ crawlers, onUpdateCrawler }) => {
  const [selectedId, setSelectedId] = useState(crawlers[0]?.id || "");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Crawler>>({});

  const selected = crawlers.find((c) => c.id === selectedId) || crawlers[0];

  const handleEdit = () => {
    if (selected) {
      setEditData({ ...selected });
      setEditMode(true);
    }
  };

  const handleSave = () => {
    if (selected && editData) {
      onUpdateCrawler(selected.id, editData);
      setEditMode(false);
    }
  };

  if (!selected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      {/* Header controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
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

      <DungeonCard className="min-h-[400px]">
        {/* Character header */}
        <div className="mb-6">
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
          <p className="text-muted-foreground">
            {selected.race} | {selected.job} | Level {selected.level}
          </p>
        </div>

        {/* HP Bar */}
        <div className="mb-8">
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

        {/* Stats grid */}
        <div className="grid md:grid-cols-2 gap-8">
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
                { key: "wis", label: "WIS", icon: Eye },
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
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default ProfilesView;
