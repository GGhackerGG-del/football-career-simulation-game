import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildWorld, circleFixtures, mulberry, hash, rankOf, ri } from './game/core';
import type { World } from './game/core';
import type { Hero, Fixture, Team } from './game/types';
import { simAiMatch, genOffers, npcTransfers, endSeasonAging, trainGain, applyXp, type Offer } from './game/career';
import MainMenu from './components/MainMenu';
import CreatePlayer from './components/CreatePlayer';
import Hub from './components/Hub';
import MatchScreen, { type MatchSummary } from './components/MatchScreen';
import SeasonEnd from './components/SeasonEnd';

const SAVE_KEY = 'resa-career-v1';
interface SaveGame { world: World; hero: Hero; md: number; season: number; offers: Offer[]; news: string[]; trainingsLeft: number }
type Screen = 'menu' | 'create' | 'hub' | 'match' | 'season';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function updTable(t: Team, gf: number, ga: number) {
  t.p++; t.gf += gf; t.ga += ga;
  if (gf > ga) { t.w++; t.pts += 3; } else if (gf === ga) { t.d++; t.pts += 1; } else t.l++;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [world, setWorld] = useState<World | null>(null);
  const [hero, setHero] = useState<Hero | null>(null);
  const [md, setMd] = useState(1);
  const [season, setSeason] = useState(1);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [news, setNews] = useState<string[]>([]);
  const [trainingsLeft, setTrainingsLeft] = useState(2);
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => { setHasSave(!!localStorage.getItem(SAVE_KEY)); }, []);
  const tplWorld = useMemo(() => buildWorld(), []);

  const pushNews = (lines: string[]) => setNews(n => [...lines, ...n].slice(0, 40));
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const save = useCallback((w = world, h = hero, m = md, s = season, o = offers, n = news, tl = trainingsLeft) => {
    if (!w || !h) return;
    const data: SaveGame = { world: w, hero: h, md: m, season: s, offers: o, news: n, trainingsLeft: tl };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    setHasSave(true);
  }, [world, hero, md, season, offers, news, trainingsLeft]);

  // ---------- start new career ----------
  const startCareer = (h: Hero, pickedId: string | null) => {
    const w = buildWorld();
    if (pickedId) {
      w.players = w.players.filter(p => p.id !== pickedId);
      w.free = w.free.filter(p => p.id !== pickedId);
      h.id = pickedId;
    }
    // give hero slightly better starting morale in his new club
    w.players.push(h);
    const t = w.teams.find(x => x.id === h.teamId);
    setWorld(w); setHero(h); setMd(1); setSeason(1); setOffers([]);
    setTrainingsLeft(2); setFixture(null);
    pushNews([
      `${h.name} подписывает контракт с ${t?.name ?? 'клубом'} — сезон S23 стартует!`,
      `Скауты оценивают тебя в OVR ${h.rating}. Время доказать, что ты стоишь больше.`,
    ]);
    setScreen('hub');
    setTimeout(() => save(w, h, 1, 1, [], [], 2), 50);
  };

  const continueCareer = () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as SaveGame;
      setWorld(d.world); setHero(d.hero); setMd(d.md); setSeason(d.season);
      setOffers(d.offers); setNews(d.news); setTrainingsLeft(d.trainingsLeft);
      setScreen(d.md > 10 ? 'season' : 'hub');
    } catch { flash('Сохранение повреждено'); }
  };

  // ---------- match flow ----------
  const resultCache = useMemo(() => ({ }), []);
  const play = (f: Fixture) => { setFixture(f); setScreen('match'); };

  const finishMatch = (s: MatchSummary) => {
    if (!world || !hero || !fixture) return;
    const w = clone(world);
    const h = clone(hero);
    const rng = mulberry(hash(`md${md}season${season}${hero.id}`) + Date.now() % 100000);
    const me = w.players.find(p => p.id === h.id)!;

    // 1) my fixture
    const f = w.fixtures.find(x => x.md === fixture.md && x.home === fixture.home && x.away === fixture.away)!;
    f.played = true; f.hs = s.hs; f.as = s.as;
    const ht = w.teams.find(t => t.id === f.home)!, at = w.teams.find(t => t.id === f.away)!;
    updTable(ht, s.hs, s.as); updTable(at, s.as, s.hs);

    // 2) hero stats
    h.apps++; h.goals += s.heroGoals; h.assists += s.heroAssists;
    h.ratingSum += s.heroRating;
    if (s.heroRating >= 8.4) h.motm++;
    h.careerApps++; h.careerG += s.heroGoals; h.careerA += s.heroAssists;
    h.xp += s.heroGoals * 3 + s.heroAssists * 2 + (s.heroRating >= 8 ? 2 : s.heroRating >= 7 ? 1 : 0);
    h.energy = Math.max(5, h.energy - 24);
    const won = (f.home === h.teamId ? s.hs > s.as : s.as > s.hs);
    const draw = s.hs === s.as;
    h.morale = Math.max(20, Math.min(99, h.morale + (won ? 8 : draw ? 1 : -7) + s.heroGoals * 4 + s.heroAssists * 2));
    h.value = Math.round(Math.max(5e5, h.value * (1 + (s.heroRating - 6.8) * 0.015)) / 1e5) * 1e5;
    applyXp(h);
    // hero copy inside world too
    Object.assign(me, h);

    // 3) distribute NPC goals of my match
    const myGoals = (f.home === h.teamId ? s.hs : s.as) - s.heroGoals;
    const oppGoals = f.home === h.teamId ? s.as : s.hs;
    const dist = (teamId: string, goals: number) => {
      if (goals <= 0) return;
      const sq = w.players.filter(p => p.teamId === teamId && p.id !== h.id);
      if (!sq.length) return;
      for (let i = 0; i < goals; i++) {
        const pl = sq[ri(rng, 0, sq.length - 1)];
        pl.goals++; pl.ratingSum += 7.6; pl.apps++;
      }
    };
    dist(h.teamId!, Math.max(0, myGoals));
    dist(f.home === h.teamId ? f.away : f.home, oppGoals);

    // 4) other fixtures of this md (both tiers)
    for (const fx of w.fixtures.filter(x => x.md === md && !x.played)) {
      const sim = simAiMatch(rng, w, fx.home, fx.away);
      fx.played = true; fx.hs = sim.hs; fx.as = sim.as;
      const th = w.teams.find(t => t.id === fx.home)!, ta = w.teams.find(t => t.id === fx.away)!;
      updTable(th, sim.hs, sim.as); updTable(ta, sim.as, sim.hs);
      sim.scorers.forEach(sc => {
        const pl = w.players.find(p => p.id === sc.id);
        if (pl) { pl.goals += sc.g; pl.assists += sc.a; }
      });
    }

    // 5) news
    const oppName = f.home === h.teamId ? at.name : ht.name;
    const lines = [
      `${ht.short} ${s.hs}:${s.as} ${at.short} — ${h.name}: ${s.heroGoals}Г ${s.heroAssists}П (оценка ${s.heroRating.toFixed(1)})`,
      ...(s.heroGoals >= 2 ? [`Пресса в восторге: дубль ${h.name} в ворота ${oppName}!`] : []),
      ...(s.heroRating >= 8.6 ? [`${h.name} — игрок матча по версии экспертов RESA`] : []),
    ];
    const freshNews = (n: string[]) => lines.concat(n).slice(0, 40);
    setNews(freshNews);

    // 6) mid-window offers after md5
    let newOffers = offers;
    if (md === 5 && offers.length === 0) {
      newOffers = genOffers(w, h, rng);
      if (newOffers.length) setNews(n => [`Трансферное окно: тобой интересуются ${newOffers.length} клуба(ов)!`, ...n].slice(0, 40));
    }
    setOffers(newOffers);

    const nextMd = md + 1;
    setWorld(w); setHero(h); setFixture(null); setTrainingsLeft(2);
    if (nextMd > 10) { setMd(nextMd); setScreen('season'); save(w, h, nextMd, season, newOffers, freshNews(news), 2); }
    else { setMd(nextMd); setScreen('hub'); save(w, h, nextMd, season, newOffers, freshNews(news), 2); }
    void resultCache;
  };

  // ---------- training ----------
  const train = (drillId: string) => {
    if (!hero || trainingsLeft <= 0) return null;
    if (hero.energy < 25) { flash('Слишком устал — отдохни!'); return null; }
    const h = clone(hero);
    const r = trainGain(h, drillId as any, mulberry(Date.now() % 100000));
    const ups = applyXp(h);
    setTrainingsLeft(t => t - 1);
    setHero(h);
    if (world) { const me = world.players.find(p => p.id === h.id); if (me) Object.assign(me, h); setWorld({ ...world }); }
    return { ...r, ups };
  };
  const rest = () => {
    if (!hero) return;
    const h = clone(hero);
    h.energy = Math.min(100, h.energy + 35);
    h.morale = Math.min(99, h.morale + 2);
    setHero(h);
    if (world) { const me = world.players.find(p => p.id === h.id); if (me) Object.assign(me, h); setWorld({ ...world }); }
  };

  // ---------- transfers ----------
  const joinClub = (teamId: string, fee = 0) => {
    if (!world || !hero) return;
    const w = clone(world); const h = clone(hero);
    const t = w.teams.find(x => x.id === teamId)!;
    const old = w.teams.find(x => x.id === h.teamId);
    h.teamId = teamId; h.morale = Math.min(99, h.morale + 10);
    const me = w.players.find(p => p.id === h.id)!; Object.assign(me, h);
    setWorld(w); setHero(h);
    setOffers(o => o.filter(x => x.teamId !== teamId));
    setNews(n => [`ОФИЦИАЛЬНО: ${h.name} переходит в ${t.name}${fee ? ` за ${(fee / 1e6).toFixed(0)}M$` : ''}${old ? ` из ${old.name}` : ''}!`, ...n].slice(0, 40));
    setScreen('hub');
  };
  const requestTransfer = (teamId: string) => {
    if (!world || !hero) return;
    const rng = mulberry(Date.now() % 99991);
    const off = genOffers(world, hero, rng).find(o => o.teamId === teamId);
    if (off && rng() < 0.75) joinClub(teamId, off.fee);
    else flash('Клуб отклонил запрос — набери форму и попробуй в окне');
  };
  const onAppearance = (a: Hero['appearance']) => {
    if (!hero) return;
    const h = { ...hero, appearance: a };
    setHero(h);
    if (world) { const me = world.players.find(p => p.id === h.id); if (me) Object.assign(me, h); }
  };

  // ---------- next season ----------
  const nextSeason = () => {
    if (!world || !hero) return;
    const w = clone(world); const h = clone(hero);
    const rng = mulberry(hash('season' + season) + Date.now() % 100003);
    // hero career history row
    const t = w.teams.find(x => x.id === h.teamId);
    h.history.push({ season: 'S' + (22 + season), team: t?.name ?? '—', rating: h.rating, g: h.goals, a: h.assists });
    // performance delta for hero
    const avg = h.apps ? h.ratingSum / h.apps : 6.5;
    const perf = Math.round(Math.max(-2, Math.min(3, (avg - 6.85) * 2.2)));
    // aging + resets for everyone (incl. hero copy in world)
    endSeasonAging(w.players, rng);
    const me = w.players.find(p => p.id === h.id)!;
    // hero: perf delta on top of aging
    me.rating = Math.max(45, Math.min(96, me.rating + perf));
    me.rank = rankOf(me.rating);
    me.value = Math.round(Math.max(5e5, me.value * (1 + (perf + h.goals * 0.02) * 0.04)) / 1e5) * 1e5;
    me.morale = 78; me.energy = 100;
    Object.assign(h, { age: me.age, rating: me.rating, rank: me.rank, value: me.value,
      apps: 0, goals: 0, assists: 0, motm: 0, ratingSum: 0, morale: 78, energy: 100, season: h.season + 1 });
    Object.assign(me, h);
    // npc market
    const trNews = npcTransfers(w, rng);
    // reset tables
    w.teams.forEach(tt => { tt.p = 0; tt.w = 0; tt.d = 0; tt.l = 0; tt.gf = 0; tt.ga = 0; tt.pts = 0; });
    // new fixtures, shuffled order
    const t1 = w.teams.filter(x => x.tier === 1).map(x => x.id).sort(() => rng() - 0.5);
    const t2 = w.teams.filter(x => x.tier === 2).map(x => x.id).sort(() => rng() - 0.5);
    w.fixtures = [...circleFixtures(t1), ...circleFixtures(t2)];
    // offers for hero
    const newOffers = genOffers(w, h, rng);
    setWorld(w); setHero(h); setMd(1); setSeason(s => s + 1);
    setOffers(newOffers); setTrainingsLeft(2);
    setNews([
      ...newOffers.map(o => `Предложение на столе: ${w.teams.find(x => x.id === o.teamId)?.name} хочет тебя!`),
      ...trNews,
      `Сезон S${23 + season} официально стартовал!`,
    ].slice(0, 40));
    setScreen('hub');
    save(w, h, 1, season + 1, newOffers, news, 2);
  };

  // ---------- render ----------
  if (screen === 'menu') return <MainMenu hasSave={hasSave} onNew={() => setScreen('create')} onContinue={continueCareer} />;
  if (screen === 'create' || !world) {
    return <CreatePlayer tier2Teams={tplWorld.teams.filter(t => t.tier === 2)} onStart={startCareer} />;
  }
  if (screen === 'match' && fixture && hero) {
    const home = world.teams.find(t => t.id === fixture.home)!;
    const away = world.teams.find(t => t.id === fixture.away)!;
    return <MatchScreen key={`${fixture.md}-${fixture.home}`} world={world} hero={hero} home={home} away={away} onFinish={finishMatch} />;
  }
  if (screen === 'season' && hero) {
    return <SeasonEnd world={world} hero={hero} season={season} onNext={nextSeason} />;
  }
  if (hero) {
    return <Hub world={world} hero={hero} season={season - 1} md={Math.min(md, 10)} offers={offers} news={news}
      trainingsLeft={trainingsLeft} onPlay={play} onTrain={train} onRest={rest}
      onOffer={tid => joinClub(tid, offers.find(o => o.teamId === tid)?.fee ?? 0)} onRequest={requestTransfer}
      onAppearance={onAppearance} onSave={() => { save(); flash('Карьера сохранена'); }} onQuit={() => { save(); setScreen('menu'); }} msg={msg} />;
  }
  return null;
}
