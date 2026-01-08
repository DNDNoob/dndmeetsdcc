import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { Mob } from "@/lib/gameData";
import { Skull, Crown, HelpCircle } from "lucide-react";

interface MobsViewProps {
  mobs: Mob[];
}

const MobsView: React.FC<MobsViewProps> = ({ mobs }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      <DungeonCard glowColor="red">
        <h2 className="font-display text-2xl text-destructive text-glow-red mb-6 flex items-center gap-3">
          <Skull className="w-6 h-6" />
          ENCOUNTERED MOBS
        </h2>

        <div className="space-y-4">
          {mobs.map((mob) => (
            <motion.div
              key={mob.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`border p-4 ${
                mob.encountered
                  ? "border-destructive/50 bg-destructive/5"
                  : "border-muted bg-muted/20"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {mob.type === "boss" ? (
                    <Crown className="w-5 h-5 text-accent" />
                  ) : (
                    <Skull className="w-5 h-5 text-destructive" />
                  )}
                  <h3
                    className={`font-display text-lg ${
                      mob.type === "boss"
                        ? "text-accent text-glow-gold"
                        : "text-destructive"
                    }`}
                  >
                    {mob.name}
                  </h3>
                </div>
                <span className="text-xs bg-muted px-2 py-1 text-muted-foreground">
                  Level {mob.level}
                </span>
              </div>

              {mob.encountered ? (
                <p className="text-muted-foreground text-sm pl-8">{mob.description}</p>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground text-sm pl-8">
                  <HelpCircle className="w-4 h-4" />
                  <span className="italic">Status: Unencountered</span>
                </div>
              )}

              {mob.type === "boss" && (
                <div className="mt-3 pl-8">
                  <span className="text-xs bg-accent/20 text-accent px-2 py-1 font-bold">
                    ⚠ BOSS MONSTER
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-8 border-t border-border pt-6 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-display text-destructive">
              {mobs.filter((m) => m.encountered).length}
            </p>
            <p className="text-xs text-muted-foreground">Encountered</p>
          </div>
          <div>
            <p className="text-2xl font-display text-muted-foreground">
              {mobs.filter((m) => !m.encountered).length}
            </p>
            <p className="text-xs text-muted-foreground">Unknown</p>
          </div>
          <div>
            <p className="text-2xl font-display text-accent">
              {mobs.filter((m) => m.type === "boss").length}
            </p>
            <p className="text-xs text-muted-foreground">Bosses</p>
          </div>
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default MobsView;
