import type { MouseEvent } from 'react'

/** Colors come from the existing closed palette only (same rule
 * `Icon.tsx` follows) — purple is already spoken for by the party pin
 * (`MapsRegionTab`'s existing pin), so the four `MarkerKind` values each
 * get one of the four remaining named accents. Picked for loose semantic
 * fit (danger→red, npc→yellow like a person/name tag, poi→cyan as a
 * neutral "place" marker, custom→pink as the catch-all) rather than any
 * meaning beyond "four markers on one map need to read as different
 * things at a glance." */
const MARKER_COLOR: Record<string, string> = {
  poi: 'var(--color-cyan)',
  npc: 'var(--color-yellow)',
  danger: 'var(--color-red)',
  custom: 'var(--color-pink)',
}

interface MapPinProps {
  x: number
  y: number
  color: string
  /** Adds the party pin's existing ping-ring treatment. Markers stay
   * plain dots — a whole map full of pulsing rings would be noise, the
   * animation's job is to draw the eye to the one "you are here" pin. */
  pulsing?: boolean
  label: string
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

/** One positioned dot on a `MapImageViewer` — the party pin and every
 * `campaign_map_markers` row both render through this so they share one
 * visual language and one interaction contract: `onMouseDown` stops
 * propagation so clicking a pin doesn't also bubble up into
 * `MapImageViewer`'s own click/pan handling on the map underneath it
 * (which would otherwise move the party pin or arm marker-placement at
 * the same spot the user just clicked to select). Renders as a `button`
 * rather than a `div` so it's keyboard-reachable and gets a real
 * accessible name, not just a decorative shape. */
export function MapPin({ x, y, color, pulsing, label, onClick }: MapPinProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {pulsing && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ backgroundColor: color }} />}
      <span className="absolute inset-0 rounded-full border-2" style={{ backgroundColor: color, borderColor: 'var(--color-bg)' }} />
    </button>
  )
}

/** Client-side mirror of `campaign_map_markers_marker_kind_check` — same
 * governance as `MapKind`/`MarkerKind` in `lib/maps.ts`, kept next to the
 * one place that actually consumes it as a color rather than duplicated
 * per call site. */
export function markerColor(markerKind: string): string {
  return MARKER_COLOR[markerKind] ?? MARKER_COLOR.custom
}
