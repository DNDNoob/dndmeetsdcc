import React from "react";
import { Check } from "lucide-react";
import { useLanguages } from "@/contexts/LanguagesContext";
import { DEFAULT_LANGUAGE_ID } from "@/lib/languages";

interface LanguagePickerProps {
  /** Selected language ids, in order (the first is the native tongue). Unset = Worldspeech. */
  value: string[] | undefined;
  onChange: (ids: string[]) => void;
  hint?: string;
}

/** Tap languages on or off. Used for mobs and for the DM editing a crawler. */
export const LanguagePicker: React.FC<LanguagePickerProps> = ({ value, onChange, hint }) => {
  const { languages } = useLanguages();
  const selected = value ?? [DEFAULT_LANGUAGE_ID];
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5" data-testid="language-picker">
        {languages.map(l => {
          const on = selected.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => toggle(l.id)}
              title={l.description}
              aria-pressed={on}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs border rounded ${on ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:text-primary"}`}
            >
              {on && <Check className="w-3 h-3" />}
              {l.name}
              {selected[0] === l.id && selected.length > 1 && <span className="text-[10px] text-accent">native</span>}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
};

interface LanguageSelectProps {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  className?: string;
  /** Limit the choices (e.g. to languages the writer knows) */
  onlyIds?: string[];
  noneLabel?: string;
  optionLabel?: (name: string) => string;
  ariaLabel?: string;
}

/** One language for a piece of writing; "none" means anyone can read it. */
export const LanguageSelect: React.FC<LanguageSelectProps> = ({ value, onChange, className, onlyIds, noneLabel = "Anyone can read it", optionLabel = (name) => `Written in ${name}`, ariaLabel = "Written in" }) => {
  const { languages } = useLanguages();
  const options = onlyIds ? languages.filter(l => onlyIds.includes(l.id)) : languages;
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={className ?? "bg-muted border border-border px-2 py-1 text-xs"}
      aria-label={ariaLabel}
    >
      <option value="">{noneLabel}</option>
      {options.map(l => <option key={l.id} value={l.id}>{optionLabel(l.name)}</option>)}
    </select>
  );
};

export default LanguagePicker;
