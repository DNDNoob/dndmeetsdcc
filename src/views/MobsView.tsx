import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { Mob } from "@/lib/gameData";
import { Skull, Crown, HelpCircle, Heart, Shield, Zap, User } from "lucide-react";

interface MobsViewProps {
  mobs: Mob[];
}

const MobsView: React.FC<MobsViewProps> = ({ mobs }) => {
  // Filter out hidden mobs for player view
  const visibleMobs = mobs.filter((mob) => !mob.hidden);
  const hiddenCount = mobs.filter((mob) => mob.hidden).length;
  const revealedBosses = mobs.filter((mob) => mob.type === "boss" && !mob.hidden).length;

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
          {visibleMobs.map((mob) => (
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
              <div className="flex items-start gap-4">
                {/* Mob Image with type label underneath */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                  {mob.image && (
                    <img
                      src={mob.image}
                      alt={mob.name}
                      className="w-24 h-24 object-cover border border-border"
                    />
                  )}
                  {mob.type === "boss" && (
                    <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 font-bold">
                      BOSS
                    </span>
                  )}
                  {mob.type === "npc" && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 font-bold">
                      NPC
                    </span>
                  )}
                  {mob.type === "normal" && (
                    <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 font-bold">
                      NORMAL
                    </span>
                  )}
                </div>

                {/* Mob Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {mob.type === "boss" ? (
                        <Crown className="w-5 h-5 text-accent" />
                      ) : mob.type === "npc" ? (
                        <User className="w-5 h-5 text-primary" />
                      ) : (
                        <Skull className="w-5 h-5 text-destructive" />
                      )}
                      <h3
                        className={`font-display text-lg ${
                          mob.type === "boss"
                            ? "text-accent text-glow-gold"
                            : mob.type === "npc"
                            ? "text-green-500"
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
                    <>
                      <p className="text-muted-foreground text-sm mb-3">{mob.description}</p>
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        {mob.hitPoints !== undefined && (
                          <div className="bg-muted/50 p-2 border border-border">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                              <Heart className="w-3 h-3" />
                              <span>Hit Points</span>
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                              {mob.hideHitPoints ? "???" : `${mob.hitPoints} HP`}
                            </p>
                          </div>
                        )}
                        {mob.weaknesses && (
                          <div className="bg-muted/50 p-2 border border-border">
                            <div className="flex items-center gap-2 text-xs text-destructive mb-1">
                              <Zap className="w-3 h-3" />
                              <span>Weaknesses</span>
                            </div>
                            <p className="text-sm text-foreground">
                              {mob.hideWeaknesses ? "???" : mob.weaknesses}
                            </p>
                          </div>
                        )}
                        {mob.strengths && (
                          <div className="bg-muted/50 p-2 border border-border">
                            <div className="flex items-center gap-2 text-xs text-primary mb-1">
                              <Shield className="w-3 h-3" />
                              <span>Strengths</span>
                            </div>
                            <p className="text-sm text-foreground">
                              {mob.hideStrengths ? "???" : mob.strengths}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <HelpCircle className="w-4 h-4" />
                      <span className="italic">Status: Unencountered</span>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-8 border-t border-border pt-6 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-display text-destructive">
              {visibleMobs.filter((m) => m.encountered).length}
            </p>
            <p className="text-xs text-muted-foreground">Encountered</p>
          </div>
          <div>
            <p className="text-2xl font-display text-muted-foreground">
              {hiddenCount}
            </p>
            <p className="text-xs text-muted-foreground">Undiscovered Mobs</p>
          </div>
          <div>
            <p className="text-2xl font-display text-accent">
              {revealedBosses}
            </p>
            <p className="text-xs text-muted-foreground">Encountered Bosses</p>
          </div>
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default MobsView;
