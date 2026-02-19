import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";
import MainMenu from "@/components/MainMenu";
import Navigation from "@/components/Navigation";
import DiceRoller from "@/components/DiceRoller";
import PingPanel from "@/components/PingPanel";
import ChangelogViewer from "@/components/ChangelogViewer";
import ProfilesView from "@/views/ProfilesView";
import MapsView from "@/views/MapsView";
import InventoryView from "@/views/InventoryView";
import MobsView from "@/views/MobsView";
import DungeonAIView from "@/views/DungeonAIView";
import ShowTimeView from "@/views/ShowTimeView";
import SoundEffectsView from "@/views/SoundEffectsView";
import WikiView from "@/views/WikiView";

import { useGameState, DiceRollEntry } from "@/hooks/useGameState";
import { toast } from "sonner";
import type { Episode, Mob, CrawlerPlacement, EpisodeMobPlacement } from "@/lib/gameData";

type AppScreen = "splash" | "menu" | "game";
type GameView = "profiles" | "maps" | "inventory" | "mobs" | "dungeonai" | "showtime" | "sounds" | "wiki";

const GAME_VIEWS: readonly string[] = ["profiles", "maps", "inventory", "mobs", "dungeonai", "showtime", "sounds", "wiki"];

const STORAGE_KEY_PLAYER = "dcc_current_player";
const STORAGE_KEY_MAP_VISIBILITY = "dcc_map_visibility";
const STORAGE_KEY_DUNGEON_AI_LOGIN = "dcc_dungeon_ai_login";

function loadSavedPlayer(): { id: string; name: string; type: "crawler" | "ai" | "npc" } | null {
  const saved = localStorage.getItem(STORAGE_KEY_PLAYER);
  if (saved) {
    try { return JSON.parse(saved); } catch { return null; }
  }
  return null;
}

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();

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

  // Initialize player synchronously from localStorage to avoid redirect flash on refresh
  const [currentPlayer, setCurrentPlayer] = useState<{
    id: string;
    name: string;
    type: "crawler" | "ai" | "npc";
  } | null>(() => {
    if (localStorage.getItem(STORAGE_KEY_DUNGEON_AI_LOGIN) === "true") {
      return { id: "dungeonai", name: "DUNGEON AI", type: "ai" };
    }
    return loadSavedPlayer();
  });

  const [mapVisibility, setMapVisibility] = useState<boolean[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MAP_VISIBILITY);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isDiceExpanded, setIsDiceExpanded] = useState(false);

  const [isDungeonAILoggedIn, setIsDungeonAILoggedIn] = useState(
    () => localStorage.getItem(STORAGE_KEY_DUNGEON_AI_LOGIN) === "true"
  );

  const [isShowtimeActive, setIsShowtimeActive] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [runtimeCrawlerPlacements, setRuntimeCrawlerPlacements] = useState<CrawlerPlacement[]>([]);
  const [runtimeMobPlacements, setRuntimeMobPlacements] = useState<EpisodeMobPlacement[]>([]);
  const [isGameActive, setIsGameActive] = useState(false);
  const setGameActiveRef = useRef<((active: boolean) => Promise<void>) | null>(null);

  const [previousPlayer, setPreviousPlayer] = useState<{
    id: string;
    name: string;
    type: "crawler" | "ai" | "npc";
  } | null>(() => {
    if (localStorage.getItem(STORAGE_KEY_DUNGEON_AI_LOGIN) === "true") {
      return loadSavedPlayer();
    }
    return null;
  });

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
    rollMobInitiatives,
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
    isLoaded
  } = useGameState();

  // Map names come from Firestore via useGameState
  const mapNames = firestoreMapNames;

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
    if (pathSegment === 'dungeonai' && currentPlayer?.type !== 'ai') {
      navigate('/menu', { replace: true });
      return;
    }
  }, [pathSegment, currentPlayer, navigate]);

  // Persist player to localStorage
  useEffect(() => {
    if (currentPlayer) {
      localStorage.setItem(STORAGE_KEY_PLAYER, JSON.stringify(currentPlayer));
    }
  }, [currentPlayer]);

  // Persist map visibility to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MAP_VISIBILITY, JSON.stringify(mapVisibility));
  }, [mapVisibility]);

  // --- Navigation handlers (now use navigate()) ---

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

  const handleDungeonAILogin = () => {
    // store previous player and switch to Dungeon AI profile for UI
    setPreviousPlayer(currentPlayer);
    setCurrentPlayer({ id: "dungeonai", name: "DUNGEON AI", type: "ai" });
    setIsDungeonAILoggedIn(true);
    localStorage.setItem(STORAGE_KEY_DUNGEON_AI_LOGIN, "true");
  };

  const handleDungeonAILogout = () => {
    setIsDungeonAILoggedIn(false);
    // restore previous player if one existed
    if (previousPlayer) {
      setCurrentPlayer(previousPlayer);
      setPreviousPlayer(null);
      navigate('/menu');
    } else {
      setCurrentPlayer(null);
      navigate('/');
    }

    localStorage.removeItem(STORAGE_KEY_DUNGEON_AI_LOGIN);
  };

  const handleReturnToMenu = () => {
    navigate('/menu');
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
  // Must be before the early return to maintain consistent hook order
  const activeCombatState = useMemo(() => {
    if (!combatState?.active) return combatState;
    // If combat has an episodeId, only show it when the matching episode is active
    if (combatState.episodeId && activeEpisode?.id && combatState.episodeId !== activeEpisode.id) {
      return null;
    }
    return combatState;
  }, [combatState, activeEpisode]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary animate-pulse font-display tracking-widest">
          LOADING SYSTEM...
        </div>
      </div>
    );
  }

  const isAdmin = currentPlayer?.type === "ai";

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {screen === "splash" && (
          <SplashScreen
            key="splash"
            crawlers={crawlers}
            onEnter={handlePlayerSelect}
          />
        )}
        {screen === "menu" && currentPlayer && (
          <MainMenu
            key="menu"
            onNavigate={handleNavigate}
            onDungeonAI={handleDungeonAI}
            isDungeonAILoggedIn={isDungeonAILoggedIn}
            onDungeonAILogout={handleDungeonAILogout}
            onDungeonAILogin={handleDungeonAILogin}
            playerName={currentPlayer.name}
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
          />

          <main className="pb-16 sm:pb-12">
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
              />
            )}
            {currentView === "mobs" && <MobsView mobs={mobs} />}
            {currentView === "dungeonai" && (
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
                onEndEpisode={() => {
                  setIsShowtimeActive(false);
                  setActiveEpisode(null);
                  setRuntimeCrawlerPlacements([]);
                  setRuntimeMobPlacements([]);
                }}
                onShowtimeActiveChange={(active, episode) => {
                  setIsShowtimeActive(active);
                  setActiveEpisode(episode ?? null);
                  if (!active) {
                    setRuntimeCrawlerPlacements([]);
                    setRuntimeMobPlacements([]);
                  }
                }}
                onRuntimePlacementsChange={(cp, mp) => {
                  setRuntimeCrawlerPlacements(cp);
                  setRuntimeMobPlacements(mp);
                }}
                onGameActiveChange={(active) => setIsGameActive(active)}
                onRegisterGameToggle={(fn) => { setGameActiveRef.current = fn; }}
                getCrawlerInventory={getCrawlerInventory}
                onUpdateCrawlerInventory={updateCrawlerInventory}
                getSharedInventory={getSharedInventory}
                onSetGameClock={setGameClock}
                noncombatTurnState={noncombatTurnState}
                resetNoncombatTurns={resetNoncombatTurns}
                combatState={activeCombatState}
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
