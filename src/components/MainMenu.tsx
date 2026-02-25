import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { User, Map, Backpack, Skull, Brain, Lock, Unlock, Presentation, Volume2, ChevronDown } from "lucide-react";
import { Crawler } from "@/lib/gameData";
import GoogleAuthButton from "./GoogleAuthButton";

interface MainMenuProps {
  onNavigate: (view: string) => void;
  onDungeonAI: () => void;
  isDungeonAILoggedIn?: boolean;
  onDungeonAILogout?: () => void;
  playerName?: string;
  playerType?: "crawler" | "ai" | "npc";
  onDungeonAILogin?: () => void;
  crawlers?: Crawler[];
  onSwitchPlayer?: (playerId: string, playerName: string, playerType: "crawler" | "ai" | "npc") => void;
}

const menuItems = [
  { id: "profiles", label: "Crawler Profiles", icon: User },
  { id: "maps", label: "World Map", icon: Map },
  { id: "inventory", label: "Inventory", icon: Backpack },
  { id: "mobs", label: "Mob Profiles", icon: Skull },
  { id: "showtime", label: "Show Time", icon: Presentation },
  { id: "sounds", label: "Sound Effects", icon: Volume2 },
];

const DM_PASSWORD = "DND_IS_LIFE!";

const MainMenu: React.FC<MainMenuProps> = ({ onNavigate, onDungeonAI, isDungeonAILoggedIn = false, onDungeonAILogout, playerName = "Crawler", playerType = "crawler", onDungeonAILogin, crawlers, onSwitchPlayer }) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
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

  const handleDungeonAIClick = () => {
    if (isDungeonAILoggedIn) {
      onDungeonAI();
    } else {
      setShowPasswordModal(true);
      setPassword("");
      setError(false);
    }
  };

  const handlePasswordSubmit = (navigateToDM = true) => {
    if (password === DM_PASSWORD) {
      localStorage.setItem("dcc_dungeon_ai_login", "true");
      setShowPasswordModal(false);
      if (onDungeonAILogin) onDungeonAILogin();
      if (navigateToDM) onDungeonAI();
    } else {
      setError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("dcc_dungeon_ai_login");
    if (onDungeonAILogout) {
      onDungeonAILogout();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background"
    >
      <div className="absolute top-4 left-4">
        <GoogleAuthButton />
      </div>
      <div className="absolute top-4 right-4 relative" ref={playerDropdownRef}>
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
                <div className="border-t border-border my-1" />
                <div className="px-3 py-1 text-[10px] text-muted-foreground font-display">DUNGEON MASTER</div>
                <button
                  onClick={() => {
                    if (isDungeonAILoggedIn) {
                      onSwitchPlayer('dungeonai', 'DUNGEON AI', 'ai');
                      onDungeonAILogin?.();
                    } else {
                      setShowPlayerDropdown(false);
                      setShowPasswordModal(true);
                      setPassword("");
                      setError(false);
                    }
                    setShowPlayerDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                    playerType === 'ai' ? 'text-accent bg-primary/5' : 'text-foreground'
                  }`}
                >
                  <Brain className="w-4 h-4 text-accent" />
                  <span>Dungeon AI</span>
                  {isDungeonAILoggedIn ? (
                    <Unlock className="w-3 h-3 text-accent ml-auto" />
                  ) : (
                    <Lock className="w-3 h-3 text-muted-foreground ml-auto" />
                  )}
                </button>
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

      {/* Dungeon AI Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 flex gap-2"
      >
        <DungeonButton
          variant="admin"
          className="flex items-center gap-3 px-8 py-4"
          onClick={handleDungeonAIClick}
        >
          <Brain className="w-6 h-6" />
          <span className="font-display tracking-wider">DUNGEON AI</span>
          {isDungeonAILoggedIn ? <Lock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        </DungeonButton>
        {isDungeonAILoggedIn && (
          <DungeonButton
            variant="menu"
            className="flex items-center gap-2 px-4 py-4"
            onClick={handleLogout}
          >
            <span className="font-display text-xs">LOGOUT</span>
          </DungeonButton>
        )}
      </motion.div>

      {/* Password Modal */}
      {showPasswordModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background border-2 border-accent p-6 max-w-sm w-full mx-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-6 h-6 text-accent" />
              <h2 className="font-display text-xl text-accent text-glow-gold">DUNGEON AI ACCESS</h2>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Enter the Dungeon Master password to access DM features.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              placeholder="Enter password..."
              className={`w-full bg-muted border px-4 py-3 mb-4 font-mono ${
                error ? "border-destructive" : "border-border"
              }`}
              autoFocus
            />
            {error && (
              <p className="text-destructive text-sm mb-4">ACCESS DENIED - Invalid password</p>
            )}
            <div className="flex gap-3">
              <DungeonButton
                variant="menu"
                className="flex-1"
                onClick={() => setShowPasswordModal(false)}
              >
                Cancel
              </DungeonButton>
              <DungeonButton variant="admin" className="flex-1" onClick={handlePasswordSubmit}>
                Access
              </DungeonButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default MainMenu;
