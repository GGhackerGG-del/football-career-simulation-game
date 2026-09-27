import { useMemo, useState } from 'react';
import { Search, Sparkles, User, ChevronRight, Check, Shirt, Dices } from 'lucide-react';
import { DB, mulberry, hash, ri, genAttrs, ratingFromAttrs, rankOf, fmtM, teamColor } from '../game/core';
import type { Hero, Appearance, Pos, Attrs } from '../game/types';
import Avatar, { SKINS, HAIRC, BOOTS, HAIR_NAMES, BEARD_NAMES } from './Avatar';

export const randAppearance = (seed: string): Appearance => {
  const r = mulberry(hash(seed));
  return { skin: ri(r, 0, 5), hair: ri(r, 1, 7), hairColor: ri(r, 0, 7), beard: ri(r, 0, 2), tattoo: ri(r, 0, 3) as Appearance['tattoo'], tucked: r() < 0.5, longSleeves: r() < 0.4, longSocks: r() < 0.55, tape: r() < 0.35, bootColor: ri(r, 0, 7), number: ri(r, 1, 99) };
};

const POS_NAMES: Record<Pos, string> = { ST: 'Нападающий', W: 'Вингер', CAM: 'Плеймейкер' };
const ATTR_NAMES: Record<keyof Attrs, string> = { pac: 'Скорость', sho: 'Удар', pas: 'Пас', dri: 'Дриблинг', def: 'Отбор', phy: 'Физика', gk: 'Вратарь' };
const SHOW_ATTRS: (keyof Attrs)[] = ['pac', 'sho', 'pas', 'dri', 'phy'];

export function AppearanceControls({ ap, onChange }: { ap: Appearance; onChange: (a: Appearance) => void }) {
  const set = (p: Partial<Appearance>) => onChange({ ...ap, ...p });
  const Row = ({ label, children }: any) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/55 w-32 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5 justify-end">{children}</div>
    </div>
  );
  const Sw = ({ c, sel, onClick }: any) => (
    <button onClick={onClick} className="w-7 h-7 rounded-lg border-2 transition" style={{ background: c, borderColor: sel ? '#a3e635' : 'rgba(255,255,255,.12)' }} />
  );
  const Tog = ({ on, onClick, children }: any) => (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${on ? 'bg-lime-400 text-black border-lime-300' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}>{children}</button>
  );
  return (
    <div className="space-y-0.5">
      <Row label="Цвет кожи">{SKINS.map((c, i) => <Sw key={i} c={c} sel={ap.skin === i} onClick={() => set({ skin: i })} />)}</Row>
      <Row label="Прическа">{HAIR_NAMES.map((n, i) => <Tog key={i} on={ap.hair === i} onClick={() => set({ hair: i })}>{n}</Tog>)}</Row>
      <Row label="Цвет волос">{HAIRC.map((c, i) => <Sw key={i} c={c} sel={ap.hairColor === i} onClick={() => set({ hairColor: i })} />)}</Row>
      <Row label="Борода">{BEARD_NAMES.map((n, i) => <Tog key={i} on={ap.beard === i} onClick={() => set({ beard: i })}>{n}</Tog>)}</Row>
      <Row label="Татуировки">{['Нет', 'Лев. рукав', 'Прав. рукав', 'Оба рукава'].map((n, i) => <Tog key={i} on={ap.tattoo === i} onClick={() => set({ tattoo: i as any })}>{n}</Tog>)}</Row>
      <Row label="Футболка"><Tog on={ap.tucked} onClick={() => set({ tucked: true })}>Заправлена</Tog><Tog on={!ap.tucked} onClick={() => set({ tucked: false })}>Навыпуск</Tog></Row>
      <Row label="Рукава"><Tog on={!ap.longSleeves} onClick={() => set({ longSleeves: false })}>Короткие</Tog><Tog on={ap.longSleeves} onClick={() => set({ longSleeves: true })}>Длинные</Tog></Row>
      <Row label="Гетры"><Tog on={!ap.longSocks} onClick={() => set({ longSocks: false })}>Короткие</Tog><Tog on={ap.longSocks} onClick={() => set({ longSocks: true })}>Длинные</Tog></Row>
      <Row label="Тейп на запястье"><Tog on={ap.tape} onClick={() => set({ tape: !ap.tape })}>{ap.tape ? 'Есть' : 'Нет'}</Tog></Row>
      <Row label="Бутсы">{BOOTS.map((c, i) => <Sw key={i} c={c} sel={ap.bootColor === i} onClick={() => set({ bootColor: i })} />)}</Row>
      <Row label="Номер">
        <button onClick={() => set({ number: Math.max(1, ap.number - 1) })} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-bold">−</button>
        <span className="px-3 py-1 rounded-lg bg-white/10 text-sm font-black w-12 text-center">{ap.number}</span>
        <button onClick={() => set({ number: Math.min(99, ap.number + 1) })} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-bold">+</button>
      </Row>
    </div>
  );
}

interface Props {
  onStart: (hero: Hero, pickedExistingId: string | null) => void;
  tier2Teams: { id: string; name: string }[];
}

export default function CreatePlayer({ onStart, tier2Teams }: Props) {
  const [mode, setMode] = useState<'create' | 'pick'>('create');
  const [name, setName] = useState('');
  const [age, setAge] = useState(19);
  const [pos, setPos] = useState<Pos>('ST');
  const [pts, setPts] = useState(46);
  const [attrs, setAttrs] = useState<Attrs>(() => ({ pac: 66, sho: 70, pas: 62, dri: 68, def: 40, phy: 62, gk: 40 }));
  const [ap, setAp] = useState<Appearance>(() => randAppearance('you' + Math.random()));
  const [club, setClub] = useState(tier2Teams[0]?.id ?? '');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const candidates = useMemo(() => {
    const list = [...DB.players].sort((a, b) => b.rt - a.rt);
    const f = q.trim().toLowerCase();
    return (f ? list.filter(p => p.n.toLowerCase().includes(f)) : list).slice(0, 60);
  }, [q]);
  const pickedDB = useMemo(() => DB.players.find(p => p.n.toLowerCase() === picked?.toLowerCase()), [picked]);

  const ovr = ratingFromAttrs(attrs, pos);
  const changeAttr = (k: keyof Attrs, d: number) => {
    const v = attrs[k] + d;
    if (v < 45 || v > 92) return;
    if (d > 0 && pts <= 0) return;
    setAttrs({ ...attrs, [k]: v });
    setPts(p => p - d);
  };

  const startCreate = () => {
    const nm = name.trim() || 'Новая Легенда';
    const hero: Hero = {
      id: 'me:' + nm.toLowerCase(), name: nm, age, rating: ovr, rank: rankOf(ovr),
      value: Math.round((ovr - 50) * 1.4e6 / 1e5) * 1e5, teamId: club, attrs, pos,
      apps: 0, goals: 0, assists: 0, motm: 0, ratingSum: 0, history: [],
      morale: 78, energy: 100, created: true, appearance: ap, careerG: 0, careerA: 0, careerApps: 0, xp: 0, season: 0,
    };
    onStart(hero, null);
  };
  const startPick = () => {
    if (!pickedDB) return;
    const r = mulberry(hash(pickedDB.n));
    const hero: Hero = {
      id: 'db:' + pickedDB.n.toLowerCase(), name: pickedDB.n, age: ri(r, 20, 27), rating: pickedDB.rt,
      rank: rankOf(pickedDB.rt), value: pickedDB.v,
      teamId: DB.t1.includes(pickedDB.tm) ? pickedDB.tm : club,
      attrs: genAttrs(r, pickedDB.rt, pos), pos,
      apps: 0, goals: 0, assists: 0, motm: 0, ratingSum: 0,
      history: [], morale: 80, energy: 100,
      created: false, appearance: ap, careerG: 0, careerA: 0, careerApps: 0, xp: 0, season: 0,
    };
    onStart(hero, hero.id);
  };

  const [c1, c2] = teamColor(mode === 'pick' && pickedDB && DB.t1.includes(pickedDB.tm) ? pickedDB.tm : club);

  return (
    <div className="min-h-screen bg-[#04120a] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shirt className="text-lime-400" />
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tight">{mode === 'create' ? 'СОЗДАЙ СВОЮ ЛЕГЕНДУ' : 'ВЫБЕРИ ФУТБОЛИСТА'}</h1>
        </div>
        <div className="flex gap-2 mb-6">
          {[['create', 'Свой игрок', Sparkles], ['pick', 'Из базы RESA', User]].map(([m, l, I]: any) => (
            <button key={m} onClick={() => { setMode(m); setStep(0); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border transition ${mode === m ? 'bg-lime-400 text-black border-lime-300' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}><I size={15} /> {l}</button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-5">
            {mode === 'pick' && step === 0 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-2 bg-black/40 rounded-xl px-3 py-2.5 border border-white/10 mb-3">
                  <Search size={16} className="text-white/40" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по нику… (17shka, Maluzur, ogb2)" className="bg-transparent outline-none text-sm flex-1 placeholder:text-white/25" />
                </div>
                <div className="max-h-[46vh] overflow-y-auto space-y-1 pr-1">
                  {candidates.map(p => {
                    const h = ['s18', 's19', 's20', 's21', 's22'].map(s => p.hs[s]?.rt ?? null);
                    const gg = ['s18', 's19', 's20', 's21', 's22'].reduce((s, y) => s + (p.st[y]?.g ?? 0), 0);
                    return (
                      <button key={p.n} onClick={() => setPicked(p.n)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${picked === p.n ? 'bg-lime-400/10 border-lime-400/60' : 'bg-white/[.03] border-white/5 hover:bg-white/[.07]'}`}>
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${p.rk === 'X' ? 'bg-amber-400 text-black' : p.rk === 'A' ? 'bg-violet-400 text-black' : p.rk === 'B' ? 'bg-sky-400 text-black' : 'bg-white/15 text-white'}`}>{p.rt}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-bold truncate">{p.n} {picked === p.n && <Check size={14} className="inline text-lime-400" />}</span>
                          <span className="block text-[11px] text-white/45 truncate">{p.tm || 'Свободный агент'} • {fmtM(p.v)} • всего голов в базе: {gg}</span>
                        </span>
                        <span className="flex items-end gap-0.5" title="рейтинг по сезонам S18→S22">
                          {h.map((v, i) => <span key={i} className="w-1.5 rounded-sm bg-lime-400/70" style={{ height: 6 + ((v ?? 55) - 55) * 0.8 + 'px', opacity: v ? 1 : 0.15 }} />)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button disabled={!pickedDB} onClick={() => setStep(1)} className="mt-4 w-full py-3 rounded-xl bg-lime-400 text-black font-black disabled:opacity-30 flex items-center justify-center gap-1">Далее — внешность <ChevronRight size={16} /></button>
              </div>
            )}

            {((mode === 'create' && step === 0) || (mode === 'pick' && step === 1)) && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                {mode === 'pick' && pickedDB && (
                  <div className="mb-4 text-sm text-white/60">Играешь за <b className="text-lime-300">{pickedDB.n}</b> • рейтинг {pickedDB.rt} • цена {fmtM(pickedDB.v)}</div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-black text-lg uppercase tracking-wide">Внешность и форма</h3>
                  <button onClick={() => setAp(randAppearance(Math.random() + ''))} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"><Dices size={13} /> Случайно</button>
                </div>
                <AppearanceControls ap={ap} onChange={setAp} />
                <div className="mt-4 flex gap-2 justify-end">
                  {mode === 'pick' && <button onClick={() => setStep(0)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold text-sm">Назад</button>}
                  <button onClick={() => setStep(mode === 'create' ? 1 : 2)} className="px-5 py-2.5 rounded-xl bg-lime-400 text-black font-black text-sm flex items-center gap-1">Далее <ChevronRight size={15} /></button>
                </div>
              </div>
            )}

            {((mode === 'create' && step === 1) || (mode === 'pick' && step === 2)) && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                {mode === 'create' ? (
                  <>
                    <h3 className="font-black text-lg uppercase tracking-wide mb-4">Профиль</h3>
                    <div className="grid md:grid-cols-2 gap-4 mb-5">
                      <div>
                        <label className="text-xs text-white/50 block mb-1.5">Игровой ник</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="например: shadowstriker" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-lime-400/60 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-white/50 block mb-1.5">Возраст: {age} лет</label>
                        <input type="range" min={16} max={24} value={age} onChange={e => setAge(+e.target.value)} className="w-full accent-lime-400 mt-3" />
                        <div className="text-[11px] text-white/35 mt-1">Молодые растут быстрее, но стартуют слабее</div>
                      </div>
                    </div>
                    <div className="mb-5">
                      <label className="text-xs text-white/50 block mb-2">Позиция</label>
                      <div className="flex gap-2 flex-wrap">
                        {(Object.keys(POS_NAMES) as Pos[]).map(p => (
                          <button key={p} onClick={() => setPos(p)} className={`px-4 py-2.5 rounded-xl border font-bold text-sm transition ${pos === p ? 'bg-lime-400 text-black border-lime-300' : 'bg-white/5 border-white/10'}`}>{POS_NAMES[p]}</button>
                        ))}
                      </div>
                    </div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs text-white/50">Распредели очки навыков</label>
                      <span className="text-sm font-black text-lime-300">Осталось: {pts}</span>
                    </div>
                    <div className="space-y-2">
                      {SHOW_ATTRS.map(k => (
                        <div key={k} className="flex items-center gap-3">
                          <span className="w-24 text-xs text-white/60">{ATTR_NAMES[k]}</span>
                          <button onClick={() => changeAttr(k, -2)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 font-black">−</button>
                          <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-lime-500 to-lime-300" style={{ width: `${attrs[k]}%` }} />
                          </div>
                          <span className="w-8 text-right font-black text-sm">{attrs[k]}</span>
                          <button onClick={() => changeAttr(k, 2)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 font-black">+</button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-wide mb-3">Позиция на поле</h3>
                    <div className="flex gap-2 flex-wrap">
                      {(Object.keys(POS_NAMES) as Pos[]).map(p => (
                        <button key={p} onClick={() => setPos(p)} className={`px-4 py-2.5 rounded-xl border font-bold text-sm transition ${pos === p ? 'bg-lime-400 text-black border-lime-300' : 'bg-white/5 border-white/10'}`}>{POS_NAMES[p]}</button>
                      ))}
                    </div>
                    <p className="text-xs text-white/40 mt-3">Реальные достижения игрока сохранятся в истории карьеры.</p>
                  </div>
                )}
                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep(mode === 'create' ? 0 : 1)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold text-sm">Назад</button>
                  <button onClick={() => setStep(mode === 'create' ? 2 : 3)} className="px-5 py-2.5 rounded-xl bg-lime-400 text-black font-black text-sm">Далее</button>
                </div>
              </div>
            )}

            {((mode === 'create' && step === 2) || (mode === 'pick' && step === 3)) && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="font-black text-lg uppercase tracking-wide mb-1">{mode === 'pick' && pickedDB && DB.t1.includes(pickedDB.tm) ? 'Твой клуб' : 'Стартовый клуб — RES Super League'}</h3>
                <p className="text-xs text-white/40 mb-4">{mode === 'pick' && pickedDB && DB.t1.includes(pickedDB.tm) ? 'По базе S22 ты в составе Tier 1A:' : 'Начни снизу и пробейся в элитный Tier 1A через трансферы'}</p>
                {mode === 'pick' && pickedDB && DB.t1.includes(pickedDB.tm) ? (
                  <div className="flex items-center gap-4 p-4 rounded-2xl border-2 border-lime-400/50 bg-lime-400/5">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-lg border-4" style={{ background: c1, color: c2, borderColor: c2 }}>{teamColor(pickedDB.tm)[2]}</div>
                    <div><div className="font-black text-lg">{pickedDB.tm}</div><div className="text-xs text-white/50">Tier 1A • по данным Season 22 HUB</div></div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {tier2Teams.map(t => {
                      const [a, b, sh] = teamColor(t.id);
                      return (
                        <button key={t.id} onClick={() => setClub(t.id)} className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition text-left ${club === t.id ? 'border-lime-400/70 bg-lime-400/10' : 'border-white/10 bg-white/[.03] hover:bg-white/[.07]'}`}>
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs border-2 shrink-0" style={{ background: a, color: b, borderColor: b }}>{sh}</div>
                          <div><div className="font-bold text-sm">{t.name}</div><div className="text-[11px] text-white/45">RES Super League</div></div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep(mode === 'create' ? 1 : 2)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold text-sm">Назад</button>
                  <button onClick={mode === 'create' ? startCreate : startPick} className="px-8 py-3 rounded-xl bg-lime-400 text-black font-black shadow-[0_0_30px_-4px_#a3e635] hover:bg-lime-300 transition">НАЧАТЬ КАРЬЕРУ</button>
                </div>
              </div>
            )}
          </div>

          {/* live preview */}
          <div className="lg:sticky lg:top-6 self-start rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.06] to-transparent p-6 flex flex-col items-center">
            <div className="text-[11px] tracking-[.3em] text-white/40 font-bold uppercase mb-4">Превью</div>
            <div className="rounded-3xl p-6" style={{ background: `radial-gradient(circle at 50% 20%, ${c1}22, transparent 70%)` }}>
              <Avatar ap={ap} c1={c1} c2={c2} size={210} />
            </div>
            <div className="mt-3 text-center">
              <div className="font-black text-lg">{mode === 'pick' && pickedDB ? pickedDB.n : (name.trim() || 'Новая Легенда')}</div>
              <div className="text-xs text-white/50">{POS_NAMES[pos]} • OVR <b className="text-lime-300">{mode === 'pick' && pickedDB ? pickedDB.rt : ovr}</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
