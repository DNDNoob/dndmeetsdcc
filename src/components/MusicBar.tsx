import { Music, Volume2, VolumeX } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import type { MusicControls } from '@/hooks/useMusic';

interface MusicBarProps {
  music: MusicControls;
}

/** Footer control for the campaign music: what's playing, plus this player's own volume and mute. */
const MusicBar: React.FC<MusicBarProps> = ({ music }) => {
  const { nowPlaying, volume, setVolume, muted, setMuted, needsTap, turnOn } = music;
  if (!nowPlaying) return null;

  if (needsTap) {
    return (
      <button
        type="button"
        onClick={turnOn}
        className="flex items-center gap-1.5 px-2 py-0.5 border border-primary text-primary animate-pulse hover:bg-primary/10"
      >
        <Music className="w-3.5 h-3.5" /> Tap to turn on music
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-2 py-0.5 text-primary hover:bg-primary/10 max-w-[60vw]"
          aria-label={`Music: ${nowPlaying.name}. Change volume`}
        >
          {muted ? <VolumeX className="w-3.5 h-3.5 shrink-0" /> : <Music className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">{nowPlaying.name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 z-[120]">
        <p className="font-display text-sm text-primary mb-1">Music</p>
        <p className="text-xs text-muted-foreground mb-3">Now playing: {nowPlaying.name}. Volume is just for you.</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="text-muted-foreground hover:text-primary"
            aria-label={muted ? 'Unmute music' : 'Mute music'}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <Slider
            value={[Math.round(volume * 100)]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => { setVolume(v / 100); if (muted && v > 0) setMuted(false); }}
            aria-label="Music volume"
          />
          <span className="text-xs w-8 text-right tabular-nums">{muted ? 0 : Math.round(volume * 100)}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MusicBar;
