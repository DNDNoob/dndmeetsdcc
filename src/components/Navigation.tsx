import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { Home, User, Map, Backpack, Skull, Presentation, Volume2, FileText, Brain, Pin, ChevronDown, BookOpen, ArrowLeft, Menu, X, Wand2 } from "lucide-react";
import { Crawler } from "@/lib/gameData";
import GoogleAuthButton from "./GoogleAuthButton";

interface NavigationProps {
  onNavigate: (view: string) => void;
  onReturnToMenu: () => void;
  onShowChangelog: () => void;
  currentView: string;
  playerName: string;
  playerType: "crawler" | "ai" | "npc";
  autoCollapse?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  crawlers?: Crawler[];
  onSwitchPlayer?: (playerId: string, playerName: string, playerType: "crawler" | "ai" | "npc") => void;
  isAdmin: boolean;
  campaignName?: string;
  onBackToCampaigns?: () => void;
}

const navItems = [
  { id: "profiles", label: "Profiles", icon: User },
  { id: "maps", label: "Maps", icon: Map },
  { id: "inventory", label: "Inventory", icon: Backpack },
  { id: "mobs", label: "Mobs", icon: Skull },
  { id: "spells", label: "Vernon's Library", icon: Wand2 },
];

const Navigation: React.FC<NavigationProps> = ({
  onNavigate,
  onReturnToMenu,
  onShowChangelog,
  currentView,
  playerName,
  playerType,
  autoCollapse = false,
  onVisibilityChange,
  crawlers,
  onSwitchPlayer,
  isAdmin,
  campaignName,
  onBackToCampaigns,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const playerDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const getPlayerColor = () => {
    if (playerType === "ai") return "text-accent text-glow-gold";
    if (playerType === "npc") return "text-muted-foreground";
    return "text-primary text-glow-cyan";
  };

  const shouldCollapse = autoCollapse && !isPinned && !isHovered;

  // Close dropdown on outside click
  useEffect(() => {
    if (!showPlayerDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (playerDropdownRef.current && !playerDropdownRef.current.contains(e.target as Node)) {
        setShowPlayerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPlayerDropdown]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!showMobileMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMobileMenu]);

  // Notify parent of visibility changes
  useEffect(() => {
    onVisibilityChange?.(!shouldCollapse);
  }, [shouldCollapse, onVisibilityChange]);

  // All nav items including extra ones
  const allNavItems = [
    { id: "menu", label: "Main Menu", icon: Home, onClick: onReturnToMenu },
    ...navItems.map(item => ({ ...item, onClick: () => onNavigate(item.id) })),
    { id: "showtime", label: "Show Time", icon: Presentation, onClick: () => onNavigate("showtime") },
    { id: "sounds", label: "Sounds", icon: Volume2, onClick: () => onNavigate("sounds") },
    { id: "wiki", label: "Wiki", icon: BookOpen, onClick: () => onNavigate("wiki") },
    ...(isAdmin ? [{ id: "dungeonai", label: "DM Console", icon: Brain, onClick: () => onNavigate("dungeonai") }] : []),
  ];

  return (
    <>
      {/* Hover trigger zone when collapsed */}
      {autoCollapse && !isPinned && !isHovered && (
        <div
          className="fixed top-0 left-0 h-8 z-[60]"
          style={{ width: '60%' }}
          onMouseEnter={() => setIsHovered(true)}
        />
      )}
      <motion.nav
        initial={{ y: -50, opacity: 0 }}
        animate={{
          y: shouldCollapse ? -100 : 0,
          opacity: shouldCollapse ? 0 : 1
        }}
        transition={{ duration: 0.2 }}
        className="sticky top-0 z-[55] bg-background/95 backdrop-blur border-b-2 border-primary px-4 py-3"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Main navigation"
      >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-0 md:mb-2">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger menu button */}
            <div className="md:hidden" ref={mobileMenuRef}>
              <DungeonButton
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                aria-label={showMobileMenu ? "Close menu" : "Open menu"}
                aria-expanded={showMobileMenu}
              >
                {showMobileMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </DungeonButton>

              {/* Mobile dropdown menu */}
              <AnimatePresence>
                {showMobileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute left-2 right-2 top-full mt-1 bg-background border-2 border-primary shadow-lg shadow-primary/20 z-[70] max-h-[70vh] overflow-y-auto"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    <div className="py-2">
                      {allNavItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            item.onClick();
                            setShowMobileMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-primary/10 transition-colors ${
                            currentView === item.id ? 'text-primary bg-primary/5 font-display' : 'text-foreground'
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                      <div className="border-t border-border my-2" />
                      {onBackToCampaigns && (
                        <button
                          onClick={() => {
                            onBackToCampaigns();
                            setShowMobileMenu(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-primary/10 transition-colors text-foreground"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Back to Campaigns</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          onShowChangelog();
                          setShowMobileMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-primary/10 transition-colors text-foreground"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Changelog</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop-only buttons */}
            {autoCollapse && (
              <DungeonButton
                variant={isPinned ? "admin" : "ghost"}
                size="sm"
                onClick={() => setIsPinned(!isPinned)}
                className="hidden md:flex items-center gap-1"
                title={isPinned ? "Unpin navigation" : "Pin navigation"}
                aria-label={isPinned ? "Unpin navigation" : "Pin navigation"}
              >
                <Pin className={`w-3 h-3 ${isPinned ? '' : 'opacity-50'}`} />
              </DungeonButton>
            )}
            {onBackToCampaigns && (
              <DungeonButton
                variant="ghost"
                size="sm"
                onClick={onBackToCampaigns}
                className="hidden md:flex items-center gap-1"
                title="Back to campaigns"
                aria-label="Back to campaigns"
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="hidden sm:inline text-xs">Campaigns</span>
              </DungeonButton>
            )}
            <DungeonButton
              variant="ghost"
              size="sm"
              onClick={onShowChangelog}
              className="hidden md:flex items-center gap-1"
              aria-label="View changelog"
            >
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline text-xs">Changelog</span>
            </DungeonButton>
            <GoogleAuthButton compact />
            {campaignName && (
              <span className="text-[10px] text-muted-foreground font-display tracking-wider hidden md:inline">
                {campaignName}
              </span>
            )}
          </div>
          <div className="relative" ref={playerDropdownRef}>
            <button
              onClick={() => onSwitchPlayer && setShowPlayerDropdown(!showPlayerDropdown)}
              className={`flex items-center gap-1.5 hover:opacity-80 transition-opacity ${onSwitchPlayer ? 'cursor-pointer' : 'cursor-default'}`}
              aria-label={`Current player: ${playerType === "ai" ? "DUNGEON AI" : playerName}. Click to switch.`}
              aria-expanded={showPlayerDropdown}
            >
              <User className="w-4 h-4 text-muted-foreground" />
              <span className={`text-xs md:text-sm font-display ${getPlayerColor()}`}>
                {playerType === "ai" ? "DUNGEON AI" : playerName}
              </span>
              {onSwitchPlayer && <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showPlayerDropdown ? 'rotate-180' : ''}`} />}
            </button>
            <AnimatePresence>
              {showPlayerDropdown && onSwitchPlayer && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full right-0 mt-1 w-56 bg-background border-2 border-primary shadow-lg shadow-primary/20 z-[70] max-h-64 overflow-y-auto"
                  style={{ scrollbarWidth: 'none' }}
                >
                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] text-muted-foreground font-display">CRAWLERS</div>
                    {(crawlers ?? []).filter(c => c.id !== 'dungeonai').map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onSwitchPlayer(c.id, c.name, 'crawler');
                          setShowPlayerDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                          playerType === 'crawler' && playerName === c.name ? 'text-primary bg-primary/5' : 'text-foreground'
                        }`}
                      >
                        {c.avatar ? (
                          <img src={c.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span>{c.name}</span>
                        <span className="text-muted-foreground ml-auto text-[10px]">Lvl {c.level}</span>
                      </button>
                    ))}
                    {isAdmin && (
                      <>
                        <div className="border-t border-border my-1" />
                        <div className="px-3 py-1 text-[10px] text-muted-foreground font-display">DUNGEON MASTER</div>
                        <button
                          onClick={() => {
                            onSwitchPlayer('dungeonai', 'DUNGEON AI', 'ai');
                            setShowPlayerDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                            playerType === 'ai' ? 'text-accent bg-primary/5' : 'text-foreground'
                          }`}
                        >
                          <Brain className="w-4 h-4 text-accent" />
                          <span>Dungeon AI</span>
                        </button>
                      </>
                    )}
                    <div className="border-t border-border my-1" />
                    <div className="px-3 py-1 text-[10px] text-muted-foreground font-display">SPECTATORS</div>
                    <button
                      onClick={() => {
                        onSwitchPlayer('npc', 'Just a Boring NPC', 'npc');
                        setShowPlayerDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                        playerType === 'npc' ? 'text-muted-foreground bg-primary/5' : 'text-foreground'
                      }`}
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>Just a Boring NPC</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Desktop nav buttons - hidden on mobile */}
        <div className="hidden md:flex flex-wrap items-center justify-center gap-1 sm:gap-2 md:gap-3">
          <DungeonButton
            variant="nav"
            size="sm"
            onClick={onReturnToMenu}
            className={`flex items-center gap-2 ${currentView === "none" ? "border-4" : ""}`}
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Main Menu</span>
          </DungeonButton>

          {navItems.map((item) => (
            <DungeonButton
              key={item.id}
              variant={currentView === item.id ? "default" : "nav"}
              size="sm"
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-2 ${currentView === item.id ? "border-4" : ""}`}
            >
              <item.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </DungeonButton>
          ))}

          <DungeonButton
            variant={currentView === "showtime" ? "default" : "nav"}
            size="sm"
            onClick={() => onNavigate("showtime")}
            className={`flex items-center gap-2 ${currentView === "showtime" ? "border-4" : ""}`}
          >
            <Presentation className="w-4 h-4" />
            <span className="hidden sm:inline">Show Time</span>
          </DungeonButton>

          <DungeonButton
            variant={currentView === "sounds" ? "default" : "nav"}
            size="sm"
            onClick={() => onNavigate("sounds")}
            className={`flex items-center gap-2 ${currentView === "sounds" ? "border-4" : ""}`}
          >
            <Volume2 className="w-4 h-4" />
            <span className="hidden sm:inline">Sounds</span>
          </DungeonButton>

          <DungeonButton
            variant={currentView === "wiki" ? "default" : "nav"}
            size="sm"
            onClick={() => onNavigate("wiki")}
            className={`flex items-center gap-2 ${currentView === "wiki" ? "border-4" : ""}`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Wiki</span>
          </DungeonButton>

          {isAdmin && (
            <DungeonButton
              variant={currentView === "dungeonai" ? "default" : "nav"}
              size="sm"
              onClick={() => onNavigate("dungeonai")}
              className={`flex items-center gap-2 ${currentView === "dungeonai" ? "border-4" : ""}`}
            >
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">DM Console</span>
            </DungeonButton>
          )}
        </div>
      </div>
    </motion.nav>
    </>
  );
};

export default Navigation;
