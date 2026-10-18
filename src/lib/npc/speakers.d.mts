import type { Mob, MobKind, EpisodeMobPlacement } from '../gameData';

export function getMobKind(mob: Partial<Pick<Mob, 'kind' | 'type'>> | null | undefined): MobKind;
export function isBossMob(mob: Partial<Pick<Mob, 'boss' | 'type'>> | null | undefined): boolean;
export function isPlacementHostile(placement: Pick<EpisodeMobPlacement, 'hostile'> | null | undefined, mob: Partial<Pick<Mob, 'kind' | 'type'>> | null | undefined): boolean;
export function baseMobId(speakerId: string): string;

export interface NpcSpeaker {
  id: string;
  name: string;
  mob: Mob;
  placement: EpisodeMobPlacement;
}

export function mapSpeakers(placements: EpisodeMobPlacement[], mobs: Mob[], allPlacements?: EpisodeMobPlacement[]): NpcSpeaker[];
