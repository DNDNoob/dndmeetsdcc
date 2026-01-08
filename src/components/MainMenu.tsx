import { useState } from "react";
import { motion } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { User, Map, Backpack, Skull, Brain, Lock } from "lucide-react";

interface MainMenuProps {
  onNavigate: (view: string) => void;
  onDungeonAI: () => void;
}

const menuItems = [
  { id: "profiles", label: "Crawler Profiles", icon: User },
  { id: "maps", label: "World Map", icon: Map },
  { id: "inventory", label: "Inventory", icon: Backpack },
  { id: "mobs", label: "Mob Profiles", icon: Skull },
];

const DM_PASSWORD = "DND_IS_LIFE!";

const MainMenu: React.FC<MainMenuProps> = ({ onNavigate, onDungeonAI }) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleDungeonAIClick = () => {
    setShowPasswordModal(true);
    setPassword("");
    setError(false);
  };

  const handlePasswordSubmit = () => {
    if (password === DM_PASSWORD) {
      setShowPasswordModal(false);
      onDungeonAI();
    } else {
      setError(true);
    }
  };

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

      {/* Dungeon AI Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8"
      >
        <DungeonButton
          variant="admin"
          className="flex items-center gap-3 px-8 py-4"
          onClick={handleDungeonAIClick}
        >
          <Brain className="w-6 h-6" />
          <span className="font-display tracking-wider">DUNGEON AI</span>
          <Lock className="w-4 h-4" />
        </DungeonButton>
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
