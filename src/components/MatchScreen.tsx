import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, FastForward, SkipForward, Goal } from 'lucide-react';
import type { World } from '../game/core';
import { ri, rr, teamStrength } from '../game/core';
import type { Hero, Team, KeyMoment, MatchEvent } from '../game/types';
import { planHeroMatch, autoResolveMoment, effectiveRating } from '../game/career';
import type { ShotOutcome } from '../game/career';
import ShotMoment from './ShotMoment';
import HeaderMoment from './HeaderMoment';

export interface MatchSummary {
  hs: number; as: number; heroGoals: number; heroAssists: number;
  heroRating: number; events: MatchEvent[]; skipped: boolean;
}

interface Props { world: World; hero: Hero; home: Team; away: Team; onFinish: (s: MatchSummary) => void }

interface NpcGoal { minute: number; side: 'home' | 'away'; scorer?: string; heroAssist: boolean }
interface Dot { x: number; y: number; tx: number; ty: number; n: number }

export default function MatchScreen({ world, hero, home, away, onFinish }: Props) {
  const rng = useMemo(() => Math.random, []);
  const [plan] = useState(() => {
    const heroSide: 'home' | 'away' = hero.teamId === home.id ? 'home' : 'away';
    const oppTeam = heroSide === 'home' ? away.id : home.id;
    const p = planHeroMatch(rng, world, hero.teamId!, oppTeam, hero);
    // distribute npc goals
    const goals: NpcGoal[] = [];
    for (let i = 0; i < p.oppGoalsPlan; i++) goals.push({ minute: ri(rng, 3, 89), side: heroSide === 'home' ? 'away' : 'home', heroAssist: false });
    for (let i = 0; i < p.teamGoalsBase; i++) goals.push({ minute: ri(rng, 3, 89), side: heroSide, heroAssist: rng() < 0.3 });
    // scorers
    goals.forEach(g => {
      const sq = world.players.filter(pl => pl.teamId === (g.side === 'home' ? home.id : away.id) && pl.id !== hero.id);
      if (sq.length) g.scorer = sq[ri(rng, 0, sq.length - 1)].name;
    });
    goals.sort((a, b) => a.minute - b.minute);
    return { ...p, heroSide, npcGoals: goals };
  });

  const [minute, setMinute] = useState(0);
  const [score, setScore] = useState([0, 0]);
  const [feed, setFeed] = useState<MatchEvent[]>([{ minute: 0, text: `Судья дает свисток! ${home.name} против ${away.name}`, side: 'neutral', important: true }]);
  const [speed, setSpeed] = useState(3);
  const [paused, setPaused] = useState(false);
  const [activeMoment, setActiveMoment] = useState<KeyMoment | null>(null);
  const [heroStats, setHeroStats] = useState({ g: 0, a: 0, conv: 0, att: 0 });
  const [done, setDone] = useState<MatchSummary | null>(null);
  const [started, setStarted] = useState(false);

  const cvRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef({ min: 0, mi: 0, gi: 0, ball: { x: 480, y: 270 }, wave: 1, score: [0, 0] as number[], feedCount: 1, hs: { g: 0, a: 0, conv: 0, att: 0 } });
  const dots = useRef<{ home: Dot[]; away: Dot[] }>({ home: [], away: [] });
  const feedRef = useRef<HTMLDivElement>(null);

  const pushFeed = (text: string, side: MatchEvent['side'], important = false) => {
    const ev: MatchEvent = { minute: Math.floor(sim.current.min), text, side, important };
    setFeed(f => { sim.current.feedCount++; return [...f.slice(-30), ev]; });
    return ev;
  };

  // init dots
  useEffect(() => {
    const mk = (side: 'home' | 'away'): Dot[] => {
      const arr: Dot[] = [];
      const fx = side === 'home' ? 1 : -1;
      const base = [[110, 270], [240, 120], [230, 270], [240, 420], [420, 90], [430, 270], [420, 450], [620, 170], [600, 370]];
      for (let i = 0; i < 9; i++) {
        const [bx, by] = base[i];
        const x = side === 'home' ? bx : 960 - bx;
        arr.push({ x: x + rr(rng, -16, 16), y: by + rr(rng, -12, 12), tx: x, ty: by, n: i === 0 ? 1 : ri(rng, 2, 11) });
        void fx;
      }
      return arr;
    };
    dots.current = { home: mk('home'), away: mk('away') };
  }, []); // eslint-disable-line

  // live loop
  useEffect(() => {
    if (!started || paused || done || activeMoment) return;
    let raf = 0; let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000; last = t;
      sim.current.min = Math.min(90, sim.current.min + dt * speed * 1.5);
      setMinute(sim.current.min);
      // hero moment?
      const m = plan.moments[sim.current.mi];
      if (m && sim.current.min >= m.minute) { sim.current.mi++; setActiveMoment(m); return; }
      // npc goals
      const g = plan.npcGoals[sim.current.gi];
      if (g && sim.current.min >= g.minute) {
        sim.current.gi++;
        const idx = g.side === 'home' ? 0 : 1;
        sim.current.score[idx]++;
        setScore([...sim.current.score]);
        const tn = g.side === 'home' ? home : away;
        if (g.heroAssist) {
          sim.current.hs.a++;
          setHeroStats(h => ({ ...h, a: h.a + 1 }));
          pushFeed(`ГОЛ! ${tn.short}: ${g.scorer} забивает с передачи ${hero.name}!`, g.side, true);
        } else pushFeed(`Гол! ${tn.short} — ${g.scorer} открывает счет мячу`, g.side, true);
      }
      // ambient commentary
      if (rng() < dt * 0.16) {
        const lines = [
          `Плотная борьба в центре поля`, `Длинная передача на фланг...`, `Арбитр фиксирует офсайд`,
          `Болельщики скандируют с трибун`, `Аут — быстрый ввод мяча`, `Перехват! Контратака не получилась`,
        ];
        pushFeed(lines[ri(rng, 0, lines.length - 1)], 'neutral');
      }
      // ball wander
      sim.current.wave += dt * (rng() < 0.01 ? 4 : 1);
      const bx = 480 + Math.sin(sim.current.wave * 0.7) * 300 + Math.sin(sim.current.wave * 1.9) * 90;
      const by = 270 + Math.cos(sim.current.wave * 1.3) * 160 + Math.sin(sim.current.wave * 2.3) * 60;
      sim.current.ball.x += (bx - sim.current.ball.x) * Math.min(1, dt * 3.2);
      sim.current.ball.y += (by - sim.current.ball.y) * Math.min(1, dt * 3.2);
      // full time
      if (sim.current.min >= 90) {
        // resolve remaining moments automatically
        while (sim.current.mi < plan.moments.length) {
          const mm = plan.moments[sim.current.mi++];
          const out = autoResolveMoment(rng, hero, mm);
          sim.current.hs.att++;
          if (out === 'goal') {
            sim.current.hs.g++; sim.current.hs.conv++;
            const idx2 = plan.heroSide === 'home' ? 0 : 1;
            sim.current.score[idx2]++;
            pushFeed(`ГОЛ! ${hero.name} реализует момент на ${mm.minute}-й минуте!`, plan.heroSide, true);
          }
        }
        const h = sim.current.hs;
        const rating = Math.min(10, 6.2 + h.g * 1.15 + h.a * 0.85 + h.conv * 0.1 + (h.att > 0 ? 0.15 : 0));
        setScore([...sim.current.score]);
        setDone({ hs: sim.current.score[0], as: sim.current.score[1], heroGoals: h.g, heroAssists: h.a, heroRating: Math.round(rating * 10) / 10, events: feed, skipped: false });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, paused, done, activeMoment, speed]); // eslint-disable-line

  // canvas render
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      const W = 960, H = 540;
      ctx.clearRect(0, 0, W, H);
      // pitch
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#0e5e2a'); grd.addColorStop(1, '#0a4a20');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 10; i += 2) { ctx.globalAlpha = 0.05; ctx.fillRect(i * 96, 0, 96, H); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5;
      ctx.strokeRect(24, 24, W - 48, H - 48);
      ctx.beginPath(); ctx.moveTo(W / 2, 24); ctx.lineTo(W / 2, H - 24); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 66, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(24, H / 2 - 120, 130, 240); ctx.strokeRect(W - 154, H / 2 - 120, 130, 240);
      ctx.strokeRect(24, H / 2 - 60, 52, 120); ctx.strokeRect(W - 76, H / 2 - 60, 52, 120);
      // dots move
      const k = 0.05;
      for (const side of ['home', 'away'] as const) {
        const col = side === 'home' ? home.color : away.color;
        const col2 = side === 'home' ? home.color2 : away.color2;
        dots.current[side].forEach((d, i) => {
          if (i > 0 && Math.random() < 0.012) { d.tx = d.x + rr(Math.random, -70, 70); d.ty = Math.max(40, Math.min(H - 40, d.y + rr(Math.random, -60, 60))); }
          d.x += (d.tx - d.x) * k; d.y += (d.ty - d.y) * k;
          const isHero = (side === 'home') === (hero.teamId === home.id) && i === dots.current[side].length - 1;
          ctx.beginPath(); ctx.arc(d.x, d.y, isHero ? 11 : 8.6, 0, Math.PI * 2);
          ctx.fillStyle = col; ctx.fill();
          ctx.lineWidth = 2.2; ctx.strokeStyle = col2; ctx.stroke();
          if (isHero) {
            ctx.beginPath(); ctx.arc(d.x, d.y, 16, 0, Math.PI * 2);
            ctx.strokeStyle = '#a3e635'; ctx.globalAlpha = .9; ctx.stroke(); ctx.globalAlpha = 1;
            ctx.fillStyle = '#eaffb0'; ctx.font = 'bold 10px Archivo'; ctx.textAlign = 'center';
            ctx.fillText('ТЫ', d.x, d.y - 20);
          }
        });
      }
      // ball
      ctx.beginPath(); ctx.arc(sim.current.ball.x, sim.current.ball.y, 4.6, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc'; ctx.fill(); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1; ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [home, away, hero]);

  // feed autoscroll
  useEffect(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; }, [feed]);

  const skipAll = () => {
    // resolve everything instantly
    const r = rng;
    for (; sim.current.gi < plan.npcGoals.length; sim.current.gi++) {
      const g = plan.npcGoals[sim.current.gi];
      sim.current.score[g.side === 'home' ? 0 : 1]++;
      if (g.heroAssist) sim.current.hs.a++;
    }
    for (; sim.current.mi < plan.moments.length; sim.current.mi++) {
      const out = autoResolveMoment(r, hero, plan.moments[sim.current.mi]);
      if (out === 'goal') { sim.current.hs.g++; sim.current.score[plan.heroSide === 'home' ? 0 : 1]++; }
    }
    const h = sim.current.hs;
    const rating = Math.min(10, 6.2 + h.g * 1.15 + h.a * 0.85);
    setScore([...sim.current.score]);
    setDone({ hs: sim.current.score[0], as: sim.current.score[1], heroGoals: h.g, heroAssists: h.a, heroRating: Math.round(rating * 10) / 10, events: feed, skipped: true });
  };

  const onMomentDone = (o: ShotOutcome) => {
    const m = activeMoment!;
    setActiveMoment(null);
    sim.current.hs.att++;
    if (o === 'goal') {
      sim.current.hs.g++; sim.current.hs.conv++;
      const idx = plan.heroSide === 'home' ? 0 : 1;
      sim.current.score[idx]++; setScore([...sim.current.score]);
      setHeroStats(h => ({ ...h, g: h.g + 1, conv: h.conv + 1, att: h.att + 1 }));
      pushFeed(`ГОООЛ! ${hero.name} ${m.kind === 'penalty' ? 'реализует пенальти' : m.kind === 'freekick' ? 'забивает со штрафного' : m.kind === 'corner' ? 'замыкает подачу головой' : `бьет с ${m.distance} метров`} — мяч в сетке!`, plan.heroSide, true);
    } else {
      setHeroStats(h => ({ ...h, att: h.att + 1 }));
      const txt = { save: `Вратарь тащит удар ${hero.name}!`, block: `${hero.name} пробивает, но защитник блокирует`, post: `${hero.name} попадает в каркас ворот!`, miss: `${hero.name} не попадает в створ` }[o];
      pushFeed(txt, 'neutral', true);
    }
  };

  // ---------- pre-match ----------
  if (!started) {
    const myT = teamStrength(world, home.id), opT = teamStrength(world, away.id);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#04120a] text-white p-6">
        <div className="text-xs tracking-[.3em] text-lime-400/80 font-bold uppercase mb-6">Тур готов к старту</div>
        <div className="flex items-center gap-8 md:gap-16">
          {[{ t: home, s: myT }, { t: away, s: opT }].map(({ t, s }, i) => (
            <div key={t.id} className={`flex flex-col items-center gap-3 ${i ? 'order-3' : ''}`}>
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-2xl font-black shadow-2xl border-4" style={{ background: t.color, color: t.color2, borderColor: t.color2 }}>{t.short}</div>
              <div className="font-black text-lg text-center max-w-[200px] leading-tight">{t.name}</div>
              <div className="text-xs font-mono text-white/50">сила: {Math.round(s)}</div>
            </div>
          ))}
          <div className="order-2 text-5xl font-black italic text-white/25">VS</div>
        </div>
        <div className="mt-10 flex gap-4">
          <button onClick={() => setStarted(true)} className="px-8 py-4 rounded-2xl bg-lime-400 text-black font-black text-lg hover:bg-lime-300 transition shadow-[0_0_40px_-6px_#a3e635]">ВЫЙТИ НА ПОЛЕ</button>
          <button onClick={() => { setStarted(true); skipAll(); }} className="px-8 py-4 rounded-2xl bg-white/10 border border-white/15 font-bold hover:bg-white/15 transition flex items-center gap-2"><SkipForward size={18} /> Пропустить матч</button>
        </div>
        <p className="mt-6 text-white/40 text-sm max-w-md text-center">Во время матча следи за опасными моментами — в них ты решаешь всё сам: прицел, сила, тип удара.</p>
      </div>
    );
  }

  // ---------- full time ----------
  if (done) {
    const won = (plan.heroSide === 'home' ? done.hs > done.as : done.as > done.hs);
    const draw = done.hs === done.as;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#04120a] text-white p-6">
        <div className="text-xs tracking-[.3em] text-white/50 font-bold uppercase mb-4">Матч окончен</div>
        <div className="flex items-center gap-6 md:gap-10">
          <div className="text-center"><div className="text-sm text-white/60 mb-1 max-w-[160px]">{home.short}</div><div className="text-7xl font-black">{done.hs}</div></div>
          <div className="text-4xl text-white/30 font-black">:</div>
          <div className="text-center"><div className="text-sm text-white/60 mb-1 max-w-[160px]">{away.short}</div><div className="text-7xl font-black">{done.as}</div></div>
        </div>
        <div className={`mt-4 px-4 py-1.5 rounded-full text-sm font-black ${won ? 'bg-lime-400/20 text-lime-300' : draw ? 'bg-white/10 text-white/70' : 'bg-rose-500/20 text-rose-300'}`}>
          {won ? 'ПОБЕДА!' : draw ? 'НИЧЬЯ' : 'ПОРАЖЕНИЕ'}
        </div>
        <div className="mt-8 grid grid-cols-4 gap-3 w-full max-w-xl">
          {[['Голы', done.heroGoals], ['Пасы', done.heroAssists], ['Оценка', done.heroRating.toFixed(1)], ['Эфф.', `${Math.round((heroStats.att ? heroStats.conv / heroStats.att : 0) * 100)}%`]].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
              <div className="text-2xl font-black text-lime-300">{v}</div>
              <div className="text-[11px] text-white/50 mt-1 uppercase tracking-wider">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 w-full max-w-xl max-h-40 overflow-y-auto rounded-2xl bg-black/30 border border-white/10 p-4 space-y-1.5">
          {done.events.filter(e => e.important).map((e, i) => (
            <div key={i} className="text-sm text-white/80 flex gap-2"><span className="font-mono text-lime-400">{e.minute}'</span><span>{e.text}</span></div>
          ))}
        </div>
        <button onClick={() => onFinish(done)} className="mt-8 px-8 py-4 rounded-2xl bg-lime-400 text-black font-black text-lg hover:bg-lime-300 transition">ПРОДОЛЖИТЬ</button>
      </div>
    );
  }

  // ---------- live ----------
  return (
    <div className="min-h-screen bg-[#04120a] text-white flex flex-col">
      {/* scorebug */}
      <div className="flex items-center justify-center gap-4 py-3 bg-black/40 border-b border-white/10">
        <span className="font-black text-lg w-40 text-right truncate" style={{ color: home.color === '#f5f5f0' ? '#fff' : home.color }}>{home.short}</span>
        <span className="px-5 py-1 rounded-xl bg-white/10 font-black text-2xl tabular-nums">{score[0]} : {score[1]}</span>
        <span className="font-black text-lg w-40 truncate" style={{ color: away.color === '#f5f5f0' ? '#fff' : away.color }}>{away.short}</span>
        <span className="ml-4 font-mono text-lime-300 text-lg w-16">{Math.floor(minute)}'</span>
        <div className="flex gap-2">
          <button onClick={() => setPaused(p => !p)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20"><Play size={14} /></button>
          {[1, 2, 3].map(s => <button key={s} onClick={() => setSpeed(s)} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${speed === s ? 'bg-lime-400 text-black' : 'bg-white/10'}`}><FastForward size={12} className="inline" /> {s}x</button>)}
          <button onClick={skipAll} className="p-2 rounded-lg bg-white/10 hover:bg-white/20" title="Досмотреть до конца"><SkipForward size={14} /></button>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        <canvas ref={cvRef} width={960} height={540} className="w-full max-w-5xl rounded-2xl border-2 border-white/10 shadow-2xl" />
        <div ref={feedRef} className="w-full max-w-5xl h-36 overflow-y-auto rounded-2xl bg-black/30 border border-white/10 p-3 space-y-1">
          {feed.map((e, i) => (
            <div key={i} className={`text-sm flex gap-2 ${e.important ? 'text-white font-semibold' : 'text-white/45'}`}>
              <span className={`font-mono ${e.important ? 'text-lime-300' : 'text-white/30'}`}>{e.minute}'</span>
              <span>{e.text}</span>
              {e.important && <Goal size={14} className="text-lime-400 shrink-0 mt-0.5" />}
            </div>
          ))}
        </div>
      </div>
      {activeMoment && (activeMoment.kind === 'corner'
        ? <HeaderMoment moment={activeMoment} youRating={effectiveRating(hero)} heroName={hero.name} onDone={onMomentDone} />
        : <ShotMoment moment={activeMoment} youRating={effectiveRating(hero)} heroName={hero.name} onDone={onMomentDone} />)}
    </div>
  );
}
