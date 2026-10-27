import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Calendar, Sparkles, Bug } from "lucide-react";
import { useLocation } from "react-router-dom";
import changelogData from "../../changelog.json";

interface ChangelogEntry {
  date: string;
  features?: string[];
  fixes?: string[];
  // Older format: one ungrouped list
  changes?: string[];
}

const changelog = changelogData as ChangelogEntry[];

const countChanges = (entry: ChangelogEntry) =>
  (entry.features?.length ?? 0) + (entry.fixes?.length ?? 0) + (entry.changes?.length ?? 0);

const ChangeList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-2">
    {items.map((change, changeIndex) => (
      <li
        key={changeIndex}
        className="text-foreground text-sm flex gap-2 items-start"
      >
        <span className="text-primary mt-1">•</span>
        <span>{change}</span>
      </li>
    ))}
  </ul>
);

interface ChangelogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangelogViewer: React.FC<ChangelogViewerProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on route change
  useEffect(() => {
    if (isOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 z-[80]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-4 md:inset-10 lg:inset-20 bg-background border-2 border-primary z-[80] flex flex-col"
          >
            <div className="flex items-center justify-between border-b-2 border-primary p-4 bg-primary/5">
              <h2 className="font-display text-xl text-primary text-glow-cyan flex items-center gap-2">
                <FileText className="w-5 h-5" />
                SYSTEM CHANGELOG
              </h2>
              <button
                onClick={onClose}
                className="text-primary hover:text-primary/80 transition-colors p-1"
                aria-label="Close changelog"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <style>{`.changelog-scroll { scrollbar-width: none; -ms-overflow-style: none; } .changelog-scroll::-webkit-scrollbar { display: none; }`}</style>
            <div
              className="flex-1 overflow-y-auto p-6 changelog-scroll"
              ref={(el) => {
                if (el && !(el as HTMLElement & { _wheelAttached?: boolean })._wheelAttached) {
                  (el as HTMLElement & { _wheelAttached?: boolean })._wheelAttached = true;
                  el.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: false });
                }
              }}
            >
              <div className="space-y-6 max-w-3xl">
                {changelog.map((entry, index) => (
                  <div key={index} className="border-l-2 border-primary pl-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-accent" />
                      <span className="font-display text-accent text-glow-gold">
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {entry.features && entry.features.length > 0 && (
                        <div>
                          <h3 className="font-display text-xs text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            New features
                          </h3>
                          <ChangeList items={entry.features} />
                        </div>
                      )}
                      {entry.fixes && entry.fixes.length > 0 && (
                        <div>
                          <h3 className="font-display text-xs text-destructive uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Bug className="w-3.5 h-3.5" />
                            Bug fixes
                          </h3>
                          <ChangeList items={entry.fixes} />
                        </div>
                      )}
                      {entry.changes && entry.changes.length > 0 && <ChangeList items={entry.changes} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border p-4 text-center text-xs text-muted-foreground">
              [ SHOWING {changelog.reduce((sum, entry) => sum + countChanges(entry), 0)} TOTAL CHANGES ]
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChangelogViewer;
