import { useState } from 'react';
import { Music, Square } from 'lucide-react';
import { DungeonCard } from '@/components/ui/DungeonCard';
import { DungeonButton } from '@/components/ui/DungeonButton';
import { MUSIC_TRACKS } from '@/lib/musicTracks';
import type { MusicControls } from '@/hooks/useMusic';

interface MusicPanelProps {
  music: MusicControls;
  isDm: boolean;
}

/** Sound Effects tab: the DM picks the campaign's background music; players see what's on. */
const MusicPanel: React.FC<MusicPanelProps> = ({ music, isDm }) => {
  const { nowPlaying, playTrack, stopMusic } = music;
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      console.error('[Music] failed to change track:', err);
      setError("Couldn't change the music. Check you're signed in with Google.");
    }
  };

  const trackButton = (id: string, name: string) => {
    const active = nowPlaying?.id === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => run(() => playTrack(id))}
        aria-pressed={active}
        className={`text-left text-sm px-3 py-2 border transition-colors ${
          active ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-muted/20 hover:bg-primary/5'
        }`}
      >
        {active && <Music className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />}
        {name}
      </button>
    );
  };

  return (
    <DungeonCard className="mb-6">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="font-display text-xl text-primary text-glow-cyan flex items-center gap-2">
          <Music className="w-5 h-5" /> Music
        </h2>
        {isDm && nowPlaying && (
          <DungeonButton variant="default" size="sm" onClick={() => run(stopMusic)}>
            <Square className="w-4 h-4 mr-1" /> Stop music
          </DungeonButton>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {nowPlaying ? <>Now playing: <span className="text-foreground">{nowPlaying.name}</span>. </> : 'No music playing. '}
        {isDm
          ? 'Pick a track and it plays on a loop for everyone in the campaign. Each player sets their own volume at the bottom of the screen.'
          : 'The DM picks the music. Use the music button at the bottom of the screen to change your volume or mute it.'}
      </p>
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}
      {isDm && (
        <>
          <h3 className="font-display text-sm text-accent mb-2">Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
            {MUSIC_TRACKS.filter(t => t.kind === 'setting').map(t => trackButton(t.id, t.name))}
          </div>
          <h3 className="font-display text-sm text-accent mb-2">Themes</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {MUSIC_TRACKS.filter(t => t.kind === 'theme').map(t => trackButton(t.id, t.name))}
          </div>
        </>
      )}
    </DungeonCard>
  );
};

export default MusicPanel;
