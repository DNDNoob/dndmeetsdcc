import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { Home, User, Map, Backpack, Skull, Presentation, Volume2, FileText, Brain, Pin, PinOff } from "lucide-react";

interface NavigationProps {
  onNavigate: (view: string) => void;
  onReturnToMenu: () => void;
  onShowChangelog: () => void;
  currentView: string;
  playerName: string;
  playerType: "crawler" | "ai" | "npc";
  autoCollapse?: boolean; // Whether navigation should auto-collapse
  onVisibilityChange?: (visible: boolean) => void; // Called when nav visibility changes
}

const navItems = [
  { id: "profiles", label: "Profiles", icon: User },
  { id: "maps", label: "Maps", icon: Map },
  { id: "inventory", label: "Inventory", icon: Backpack },
  { id: "mobs", label: "Mobs", icon: Skull },
];

const Navigation: React.FC<NavigationProps> = ({
  onNavigate,
  onReturnToMenu,
  onShowChangelog,
  currentView,
  playerName,
  playerType,
  autoCollapse = false,
  onVisibilityChange,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const getPlayerColor = () => {
    if (playerType === "ai") return "text-accent text-glow-gold";
    if (playerType === "npc") return "text-muted-foreground";
    return "text-primary text-glow-cyan";
  };

  const shouldCollapse = autoCollapse && !isPinned && !isHovered;

  // Notify parent of visibility changes
  useEffect(() => {
    onVisibilityChange?.(!shouldCollapse);
  }, [shouldCollapse, onVisibilityChange]);

  return (
    <>
      {/* Hover trigger zone when collapsed - only covers left portion to avoid blocking the ping panel on the right */}
      {autoCollapse && !isPinned && !isHovered && (
        <div
          className="fixed top-0 left-0 h-8 z-[60]"
          style={{ width: '60%' }}
          onMouseEnter={() => setIsHovered(true)}
        />
      )}
      <motion.nav
        initial={{ y: -50, opacity: 0 }}
        animate={{
          y: shouldCollapse ? -100 : 0,
          opacity: shouldCollapse ? 0 : 1
        }}
        transition={{ duration: 0.2 }}
        className="sticky top-0 z-[55] bg-background/95 backdrop-blur border-b-2 border-primary px-4 py-3"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className={`text-xs md:text-sm font-display ${getPlayerColor()}`}>
              {playerType === "ai" ? "DUNGEON AI" : playerName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {autoCollapse && (
              <DungeonButton
                variant={isPinned ? "admin" : "ghost"}
                size="sm"
                onClick={() => setIsPinned(!isPinned)}
                className="flex items-center gap-1"
                title={isPinned ? "Unpin navigation" : "Pin navigation"}
              >
                {isPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
              </DungeonButton>
            )}
            <DungeonButton
              variant="ghost"
              size="sm"
              onClick={onShowChangelog}
              className="flex items-center gap-1"
            >
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline text-xs">Changelog</span>
            </DungeonButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
          <DungeonButton
            variant="nav"
            size="sm"
            onClick={onReturnToMenu}
            className={`flex items-center gap-2 ${currentView === "none" ? "border-4" : ""}`}
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Main Menu</span>
          </DungeonButton>

          {navItems.map((item) => (
            <DungeonButton
              key={item.id}
              variant={currentView === item.id ? "default" : "nav"}
              size="sm"
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-2 ${currentView === item.id ? "border-4" : ""}`}
            >
              <item.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </DungeonButton>
          ))}

          <DungeonButton
            variant={currentView === "showtime" ? "default" : "nav"}
            size="sm"
            onClick={() => onNavigate("showtime")}
            className={`flex items-center gap-2 ${currentView === "showtime" ? "border-4" : ""}`}
          >
            <Presentation className="w-4 h-4" />
            <span className="hidden sm:inline">Show Time</span>
          </DungeonButton>

          <DungeonButton
            variant={currentView === "sounds" ? "default" : "nav"}
            size="sm"
            onClick={() => onNavigate("sounds")}
            className={`flex items-center gap-2 ${currentView === "sounds" ? "border-4" : ""}`}
          >
            <Volume2 className="w-4 h-4" />
            <span className="hidden sm:inline">Sounds</span>
          </DungeonButton>

          {playerType === "ai" && (
            <DungeonButton
              variant={currentView === "dungeonai" ? "default" : "nav"}
              size="sm"
              onClick={() => onNavigate("dungeonai")}
              className={`flex items-center gap-2 ${currentView === "dungeonai" ? "border-4" : ""}`}
            >
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">DM Console</span>
            </DungeonButton>
          )}
        </div>
      </div>
    </motion.nav>
    </>
  );
};

export default Navigation;
