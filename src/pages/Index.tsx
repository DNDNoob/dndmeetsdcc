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
import { useMyContent } from "@/hooks/useMyContent";
import { useNpcBrain } from "@/hooks/useNpcBrain";
import { toast } from "sonner";
import { getNoChildLeftBehindBump } from "@/lib/gameData";
import type { Episode, Campaign, CrawlerPlacement, EpisodeMobPlacement, Mob, PublicMap, PublicMob, PublicEpisode, InventoryItem, Spell } from "@/lib/gameData";
import { publicDocId, buildEpisodeBundle } from "@/lib/publicContent";
import { LanguagesProvider } from "@/contexts/LanguagesContext";

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

  // Derive screen and currentView from the URL path (strip /app prefix)
  const pathSegment = location.pathname.replace(/^\/app\/?/, '').split('/')[0] || '';

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
    mapDocs,
    updateMapName,
    setMaps,
    setMapPublic,
    markMapsShared,
    importMaps,
    importMob,
    importEpisode,
    setCreator,
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
    forceRollInitiatives,
    advanceCombatTurn,
    recordCombatAction,
    applyCombatDamage,
    applyCombatDamageBatch,
    recordCrawlerMove,
    undoCombatTurn,
    awardTrophy,
    applyNoChildLeftBehind,
    revokeTrophy,
    overrideMobHealth,
    setMobEncountered,
    endCombat,
    cancelCombat,
    removeCombatant,
    addCombatant,
    updateCombatTimer,
    wikiPages,
    addWikiPage,
    updateWikiPage,
    chatMessages,
    npcAiSettings,
    npcAiStatus,
    npcSecrets,
    npcPersonalities,
    sendChatMessage,
    clearChat,
    customLanguages,
    createLanguage,
    deleteLanguage,
    updateNpcAiSettings,
    setNpcSecretState,
    spells,
    addSpell,
    updateSpell,
    deleteSpell,
    learnSpell,
    forgetSpell,
    castSpell,
    healCrawler,
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

  // Online NPC brain: runs in the DM's browser during a live game (keys stay in this browser)
  const { npcKeys, setNpcKeys } = useNpcBrain(roomId, isAdmin);

  // Public content (cross-campaign sharing)
  const showPublicContent = userProfile?.showPublicContent ?? false;
  const {
    publicItems, publicSpells, publicMaps, publicMobs, publicEpisodes,
    publishItem, unpublishItem, publishSpell, unpublishSpell,
    publishMap, unpublishMap, publishMob, unpublishMob,
    publishEpisode, unpublishEpisode, fetchEpisodeAssets,
  } = usePublicContent(showPublicContent);

  // Personal content: items and spells linked to the user's profile, not to a campaign
  const { myItems, mySpells, saveMyItem, deleteMyItem, saveMySpell, deleteMySpell } =
    useMyContent(isAuthenticated ? user?.uid ?? null : null, userProfile?.username);
  const handleSaveItemToMyContent = (item: InventoryItem) => {
    saveMyItem(item).then(() => toast.success(`Saved ${item.name} to My Content`)).catch(() => {});
  };
  const handleSaveSpellToMyContent = (spell: Spell) => {
    saveMySpell(spell).then(() => toast.success(`Saved ${spell.name} to My Content`)).catch(() => {});
  };

  // ── Community maps / mobs / episodes (DM console) ─────────────────────────
  // Content without createdBy was made in this campaign by its DM; it's stamped with the
  // publisher's uid on first publish. Imported content keeps its original creator, so it
  // can't be re-published by the importer.
  const creatorFields = () => ({
    createdBy: user?.uid ?? '',
    ...(userProfile?.username ? { createdByUsername: userProfile.username } : {}),
  });

  const handleToggleMapPublic = async (index: number, isPublic: boolean) => {
    const map = mapDocs[index];
    if (!map || !roomId || !user) return;
    const creator = map.createdBy ? { createdBy: map.createdBy, createdByUsername: map.createdByUsername } : creatorFields();
    const publicId = publicDocId(roomId, map.id);
    try {
      if (isPublic) {
        const pub: PublicMap = {
          id: publicId,
          sourceId: map.id,
          sourceCampaignId: roomId,
          name: map.name || `Map ${index + 1}`,
          image: map.image,
          ...creator,
          publishedAt: Date.now(),
        };
        await publishMap(pub);
      } else {
        await unpublishMap(publicId);
      }
      await setMapPublic(index, { isPublic, ...creator });
      toast.success(isPublic ? 'Map shared with the community' : 'Map is now private');
    } catch (err) {
      console.error('[Index] Failed to toggle map public:', err);
      toast.error('Failed to update map sharing');
    }
  };

  const handleToggleMobPublic = async (mob: Mob, isPublic: boolean) => {
    if (!roomId || !user) return;
    const creator = mob.createdBy ? { createdBy: mob.createdBy, createdByUsername: mob.createdByUsername } : creatorFields();
    const publicId = publicDocId(roomId, mob.id);
    try {
      if (isPublic) {
        const pub: PublicMob = {
          ...mob,
          ...creator,
          id: publicId,
          sourceId: mob.id,
          sourceCampaignId: roomId,
          encountered: false,
          publishedAt: Date.now(),
        };
        await publishMob(pub);
      } else {
        await unpublishMob(publicId);
      }
      await setMobs(mobs.map(m => m.id === mob.id ? { ...m, ...creator, isPublic } : m));
      toast.success(isPublic ? `${mob.name} shared with the community` : `${mob.name} is now private`);
    } catch (err) {
      console.error('[Index] Failed to toggle mob public:', err);
      toast.error('Failed to update mob sharing');
    }
  };

  // Publishing an episode snapshots it; editing it afterwards requires "Update shared copy"
  const handleToggleEpisodePublic = async (episode: Episode, isPublic: boolean) => {
    if (!roomId || !user) return;
    const creator = episode.createdBy ? { createdBy: episode.createdBy, createdByUsername: episode.createdByUsername } : creatorFields();
    const publicId = publicDocId(roomId, episode.id);
    try {
      if (isPublic) {
        const bundle = buildEpisodeBundle(episode, mapDocs, mobs, lootBoxTemplates, quests);
        if (bundle.assets.maps.length === 0) {
          toast.error('Add at least one map to this episode before sharing it');
          return;
        }
        const pub: PublicEpisode = {
          ...bundle.episode,
          ...creator,
          id: publicId,
          sourceId: episode.id,
          sourceCampaignId: roomId,
          publishedAt: Date.now(),
        };
        await publishEpisode(pub, bundle.assets);
        await markMapsShared(episode.mapIds.map(i => mapDocs[parseInt(i, 10)]?.id).filter((id): id is string => !!id));
      } else {
        await unpublishEpisode(publicId);
      }
      await updateEpisode(episode.id, { ...creator, isPublic });
      toast.success(isPublic ? `"${episode.name}" shared with the community` : `"${episode.name}" is now private`);
    } catch (err) {
      console.error('[Index] Failed to toggle episode public:', err);
      toast.error('Failed to update episode sharing');
    }
  };

  const handleImportPublicMap = async (map: PublicMap) => {
    try {
      await importMaps([{ name: map.name, image: map.image, createdBy: map.createdBy, ...(map.createdByUsername ? { createdByUsername: map.createdByUsername } : {}) }]);
      toast.success(`Added "${map.name}" to your maps`);
    } catch (err) {
      console.error('[Index] Failed to import map:', err);
    }
  };

  const handleImportPublicMob = async (mob: PublicMob) => {
    try {
      await importMob(mob);
      toast.success(`Added ${mob.name} to your mobs`);
    } catch (err) {
      console.error('[Index] Failed to import mob:', err);
    }
  };

  const handleImportPublicEpisode = async (episode: PublicEpisode) => {
    try {
      const assets = await fetchEpisodeAssets(episode.id);
      await importEpisode(episode, assets);
      toast.success(`Imported "${episode.name}" with ${assets.maps.length} map(s), ${assets.mobs.length} mob type(s) and ${episode.quests?.length ?? 0} quest(s)`);
    } catch (err) {
      console.error('[Index] Failed to import episode:', err);
      toast.error('Failed to import episode');
    }
  };

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

  // One-click "share everything I made in this campaign" for the DM. Content with no creator was
  // made here before creator tracking existed, so the DM claims it. Content created by others is untouched.
  const handleShareAllMyContent = async () => {
    if (!roomId || !user || !isAdmin) return;
    const isMine = (createdBy?: string) => !createdBy || createdBy === user.uid;
    const creatorOf = (c: { createdBy?: string; createdByUsername?: string }) =>
      c.createdBy ? { createdBy: c.createdBy, ...(c.createdByUsername ? { createdByUsername: c.createdByUsername } : {}) } : creatorFields();

    const libraryItems = getSharedInventory();
    const itemsToShare = libraryItems.filter(i => isMine(i.createdBy) && !(i.isPublic && i.createdBy));
    const spellsToShare = spells.filter(s => isMine(s.createdBy) && !(s.isPublic && s.createdBy));
    const mapsToShare = mapDocs.map((m, index) => ({ m, index })).filter(({ m }) => m.image && isMine(m.createdBy) && !m.isPublic);
    const mobsToShare = mobs.filter(m => isMine(m.createdBy) && !m.isPublic);
    const episodesToShare = episodes.filter(e => isMine(e.createdBy) && !e.isPublic);

    const total = itemsToShare.length + spellsToShare.length + mapsToShare.length + mobsToShare.length + episodesToShare.length;
    if (total === 0) {
      toast.info('Everything you made in this campaign is already shared');
      return;
    }
    const summary = [
      [itemsToShare.length, 'item'], [spellsToShare.length, 'spell'], [mapsToShare.length, 'map'],
      [mobsToShare.length, 'mob type'], [episodesToShare.length, 'episode'],
    ].filter(([n]) => n).map(([n, label]) => `${n} ${label}${n === 1 ? '' : 's'}`).join(', ');
    if (!confirm(`Share ${summary} with the community? Content made by other players is not touched.`)) return;

    let shared = 0;
    let failed = 0;
    const attempt = async (label: string, fn: () => Promise<void>) => {
      try {
        await fn();
        shared++;
      } catch (err) {
        failed++;
        console.error(`[Index] Failed to share ${label}:`, err);
      }
    };

    if (itemsToShare.length > 0) {
      const ids = new Set(itemsToShare.map(i => i.id));
      const updated = libraryItems.map(i => ids.has(i.id) ? { ...i, ...creatorOf(i), isPublic: true } : i);
      updateSharedInventory(updated);
      for (const item of updated.filter(i => ids.has(i.id))) {
        await attempt(`item ${item.name}`, () => publishItem(item));
      }
    }
    for (const spell of spellsToShare) {
      const stamp = { ...creatorOf(spell), isPublic: true };
      await attempt(`spell ${spell.name}`, async () => {
        await updateSpell(spell.id, stamp);
        await publishSpell({ ...spell, ...stamp });
      });
    }
    for (const { m, index } of mapsToShare) {
      const creator = creatorOf(m);
      await attempt(`map ${m.name}`, async () => {
        await publishMap({
          id: publicDocId(roomId, m.id), sourceId: m.id, sourceCampaignId: roomId,
          name: m.name || `Map ${index + 1}`, image: m.image, ...creator, publishedAt: Date.now(),
        });
        await setMapPublic(index, { isPublic: true, ...creator });
      });
    }
    // Mobs are saved in one setMobs call at the end, since setMobs replaces the whole list
    const sharedMobIds = new Set<string>();
    for (const mob of mobsToShare) {
      await attempt(`mob ${mob.name}`, async () => {
        await publishMob({
          ...mob, ...creatorOf(mob), id: publicDocId(roomId, mob.id), sourceId: mob.id,
          sourceCampaignId: roomId, encountered: false, publishedAt: Date.now(),
        });
        sharedMobIds.add(mob.id);
      });
    }
    if (sharedMobIds.size > 0) {
      await setMobs(mobs.map(m => sharedMobIds.has(m.id) ? { ...m, ...creatorOf(m), isPublic: true } : m));
    }
    for (const episode of episodesToShare) {
      const bundle = buildEpisodeBundle(episode, mapDocs, mobs, lootBoxTemplates, quests);
      if (bundle.assets.maps.length === 0) continue;
      const creator = creatorOf(episode);
      await attempt(`episode ${episode.name}`, async () => {
        await publishEpisode({
          ...bundle.episode, ...creator, id: publicDocId(roomId, episode.id), sourceId: episode.id,
          sourceCampaignId: roomId, publishedAt: Date.now(),
        }, bundle.assets);
        await markMapsShared(episode.mapIds.map(i => mapDocs[parseInt(i, 10)]?.id).filter((id): id is string => !!id));
        await updateEpisode(episode.id, { ...creator, isPublic: true });
      });
    }

    if (failed > 0) toast.error(`Shared ${shared}, but ${failed} failed. Check the console for details.`);
    else toast.success(`Shared ${shared} with the community`);
  };

  // Link everything the signed-in user creates to their profile
  useEffect(() => {
    setCreator(isAuthenticated && user ? { uid: user.uid, ...(userProfile?.username ? { username: userProfile.username } : {}) } : null);
  }, [isAuthenticated, user, userProfile?.username, setCreator]);

  // "No Child Left Behind": the DM's client lifts a sole slowest crawler to the second slowest speed.
  // Only the DM runs it so the trophy isn't awarded once per connected player, and only while a game
  // is being played, so speeds the DM sets while creating crawlers aren't overridden mid-setup.
  const noChildLeftBehindKey = (() => {
    const bump = getNoChildLeftBehindBump(crawlers, getCrawlerInventory);
    return bump ? `${bump.crawlerId}:${bump.moveSpeed}` : '';
  })();
  const lastNoChildLeftBehindKey = useRef('');
  useEffect(() => {
    if (!isAdmin || !isLoaded || !isGameActive || !noChildLeftBehindKey) return;
    if (lastNoChildLeftBehindKey.current === noChildLeftBehindKey) return;
    lastNoChildLeftBehindKey.current = noChildLeftBehindKey;
    applyNoChildLeftBehind().catch(err => console.error('[Index] No Child Left Behind failed:', err));
  }, [isAdmin, isLoaded, isGameActive, noChildLeftBehindKey, applyNoChildLeftBehind]);

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

  // When user signs out or becomes unauthenticated, redirect to landing page
  // Guard with authLoading so we don't redirect before auth resolves
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setActiveCampaign(null);
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Determine if we should show campaign selection
  const showCampaignSelect = !authLoading && isAuthenticated && !needsUsername && !activeCampaign;

  // Route guards — redirect invalid navigation states
  useEffect(() => {
    // Unknown route → splash
    if (pathSegment !== '' && pathSegment !== 'menu' && !GAME_VIEWS.includes(pathSegment)) {
      navigate('/app', { replace: true });
      return;
    }
    // No player selected but trying to access menu or game views → splash
    if (!currentPlayer && pathSegment !== '') {
      navigate('/app', { replace: true });
      return;
    }
    // Non-admin trying to access dungeonai → menu. Wait for sign-in to restore first,
    // otherwise a DM refreshing the DM Console is briefly "not admin" and gets bounced.
    if (pathSegment === 'dungeonai' && !authLoading && !isAdmin) {
      navigate('/app/menu', { replace: true });
      return;
    }
  }, [pathSegment, currentPlayer, navigate, isAdmin, authLoading]);

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
    navigate('/app/menu');
  };

  const handleNavigate = (view: string) => {
    navigate('/app/' + view);
  };

  const handleDungeonAI = () => {
    navigate('/app/dungeonai');
  };

  const handleReturnToMenu = () => {
    navigate('/app/menu');
  };

  const handleBackToCampaigns = () => {
    setActiveCampaign(null);
    setCurrentPlayer(null);
    navigate('/app', { replace: true });
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
    navigate(restoredPlayer ? '/app/menu' : '/app');
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

  // Whose languages decide what's readable: the DM reads everything
  const languageReader = useMemo(
    () => (isAdmin ? null : crawlers.find(c => c.id === currentPlayer?.id) ?? null),
    [isAdmin, crawlers, currentPlayer?.id]
  );

  // While auth is still loading, show a loading indicator to avoid flashing
  // the splash screen before we know if the user should be redirected to landing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary animate-pulse font-display tracking-widest">
          LOADING SYSTEM...
        </div>
      </div>
    );
  }

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
        myItems={myItems}
        mySpells={mySpells}
        onSaveMyItem={saveMyItem}
        onDeleteMyItem={deleteMyItem}
        onDeleteMySpell={deleteMySpell}
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
    <LanguagesProvider
      customLanguages={customLanguages}
      isAdmin={isAdmin}
      readerCrawler={languageReader}
      createLanguage={createLanguage}
      deleteLanguage={deleteLanguage}
    >
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
                onUndoCombatTurn={undoCombatTurn}
                onApplyCombatDamage={applyCombatDamage}
                onApplyCombatDamageBatch={applyCombatDamageBatch}
                isAdmin={isAdmin}
                onAwardTrophy={awardTrophy}
                onRevokeTrophy={revokeTrophy}
                addDiceRoll={addDiceRoll}
                mobs={mobs}
                getCrawlerAssignedQuests={getCrawlerAssignedQuests}
                quests={quests}
                onUpdateQuest={updateQuest}
                spells={spells}
                onCastSpell={castSpell}
                onForgetSpell={forgetSpell}
                onHealCrawler={healCrawler}
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
                myItems={myItems}
                onSaveItemToMyContent={isAuthenticated ? handleSaveItemToMyContent : undefined}
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
                mySpells={mySpells}
                onSaveSpellToMyContent={isAuthenticated ? handleSaveSpellToMyContent : undefined}
                onToggleSpellPublic={handleToggleSpellPublic}
                showPublicContent={showPublicContent}
                currentPlayerId={currentPlayer?.id}
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
                currentUserId={user?.uid}
                currentCampaignId={roomId}
                mapDocs={mapDocs}
                showPublicContent={showPublicContent}
                publicMaps={publicMaps}
                publicMobs={publicMobs}
                publicEpisodes={publicEpisodes}
                onToggleMapPublic={handleToggleMapPublic}
                onToggleMobPublic={handleToggleMobPublic}
                onToggleEpisodePublic={handleToggleEpisodePublic}
                onShareAllMyContent={handleShareAllMyContent}
                onImportPublicMap={handleImportPublicMap}
                onImportPublicMob={handleImportPublicMob}
                onImportPublicEpisode={handleImportPublicEpisode}
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
                currentPlayerId={currentPlayer?.id}
                onRecordCrawlerMove={recordCrawlerMove}
                onSetMobEncountered={setMobEncountered}
                chatMessages={chatMessages}
                npcAiSettings={npcAiSettings}
                npcAiStatus={npcAiStatus}
                npcSecrets={npcSecrets}
                npcPersonalities={npcPersonalities}
                onSendChatMessage={sendChatMessage}
                onClearChat={isAdmin ? clearChat : undefined}
                onUpdateNpcAiSettings={isAdmin ? updateNpcAiSettings : undefined}
                onSetNpcSecretState={isAdmin ? setNpcSecretState : undefined}
                npcKeys={isAdmin ? npcKeys : undefined}
                onChangeNpcKeys={isAdmin ? setNpcKeys : undefined}
                onSetTranslateMode={async (crawlerId, mode) => { await updateCrawler(crawlerId, { translateMode: mode }); }}
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
              onForceRollInitiatives={forceRollInitiatives}
              onAdvanceCombatTurn={advanceCombatTurn}
              onEndCombat={endCombat}
              onCancelCombat={cancelCombat}
              onOverrideMobHealth={overrideMobHealth}
              onSetMobEncountered={setMobEncountered}
              onRemoveCombatant={removeCombatant}
              runtimeCrawlerPlacements={runtimeCrawlerPlacements}
              runtimeMobPlacements={runtimeMobPlacements}
              onAddCombatant={addCombatant}
              onUpdateCombatTimer={updateCombatTimer}
              getCrawlerInventory={getCrawlerInventory}
              currentPlayerId={currentPlayer?.id}
              onUndoCombatTurn={undoCombatTurn}
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
    </LanguagesProvider>
  );
};

export default Index;
