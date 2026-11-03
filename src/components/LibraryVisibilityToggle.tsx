import { Eye, EyeOff, Sparkles } from "lucide-react";
import { LIBRARY_MODES, type LibraryMode } from "@/lib/discoveries";

interface LibraryModePickerProps {
  mode: LibraryMode;
  onChange: (mode: LibraryMode) => void;
}

const MODE_ICON = { full: Eye, encountered: Sparkles, hidden: EyeOff } as const;

/** DM-only picker for what players see in a library (items or spells): all of it, what they've encountered, or nothing. */
export const LibraryModePicker: React.FC<LibraryModePickerProps> = ({ mode, onChange }) => (
  <div role="radiogroup" aria-label="What players see" className="flex items-center border border-border text-[10px] font-normal">
    {LIBRARY_MODES.map(m => {
      const Icon = MODE_ICON[m.id];
      const active = m.id === mode;
      return (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(m.id)}
          title={m.hint}
          className={`flex items-center gap-1 px-1.5 py-0.5 transition-colors ${
            active
              ? m.id === 'hidden' ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-primary'
          }`}
        >
          <Icon className="w-3 h-3" /> {m.label}
        </button>
      );
    })}
  </div>
);

/** What players see in place of a library the DM has hidden. */
export const HiddenLibraryNotice: React.FC<{ kind: 'items' | 'spells' }> = ({ kind }) => (
  <p className="text-muted-foreground text-sm italic flex items-center gap-2">
    <EyeOff className="w-4 h-4 shrink-0" />
    The DM has hidden the {kind === 'items' ? 'item' : 'spell'} library. You'll find out about {kind} as you come across them.
  </p>
);

/** What players see in "Encountered only" mode before they've come across anything. */
export const NothingEncounteredNotice: React.FC<{ kind: 'items' | 'spells' }> = ({ kind }) => (
  <p className="text-muted-foreground text-sm italic flex items-center gap-2">
    <Sparkles className="w-4 h-4 shrink-0" />
    You haven't come across any {kind} yet. {kind === 'items' ? 'Items' : 'Spells'} show up here once you find, buy, see or learn them.
  </p>
);
