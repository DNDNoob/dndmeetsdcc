import React, { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import type { NpcPersonality } from "@/lib/gameData";

interface NpcPersonalityFieldsProps {
  value: NpcPersonality | undefined;
  onChange: (next: NpcPersonality) => void;
  defaultOpen?: boolean;
}

const FIELDS: { key: keyof NpcPersonality; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: "voice", label: "Voice and manner", placeholder: "Gruff dwarf smith. Short sentences, calls everyone \"kid\"" },
  { key: "wants", label: "Wants", placeholder: "The party to clear the rats out of his forge" },
  { key: "knows", label: "Knows", placeholder: "Rats come up from the cellar; the old mine is flooded", multiline: true },
  { key: "secret", label: "Secret", placeholder: "The cellar key is in the well" },
  { key: "revealWhen", label: "Reveals the secret when", placeholder: "The party pays or bribes him" },
  { key: "attitude", label: "Attitude toward the party", placeholder: "Grumpy but fair" },
];

/** DM-only personality card that drives a mob's AI dialogue in Show Time. */
export const NpcPersonalityFields: React.FC<NpcPersonalityFieldsProps> = ({ value, onChange, defaultOpen = false }) => {
  const filled = !!value && Object.values(value).some(v => typeof v === "string" && v.trim() !== "");
  const [open, setOpen] = useState(defaultOpen || filled);

  return (
    <div className="bg-muted/40 border border-border p-2 rounded">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <MessageSquare className="w-3 h-3" />
        NPC Personality {filled && <span className="text-accent font-normal">(talks in Show Time)</span>}
        <span className="ml-auto font-normal">DM only</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Fill any of these and this mob talks in Show Time when NPC voices are running. Players never see this card.
            The AI isn't told the secret until you unlock it.
          </p>
          {FIELDS.map(field => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground mb-0.5 block">{field.label}</label>
              {field.multiline ? (
                <textarea
                  value={value?.[field.key] ?? ""}
                  onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full bg-muted border border-border px-2 py-1 text-sm min-h-[44px]"
                />
              ) : (
                <input
                  type="text"
                  value={value?.[field.key] ?? ""}
                  onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full bg-muted border border-border px-2 py-1 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NpcPersonalityFields;
