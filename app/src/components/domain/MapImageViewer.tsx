import { useCallback, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode, TouchEvent as ReactTouchEvent, WheelEvent as ReactWheelEvent } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 1.4
/** Pixels of total pointer movement below which a mouse-down→mouse-up
 * (or single-finger touch-start→touch-end) cycle counts as a click
 * rather than a pan-drag. High enough to absorb the natural jitter of a
 * real click, low enough that an intentional drag never gets swallowed. */
const CLICK_DISTANCE_THRESHOLD = 6

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface Pan {
  x: number
  y: number
}

interface MapImageViewerProps {
  src: string
  alt: string
  /** Fires only for a genuine click/tap — one that didn't move more than
   * `CLICK_DISTANCE_THRESHOLD` between press and release — with the
   * position expressed as a 0–100 percentage of the image's own
   * (unzoomed, unpanned) box. Matches the coordinate convention every
   * marker/pin table already uses (`x numeric check (x>=0 and x<=100)`),
   * so callers can pass this straight to `addMapMarker`/`setPartyPosition`
   * without re-deriving it. */
  onImageClick?: (x: number, y: number) => void
  /** Overlay content (pins, markers) positioned with `left`/`top`
   * percentages in the same 0–100 space as `onImageClick` — rendered
   * inside the same zoom/pan transform as the image so it stays glued to
   * the map at any zoom level, the same way the plain-`img` version did
   * at a fixed 1:1 zoom. */
  children?: ReactNode
  className?: string
}

/**
 * Shared zoom/pan/click surface for map images (BUILD_PLAN.md slice 8's
 * "map controls" follow-up — zoom/pan was one of the four controls
 * confirmed via `AskUserQuestion`). Used by both `MapsRegionTab` (which
 * also passes `onImageClick` for pin/marker placement) and `MapsSiteTab`
 * (view/pan only today, though it accepts the same `onImageClick` prop
 * for whenever Site markers need it).
 *
 * No external pan/zoom library — this sandbox has no npm registry
 * access this cycle, and the interaction surface is small enough
 * (wheel zoom, single-finger drag, two-finger pinch, click-vs-drag
 * disambiguation) to own directly rather than pull in a dependency sight
 * unseen.
 *
 * Coordinate model: the outer `overflow-hidden` box's own layout size is
 * never touched by the inner content's `transform` (CSS transforms are
 * purely visual, not layout-affecting), so `outerRef`'s bounding rect is
 * always the same 0–100% frame regardless of current zoom/pan — that's
 * what both the click-percentage math and the pan-clamping math anchor
 * to, rather than re-deriving it from the scaled visual size.
 */
export function MapImageViewer({ src, alt, onImageClick, children, className }: MapImageViewerProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)

  // Refs, not state: these are read/written many times per drag frame
  // and never need to trigger a render on their own — only the `setPan`
  // calls they lead to do.
  const dragStart = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null)
  const dragDistance = useRef(0)
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null)

  const clampPan = useCallback((nextPan: Pan, nextZoom: number): Pan => {
    const rect = outerRef.current?.getBoundingClientRect()
    if (!rect) return nextPan
    return {
      x: clamp(nextPan.x, rect.width * (1 - nextZoom), 0),
      y: clamp(nextPan.y, rect.height * (1 - nextZoom), 0),
    }
  }, [])

  /** Zooms to `nextZoom`, keeping the inner-content point currently under
   * `(localX, localY)` (both relative to `outerRef`) fixed on screen —
   * the standard "zoom toward cursor/pinch-midpoint" feel, rather than
   * always zooming toward the top-left corner. Reads `zoom`/`pan` from
   * the render closure rather than functional updaters: this fires once
   * per discrete wheel/pinch/button event, never batched back-to-back
   * with another call to itself, so the render-time values are already
   * current. */
  const zoomAt = useCallback(
    (localX: number, localY: number, nextZoom: number) => {
      const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
      const innerX = (localX - pan.x) / zoom
      const innerY = (localY - pan.y) / zoom
      setZoom(clampedZoom)
      setPan(clampPan({ x: localX - innerX * clampedZoom, y: localY - innerY * clampedZoom }, clampedZoom))
    },
    [zoom, pan, clampPan],
  )

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const rect = outerRef.current?.getBoundingClientRect()
    if (!rect) return
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    zoomAt(localX, localY, zoom * factor)
  }

  function emitClickIfGenuine(clientX: number, clientY: number) {
    if (dragDistance.current > CLICK_DISTANCE_THRESHOLD) return
    const rect = outerRef.current?.getBoundingClientRect()
    if (!rect || !onImageClick) return
    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const innerX = (localX - pan.x) / zoom
    const innerY = (localY - pan.y) / zoom
    onImageClick(clamp((innerX / rect.width) * 100, 0, 100), clamp((innerY / rect.height) * 100, 0, 100))
  }

  function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    dragStart.current = { clientX: event.clientX, clientY: event.clientY, panX: pan.x, panY: pan.y }
    dragDistance.current = 0
    setIsPanning(true)

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      const start = dragStart.current
      if (!start) return
      const dx = moveEvent.clientX - start.clientX
      const dy = moveEvent.clientY - start.clientY
      dragDistance.current = Math.max(dragDistance.current, Math.hypot(dx, dy))
      setPan(clampPan({ x: start.panX + dx, y: start.panY + dy }, zoom))
    }

    function handleMouseUp(upEvent: globalThis.MouseEvent) {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      setIsPanning(false)
      emitClickIfGenuine(upEvent.clientX, upEvent.clientY)
      dragStart.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function touchDistance(touches: ReactTouchEvent<HTMLDivElement>['touches']): number {
    const [a, b] = [touches[0], touches[1]]
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      pinchStart.current = { distance: touchDistance(event.touches), zoom }
      dragStart.current = null
      return
    }
    const touch = event.touches[0]
    dragStart.current = { clientX: touch.clientX, clientY: touch.clientY, panX: pan.x, panY: pan.y }
    dragDistance.current = 0
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2 && pinchStart.current) {
      const rect = outerRef.current?.getBoundingClientRect()
      if (!rect) return
      const distance = touchDistance(event.touches)
      const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left
      const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top
      const nextZoom = pinchStart.current.zoom * (distance / pinchStart.current.distance)
      zoomAt(midX, midY, nextZoom)
      return
    }
    const start = dragStart.current
    const touch = event.touches[0]
    if (!start || !touch) return
    const dx = touch.clientX - start.clientX
    const dy = touch.clientY - start.clientY
    dragDistance.current = Math.max(dragDistance.current, Math.hypot(dx, dy))
    setPan(clampPan({ x: start.panX + dx, y: start.panY + dy }, zoom))
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    pinchStart.current = null
    const start = dragStart.current
    const touch = event.changedTouches[0]
    dragStart.current = null
    if (!start || !touch) return
    emitClickIfGenuine(touch.clientX, touch.clientY)
  }

  function resetView() {
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
  }

  function stepZoom(factor: number) {
    const rect = outerRef.current?.getBoundingClientRect()
    const center = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 }
    zoomAt(center.x, center.y, zoom * factor)
  }

  return (
    <div
      ref={outerRef}
      className={cx(
        'relative touch-none select-none overflow-hidden rounded-card border border-line-soft bg-black',
        isPanning ? 'cursor-grabbing' : onImageClick ? 'cursor-crosshair' : 'cursor-grab',
        className,
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        <img src={src} alt={alt} className="block w-full" draggable={false} />
        {children}
      </div>

      {/* 44px touch targets (2026-08-11, mobile polish pass) — these
        * were h-7 (28px), the one hand-rolled control in this app that
        * never went through Button/Stepper's shared 44px guarantee
        * (CLAUDE.md: "every interactive control...guarantees the 44px
        * touch-target minimum"). Map zoom is exactly the kind of control
        * a phone user reaches for mid-pinch, so undersized hit targets
        * here cost more than most. */}
      <div className="absolute bottom-2 right-2 flex gap-1 rounded-button border border-line-soft bg-panel/90 p-1 backdrop-blur">
        <button
          type="button"
          onClick={() => stepZoom(1 / ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          className={cx(text.label, 'inline-flex h-11 w-11 items-center justify-center rounded-button hover:bg-panel2 disabled:opacity-30')}
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          disabled={zoom === MIN_ZOOM && pan.x === 0 && pan.y === 0}
          aria-label="Reset zoom"
          className={cx(text.label, 'inline-flex min-h-11 items-center justify-center rounded-button px-3 hover:bg-panel2 disabled:opacity-30')}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => stepZoom(ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          className={cx(text.label, 'inline-flex h-11 w-11 items-center justify-center rounded-button hover:bg-panel2 disabled:opacity-30')}
        >
          +
        </button>
      </div>
    </div>
  )
}
