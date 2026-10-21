import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ConditionBadges } from "@/components/ConditionBadges";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { ResizableMobDisplay } from "@/components/ui/ResizableMobDisplay";
import { GridOverlay } from "@/components/ui/GridOverlay";
import RulerOverlay from "@/components/ui/RulerOverlay";
import { MobIcon } from "@/components/ui/MobIcon";
import { FogOfWar } from "@/components/ui/FogOfWar";
import { Episode, Mob, stackItems, MapSettings, Crawler, CrawlerPlacement, EpisodeMobPlacement, SentLootBox, LootBoxTemplate, getLootBoxTierColor, InventoryItem, CombatState, getEquippedModifiers, getEffectiveMoveSpeed, getMapDistanceFeet, NONCOMBAT_MOVE_MULTIPLIER, Quest, AssignedQuest, getQuestProgress, QuestActionItem, LootBoxTier } from "@/lib/gameData";
import { ItemName } from "@/components/ItemName";
import { Map as MapIcon, X, Eye, EyeOff, Layers, ChevronLeft, ChevronRight, PlayCircle, Grid3x3, CloudFog, Eraser, Trash2, Target, ZoomIn, ZoomOut, Package, Lock, Unlock, Search, Plus, Heart, ScrollText, CheckSquare, Check, Swords, Handshake, Store } from "lucide-react";
import { PingEffect, Ping } from "@/components/ui/PingEffect";
import { MapBox, MapBoxData, ShapeType } from "@/components/ui/MapBox";
import { MapToolsMenu } from "@/components/ui/MapToolsMenu";
import { CrawlerIcon } from "@/components/ui/CrawlerIcon";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";
import { useThrottledCallback } from "@/hooks/useDebounce";
import CombatTurnTimer from "@/components/CombatTurnTimer";
import MobActionsOverlay from "@/components/MobActionsOverlay";
import NpcChatPanel, { type NpcChatAuthor, type NpcChatMentionable } from "@/components/NpcChatPanel";
import NpcSpeechBubbles from "@/components/ui/NpcSpeechBubbles";
import type { NpcOnlineKeys } from "@/lib/npc/onlineLlm.mjs";
import { useLanguages } from "@/contexts/LanguagesContext";
import { readChatLine, usableLanguageIds, crawlerUnderstands, languageEffectLeft, DEFAULT_LANGUAGE_ID } from "@/lib/languages";
import { useNpcSpeechPlayer } from "@/hooks/useNpcSpeechPlayer";
import MerchantPanel, { MerchantHagglePrompts } from "@/components/MerchantPanel";
import { isMerchant, getHaggleBlocker, MERCHANT_TRADE_RANGE_FEET, type MerchantState } from "@/lib/gameData";
import { withNpcPersonality, speakerAsMob, mapSpeakers, baseMobId, isPlacementHostile, NPC_TALK_RANGE_FEET, type TranslateMode, type ChatMessage, type NpcAiSettings, type NpcAiStatus, type NpcSecretEntry, type NpcSecretState, type NpcGeneratedPersonality, type NpcMemory } from "@/lib/gameData";

const NO_GENERATED_PERSONALITIES: Record<string, NpcGeneratedPersonality> = {};
const NO_NPC_MEMORIES: Record<string, NpcMemory> = {};

interface ShowTimeViewProps {
  maps: string[];
  mapNames?: string[];
  episodes: Episode[];
  mobs: Mob[];
  crawlers: Crawler[];
  isAdmin: boolean;
  onUpdateEpisode?: (id: string, updates: Partial<Episode>) => void;
  isNavVisible?: boolean;
  isDiceExpanded?: boolean;
  lootBoxes?: SentLootBox[];
  lootBoxTemplates?: LootBoxTemplate[];
  sendLootBox?: (episodeId: string, template: LootBoxTemplate, crawlerIds: string[]) => Promise<void>;
  unlockLootBox?: (lootBoxId: string) => Promise<void>;
  deleteLootBox?: (lootBoxId: string) => void;
  addDiceRoll?: (entry: import("@/hooks/useGameState").DiceRollEntry) => Promise<void>;
  onEndEpisode?: () => void;
  onShowtimeActiveChange?: (active: boolean, episode?: Episode | null) => void;
  getCrawlerInventory?: (crawlerId: string) => import("@/lib/gameData").InventoryItem[];
  onUpdateCrawlerInventory?: (crawlerId: string, items: import("@/lib/gameData").InventoryItem[]) => void;
  getSharedInventory?: () => import("@/lib/gameData").InventoryItem[];
  onSetGameClock?: (gameTime: number) => Promise<void>;
  noncombatTurnState?: import("@/lib/gameData").NoncombatTurnState | null;
  resetNoncombatTurns?: (episodeId: string) => Promise<void>;
  combatState?: CombatState | null;
  onRemoveCombatant?: (combatantId: string) => Promise<void>;
  onRemoveCombatCondition?: (combatantId: string, conditionId: string) => Promise<void>;
  onRuntimePlacementsChange?: (crawlerPlacements: CrawlerPlacement[], runtimeMobPlacements: EpisodeMobPlacement[], currentMapId: string | null) => void;
  onGameActiveChange?: (active: boolean) => void;
  onRegisterGameToggle?: (toggleFn: (active: boolean) => Promise<void>) => void;
  roomId?: string | null;
  quests?: Quest[];
  assignedQuests?: AssignedQuest[];
  onAssignQuest?: (questId: string, crawlerIds: string[], episodeId?: string) => Promise<void>;
  onUpdateQuest?: (id: string, updates: Partial<Quest>) => void;
  onUpdateAssignedQuest?: (id: string, updates: Partial<AssignedQuest>) => void;
  onAwardQuestXP?: (assignedQuestId: string, crawlerId: string) => Promise<void>;
  onDeleteAssignedQuest?: (id: string) => void;
  currentPlayerId?: string; // crawler id of the player at this screen (DMs may have none)
  onRecordCrawlerMove?: (crawlerId: string, feet: number, spendTurnMovement: boolean, from?: { episodeId: string; mapId: string; x: number; y: number }) => Promise<void>;
  onSetMobEncountered?: (mobId: string, encountered: boolean) => Promise<void>;
  // In-game chat & talking NPCs
  chatMessages?: ChatMessage[];
  npcAiSettings?: NpcAiSettings | null;
  npcAiStatus?: NpcAiStatus | null;
  npcSecrets?: Record<string, NpcSecretEntry>;
  npcPersonalities?: Record<string, NpcGeneratedPersonality>; // personalities the AI wrote for mobs without one
  npcMemories?: Record<string, NpcMemory>; // what each speaker remembers from earlier conversations
  onSetNpcMemory?: (speakerId: string, memory: NpcMemory) => Promise<void>;
  onSendChatMessage?: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => Promise<void>;
  onClearChat?: (episodeId?: string) => Promise<void>;
  onUpdateNpcAiSettings?: (updates: Partial<Omit<NpcAiSettings, 'id'>>) => Promise<void>;
  onSetNpcSecretState?: (mobId: string, state: NpcSecretState) => Promise<void>;
  npcKeys?: NpcOnlineKeys;
  onChangeNpcKeys?: (keys: NpcOnlineKeys) => void;
  onSetTranslateMode?: (crawlerId: string, mode: TranslateMode) => Promise<void>;
  // Merchants
  merchants?: MerchantState[];
  onBuyFromMerchant?: (mob: Mob, crawlerId: string, item: InventoryItem) => Promise<boolean>;
  onSellToMerchant?: (mob: Mob, crawlerId: string, itemId: string, minGold: number) => Promise<boolean>;
  onHaggleWithMerchant?: (mob: Mob, crawler: Crawler) => Promise<unknown>;
  onRestockMerchant?: (mob: Mob) => Promise<boolean>;
  onResolveMerchantHaggle?: (mob: Mob, crawlerId: string, approve: boolean) => Promise<boolean>;
  // DM mob actions in combat
  spells?: import("@/lib/gameData").Spell[];
  onApplyCombatDamageBatch?: (hits: { targetId: string; targetType: 'crawler' | 'mob'; damage: number }[]) => Promise<void>;
  onRecordCombatAction?: (combatantId: string, actionType: 'action' | 'bonus') => Promise<void>;
  onOverrideMobHealth?: (combatantId: string, newHP: number) => Promise<void>;
  onHealCrawler?: (crawlerId: string, amount: number) => Promise<void>;
}

const NO_MERCHANTS: MerchantState[] = [];
const NO_SPELLS: import("@/lib/gameData").Spell[] = [];

const SHOWTIME_STORAGE_KEY = 'dcc_showtime_state';

// Loot Box Panel for DM to send/manage loot boxes
const LootBoxPanel: React.FC<{
  episode: Episode;
  crawlers: Crawler[];
  sentLootBoxes: SentLootBox[];
  allTemplates: LootBoxTemplate[];
  onSend: (episodeId: string, template: LootBoxTemplate, crawlerIds: string[]) => Promise<void>;
  onUnlock?: (lootBoxId: string) => Promise<void>;
  onDelete?: (lootBoxId: string) => void;
  addDiceRoll?: (entry: import("@/hooks/useGameState").DiceRollEntry) => Promise<void>;
}> = ({ episode, crawlers, sentLootBoxes, allTemplates, onSend, onUnlock, onDelete, addDiceRoll }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedCrawlerIds, setSelectedCrawlerIds] = useState<string[]>([]);

  // Get templates assigned to this episode (support both old embedded and new ID-based)
  const episodeTemplateIds = episode.lootBoxIds || (episode.lootBoxes?.map(b => b.id) || []);
  const templates = allTemplates.filter(t => episodeTemplateIds.includes(t.id));
  const episodeCrawlerIds = [...new Set((episode.crawlerPlacements || []).map(p => p.crawlerId))];
  const episodeCrawlers = crawlers.filter(c => episodeCrawlerIds.includes(c.id));

  const handleSend = async () => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template || selectedCrawlerIds.length === 0) return;
    await onSend(episode.id, template, selectedCrawlerIds);

    // Add notification to dice roll history
    if (addDiceRoll) {
      const recipientNames = selectedCrawlerIds
        .map(id => crawlers.find(c => c.id === id)?.name)
        .filter(Boolean) as string[];
      await addDiceRoll({
        id: crypto.randomUUID(),
        crawlerName: 'DM',
        crawlerId: '__dm__',
        timestamp: Date.now(),
        results: [],
        total: 0,
        lootBoxNotification: {
          boxName: template.name,
          tier: template.tier,
          recipientNames,
        },
      });
    }

    setSelectedCrawlerIds([]);
  };

  const toggleAll = () => {
    if (selectedCrawlerIds.length === episodeCrawlers.length) {
      setSelectedCrawlerIds([]);
    } else {
      setSelectedCrawlerIds(episodeCrawlers.map(c => c.id));
    }
  };

  return (
    <div>
      <h3 className="font-display text-amber-400 text-lg mb-4 flex items-center gap-2">
        <Package className="w-5 h-5" />
        Loot Boxes
      </h3>

      {/* Template selection */}
      <div className="grid sm:grid-cols-2 gap-2 mb-4">
        {templates.map(template => (
          <button
            key={template.id}
            onClick={() => setSelectedTemplateId(selectedTemplateId === template.id ? null : template.id)}
            className={`text-left p-2 border rounded transition-colors ${
              selectedTemplateId === template.id
                ? 'bg-amber-500/20 border-amber-500'
                : 'bg-muted/30 border-border hover:border-amber-500/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 flex-shrink-0" style={{ color: getLootBoxTierColor(template.tier) }} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{template.name}</p>
                <p className="text-xs text-muted-foreground">{template.tier} · {template.items.length} items</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Crawler selection - only show when a template is selected */}
      {selectedTemplateId && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Send to:</p>
            <button onClick={toggleAll} className="text-xs text-primary hover:underline">
              {selectedCrawlerIds.length === episodeCrawlers.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {episodeCrawlers.map(crawler => (
              <button
                key={crawler.id}
                onClick={() => setSelectedCrawlerIds(prev =>
                  prev.includes(crawler.id) ? prev.filter(id => id !== crawler.id) : [...prev, crawler.id]
                )}
                className={`text-left p-2 border rounded text-sm transition-colors ${
                  selectedCrawlerIds.includes(crawler.id)
                    ? 'bg-blue-500/20 border-blue-500'
                    : 'bg-muted/30 border-border hover:border-blue-500/50'
                }`}
              >
                {crawler.name}
                {selectedCrawlerIds.includes(crawler.id) && <span className="ml-1">✓</span>}
              </button>
            ))}
          </div>
          <DungeonButton
            variant="admin"
            size="sm"
            className="mt-3"
            disabled={selectedCrawlerIds.length === 0}
            onClick={handleSend}
          >
            <Package className="w-4 h-4 mr-2" />
            Send to {selectedCrawlerIds.length} crawler{selectedCrawlerIds.length !== 1 ? 's' : ''}
          </DungeonButton>
        </div>
      )}

      {/* Sent loot boxes */}
      {sentLootBoxes.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Sent Loot Boxes:</p>
          <div className="space-y-1">
            {sentLootBoxes.map(box => {
              const crawler = crawlers.find(c => c.id === box.crawlerId);
              return (
                <div
                  key={box.id}
                  className="flex items-center justify-between bg-muted/30 border border-border rounded p-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-3 h-3 flex-shrink-0" style={{ color: getLootBoxTierColor(box.tier) }} />
                    <span className="text-xs truncate">
                      {box.name} → {crawler?.name || 'Unknown'}
                    </span>
                    {box.locked ? (
                      <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    ) : (
                      <Unlock className="w-3 h-3 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {box.locked && onUnlock && (
                      <button
                        onClick={() => onUnlock(box.id)}
                        className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Unlock
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(box.id)}
                        className="p-0.5 hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Quest Panel for DM to assign quests and manage action items
const QuestPanel: React.FC<{
  episode: Episode;
  crawlers: Crawler[];
  quests: Quest[];
  assignedQuests: AssignedQuest[];
  onAssignQuest: (questId: string, crawlerIds: string[], episodeId?: string) => Promise<void>;
  onUpdateAssignedQuest?: (id: string, updates: Partial<AssignedQuest>) => void;
  onAwardQuestXP?: (assignedQuestId: string, crawlerId: string) => Promise<void>;
  onDeleteAssignedQuest?: (id: string) => void;
  addDiceRoll?: (entry: import("@/hooks/useGameState").DiceRollEntry) => Promise<void>;
}> = ({ episode, crawlers, quests, assignedQuests, onAssignQuest, onUpdateAssignedQuest, onAwardQuestXP, onDeleteAssignedQuest, addDiceRoll }) => {
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [selectedCrawlerIds, setSelectedCrawlerIds] = useState<string[]>([]);

  // Quests attached to this episode come first, then the rest of the campaign's quests
  const episodeQuestIds = episode.questIds || [];
  const sortedQuests = [
    ...quests.filter(q => episodeQuestIds.includes(q.id)),
    ...quests.filter(q => !episodeQuestIds.includes(q.id)),
  ];
  // Every crawler can get a quest (Party Quests mean the whole party); crawlers on this map come first
  const mapCrawlerIds = new Set((episode.crawlerPlacements || []).map(p => p.crawlerId));
  const playerCrawlers = crawlers.filter(c => c.id !== 'dungeonai');
  const pickerCrawlers = [
    ...playerCrawlers.filter(c => mapCrawlerIds.has(c.id)),
    ...playerCrawlers.filter(c => !mapCrawlerIds.has(c.id)),
  ];

  // Get assigned quests for this episode
  const episodeAssignedQuests = assignedQuests.filter(a => a.episodeId === episode.id);

  const postQuestNote = (questNotification: NonNullable<import("@/hooks/useGameState").DiceRollEntry['questNotification']>) => {
    if (!addDiceRoll) return;
    return addDiceRoll({
      id: crypto.randomUUID(),
      crawlerName: 'DM',
      crawlerId: '__dm__',
      timestamp: Date.now(),
      results: [],
      total: 0,
      questNotification,
    });
  };

  const handleAssign = async () => {
    const quest = quests.find(q => q.id === selectedQuestId);
    if (!quest || selectedCrawlerIds.length === 0) return;
    await onAssignQuest(quest.id, selectedCrawlerIds, episode.id);

    const recipientNames = selectedCrawlerIds
      .map(id => crawlers.find(c => c.id === id)?.name)
      .filter(Boolean) as string[];
    const isPartyQuest = playerCrawlers.every(c => selectedCrawlerIds.includes(c.id));
    await postQuestNote({
      questName: quest.name,
      type: 'assigned',
      recipientNames,
      detail: isPartyQuest ? 'Party Quest' : undefined,
    });

    setSelectedCrawlerIds([]);
    setSelectedQuestId(null);
  };

  const toggleAll = () => {
    if (selectedCrawlerIds.length === pickerCrawlers.length) {
      setSelectedCrawlerIds([]);
    } else {
      setSelectedCrawlerIds(pickerCrawlers.map(c => c.id));
    }
  };

  // Default select all when choosing a quest
  const handleSelectQuest = (questId: string) => {
    if (selectedQuestId === questId) {
      setSelectedQuestId(null);
      setSelectedCrawlerIds([]);
    } else {
      setSelectedQuestId(questId);
      setSelectedCrawlerIds(pickerCrawlers.map(c => c.id));
    }
  };

  const handleToggleActionVisibility = (quest: Quest, assigned: AssignedQuest, actionItemId: string) => {
    if (!onUpdateAssignedQuest) return;
    const { visibleActionIds } = getQuestProgress(quest, assigned);
    const wasVisible = visibleActionIds.includes(actionItemId);
    onUpdateAssignedQuest(assigned.id, {
      visibleActionIds: wasVisible ? visibleActionIds.filter(id => id !== actionItemId) : [...visibleActionIds, actionItemId],
    });

    // Send dice notification when revealing an action item
    const actionItem = quest.actionItems.find(ai => ai.id === actionItemId);
    if (!wasVisible && actionItem) {
      postQuestNote({ questName: quest.name, type: 'action_revealed', recipientNames: [], detail: actionItem.description });
    }
  };

  const handleToggleRewardVisibility = (quest: Quest, assigned: AssignedQuest, rewardId: string) => {
    if (!onUpdateAssignedQuest) return;
    const { visibleRewardIds } = getQuestProgress(quest, assigned);
    const wasVisible = visibleRewardIds.includes(rewardId);
    onUpdateAssignedQuest(assigned.id, {
      visibleRewardIds: wasVisible ? visibleRewardIds.filter(id => id !== rewardId) : [...visibleRewardIds, rewardId],
    });

    // Send dice notification when revealing a reward
    const reward = quest.rewards.find(r => r.id === rewardId);
    if (!wasVisible && reward) {
      postQuestNote({ questName: quest.name, type: 'reward_revealed', recipientNames: [], detail: reward.item.name });
    }
  };

  const handleToggleActionComplete = (quest: Quest, assigned: AssignedQuest, actionItemId: string, crawlerId: string) => {
    if (!onUpdateAssignedQuest) return;
    const actionItem = quest.actionItems.find(ai => ai.id === actionItemId);
    if (!actionItem) return;
    const { completedActions } = getQuestProgress(quest, assigned);
    const doneBy = completedActions[actionItemId] || [];
    const alreadyCompleted = doneBy.includes(crawlerId);
    onUpdateAssignedQuest(assigned.id, {
      completedActions: {
        ...completedActions,
        [actionItemId]: alreadyCompleted ? doneBy.filter(id => id !== crawlerId) : [...doneBy, crawlerId],
      },
    });

    // Ticking off a crawler's last visible action item finishes this handout for them: give its XP (once)
    const { visibleActionIds } = getQuestProgress(quest, assigned);
    const doneAfter = (id: string) => (id === actionItemId ? !alreadyCompleted : (completedActions[id] || []).includes(crawlerId));
    if (!alreadyCompleted && visibleActionIds.length > 0 && visibleActionIds.every(doneAfter)) {
      onAwardQuestXP?.(assigned.id, crawlerId);
    }

    // Send dice notification when completing an action item
    if (!alreadyCompleted) {
      const crawler = crawlers.find(c => c.id === crawlerId);
      postQuestNote({
        questName: quest.name,
        type: 'action_completed',
        recipientNames: crawler ? [crawler.name] : [],
        detail: actionItem.description,
      });
    }
  };

  if (quests.length === 0) return null;

  return (
    <div>
      <h3 className="font-display text-emerald-400 text-lg mb-4 flex items-center gap-2">
        <ScrollText className="w-5 h-5" />
        Quests
      </h3>

      {/* Quest selection for assigning */}
      <div className="grid sm:grid-cols-2 gap-2 mb-4">
        {sortedQuests.map(quest => {
          const isAssigned = episodeAssignedQuests.some(a => a.questId === quest.id);
          return (
            <button
              key={quest.id}
              onClick={() => handleSelectQuest(quest.id)}
              className={`text-left p-2 border rounded transition-colors ${
                selectedQuestId === quest.id
                  ? 'bg-emerald-500/20 border-emerald-500'
                  : isAssigned
                    ? 'bg-muted/50 border-emerald-500/30'
                    : 'bg-muted/30 border-border hover:border-emerald-500/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{quest.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {quest.actionItems.length} tasks · {quest.rewards.length} rewards
                    {isAssigned && ' · Assigned'}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Crawler selection - only show when a quest is selected and not yet assigned */}
      {selectedQuestId && !episodeAssignedQuests.some(a => a.questId === selectedQuestId) && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Assign to:</p>
            <button onClick={toggleAll} className="text-xs text-primary hover:underline">
              {selectedCrawlerIds.length === pickerCrawlers.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {pickerCrawlers.map(crawler => (
              <button
                key={crawler.id}
                onClick={() => setSelectedCrawlerIds(prev =>
                  prev.includes(crawler.id) ? prev.filter(id => id !== crawler.id) : [...prev, crawler.id]
                )}
                className={`text-left p-2 border rounded text-sm transition-colors ${
                  selectedCrawlerIds.includes(crawler.id)
                    ? 'bg-blue-500/20 border-blue-500'
                    : 'bg-muted/30 border-border hover:border-blue-500/50'
                }`}
              >
                {crawler.name}
                {selectedCrawlerIds.includes(crawler.id) && <span className="ml-1">✓</span>}
                {!mapCrawlerIds.has(crawler.id) && <span className="ml-1 text-xs text-muted-foreground">(not on map)</span>}
              </button>
            ))}
          </div>
          {pickerCrawlers.length > 0 && playerCrawlers.every(c => selectedCrawlerIds.includes(c.id)) && (
            <p className="text-xs text-emerald-400 mt-2">Everyone is selected, so this will be a Party Quest.</p>
          )}
          <DungeonButton
            variant="admin"
            size="sm"
            className="mt-3"
            disabled={selectedCrawlerIds.length === 0}
            onClick={handleAssign}
          >
            <ScrollText className="w-4 h-4 mr-2" />
            Assign to {selectedCrawlerIds.length} crawler{selectedCrawlerIds.length !== 1 ? 's' : ''}
          </DungeonButton>
        </div>
      )}

      {/* Assigned quests management */}
      {episodeAssignedQuests.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Active Quests:</p>
          {episodeAssignedQuests.map(assigned => {
            const quest = quests.find(q => q.id === assigned.questId);
            if (!quest) return null;
            const progress = getQuestProgress(quest, assigned);
            const assignedCrawlers = crawlers.filter(c => assigned.crawlerIds.includes(c.id));
            return (
              <div key={assigned.id} className="bg-muted/30 border border-emerald-500/30 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold">{quest.name}</span>
                    {assigned.isPartyQuest && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Party Quest</span>
                    )}
                  </div>
                  {onDeleteAssignedQuest && (
                    <button
                      onClick={() => onDeleteAssignedQuest(assigned.id)}
                      className="p-1 hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Assigned to: {assignedCrawlers.map(c => c.name).join(', ')}
                </p>

                {/* Action items with toggle visibility + completion */}
                {quest.actionItems.length > 0 && (
                  <div className="space-y-1 mb-2">
                    <p className="text-xs text-muted-foreground font-semibold">Action Items:</p>
                    {quest.actionItems.map(ai => {
                      const visible = progress.visibleActionIds.includes(ai.id);
                      const doneBy = progress.completedActions[ai.id] || [];
                      return (
                        <div key={ai.id} className="flex items-center gap-2 text-xs">
                          <button
                            onClick={() => handleToggleActionVisibility(quest, assigned, ai.id)}
                            className="p-0.5 hover:bg-muted rounded"
                            title={visible ? "Visible to players" : "Hidden from players"}
                          >
                            {visible ? <Eye className="w-3 h-3 text-green-400" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                          </button>
                          <span className={doneBy.length > 0 ? 'text-muted-foreground' : 'text-foreground'}>
                            {ai.description}
                          </span>
                          <div className="ml-auto flex gap-1">
                            {assignedCrawlers.map(crawler => {
                              const isComplete = doneBy.includes(crawler.id);
                              return (
                                <button
                                  key={crawler.id}
                                  onClick={() => handleToggleActionComplete(quest, assigned, ai.id, crawler.id)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                                    isComplete
                                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                      : 'bg-muted/30 border-border text-muted-foreground hover:border-emerald-500/50'
                                  }`}
                                  title={`${crawler.name}: ${isComplete ? 'Completed' : 'Not completed'}`}
                                >
                                  {crawler.name.slice(0, 3)}{isComplete && ' ✓'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rewards with toggle visibility */}
                {quest.rewards.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">Rewards:</p>
                    {quest.rewards.map(reward => {
                      const visible = progress.visibleRewardIds.includes(reward.id);
                      return (
                        <div key={reward.id} className="flex items-center gap-2 text-xs">
                          <button
                            onClick={() => handleToggleRewardVisibility(quest, assigned, reward.id)}
                            className="p-0.5 hover:bg-muted rounded"
                            title={visible ? "Visible to players" : "Hidden from players"}
                          >
                            {visible ? <Eye className="w-3 h-3 text-green-400" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                          </button>
                          <Package className="w-3 h-3 flex-shrink-0" style={{ color: getLootBoxTierColor(reward.tier as LootBoxTier) }} />
                          <span>{reward.item.name}</span>
                          <span className="text-muted-foreground" style={{ color: getLootBoxTierColor(reward.tier as LootBoxTier) }}>
                            {reward.tier}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Inventory Panel for DM to search and add items to player inventories
const InventoryPanel: React.FC<{
  crawlers: Crawler[];
  getCrawlerInventory: (crawlerId: string) => InventoryItem[];
  onUpdateCrawlerInventory: (crawlerId: string, items: InventoryItem[]) => void;
  getSharedInventory?: () => InventoryItem[];
}> = ({ crawlers, getCrawlerInventory, onUpdateCrawlerInventory, getSharedInventory }) => {
  const [selectedCrawlerId, setSelectedCrawlerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const playerCrawlers = crawlers.filter(c => c.id !== 'dungeonai');
  const libraryItems = getSharedInventory?.() ?? [];

  // Search the item library
  const filteredLibraryItems = searchQuery
    ? libraryItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : libraryItems;

  // Current crawler's inventory for display
  const selectedCrawlerItems = selectedCrawlerId ? getCrawlerInventory(selectedCrawlerId) : [];

  const handleAddLibraryItem = (libraryItem: InventoryItem) => {
    if (!selectedCrawlerId) return;
    const currentItems = getCrawlerInventory(selectedCrawlerId);
    const newItem: InventoryItem = { ...libraryItem, id: crypto.randomUUID() };
    onUpdateCrawlerInventory(selectedCrawlerId, [...currentItems, newItem]);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!selectedCrawlerId) return;
    const currentItems = getCrawlerInventory(selectedCrawlerId);
    onUpdateCrawlerInventory(selectedCrawlerId, currentItems.filter(i => i.id !== itemId));
  };

  return (
    <div>
      <h3 className="font-display text-primary text-lg mb-4 flex items-center gap-2">
        <Package className="w-5 h-5" /> Player Inventory
      </h3>

      {/* Crawler selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {playerCrawlers.map(c => (
          <button
            key={c.id}
            onClick={() => { setSelectedCrawlerId(c.id); setSearchQuery(''); }}
            className={`px-3 py-1.5 text-xs font-display border-2 rounded transition-all ${
              selectedCrawlerId === c.id
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-muted/30 border-border text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {selectedCrawlerId && (
        <>
          {/* Search item library */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search item library..."
              className="w-full pl-9 pr-3 py-2 bg-muted/20 border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Library items search results */}
          {searchQuery && (
            <div className="max-h-40 overflow-y-auto space-y-1 mb-3 border border-border bg-background rounded p-2">
              {filteredLibraryItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No items match your search</p>
              ) : (
                filteredLibraryItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-muted/30 border border-border rounded px-2 py-1.5 hover:bg-muted/50">
                    <div className="min-w-0">
                      <span className="text-xs font-display text-primary block truncate">{item.name}</span>
                      {item.description && (
                        <span className="text-[10px] text-muted-foreground block truncate">{item.description}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddLibraryItem(item)}
                      className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground font-display text-[10px] rounded hover:bg-primary/90 transition-colors flex-shrink-0 ml-2"
                    >
                      <Plus className="w-3 h-3" /> Give
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Current inventory */}
          <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
            <span className="text-xs text-muted-foreground font-display block mb-1">
              {playerCrawlers.find(c => c.id === selectedCrawlerId)?.name}'s Items ({selectedCrawlerItems.length})
            </span>
            {selectedCrawlerItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No items in inventory</p>
            ) : (
              stackItems(selectedCrawlerItems).map(({ key, item, count, ids }) => (
                <div key={key} className="flex items-center justify-between bg-muted/30 border border-border rounded px-2 py-1.5">
                  <div className="min-w-0">
                    <span className="text-xs font-display text-primary block truncate">
                      <ItemName item={item} />{count > 1 && <span className="text-accent font-bold"> ×{count}</span>}
                    </span>
                    {item.description && (
                      <span className="text-[10px] text-muted-foreground block truncate">{item.description}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveItem(ids[ids.length - 1])}
                    title={count > 1 ? 'Remove one' : 'Remove'}
                    className="p-0.5 hover:bg-destructive/10 rounded flex-shrink-0 ml-2"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ShowTimeView: React.FC<ShowTimeViewProps> = ({ maps, mapNames, episodes, mobs, crawlers, isAdmin, onUpdateEpisode, isNavVisible = false, isDiceExpanded = false, lootBoxes = [], lootBoxTemplates = [], sendLootBox, unlockLootBox, deleteLootBox, addDiceRoll, onEndEpisode: onEndEpisodeCallback, onShowtimeActiveChange, getCrawlerInventory, onUpdateCrawlerInventory, getSharedInventory, onSetGameClock, noncombatTurnState, resetNoncombatTurns, combatState, onRemoveCombatant, onRemoveCombatCondition, onRuntimePlacementsChange, onGameActiveChange, onRegisterGameToggle, roomId, quests = [], assignedQuests = [], onAssignQuest, onUpdateAssignedQuest, onAwardQuestXP, onDeleteAssignedQuest, currentPlayerId, onRecordCrawlerMove, onSetMobEncountered, chatMessages = [], npcAiSettings = null, npcAiStatus = null, npcSecrets = {}, npcPersonalities = NO_GENERATED_PERSONALITIES, npcMemories = NO_NPC_MEMORIES, onSetNpcMemory, onSendChatMessage, onClearChat, onUpdateNpcAiSettings, onSetNpcSecretState, npcKeys, onChangeNpcKeys, merchants = NO_MERCHANTS, onBuyFromMerchant, onSellToMerchant, onHaggleWithMerchant, onRestockMerchant, onResolveMerchantHaggle, onSetTranslateMode, spells = NO_SPELLS, onApplyCombatDamageBatch, onRecordCombatAction, onOverrideMobHealth, onHealCrawler }) => {
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const selectedEpisodeIdRef = useRef<string | null>(null);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [displayedMobIds, setDisplayedMobIds] = useState<string[]>([]);
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(64); // Match mob icon size (64px)
  const [draggingMobId, setDraggingMobId] = useState<string | null>(null);
  const draggingMobIdRef = useRef<string | null>(null); // Ref for use in listeners to avoid re-subscription
  const [remoteDragState, setRemoteDragState] = useState<{placementIndex: number; x: number; y: number} | null>(null);
  const mapImageRef = useRef<HTMLImageElement>(null);
  const [mapImageDimensions, setMapImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const hasAutoLoaded = useRef(false);
  const [gameStarted, setGameStarted] = useState(false);
  const mountTime = useRef(Timestamp.now());
  const lastBroadcastTime = useRef<number>(0);
  const pendingBroadcast = useRef<{ index: number; x: number; y: number } | null>(null);
  const BROADCAST_THROTTLE_MS = 50; // Throttle to ~20 updates per second for smooth real-time sync

  // Fog of war state
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [fogEraserActive, setFogEraserActive] = useState(false); // Separate eraser toggle
  const [fogPaintActive, setFogPaintActive] = useState(false); // Paint fog back over cleared areas
  const [fogBrushSize, setFogBrushSize] = useState(5);
  const [revealedAreas, setRevealedAreas] = useState<{ x: number; y: number; radius: number }[]>([]);
  const [mapScale, setMapScale] = useState(100);
  const lastFogBroadcastTime = useRef<number>(0);
  const FOG_BROADCAST_THROTTLE_MS = 50; // Faster fog sync for better real-time experience
  const pendingFogBroadcast = useRef<{ x: number; y: number; radius: number }[] | null>(null);
  const CONSOLIDATION_THRESHOLD = 3000; // Higher threshold preserves fog precision

  // Ping and Box state
  const [pings, setPings] = useState<Ping[]>([]);
  const [mapBoxes, setMapBoxes] = useState<MapBoxData[]>([]);
  const [isPingMode, setIsPingMode] = useState(false);
  const [isBoxMode, setIsBoxMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#ef4444"); // Default red
  const [boxOpacity, setBoxOpacity] = useState(0.3);
  const [selectedShape, setSelectedShape] = useState<ShapeType>("rectangle");
  const [isRulerMode, setIsRulerModeRaw] = useState(false);
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ x: number; y: number } | null>(null);
  const [remoteRulers, setRemoteRulers] = useState<{ id: string; start: { x: number; y: number }; end: { x: number; y: number } }[]>([]);
  const setIsRulerMode = (v: boolean) => {
    setIsRulerModeRaw(v);
    if (!v) { setRulerStart(null); setRulerEnd(null); broadcastRulerState(null, null); }
  };
  const lastBoxBroadcastTime = useRef<number>(0);
  const pendingBoxBroadcast = useRef<MapBoxData[] | null>(null);

  // Natural image dimensions for responsive sizing (no black bars)
  const [naturalImageSize, setNaturalImageSize] = useState<{ width: number; height: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Selected map entity for keyboard/right-click delete
  const [selectedMapEntity, setSelectedMapEntity] = useState<{ type: 'episode-mob' | 'runtime-mob' | 'crawler'; index: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'episode-mob' | 'runtime-mob' | 'crawler'; index: number } | null>(null);
  // Merchants: the small "Trade with Merchant" menu a player gets by tapping one, and the open trade window
  const [merchantMenu, setMerchantMenu] = useState<{ mobId: string; x: number; y: number } | null>(null);
  const [openMerchantId, setOpenMerchantId] = useState<string | null>(null);
  // Where a press on a mob started, so a drag isn't mistaken for a tap
  const mobPressRef = useRef<{ x: number; y: number } | null>(null);

  // Crawler and Mob placement state (DM can add during ShowTime)
  const [crawlerPlacements, setCrawlerPlacements] = useState<CrawlerPlacement[]>([]);
  const [runtimeMobPlacements, setRuntimeMobPlacements] = useState<EpisodeMobPlacement[]>([]);
  const [isAddCrawlerMode, setIsAddCrawlerMode] = useState(false);
  const [isAddMobMode, setIsAddMobMode] = useState(false);
  const [selectedCrawlerId, setSelectedCrawlerId] = useState<string | null>(null);
  const [selectedMobId, setSelectedMobId] = useState<string | null>(null);

  // Name overrides for crawlers/mobs (per-episode, not permanent)
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

  // Cursor follower state for ping/box mode
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const needsCentering = useRef(true);

  // Dragging state for runtime crawlers/mobs
  const [draggingRuntimeId, setDraggingRuntimeId] = useState<string | null>(null);

  // Local drag position for smooth visual feedback (avoids expensive state updates during drag)
  const [localDragPosition, setLocalDragPosition] = useState<{ index: number; x: number; y: number } | null>(null);

  // Panning state for map navigation
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Accumulated runtime placements across all visited maps (for combat/rest integration)
  const allMapCrawlerPlacementsRef = useRef<Map<string, CrawlerPlacement[]>>(new Map());
  const allMapRuntimeMobPlacementsRef = useRef<Map<string, EpisodeMobPlacement[]>>(new Map());

  // Get current map ID for fog of war storage - MUST be defined before useEffects that use it
  const currentMapId = useMemo(() => {
    if (!selectedEpisode || selectedEpisode.mapIds.length === 0) return null;
    return selectedEpisode.mapIds[currentMapIndex];
  }, [selectedEpisode, currentMapIndex]);

  // Keep selectedEpisode in sync with latest episode data from Firebase
  // This ensures changes made in the DM console (e.g., map scale) are reflected
  // Skip sync during active drag to prevent overwriting local drag position
  useEffect(() => {
    if (!selectedEpisode) return;
    if (draggingMobIdRef.current) return; // Don't overwrite during active drag
    const updated = episodes.find(e => e.id === selectedEpisode.id);
    if (updated) {
      // Use JSON comparison since getStableCollection may return same reference
      // even when nested properties (like mapSettings) have changed
      const currentJson = JSON.stringify(selectedEpisode);
      const updatedJson = JSON.stringify(updated);
      if (currentJson !== updatedJson) {
        setSelectedEpisode(updated);
      }
    }
  }, [episodes]);

  // Notify parent when episode active state changes
  useEffect(() => {
    onShowtimeActiveChange?.(!!selectedEpisode, selectedEpisode);
    // If DM deselected episode, reset gameStarted
    if (!selectedEpisode && gameStarted) {
      setGameStarted(false);
      onGameActiveChange?.(false);
    }
  }, [selectedEpisode, onShowtimeActiveChange, gameStarted, onGameActiveChange]);

  // Report runtime placements to parent (for PingPanel combat/rest integration)
  // Accumulates across all visited maps so switching maps doesn't lose data
  useEffect(() => {
    if (!currentMapId || !selectedEpisode) {
      // Episode closed — clear accumulated refs
      if (!selectedEpisode) {
        allMapCrawlerPlacementsRef.current.clear();
        allMapRuntimeMobPlacementsRef.current.clear();
        onRuntimePlacementsChange?.([], [], null);
      }
      return;
    }
    allMapCrawlerPlacementsRef.current.set(currentMapId, crawlerPlacements);
    allMapRuntimeMobPlacementsRef.current.set(currentMapId, runtimeMobPlacements);
    const allCrawler = Array.from(allMapCrawlerPlacementsRef.current.values()).flat();
    const allMob = Array.from(allMapRuntimeMobPlacementsRef.current.values()).flat();
    onRuntimePlacementsChange?.(allCrawler, allMob, currentMapId);
  }, [crawlerPlacements, runtimeMobPlacements, currentMapId, selectedEpisode, onRuntimePlacementsChange]);

  // Keep refs in sync with state (avoids listener re-subscription / stale closures)
  useEffect(() => {
    draggingMobIdRef.current = draggingMobId;
  }, [draggingMobId]);

  useEffect(() => {
    selectedEpisodeIdRef.current = selectedEpisode?.id ?? null;
  }, [selectedEpisode?.id]);

  // Broadcast showtime state to sync with other players
  const broadcastShowtimeState = useCallback(async (
    episodeId: string | null,
    mapIdx: number,
    mapUrl: string | null,
    started?: boolean
  ) => {
    if (!isAdmin || !db) return; // Only DM broadcasts; guard against null db

    const showtimeDocPath = roomId
      ? `rooms/${roomId}/showtime-state/current`
      : `showtime-state/current`;

    try {
      await setDoc(doc(db, showtimeDocPath), {
        episodeId,
        currentMapIndex: mapIdx,
        selectedMapUrl: mapUrl,
        isActive: episodeId !== null && mapUrl !== null,
        gameStarted: started ?? gameStarted,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast showtime state:', error);
    }
  }, [isAdmin, roomId, gameStarted]);

  // DM: when Show Time mounts again (refresh, or back from another page), pick up the running
  // episode from the shared showtime state instead of starting over, so players stay in the game
  const hasRestoredShowtime = useRef(false);
  useEffect(() => {
    if (!isAdmin || !db || hasRestoredShowtime.current || episodes.length === 0) return;
    hasRestoredShowtime.current = true;
    const showtimeDocPath = roomId
      ? `rooms/${roomId}/showtime-state/current`
      : `showtime-state/current`;
    getDoc(doc(db, showtimeDocPath)).then(snapshot => {
      if (!snapshot.exists() || selectedEpisodeIdRef.current) return;
      const data = snapshot.data();
      const episode = data.episodeId ? episodes.find(e => e.id === data.episodeId) : undefined;
      if (!episode || !data.isActive) return;
      const mapIdx = typeof data.currentMapIndex === 'number' && data.currentMapIndex < episode.mapIds.length ? data.currentMapIndex : 0;
      const mapUrl = maps[parseInt(episode.mapIds[mapIdx], 10)] || data.selectedMapUrl || null;
      console.log('[ShowTime] Restoring running episode', { episodeId: episode.id, mapIdx, gameStarted: data.gameStarted });
      setSelectedEpisode(episode);
      setCurrentMapIndex(mapIdx);
      setSelectedMap(mapUrl);
      needsCentering.current = true;
      if (data.gameStarted === true) {
        setGameStarted(true);
        onGameActiveChange?.(true);
      }
    }).catch(error => {
      console.error('[ShowTime] Failed to restore showtime state:', error);
    });
  }, [isAdmin, roomId, episodes, maps, onGameActiveChange]);

  // Listen for showtime state updates (for players)
  useEffect(() => {
    if (isAdmin || !db) return; // DM doesn't need to listen; guard against null db

    const showtimeDocPath = roomId
      ? `rooms/${roomId}/showtime-state/current`
      : `showtime-state/current`;

    const showtimeDocRef = doc(db, showtimeDocPath);

    const unsubscribe = onSnapshot(showtimeDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        // No showtime state - show waiting screen
        setSelectedEpisode(null);
        setSelectedMap(null);
        setGameStarted(false);
        return;
      }

      const data = snapshot.data();
      console.log('[ShowTime] Received showtime state update:', data);

      // Track game started state
      const isStarted = data.gameStarted === true;
      setGameStarted(isStarted);

      // Only show episode content to players when DM has started the game
      if (!isStarted) {
        setSelectedEpisode(null);
        setSelectedMap(null);
        localStorage.removeItem(SHOWTIME_STORAGE_KEY);
        return;
      }

      // Update episode if changed (use ref to avoid stale closure)
      if (data.episodeId) {
        const episode = episodes.find(e => e.id === data.episodeId);
        if (episode && episode.id !== selectedEpisodeIdRef.current) {
          setSelectedEpisode(episode);
        }
      } else {
        setSelectedEpisode(null);
        localStorage.removeItem(SHOWTIME_STORAGE_KEY);
      }

      // Update map index
      if (data.currentMapIndex !== undefined) {
        setCurrentMapIndex(data.currentMapIndex);
      }

      // Update selected map URL
      if (data.selectedMapUrl !== undefined) {
        setSelectedMap(data.selectedMapUrl);
      } else if (!data.isActive) {
        setSelectedMap(null);
      }
    });

    return () => unsubscribe();
  }, [isAdmin, roomId, episodes]);

  // Get the episode's configured base scale for the current map
  // This scales the map image itself (making it physically larger/smaller),
  // separate from the user's viewport zoom (mapScale)
  const mapBaseScale = useMemo(() => {
    if (!selectedEpisode || !currentMapId) return 100;
    return selectedEpisode.mapSettings?.[currentMapId]?.scale ?? 100;
  }, [selectedEpisode, currentMapId]);

  // Counter-scale for icons/shapes inside the mapBaseScale wrapper
  const iconCounterScale = 100 / mapBaseScale;

  // Fixed zoom limits - 1% minimum so users can always zoom out on any scale
  const zoomMin = 1;
  const zoomMax = 500;

  // Track map container size for responsive image sizing (no black bars).
  // The container only mounts once a map is showing (episode picker renders first),
  // so re-attach whenever the map view mounts instead of only on first render.
  const isMapViewMounted = !!selectedEpisode && !!selectedMap;
  useEffect(() => {
    if (!isMapViewMounted || !mapContainerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(mapContainerRef.current);
    return () => ro.disconnect();
  }, [isMapViewMounted]);

  // Calculate image display dimensions to fill container without black bars
  const mapDisplaySize = useMemo(() => {
    if (!naturalImageSize || !containerSize.width || !containerSize.height) return null;
    const cw = containerSize.width;
    const ch = containerSize.height;
    const aspectRatio = naturalImageSize.width / naturalImageSize.height;
    // Fit image to container (contain mode)
    let h = ch;
    let w = h * aspectRatio;
    if (w > cw) {
      w = cw;
      h = w / aspectRatio;
    }
    return { width: Math.round(w), height: Math.round(h) };
  }, [naturalImageSize, containerSize]);

  // Update mapImageDimensions when display size changes (container resize)
  useEffect(() => {
    if (mapDisplaySize && naturalImageSize) {
      setMapImageDimensions(mapDisplaySize);
    }
  }, [mapDisplaySize, naturalImageSize]);

  // Check if a point is visible (not completely obscured by fog)
  const isPointVisible = useCallback((x: number, y: number): boolean => {
    if (!fogOfWarEnabled) return true; // No fog = always visible
    if (isAdmin) return true; // Admin can always interact

    // Check if point is within any revealed area
    return revealedAreas.some(area => {
      const dx = x - area.x;
      const dy = y - area.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= area.radius;
    });
  }, [fogOfWarEnabled, isAdmin, revealedAreas]);

  // Non-admin players: wait for DM's Firebase broadcast to set episode
  useEffect(() => {
    if (episodes.length > 0 && !selectedEpisode && !hasAutoLoaded.current && !isAdmin) {
      hasAutoLoaded.current = true;
    }
  }, [episodes, isAdmin]);

  // Save episode/map selection to localStorage (fog state is persisted in Firebase, zoom always starts at 100%)
  useEffect(() => {
    if (selectedEpisode && selectedMap) {
      try {
        localStorage.setItem(SHOWTIME_STORAGE_KEY, JSON.stringify({
          episodeId: selectedEpisode.id,
          mapIndex: currentMapIndex,
        }));
      } catch (e) {
        console.error('[ShowTime] Failed to save state to localStorage:', e);
      }
    }
  }, [selectedEpisode?.id, currentMapIndex, selectedMap]);

  // Reset all per-map state when map changes (Firebase listeners will reload per-map data)
  useEffect(() => {
    if (!selectedEpisode || currentMapId === null) return;
    // Always start at 100% zoom
    setMapScale(100);
    // Center map in viewport — computed after image loads via the onLoad handler
    setPanOffset({ x: 0, y: 0 });
    // Reset per-map state so old map data doesn't bleed into new map
    setPings([]);
    setMapBoxes([]);
    setRevealedAreas([]);
    setFogOfWarEnabled(false);
    setCrawlerPlacements([]);
    setRuntimeMobPlacements([]);
    setRemoteRulers([]);
    setNameOverrides({});
    setEditingNameId(null);
    // Reset fog initial load flag so Firebase listener will reload fog for new map
    fogInitialLoadDone.current = null;
    // Reset natural image size so centering recalculates for new map
    setNaturalImageSize(null);
    setMapImageDimensions(null);
    // Flag that we need to center the map once dimensions are known
    needsCentering.current = true;
  }, [currentMapId]);

  // The reset above can run after the map image has already loaded (players get the episode a moment
  // after the map, and data-URL maps load at once), and then onLoad never fires again. Without a
  // natural size the map isn't fitted to the screen, so phones opened zoomed into its top-left corner.
  useEffect(() => {
    const img = mapImageRef.current;
    if (naturalImageSize || !img || !img.complete || img.naturalWidth === 0) return;
    setNaturalImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, [naturalImageSize, selectedMap, currentMapId]);

  // Center the map in the viewport when image dimensions become known (only on initial load)
  // Centering is handled solely via panOffset (not CSS flex centering) to avoid double-centering
  useEffect(() => {
    if (!needsCentering.current) return;
    // Prefer the fitted size: on the image's first load mapImageDimensions still holds the
    // pre-fit placeholder size until the effect above syncs it in the same commit
    const dims = mapDisplaySize ?? mapImageDimensions;
    if (!dims || !containerSize.width || !containerSize.height) return;
    needsCentering.current = false;
    const scaledW = dims.width * mapBaseScale / 100;
    const scaledH = dims.height * mapBaseScale / 100;
    const cw = containerSize.width;
    const ch = containerSize.height;
    // Center map in container: positive offset centers smaller maps,
    // negative offset centers larger maps (showing the middle)
    const offsetX = (cw - scaledW) / 2;
    const offsetY = (ch - scaledH) / 2;
    setPanOffset({ x: offsetX, y: offsetY });
  }, [mapImageDimensions, mapDisplaySize, containerSize, mapBaseScale]);

  // Listen for real-time drag updates from other players
  useEffect(() => {
    if (!selectedEpisode || !db) return;

    const episodeId = selectedEpisode.id;

    // Use a single document per episode for drag state
    const dragDocPath = roomId
      ? `rooms/${roomId}/mob-drag-state/${episodeId}`
      : `mob-drag-state/${episodeId}`;

    const dragDocRef = doc(db, dragDocPath);

    console.log('[ShowTime] Setting up drag listener for episode:', episodeId);

    const unsubscribe = onSnapshot(dragDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      const dragData = snapshot.data();

      // Only apply if we're not the one currently dragging (use ref to avoid re-subscription)
      if (!draggingMobIdRef.current) {
        if (dragData.updatedAt) {
          const updateTime = dragData.updatedAt.toMillis ? dragData.updatedAt.toMillis() : 0;
          const mountTimeMs = mountTime.current.toMillis();

          // Only apply updates that happened after component mounted
          if (updateTime > mountTimeMs) {
            setRemoteDragState({
              placementIndex: dragData.placementIndex,
              x: dragData.x,
              y: dragData.y
            });

            // Update local episode state with remote drag position
            setSelectedEpisode(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                mobPlacements: prev.mobPlacements.map((p, i) =>
                  i === dragData.placementIndex ? { ...p, x: dragData.x, y: dragData.y } : p
                ),
              };
            });
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedEpisode?.id, roomId]); // Removed draggingMobId - using ref instead to avoid re-subscription

  // Broadcast drag state to other players (all users can broadcast)
  const broadcastDragState = useCallback(async (placementIndex: number, x: number, y: number) => {
    if (!selectedEpisode || !db) return;

    const dragDocPath = roomId
      ? `rooms/${roomId}/mob-drag-state/${selectedEpisode.id}`
      : `mob-drag-state/${selectedEpisode.id}`;

    try {
      await setDoc(doc(db, dragDocPath), {
        episodeId: selectedEpisode.id,
        placementIndex,
        x,
        y,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast drag state:', error);
    }
  }, [selectedEpisode?.id, roomId]);

  // Track if we've done the initial fog load for this map
  const fogInitialLoadDone = useRef<string | null>(null);

  // Listen for fog of war updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const fogDocPath = roomId
      ? `rooms/${roomId}/fog-of-war/${selectedEpisode.id}-${currentMapId}`
      : `fog-of-war/${selectedEpisode.id}-${currentMapId}`;

    const fogDocRef = doc(db, fogDocPath);
    const fogKey = `${selectedEpisode.id}-${currentMapId}`;

    const unsubscribe = onSnapshot(fogDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        // No fog document exists - this is a fresh map
        fogInitialLoadDone.current = fogKey;
        return;
      }

      const fogData = snapshot.data();
      const isInitialLoad = fogInitialLoadDone.current !== fogKey;

      // Always load on initial page load (to restore saved state)
      // For subsequent updates, only sync if update is newer than mount time or user is not admin
      if (isInitialLoad) {
        // Initial load - restore saved fog state
        setFogOfWarEnabled(fogData.enabled ?? false);
        setRevealedAreas(fogData.revealedAreas ?? []);
        fogInitialLoadDone.current = fogKey;
      } else if (fogData.updatedAt) {
        const updateTime = fogData.updatedAt.toMillis ? fogData.updatedAt.toMillis() : 0;
        const mountTimeMs = mountTime.current.toMillis();

        if (updateTime > mountTimeMs || !isAdmin) {
          setFogOfWarEnabled(fogData.enabled ?? false);
          setRevealedAreas(fogData.revealedAreas ?? []);
        }
      }
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId, isAdmin]);

  // Consolidate overlapping circles into fewer, larger circles
  // This maintains coverage while reducing array size for better performance
  const consolidateFogCircles = useCallback((areas: { x: number; y: number; radius: number }[]) => {
    if (areas.length <= CONSOLIDATION_THRESHOLD) return areas;

    // Group nearby circles and merge them
    const consolidated: { x: number; y: number; radius: number }[] = [];
    const used = new Set<number>();

    for (let i = 0; i < areas.length; i++) {
      if (used.has(i)) continue;

      const cluster = [areas[i]];
      used.add(i);

      // Find all circles close to this one
      for (let j = i + 1; j < areas.length; j++) {
        if (used.has(j)) continue;

        const dx = areas[j].x - areas[i].x;
        const dy = areas[j].y - areas[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If circles overlap significantly, add to cluster
        if (distance < areas[i].radius + areas[j].radius * 0.5) {
          cluster.push(areas[j]);
          used.add(j);
        }
      }

      if (cluster.length === 1) {
        consolidated.push(cluster[0]);
      } else {
        // Merge cluster into a single larger circle
        // Find bounding box center and radius that covers all circles
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const c of cluster) {
          minX = Math.min(minX, c.x - c.radius);
          maxX = Math.max(maxX, c.x + c.radius);
          minY = Math.min(minY, c.y - c.radius);
          maxY = Math.max(maxY, c.y + c.radius);
        }
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const newRadius = Math.max((maxX - minX) / 2, (maxY - minY) / 2);

        consolidated.push({ x: centerX, y: centerY, radius: newRadius });
      }
    }

    return consolidated;
  }, []);

  // Broadcast fog of war state
  const broadcastFogState = useCallback(async (
    enabled: boolean,
    areas: { x: number; y: number; radius: number }[],
    scale: number
  ) => {
    if (!selectedEpisode || !currentMapId || !isAdmin || !db) return;

    const fogDocPath = roomId
      ? `rooms/${roomId}/fog-of-war/${selectedEpisode.id}-${currentMapId}`
      : `fog-of-war/${selectedEpisode.id}-${currentMapId}`;

    try {
      await setDoc(doc(db, fogDocPath), {
        episodeId: selectedEpisode.id,
        mapId: currentMapId,
        enabled,
        revealedAreas: areas,
        scale,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast fog state:', error);
    }
  }, [selectedEpisode?.id, currentMapId, roomId, isAdmin]);

  // Handle revealing fog of war areas
  const handleFogReveal = useCallback((x: number, y: number, radius: number) => {
    setRevealedAreas(prev => {
      // Optimization: Check if this point is already covered by existing circles
      // If the new circle's center is within an existing circle (with some margin),
      // we can skip adding it to reduce array size and improve rendering performance
      const coverageThreshold = radius * 0.6; // Allow some overlap
      const isAlreadyCovered = prev.some(area => {
        const dx = area.x - x;
        const dy = area.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // If the distance to an existing circle's center is less than its radius minus threshold,
        // the new circle is mostly covered
        return distance < (area.radius - coverageThreshold);
      });

      if (isAlreadyCovered) {
        return prev; // Skip adding redundant circle
      }

      // Add new circle
      const newAreas = [...prev, { x, y, radius }];

      // Track pending broadcast for final sync
      pendingFogBroadcast.current = newAreas;

      // Throttle broadcast
      const now = Date.now();
      if (now - lastFogBroadcastTime.current >= FOG_BROADCAST_THROTTLE_MS) {
        lastFogBroadcastTime.current = now;
        pendingFogBroadcast.current = null;
        broadcastFogState(fogOfWarEnabled, newAreas, mapScale);
      }

      return newAreas;
    });
  }, [fogOfWarEnabled, mapScale, broadcastFogState]);

  // Handle painting fog back over previously cleared areas
  const handleFogPaint = useCallback((x: number, y: number, radius: number) => {
    setRevealedAreas(prev => {
      // Remove revealed circles whose centers fall within the paint brush radius
      const newAreas = prev.filter(area => {
        const dx = area.x - x;
        const dy = area.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance > radius + area.radius * 0.5;
      });

      if (newAreas.length === prev.length) return prev; // Nothing changed

      pendingFogBroadcast.current = newAreas;

      const now = Date.now();
      if (now - lastFogBroadcastTime.current >= FOG_BROADCAST_THROTTLE_MS) {
        lastFogBroadcastTime.current = now;
        pendingFogBroadcast.current = null;
        broadcastFogState(fogOfWarEnabled, newAreas, mapScale);
      }

      return newAreas;
    });
  }, [fogOfWarEnabled, mapScale, broadcastFogState]);

  // Handle fog drawing end - ensure final state is broadcast
  const handleFogDrawingEnd = useCallback(() => {
    // Consolidate on drawing end (not during) to avoid visible jumps
    setRevealedAreas(prev => {
      const areas = prev.length > CONSOLIDATION_THRESHOLD ? consolidateFogCircles(prev) : prev;
      broadcastFogState(fogOfWarEnabled, areas, mapScale);
      pendingFogBroadcast.current = null;
      return areas;
    });
  }, [fogOfWarEnabled, mapScale, broadcastFogState, consolidateFogCircles]);

  // Toggle fog of war
  const handleToggleFogOfWar = useCallback(() => {
    const newEnabled = !fogOfWarEnabled;
    setFogOfWarEnabled(newEnabled);
    // Reset brush modes when toggling fog so paint/eraser don't auto-activate
    setFogPaintActive(false);
    setFogEraserActive(false);
    broadcastFogState(newEnabled, revealedAreas, mapScale);
  }, [fogOfWarEnabled, revealedAreas, mapScale, broadcastFogState]);

  // Listen for ping updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const pingDocPath = roomId
      ? `rooms/${roomId}/pings/${selectedEpisode.id}-${currentMapId}`
      : `pings/${selectedEpisode.id}-${currentMapId}`;

    const pingDocRef = doc(db, pingDocPath);

    const unsubscribe = onSnapshot(pingDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPings([]);
        return;
      }

      const pingData = snapshot.data();
      if (pingData.pings) {
        // Filter out old pings (older than 3 seconds)
        const now = Date.now();
        const activePings = pingData.pings.filter((p: Ping) => now - p.timestamp < 3000);
        setPings(activePings);
      }
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Listen for box updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const boxDocPath = roomId
      ? `rooms/${roomId}/map-boxes/${selectedEpisode.id}-${currentMapId}`
      : `map-boxes/${selectedEpisode.id}-${currentMapId}`;

    const boxDocRef = doc(db, boxDocPath);

    const unsubscribe = onSnapshot(boxDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        setMapBoxes([]);
        return;
      }

      const boxData = snapshot.data();
      setMapBoxes(boxData.boxes ?? []);
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Broadcast a ping
  const broadcastPing = useCallback(async (x: number, y: number, color: string) => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const pingDocPath = roomId
      ? `rooms/${roomId}/pings/${selectedEpisode.id}-${currentMapId}`
      : `pings/${selectedEpisode.id}-${currentMapId}`;

    const newPing: Ping = {
      id: `ping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      color,
      timestamp: Date.now(),
    };

    try {
      // Get current pings and add new one
      const currentPings = [...pings, newPing].filter(p => Date.now() - p.timestamp < 3000);
      await setDoc(doc(db, pingDocPath), {
        episodeId: selectedEpisode.id,
        mapId: currentMapId,
        pings: currentPings,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast ping:', error);
    }
  }, [selectedEpisode?.id, currentMapId, roomId, pings]);

  // Broadcast box updates
  const broadcastBoxes = useCallback(async (boxes: MapBoxData[]) => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const boxDocPath = roomId
      ? `rooms/${roomId}/map-boxes/${selectedEpisode.id}-${currentMapId}`
      : `map-boxes/${selectedEpisode.id}-${currentMapId}`;

    try {
      await setDoc(doc(db, boxDocPath), {
        episodeId: selectedEpisode.id,
        mapId: currentMapId,
        boxes,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast boxes:', error);
    }
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Generate a stable ruler ID for this user session
  const rulerSessionId = useRef(`ruler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Broadcast ruler state to other players
  const broadcastRulerState = useCallback(async (start: { x: number; y: number } | null, end: { x: number; y: number } | null) => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const rulerDocPath = roomId
      ? `rooms/${roomId}/ruler-state/${selectedEpisode.id}-${currentMapId}`
      : `ruler-state/${selectedEpisode.id}-${currentMapId}`;

    try {
      const rulerData = start && end ? {
        id: rulerSessionId.current,
        start,
        end,
      } : null;

      // Read current rulers, update ours
      const currentRulers = remoteRulers.filter(r => r.id !== rulerSessionId.current);
      const allRulers = rulerData ? [...currentRulers, rulerData] : currentRulers;

      await setDoc(doc(db, rulerDocPath), {
        rulers: allRulers,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast ruler state:', error);
    }
  }, [selectedEpisode?.id, currentMapId, roomId, remoteRulers]);

  // Listen for ruler state updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const rulerDocPath = roomId
      ? `rooms/${roomId}/ruler-state/${selectedEpisode.id}-${currentMapId}`
      : `ruler-state/${selectedEpisode.id}-${currentMapId}`;

    const rulerDocRef = doc(db, rulerDocPath);

    const unsubscribe = onSnapshot(rulerDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        setRemoteRulers([]);
        return;
      }
      const data = snapshot.data();
      // Filter out our own ruler
      const others = (data.rulers ?? []).filter((r: { id: string; start: { x: number; y: number }; end: { x: number; y: number } }) => r.id !== rulerSessionId.current);
      setRemoteRulers(others);
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Throttle ruler broadcasts
  const lastRulerBroadcastTime = useRef<number>(0);
  const RULER_BROADCAST_THROTTLE_MS = 50;

  // Handle adding a box
  const handleAddBox = useCallback((x: number, y: number, color: string, opacity: number, shape: ShapeType = "rectangle") => {
    // Square and circle get equal width/height, rectangle is wider
    const isEqualDimensions = shape === "square" || shape === "circle";
    const newBox: MapBoxData = {
      id: `box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      width: isEqualDimensions ? 5 : 15,
      height: isEqualDimensions ? 5 : 10,
      rotation: 0,
      color,
      opacity,
      createdBy: isAdmin ? 'admin' : 'user',
      shape,
    };
    setMapBoxes(prev => {
      const updatedBoxes = [...prev, newBox];
      broadcastBoxes(updatedBoxes);
      return updatedBoxes;
    });
    // Deselect shape mode after placing
    setIsBoxMode(false);
  }, [broadcastBoxes, isAdmin]);

  // Handle updating a box with throttled broadcast
  const handleUpdateBox = useCallback((updatedBox: MapBoxData) => {
    setMapBoxes(prev => {
      const updatedBoxes = prev.map(b => b.id === updatedBox.id ? updatedBox : b);

      // Track pending broadcast for final sync
      pendingBoxBroadcast.current = updatedBoxes;

      // Throttle broadcasts to prevent lag during drag/resize/rotate
      const now = Date.now();
      if (now - lastBoxBroadcastTime.current >= BROADCAST_THROTTLE_MS) {
        lastBoxBroadcastTime.current = now;
        pendingBoxBroadcast.current = null;
        broadcastBoxes(updatedBoxes);
      }

      return updatedBoxes;
    });
  }, [broadcastBoxes]);

  // Handle box manipulation end - ensure final state is broadcast
  const handleBoxManipulationEnd = useCallback(() => {
    if (pendingBoxBroadcast.current) {
      broadcastBoxes(pendingBoxBroadcast.current);
      pendingBoxBroadcast.current = null;
    }
  }, [broadcastBoxes]);

  // Handle deleting a box
  const handleDeleteBox = useCallback((id: string) => {
    setMapBoxes(prev => {
      const updatedBoxes = prev.filter(b => b.id !== id);
      broadcastBoxes(updatedBoxes);
      return updatedBoxes;
    });
  }, [broadcastBoxes]);

  // Broadcast crawler placements (all users can broadcast)
  const broadcastCrawlerPlacements = useCallback(async (placements: CrawlerPlacement[]) => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const crawlerDocPath = roomId
      ? `rooms/${roomId}/crawler-placements/${selectedEpisode.id}-${currentMapId}`
      : `crawler-placements/${selectedEpisode.id}-${currentMapId}`;

    try {
      await setDoc(doc(db, crawlerDocPath), {
        episodeId: selectedEpisode.id,
        mapId: currentMapId,
        placements,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast crawler placements:', error);
    }
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Broadcast runtime mob placements (all users can broadcast)
  const broadcastRuntimeMobPlacements = useCallback(async (placements: EpisodeMobPlacement[]) => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const mobDocPath = roomId
      ? `rooms/${roomId}/runtime-mob-placements/${selectedEpisode.id}-${currentMapId}`
      : `runtime-mob-placements/${selectedEpisode.id}-${currentMapId}`;

    try {
      await setDoc(doc(db, mobDocPath), {
        episodeId: selectedEpisode.id,
        mapId: currentMapId,
        placements,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast runtime mob placements:', error);
    }
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Handle adding a crawler to the map
  const handleAddCrawlerToMap = useCallback((x: number, y: number) => {
    if (!selectedCrawlerId || !currentMapId) return;

    const newPlacement: CrawlerPlacement = {
      crawlerId: selectedCrawlerId,
      mapId: currentMapId,
      x,
      y,
    };
    const updated = [...crawlerPlacements, newPlacement];
    setCrawlerPlacements(updated);
    broadcastCrawlerPlacements(updated);
  }, [selectedCrawlerId, currentMapId, crawlerPlacements, broadcastCrawlerPlacements]);

  // Handle adding a mob to the map at runtime
  const handleAddMobToMapRuntime = useCallback((x: number, y: number) => {
    if (!selectedMobId || !currentMapId) return;

    // Compute next letterIndex: find max letterIndex for this mobId across all placements
    const episodePlacements = selectedEpisode?.mobPlacements ?? [];
    const allSameId = [...episodePlacements, ...runtimeMobPlacements].filter(p => p.mobId === selectedMobId);
    const maxLetterIndex = allSameId.reduce((max, p) => Math.max(max, p.letterIndex ?? -1), -1);

    const newPlacement: EpisodeMobPlacement = {
      mobId: selectedMobId,
      mapId: currentMapId,
      x,
      y,
      letterIndex: maxLetterIndex + 1,
    };
    const updated = [...runtimeMobPlacements, newPlacement];
    setRuntimeMobPlacements(updated);
    broadcastRuntimeMobPlacements(updated);
  }, [selectedMobId, currentMapId, runtimeMobPlacements, selectedEpisode?.mobPlacements, broadcastRuntimeMobPlacements]);

  // Handle removing a crawler from the map
  const handleRemoveCrawlerFromMap = useCallback((index: number) => {
    const updated = crawlerPlacements.filter((_, i) => i !== index);
    setCrawlerPlacements(updated);
    broadcastCrawlerPlacements(updated);
  }, [crawlerPlacements, broadcastCrawlerPlacements]);

  // Count mob occurrences across ALL placements (episode + runtime) to match PingPanel's combatId logic
  // Must be declared before handleRemoveRuntimeMob/handleRemoveEpisodeMob which reference it
  const allPlacementsMobCounts = useMemo(() => {
    const episodePlacements = selectedEpisode?.mobPlacements ?? [];
    const runtimePlacements = runtimeMobPlacements ?? [];
    const allPlacements = [...episodePlacements, ...runtimePlacements];
    const counts: Record<string, number> = {};
    allPlacements.forEach(p => { counts[p.mobId] = (counts[p.mobId] ?? 0) + 1; });
    return counts;
  }, [selectedEpisode?.mobPlacements, runtimeMobPlacements]);

  // Handle removing a runtime mob from the map
  const handleRemoveRuntimeMob = useCallback((index: number) => {
    // Remove from combat if active
    if (combatState?.active && onRemoveCombatant) {
      const episodePlacementCount = selectedEpisode?.mobPlacements?.length ?? 0;
      const placementIdx = episodePlacementCount + index;
      const placement = runtimeMobPlacements[index];
      if (placement) {
        const totalSameId = allPlacementsMobCounts[placement.mobId] ?? 1;
        const combatId = totalSameId > 1 ? `${placement.mobId}:${placementIdx}` : placement.mobId;
        if (combatState.combatants.some(c => c.id === combatId)) {
          onRemoveCombatant(combatId);
        } else {
          // Also check bare mobId for pre-suffix entries
          const bareMatch = combatState.combatants.find(c => c.id === placement.mobId || c.sourceId === placement.mobId);
          if (bareMatch) onRemoveCombatant(bareMatch.id);
        }
      }
    }
    const updated = runtimeMobPlacements.filter((_, i) => i !== index);
    setRuntimeMobPlacements(updated);
    broadcastRuntimeMobPlacements(updated);
  }, [runtimeMobPlacements, broadcastRuntimeMobPlacements, combatState, onRemoveCombatant, selectedEpisode?.mobPlacements?.length, allPlacementsMobCounts]);

  // Handle removing an episode mob from the map (persists to episode)
  const handleRemoveEpisodeMob = useCallback((globalIndex: number) => {
    if (!selectedEpisode || !onUpdateEpisode) return;
    // Remove from combat if active
    if (combatState?.active && onRemoveCombatant) {
      const placement = selectedEpisode.mobPlacements[globalIndex];
      if (placement) {
        const totalSameId = allPlacementsMobCounts[placement.mobId] ?? 1;
        const combatId = totalSameId > 1 ? `${placement.mobId}:${globalIndex}` : placement.mobId;
        if (combatState.combatants.some(c => c.id === combatId)) {
          onRemoveCombatant(combatId);
        } else {
          // Also check bare mobId for pre-suffix entries
          const bareMatch = combatState.combatants.find(c => c.id === placement.mobId || c.sourceId === placement.mobId);
          if (bareMatch) onRemoveCombatant(bareMatch.id);
        }
      }
    }
    const updated = selectedEpisode.mobPlacements.filter((_, i) => i !== globalIndex);
    const updatedEpisode = { ...selectedEpisode, mobPlacements: updated };
    setSelectedEpisode(updatedEpisode);
    onUpdateEpisode(selectedEpisode.id, { mobPlacements: updated });
  }, [selectedEpisode, onUpdateEpisode, combatState, onRemoveCombatant, allPlacementsMobCounts]);

  // Handle delete for selected map entity (Delete key or context menu)
  const handleDeleteSelectedEntity = useCallback(() => {
    if (!isAdmin || !selectedMapEntity) return;
    if (selectedMapEntity.type === 'episode-mob') {
      handleRemoveEpisodeMob(selectedMapEntity.index);
    } else if (selectedMapEntity.type === 'runtime-mob') {
      handleRemoveRuntimeMob(selectedMapEntity.index);
    } else if (selectedMapEntity.type === 'crawler') {
      handleRemoveCrawlerFromMap(selectedMapEntity.index);
    }
    setSelectedMapEntity(null);
    setContextMenu(null);
  }, [isAdmin, selectedMapEntity, handleRemoveEpisodeMob, handleRemoveRuntimeMob, handleRemoveCrawlerFromMap]);

  // Keyboard listener for Delete/Backspace to remove selected entity
  useEffect(() => {
    if (!selectedMap || !isAdmin) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedMapEntity) {
          e.preventDefault();
          handleDeleteSelectedEntity();
        }
      }
      if (e.key === 'Escape') {
        setSelectedMapEntity(null);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMap, isAdmin, selectedMapEntity, handleDeleteSelectedEntity]);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Handle map click for ping/box/crawlers/mobs
  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapImageRef.current) return;
    if (draggingMobId) return; // Don't do anything while dragging

    const rect = mapImageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    if (isRulerMode) {
      if (!rulerStart) {
        setRulerStart({ x: clampedX, y: clampedY });
        setRulerEnd({ x: clampedX, y: clampedY });
        broadcastRulerState({ x: clampedX, y: clampedY }, { x: clampedX, y: clampedY });
      } else {
        setRulerStart(null);
        setRulerEnd(null);
        broadcastRulerState(null, null);
      }
    } else if (isPingMode) {
      broadcastPing(clampedX, clampedY, selectedColor);
    } else if (isBoxMode) {
      // All users can add boxes
      handleAddBox(clampedX, clampedY, selectedColor, boxOpacity, selectedShape);
    } else if (isAddCrawlerMode && isAdmin && selectedCrawlerId) {
      handleAddCrawlerToMap(clampedX, clampedY);
    } else if (isAddMobMode && isAdmin && selectedMobId) {
      handleAddMobToMapRuntime(clampedX, clampedY);
    }
  }, [isPingMode, isBoxMode, isRulerMode, rulerStart, isAddCrawlerMode, isAddMobMode, isAdmin, selectedColor, boxOpacity, selectedCrawlerId, selectedMobId, draggingMobId, broadcastPing, handleAddBox, handleAddCrawlerToMap, handleAddMobToMapRuntime]);

  // Auto-clean old pings
  useEffect(() => {
    const interval = setInterval(() => {
      setPings(prev => prev.filter(p => Date.now() - p.timestamp < 3000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Handle zoom for all users
  const handleZoomIn = useCallback(() => {
    setMapScale(prev => Math.min(prev + 25, zoomMax));
  }, []);

  const handleZoomOut = useCallback(() => {
    setMapScale(prev => Math.max(prev - 25, zoomMin));
  }, []);

  // Handle scroll wheel zoom - applied globally so it works regardless of cursor position
  useEffect(() => {
    if (!selectedMap) return;

    const handleWheel = (e: WheelEvent) => {
      // Over a floating panel (game chat, dice, ping panel, menus) the wheel scrolls that panel
      if ((e.target as Element | null)?.closest?.('.fixed, [role="dialog"], [data-radix-popper-content-wrapper]')) return;
      e.preventDefault();
      // Proportional zoom: step scales with current zoom level for smooth feel
      // At 100% → step ~3, at 50% → step ~1.5, at 200% → step ~6
      setMapScale(prev => {
        const step = Math.max(1, prev * 0.03);
        if (e.deltaY < 0) {
          return Math.min(prev + step, zoomMax);
        } else {
          return Math.max(prev - step, zoomMin);
        }
      });
    };

    // Prevent page scroll and apply zoom globally
    document.body.style.overflow = 'hidden';
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('wheel', handleWheel);
    };
  }, [selectedMap]);

  // Refs for throttling runtime drag broadcasts
  const lastCrawlerBroadcastTime = useRef<number>(0);
  const lastRuntimeMobBroadcastTime = useRef<number>(0);

  // Feet between two map points, using the Ruler's scale (5 ft per token-sized grid square)
  const mapDistanceFeet = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const img = mapImageRef.current;
    if (!img) return 0;
    return getMapDistanceFeet(from, to, img.clientWidth, img.clientHeight, gridSize * iconCounterScale);
  }, [gridSize, iconCounterScale]);

  const isCombatTurnPhase = !!(combatState?.active && combatState.phase === 'combat');
  const isCombatActive = !!(combatState?.active && combatState.phase !== 'ended');

  // Movement status for a crawler. In combat: their speed per combat turn, only on their turn.
  // Outside combat, while noncombat turns are running for this episode: NONCOMBAT_MOVE_MULTIPLIER
  // times their speed per noncombat turn. Returns null when movement isn't tracked (a crawler
  // not in the fight, the initiative phase, or no noncombat turn running).
  const getCrawlerMoveStatus = useCallback((crawlerId: string) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    const speed = crawler ? getEffectiveMoveSpeed(crawler, getCrawlerInventory?.(crawlerId) ?? []) : 0;
    const isOwner = !currentPlayerId || currentPlayerId === crawlerId;
    if (isCombatTurnPhase && combatState) {
      const combatant = combatState.combatants.find(c => c.type === 'crawler' && c.id === crawlerId);
      if (!combatant) return null;
      const isTheirTurn = combatState.combatants[combatState.currentTurnIndex]?.id === crawlerId;
      const used = combatant.feetMovedThisTurn ?? 0;
      return { speed, used, remaining: Math.max(0, speed - used), canMove: isTheirTurn && isOwner, isTheirTurn, label: 'per combat turn' };
    }
    if (isCombatActive) return null;
    const turnEpisodeId = noncombatTurnState?.episodeId;
    if (!noncombatTurnState || (turnEpisodeId && selectedEpisode && turnEpisodeId !== selectedEpisode.id)) return null;
    const turnSpeed = speed * NONCOMBAT_MOVE_MULTIPLIER;
    const used = noncombatTurnState.feetMoved?.[crawlerId] ?? 0;
    return { speed: turnSpeed, used, remaining: Math.max(0, turnSpeed - used), canMove: isOwner, isTheirTurn: true, label: 'per noncombat turn' };
  }, [isCombatTurnPhase, isCombatActive, combatState, noncombatTurnState, selectedEpisode, crawlers, getCrawlerInventory, currentPlayerId]);

  // Movement budget that limits a drag. The DM can always reposition freely.
  const getCrawlerMoveBudget = useCallback((crawlerId: string) => (
    isAdmin ? null : getCrawlerMoveStatus(crawlerId)
  ), [isAdmin, getCrawlerMoveStatus]);

  // Where the current crawler drag started (to measure and limit the move)
  const crawlerDragStartRef = useRef<{ index: number; x: number; y: number } | null>(null);

  const startCrawlerDrag = (index: number) => {
    const placement = crawlerPlacements[index];
    if (!placement) return;
    const budget = getCrawlerMoveBudget(placement.crawlerId);
    if (budget && !budget.canMove) return; // Locked: not this player's crawler, or not its combat turn
    crawlerDragStartRef.current = { index, x: placement.x, y: placement.y };
    setDraggingRuntimeId(`crawler-${index}`);
  };

  // Handle dragging runtime crawlers (all users can drag; limited by movement speed in combat)
  const handleRuntimeCrawlerDrag = useCallback((index: number, rawX: number, rawY: number) => {
    let x = rawX;
    let y = rawY;
    const start = crawlerDragStartRef.current;
    const placement = crawlerPlacements[index];
    if (start && start.index === index && placement) {
      const budget = getCrawlerMoveBudget(placement.crawlerId);
      if (budget) {
        const dist = mapDistanceFeet(start, { x, y });
        if (dist > budget.remaining) {
          // Stop the token on the drag line at exactly the remaining distance
          const t = dist > 0 ? budget.remaining / dist : 0;
          x = start.x + (x - start.x) * t;
          y = start.y + (y - start.y) * t;
        }
      }
    }
    const updated = crawlerPlacements.map((p, i) =>
      i === index ? { ...p, x, y } : p
    );
    setCrawlerPlacements(updated);

    // Throttled broadcast during drag for real-time sync
    const now = Date.now();
    if (now - lastCrawlerBroadcastTime.current >= BROADCAST_THROTTLE_MS) {
      lastCrawlerBroadcastTime.current = now;
      broadcastCrawlerPlacements(updated);
    }
  }, [crawlerPlacements, broadcastCrawlerPlacements, getCrawlerMoveBudget, mapDistanceFeet]);

  const handleRuntimeCrawlerDragEnd = useCallback((index: number) => {
    // Final broadcast to ensure position is synced
    broadcastCrawlerPlacements(crawlerPlacements);

    // Record the move: a player's own drags count toward their stats and, in combat,
    // spend their movement for the turn. DM repositioning doesn't count.
    const start = crawlerDragStartRef.current;
    crawlerDragStartRef.current = null;
    const placement = crawlerPlacements[index];
    if (!start || start.index !== index || !placement || isAdmin) return;
    if (!currentPlayerId || currentPlayerId !== placement.crawlerId) return;
    const feet = mapDistanceFeet(start, placement);
    if (feet > 0) {
      const from = selectedEpisode ? { episodeId: selectedEpisode.id, mapId: placement.mapId, x: start.x, y: start.y } : undefined;
      onRecordCrawlerMove?.(placement.crawlerId, feet, !!getCrawlerMoveBudget(placement.crawlerId), from);
    }
  }, [crawlerPlacements, broadcastCrawlerPlacements, isAdmin, currentPlayerId, mapDistanceFeet, onRecordCrawlerMove, getCrawlerMoveBudget, selectedEpisode]);

  // Handle dragging runtime mobs (all users can drag)
  const handleRuntimeMobDrag = useCallback((index: number, x: number, y: number) => {
    const updated = runtimeMobPlacements.map((p, i) =>
      i === index ? { ...p, x, y } : p
    );
    setRuntimeMobPlacements(updated);

    // Throttled broadcast during drag for real-time sync
    const now = Date.now();
    if (now - lastRuntimeMobBroadcastTime.current >= BROADCAST_THROTTLE_MS) {
      lastRuntimeMobBroadcastTime.current = now;
      broadcastRuntimeMobPlacements(updated);
    }
  }, [runtimeMobPlacements, broadcastRuntimeMobPlacements]);

  const handleRuntimeMobDragEnd = useCallback((index: number) => {
    // Final broadcast to ensure position is synced
    broadcastRuntimeMobPlacements(runtimeMobPlacements);
  }, [runtimeMobPlacements, broadcastRuntimeMobPlacements]);

  // Initialize crawler placements from episode when map changes (if DM)
  useEffect(() => {
    if (!selectedEpisode || !currentMapId || !isAdmin) return;

    // Check if episode has pre-placed crawlers for this map
    const episodeCrawlerPlacements = selectedEpisode.crawlerPlacements?.filter(
      p => p.mapId === currentMapId
    ) || [];

    // If there are pre-placed crawlers and no current placements, initialize them
    if (episodeCrawlerPlacements.length > 0 && crawlerPlacements.filter(p => p.mapId === currentMapId).length === 0) {
      setCrawlerPlacements(episodeCrawlerPlacements);
      // Broadcast to Firebase so other players see them
      broadcastCrawlerPlacements(episodeCrawlerPlacements);
    }
  }, [selectedEpisode?.id, currentMapId, isAdmin]);

  // Listen for crawler placement updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const crawlerDocPath = roomId
      ? `rooms/${roomId}/crawler-placements/${selectedEpisode.id}-${currentMapId}`
      : `crawler-placements/${selectedEpisode.id}-${currentMapId}`;

    const crawlerDocRef = doc(db, crawlerDocPath);

    const unsubscribe = onSnapshot(crawlerDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        // If no Firebase data exists yet, check episode for pre-placed crawlers
        const episodeCrawlerPlacements = selectedEpisode.crawlerPlacements?.filter(
          p => p.mapId === currentMapId
        ) || [];
        setCrawlerPlacements(episodeCrawlerPlacements);
        return;
      }

      const data = snapshot.data();
      setCrawlerPlacements(data.placements ?? []);
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Listen for runtime mob placement updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const mobDocPath = roomId
      ? `rooms/${roomId}/runtime-mob-placements/${selectedEpisode.id}-${currentMapId}`
      : `runtime-mob-placements/${selectedEpisode.id}-${currentMapId}`;

    const mobDocRef = doc(db, mobDocPath);

    const unsubscribe = onSnapshot(mobDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        setRuntimeMobPlacements([]);
        return;
      }

      const data = snapshot.data();
      setRuntimeMobPlacements(data.placements ?? []);
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Broadcast displayed mob IDs so players can see mob cards
  const broadcastDisplayedMobs = useCallback(async (mobIds: string[]) => {
    if (!selectedEpisode || !isAdmin || !db) return;

    const displayDocPath = roomId
      ? `rooms/${roomId}/displayed-mobs/${selectedEpisode.id}`
      : `displayed-mobs/${selectedEpisode.id}`;

    try {
      await setDoc(doc(db, displayDocPath), {
        mobIds,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast displayed mobs:', error);
    }
  }, [selectedEpisode?.id, roomId, isAdmin]);

  // Listen for displayed mob updates (for players)
  useEffect(() => {
    if (isAdmin || !selectedEpisode || !db) return;

    const displayDocPath = roomId
      ? `rooms/${roomId}/displayed-mobs/${selectedEpisode.id}`
      : `displayed-mobs/${selectedEpisode.id}`;

    const displayDocRef = doc(db, displayDocPath);

    const unsubscribe = onSnapshot(displayDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        setDisplayedMobIds([]);
        return;
      }
      const data = snapshot.data();
      setDisplayedMobIds(data.mobIds ?? []);
    });

    return () => unsubscribe();
  }, [isAdmin, selectedEpisode?.id, roomId]);

  // Broadcast name overrides
  const broadcastNameOverrides = useCallback(async (overrides: Record<string, string>) => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const nameDocPath = roomId
      ? `rooms/${roomId}/name-overrides/${selectedEpisode.id}-${currentMapId}`
      : `name-overrides/${selectedEpisode.id}-${currentMapId}`;

    try {
      await setDoc(doc(db, nameDocPath), {
        overrides,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast name overrides:', error);
    }
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Listen for name override updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId || !db) return;

    const nameDocPath = roomId
      ? `rooms/${roomId}/name-overrides/${selectedEpisode.id}-${currentMapId}`
      : `name-overrides/${selectedEpisode.id}-${currentMapId}`;

    const nameDocRef = doc(db, nameDocPath);

    const unsubscribe = onSnapshot(nameDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        setNameOverrides({});
        return;
      }
      const data = snapshot.data();
      setNameOverrides(data.overrides ?? {});
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Handle name override change
  const handleNameOverride = useCallback((placementKey: string, newName: string) => {
    const updated = { ...nameOverrides, [placementKey]: newName };
    setNameOverrides(updated);
    broadcastNameOverrides(updated);
  }, [nameOverrides, broadcastNameOverrides]);

  // Get all mobs for the current episode (unique mobs for the mob display list)
  const episodeMobs = useMemo(() => {
    if (!selectedEpisode) return [];
    const uniqueMobIds = new Set(selectedEpisode.mobPlacements.map(p => p.mobId));
    return Array.from(uniqueMobIds)
      .map(mobId => mobs.find(m => m.id === mobId))
      .filter(Boolean) as Mob[];
  }, [selectedEpisode, mobs]);

  // Get mob placements filtered by current map
  const currentMapMobPlacements = useMemo(() => {
    if (!selectedEpisode || !currentMapId) return [];
    return selectedEpisode.mobPlacements.filter(p =>
      p.mapId === currentMapId || (!p.mapId && selectedEpisode.mapIds[0] === currentMapId)
    );
  }, [selectedEpisode, currentMapId]);

  // ======== In-game chat & talking NPCs ========
  const episodeChatLines = useMemo(
    () => selectedEpisode ? chatMessages.filter(m => !m.episodeId || m.episodeId === selectedEpisode.id) : [],
    [chatMessages, selectedEpisode]
  );
  // Translators' versions of lines are kept apart and shown in place of the line they translate
  const episodeChatMessages = useMemo(() => episodeChatLines.filter(m => !m.translationOf), [episodeChatLines]);
  const chatTranslations = useMemo(() => {
    const byLine = new Map<string, ChatMessage[]>();
    for (const m of episodeChatLines) {
      if (!m.translationOf) continue;
      byLine.set(m.translationOf, [...(byLine.get(m.translationOf) ?? []), m]);
    }
    return byLine;
  }, [episodeChatLines]);

  // Languages: what each line looks like to this viewer
  const { languages: allLanguageList, customLanguages } = useLanguages();
  const myChatCrawler = useMemo(
    () => (!isAdmin && currentPlayerId ? crawlers.find(c => c.id === currentPlayerId) ?? null : null),
    [isAdmin, currentPlayerId, crawlers]
  );
  const readChat = useCallback(
    (m: ChatMessage) => readChatLine(m, chatTranslations.get(m.id) ?? [], { isAdmin, crawler: myChatCrawler, party: crawlers }, customLanguages),
    [chatTranslations, isAdmin, myChatCrawler, crawlers, customLanguages]
  );
  // Spoken voices: NPC lines play on this device, scrambled if this viewer doesn't know the language
  const understandsChatLine = useCallback(
    (m: ChatMessage) => isAdmin || crawlerUnderstands(myChatCrawler, m.language),
    [isAdmin, myChatCrawler]
  );
  const { speechMuted, speechVolume, setSpeechPrefs, mutedSpeakers, toggleSpeakerMuted } = useNpcSpeechPlayer({
    roomId, messages: episodeChatMessages, understands: understandsChatLine, mapId: currentMapId,
  });
  // Speech bubbles show what this viewer can make out
  const bubbleMessages = useMemo(
    () => episodeChatMessages.map(m => (m.language ? { ...m, text: readChat(m).text } : m)),
    [episodeChatMessages, readChat]
  );
  const mySpeakLanguages = useMemo(() => {
    if (!myChatCrawler) return [];
    const ids = usableLanguageIds(myChatCrawler);
    // Worldspeech first when they know it, so it's the default
    const ordered = ids.includes(DEFAULT_LANGUAGE_ID) ? [DEFAULT_LANGUAGE_ID, ...ids.filter(id => id !== DEFAULT_LANGUAGE_ID)] : ids;
    // Spell languages say how long they have left: "Dead (Speak with Dead, 3 questions left)"
    const effects = myChatCrawler.languageEffects ?? [];
    return ordered.map(id => {
      const l = allLanguageList.find(x => x.id === id);
      const effect = effects.find(e => e.languageId === id);
      if (!l || !effect || myChatCrawler.languages?.includes(id)) return l;
      const left = languageEffectLeft(effect);
      return { ...l, name: `${l.name} (${effect.name}${left ? `, ${left}` : ''})` };
    }).filter((l): l is NonNullable<typeof l> => !!l);
  }, [myChatCrawler, allLanguageList]);

  // Mob tokens on the current map (episode + runtime placements)
  const mobPlacementsOnMap = useMemo(
    () => [...currentMapMobPlacements, ...runtimeMobPlacements.filter(p => p.mapId === currentMapId)],
    [currentMapMobPlacements, runtimeMobPlacements, currentMapId]
  );

  // Every token that can talk (silent mobs stay quiet). Unencountered mobs talk too: their token is on
  // the map, so players can walk up to them. Characters speak as one; each creature
  // copy is its own speaker ("Goblin B") with its own personality.
  const npcSpeakers = useMemo(
    () => mapSpeakers(mobPlacementsOnMap, mobs, [...(selectedEpisode?.mobPlacements ?? []), ...runtimeMobPlacements])
      .filter(s => !s.mob.silent),
    [mobPlacementsOnMap, mobs, selectedEpisode?.mobPlacements, runtimeMobPlacements]
  );

  // Speakers on the current map with the personality they talk with (one entry per speaker)
  const npcsOnMap = useMemo(() => {
    const byId = new Map<string, Mob>();
    for (const s of npcSpeakers) if (!byId.has(s.id)) byId.set(s.id, speakerAsMob(s, npcPersonalities));
    return [...byId.values()];
  }, [npcSpeakers, npcPersonalities]);

  // What speakers remember; a creature copy's memory only counts in the episode it was made in
  const episodeNpcMemories = useMemo(() => {
    const out: Record<string, NpcMemory> = {};
    for (const [id, m] of Object.entries(npcMemories)) {
      if (!m.episodeId || m.episodeId === selectedEpisode?.id) out[id] = m;
    }
    return out;
  }, [npcMemories, selectedEpisode?.id]);

  // Everything the chat may need to show by id: campaign mobs plus the speakers on this map
  const talkingMobs = useMemo(() => {
    const onMap = new Set(npcsOnMap.map(m => m.id));
    return [...npcsOnMap, ...mobs.filter(m => !onMap.has(m.id)).map(m => withNpcPersonality(m, npcPersonalities))];
  }, [mobs, npcsOnMap, npcPersonalities]);

  // Who can be picked with @ in the chat. Players only get mobs they can see within talking range.
  const myCrawlerSpot = useMemo(
    () => (currentPlayerId ? crawlerPlacements.find(p => p.crawlerId === currentPlayerId && p.mapId === currentMapId) : undefined),
    [crawlerPlacements, currentPlayerId, currentMapId]
  );
  const chatMentionables = useMemo((): NpcChatMentionable[] => {
    const list: NpcChatMentionable[] = [];
    for (const mob of npcsOnMap) {
      if (isAdmin) { list.push({ id: mob.id, name: mob.name, kind: 'npc' }); continue; }
      if (!myCrawlerSpot) continue;
      const feet = Math.min(...npcSpeakers
        .filter(s => s.id === mob.id && isPointVisible(s.placement.x, s.placement.y))
        .map(s => mapDistanceFeet(myCrawlerSpot, s.placement)));
      if (feet <= NPC_TALK_RANGE_FEET) list.push({ id: mob.id, name: mob.name, kind: 'npc', feet: Math.round(feet) });
    }
    list.sort((a, b) => (a.feet ?? 0) - (b.feet ?? 0) || a.name.localeCompare(b.name));
    const crawlerIds = new Set(crawlerPlacements.filter(p => p.mapId === currentMapId).map(p => p.crawlerId));
    for (const c of crawlers) {
      if (crawlerIds.has(c.id) && c.id !== currentPlayerId) list.push({ id: c.id, name: c.name, kind: 'crawler' });
    }
    return list;
  }, [npcsOnMap, isAdmin, myCrawlerSpot, npcSpeakers, isPointVisible, mapDistanceFeet, crawlerPlacements, currentMapId, crawlers, currentPlayerId]);

  // --- Merchants ---
  // A shop is a speaker: a character has one shop wherever they stand, while each copy of a
  // creature ("Goblin B") has its own stock and gold in merchants/{speaker id}.
  const mapShops = useMemo(
    () => mapSpeakers(mobPlacementsOnMap, mobs, [...(selectedEpisode?.mobPlacements ?? []), ...runtimeMobPlacements]),
    [mobPlacementsOnMap, mobs, selectedEpisode?.mobPlacements, runtimeMobPlacements]
  );
  const shopIdForPlacement = useMemo(() => new Map(mapShops.map(s => [s.placement, s.id])), [mapShops]);

  /** The merchant as the trade window sees it: its shop id and name ("Goblin B"), even off this map. */
  const shopMob = useCallback((shopId: string): Mob | undefined => {
    const onMap = mapShops.find(s => s.id === shopId);
    const base = onMap?.mob ?? mobs.find(m => m.id === baseMobId(shopId));
    if (!base || !isMerchant(base)) return undefined;
    if (shopId === base.id) return base;
    const name = onMap?.name ?? `${base.name} ${String.fromCharCode(65 + Number(shopId.split('~')[1] ?? 0))}`;
    return { ...base, id: shopId, name };
  }, [mapShops, mobs]);

  // Distance from the player's crawler to the nearest visible token of a shop on this map
  const merchantDistanceFeet = useCallback((shopId: string): number | null => {
    if (!myCrawlerSpot) return null;
    const spots = mapShops.filter(s => s.id === shopId && isPointVisible(s.placement.x, s.placement.y));
    if (spots.length === 0) return null;
    return Math.min(...spots.map(s => mapDistanceFeet(myCrawlerSpot, s.placement)));
  }, [myCrawlerSpot, mapShops, isPointVisible, mapDistanceFeet]);

  // A player tapping a merchant (not dragging it) gets the "Trade with Merchant" menu
  const handleMerchantTap = (e: React.MouseEvent, mob: Mob, placement: EpisodeMobPlacement) => {
    if (isAdmin || !isMerchant(mob)) return;
    const start = mobPressRef.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
    e.stopPropagation();
    setMerchantMenu({ mobId: shopIdForPlacement.get(placement) ?? mob.id, x: e.clientX, y: e.clientY });
  };
  const recordMobPress = (x: number, y: number) => { mobPressRef.current = { x, y }; };

  const merchantsWithState = useMemo(() => merchants
    .map(state => ({ mob: shopMob(state.id), state }))
    .filter((m): m is { mob: Mob; state: MerchantState } => !!m.mob),
  [merchants, shopMob]);

  const myCrawler = currentPlayerId ? crawlers.find(c => c.id === currentPlayerId) : undefined;
  const openMerchantMob = openMerchantId ? shopMob(openMerchantId) : undefined;

  const chatAuthor = useMemo((): NpcChatAuthor | null => {
    if (isAdmin) return { type: 'dm', id: 'dm', name: 'DM' };
    const crawler = currentPlayerId ? crawlers.find(c => c.id === currentPlayerId) : undefined;
    return crawler ? { type: 'crawler', id: crawler.id, name: crawler.name } : null;
  }, [isAdmin, currentPlayerId, crawlers]);

  const handleSendChat = useCallback(async (text: string, viaVoice: boolean, toMobIds: string[] = [], language?: string) => {
    if (!chatAuthor || !onSendChatMessage) return;
    // Players: note which mobs are in talking range, so only those answer
    const nearMobIds = chatAuthor.type === 'crawler'
      ? chatMentionables.filter(m => m.kind === 'npc').map(m => m.id)
      : null;
    await onSendChatMessage({
      authorType: chatAuthor.type,
      authorId: chatAuthor.id,
      authorName: chatAuthor.name,
      text,
      ...(selectedEpisode ? { episodeId: selectedEpisode.id } : {}),
      ...(viaVoice ? { viaVoice: true } : {}),
      ...(toMobIds.length ? { toMobIds } : {}),
      ...(nearMobIds ? { nearMobIds } : {}),
      ...(chatAuthor.type === 'crawler' && language ? { language } : {}),
    });
  }, [chatAuthor, onSendChatMessage, selectedEpisode, chatMentionables]);

  // A translator passes a line on to the party, as said or twisted
  const handleTranslate = useCallback(async (m: ChatMessage, text: string) => {
    if (!myChatCrawler || !onSendChatMessage) return;
    await onSendChatMessage({
      authorType: 'crawler',
      authorId: myChatCrawler.id,
      authorName: myChatCrawler.name,
      text,
      translationOf: m.id,
      ...(m.episodeId ? { episodeId: m.episodeId } : {}),
    });
  }, [myChatCrawler, onSendChatMessage]);

  // Get the current map URL
  const currentMapUrl = useMemo(() => {
    if (!selectedEpisode || selectedEpisode.mapIds.length === 0) return null;
    const mapIndex = parseInt(selectedEpisode.mapIds[currentMapIndex], 10);
    return maps[mapIndex] || null;
  }, [selectedEpisode, maps, currentMapIndex]);

  // Keep the shown map in step with the episode. When a live map is deleted, the episode's maps
  // shift, so the old image (still in the shared Show Time state) would stay on players' screens.
  useEffect(() => {
    if (!selectedEpisode || selectedEpisode.mapIds.length === 0 || !selectedMap) return;
    if (currentMapIndex >= selectedEpisode.mapIds.length) {
      setCurrentMapIndex(0);
      if (isAdmin) {
        const firstUrl = maps[parseInt(selectedEpisode.mapIds[0], 10)] || null;
        if (firstUrl) {
          setSelectedMap(firstUrl);
          broadcastShowtimeState(selectedEpisode.id, 0, firstUrl);
        }
      }
      return;
    }
    if (currentMapUrl && currentMapUrl !== selectedMap) {
      setSelectedMap(currentMapUrl);
      if (isAdmin) broadcastShowtimeState(selectedEpisode.id, currentMapIndex, currentMapUrl);
    }
  }, [selectedEpisode, currentMapIndex, currentMapUrl, selectedMap, maps, isAdmin, broadcastShowtimeState]);

  const handlePreviousMap = useCallback(() => {
    if (!selectedEpisode) return;
    const newIndex = currentMapIndex > 0 ? currentMapIndex - 1 : selectedEpisode.mapIds.length - 1;
    setCurrentMapIndex(newIndex);
    // Broadcast new map index
    const newMapIdxStr = selectedEpisode.mapIds[newIndex];
    const newMapIdx = parseInt(newMapIdxStr, 10);
    const newMapUrl = maps[newMapIdx] || null;
    setSelectedMap(newMapUrl);
    broadcastShowtimeState(selectedEpisode.id, newIndex, newMapUrl);
  }, [selectedEpisode, currentMapIndex, maps, broadcastShowtimeState]);

  const handleNextMap = useCallback(() => {
    if (!selectedEpisode) return;
    const newIndex = currentMapIndex < selectedEpisode.mapIds.length - 1 ? currentMapIndex + 1 : 0;
    setCurrentMapIndex(newIndex);
    // Broadcast new map index
    const newMapIdxStr = selectedEpisode.mapIds[newIndex];
    const newMapIdx = parseInt(newMapIdxStr, 10);
    const newMapUrl = maps[newMapIdx] || null;
    setSelectedMap(newMapUrl);
    broadcastShowtimeState(selectedEpisode.id, newIndex, newMapUrl);
  }, [selectedEpisode, currentMapIndex, maps, broadcastShowtimeState]);

  const handleToggleMobDisplay = (mobId: string) => {
    setDisplayedMobIds(prev => {
      const updated = prev.includes(mobId) ? prev.filter(id => id !== mobId) : [...prev, mobId];
      broadcastDisplayedMobs(updated);
      return updated;
    });
  };

  const handleHideMob = (mobId: string) => {
    setDisplayedMobIds(prev => {
      const updated = prev.filter(id => id !== mobId);
      broadcastDisplayedMobs(updated);
      return updated;
    });
  };

  const handleSelectEpisode = useCallback((episode: Episode) => {
    setSelectedEpisode(episode);
    setSelectedMap(null);
    setCurrentMapIndex(0);
    setDisplayedMobIds([]);
    setMapScale(100);
    setPanOffset({ x: 0, y: 0 });
    // Reset all per-episode state to prevent cross-episode bleeding
    setPings([]);
    setMapBoxes([]);
    setRevealedAreas([]);
    setFogOfWarEnabled(false);
    setCrawlerPlacements([]);
    setRuntimeMobPlacements([]);
    fogInitialLoadDone.current = null;
    // Forget the previous map's size so the new map is fitted and centered from its own
    // dimensions (the per-map reset effect doesn't run when both episodes start on the same map)
    setNaturalImageSize(null);
    setMapImageDimensions(null);
    needsCentering.current = true;
    // Set game clock to episode's starting time if available
    if (episode.startingGameTime && onSetGameClock) {
      onSetGameClock(episode.startingGameTime);
    }
    // Reset turn counter if switching to a different episode
    if (resetNoncombatTurns && (!noncombatTurnState?.episodeId || noncombatTurnState.episodeId !== episode.id)) {
      resetNoncombatTurns(episode.id);
    }
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [onSetGameClock, resetNoncombatTurns, noncombatTurnState]);

  const handleEndEpisode = useCallback(() => {
    setSelectedEpisode(null);
    setSelectedMap(null);
    setCurrentMapIndex(0);
    setDisplayedMobIds([]);
    // Reset all per-episode state
    setPings([]);
    setMapBoxes([]);
    setRevealedAreas([]);
    setFogOfWarEnabled(false);
    setCrawlerPlacements([]);
    setRuntimeMobPlacements([]);
    // Broadcast end of episode
    setGameStarted(false);
    broadcastShowtimeState(null, 0, null, false);
    localStorage.removeItem(SHOWTIME_STORAGE_KEY);
    // Notify parent to close showtime view
    onEndEpisodeCallback?.();
    onGameActiveChange?.(false);
  }, [broadcastShowtimeState, onEndEpisodeCallback, onGameActiveChange]);

  // DM: Start or end the game for players
  const handleSetGameActive = useCallback(async (active: boolean) => {
    setGameStarted(active);
    if (selectedEpisode && selectedMap) {
      await broadcastShowtimeState(selectedEpisode.id, currentMapIndex, selectedMap, active);
    } else if (!active) {
      await broadcastShowtimeState(null, 0, null, false);
    }
    onGameActiveChange?.(active);
  }, [selectedEpisode, selectedMap, currentMapIndex, broadcastShowtimeState, onGameActiveChange]);

  // Register toggle function with parent so PingPanel can call it
  useEffect(() => {
    onRegisterGameToggle?.(handleSetGameActive);
  }, [handleSetGameActive, onRegisterGameToggle]);

  const handleMobMouseDown = (placementKey: string) => {
    // All users can move mobs
    setDraggingMobId(placementKey);
  };

  // Handle panning start
  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't start panning if we're in a mode that uses clicks
    if (isPingMode || isBoxMode || isRulerMode || isAddCrawlerMode || isAddMobMode || fogEraserActive || fogPaintActive) return;
    // Don't pan if clicking on an interactive element
    if ((e.target as HTMLElement).closest('button, [data-draggable]')) return;

    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      panX: panOffset.x,
      panY: panOffset.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle panning
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset({
        x: panStart.panX + dx,
        y: panStart.panY + dy,
      });
    }

    // Track cursor position for ping/box/crawler/mob mode
    // Update ruler end point
    if (isRulerMode && rulerStart && mapImageRef.current) {
      const imgRect = mapImageRef.current.getBoundingClientRect();
      const rx = ((e.clientX - imgRect.left) / imgRect.width) * 100;
      const ry = ((e.clientY - imgRect.top) / imgRect.height) * 100;
      const newEnd = { x: Math.max(0, Math.min(100, rx)), y: Math.max(0, Math.min(100, ry)) };
      setRulerEnd(newEnd);
      // Throttled broadcast of ruler position
      const now = Date.now();
      if (now - lastRulerBroadcastTime.current >= RULER_BROADCAST_THROTTLE_MS) {
        lastRulerBroadcastTime.current = now;
        broadcastRulerState(rulerStart, newEnd);
      }
    }

    if (mapContainerRef.current && (isPingMode || isBoxMode || isRulerMode || (isAddCrawlerMode && selectedCrawlerId) || (isAddMobMode && selectedMobId))) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setCursorPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    } else {
      setCursorPosition(null);
    }

    // Handle runtime crawler/mob dragging (all users can drag)
    if (draggingRuntimeId && mapImageRef.current) {
      const rect = mapImageRef.current.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;
      const x = Math.max(0, Math.min(100, rawX));
      const y = Math.max(0, Math.min(100, rawY));

      if (draggingRuntimeId.startsWith('crawler-')) {
        const index = parseInt(draggingRuntimeId.split('-')[1], 10);
        handleRuntimeCrawlerDrag(index, x, y);
      } else if (draggingRuntimeId.startsWith('mob-')) {
        const index = parseInt(draggingRuntimeId.split('-')[1], 10);
        handleRuntimeMobDrag(index, x, y);
      }
      return;
    }

    // Handle episode mob dragging (all users can drag)
    if (!draggingMobId || !mapImageRef.current || !selectedEpisode) return;

    const rect = mapImageRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp coordinates to keep mob icons within the map boundaries (0-100%)
    const x = Math.max(0, Math.min(100, rawX));
    const y = Math.max(0, Math.min(100, rawY));

    // Extract index from placement key (format: "mobId-index")
    const index = parseInt(draggingMobId.split('-').pop() || '0', 10);

    // Update local drag position for immediate visual feedback (lightweight, no expensive state updates)
    setLocalDragPosition({ index, x, y });

    // Track pending broadcast for final sync on drag end
    pendingBroadcast.current = { index, x, y };

    // Throttle broadcast and main state updates to prevent lag
    const now = Date.now();
    if (now - lastBroadcastTime.current >= BROADCAST_THROTTLE_MS) {
      lastBroadcastTime.current = now;
      pendingBroadcast.current = null; // Clear pending since we're broadcasting now
      // Broadcast to other players
      broadcastDragState(index, x, y);
      // Update main state less frequently
      setSelectedEpisode(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          mobPlacements: prev.mobPlacements.map((p, i) =>
            i === index ? { ...p, x, y } : p
          ),
        };
      });
    }
  };

  // Touch event handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isPingMode || isBoxMode || isRulerMode || isAddCrawlerMode || isAddMobMode || fogEraserActive || fogPaintActive) return;
    if ((e.target as HTMLElement).closest('button, [data-draggable]')) return;
    if (e.touches.length !== 1) return; // Only handle single touch for panning

    const touch = e.touches[0];
    setIsPanning(true);
    setPanStart({
      x: touch.clientX,
      y: touch.clientY,
      panX: panOffset.x,
      panY: panOffset.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    // Handle panning
    if (isPanning && panStart) {
      e.preventDefault(); // Prevent page scroll while panning
      const dx = touch.clientX - panStart.x;
      const dy = touch.clientY - panStart.y;
      setPanOffset({
        x: panStart.panX + dx,
        y: panStart.panY + dy,
      });
    }

    // Handle runtime crawler/mob dragging
    if (draggingRuntimeId && mapImageRef.current) {
      e.preventDefault();
      const rect = mapImageRef.current.getBoundingClientRect();
      const rawX = ((touch.clientX - rect.left) / rect.width) * 100;
      const rawY = ((touch.clientY - rect.top) / rect.height) * 100;
      const x = Math.max(0, Math.min(100, rawX));
      const y = Math.max(0, Math.min(100, rawY));

      if (draggingRuntimeId.startsWith('crawler-')) {
        const index = parseInt(draggingRuntimeId.split('-')[1], 10);
        handleRuntimeCrawlerDrag(index, x, y);
      } else if (draggingRuntimeId.startsWith('mob-')) {
        const index = parseInt(draggingRuntimeId.split('-')[1], 10);
        handleRuntimeMobDrag(index, x, y);
      }
      return;
    }

    // Handle episode mob dragging
    if (draggingMobId && mapImageRef.current && selectedEpisode) {
      e.preventDefault();
      const rect = mapImageRef.current.getBoundingClientRect();
      const rawX = ((touch.clientX - rect.left) / rect.width) * 100;
      const rawY = ((touch.clientY - rect.top) / rect.height) * 100;
      const x = Math.max(0, Math.min(100, rawX));
      const y = Math.max(0, Math.min(100, rawY));
      const index = parseInt(draggingMobId.split('-').pop() || '0', 10);

      setLocalDragPosition({ index, x, y });
      pendingBroadcast.current = { index, x, y };

      const now = Date.now();
      if (now - lastBroadcastTime.current >= BROADCAST_THROTTLE_MS) {
        lastBroadcastTime.current = now;
        pendingBroadcast.current = null;
        broadcastDragState(index, x, y);
        setSelectedEpisode(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            mobPlacements: prev.mobPlacements.map((p, i) =>
              i === index ? { ...p, x, y } : p
            ),
          };
        });
      }
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  const handleMouseUp = () => {
    // Stop panning
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }

    // Handle runtime crawler/mob drag end (all users)
    if (draggingRuntimeId) {
      if (draggingRuntimeId.startsWith('crawler-')) {
        const index = parseInt(draggingRuntimeId.split('-')[1], 10);
        handleRuntimeCrawlerDragEnd(index);
      } else if (draggingRuntimeId.startsWith('mob-')) {
        const index = parseInt(draggingRuntimeId.split('-')[1], 10);
        handleRuntimeMobDragEnd(index);
      }
      setDraggingRuntimeId(null);
      return;
    }

    // Handle episode mob drag end (all users)
    if (draggingMobId && selectedEpisode) {
      // Extract index from placement key
      const index = parseInt(draggingMobId.split('-').pop() || '0', 10);

      // Use pending broadcast position, localDragPosition, or fall back to current placement
      const finalX = pendingBroadcast.current?.x ?? localDragPosition?.x ?? selectedEpisode.mobPlacements[index]?.x ?? 0;
      const finalY = pendingBroadcast.current?.y ?? localDragPosition?.y ?? selectedEpisode.mobPlacements[index]?.y ?? 0;

      // Always broadcast final position to ensure sync (even if we just broadcast recently)
      broadcastDragState(index, finalX, finalY);
      pendingBroadcast.current = null;

      // Commit final position to main state
      setSelectedEpisode(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          mobPlacements: prev.mobPlacements.map((p, i) =>
            i === index ? { ...p, x: finalX, y: finalY } : p
          ),
        };
      });

      // Only admin persists to the episode storage
      if (onUpdateEpisode && isAdmin) {
        const updatedPlacements = selectedEpisode.mobPlacements.map((p, i) =>
          i === index ? { ...p, x: finalX, y: finalY } : p
        );
        onUpdateEpisode(selectedEpisode.id, {
          mobPlacements: updatedPlacements,
        });
      }
    }
    setDraggingMobId(null);
    setLocalDragPosition(null);
  };

  // Main view when no episode is selected
  if (!selectedEpisode) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background p-4"
      >
        {isAdmin ? (
          <DungeonCard className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl text-accent text-glow-gold mb-6 flex items-center gap-3">
              <MapIcon className="w-6 h-6" />
              SHOW TIME - SELECT EPISODE
            </h2>

            <div className="space-y-4">
              {episodes.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No episodes created. Create episodes in the Dungeon AI console.
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {episodes.map(episode => (
                    <motion.div
                      key={episode.id}
                      whileHover={{ scale: 1.02 }}
                      className="border-2 border-primary bg-muted/20 p-4 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => handleSelectEpisode(episode)}
                    >
                      <h3 className="font-display text-lg text-primary mb-2">{episode.name}</h3>
                      {episode.description && (
                        <p className="text-sm text-muted-foreground mb-3">{episode.description}</p>
                      )}

                      <div className="space-y-2 text-xs mb-4">
                        <div className="flex items-center gap-2">
                          <MapIcon className="w-4 h-4 text-primary" />
                          <span>
                            {episode.mapIds.length} map{episode.mapIds.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-accent" />
                          <span>
                            {episode.mobPlacements.length} mob
                            {episode.mobPlacements.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {(episode.lootBoxIds?.length ?? 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-yellow-400" />
                            <span>
                              {episode.lootBoxIds!.length} loot box{episode.lootBoxIds!.length !== 1 ? "es" : ""}
                            </span>
                          </div>
                        )}
                        {(episode.questIds?.length ?? 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <ScrollText className="w-4 h-4 text-green-400" />
                            <span>
                              {episode.questIds!.length} quest{episode.questIds!.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>

                      <DungeonButton
                        variant="admin"
                        size="sm"
                        className="w-full"
                        onClick={(e) => { e.stopPropagation(); handleSelectEpisode(episode); }}
                      >
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Load Episode
                      </DungeonButton>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </DungeonCard>
        ) : (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <Layers className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-lg">
                Waiting for the Dungeon Master to start an episode...
              </p>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // Episode selection view for DM
  if (!selectedMap) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-background p-4"
      >
        <DungeonCard className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl text-accent text-glow-gold mb-2 flex items-center gap-3">
                <Layers className="w-6 h-6" />
                {selectedEpisode.name}
              </h2>
              {selectedEpisode.description && (
                <p className="text-muted-foreground text-sm">{selectedEpisode.description}</p>
              )}
            </div>
            <DungeonButton variant="default" onClick={() => {
              setSelectedEpisode(null);
              setGameStarted(false);
              broadcastShowtimeState(null, 0, null, false);
              localStorage.removeItem(SHOWTIME_STORAGE_KEY);
              onGameActiveChange?.(false);
            }}>
              <X className="w-4 h-4 mr-2" /> Back to Episodes
            </DungeonButton>
          </div>

          <div className="space-y-6">
            {/* Map selection */}
            <div>
              <h3 className="font-display text-primary text-lg mb-4">Select Map to Display</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {selectedEpisode.mapIds.map((mapIndexStr, idx) => {
                  const mapIndex = parseInt(mapIndexStr, 10);
                  const mapUrl = maps[mapIndex];
                  if (!mapUrl) return null;
                  const mapName = mapNames?.[mapIndex] || `Map ${mapIndex + 1}`;

                  return (
                    <motion.div
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      className="border-2 border-primary bg-muted/20 p-2 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => {
                        setCurrentMapIndex(idx);
                        setSelectedMap(mapUrl);
                        broadcastShowtimeState(selectedEpisode.id, idx, mapUrl);
                      }}
                    >
                      <img
                        src={mapUrl}
                        alt={mapName}
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                      <DungeonButton variant="admin" size="sm" className="w-full">
                        <Eye className="w-4 h-4 mr-2" />
                        {mapName}
                      </DungeonButton>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Mob control */}
            {episodeMobs.length > 0 && (
              <div>
                <h3 className="font-display text-primary text-lg mb-4">Display Mobs</h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {episodeMobs.map(mob => (
                    <DungeonButton
                      key={mob.id}
                      variant={displayedMobIds.includes(mob.id) ? "admin" : "default"}
                      size="sm"
                      className="justify-start"
                      onClick={() => handleToggleMobDisplay(mob.id)}
                    >
                      <span>{mob.name}</span>
                      {displayedMobIds.includes(mob.id) && (
                        <span className="ml-auto">✓</span>
                      )}
                    </DungeonButton>
                  ))}
                </div>
              </div>
            )}

            {/* Loot Box Panel - DM only */}
            {isAdmin && ((selectedEpisode.lootBoxIds && selectedEpisode.lootBoxIds.length > 0) || (selectedEpisode.lootBoxes && selectedEpisode.lootBoxes.length > 0)) && sendLootBox && (
              <LootBoxPanel
                episode={selectedEpisode}
                crawlers={crawlers}
                sentLootBoxes={lootBoxes.filter(b => b.episodeId === selectedEpisode.id)}
                allTemplates={lootBoxTemplates}
                onSend={sendLootBox}
                onUnlock={unlockLootBox}
                onDelete={deleteLootBox}
                addDiceRoll={addDiceRoll}
              />
            )}

            {/* Quest Panel - DM only */}
            {isAdmin && quests.length > 0 && onAssignQuest && (
              <QuestPanel
                episode={selectedEpisode}
                crawlers={crawlers}
                quests={quests}
                assignedQuests={assignedQuests}
                onAssignQuest={onAssignQuest}
                onUpdateAssignedQuest={onUpdateAssignedQuest}
                onAwardQuestXP={onAwardQuestXP}
                onDeleteAssignedQuest={onDeleteAssignedQuest}
                addDiceRoll={addDiceRoll}
              />
            )}

            {/* Inventory Management - DM only (filtered to episode crawlers) */}
            {isAdmin && getCrawlerInventory && onUpdateCrawlerInventory && (() => {
              const epCrawlerIds = [...new Set((selectedEpisode.crawlerPlacements || []).map(p => p.crawlerId))];
              const epCrawlers = epCrawlerIds.length > 0
                ? crawlers.filter(c => epCrawlerIds.includes(c.id))
                : crawlers;
              return (
                <InventoryPanel
                  crawlers={epCrawlers}
                  getCrawlerInventory={getCrawlerInventory}
                  onUpdateCrawlerInventory={onUpdateCrawlerInventory}
                  getSharedInventory={getSharedInventory}
                />
              );
            })()}
          </div>
        </DungeonCard>
      </motion.div>
    );
  }

  // Main display view with map and mobs
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background relative flex flex-col"
    >
      {/* Map Tools Menu - available to all users, includes DM controls when admin */}
      {selectedMap && (
        <MapToolsMenu
          onPing={(color) => {}}
          onAddBox={(color, opacity) => {}}
          isPingMode={isPingMode}
          isBoxMode={isBoxMode}
          setIsPingMode={setIsPingMode}
          setIsBoxMode={setIsBoxMode}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          boxOpacity={boxOpacity}
          setBoxOpacity={setBoxOpacity}
          selectedShape={selectedShape}
          setSelectedShape={setSelectedShape}
          isAdmin={isAdmin}
          crawlers={crawlers}
          mobs={mobs}
          isAddCrawlerMode={isAddCrawlerMode}
          isAddMobMode={isAddMobMode}
          setIsAddCrawlerMode={setIsAddCrawlerMode}
          setIsAddMobMode={setIsAddMobMode}
          selectedCrawlerId={selectedCrawlerId}
          selectedMobId={selectedMobId}
          setSelectedCrawlerId={setSelectedCrawlerId}
          setSelectedMobId={setSelectedMobId}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          fogOfWarEnabled={fogOfWarEnabled}
          onToggleFogOfWar={handleToggleFogOfWar}
          fogEraserActive={fogEraserActive}
          setFogEraserActive={setFogEraserActive}
          fogBrushSize={fogBrushSize}
          setFogBrushSize={setFogBrushSize}
          fogPaintActive={fogPaintActive}
          setFogPaintActive={setFogPaintActive}
          episodeName={selectedEpisode.name}
          currentMapIndex={currentMapIndex}
          totalMaps={selectedEpisode.mapIds.length}
          mapScale={mapScale}
          onPreviousMap={handlePreviousMap}
          onNextMap={handleNextMap}
          onSelectMap={() => setSelectedMap(null)}
          onEndEpisode={handleEndEpisode}
          isNavVisible={isNavVisible}
          isRulerMode={isRulerMode}
          setIsRulerMode={setIsRulerMode}
        />
      )}

      {/* Zoom controls - available to all users, fixed position so they stay visible */}
      {selectedMap && (
        <div className="fixed bottom-24 left-4 z-40 flex flex-col gap-2">
          <DungeonButton
            variant="default"
            size="sm"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </DungeonButton>
          <div className="text-xs text-center text-muted-foreground bg-background/80 px-2 py-1 rounded border border-border">
            {Math.round(mapScale)}%
          </div>
          <DungeonButton
            variant="default"
            size="sm"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </DungeonButton>
        </div>
      )}

      {/* Combat Order Display - shows above map during active combat */}
      {combatState?.active && combatState.phase === 'combat' && combatState.combatants.length > 0 && (
        <div className="w-full bg-background/90 border-b-2 border-destructive/50 px-4 py-2 flex items-center gap-1 overflow-x-auto shrink-0">
          <span className="text-[10px] text-destructive font-display mr-2 shrink-0">R{combatState.combatRound}</span>
          {combatState.turnStartedAt && (
            <CombatTurnTimer
              mode={combatState.turnTimerMode ?? 'countdown'}
              durationSeconds={combatState.turnTimerDuration ?? 60}
              turnStartedAt={combatState.turnStartedAt}
              paused={combatState.turnTimerPaused ?? false}
            />
          )}
          {combatState.combatants.map((c, i) => {
            const isCurrent = i === combatState.currentTurnIndex;
            const crawlerData = c.type === 'crawler' ? crawlers.find(cr => cr.id === c.id) : null;
            const mobData = c.type === 'mob' ? mobs.find(m => m.id === (c.sourceId || c.id)) : null;
            const avatar = crawlerData?.avatar || mobData?.image;
            return (
              <div
                key={c.id}
                className={`flex flex-col items-center shrink-0 px-1 py-1 rounded transition-all ${
                  isCurrent
                    ? 'bg-accent/20 border border-accent shadow-[0_0_8px_rgba(251,191,36,0.4)] scale-110'
                    : 'opacity-60'
                }`}
                title={`${c.name} (Initiative: ${c.initiative})`}
              >
                <div className={`w-10 h-10 rounded-full border-2 overflow-hidden flex items-center justify-center ${
                  c.type === 'crawler' ? 'border-primary' : 'border-destructive'
                } ${isCurrent ? 'ring-2 ring-accent' : ''}`}>
                  {avatar ? (
                    <img src={avatar} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className={`text-xs font-bold ${c.type === 'crawler' ? 'text-primary' : 'text-destructive'}`}>
                      {c.name.charAt(0)}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] mt-0.5 max-w-[48px] truncate ${
                  isCurrent ? 'text-accent font-bold' : 'text-muted-foreground'
                }`}>
                  {c.name}
                </span>
                <ConditionBadges
                  conditions={c.conditions}
                  compact
                  className="justify-center max-w-[64px] mt-0.5"
                  onRemove={isAdmin && onRemoveCombatCondition ? (conditionId) => { void onRemoveCombatCondition(c.id, conditionId); } : undefined}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Initiative Phase Banner */}
      {combatState?.active && combatState.phase === 'initiative' && (
        <div className="w-full bg-destructive/10 border-b-2 border-destructive/50 px-4 py-3 text-center shrink-0">
          <span className="text-destructive font-display text-sm animate-pulse">ROLL FOR INITIATIVE</span>
          <p className="text-[10px] text-muted-foreground mt-1">Go to your profile to roll initiative</p>
        </div>
      )}

      {/* Map display */}
      <div
        ref={mapContainerRef}
        className="flex-1 p-1 select-none overflow-hidden relative"
        style={{ cursor: isPanning ? 'grabbing' : (isPingMode || isBoxMode || isRulerMode || isAddCrawlerMode || isAddMobMode) ? 'crosshair' : 'grab' }}
        onMouseDown={handlePanStart}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setCursorPosition(null);
          handleMouseUp();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Map interaction blocker during initiative (non-admin) - scoped to map container */}
        {combatState?.active && combatState.phase === 'initiative' && !isAdmin && (
          <div className="absolute inset-0 z-40 bg-background/30 pointer-events-auto" />
        )}
        {/* DM: everything the mob whose turn it is can do */}
        {isAdmin && combatState?.active && combatState.phase === 'combat' && (
          <MobActionsOverlay
            combatState={combatState}
            mobs={mobs}
            crawlers={crawlers}
            spells={spells}
            getCrawlerInventory={getCrawlerInventory}
            addDiceRoll={addDiceRoll}
            onApplyDamage={onApplyCombatDamageBatch}
            onRecordAction={onRecordCombatAction}
            onOverrideMobHealth={onOverrideMobHealth}
            onHealCrawler={onHealCrawler}
          />
        )}
        {/* Cursor follower for ping/box/crawler/mob mode */}
        {cursorPosition && (isPingMode || isBoxMode || (isAddCrawlerMode && selectedCrawlerId) || (isAddMobMode && selectedMobId)) && (
          <div
            className="pointer-events-none fixed z-50"
            style={{
              left: mapContainerRef.current ? mapContainerRef.current.getBoundingClientRect().left + cursorPosition.x : cursorPosition.x,
              top: mapContainerRef.current ? mapContainerRef.current.getBoundingClientRect().top + cursorPosition.y : cursorPosition.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {isPingMode ? (
              <div
                className="w-8 h-8 rounded-full border-4 animate-pulse"
                style={{
                  borderColor: selectedColor,
                  boxShadow: `0 0 20px ${selectedColor}`,
                }}
              >
                <Target className="w-full h-full p-1" style={{ color: selectedColor }} />
              </div>
            ) : isBoxMode ? (
              <>
                {selectedShape === "circle" ? (
                  <div
                    className="w-10 h-10 rounded-full border-2 border-dashed"
                    style={{
                      borderColor: selectedColor,
                      backgroundColor: `${selectedColor}${Math.round(boxOpacity * 255).toString(16).padStart(2, '0')}`,
                    }}
                  />
                ) : selectedShape === "triangle" ? (
                  <svg width="40" height="40" viewBox="0 0 100 100" className="opacity-70">
                    <polygon
                      points="50,5 95,95 5,95"
                      fill={`${selectedColor}${Math.round(boxOpacity * 255).toString(16).padStart(2, '0')}`}
                      stroke={selectedColor}
                      strokeWidth="3"
                      strokeDasharray="5,5"
                    />
                  </svg>
                ) : selectedShape === "square" ? (
                  <div
                    className="w-10 h-10 border-2 border-dashed"
                    style={{
                      borderColor: selectedColor,
                      backgroundColor: `${selectedColor}${Math.round(boxOpacity * 255).toString(16).padStart(2, '0')}`,
                    }}
                  />
                ) : (
                  <div
                    className="w-12 h-8 border-2 border-dashed rounded"
                    style={{
                      borderColor: selectedColor,
                      backgroundColor: `${selectedColor}${Math.round(boxOpacity * 255).toString(16).padStart(2, '0')}`,
                    }}
                  />
                )}
              </>
            ) : isAddCrawlerMode && selectedCrawlerId ? (
              (() => {
                const crawler = crawlers.find(c => c.id === selectedCrawlerId);
                return crawler ? (
                  <div className="w-12 h-12 rounded-full border-2 border-blue-400 bg-blue-400/30 flex items-center justify-center shadow-lg animate-pulse">
                    {crawler.avatar ? (
                      <img src={crawler.avatar} alt={crawler.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-blue-400 text-xs font-bold">{crawler.name.charAt(0)}</span>
                    )}
                  </div>
                ) : null;
              })()
            ) : isAddMobMode && selectedMobId ? (
              (() => {
                const mob = mobs.find(m => m.id === selectedMobId);
                return mob ? (
                  <div className="w-12 h-12 rounded-full border-2 border-red-500 bg-red-500/30 flex items-center justify-center shadow-lg animate-pulse">
                    {mob.image ? (
                      <img src={mob.image} alt={mob.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-red-500 text-xs font-bold">{mob.name.charAt(0)}</span>
                    )}
                  </div>
                ) : null;
              })()
            ) : null}
          </div>
        )}

        {/* Absolutely positioned so the map never stretches its container: the container's
            height must come from the screen, or a scaled-up map grows the container, which
            refits the map larger again (tall maps ballooned past their episode scale) */}
        <div
          className="absolute top-1 left-1"
          data-map-container
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${mapScale / 100})`,
            transformOrigin: 'center center',
          }}
          onMouseUp={handleMouseUp}
          onClick={handleMapClick}
        >
          {/* Outer wrapper reserves space for scaled content by using the scaled dimensions.
              Inner wrapper applies transform scale. Icons counter-scale to stay physically same size. */}
          <div
            className="relative"
            data-map-scale-spacer
            style={{
              // Reserves layout space based on the scaled size
              // Uses responsive dimensions computed from container size (no black bars)
              width: mapImageDimensions
                ? `${mapImageDimensions.width * mapBaseScale / 100}px`
                : mapDisplaySize
                  ? `${mapDisplaySize.width * mapBaseScale / 100}px`
                  : `calc(80vh * 1.6 * ${mapBaseScale / 100})`,
              height: mapImageDimensions
                ? `${mapImageDimensions.height * mapBaseScale / 100}px`
                : mapDisplaySize
                  ? `${mapDisplaySize.height * mapBaseScale / 100}px`
                  : `calc(80vh * ${mapBaseScale / 100})`,
            }}
          >
          <div
            className="absolute top-0 left-0"
            data-map-scale-wrapper
            style={{
              transform: `scale(${mapBaseScale / 100})`,
              transformOrigin: 'top left',
            }}
          >
          <img
            ref={mapImageRef}
            src={selectedMap}
            alt="Current Map"
            className="pointer-events-none border-2 border-primary shadow-[0_0_15px_rgba(0,200,255,0.5)]"
            style={{
              // Responsive: fill container without black bars
              height: mapDisplaySize ? `${mapDisplaySize.height}px` : '80vh',
              width: mapDisplaySize ? `${mapDisplaySize.width}px` : 'auto',
              // Tailwind's base styles cap images at max-width: 100% of their parent,
              // which squishes wide maps to the placeholder box's 1.6:1 width
              maxWidth: 'none',
              maxHeight: 'none',
              display: 'block',
            }}
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              setNaturalImageSize({ width: img.naturalWidth, height: img.naturalHeight });
              setMapImageDimensions({ width: img.clientWidth, height: img.clientHeight });
            }}
          />

          {/* Grid overlay - only visible to DM */}
          {isAdmin && <GridOverlay isVisible={showGrid} cellSize={gridSize * iconCounterScale} opacity={0.3} />}

          {/* Ruler overlay - local */}
          {isRulerMode && rulerStart && rulerEnd && mapImageRef.current && (
            <RulerOverlay
              start={rulerStart}
              end={rulerEnd}
              imageWidth={mapImageRef.current.clientWidth}
              imageHeight={mapImageRef.current.clientHeight}
              gridSize={gridSize * iconCounterScale}
            />
          )}
          {/* Ruler overlays - remote users */}
          {remoteRulers.map((ruler) => mapImageRef.current && (
            <RulerOverlay
              key={ruler.id}
              start={ruler.start}
              end={ruler.end}
              imageWidth={mapImageRef.current!.clientWidth}
              imageHeight={mapImageRef.current!.clientHeight}
              gridSize={gridSize * iconCounterScale}
            />
          ))}

          {/* Displayed mobs on the map - filtered by current map */}
          {currentMapMobPlacements.map((placement, localIndex) => {
            const mob = mobs.find(m => m.id === placement.mobId);
            if (!mob) return null;

            // Find the global index in the full placements array for drag state
            const globalIndex = selectedEpisode?.mobPlacements.findIndex(
              (p, i) => p === placement || (p.mobId === placement.mobId && p.x === placement.x && p.y === placement.y && p.mapId === placement.mapId)
            ) ?? localIndex;

            // Use stable letterIndex if available, fall back to sequential counting for legacy data
            const totalSameId = allPlacementsMobCounts[placement.mobId] ?? 1;
            const sameIdBefore = currentMapMobPlacements
              .slice(0, localIndex)
              .filter(p => p.mobId === placement.mobId).length;
            const letterIdx = placement.letterIndex ?? sameIdBefore;
            const letter = totalSameId > 1 ? String.fromCharCode(65 + letterIdx) : '';

            const isDragging = draggingMobId === `${placement.mobId}-${globalIndex}`;

            // Use local drag position for immediate visual feedback during drag
            const displayX = isDragging && localDragPosition?.index === globalIndex ? localDragPosition.x : placement.x;
            const displayY = isDragging && localDragPosition?.index === globalIndex ? localDragPosition.y : placement.y;
            const canInteract = isPointVisible(displayX, displayY);

            return (
              <motion.div
                key={`${placement.mobId}-${currentMapId}-${localIndex}`}
                className={canInteract ? "absolute cursor-move" : "absolute cursor-not-allowed"}
                style={{
                  left: `${displayX}%`,
                  top: `${displayY}%`,
                  transform: `translate(-50%, -50%) scale(${iconCounterScale})`,
                  pointerEvents: canInteract ? 'auto' : 'none',
                  opacity: canInteract ? 1 : 0.5,
                  // Smooth transition for remote updates, instant for local drag
                  transition: isDragging ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out',
                }}
                onMouseDown={(e) => {
                  if (!canInteract) return;
                  e.stopPropagation();
                  recordMobPress(e.clientX, e.clientY);
                  handleMobMouseDown(`${placement.mobId}-${globalIndex}`);
                }}
                onClick={(e) => {
                  handleMerchantTap(e, mob, placement);
                  if (!isDragging && isAdmin) {
                    e.stopPropagation();
                    setSelectedMapEntity({ type: 'episode-mob', index: globalIndex });
                    setContextMenu(null);
                  }
                }}
                onContextMenu={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedMapEntity({ type: 'episode-mob', index: globalIndex });
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'episode-mob', index: globalIndex });
                }}
                onTouchStart={(e) => {
                  if (!canInteract) return;
                  e.stopPropagation();
                  const touch = e.touches[0];
                  recordMobPress(touch.clientX, touch.clientY);
                  handleMobMouseDown(`${placement.mobId}-${globalIndex}`);
                  // Store touch start for drag
                  (e.currentTarget as HTMLElement).dataset.touchStartX = String(touch.clientX);
                  (e.currentTarget as HTMLElement).dataset.touchStartY = String(touch.clientY);
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: canInteract ? 1 : 0.5 }}
                transition={{ opacity: { duration: 0.2 } }}
              >
                <div className="relative">
                  <MobIcon
                    mob={mob}
                    size={64}
                    selected={selectedMapEntity?.type === 'episode-mob' && selectedMapEntity?.index === globalIndex}
                    hostile={isAdmin ? isPlacementHostile(placement, mob) : undefined}
                    isDragging={isDragging}
                    inCombat={(() => {
                      if (!combatState?.active || combatState.phase === 'ended') return false;
                      const totalAll = allPlacementsMobCounts[placement.mobId] ?? 0;
                      const combatId = totalAll > 1 ? `${placement.mobId}:${globalIndex}` : placement.mobId;
                      return combatState.combatants.some(c => c.id === combatId);
                    })()}
                    combatHP={(() => {
                      const totalAll = allPlacementsMobCounts[placement.mobId] ?? 0;
                      const combatId = totalAll > 1 ? `${placement.mobId}:${globalIndex}` : placement.mobId;
                      if (combatState?.active && combatState.phase !== 'ended') {
                        const combatant = combatState.combatants.find(c => c.id === combatId);
                        return combatant?.currentHP;
                      }
                      // Outside combat, pass persisted HP (used when next combat starts)
                      return placement.currentHP;
                    })()}
                    maxHP={mob.hitPoints}
                  />
                  {letter && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-accent text-background rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      {letter}
                    </div>
                  )}
                  {/* Name label - shifted down to avoid overlapping health bar */}
                  {(() => {
                    const nameKey = `mob-ep-${placement.mobId}-${localIndex}`;
                    const displayName = nameOverrides[nameKey] ?? mob.name;
                    return editingNameId === nameKey ? (
                      <input
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-background/90 border border-border rounded px-1 py-0.5 text-xs text-center text-foreground w-20 z-20"
                        defaultValue={displayName}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val && val !== mob.name) handleNameOverride(nameKey, val);
                          else if (!val || val === mob.name) {
                            const updated = { ...nameOverrides };
                            delete updated[nameKey];
                            setNameOverrides(updated);
                            broadcastNameOverrides(updated);
                          }
                          setEditingNameId(null);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    ) : (
                      <div
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-background/80 border border-border rounded px-1.5 py-0.5 text-xs text-foreground whitespace-nowrap cursor-text z-10"
                        onClick={(e) => { e.stopPropagation(); setEditingNameId(nameKey); }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {displayName}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            );
          })}

          {/* Crawler icons on the map */}
          {crawlerPlacements.filter(p => p.mapId === currentMapId).map((placement, index, filteredArr) => {
            const crawler = crawlers.find(c => c.id === placement.crawlerId);
            if (!crawler) return null;

            // Count how many times this crawler appears before this index
            const sameIdBefore = filteredArr
              .slice(0, index)
              .filter(p => p.crawlerId === placement.crawlerId).length;
            // Only show letter if there are duplicates (sameIdBefore > 0 means this is 2nd, 3rd, etc.)
            const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';
            // Index into the full placements array (drag handlers index into it, not the per-map list)
            const placementIndex = crawlerPlacements.indexOf(placement);
            const isDragging = draggingRuntimeId === `crawler-${placementIndex}`;
            const canInteract = isPointVisible(placement.x, placement.y);
            const moveBudget = getCrawlerMoveStatus(placement.crawlerId);
            const dragStart = crawlerDragStartRef.current;
            const feetLeft = moveBudget
              ? Math.max(0, Math.round(moveBudget.remaining - (isDragging && dragStart && !isAdmin ? mapDistanceFeet(dragStart, placement) : 0)))
              : null;
            // The player moving sees their own; the DM sees every tracked crawler; in combat
            // everyone sees the crawler whose turn it is.
            const showFeetLeft = !!moveBudget && moveBudget.isTheirTurn && (moveBudget.canMove || isAdmin || isCombatTurnPhase);

            return (
              <motion.div
                key={`crawler-${placement.crawlerId}-${index}`}
                className={canInteract ? "absolute cursor-move" : "absolute cursor-not-allowed"}
                style={{
                  left: `${placement.x}%`,
                  top: `${placement.y}%`,
                  transform: `translate(-50%, -50%) scale(${iconCounterScale})`,
                  pointerEvents: canInteract ? 'auto' : 'none',
                  // Smooth transition for remote updates, instant for local drag
                  transition: isDragging ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: canInteract ? 1 : 0.5 }}
                transition={{ opacity: { duration: 0.2 } }}
                onMouseDown={(e) => {
                  if (!canInteract) return;
                  e.stopPropagation();
                  startCrawlerDrag(placementIndex);
                }}
                onClick={(e) => {
                  if (!isDragging && isAdmin) {
                    e.stopPropagation();
                    setSelectedMapEntity({ type: 'crawler', index: placementIndex });
                    setContextMenu(null);
                  }
                }}
                onContextMenu={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedMapEntity({ type: 'crawler', index: placementIndex });
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'crawler', index: placementIndex });
                }}
                onTouchStart={(e) => {
                  if (!canInteract) return;
                  e.stopPropagation();
                  startCrawlerDrag(placementIndex);
                }}
              >
                <div className="relative">
                  {(() => {
                    const crawlerInv = getCrawlerInventory?.(crawler.id) ?? [];
                    const mods = getEquippedModifiers(crawler, crawlerInv);
                    const hpMod = mods.hp ?? 0;
                    const maxHPMod = mods.maxHP ?? 0;
                    const effectiveHP = (crawler.hp ?? 0) + hpMod;
                    const effectiveMaxHP = (crawler.maxHP ?? 0) + maxHPMod;
                    const baseMaxHP = crawler.maxHP ?? 0;
                    return (
                      <CrawlerIcon
                        crawler={crawler}
                        size={64}
                        selected={selectedMapEntity?.type === 'crawler' && selectedMapEntity?.index === placementIndex}
                        isDragging={isDragging}
                        effectiveHP={effectiveHP}
                        effectiveMaxHP={effectiveMaxHP}
                        baseMaxHP={maxHPMod !== 0 ? baseMaxHP : undefined}
                        showHealthBar={!!(combatState?.active && combatState.phase !== 'ended')}
                      />
                    );
                  })()}
                  {/* Movement left this turn (combat or noncombat turn) */}
                  {showFeetLeft && moveBudget && feetLeft !== null && (
                    <div
                      className={`absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full px-1.5 pt-0.5 pb-1 rounded text-[10px] font-bold whitespace-nowrap shadow-lg pointer-events-none ${
                        feetLeft === 0 ? 'bg-destructive text-destructive-foreground' : 'bg-background/90 border border-primary/60 text-primary'
                      }`}
                      title={`Movement: ${moveBudget.speed} ft ${moveBudget.label}`}
                    >
                      {feetLeft}/{moveBudget.speed} ft left
                      {/* Bar showing the share of this turn's movement still left */}
                      <div className="mt-0.5 h-1 w-full rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${feetLeft === 0 ? 'bg-destructive-foreground/70' : 'bg-primary'}`}
                          style={{ width: `${moveBudget.speed > 0 ? Math.min(100, (feetLeft / moveBudget.speed) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Letter badge - only show if there are duplicates */}
                  {letter && (
                    <div className="absolute -top-1 -left-1 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      {letter}
                    </div>
                  )}
                  {/* Name label - shifted down to avoid overlapping health bar */}
                  {(() => {
                    const nameKey = `crawler-${placement.crawlerId}-${index}`;
                    const displayName = nameOverrides[nameKey] ?? crawler.name;
                    return editingNameId === nameKey ? (
                      <input
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-background/90 border border-border rounded px-1 py-0.5 text-xs text-center text-foreground w-20 z-20"
                        defaultValue={displayName}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val && val !== crawler.name) handleNameOverride(nameKey, val);
                          else if (!val || val === crawler.name) {
                            const updated = { ...nameOverrides };
                            delete updated[nameKey];
                            setNameOverrides(updated);
                            broadcastNameOverrides(updated);
                          }
                          setEditingNameId(null);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    ) : (
                      <div
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-background/80 border border-border rounded px-1.5 py-0.5 text-xs text-foreground whitespace-nowrap cursor-text z-10"
                        onClick={(e) => { e.stopPropagation(); setEditingNameId(nameKey); }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {displayName}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            );
          })}

          {/* Runtime mob icons (added during ShowTime) */}
          {runtimeMobPlacements.filter(p => p.mapId === currentMapId).map((placement, index, filteredArr) => {
            const mob = mobs.find(m => m.id === placement.mobId);
            if (!mob) return null;

            // Use stable letterIndex if available, fall back to sequential counting for legacy data
            const totalSameId = allPlacementsMobCounts[placement.mobId] ?? 1;
            const episodeMobCount = currentMapMobPlacements.filter(p => p.mobId === placement.mobId).length;
            const runtimeMobsBefore = filteredArr
              .slice(0, index)
              .filter(p => p.mobId === placement.mobId).length;
            const totalBefore = episodeMobCount + runtimeMobsBefore;
            const letterIdx = placement.letterIndex ?? totalBefore;
            const letter = totalSameId > 1 ? String.fromCharCode(65 + letterIdx) : '';
            const isDragging = draggingRuntimeId === `mob-${index}`;
            const canInteract = isPointVisible(placement.x, placement.y);

            // Compute placement-based combatId matching PingPanel's logic
            // Runtime placements come after episode placements in the merged array
            const episodePlacementCount = selectedEpisode?.mobPlacements?.length ?? 0;
            const runtimePlacementIdx = episodePlacementCount + index;
            const totalSameIdAll = episodeMobCount + filteredArr.filter(p => p.mobId === placement.mobId).length;
            const runtimeCombatId = totalSameIdAll > 1 ? `${placement.mobId}:${runtimePlacementIdx}` : placement.mobId;

            return (
              <motion.div
                key={`runtime-mob-${placement.mobId}-${index}`}
                className={canInteract ? "absolute cursor-move" : "absolute cursor-not-allowed"}
                style={{
                  left: `${placement.x}%`,
                  top: `${placement.y}%`,
                  transform: `translate(-50%, -50%) scale(${iconCounterScale})`,
                  pointerEvents: canInteract ? 'auto' : 'none',
                  // Smooth transition for remote updates, instant for local drag
                  transition: isDragging ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: canInteract ? 1 : 0.5 }}
                transition={{ opacity: { duration: 0.2 } }}
                onMouseDown={(e) => {
                  if (!canInteract) return;
                  e.stopPropagation();
                  recordMobPress(e.clientX, e.clientY);
                  setDraggingRuntimeId(`mob-${index}`);
                }}
                onClick={(e) => {
                  handleMerchantTap(e, mob, placement);
                  if (!isDragging && isAdmin) {
                    e.stopPropagation();
                    setSelectedMapEntity({ type: 'runtime-mob', index });
                    setContextMenu(null);
                  }
                }}
                onContextMenu={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedMapEntity({ type: 'runtime-mob', index });
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'runtime-mob', index });
                }}
                onTouchStart={(e) => {
                  if (!canInteract) return;
                  e.stopPropagation();
                  recordMobPress(e.touches[0].clientX, e.touches[0].clientY);
                  setDraggingRuntimeId(`mob-${index}`);
                }}
              >
                <div className="relative">
                  <MobIcon
                    mob={mob}
                    size={64}
                    selected={selectedMapEntity?.type === 'runtime-mob' && selectedMapEntity?.index === index}
                    hostile={isAdmin ? isPlacementHostile(placement, mob) : undefined}
                    isDragging={isDragging}
                    inCombat={(() => {
                      if (!combatState?.active || combatState.phase === 'ended') return false;
                      return combatState.combatants.some(c => c.id === runtimeCombatId);
                    })()}
                    combatHP={(() => {
                      if (combatState?.active && combatState.phase !== 'ended') {
                        const combatant = combatState.combatants.find(c => c.id === runtimeCombatId);
                        return combatant?.currentHP;
                      }
                      return placement.currentHP;
                    })()}
                    maxHP={mob.hitPoints}
                  />
                  {/* Letter badge - only show if there are duplicates */}
                  {letter && (
                    <div className="absolute -top-1 -left-1 w-6 h-6 bg-accent text-background rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      {letter}
                    </div>
                  )}
                  {/* Name label - shifted down to avoid overlapping health bar */}
                  {(() => {
                    const nameKey = `mob-rt-${placement.mobId}-${index}`;
                    const displayName = nameOverrides[nameKey] ?? mob.name;
                    return editingNameId === nameKey ? (
                      <input
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-background/90 border border-border rounded px-1 py-0.5 text-xs text-center text-foreground w-20 z-20"
                        defaultValue={displayName}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val && val !== mob.name) handleNameOverride(nameKey, val);
                          else if (!val || val === mob.name) {
                            const updated = { ...nameOverrides };
                            delete updated[nameKey];
                            setNameOverrides(updated);
                            broadcastNameOverrides(updated);
                          }
                          setEditingNameId(null);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    ) : (
                      <div
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-background/80 border border-border rounded px-1.5 py-0.5 text-xs text-foreground whitespace-nowrap cursor-text z-10"
                        onClick={(e) => { e.stopPropagation(); setEditingNameId(nameKey); }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {displayName}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            );
          })}

          {/* Map Boxes - placed BEFORE fog so they can be covered */}
          {mapBoxes.map((box) => (
            <MapBox
              key={box.id}
              box={box}
              isAdmin={isAdmin}
              onUpdate={handleUpdateBox}
              onDelete={handleDeleteBox}
              onManipulationEnd={handleBoxManipulationEnd}
              mapScale={mapScale}
              mapBaseScale={mapBaseScale}
              canInteract={isPointVisible(box.x, box.y)}
              placementMode={isBoxMode || isPingMode || isAddCrawlerMode || isAddMobMode}
            />
          ))}

          {/* Fog of War overlay - placed AFTER mobs and boxes so it covers them */}
          <FogOfWar
            isVisible={fogOfWarEnabled}
            revealedAreas={revealedAreas}
            isAdmin={isAdmin && (fogEraserActive || fogPaintActive)}
            brushSize={fogBrushSize}
            onReveal={fogPaintActive ? handleFogPaint : handleFogReveal}
            onDrawingEnd={handleFogDrawingEnd}
            isViewerAdmin={isAdmin}
            isPaintMode={fogPaintActive}
            mapBaseScale={mapBaseScale}
          />

          {/* NPC speech bubbles over their tokens */}
          <NpcSpeechBubbles
            messages={bubbleMessages}
            thinking={npcAiStatus?.thinking ?? null}
            mapId={currentMapId}
            counterScale={iconCounterScale}
          />

          {/* Ping effects - on top of everything */}
          <PingEffect pings={pings} />
        </div>{/* end mapBaseScale wrapper */}
        </div>{/* end mapBaseScale spacer */}
        </div>
      </div>

      {/* Display mob cards - positioned to the LEFT of the dice menu, OUTSIDE the map container */}
      {displayedMobIds.map((mobId, index) => {
        const mob = mobs.find(m => m.id === mobId);
        if (!mob) return null;

        return (
          <ResizableMobDisplay
            key={mobId}
            mob={mob}
            onClose={() => handleHideMob(mobId)}
            index={index}
            isDiceExpanded={isDiceExpanded}
            isAdmin={isAdmin}
          />
        );
      })}

      {/* Player view - waiting message */}
      {!isAdmin && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          <Layers className="w-4 h-4 inline mr-2" />
          Dungeon Master is presenting: {selectedEpisode.name}
        </div>
      )}

      {/* Right-click context menu for mob/crawler deletion */}
      {contextMenu && isAdmin && (() => {
        // Resolve mob HP info for display/editing
        let mobHPInfo: { currentHP: number; maxHP: number; name: string } | null = null;
        let contextMob: Mob | undefined;
        let contextPlacement: EpisodeMobPlacement | undefined;
        if (contextMenu.type === 'episode-mob') {
          const placement = selectedEpisode?.mobPlacements[contextMenu.index];
          contextPlacement = placement;
          if (placement) {
            const mob = mobs.find(m => m.id === placement.mobId);
            contextMob = mob;
            if (mob && mob.hitPoints) {
              const hp = placement.currentHP ?? mob.hitPoints;
              mobHPInfo = { currentHP: hp, maxHP: mob.hitPoints, name: mob.name };
            }
          }
        } else if (contextMenu.type === 'runtime-mob') {
          const filtered = runtimeMobPlacements.filter(p => p.mapId === currentMapId);
          const placement = filtered[contextMenu.index];
          contextPlacement = placement;
          if (placement) {
            const mob = mobs.find(m => m.id === placement.mobId);
            contextMob = mob;
            if (mob && mob.hitPoints) {
              const hp = placement.currentHP ?? mob.hitPoints;
              mobHPInfo = { currentHP: hp, maxHP: mob.hitPoints, name: mob.name };
            }
          }
        }
        const inCombat = combatState?.active && combatState.phase !== 'ended';

        const updateContextPlacement = (fields: Partial<EpisodeMobPlacement>) => {
          if (contextMenu.type === 'episode-mob' && selectedEpisode && onUpdateEpisode) {
            const updated = selectedEpisode.mobPlacements.map((p, i) =>
              i === contextMenu.index ? { ...p, ...fields } : p
            );
            const updatedEpisode = { ...selectedEpisode, mobPlacements: updated };
            setSelectedEpisode(updatedEpisode);
            onUpdateEpisode(selectedEpisode.id, { mobPlacements: updated });
          } else if (contextMenu.type === 'runtime-mob') {
            const filteredIndices: number[] = [];
            runtimeMobPlacements.forEach((p, i) => { if (p.mapId === currentMapId) filteredIndices.push(i); });
            const realIndex = filteredIndices[contextMenu.index];
            if (realIndex !== undefined) {
              const updated = runtimeMobPlacements.map((p, i) =>
                i === realIndex ? { ...p, ...fields } : p
              );
              setRuntimeMobPlacements(updated);
              broadcastRuntimeMobPlacements(updated);
            }
          }
        };
        const handleContextHPChange = (newHP: number) => updateContextPlacement({ currentHP: newHP });

        return (
        <div
          className="fixed z-[200] bg-background border-2 border-destructive rounded shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {mobHPInfo && !inCombat && (
            <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-destructive shrink-0" />
                <span className="font-display text-xs">HP</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  defaultValue={mobHPInfo.currentHP}
                  min={0}
                  max={9999}
                  className="w-14 bg-muted border border-border rounded px-1.5 py-0.5 text-sm text-foreground text-center"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      const val = parseInt((e.target as HTMLInputElement).value);
                      if (!isNaN(val)) handleContextHPChange(Math.max(0, val));
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) handleContextHPChange(Math.max(0, val));
                  }}
                  autoFocus
                />
                <span className="text-sm text-muted-foreground">/ {mobHPInfo.maxHP}</span>
              </div>
            </div>
          )}
          {contextMob && contextPlacement && (() => {
            const hostile = isPlacementHostile(contextPlacement, contextMob);
            return (
              <button
                onClick={() => { updateContextPlacement({ hostile: !hostile }); setContextMenu(null); }}
                className={`w-full text-left px-4 py-2 text-sm font-display flex items-center gap-2 ${hostile ? 'text-green-500 hover:bg-green-500/10' : 'text-destructive hover:bg-destructive/10'}`}
                title={hostile ? 'Friendly tokens are left unticked when combat starts' : 'Hostile tokens are ticked when combat starts'}
              >
                {hostile ? <Handshake className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
                {hostile ? 'Make Friendly' : 'Make Hostile'}
              </button>
            );
          })()}
          {contextMob && onSetMobEncountered && (() => {
            const encountered = !!contextMob.encountered && !contextMob.hidden;
            const mobId = contextMob.id;
            return (
              <button
                onClick={() => { onSetMobEncountered(mobId, !encountered); setContextMenu(null); }}
                className="w-full text-left px-4 py-2 text-sm text-accent hover:bg-accent/10 font-display flex items-center gap-2"
              >
                {encountered ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {encountered ? 'Mark Unencountered' : 'Mark Encountered'}
              </button>
            );
          })()}
          {contextMob && isMerchant(contextMob) && (() => {
            const mobId = (contextPlacement && shopIdForPlacement.get(contextPlacement)) ?? contextMob.id;
            return (
              <button
                onClick={() => { setOpenMerchantId(mobId); setContextMenu(null); }}
                className="w-full text-left px-4 py-2 text-sm text-accent hover:bg-accent/10 font-display flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                Open Merchant
              </button>
            );
          })()}
          <button
            onClick={() => handleDeleteSelectedEntity()}
            className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 font-display flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
        );
      })()}

      {/* Player tapped a merchant: offer to trade */}
      {merchantMenu && !isAdmin && (() => {
        const mob = shopMob(merchantMenu.mobId);
        if (!mob) return null;
        const feet = merchantDistanceFeet(mob.id);
        const inRange = feet !== null && feet <= MERCHANT_TRADE_RANGE_FEET;
        return (
          <>
            <div className="fixed inset-0 z-[199]" onClick={() => setMerchantMenu(null)} />
            <div
              className="fixed z-[200] bg-background border-2 border-accent rounded shadow-lg py-1 min-w-[180px]"
              style={{ left: Math.min(merchantMenu.x, window.innerWidth - 200), top: Math.min(merchantMenu.y, window.innerHeight - 90) }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                disabled={!inRange}
                onClick={() => { setOpenMerchantId(mob.id); setMerchantMenu(null); }}
                className="w-full text-left px-4 py-2 text-sm text-accent hover:bg-accent/10 font-display flex items-center gap-2 disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <Store className="w-4 h-4" />
                Trade with Merchant
              </button>
              {!inRange && (
                <p className="px-4 pb-1 text-[11px] text-muted-foreground">
                  {feet === null ? "Your crawler isn't on this map." : `${Math.round(feet)} ft away. Walk within ${MERCHANT_TRADE_RANGE_FEET} ft to trade.`}
                </p>
              )}
            </div>
          </>
        );
      })()}

      {/* Merchant trade window */}
      {openMerchantMob && (
        <MerchantPanel
          mob={openMerchantMob}
          state={merchants.find(m => m.id === openMerchantMob.id)}
          isAdmin={isAdmin}
          crawler={myCrawler}
          crawlerInventory={myCrawler ? getCrawlerInventory?.(myCrawler.id) ?? [] : []}
          distanceFeet={merchantDistanceFeet(openMerchantMob.id)}
          haggleBlocker={myCrawler ? getHaggleBlocker(myCrawler.id, combatState, noncombatTurnState) : null}
          onBuy={async (item) => { if (myCrawler) await onBuyFromMerchant?.(openMerchantMob, myCrawler.id, item); }}
          onSell={async (itemId, minGold) => { if (myCrawler) await onSellToMerchant?.(openMerchantMob, myCrawler.id, itemId, minGold); }}
          onHaggle={async () => { if (myCrawler) await onHaggleWithMerchant?.(openMerchantMob, myCrawler); }}
          onRestock={async () => { await onRestockMerchant?.(openMerchantMob); }}
          onResolveHaggle={async (crawlerId, approve) => { await onResolveMerchantHaggle?.(openMerchantMob, crawlerId, approve); }}
          onClose={() => setOpenMerchantId(null)}
        />
      )}

      {/* DM: haggles waiting for a yes or no */}
      {isAdmin && onResolveMerchantHaggle && !openMerchantMob && (
        <MerchantHagglePrompts merchants={merchantsWithState} onResolve={onResolveMerchantHaggle} />
      )}

      {/* In-game chat with talking NPCs */}
      {selectedEpisode && onSendChatMessage && (
        <NpcChatPanel
          messages={episodeChatMessages}
          author={chatAuthor}
          isAdmin={isAdmin}
          mobs={talkingMobs}
          npcsOnMap={npcsOnMap}
          mentionables={chatMentionables}
          aiSettings={npcAiSettings}
          aiStatus={npcAiStatus}
          secrets={npcSecrets}
          onSend={handleSendChat}
          onUpdateSettings={onUpdateNpcAiSettings}
          onSetSecretState={onSetNpcSecretState}
          memories={episodeNpcMemories}
          onSetMemory={onSetNpcMemory}
          npcKeys={npcKeys}
          onChangeNpcKeys={onChangeNpcKeys}
          readLine={readChat}
          speakLanguages={mySpeakLanguages}
          translateMode={myChatCrawler?.translateMode ?? 'off'}
          onSetTranslateMode={myChatCrawler && onSetTranslateMode ? (mode) => onSetTranslateMode(myChatCrawler.id, mode) : undefined}
          onTranslate={myChatCrawler ? handleTranslate : undefined}
          onClearChat={onClearChat ? () => onClearChat(selectedEpisode.id) : undefined}
          speechMuted={speechMuted}
          speechVolume={speechVolume}
          onSetSpeechPrefs={setSpeechPrefs}
          mutedSpeakers={mutedSpeakers}
          onToggleSpeakerMuted={toggleSpeakerMuted}
        />
      )}
    </motion.div>
  );
};

export default ShowTimeView;
