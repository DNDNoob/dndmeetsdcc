import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { Crawler, InventoryItem } from "@/lib/gameData";
import { Coins, Package, Sword, Shield } from "lucide-react";

interface InventoryViewProps {
  crawlers: Crawler[];
  getCrawlerInventory: (crawlerId: string) => InventoryItem[];
  gold: number;
}

const InventoryView: React.FC<InventoryViewProps> = ({
  crawlers,
  getCrawlerInventory,
  gold,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      <DungeonCard>
        <h2 className="font-display text-2xl text-primary text-glow-cyan mb-6 flex items-center gap-3">
          <Package className="w-6 h-6" />
          CRAWLER INVENTORY
        </h2>

        {/* Party Gold */}
        <div className="bg-accent/10 border border-accent p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="w-6 h-6 text-accent" />
            <span className="font-display text-accent text-glow-gold">SHARED PARTY GOLD</span>
          </div>
          <span className="font-display text-2xl text-accent">{gold.toFixed(2)}G</span>
        </div>

        {/* Crawler inventories */}
        <div className="space-y-6">
          {crawlers.map((crawler) => {
            const items = getCrawlerInventory(crawler.id);
            return (
              <div key={crawler.id} className="border border-border bg-muted/20 p-4">
                <h3 className="font-display text-lg text-primary mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  {crawler.name}'s Items
                </h3>

                {items.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">No items in inventory</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 text-sm py-2 border-b border-border/50 last:border-0"
                      >
                        <Sword className="w-4 h-4 text-primary/60" />
                        <span className="text-foreground">{item.name}</span>
                        {item.equipped && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 ml-auto">
                            EQUIPPED
                          </span>
                        )}
                        {item.description && (
                          <span className="text-muted-foreground text-xs ml-2">
                            ({item.description})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default InventoryView;
