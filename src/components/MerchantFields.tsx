import React, { useState } from "react";
import { ChevronDown, ChevronRight, Coins, Plus, Search, Store, Trash2 } from "lucide-react";
import {
  DEFAULT_HAGGLE_DC,
  DEFAULT_MERCHANT_CONFIG,
  getMerchantBuyPrice,
  getMerchantSellPrice,
  type InventoryItem,
  type MerchantConfig,
} from "@/lib/gameData";

interface MerchantFieldsProps {
  value: MerchantConfig | undefined;
  onChange: (next: MerchantConfig) => void;
  /** The item library the DM picks stock from */
  items: InventoryItem[];
}

const clampInt = (raw: string, min: number, max: number, fallback: number) => {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** DM settings that turn any mob into a merchant crawlers can trade with in Show Time. */
export const MerchantFields: React.FC<MerchantFieldsProps> = ({ value, onChange, items }) => {
  const enabled = !!value?.enabled;
  const [open, setOpen] = useState(enabled);
  const [search, setSearch] = useState("");
  const config: MerchantConfig = value ?? { ...DEFAULT_MERCHANT_CONFIG, enabled: false };
  const set = (updates: Partial<MerchantConfig>) => onChange({ ...config, ...updates });

  const searchVal = search.trim().toLowerCase();
  const matches = searchVal
    ? items.filter(i => i.name.toLowerCase().includes(searchVal) && !config.stock.some(e => e.item.id === i.id)).slice(0, 6)
    : [];

  return (
    <div className="bg-muted/40 border border-border p-2 rounded">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Store className="w-3 h-3" />
          Merchant {enabled && <span className="text-accent font-normal">(trades in Show Time)</span>}
        </button>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { set({ enabled: e.target.checked }); if (e.target.checked) setOpen(true); }}
            className="w-4 h-4"
          />
          Is a merchant
        </label>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Crawlers within 20 ft can tap this mob in Show Time to buy and sell. Stock and gold are shared by the
            whole party. Changes to stock and gold take effect when you press <span className="text-primary">Restock</span> in
            the merchant's trade window; the Scrooge Factor applies right away.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-0.5 block">Starting gold</label>
              <input
                type="number"
                min={0}
                value={config.startingGold}
                onChange={(e) => set({ startingGold: clampInt(e.target.value, 0, 1_000_000, 0) })}
                className="w-full bg-muted border border-border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-0.5 block">Scrooge Factor</label>
              <input
                type="number"
                min={0}
                max={10}
                value={config.scroogeFactor}
                onChange={(e) => set({ scroogeFactor: clampInt(e.target.value, 0, 10, 0) })}
                className="w-full bg-muted border border-border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-0.5 block">Haggle DC</label>
              <input
                type="number"
                min={1}
                max={40}
                value={config.haggleDC ?? ""}
                placeholder={String(DEFAULT_HAGGLE_DC)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  set({ haggleDC: Number.isFinite(n) && n > 0 ? Math.min(40, n) : undefined });
                }}
                className="w-full bg-muted border border-border px-2 py-1 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Scrooge {config.scroogeFactor}: crawlers pay {config.scroogeFactor * 10}% more and get {Math.min(100, config.scroogeFactor * 10)}% less
            when selling. A crawler who rolls Persuasion at or above the Haggle DC asks you to take one level off for them.
          </p>

          <div>
            <p className="text-xs text-muted-foreground font-semibold mb-1">Stock</p>
            <div className="relative mb-1">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search the item library to add stock..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1 bg-muted border border-border text-xs"
              />
            </div>
            {searchVal && (
              matches.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic mb-1">No matching items</p>
              ) : (
                <div className="space-y-1 mb-2 max-h-28 overflow-y-auto">
                  {matches.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-muted/30 border border-border rounded px-2 py-1">
                      <span className="text-xs text-primary truncate">{item.name}</span>
                      <button
                        type="button"
                        onClick={() => { set({ stock: [...config.stock, { item: { ...item }, quantity: 1 }] }); setSearch(""); }}
                        className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 shrink-0 ml-2"
                      >
                        <Plus className="w-3 h-3 inline" /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
            {config.stock.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">No stock yet. Add items from the library above.</p>
            ) : (
              <div className="space-y-1">
                {config.stock.map((entry, idx) => (
                  <div key={`${entry.item.id}-${idx}`} className="flex items-center gap-2 bg-muted/30 border border-border rounded px-2 py-1">
                    <span className="text-xs text-primary truncate flex-1">{entry.item.name}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0" title="Buy / sell price at this Scrooge Factor">
                      <Coins className="w-3 h-3 text-accent" />
                      {getMerchantBuyPrice(entry.item.goldValue, config.scroogeFactor)} / {getMerchantSellPrice(entry.item.goldValue, config.scroogeFactor)}
                    </span>
                    <label className="text-[10px] text-muted-foreground shrink-0">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={entry.quantity}
                      onChange={(e) => set({
                        stock: config.stock.map((s, i) => (i === idx ? { ...s, quantity: clampInt(e.target.value, 1, 999, 1) } : s)),
                      })}
                      className="w-14 bg-muted border border-border px-1 py-0.5 text-xs text-center"
                    />
                    <button
                      type="button"
                      onClick={() => set({ stock: config.stock.filter((_, i) => i !== idx) })}
                      className="text-destructive hover:text-destructive/80 shrink-0"
                      title="Remove from stock"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantFields;
