import { motion } from "framer-motion";
import { Award, BarChart3, Coins, Crosshair, Crown, Dices, Footprints, Heart, HeartCrack, HeartPulse, ShieldAlert, Skull, Store, Swords, Wand } from "lucide-react";
import {
  ABILITY_KEYS,
  CRAWLER_STAT_KEYS,
  CRAWLER_STAT_LABELS,
  getCrawlerStatValue,
  getLootingLevel,
  getLootsUntilNextLevel,
  type Crawler,
  type CrawlerStatKey,
  type CrawlerStats,
  type CrawlerStatsById,
  type SourceStats,
} from "@/lib/gameData";

const CRAWLER_STAT_ICONS: Record<CrawlerStatKey, React.FC<{ className?: string }>> = {
  damageDealt: Swords,
  killingBlows: Skull,
  combatEndingBlows: Crown,
  bossKills: Award,
  healingDone: HeartPulse,
  damageTaken: Heart,
  lowHealthCount: HeartCrack,
  feetMoved: Footprints,
  mobsLooted: Coins,
  spellCasts: Wand,
  barterTrades: Store,
  nat20s: Dices,
  friendlyFire: Crosshair,
  neutralDamage: ShieldAlert,
};

export const CrawlerStatTile: React.FC<{ statKey: CrawlerStatKey; value: number; note?: string }> = ({ statKey, value, note }) => {
  const Icon = CRAWLER_STAT_ICONS[statKey];
  return (
    <div className="bg-muted/50 px-3 py-2 rounded">
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        <Icon className="w-3.5 h-3.5 shrink-0" /> {CRAWLER_STAT_LABELS[statKey]}
      </div>
      <div className="text-foreground font-bold text-lg">{value.toLocaleString()}</div>
      {note && <div className="text-xs text-accent">{note}</div>}
    </div>
  );
};

const SmallStat: React.FC<{ label: string; value: string | number; title?: string }> = ({ label, value, title }) => (
  <div className="bg-muted/30 px-3 py-2 rounded" title={title}>
    <div className="text-muted-foreground text-xs">{label}</div>
    <div className="text-foreground font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="font-display text-primary text-sm mt-6 mb-2">{children}</h4>
);

interface CrawlerStatsPanelProps {
  crawler: Crawler;
  party: Crawler[];
  statsById: CrawlerStatsById;
}

/** The profile's Stats tab: every counter the game keeps for a crawler. */
export const CrawlerStatsPanel: React.FC<CrawlerStatsPanelProps> = ({ crawler, party, statsById }) => {
  const stats: CrawlerStats = statsById[crawler.id] ?? { id: crawler.id };
  const everyone = party.length > 0 ? party : [crawler];
  const partyRank = (key: CrawlerStatKey): string | undefined => {
    const value = getCrawlerStatValue(crawler, key, stats);
    if (value <= 0 || everyone.length < 2) return undefined;
    const rank = 1 + everyone.filter(c => getCrawlerStatValue(c, key, statsById[c.id]) > value).length;
    return rank === 1 ? 'Top of the party' : `#${rank} in the party`;
  };

  const mobsLooted = crawler.activityStats?.mobsLooted ?? 0;
  const lootingLevel = getLootingLevel(mobsLooted);
  const lootsToNext = getLootsUntilNextLevel(mobsLooted);

  // Weapons and spells, busiest first. Spell casts live on the known spell.
  const castsOf = (spellId: string) => crawler.knownSpells?.find(k => k.spellId === spellId)?.castCount ?? 0;
  const gear = [
    ...Object.entries(stats.items ?? {}).map(([id, s]) => ({ id, kind: 'item' as const, s, uses: s.uses ?? 0 })),
    ...Object.entries(stats.spells ?? {}).map(([id, s]) => ({ id, kind: 'spell' as const, s, uses: castsOf(id) })),
  ].sort((a, b) => ((b.s.damage ?? 0) + (b.s.healing ?? 0)) - ((a.s.damage ?? 0) + (a.s.healing ?? 0)) || b.uses - a.uses);

  const topVictims = Object.entries(stats.killsByMob ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const damageTypes = Object.entries(stats.damageByType ?? {}).sort((a, b) => b[1] - a[1]);
  const d20Rolls = stats.d20Rolls ?? 0;
  const averageD20 = d20Rolls > 0 ? ((stats.d20Total ?? 0) / d20Rolls).toFixed(1) : '–';
  const abilityRolls = ABILITY_KEYS.map(k => [k, stats.rollsByAbility?.[k] ?? 0] as const);
  const checks = (stats.checksPassed ?? 0) + (stats.checksFailed ?? 0);

  const gearLine = (s: SourceStats, kind: 'item' | 'spell', uses: number): string => {
    const parts = [
      uses ? `${uses} ${kind === 'spell' ? 'casts' : 'attacks'}` : '',
      s.hits ? `${s.hits} hits` : '',
      s.damage ? `${s.damage} dmg` : '',
      s.kills ? `${s.kills} kills` : '',
      s.bossKills ? `${s.bossKills} boss` : '',
      s.biggestHit ? `best hit ${s.biggestHit}` : '',
      s.healing ? `${s.healing} healed` : '',
      s.conditions ? `${s.conditions} effects` : '',
      s.friendlyFire ? `${s.friendlyFire} friendly fire` : '',
      s.neutralDamage ? `${s.neutralDamage} to neutrals` : '',
      s.neutralKills ? `${s.neutralKills} neutral kills` : '',
    ];
    return parts.filter(Boolean).join(' · ');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="font-display text-primary text-xl mb-1 flex items-center gap-2">
        <BarChart3 className="w-6 h-6 shrink-0" /> ACTIVITY STATS
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Everything the game counts for {crawler.name}. The profile shows the 5 that stand out most compared with the party.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CRAWLER_STAT_KEYS.map(key => (
          <CrawlerStatTile key={key} statKey={key} value={getCrawlerStatValue(crawler, key, stats)} note={partyRank(key)} />
        ))}
      </div>
      <div className="mt-3 bg-accent/10 border border-accent/30 rounded px-3 py-2 text-sm" title="Each Looting level makes loot a tenth less likely to be smashed">
        <span className="font-display text-accent">Looting Lv {lootingLevel}</span>
        <span className="text-muted-foreground">
          {lootingLevel > 0 ? ` · loot smashed ${lootingLevel * 10}% less often` : ' · loot is smashed at the normal rate'}
          {lootsToNext !== null ? ` · ${lootsToNext} more mob${lootsToNext === 1 ? '' : 's'} to Lv ${lootingLevel + 1}` : ' · max level, loot is never smashed'}
        </span>
      </div>

      <SectionTitle>WEAPONS AND SPELLS</SectionTitle>
      {gear.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet. Attacks, hits and kills with each weapon and spell show here.</p>
      ) : (
        <div className="space-y-2">
          {gear.map(({ id, kind, s, uses }) => (
            <div key={`${kind}-${id}`} className="bg-muted/30 rounded px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {kind === 'spell' ? <Wand className="w-3.5 h-3.5 text-primary shrink-0" /> : <Swords className="w-3.5 h-3.5 text-accent shrink-0" />}
                <span className="font-display text-foreground break-words">{s.name ?? id}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{gearLine(s, kind, uses) || 'Not used yet'}</p>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>COMBAT</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <SmallStat label="Healing received" value={stats.healingReceived ?? 0} />
        <SmallStat label="Neutral kills" value={stats.neutralKills ?? 0} title="Mobs that weren't hostile, NPCs included" />
        <SmallStat label="Top damage type" value={damageTypes[0] ? `${damageTypes[0][0]} (${damageTypes[0][1]})` : '–'} />
      </div>
      {topVictims.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Most killed: {topVictims.map(([name, n]) => `${name} ×${n}`).join(', ')}
        </p>
      )}

      <SectionTitle>DICE</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <SmallStat label="d20 rolls" value={d20Rolls} />
        <SmallStat label="Average d20" value={averageD20} title="10.5 is average luck" />
        <SmallStat label="Natural 1s" value={stats.nat1s ?? 0} />
        <SmallStat label="With disadvantage" value={stats.disadvantageRolls ?? 0} />
        <SmallStat label="Checks passed" value={checks > 0 ? `${stats.checksPassed ?? 0} of ${checks}` : '–'} />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Rolls by ability: {abilityRolls.map(([k, n]) => `${k.toUpperCase()} ${n}`).join(' · ')}
      </p>
    </motion.div>
  );
};
