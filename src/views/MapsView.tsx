import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { MapPin, Layers } from "lucide-react";

const MapsView: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      <DungeonCard>
        <h2 className="font-display text-2xl text-primary text-glow-cyan mb-6 flex items-center gap-3">
          <MapPin className="w-6 h-6" />
          WORLD MAPS
        </h2>

        <div className="space-y-6">
          {/* Floor 1 Map placeholder */}
          <div className="border border-dashed border-primary/50 bg-background/50 p-8 text-center">
            <Layers className="w-12 h-12 text-primary/50 mx-auto mb-4" />
            <h3 className="font-display text-lg text-primary mb-2">FLOOR 1 - THE DESCENT</h3>
            <p className="text-muted-foreground text-sm mb-4">
              [ Upload map image to display here ]
            </p>
            <p className="text-xs text-muted-foreground/60">
              Tip: You can add custom map images in the code
            </p>
          </div>

          {/* Overworld Map placeholder */}
          <div className="border border-dashed border-primary/50 bg-background/50 p-8 text-center">
            <MapPin className="w-12 h-12 text-primary/50 mx-auto mb-4" />
            <h3 className="font-display text-lg text-primary mb-2">TOPEKA OVERWORLD</h3>
            <p className="text-muted-foreground text-sm mb-4">
              [ Upload overworld map to display here ]
            </p>
            <p className="text-xs text-muted-foreground/60">
              Current Location: Unknown
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 border-t border-border pt-6">
          <h4 className="text-sm text-muted-foreground mb-3">MAP LEGEND</h4>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full" />
              <span>Safe Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-destructive rounded-full" />
              <span>Danger Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-accent rounded-full" />
              <span>Loot Room</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted-foreground rounded-full" />
              <span>Unexplored</span>
            </div>
          </div>
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default MapsView;
