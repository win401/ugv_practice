export default function Vehicle({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "vehicle small" : "vehicle"}
      viewBox="0 0 260 180"
      aria-label="가상의 궤도형 관수 UGV 일러스트"
      role="img"
    >
      <defs>
        <linearGradient id={small ? "body-s" : "body"} x2="0" y2="1">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#e5e5e5" />
        </linearGradient>
      </defs>
      <ellipse cx="131" cy="150" rx="105" ry="15" fill="#18181b" opacity=".1" />
      <g fill="#27272a" stroke="#18181b" strokeWidth="3">
        <rect x="22" y="86" width="49" height="65" rx="19" />
        <rect x="188" y="86" width="49" height="65" rx="19" />
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} stroke="#71717a" strokeWidth="3">
          <path d={`M25 ${96 + i * 9}h42`} />
          <path d={`M192 ${96 + i * 9}h41`} />
        </g>
      ))}
      <path
        d="M60 60 151 41 206 77 202 128 116 151 57 117Z"
        fill={`url(#${small ? "body-s" : "body"})`}
        stroke="#a1a1aa"
        strokeWidth="2"
      />
      <path d="m60 60 61 33 85-16-55-36Z" fill="#fafafa" stroke="#d4d4d8" />
      <path d="m121 93-5 58 86-23 4-51Z" fill="#e5e5e5" />
      <path
        d="m83 54 57-11 38 23-58 14Z"
        fill="#c8d6ff"
        stroke="#245bff"
        strokeWidth="2"
      />
      <path d="m93 56 45-8 28 17-45 9Z" fill="#245bff" opacity=".55" />
      <path d="m68 97 33 18v12l-33-18Z" fill="#18181b" />
      <path
        d="m137 110 45-11"
        stroke="#a1a1aa"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="182" cy="112" r="4" fill="#16a34a" />
      <path
        d="M166 46V19"
        stroke="#27272a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="166" cy="17" r="5" fill="#ff6b35" />
      <path
        d="m59 84-15 7-8-5"
        stroke="#a1a1aa"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
