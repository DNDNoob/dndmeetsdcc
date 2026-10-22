import { Eye, EyeOff } from "lucide-react";

interface LibraryVisibilityToggleProps {
  hidden: boolean;
  onChange: (hidden: boolean) => void;
}

/** DM-only switch that hides a whole library (items or spells) from players. */
export const LibraryVisibilityToggle: React.FC<LibraryVisibilityToggleProps> = ({ hidden, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!hidden}
    onClick={() => onChange(!hidden)}
    title={hidden ? 'Players cannot see this library. Tap to show it.' : 'Players can see this library. Tap to hide it.'}
    className={`flex items-center gap-1 text-[10px] font-normal px-1.5 py-0.5 border transition-colors ${
      hidden
        ? 'border-destructive/60 text-destructive hover:bg-destructive/10'
        : 'border-primary/50 text-primary hover:bg-primary/10'
    }`}
  >
    {hidden ? <><EyeOff className="w-3 h-3" /> Hidden from players</> : <><Eye className="w-3 h-3" /> Shown to players</>}
  </button>
);

/** What players see in place of a library the DM has hidden. */
export const HiddenLibraryNotice: React.FC<{ kind: 'items' | 'spells' }> = ({ kind }) => (
  <p className="text-muted-foreground text-sm italic flex items-center gap-2">
    <EyeOff className="w-4 h-4 shrink-0" />
    The DM has hidden the {kind === 'items' ? 'item' : 'spell'} library. You'll find out about {kind} as you come across them.
  </p>
);
