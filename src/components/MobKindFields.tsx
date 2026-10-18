import React from "react";
import { getMobKind, isBossMob, legacyMobType, type Mob, type MobKind } from "@/lib/gameData";

type KindFields = Pick<Mob, "kind" | "boss" | "speciesId" | "type">;

interface MobKindFieldsProps {
  value: Partial<Mob>;
  /** Called with kind, boss, speciesId and the matching legacy type */
  onChange: (next: KindFields) => void;
  /** Creatures a character can be ("Grimble is a Goblin") */
  creatures: Mob[];
  compact?: boolean;
}

/** Creature (a template, placed as many times as you like) or Character (unique, part of the story), plus Boss. */
export const MobKindFields: React.FC<MobKindFieldsProps> = ({ value, onChange, creatures, compact = false }) => {
  const kind = getMobKind(value);
  const boss = isBossMob(value);
  const inputClass = `w-full bg-muted border border-border ${compact ? "px-2 py-1 text-sm" : "px-3 py-2"}`;

  const emit = (nextKind: MobKind, nextBoss: boolean, speciesId: string | undefined) =>
    onChange({
      kind: nextKind,
      boss: nextBoss,
      // Only characters belong to a species. '' (not undefined) so an update clears the old one.
      speciesId: nextKind === "character" ? speciesId ?? "" : "",
      type: legacyMobType(nextKind, nextBoss),
    });

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Kind</label>
        <select
          value={kind}
          onChange={(e) => emit(e.target.value as MobKind, boss, value.speciesId)}
          className={inputClass}
          title="Creatures are templates you can place many times; characters are unique and part of the story"
        >
          <option value="creature">Creature</option>
          <option value="character">Character</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={boss}
          onChange={(e) => emit(kind, e.target.checked, value.speciesId)}
          className="w-4 h-4"
        />
        <span className="text-destructive font-semibold">Boss</span>
      </label>
      {kind === "character" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Is a (optional)</label>
          <select
            value={value.speciesId ?? ""}
            onChange={(e) => emit(kind, boss, e.target.value)}
            className={inputClass}
            title="Meeting this character also reveals that creature in players' Mob Profiles"
          >
            <option value="">None</option>
            {creatures.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default MobKindFields;
