import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Dices, Heart, Shield, Sparkles, Swords, X } from "lucide-react";
import { getCrawlerArmor } from "@/lib/armor";
import {
  formatDamageDice,
  getEquippedModifiers,
  getMobCombatActions,
  type CombatState,
  type CombatantEntry,
  type Crawler,
  type InventoryItem,
  type Mob,
  type MobCombatAction,
  type Spell,
  type WeaponDie,
} from "@/lib/gameData";
import type { CombatHit, DiceRollEntry } from "@/hooks/useGameState";

interface MobActionsOverlayProps {
  combatState: CombatState;
  mobs: Mob[];
  crawlers: Crawler[];
  spells: Spell[];
  getCrawlerInventory?: (crawlerId: string) => InventoryItem[];
  addDiceRoll?: (entry: DiceRollEntry) => Promise<void>;
  onApplyDamage?: (hits: CombatHit[]) => Promise<void>;
  onRecordAction?: (combatantId: string, actionType: 'action' | 'bonus') => Promise<void>;
  onOverrideMobHealth?: (combatantId: string, newHP: number) => Promise<void>;
  onHealCrawler?: (crawlerId: string, amount: number) => Promise<void>;
}

interface PendingAction {
  action: MobCombatAction;
  hitTotal?: number; // absent for healing
}

const rollDie = (sides: number) => Math.floor(Math.random() * sides) + 1;
const rollDice = (dice: WeaponDie[]) => {
  const results: { dice: string; result: number }[] = [];
  for (const d of dice) {
    for (let i = 0; i < d.count; i++) results.push({ dice: `D${d.sides}`, result: rollDie(d.sides) });
  }
  return results;
};

const SOURCE_ICON = { attack: Swords, weapon: Shield, spell: Sparkles } as const;

/**
 * DM-only panel in the top left of the Show Time map during combat: everything the mob whose
 * turn it is can do. Rolls go to the dice feed under the mob's name for everyone to see.
 */
export const MobActionsOverlay: React.FC<MobActionsOverlayProps> = ({
  combatState,
  mobs,
  crawlers,
  spells,
  getCrawlerInventory,
  addDiceRoll,
  onApplyDamage,
  onRecordAction,
  onOverrideMobHealth,
  onHealCrawler,
}) => {
  const current = combatState.combatants[combatState.currentTurnIndex];
  const mobCombatants = combatState.combatants.filter(c => c.type === 'mob');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Follow the turn order: when a mob's turn starts, show that mob
  useEffect(() => {
    if (current?.type === 'mob') setSelectedId(current.id);
    setPending(null);
  }, [current?.id, current?.type]);

  const combatant = mobCombatants.find(c => c.id === selectedId) ?? (current?.type === 'mob' ? current : undefined);
  const mob = combatant ? mobs.find(m => m.id === (combatant.sourceId || combatant.id)) : undefined;
  const actions = useMemo(() => (mob ? getMobCombatActions(mob, spells) : []), [mob, spells]);

  if (mobCombatants.length === 0) return null;

  const isTheirTurn = !!combatant && current?.id === combatant.id;
  // Players can't see a mob's name until they have met it
  const feedName = (c: CombatantEntry, m?: Mob) => (m && (m.hidden || !m.encountered) ? '???' : c.name);

  const blockedReason = (action: MobCombatAction): string | null => {
    if (action.actionType === 'Reaction') return null;
    if (!isTheirTurn) return 'Not its turn (only reactions)';
    if (action.actionType === 'Action' && combatant?.hasUsedAction) return 'Action used';
    if (action.actionType === 'Bonus Action' && combatant?.hasUsedBonusAction) return 'Bonus action used';
    return null;
  };

  const getHP = (c: CombatantEntry) => {
    if (c.type === 'crawler') {
      const cr = crawlers.find(x => x.id === c.id);
      if (!cr) return null;
      const mods = getEquippedModifiers(cr, getCrawlerInventory?.(cr.id) ?? []);
      const inventory = getCrawlerInventory?.(cr.id) ?? [];
      // DC = the armor ratings of everything worn; 0 without armor, so any roll hits
      return { hp: cr.hp ?? 0, max: (cr.maxHP ?? 0) + (mods.maxHP ?? 0), dc: getCrawlerArmor(cr, inventory).dc as number | undefined };
    }
    const m = mobs.find(x => x.id === (c.sourceId || c.id));
    const max = m?.hitPoints ?? 0;
    return { hp: c.currentHP ?? max, max, dc: undefined as number | undefined };
  };

  const takeAction = async (action: MobCombatAction) => {
    if (!combatant || !mob || blockedReason(action)) return;
    const name = feedName(combatant, mob);
    let hitTotal: number | undefined;
    if (!action.healing) {
      const raw = rollDie(20);
      const hitDie = action.hitDie ? rollDice([action.hitDie]) : [];
      const modifier = action.hitBonus + hitDie.reduce((s, r) => s + r.result, 0);
      hitTotal = raw + modifier;
      await addDiceRoll?.({
        id: crypto.randomUUID(),
        crawlerName: name,
        crawlerId: combatant.id,
        timestamp: Date.now(),
        results: [{ dice: 'D20', result: raw }, ...hitDie],
        total: hitTotal,
        statRoll: { stat: `${action.name} (Attack)`, modifier, rawRoll: raw, rollType: 'Attack roll' },
        mobRoll: true,
      });
    }
    if (isTheirTurn && action.actionType !== 'Reaction') {
      await onRecordAction?.(combatant.id, action.actionType === 'Action' ? 'action' : 'bonus');
    }
    if (action.damageDice.length > 0 || action.damageBonus) {
      setPending({ action, hitTotal });
      setTargetIds([]);
    }
  };

  const resolve = async () => {
    if (!pending || !combatant || targetIds.length === 0) return;
    const { action } = pending;
    setBusy(true);
    try {
      const results = rollDice(action.damageDice);
      const amount = Math.max(0, results.reduce((s, r) => s + r.result, 0) + action.damageBonus);
      const targets = combatState.combatants.filter(c => targetIds.includes(c.id));
      const targetLabel = targets.map(t => t.name).join(', ');
      await addDiceRoll?.({
        id: crypto.randomUUID(),
        crawlerName: feedName(combatant, mob),
        crawlerId: combatant.id,
        timestamp: Date.now(),
        results,
        total: amount,
        statRoll: {
          stat: `${action.name} (${action.healing ? 'Healing' : 'Damage'} → ${targetLabel})`,
          modifier: action.damageBonus,
          rawRoll: amount - action.damageBonus,
          diceLabel: formatDamageDice(action.damageDice),
          rollType: action.healing ? 'Healing' : 'Damage',
        },
        mobRoll: true,
      });
      if (action.healing) {
        for (const t of targets) {
          if (t.type === 'crawler') await onHealCrawler?.(t.id, amount);
          else {
            const hp = getHP(t);
            if (hp) await onOverrideMobHealth?.(t.id, Math.min(hp.max, hp.hp + amount));
          }
        }
      } else {
        await onApplyDamage?.(targets.map(t => ({ targetId: t.id, targetType: t.type, damage: amount, damageType: action.damageType, weaponType: action.weaponType })));
      }
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleTarget = (id: string) => {
    if (!pending) return;
    if (pending.action.splash) setTargetIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    else setTargetIds([id]);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      className="absolute top-2 left-2 z-30 w-72 max-w-[calc(100%-1rem)] max-h-[calc(100%-1rem)] overflow-y-auto bg-background/95 backdrop-blur-sm border-2 border-destructive/60 rounded-lg shadow-lg text-xs cursor-default"
      onMouseDown={stop}
      onTouchStart={stop}
      onClick={stop}
      onWheel={stop}
      data-mob-actions-overlay
    >
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-destructive/40 bg-destructive/10">
        <Swords className="w-4 h-4 text-destructive shrink-0" />
        <select
          value={combatant?.id ?? ''}
          onChange={(e) => { setSelectedId(e.target.value); setPending(null); }}
          className="flex-1 min-w-0 bg-transparent font-display text-destructive text-sm truncate"
          title="Pick a mob (for reactions when it isn't its turn)"
        >
          {!combatant && <option value="">Pick a mob</option>}
          {mobCombatants.map(c => (
            <option key={c.id} value={c.id} className="bg-background">
              {c.name}{current?.id === c.id ? ' (turn)' : ''}
            </option>
          ))}
        </select>
        <button onClick={() => setCollapsed(v => !v)} className="text-muted-foreground hover:text-foreground" title={collapsed ? 'Show actions' : 'Hide actions'}>
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && combatant && (
        <div className="p-2 space-y-2">
          <div className="flex items-center gap-2 text-[10px]">
            {(() => {
              const hp = getHP(combatant);
              return hp ? <span className="flex items-center gap-0.5 text-destructive"><Heart className="w-3 h-3" />{hp.hp}/{hp.max}</span> : null;
            })()}
            <span className={combatant.hasUsedAction ? 'text-muted-foreground line-through' : 'text-accent'}>Action</span>
            <span className={combatant.hasUsedBonusAction ? 'text-muted-foreground line-through' : 'text-accent'}>Bonus</span>
            {!isTheirTurn && <span className="text-muted-foreground">· reactions only</span>}
          </div>

          {pending ? (
            <div className="space-y-2">
              <div className="text-foreground">
                <span className="font-display text-destructive">{pending.action.name}</span>
                {pending.hitTotal !== undefined && <> rolled <span className="font-bold text-accent">{pending.hitTotal}</span> to hit.</>}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {pending.action.healing ? 'Pick who to heal' : pending.action.splash ? 'Pick every target it hits' : 'Pick the target if it hit'}
                {' '}({formatDamageDice(pending.action.damageDice, pending.action.damageBonus)}).
              </p>
              <div className="space-y-1">
                {combatState.combatants.filter(c => c.id !== combatant.id || pending.action.healing).map(c => {
                  const hp = getHP(c);
                  const picked = targetIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleTarget(c.id)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded border ${picked ? 'border-accent bg-accent/15' : 'border-border hover:bg-muted/50'}`}
                    >
                      <span className={c.type === 'crawler' ? 'text-primary' : 'text-destructive'}>{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {hp ? `${hp.hp}/${hp.max} HP` : ''}{hp?.dc !== undefined ? ` · DC ${hp.dc}` : ''}
                        {hp?.dc !== undefined && pending.hitTotal !== undefined && (
                          <span className={pending.hitTotal >= hp.dc ? 'text-accent' : 'text-muted-foreground'}>{pending.hitTotal >= hp.dc ? ' · hits' : ' · misses'}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={resolve}
                  disabled={busy || targetIds.length === 0}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded font-display bg-destructive text-destructive-foreground disabled:opacity-40"
                >
                  <Dices className="w-3 h-3" /> {pending.action.healing ? 'Roll healing' : 'Roll damage'}
                </button>
                <button
                  onClick={() => setPending(null)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" /> {pending.action.healing ? 'Cancel' : 'Missed'}
                </button>
              </div>
            </div>
          ) : actions.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">
              {mob ? `${mob.name} has no attacks, weapons or spells yet. Add them in Dungeon AI → Mobs.` : 'This mob was deleted.'}
            </p>
          ) : (
            <div className="space-y-1">
              {actions.map(action => {
                const blocked = blockedReason(action);
                const Icon = SOURCE_ICON[action.source];
                return (
                  <button
                    key={action.key}
                    onClick={() => takeAction(action)}
                    disabled={!!blocked}
                    title={blocked ?? action.notes ?? ''}
                    className={`w-full text-left px-2 py-1.5 rounded border transition-colors ${
                      blocked ? 'border-border bg-muted/30 text-muted-foreground cursor-not-allowed' : 'border-destructive/40 hover:bg-destructive/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3 h-3 shrink-0 ${blocked ? '' : action.source === 'spell' ? 'text-primary' : 'text-destructive'}`} />
                      <span className={`font-display truncate ${blocked ? '' : 'text-foreground'}`}>{action.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{action.actionType}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground pl-4">
                      {action.healing
                        ? `Heals ${formatDamageDice(action.damageDice, action.damageBonus)}`
                        : `d20${action.hitBonus ? (action.hitBonus > 0 ? ` + ${action.hitBonus}` : ` - ${-action.hitBonus}`) : ''}${action.hitDie ? ` + ${action.hitDie.count}d${action.hitDie.sides}` : ''} to hit`}
                      {!action.healing && (action.damageDice.length > 0 || action.damageBonus) ? ` · ${formatDamageDice(action.damageDice, action.damageBonus)}${action.damageType ? ` ${action.damageType}` : ''}` : ''}
                      {action.range !== undefined ? ` · ${typeof action.range === 'number' ? `${action.range} ft` : action.range}` : ''}
                      {blocked ? ` · ${blocked}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MobActionsOverlay;
