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
import { RoomManager } from "@/components/RoomManager";
import { useGameState, DiceRollEntry } from "@/hooks/useGameState";
import { toast } from "sonner";
import type { Episode } from "@/lib/gameData";

type AppScreen = "splash" | "menu" | "game";
type GameView = "profiles" | "maps" | "inventory" | "mobs" | "dungeonai" | "showtime" | "sounds" | "multiplayer";

const GAME_VIEWS: readonly string[] = ["profiles", "maps", "inventory", "mobs", "dungeonai", "showtime", "sounds", "multiplayer"];

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

  const [mapNames, setMapNames] = useState<string[]>(() => {
    const saved = localStorage.getItem('dcc_map_names');
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
    isLoaded
  } = useGameState();

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
    setMapNames((prev) => {
      const newNames = [...prev];
      newNames[index] = name;
      // Persist to localStorage
      localStorage.setItem('dcc_map_names', JSON.stringify(newNames));
      return newNames;
    });
  };

  useEffect(() => {
    if (maps.length > mapVisibility.length) {
      setMapVisibility((prev) => [...prev, ...Array(maps.length - prev.length).fill(true)]);
    } else if (maps.length < mapVisibility.length) {
      setMapVisibility((prev) => prev.slice(0, maps.length));
    }
    if (maps.length > mapNames.length) {
      setMapNames((prev) => [...prev, ...Array(maps.length - prev.length).fill(undefined).map((_, i) => `Map ${prev.length + i + 1}`)]);
    } else if (maps.length < mapNames.length) {
      setMapNames((prev) => prev.slice(0, maps.length));
    }
  }, [maps.length, mapVisibility.length, mapNames.length]);

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
                }}
                onShowtimeActiveChange={(active, episode) => {
                  setIsShowtimeActive(active);
                  setActiveEpisode(episode ?? null);
                }}
                getCrawlerInventory={getCrawlerInventory}
                onUpdateCrawlerInventory={updateCrawlerInventory}
                getSharedInventory={getSharedInventory}
                onSetGameClock={setGameClock}
                noncombatTurnState={noncombatTurnState}
                resetNoncombatTurns={resetNoncombatTurns}
              />
            )}
            {currentView === "sounds" && <SoundEffectsView />}
            {currentView === "multiplayer" && (
              <div className="container mx-auto px-4 sm:px-6 max-w-2xl">
                <h1 className="font-display text-3xl text-primary text-glow-cyan mb-6 text-center">
                  MULTIPLAYER
                </h1>
                <RoomManager />
              </div>
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
              crawlers={crawlers}
              gameClockState={gameClockState}
              onPerformShortRest={performShortRest}
              onPerformLongRest={performLongRest}
              activeEpisode={activeEpisode}
            />
          )}

          <ChangelogViewer
            isOpen={showChangelog}
            onClose={() => setShowChangelog(false)}
          />

          <footer className="fixed bottom-0 left-0 right-0 text-center py-2 bg-background/80 border-t border-border text-xs text-muted-foreground">
            [ DUNGEON CRAWLER CARL - SYSTEM HUB v1.0 ]
          </footer>
        </>
      )}
    </div>
  );
};

export default Index;
