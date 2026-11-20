import type { ReactNode } from "react";

/*
 * Avatares desenhados do protótipo, portados para JSX: pessoas (`PP` + `personSvg`), animais e objetos (`AVX`),
 * agrupados como em `AVG`. Tudo em viewBox 64 × 64, com fundo próprio.
 */

type Gender = "m" | "f";
type Hair = "crew" | "quiff" | "curlys" | "bald" | "long" | "bun" | "bob" | "curlyl";
/** [gênero, cabelo, fundo, roupa, pele, cor do cabelo, barba, óculos] */
type Person = readonly [Gender, Hair, string, string, string, string, 0 | 1, 0 | 1];

const PP = {
  a1: ["m", "crew", "#e6e4fb", "#4f46e5", "#f2c9a5", "#2b2118", 0, 0],
  a2: ["f", "long", "#fbe3ea", "#c0507a", "#f2c9a5", "#c98a3d", 0, 0],
  a3: ["m", "quiff", "#e1f4ec", "#0d8a5c", "#b97c55", "#1f1a24", 1, 0],
  a4: ["f", "bun", "#fdf1dc", "#e08a2e", "#7a4b30", "#1f1a24", 0, 0],
  a5: ["m", "crew", "#e3edfb", "#2765d1", "#7a4b30", "#1f1a24", 1, 0],
  a6: ["f", "curlyl", "#e6e4fb", "#434a60", "#e0ac84", "#3a2418", 0, 0],
  a7: ["m", "bald", "#fdf1dc", "#e08a2e", "#e0ac84", "#5a3825", 1, 0],
  a8: ["f", "bob", "#e1f4ec", "#2765d1", "#f2c9a5", "#1f1a24", 0, 1],
  a9: ["m", "crew", "#eceef3", "#434a60", "#f2c9a5", "#8a5a2b", 0, 1],
  a10: ["f", "long", "#e3edfb", "#0d8a5c", "#7a4b30", "#1f1a24", 0, 1],
  a11: ["m", "curlys", "#fbe3ea", "#c0507a", "#7a4b30", "#1f1a24", 0, 0],
  a12: ["f", "bun", "#eceef3", "#4f46e5", "#f2c9a5", "#5a3825", 0, 0],
  a13: ["m", "quiff", "#fdf1dc", "#2765d1", "#e0ac84", "#c98a3d", 1, 1],
  a14: ["f", "curlyl", "#e1f4ec", "#e08a2e", "#b97c55", "#1f1a24", 0, 0],
  a15: ["m", "crew", "#e6e4fb", "#0d8a5c", "#b97c55", "#2b2b33", 0, 0],
  a16: ["f", "bob", "#fbe3ea", "#434a60", "#e0ac84", "#c98a3d", 0, 0],
} as const satisfies Record<string, Person>;

type PersonKey = keyof typeof PP;

function circles(points: readonly (readonly [number, number])[], r: number, fill: string): ReactNode {
  return points.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={fill} />);
}

function hairBack(hair: Hair, color: string): ReactNode {
  if (hair === "long") {
    return <path d="M19 26c0-9 6-14 13-14s13 5 13 14v16c0 3-3 5-6 5H25c-3 0-6-2-6-5z" fill={color} />;
  }
  if (hair === "curlyl") {
    return circles(
      [
        [20, 24],
        [19, 32],
        [21, 40],
        [44, 24],
        [45, 32],
        [43, 40],
      ],
      6,
      color,
    );
  }
  if (hair === "bob") return <path d="M19 27c0-8 5.5-13 13-13s13 5 13 13v9h-26z" fill={color} />;
  return null;
}

function hairTop(hair: Hair, color: string): ReactNode {
  switch (hair) {
    case "crew":
      return (
        <path
          d="M20.5 25.5c0-7 5-11.5 11.5-11.5s11.5 4.5 11.5 11.5c-2-2.5-6-3.8-11.5-3.8s-9.5 1.3-11.5 3.8z"
          fill={color}
        />
      );
    case "quiff":
      return (
        <path
          d="M20.5 25.5c0-6.5 4-10.5 9.5-11.7 4.5-1.8 10-.6 11.3 2.7 1.7 2 2.2 5 2.2 9-2-2.5-6-3.8-11.5-3.8s-9.5 1.3-11.5 3.8z"
          fill={color}
        />
      );
    case "curlys":
      return circles(
        [
          [22.5, 21],
          [26.5, 17],
          [32, 15.5],
          [37.5, 17],
          [41.5, 21],
        ],
        4.3,
        color,
      );
    case "long":
      return (
        <path
          d="M20 28.5c0-9 5-14.5 12-14.5s12 5.5 12 14.5c-2.5-5.5-6.5-8.5-12-8.5-3 3.5-7.5 6.5-12 8.5z"
          fill={color}
        />
      );
    case "bun":
      return (
        <>
          <circle cx="32" cy="12.5" r="5.5" fill={color} />
          <path d="M20 28c0-9 5-14 12-14s12 5 12 14c-3-5-7-7-12-7s-9 2-12 7z" fill={color} />
        </>
      );
    case "bob":
      return <path d="M20 27c0-8 5-12.5 12-12.5s12 4.5 12 12.5c-3-4-7-6-12-6-4 0-7 1.5-9 4z" fill={color} />;
    case "curlyl":
      return circles(
        [
          [22, 21],
          [26.5, 16.5],
          [32, 14.5],
          [37.5, 16.5],
          [42, 21],
        ],
        5,
        color,
      );
    default:
      return null;
  }
}

function PersonArt({ id }: { id: PersonKey }) {
  const [gender, hair, bg, shirt, skin, hairColor, beard, glasses] = PP[id];
  return (
    <>
      <rect width="64" height="64" fill={bg} />
      {hairBack(hair, hairColor)}
      {gender === "m" ? (
        <>
          <path d="M7 64c0-13 11-20 25-20s25 7 25 20z" fill={shirt} />
          <path
            d="M27 44.5l5 5 5-5"
            fill="none"
            stroke="rgba(255,255,255,.6)"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <path d="M12 64c0-12 9-19 20-19s20 7 20 19z" fill={shirt} />
      )}
      <rect x="27.5" y="35" width="9" height="11" rx="3" fill={skin} />
      {gender === "m" ? (
        <>
          <circle cx="20.6" cy="29" r="2.7" fill={skin} />
          <circle cx="43.4" cy="29" r="2.7" fill={skin} />
        </>
      ) : null}
      <circle cx="32" cy="28" r="11.5" fill={skin} />
      {hairTop(hair, hairColor)}
      {beard ? (
        <path
          d="M20.8 29c.3 8 5 12.3 11.2 12.3S42.9 37 43.2 29c-1.3 2.7-3.5 4-5.8 4-1.6-1.3-3.3-1.8-5.4-1.8s-3.8.5-5.4 1.8c-2.3 0-4.5-1.3-5.8-4z"
          fill={hairColor}
        />
      ) : null}
      {glasses ? (
        <>
          <circle cx="27.5" cy="28.5" r="3.5" fill="none" stroke="#1f1a24" strokeWidth="1.4" />
          <circle cx="36.5" cy="28.5" r="3.5" fill="none" stroke="#1f1a24" strokeWidth="1.4" />
          <path d="M31 28.5h2" stroke="#1f1a24" strokeWidth="1.4" />
        </>
      ) : null}
    </>
  );
}

const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Animais e objetos (`AVX`): [fundo, desenho, nome]. */
const AVX = {
  b1: [
    "#fdf1dc",
    <>
      <path d="M17 30l3-15 10 9M47 30l-3-15-10 9" fill="#e08a2e" />
      <circle cx="32" cy="36" r="16" fill="#e08a2e" />
      <circle cx="26" cy="34" r="2" fill="#1f1a24" />
      <circle cx="38" cy="34" r="2" fill="#1f1a24" />
      <path d="M30 39h4l-2 2.5z" fill="#c0507a" />
      <path d="M14 38h9M14 42h9M41 38h9M41 42h9" stroke="#1f1a24" strokeWidth="1" opacity=".5" />
    </>,
    "Gato",
  ],
  b2: [
    "#e3edfb",
    <>
      <ellipse cx="17" cy="33" rx="6" ry="11" fill="#5a3825" />
      <ellipse cx="47" cy="33" rx="6" ry="11" fill="#5a3825" />
      <circle cx="32" cy="35" r="15" fill="#c98a3d" />
      <ellipse cx="32" cy="42" rx="8" ry="6" fill="#f2dcc0" />
      <circle cx="26" cy="32" r="2" fill="#1f1a24" />
      <circle cx="38" cy="32" r="2" fill="#1f1a24" />
      <ellipse cx="32" cy="39.5" rx="3" ry="2" fill="#1f1a24" />
    </>,
    "Cachorro",
  ],
  b3: [
    "#fbe3ea",
    <>
      <path d="M16 28l4-16 10 10M48 28l-4-16-10 10" fill="#e0662e" />
      <path d="M14 30c0-8 8-12 18-12s18 4 18 12c0 10-9 18-18 22-9-4-18-12-18-22z" fill="#e0662e" />
      <path d="M14 31c5 2 10 6 18 21-9-4-18-11-18-21zM50 31c-5 2-10 6-18 21 9-4 18-11 18-21z" fill="#fff" />
      <circle cx="25" cy="32" r="2" fill="#1f1a24" />
      <circle cx="39" cy="32" r="2" fill="#1f1a24" />
      <circle cx="32" cy="46" r="2.5" fill="#1f1a24" />
    </>,
    "Raposa",
  ],
  b4: [
    "#e1f4ec",
    <>
      <circle cx="20" cy="22" r="7" fill="#7a4b30" />
      <circle cx="44" cy="22" r="7" fill="#7a4b30" />
      <circle cx="32" cy="35" r="16" fill="#7a4b30" />
      <ellipse cx="32" cy="41" rx="8" ry="6" fill="#d9b48f" />
      <circle cx="26" cy="32" r="2" fill="#1f1a24" />
      <circle cx="38" cy="32" r="2" fill="#1f1a24" />
      <ellipse cx="32" cy="38.5" rx="3" ry="2" fill="#1f1a24" />
    </>,
    "Urso",
  ],
  b5: [
    "#e6e4fb",
    <>
      <ellipse cx="25" cy="16" rx="4.5" ry="12" fill="#eceef3" />
      <ellipse cx="39" cy="16" rx="4.5" ry="12" fill="#eceef3" />
      <ellipse cx="25" cy="17" rx="2" ry="8" fill="#f4b6c6" />
      <ellipse cx="39" cy="17" rx="2" ry="8" fill="#f4b6c6" />
      <circle cx="32" cy="38" r="14" fill="#eceef3" />
      <circle cx="27" cy="36" r="2" fill="#1f1a24" />
      <circle cx="37" cy="36" r="2" fill="#1f1a24" />
      <path d="M30 41h4l-2 2.5z" fill="#c0507a" />
    </>,
    "Coelho",
  ],
  b6: [
    "#eceef3",
    <>
      <circle cx="19" cy="22" r="7" fill="#1f1a24" />
      <circle cx="45" cy="22" r="7" fill="#1f1a24" />
      <circle cx="32" cy="36" r="16" fill="#fff" />
      <ellipse cx="25" cy="34" rx="4.5" ry="6" fill="#1f1a24" transform="rotate(-20 25 34)" />
      <ellipse cx="39" cy="34" rx="4.5" ry="6" fill="#1f1a24" transform="rotate(20 39 34)" />
      <circle cx="25.5" cy="33" r="1.5" fill="#fff" />
      <circle cx="38.5" cy="33" r="1.5" fill="#fff" />
      <ellipse cx="32" cy="42" rx="3" ry="2" fill="#1f1a24" />
    </>,
    "Panda",
  ],
  b7: [
    "#e3edfb",
    <>
      <ellipse cx="32" cy="38" rx="17" ry="20" fill="#1f2a44" />
      <ellipse cx="32" cy="42" rx="11" ry="14" fill="#fff" />
      <circle cx="27" cy="31" r="2" fill="#1f1a24" />
      <circle cx="37" cy="31" r="2" fill="#1f1a24" />
      <path d="M28 36h8l-4 4z" fill="#e08a2e" />
    </>,
    "Pinguim",
  ],
  b8: [
    "#fdf1dc",
    <>
      <path d="M17 22l6 6M47 22l-6 6" stroke="#7a4b30" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="32" cy="37" rx="16" ry="18" fill="#a86b3c" />
      <ellipse cx="32" cy="43" rx="10" ry="10" fill="#e9c9a0" />
      <circle cx="25" cy="31" r="6.5" fill="#fff" />
      <circle cx="39" cy="31" r="6.5" fill="#fff" />
      <circle cx="25" cy="31" r="3" fill="#1f1a24" />
      <circle cx="39" cy="31" r="3" fill="#1f1a24" />
      <path d="M29 37h6l-3 4z" fill="#e08a2e" />
    </>,
    "Coruja",
  ],
  c1: [
    "#e1f4ec",
    <>
      <path d="M22 40h20l-3 14H25z" fill="#c9673e" />
      <rect x="20" y="37" width="24" height="5" rx="2" fill="#a8532f" />
      <ellipse cx="25" cy="27" rx="5" ry="10" fill="#0d8a5c" transform="rotate(-25 25 27)" />
      <ellipse cx="39" cy="27" rx="5" ry="10" fill="#1aa874" transform="rotate(25 39 27)" />
      <ellipse cx="32" cy="22" rx="4.5" ry="12" fill="#14995f" />
    </>,
    "Planta",
  ],
  c2: [
    "#fdf1dc",
    <>
      <path
        d="M26 16c-2 3 2 5 0 8M32 14c-2 3 2 5 0 8M38 16c-2 3 2 5 0 8"
        stroke="#a8a3b8"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="18" y="28" width="24" height="22" rx="5" fill="#4f46e5" />
      <path d="M42 33h3a5 5 0 0 1 0 10h-3" stroke="#4f46e5" strokeWidth="4" fill="none" />
      <rect x="16" y="49" width="30" height="4" rx="2" fill="#2f2a9e" />
    </>,
    "Café",
  ],
  c3: [
    "#e3edfb",
    <>
      <path d="M14 32L32 16l18 16" fill="#c0507a" />
      <rect x="18" y="31" width="28" height="21" fill="#fff" />
      <rect x="28" y="38" width="8" height="14" rx="1" fill="#4f46e5" />
      <rect x="21" y="35" width="6" height="6" rx="1" fill="#86b6f8" />
      <rect x="38" y="35" width="6" height="6" rx="1" fill="#86b6f8" />
    </>,
    "Casa",
  ],
  c4: [
    "#fbe3ea",
    <>
      <circle cx="40" cy="15" r="6" fill="#f2c14e" stroke="#d9a32c" strokeWidth="2" />
      <ellipse cx="31" cy="37" rx="18" ry="14" fill="#f4a3b8" />
      <path d="M24 25l3 4h-6z" fill="#e48aa2" />
      <ellipse cx="47" cy="37" rx="4" ry="5" fill="#e48aa2" />
      <circle cx="36" cy="33" r="2" fill="#1f1a24" />
      <rect x="28" y="23" width="8" height="2" rx="1" fill="#c0507a" />
      <rect x="20" y="48" width="5" height="7" rx="2" fill="#e48aa2" />
      <rect x="35" y="48" width="5" height="7" rx="2" fill="#e48aa2" />
    </>,
    "Cofrinho",
  ],
  c5: [
    "#e6e4fb",
    <>
      <path d="M32 10c8 6 11 16 9 30H23c-2-14 1-24 9-30z" fill="#fff" stroke="#d8d6ea" strokeWidth="1.5" />
      <circle cx="32" cy="26" r="4.5" fill="#4f46e5" />
      <path d="M23 34l-7 8 8-1zM41 34l7 8-8-1z" fill="#c0507a" />
      <path d="M27 41c1 7 3 9 5 12 2-3 4-5 5-12z" fill="#f2a13c" />
    </>,
    "Foguete",
  ],
  c6: [
    "#fdf1dc",
    <>
      <circle cx="32" cy="32" r="10" fill="#f2c14e" />
      {SUN_RAYS.map((a) => (
        <rect key={a} x="31" y="11" width="2.5" height="7" rx="1.25" fill="#f2a13c" transform={`rotate(${a} 32 32)`} />
      ))}
    </>,
    "Sol",
  ],
  c7: [
    "#1f2a44",
    <>
      <circle cx="30" cy="32" r="14" fill="#f2e3a6" />
      <circle cx="37" cy="27" r="13" fill="#1f2a44" />
      <circle cx="46" cy="16" r="1.5" fill="#fff" />
      <circle cx="50" cy="28" r="1" fill="#fff" />
      <circle cx="42" cy="44" r="1.2" fill="#fff" />
    </>,
    "Lua",
  ],
  c8: [
    "#e6e4fb",
    <path
      key="estrela"
      d="M32 13l5.6 11.5 12.6 1.8-9.1 8.9 2.2 12.5L32 41.8l-11.3 5.9 2.2-12.5-9.1-8.9 12.6-1.8z"
      fill="#f2c14e"
      stroke="#e0a82c"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />,
    "Estrela",
  ],
} as const satisfies Record<string, readonly [string, ReactNode, string]>;

type ObjectKey = keyof typeof AVX;
export type AvatarKey = PersonKey | ObjectKey;

export const AVATAR_GROUPS: readonly { label: string; keys: readonly AvatarKey[] }[] = [
  { label: "Pessoas", keys: Object.keys(PP) as PersonKey[] },
  { label: "Animais", keys: ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"] },
  { label: "Objetos", keys: ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"] },
];

/** Todas as chaves de avatar (pessoas a1–a16, animais b1–b8, objetos c1–c8): fonte única, usada também pelo servidor. */
export const AVATAR_IDS: readonly AvatarKey[] = AVATAR_GROUPS.flatMap((group) => group.keys);

export function isAvatarKey(value: string | null | undefined): value is AvatarKey {
  return Boolean(value) && (Object.hasOwn(PP, value as string) || Object.hasOwn(AVX, value as string));
}

/** Nome do avatar para o leitor de tela ("Gato", "Avatar 3"). */
export function avatarName(key: AvatarKey): string {
  return key in AVX ? AVX[key as ObjectKey][2] : `Avatar ${key.slice(1)}`;
}

/** Desenho do avatar em SVG (decorativo: o nome acessível fica em quem usa). */
export function AvatarArt({ id, className }: { id: AvatarKey; className?: string }) {
  const art =
    id in AVX ? (
      <>
        <rect width="64" height="64" fill={AVX[id as ObjectKey][0]} />
        {AVX[id as ObjectKey][1]}
      </>
    ) : (
      <PersonArt id={id as PersonKey} />
    );
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      {art}
    </svg>
  );
}
