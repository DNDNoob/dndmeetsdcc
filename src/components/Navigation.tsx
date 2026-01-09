import { motion } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { Home, User, Map, Backpack, Skull, Presentation, Volume2, FileText } from "lucide-react";

interface NavigationProps {
  onNavigate: (view: string) => void;
  onReturnToMenu: () => void;
  onShowChangelog: () => void;
  currentView: string;
  playerName: string;
  playerType: "crawler" | "ai" | "npc";
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
}) => {
  const getPlayerColor = () => {
    if (playerType === "ai") return "text-accent text-glow-gold";
    if (playerType === "npc") return "text-muted-foreground";
    return "text-primary text-glow-cyan";
  };

  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b-2 border-primary px-4 py-3"
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
        </div>
      </div>
    </motion.nav>
  );
};

export default Navigation;
