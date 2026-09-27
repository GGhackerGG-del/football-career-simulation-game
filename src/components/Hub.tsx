import { useMemo, useState } from 'react';
import { Home, Calendar, Table2, BarChart3, Users, Dumbbell, ArrowLeftRight, UserCircle, Play, Zap, Heart, Trophy, TrendingUp, TrendingDown, Minus, Shirt, Save, LogOut, BedDouble, Medal } from 'lucide-react';
import type { World } from '../game/core';
import { teamColor, teamStrength, fmtM, DB } from '../game/core';
import type { Hero, Fixture } from '../game/types';
import { DRILLS, ageDelta, type Offer } from '../game/career';
import Avatar from './Avatar';
import { AppearanceControls } from './CreatePlayer';

const TABS = [
  { id: 'home', name: 'Обзор', icon: Home },
  { id: 'cal', name: 'Календарь', icon: Calendar },
  { id: 'table', name: 'Таблица', icon: Table2 },
  { id: 'stats', name: 'Статистика', icon: BarChart3 },
  { id: 'team', name: 'Клуб', icon: Users },
  { id: 'train', name: 'Тренировки', icon: Dumbbell },
  { id: 'transfer', name: 'Трансферы', icon: ArrowLeftRight },
  { id: 'profile', name: 'Профиль', icon: UserCircle },
] as const;

interface Props {
  world: World; hero: Hero; season: number; md: number;
  offers: Offer[]; news: string[]; trainingsLeft: number;
  onPlay: (f: Fixture) => void;
  onTrain: (drillId: string) => { pts: number; ups?: number } | null;
  onRest: () => void;
  onOffer: (teamId: string) => void;
  onRequest: (teamId: string) => void;
  onAppearance: (a: Hero['appearance']) => void;
  onSave: () => void; onQuit: () => void;
  msg: string | null;
}

const Bar = ({ v, c = '#a3e635' }: { v: number; c?: string }) => (
  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${v}%`, background: c }} />
  </div>
);

export default function Hub(p: Props) {
  const [tab, setTab] = useState<string>('home');
  const [trainMsg, setTrainMsg] = useState<string | null>(null);
  const { world, hero } = p;
  const myTeam = world.teams.find(t => t.id === hero.teamId)!;
  const myFixtures = world.fixtures.filter(f => (f.home === hero.teamId || f.away === hero.teamId));
  const nextFix = myFixtures.find(f => !f.played);
  const squad = world.players.filter(pl => pl.teamId === hero.teamId).sort((a, b) => b.rating - a.rating);
  const table = (tier: 1 | 2) => [...world.teams.filter(t => t.tier === tier)].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
  const leaders = useMemo(() => {
    const all = [...world.players.filter(x => x.id !== hero.id), hero];
    const g = [...all].sort((a, b) => b.goals - a.goals).slice(0, 8);
    const a = [...all].sort((x, y) => y.assists - x.assists).slice(0, 8);
    const m = [...all].sort((x, y) => y.motm - x.motm).slice(0, 8);
    return { g, a, m };
  }, [world.players, hero]);
  const heroDB = useMemo(() => DB.players.find(d => d.n.toLowerCase() === hero.id.replace('db:', '')), [hero.id]);
  const [histOpen, setHistOpen] = useState<string | null>(null);

  const [c1, c2] = teamColor(myTeam?.id ?? '');
  const avgR = hero.ratingSum && hero.apps ? (hero.ratingSum / hero.apps).toFixed(1) : '—';

  return (
    <div className="min-h-screen bg-[#04120a] text-white">
      {/* top bar */}
      <div className="sticky top-0 z-40 bg-[#04120a]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border-2" style={{ background: c1, color: c2, borderColor: c2 }}>{myTeam?.short ?? 'FA'}</div>
            <div>
              <div className="font-black leading-tight text-sm md:text-base">{hero.name}</div>
              <div className="text-[11px] text-white/45">{myTeam?.name ?? 'Свободный агент'} • OVR {hero.rating} • возраст {hero.age}</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden md:block text-xs font-mono text-white/50">Сезон S{23 + p.season} • Тур {p.md}/10</span>
            <button onClick={p.onSave} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10" title="Сохранить"><Save size={15} /></button>
            <button onClick={p.onQuit} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10" title="В меню"><LogOut size={15} /></button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${tab === t.id ? 'bg-lime-400 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
              <t.icon size={13} /> {t.name}
            </button>
          ))}
        </div>
      </div>

      {p.msg && <div className="max-w-7xl mx-auto px-4 mt-3"><div className="px-4 py-2.5 rounded-xl bg-lime-400/15 border border-lime-400/30 text-lime-200 text-sm font-semibold">{p.msg}</div></div>}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ============ OVERVIEW ============ */}
        {tab === 'home' && (
          <div className="grid lg:grid-cols-3 gap-5">
            {/* next match */}
            <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[.06] to-transparent p-6">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] tracking-[.25em] font-bold text-white/40 uppercase">Следующий матч • Тур {p.md}</span>
                <span className="text-xs font-mono text-lime-300">{myTeam?.tier === 1 ? 'TIER 1A' : 'RES SUPER LEAGUE'}</span>
              </div>
              {nextFix ? (
                <>
                  <div className="flex items-center justify-center gap-6 md:gap-10">
                    {[world.teams.find(t => t.id === nextFix.home)!, world.teams.find(t => t.id === nextFix.away)!].map((t, i) => {
                      const [a, b, sh] = teamColor(t.id);
                      return (
                        <div key={t.id} className={`text-center ${i ? 'order-3' : ''} ${t.id === hero.teamId ? '' : 'opacity-80'}`}>
                          <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center font-black text-lg border-4 shadow-xl" style={{ background: a, color: b, borderColor: b }}>{sh}</div>
                          <div className="mt-2 font-bold text-sm max-w-[150px] leading-tight">{t.name}</div>
                          <div className="text-[11px] font-mono text-white/40">сила {Math.round(teamStrength(world, t.id))}</div>
                        </div>
                      );
                    })}
                    <div className="order-2 text-3xl font-black italic text-white/20">VS</div>
                  </div>
                  <button onClick={() => p.onPlay(nextFix)} className="mt-6 mx-auto flex items-center gap-2 px-10 py-4 rounded-2xl bg-lime-400 text-black font-black text-lg hover:bg-lime-300 transition shadow-[0_0_44px_-8px_#a3e635]">
                    <Play size={20} /> ИГРАТЬ МАТЧ
                  </button>
                </>
              ) : (
                <div className="py-10 text-center text-white/50">Сезон завершен — подводи итоги!</div>
              )}
              {/* last results */}
              <div className="mt-6 flex gap-2 justify-center">
                {myFixtures.filter(f => f.played).slice(-5).map((f, i) => {
                  const won = (f.home === hero.teamId ? f.hs! > f.as! : f.as! > f.hs!);
                  const dr = f.hs === f.as;
                  return <span key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${won ? 'bg-lime-400 text-black' : dr ? 'bg-white/20' : 'bg-rose-500'}`}>{won ? 'В' : dr ? 'Н' : 'П'}</span>;
                })}
              </div>
            </div>
            {/* player card */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-lime-400/10 to-transparent p-5 flex flex-col items-center">
              <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${hero.rank === 'X' ? 'bg-amber-400 text-black' : hero.rank === 'A' ? 'bg-violet-400 text-black' : 'bg-white/15'}`}>RANK {hero.rank}</div>
              <Avatar ap={hero.appearance} c1={c1} c2={c2} size={150} className="mt-2" />
              <div className="text-3xl font-black mt-1">{hero.rating}</div>
              <div className="text-xs text-white/50 mb-3">{hero.pos} • {fmtM(hero.value)}</div>
              <div className="w-full space-y-2.5 text-[11px]">
                <div><div className="flex justify-between mb-1"><span className="text-white/55 flex items-center gap-1"><Zap size={11} className="text-lime-400" /> Энергия</span><span className="font-mono">{hero.energy}%</span></div><Bar v={hero.energy} c={hero.energy > 55 ? '#a3e635' : '#fb923c'} /></div>
                <div><div className="flex justify-between mb-1"><span className="text-white/55 flex items-center gap-1"><Heart size={11} className="text-rose-400" /> Морал</span><span className="font-mono">{hero.morale}%</span></div><Bar v={hero.morale} c="#fb7185" /></div>
                <div><div className="flex justify-between mb-1"><span className="text-white/55">Опыт до апгрейда</span><span className="font-mono">{hero.xp} xp</span></div><Bar v={Math.min(100, hero.xp / 60 * 100)} c="#38bdf8" /></div>
              </div>
              <div className="grid grid-cols-4 gap-2 w-full mt-4">
                {[['Г', hero.goals], ['П', hero.assists], ['МОМ', hero.motm], ['Ø', avgR]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-black/30 border border-white/10 py-2 text-center"><div className="font-black text-lime-300">{v}</div><div className="text-[10px] text-white/40">{l}</div></div>
                ))}
              </div>
            </div>
            {/* attrs */}
            <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5">
              <h3 className="font-black text-sm uppercase tracking-wider text-white/60 mb-3">Навыки</h3>
              <div className="space-y-2.5">
                {([['pac', 'Скорость'], ['sho', 'Удар'], ['pas', 'Пас'], ['dri', 'Дриблинг'], ['phy', 'Физика']] as const).map(([k, n]) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-white/55">{n}</span>
                    <div className="flex-1"><Bar v={hero.attrs[k]} /></div>
                    <span className="w-7 text-right text-sm font-black">{hero.attrs[k]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-[11px] text-white/40 flex items-center gap-1.5">
                {ageDelta(hero.age) > 0 ? <TrendingUp size={13} className="text-lime-400" /> : ageDelta(hero.age) < 0 ? <TrendingDown size={13} className="text-rose-400" /> : <Minus size={13} />}
                {ageDelta(hero.age) > 0 ? 'В расцвете роста — тренируйся чаще' : ageDelta(hero.age) < 0 ? 'Возраст берет свое — держи форму тренировками' : 'Пик карьеры'}
              </div>
            </div>
            {/* news */}
            <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[.04] p-5">
              <h3 className="font-black text-sm uppercase tracking-wider text-white/60 mb-3">Лента новостей</h3>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {p.news.length === 0 && <div className="text-sm text-white/35">Пока тихо. Сыграй матч — и пресса заговорит о тебе.</div>}
                {p.news.slice(0, 12).map((n, i) => <div key={i} className="text-sm text-white/75 flex gap-2"><span className="text-lime-400">•</span>{n}</div>)}
              </div>
            </div>
          </div>
        )}

        {/* ============ CALENDAR ============ */}
        {tab === 'cal' && (
          <div className="grid md:grid-cols-2 gap-3">
            {Array.from({ length: 10 }, (_, md) => md + 1).map(md => {
              const fs = world.fixtures.filter(f => f.md === md && world.teams.find(t => t.id === f.home)?.tier === myTeam?.tier);
              const cur = md === p.md;
              return (
                <div key={md} className={`rounded-2xl border p-4 ${cur ? 'border-lime-400/50 bg-lime-400/5' : 'border-white/10 bg-white/[.03]'}`}>
                  <div className="text-xs font-black text-white/50 mb-2">ТУР {md} {cur && <span className="text-lime-300 ml-1">— текущий</span>}</div>
                  <div className="space-y-1.5">
                    {fs.map((f, i) => {
                      const mine = f.home === hero.teamId || f.away === hero.teamId;
                      return (
                        <div key={i} className={`flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg ${mine ? 'bg-lime-400/10 border border-lime-400/25' : 'bg-black/20'}`}>
                          <span className={`flex-1 text-right truncate ${f.home === hero.teamId ? 'font-black' : ''}`}>{world.teams.find(t => t.id === f.home)?.short}</span>
                          <span className="font-mono font-black w-14 text-center">{f.played ? `${f.hs} : ${f.as}` : '— : —'}</span>
                          <span className={`flex-1 truncate ${f.away === hero.teamId ? 'font-black' : ''}`}>{world.teams.find(t => t.id === f.away)?.short}</span>
                          {mine && !f.played && cur && <button onClick={() => p.onPlay(f)} className="px-2.5 py-1 rounded-md bg-lime-400 text-black text-[10px] font-black">ИГРАТЬ</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============ TABLE ============ */}
        {tab === 'table' && (
          <div className="grid lg:grid-cols-2 gap-5">
            {[1, 2].map(tier => (
              <div key={tier} className="rounded-2xl border border-white/10 bg-white/[.03] overflow-hidden">
                <div className="px-4 py-3 bg-black/40 font-black text-sm flex items-center gap-2"><Trophy size={14} className="text-amber-400" /> {tier === 1 ? 'TIER 1A' : 'RES SUPER LEAGUE'}</div>
                <table className="w-full text-sm">
                  <thead><tr className="text-[10px] text-white/40 uppercase">
                    <th className="px-3 py-2 text-left">#</th><th className="text-left">Клуб</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>М</th><th className="pr-3">О</th>
                  </tr></thead>
                  <tbody>
                    {table(tier as 1 | 2).map((t, i) => (
                      <tr key={t.id} className={`border-t border-white/5 ${t.id === hero.teamId ? 'bg-lime-400/10 font-bold' : ''}`}>
                        <td className={`px-3 py-2 font-black ${i === 0 ? 'text-amber-400' : 'text-white/50'}`}>{i + 1}</td>
                        <td className="py-2"><span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded" style={{ background: teamColor(t.id)[0], border: `1px solid ${teamColor(t.id)[1]}` }} /> {t.short}</span></td>
                        <td className="text-center font-mono">{t.p}</td><td className="text-center font-mono">{t.w}</td><td className="text-center font-mono">{t.d}</td><td className="text-center font-mono">{t.l}</td>
                        <td className="text-center font-mono text-white/50">{t.gf}:{t.ga}</td>
                        <td className="text-center font-black pr-3 text-lime-300">{t.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* ============ STATS ============ */}
        {tab === 'stats' && (
          <div className="space-y-5">
            <div className="grid md:grid-cols-3 gap-4">
              {[['Бомбардиры', leaders.g, 'goals', 'text-lime-300'], ['Ассистенты', leaders.a, 'assists', 'text-sky-300'], ['Лучшие игроки матча', leaders.m, 'motm', 'text-amber-300']].map(([title, list, key, col]: any) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[.03] overflow-hidden">
                  <div className="px-4 py-3 bg-black/40 font-black text-sm">{title}</div>
                  <div className="divide-y divide-white/5">
                    {list.map((pl: Hero | any, i: number) => (
                      <div key={pl.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${pl.id === hero.id ? 'bg-lime-400/10' : ''}`}>
                        <span className={`w-5 font-black ${i < 3 ? col : 'text-white/35'}`}>{i + 1}</span>
                        <span className="flex-1 truncate">{pl.name} <span className="text-[10px] text-white/35">{world.teams.find(t => t.id === pl.teamId)?.short}</span></span>
                        <span className={`font-black font-mono ${col}`}>{pl[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* real historic DB */}
            <div className="rounded-2xl border border-white/10 bg-white/[.03] overflow-hidden">
              <div className="px-4 py-3 bg-black/40 font-black text-sm flex items-center gap-2"><BarChart3 size={14} className="text-lime-400" /> Реальная база RESA — статистика по сезонам S18–S22</div>
              <div className="p-3 max-h-80 overflow-y-auto space-y-1">
                {[...DB.players].sort((a, b) => (Object.values(b.st).reduce((s, x) => s + (x.g ?? 0), 0)) - (Object.values(a.st).reduce((s, x) => s + (x.g ?? 0), 0))).slice(0, 40).map(d => {
                  const g22 = (y: string) => d.st[y]?.g ?? 0, a22 = (y: string) => d.st[y]?.a ?? 0;
                  const open = histOpen === d.n;
                  return (
                    <div key={d.n}>
                      <button onClick={() => setHistOpen(open ? null : d.n)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-black/20 hover:bg-black/40 text-left text-sm transition">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${d.rk === 'X' ? 'bg-amber-400 text-black' : d.rk === 'A' ? 'bg-violet-400 text-black' : d.rk === 'B' ? 'bg-sky-400 text-black' : 'bg-white/10'}`}>{d.rt}</span>
                        <span className="flex-1 truncate font-semibold">{d.n}</span>
                        <span className="hidden sm:block text-[11px] text-white/40 w-40 truncate">{d.tm || 'Free Agent'}</span>
                        {['s18', 's19', 's20', 's21', 's22'].map(y => <span key={y} className="hidden md:inline w-10 text-center font-mono text-xs text-white/60" title={y.toUpperCase()}>{g22(y) || '·'}</span>)}
                        <span className="font-black font-mono text-lime-300 w-10 text-right">{['s18', 's19', 's20', 's21', 's22'].reduce((s, y) => s + g22(y), 0)}</span>
                      </button>
                      {open && (
                        <div className="mx-3 mt-1 mb-2 rounded-xl bg-lime-400/5 border border-lime-400/20 p-3 text-xs grid sm:grid-cols-5 gap-2">
                          {['s18', 's19', 's20', 's21', 's22'].map(y => (
                            <div key={y} className="rounded-lg bg-black/30 p-2">
                              <div className="font-black text-lime-300 mb-0.5">{y.toUpperCase()}</div>
                              <div className="text-white/60">{d.hs[y]?.tm || '—'}</div>
                              <div className="mt-1 font-mono">Г:{g22(y)} П:{a22(y)} МОМ:{d.st[y]?.m ?? 0}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============ TEAM ============ */}
        {tab === 'team' && (
          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white/60 mb-3">Состав {myTeam?.name} ({squad.length})</h3>
              <div className="space-y-1.5">
                {squad.map(pl => {
                  const trend = pl.age <= 23 ? 1 : pl.age >= 31 ? -1 : 0;
                  return (
                    <div key={pl.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[.04] border border-white/5 text-sm">
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black ${pl.rating >= 88 ? 'bg-amber-400 text-black' : pl.rating >= 84 ? 'bg-violet-400 text-black' : 'bg-white/10'}`}>{pl.rating}</span>
                      <span className="flex-1 truncate font-semibold">{pl.name} <span className="text-[10px] text-white/35 ml-1">{pl.pos} • {pl.age}л</span></span>
                      <span className="font-mono text-xs text-white/50">{pl.goals}Г {pl.assists}П</span>
                      {trend > 0 ? <TrendingUp size={14} className="text-lime-400" /> : trend < 0 ? <TrendingDown size={14} className="text-rose-400" /> : <Minus size={14} className="text-white/25" />}
                    </div>
                  );
                })}
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-lime-400/10 border border-lime-400/30 text-sm">
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black bg-lime-400 text-black">{hero.rating}</span>
                  <span className="flex-1 truncate font-black">{hero.name} <span className="text-[10px] text-lime-300/70 ml-1">{hero.pos} • {hero.age}л • ТЫ</span></span>
                  <span className="font-mono text-xs text-lime-200">{hero.goals}Г {hero.assists}П</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white/60 mb-3">Свободные агенты (топ)</h3>
              <div className="space-y-1.5">
                {world.free.slice(0, 10).map(pl => (
                  <div key={pl.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[.04] border border-white/5 text-sm">
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black bg-white/10">{pl.rating}</span>
                    <span className="flex-1 truncate font-semibold">{pl.name}</span>
                    <span className="font-mono text-xs text-white/40">{fmtM(pl.value)}</span>
                  </div>
                ))}
                {world.free.length === 0 && <div className="text-sm text-white/35 px-2">Все подписаны по клубам.</div>}
              </div>
              {heroDB && (
                <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
                  <div className="flex items-center gap-2 font-black text-sm mb-2 text-amber-200"><Medal size={15} /> Твоя реальная история RESA</div>
                  <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                    {['s18', 's19', 's20', 's21', 's22'].map(y => (
                      <div key={y} className="rounded-lg bg-black/30 p-2">
                        <div className="font-black text-amber-300">{y.toUpperCase()}</div>
                        <div className="text-white/50 text-[10px] truncate mt-0.5">{heroDB.hs[y]?.tm?.slice(0, 12) || '—'}</div>
                        <div className="font-mono mt-0.5">{heroDB.st[y]?.g ?? 0}Г {heroDB.st[y]?.a ?? 0}П</div>
                        <div className="text-[10px] text-white/40">rt {heroDB.hs[y]?.rt ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ TRAIN ============ */}
        {tab === 'train' && (
          <div>
            <div className="flex flex-wrap items-center gap-4 mb-5">
              <div className="flex items-center gap-2 text-sm"><Dumbbell size={16} className="text-lime-400" /> Осталось сессий в этом туре: <b className="text-lime-300">{p.trainingsLeft}</b></div>
              <div className="flex items-center gap-2 text-sm text-white/60"><Zap size={14} className="text-amber-400" /> Энергия: <b className={hero.energy > 50 ? 'text-lime-300' : 'text-orange-400'}>{hero.energy}%</b></div>
              <button onClick={() => { p.onRest(); setTrainMsg('Отдых прошел с пользой: +35 энергии'); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-400/15 border border-sky-400/40 text-sky-200 text-xs font-bold hover:bg-sky-400/25"><BedDouble size={14} /> Отдохнуть (+35 эн.)</button>
              {trainMsg && <span className="text-xs text-lime-300 font-semibold">{trainMsg}</span>}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DRILLS.map(d => (
                <button key={d.id} disabled={p.trainingsLeft <= 0}
                  onClick={() => {
                    const r = p.onTrain(d.id);
                    if (r) setTrainMsg(`+${r.pts} xp (${d.name.toLowerCase()})${(r as any).ups > 0 ? ` • АПГРЕЙД +${(r as any).ups} OVR!` : ''}`);
                  }}
                  className="group text-left rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.06] to-transparent p-5 hover:border-lime-400/50 hover:from-lime-400/10 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black">{d.name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono">−22 эн.</span>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">{d.desc}</p>
                  <div className="mt-3 text-[11px] font-bold text-lime-300 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition">Тренировать →</div>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/40 max-w-2xl">Молодые игроки (до 23) получают на 50% больше опыта. После 30 лет прогресс замедляется, а по ходу сезонов рейтинг начнет падать — держи форму. Каждые ~12xp → +1 к навыкам и OVR. Усталость снижает твой эффективный рейтинг в матче.</p>
          </div>
        )}

        {/* ============ TRANSFER ============ */}
        {tab === 'transfer' && (
          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white/60 mb-3 flex items-center gap-2"><ArrowLeftRight size={15} className="text-lime-400" /> Предложения клубов ({p.offers.length})</h3>
              {p.offers.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5 text-sm text-white/45">Пока предложений нет. Они появляются после 5-го тура и в межсезонье — зажигай на поле, и скауты Tier 1A тебя заметят.</div>}
              <div className="space-y-2">
                {p.offers.map(o => {
                  const t = world.teams.find(x => x.id === o.teamId)!;
                  const [a, b, sh] = teamColor(t.id);
                  return (
                    <div key={o.teamId} className="flex items-center gap-3 rounded-2xl border border-lime-400/30 bg-lime-400/5 p-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs border-2 shrink-0" style={{ background: a, color: b, borderColor: b }}>{sh}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{t.name}</div>
                        <div className="text-[11px] text-white/50">{o.note} • отступные {fmtM(o.fee)} • з/п {fmtM(o.wage)}/нед</div>
                      </div>
                      <button onClick={() => p.onOffer(o.teamId)} className="px-4 py-2 rounded-xl bg-lime-400 text-black text-xs font-black hover:bg-lime-300">ПЕРЕЙТИ</button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white/60 mb-3 flex items-center gap-2"><Shirt size={15} className="text-sky-400" /> Запросить трансфер</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {world.teams.filter(t => t.id !== hero.teamId).map(t => {
                  const [a, b, sh] = teamColor(t.id);
                  const str = teamStrength(world, t.id);
                  const interest = Math.round(Math.max(5, Math.min(98, 50 + (hero.rating - str) * 3 + (hero.goals + hero.assists) * 1.5 - (t.tier === 2 && hero.rating > 82 ? 25 : 0))));
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-[10px] border-2 shrink-0" style={{ background: a, color: b, borderColor: b }}>{sh}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{t.name}</div>
                        <div className="text-[10px] text-white/40">интерес: <b className={interest > 60 ? 'text-lime-300' : interest > 35 ? 'text-amber-300' : 'text-rose-300'}>{interest}%</b></div>
                      </div>
                      <button onClick={() => interest > 30 ? p.onRequest(t.id) : setTrainMsg('Клуб не заинтересован… улучши показатели')} className="px-2.5 py-1.5 rounded-lg bg-white/10 text-[10px] font-black hover:bg-white/20">ЗАПРОС</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============ PROFILE ============ */}
        {tab === 'profile' && (
          <div className="grid lg:grid-cols-[340px_1fr] gap-5">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.06] to-transparent p-6 flex flex-col items-center">
              <Avatar ap={hero.appearance} c1={c1} c2={c2} size={200} />
              <div className="font-black text-xl mt-2">{hero.name}</div>
              <div className="text-xs text-white/50">{myTeam?.name} • {hero.pos}</div>
              <div className="grid grid-cols-3 gap-2 w-full mt-4 text-center">
                {[['Матчи', hero.careerApps], ['Голы', hero.careerG], ['Пасы', hero.careerA]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-black/30 py-2.5 border border-white/10"><div className="font-black text-lg text-lime-300">{v}</div><div className="text-[10px] text-white/40 uppercase">{l}</div></div>
                ))}
              </div>
              <div className="w-full mt-4 space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-white/50">Сезонов в карьере</span><b>{p.season + 1}</b></div>
                <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-white/50">Стоимость</span><b>{fmtM(hero.value)}</b></div>
                <div className="flex justify-between py-1.5"><span className="text-white/50">Ранг лиги</span><b className="text-amber-300">{hero.rank}</b></div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
              <h3 className="font-black text-sm uppercase tracking-wider text-white/60 mb-3">Редактировать внешний вид</h3>
              <AppearanceControls ap={hero.appearance} onChange={p.onAppearance} />
              <div className="mt-4 rounded-xl bg-black/30 border border-white/10 p-4">
                <div className="font-black text-sm mb-2">История сезонов (игровая)</div>
                {hero.history.length === 0 && <div className="text-xs text-white/40">Первый сезон в процессе…</div>}
                <div className="space-y-1">
                  {hero.history.map((h, i) => (
                    <div key={i} className="flex gap-3 text-xs font-mono text-white/70"><span className="text-lime-300">{h.season}</span><span className="flex-1 truncate">{h.team}</span><span>OVR {h.rating}</span><span>{h.g}Г</span><span>{h.a}П</span></div>
                  ))}
                </div>
                {heroDB && <div className="mt-3 text-[11px] text-white/40">+ реальная статистика RESA за S18–S22 доступна во вкладке «Клуб»</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
