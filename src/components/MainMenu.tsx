import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { User, Map, Backpack, Skull, Brain, Presentation, Volume2, ChevronDown, ArrowLeft, Wand2 } from "lucide-react";
import { Crawler } from "@/lib/gameData";
import GoogleAuthButton from "./GoogleAuthButton";

interface MainMenuProps {
  onNavigate: (view: string) => void;
  onDungeonAI: () => void;
  isAdmin: boolean;
  playerName?: string;
  playerType?: "crawler" | "ai" | "npc";
  crawlers?: Crawler[];
  onSwitchPlayer?: (playerId: string, playerName: string, playerType: "crawler" | "ai" | "npc") => void;
  campaignName?: string;
  onBackToCampaigns?: () => void;
}

const menuItems = [
  { id: "profiles", label: "Crawler Profiles", icon: User },
  { id: "maps", label: "World Map", icon: Map },
  { id: "inventory", label: "Inventory", icon: Backpack },
  { id: "mobs", label: "Mob Profiles", icon: Skull },
  { id: "spells", label: "Vernon's Library", icon: Wand2 },
  { id: "showtime", label: "Show Time", icon: Presentation },
  { id: "sounds", label: "Sound Effects", icon: Volume2 },
];

const MainMenu: React.FC<MainMenuProps> = ({
  onNavigate,
  onDungeonAI,
  isAdmin,
  playerName = "Crawler",
  playerType = "crawler",
  crawlers,
  onSwitchPlayer,
  campaignName,
  onBackToCampaigns,
}) => {
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const playerDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showPlayerDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (playerDropdownRef.current && !playerDropdownRef.current.contains(e.target as Node)) {
        setShowPlayerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPlayerDropdown]);

  const getPlayerColor = () => {
    if (playerType === "ai") return "text-accent text-glow-gold";
    if (playerType === "npc") return "text-muted-foreground";
    return "text-primary text-glow-cyan";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background"
    >
      <div className="absolute top-4 left-4 flex items-center gap-2">
        {onBackToCampaigns && (
          <DungeonButton variant="ghost" size="sm" onClick={onBackToCampaigns} className="flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-xs">Campaigns</span>
          </DungeonButton>
        )}
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-3" ref={playerDropdownRef}>
        <GoogleAuthButton compact />
        <div className="relative">
        <button
          onClick={() => onSwitchPlayer && setShowPlayerDropdown(!showPlayerDropdown)}
          className={`flex items-center gap-1.5 hover:opacity-80 transition-opacity ${onSwitchPlayer ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <User className="w-4 h-4 text-muted-foreground" />
          <span className={`text-sm font-display ${getPlayerColor()}`}>
            {playerType === "ai" ? "DUNGEON AI" : playerName}
          </span>
          {onSwitchPlayer && <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showPlayerDropdown ? 'rotate-180' : ''}`} />}
        </button>
        <AnimatePresence>
          {showPlayerDropdown && onSwitchPlayer && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full right-0 mt-1 w-56 bg-background border-2 border-primary shadow-lg shadow-primary/20 z-[70] max-h-64 overflow-y-auto"
              style={{ scrollbarWidth: 'none' }}
            >
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] text-muted-foreground font-display">CRAWLERS</div>
                {(crawlers ?? []).filter(c => c.id !== 'dungeonai').map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSwitchPlayer(c.id, c.name, 'crawler');
                      setShowPlayerDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                      playerType === 'crawler' && playerName === c.name ? 'text-primary bg-primary/5' : 'text-foreground'
                    }`}
                  >
                    {c.avatar ? (
                      <img src={c.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span>{c.name}</span>
                    <span className="text-muted-foreground ml-auto text-[10px]">Lvl {c.level}</span>
                  </button>
                ))}
                {isAdmin && (
                  <>
                    <div className="border-t border-border my-1" />
                    <div className="px-3 py-1 text-[10px] text-muted-foreground font-display">DUNGEON MASTER</div>
                    <button
                      onClick={() => {
                        onSwitchPlayer('dungeonai', 'DUNGEON AI', 'ai');
                        setShowPlayerDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                        playerType === 'ai' ? 'text-accent bg-primary/5' : 'text-foreground'
                      }`}
                    >
                      <Brain className="w-4 h-4 text-accent" />
                      <span>Dungeon AI</span>
                    </button>
                  </>
                )}
                <div className="border-t border-border my-1" />
                <div className="px-3 py-1 text-[10px] text-muted-foreground font-display">SPECTATORS</div>
                <button
                  onClick={() => {
                    onSwitchPlayer('npc', 'Just a Boring NPC', 'npc');
                    setShowPlayerDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                    playerType === 'npc' ? 'text-muted-foreground bg-primary/5' : 'text-foreground'
                  }`}
                >
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>Just a Boring NPC</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {campaignName && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-muted-foreground font-display tracking-wider mb-2"
        >
          {campaignName}
        </motion.p>
      )}

      <motion.h1
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="font-display text-3xl md:text-5xl text-primary text-glow-cyan tracking-[0.3em] mb-12"
      >
        SYSTEM HUB
      </motion.h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5 max-w-2xl md:max-w-3xl px-4">
        {menuItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            <DungeonButton
              variant="menu"
              className="w-full flex flex-col gap-3 items-center"
              onClick={() => onNavigate(item.id)}
            >
              <item.icon className="w-8 h-8" />
              <span className="text-sm">{item.label}</span>
            </DungeonButton>
          </motion.div>
        ))}
      </div>

      {/* Dungeon AI Button — only shown if the user is the DM */}
      {isAdmin && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <DungeonButton
            variant="admin"
            className="flex items-center gap-3 px-8 py-4"
            onClick={onDungeonAI}
          >
            <Brain className="w-6 h-6" />
            <span className="font-display tracking-wider">DUNGEON AI</span>
          </DungeonButton>
        </motion.div>
      )}
    </motion.div>
  );
};

export default MainMenu;
