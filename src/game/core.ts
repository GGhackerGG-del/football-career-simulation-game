import raw from '../data/db.json';
import type { DBPlayer, Player, Team, Attrs, Pos, Fixture } from './types';

export const DB = raw as unknown as { players: DBPlayer[]; t1: string[]; t2: string[] };

// ---------- seeded RNG ----------
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rr = (r: () => number, a: number, b: number) => a + r() * (b - a);
export const ri = (r: () => number, a: number, b: number) => Math.floor(rr(r, a, b + 1));
export const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];
export const fmtM = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(v % 1e6 ? 1 : 0)}M` : `$${Math.round(v / 1e3)}K`;

// ---------- team meta ----------
const TEAM_COLORS: Record<string, [string, string, string]> = {
  'Real Madrid C.F': ['#f5f5f0', '#5c2d91', 'РМС'],
  'Tottenham Hotspur': ['#f8f8f8', '#132257', 'ТОТ'],
  'Juventus F.C': ['#ffffff', '#1a1a1a', 'ЮВЕ'],
  'Inter Milan': ['#1b3f94', '#101010', 'ИНТ'],
  'Atletico Madrid': ['#d42b2b', '#f2f2f2', 'АТЛ'],
  'Manchester City': ['#79c1e8', '#1c2c5b', 'МСИ'],
  'Bloxalona United': ['#a31d45', '#16418e', 'БЛО'],
  'Leon FC': ['#0e7a3d', '#f2f2f2', 'ЛЕО'],
  'Momoyama Predators': ['#e8a812', '#2b2b2b', 'МОМ'],
  'Spartans United': ['#b8202e', '#1c1c1c', 'СПА'],
  'Majesty United': ['#6d2bb8', '#e8c832', 'МАД'],
  'Petropolis Lions': ['#e86a12', '#31318f', 'ПЕТ'],
};
export function teamColor(name: string): [string, string, string] {
  return TEAM_COLORS[name] || ['#3a9e4f', '#12381f', name.slice(0, 3).toUpperCase()];
}

// ---------- player generation ----------
export const rankOf = (rt: number): Player['rank'] => rt >= 88 ? 'X' : rt >= 84 ? 'A' : rt >= 79 ? 'B' : rt >= 70 ? 'C' : 'D';

export function genAttrs(r: () => number, rating: number, pos: Pos): Attrs {
  const j = () => Math.round(rr(r, -7, 7));
  const a: Attrs = {
    pac: rating + j(), sho: rating + j(), pas: rating + j(),
    dri: rating + j(), def: Math.max(30, rating - 18 + j()), phy: rating + j(), gk: rating + j(),
  };
  if (pos === 'ST') { a.sho += 4; a.phy += 2; a.def -= 8; }
  if (pos === 'W') { a.pac += 5; a.dri += 3; a.sho += 2; a.def -= 8; }
  if (pos === 'CAM') { a.pas += 5; a.dri += 2; a.sho += 1; a.def -= 6; }
  const cl = (x: number) => Math.max(28, Math.min(99, Math.round(x)));
  return { pac: cl(a.pac), sho: cl(a.sho), pas: cl(a.pas), dri: cl(a.dri), def: cl(a.def), phy: cl(a.phy), gk: cl(a.gk) };
}
export function ratingFromAttrs(a: Attrs, pos: Pos): number {
  const w = pos === 'ST' ? { sho: .32, dri: .2, pac: .16, pas: .12, phy: .2 } :
    pos === 'W' ? { pac: .28, dri: .26, sho: .18, pas: .16, phy: .12 } :
    { pas: .3, dri: .24, sho: .18, pac: .14, phy: .14 };
  return Math.round(a.pac * (w as any).pac + a.sho * (w as any).sho + a.pas * (w as any).pas + a.dri * (w as any).dri + a.phy * (w as any).phy);
}

export function dbToPlayer(d: DBPlayer, teamId: string | null, seedSalt = 0): Player {
  const r = mulberry(hash(d.n) + seedSalt);
  const pos: Pos = (() => {
    if (d.ro === 'Manager' || d.ro === 'Assistant') return 'CAM';
    const p = r(); return p < 0.42 ? 'ST' : p < 0.74 ? 'W' : 'CAM';
  })();
  return {
    id: 'db:' + d.n.toLowerCase(),
    name: d.n,
    age: ri(r, 18, 33),
    rating: d.rt, rank: rankOf(d.rt), value: d.v, teamId,
    attrs: genAttrs(r, d.rt, pos),
    pos,
    apps: 0, goals: 0, assists: 0, motm: 0, ratingSum: 0,
    history: [], morale: ri(r, 60, 90), energy: 100,
  };
}

// ---------- build world ----------
export interface World {
  teams: Team[];
  players: Player[];   // league players (both tiers)
  free: Player[];      // free agents pool
  fixtures: Fixture[]; // for both tiers (md 1-10)
}

export function circleFixtures(teamIds: string[]): Fixture[] {
  // round-robin, double (10 rounds for 6 teams)
  const t = [...teamIds]; const n = t.length; const f: Fixture[] = [];
  const half = n / 2;
  let round = 0;
  const arr = [...t];
  for (let k = 0; k < (n - 1); k++) {
    round++;
    for (let i = 0; i < half; i++) {
      const home = arr[i], away = arr[n - 1 - i];
      f.push({ md: round, home, away, played: false });
    }
    // rotate (keep first fixed)
    arr.splice(1, 0, arr.pop()!);
  }
  // mirror for second half
  const base = f.map(x => ({ ...x }));
  base.forEach(x => f.push({ md: x.md + 5, home: x.away, away: x.home, played: false }));
  return f.sort((a, b) => a.md - b.md);
}

export function buildWorld(): World {
  const t1names = DB.t1, t2names = DB.t2;
  const teams: Team[] = [];
  const mkTeam = (name: string, tier: 1 | 2): Team => {
    const [c1, c2, short] = teamColor(name);
    return { id: name, name, short, tier, color: c1, color2: c2, gk: 78, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  };
  t1names.forEach(n => teams.push(mkTeam(n, 1)));
  t2names.forEach(n => teams.push(mkTeam(n, 2)));

  const players: Player[] = [];
  const placed = new Set<string>();
  // tier1 from S22 hub teams
  for (const d of DB.players) {
    if (t1names.includes(d.tm)) { players.push(dbToPlayer(d, d.tm)); placed.add(d.n.toLowerCase()); }
  }
  // tier2 fill: pick DB players NOT in t1 squads with rating <= 80, seeded deterministic
  const pool = DB.players.filter(p => !placed.has(p.n.toLowerCase()) && p.rt <= 79 && p.rt >= 58);
  const targets: Record<string, number> = {};
  t2names.forEach(t => targets[t] = 11);
  // seed with known t2 names from allstats s23 (tm='' though) -> just distribute pool
  let ti = 0;
  const shuffled = [...pool].sort((a, b) => (hash(a.n) % 97) - (hash(b.n) % 97));
  for (const p of shuffled) {
    const t = t2names[ti % t2names.length];
    if (targets[t] <= 0) { ti++; if (ti >= t2names.length) break; continue; }
    players.push(dbToPlayer(p, t, 7)); placed.add(p.n.toLowerCase());
    targets[t]--; ti++;
  }
  // free agents: strong leftovers (rating >= 76 not placed), cap 60
  const free = DB.players
    .filter(p => !placed.has(p.n.toLowerCase()) && p.rt >= 74)
    .sort((a, b) => b.rt - a.rt).slice(0, 60)
    .map(p => dbToPlayer(p, null, 3));

  // team gk: best gk-ish rating member +2
  for (const t of teams) {
    const squad = players.filter(p => p.teamId === t.id);
    if (squad.length) t.gk = Math.max(...squad.map(s => Math.max(s.attrs.gk, s.rating - 6)));
    else t.gk = t.tier === 1 ? 80 : 68;
  }

  const fixtures = [...circleFixtures(t1names), ...circleFixtures(t2names)];
  return { teams, players, free, fixtures };
}

export const teamStrength = (world: World, teamId: string): number => {
  const squad = world.players.filter(p => p.teamId === teamId).sort((a, b) => b.rating - a.rating);
  const top = squad.slice(0, 8);
  if (!top.length) return 60;
  return top.reduce((s, p) => s + p.rating, 0) / top.length;
};
export const bestGk = (world: World, teamId: string): number => {
  const squad = world.players.filter(p => p.teamId === teamId);
  if (!squad.length) return 65;
  return Math.max(...squad.map(s => Math.max(s.attrs.gk, s.rating - 5)));
};
export const bestDef = (world: World, teamId: string): number => {
  const squad = world.players.filter(p => p.teamId === teamId);
  if (!squad.length) return 65;
  const ds = squad.map(s => s.attrs.def).sort((a, b) => b - a);
  return (ds[0] + (ds[1] ?? ds[0])) / 2;
};
