import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Mic, Send, Settings, X, Volume2, VolumeX, Lock, Unlock, Trash2, Sparkles } from "lucide-react";
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
  isNpcAiOnline,
} from "@/lib/gameData";
import type { NpcOnlineKeys } from "@/lib/npc/onlineLlm.mjs";

const OPEN_STORAGE_KEY = "dcc_chat_open";

export interface NpcChatAuthor {
  type: "crawler" | "dm";
  id: string;
  name: string;
}

interface NpcChatPanelProps {
  messages: ChatMessage[];
  author: NpcChatAuthor | null; // null = can't post (e.g. a player who hasn't picked a crawler)
  isAdmin: boolean;
  mobs: Mob[];
  npcsOnMap: Mob[]; // NPCs with a personality on the current map (DM controls)
  aiSettings: NpcAiSettings | null;
  aiStatus: NpcAiStatus | null;
  secrets: Record<string, NpcSecretEntry>;
  onSend: (text: string, viaVoice: boolean) => void | Promise<void>;
  onUpdateSettings?: (updates: Partial<Omit<NpcAiSettings, "id">>) => void | Promise<void>;
  onSetSecretState?: (mobId: string, state: NpcSecretState) => void | Promise<void>;
  onClearChat?: () => void | Promise<void>;
  npcKeys?: NpcOnlineKeys;                        // DM only: free online model keys, saved in this browser
  onChangeNpcKeys?: (keys: NpcOnlineKeys) => void;
}

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
  messages, author, isAdmin, mobs, npcsOnMap, aiSettings, aiStatus, secrets,
  onSend, onUpdateSettings, onSetSecretState, onClearChat, npcKeys, onChangeNpcKeys,
}) => {
  const [open, setOpen] = useState(readOpen);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);
  const seenCountRef = useRef(messages.length);
  const [unread, setUnread] = useState(0);

  const speech = useSpeechToText((text) => { void onSend(text, true); });

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
    () => (isAdmin ? Object.entries(secrets).filter(([mobId, s]) => s?.state === "pending" && mobs.some(m => m.id === mobId)) : []),
    [isAdmin, secrets, mobs]
  );

  const submit = () => {
    const text = draft.trim();
    if (!text || !author) return;
    setDraft("");
    void onSend(text, false);
  };

  const mobById = (id: string) => mobs.find(m => m.id === id);

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
                {brain === "online" && npcKeys && onChangeNpcKeys && (
                  <div className="space-y-1" data-testid="npc-keys">
                    <p className="text-muted-foreground">
                      Free keys, saved only in this browser. Groq is used first, then Gemini when Groq's free limit runs out.
                      Keep this page open during the game.
                    </p>
                    {([["groq", "Groq key", "gsk_…"], ["gemini", "Gemini key", "AIza…"]] as const).map(([id, label, placeholder]) => (
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
                  <p className="text-muted-foreground">Uses the NPC voices program on the DM computer.</p>
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
                {aiStatus?.activeModel && online && (
                  <p className="text-muted-foreground">Running: {aiStatus.activeModel}</p>
                )}
                <div>
                  <p className="text-muted-foreground mb-1">NPCs on this map</p>
                  {npcsOnMap.length === 0 && (
                    <p className="text-muted-foreground italic">No mobs with a personality here. Add one in the DM Console.</p>
                  )}
                  {npcsOnMap.map(mob => {
                    const muted = mutedIds.includes(mob.id);
                    const secretState = secrets[mob.id]?.state ?? "locked";
                    const hasSecret = !!mob.personality?.secret?.trim();
                    return (
                      <div key={mob.id} className="flex items-center gap-2 py-0.5">
                        <span className="flex-1 truncate">{mob.name}</span>
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
                  No messages yet. Say something, or talk to an NPC by name.
                </p>
              )}
              {messages.map(m => {
                const mob = m.authorType === "npc" ? mobById(m.authorId) : undefined;
                const mine = author && m.authorType === author.type && m.authorId === author.id;
                const nameClass = m.authorType === "npc" ? "text-accent" : m.authorType === "dm" ? "text-destructive" : "text-primary";
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
                      <p className={`break-words leading-snug ${m.authorType === "npc" ? "italic" : ""}`}>{m.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-border p-2">
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
                    value={speech.listening ? speech.interim : draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={speech.listening ? "Listening…" : `Message as ${author.name}`}
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
