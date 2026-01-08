import { useState } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Crawler, InventoryItem } from "@/lib/gameData";
import { Coins, Package, Sword, Shield, Plus, Trash2, Edit2, Save } from "lucide-react";

interface InventoryViewProps {
  crawlers: Crawler[];
  getCrawlerInventory: (crawlerId: string) => InventoryItem[];
  partyGold: number;
  onUpdateInventory: (crawlerId: string, items: InventoryItem[]) => void;
  onUpdateCrawler: (id: string, updates: Partial<Crawler>) => void;
}

const InventoryView: React.FC<InventoryViewProps> = ({
  crawlers,
  getCrawlerInventory,
  partyGold,
  onUpdateInventory,
  onUpdateCrawler,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [newItem, setNewItem] = useState<{ crawlerId: string; name: string; description: string }>({
    crawlerId: "",
    name: "",
    description: "",
  });

  const handleAddItem = (crawlerId: string) => {
    if (!newItem.name.trim()) return;
    const items = getCrawlerInventory(crawlerId);
    const item: InventoryItem = {
      id: Date.now().toString(),
      name: newItem.name,
      description: newItem.description,
      equipped: false,
    };
    onUpdateInventory(crawlerId, [...items, item]);
    setNewItem({ crawlerId: "", name: "", description: "" });
  };

  const handleRemoveItem = (crawlerId: string, itemId: string) => {
    const items = getCrawlerInventory(crawlerId);
    onUpdateInventory(crawlerId, items.filter((i) => i.id !== itemId));
  };

  const handleToggleEquip = (crawlerId: string, itemId: string) => {
    const items = getCrawlerInventory(crawlerId);
    onUpdateInventory(
      crawlerId,
      items.map((i) => (i.id === itemId ? { ...i, equipped: !i.equipped } : i))
    );
  };

  const handleGoldChange = (crawlerId: string, delta: number) => {
    const crawler = crawlers.find((c) => c.id === crawlerId);
    if (crawler) {
      const newGold = Math.max(0, (crawler.gold || 0) + delta);
      onUpdateCrawler(crawlerId, { gold: newGold });
    }
  };

  const handleGoldSet = (crawlerId: string, value: number) => {
    onUpdateCrawler(crawlerId, { gold: Math.max(0, Math.floor(value)) });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      <DungeonCard>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-primary text-glow-cyan flex items-center gap-3">
            <Package className="w-6 h-6" />
            CRAWLER INVENTORY
          </h2>
          <DungeonButton
            variant="admin"
            size="sm"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? (
              <>
                <Save className="w-4 h-4 mr-1" /> Done
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4 mr-1" /> Edit
              </>
            )}
          </DungeonButton>
        </div>

        {/* Party Gold (read-only sum) */}
        <div className="bg-accent/10 border border-accent p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Coins className="w-6 h-6 text-accent" />
              <span className="font-display text-accent text-glow-gold">TOTAL PARTY GOLD</span>
            </div>
            <span className="font-display text-2xl text-accent">{Math.floor(partyGold)}G</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Sum of all crawler gold</p>
        </div>

        {/* Crawler inventories */}
        <div className="space-y-6">
          {crawlers.map((crawler) => {
            const items = getCrawlerInventory(crawler.id);
            return (
              <div key={crawler.id} className="border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg text-primary flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {crawler.name}'s Items
                  </h3>
                  {/* Individual crawler gold */}
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-accent" />
                    {editMode ? (
                      <div className="flex items-center gap-1">
                        <DungeonButton variant="danger" size="sm" onClick={() => handleGoldChange(crawler.id, -10)}>
                          -10
                        </DungeonButton>
                        <input
                          type="number"
                          value={crawler.gold || 0}
                          onChange={(e) => handleGoldSet(crawler.id, parseInt(e.target.value) || 0)}
                          className="bg-background border border-accent px-2 py-1 w-20 text-right font-display text-accent text-sm"
                        />
                        <DungeonButton variant="default" size="sm" onClick={() => handleGoldChange(crawler.id, 10)}>
                          +10
                        </DungeonButton>
                      </div>
                    ) : (
                      <span className="font-display text-accent">{Math.floor(crawler.gold || 0)}G</span>
                    )}
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic mb-3">No items in inventory</p>
                ) : (
                  <ul className="space-y-2 mb-3">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 text-sm py-2 border-b border-border/50 last:border-0"
                      >
                        <Sword className="w-4 h-4 text-primary/60" />
                        <span className="text-foreground">{item.name}</span>
                        {item.description && (
                          <span className="text-muted-foreground text-xs">({item.description})</span>
                        )}
                        {editMode ? (
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              onClick={() => handleToggleEquip(crawler.id, item.id)}
                              className={`text-xs px-2 py-0.5 ${
                                item.equipped
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {item.equipped ? "EQUIPPED" : "EQUIP"}
                            </button>
                            <button
                              onClick={() => handleRemoveItem(crawler.id, item.id)}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          item.equipped && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 ml-auto">
                              EQUIPPED
                            </span>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add new item form */}
                {editMode && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <input
                      type="text"
                      placeholder="Item name"
                      value={newItem.crawlerId === crawler.id ? newItem.name : ""}
                      onChange={(e) =>
                        setNewItem({ crawlerId: crawler.id, name: e.target.value, description: newItem.crawlerId === crawler.id ? newItem.description : "" })
                      }
                      className="bg-muted border border-border px-2 py-1 text-sm flex-1"
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={newItem.crawlerId === crawler.id ? newItem.description : ""}
                      onChange={(e) =>
                        setNewItem({ ...newItem, crawlerId: crawler.id, description: e.target.value })
                      }
                      className="bg-muted border border-border px-2 py-1 text-sm flex-1"
                    />
                    <DungeonButton
                      variant="default"
                      size="sm"
                      onClick={() => handleAddItem(crawler.id)}
                    >
                      <Plus className="w-4 h-4" />
                    </DungeonButton>
                  </div>
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
