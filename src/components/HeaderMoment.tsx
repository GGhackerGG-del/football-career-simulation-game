import { useEffect, useRef, useState } from 'react';
import { resolveShot, type ShotOutcome } from '../game/career';
import type { KeyMoment } from '../game/types';

interface Props { moment: KeyMoment; youRating: number; heroName: string; onDone: (o: ShotOutcome) => void }

// corner: ball arcs in from left; press SPACE/click when marker is in the golden window; then header flies toward goal
export default function HeaderMoment({ moment, youRating, heroName, onDone }: Props) {
  const { distance, oppDef, oppGk } = moment;
  const diff = youRating - oppDef;
  const windowSize = Math.max(0.07, Math.min(0.22, 0.12 + diff * 0.004)); // golden zone width
  const [t, setT] = useState(0);          // 0..1 loop marker
  const [phase, setPhase] = useState<'swing' | 'flight' | 'result'>('swing');
  const [quality, setQuality] = useState(0.5);
  const [result, setResult] = useState<ShotOutcome | null>(null);
  const [ball, setBall] = useState({ x: 30, y: 90, hx: 380, hy: 240 });
  const raf = useRef(0);
  const dir = useRef(1);
  const pos = useRef(0);
  const speed = 0.9 + Math.max(0, (oppDef - youRating)) * 0.012; // faster vs strong defenders

  // swing loop
  useEffect(() => {
    if (phase !== 'swing') return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      pos.current += dir.current * dt * speed;
      if (pos.current > 1) { pos.current = 1; dir.current = -1; }
      if (pos.current < 0) { pos.current = 0; dir.current = 1; }
      setT(pos.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, speed]);

  const hit = () => {
    if (phase !== 'swing') return;
    const center = 0.62;
    const d = Math.abs(pos.current - center);
    const q = Math.max(0, 1 - d / (windowSize * 2.4)); // 0..1
    setQuality(q);
    setPhase('flight');
    cancelAnimationFrame(raf.current);
    const out = resolveShot({
      kind: 'corner', distance, aimX: Math.random(), aimY: 0.7, power: 0.7,
      shotType: 'normal', headerTiming: q, youRating, oppDef, oppGk, rng: Math.random,
    });
    // ball path: cross from left, header, then to goal
    const start = performance.now();
    const dur = 1500;
    const goalX = 610, goalY = q > 0.55 ? 130 : 100;
    const frame = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      let x, y;
      if (k < 0.5) { // cross coming in
        const kk = k / 0.5;
        x = 30 + (400 - 30) * kk;
        y = 60 + Math.sin(kk * Math.PI * 0.9) * -20 + kk * 200;
      } else { // header deflection
        const kk = (k - 0.5) / 0.5;
        const tx = out.outcome === 'goal' ? goalX : out.outcome === 'save' ? goalX - 24 : out.outcome === 'miss' ? goalX + 60 : goalX + 4;
        const ty = out.outcome === 'goal' ? goalY : out.outcome === 'save' ? goalY : out.outcome === 'miss' ? 90 : 128;
        x = 400 + (tx - 400) * kk;
        y = 240 + (ty - 240) * kk - Math.sin(kk * Math.PI) * 26;
      }
      setBall({ x, y, hx: 400, hy: 240 });
      if (k < 1) raf.current = requestAnimationFrame(frame);
      else { setResult(out.outcome); setPhase('result'); }
    };
    raf.current = requestAnimationFrame(frame);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); hit(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  useEffect(() => {
    if (phase !== 'result') return;
    const t2 = setTimeout(() => onDone(result!), 1900);
    return () => clearTimeout(t2);
  }, [phase]); // eslint-disable-line

  const RES_TXT: Record<ShotOutcome, [string, string]> = {
    goal: ['ГОЛ ГОЛОВОЙ!', `${heroName} вколачивает мяч в сетку!`],
    save: ['СЕЙВ!', 'Вратарь на месте'],
    block: ['БЛОК!', 'Защитник выносит мяч'],
    post: ['ШТАНГА!', 'Снаряд попадает в каркас!'],
    miss: ['МИМО!', 'Не попал по мячу как следует'],
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#04120a]/95 backdrop-blur-sm select-none" onClick={hit}>
      <div className="mb-2 flex items-center gap-3">
        <span className="px-3 py-1 rounded-full bg-amber-400 text-black text-xs font-black tracking-widest uppercase">Угловой!</span>
        <span className="text-amber-200/90 font-mono text-sm">подача в штрафную • добей головой</span>
      </div>
      <div className="relative w-[min(94vw,720px)] rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl cursor-pointer" style={{ aspectRatio: '720/420', background: 'linear-gradient(180deg,#0b3d1e 0%,#0f5a28 60%,#0c4b22 100%)' }}>
        <svg viewBox="0 0 720 420" className="absolute inset-0 w-full h-full">
          {[0, 1, 2, 3, 4].map(i => <rect key={i} x={i * 144} y="0" width="72" height="420" fill="#ffffff" opacity="0.035" />)}
          {/* side-view goal */}
          <rect x="596" y="60" width="10" height="240" fill="none" />
          <line x1="596" y1="300" x2="596" y2="78" stroke="#f8fafc" strokeWidth="7" />
          <line x1="596" y1="300" x2="690" y2="300" stroke="#f8fafc" strokeWidth="7" />
          <g stroke="#cbd5e1" strokeOpacity=".3">
            {[0, 1, 2, 3].map(i => <line key={i} x1={596} y1={90 + i * 55} x2={700} y2={90 + i * 55} strokeWidth="1.5" />)}
            {[0, 1, 2].map(i => <line key={'v' + i} x1={628 + i * 34} y1={78} x2={628 + i * 34} y2={300} strokeWidth="1.5" />)}
          </g>
          <line x1="596" y1="78" x2="700" y2="78" stroke="#f8fafc" strokeWidth="5" />
          {/* keeper in side view */}
          <g transform="translate(600,236)">
            <circle cx="0" cy="-46" r="10" fill="#d9a066" />
            <rect x="-10" y="-38" width="20" height="30" rx="8" fill="#f59e0b" />
          </g>
          {/* hero + defender jumping */}
          {phase !== 'swing' && (
            <ellipse cx="400" cy="210" rx="30" ry="44" fill="#a3e635" opacity=".14" />
          )}
          <g transform={`translate(388,${phase === 'flight' ? 200 - quality * 60 : 210})`}>
            <circle cx="0" cy="-46" r="10" fill="#8c5a33" />
            <rect x="-10" y="-38" width="20" height="30" rx="8" fill="#a3e635" />
          </g>
          <g transform={`translate(424,${phase === 'flight' ? 200 - Math.max(0, quality - 0.1) * 46 : 216})`}>
            <circle cx="0" cy="-46" r="10" fill="#eec39a" />
            <rect x="-10" y="-38" width="20" height="30" rx="8" fill="#dc2626" />
          </g>
          {/* ball */}
          <circle cx={ball.x} cy={phase === 'swing' ? 90 : ball.y} r="10" fill="#f8fafc" stroke="#111827" strokeWidth="1.4" />
          {phase === 'swing' && <text x="40" y="60" fill="#ffffff88" fontSize="13" fontFamily="monospace">подача по дуге…</text>}
        </svg>
        {phase === 'result' && result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35">
            <div className={`text-6xl font-black italic ${result === 'goal' ? 'text-lime-300' : 'text-white/90'}`} style={{ textShadow: '0 6px 30px rgba(0,0,0,.6)' }}>{RES_TXT[result][0]}</div>
            <div className="mt-1 text-white/80 text-sm">{RES_TXT[result][1]}</div>
          </div>
        )}
      </div>
      {/* timing bar */}
      <div className="mt-4 w-[min(94vw,560px)]">
        <div className="relative h-6 rounded-full bg-white/10 border border-white/10 overflow-hidden">
          <div className="absolute top-0 bottom-0 bg-amber-400/80" style={{ left: `${(0.62 - windowSize) * 100}%`, width: `${windowSize * 2 * 100}%` }} />
          <div className="absolute top-0 bottom-0 bg-yellow-300" style={{ left: `${0.615 * 100}%`, width: `1.4%` }} />
          <div className="absolute top-0 bottom-0 w-2.5 bg-white rounded-full shadow" style={{ left: `calc(${t * 100}% - 5px)` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-mono text-white/50">
          <span>жми ПРОБЕЛ / клик в жёлтой зоне</span>
          <span className={diff >= 0 ? 'text-lime-400' : 'text-rose-400'}>соперник по борьбе: {Math.round(oppDef)}</span>
        </div>
      </div>
    </div>
  );
}
