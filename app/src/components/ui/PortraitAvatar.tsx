import { cx } from '../../lib/cx'

interface PortraitAvatarProps {
  name: string
  /** Hex color for this character (SPEC's "one PC color everywhere"
   * rule) — same inline-style mechanism Log entry row uses for sender
   * color, since this is arbitrary per-character data, not one of the
   * six fixed palette tones. */
  color: string
  /** Optional portrait image; falls back to initials when absent — no
   * real portrait assets exist yet. */
  src?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClass: Record<NonNullable<PortraitAvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Circular avatar ringed in the character's identity color. Not in the
 * landing page — new territory for the app's character-display needs. */
export function PortraitAvatar({ name, color, src, size = 'md', className }: PortraitAvatarProps) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-panel2 font-sans font-semibold text-ink',
        sizeClass[size],
        className,
      )}
      style={{ borderColor: color }}
      role="img"
      aria-label={name}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  )
}
