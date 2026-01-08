import { useState } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Map, X, Eye } from "lucide-react";

interface ShowTimeViewProps {
  maps: string[];
  isAdmin: boolean;
}

const ShowTimeView: React.FC<ShowTimeViewProps> = ({ maps, isAdmin }) => {
  const [selectedMap, setSelectedMap] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background p-4"
    >
      {isAdmin && !selectedMap && (
        <DungeonCard className="max-w-4xl mx-auto">
          <h2 className="font-display text-2xl text-accent text-glow-gold mb-6 flex items-center gap-3">
            <Map className="w-6 h-6" />
            SHOW TIME - SELECT MAP
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {maps.map((map, index) => (
              <div
                key={index}
                className="border border-primary bg-muted/20 p-3 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => setSelectedMap(map)}
              >
                <img
                  src={map}
                  alt={`Map ${index + 1}`}
                  className="w-full h-32 object-cover mb-2"
                />
                <DungeonButton variant="default" size="sm" className="w-full">
                  <Eye className="w-4 h-4 mr-2" />
                  Display Map {index + 1}
                </DungeonButton>
              </div>
            ))}
            {maps.length === 0 && (
              <div className="col-span-2 text-center py-12 text-muted-foreground">
                No maps available. Upload maps in the Map Manager.
              </div>
            )}
          </div>
        </DungeonCard>
      )}

      {selectedMap && (
        <div className="relative w-full h-full flex items-center justify-center">
          {isAdmin && (
            <button
              onClick={() => setSelectedMap(null)}
              className="absolute top-4 right-4 bg-destructive text-destructive-foreground p-2 z-10 hover:bg-destructive/80"
            >
              <X className="w-6 h-6" />
            </button>
          )}
          <img
            src={selectedMap}
            alt="Current Map"
            className="max-w-full max-h-screen object-contain"
          />
        </div>
      )}

      {!isAdmin && !selectedMap && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Map className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg">
              Waiting for the Dungeon Master to display a map...
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ShowTimeView;
