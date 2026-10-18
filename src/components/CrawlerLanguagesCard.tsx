import React, { useState } from "react";
import { Languages, Brain, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useLanguages } from "@/contexts/LanguagesContext";
import { crawlerLanguageIds, TELEPATHIC_LANGUAGE_ID } from "@/lib/languages";
import type { Crawler } from "@/lib/gameData";

interface CrawlerLanguagesCardProps {
  crawler: Crawler;
  isAdmin: boolean;
  canCreate: boolean; // this viewer plays this crawler (or is the DM)
  onUpdateCrawler: (id: string, updates: Partial<Crawler>) => void | Promise<void>;
}

/**
 * The languages a crawler knows. The DM decides who knows what (and who is telepathic);
 * players can make up a language, which their crawler knows straight away.
 */
export const CrawlerLanguagesCard: React.FC<CrawlerLanguagesCardProps> = ({ crawler, isAdmin, canCreate, onUpdateCrawler }) => {
  const { languages, createLanguage, deleteLanguage } = useLanguages();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const known = crawlerLanguageIds(crawler);
  const knownLanguages = known.map(id => languages.find(l => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l);
  const customLanguages = languages.filter(l => l.custom);

  const handleCreate = async () => {
    if (!newName.trim() || !createLanguage) return;
    await createLanguage(newName, newDescription, crawler.id);
    setNewName("");
    setNewDescription("");
  };

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 mb-8" data-testid="crawler-languages">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-display text-primary text-lg flex items-center gap-2">
          <Languages className="w-5 h-5" /> LANGUAGES
        </h3>
        {isAdmin && (
          <button type="button" onClick={() => setEditing(e => !e)} className="text-sm text-primary hover:underline">
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {editing && isAdmin ? (
        <div className="space-y-3">
          <LanguagePicker
            value={crawler.languages}
            onChange={(ids) => onUpdateCrawler(crawler.id, { languages: ids })}
          />
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5"><Brain className="w-4 h-4 text-accent" /> Telepathic (needed for Mindspeech)</span>
            <Switch checked={!!crawler.telepathic} onCheckedChange={(v) => onUpdateCrawler(crawler.id, { telepathic: v })} />
          </label>
          {customLanguages.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Made-up languages (deleting one removes it for everyone)</p>
              <div className="flex flex-wrap gap-1.5">
                {customLanguages.map(l => (
                  <span key={l.id} className="flex items-center gap-1 px-2 py-0.5 text-xs border border-border rounded">
                    {l.name}
                    {confirmDeleteId === l.id ? (
                      <>
                        <button type="button" className="text-destructive font-bold" onClick={() => { void deleteLanguage?.(l.id); setConfirmDeleteId(null); }}>Delete</button>
                        <button type="button" className="text-muted-foreground" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(l.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${l.name}`}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {knownLanguages.length === 0 && <p className="text-sm text-muted-foreground">No languages. Only gestures and grunts.</p>}
          {knownLanguages.map(l => {
            const blocked = l.id === TELEPATHIC_LANGUAGE_ID && !crawler.telepathic;
            return (
              <span
                key={l.id}
                title={blocked ? `${l.description ?? ""} Needs telepathy to use.`.trim() : l.description}
                className={`px-2 py-0.5 text-xs rounded border ${blocked ? "border-border text-muted-foreground line-through" : "border-primary/50 text-primary bg-primary/10"}`}
              >
                {l.name}{l.custom && <span className="text-accent"> *</span>}
              </span>
            );
          })}
          {crawler.telepathic && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-accent/50 text-accent bg-accent/10">
              <Brain className="w-3 h-3" /> Telepathic
            </span>
          )}
        </div>
      )}

      {canCreate && createLanguage && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-primary">Make up a language</summary>
          <div className="mt-2 space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              placeholder="Name (e.g. Squeaktongue)"
              className="w-full bg-muted border border-border px-2 py-1 text-sm rounded"
            />
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              maxLength={300}
              placeholder="Who speaks it (optional)"
              className="w-full bg-muted border border-border px-2 py-1 text-sm rounded"
            />
            <p className="text-[11px] text-muted-foreground">{crawler.name} will know it. The DM decides who else learns it.</p>
            <DungeonButton variant="default" size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Create language
            </DungeonButton>
          </div>
        </details>
      )}
    </div>
  );
};

export default CrawlerLanguagesCard;
