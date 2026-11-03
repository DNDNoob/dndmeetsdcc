import { useState } from "react";
import { Eye, Languages, Search, Share2, Sparkles } from "lucide-react";
import { useLanguages } from "@/contexts/LanguagesContext";
import { DEFAULT_LANGUAGE_ID, crawlerUnderstands, languageName } from "@/lib/languages";
import { KNOWN, SEEN, type DiscoveryView, type LibraryKind } from "@/lib/discoveries";

export interface DiscoveryActions {
  share?: (kind: LibraryKind, key: string, level: number) => void;
  shareTranslation?: (key: string, text: string, twisted: boolean, level: number) => void;
  identify?: (kind: LibraryKind, key: string, name: string) => void;
  reveal?: (kind: LibraryKind, key: string, level: number) => void; // DM
}

const LEVEL_LABEL = ['Hidden', 'Seen', 'Known'] as const;

/** "Seen" tag for entries a player has only glimpsed. */
export const SeenBadge: React.FC = () => (
  <span className="text-[9px] border border-primary/40 text-primary px-1 rounded flex items-center gap-0.5" title="You've only seen this. Own it, learn it or Identify it to learn the details.">
    <Eye className="w-2.5 h-2.5" /> Seen
  </span>
);

/** Placeholder for details a player doesn't know yet. */
export const UnknownDetails: React.FC<{ kind: LibraryKind }> = ({ kind }) => (
  <div className="text-muted-foreground italic text-[11px]">
    ??? {kind === 'items' ? 'Stats, value and effects unknown.' : 'Mana cost, range, dice and effects unknown.'}
  </div>
);

interface DiscoveryControlsProps {
  kind: LibraryKind;
  entryKey: string;
  name: string;
  view: DiscoveryView;
  actions: DiscoveryActions;
  /** Items only: the description and its language, for sharing a translation */
  description?: string;
  language?: string;
}

/**
 * Encountered-mode buttons under a library entry. Players: share with the party, share a translation
 * of a foreign description, or try to Identify a Seen entry. DM: what the party sees, and who knows it.
 */
export const DiscoveryControls: React.FC<DiscoveryControlsProps> = ({ kind, entryKey, name, view, actions, description, language }) => {
  const { customLanguages } = useLanguages();
  const [translating, setTranslating] = useState(false);
  const [draft, setDraft] = useState('');

  if (view.isAdmin) {
    const partyLevel = view.partyLevelOf(kind, entryKey);
    const knownBy = view.knownByOf(kind, entryKey);
    const sharedBy = view.sharedByOf(kind, entryKey);
    const translation = kind === 'items' ? view.translationOf(entryKey) : undefined;
    return (
      <div className="space-y-1 text-[10px]">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-muted-foreground">Party sees:</span>
          {[0, SEEN, KNOWN].map(level => (
            <button
              key={level}
              type="button"
              onClick={() => actions.reveal?.(kind, entryKey, level)}
              className={`px-1.5 py-0.5 border transition-colors ${
                partyLevel === level ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-primary'
              }`}
            >
              {LEVEL_LABEL[level]}
            </button>
          ))}
        </div>
        <div className="text-muted-foreground">
          Known by: {knownBy.length > 0 ? knownBy.join(', ') : 'nobody'}
          {sharedBy && <> · shared by {sharedBy}</>}
        </div>
        {translation && (
          <div className="text-muted-foreground">
            Translation by {translation.byName}{translation.twisted && <span className="text-destructive font-display"> (TWISTED)</span>}: <span className="italic text-foreground">{translation.text}</span>
          </div>
        )}
      </div>
    );
  }

  const crawler = view.crawler;
  if (!crawler) return null;
  const own = view.ownLevelOf(kind, entryKey);
  const party = view.partyLevelOf(kind, entryKey);
  const level = Math.max(own, party);
  const sharedBy = view.sharedByOf(kind, entryKey);
  const foreign = kind === 'items' && !!description && !!language && language !== DEFAULT_LANGUAGE_ID;
  const canTranslate = foreign && own >= SEEN && crawlerUnderstands(crawler, language);
  const existing = foreign ? view.translationOf(entryKey) : undefined;

  const startTranslation = () => {
    setDraft(existing?.byId === crawler.id ? existing.text : description ?? '');
    setTranslating(true);
  };
  const saveTranslation = () => {
    const text = draft.trim();
    if (!text) return;
    actions.shareTranslation?.(entryKey, text, text !== (description ?? '').trim(), own);
    setTranslating(false);
  };

  return (
    <div className="space-y-1 text-[10px]">
      <div className="flex items-center gap-1 flex-wrap">
        {own > party && actions.share && (
          <button
            type="button"
            onClick={() => actions.share?.(kind, entryKey, own)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 border border-primary/50 text-primary hover:bg-primary/10"
            title={own >= KNOWN ? 'Tell the party everything you know about this' : 'Tell the party what you saw'}
          >
            <Share2 className="w-2.5 h-2.5" /> Share with party
          </button>
        )}
        {canTranslate && actions.shareTranslation && !translating && (
          <button
            type="button"
            onClick={startTranslation}
            className="flex items-center gap-0.5 px-1.5 py-0.5 border border-accent/50 text-accent hover:bg-accent/10"
            title={`Translate the ${languageName(language, customLanguages)} description for the party`}
          >
            <Languages className="w-2.5 h-2.5" /> {existing?.byId === crawler.id ? 'Edit translation' : 'Share translation'}
          </button>
        )}
        {level === SEEN && actions.identify && (
          <button
            type="button"
            onClick={() => actions.identify?.(kind, entryKey, name)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 border border-border text-muted-foreground hover:text-primary hover:border-primary/50"
            title={`Roll ${kind === 'items' ? 'Perception' : 'Arcana'} (Medium DC) to learn the details`}
          >
            <Search className="w-2.5 h-2.5" /> Identify
          </button>
        )}
        {sharedBy && sharedBy !== crawler.name && (
          <span className="text-muted-foreground flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> shared by {sharedBy}</span>
        )}
      </div>
      {translating && (
        <div className="space-y-1">
          <p className="text-muted-foreground">
            Write what the party will read. Change the meaning if you like; only you and the DM will know.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full bg-muted border border-border px-2 py-1 text-xs"
            aria-label="Translation"
          />
          <div className="flex gap-1">
            <button type="button" onClick={saveTranslation} className="px-1.5 py-0.5 border border-accent text-accent hover:bg-accent/10">Share</button>
            <button type="button" onClick={() => setTranslating(false)} className="px-1.5 py-0.5 border border-border text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

/** A shared translation under a description the viewer can't read. */
export const SharedTranslation: React.FC<{ view?: DiscoveryView; entryKey: string; language?: string }> = ({ view, entryKey, language }) => {
  const translation = view?.translationOf(entryKey);
  if (!view || view.isAdmin || !translation || !language || language === DEFAULT_LANGUAGE_ID) return null;
  if (crawlerUnderstands(view.crawler, language)) return null;
  return (
    <span className="block text-[11px] text-accent">
      <Languages className="w-2.5 h-2.5 inline mr-0.5" />Translated by {translation.byName}: <span className="italic">{translation.text}</span>
    </span>
  );
};

