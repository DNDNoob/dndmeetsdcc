import React, { useState } from "react";
import { Clock, FlaskConical, Grab, HandHelping, MoveRight } from "lucide-react";
import { getDefaultAbility } from "@/lib/defaultAbilities";
import type { InventoryItem } from "@/lib/gameData";

const cardClass = (enabled: boolean) =>
  `flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors group text-center ${
    enabled ? 'border-accent/50 bg-accent/5 hover:bg-accent/20 hover:border-accent' : 'border-border/50 bg-muted/20 opacity-50 cursor-not-allowed'
  }`;

interface CombatActionCardsProps {
  /** Your action is free to use right now (your combat turn) */
  enabled: boolean;
  /** Who you can help: everyone else in the fight */
  allies: { id: string; name: string }[];
  /** d20 bonus for Grapple and Shove (STR modifier + Athletics rank) */
  athleticsBonus: number;
  onHelp: (allyId: string) => void;
  onReady: (trigger: string) => void;
  onAthletics: (abilityId: 'grapple' | 'shove') => void;
}

/** Help, Ready, Grapple and Shove: actions every character has in combat. */
export const CombatActionCards: React.FC<CombatActionCardsProps> = ({ enabled, allies, athleticsBonus, onHelp, onReady, onAthletics }) => {
  const [picking, setPicking] = useState<'help' | 'ready' | null>(null);
  const [trigger, setTrigger] = useState('');
  const bonus = `${athleticsBonus >= 0 ? '+' : ''}${athleticsBonus}`;
  const help = getDefaultAbility('help')!;
  const ready = getDefaultAbility('ready')!;
  const grapple = getDefaultAbility('grapple')!;
  const shove = getDefaultAbility('shove')!;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => setPicking(p => (p === 'help' ? null : 'help'))} disabled={!enabled} className={cardClass(enabled)} title={help.description}>
          <HandHelping className={`w-8 h-8 ${enabled ? 'text-accent group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-display ${enabled ? 'text-accent' : 'text-muted-foreground'}`}>Help</span>
          <span className="text-[10px] text-muted-foreground">Ally gets advantage on their next roll</span>
        </button>
        <button onClick={() => setPicking(p => (p === 'ready' ? null : 'ready'))} disabled={!enabled} className={cardClass(enabled)} title={ready.description}>
          <Clock className={`w-8 h-8 ${enabled ? 'text-accent group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-display ${enabled ? 'text-accent' : 'text-muted-foreground'}`}>Ready</span>
          <span className="text-[10px] text-muted-foreground">Hold your action for a trigger</span>
        </button>
        <button onClick={() => onAthletics('grapple')} disabled={!enabled} className={cardClass(enabled)} title={grapple.description}>
          <Grab className={`w-8 h-8 ${enabled ? 'text-accent group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-display ${enabled ? 'text-accent' : 'text-muted-foreground'}`}>Grapple</span>
          <span className="text-[10px] text-muted-foreground">Athletics d20 {bonus}</span>
        </button>
        <button onClick={() => onAthletics('shove')} disabled={!enabled} className={cardClass(enabled)} title={shove.description}>
          <MoveRight className={`w-8 h-8 ${enabled ? 'text-accent group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-display ${enabled ? 'text-accent' : 'text-muted-foreground'}`}>Shove</span>
          <span className="text-[10px] text-muted-foreground">Athletics d20 {bonus}</span>
        </button>
      </div>

      {enabled && picking === 'help' && (
        <div className="border border-accent/50 rounded-lg p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Who do you help?</p>
          {allies.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nobody else is in the fight.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allies.map(a => (
                <button
                  key={a.id}
                  onClick={() => { onHelp(a.id); setPicking(null); }}
                  className="px-3 py-1.5 rounded border border-accent/60 text-accent text-sm hover:bg-accent/15"
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {enabled && picking === 'ready' && (
        <form
          className="border border-accent/50 rounded-lg p-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!trigger.trim()) return;
            onReady(trigger.trim());
            setTrigger('');
            setPicking(null);
          }}
        >
          <label className="text-xs text-muted-foreground block" htmlFor="ready-trigger">What are you waiting for, and what will you do?</label>
          <input
            id="ready-trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="When the goblin steps through the door, I swing my axe"
            className="w-full bg-muted/40 border border-border rounded px-2 py-1.5 text-sm"
            maxLength={160}
          />
          <button type="submit" disabled={!trigger.trim()} className="px-3 py-1.5 rounded bg-accent text-accent-foreground font-display text-sm disabled:opacity-40">
            Ready it
          </button>
        </form>
      )}
    </div>
  );
};

interface UseItemCardProps {
  enabled: boolean;
  /** Items that aren't worn or wielded (potions, scrolls, tools) */
  items: InventoryItem[];
  onUse: (item: InventoryItem, usedUp: boolean) => void;
}

/** Use Item: a bonus action every character has. */
export const UseItemCard: React.FC<UseItemCardProps> = ({ enabled, items, onUse }) => {
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [usedUp, setUsedUp] = useState(true);
  const usable = enabled && items.length > 0;
  const chosen = items.find(i => i.id === itemId) ?? items[0];

  return (
    <div className="contents">
      <button onClick={() => setOpen(v => !v)} disabled={!usable} className={cardClass(usable)} title={getDefaultAbility('use-item')!.description}>
        <FlaskConical className={`w-8 h-8 ${usable ? 'text-accent group-hover:scale-110 transition-transform' : 'text-muted-foreground'}`} />
        <span className={`text-sm font-display ${usable ? 'text-accent' : 'text-muted-foreground'}`}>Use Item</span>
        <span className="text-[10px] text-muted-foreground">{items.length === 0 ? 'Nothing to use' : 'Potion, scroll or tool'}</span>
      </button>
      {usable && open && chosen && (
        <div className="col-span-2 md:col-span-3 border border-accent/50 rounded-lg p-3 space-y-2">
          <select
            value={chosen.id}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full bg-muted/40 border border-border rounded px-2 py-1.5 text-sm"
            aria-label="Item to use"
          >
            {items.map(i => <option key={i.id} value={i.id} className="bg-background">{i.name}</option>)}
          </select>
          {chosen.effects && <p className="text-xs text-muted-foreground">{chosen.effects}</p>}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={usedUp} onChange={(e) => setUsedUp(e.target.checked)} />
            Used up (remove it from my pack)
          </label>
          <button
            onClick={() => { onUse(chosen, usedUp); setOpen(false); setItemId(''); }}
            className="px-3 py-1.5 rounded bg-accent text-accent-foreground font-display text-sm"
          >
            Use {chosen.name}
          </button>
        </div>
      )}
    </div>
  );
};
