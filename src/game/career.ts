import type { World } from './core';
import { teamStrength, bestGk, bestDef, ri, rr, pick, rankOf } from './core';
import type { Player, Hero, KeyMoment, MomentKind } from './types';

export const SEASON_NAME = (n: number) => `S${23 + n}`;

// ---------- growth / aging ----------
export function ageDelta(age: number): number {
  if (age <= 21) return 3; if (age <= 24) return 2; if (age <= 27) return 1;
  if (age <= 30) return 0; if (age <= 32) return -2; if (age <= 34) return -3;
  return -4;
}
export function effectiveRating(p: Player | Hero): number {
  const fatigue = (100 - p.energy) * 0.06;      // up to -6
  const morale = (p.morale - 65) * 0.04;        // -2.6..+1.4
  return Math.max(40, p.rating - fatigue + morale);
}

// ---------- quick sim of one match between teams ----------
export function simScore(r: () => number, attStr: number, defStr: number, heroBoost = 0): number {
  const diff = attStr - defStr + heroBoost;
  let xg = 1.35 + diff * 0.055;
  xg = Math.max(0.15, Math.min(4.5, xg));
  let g = 0;
  for (let i = 0; i < 12; i++) if (r() < xg / 12) g++;
  if (r() < xg * 0.12) g++;
  return g;
}

export interface AiMatchSim {
  hs: number; as: number;
  scorers: { id: string; g: number; a: number }[];
}

export function simAiMatch(r: () => number, world: World, home: string, away: string): AiMatchSim {
  const hs = simScore(r, teamStrength(world, home), bestDef(world, away) * 0.4 + bestGk(world, away) * 0.5) ;
  const as = simScore(r, teamStrength(world, away), bestDef(world, home) * 0.4 + bestGk(world, home) * 0.5);
  const scorers: { id: string; g: number; a: number }[] = [];
  const dist = (teamId: string, goals: number) => {
    const squad = world.players.filter(p => p.teamId === teamId);
    if (!squad.length || goals === 0) return;
    const w = squad.map(p => Math.max(0.1, (p.rating - 55) * (p.pos === 'ST' ? 1.6 : p.pos === 'W' ? 1.25 : 1)));
    const tot = w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < goals; i++) {
      let x = r() * tot, idx = 0;
      while (x > w[idx]) { x -= w[idx]; idx++; }
      const p = squad[idx];
      let rec = scorers.find(s => s.id === p.id);
      if (!rec) { rec = { id: p.id, g: 0, a: 0 }; scorers.push(rec); }
      if (r() < 0.72) rec.g++; else rec.a++;
      p.ratingSum += rr(r, 6.2, 8.6); p.apps++;
    }
  };
  dist(home, hs + Math.min(3, hs)); // goals+assists opportunities
  dist(away, as + Math.min(3, as));
  return { hs, as, scorers };
}

// ---------- hero match plan: generate scripted key moments ----------
export function planHeroMatch(r: () => number, world: World, heroTeam: string, oppTeam: string, hero: Hero): {
  moments: KeyMoment[]; oppGoalsPlan: number; teamGoalsBase: number;
} {
  const oppDef = bestDef(world, oppTeam);
  const oppGk = bestGk(world, oppTeam);
  const myStr = teamStrength(world, heroTeam);
  const eff = effectiveRating(hero);
  const involvement = (eff - 60) / 40; // 0..1
  const nMoments = Math.max(1, Math.round(rr(r, 1.5, 3.2) + involvement * 2.2));
  const moments: KeyMoment[] = [];
  const usedMin = new Set<number>();
  for (let i = 0; i < nMoments; i++) {
    let minute = ri(r, 6, 88);
    while (usedMin.has(minute)) minute = ri(r, 6, 88);
    usedMin.add(minute);
    const kindRoll = r();
    let kind: MomentKind = 'shot';
    if (kindRoll < 0.07) kind = 'penalty';
    else if (kindRoll < 0.2) kind = 'freekick';
    else if (kindRoll < 0.36) kind = 'corner';
    const distance = kind === 'penalty' ? 11 : kind === 'freekick' ? ri(r, 17, 30) : kind === 'corner' ? ri(r, 6, 12) : ri(r, 9, 32);
    moments.push({ kind, minute, distance, oppDef, oppGk });
  }
  moments.sort((a, b) => a.minute - b.minute);
  // team baseline goals (excluding hero moments)
  const teamGoalsBase = simScore(r, myStr, bestDef(world, oppTeam) * 0.4 + oppGk * 0.5, (eff - 70) * 0.05) - Math.round(nMoments * 0.4);
  const oppGoalsPlan = simScore(r, teamStrength(world, oppTeam), bestDef(world, heroTeam) * 0.4 + bestGk(world, heroTeam) * 0.5);
  return { moments, oppGoalsPlan: Math.max(0, oppGoalsPlan), teamGoalsBase: Math.max(0, teamGoalsBase), };
}

// ---------- resolve a shot attempt (shared live & skip) ----------
export interface ShotInput {
  kind: MomentKind;
  distance: number;
  aimX: number;  // 0..1 across goal mouth (0 left)
  aimY: number;  // 0..1 height (0 bottom)
  power: number; // 0..1
  shotType: 'normal' | 'curl' | 'knuckle' | 'chip';
  curlDir?: -1 | 1;
  headerTiming?: number; // 0..1 for corners
  youRating: number; oppDef: number; oppGk: number;
  rng: () => number;
}
export type ShotOutcome = 'goal' | 'save' | 'block' | 'post' | 'miss';
export function resolveShot(i: ShotInput): { outcome: ShotOutcome } {
  const r = i.rng;
  const diffDef = i.youRating - i.oppDef;   // -30..+30
  const diffGk = i.youRating - i.oppGk;
  // ---- basics by kind ----
  const distFactor = i.kind === 'penalty' ? 0 : (i.kind === 'corner' ? (i.distance - 9) : (i.distance - 18)) * 0.012;
  let baseGoal = i.kind === 'penalty' ? 0.78 : i.kind === 'corner' ? 0.35 : i.kind === 'freekick' ? 0.34 : 0.42;
  baseGoal -= distFactor;
  // ---- aim quality: corners best ----
  const cornerScore = (Math.abs(i.aimX - 0.5) * 1.7 + (i.aimY > 0.55 ? (i.aimY - 0.55) * 2.4 : 0));
  baseGoal += cornerScore * (i.kind === 'penalty' ? 0.24 : 0.3);
  // ---- power sweet spot ----
  const sweet = i.kind === 'corner' ? 0 : 1 - Math.min(1, Math.abs(i.power - 0.78) / 0.42);
  baseGoal += sweet * 0.12;
  // ---- shot types ----
  if (i.shotType === 'curl' && (i.kind === 'shot' || i.kind === 'freekick')) baseGoal += 0.1 * cornerScore + 0.02;
  if (i.shotType === 'knuckle') baseGoal += i.power > 0.7 ? 0.06 : -0.04;
  if (i.shotType === 'chip') baseGoal += i.distance < 22 && i.power < 0.55 ? 0.12 : -0.09;
  // ---- ratings ----
  baseGoal += diffGk * 0.011;
  baseGoal += diffDef * 0.006;
  // ---- header timing ----
  if (i.kind === 'corner') baseGoal += ((i.headerTiming ?? 0.5) - 0.5) * 0.8;
  baseGoal = Math.max(0.02, Math.min(0.96, baseGoal));

  // ---- block chance (defenders) ----
  if (i.kind === 'shot' || i.kind === 'freekick') {
    const blockP = Math.max(0.03, 0.22 - diffDef * 0.012 - cornerScore * 0.1 + (i.kind === 'freekick' ? 0.1 : 0));
    if (r() < blockP) return { outcome: 'block' };
  }
  // ---- off target ----
  const missP = Math.max(0.02, 0.2 - sweet * 0.18 - (i.kind === 'penalty' ? 0.06 : 0) - diffGk * 0.004 + (i.power > 0.94 ? 0.18 : 0) + (cornerScore > 1.2 ? 0.14 : 0));
  if (r() < missP) return { outcome: r() < 0.24 ? 'post' : 'miss' };
  // ---- keeper save ----
  const saveP = Math.max(0.04, Math.min(0.9, 1 - baseGoal - 0.12));
  if (r() < saveP) return { outcome: 'save' };
  return { outcome: 'goal' };
}

// auto-aim for skip mode
export function autoResolveMoment(r: () => number, hero: Hero, m: KeyMoment): ShotOutcome {
  const eff = effectiveRating(hero);
  const { outcome } = resolveShot({
    kind: m.kind, distance: m.distance,
    aimX: rr(r, 0.06, 0.94), aimY: rr(r, 0.1, 0.9), power: rr(r, 0.6, 0.85),
    shotType: 'normal', headerTiming: rr(r, 0.35, 0.75),
    youRating: eff, oppDef: m.oppDef, oppGk: m.oppGk, rng: r,
  });
  return outcome;
}

// ---------- events feed generator ----------
// ---------- end of season ----------
export function endSeasonAging(players: Player[], rng: () => number) {
  for (const p of players) {
    p.age++;
    const delta = ageDelta(p.age) + ri(rng, -1, 1);
    p.rating = Math.max(45, Math.min(94, p.rating + delta));
    p.rank = rankOf(p.rating);
    p.value = Math.round((p.value * (1 + delta * 0.06)) / 1e5) * 1e5;
    p.apps = 0; p.goals = 0; p.assists = 0; p.motm = 0; p.ratingSum = 0;
    p.energy = 100; p.morale = ri(rng, 60, 90);
  }
}

// ---------- transfers ----------
export interface Offer { teamId: string; wage: number; fee: number; note: string }
export function genOffers(world: World, hero: Hero, rng: () => number): Offer[] {
  const teams = world.teams.filter(t => t.id !== hero.teamId);
  const perf = hero.goals + hero.assists * 0.7 + hero.motm * 1.2;
  const offers: Offer[] = [];
  for (const t of teams) {
    const str = teamStrength(world, t.id);
    let interest = (hero.rating - str) * 0.03 + perf * 0.02 + (t.tier === 2 && (world.teams.find(x => x.id === hero.teamId)?.tier === 1) ? -0.5 : 0);
    if (rng() < interest) {
      const fee = Math.round(hero.value * rr(rng, 0.9, 1.35) / 1e6) * 1e6;
      offers.push({
        teamId: t.id, fee,
        wage: Math.round(hero.value * 0.00018 / 1e3) * 1e3,
        note: perf > 12 ? 'Ты их главная цель!' : 'Ищут усиление атаки',
      });
    }
    if (offers.length >= 4) break;
  }
  return offers.sort((a, b) => b.fee - a.fee);
}

export function npcTransfers(world: World, rng: () => number): string[] {
  const news: string[] = [];
  // free agents -> weak squads
  const weak = [...world.teams].sort((a, b) => teamStrength(world, a.id) - teamStrength(world, b.id)).slice(0, 4);
  const agents = world.free.sort((a, b) => b.rating - a.rating);
  for (const t of weak) {
    if (!agents.length) break;
    const p = agents.shift()!;
    p.teamId = t.id;
    world.free = world.free.filter(x => x.id !== p.id);
    world.players.push(p);
    news.push(`${p.name} (${p.rating}) подписал контракт с ${t.name}`);
  }
  // 2-4 random swaps between t1 clubs for top squad players
  const t1 = world.teams.filter(t => t.tier === 1);
  for (let i = 0; i < 3; i++) {
    const from = pick(rng, t1);
    const squad = world.players.filter(p => p.teamId === from.id).sort((a, b) => b.rating - a.rating).slice(0, 6);
    if (!squad.length || rng() < 0.4) continue;
    const p = pick(rng, squad);
    const to = pick(rng, t1.filter(t => t.id !== from.id));
    p.teamId = to.id;
    news.push(`Громкий трансфер: ${p.name} переходит из ${from.name} в ${to.name} за ~${Math.round(p.value / 1e6)}M$`);
  }
  return news.slice(0, 6);
}

// ---------- training ----------
export type Drill = 'sho' | 'dri' | 'pac' | 'pas' | 'phy' | 'head';
export const DRILLS: { id: Drill; name: string; desc: string; attr: keyof Hero['attrs'] | 'head' }[] = [
  { id: 'sho', name: 'Удары по воротам', desc: 'Завершение атак, поставленный удар', attr: 'sho' },
  { id: 'dri', name: 'Дриблинг и финты', desc: 'Обводка 1-на-1, контроль мяча', attr: 'dri' },
  { id: 'pac', name: 'Спринт-интервалы', desc: 'Скорость и отрыв от защитника', attr: 'pac' },
  { id: 'pas', name: 'Пасы и видение поля', desc: 'Точность передач, ассисты', attr: 'pas' },
  { id: 'phy', name: 'Силовая работа', desc: 'Борьба, выбор позиции', attr: 'phy' },
  { id: 'head', name: 'Игра головой', desc: 'Завершение навесов и угловых', attr: 'head' },
];
export function trainGain(hero: Hero, drill: Drill, rng: () => number): { pts: number; attr: string } {
  const energyCost = 22;
  const young = hero.age <= 23 ? 1.5 : hero.age <= 28 ? 1 : 0.6;
  const pts = Math.max(1, Math.round(rr(rng, 2, 5) * young * (hero.energy / 100 > 0.4 ? 1 : 0.6)));
  hero.energy = Math.max(0, hero.energy - energyCost);
  hero.xp += pts;
  return { pts, attr: drill };
}

// xp -> attribute ups
export function applyXp(hero: Hero): number {
  const cost = 12;
  let ups = 0;
  while (hero.xp >= cost + ups * 6) {
    hero.xp -= cost + ups * 6;
    ups++;
  }
  if (ups > 0) {
    // distribute to key attrs by position
    const keys: (keyof Hero['attrs'])[] = hero.pos === 'ST' ? ['sho', 'phy', 'pac', 'dri'] : hero.pos === 'W' ? ['dri', 'pac', 'sho', 'pas'] : ['pas', 'dri', 'sho', 'pac'];
    for (let i = 0; i < ups; i++) {
      const k = keys[i % keys.length];
      hero.attrs[k] = Math.min(99, hero.attrs[k] + 1);
    }
    hero.rating = Math.min(96, hero.rating + ups);
    hero.rank = rankOf(hero.rating);
    hero.value = Math.round(hero.value * (1 + 0.05 * ups) / 1e5) * 1e5;
  }
  return ups;
}
