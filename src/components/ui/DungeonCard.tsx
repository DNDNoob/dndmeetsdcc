import * as React from "react";
import { cn } from "@/lib/utils";

interface DungeonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: "cyan" | "red" | "gold";
}

const DungeonCard = React.forwardRef<HTMLDivElement, DungeonCardProps>(
  ({ className, glowColor = "cyan", children, ...props }, ref) => {
    const glowClasses = {
      cyan: "border-primary hover:glow-cyan",
      red: "border-destructive hover:glow-red",
      gold: "border-accent hover:glow-gold",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "bg-card/95 border-2 p-6 transition-all duration-300",
          glowClasses[glowColor],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DungeonCard.displayName = "DungeonCard";

export { DungeonCard };
