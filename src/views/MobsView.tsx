import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { Mob, getMobKind, isBossMob } from "@/lib/gameData";
import { Skull, Crown, HelpCircle, Heart, Shield, Zap, User } from "lucide-react";

interface MobsViewProps {
  mobs: Mob[];
}

type Section = "creature" | "boss" | "character";

const SECTION_STYLE: Record<Section, { label: string; icon: typeof Skull; text: string; badge: string; border: string; empty: string }> = {
  creature: {
    label: "CREATURES",
    icon: Skull,
    text: "text-destructive",
    badge: "bg-destructive/20 text-destructive",
    border: "border-destructive/50 bg-destructive/5",
    empty: "No creatures encountered yet.",
  },
  boss: {
    label: "BOSSES",
    icon: Crown,
    text: "text-accent text-glow-gold",
    badge: "bg-accent/20 text-accent",
    border: "border-accent/50 bg-accent/5",
    empty: "No bosses encountered yet.",
  },
  character: {
    label: "CHARACTERS",
    icon: User,
    text: "text-green-500",
    badge: "bg-green-500/20 text-green-500",
    border: "border-green-500/50 bg-green-500/5",
    empty: "No characters met yet.",
  },
};

const sectionOf = (mob: Mob): Section => (isBossMob(mob) ? "boss" : getMobKind(mob));

const MobsView: React.FC<MobsViewProps> = ({ mobs }) => {
  // Filter out hidden mobs for player view
  const visibleMobs = mobs.filter((mob) => !mob.hidden);
  const hiddenCount = mobs.filter((mob) => mob.hidden).length;
  const sections: Section[] = ["creature", "boss", "character"];
  const bySection = (section: Section) => visibleMobs.filter((mob) => sectionOf(mob) === section);
  const speciesName = (mob: Mob) => {
    const species = mob.speciesId ? mobs.find((m) => m.id === mob.speciesId) : undefined;
    return species && !species.hidden ? species.name : null;
  };

  const renderMob = (mob: Mob) => {
    const style = SECTION_STYLE[sectionOf(mob)];
    const Icon = style.icon;
    const species = getMobKind(mob) === "character" ? speciesName(mob) : null;
    return (
      <motion.div
        key={mob.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`border p-4 ${mob.encountered ? style.border : "border-muted bg-muted/20"}`}
      >
        <div className="flex items-start gap-4">
          {/* Mob Image with kind label underneath */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            {mob.image && (
              <img
                src={mob.image}
                alt={mob.name}
                className="w-20 h-20 sm:w-24 sm:h-24 object-cover border border-border"
              />
            )}
            {isBossMob(mob) && getMobKind(mob) === "character" && (
              <span className={`text-xs px-2 py-0.5 font-bold ${SECTION_STYLE.character.badge}`}>CHARACTER</span>
            )}
          </div>

          {/* Mob Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-5 h-5 shrink-0 ${style.text}`} />
                <div className="min-w-0">
                  <h3 className={`font-display text-lg ${style.text}`}>{mob.name}</h3>
                  {species && <p className="text-xs text-muted-foreground">A {species}</p>}
                </div>
              </div>
              <span className="text-xs bg-muted px-2 py-1 text-muted-foreground shrink-0">
                Level {mob.level}
              </span>
            </div>

            {mob.encountered ? (
              <>
                {mob.description && <p className="text-muted-foreground text-sm mb-3">{mob.description}</p>}

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
    );
  };

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

        <div className="space-y-8">
          {sections.map((section) => {
            const style = SECTION_STYLE[section];
            const Icon = style.icon;
            const list = bySection(section);
            return (
              <section key={section}>
                <h3 className={`font-display text-lg mb-3 flex items-center gap-2 ${style.text}`}>
                  <Icon className="w-5 h-5" />
                  {style.label}
                  <span className="text-xs text-muted-foreground font-normal">({list.length})</span>
                </h3>
                {list.length > 0 ? (
                  <div className="space-y-4">{list.map(renderMob)}</div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{style.empty}</p>
                )}
              </section>
            );
          })}
        </div>

        {/* Stats */}
        <div className="mt-8 border-t border-border pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {sections.map((section) => (
            <div key={section}>
              <p className={`text-2xl font-display ${SECTION_STYLE[section].text}`}>
                {bySection(section).filter((m) => m.encountered).length}
              </p>
              <p className="text-xs text-muted-foreground">
                {section === "creature" ? "Creatures" : section === "boss" ? "Bosses" : "Characters"}
              </p>
            </div>
          ))}
          <div>
            <p className="text-2xl font-display text-muted-foreground">{hiddenCount}</p>
            <p className="text-xs text-muted-foreground">Undiscovered</p>
          </div>
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default MobsView;
