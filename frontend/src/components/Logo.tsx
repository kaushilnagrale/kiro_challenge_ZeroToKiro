/**
 * PulseRoute logo — SVG wordmark with pulse-line icon.
 * Used in the app header and onboarding splash.
 */

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  /** Show just the icon without the wordmark */
  iconOnly?: boolean
}

const sizes = {
  sm: { icon: 20, text: 14, gap: 6 },
  md: { icon: 28, text: 18, gap: 8 },
  lg: { icon: 44, text: 28, gap: 12 },
}

export function Logo({ size = 'md', iconOnly = false }: LogoProps) {
  const s = sizes[size]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: s.gap }}>
      {/* Pulse-line icon */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Circle background */}
        <circle cx="16" cy="16" r="15" fill="#ffb693" fillOpacity="0.15" stroke="#ffb693" strokeWidth="1.5" />
        {/* Pulse / ECG line */}
        <polyline
          points="4,16 9,16 11,10 13,22 15,14 17,18 19,16 28,16"
          stroke="#ffb693"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {!iconOnly && (
        <span
          style={{
            fontSize: s.text,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#f1f1f1',
            lineHeight: 1,
          }}
        >
          Pulse<span style={{ color: '#ffb693' }}>Route</span>
        </span>
      )}
    </div>
  )
}
