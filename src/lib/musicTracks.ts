import type { MusicTrack } from '@/lib/gameData';

// Every track is a 156 s seamless loop made with ACE-Step (see scripts/upload-music.py)
const LOOP_SECONDS = 156;

const setting = (id: string, name: string): MusicTrack => ({ id, name, kind: 'setting', durationSec: LOOP_SECONDS });
const theme = (id: string, name: string): MusicTrack => ({ id, name, kind: 'theme', durationSec: LOOP_SECONDS });

export const MUSIC_TRACKS: MusicTrack[] = [
  setting('dungeon-corridor', 'Dungeon corridor'),
  setting('combat', 'Combat'),
  setting('boss-fight', 'Boss fight'),
  setting('safe-room', 'Safe room'),
  setting('tavern-or-club', 'Tavern or club'),
  setting('town-or-market', 'Town or market'),
  setting('forest-at-dusk', 'Forest at dusk'),
  setting('crypt-or-haunted-area', 'Crypt or haunted area'),
  setting('deep-cavern-or-water-level', 'Deep cavern or water level'),
  setting('show-time-stage', 'Show Time stage'),
  theme('royal-encounter', 'Royal encounter'),
  theme('desert-streets', 'Desert streets'),
  theme('safe-room-alternate', 'Safe room (alternate)'),
  theme('grassy-meadows', 'Grassy meadows'),
  theme('home-screen-intro', 'Home screen intro'),
  theme('temple', 'Temple'),
  theme('island', 'Island'),
  theme('farm', 'Farm'),
  theme('forest', 'Forest'),
  theme('eerie-desert', 'Eerie desert'),
  theme('haunted-temple', 'Haunted temple'),
  theme('combat-original', 'Combat (original)'),
];

export const musicTrackUrl = (id: string) => `${import.meta.env.BASE_URL}music/${id}.mp3`;
