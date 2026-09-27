// ============ Core data types (from RESA spreadsheets) ============
export interface SeasonStat { g?: number; a?: number; cs?: number; m?: number; me?: number }
export interface SeasonHist { rt?: number; v?: number; tm?: string }
export interface DBPlayer {
  n: string; rk: 'X'|'A'|'B'|'C'|'D'; rt: number; v: number;
  tm: string; nt: string; ro: string;
  hs: Record<string, SeasonHist>;
  st: Record<string, SeasonStat>;
}

// ============ Game runtime player ============
export type Pos = 'ST' | 'W' | 'CAM';
export interface Attrs { pac: number; sho: number; pas: number; dri: number; def: number; phy: number; gk: number }
export interface Player {
  id: string;
  name: string;
  age: number;
  rating: number;          // overall
  rank: 'X'|'A'|'B'|'C'|'D';
  value: number;
  teamId: string | null;   // null = free agent
  attrs: Attrs;
  pos: Pos;
  // live season stats
  apps: number; goals: number; assists: number; motm: number; ratingSum: number;
  history: { season: string; team: string; rating: number; g: number; a: number }[];
  morale: number;          // 0-100
  energy: number;          // 0-100
}

// ============ Your created character ============
export interface Appearance {
  skin: number; hair: number; hairColor: number; beard: number;
  tattoo: 0|1|2|3; // none, left, right, both sleeves
  tucked: boolean; longSleeves: boolean; longSocks: boolean;
  tape: boolean; bootColor: number;
  number: number;
}
export interface Hero extends Player {
  created: boolean;
  appearance: Appearance;
  careerG: number; careerA: number; careerApps: number;
  xp: number; // growth points
  season: number; // career season index
}

// ============ Teams / league ============
export interface Team {
  id: string; name: string; short: string; tier: 1|2;
  color: string; color2: string; // kit colors
  gk: number; // gk rating derived
  // table
  p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
}
export interface Fixture { md: number; home: string; away: string; hs?: number; as?: number; played: boolean }

export type MomentKind = 'shot'|'penalty'|'freekick'|'corner';
export interface KeyMoment {
  kind: MomentKind; minute: number; distance: number; // meters to goal
  oppDef: number; oppGk: number; note?: string;
}
export interface MatchEvent { minute: number; text: string; side: 'home'|'away'|'neutral'; important?: boolean }
export interface MatchResult { hs: number; as: number; events: MatchEvent[]; heroGoals: number; heroAssists: number; heroRating: number; motm: string }

export type Screen = 'menu'|'create'|'hub'|'match'|'seasonEnd';
