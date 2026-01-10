import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Mob } from "@/lib/gameData";
import { Brain, Upload, Plus, Trash2, Map, Skull, Image, Save, Edit2, X } from "lucide-react";

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
    weaknesses: "",
    strengths: "",
    hitPoints: 50,
  });
  const mobImageRef = useRef<HTMLInputElement>(null);
  const mapImageRef = useRef<HTMLInputElement>(null);
  const [editingMobId, setEditingMobId] = useState<string | null>(null);
  const [editedMobData, setEditedMobData] = useState<Mob | null>(null);

  const handleAddMob = () => {
    if (!newMob.name?.trim()) return;
    const mob: Mob = {
      id: Date.now().toString(),
      name: newMob.name,
      level: newMob.level || 1,
      type: newMob.type || "normal",
      description: newMob.description || "",
      encountered: false,
      hidden: true,
      image: newMob.image,
      weaknesses: newMob.weaknesses,
      strengths: newMob.strengths,
      hitPoints: newMob.hitPoints || 50,
      hideHitPoints: false,
      hideWeaknesses: false,
      hideStrengths: false,
    };
    onUpdateMobs([...mobs, mob]);
    setNewMob({ name: "", level: 1, type: "normal", description: "", weaknesses: "", strengths: "", hitPoints: 50 });
  };

  const handleDeleteMob = (id: string) => {
    onUpdateMobs(mobs.filter((m) => m.id !== id));
    if (editingMobId === id) {
      setEditingMobId(null);
    }
  };

  const handleUpdateMob = (id: string, updates: Partial<Mob>) => {
    onUpdateMobs(mobs.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const handleToggleEncountered = (id: string, currentEncountered: boolean) => {
    // When marking as encountered, automatically reveal (hidden=false)
    // When marking as unencountered, automatically hide (hidden=true)
    handleUpdateMob(id, { 
      encountered: !currentEncountered,
      hidden: currentEncountered // if was encountered, now hide it; if was unencountered, now reveal it
    });
  };

  const handleStartEdit = (mob: Mob) => {
    setEditingMobId(mob.id);
    setEditedMobData(mob);
  };

  const handleCancelEdit = () => {
    setEditingMobId(null);
    setEditedMobData(null);
  };

  const handleSaveEdit = (mobId: string, editedMob: Partial<Mob>) => {
    handleUpdateMob(mobId, editedMob);
    setEditingMobId(null);
    setEditedMobData(null);
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
        <div className="flex gap-2 mb-6 border-b border-border pb-4 overflow-x-auto">
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
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                    <input
                      type="text"
                      placeholder="Mob name"
                      value={newMob.name || ""}
                      onChange={(e) => setNewMob({ ...newMob, name: e.target.value })}
                      className="w-full bg-muted border border-border px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Level</label>
                      <input
                        type="number"
                        placeholder="Level"
                        value={newMob.level || ""}
                        onChange={(e) => setNewMob({ ...newMob, level: parseInt(e.target.value) || 1 })}
                        className="w-full bg-muted border border-border px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Hit Points</label>
                      <input
                        type="number"
                        placeholder="HP"
                        value={newMob.hitPoints || ""}
                        onChange={(e) => setNewMob({ ...newMob, hitPoints: parseInt(e.target.value) || 50 })}
                        className="w-full bg-muted border border-border px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                      <select
                        value={newMob.type || "normal"}
                        onChange={(e) => setNewMob({ ...newMob, type: e.target.value as "normal" | "boss" | "npc" })}
                        className="w-full bg-muted border border-border px-3 py-2"
                      >
                        <option value="normal">Normal</option>
                        <option value="boss">Boss</option>
                        <option value="npc">NPC</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                    <textarea
                      placeholder="Description"
                      value={newMob.description || ""}
                      onChange={(e) => setNewMob({ ...newMob, description: e.target.value })}
                      className="w-full bg-muted border border-border px-3 py-2 min-h-[60px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Weaknesses</label>
                    <input
                      type="text"
                      placeholder="e.g., fire, water"
                      value={newMob.weaknesses || ""}
                      onChange={(e) => setNewMob({ ...newMob, weaknesses: e.target.value })}
                      className="w-full bg-muted border border-border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Strengths</label>
                    <input
                      type="text"
                      placeholder="e.g., armor, speed"
                      value={newMob.strengths || ""}
                      onChange={(e) => setNewMob({ ...newMob, strengths: e.target.value })}
                      className="w-full bg-muted border border-border px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center border border-dashed border-border p-4">
                  <label className="text-xs text-muted-foreground mb-2">Mob Image</label>
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
              {mobs.map((mob) => {
                const isEditing = editingMobId === mob.id;
                const editedMob = (isEditing && editedMobData) ? editedMobData : mob;

                return (
                  <div
                    key={mob.id}
                    className={`border p-3 ${
                      mob.type === "boss" ? "border-destructive bg-destructive/5" : "border-border bg-muted/20"
                    }`}
                  >
                    {isEditing ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                            <input
                              type="text"
                              value={editedMob.name}
                              onChange={(e) => setEditedMobData(prev => prev ? { ...prev, name: e.target.value } : prev)}
                              className="w-full bg-muted border border-border px-2 py-1 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Level</label>
                              <input
                                type="number"
                                value={editedMob.level}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, level: parseInt(e.target.value) || 1 } : prev)}
                                className="w-full bg-muted border border-border px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">HP</label>
                              <input
                                type="number"
                                value={editedMob.hitPoints || 50}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, hitPoints: parseInt(e.target.value) || 50 } : prev)}
                                className="w-full bg-muted border border-border px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                              <select
                                value={editedMob.type}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, type: e.target.value as "normal" | "boss" | "npc" } : prev)}
                                className="w-full bg-muted border border-border px-2 py-1 text-sm"
                              >
                                <option value="normal">Normal</option>
                                <option value="boss">Boss</option>
                                <option value="npc">NPC</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                          <textarea
                            value={editedMob.description}
                            onChange={(e) => setEditedMobData(prev => prev ? { ...prev, description: e.target.value } : prev)}
                            className="w-full bg-muted border border-border px-2 py-1 text-sm min-h-[50px]"
                          />
                        </div>
                        
                        {/* Image Upload */}
                        <div className="flex items-center gap-3 bg-muted/40 border border-border p-2 rounded">
                          {editedMob.image && (
                            <img src={editedMob.image} alt="Mob preview" className="w-16 h-16 object-cover" />
                          )}
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Mob Image</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    setEditedMobData(prev => prev ? { ...prev, image: reader.result as string } : prev);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="text-xs w-full"
                            />
                          </div>
                          {editedMob.image && (
                            <DungeonButton
                              variant="default"
                              size="sm"
                              onClick={() => setEditedMobData(prev => prev ? { ...prev, image: undefined } : prev)}
                            >
                              <X className="w-3 h-3" />
                            </DungeonButton>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Weaknesses</label>
                            <input
                              type="text"
                              value={editedMob.weaknesses || ""}
                              onChange={(e) => setEditedMobData(prev => prev ? { ...prev, weaknesses: e.target.value } : prev)}
                              className="w-full bg-muted border border-border px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Strengths</label>
                            <input
                              type="text"
                              value={editedMob.strengths || ""}
                              onChange={(e) => setEditedMobData(prev => prev ? { ...prev, strengths: e.target.value } : prev)}
                              className="w-full bg-muted border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </div>

                        {/* Hide Detail Toggles */}
                        <div className="bg-muted/40 border border-border p-2 mt-3 rounded">
                          <p className="text-xs text-muted-foreground font-semibold mb-2">Hide Details From Players:</p>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={editedMob.hideHitPoints || false}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, hideHitPoints: e.target.checked } : prev)}
                                className="w-4 h-4"
                              />
                              <span>Hide HP</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={editedMob.hideWeaknesses || false}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, hideWeaknesses: e.target.checked } : prev)}
                                className="w-4 h-4"
                              />
                              <span>Hide Weaknesses</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={editedMob.hideStrengths || false}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, hideStrengths: e.target.checked } : prev)}
                                className="w-4 h-4"
                              />
                              <span>Hide Strengths</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <DungeonButton
                            variant="admin"
                            size="sm"
                            onClick={() => handleSaveEdit(mob.id, editedMob)}
                          >
                            <Save className="w-4 h-4 mr-1" /> Save
                          </DungeonButton>
                          <DungeonButton
                            variant="default"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </DungeonButton>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="flex flex-wrap items-start gap-4">
                        {mob.image ? (
                          <img src={mob.image} alt={mob.name} className="w-16 h-16 object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 bg-muted flex items-center justify-center flex-shrink-0">
                            <Skull className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-display text-foreground">{mob.name}</span>
                            <span className="text-xs text-muted-foreground">Lvl {mob.level}</span>
                            {mob.hitPoints !== undefined && (
                              <span className="text-xs text-muted-foreground">HP: {mob.hitPoints}</span>
                            )}
                            {mob.type === "boss" && (
                              <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5">BOSS</span>
                            )}
                            <span
                              className={`text-xs px-2 py-0.5 ${
                                mob.encountered ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {mob.encountered ? "ENCOUNTERED" : "UNENCOUNTERED"}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">{mob.description}</p>
                          {mob.weaknesses && (
                            <p className="text-xs text-muted-foreground">
                              <span className="text-destructive">Weaknesses:</span> {mob.weaknesses}
                            </p>
                          )}
                          {mob.strengths && (
                            <p className="text-xs text-muted-foreground">
                              <span className="text-primary">Strengths:</span> {mob.strengths}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                          <DungeonButton
                            variant="default"
                            size="sm"
                            onClick={() => handleToggleEncountered(mob.id, mob.encountered)}
                          >
                            {mob.encountered ? "Mark Unencountered" : "Mark Encountered"}
                          </DungeonButton>
                          <DungeonButton
                            variant="default"
                            size="sm"
                            onClick={() => handleStartEdit(mob)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </DungeonButton>
                          <DungeonButton variant="danger" size="sm" onClick={() => handleDeleteMob(mob.id)}>
                            <Trash2 className="w-4 h-4" />
                          </DungeonButton>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
            <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4">
              {maps.map((map, index) => (
                <div key={index} className="border border-border p-2 relative group w-full">
                  <img src={map} alt={`Map ${index + 1}`} className="w-full h-auto object-contain max-h-[40vh]" />
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
