import { motion } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { Home, User, Map, Backpack, Skull } from "lucide-react";

interface NavigationProps {
  onNavigate: (view: string) => void;
  onReturnToMenu: () => void;
  currentView: string;
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
  currentView,
}) => {
  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b-2 border-primary px-4 py-3"
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 md:gap-4">
        <DungeonButton
          variant="nav"
          size="sm"
          onClick={onReturnToMenu}
          className="flex items-center gap-2"
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
            className="flex items-center gap-2"
          >
            <item.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </DungeonButton>
        ))}
      </div>
    </motion.nav>
  );
};

export default Navigation;
