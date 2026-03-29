export function BeeDecoration({ className = "", variant = 1 }: { className?: string; variant?: 1 | 2 | 3 }) {
  const animClass = `bee-float-${variant}`
  return (
    <svg
      className={`${animClass} ${className}`}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Body */}
      <ellipse cx="16" cy="18" rx="7" ry="8" fill="#C9A84C" />
      {/* Stripes */}
      <rect x="9" y="15" width="14" height="2.5" rx="1" fill="#1B1464" />
      <rect x="10" y="20" width="12" height="2.5" rx="1" fill="#1B1464" />
      {/* Head */}
      <circle cx="16" cy="9" r="5" fill="#1B1464" />
      {/* Eyes */}
      <circle cx="14" cy="8" r="1.2" fill="#FAF7F2" />
      <circle cx="18" cy="8" r="1.2" fill="#FAF7F2" />
      {/* Wings */}
      <ellipse cx="9" cy="12" rx="5" ry="3" fill="#C9A84C" opacity="0.4" transform="rotate(-20 9 12)" />
      <ellipse cx="23" cy="12" rx="5" ry="3" fill="#C9A84C" opacity="0.4" transform="rotate(20 23 12)" />
      {/* Antenna */}
      <line x1="14" y1="5" x2="11" y2="1" stroke="#1B1464" strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="5" x2="21" y2="1" stroke="#1B1464" strokeWidth="1" strokeLinecap="round" />
      <circle cx="11" cy="1" r="1" fill="#1B1464" />
      <circle cx="21" cy="1" r="1" fill="#1B1464" />
    </svg>
  )
}
