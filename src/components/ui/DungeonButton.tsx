import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const dungeonButtonVariants = cva(
  "inline-flex items-center justify-center font-display uppercase font-bold transition-all duration-300 cursor-pointer disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary border-2 border-primary hover:bg-primary hover:text-primary-foreground hover:glow-cyan",
        menu:
          "bg-primary/10 text-primary border-2 border-primary p-8 text-lg hover:bg-primary hover:text-primary-foreground hover:glow-cyan",
        nav:
          "bg-transparent text-primary border border-primary px-4 py-2 text-sm hover:bg-primary/20",
        admin:
          "bg-accent text-accent-foreground border-none hover:bg-accent/80 hover:glow-gold",
        danger:
          "bg-destructive/20 text-destructive border-2 border-destructive hover:bg-destructive hover:text-destructive-foreground hover:glow-red",
        ghost:
          "bg-transparent text-muted-foreground hover:text-primary hover:bg-primary/10",
      },
      size: {
        default: "px-6 py-3",
        sm: "px-3 py-1.5 text-xs",
        lg: "px-8 py-4 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface DungeonButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof dungeonButtonVariants> {}

const DungeonButton = React.forwardRef<HTMLButtonElement, DungeonButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(dungeonButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
DungeonButton.displayName = "DungeonButton";

export { DungeonButton, dungeonButtonVariants };
