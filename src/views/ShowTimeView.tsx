import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { ResizableMobDisplay } from "@/components/ui/ResizableMobDisplay";
import { GridOverlay } from "@/components/ui/GridOverlay";
import { MobIcon } from "@/components/ui/MobIcon";
import { FogOfWar } from "@/components/ui/FogOfWar";
import { Episode, Mob, MapSettings, Crawler, CrawlerPlacement, EpisodeMobPlacement } from "@/lib/gameData";
import { Map, X, Eye, Layers, ChevronLeft, ChevronRight, PlayCircle, Grid3x3, CloudFog, Eraser, Trash2, Target, ZoomIn, ZoomOut } from "lucide-react";
import { PingEffect, Ping } from "@/components/ui/PingEffect";
import { MapBox, MapBoxData } from "@/components/ui/MapBox";
import { MapToolsMenu } from "@/components/ui/MapToolsMenu";
import { CrawlerIcon } from "@/components/ui/CrawlerIcon";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";
import { useFirebaseStore } from "@/hooks/useFirebaseStore";

interface ShowTimeViewProps {
  maps: string[];
  mapNames?: string[];
  episodes: Episode[];
  mobs: Mob[];
  crawlers: Crawler[];
  isAdmin: boolean;
  onUpdateEpisode?: (id: string, updates: Partial<Episode>) => void;
}

const ShowTimeView: React.FC<ShowTimeViewProps> = ({ maps, mapNames, episodes, mobs, crawlers, isAdmin, onUpdateEpisode }) => {
  const { roomId } = useFirebaseStore();
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [displayedMobIds, setDisplayedMobIds] = useState<string[]>([]);
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(51); // Reduced by 20% from 64px
  const [draggingMobId, setDraggingMobId] = useState<string | null>(null);
  const [remoteDragState, setRemoteDragState] = useState<{placementIndex: number; x: number; y: number} | null>(null);
  const mapImageRef = useRef<HTMLImageElement>(null);
  const hasAutoLoaded = useRef(false);
  const mountTime = useRef(Timestamp.now());
  const lastBroadcastTime = useRef<number>(0);
  const BROADCAST_THROTTLE_MS = 50; // Throttle to ~20 updates per second

  // Fog of war state
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [fogEraserActive, setFogEraserActive] = useState(false); // Separate eraser toggle
  const [fogBrushSize, setFogBrushSize] = useState(5);
  const [revealedAreas, setRevealedAreas] = useState<{ x: number; y: number; radius: number }[]>([]);
  const [mapScale, setMapScale] = useState(100);
  const lastFogBroadcastTime = useRef<number>(0);
  const FOG_BROADCAST_THROTTLE_MS = 100;

  // Ping and Box state
  const [pings, setPings] = useState<Ping[]>([]);
  const [mapBoxes, setMapBoxes] = useState<MapBoxData[]>([]);
  const [isPingMode, setIsPingMode] = useState(false);
  const [isBoxMode, setIsBoxMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#ef4444"); // Default red
  const [boxOpacity, setBoxOpacity] = useState(0.3);

  // Crawler and Mob placement state (DM can add during ShowTime)
  const [crawlerPlacements, setCrawlerPlacements] = useState<CrawlerPlacement[]>([]);
  const [runtimeMobPlacements, setRuntimeMobPlacements] = useState<EpisodeMobPlacement[]>([]);
  const [isAddCrawlerMode, setIsAddCrawlerMode] = useState(false);
  const [isAddMobMode, setIsAddMobMode] = useState(false);
  const [selectedCrawlerId, setSelectedCrawlerId] = useState<string | null>(null);
  const [selectedMobId, setSelectedMobId] = useState<string | null>(null);

  // Cursor follower state for ping/box mode
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Dragging state for runtime crawlers/mobs
  const [draggingRuntimeId, setDraggingRuntimeId] = useState<string | null>(null);

  // Broadcast showtime state to sync with other players
  const broadcastShowtimeState = useCallback(async (
    episodeId: string | null,
    mapIdx: number,
    mapUrl: string | null
  ) => {
    if (!isAdmin) return; // Only DM broadcasts

    const showtimeDocPath = roomId
      ? `rooms/${roomId}/showtime-state/current`
      : `showtime-state/current`;

    try {
      await setDoc(doc(db, showtimeDocPath), {
        episodeId,
        currentMapIndex: mapIdx,
        selectedMapUrl: mapUrl,
        isActive: episodeId !== null && mapUrl !== null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast showtime state:', error);
    }
  }, [isAdmin, roomId]);

  // Listen for showtime state updates (for players)
  useEffect(() => {
    if (isAdmin) return; // DM doesn't need to listen - they control the state

    const showtimeDocPath = roomId
      ? `rooms/${roomId}/showtime-state/current`
      : `showtime-state/current`;

    const showtimeDocRef = doc(db, showtimeDocPath);

    const unsubscribe = onSnapshot(showtimeDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        // No showtime state - show waiting screen
        setSelectedEpisode(null);
        setSelectedMap(null);
        return;
      }

      const data = snapshot.data();
      console.log('[ShowTime] Received showtime state update:', data);

      // Update episode if changed
      if (data.episodeId) {
        const episode = episodes.find(e => e.id === data.episodeId);
        if (episode && episode.id !== selectedEpisode?.id) {
          setSelectedEpisode(episode);
        }
      } else {
        setSelectedEpisode(null);
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

  // Get current map ID for fog of war storage - MUST be defined before useEffects that use it
  const currentMapId = useMemo(() => {
    if (!selectedEpisode || selectedEpisode.mapIds.length === 0) return null;
    return selectedEpisode.mapIds[currentMapIndex];
  }, [selectedEpisode, currentMapIndex]);

  // Auto-select first episode and first map when episodes load (only once)
  useEffect(() => {
    if (episodes.length > 0 && !selectedEpisode && !hasAutoLoaded.current) {
      const firstEpisode = episodes[0];
      setSelectedEpisode(firstEpisode);
      if (firstEpisode.mapIds.length > 0) {
        const mapIndex = parseInt(firstEpisode.mapIds[0], 10);
        setSelectedMap(maps[mapIndex] || null);
        setCurrentMapIndex(0);
        // Load default fog of war and scale settings
        const firstMapId = firstEpisode.mapIds[0];
        const mapSettings = firstEpisode.mapSettings?.[firstMapId];
        setFogOfWarEnabled(mapSettings?.fogOfWar?.enabled ?? firstEpisode.defaultFogOfWar ?? false);
        setRevealedAreas(mapSettings?.fogOfWar?.revealedAreas ?? []);
        setMapScale(mapSettings?.scale ?? 100);
      }
      hasAutoLoaded.current = true;
    }
  }, [episodes, maps]);

  // Load fog of war and scale settings when map changes
  useEffect(() => {
    if (!selectedEpisode || currentMapId === null) return;
    const mapSettings = selectedEpisode.mapSettings?.[currentMapId];
    // Only set defaults if not already set from Firebase listener
    if (mapSettings) {
      setFogOfWarEnabled(mapSettings.fogOfWar?.enabled ?? selectedEpisode.defaultFogOfWar ?? false);
      setRevealedAreas(mapSettings.fogOfWar?.revealedAreas ?? []);
      setMapScale(mapSettings.scale ?? 100);
    } else {
      // Use episode defaults
      setFogOfWarEnabled(selectedEpisode.defaultFogOfWar ?? false);
      setRevealedAreas([]);
      setMapScale(100);
    }
  }, [currentMapId]);

  // Debug logging
  console.log('[ShowTime] Rendering with:', {
    episodeCount: episodes.length,
    mapCount: maps.length,
    mobCount: mobs.length,
    isAdmin,
    selectedEpisode: selectedEpisode?.name
  });

  // Listen for real-time drag updates from other players
  useEffect(() => {
    if (!selectedEpisode) return;

    const episodeId = selectedEpisode.id;

    // Use a single document per episode for drag state
    const dragDocPath = roomId
      ? `rooms/${roomId}/mob-drag-state/${episodeId}`
      : `mob-drag-state/${episodeId}`;

    const dragDocRef = doc(db, dragDocPath);

    console.log('[ShowTime] Setting up drag listener for episode:', episodeId);

    const unsubscribe = onSnapshot(dragDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        console.log('[ShowTime] Drag doc does not exist');
        return;
      }

      const dragData = snapshot.data();
      console.log('[ShowTime] Received drag update:', {
        dragData,
        isAdmin,
        draggingMobId,
        shouldApply: !isAdmin || !draggingMobId
      });

      // Only apply if we're not the one dragging
      if (!isAdmin || !draggingMobId) {
        if (dragData.updatedAt) {
          const updateTime = dragData.updatedAt.toMillis ? dragData.updatedAt.toMillis() : 0;
          const mountTimeMs = mountTime.current.toMillis();

          console.log('[ShowTime] Time check:', {
            updateTime,
            mountTimeMs,
            shouldApply: updateTime > mountTimeMs
          });

          // Only apply updates that happened after component mounted
          if (updateTime > mountTimeMs) {
            console.log('[ShowTime] APPLYING drag update to placement', dragData.placementIndex, 'with position', dragData.x, dragData.y);

            setRemoteDragState({
              placementIndex: dragData.placementIndex,
              x: dragData.x,
              y: dragData.y
            });

            // Update local episode state with remote drag position
            setSelectedEpisode(prev => {
              if (!prev) return prev;
              console.log('[ShowTime] Updating placement', dragData.placementIndex, 'from', prev.mobPlacements[dragData.placementIndex], 'to', dragData.x, dragData.y);
              return {
                ...prev,
                mobPlacements: prev.mobPlacements.map((p, i) =>
                  i === dragData.placementIndex ? { ...p, x: dragData.x, y: dragData.y } : p
                ),
              };
            });
          } else {
            console.log('[ShowTime] Skipping old update (before mount time)');
          }
        } else {
          console.log('[ShowTime] No updatedAt timestamp in drag data');
        }
      } else {
        console.log('[ShowTime] Skipping update - we are the dragger');
      }
    });

    return () => {
      console.log('[ShowTime] Cleaning up drag listener for episode:', episodeId);
      unsubscribe();
    };
  }, [selectedEpisode?.id, isAdmin, draggingMobId, roomId]);

  // Broadcast drag state to other players
  const broadcastDragState = async (placementIndex: number, x: number, y: number) => {
    if (!selectedEpisode || !isAdmin) return;

    // Use a single document per episode for drag state
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
  };

  // Listen for fog of war updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId) return;

    const fogDocPath = roomId
      ? `rooms/${roomId}/fog-of-war/${selectedEpisode.id}-${currentMapId}`
      : `fog-of-war/${selectedEpisode.id}-${currentMapId}`;

    const fogDocRef = doc(db, fogDocPath);

    const unsubscribe = onSnapshot(fogDocRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const fogData = snapshot.data();
      if (fogData.updatedAt) {
        const updateTime = fogData.updatedAt.toMillis ? fogData.updatedAt.toMillis() : 0;
        const mountTimeMs = mountTime.current.toMillis();

        if (updateTime > mountTimeMs || !isAdmin) {
          setFogOfWarEnabled(fogData.enabled ?? false);
          setRevealedAreas(fogData.revealedAreas ?? []);
          if (fogData.scale !== undefined) {
            setMapScale(fogData.scale);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId, isAdmin]);

  // Broadcast fog of war state
  const broadcastFogState = useCallback(async (
    enabled: boolean,
    areas: { x: number; y: number; radius: number }[],
    scale: number
  ) => {
    if (!selectedEpisode || !currentMapId || !isAdmin) return;

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
      const newAreas = [...prev, { x, y, radius }];

      // Throttle broadcast
      const now = Date.now();
      if (now - lastFogBroadcastTime.current >= FOG_BROADCAST_THROTTLE_MS) {
        lastFogBroadcastTime.current = now;
        broadcastFogState(fogOfWarEnabled, newAreas, mapScale);
      }

      return newAreas;
    });
  }, [fogOfWarEnabled, mapScale, broadcastFogState]);

  // Toggle fog of war
  const handleToggleFogOfWar = useCallback(() => {
    const newEnabled = !fogOfWarEnabled;
    setFogOfWarEnabled(newEnabled);
    broadcastFogState(newEnabled, revealedAreas, mapScale);
  }, [fogOfWarEnabled, revealedAreas, mapScale, broadcastFogState]);

  // Clear all fog of war (reset to fully fogged)
  const handleClearFogOfWar = useCallback(() => {
    setRevealedAreas([]);
    broadcastFogState(fogOfWarEnabled, [], mapScale);
  }, [fogOfWarEnabled, mapScale, broadcastFogState]);

  // Listen for ping updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId) return;

    const pingDocPath = roomId
      ? `rooms/${roomId}/pings/${selectedEpisode.id}-${currentMapId}`
      : `pings/${selectedEpisode.id}-${currentMapId}`;

    const pingDocRef = doc(db, pingDocPath);

    const unsubscribe = onSnapshot(pingDocRef, (snapshot) => {
      if (!snapshot.exists()) return;

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
    if (!selectedEpisode || !currentMapId) return;

    const boxDocPath = roomId
      ? `rooms/${roomId}/map-boxes/${selectedEpisode.id}-${currentMapId}`
      : `map-boxes/${selectedEpisode.id}-${currentMapId}`;

    const boxDocRef = doc(db, boxDocPath);

    const unsubscribe = onSnapshot(boxDocRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const boxData = snapshot.data();
      if (boxData.boxes) {
        setMapBoxes(boxData.boxes);
      }
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Broadcast a ping
  const broadcastPing = useCallback(async (x: number, y: number, color: string) => {
    if (!selectedEpisode || !currentMapId) return;

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
    if (!selectedEpisode || !currentMapId) return;

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

  // Handle adding a box
  const handleAddBox = useCallback((x: number, y: number, color: string, opacity: number) => {
    const newBox: MapBoxData = {
      id: `box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      width: 10,
      height: 10,
      rotation: 0,
      color,
      opacity,
      createdBy: isAdmin ? 'admin' : 'user',
    };
    const updatedBoxes = [...mapBoxes, newBox];
    setMapBoxes(updatedBoxes);
    broadcastBoxes(updatedBoxes);
    // Auto-deselect box mode after placing so user can manipulate the box
    setIsBoxMode(false);
  }, [mapBoxes, broadcastBoxes, isAdmin]);

  // Handle updating a box
  const handleUpdateBox = useCallback((updatedBox: MapBoxData) => {
    const updatedBoxes = mapBoxes.map(b => b.id === updatedBox.id ? updatedBox : b);
    setMapBoxes(updatedBoxes);
    broadcastBoxes(updatedBoxes);
  }, [mapBoxes, broadcastBoxes]);

  // Handle deleting a box
  const handleDeleteBox = useCallback((id: string) => {
    const updatedBoxes = mapBoxes.filter(b => b.id !== id);
    setMapBoxes(updatedBoxes);
    broadcastBoxes(updatedBoxes);
  }, [mapBoxes, broadcastBoxes]);

  // Broadcast crawler placements
  const broadcastCrawlerPlacements = useCallback(async (placements: CrawlerPlacement[]) => {
    if (!selectedEpisode || !currentMapId || !isAdmin) return;

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
  }, [selectedEpisode?.id, currentMapId, roomId, isAdmin]);

  // Broadcast runtime mob placements
  const broadcastRuntimeMobPlacements = useCallback(async (placements: EpisodeMobPlacement[]) => {
    if (!selectedEpisode || !currentMapId || !isAdmin) return;

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
  }, [selectedEpisode?.id, currentMapId, roomId, isAdmin]);

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

    const newPlacement: EpisodeMobPlacement = {
      mobId: selectedMobId,
      mapId: currentMapId,
      x,
      y,
    };
    const updated = [...runtimeMobPlacements, newPlacement];
    setRuntimeMobPlacements(updated);
    broadcastRuntimeMobPlacements(updated);
  }, [selectedMobId, currentMapId, runtimeMobPlacements, broadcastRuntimeMobPlacements]);

  // Handle removing a crawler from the map
  const handleRemoveCrawlerFromMap = useCallback((index: number) => {
    const updated = crawlerPlacements.filter((_, i) => i !== index);
    setCrawlerPlacements(updated);
    broadcastCrawlerPlacements(updated);
  }, [crawlerPlacements, broadcastCrawlerPlacements]);

  // Handle removing a runtime mob from the map
  const handleRemoveRuntimeMob = useCallback((index: number) => {
    const updated = runtimeMobPlacements.filter((_, i) => i !== index);
    setRuntimeMobPlacements(updated);
    broadcastRuntimeMobPlacements(updated);
  }, [runtimeMobPlacements, broadcastRuntimeMobPlacements]);

  // Handle map click for ping/box/crawlers/mobs
  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapImageRef.current) return;
    if (draggingMobId) return; // Don't do anything while dragging

    const rect = mapImageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    if (isPingMode) {
      broadcastPing(clampedX, clampedY, selectedColor);
    } else if (isBoxMode) {
      // All users can add boxes
      handleAddBox(clampedX, clampedY, selectedColor, boxOpacity);
    } else if (isAddCrawlerMode && isAdmin && selectedCrawlerId) {
      handleAddCrawlerToMap(clampedX, clampedY);
    } else if (isAddMobMode && isAdmin && selectedMobId) {
      handleAddMobToMapRuntime(clampedX, clampedY);
    }
  }, [isPingMode, isBoxMode, isAddCrawlerMode, isAddMobMode, isAdmin, selectedColor, boxOpacity, selectedCrawlerId, selectedMobId, draggingMobId, broadcastPing, handleAddBox, handleAddCrawlerToMap, handleAddMobToMapRuntime]);

  // Auto-clean old pings
  useEffect(() => {
    const interval = setInterval(() => {
      setPings(prev => prev.filter(p => Date.now() - p.timestamp < 3000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Handle zoom for all users
  const handleZoomIn = useCallback(() => {
    setMapScale(prev => Math.min(prev + 25, 500));
  }, []);

  const handleZoomOut = useCallback(() => {
    setMapScale(prev => Math.max(prev - 25, 25));
  }, []);

  // Handle dragging runtime crawlers (all users can drag)
  const handleRuntimeCrawlerDrag = useCallback((index: number, x: number, y: number) => {
    const updated = crawlerPlacements.map((p, i) =>
      i === index ? { ...p, x, y } : p
    );
    setCrawlerPlacements(updated);
  }, [crawlerPlacements]);

  const handleRuntimeCrawlerDragEnd = useCallback((index: number) => {
    broadcastCrawlerPlacements(crawlerPlacements);
  }, [crawlerPlacements, broadcastCrawlerPlacements]);

  // Handle dragging runtime mobs (all users can drag)
  const handleRuntimeMobDrag = useCallback((index: number, x: number, y: number) => {
    const updated = runtimeMobPlacements.map((p, i) =>
      i === index ? { ...p, x, y } : p
    );
    setRuntimeMobPlacements(updated);
  }, [runtimeMobPlacements]);

  const handleRuntimeMobDragEnd = useCallback((index: number) => {
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
    if (!selectedEpisode || !currentMapId) return;

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
        if (episodeCrawlerPlacements.length > 0) {
          setCrawlerPlacements(episodeCrawlerPlacements);
        }
        return;
      }

      const data = snapshot.data();
      if (data.placements) {
        setCrawlerPlacements(data.placements);
      }
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId]);

  // Listen for runtime mob placement updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId) return;

    const mobDocPath = roomId
      ? `rooms/${roomId}/runtime-mob-placements/${selectedEpisode.id}-${currentMapId}`
      : `runtime-mob-placements/${selectedEpisode.id}-${currentMapId}`;

    const mobDocRef = doc(db, mobDocPath);

    const unsubscribe = onSnapshot(mobDocRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      if (data.placements) {
        setRuntimeMobPlacements(data.placements);
      }
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId]);

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

  // Get the current map URL
  const currentMapUrl = useMemo(() => {
    if (!selectedEpisode || selectedEpisode.mapIds.length === 0) return null;
    const mapIndex = parseInt(selectedEpisode.mapIds[currentMapIndex], 10);
    return maps[mapIndex] || null;
  }, [selectedEpisode, maps, currentMapIndex]);

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
    setDisplayedMobIds(prev =>
      prev.includes(mobId) ? prev.filter(id => id !== mobId) : [...prev, mobId]
    );
  };

  const handleHideMob = (mobId: string) => {
    setDisplayedMobIds(prev => prev.filter(id => id !== mobId));
  };

  const handleEndEpisode = useCallback(() => {
    setSelectedEpisode(null);
    setSelectedMap(null);
    setCurrentMapIndex(0);
    setDisplayedMobIds([]);
    // Broadcast end of episode
    broadcastShowtimeState(null, 0, null);
  }, [broadcastShowtimeState]);

  const handleMobMouseDown = (placementKey: string) => {
    // All users can move mobs
    setDraggingMobId(placementKey);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Track cursor position for ping/box mode
    if (mapContainerRef.current && (isPingMode || isBoxMode)) {
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

    // Update mob placement in local state (always update for smooth dragging)
    setSelectedEpisode(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        mobPlacements: prev.mobPlacements.map((p, i) =>
          i === index ? { ...p, x, y } : p
        ),
      };
    });

    // Throttle broadcast to prevent overwhelming Firestore
    const now = Date.now();
    if (now - lastBroadcastTime.current >= BROADCAST_THROTTLE_MS) {
      lastBroadcastTime.current = now;
      broadcastDragState(index, x, y);
    }
  };

  const handleMouseUp = () => {
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
    if (draggingMobId && selectedEpisode && onUpdateEpisode) {
      // Extract index from placement key and broadcast final position
      const index = parseInt(draggingMobId.split('-').pop() || '0', 10);
      const finalPlacement = selectedEpisode.mobPlacements[index];
      if (finalPlacement && isAdmin) {
        broadcastDragState(index, finalPlacement.x, finalPlacement.y);
      }

      // Persist the updated mob placements
      onUpdateEpisode(selectedEpisode.id, {
        mobPlacements: selectedEpisode.mobPlacements,
      });
    }
    setDraggingMobId(null);
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
              <Map className="w-6 h-6" />
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
                      onClick={() => setSelectedEpisode(episode)}
                    >
                      <h3 className="font-display text-lg text-primary mb-2">{episode.name}</h3>
                      {episode.description && (
                        <p className="text-sm text-muted-foreground mb-3">{episode.description}</p>
                      )}

                      <div className="space-y-2 text-xs mb-4">
                        <div className="flex items-center gap-2">
                          <Map className="w-4 h-4 text-primary" />
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
                      </div>

                      <DungeonButton
                        variant="admin"
                        size="sm"
                        className="w-full"
                        onClick={() => setSelectedEpisode(episode)}
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
              broadcastShowtimeState(null, 0, null);
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
          onClearFogOfWar={handleClearFogOfWar}
          episodeName={selectedEpisode.name}
          currentMapIndex={currentMapIndex}
          totalMaps={selectedEpisode.mapIds.length}
          mapScale={mapScale}
          onPreviousMap={handlePreviousMap}
          onNextMap={handleNextMap}
          onSelectMap={() => setSelectedMap(null)}
          onEndEpisode={handleEndEpisode}
        />
      )}

      {/* Zoom controls - available to all users */}
      {selectedMap && (
        <div className="absolute bottom-4 left-4 z-40 flex flex-col gap-2">
          <DungeonButton
            variant="default"
            size="sm"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </DungeonButton>
          <div className="text-xs text-center text-muted-foreground bg-background/80 px-2 py-1 rounded">
            {mapScale}%
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

      {/* Map display */}
      <div
        ref={mapContainerRef}
        className="flex-1 flex items-center justify-center p-4 select-none overflow-auto relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setCursorPosition(null);
          handleMouseUp();
        }}
      >
        {/* Cursor follower for ping/box mode */}
        {cursorPosition && (isPingMode || isBoxMode) && (
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
            ) : (
              <div
                className="w-10 h-10 border-2 border-dashed"
                style={{
                  borderColor: selectedColor,
                  backgroundColor: `${selectedColor}${Math.round(boxOpacity * 255).toString(16).padStart(2, '0')}`,
                }}
              />
            )}
          </div>
        )}

        <div
          className="relative"
          data-map-container
          style={{
            transform: `scale(${mapScale / 100})`,
            transformOrigin: 'center center',
          }}
          onMouseUp={handleMouseUp}
          onClick={handleMapClick}
        >
          <img
            ref={mapImageRef}
            src={selectedMap}
            alt="Current Map"
            className="max-w-full max-h-[90vh] object-contain pointer-events-none"
            draggable={false}
          />

          {/* Grid overlay - only visible to DM */}
          {isAdmin && <GridOverlay isVisible={showGrid} cellSize={gridSize} opacity={0.3} />}

          {/* Displayed mobs on the map - filtered by current map */}
          {currentMapMobPlacements.map((placement, localIndex) => {
            const mob = mobs.find(m => m.id === placement.mobId);
            if (!mob) return null;

            // Find the global index in the full placements array for drag state
            const globalIndex = selectedEpisode?.mobPlacements.findIndex(
              (p, i) => p === placement || (p.mobId === placement.mobId && p.x === placement.x && p.y === placement.y && p.mapId === placement.mapId)
            ) ?? localIndex;

            // Count how many times this mob appears before this index on this map
            const sameIdBefore = currentMapMobPlacements
              .slice(0, localIndex)
              .filter(p => p.mobId === placement.mobId).length;
            const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';

            const isDragging = draggingMobId === `${placement.mobId}-${globalIndex}`;

            return (
              <motion.div
                key={`${placement.mobId}-${currentMapId}-${localIndex}`}
                className="absolute"
                style={{
                  left: `${placement.x}%`,
                  top: `${placement.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseDown={() => handleMobMouseDown(`${placement.mobId}-${globalIndex}`)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ opacity: { duration: 0.2 } }}
              >
                <div className="relative">
                  <MobIcon
                    mob={mob}
                    size={64}
                    isDragging={isDragging}
                  />
                  {letter && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-accent text-background rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      {letter}
                    </div>
                  )}
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
            const isDragging = draggingRuntimeId === `crawler-${index}`;

            return (
              <motion.div
                key={`crawler-${placement.crawlerId}-${index}`}
                className="absolute cursor-move"
                style={{
                  left: `${placement.x}%`,
                  top: `${placement.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ opacity: { duration: 0.2 } }}
                onMouseDown={(e) => {
                  // All users can move crawlers
                  e.stopPropagation();
                  setDraggingRuntimeId(`crawler-${index}`);
                }}
              >
                <div className="relative">
                  <CrawlerIcon crawler={crawler} size={64} isDragging={isDragging} />
                  {/* Letter badge - only show if there are duplicates */}
                  {letter && (
                    <div className="absolute -top-1 -left-1 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      {letter}
                    </div>
                  )}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCrawlerFromMap(index);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Runtime mob icons (added during ShowTime) */}
          {runtimeMobPlacements.filter(p => p.mapId === currentMapId).map((placement, index, filteredArr) => {
            const mob = mobs.find(m => m.id === placement.mobId);
            if (!mob) return null;

            // Count how many times this mob appears in episode mobs on this map
            const episodeMobCount = currentMapMobPlacements.filter(p => p.mobId === placement.mobId).length;
            // Count how many times this mob appears before this index in runtime mobs
            const runtimeMobsBefore = filteredArr
              .slice(0, index)
              .filter(p => p.mobId === placement.mobId).length;
            // Total count before this one (episode + runtime before)
            const totalBefore = episodeMobCount + runtimeMobsBefore;
            // Only show letter if this mob has any duplicates (totalBefore > 0)
            const letter = totalBefore > 0 ? String.fromCharCode(65 + totalBefore) : '';
            const isDragging = draggingRuntimeId === `mob-${index}`;

            return (
              <motion.div
                key={`runtime-mob-${placement.mobId}-${index}`}
                className="absolute cursor-move"
                style={{
                  left: `${placement.x}%`,
                  top: `${placement.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ opacity: { duration: 0.2 } }}
                onMouseDown={(e) => {
                  // All users can move runtime mobs
                  e.stopPropagation();
                  setDraggingRuntimeId(`mob-${index}`);
                }}
              >
                <div className="relative">
                  <MobIcon mob={mob} size={64} isDragging={isDragging} />
                  {/* Letter badge - only show if there are duplicates */}
                  {letter && (
                    <div className="absolute -top-1 -left-1 w-6 h-6 bg-accent text-background rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      {letter}
                    </div>
                  )}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRuntimeMob(index);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
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
              mapScale={mapScale}
            />
          ))}

          {/* Fog of War overlay - placed AFTER mobs and boxes so it covers them */}
          <FogOfWar
            isVisible={fogOfWarEnabled}
            revealedAreas={revealedAreas}
            isAdmin={isAdmin && fogEraserActive}
            brushSize={fogBrushSize}
            onReveal={handleFogReveal}
            onClearAll={handleClearFogOfWar}
            isViewerAdmin={isAdmin}
          />

          {/* Ping effects - on top of everything */}
          <PingEffect pings={pings} />
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
    </motion.div>
  );
};

export default ShowTimeView;
