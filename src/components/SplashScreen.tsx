import { motion } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";

interface SplashScreenProps {
  onEnter: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onEnter }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      {/* Glowing orb */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative mb-8"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-radial from-destructive to-transparent animate-pulse-glow" />
        <div className="absolute inset-0 w-24 h-24 rounded-full bg-destructive/30 blur-xl" />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="font-display text-4xl md:text-6xl text-primary text-glow-cyan tracking-widest mb-4"
      >
        WORLD DUNGEON
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-muted-foreground text-lg mb-12 tracking-wide"
      >
        CRAWLER HUB v1.0
      </motion.p>

      {/* Enter button */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3 }}
      >
        <DungeonButton variant="menu" onClick={onEnter}>
          Let the Fun Begin
        </DungeonButton>
      </motion.div>

      {/* System message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="absolute bottom-8 text-xs text-muted-foreground animate-flicker"
      >
        [ SYSTEM INITIALIZED ]
      </motion.p>
    </motion.div>
  );
};

export default SplashScreen;
