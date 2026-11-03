import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, ChevronDown, ChevronUp, Copy, Globe, Lock, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { DungeonCard } from "@/components/ui/DungeonCard";
import PixelIcon from "@/components/ui/PixelIcon";
import IconRegenerateButton from "@/components/IconRegenerateButton";
import { LanguageSelect } from "@/components/LanguagePicker";
import { useLanguages } from "@/contexts/LanguagesContext";
import type { IconSubject } from "@/lib/iconGen";
import {
  ABILITY_ACTIVATIONS,
  ABILITY_KEYS,
  ABILITY_USES,
  CHECK_DIFFICULTIES,
  DAMAGE_TYPES,
  SKILLS,
  SPELL_CONDITIONS,
  type Ability,
  type AbilityActivation,
  type AbilityEffect,
  type AbilityEffectType,
  type AbilityKey,
  type AbilityUses,
  type CheckDifficultyId,
  type SkillId,
  type StatModifiers,
} from "@/lib/gameData";
import {
  ABILITY_EFFECT_TYPES,
  BUILT_IN_ABILITIES,
  STAT_NAMES,
  copyAbility,
  createDefaultAbility,
  describeAbilityEffect,
  describeAbilityRoll,
  describeAbilityUses,
  isBuiltInAbility,
  newAbilityEffect,
} from "@/lib/abilities";

type SaveTarget = 'campaign' | 'mine';

interface AbilitiesViewProps {
  abilities: Ability[];
  myAbilities: Ability[];
  isAdmin: boolean;
  currentUserId?: string;
  currentUsername?: string;
  onAddAbility: (ability: Ability) => Promise<void>;
  onUpdateAbility: (id: string, updates: Partial<Ability>) => Promise<void>;
  onDeleteAbility: (id: string) => Promise<void>;
  onSaveMyAbility: (ability: Ability) => Promise<void>;
  onDeleteMyAbility: (id: string) => Promise<void>;
  iconImages?: Record<string, string>;
  onRegenerateIcon?: (subject: IconSubject) => Promise<{ id: string; image: string } | null>;
}

const inputClass = "bg-muted border border-border px-2 py-1 text-xs w-full";
const labelClass = "text-[10px] text-muted-foreground block mb-0.5";
const num = (value: string, fallback = 0) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
const STAT_MOD_KEYS: (keyof StatModifiers)[] = ['str', 'dex', 'con', 'int', 'cha', 'maxHP', 'maxMana'];

/** Comma-separated list input that keeps what's typed (trailing commas included) while editing. */
const CommaListInput: React.FC<{ value?: string[]; onChange: (list: string[]) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => {
  const [text, setText] = useState((value ?? []).join(', '));
  return (
    <input
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean));
      }}
      className={inputClass}
    />
  );
};

// ─── Effect editor ───────────────────────────────────────────────────────────

const EffectEditor: React.FC<{ effect: AbilityEffect; onChange: (effect: AbilityEffect) => void }> = ({ effect, onChange }) => {
  switch (effect.type) {
    case 'dice':
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Used for</label>
              <select value={effect.purpose} onChange={(e) => onChange({ ...effect, purpose: e.target.value as typeof effect.purpose })} className={inputClass}>
                <option value="damage">Damage</option>
                <option value="healing">Healing</option>
                <option value="attack">Attack roll bonus</option>
              </select>
            </div>
            {effect.purpose === 'damage' && (
              <div>
                <label className={labelClass}>Damage type</label>
                <select value={effect.damageType ?? 'Basic'} onChange={(e) => onChange({ ...effect, damageType: e.target.value })} className={inputClass}>
                  {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
          {effect.dice.map((die, i) => (
            <div key={i} className="flex items-center gap-1">
              <input type="number" min={0} value={die.count} aria-label="Number of dice"
                onChange={(e) => onChange({ ...effect, dice: effect.dice.map((d, j) => (j === i ? { ...d, count: num(e.target.value) } : d)) })}
                className="bg-muted border border-border px-2 py-1 text-xs w-14" />
              <span className="text-xs text-muted-foreground">d</span>
              <select value={die.sides} aria-label="Die size"
                onChange={(e) => onChange({ ...effect, dice: effect.dice.map((d, j) => (j === i ? { ...d, sides: num(e.target.value, 6) } : d)) })}
                className="bg-muted border border-border px-2 py-1 text-xs w-16">
                {[4, 6, 8, 10, 12, 20, 100].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {effect.dice.length > 1 && (
                <button type="button" aria-label="Remove die" onClick={() => onChange({ ...effect, dice: effect.dice.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => onChange({ ...effect, dice: [...effect.dice, { count: 1, sides: 6 }] })} className="text-[10px] text-primary hover:underline">
            + Add a die
          </button>
        </div>
      );
    case 'condition':
      return (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className={labelClass}>Condition</label>
            <input list="ability-conditions" value={effect.condition} onChange={(e) => onChange({ ...effect, condition: e.target.value })} className={inputClass} />
            <datalist id="ability-conditions">
              {SPELL_CONDITIONS.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Turns</label>
            <input type="number" min={1} value={effect.turns} onChange={(e) => onChange({ ...effect, turns: Math.max(1, num(e.target.value, 1)) })} className={inputClass} />
          </div>
          <div className="col-span-3">
            <label className={labelClass}>What it does (optional)</label>
            <input value={effect.description ?? ''} placeholder="Disadvantage on attacks" onChange={(e) => onChange({ ...effect, description: e.target.value || undefined })} className={inputClass} />
          </div>
        </div>
      );
    case 'stat':
      return (
        <div className="grid grid-cols-4 gap-2">
          {STAT_MOD_KEYS.map(key => (
            <div key={key}>
              <label className={labelClass}>{key === 'maxHP' ? 'Max HP' : key === 'maxMana' ? 'Max mana' : key.toUpperCase()}</label>
              <input type="number" value={effect.mods[key] ?? 0}
                onChange={(e) => {
                  const mods = { ...effect.mods, [key]: num(e.target.value) };
                  if (!mods[key]) delete mods[key];
                  onChange({ ...effect, mods });
                }}
                className={inputClass} />
            </div>
          ))}
        </div>
      );
    case 'language':
      return (
        <div>
          <label className={labelClass}>Language</label>
          <LanguageSelect value={effect.language || undefined} onChange={(id) => onChange({ ...effect, language: id ?? '' })}
            noneLabel="Pick a language" optionLabel={(name) => name} ariaLabel="Language granted" className={inputClass} />
        </div>
      );
    case 'defense':
      return (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelClass}>Armor rating</label>
            <input type="number" value={effect.armorRating ?? 0} onChange={(e) => onChange({ ...effect, armorRating: num(e.target.value) || undefined })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Resists</label>
            <CommaListInput value={effect.resist} placeholder="Fire, Bows" onChange={(resist) => onChange({ ...effect, resist: resist.length ? resist : undefined })} />
          </div>
          <div>
            <label className={labelClass}>Vulnerable to</label>
            <CommaListInput value={effect.vulnerable} placeholder="Electric" onChange={(vulnerable) => onChange({ ...effect, vulnerable: vulnerable.length ? vulnerable : undefined })} />
          </div>
        </div>
      );
    case 'movement':
      return (
        <div className="w-32">
          <label className={labelClass}>Feet (minus slows)</label>
          <input type="number" step={5} value={effect.feet} onChange={(e) => onChange({ ...effect, feet: num(e.target.value) })} className={inputClass} />
        </div>
      );
    case 'text':
      return (
        <textarea value={effect.text} rows={2} placeholder="Can breathe underwater for an hour" onChange={(e) => onChange({ ...effect, text: e.target.value })} className={inputClass} />
      );
  }
};

// ─── Ability editor ──────────────────────────────────────────────────────────

interface AbilityEditorProps {
  initial: Ability;
  isNew: boolean;
  canSaveToMine: boolean;
  initialTarget: SaveTarget;
  iconSrc?: string;
  onRegenerateIcon?: (subject: IconSubject) => Promise<{ id: string; image: string } | null>;
  onSave: (ability: Ability, target: SaveTarget) => Promise<void>;
  onCancel: () => void;
}

const AbilityEditor: React.FC<AbilityEditorProps> = ({ initial, isNew, canSaveToMine, initialTarget, iconSrc, onRegenerateIcon, onSave, onCancel }) => {
  const [draft, setDraft] = useState<Ability>(initial);
  const [tagsText, setTagsText] = useState((initial.tags ?? []).join(', '));
  const [target, setTarget] = useState<SaveTarget>(initialTarget);
  const [addType, setAddType] = useState<AbilityEffectType | ''>('');
  const [saving, setSaving] = useState(false);

  const set = (updates: Partial<Ability>) => setDraft(prev => ({ ...prev, ...updates }));
  const rangeKind = draft.range === undefined ? 'none' : typeof draft.range === 'number' ? 'feet' : draft.range;

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
      await onSave({
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        tags: tags.length ? tags : undefined,
        trigger: draft.activation === 'Reaction' ? draft.trigger?.trim() || undefined : undefined,
        usesCount: draft.uses === 'atWill' ? undefined : Math.max(1, draft.usesCount ?? 1),
        cost: draft.cost && (draft.cost.mana || draft.cost.hp) ? draft.cost : undefined,
      }, target);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DungeonCard className="p-4 space-y-3 border-primary">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-primary text-sm">{isNew ? (draft.copiedFrom ? 'Make my own copy' : 'New ability') : 'Edit ability'}</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="text-muted-foreground hover:text-primary"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex items-start gap-3">
        {onRegenerateIcon && !isNew && (
          <IconRegenerateButton iconSrc={iconSrc} alt={draft.name || 'Ability'} onRegenerate={() => onRegenerateIcon({ kind: 'ability', ability: draft })} onIconChange={(iconId) => set({ iconId })} />
        )}
        <div className="flex-1">
          <label className={labelClass}>Name</label>
          <input value={draft.name} placeholder="Unlock a Door" onChange={(e) => set({ name: e.target.value })} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea value={draft.description} rows={2} placeholder="What it is and how it looks at the table" onChange={(e) => set({ description: e.target.value })} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className={labelClass}>Uses up</label>
          <select value={draft.activation} onChange={(e) => set({ activation: e.target.value as AbilityActivation })} className={inputClass}>
            {ABILITY_ACTIVATIONS.map(a => <option key={a} value={a}>{a === 'Passive' ? 'Nothing (passive)' : a}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>How often</label>
          <select value={draft.uses} onChange={(e) => set({ uses: e.target.value as AbilityUses })} className={inputClass}>
            {ABILITY_USES.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
        {draft.uses !== 'atWill' && (
          <div>
            <label className={labelClass}>Times</label>
            <input type="number" min={1} value={draft.usesCount ?? 1} onChange={(e) => set({ usesCount: Math.max(1, num(e.target.value, 1)) })} className={inputClass} />
          </div>
        )}
      </div>

      {draft.activation === 'Reaction' && (
        <div>
          <label className={labelClass}>Trigger</label>
          <input value={draft.trigger ?? ''} placeholder="When an attack would hit you" onChange={(e) => set({ trigger: e.target.value })} className={inputClass} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className={labelClass}>Mana cost</label>
          <input type="number" min={0} value={draft.cost?.mana ?? 0} onChange={(e) => set({ cost: { ...draft.cost, mana: num(e.target.value) || undefined } })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>HP cost</label>
          <input type="number" min={0} value={draft.cost?.hp ?? 0} onChange={(e) => set({ cost: { ...draft.cost, hp: num(e.target.value) || undefined } })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Range</label>
          <select value={rangeKind}
            onChange={(e) => {
              const v = e.target.value;
              set({ range: v === 'none' ? undefined : v === 'feet' ? 30 : (v as 'Self' | 'Touch') });
            }}
            className={inputClass}>
            <option value="none">Not needed</option>
            <option value="Self">Self</option>
            <option value="Touch">Touch</option>
            <option value="feet">Feet</option>
          </select>
        </div>
        {typeof draft.range === 'number' && (
          <div>
            <label className={labelClass}>Feet</label>
            <input type="number" min={0} step={5} value={draft.range} onChange={(e) => set({ range: num(e.target.value) })} className={inputClass} />
          </div>
        )}
      </div>

      {/* The roll */}
      <div className="border border-border/60 p-2 space-y-2">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={!!draft.roll} onChange={(e) => set({ roll: e.target.checked ? { ability: 'dex' } : undefined })} />
          The user rolls a check
        </label>
        {draft.roll && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Skill</label>
              <select value={draft.roll.skill ?? ''}
                onChange={(e) => {
                  const skill = SKILLS.find(s => s.id === e.target.value);
                  set({ roll: { ...draft.roll!, skill: skill?.id as SkillId | undefined, ...(skill ? { ability: skill.ability } : {}) } });
                }}
                className={inputClass}>
                <option value="">No skill</option>
                {SKILLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Stat</label>
              <select value={draft.roll.ability} onChange={(e) => set({ roll: { ...draft.roll!, ability: e.target.value as AbilityKey } })} className={inputClass}>
                {ABILITY_KEYS.map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Difficulty</label>
              <select value={draft.roll.difficulty ?? ''}
                onChange={(e) => set({ roll: { ...draft.roll!, difficulty: (e.target.value || undefined) as CheckDifficultyId | undefined } })}
                className={inputClass}>
                <option value="">DM decides</option>
                {CHECK_DIFFICULTIES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="w-1/2">
          <label className={labelClass}>Targets resist with</label>
          <select value={draft.save ?? ''} onChange={(e) => set({ save: (e.target.value || undefined) as AbilityKey | undefined })} className={inputClass}>
            <option value="">No saving throw</option>
            {ABILITY_KEYS.map(k => <option key={k} value={k}>{STAT_NAMES[k]} save</option>)}
          </select>
        </div>
      </div>

      {/* Effects */}
      <div className="space-y-2">
        <span className="text-xs font-display text-primary">What it does</span>
        {draft.effects.length === 0 && <p className="text-[10px] text-muted-foreground">No effects yet. Add one below, or leave it to the description.</p>}
        {draft.effects.map((effect, i) => (
          <div key={i} className="border border-border/60 p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-accent">{ABILITY_EFFECT_TYPES.find(t => t.type === effect.type)?.label}</span>
              <button type="button" aria-label="Remove effect" onClick={() => set({ effects: draft.effects.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <EffectEditor effect={effect} onChange={(next) => set({ effects: draft.effects.map((e, j) => (j === i ? next : e)) })} />
          </div>
        ))}
        <div className="flex gap-2">
          <select value={addType} onChange={(e) => setAddType(e.target.value as AbilityEffectType | '')} className={inputClass} aria-label="Effect to add">
            <option value="">Add an effect...</option>
            {ABILITY_EFFECT_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
          <DungeonButton type="button" variant="ghost" size="sm" disabled={!addType}
            onClick={() => { if (addType) { set({ effects: [...draft.effects, newAbilityEffect(addType)] }); setAddType(''); } }}>
            <Plus className="w-3 h-3" />
          </DungeonButton>
        </div>
      </div>

      <div>
        <label className={labelClass}>Tags (comma separated)</label>
        <input value={tagsText} placeholder="stealth, utility" onChange={(e) => setTagsText(e.target.value)} className={inputClass} />
      </div>

      {isNew && canSaveToMine && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Save to</span>
          <label className="flex items-center gap-1"><input type="radio" checked={target === 'campaign'} onChange={() => setTarget('campaign')} /> This campaign</label>
          <label className="flex items-center gap-1"><input type="radio" checked={target === 'mine'} onChange={() => setTarget('mine')} /> My Content</label>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <DungeonButton type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</DungeonButton>
        <DungeonButton type="button" size="sm" onClick={handleSave} disabled={!draft.name.trim() || saving}>
          {saving ? 'Saving...' : 'Save'}
        </DungeonButton>
      </div>
    </DungeonCard>
  );
};

// ─── Ability card ────────────────────────────────────────────────────────────

interface AbilityCardProps {
  ability: Ability;
  iconSrc?: string;
  badge?: React.ReactNode;
  languageName: (id: string) => string;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onSaveToMine?: () => void;
  savedToMine?: boolean;
  onAddToCampaign?: () => void;
}

const AbilityCard: React.FC<AbilityCardProps> = ({ ability, iconSrc, badge, languageName, onEdit, onDelete, onCopy, onSaveToMine, savedToMine, onAddToCampaign }) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const roll = describeAbilityRoll(ability.roll);
  const range = ability.range === undefined ? null : typeof ability.range === 'number' ? `${ability.range} ft` : ability.range;
  const cost = [ability.cost?.mana ? `${ability.cost.mana} mana` : '', ability.cost?.hp ? `${ability.cost.hp} HP` : ''].filter(Boolean).join(', ');

  return (
    <DungeonCard className="p-3 space-y-2">
      <button type="button" className="flex items-center gap-2 text-left w-full min-w-0" onClick={() => setExpanded(!expanded)}>
        <PixelIcon src={iconSrc} alt={ability.name} fallback={<Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />} />
        <span className="text-sm font-display text-primary truncate">{ability.name}</span>
        {badge}
        <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">{ability.activation}</span>
        {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-border/50 pt-2 text-xs">
          {ability.description && <p className="text-muted-foreground">{ability.description}</p>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div><span className="text-muted-foreground">Uses: </span>{describeAbilityUses(ability)}</div>
            {cost && <div><span className="text-muted-foreground">Cost: </span><span className="text-accent">{cost}</span></div>}
            {range && <div><span className="text-muted-foreground">Range: </span>{range}</div>}
            {roll && <div className="col-span-2"><span className="text-muted-foreground">Roll: </span>{roll}</div>}
            {ability.save && <div className="col-span-2"><span className="text-muted-foreground">Targets resist with: </span>{STAT_NAMES[ability.save]} save</div>}
            {ability.trigger && <div className="col-span-2"><span className="text-muted-foreground">Trigger: </span><span className="text-accent italic">{ability.trigger}</span></div>}
          </div>
          {ability.effects.length > 0 && (
            <ul className="list-disc pl-4 text-[11px] text-primary space-y-0.5">
              {ability.effects.map((e, i) => <li key={i}>{describeAbilityEffect(e, languageName)}</li>)}
            </ul>
          )}
          {(ability.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ability.tags!.map(tag => <span key={tag} className="text-[9px] border border-border px-1 text-muted-foreground">{tag}</span>)}
            </div>
          )}
          {ability.createdByUsername && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" /> by {ability.createdByUsername}</span>
          )}

          <div className="flex gap-2 pt-1 flex-wrap items-center">
            {onEdit && <DungeonButton variant="ghost" size="sm" onClick={onEdit} className="text-xs">Edit</DungeonButton>}
            {onCopy && (
              <DungeonButton variant="ghost" size="sm" onClick={onCopy} className="text-xs flex items-center gap-1"><Copy className="w-3 h-3" /> Make my own copy</DungeonButton>
            )}
            {onAddToCampaign && (
              <DungeonButton variant="ghost" size="sm" onClick={onAddToCampaign} className="text-xs text-primary flex items-center gap-1"><Plus className="w-3 h-3" /> Add to campaign</DungeonButton>
            )}
            {onSaveToMine && (
              <button type="button" onClick={onSaveToMine} title={savedToMine ? 'Update the copy in My Content' : 'Save to My Content'}
                className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 border transition-colors ${savedToMine ? 'border-accent/50 text-accent hover:bg-accent/10' : 'border-border text-muted-foreground hover:border-accent/30 hover:text-accent'}`}>
                <Bookmark className="w-2.5 h-2.5" /> Mine
              </button>
            )}
            {onDelete && (confirmDelete ? (
              <span className="flex items-center gap-1">
                <DungeonButton variant="danger" size="sm" onClick={() => { setConfirmDelete(false); onDelete(); }} className="text-xs">Delete for good</DungeonButton>
                <DungeonButton variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="text-xs">Keep</DungeonButton>
              </span>
            ) : (
              <DungeonButton variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-xs text-destructive">Delete</DungeonButton>
            ))}
          </div>
        </div>
      )}
    </DungeonCard>
  );
};

// ─── View ────────────────────────────────────────────────────────────────────

type Editing = { ability: Ability; isNew: boolean; target: SaveTarget } | null;

const AbilitiesView: React.FC<AbilitiesViewProps> = ({
  abilities,
  myAbilities,
  isAdmin,
  currentUserId,
  currentUsername,
  onAddAbility,
  onUpdateAbility,
  onDeleteAbility,
  onSaveMyAbility,
  onDeleteMyAbility,
  iconImages = {},
  onRegenerateIcon,
}) => {
  const [editing, setEditing] = useState<Editing>(null);
  const [search, setSearch] = useState('');
  const [showBuiltIn, setShowBuiltIn] = useState(false);
  const { languages } = useLanguages();
  const languageName = (id: string) => languages.find(l => l.id === id)?.name ?? id;

  const matches = (a: Ability) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [a.name, a.description, ...(a.tags ?? [])].some(t => t?.toLowerCase().includes(q));
  };
  const byName = (a: Ability, b: Ability) => a.name.localeCompare(b.name);
  const campaign = useMemo(() => abilities.filter(matches).sort(byName), [abilities, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const mineOnly = useMemo(() => myAbilities.filter(m => !abilities.some(a => a.id === m.id)).filter(matches).sort(byName), [myAbilities, abilities, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const builtIn = BUILT_IN_ABILITIES.filter(matches);
  const canEditCampaign = (a: Ability) => isAdmin || (!!currentUserId && a.createdBy === currentUserId);
  const creator = currentUserId ? { createdBy: currentUserId, ...(currentUsername ? { createdByUsername: currentUsername } : {}) } : {};

  const startNew = () => setEditing({ ability: createDefaultAbility(), isNew: true, target: 'campaign' });
  const startCopy = (a: Ability) => setEditing({ ability: copyAbility(a), isNew: true, target: 'campaign' });

  const handleSave = async (ability: Ability, target: SaveTarget) => {
    if (!editing) return;
    if (editing.isNew) {
      const withCreator = { ...ability, ...creator };
      if (target === 'mine') await onSaveMyAbility(withCreator);
      else await onAddAbility(withCreator);
    } else if (editing.target === 'mine') {
      await onSaveMyAbility(ability);
    } else {
      const { id, ...updates } = ability;
      await onUpdateAbility(id, updates);
    }
    setEditing(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-display text-xl text-primary text-glow-cyan">Abilities</h2>
        </div>
        {!editing && (
          <DungeonButton size="sm" onClick={startNew} className="flex items-center gap-1"><Plus className="w-3 h-3" /> New ability</DungeonButton>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Anything someone can do: cast a fireball, speak with animals, unlock a door, dodge an attack. Make an ability once here;
        items and spells will link to it soon. Don't like how one works? Make your own copy and change it.
      </p>

      {editing && (
        <AbilityEditor
          key={editing.ability.id}
          initial={editing.ability}
          isNew={editing.isNew}
          initialTarget={editing.target}
          canSaveToMine={!!currentUserId}
          iconSrc={editing.ability.iconId ? iconImages[editing.ability.iconId] : undefined}
          onRegenerateIcon={onRegenerateIcon}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search abilities" className="bg-muted border border-border pl-7 pr-2 py-1.5 text-xs w-full" />
      </div>

      <section className="space-y-2">
        <h3 className="font-display text-sm text-accent">This campaign</h3>
        {campaign.length === 0 ? (
          <p className="text-xs text-muted-foreground">{search ? 'No matches.' : 'No abilities yet. Make the first one with New ability.'}</p>
        ) : campaign.map(a => (
          <AbilityCard
            key={a.id}
            ability={a}
            iconSrc={a.iconId ? iconImages[a.iconId] : undefined}
            languageName={languageName}
            onEdit={canEditCampaign(a) ? () => setEditing({ ability: a, isNew: false, target: 'campaign' }) : undefined}
            onDelete={canEditCampaign(a) ? () => onDeleteAbility(a.id) : undefined}
            onCopy={() => startCopy(a)}
            onSaveToMine={currentUserId && a.createdBy === currentUserId ? () => onSaveMyAbility(a) : undefined}
            savedToMine={myAbilities.some(m => m.id === a.id)}
          />
        ))}
      </section>

      {currentUserId && (
        <section className="space-y-2">
          <h3 className="font-display text-sm text-accent flex items-center gap-1"><Lock className="w-3 h-3" /> My Content</h3>
          <p className="text-[10px] text-muted-foreground">Only you see these. Add one to the campaign to share it with the party.</p>
          {mineOnly.length === 0 ? (
            <p className="text-xs text-muted-foreground">{search ? 'No matches.' : 'Nothing here yet. Pick "My Content" when you save a new ability.'}</p>
          ) : mineOnly.map(a => (
            <AbilityCard
              key={a.id}
              ability={a}
              iconSrc={a.iconId ? iconImages[a.iconId] : undefined}
              languageName={languageName}
              onEdit={() => setEditing({ ability: a, isNew: false, target: 'mine' })}
              onDelete={() => onDeleteMyAbility(a.id)}
              onCopy={() => startCopy(a)}
              onAddToCampaign={() => onAddAbility(a)}
            />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <button type="button" onClick={() => setShowBuiltIn(!showBuiltIn)} className="font-display text-sm text-accent flex items-center gap-1">
          {showBuiltIn ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Everyone has these ({builtIn.length})
        </button>
        {showBuiltIn && builtIn.map(a => (
          <AbilityCard
            key={a.id}
            ability={a}
            languageName={languageName}
            badge={<span className="text-[9px] border border-border px-1 text-muted-foreground shrink-0">Built in</span>}
            onCopy={isBuiltInAbility(a) ? () => startCopy(a) : undefined}
          />
        ))}
      </section>
    </motion.div>
  );
};

export default AbilitiesView;
