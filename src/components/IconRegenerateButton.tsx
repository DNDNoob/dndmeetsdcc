import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import PixelIcon from '@/components/ui/PixelIcon';
import { DungeonButton } from '@/components/ui/DungeonButton';

interface IconRegenerateButtonProps {
  /** Current icon image, if any. */
  iconSrc?: string;
  alt: string;
  /** Generates a new icon from the current form values; resolves to null when it can't. */
  onRegenerate: () => Promise<{ id: string; image: string } | null>;
  /** Called with the new icon's id; the form saves it with the rest of its changes. */
  onIconChange: (iconId: string) => void;
}

/** Icon preview with a button that makes a fresh pixel icon for an item or spell being edited. */
const IconRegenerateButton: React.FC<IconRegenerateButtonProps> = ({ iconSrc, alt, onRegenerate, onIconChange }) => {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | undefined>();

  const handleClick = async () => {
    setBusy(true);
    try {
      const entry = await onRegenerate();
      if (!entry) {
        toast.error("Couldn't make a new icon right now. Try again later.");
        return;
      }
      setPreview(entry.image);
      onIconChange(entry.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <PixelIcon src={preview ?? iconSrc} alt={alt} className="w-10 h-10" fallback={<div className="w-10 h-10 border border-dashed border-border" />} />
      <DungeonButton type="button" variant="ghost" size="sm" onClick={handleClick} disabled={busy} className="text-xs flex items-center gap-1">
        <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Painting icon...' : iconSrc || preview ? 'Regenerate icon' : 'Generate icon'}
      </DungeonButton>
    </div>
  );
};

export default IconRegenerateButton;
