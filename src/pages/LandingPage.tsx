import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { DungeonButton } from "@/components/ui/DungeonButton";
import {
  Map,
  Swords,
  Users,
  Dice5,
  Shield,
  Sparkles,
  ChevronDown,
  Volume2,
  BookOpen,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Animated section wrapper – fades/slides in when scrolled into view */
/* ------------------------------------------------------------------ */
function RevealSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating particle background                                       */
/* ------------------------------------------------------------------ */
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card used in the showcase grid                             */
/* ------------------------------------------------------------------ */
function FeatureCard({
  icon: Icon,
  title,
  description,
  accentColor = "cyan",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  accentColor?: "cyan" | "red" | "gold";
}) {
  const colorMap = {
    cyan: {
      border: "border-primary/40 hover:border-primary",
      glow: "hover:glow-cyan",
      text: "text-primary",
      iconBg: "bg-primary/10",
    },
    red: {
      border: "border-destructive/40 hover:border-destructive",
      glow: "hover:glow-red",
      text: "text-destructive",
      iconBg: "bg-destructive/10",
    },
    gold: {
      border: "border-accent/40 hover:border-accent",
      glow: "hover:glow-gold",
      text: "text-accent",
      iconBg: "bg-accent/10",
    },
  };

  const c = colorMap[accentColor];

  return (
    <div
      className={`bg-card/80 border-2 ${c.border} ${c.glow} p-6 transition-all duration-300`}
    >
      <div className={`w-12 h-12 ${c.iconBg} flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${c.text}`} />
      </div>
      <h3 className={`font-display text-sm tracking-wider ${c.text} mb-2`}>
        {title}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Landing Page                                                  */
/* ------------------------------------------------------------------ */
const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, openAuthModal } = useAuth();

  // If already authenticated, redirect to the app (runs silently in the background)
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/app", { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  const handleCTA = () => {
    openAuthModal();
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
        <ParticleField />

        {/* Central glowing orb */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative mb-10"
        >
          <div className="w-28 h-28 rounded-full bg-gradient-radial from-destructive to-transparent animate-pulse-glow" />
          <div className="absolute inset-0 w-28 h-28 rounded-full bg-destructive/30 blur-xl" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="font-display text-5xl md:text-7xl text-primary text-glow-cyan tracking-widest mb-4 text-center"
        >
          WORLD DUNGEON
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-muted-foreground text-lg md:text-xl mb-2 tracking-wide text-center max-w-xl"
        >
          Your Tabletop. Digitized.
        </motion.p>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="text-muted-foreground/60 text-sm mb-12 tracking-wide text-center max-w-md"
        >
          The ultimate RPG companion for D&D and Dungeon Crawl Classics.
          <br />
          Create an account to start your adventure.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        >
          <DungeonButton variant="menu" onClick={handleCTA}>
            Enter the Dungeon
          </DungeonButton>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute bottom-10"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-6 h-6 text-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </section>

      {/* ===== LIVING MAPS ===== */}
      <RevealSection className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Map className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl md:text-3xl text-primary text-glow-cyan tracking-wider mb-4">
            LIVING MAPS
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Explore hand-crafted and AI-generated maps with fog of war,
            real-time mob placement, and crawler positioning — all synced
            live across your party.
          </p>

          {/* Stylized map mockup */}
          <div className="mt-12 border-2 border-primary/30 bg-card/60 p-8 max-w-2xl mx-auto relative overflow-hidden">
            <div className="grid grid-cols-8 grid-rows-6 gap-1">
              {Array.from({ length: 48 }).map((_, i) => {
                const isWall = [0,1,2,3,4,5,6,7,8,15,16,23,24,31,32,39,40,41,42,43,44,45,46,47].includes(i);
                const isFog = [9,10,11,17,18,19,25,26,27].includes(i);
                const isMob = i === 29;
                const isCrawler = i === 21;
                return (
                  <div
                    key={i}
                    className={`aspect-square border transition-all duration-500 ${
                      isWall
                        ? "bg-muted-foreground/20 border-muted-foreground/30"
                        : isFog
                          ? "bg-muted/80 border-muted-foreground/10"
                          : isMob
                            ? "bg-destructive/30 border-destructive/50"
                            : isCrawler
                              ? "bg-primary/30 border-primary/50"
                              : "bg-card/40 border-border/30"
                    }`}
                  >
                    {isMob && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      </div>
                    )}
                    {isCrawler && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/40 font-display">
              FOG OF WAR ENABLED
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ===== COMBAT ===== */}
      <RevealSection className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <Swords className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="font-display text-2xl md:text-3xl text-destructive text-glow-red tracking-wider mb-4">
            REAL-TIME COMBAT
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Run encounters with initiative tracking, health bars,
            damage rolls, and turn management — all synchronized
            instantly across your party.
          </p>

          {/* Combat mockup */}
          <div className="mt-12 max-w-lg mx-auto space-y-3">
            {[
              { name: "GRIMTOOTH", hp: 45, maxHp: 60, color: "bg-primary", isPlayer: true },
              { name: "SHADOW ELF", hp: 32, maxHp: 40, color: "bg-primary", isPlayer: true },
              { name: "GOBLIN KING", hp: 28, maxHp: 80, color: "bg-destructive", isPlayer: false },
              { name: "SKELETON", hp: 5, maxHp: 15, color: "bg-destructive", isPlayer: false },
            ].map((entity) => (
              <div
                key={entity.name}
                className="border border-border/50 bg-card/60 px-4 py-3 flex items-center gap-4"
              >
                <div className={`w-2 h-2 rounded-full ${entity.color} ${entity.hp < entity.maxHp * 0.3 ? "animate-pulse" : ""}`} />
                <span className="font-display text-xs tracking-wider text-foreground/80 w-28 text-left">
                  {entity.name}
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${entity.color} transition-all duration-500`}
                    style={{ width: `${(entity.hp / entity.maxHp) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono w-12 text-right">
                  {entity.hp}/{entity.maxHp}
                </span>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ===== FEATURE GRID ===== */}
      <RevealSection className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl text-accent text-glow-gold tracking-wider mb-12 text-center">
            EVERYTHING YOUR PARTY NEEDS
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Shield}
              title="CHARACTER PROFILES"
              description="Create and manage crawlers with full stat blocks, avatars, equipped gear, and level tracking."
              accentColor="cyan"
            />
            <FeatureCard
              icon={Dice5}
              title="DICE ROLLER"
              description="Roll any combination of dice with stat modifiers. Results sync across the party in real-time."
              accentColor="cyan"
            />
            <FeatureCard
              icon={Volume2}
              title="SOUND EFFECTS"
              description="Immersive ambient sounds and effects that the DM can trigger to set the mood for any scene."
              accentColor="cyan"
            />
            <FeatureCard
              icon={Sparkles}
              title="DUNGEON AI"
              description="AI-powered tools for DMs — generate maps, mobs, loot boxes, and episode encounters."
              accentColor="gold"
            />
            <FeatureCard
              icon={BookOpen}
              title="SPELLS & INVENTORY"
              description="Full inventory management with equipment slots, spell tomes, loot boxes, and a shared party vault."
              accentColor="gold"
            />
            <FeatureCard
              icon={Users}
              title="MULTIPLAYER"
              description="Create campaigns, invite friends with share codes, and play together with real-time sync across all devices."
              accentColor="gold"
            />
          </div>
        </div>
      </RevealSection>

      {/* ===== HOW IT WORKS ===== */}
      <RevealSection className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl text-primary text-glow-cyan tracking-wider mb-12">
            THREE STEPS TO ADVENTURE
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "CREATE ACCOUNT",
                desc: "Sign up with Google or email — takes seconds.",
              },
              {
                step: "02",
                title: "START A CAMPAIGN",
                desc: "Create your campaign and invite your party with a share code.",
              },
              {
                step: "03",
                title: "PLAY",
                desc: "Explore maps, roll dice, fight mobs, and manage your crawlers — all in real-time.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <div className="w-14 h-14 border-2 border-primary/50 flex items-center justify-center mb-4">
                  <span className="font-display text-xl text-primary text-glow-cyan">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-display text-sm tracking-wider text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ===== FINAL CTA ===== */}
      <section className="relative py-32 px-4 flex flex-col items-center justify-center">
        <ParticleField />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center relative z-10"
        >
          <h2 className="font-display text-3xl md:text-4xl text-primary text-glow-cyan tracking-wider mb-4">
            YOUR ADVENTURE AWAITS
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Create your free account and start building your dungeon crawl today.
          </p>
          <DungeonButton variant="menu" onClick={handleCTA}>
            Enter the Dungeon
          </DungeonButton>
        </motion.div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border/50 py-8 text-center">
        <p className="text-xs text-muted-foreground font-display tracking-wider mb-2">
          WORLD DUNGEON — CRAWLER HUB v1.0
        </p>
        <p className="text-[10px] text-muted-foreground/50">
          Built for adventurers. Powered by Firebase.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
