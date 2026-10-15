import { useState } from "react";
import { Globe, Lock, Loader2 } from "lucide-react";
import { DungeonButton } from "@/components/ui/DungeonButton";

interface ShareToggleProps {
  isPublic: boolean;
  onToggle: (isPublic: boolean) => Promise<void> | void;
  className?: string;
}

/** Public/Private toggle for sharing content with the community. Disabled while saving. */
export const ShareToggle: React.FC<ShareToggleProps> = ({ isPublic, onToggle, className }) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await onToggle(!isPublic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DungeonButton
      variant={isPublic ? "default" : "ghost"}
      size="sm"
      onClick={handleClick}
      disabled={busy}
      className={className}
      title={isPublic ? "Shared with the community. Click to make private." : "Private. Click to share with the community."}
    >
      {busy ? (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      ) : isPublic ? (
        <Globe className="w-3 h-3 mr-1" />
      ) : (
        <Lock className="w-3 h-3 mr-1" />
      )}
      {isPublic ? "Public" : "Private"}
    </DungeonButton>
  );
};

interface ImportButtonProps {
  onImport: () => Promise<void> | void;
  label?: string;
}

/** "Add to campaign" button for community content. Disabled while importing. */
export const ImportButton: React.FC<ImportButtonProps> = ({ onImport, label = "Add to Campaign" }) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await onImport();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DungeonButton variant="admin" size="sm" onClick={handleClick} disabled={busy}>
      {busy && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
      {busy ? "Adding..." : label}
    </DungeonButton>
  );
};
