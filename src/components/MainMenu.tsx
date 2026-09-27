import { useEffect, useState } from 'react';
import { Play, RotateCcw, Database, Goal, Users, Trophy } from 'lucide-react';
import { DB, teamColor } from '../game/core';

interface Props { hasSave: boolean; onNew: () => void; onContinue: () => void }

export default function MainMenu({ hasSave, onNew, onContinue }: Props) {
  const stars = [...DB.players].sort((a, b) => b.rt - a.rt).slice(0, 24);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 2600);
    return () => clearInterval(t);
  }, []);
  const s = stars[tick % stars.length];

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#04120a] text-white flex flex-col">
      {/* bg art */}
      <div className="absolute inset-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 55% at 50% -8%, #a3e63515, transparent 60%), radial-gradient(ellipse 60% 40% at 85% 110%, #16a34a22, transparent 60%), linear-gradient(180deg,#04120a 0%,#061a0e 50%,#04120a 100%)' }} />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[-30%] w-[150%] aspect-[2/1] rounded-[100%] border border-lime-300/10" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[-45%] w-[150%] aspect-[2/1] rounded-[100%] border border-lime-300/[.07]" />
        {[...Array(9)].map((_, i) => (
          <div key={i} className="absolute w-1 h-40 rotate-[24deg] bg-gradient-to-b from-lime-300/[.06] to-transparent" style={{ left: `${4 + i * 12}%`, top: '-4%', animation: `beam ${5 + i}s ease-in-out infinite alternate` }} />
        ))}
        <div className="absolute bottom-0 left-0 right-0 h-40" style={{ background: 'linear-gradient(180deg,transparent, #04120a)' }} />
      </div>
      <style>{`@keyframes beam { from { opacity:.3; transform: rotate(20deg) translateY(-6px) } to { opacity:1; transform: rotate(28deg) translateY(8px) } }`}</style>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold tracking-[.25em] text-lime-300/90 uppercase">
          <Database size={12} /> Реальные данные лиги RESA
        </div>
        <h1 className="text-[13vw] md:text-[7.5rem] leading-[.9] font-black italic tracking-tighter text-center">
          <span className="text-white">КАРЬЕРА</span>
          <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400" style={{ filter: 'drop-shadow(0 0 34px #a3e63555)' }}>ФУТБОЛИСТА</span>
        </h1>
        <p className="mt-5 max-w-xl text-center text-white/55 text-sm md:text-base leading-relaxed">
          Путь от Super League до элиты Tier 1A. 1400+ реальных игроков лиги RESA, их ранги, цены и статистика за сезоны S18–S23. Играй матчи, решай моменты сам — прицел, сила, закрутка — и становись легендой.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button onClick={onNew} className="group flex items-center gap-2.5 px-9 py-4 rounded-2xl bg-lime-400 text-black font-black text-lg hover:bg-lime-300 transition shadow-[0_0_50px_-8px_#a3e635]">
            <Play size={20} className="group-hover:scale-110 transition" /> НОВАЯ КАРЬЕРА
          </button>
          {hasSave && (
            <button onClick={onContinue} className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-white/8 border border-white/15 font-bold hover:bg-white/15 transition">
              <RotateCcw size={17} /> Продолжить
            </button>
          )}
        </div>
        {/* live star card */}
        <div className="mt-10 w-full max-w-md rounded-3xl border border-white/10 bg-black/40 backdrop-blur p-5">
          <div className="text-[10px] uppercase tracking-[.3em] text-white/40 font-bold mb-3">Звезда недели из базы S23</div>
          <div className="flex items-center gap-4" key={s.n} style={{ animation: 'fadein .5s ease' }}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${s.rk === 'X' ? 'bg-amber-400 text-black' : s.rk === 'A' ? 'bg-violet-400 text-black' : 'bg-sky-400 text-black'}`}>{s.rt}</div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-lg truncate">{s.n}</div>
              <div className="text-xs text-white/50">{s.tm || 'Free Agent'} • RANK {s.rk}</div>
              <div className="flex gap-0.5 mt-1.5" title="рейтинг по сезонам">
                {['s18', 's19', 's20', 's21', 's22'].map(y => {
                  const v = s.hs[y]?.rt; const top = s.rt;
                  return <span key={y} style={{ height: 8 + ((v ?? top * 0.8) - 55) * 0.75 + 'px' }} className="w-2 rounded-sm bg-lime-400/70 self-end" />;
                })}
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-lime-300">${((s.v || 0) / 1e6).toFixed(0)}M</div>
              <div className="text-[10px] text-white/40">цена S23</div>
            </div>
          </div>
        </div>
        <style>{`@keyframes fadein { from { opacity:0; transform: translateY(6px) } }`}</style>
        <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[11px] text-white/40 font-semibold">
          <span className="flex items-center gap-1.5"><Users size={12} className="text-lime-400/70" /> {DB.players.length} игроков</span>
          <span className="flex items-center gap-1.5"><Goal size={12} className="text-lime-400/70" /> 5 сезонов реальной статистики</span>
          <span className="flex items-center gap-1.5"><Trophy size={12} className="text-lime-400/70" /> 2 дивизиона • 12 клубов</span>
        </div>
      </div>
      {/* ticker */}
      <div className="relative border-t border-white/10 bg-black/50 overflow-hidden">
        <div className="flex whitespace-nowrap py-2.5" style={{ animation: 'mar 60s linear infinite' }}>
          {stars.concat(stars).map((p, i) => {
            const [c] = teamColor(p.tm || '');
            return (
              <span key={i} className="mx-5 text-xs font-bold flex items-center gap-2 shrink-0">
                <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                {p.n} <span className="font-mono text-white/35">{p.rt}</span>
                <span className="text-[10px] text-white/25">{['s18', 's19', 's20', 's21', 's22'].reduce((x, y) => x + (p.st[y]?.g ?? 0), 0)}г за 5 сезонов</span>
              </span>
            );
          })}
        </div>
        <style>{`@keyframes mar { to { transform: translateX(-50%) } }`}</style>
      </div>
    </div>
  );
}
