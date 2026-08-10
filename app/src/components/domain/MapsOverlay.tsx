import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { MapsPanel } from './MapsPanel'

interface MapsOverlayProps {
  open: boolean
  campaignId: string
  onClose: () => void
}

/** Desktop's entry point for the Maps overlay (BUILD_PLAN.md slice 8),
 * opened from `ToolsDock`'s Maps button — same `Overlay`-wraps-a-domain-
 * component shape as `RulesChat`/`DiceRoller`. `Overlay.tsx`'s own doc
 * comment already called this out: "Maps (still unbuilt) would share
 * this same primitive when its slice lands."
 *
 * Mobile doesn't use this wrapper — `MobileJournalView` renders
 * `MapsPanel` directly under its own "Maps" bottom tab, which already
 * has its own header-with-close chrome; see `MapsPanel`'s doc comment. */
export function MapsOverlay({ open, campaignId, onClose }: MapsOverlayProps) {
  return (
    <Overlay open={open} onClose={onClose} header={<h2 className={text.h2}>Maps</h2>}>
      <MapsPanel campaignId={campaignId} />
    </Overlay>
  )
}
