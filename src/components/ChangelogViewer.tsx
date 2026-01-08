import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Calendar } from "lucide-react";
import changelogData from "../../changelog.json";

interface ChangelogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangelogViewer: React.FC<ChangelogViewerProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-4 md:inset-10 lg:inset-20 bg-background border-2 border-primary z-50 flex flex-col"
          >
            <div className="flex items-center justify-between border-b-2 border-primary p-4 bg-primary/5">
              <h2 className="font-display text-xl text-primary text-glow-cyan flex items-center gap-2">
                <FileText className="w-5 h-5" />
                SYSTEM CHANGELOG
              </h2>
              <button
                onClick={onClose}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6 max-w-3xl">
                {changelogData.map((entry, index) => (
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
                    <ul className="space-y-2">
                      {entry.changes.map((change, changeIndex) => (
                        <li
                          key={changeIndex}
                          className="text-foreground text-sm flex gap-2 items-start"
                        >
                          <span className="text-primary mt-1">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border p-4 text-center text-xs text-muted-foreground">
              [ SHOWING {changelogData.reduce((sum, entry) => sum + entry.changes.length, 0)} TOTAL CHANGES ]
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChangelogViewer;
