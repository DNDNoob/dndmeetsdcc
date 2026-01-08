import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";
import MainMenu from "@/components/MainMenu";
import Navigation from "@/components/Navigation";
import DiceRoller from "@/components/DiceRoller";
import ProfilesView from "@/views/ProfilesView";
import MapsView from "@/views/MapsView";
import InventoryView from "@/views/InventoryView";
import MobsView from "@/views/MobsView";
import DungeonAIView from "@/views/DungeonAIView";
import { useGameState } from "@/hooks/useGameState";

type AppScreen = "splash" | "menu" | "game";
type GameView = "profiles" | "maps" | "inventory" | "mobs" | "dungeonai";

const Index = () => {
  const [screen, setScreen] = useState<AppScreen>("splash");
  const [currentView, setCurrentView] = useState<GameView>("profiles");

  const { 
    crawlers, 
    updateCrawler, 
    addCrawler,
    deleteCrawler,
    getCrawlerInventory, 
    updateCrawlerInventory,
    mobs,
    setMobs,
    maps,
    setMaps,
    partyGold,
    isLoaded 
  } = useGameState();

  const handleEnter = () => setScreen("menu");

  const handleNavigate = (view: string) => {
    setCurrentView(view as GameView);
    setScreen("game");
  };

  const handleDungeonAI = () => {
    setCurrentView("dungeonai");
    setScreen("game");
  };

  const handleReturnToMenu = () => {
    setScreen("menu");
  };

  if (!isLoaded) {
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
      <AnimatePresence mode="wait">
        {screen === "splash" && <SplashScreen key="splash" onEnter={handleEnter} />}
        {screen === "menu" && (
          <MainMenu key="menu" onNavigate={handleNavigate} onDungeonAI={handleDungeonAI} />
        )}
      </AnimatePresence>

      {screen === "game" && (
        <>
          <Navigation
            onNavigate={handleNavigate}
            onReturnToMenu={handleReturnToMenu}
            currentView={currentView}
          />

          <main className="pb-12">
            {currentView === "profiles" && (
              <ProfilesView 
                crawlers={crawlers} 
                onUpdateCrawler={updateCrawler}
                onAddCrawler={addCrawler}
                onDeleteCrawler={deleteCrawler}
                getCrawlerInventory={getCrawlerInventory}
                partyGold={partyGold}
              />
            )}
            {currentView === "maps" && <MapsView />}
            {currentView === "inventory" && (
              <InventoryView
                crawlers={crawlers}
                getCrawlerInventory={getCrawlerInventory}
                partyGold={partyGold}
                onUpdateInventory={updateCrawlerInventory}
                onUpdateCrawler={updateCrawler}
              />
            )}
            {currentView === "mobs" && <MobsView mobs={mobs} />}
            {currentView === "dungeonai" && (
              <DungeonAIView
                mobs={mobs}
                onUpdateMobs={setMobs}
                maps={maps}
                onUpdateMaps={setMaps}
              />
            )}
          </main>

          {/* Dice Roller */}
          <DiceRoller />

          {/* System footer */}
          <footer className="fixed bottom-0 left-0 right-0 text-center py-2 bg-background/80 border-t border-border text-xs text-muted-foreground">
            [ DUNGEON CRAWLER CARL - SYSTEM HUB v1.0 ]
          </footer>
        </>
      )}
    </div>
  );
};

export default Index;
