import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Mob } from "@/lib/gameData";
import { Brain, Upload, Plus, Trash2, Map, Skull, Image, Save } from "lucide-react";

interface DungeonAIViewProps {
  mobs: Mob[];
  onUpdateMobs: (mobs: Mob[]) => void;
  maps: string[];
  onUpdateMaps: (maps: string[]) => void;
}

const DungeonAIView: React.FC<DungeonAIViewProps> = ({
  mobs,
  onUpdateMobs,
  maps,
  onUpdateMaps,
}) => {
  const [activeTab, setActiveTab] = useState<"mobs" | "maps">("mobs");
  const [newMob, setNewMob] = useState<Partial<Mob>>({
    name: "",
    level: 1,
    type: "normal",
    description: "",
  });
  const mobImageRef = useRef<HTMLInputElement>(null);
  const mapImageRef = useRef<HTMLInputElement>(null);
  const [editingMobId, setEditingMobId] = useState<string | null>(null);

  const handleAddMob = () => {
    if (!newMob.name?.trim()) return;
    const mob: Mob = {
      id: Date.now().toString(),
      name: newMob.name,
      level: newMob.level || 1,
      type: newMob.type || "normal",
      description: newMob.description || "",
      encountered: false,
      image: newMob.image,
    };
    onUpdateMobs([...mobs, mob]);
    setNewMob({ name: "", level: 1, type: "normal", description: "" });
  };

  const handleDeleteMob = (id: string) => {
    onUpdateMobs(mobs.filter((m) => m.id !== id));
  };

  const handleUpdateMob = (id: string, updates: Partial<Mob>) => {
    onUpdateMobs(mobs.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const handleMobImageUpload = (e: React.ChangeEvent<HTMLInputElement>, mobId?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        if (mobId) {
          handleUpdateMob(mobId, { image: base64 });
        } else {
          setNewMob({ ...newMob, image: base64 });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        onUpdateMaps([...maps, base64]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteMap = (index: number) => {
    onUpdateMaps(maps.filter((_, i) => i !== index));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      <DungeonCard glowColor="gold">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="w-8 h-8 text-accent" />
          <h2 className="font-display text-2xl text-accent text-glow-gold">
            DUNGEON AI - DM CONSOLE
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border pb-4">
          <DungeonButton
            variant={activeTab === "mobs" ? "default" : "menu"}
            size="sm"
            onClick={() => setActiveTab("mobs")}
          >
            <Skull className="w-4 h-4 mr-2" /> Mob Manager
          </DungeonButton>
          <DungeonButton
            variant={activeTab === "maps" ? "default" : "menu"}
            size="sm"
            onClick={() => setActiveTab("maps")}
          >
            <Map className="w-4 h-4 mr-2" /> Map Manager
          </DungeonButton>
        </div>

        {activeTab === "mobs" && (
          <div className="space-y-6">
            {/* Add new mob form */}
            <div className="bg-muted/30 border border-border p-4">
              <h3 className="font-display text-primary text-lg mb-4">Add New Mob</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Mob name"
                    value={newMob.name || ""}
                    onChange={(e) => setNewMob({ ...newMob, name: e.target.value })}
                    className="w-full bg-muted border border-border px-3 py-2"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Level"
                      value={newMob.level || ""}
                      onChange={(e) => setNewMob({ ...newMob, level: parseInt(e.target.value) || 1 })}
                      className="w-20 bg-muted border border-border px-3 py-2"
                    />
                    <select
                      value={newMob.type || "normal"}
                      onChange={(e) => setNewMob({ ...newMob, type: e.target.value as "normal" | "boss" })}
                      className="bg-muted border border-border px-3 py-2"
                    >
                      <option value="normal">Normal</option>
                      <option value="boss">Boss</option>
                    </select>
                  </div>
                  <textarea
                    placeholder="Description"
                    value={newMob.description || ""}
                    onChange={(e) => setNewMob({ ...newMob, description: e.target.value })}
                    className="w-full bg-muted border border-border px-3 py-2 min-h-[80px]"
                  />
                </div>
                <div className="flex flex-col items-center justify-center border border-dashed border-border p-4">
                  {newMob.image ? (
                    <img src={newMob.image} alt="Mob preview" className="max-h-32 mb-2" />
                  ) : (
                    <Image className="w-12 h-12 text-muted-foreground mb-2" />
                  )}
                  <input
                    ref={mobImageRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleMobImageUpload(e)}
                    className="hidden"
                  />
                  <DungeonButton
                    variant="default"
                    size="sm"
                    onClick={() => mobImageRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-1" /> Upload Image
                  </DungeonButton>
                </div>
              </div>
              <div className="mt-4">
                <DungeonButton variant="admin" onClick={handleAddMob}>
                  <Plus className="w-4 h-4 mr-2" /> Add Mob
                </DungeonButton>
              </div>
            </div>

            {/* Existing mobs list */}
            <div className="space-y-3">
              <h3 className="font-display text-primary text-lg">Existing Mobs</h3>
              {mobs.map((mob) => (
                <div
                  key={mob.id}
                  className={`border p-3 flex items-center gap-4 ${
                    mob.type === "boss" ? "border-destructive bg-destructive/5" : "border-border bg-muted/20"
                  }`}
                >
                  {mob.image ? (
                    <img src={mob.image} alt={mob.name} className="w-16 h-16 object-cover" />
                  ) : (
                    <div className="w-16 h-16 bg-muted flex items-center justify-center">
                      <Skull className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-foreground">{mob.name}</span>
                      <span className="text-xs text-muted-foreground">Lvl {mob.level}</span>
                      {mob.type === "boss" && (
                        <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5">BOSS</span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 ${
                          mob.encountered ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {mob.encountered ? "ENCOUNTERED" : "HIDDEN"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{mob.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <DungeonButton
                      variant="default"
                      size="sm"
                      onClick={() => handleUpdateMob(mob.id, { encountered: !mob.encountered })}
                    >
                      {mob.encountered ? "Hide" : "Reveal"}
                    </DungeonButton>
                    <DungeonButton variant="danger" size="sm" onClick={() => handleDeleteMob(mob.id)}>
                      <Trash2 className="w-4 h-4" />
                    </DungeonButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "maps" && (
          <div className="space-y-6">
            {/* Upload map */}
            <div className="bg-muted/30 border border-border p-4">
              <h3 className="font-display text-primary text-lg mb-4">Upload Map</h3>
              <input
                ref={mapImageRef}
                type="file"
                accept="image/*"
                onChange={handleMapUpload}
                className="hidden"
              />
              <DungeonButton variant="admin" onClick={() => mapImageRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Upload Map Image
              </DungeonButton>
            </div>

            {/* Maps grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {maps.map((map, index) => (
                <div key={index} className="border border-border p-2 relative group">
                  <img src={map} alt={`Map ${index + 1}`} className="w-full h-48 object-cover" />
                  <DungeonButton
                    variant="danger"
                    size="sm"
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteMap(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </DungeonButton>
                </div>
              ))}
              {maps.length === 0 && (
                <p className="text-muted-foreground text-sm col-span-2 text-center py-8">
                  No maps uploaded yet. Upload your first map!
                </p>
              )}
            </div>
          </div>
        )}
      </DungeonCard>
    </motion.div>
  );
};

export default DungeonAIView;
