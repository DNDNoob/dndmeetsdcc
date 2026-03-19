import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";
import MainMenu from "@/components/MainMenu";
import Navigation from "@/components/Navigation";
import DiceRoller from "@/components/DiceRoller";
import PingPanel from "@/components/PingPanel";
import ChangelogViewer from "@/components/ChangelogViewer";
import CampaignSelectView from "@/views/CampaignSelectView";
import ProfilesView from "@/views/ProfilesView";
import MapsView from "@/views/MapsView";
import InventoryView from "@/views/InventoryView";
import MobsView from "@/views/MobsView";
import DungeonAIView from "@/views/DungeonAIView";
import ShowTimeView from "@/views/ShowTimeView";
import SoundEffectsView from "@/views/SoundEffectsView";
import WikiView from "@/views/WikiView";
import SpellsView from "@/views/SpellsView";

import { useGameState, DiceRollEntry } from "@/hooks/useGameState";
import { useAuth } from "@/contexts/AuthContext";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useFriends } from "@/hooks/useFriends";
import { usePublicContent } from "@/hooks/usePublicContent";
import { toast } from "sonner";
import type { Episode, Campaign, CrawlerPlacement, EpisodeMobPlacement } from "@/lib/gameData";

type AppScreen = "splash" | "menu" | "game";
type GameView = "profiles" | "maps" | "inventory" | "mobs" | "dungeonai" | "showtime" | "sounds" | "wiki" | "spells";

const GAME_VIEWS: readonly string[] = ["profiles", "maps", "inventory", "mobs", "dungeonai", "showtime", "sounds", "wiki", "spells"];

const STORAGE_KEY_PLAYER = "dcc_current_player";
const STORAGE_KEY_MAP_VISIBILITY = "dcc_map_visibility";
const STORAGE_KEY_ACTIVE_CAMPAIGN = "dcc_active_campaign";
const STORAGE_KEY_CAMPAIGN_PLAYER_PREFIX = "dcc_campaign_player_";

function loadSavedPlayer(): { id: string; name: string; type: "crawler" | "ai" | "npc" } | null {
  const saved = localStorage.getItem(STORAGE_KEY_PLAYER);
  if (saved) {
    try { return JSON.parse(saved); } catch { return null; }
  }
  return null;
}

function loadSavedCampaign(): Campaign | null {
  const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_CAMPAIGN);
  if (saved) {
    try { return JSON.parse(saved); } catch { return null; }
  }
  return null;
}

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, userProfile, needsUsername, signOut, loading: authLoading, updateUserProfile, logDecision } = useAuth();

  // Campaign management
  const {
    myCampaigns,
    joinedCampaigns,
    loading: campaignsLoading,
    createCampaign,
    deleteCampaign,
    copyCampaign,
    joinCampaignByCode,
    leaveCampaign,
    regenerateInviteCode,
  } = useCampaigns(user?.uid ?? null);

  // Friend requests
  const {
    friends,
    pendingReceived,
    pendingSent,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    cancelFriendRequest,
  } = useFriends(user?.uid ?? null);

  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(loadSavedCampaign);

  // Derive screen and currentView from the URL path
  const pathSegment = location.pathname.replace(/^\//, '').split('/')[0] || '';

  const { screen, currentView } = useMemo((): { screen: AppScreen; currentView: GameView } => {
    if (pathSegment === '') {
      return { screen: 'splash', currentView: 'profiles' };
    }
    if (pathSegment === 'menu') {
      return { screen: 'menu', currentView: 'profiles' };
    }
    if (GAME_VIEWS.includes(pathSegment)) {
      return { screen: 'game', currentView: pathSegment as GameView };
    }
    // Unknown path — will be redirected by the guard effect
    return { screen: 'splash', currentView: 'profiles' };
  }, [pathSegment]);

  const [showChangelog, setShowChangelog] = useState(false);

  // Initialize player synchronously from localStorage
  const [currentPlayer, setCurrentPlayer] = useState<{
    id: string;
    name: string;
    type: "crawler" | "ai" | "npc";
  } | null>(() => loadSavedPlayer());

  const [mapVisibility, setMapVisibility] = useState<boolean[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MAP_VISIBILITY);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isDiceExpanded, setIsDiceExpanded] = useState(false);

  const [isShowtimeActive, setIsShowtimeActive] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [runtimeCrawlerPlacements, setRuntimeCrawlerPlacements] = useState<CrawlerPlacement[]>([]);
  const [runtimeMobPlacements, setRuntimeMobPlacements] = useState<EpisodeMobPlacement[]>([]);
  const [isGameActive, setIsGameActive] = useState(false);
  const setGameActiveRef = useRef<((active: boolean) => Promise<void>) | null>(null);

  const {
    crawlers,
    updateCrawler,
    addCrawler,
    deleteCrawler,
    getCrawlerInventory,
    updateCrawlerInventory,
    getSharedInventory,
    updateSharedInventory,
    mobs,
    setMobs,
    maps,
    mapNames: firestoreMapNames,
    updateMapName,
    setMaps,
    cleanupEmptyMaps,
    episodes,
    addEpisode,
    updateEpisode,
    deleteEpisode,
    partyGold,
    lootBoxes,
    sendLootBox,
    unlockLootBox,
    claimLootBoxItems,
    deleteLootBox,
    getCrawlerLootBoxes,
    lootBoxTemplates,
    addLootBoxTemplate,
    updateLootBoxTemplate,
    deleteLootBoxTemplate,
    addDiceRoll,
    diceRolls,
    noncombatTurnState,
    startNoncombatTurn,
    resetNoncombatTurns,
    recordNoncombatRoll,
    getNoncombatRollsRemaining,
    gameClockState,
    setGameClock,
    performShortRest,
    performLongRest,
    combatState,
    startCombat,
    recordCombatInitiative,
    confirmInitiative,
    advanceCombatTurn,
    recordCombatAction,
    applyCombatDamage,
    overrideMobHealth,
    endCombat,
    cancelCombat,
    removeCombatant,
    addCombatant,
    wikiPages,
    addWikiPage,
    updateWikiPage,
    spells,
    addSpell,
    updateSpell,
    deleteSpell,
    learnSpell,
    forgetSpell,
    castSpell,
    consumeSpellTome,
    promoteSpellToLibrary,
    quests,
    addQuest,
    updateQuest,
    deleteQuest,
    assignedQuests,
    assignQuest,
    updateAssignedQuest,
    deleteAssignedQuest,
    getCrawlerAssignedQuests,
    roomId,
    setRoomId,
    isLoaded
  } = useGameState();

  // Map names come from Firestore via useGameState
  const mapNames = firestoreMapNames;

  // Determine if current user is the DM of the active campaign
  const isAdmin = useMemo(() => {
    if (!activeCampaign || !user) return false;
    return activeCampaign.ownerId === user.uid;
  }, [activeCampaign, user]);

  // Public content (cross-campaign sharing)
  const showPublicContent = userProfile?.showPublicContent ?? false;
  const { publicItems, publicSpells, publishItem, unpublishItem, publishSpell, unpublishSpell } = usePublicContent(showPublicContent);

  const handleToggleItemPublic = useCallback(async (item: import('@/lib/gameData').InventoryItem, isPublic: boolean) => {
    const sharedItems = getSharedInventory();
    updateSharedInventory(sharedItems.map(i => i.id === item.id ? { ...i, isPublic } : i));
    if (isPublic) {
      await publishItem({ ...item, isPublic: true });
    } else {
      await unpublishItem(item.id);
    }
  }, [getSharedInventory, updateSharedInventory, publishItem, unpublishItem]);

  const handleToggleSpellPublic = useCallback(async (spell: import('@/lib/gameData').Spell, isPublic: boolean) => {
    await updateSpell(spell.id, { isPublic });
    if (isPublic) {
      await publishSpell({ ...spell, isPublic: true });
    } else {
      await unpublishSpell(spell.id);
    }
  }, [updateSpell, publishSpell, unpublishSpell]);

  // Restore campaign from URL query param on cold load (deep linking)
  const campaignRestoredRef = useRef(false);
  useEffect(() => {
    if (campaignRestoredRef.current || activeCampaign || campaignsLoading || !isAuthenticated || authLoading) return;
    const params = new URLSearchParams(location.search);
    const campaignId = params.get('campaign');
    if (!campaignId) return;

    const allCampaigns = [...myCampaigns, ...joinedCampaigns];
    const found = allCampaigns.find(c => c.id === campaignId);
    if (found) {
      campaignRestoredRef.current = true;
      setActiveCampaign(found);
      // Restore player identity
      if (user && found.ownerId === user.uid) {
        setCurrentPlayer({ id: "dungeonai", name: "DUNGEON AI", type: "ai" });
      } else {
        const savedPlayer = localStorage.getItem(STORAGE_KEY_CAMPAIGN_PLAYER_PREFIX + found.id);
        if (savedPlayer) {
          try { setCurrentPlayer(JSON.parse(savedPlayer)); } catch { /* ignore */ }
        }
      }
    }
  }, [myCampaigns, joinedCampaigns, campaignsLoading, activeCampaign, isAuthenticated, authLoading, location.search, user]);

  // Sync roomId with active campaign
  useEffect(() => {
    if (activeCampaign) {
      setRoomId(activeCampaign.id);
    } else {
      setRoomId(null);
    }
  }, [activeCampaign, setRoomId]);

  // Persist active campaign to localStorage and sync URL query param
  useEffect(() => {
    if (activeCampaign) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_CAMPAIGN, JSON.stringify(activeCampaign));
      // Add campaign ID to URL for deep linking (preserves current path)
      const params = new URLSearchParams(location.search);
      if (params.get('campaign') !== activeCampaign.id) {
        params.set('campaign', activeCampaign.id);
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      }
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_CAMPAIGN);
      // Remove campaign param from URL
      const params = new URLSearchParams(location.search);
      if (params.has('campaign')) {
        params.delete('campaign');
        const qs = params.toString();
        navigate(`${location.pathname}${qs ? '?' + qs : ''}`, { replace: true });
      }
    }
  }, [activeCampaign]);

  // When user signs out or becomes unauthenticated, clear campaign
  // Guard with authLoading so we don't clear the campaign before auth resolves
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setActiveCampaign(null);
    }
  }, [isAuthenticated, authLoading]);

  // Determine if we should show campaign selection
  const showCampaignSelect = !authLoading && isAuthenticated && !needsUsername && !activeCampaign;

  // Route guards — redirect invalid navigation states
  useEffect(() => {
    // Unknown route → splash
    if (pathSegment !== '' && pathSegment !== 'menu' && !GAME_VIEWS.includes(pathSegment)) {
      navigate('/', { replace: true });
      return;
    }
    // No player selected but trying to access menu or game views → splash
    if (!currentPlayer && pathSegment !== '') {
      navigate('/', { replace: true });
      return;
    }
    // Non-admin trying to access dungeonai → menu
    if (pathSegment === 'dungeonai' && !isAdmin) {
      navigate('/menu', { replace: true });
      return;
    }
  }, [pathSegment, currentPlayer, navigate, isAdmin]);

  // Persist player to localStorage (global + per-campaign)
  useEffect(() => {
    if (currentPlayer) {
      localStorage.setItem(STORAGE_KEY_PLAYER, JSON.stringify(currentPlayer));
      if (activeCampaign) {
        localStorage.setItem(STORAGE_KEY_CAMPAIGN_PLAYER_PREFIX + activeCampaign.id, JSON.stringify(currentPlayer));
      }
    }
  }, [currentPlayer, activeCampaign]);

  // Persist map visibility to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MAP_VISIBILITY, JSON.stringify(mapVisibility));
  }, [mapVisibility]);

  // --- Navigation handlers ---

  const handlePlayerSelect = (playerId: string, playerName: string, playerType: "crawler" | "ai" | "npc") => {
    setCurrentPlayer({ id: playerId, name: playerName, type: playerType });
    navigate('/menu');
  };

  const handleNavigate = (view: string) => {
    navigate('/' + view);
  };

  const handleDungeonAI = () => {
    navigate('/dungeonai');
  };

  const handleReturnToMenu = () => {
    navigate('/menu');
  };

  const handleBackToCampaigns = () => {
    setActiveCampaign(null);
    setCurrentPlayer(null);
    navigate('/', { replace: true });
  };

  const handleSelectCampaign = (campaign: Campaign) => {
    setActiveCampaign(campaign);
    let restoredPlayer: { id: string; name: string; type: "crawler" | "ai" | "npc" } | null = null;

    // If user is the DM, set them as the DM player
    if (user && campaign.ownerId === user.uid) {
      restoredPlayer = { id: "dungeonai", name: "DUNGEON AI", type: "ai" };
    } else {
      // Try to restore previously selected player for this campaign
      const savedPlayer = localStorage.getItem(STORAGE_KEY_CAMPAIGN_PLAYER_PREFIX + campaign.id);
      if (savedPlayer) {
        try {
          restoredPlayer = JSON.parse(savedPlayer);
        } catch {
          // ignore parse errors
        }
      }
    }

    setCurrentPlayer(restoredPlayer);
    // If we have a player (DM or restored), skip splash and go to menu
    navigate(restoredPlayer ? '/menu' : '/');
  };

  const handleStatRoll = (crawlerName: string, crawlerId: string, stat: string, totalStat: number) => {
    const modifier = Math.floor((totalStat - 10) / 2);
    const rawRoll = Math.floor(Math.random() * 20) + 1;
    const total = rawRoll + modifier;
    const entry: DiceRollEntry = {
      id: crypto.randomUUID(),
      crawlerName,
      crawlerId,
      timestamp: Date.now(),
      results: [{ dice: 'D20', result: rawRoll }],
      total,
      statRoll: { stat, modifier, rawRoll },
    };
    addDiceRoll(entry);
  };

  const handleToggleMapVisibility = (index: number) => {
    setMapVisibility((prev) => {
      const newVisibility = [...prev];
      newVisibility[index] = !newVisibility[index];
      return newVisibility;
    });
  };

  const handleUpdateMapName = (index: number, name: string) => {
    updateMapName(index, name);
  };

  useEffect(() => {
    if (maps.length > mapVisibility.length) {
      setMapVisibility((prev) => [...prev, ...Array(maps.length - prev.length).fill(true)]);
    } else if (maps.length < mapVisibility.length) {
      setMapVisibility((prev) => prev.slice(0, maps.length));
    }
  }, [maps.length, mapVisibility.length]);

  // Loot box notifications
  const seenLootBoxIds = useRef<Set<string>>(new Set());
  const prevLootBoxes = useRef(lootBoxes);

  useEffect(() => {
    if (!currentPlayer || currentPlayer.type === 'ai') return;

    // Initialize seen IDs on first load
    if (seenLootBoxIds.current.size === 0 && lootBoxes.length > 0) {
      lootBoxes.forEach(b => seenLootBoxIds.current.add(b.id));
      prevLootBoxes.current = lootBoxes;
      return;
    }

    const myBoxes = lootBoxes.filter(b => b.crawlerId === currentPlayer.id);
    const prevMyBoxes = prevLootBoxes.current.filter(b => b.crawlerId === currentPlayer.id);

    // Check for new boxes
    for (const box of myBoxes) {
      if (!seenLootBoxIds.current.has(box.id)) {
        seenLootBoxIds.current.add(box.id);
        toast(`New loot box received: ${box.name}!`, { icon: '📦', duration: Infinity });
      }
    }

    // Check for unlocked boxes
    for (const box of myBoxes) {
      const prev = prevMyBoxes.find(b => b.id === box.id);
      if (prev && prev.locked && !box.locked) {
        toast(`Loot box unlocked: ${box.name}!`, { icon: '🔓', duration: Infinity });
      }
    }

    prevLootBoxes.current = lootBoxes;
  }, [lootBoxes, currentPlayer]);

  // Quest assignment notifications
  const seenAssignedQuestIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentPlayer || currentPlayer.type === 'ai') return;

    // Initialize seen IDs on first load
    if (seenAssignedQuestIds.current.size === 0 && assignedQuests.length > 0) {
      assignedQuests.forEach(a => seenAssignedQuestIds.current.add(a.id));
      return;
    }

    const myQuests = assignedQuests.filter(a => a.crawlerIds.includes(currentPlayer.id));
    for (const assigned of myQuests) {
      if (!seenAssignedQuestIds.current.has(assigned.id)) {
        seenAssignedQuestIds.current.add(assigned.id);
        const quest = quests.find(q => q.id === assigned.questId);
        if (quest) {
          const label = assigned.isPartyQuest ? `Party Quest: ${quest.name}` : `New Quest: ${quest.name}`;
          toast(label, { icon: '📜', duration: Infinity });
        }
      }
    }
  }, [assignedQuests, currentPlayer, quests]);

  // Game start/stop notifications for players (detect system dice roll messages)
  const seenSystemRollIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentPlayer || currentPlayer.type === 'ai') return;
    const systemRolls = diceRolls.filter(r => r.crawlerId === '__system__' && r.lootBoxNotification);
    // Initialize seen on first load
    if (seenSystemRollIds.current.size === 0 && systemRolls.length > 0) {
      systemRolls.forEach(r => seenSystemRollIds.current.add(r.id));
      return;
    }
    for (const roll of systemRolls) {
      if (!seenSystemRollIds.current.has(roll.id)) {
        seenSystemRollIds.current.add(roll.id);
        const isStart = roll.lootBoxNotification!.tier === 'Gold';
        toast(roll.lootBoxNotification!.boxName, { icon: isStart ? '⚔️' : '🏁', duration: Infinity });
      }
    }
  }, [diceRolls, currentPlayer]);

  // Filter combat state to only show for the matching episode
  const activeCombatState = useMemo(() => {
    if (!combatState?.active) return combatState;
    if (combatState.episodeId && activeEpisode?.id && combatState.episodeId !== activeEpisode.id) {
      return null;
    }
    return combatState;
  }, [combatState, activeEpisode]);

  // Stable callbacks for ShowTimeView
  const handleShowtimeActiveChange = useCallback((active: boolean, episode?: Episode | null) => {
    setIsShowtimeActive(active);
    setActiveEpisode(episode ?? null);
    if (!active) {
      setRuntimeCrawlerPlacements([]);
      setRuntimeMobPlacements([]);
    }
  }, []);

  const handleEndEpisode = useCallback(() => {
    setIsShowtimeActive(false);
    setActiveEpisode(null);
    setRuntimeCrawlerPlacements([]);
    setRuntimeMobPlacements([]);
  }, []);

  const handleRuntimePlacementsChange = useCallback((cp: CrawlerPlacement[], mp: EpisodeMobPlacement[]) => {
    setRuntimeCrawlerPlacements(cp);
    setRuntimeMobPlacements(mp);
  }, []);

  const handleGameActiveChange = useCallback((active: boolean) => {
    setIsGameActive(active);
  }, []);

  const handleRegisterGameToggle = useCallback((fn: (active: boolean) => Promise<void>) => {
    setGameActiveRef.current = fn;
  }, []);

  // If authenticated and no campaign selected, show campaign selection
  if (showCampaignSelect) {
    return (
      <CampaignSelectView
        myCampaigns={myCampaigns}
        joinedCampaigns={joinedCampaigns}
        loading={campaignsLoading}
        userProfile={userProfile}
        onCreateCampaign={(name, desc) => createCampaign(name, desc, userProfile ?? undefined)}
        onDeleteCampaign={deleteCampaign}
        onCopyCampaign={(sourceId, newName) => copyCampaign(sourceId, newName, userProfile ?? undefined)}
        onJoinCampaign={joinCampaignByCode}
        onLeaveCampaign={leaveCampaign}
        onRegenerateInviteCode={regenerateInviteCode}
        onSelectCampaign={handleSelectCampaign}
        onSignOut={signOut}
        friends={friends}
        pendingReceived={pendingReceived}
        pendingSent={pendingSent}
        onSendFriendRequest={(username) => sendFriendRequest(username, userProfile!)}
        onAcceptFriendRequest={acceptFriendRequest}
        onDeclineFriendRequest={declineFriendRequest}
        onRemoveFriend={removeFriend}
        onCancelFriendRequest={cancelFriendRequest}
        onUpdateUserProfile={updateUserProfile}
        onLogDecision={logDecision}
      />
    );
  }

  if (!isLoaded && activeCampaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary animate-pulse font-display tracking-widest">
          LOADING SYSTEM...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <AnimatePresence mode="wait">
        {screen === "splash" && (
          <SplashScreen
            key="splash"
            crawlers={crawlers}
            onEnter={handlePlayerSelect}
            isAdmin={isAdmin}
            campaignName={activeCampaign?.name}
            onBackToCampaigns={activeCampaign ? handleBackToCampaigns : undefined}
          />
        )}
        {screen === "menu" && currentPlayer && (
          <MainMenu
            key="menu"
            onNavigate={handleNavigate}
            onDungeonAI={handleDungeonAI}
            isAdmin={isAdmin}
            playerName={currentPlayer.name}
            playerType={currentPlayer.type}
            crawlers={crawlers}
            onSwitchPlayer={(id, name, type) => {
              setCurrentPlayer({ id, name, type });
            }}
            campaignName={activeCampaign?.name}
            onBackToCampaigns={handleBackToCampaigns}
          />
        )}
      </AnimatePresence>

      {screen === "game" && currentPlayer && (
        <>
          <Navigation
            onNavigate={handleNavigate}
            onReturnToMenu={handleReturnToMenu}
            onShowChangelog={() => setShowChangelog(true)}
            currentView={currentView}
            playerName={currentPlayer.name}
            playerType={currentPlayer.type}
            autoCollapse={currentView === "showtime"}
            onVisibilityChange={setIsNavVisible}
            crawlers={crawlers}
            onSwitchPlayer={(id, name, type) => {
              setCurrentPlayer({ id, name, type });
            }}
            isAdmin={isAdmin}
            campaignName={activeCampaign?.name}
            onBackToCampaigns={handleBackToCampaigns}
          />

          <main id="main-content" className="pb-16 sm:pb-12">
            {currentView === "profiles" && (
              <ProfilesView
                crawlers={crawlers}
                onUpdateCrawler={updateCrawler}
                onAddCrawler={addCrawler}
                onDeleteCrawler={deleteCrawler}
                getCrawlerInventory={getCrawlerInventory}
                onUpdateCrawlerInventory={updateCrawlerInventory}
                partyGold={partyGold}
                onStatRoll={handleStatRoll}
                getCrawlerLootBoxes={getCrawlerLootBoxes}
                claimLootBoxItems={claimLootBoxItems}
                noncombatTurnState={noncombatTurnState}
                getNoncombatRollsRemaining={getNoncombatRollsRemaining}
                recordNoncombatRoll={recordNoncombatRoll}
                currentPlayerId={currentPlayer?.id}
                isShowtimeActive={isShowtimeActive}
                combatState={activeCombatState}
                onRecordCombatInitiative={recordCombatInitiative}
                onRecordCombatAction={recordCombatAction}
                onApplyCombatDamage={applyCombatDamage}
                addDiceRoll={addDiceRoll}
                mobs={mobs}
                getCrawlerAssignedQuests={getCrawlerAssignedQuests}
                quests={quests}
                onUpdateQuest={updateQuest}
              />
            )}
            {currentView === "maps" && (
              <MapsView
                maps={maps}
                mapNames={mapNames}
                onUpdateMapName={handleUpdateMapName}
                mapVisibility={mapVisibility}
                onToggleVisibility={handleToggleMapVisibility}
                isAdmin={isAdmin}
              />
            )}
            {currentView === "inventory" && (
              <InventoryView
                crawlers={crawlers}
                getCrawlerInventory={getCrawlerInventory}
                partyGold={partyGold}
                onUpdateInventory={updateCrawlerInventory}
                onUpdateCrawler={updateCrawler}
                getSharedInventory={getSharedInventory}
                onUpdateSharedInventory={updateSharedInventory}
                spells={spells}
                onConsumeSpellTome={consumeSpellTome}
                onPromoteSpellToLibrary={promoteSpellToLibrary}
                isAdmin={isAdmin}
                currentUserId={user?.uid}
                currentUsername={userProfile?.username}
                publicItems={publicItems}
                onToggleItemPublic={handleToggleItemPublic}
                showPublicContent={showPublicContent}
              />
            )}
            {currentView === "spells" && (
              <SpellsView
                crawlers={crawlers}
                spells={spells}
                onAddSpell={addSpell}
                onUpdateSpell={updateSpell}
                onDeleteSpell={deleteSpell}
                onLearnSpell={learnSpell}
                onForgetSpell={forgetSpell}
                onCastSpell={castSpell}
                onPromoteSpellToLibrary={promoteSpellToLibrary}
                isAdmin={isAdmin}
                currentUserId={user?.uid}
                currentUsername={userProfile?.username}
                publicSpells={publicSpells}
                onToggleSpellPublic={handleToggleSpellPublic}
                showPublicContent={showPublicContent}
              />
            )}
            {currentView === "mobs" && <MobsView mobs={mobs} />}
            {currentView === "dungeonai" && isAdmin && (
              <DungeonAIView
                mobs={mobs}
                onUpdateMobs={setMobs}
                maps={maps}
                onUpdateMaps={setMaps}
                mapNames={mapNames}
                onUpdateMapName={handleUpdateMapName}
                crawlers={crawlers}
                episodes={episodes}
                onAddEpisode={addEpisode}
                onUpdateEpisode={updateEpisode}
                onDeleteEpisode={deleteEpisode}
                onCleanupEmptyMaps={cleanupEmptyMaps}
                getSharedInventory={getSharedInventory}
                lootBoxTemplates={lootBoxTemplates}
                onAddLootBoxTemplate={addLootBoxTemplate}
                onUpdateLootBoxTemplate={updateLootBoxTemplate}
                onDeleteLootBoxTemplate={deleteLootBoxTemplate}
                onSetGameClock={setGameClock}
                quests={quests}
                onAddQuest={addQuest}
                onUpdateQuest={updateQuest}
                onDeleteQuest={deleteQuest}
              />
            )}
            {currentView === "showtime" && (
              <ShowTimeView
                maps={maps}
                mapNames={mapNames}
                episodes={episodes}
                mobs={mobs}
                crawlers={crawlers}
                isAdmin={isAdmin}
                onUpdateEpisode={updateEpisode}
                isNavVisible={isNavVisible}
                isDiceExpanded={isDiceExpanded}
                lootBoxes={lootBoxes}
                lootBoxTemplates={lootBoxTemplates}
                sendLootBox={sendLootBox}
                unlockLootBox={unlockLootBox}
                deleteLootBox={deleteLootBox}
                addDiceRoll={addDiceRoll}
                onEndEpisode={handleEndEpisode}
                onShowtimeActiveChange={handleShowtimeActiveChange}
                onRuntimePlacementsChange={handleRuntimePlacementsChange}
                onGameActiveChange={handleGameActiveChange}
                onRegisterGameToggle={handleRegisterGameToggle}
                getCrawlerInventory={getCrawlerInventory}
                onUpdateCrawlerInventory={updateCrawlerInventory}
                getSharedInventory={getSharedInventory}
                onSetGameClock={setGameClock}
                noncombatTurnState={noncombatTurnState}
                resetNoncombatTurns={resetNoncombatTurns}
                combatState={activeCombatState}
                onRemoveCombatant={removeCombatant}
                roomId={roomId}
                quests={quests}
                assignedQuests={assignedQuests}
                onAssignQuest={assignQuest}
                onUpdateQuest={updateQuest}
                onUpdateAssignedQuest={updateAssignedQuest}
                onDeleteAssignedQuest={deleteAssignedQuest}
              />
            )}
            {currentView === "sounds" && <SoundEffectsView />}
            {currentView === "wiki" && (
              <WikiView
                wikiPages={wikiPages}
                onUpdateWikiPage={updateWikiPage}
                onAddWikiPage={addWikiPage}
                playerName={currentPlayer.name}
              />
            )}
          </main>

          <DiceRoller
            crawlerName={currentPlayer.name}
            crawlerId={currentPlayer.id}
            diceRolls={diceRolls}
            addDiceRoll={addDiceRoll}
            onExpandedChange={setIsDiceExpanded}
          />

          {isShowtimeActive && (
            <PingPanel
              isAdmin={isAdmin}
              noncombatTurnState={noncombatTurnState}
              onStartNoncombatTurn={() => startNoncombatTurn()}
              isGameActive={isGameActive}
              onToggleGameActive={async (active) => {
                if (setGameActiveRef.current) {
                  await setGameActiveRef.current(active);
                }
                setIsGameActive(active);
                // Push dice roll notification
                const entry: DiceRollEntry = {
                  id: crypto.randomUUID(),
                  crawlerName: 'SYSTEM',
                  crawlerId: '__system__',
                  timestamp: Date.now(),
                  results: [],
                  total: 0,
                  lootBoxNotification: {
                    boxName: active
                      ? `${activeEpisode?.name ?? 'Episode'} has begun!`
                      : `${activeEpisode?.name ?? 'Episode'} has ended.`,
                    tier: active ? 'Gold' : 'Dirt',
                    recipientNames: active ? ['The adventure awaits...'] : ['The adventure is over.'],
                  },
                };
                await addDiceRoll(entry);
                if (active) {
                  toast(`${activeEpisode?.name ?? 'Episode'} has started!`, { icon: '⚔️', duration: Infinity });
                }
              }}
              crawlers={crawlers}
              mobs={mobs}
              gameClockState={gameClockState}
              onPerformShortRest={performShortRest}
              onPerformLongRest={performLongRest}
              activeEpisode={activeEpisode}
              combatState={activeCombatState}
              onStartCombat={async (crawlerIds, mobEntries) => {
                await startCombat(crawlerIds, mobEntries, activeEpisode?.id);
              }}
              onConfirmInitiative={confirmInitiative}
              onAdvanceCombatTurn={advanceCombatTurn}
              onEndCombat={endCombat}
              onCancelCombat={cancelCombat}
              onOverrideMobHealth={overrideMobHealth}
              onRemoveCombatant={removeCombatant}
              runtimeCrawlerPlacements={runtimeCrawlerPlacements}
              runtimeMobPlacements={runtimeMobPlacements}
              onAddCombatant={addCombatant}
            />
          )}

          <ChangelogViewer
            isOpen={showChangelog}
            onClose={() => setShowChangelog(false)}
          />

          <footer className="fixed bottom-0 left-0 right-0 z-10 text-center py-2 bg-background/80 border-t border-border text-xs text-muted-foreground">
            [ DUNGEON CRAWLER CARL - SYSTEM HUB v1.0 ]
          </footer>
        </>
      )}
    </div>
  );
};

export default Index;
