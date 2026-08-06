import { cx } from '../../lib/cx'
import type { DieType } from '../../lib/dice'

interface DieIconProps {
  die: DieType
  className?: string
  /** Adds the tumbling roll animation (index.css's `.animate-dice-roll`)
   * — set only while an actual roll is in flight (DiceRoller.tsx). */
  rolling?: boolean
}

// Simple stroke-outline polygon per die shape — a flat glyph standing in
// for each polyhedron's face count, the same convention most virtual-
// tabletop dice trays use (a triangle for d4, a square for d6, a
// diamond for d8, and so on), not a literal 3D net. Not built on lucide:
// lucide has no polyhedral-dice icons (only Dice1-Dice6 pip faces, which
// don't map to d4/d8/d10/d12/d20 at all), so this is a small, separate
// primitive rather than being forced into Icon.tsx's closed lucide
// `name` set — deliberately scoped to dice shapes only. Same stroke
// language as Icon.tsx (24x24 viewBox, strokeWidth 2, currentColor) so
// it still reads as part of the same icon system.
const SHAPES: Record<DieType, string> = {
  d4: '12,3 21,20 3,20',
  d6: '4,4 20,4 20,20 4,20',
  d8: '12,2 22,12 12,22 2,12',
  d10: '12,1 19,8 15,23 9,23 5,8',
  d12: '12,2 22,10 18,21 6,21 2,10',
  d20: '12,2 21,7 21,17 12,22 3,17 3,7',
}

export function DieIcon({ die, className, rolling }: DieIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      className={cx('h-6 w-6', rolling && 'animate-dice-roll', className)}
    >
      <polygon points={SHAPES[die]} />
    </svg>
  )
}
