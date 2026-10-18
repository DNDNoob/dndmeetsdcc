import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Mic, Send, Settings, X, Volume2, VolumeX, Lock, Unlock, Trash2, Sparkles, User, Wand2, Languages, Check, Pencil, Brain, Play, AudioLines } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import {
  type ChatMessage,
  type Mob,
  type NpcAiSettings,
  type NpcAiStatus,
  type NpcSecretEntry,
  type NpcSecretState,
  type NpcModelChoice,
  type NpcBrain,
  type NpcMemory,
  type NpcSpeechVoice,
  type TranslateMode,
  isNpcAiOnline,
  npcFeelingWord,
  NPC_MEMORY_MAX_NOTES,
  baseMobId,
  NPC_TALK_RANGE_FEET,
} from "@/lib/gameData";
import type { NpcOnlineKeys } from "@/lib/npc/onlineLlm.mjs";
import type { ChatLineView, Language } from "@/lib/languages";
import {
  GEMINI_VOICES, GROQ_VOICES, KOKORO_VOICES, engineName, fitVoice, kokoroVoice, voiceLabel, voiceTraits,
  type CatalogVoice, type VoiceEngine,
} from "@/lib/npcSpeech/voices";
import { useSpeechEngineState } from "@/lib/npcSpeech/engine";
import { elevenLabsVoices, speakLine, useVoiceServiceState, voiceEnginesInOrder } from "@/lib/npcSpeech/providers";

const OPEN_STORAGE_KEY = "dcc_chat_open";

export interface NpcChatAuthor {
  type: "crawler" | "dm";
  id: string;
  name: string;
}

/** Someone who can be picked with @ in the chat box. */
export interface NpcChatMentionable {
  id: string;
  name: string;
  kind: "npc" | "crawler";
  feet?: number; // players: how far the mob is from their crawler
}

interface NpcChatPanelProps {
  messages: ChatMessage[];
  author: NpcChatAuthor | null; // null = can't post (e.g. a player who hasn't picked a crawler)
  isAdmin: boolean;
  mobs: Mob[];
  npcsOnMap: Mob[]; // Mobs on the current map that can talk (DM controls)
  mentionables?: NpcChatMentionable[]; // who @ can pick (players: only mobs within talking range)
  aiSettings: NpcAiSettings | null;
  aiStatus: NpcAiStatus | null;
  secrets: Record<string, NpcSecretEntry>;
  onSend: (text: string, viaVoice: boolean, toMobIds?: string[], language?: string) => void | Promise<void>;
  /** How each line reads for this viewer (languages and translators). Without it every line shows as written. */
  readLine?: (m: ChatMessage) => ChatLineView;
  speakLanguages?: Language[];          // languages the author can speak in (players)
  translateMode?: TranslateMode;        // the author's translator setting (players)
  onSetTranslateMode?: (mode: TranslateMode) => void | Promise<void>;
  onTranslate?: (m: ChatMessage, text: string) => void | Promise<void>; // pass a line on to the party (maybe twisted)
  onUpdateSettings?: (updates: Partial<Omit<NpcAiSettings, "id">>) => void | Promise<void>;
  onSetSecretState?: (mobId: string, state: NpcSecretState) => void | Promise<void>;
  memories?: Record<string, NpcMemory>;           // what each speaker remembers (DM view)
  onSetMemory?: (speakerId: string, memory: NpcMemory) => void | Promise<void>;
  onClearChat?: () => void | Promise<void>;
  npcKeys?: NpcOnlineKeys;                        // DM only: free online model keys, saved in this browser
  onChangeNpcKeys?: (keys: NpcOnlineKeys) => void;
  // Spoken voices: this viewer's sound settings
  speechMuted?: boolean;
  speechVolume?: number;
  onSetSpeechPrefs?: (prefs: { muted?: boolean; volume?: number }) => void;
}

const SPEEDS = [["0.85", "Slow"], ["1", "Normal"], ["1.15", "Quick"]] as const;
const PREVIEW_LINE = "Well met, crawler. What brings you down here?";

const readOpen = (): boolean => {
  try { return localStorage.getItem(OPEN_STORAGE_KEY) === "1"; } catch { return false; }
};
const writeOpen = (open: boolean) => {
  try { localStorage.setItem(OPEN_STORAGE_KEY, open ? "1" : "0"); } catch { /* storage unavailable */ }
};

const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Shared in-game chat for Show Time, with NPC voices status and DM controls. */
export const NpcChatPanel: React.FC<NpcChatPanelProps> = ({
  messages, author, isAdmin, mobs, npcsOnMap, mentionables = [], aiSettings, aiStatus, secrets,
  onSend, onUpdateSettings, onSetSecretState, memories = {}, onSetMemory, onClearChat, npcKeys, onChangeNpcKeys,
  readLine, speakLanguages = [], translateMode = "off", onSetTranslateMode, onTranslate,
  speechMuted = false, speechVolume = 0.9, onSetSpeechPrefs,
}) => {
  const [open, setOpen] = useState(readOpen);
  const [showSettings, setShowSettings] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  // DM memory editor: which speaker is open, and the notes being edited (one per line)
  const [memoryOpenId, setMemoryOpenId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);
  const seenCountRef = useRef(messages.length);
  const [unread, setUnread] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // @ picker: the "@query" being typed (start = index of the @), and who has been picked
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [pickedMobIds, setPickedMobIds] = useState<string[]>([]);
  // The mob this person is talking with: later messages go to it without another @
  const [talkingToId, setTalkingToId] = useState<string | null>(null);
  // Language this person speaks in (players who know more than one)
  const [speakId, setSpeakId] = useState<string | null>(null);
  const speakLanguage = speakLanguages.find(l => l.id === speakId) ?? speakLanguages[0];
  const speakRef = useRef(speakLanguage?.id);
  speakRef.current = speakLanguage?.id;
  // Translator rewriting a line before passing it on: message id → draft
  const [twisting, setTwisting] = useState<{ id: string; text: string } | null>(null);

  const talkingTo = talkingToId ? mentionables.find(m => m.kind === "npc" && m.id === talkingToId) ?? null : null;
  const talkingToRef = useRef(talkingTo);
  talkingToRef.current = talkingTo;

  const speech = useSpeechToText((text) => {
    const target = talkingToRef.current;
    void onSend(text, true, target ? [target.id] : [], speakRef.current);
  });

  // Re-evaluate the online indicator as heartbeats age
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (open) {
      seenCountRef.current = messages.length;
      setUnread(0);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    } else if (messages.length > seenCountRef.current) {
      setUnread(messages.length - seenCountRef.current);
    } else {
      seenCountRef.current = messages.length;
    }
  }, [messages.length, open]);

  const setPanelOpen = (next: boolean) => {
    setOpen(next);
    writeOpen(next);
  };

  const enabled = aiSettings?.enabled !== false;
  const speechOn = !!aiSettings?.speech;
  const voicePicks = aiSettings?.voices ?? {};
  const engine = useSpeechEngineState();
  const services = useVoiceServiceState();
  // The voice service lines go to right now: the DM picks voices from its list
  const voiceEngine: VoiceEngine = voiceEnginesInOrder(npcKeys ?? {})[0] ?? "kokoro";
  const [elevenList, setElevenList] = useState<CatalogVoice[]>([]);
  const elevenKey = npcKeys?.elevenlabs?.trim();
  useEffect(() => {
    if (!isAdmin || !speechOn || !elevenKey) { setElevenList([]); return; }
    let live = true;
    void elevenLabsVoices(elevenKey).then(list => { if (live) setElevenList(list); });
    return () => { live = false; };
  }, [isAdmin, speechOn, elevenKey]);
  const catalog: CatalogVoice[] = voiceEngine === "gemini" ? GEMINI_VOICES
    : voiceEngine === "groq" ? GROQ_VOICES
      : voiceEngine === "elevenlabs" ? elevenList
        : KOKORO_VOICES;
  const pickField = voiceEngine === "kokoro" ? "voice" : voiceEngine;
  const kokoroLabel = engine.status === "loading"
    ? `Downloading the backup voices ${Math.round((engine.progress ?? 0) * 100)}%`
    : engine.status === "error" ? `Backup voices failed to load: ${engine.error ?? "unknown error"}` : "";
  const restingNotes = Object.values(services.rest).filter(r => r && r.restUntil > now).map(r => r!.why);
  const engineLabel = [
    `Using ${engineName(voiceEngine)}${voiceEngine === "kokoro" && engine.status === "ready" ? " (in this browser)" : ""}.`,
    ...restingNotes.map(n => `${n}.`),
    kokoroLabel,
  ].filter(Boolean).join(" ");
  const preview = async (mob: Mob) => {
    const pick = voicePicks[baseMobId(mob.id)];
    const lastLine = [...messages].reverse().find(m => m.authorType === "npc" && m.authorId === mob.id)?.text;
    setPreviewing(mob.id);
    try {
      const text = lastLine?.replace(/\*[^*]*\*/g, " ").trim() || PREVIEW_LINE;
      const clip = await speakLine({ text, traits: voiceTraits(mob.id, mob, pick), pick }, npcKeys ?? {});
      const url = URL.createObjectURL(clip.blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (err) {
      console.warn("[NpcSpeech] Preview failed", err);
    } finally {
      setPreviewing(null);
    }
  };
  const online = isNpcAiOnline(aiStatus, now);
  const model: NpcModelChoice = aiSettings?.model ?? "quality";
  const mutedIds = aiSettings?.mutedMobIds ?? [];

  const brain: NpcBrain = aiSettings?.brain ?? "online";
  const hasKey = !!(npcKeys?.groq?.trim() || npcKeys?.gemini?.trim());
  const laptopCovering = online && brain === "online" && aiStatus?.runner === "laptop";

  const statusLabel = !enabled
    ? "NPC voices off"
    : isAdmin && brain === "online" && npcKeys && !hasKey && !online
      ? "Add a key in settings"
      : !online
        ? "NPC voices offline"
        : aiStatus?.busy
          ? "NPC voices offline: laptop busy"
          : laptopCovering
            ? "Laptop covering"
            : "NPC voices online";
  const statusColor = !enabled || !online || aiStatus?.busy ? "bg-muted-foreground" : "bg-green-500";

  const pendingSecrets = useMemo(
    () => (isAdmin ? Object.entries(secrets).filter(([mobId, s]) => s?.state === "pending" && mobs.some(m => m.id === mobId || m.id === baseMobId(mobId))) : []),
    [isAdmin, secrets, mobs]
  );

  const mentionOptions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return mentionables
      .filter(m => m.name.toLowerCase().startsWith(q) || m.name.toLowerCase().split(/\s+/).some(w => w.startsWith(q)))
      .slice(0, 8);
  }, [mention, mentionables]);
  // Once a name is picked and the person keeps typing, the "@Name words…" no longer looks like a search
  const showMention = !!mention && (mentionOptions.length > 0 || !/\s/.test(mention.query));

  const updateDraft = (value: string, caret: number | null) => {
    setDraft(value);
    const before = value.slice(0, caret ?? value.length);
    const match = /(^|\s)@([^@\n]{0,24})$/.exec(before);
    if (match && !/\s{2}/.test(match[2])) {
      setMention({ start: before.length - match[2].length - 1, query: match[2] });
      setMentionIndex(0);
    } else {
      setMention(null);
    }
  };

  const pickMention = (option: NpcChatMentionable) => {
    if (!mention) return;
    const end = mention.start + 1 + mention.query.length;
    const insert = `@${option.name} `;
    const next = draft.slice(0, mention.start) + insert + draft.slice(end);
    setDraft(next);
    setMention(null);
    if (option.kind === "npc") setPickedMobIds(ids => (ids.includes(option.id) ? ids : [...ids, option.id]));
    const caret = mention.start + insert.length;
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      // Only move the caret if nothing was typed since the pick
      if (input.value === next) input.setSelectionRange(caret, caret);
    });
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMention) return;
    if (e.key === "Escape") { e.preventDefault(); setMention(null); return; }
    if (!mentionOptions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionOptions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionOptions.length) % mentionOptions.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(mentionOptions[mentionIndex] ?? mentionOptions[0]); }
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || !author) return;
    // Only mobs still tagged in the text count as picked
    let toMobIds = pickedMobIds.filter(id => {
      const mob = mentionables.find(m => m.id === id);
      return mob && text.includes(`@${mob.name}`);
    });
    const taggedCrawler = mentionables.some(m => m.kind === "crawler" && text.includes(`@${m.name}`));
    if (toMobIds.length) {
      setTalkingToId(toMobIds[toMobIds.length - 1]);
    } else if (taggedCrawler) {
      setTalkingToId(null); // talking to another player now
    } else if (talkingTo) {
      toMobIds = [talkingTo.id];
    }
    setDraft("");
    setMention(null);
    setPickedMobIds([]);
    void onSend(text, false, toMobIds, speakLanguage?.id);
  };

  // Speakers that left the map ("Goblin B") still show with their creature's picture
  const mobById = (id: string) => mobs.find(m => m.id === id) ?? mobs.find(m => m.id === baseMobId(id));

  return (
    <div className="fixed bottom-24 right-2 sm:right-4 z-[98] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto w-[min(360px,calc(100vw-16px))] max-h-[min(62vh,560px)] flex flex-col bg-background/95 backdrop-blur border-2 border-primary shadow-2xl"
            data-testid="npc-chat-panel"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="font-display text-sm text-primary uppercase tracking-wide whitespace-nowrap shrink-0">Game Chat</span>
              <span className="ml-auto min-w-0 flex items-center gap-1.5 text-[11px] text-muted-foreground" title={aiStatus?.note || statusLabel}>
                <span className={`w-2 h-2 shrink-0 rounded-full ${statusColor}`} />
                <span className="truncate">{statusLabel}</span>
              </span>
              {speechOn && onSetSpeechPrefs && (
                <button
                  type="button"
                  onClick={() => setShowSound(s => !s)}
                  className={`p-1 hover:text-primary ${showSound ? "text-primary" : speechMuted ? "text-destructive" : "text-muted-foreground"}`}
                  aria-label="NPC voice sound"
                  data-testid="npc-sound-button"
                >
                  {speechMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowSettings(s => !s)}
                  className={`p-1 hover:text-primary ${showSettings ? "text-primary" : "text-muted-foreground"}`}
                  aria-label="NPC voice settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={() => setPanelOpen(false)} className="p-1 text-muted-foreground hover:text-primary" aria-label="Close chat">
                <X className="w-4 h-4" />
              </button>
            </div>

            {speechOn && showSound && onSetSpeechPrefs && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border text-xs" data-testid="npc-sound">
                <AudioLines className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="shrink-0">Hear NPCs</span>
                <Switch checked={!speechMuted} onCheckedChange={(v) => onSetSpeechPrefs({ muted: !v })} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={speechVolume}
                  disabled={speechMuted}
                  onChange={(e) => onSetSpeechPrefs({ volume: Number(e.target.value) })}
                  className="flex-1 min-w-0 accent-primary"
                  aria-label="NPC voice volume"
                />
              </div>
            )}

            {online && enabled && aiStatus?.note && (
              <div className="px-3 py-1 text-[11px] text-accent border-b border-border">{aiStatus.note}</div>
            )}

            {/* DM: secret reveal prompts */}
            {pendingSecrets.map(([mobId, entry]) => {
              const mob = mobById(mobId);
              if (!mob) return null;
              return (
                <div key={mobId} className="shrink-0 px-3 py-2 border-b border-accent bg-accent/10 text-xs">
                  <p className="text-foreground">
                    <Sparkles className="inline w-3 h-3 text-accent mr-1" />
                    {entry.reason ? <>{entry.reason} </> : null}
                    Unlock <span className="font-bold">{mob.name}</span>'s secret?
                  </p>
                  {mob.personality?.secret && (
                    <p className="text-muted-foreground mt-0.5 italic">Secret: {mob.personality.secret}</p>
                  )}
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => onSetSecretState?.(mobId, "unlocked")}
                      className="px-2 py-0.5 border border-accent text-accent hover:bg-accent hover:text-background font-display uppercase text-[11px]"
                    >
                      Unlock
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetSecretState?.(mobId, "locked")}
                      className="px-2 py-0.5 border border-border text-muted-foreground hover:text-primary font-display uppercase text-[11px]"
                    >
                      Not yet
                    </button>
                  </div>
                </div>
              );
            })}

            {/* DM: settings */}
            {isAdmin && showSettings && (
              <div className="flex-1 min-h-0 px-3 py-2 space-y-2 text-xs overflow-y-auto" data-testid="npc-settings">
                <label className="flex items-center justify-between gap-2">
                  <span>NPC voices</span>
                  <Switch checked={enabled} onCheckedChange={(v) => onUpdateSettings?.({ enabled: v })} />
                </label>
                <div className="flex items-center justify-between gap-2">
                  <span>NPC brain</span>
                  <div className="flex border border-border">
                    {([["online", "Online"], ["laptop", "Laptop"]] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onUpdateSettings?.({ brain: value })}
                        className={`px-2 py-0.5 ${brain === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {(brain === "online" || speechOn) && npcKeys && onChangeNpcKeys && (
                  <div className="space-y-1" data-testid="npc-keys">
                    <p className="text-muted-foreground">
                      Free keys, saved only in this browser. {brain === "online" && "NPC lines are written with Groq first, then Gemini when Groq's free limit runs out. "}
                      {speechOn && "Voices use Gemini first, then Groq, then ElevenLabs. "}
                      Keep this page open during the game.
                    </p>
                    {([
                      ["groq", "Groq key", "gsk_…"],
                      ["gemini", "Gemini key", "AIza…"],
                      ...(speechOn ? [["elevenlabs", "ElevenLabs", "sk_…"] as const] : []),
                    ] as const).map(([id, label, placeholder]) => (
                      <label key={id} className="flex items-center gap-2">
                        <span className="w-20 shrink-0">{label}</span>
                        <input
                          type="password"
                          autoComplete="off"
                          spellCheck={false}
                          value={npcKeys[id] ?? ""}
                          onChange={(e) => onChangeNpcKeys({ ...npcKeys, [id]: e.target.value.trim() })}
                          placeholder={placeholder}
                          className="flex-1 min-w-0 bg-muted border border-border px-2 py-0.5 text-xs"
                        />
                      </label>
                    ))}
                  </div>
                )}
                {brain === "laptop" && (
                  <p className="text-muted-foreground">Uses only the local AI model in the NPC voices program on the DM computer. No Groq or Gemini.</p>
                )}
                {laptopCovering && (
                  <p className="text-accent">Free online limits used up for now: the laptop is covering.</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span>Model</span>
                  <div className="flex border border-border">
                    {([["quality", "Best quality"], ["fast", "Fast"]] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onUpdateSettings?.({ model: value })}
                        className={`px-2 py-0.5 ${model === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between gap-2">
                  <span>Mute all NPCs</span>
                  <Switch checked={!!aiSettings?.mutedAll} onCheckedChange={(v) => onUpdateSettings?.({ mutedAll: v })} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>Spoken voices</span>
                  <Switch checked={speechOn} onCheckedChange={(v) => onUpdateSettings?.({ speech: v })} data-testid="npc-speech-switch" />
                </label>
                {speechOn && (
                  <p className="text-muted-foreground" data-testid="npc-speech-status">
                    NPC lines are read aloud on every player's device, using the keys above. When every service is used up,
                    voices are made in this browser instead (about 330 MB to download the first time), so keep this tab open.{" "}
                    <span className={engine.status === "error" ? "text-destructive" : "text-accent"}>{engineLabel}</span>
                  </p>
                )}
                {aiStatus?.activeModel && online && (
                  <p className="text-muted-foreground">Running: {aiStatus.activeModel}</p>
                )}
                <div>
                  <p className="text-muted-foreground mb-1">NPCs on this map</p>
                  {npcsOnMap.length === 0 && (
                    <p className="text-muted-foreground italic">No mobs on this map yet.</p>
                  )}
                  {npcsOnMap.map(mob => {
                    const muted = mutedIds.includes(mob.id);
                    const secretState = secrets[mob.id]?.state ?? "locked";
                    const hasSecret = !!mob.personality?.secret?.trim();
                    const generated = !!(mob as Mob & { personalityGenerated?: boolean }).personalityGenerated;
                    const hasAny = !!mob.personality && Object.values(mob.personality).some(v => typeof v === "string" && v.trim());
                    const card = mob.personality
                      ? [mob.personality.voice, mob.personality.attitude && `Attitude: ${mob.personality.attitude}`, mob.personality.secret && `Secret: ${mob.personality.secret}`].filter(Boolean).join("\n")
                      : "";
                    const memory = memories[mob.id];
                    const memoryCount = memory?.notes?.length ?? 0;
                    const memoryOpen = memoryOpenId === mob.id;
                    const feelings = Object.values(memory?.feelings ?? {}).filter(f => f?.name);
                    return (
                      <div key={mob.id}>
                      <div className="flex items-center gap-2 py-0.5">
                        <span className="flex-1 min-w-0 truncate" title={card || undefined}>
                          {mob.name}
                          {generated && <span className="ml-1 text-[10px] text-accent" title={card}>(AI personality)</span>}
                          {!hasAny && <span className="ml-1 text-[10px] text-muted-foreground">(personality on first line)</span>}
                        </span>
                        {hasSecret && (
                          <button
                            type="button"
                            onClick={() => onSetSecretState?.(mob.id, secretState === "unlocked" ? "locked" : "unlocked")}
                            className={`flex items-center gap-1 px-1.5 py-0.5 border ${secretState === "unlocked" ? "border-accent text-accent" : "border-border text-muted-foreground hover:text-primary"}`}
                            title={secretState === "unlocked" ? "Secret unlocked: click to lock again" : "Unlock this NPC's secret"}
                          >
                            {secretState === "unlocked" ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            Secret
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onUpdateSettings?.({ mutedMobIds: muted ? mutedIds.filter(id => id !== mob.id) : [...mutedIds, mob.id] })}
                          className={`p-1 ${muted ? "text-destructive" : "text-muted-foreground hover:text-primary"}`}
                          aria-label={muted ? `Unmute ${mob.name}` : `Mute ${mob.name}`}
                        >
                          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                        {onSetMemory && (
                          <button
                            type="button"
                            data-testid={`npc-memory-${mob.id}`}
                            onClick={() => {
                              if (memoryOpen) { setMemoryOpenId(null); return; }
                              setMemoryOpenId(mob.id);
                              setMemoryDraft((memory?.notes ?? []).join("\n"));
                            }}
                            className={`flex items-center gap-0.5 p-1 ${memoryOpen ? "text-primary" : memoryCount ? "text-accent hover:text-primary" : "text-muted-foreground hover:text-primary"}`}
                            aria-label={`What ${mob.name} remembers`}
                            title={memoryCount ? `${mob.name} remembers ${memoryCount} thing${memoryCount === 1 ? "" : "s"}` : `${mob.name} doesn't remember anything yet`}
                          >
                            <Brain className="w-3.5 h-3.5" />
                            {memoryCount > 0 && <span className="text-[10px]">{memoryCount}</span>}
                          </button>
                        )}
                      </div>
                      {speechOn && (() => {
                        const baseId = baseMobId(mob.id);
                        const pick = voicePicks[baseId] ?? {};
                        const traits = voiceTraits(mob.id, mob, pick);
                        const autoTraits = voiceTraits(mob.id, mob, pick.speed === undefined ? undefined : { speed: pick.speed });
                        const autoVoice = voiceEngine === "kokoro"
                          ? KOKORO_VOICES.find(v => v.id === kokoroVoice(autoTraits))
                          : fitVoice(catalog, autoTraits);
                        const setPick = (next: NpcSpeechVoice) => {
                          const merged: NpcSpeechVoice = { ...pick, ...next };
                          for (const k of Object.keys(merged) as (keyof NpcSpeechVoice)[]) if (merged[k] === undefined) delete merged[k];
                          const { [baseId]: _old, ...rest } = voicePicks;
                          void onUpdateSettings?.({ voices: Object.keys(merged).length ? { ...rest, [baseId]: merged } : rest });
                        };
                        return (
                          <div className="ml-2 mb-1 flex items-center gap-1" data-testid={`npc-voice-${mob.id}`}>
                            <select
                              value={pick[pickField] ?? ""}
                              onChange={(e) => setPick({ [pickField]: e.target.value || undefined })}
                              className="flex-1 min-w-0 bg-muted border border-border px-1 py-0.5 text-[11px]"
                              aria-label={`${mob.name}'s voice`}
                              title={`${engineName(voiceEngine)} voices`}
                            >
                              <option value="">Auto: {autoVoice ? voiceLabel(autoVoice) : "picked from notes"}</option>
                              {catalog.map(v => <option key={v.id} value={v.id}>{voiceLabel(v)}</option>)}
                            </select>
                            <select
                              value={pick.speed === undefined ? "" : String(pick.speed)}
                              onChange={(e) => setPick({ speed: e.target.value ? Number(e.target.value) : undefined })}
                              className="w-[72px] shrink-0 bg-muted border border-border px-1 py-0.5 text-[11px]"
                              aria-label={`${mob.name}'s speaking speed`}
                            >
                              <option value="">Auto</option>
                              {SPEEDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => void preview(mob)}
                              disabled={previewing !== null}
                              className={`p-1 ${previewing === mob.id ? "text-accent animate-pulse" : "text-muted-foreground hover:text-primary"}`}
                              aria-label={`Hear ${mob.name}'s voice`}
                              title={`Hear ${mob.name} (speed ${traits.speed})`}
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })()}
                      {memoryOpen && onSetMemory && (
                        <div className="ml-2 mb-1 p-1.5 border border-border bg-muted/40 space-y-1" data-testid="npc-memory-editor">
                          <p className="text-muted-foreground">
                            What {mob.name} remembers, one note per line. Updated after each conversation goes quiet.
                          </p>
                          <textarea
                            value={memoryDraft}
                            onChange={(e) => setMemoryDraft(e.target.value)}
                            rows={4}
                            placeholder="Nothing yet"
                            className="w-full bg-muted border border-border px-2 py-1 text-xs"
                          />
                          {feelings.length > 0 && (
                            <p className="text-muted-foreground">
                              Feels: {feelings.map(f => `${f.name} ${npcFeelingWord(f.score)}`).join(", ")}
                            </p>
                          )}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-primary font-bold"
                              onClick={() => {
                                const notes = memoryDraft.split("\n").map(n => n.trim()).filter(Boolean).slice(0, NPC_MEMORY_MAX_NOTES);
                                void onSetMemory(mob.id, { ...memory, notes, feelings: memory?.feelings ?? {} });
                                setMemoryOpenId(null);
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                void onSetMemory(mob.id, { ...memory, notes: [], feelings: {} });
                                setMemoryOpenId(null);
                              }}
                            >
                              Forget everything
                            </button>
                          </div>
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
                <div className="pt-1">
                  {confirmClear ? (
                    <span className="flex items-center gap-2">
                      <span>Clear this episode's chat?</span>
                      <button type="button" className="text-destructive font-bold" onClick={() => { void onClearChat?.(); setConfirmClear(false); }}>Clear</button>
                      <button type="button" className="text-muted-foreground" onClick={() => setConfirmClear(false)}>Cancel</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmClear(true)} className="flex items-center gap-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" /> Clear chat
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Messages (hidden while the DM has settings open, so both fit on a phone) */}
            <div ref={listRef} hidden={isAdmin && showSettings} className="flex-1 min-h-[64px] overflow-y-auto px-3 py-2 space-y-1.5 text-sm">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-6">
                  No messages yet. Say something, or type @ to talk to someone.
                </p>
              )}
              {messages.map(m => {
                const mob = m.authorType === "npc" ? mobById(m.authorId) : undefined;
                const mine = author && m.authorType === author.type && m.authorId === author.id;
                const nameClass = m.authorType === "npc" ? "text-accent" : m.authorType === "dm" ? "text-destructive" : "text-primary";
                const line: ChatLineView = readLine ? readLine(m) : { text: m.text, scrambled: false };
                return (
                  <div key={m.id} className={`flex gap-2 ${mine ? "opacity-90" : ""}`}>
                    {m.authorType === "npc" && (
                      <div className="w-6 h-6 shrink-0 rounded-full border border-accent overflow-hidden bg-muted mt-0.5 flex items-center justify-center text-[10px] font-bold text-accent">
                        {mob?.image ? <img src={mob.image} alt="" className="w-full h-full object-cover" /> : m.authorName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className={`font-bold text-xs ${nameClass}`}>{m.authorName}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">{formatTime(m.createdAt)}{m.viaVoice ? " 🎙" : ""}</span>
                      {line.languageName && (
                        <span
                          className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-accent"
                          title={line.scrambled ? `You don't know ${line.languageName}` : `Spoken in ${line.languageName}`}
                        >
                          <Languages className="w-2.5 h-2.5" />{line.languageName}
                        </span>
                      )}
                      <p
                        className={`leading-snug ${line.scrambled ? `${line.languageId === "beast" ? "break-words" : "break-all"} text-muted-foreground` : "break-words"} ${m.authorType === "npc" ? "italic" : ""}`}
                        data-testid={line.scrambled ? "chat-line-scrambled" : undefined}
                      >
                        {line.text}
                      </p>
                      {line.via && <p className="text-[10px] text-primary">translated by {line.via}</p>}
                      {line.translating && <p className="text-[10px] text-muted-foreground italic">{line.translating} is translating…</p>}
                      {line.toldParty?.map((t, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground" data-testid="told-party">
                          {t.twisted ? (
                            <>
                              {t.mine ? "You told the party" : `${t.by} told the party`}: <span className="italic">{t.text}</span>
                              <span className="ml-1 px-1 border border-destructive text-destructive not-italic">twisted</span>
                            </>
                          ) : (
                            <>{t.mine ? "You passed it on" : `${t.by} passed it on`}</>
                          )}
                        </p>
                      ))}
                      {line.canTranslate && onTranslate && (
                        twisting?.id === m.id ? (
                          <form
                            className="flex items-center gap-1 mt-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!twisting.text.trim()) return;
                              void onTranslate(m, twisting.text.trim());
                              setTwisting(null);
                            }}
                          >
                            <input
                              autoFocus
                              value={twisting.text}
                              onChange={(e) => setTwisting({ id: m.id, text: e.target.value })}
                              maxLength={500}
                              className="flex-1 min-w-0 bg-muted border border-border px-1.5 py-0.5 text-xs"
                              aria-label="What you tell the party"
                            />
                            <button type="submit" className="p-1 text-primary hover:bg-primary/20" aria-label="Tell the party"><Check className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => setTwisting(null)} className="p-1 text-muted-foreground hover:text-primary" aria-label="Cancel"><X className="w-3.5 h-3.5" /></button>
                          </form>
                        ) : (
                          <div className="flex gap-1.5 mt-1" data-testid="translate-actions">
                            <button
                              type="button"
                              onClick={() => void onTranslate(m, m.text)}
                              className="px-1.5 py-0.5 border border-primary text-primary hover:bg-primary/20 text-[10px] font-display uppercase"
                              title="Tell the party exactly what was said"
                            >
                              Pass on
                            </button>
                            <button
                              type="button"
                              onClick={() => setTwisting({ id: m.id, text: m.text })}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 border border-destructive text-destructive hover:bg-destructive/20 text-[10px] font-display uppercase"
                              title="Tell the party something else. They won't know."
                            >
                              <Pencil className="w-2.5 h-2.5" /> Twist
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="relative shrink-0 border-t border-border p-2">
              {author && showMention && !speech.listening && (
                <div className="absolute left-2 right-2 bottom-full mb-1 bg-background border-2 border-primary shadow-xl z-10 text-sm" data-testid="mention-list" role="listbox">
                  {mentionOptions.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground italic">
                      {isAdmin
                        ? "No one here by that name."
                        : `No one by that name within ${NPC_TALK_RANGE_FEET} ft. Walk closer to talk to a mob.`}
                    </p>
                  ) : (
                    mentionOptions.map((option, i) => (
                      <button
                        key={`${option.kind}-${option.id}`}
                        type="button"
                        role="option"
                        aria-selected={i === mentionIndex}
                        onMouseDown={(e) => { e.preventDefault(); pickMention(option); }}
                        onMouseEnter={() => setMentionIndex(i)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-left ${i === mentionIndex ? "bg-primary/20" : ""}`}
                      >
                        {option.kind === "npc" ? <Wand2 className="w-3.5 h-3.5 text-accent shrink-0" /> : <User className="w-3.5 h-3.5 text-primary shrink-0" />}
                        <span className={`flex-1 truncate ${option.kind === "npc" ? "text-accent" : "text-primary"}`}>{option.name}</span>
                        {option.feet !== undefined && <span className="text-[10px] text-muted-foreground">{option.feet} ft</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
              {author && talkingTo && (
                <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground" data-testid="talking-to">
                  <Wand2 className="w-3 h-3 text-accent shrink-0" />
                  <span className="truncate">Talking to <span className="text-accent font-bold">{talkingTo.name}</span></span>
                  <button
                    type="button"
                    onClick={() => setTalkingToId(null)}
                    className="ml-auto p-0.5 hover:text-primary"
                    aria-label={`Stop talking to ${talkingTo.name}`}
                    title="Stop talking to them"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {author && speakLanguages.length > 1 && (
                <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground" data-testid="chat-language-row">
                  <Languages className="w-3 h-3 shrink-0" />
                  {speakLanguages.length > 1 && (
                    <select
                      value={speakLanguage?.id ?? ""}
                      onChange={(e) => setSpeakId(e.target.value)}
                      className="min-w-0 bg-muted border border-border px-1 py-0.5"
                      aria-label="Speak in"
                      title="The language you speak in"
                    >
                      {speakLanguages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  )}
                  {onSetTranslateMode && (
                    <select
                      value={translateMode}
                      onChange={(e) => void onSetTranslateMode(e.target.value as TranslateMode)}
                      className="ml-auto min-w-0 bg-muted border border-border px-1 py-0.5"
                      aria-label="Translate for party"
                      title="Pass lines in your languages on to party members who don't know them"
                    >
                      <option value="off">Not translating</option>
                      <option value="auto">Translating</option>
                      <option value="review">Translating (check lines)</option>
                    </select>
                  )}
                </div>
              )}
              {author ? (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => { e.preventDefault(); submit(); }}
                >
                  {speech.supported && (
                    <button
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); speech.start(); }}
                      onPointerUp={() => speech.stop()}
                      onPointerLeave={() => speech.listening && speech.stop()}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`shrink-0 p-2 border-2 select-none touch-none ${speech.listening ? "border-destructive text-destructive bg-destructive/20 animate-pulse" : "border-primary text-primary hover:bg-primary/20"}`}
                      aria-label="Hold to talk"
                      title="Hold to talk"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                  <input
                    ref={inputRef}
                    value={speech.listening ? speech.interim : draft}
                    onChange={(e) => updateDraft(e.target.value, e.target.selectionStart)}
                    onKeyDown={onInputKeyDown}
                    onBlur={() => setMention(null)}
                    placeholder={speech.listening ? "Listening…" : `Message as ${author.name} (@ to pick)`}
                    readOnly={speech.listening}
                    maxLength={500}
                    className="flex-1 min-w-0 bg-muted border border-border px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                    data-testid="chat-input"
                  />
                  <button type="submit" disabled={!draft.trim()} className="shrink-0 p-2 text-primary hover:bg-primary/20 disabled:opacity-40" aria-label="Send">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1">Pick your crawler to join the chat.</p>
              )}
              {speech.error && <p className="text-[11px] text-destructive mt-1">{speech.error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setPanelOpen(!open)}
        className="pointer-events-auto relative h-11 w-11 flex items-center justify-center bg-background border-2 border-primary text-primary shadow-lg hover:bg-primary/20"
        aria-label={open ? "Hide chat" : "Show chat"}
        data-testid="chat-toggle"
      >
        <MessageSquare className="w-5 h-5" />
        <span className={`absolute -bottom-1 -left-1 w-3 h-3 rounded-full border-2 border-background ${statusColor}`} />
        {!open && unread > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-accent text-background text-xs font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
};

export default NpcChatPanel;
