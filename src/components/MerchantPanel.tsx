import React, { useState } from "react";
import { motion } from "framer-motion";
import { Coins, Dices, Handshake, RefreshCw, Store, X } from "lucide-react";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import {
  DEFAULT_HAGGLE_DC,
  MERCHANT_TRADE_RANGE_FEET,
  getEffectiveScrooge,
  getSkillRank,
  getBarterScroogeReduction,
  getMerchantBuyPrice,
  getMerchantSellPrice,
  merchantItemKey,
  stackItems,
  type Crawler,
  type InventoryItem,
  type MerchantState,
  type MerchantStockEntry,
  type Mob,
} from "@/lib/gameData";

interface MerchantPanelProps {
  mob: Mob;
  state: MerchantState | undefined;
  isAdmin: boolean;
  /** The player's own crawler (players only) */
  crawler?: Crawler;
  crawlerInventory?: InventoryItem[];
  /** Distance from the player's crawler to the merchant, or null when it can't be measured */
  distanceFeet: number | null;
  /** Why the player can't spend an action on haggling right now, or null */
  haggleBlocker?: string | null;
  onBuy: (item: InventoryItem) => Promise<unknown>;
  onSell: (itemId: string, minGold: number) => Promise<unknown>;
  onHaggle: () => Promise<unknown>;
  onRestock: () => Promise<unknown>;
  onResolveHaggle: (crawlerId: string, approve: boolean) => Promise<unknown>;
  onClose: () => void;
}

type Tab = "buy" | "sell";

/** Trade window for a merchant NPC in Show Time. Stock and gold are live for everyone. */
export const MerchantPanel: React.FC<MerchantPanelProps> = ({
  mob, state, isAdmin, crawler, crawlerInventory = [], distanceFeet, haggleBlocker = null,
  onBuy, onSell, onHaggle, onRestock, onResolveHaggle, onClose,
}) => {
  const [tab, setTab] = useState<Tab>("buy");
  const [busy, setBusy] = useState(false);
  const config = mob.merchant;
  if (!config) return null;

  // Before anyone trades, show what the DM set up
  const stock: MerchantStockEntry[] = state?.stock ?? config.stock.filter(e => e.quantity > 0);
  const merchantGold = state?.gold ?? config.startingGold;
  const barter = isAdmin ? 0 : getSkillRank(crawler, "barter");
  const scrooge = getEffectiveScrooge(config, state, crawler?.id, barter);
  const myGold = crawler?.gold ?? 0;
  const inRange = isAdmin || (distanceFeet !== null && distanceFeet <= MERCHANT_TRADE_RANGE_FEET);
  const canTrade = !isAdmin && !!crawler && inRange;
  const haggle = crawler ? state?.haggles?.[crawler.id] : undefined;
  const haggleDC = config.haggleDC ?? DEFAULT_HAGGLE_DC;
  const pendingHaggles = Object.entries(state?.haggles ?? {}).filter(([, h]) => h.state === "pending");

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-background/70 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <DungeonCard glowColor="gold" className="p-4 max-h-[85vh] flex flex-col">
          <div className="flex items-start gap-3 mb-3">
            {mob.image && <img src={mob.image} alt={mob.name} className="w-12 h-12 object-cover border border-border shrink-0" />}
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-lg text-accent text-glow-gold flex items-center gap-2">
                <Store className="w-5 h-5 shrink-0" />
                <span className="truncate">{mob.name}</span>
              </h2>
              <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-accent" />Merchant has {merchantGold} gold</span>
                <span>Scrooge {scrooge}{scrooge !== config.scroogeFactor ? ` (was ${config.scroogeFactor})` : ""}</span>
                {getBarterScroogeReduction(barter) > 0 && <span className="text-primary">Barter {barter}: -{getBarterScroogeReduction(barter)} Scrooge</span>}
                {crawler && !isAdmin && <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-accent" />You have {myGold} gold</span>}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-primary" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          {!isAdmin && !inRange && (
            <p className="text-xs text-destructive border border-destructive/50 bg-destructive/10 px-2 py-1 mb-2">
              {distanceFeet === null
                ? "Your crawler isn't on this map."
                : `You're ${Math.round(distanceFeet)} ft away. Walk within ${MERCHANT_TRADE_RANGE_FEET} ft to trade.`}
            </p>
          )}
          {!isAdmin && !crawler && (
            <p className="text-xs text-muted-foreground mb-2">Pick your crawler to trade.</p>
          )}

          {isAdmin && (
            <div className="border border-accent/40 bg-accent/5 p-2 mb-3 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground flex-1">
                  Restock resets stock, gold and haggling to the merchant's settings in the DM Console.
                </p>
                <DungeonButton size="sm" variant="admin" disabled={busy} onClick={() => run(onRestock)}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Restock
                </DungeonButton>
              </div>
              {pendingHaggles.map(([crawlerId, h]) => (
                <div key={crawlerId} className="flex items-center gap-2 text-xs">
                  <Handshake className="w-4 h-4 text-accent shrink-0" />
                  <span className="flex-1">
                    {h.crawlerName} rolled Persuasion {h.total} vs DC {h.dc}. Lower prices one level for them?
                  </span>
                  <DungeonButton size="sm" disabled={busy} onClick={() => run(() => onResolveHaggle(crawlerId, true))}>Yes</DungeonButton>
                  <DungeonButton size="sm" variant="danger" disabled={busy} onClick={() => run(() => onResolveHaggle(crawlerId, false))}>No</DungeonButton>
                </div>
              ))}
            </div>
          )}

          {canTrade && (
            <div className="flex items-center gap-2 mb-3 text-xs">
              {!haggle ? (
                <>
                  <span className="flex-1 text-muted-foreground">
                    Haggle: uses an action to roll Persuasion{barter > 0 ? ` + Barter ${barter}` : ""} vs DC {haggleDC}. If you make it, the DM can lower your prices one level.
                    {haggleBlocker && <span className="block text-destructive">{haggleBlocker}</span>}
                  </span>
                  <DungeonButton size="sm" disabled={busy || scrooge === 0 || !!haggleBlocker} onClick={() => run(onHaggle)}>
                    <Dices className="w-3 h-3 mr-1" /> Haggle
                  </DungeonButton>
                </>
              ) : (
                <span className="text-muted-foreground">
                  <Handshake className="w-3 h-3 inline mr-1 text-accent" />
                  {haggle.state === "pending" && `You rolled ${haggle.total} vs DC ${haggle.dc}. Waiting for the DM.`}
                  {haggle.state === "approved" && `Haggled: your prices are one level lower.`}
                  {haggle.state === "denied" && `The DM said no. ${mob.name} won't budge until they restock.`}
                  {haggle.state === "failed" && `You rolled ${haggle.total} vs DC ${haggle.dc}. ${mob.name} won't budge until they restock.`}
                </span>
              )}
            </div>
          )}

          {!isAdmin && (
            <div className="flex gap-1 mb-2">
              {(["buy", "sell"] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 font-display text-sm py-1 border ${tab === t ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:text-primary"}`}
                >
                  {t === "buy" ? "Buy" : "Sell"}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-y-auto flex-1 space-y-1 min-h-[80px]">
            {(isAdmin || tab === "buy") && (
              stock.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{mob.name} has nothing for sale.</p>
              ) : stock.map(entry => {
                const price = getMerchantBuyPrice(entry.item.goldValue, scrooge);
                const tooPoor = myGold < price;
                return (
                  <div key={merchantItemKey(entry.item)} className="flex items-center gap-2 border border-border bg-muted/20 px-2 py-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary truncate">{entry.item.name} <span className="text-xs text-muted-foreground">×{entry.quantity}</span></p>
                      {entry.item.description && <p className="text-[11px] text-muted-foreground truncate">{entry.item.description}</p>}
                    </div>
                    <span className="text-xs text-accent flex items-center gap-0.5 shrink-0"><Coins className="w-3 h-3" />{price}</span>
                    {!isAdmin && (
                      <DungeonButton
                        size="sm"
                        disabled={!canTrade || busy || tooPoor}
                        title={tooPoor ? "Not enough gold" : undefined}
                        onClick={() => run(() => onBuy(entry.item))}
                      >
                        Buy
                      </DungeonButton>
                    )}
                  </div>
                );
              })
            )}

            {!isAdmin && tab === "sell" && (
              crawlerInventory.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">You have nothing to sell.</p>
              ) : stackItems(crawlerInventory).map(({ key, item: first, count, ids }) => {
                // Sell an unequipped copy first
                const equippedIds = new Set(Object.values(crawler?.equippedItems ?? {}));
                const sellId = ids.find(id => !equippedIds.has(id)) ?? ids[0];
                const item = crawlerInventory.find(i => i.id === sellId) ?? first;
                const price = getMerchantSellPrice(item.goldValue, scrooge);
                const offer = Math.min(price, merchantGold);
                const equipped = equippedIds.has(item.id);
                let label = `Sell for ${price}`;
                let note: string | null = null;
                if (price <= 0) { label = "Sell"; note = "Worthless to this merchant"; }
                else if (merchantGold <= 0) { label = "Sell"; note = `${mob.name} is out of gold`; }
                else if (offer < price) { label = `Sell for ${offer}`; note = `Worth ${price}, but ${mob.name} only has ${merchantGold} gold`; }
                return (
                  <div key={key} className="flex items-center gap-2 border border-border bg-muted/20 px-2 py-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary truncate">
                        {item.name}
                        {count > 1 && <span className="text-xs text-muted-foreground"> ×{count}</span>}
                        {equipped && <span className="text-[10px] text-accent ml-1">(equipped)</span>}
                      </p>
                      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
                    </div>
                    <span className="text-xs text-accent flex items-center gap-0.5 shrink-0"><Coins className="w-3 h-3" />{price}</span>
                    <DungeonButton
                      size="sm"
                      disabled={!canTrade || busy || price <= 0 || offer <= 0}
                      onClick={() => run(() => onSell(item.id, offer))}
                    >
                      {label}
                    </DungeonButton>
                  </div>
                );
              })
            )}
          </div>
        </DungeonCard>
      </motion.div>
    </div>
  );
};

interface MerchantHagglePromptsProps {
  merchants: { mob: Mob; state: MerchantState }[];
  onResolve: (mob: Mob, crawlerId: string, approve: boolean) => Promise<unknown>;
}

/** DM: haggles waiting for approval, shown on the map so the DM doesn't have to open each merchant. */
export const MerchantHagglePrompts: React.FC<MerchantHagglePromptsProps> = ({ merchants, onResolve }) => {
  const pending = merchants.flatMap(({ mob, state }) =>
    Object.entries(state.haggles ?? {}).filter(([, h]) => h.state === "pending").map(([crawlerId, h]) => ({ mob, crawlerId, h }))
  );
  if (pending.length === 0) return null;
  return (
    <div className="fixed left-4 bottom-24 z-[150] space-y-2 max-w-xs" onMouseDown={(e) => e.stopPropagation()}>
      {pending.map(({ mob, crawlerId, h }) => (
        <div key={`${mob.id}-${crawlerId}`} className="bg-background/95 border-2 border-accent p-2 text-xs shadow-lg">
          <p className="mb-1">
            <Handshake className="w-3 h-3 inline mr-1 text-accent" />
            <span className="font-bold">{h.crawlerName}</span> haggled with <span className="font-bold">{mob.name}</span>: Persuasion {h.total} vs DC {h.dc}.
            Lower their prices one Scrooge level?
          </p>
          <div className="flex gap-2">
            <DungeonButton size="sm" onClick={() => onResolve(mob, crawlerId, true)}>Yes</DungeonButton>
            <DungeonButton size="sm" variant="danger" onClick={() => onResolve(mob, crawlerId, false)}>No</DungeonButton>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MerchantPanel;
