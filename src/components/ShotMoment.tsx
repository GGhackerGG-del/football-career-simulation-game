import { useEffect, useRef, useState, useCallback } from 'react';
import { CircleDot, Wind, Zap, ArrowUpRight, RotateCcw } from 'lucide-react';
import { resolveShot, type ShotOutcome } from '../game/career';
import type { KeyMoment } from '../game/types';

export type ShotType = 'normal' | 'curl' | 'knuckle' | 'chip';
const SHOT_TYPES: { id: ShotType; name: string; icon: any; hint: string }[] = [
  { id: 'normal', name: 'Силовой', icon: Zap, hint: 'Прямой и мощный' },
  { id: 'curl', name: 'Закрутка', icon: ArrowUpRight, hint: 'Обводит стенку и вратаря' },
  { id: 'knuckle', name: 'Наклбол', icon: Wind, hint: 'Дрожащая траектория' },
  { id: 'chip', name: 'Свеча', icon: CircleDot, hint: 'Перекинуть вратаря' },
];

interface Props { moment: KeyMoment; youRating: number; heroName: string; onDone: (o: ShotOutcome) => void }

const GX = 90, GW = 540, GY = 42, GH = 190; // goal rect
const BX = 360, BY = 430;

export default function ShotMoment({ moment, youRating, heroName, onDone }: Props) {
  const { kind, distance, oppDef, oppGk } = moment;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [aim, setAim] = useState({ x: BX, y: GY + GH * 0.35 });
  const [type, setType] = useState<ShotType>(kind === 'penalty' ? 'normal' : 'normal');
  const [curlDir, setCurlDir] = useState<-1 | 1>(1);
  const [phase, setPhase] = useState<'ready' | 'charging' | 'flight' | 'result'>('ready');
  const [power, setPower] = useState(0);
  const [result, setResult] = useState<ShotOutcome | null>(null);
  const [anim, setAnim] = useState({ bx: BX, by: BY, sx: 1, gkX: 360, gkRot: 0, gkY: 0, defJump: [0, 0], net: 0 });
  const st = useRef({ power: 0, dir: 1, raf: 0, outcome: null as ShotOutcome | null, b1: 0, b2: 0 });
  const defenders = kind === 'shot' ? (distance > 20 ? [{ x: 290, y: 288 }, { x: 428, y: 300 }] : [{ x: 336, y: 306 }])
    : kind === 'freekick' ? [{ x: 285, y: 296 }, { x: 343, y: 296 }, { x: 401, y: 296 }, { x: 459, y: 296 }]
    : [];
  const defCount = defenders.length;

  const diffs = { g: youRating - oppGk, d: youRating - oppDef };

  // aim from mouse
  const onMove = useCallback((e: React.MouseEvent) => {
    if (phase === 'flight' || phase === 'result') return;
    const r = wrapRef.current!.getBoundingClientRect();
    setAim({ x: Math.max(GX - 40, Math.min(GX + GW + 40, (e.clientX - r.left) * (720 / r.width))), y: Math.max(GY - 25, Math.min(GY + GH + 20, (e.clientY - r.top) * (500 / r.height))) });
  }, [phase]);

  const shoot = useCallback(() => {
    if (phase === 'flight' || phase === 'result') return;
    cancelAnimationFrame(st.current.raf);
    const p = st.current.power / 100;
    const aimX = (aim.x - GX) / GW, aimY = 1 - (aim.y - GY) / GH;
    const out = resolveShot({
      kind, distance, aimX, aimY, power: p, shotType: type, curlDir, youRating, oppDef, oppGk,
      rng: Math.random,
    });
    st.current.outcome = out.outcome;
    setPower(st.current.power);
    setPhase('flight');
  }, [phase, aim, kind, distance, type, curlDir, youRating, oppDef, oppGk]);

  // charge loop
  const chargeStart = () => {
    if (phase !== 'ready') return;
    setPhase('charging');
    st.current.power = 10; st.current.dir = 1;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000; last = t;
      st.current.power += st.current.dir * dt * 115;
      if (st.current.power >= 100) { st.current.power = 100; st.current.dir = -1; }
      if (st.current.power <= 8) { st.current.power = 8; st.current.dir = 1; }
      setPower(Math.round(st.current.power));
      st.current.raf = requestAnimationFrame(tick);
    };
    st.current.raf = requestAnimationFrame(tick);
  };

  // flight choreography
  useEffect(() => {
    if (phase !== 'flight') return;
    const outcome = st.current.outcome!;
    const p = st.current.power / 100;
    // final ball position by outcome
    let tx = aim.x, ty = aim.y;
    if (outcome === 'miss') { tx = aim.x + (aim.x < 360 ? -58 : 58) + Math.random() * 20; ty = aim.y + (Math.random() < .5 ? -14 : 8); }
    if (outcome === 'post') { tx = aim.x < 360 ? GX + 6 : GX + GW - 6; ty = aim.y > GY + GH - 30 ? GY + GH - 4 : ty; }
    if (outcome === 'save') { /* ball goes to keeper */ }
    if (outcome === 'block') { /* stops at defender */ }
    const bd = defCount && outcome === 'block' ? defenders[Math.floor(Math.random() * defCount)] : null;
    if (bd) { tx = bd.x + 8; ty = bd.y - 44; }
    // keeper target
    let gkTarget = tx;
    if (outcome === 'goal' || outcome === 'post') {
      const wrong = (360 + (360 - tx)) + (Math.random() * 60 - 30) * (diffs.g > 12 ? 1.6 : 0.8);
      gkTarget = Math.max(GX + 20, Math.min(GX + GW - 20, wrong));
    }
    if (outcome === 'miss') gkTarget = Math.max(GX + 20, Math.min(GX + GW - 20, tx * 0.6 + 144));
    const dur = 620 - p * 160;
    const t0 = performance.now();
    const curl = type === 'curl' ? curlDir * (54 + p * 50) : 0;
    let caught = false;
    const frame = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = k;
      let x = BX + (tx - BX) * e, y = BY + (ty - BY) * e;
      // curves
      if (type === 'curl') x += Math.sin(Math.PI * e) * -curl;
      if (type === 'knuckle') x += Math.sin(e * 16) * 7 * (1 - e);
      if (type === 'chip') y -= Math.sin(Math.PI * e) * 120;
      const scale = 1 - e * 0.55;
      // keeper dive
      const kk = Math.max(0, (k - 0.14) / 0.8);
      const gkX = 360 + (gkTarget - 360) * Math.min(1, kk);
      const gkRot = (gkTarget - 360) * 0.0016 * Math.min(1, kk) * 55;
      const gkY = -Math.abs(Math.sin(Math.min(1, kk) * Math.PI)) * 16;
      const defJump = defenders.map((d, i) => (outcome === 'block' ? Math.abs(d.x - 360) < 130 : i === 0 && k > 0.3) ? Math.sin(Math.min(1, k * 1.6) * Math.PI) * -30 : 0);
      // save catch
      let fx = x, fy = y, fs = scale;
      if (outcome === 'save' && k > 0.72) {
        if (!caught) { caught = true; }
        const ck = (k - 0.72) / 0.28;
        fx = x + (gkX - x) * ck; fy = y + ((GY + GH * 0.45 + gkY) - y) * ck; fs = scale * (1 - ck * 0.3);
      }
      const net = outcome === 'goal' && k > 0.86 ? 1 : 0;
      setAnim({ bx: fx, by: fy, sx: fs, gkX, gkRot, gkY, defJump: [defJump[0] ?? 0, defJump[1] ?? 0, defJump[2] ?? 0, defJump[3] ?? 0], net });
      if (k < 1) st.current.raf = requestAnimationFrame(frame);
      else { setResult(outcome); setPhase('result'); }
    };
    st.current.raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(st.current.raf);
  }, [phase]); // eslint-disable-line

  useEffect(() => {
    if (phase !== 'result') return;
    const t = setTimeout(() => onDone(result!), 1900);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line

  // keyboard
  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); chargeStart(); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); if (phase === 'charging') shoot(); } };
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, [phase, shoot]);

  const RES_TXT: Record<ShotOutcome, [string, string]> = {
    goal: ['ГОЛ!!!', `${heroName} забивает с ${distance} метров!`],
    save: ['СЕЙВ!', 'Вратарь тянет этот удар...'],
    block: ['БЛОК!', 'Защитник бросился под мяч'],
    post: ['ШТАНГА!', 'Каркас ворот спасает!'],
    miss: ['МИМО!', 'Мяч уходит в сторону'],
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#04120a]/95 backdrop-blur-sm select-none">
      <div className="mb-2 flex items-center gap-3">
        <span className="px-3 py-1 rounded-full bg-lime-400 text-black text-xs font-black tracking-widest uppercase">
          {kind === 'penalty' ? 'Пенальти!' : kind === 'freekick' ? 'Штрафной удар!' : 'Опасный момент!'}
        </span>
        <span className="text-lime-300/90 font-mono text-sm">дистанция: {distance} м</span>
      </div>
      <div className="mb-2 flex gap-4 text-[11px] font-mono">
        <span className={diffs.d >= 0 ? 'text-lime-400' : 'text-rose-400'}>Защита {Math.round(oppDef)} {diffs.d >= 0 ? '▼ слабее тебя' : '▲ сильнее тебя'}</span>
        <span className={diffs.g >= 0 ? 'text-lime-400' : 'text-rose-400'}>Вратарь {Math.round(oppGk)} {diffs.g >= 0 ? '▼' : '▲'}</span>
      </div>

      <div ref={wrapRef} onMouseMove={onMove}
        onMouseDown={chargeStart} onMouseUp={() => phase === 'charging' && shoot()}
        className="relative w-[min(94vw,720px)] rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl" style={{ aspectRatio: '720/500', background: 'linear-gradient(180deg,#0b3d1e 0%,#0f5a28 55%,#0c4b22 100%)', cursor: 'crosshair' }}>
        <svg viewBox="0 0 720 500" className="absolute inset-0 w-full h-full">
          {/* stripes */}
          {[0, 1, 2, 3, 4].map(i => <rect key={i} x={i * 144} y="0" width="72" height="500" fill="#ffffff" opacity="0.035" />)}
          {/* penalty box lines */}
          <rect x="150" y="330" width="420" height="170" fill="none" stroke="#ffffff" strokeOpacity=".35" strokeWidth="3" />
          <rect x="250" y="330" width="220" height="70" fill="none" stroke="#ffffff" strokeOpacity=".35" strokeWidth="3" />
          <ellipse cx="360" cy="330" rx="80" ry="26" fill="none" stroke="#ffffff" strokeOpacity=".35" strokeWidth="3" />
          {/* goal net back */}
          <rect x={GX - 14} y={GY - 14} width={GW + 28} height={GH + 14} fill="none" stroke="#e5e7eb" strokeOpacity=".5" strokeWidth="2" />
          <g stroke="#cbd5e1" strokeOpacity=".22">
            {Array.from({ length: 17 }, (_, i) => <line key={i} x1={GX + i * (GW / 16)} y1={GY - 12} x2={GX + i * (GW / 16)} y2={GY + GH} strokeWidth="1" />)}
            {Array.from({ length: 8 }, (_, i) => <line key={i} x1={GX - 12} y1={GY + i * (GH / 7)} x2={GX + GW + 12} y2={GY + i * (GH / 7)} strokeWidth="1" />)}
          </g>
          {/* goal frame */}
          <rect x={GX} y={GY} width={GW} height={GH} fill="rgba(4,20,10,.4)" stroke="#f8fafc" strokeWidth="7" />
          {/* net bulge */}
          {anim.net > 0 && <ellipse cx={anim.bx} cy={anim.by} rx="34" ry="10" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" />}
          {/* defenders */}
          {defenders.map((d, i) => (
            <g key={i} transform={`translate(${d.x},${d.y + (anim.defJump[i] || 0)}) scale(1.18)`}>
              <circle cx="0" cy="-34" r="9" fill="#26282e" />
              <rect x="-9" y="-26" width="18" height="30" rx="7" fill="#dc2626" />
              <rect x="-6" y="4" width="5" height="16" rx="2" fill="#26282e" /><rect x="1" y="4" width="5" height="16" rx="2" fill="#26282e" />
              <rect x="-15" y={-24 + Math.min(0, (anim.defJump[i] || 0) * 0.7)} width="6" height="20" rx="3" fill="#dc2626" />
              <rect x="9" y={-24 + Math.min(0, (anim.defJump[i] || 0) * 0.7)} width="6" height="20" rx="3" fill="#dc2626" />
            </g>
          ))}
          {/* keeper */}
          <g transform={`translate(${anim.gkX},${GY + GH - 8 + anim.gkY}) rotate(${anim.gkRot})`}>
            <circle cx="0" cy="-58" r="11" fill="#d9a066" />
            <rect x="-12" y="-50" width="24" height="36" rx="9" fill="#f59e0b" />
            <rect x="-24" y="-48" width="9" height="26" rx="4.5" fill="#f59e0b" transform={`rotate(${-18 - anim.gkRot * 0.8} -12 -46)`} />
            <rect x="15" y="-48" width="9" height="26" rx="4.5" fill="#f59e0b" transform={`rotate(${18 - anim.gkRot * 0.8} 12 -46)`} />
            <rect x="-9" y="-14" width="7" height="18" rx="3" fill="#1f2937" /><rect x="2" y="-14" width="7" height="18" rx="3" fill="#1f2937" />
          </g>
          {/* aim crosshair */}
          {(phase === 'ready' || phase === 'charging') && (
            <g transform={`translate(${aim.x},${aim.y})`} opacity=".95">
              <circle r="13" fill="none" stroke={type === 'curl' ? '#7dd3fc' : '#a3e635'} strokeWidth="2.4" strokeDasharray="4 3" />
              <line x1="-19" y1="0" x2="-7" y2="0" stroke="#a3e635" strokeWidth="2.4" />
              <line x1="7" y1="0" x2="19" y2="0" stroke="#a3e635" strokeWidth="2.4" />
              <line x1="0" y1="-19" x2="0" y2="-7" stroke="#a3e635" strokeWidth="2.4" />
              <line x1="0" y1="7" x2="0" y2="19" stroke="#a3e635" strokeWidth="2.4" />
            </g>
          )}
          {/* ball */}
          <g transform={`translate(${phase === 'flight' || phase === 'result' ? anim.bx : BX},${phase === 'flight' || phase === 'result' ? anim.by : BY}) scale(${phase === 'flight' || phase === 'result' ? anim.sx : 1})`}>
            <circle r="11" fill="#f8fafc" stroke="#111827" strokeWidth="1.4" />
            <path d="M0 -7 L5 -1 L0 3 L-5 -1 Z" fill="#111827" />
          </g>
        </svg>

        {/* result overlay */}
        {phase === 'result' && result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35">
            <div className={`text-6xl font-black tracking-tight italic ${result === 'goal' ? 'text-lime-300' : 'text-white/90'}`} style={{ textShadow: '0 6px 30px rgba(0,0,0,.6)' }}>{RES_TXT[result][0]}</div>
            <div className="mt-1 text-white/80 text-sm font-medium">{RES_TXT[result][1]}</div>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="mt-3 flex items-center gap-3">
        {kind !== 'penalty' && SHOT_TYPES.map(s => (
          <button key={s.id} onClick={() => setType(s.id)} disabled={phase === 'flight' || phase === 'result'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition ${type === s.id ? 'bg-lime-400 text-black border-lime-300' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}>
            <s.icon size={14} /> {s.name}
          </button>
        ))}
        {type === 'curl' && (
          <button onClick={() => setCurlDir(d => d === 1 ? -1 : 1)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-sky-400/20 text-sky-300 border border-sky-400/40">
            <RotateCcw size={13} /> {curlDir === 1 ? 'вправо →' : '← влево'}
          </button>
        )}
      </div>
      <div className="mt-3 w-[min(94vw,720px)] flex items-center gap-3">
        <div className="h-3 flex-1 rounded-full bg-white/10 overflow-hidden border border-white/10">
          <div className="h-full rounded-full transition-none" style={{ width: `${power}%`, background: power > 92 ? '#ef4444' : power > 62 ? '#a3e635' : '#38bdf8' }} />
        </div>
        <span className="text-xs font-mono text-white/60 w-24 text-right">{phase === 'ready' ? 'ЗАЖМИ для силы' : phase === 'charging' ? `${power}% — отпускай!` : ' '}</span>
      </div>
      <p className="mt-2 text-[11px] text-white/40">Наведи прицел мышью • зажми кнопку (или ПРОБЕЛ) для набора силы • отпусти — удар</p>
    </div>
  );
}
