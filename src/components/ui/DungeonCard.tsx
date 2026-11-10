import * as React from "react";
import { cn } from "@/lib/utils";

interface DungeonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: "cyan" | "red" | "gold";
}

const DungeonCard = React.forwardRef<HTMLDivElement, DungeonCardProps>(
  ({ className, glowColor = "cyan", children, ...props }, ref) => {
    // A quiet frame: big page cards no longer glow on hover, so the glow is saved for what needs attention
    const glowClasses = {
      cyan: "border-primary/60",
      red: "border-destructive/70",
      gold: "border-accent/70",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "bg-card/95 border p-6 transition-all duration-300",
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
