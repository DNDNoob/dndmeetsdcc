import React from "react";
import { Sparkles } from "lucide-react";
import PixelIcon from "@/components/ui/PixelIcon";
import {
  getCheckDC,
  getSkillRank,
  rollD20,
  rollsWithDisadvantage,
  isCheckSuccess,
  SKILLS,
  type Crawler,
  type StatModifiers,
} from "@/lib/gameData";
import {
  STAT_NAMES,
  describeAbilityEffect,
  describeAbilityRoll,
  describeAbilityUses,
  formatAbilityDice,
  rollAbilityDice,
  type CrawlerAbility,
} from "@/lib/abilities";
import type { DiceRollEntry } from "@/hooks/useGameState";
import { useLanguages } from "@/contexts/LanguagesContext";

interface CrawlerAbilitiesPanelProps {
  crawler: Crawler;
  abilities: CrawlerAbility[];
  equippedMods: StatModifiers;
  dungeonFloor?: number;
  iconImages?: Record<string, string>;
  /** Who may press Use: the crawler's player or the DM */
  canUse: boolean;
  /** Why an ability can't be used right now (combat turn rules), or null */
  blockedReason: (activation: CrawlerAbility['ability']['activation']) => string | null;
  addDiceRoll?: (entry: DiceRollEntry) => Promise<void>;
  /** A check with a skill goes through the normal stat roll so it earns skill XP */
  onStatRoll?: (crawlerName: string, crawlerId: string, stat: string, totalStat: number, bonus?: number, dc?: number) => void;
  onUpdateCrawler: (id: string, updates: Partial<Crawler>) => void;
  /** Called after a use, with what it used up in combat */
  onUsed?: (activation: CrawlerAbility['ability']['activation']) => void;
}

/** The abilities a crawler gets from equipped items and known spells, each with a Use button. */
const CrawlerAbilitiesPanel: React.FC<CrawlerAbilitiesPanelProps> = ({
  crawler, abilities, equippedMods, dungeonFloor, iconImages = {}, canUse, blockedReason, addDiceRoll, onStatRoll, onUpdateCrawler, onUsed,
}) => {
  const effectiveMaxHP = crawler.maxHP + (equippedMods.maxHP ?? 0);
  const { languages } = useLanguages();
  const languageName = (id: string) => languages.find(l => l.id === id)?.name ?? id;

  const use = (entry: CrawlerAbility) => {
    const { ability } = entry;
    const manaCost = ability.cost?.mana ?? 0;
    const hpCost = ability.cost?.hp ?? 0;
    // Pay the cost first
    if (manaCost || hpCost) {
      onUpdateCrawler(crawler.id, {
        ...(manaCost ? { mana: Math.max(0, crawler.mana - manaCost) } : {}),
        ...(hpCost ? { hp: Math.max(0, Math.min(effectiveMaxHP, crawler.hp) - hpCost) } : {}),
      });
    }
    // The check, if it has one
    if (ability.roll) {
      const { ability: stat, skill, difficulty } = ability.roll;
      const total = (crawler[stat] ?? 10) + (equippedMods[stat] ?? 0);
      const dc = difficulty ? getCheckDC(difficulty, dungeonFloor) : undefined;
      if (skill && onStatRoll) {
        const skillName = SKILLS.find(sk => sk.id === skill)?.name ?? skill;
        onStatRoll(crawler.name, crawler.id, `${skillName} check: ${ability.name}`, total, getSkillRank(crawler, skill), dc);
      } else {
        const modifier = Math.floor((total - 10) / 2);
        const { rawRoll, results, diceLabel } = rollD20(rollsWithDisadvantage(crawler, total));
        const rollTotal = rawRoll + modifier;
        void addDiceRoll?.({
          id: crypto.randomUUID(), crawlerName: crawler.name, crawlerId: crawler.id, timestamp: Date.now(), results, total: rollTotal,
          statRoll: {
            stat: `${ability.name} (${stat.toUpperCase()})`, modifier, rawRoll, diceLabel, rollType: 'Check',
            ...(dc !== undefined ? { dc, success: isCheckSuccess(rawRoll, rollTotal, dc) } : {}),
          },
        });
      }
    }
    // Dice effects: damage, healing or an attack bonus
    for (const effect of ability.effects) {
      if (effect.type !== 'dice' || !effect.dice.some(d => d.count > 0)) continue;
      const { results, total } = rollAbilityDice(effect.dice);
      const label = effect.purpose === 'healing' ? 'Healing' : effect.purpose === 'attack' ? 'Attack bonus' : `${effect.damageType && effect.damageType !== 'Basic' ? `${effect.damageType} ` : ''}Damage`;
      void addDiceRoll?.({
        id: crypto.randomUUID(), crawlerName: crawler.name, crawlerId: crawler.id, timestamp: Date.now(), results, total,
        statRoll: { stat: `${ability.name} (${label})`, modifier: 0, rawRoll: total, diceLabel: formatAbilityDice(effect.dice), rollType: effect.purpose === 'healing' ? 'Healing' : 'Damage' },
      });
    }
    // Nothing to roll: just note the use in the dice log
    if (!ability.roll && !ability.effects.some(e => e.type === 'dice')) {
      void addDiceRoll?.({
        id: crypto.randomUUID(), crawlerName: crawler.name, crawlerId: crawler.id, timestamp: Date.now(),
        results: [], total: 0,
        statRoll: { stat: ability.name, modifier: 0, rawRoll: 0, diceLabel: 'no roll', rollType: 'Used' },
      });
    }
    onUsed?.(ability.activation);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl text-primary flex items-center gap-2">
        <Sparkles className="w-6 h-6" /> ABILITIES
      </h2>
      <p className="text-xs text-muted-foreground">
        What {crawler.name} can do thanks to equipped items and known spells. Spell abilities happen when the spell is cast from the Spells tab. Actions every character has are on the Actions, Reactions and Bonus tabs.
      </p>
      {abilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No abilities yet. Items and spells with linked abilities add them here.</p>
      ) : (
        <div className="space-y-3">
          {abilities.map(entry => {
            const { ability, link, source } = entry;
            const manaShort = (ability.cost?.mana ?? 0) > crawler.mana;
            // Spell abilities happen when the spell is cast (Spells tab), so they have no Use button of their own
            const usable = ability.activation !== 'Passive' && canUse && source.kind !== 'spell';
            const blocked = ability.activation === 'Passive' ? null : manaShort ? 'Not enough mana' : blockedReason(ability.activation);
            const roll = describeAbilityRoll(ability.roll);
            const cost = [ability.cost?.mana ? `${ability.cost.mana} mana` : '', ability.cost?.hp ? `${ability.cost.hp} HP` : ''].filter(Boolean).join(', ');
            return (
              <div key={entry.key} className="border border-border rounded-lg p-3 space-y-2 bg-muted/10">
                <div className="flex items-start gap-2">
                  <PixelIcon src={ability.iconId ? iconImages[ability.iconId] : undefined} alt={ability.name} className="w-8 h-8"
                    fallback={<Sparkles className="w-5 h-5 text-primary shrink-0" />} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-primary">{ability.name}</span>
                      <span className="text-[10px] text-muted-foreground border border-border px-1">{ability.activation}</span>
                      <span className="text-[10px] text-muted-foreground">{source.kind === 'spell' ? `when you cast ${source.name}` : `from ${source.name}`}</span>
                    </div>
                    {ability.description && <p className="text-xs text-muted-foreground">{ability.description}</p>}
                  </div>
                  {usable && (
                    <button type="button" onClick={() => use(entry)} disabled={!!blocked} title={blocked ?? `Use ${ability.name}`}
                      className="px-3 py-1.5 border-2 border-accent/60 text-accent text-xs font-display rounded hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                      Use
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  <span><span className="text-muted-foreground">Uses: </span>{describeAbilityUses(ability)}</span>
                  {cost && <span><span className="text-muted-foreground">Cost: </span><span className={manaShort ? 'text-destructive' : 'text-accent'}>{cost}</span></span>}
                  {ability.range !== undefined && <span><span className="text-muted-foreground">Range: </span>{typeof ability.range === 'number' ? `${ability.range} ft` : ability.range}</span>}
                  {roll && <span><span className="text-muted-foreground">Roll: </span>{roll}</span>}
                  {ability.save && <span><span className="text-muted-foreground">Targets resist: </span>{STAT_NAMES[ability.save]} save</span>}
                  {ability.trigger && <span><span className="text-muted-foreground">Trigger: </span><span className="italic text-accent">{ability.trigger}</span></span>}
                </div>
                {ability.effects.length > 0 && (
                  <ul className="list-disc pl-5 text-[11px] text-primary">
                    {ability.effects.map((e, i) => <li key={i}>{describeAbilityEffect(e, languageName)}</li>)}
                  </ul>
                )}
                {link.note && <p className="text-[11px] italic text-accent">{link.note}</p>}
                {blocked && usable && <p className="text-[10px] text-muted-foreground">{blocked}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CrawlerAbilitiesPanel;
