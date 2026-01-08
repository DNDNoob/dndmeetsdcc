import { motion } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { User, Map, Backpack, Skull } from "lucide-react";

interface MainMenuProps {
  onNavigate: (view: string) => void;
}

const menuItems = [
  { id: "profiles", label: "Character Profiles", icon: User },
  { id: "maps", label: "World Map", icon: Map },
  { id: "inventory", label: "Inventory", icon: Backpack },
  { id: "mobs", label: "Mob Profiles", icon: Skull },
];

const MainMenu: React.FC<MainMenuProps> = ({ onNavigate }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background"
    >
      <motion.h1
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="font-display text-3xl md:text-5xl text-primary text-glow-cyan tracking-[0.3em] mb-12"
      >
        SYSTEM HUB
      </motion.h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-xl px-4">
        {menuItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            <DungeonButton
              variant="menu"
              className="w-full min-w-[200px] flex flex-col gap-3 items-center"
              onClick={() => onNavigate(item.id)}
            >
              <item.icon className="w-8 h-8" />
              <span>{item.label}</span>
            </DungeonButton>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default MainMenu;
