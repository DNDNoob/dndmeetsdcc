import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, ChevronDown, ChevronUp, BookOpen, Zap, Star, Wand2, X, Check, Globe, Lock, Users } from "lucide-react";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { DungeonCard } from "@/components/ui/DungeonCard";
import {
  Crawler,
  Spell,
  SpellData,
  SpellSchool,
  SpellActionType,
  SpellDamageType,
  SpellLearnedFrom,
  KnownSpell,
  SPELL_SCHOOLS,
  SPELL_ACTION_TYPES,
  SPELL_DAMAGE_TYPES,
  DAMAGE_TYPES,
  WeaponDie,
  StatModifiers,
  getSpellMasteryLevel,
  getEffectiveManaCost,
  getCastsUntilNextMastery,
} from "@/lib/gameData";

interface SpellsViewProps {
  crawlers: Crawler[];
  spells: Spell[];
  onAddSpell: (spell: Spell) => Promise<void>;
  onUpdateSpell: (id: string, updates: Partial<Spell>) => Promise<void>;
  onDeleteSpell: (id: string) => Promise<void>;
  onLearnSpell: (crawlerId: string, spell: Spell, source: SpellLearnedFrom) => Promise<void>;
  onForgetSpell: (crawlerId: string, spellId: string) => Promise<void>;
  onCastSpell: (crawlerId: string, spellId: string) => Promise<void>;
  onPromoteSpellToLibrary: (spell: Spell) => Promise<void>;
  isAdmin: boolean;
  currentUserId?: string;
  currentUsername?: string;
  publicSpells?: Spell[];
  onToggleSpellPublic?: (spell: Spell, isPublic: boolean) => void;
  showPublicContent?: boolean;
}

const createDefaultSpellData = (): SpellData => ({
  manaCost: 10,
  spellLevel: 1,
  school: 'Evocation',
  actionType: 'Action',
  range: 30,
  canTargetSelf: false,
  target: 'Single',
  damageDice: [{ count: 1, sides: 6 }],
  damageType: 'Fire',
});

const createDefaultSpell = (): Spell => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  tags: [],
  spellData: createDefaultSpellData(),
});

// ─── Spell Data Editor ───────────────────────────────────────────────────────

interface SpellDataEditorProps {
  spellData: SpellData;
  onChange: (updates: Partial<SpellData>) => void;
}

function SpellDataEditor({ spellData, onChange }: SpellDataEditorProps) {
  const sd = spellData;

  const updateDamageDie = (index: number, updates: Partial<WeaponDie>) => {
    const updated = [...(sd.damageDice ?? [])];
    updated[index] = { ...updated[index], ...updates };
    onChange({ damageDice: updated });
  };

  return (
    <div className="space-y-3">
      {/* Mana Cost, Spell Level, School */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Mana Cost</label>
          <input
            type="number"
            min={0}
            value={sd.manaCost}
            onChange={(e) => onChange({ manaCost: parseInt(e.target.value) || 0 })}
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Spell Level</label>
          <select
            value={sd.spellLevel}
            onChange={(e) => onChange({ spellLevel: parseInt(e.target.value) })}
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">School</label>
          <select
            value={sd.school}
            onChange={(e) => onChange({ school: e.target.value as SpellSchool })}
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          >
            {SPELL_SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Action Type, Target, Range */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Action Type</label>
          <select
            value={sd.actionType}
            onChange={(e) => onChange({ actionType: e.target.value as SpellActionType })}
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          >
            {SPELL_ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Target</label>
          <select
            value={sd.target}
            onChange={(e) => onChange({ target: e.target.value as SpellData['target'] })}
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          >
            {(['Single', 'Area', 'Self', 'Multiple'] as const).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Range</label>
          <select
            value={typeof sd.range === 'number' ? 'ft' : sd.range}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'Self' || v === 'Touch') onChange({ range: v });
              else onChange({ range: typeof sd.range === 'number' ? sd.range : 30 });
            }}
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          >
            <option value="ft">Feet</option>
            <option value="Self">Self</option>
            <option value="Touch">Touch</option>
          </select>
          {typeof sd.range === 'number' && (
            <input
              type="number"
              min={0}
              value={sd.range}
              onChange={(e) => onChange({ range: parseInt(e.target.value) || 0 })}
              className="bg-muted border border-border px-2 py-1 text-xs w-full mt-1"
              placeholder="feet"
            />
          )}
        </div>
      </div>

      {/* Can Target Self */}
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={sd.canTargetSelf}
          onChange={(e) => onChange({ canTargetSelf: e.target.checked })}
          className="w-3.5 h-3.5"
        />
        <span className="text-muted-foreground">Caster can target themselves</span>
      </label>

      {/* Area of Effect (if target is Area) */}
      {sd.target === 'Area' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">AoE Shape</label>
            <select
              value={sd.areaOfEffect?.shape ?? 'sphere'}
              onChange={(e) => onChange({ areaOfEffect: { shape: e.target.value as 'sphere' | 'cone' | 'line' | 'cube', size: sd.areaOfEffect?.size ?? 10 } })}
              className="bg-muted border border-border px-2 py-1 text-xs w-full"
            >
              {(['sphere', 'cone', 'line', 'cube'] as const).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">AoE Size (ft)</label>
            <input
              type="number"
              min={1}
              value={sd.areaOfEffect?.size ?? 10}
              onChange={(e) => onChange({ areaOfEffect: { shape: sd.areaOfEffect?.shape ?? 'sphere', size: parseInt(e.target.value) || 10 } })}
              className="bg-muted border border-border px-2 py-1 text-xs w-full"
            />
          </div>
        </div>
      )}

      {/* Damage Type */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Damage / Effect Type</label>
        <select
          value={sd.damageType ?? ''}
          onChange={(e) => onChange({ damageType: e.target.value ? e.target.value as SpellDamageType : undefined })}
          className="bg-muted border border-border px-2 py-1 text-xs w-full"
        >
          <option value="">— None —</option>
          {SPELL_DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Damage Dice */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Damage / Effect Dice</label>
        {(sd.damageDice ?? []).map((die, i) => (
          <div key={i} className="flex items-center gap-1 mb-1">
            <input
              type="number" min={1} max={20} value={die.count}
              onChange={(e) => updateDamageDie(i, { count: parseInt(e.target.value) || 1 })}
              className="w-12 bg-muted border border-border px-1 py-0.5 text-xs text-center"
            />
            <span className="text-xs text-muted-foreground">d</span>
            <select
              value={die.sides}
              onChange={(e) => updateDamageDie(i, { sides: parseInt(e.target.value) })}
              className="bg-muted border border-border px-1 py-0.5 text-xs"
            >
              {[4, 6, 8, 10, 12, 20].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(sd.damageDice ?? []).length > 1 && (
              <button
                type="button"
                onClick={() => onChange({ damageDice: (sd.damageDice ?? []).filter((_, j) => j !== i) })}
                className="text-destructive hover:text-destructive/70"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ damageDice: [...(sd.damageDice ?? []), { count: 1, sides: 6 }] })}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add die
        </button>
        <button
          type="button"
          onClick={() => onChange({ damageDice: [] })}
          className="text-xs text-muted-foreground hover:underline flex items-center gap-1 ml-3"
        >
          Clear dice
        </button>
      </div>

      {/* Bonus Hit Die */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Bonus Hit Die (added to spell attack d20)</label>
        <div className="flex items-center gap-1">
          <input
            type="number" min={0} max={10} value={sd.hitDie?.count ?? 0}
            onChange={(e) => {
              const count = parseInt(e.target.value) || 0;
              onChange({ hitDie: count > 0 ? { count, sides: sd.hitDie?.sides ?? 4 } : undefined });
            }}
            className="w-12 bg-muted border border-border px-1 py-0.5 text-xs text-center"
          />
          <span className="text-xs text-muted-foreground">d</span>
          <select
            value={sd.hitDie?.sides ?? 4}
            onChange={(e) => onChange({
              hitDie: (sd.hitDie?.count ?? 0) > 0
                ? { count: sd.hitDie!.count, sides: parseInt(e.target.value) }
                : undefined
            })}
            className="bg-muted border border-border px-1 py-0.5 text-xs"
          >
            {[4, 6, 8, 10, 12, 20].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Hit Stat Modifiers */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Hit Roll Stat Modifiers</label>
        <div className="flex gap-3">
          {(['str', 'dex', 'con', 'int', 'cha'] as const).map((stat) => (
            <label key={stat} className="flex items-center gap-1 text-[10px] cursor-pointer">
              <input
                type="checkbox"
                checked={!!sd.hitModifiers?.[stat]}
                onChange={(e) => onChange({ hitModifiers: { ...sd.hitModifiers, [stat]: e.target.checked ? 1 : undefined } })}
                className="w-3.5 h-3.5"
              />
              <span className="text-muted-foreground uppercase">{stat}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Damage Stat Modifiers */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Damage Stat Modifiers</label>
        <div className="flex gap-3">
          {(['str', 'dex', 'con', 'int', 'cha'] as const).map((stat) => (
            <label key={stat} className="flex items-center gap-1 text-[10px] cursor-pointer">
              <input
                type="checkbox"
                checked={!!sd.damageModifiers?.[stat]}
                onChange={(e) => onChange({ damageModifiers: { ...sd.damageModifiers, [stat]: e.target.checked ? 1 : undefined } })}
                className="w-3.5 h-3.5"
              />
              <span className="text-muted-foreground uppercase">{stat}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Combat Turns</label>
          <input
            type="number" min={0} value={sd.duration?.combatTurns ?? ''}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              onChange({ duration: { ...sd.duration, combatTurns: isNaN(v) ? undefined : v } });
            }}
            placeholder="—"
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Noncombat Turns</label>
          <input
            type="number" min={0} value={sd.duration?.noncombatTurns ?? ''}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              onChange({ duration: { ...sd.duration, noncombatTurns: isNaN(v) ? undefined : v } });
            }}
            placeholder="—"
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Duration Label</label>
          <input
            type="text"
            value={sd.duration?.description ?? ''}
            onChange={(e) => onChange({ duration: { ...sd.duration, description: e.target.value || undefined } })}
            placeholder="e.g. Instant"
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          />
        </div>
      </div>

      {/* Saving Throw, Splash Damage */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Saving Throw</label>
          <input
            type="text"
            value={sd.savingThrow ?? ''}
            onChange={(e) => onChange({ savingThrow: e.target.value || undefined })}
            placeholder="e.g. DEX, CON"
            className="bg-muted border border-border px-2 py-1 text-xs w-full"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={sd.splashDamage ?? false}
              onChange={(e) => onChange({ splashDamage: e.target.checked || undefined })}
              className="w-3.5 h-3.5"
            />
            <span className="text-muted-foreground">Splash damage (multi-target)</span>
          </label>
        </div>
      </div>

      {/* Special Effect */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Special Effect</label>
        <textarea
          value={sd.specialEffect ?? ''}
          onChange={(e) => onChange({ specialEffect: e.target.value || undefined })}
          placeholder="e.g. On hit: target is stunned for 1 round"
          className="bg-muted border border-border px-2 py-1 text-xs w-full resize-none"
          rows={2}
        />
      </div>
    </div>
  );
}

// ─── Spell Card (library display) ────────────────────────────────────────────

function SpellCard({
  spell,
  isAdmin,
  onEdit,
  onDelete,
  onGrant,
  crawlers,
  currentUserId,
  onTogglePublic,
}: {
  spell: Spell;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onGrant: (crawlerId: string) => void;
  crawlers: Crawler[];
  currentUserId?: string;
  onTogglePublic?: (isPublic: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showGrantMenu, setShowGrantMenu] = useState(false);
  const sd = spell.spellData;

  const diceStr = (sd.damageDice ?? []).map(d => `${d.count}d${d.sides}`).join(' + ');
  const rangeStr = typeof sd.range === 'number' ? `${sd.range} ft` : sd.range;
  const durationParts: string[] = [];
  if (sd.duration?.combatTurns) durationParts.push(`${sd.duration.combatTurns} combat turns`);
  if (sd.duration?.noncombatTurns) durationParts.push(`${sd.duration.noncombatTurns} noncombat turns`);
  if (sd.duration?.description) durationParts.push(sd.duration.description);

  return (
    <DungeonCard className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 text-left flex-1 min-w-0"
          onClick={() => setExpanded(!expanded)}
        >
          <Wand2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-sm font-display text-primary truncate">{spell.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            Lvl {sd.spellLevel} {sd.school}
          </span>
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-accent font-display">{sd.manaCost} MP</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">{sd.actionType}</span>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1.5 border-t border-border/50 pt-2 text-xs">
          <p className="text-muted-foreground">{spell.description}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div><span className="text-muted-foreground">Range: </span>{rangeStr}</div>
            <div><span className="text-muted-foreground">Target: </span>{sd.target}</div>
            {sd.target === 'Area' && sd.areaOfEffect && (
              <div><span className="text-muted-foreground">AoE: </span>{sd.areaOfEffect.size}ft {sd.areaOfEffect.shape}</div>
            )}
            {diceStr && <div><span className="text-muted-foreground">Dice: </span><span className="text-destructive">{diceStr}</span></div>}
            {sd.damageType && <div><span className="text-muted-foreground">Type: </span>{sd.damageType}</div>}
            {sd.savingThrow && <div><span className="text-muted-foreground">Save: </span>{sd.savingThrow}</div>}
            {durationParts.length > 0 && <div className="col-span-2"><span className="text-muted-foreground">Duration: </span>{durationParts.join(', ')}</div>}
            {sd.canTargetSelf && <div className="col-span-2 text-muted-foreground italic">Can target self</div>}
            {sd.splashDamage && <div className="col-span-2 text-muted-foreground italic">Splash damage</div>}
          </div>
          {sd.specialEffect && (
            <div className="text-accent italic text-[11px]">
              <span className="text-muted-foreground not-italic">Special: </span>{sd.specialEffect}
            </div>
          )}
          {(spell.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {spell.tags!.map(tag => (
                <span key={tag} className="text-[9px] border border-border px-1 text-muted-foreground">{tag}</span>
              ))}
            </div>
          )}

          {/* Creator + public toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {spell.createdByUsername && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Globe className="w-2.5 h-2.5" /> by {spell.createdByUsername}
              </span>
            )}
            {currentUserId && spell.createdBy === currentUserId && onTogglePublic && (
              <button
                type="button"
                onClick={() => onTogglePublic(!spell.isPublic)}
                className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 border transition-colors ${
                  spell.isPublic
                    ? 'border-primary/50 text-primary hover:bg-primary/10'
                    : 'border-border text-muted-foreground hover:border-primary/30 hover:text-primary'
                }`}
              >
                {spell.isPublic
                  ? <><Globe className="w-2.5 h-2.5" /> Public</>
                  : <><Lock className="w-2.5 h-2.5" /> Private</>
                }
              </button>
            )}
          </div>

          {isAdmin && (
            <div className="flex gap-2 pt-1 relative">
              <DungeonButton variant="ghost" size="sm" onClick={onEdit} className="text-xs">Edit</DungeonButton>
              <DungeonButton
                variant="ghost"
                size="sm"
                className="text-xs text-primary"
                onClick={() => setShowGrantMenu(!showGrantMenu)}
              >
                Grant to Crawler
              </DungeonButton>
              <DungeonButton variant="ghost" size="sm" onClick={onDelete} className="text-xs text-destructive">Delete</DungeonButton>

              {showGrantMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-background border-2 border-primary shadow-lg z-10">
                  <div className="py-1">
                    {crawlers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { onGrant(c.id); setShowGrantMenu(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10 transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </DungeonCard>
  );
}

// ─── Known Spell Card (per-crawler) ──────────────────────────────────────────

function KnownSpellCard({
  knownSpell,
  spell,
  isAdmin,
  onForget,
  onCast,
  onPromoteToLibrary,
}: {
  knownSpell: KnownSpell;
  spell?: Spell;
  isAdmin: boolean;
  onForget: () => void;
  onCast: () => void;
  onPromoteToLibrary?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const masteryLevel = getSpellMasteryLevel(knownSpell.castCount);
  const isCustom = !spell; // embedded custom spell, not in library
  const effectiveMana = spell
    ? getEffectiveManaCost(spell.spellData.manaCost, masteryLevel)
    : 0;
  const castsUntilNext = getCastsUntilNextMastery(knownSpell.castCount);

  const learnedFromLabel: Record<string, string> = {
    tome: 'Tome',
    quest: 'Quest',
    level: 'Level Up',
    race: 'Race',
    class: 'Class',
    granted: 'Granted',
  };

  return (
    <DungeonCard className="p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 text-left flex-1 min-w-0"
          onClick={() => setExpanded(!expanded)}
        >
          <Wand2 className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-sm font-display text-accent truncate">{knownSpell.spellName}</span>
          {masteryLevel > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-accent shrink-0">
              <Star className="w-2.5 h-2.5" />M{masteryLevel}
            </span>
          )}
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />}
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {spell && (
            <span className="text-[10px] text-accent font-display">{effectiveMana} MP</span>
          )}
          <DungeonButton variant="default" size="sm" className="text-xs h-6 px-2" onClick={onCast}>
            Cast
          </DungeonButton>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 pt-2 space-y-1.5 text-xs">
          {/* Cast tracker */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              Casts: <span className="text-foreground">{knownSpell.castCount}</span>
            </span>
            {masteryLevel === 0 ? (
              <span className="text-muted-foreground">{castsUntilNext} casts until Mastery 1</span>
            ) : (
              <span className="text-muted-foreground">{castsUntilNext} casts until Mastery {masteryLevel + 1}</span>
            )}
          </div>

          {/* Mastery discount info */}
          {spell && masteryLevel > 0 && (
            <div className="text-[11px] text-accent">
              Base cost: {spell.spellData.manaCost} MP → {effectiveMana} MP (M{masteryLevel} discount)
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Learned: </span>
            <span>{learnedFromLabel[knownSpell.learnedFrom] ?? knownSpell.learnedFrom}</span>
          </div>

          {spell && (
            <div className="space-y-1">
              <p className="text-muted-foreground">{spell.description}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div><span className="text-muted-foreground">Action: </span>{spell.spellData.actionType}</div>
                <div><span className="text-muted-foreground">Range: </span>
                  {typeof spell.spellData.range === 'number' ? `${spell.spellData.range} ft` : spell.spellData.range}
                </div>
                {spell.spellData.damageType && (
                  <div><span className="text-muted-foreground">Type: </span>{spell.spellData.damageType}</div>
                )}
                {(spell.spellData.damageDice ?? []).length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Dice: </span>
                    <span className="text-destructive">
                      {spell.spellData.damageDice!.map(d => `${d.count}d${d.sides}`).join(' + ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {isCustom && (
            <p className="text-[10px] text-muted-foreground italic">Custom spell — not in library</p>
          )}

          <div className="flex gap-2 pt-1">
            {isAdmin && isCustom && onPromoteToLibrary && (
              <DungeonButton variant="ghost" size="sm" className="text-xs text-primary" onClick={onPromoteToLibrary}>
                Add to Library
              </DungeonButton>
            )}
            {isAdmin && (
              <DungeonButton variant="ghost" size="sm" className="text-xs text-destructive" onClick={onForget}>
                Forget
              </DungeonButton>
            )}
          </div>
        </div>
      )}
    </DungeonCard>
  );
}

// ─── Spell Editor Modal ───────────────────────────────────────────────────────

function SpellEditorModal({
  spell,
  onSave,
  onClose,
}: {
  spell: Spell;
  onSave: (spell: Spell) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Spell>(spell);
  const [tagInput, setTagInput] = useState('');

  const updateSpellData = (updates: Partial<SpellData>) => {
    setDraft(prev => ({ ...prev, spellData: { ...prev.spellData, ...updates } }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    setDraft(prev => ({ ...prev, tags: [...(prev.tags ?? []), tag] }));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setDraft(prev => ({ ...prev, tags: (prev.tags ?? []).filter(t => t !== tag) }));
  };

  const isValid = draft.name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background border-2 border-primary w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <h2 className="font-display text-primary text-sm">
            {draft.id === spell.id && draft.name ? `Edit: ${draft.name}` : 'New Spell'}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Name & Description */}
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">Spell Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Fireball"
                className="bg-muted border border-border px-2 py-1 text-sm w-full"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">Description</label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what the spell does..."
                className="bg-muted border border-border px-2 py-1 text-xs w-full resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {(draft.tags ?? []).map(tag => (
                <span key={tag} className="flex items-center gap-1 text-[10px] border border-border px-1.5 py-0.5 text-muted-foreground">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tag..."
                className="bg-muted border border-border px-2 py-1 text-xs flex-1"
              />
              <DungeonButton type="button" variant="ghost" size="sm" onClick={addTag} className="text-xs">
                Add
              </DungeonButton>
            </div>
          </div>

          {/* Spell Data */}
          <div className="border border-primary/30 bg-primary/5 p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs text-primary font-display">
              <Zap className="w-4 h-4" />
              SPELL CONFIG
            </div>
            <SpellDataEditor spellData={draft.spellData} onChange={updateSpellData} />
          </div>

          <div className="flex gap-2 pt-2">
            <DungeonButton
              variant="default"
              size="sm"
              onClick={() => isValid && onSave(draft)}
              disabled={!isValid}
              className="flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Save Spell
            </DungeonButton>
            <DungeonButton variant="ghost" size="sm" onClick={onClose}>Cancel</DungeonButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main SpellsView ──────────────────────────────────────────────────────────

const SpellsView: React.FC<SpellsViewProps> = ({
  crawlers,
  spells,
  onAddSpell,
  onUpdateSpell,
  onDeleteSpell,
  onLearnSpell,
  onForgetSpell,
  onCastSpell,
  onPromoteSpellToLibrary,
  isAdmin,
  currentUserId,
  currentUsername,
  publicSpells = [],
  onToggleSpellPublic,
  showPublicContent = false,
}) => {
  const [selectedCrawlerId, setSelectedCrawlerId] = useState<string>(crawlers[0]?.id ?? '');
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('');

  const selectedCrawler = crawlers.find(c => c.id === selectedCrawlerId);

  const filteredSpells = spells.filter(s => {
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (schoolFilter && s.spellData.school !== schoolFilter) return false;
    return true;
  });

  const handleSaveSpell = async (spell: Spell) => {
    const exists = spells.some(s => s.id === spell.id);
    if (exists) {
      await onUpdateSpell(spell.id, spell);
    } else {
      const newSpell: Spell = {
        ...spell,
        ...(currentUserId ? { createdBy: currentUserId, createdByUsername: currentUsername } : {}),
        isPublic: false,
      };
      await onAddSpell(newSpell);
    }
    setEditingSpell(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display text-primary text-glow-cyan flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          SPELLS
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── LEFT: Spell Library ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display text-muted-foreground">SPELL LIBRARY</h2>
            {isAdmin && (
              <DungeonButton
                variant="default"
                size="sm"
                className="flex items-center gap-1 text-xs"
                onClick={() => setEditingSpell(createDefaultSpell())}
              >
                <Plus className="w-3 h-3" /> New Spell
              </DungeonButton>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search spells..."
              className="bg-muted border border-border px-2 py-1 text-xs flex-1"
            />
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="bg-muted border border-border px-2 py-1 text-xs"
            >
              <option value="">All Schools</option>
              {SPELL_SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {filteredSpells.length === 0 ? (
            <DungeonCard className="p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {spells.length === 0
                  ? isAdmin ? 'No spells yet. Create one above.' : 'No spells in the library yet.'
                  : 'No spells match your filters.'}
              </p>
            </DungeonCard>
          ) : (
            <div className="space-y-2">
              {filteredSpells.map(spell => (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  isAdmin={isAdmin}
                  crawlers={crawlers}
                  onEdit={() => setEditingSpell({ ...spell })}
                  onDelete={() => onDeleteSpell(spell.id)}
                  onGrant={(crawlerId) => onLearnSpell(crawlerId, spell, 'granted')}
                  currentUserId={currentUserId}
                  onTogglePublic={onToggleSpellPublic ? (isPublic) => onToggleSpellPublic(spell, isPublic) : undefined}
                />
              ))}
            </div>
          )}
          {/* Community Spells */}
          {showPublicContent && publicSpells.filter(ps => !spells.some(s => s.id === ps.id)).length > 0 && (
            <div className="border border-primary/20 bg-primary/5 p-3 rounded space-y-2 mt-3">
              <h3 className="font-display text-xs text-primary flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                COMMUNITY SPELLS
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {publicSpells.filter(ps => !spells.some(s => s.id === ps.id)).map(spell => (
                  <div key={spell.id} className="flex items-center justify-between gap-2 py-1.5 px-2 border border-primary/20 bg-background/50 text-xs">
                    <div className="min-w-0">
                      <span className="font-display text-primary truncate block">{spell.name}</span>
                      <span className="text-muted-foreground">Lvl {spell.spellData.spellLevel} {spell.spellData.school}</span>
                      {spell.createdByUsername && (
                        <span className="text-[10px] text-primary/60 flex items-center gap-0.5 mt-0.5">
                          <Globe className="w-2.5 h-2.5" /> by {spell.createdByUsername}
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onAddSpell({ ...spell, id: crypto.randomUUID(), isPublic: false })}
                        className="text-primary hover:text-primary/80 shrink-0"
                        title="Add to library"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Per-Crawler Known Spells ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-display text-muted-foreground">CRAWLER SPELLS</h2>

          {/* Crawler selector */}
          {crawlers.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1">
                {crawlers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCrawlerId(c.id)}
                    className={`px-3 py-1 text-xs font-display border transition-colors ${
                      selectedCrawlerId === c.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {selectedCrawler && (
                <div className="space-y-2">
                  {/* Mana bar */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Mana:</span>
                    <span className="text-primary">{selectedCrawler.mana} / {selectedCrawler.maxMana}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (selectedCrawler.mana / (selectedCrawler.maxMana || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Known spells list */}
                  {(selectedCrawler.knownSpells ?? []).length === 0 ? (
                    <DungeonCard className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        {selectedCrawler.name} doesn&apos;t know any spells yet.
                      </p>
                    </DungeonCard>
                  ) : (
                    <div className="space-y-2">
                      {(selectedCrawler.knownSpells ?? []).map(ks => {
                        const libSpell = spells.find(s => s.id === ks.spellId);
                        return (
                          <KnownSpellCard
                            key={ks.spellId}
                            knownSpell={ks}
                            spell={libSpell}
                            isAdmin={isAdmin}
                            onForget={() => onForgetSpell(selectedCrawler.id, ks.spellId)}
                            onCast={() => onCastSpell(selectedCrawler.id, ks.spellId)}
                            onPromoteToLibrary={
                              !libSpell
                                ? () => {
                                    const custom = (selectedCrawler.knownSpells ?? [])
                                      .find(k => k.spellId === ks.spellId);
                                    if (custom) {
                                      // We'd need the customSpell object; in practice this is on the tome item
                                      // For now just show a placeholder path
                                    }
                                  }
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <DungeonCard className="p-4 text-center">
              <p className="text-xs text-muted-foreground">No crawlers found.</p>
            </DungeonCard>
          )}
        </div>
      </div>

      {/* Spell Editor Modal */}
      {editingSpell && (
        <SpellEditorModal
          spell={editingSpell}
          onSave={handleSaveSpell}
          onClose={() => setEditingSpell(null)}
        />
      )}
    </motion.div>
  );
};

export default SpellsView;
export { SpellDataEditor };
