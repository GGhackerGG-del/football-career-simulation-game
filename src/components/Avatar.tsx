import type { Appearance } from '../game/types';

export const SKINS = ['#f6d7b8', '#eec39a', '#d9a066', '#b07a4b', '#8c5a33', '#5f3d22'];
export const HAIRC = ['#191410', '#3a2417', '#6b3d1e', '#a0672b', '#c8c8c8', '#8a8f98', '#d4a017', '#3268b8'];
export const BOOTS = ['#e11d48', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#f8fafc', '#0f172a', '#a3e635'];
export const HAIR_NAMES = ['Лысая', 'Средняя', 'Под ноль', 'Кудри', 'Афро', 'Длинная', 'Ирокез', 'Пучок'];
export const BEARD_NAMES = ['Нет', 'Щетина', 'Борода'];

interface Props { ap: Appearance; c1: string; c2: string; size?: number; className?: string }

export default function Avatar({ ap, c1, c2, size = 220, className }: Props) {
  const skin = SKINS[ap.skin];
  const hairC = HAIRC[ap.hairColor];
  const boot = BOOTS[ap.bootColor];
  const h = size * (200 / 160) * 1.0;

  const sleeveY1 = ap.longSleeves ? 66 : 74;
  const tatL = ap.tattoo === 1 || ap.tattoo === 3;
  const tatR = ap.tattoo === 2 || ap.tattoo === 3;
  // number contrast: if both kit colors are light, use dark ink
  const lum = (hex: string) => {
    const c = parseInt(hex.slice(1, 7), 16);
    return (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
  };
  const numColor = lum(c1) > 0.72 && lum(c2) > 0.72 ? '#1f2937' : c2;

  return (
    <svg viewBox="0 0 160 200" width={size} height={h} className={className} style={{ filter: 'drop-shadow(0 10px 24px rgba(0,0,0,.45))' }}>

      {/* shadow */}
      <ellipse cx="80" cy="192" rx="46" ry="6" fill="#000" opacity=".35" />
      {/* socks */}
      <g>
        <rect x="63" y={ap.longSocks ? 128 : 158} width="13" height={ap.longSocks ? 52 : 22} rx="5" fill={c2} />
        <rect x="84" y={ap.longSocks ? 128 : 158} width="13" height={ap.longSocks ? 52 : 22} rx="5" fill={c2} />
        {!ap.longSocks && <>
          <rect x="63" y="158" width="13" height="6" rx="3" fill={c2} opacity=".9" />
          <rect x="84" y="158" width="13" height="6" rx="3" fill={c2} opacity=".9" />
        </>}
      </g>
      {/* lower legs */}
      <rect x="63" y="172" width="13" height="12" rx="4" fill={skin} opacity={ap.longSocks ? 0 : 1} />
      <rect x="84" y="172" width="13" height="12" rx="4" fill={skin} opacity={ap.longSocks ? 0 : 1} />
      {/* boots */}
      <path d="M60 180 h18 a6 6 0 0 1 6 6 v4 h-26 a6 6 0 0 1 -6 -6 v-2 a4 4 0 0 1 4 -4 z" fill={boot} />
      <path d="M82 180 h18 a6 6 0 0 1 6 6 v4 h-26 a6 6 0 0 1 -6 -6 v-2 a4 4 0 0 1 4 -4 z" fill={boot} transform="translate(6,0) scale(0.94,1)" />
      {/* shorts */}
      <path d="M58 108 h44 v8 l-4 26 a6 6 0 0 1 -6 5 h-24 a6 6 0 0 1 -6 -5 l-4 -26 z" fill={c2} />
      <rect x="58" y="108" width="44" height="6" fill="#000" opacity=".18" />
      {/* arms */}
      <g>
        {/* upper arms = sleeves */}
        <rect x="40" y="64" width="14" height={sleeveY1 - 60} rx="7" fill={c1} />
        <rect x="106" y="64" width="14" height={sleeveY1 - 60} rx="7" fill={c1} />
        {/* forearms skin/tattoo */}
        <rect x="41" y={sleeveY1} width="12" height="34" rx="6" fill={skin} />{tatL && <><rect x="42" y={sleeveY1 + 6} width="10" height="3.4" rx="1.7" fill="#2f3a4a" /><rect x="42" y={sleeveY1 + 15} width="10" height="3.4" rx="1.7" fill="#2f3a4a" /><rect x="42" y={sleeveY1 + 24} width="10" height="3.4" rx="1.7" fill="#2f3a4a" /></>}
        <rect x="107" y={sleeveY1} width="12" height="34" rx="6" fill={skin} />{tatR && <><rect x="108" y={sleeveY1 + 6} width="10" height="3.4" rx="1.7" fill="#2f3a4a" /><rect x="108" y={sleeveY1 + 15} width="10" height="3.4" rx="1.7" fill="#2f3a4a" /><rect x="108" y={sleeveY1 + 24} width="10" height="3.4" rx="1.7" fill="#2f3a4a" /></>}
        {/* wrists + tape */}
        {ap.tape && <rect x="41" y="96" width="12" height="5" rx="2.5" fill="#f5f5f5" />}
        <circle cx="47" cy={sleeveY1 + 33} r="6" fill={skin} />
        <circle cx="113" cy={sleeveY1 + 33} r="6" fill={skin} />
      </g>
      {/* torso (shirt) */}
      <path d="M52 62 q28 -10 56 0 l2 16 v36 a6 6 0 0 1 -6 6 h-48 a6 6 0 0 1 -6 -6 v-36 z" fill={c1} />
      {/* shirt hem: tucked vs untucked */}
      {ap.tucked
        ? <rect x="52" y="106" width="56" height="10" fill={c1} />
        : <path d="M50 104 h60 a4 4 0 0 1 4 4 v6 a6 6 0 0 1 -6 6 h-56 a6 6 0 0 1 -6 -6 v-6 a4 4 0 0 1 4 -4 z" fill={c1} opacity=".97" />
      }
      {/* collar + stripes */}
      <path d="M72 58 q8 6 16 0 l3 4 q-11 7 -22 0 z" fill={c2} />
      <rect x="64" y="64" width="4" height={ap.tucked ? 48 : 50} fill={c2} opacity=".5" />
      <rect x="92" y="64" width="4" height={ap.tucked ? 48 : 50} fill={c2} opacity=".5" />
      {/* number */}
      <text x="80" y="94" textAnchor="middle" fontSize="17" fontWeight="900" fill={numColor} fontFamily="Archivo, sans-serif" opacity=".92">{ap.number}</text>
      {/* neck + head */}
      <rect x="73" y="48" width="14" height="12" rx="4" fill={skin} />
      <circle cx="80" cy="34" r="19" fill={skin} />
      {/* ears */}
      <circle cx="61.5" cy="35" r="3.4" fill={skin} /> <circle cx="98.5" cy="35" r="3.4" fill={skin} />
      {/* hair styles */}
      {ap.hair === 1 && <path d="M61 32 a19 19 0 0 1 38 0 q-6 -10 -19 -10 q-13 0 -19 10 z" fill={hairC} />}
      {ap.hair === 2 && <path d="M61 33 a19 19 0 0 1 38 2 l-3 1 q-2 -12 -16 -12 q-14 0 -16 12 l-3 -1 z" fill={hairC} />}
      {ap.hair === 3 && <>
        <circle cx="66" cy="22" r="6" fill={hairC} /><circle cx="75" cy="17" r="7" fill={hairC} />
        <circle cx="85" cy="17" r="7" fill={hairC} /><circle cx="94" cy="22" r="6" fill={hairC} />
        <circle cx="63" cy="29" r="5" fill={hairC} /><circle cx="97" cy="29" r="5" fill={hairC} />
      </>}
      {ap.hair === 4 && <><circle cx="80" cy="23" r="18" fill={hairC} /><ellipse cx="80" cy="14" rx="13" ry="6" fill={hairC} /></>}
      {ap.hair === 5 && <>
        <path d="M61 32 a19 19 0 0 1 38 0 q-8 -12 -19 -12 q-11 0 -19 12 z" fill={hairC} />
        <path d="M61 30 q-4 22 2 34 l6 -2 q-6 -18 -4 -32 z" fill={hairC} />
        <path d="M99 30 q4 22 -2 34 l-6 -2 q6 -18 4 -32 z" fill={hairC} />
      </>}
      {ap.hair === 6 && <><path d="M69 26 q1 -21 11 -22 q10 1 11 22 l-5 5 q-6 -5 -12 0 z" fill={hairC} /><path d="M62 33 a19 19 0 0 1 6 -12 l4 4 q-4 6 -4 9 z" fill={hairC} opacity=".55" /><path d="M98 33 a19 19 0 0 0 -6 -12 l-4 4 q4 6 4 9 z" fill={hairC} opacity=".55" /></>}
      {ap.hair === 7 && <>
        <path d="M61 32 a19 19 0 0 1 38 0 q-6 -10 -19 -10 q-13 0 -19 10 z" fill={hairC} />
        <circle cx="80" cy="11" r="6" fill={hairC} />
      </>}
      {/* face */}
      <circle cx="73" cy="35" r="2.1" fill="#221a12" /><circle cx="87" cy="35" r="2.1" fill="#221a12" />
      <path d="M76 44 q4 3 8 0" stroke="#221a12" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* beard */}
      {ap.beard === 1 && <path d="M65 40 a19 19 0 0 0 30 0 q-2 10 -15 11 q-13 -1 -15 -11 z" fill={hairC} opacity=".45" />}
      {ap.beard === 2 && <path d="M64 38 a19 19 0 0 0 32 0 q-1 13 -16 14 q-15 -1 -16 -14 z" fill={hairC} opacity=".9" />}
      {/* brows */}
      <rect x="69" y="29" width="8" height="2" rx="1" fill={hairC} /><rect x="83" y="29" width="8" height="2" rx="1" fill={hairC} />
    </svg>
  );
}
