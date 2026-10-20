import React, { useState } from "react";
import { X, Minus, Plus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { useLanguages } from "@/contexts/LanguagesContext";
import { DEFAULT_LANGUAGE_ID } from "@/lib/languages";
import { BACKSTORY_QUESTIONS, STARTING_LANGUAGE_PICKS, UNPICKABLE_STARTING_LANGUAGES } from "@/lib/characterCreation";
import {
  type Crawler,
  type CrawlerBackstory,
  type AbilityKey,
  ABILITY_KEYS,
  ABILITY_POINTS_TOTAL,
  ABILITY_POINTS_MAX,
  NEW_CRAWLER_HP,
  NEW_CRAWLER_MANA,
  abilityScoreFromPoints,
} from "@/lib/gameData";

interface CharacterCreatorProps {
  onCreate: (crawler: Crawler) => void;
  onClose: () => void;
}

const ABILITY_LABELS: Record<AbilityKey, { short: string; name: string }> = {
  str: { short: 'STR', name: 'Strength' },
  dex: { short: 'DEX', name: 'Dexterity' },
  con: { short: 'CON', name: 'Constitution' },
  int: { short: 'INT', name: 'Intelligence' },
  cha: { short: 'CHA', name: 'Charisma' },
};

// Steps: name, one per backstory question, abilities, languages, review
type Step = { kind: 'name' } | { kind: 'question'; index: number } | { kind: 'abilities' } | { kind: 'languages' } | { kind: 'review' };
const STEPS: Step[] = [
  { kind: 'name' },
  ...BACKSTORY_QUESTIONS.map((_, index) => ({ kind: 'question' as const, index })),
  { kind: 'abilities' },
  { kind: 'languages' },
  { kind: 'review' },
];

/** Step-by-step character creation: every new crawler starts as a classless Human. */
export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onCreate, onClose }) => {
  const { languages } = useLanguages();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [backstory, setBackstory] = useState<CrawlerBackstory>({});
  const [points, setPoints] = useState<Record<AbilityKey, number>>({ str: 0, dex: 0, con: 0, int: 0, cha: 0 });
  const [pickedLanguages, setPickedLanguages] = useState<string[]>([]);

  const step = STEPS[stepIndex];
  const pointsSpent = ABILITY_KEYS.reduce((sum, k) => sum + points[k], 0);
  const pointsLeft = ABILITY_POINTS_TOTAL - pointsSpent;
  const pickable = languages.filter(l => !UNPICKABLE_STARTING_LANGUAGES.includes(l.id));
  const nameOf = (id: string) => languages.find(l => l.id === id)?.name ?? id;

  const stepDone = (() => {
    switch (step.kind) {
      case 'name': return name.trim().length > 0;
      case 'question': return !!backstory[BACKSTORY_QUESTIONS[step.index].key]?.trim();
      case 'abilities': return pointsLeft === 0;
      case 'languages': return pickedLanguages.length === STARTING_LANGUAGE_PICKS;
      case 'review': return true;
    }
  })();

  const adjustPoints = (key: AbilityKey, delta: number) => {
    const next = points[key] + delta;
    if (next < 0 || next > ABILITY_POINTS_MAX || (delta > 0 && pointsLeft <= 0)) return;
    setPoints({ ...points, [key]: next });
  };

  const toggleLanguage = (id: string) => {
    if (pickedLanguages.includes(id)) setPickedLanguages(pickedLanguages.filter(l => l !== id));
    else if (pickedLanguages.length < STARTING_LANGUAGE_PICKS) setPickedLanguages([...pickedLanguages, id]);
  };

  const handleCreate = () => {
    const trimmed = Object.fromEntries(
      Object.entries(backstory).map(([k, v]) => [k, v?.trim()]).filter(([, v]) => v),
    ) as CrawlerBackstory;
    onCreate({
      id: Date.now().toString(),
      name: name.trim(),
      race: 'Human',
      job: '',
      level: 1,
      hp: NEW_CRAWLER_HP,
      maxHP: NEW_CRAWLER_HP,
      mana: NEW_CRAWLER_MANA,
      maxMana: NEW_CRAWLER_MANA,
      str: abilityScoreFromPoints(points.str),
      dex: abilityScoreFromPoints(points.dex),
      con: abilityScoreFromPoints(points.con),
      int: abilityScoreFromPoints(points.int),
      cha: abilityScoreFromPoints(points.cha),
      achievements: '',
      gold: 0,
      languages: [DEFAULT_LANGUAGE_ID, ...pickedLanguages],
      backstory: trimmed,
      usesAbilityPoints: true,
    });
  };

  const renderStep = () => {
    switch (step.kind) {
      case 'name':
        return (
          <div className="space-y-3">
            <h4 className="font-display text-lg text-primary">What's your name, crawler?</h4>
            <p className="text-sm text-muted-foreground">
              Everyone enters the dungeon as a Human with no class. Your race and class can change later, when the DM decides.
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoFocus
              className="w-full bg-muted border border-border rounded px-3 py-2"
            />
          </div>
        );
      case 'question': {
        const q = BACKSTORY_QUESTIONS[step.index];
        const value = backstory[q.key] ?? '';
        return (
          <div className="space-y-3">
            <h4 className="font-display text-lg text-primary">{q.question}</h4>
            <p className="text-sm text-muted-foreground">{q.hint} Pick one or write your own.</p>
            <input
              type="text"
              value={value}
              onChange={(e) => setBackstory({ ...backstory, [q.key]: e.target.value })}
              placeholder={q.placeholder}
              className="w-full bg-muted border border-border rounded px-3 py-2"
            />
            <div className="flex flex-wrap gap-2">
              {q.presets.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setBackstory({ ...backstory, [q.key]: p })}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${value === p ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        );
      }
      case 'abilities':
        return (
          <div className="space-y-3">
            <h4 className="font-display text-lg text-primary">Assign your ability points</h4>
            <p className="text-sm text-muted-foreground">
              Spend all {ABILITY_POINTS_TOTAL} points, up to {ABILITY_POINTS_MAX} in one ability. Each point adds +1 to that ability's rolls.
              Abilities left at 0 roll with disadvantage (two d20s, take the lower).
            </p>
            <p className={`text-sm font-bold ${pointsLeft === 0 ? 'text-primary' : 'text-accent'}`}>Points left: {pointsLeft}</p>
            <div className="space-y-2">
              {ABILITY_KEYS.map(key => (
                <div key={key} className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded">
                  <div>
                    <span className="font-bold">{ABILITY_LABELS[key].short}</span>
                    <span className="text-xs text-muted-foreground ml-2">{ABILITY_LABELS[key].name}</span>
                    {points[key] === 0 && <span className="ml-2 text-xs text-destructive">DIS</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustPoints(key, -1)}
                      disabled={points[key] === 0}
                      aria-label={`Remove a point from ${ABILITY_LABELS[key].name}`}
                      className="w-8 h-8 flex items-center justify-center border border-border rounded disabled:opacity-30"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center text-lg font-bold">{points[key]}</span>
                    <button
                      type="button"
                      onClick={() => adjustPoints(key, 1)}
                      disabled={points[key] >= ABILITY_POINTS_MAX || pointsLeft <= 0}
                      aria-label={`Add a point to ${ABILITY_LABELS[key].name}`}
                      className="w-8 h-8 flex items-center justify-center border border-primary text-primary rounded disabled:opacity-30"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'languages':
        return (
          <div className="space-y-3">
            <h4 className="font-display text-lg text-primary">Pick your languages</h4>
            <p className="text-sm text-muted-foreground">
              You already speak Worldspeech. Pick {STARTING_LANGUAGE_PICKS} more ({pickedLanguages.length}/{STARTING_LANGUAGE_PICKS}).
            </p>
            <div className="space-y-2">
              {pickable.map(l => {
                const picked = pickedLanguages.includes(l.id);
                const full = !picked && pickedLanguages.length >= STARTING_LANGUAGE_PICKS;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLanguage(l.id)}
                    disabled={full}
                    className={`w-full text-left px-3 py-2 rounded border transition-colors disabled:opacity-40 ${picked ? 'border-primary bg-primary/20' : 'border-border hover:border-primary'}`}
                  >
                    <div className="flex items-center gap-2">
                      {picked && <Check className="w-4 h-4 text-primary shrink-0" />}
                      <span className="font-bold">{l.name}</span>
                    </div>
                    {l.description && <p className="text-xs text-muted-foreground">{l.description}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 'review':
        return (
          <div className="space-y-3 text-sm">
            <h4 className="font-display text-lg text-primary">{name.trim()}</h4>
            <p className="text-muted-foreground">Human | No class | Level 1</p>
            <p>HP {NEW_CRAWLER_HP} · Mana {NEW_CRAWLER_MANA} · Gold 0</p>
            <div className="grid grid-cols-5 gap-1 text-center">
              {ABILITY_KEYS.map(key => (
                <div key={key} className="bg-muted/50 rounded py-1">
                  <div className="text-xs text-muted-foreground">{ABILITY_LABELS[key].short}</div>
                  <div className="font-bold">+{points[key]}</div>
                  {points[key] === 0 && <div className="text-[10px] text-destructive">DIS</div>}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {BACKSTORY_QUESTIONS.map(q => (
                <p key={q.key}><span className="text-muted-foreground">{q.label}:</span> {backstory[q.key]?.trim()}</p>
              ))}
            </div>
            <p><span className="text-muted-foreground">Languages:</span> {[DEFAULT_LANGUAGE_ID, ...pickedLanguages].map(nameOf).join(', ')}</p>
            <p className="text-xs text-muted-foreground">You can change your backstory on your profile later. The DM will set up your starting items.</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
      <div className="bg-background border-2 border-primary rounded-lg p-5 max-w-md w-full shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg text-primary text-glow-cyan">New Crawler</h3>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        <div className="flex gap-1 mb-4" aria-hidden>
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded ${i <= stepIndex ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
        <div className="overflow-y-auto flex-1 pr-1">{renderStep()}</div>
        <div className="flex justify-between gap-2 mt-4">
          <DungeonButton variant="ghost" size="sm" onClick={() => (stepIndex === 0 ? onClose() : setStepIndex(stepIndex - 1))}>
            <ChevronLeft className="w-4 h-4 mr-1" /> {stepIndex === 0 ? 'Cancel' : 'Back'}
          </DungeonButton>
          {step.kind === 'review' ? (
            <DungeonButton variant="admin" size="sm" onClick={handleCreate}>
              <Check className="w-4 h-4 mr-1" /> Create crawler
            </DungeonButton>
          ) : (
            <DungeonButton variant="default" size="sm" onClick={() => setStepIndex(stepIndex + 1)} disabled={!stepDone}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </DungeonButton>
          )}
        </div>
      </div>
    </div>
  );
};
