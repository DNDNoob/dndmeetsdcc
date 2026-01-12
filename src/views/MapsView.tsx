import { useState } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { MapPin, Layers, Eye, EyeOff, Edit2, Check, X } from "lucide-react";

interface MapsViewProps {
  maps: string[];
  mapNames?: string[];
  onUpdateMapName?: (index: number, name: string) => void;
  mapVisibility: boolean[];
  onToggleVisibility: (index: number) => void;
  isAdmin: boolean;
}

const MapsView: React.FC<MapsViewProps> = ({ 
  maps, 
  mapNames,
  onUpdateMapName,
  mapVisibility, 
  onToggleVisibility, 
  isAdmin 
}) => {
  const [editingMapIndex, setEditingMapIndex] = useState<number | null>(null);
  const [editingMapName, setEditingMapName] = useState("");

  const startEditingMap = (index: number) => {
    setEditingMapIndex(index);
    setEditingMapName(mapNames?.[index] || `Map ${index + 1}`);
  };

  const saveMapName = (index: number) => {
    if (onUpdateMapName && editingMapName.trim()) {
      onUpdateMapName(index, editingMapName.trim());
    }
    setEditingMapIndex(null);
  };

  const cancelEditing = () => {
    setEditingMapIndex(null);
    setEditingMapName("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      <DungeonCard>
        <h2 className="font-display text-2xl text-primary text-glow-cyan mb-6 flex items-center gap-3">
          <MapPin className="w-6 h-6" />
          WORLD MAPS
        </h2>

        <div className="space-y-6">
          {maps.length > 0 ? (
            maps.map((map, index) => {
              const isVisible = mapVisibility[index] ?? true;
              const canView = isAdmin || isVisible;
              const displayName = mapNames?.[index] || `Map ${index + 1}`;
              const isEditing = editingMapIndex === index;

              return (
                <div
                  key={index}
                  className={`border-2 ${
                    isVisible ? "border-primary" : "border-muted"
                  } bg-background/50 p-4`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingMapName}
                            onChange={(e) => setEditingMapName(e.target.value)}
                            className="flex-1 bg-muted border border-primary px-2 py-1 font-display text-lg"
                            autoFocus
                          />
                          <DungeonButton
                            variant="admin"
                            size="sm"
                            onClick={() => saveMapName(index)}
                          >
                            <Check className="w-4 h-4" />
                          </DungeonButton>
                          <DungeonButton
                            variant="default"
                            size="sm"
                            onClick={cancelEditing}
                          >
                            <X className="w-4 h-4" />
                          </DungeonButton>
                        </div>
                      ) : (
                        <h3 className="font-display text-lg text-primary flex items-center gap-2">
                          {displayName}
                          {isAdmin && (
                            <button
                              onClick={() => startEditingMap(index)}
                              className="p-1 hover:bg-primary/10 rounded transition-colors"
                              title="Edit map name"
                            >
                              <Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </button>
                          )}
                        </h3>
                      )}
                    </div>

                    {!isEditing && isAdmin && (
                      <DungeonButton
                        variant={isVisible ? "default" : "ghost"}
                        size="sm"
                        onClick={() => onToggleVisibility(index)}
                      >
                        {isVisible ? (
                          <>
                            <Eye className="w-4 h-4 mr-2" /> Visible to All
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4 mr-2" /> Hidden (Admin Only)
                          </>
                        )}
                      </DungeonButton>
                    )}
                    {!isAdmin && !isVisible && (
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-muted">
                        Hidden by DM
                      </span>
                    )}
                  </div>

                  {canView ? (
                    <img
                      src={map}
                      alt={displayName}
                      className="w-full border border-border"
                    />
                  ) : (
                    <div className="bg-muted/50 border border-border p-12 text-center">
                      <EyeOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        This map is hidden by the Dungeon Master
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <>
              <div className="border border-dashed border-primary/50 bg-background/50 p-8 text-center">
                <Layers className="w-12 h-12 text-primary/50 mx-auto mb-4" />
                <h3 className="font-display text-lg text-primary mb-2">FLOOR 1 - THE DESCENT</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  [ Upload map image to display here ]
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Tip: You can add custom map images in the Dungeon AI console
                </p>
              </div>

              <div className="border border-dashed border-primary/50 bg-background/50 p-8 text-center">
                <MapPin className="w-12 h-12 text-primary/50 mx-auto mb-4" />
                <h3 className="font-display text-lg text-primary mb-2">TOPEKA OVERWORLD</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  [ Upload overworld map to display here ]
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Current Location: Unknown
                </p>
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="mt-8 border-t border-border pt-6">
          <h4 className="text-sm text-muted-foreground mb-3">MAP LEGEND</h4>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full" />
              <span>Safe Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-destructive rounded-full" />
              <span>Danger Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-accent rounded-full" />
              <span>Loot Room</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted-foreground rounded-full" />
              <span>Unexplored</span>
            </div>
          </div>
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default MapsView;
