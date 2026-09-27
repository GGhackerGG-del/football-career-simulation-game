import { Trophy, Medal, Crown, ChevronRight, Star } from 'lucide-react';
import type { World } from '../game/core';
import { teamColor } from '../game/core';
import type { Hero } from '../game/types';

interface Props { world: World; hero: Hero; season: number; onNext: () => void }

export default function SeasonEnd({ world, hero, season, onNext }: Props) {
  const tables = [1, 2].map(tier =>
    [...world.teams.filter(t => t.tier === tier)].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga))
  );
  const all = [...world.players.filter(x => x.id !== hero.id), hero];
  const scorer = [...all].sort((a, b) => b.goals - a.goals)[0];
  const assister = [...all].sort((a, b) => b.assists - a.assists)[0];
  const mvp = [...all].sort((a, b) => b.motm - a.motm)[0];
  const myPos = (() => {
    const t = tables[(world.teams.find(x => x.id === hero.teamId)?.tier ?? 2) - 1];
    return t.findIndex(x => x.id === hero.teamId) + 1;
  })();
  const champ1 = tables[0][0], champ2 = tables[1][0];

  return (
    <div className="min-h-screen bg-[#04120a] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse at 50% -10%, #a3e63533, transparent 55%)' }} />
      <div className="relative text-center">
        <div className="text-xs tracking-[.35em] text-white/50 font-bold uppercase mb-2">Сезон S{22 + season} завершен</div>
        <h1 className="text-5xl md:text-6xl font-black italic mb-10">ИТОГИ СЕЗОНА</h1>
        <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto mb-6">
          {[champ1, champ2].map((c, i) => (
            <div key={c.id} className="rounded-3xl border border-amber-400/40 bg-amber-400/10 p-6 flex items-center gap-4">
              <Trophy className="text-amber-300 shrink-0" size={34} />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-widest text-amber-200/70 font-bold">{i === 0 ? 'Чемпион Tier 1A' : 'Чемпион RES Super League'}</div>
                <div className="font-black text-xl">{c.name}</div>
                <div className="text-xs text-white/50 font-mono">{c.pts} очков • {c.gf}:{c.ga}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
          {[[scorer, 'Лучший бомбардир', 'goals', Crown], [assister, 'Лучший ассистент', 'assists', Medal], [mvp, 'MVP по MOTM', 'motm', Star]].map(([pl, title, k, I]: any) => (
            <div key={title} className={`rounded-2xl border p-5 text-left ${pl.id === hero.id ? 'border-lime-400/60 bg-lime-400/10' : 'border-white/10 bg-white/[.04]'}`}>
              <I size={20} className="text-lime-300 mb-2" />
              <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold">{title}</div>
              <div className="font-black text-lg truncate">{pl.name}{pl.id === hero.id && ' (ТЫ)'}</div>
              <div className="font-mono text-lime-300 font-black">{pl[k]}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5 max-w-3xl mx-auto mb-8 text-left">
          <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-2">Твой сезон</div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm">
            <span>место клуба: <b className="text-lime-300">{myPos}</b></span>
            <span>матчи: <b>{hero.apps}</b></span>
            <span>голы: <b className="text-lime-300">{hero.goals}</b></span>
            <span>пасы: <b>{hero.assists}</b></span>
            <span>MOTM: <b>{hero.motm}</b></span>
            <span>ср. оценка: <b>{hero.apps ? (hero.ratingSum / hero.apps).toFixed(1) : '—'}</b></span>
          </div>
        </div>
        <button onClick={onNext} className="px-10 py-4 rounded-2xl bg-lime-400 text-black font-black text-lg hover:bg-lime-300 transition shadow-[0_0_44px_-8px_#a3e635] inline-flex items-center gap-2">
          НАЧАТЬ СЕЗОН S{23 + season} <ChevronRight />
        </button>
        <p className="mt-4 text-xs text-white/40">Игроки постареют, рейтинги изменятся, пройдут летние трансферы — включая переходы звезд между клубами.</p>
      </div>
      {tables.length > 0 && <div className="hidden" style={{borderColor: teamColor(champ1.id)[0]}} />}
    </div>
  );
}
