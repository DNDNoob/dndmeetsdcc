import * as React from "react";
import { cn } from "@/lib/utils";

interface HealthBarProps {
  current: number;
  max: number;
  label?: string;
  variant?: "health" | "mana" | "xp";
  className?: string;
  /** If provided, shows the modifier portion of the bar in orange */
  baseMax?: number;
}

const HealthBar: React.FC<HealthBarProps> = ({
  current,
  max,
  label,
  variant = "health",
  className,
  baseMax,
}) => {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));

  // Calculate the base portion (without modifier) as a percentage of max
  const hasModifier = baseMax !== undefined && baseMax !== max;
  const basePercentage = hasModifier
    ? Math.min(100, Math.max(0, (Math.min(current, baseMax) / max) * 100))
    : percentage;
  const modifierPercentage = hasModifier ? percentage - basePercentage : 0;

  const variantClasses = {
    health: "bg-destructive",
    mana: "bg-primary",
    xp: "bg-accent",
  };

  return (
    <div className={cn("relative", className)}>
      <div className="h-7 border border-muted-foreground/30 bg-background overflow-hidden flex">
        {/* Base portion */}
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out",
            variantClasses[variant]
          )}
          style={{ width: `${basePercentage}%` }}
        />
        {/* Modifier portion (orange) */}
        {modifierPercentage > 0 && (
          <div
            className="h-full transition-all duration-500 ease-out bg-orange-500"
            style={{ width: `${modifierPercentage}%` }}
          />
        )}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
          {label || `${current}/${max}`}
        </span>
      </div>
    </div>
  );
};

export { HealthBar };
