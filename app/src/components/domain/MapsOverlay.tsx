import type { Dispatch, SetStateAction } from 'react'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { MapsPanel } from './MapsPanel'
import type { Character } from '../../lib/characters'
import type { TurnOrder } from '../../lib/encounters'

interface MapsOverlayProps {
  open: boolean
  campaignId: string
  /** BUILD_PLAN.md item 15 slice 4 (2026-08-14) — threaded straight to
   * `MapsPanel`, see that component's own doc comment for what it
   * gates. */
  isOwner: boolean
  /** BUILD_PLAN.md item 8 (2026-08-14) — threaded straight to
   * `MapsPanel`'s own new prop of the same name, for its Scene tab. */
  characters: Character[]
  /** Encounter mode phase 2 (BUILD_PLAN.md item 13, 2026-08-14) —
   * threaded straight to `MapsPanel`'s own new props of the same names;
   * see that component's own doc comment. */
  sessionId: string | null
  turnOrder: TurnOrder | null
  onTurnOrderChange: Dispatch<SetStateAction<TurnOrder | null>>
  onClose: () => void
}

/** Desktop's entry point for the Maps overlay (BUILD_PLAN.md slice 8),
 * opened from `ToolsDock`'s Maps button — same `Overlay`-wraps-a-domain-
 * component shape as `RulesChat`/`DiceRoller`. `Overlay.tsx`'s own doc
 * comment already called this out: "Maps (still unbuilt) would share
 * this same primitive when its slice lands."
 *
 * `width="wide" tall` (2026-08-10, map-controls follow-up): the default
 * 880×88vh sheet size was tuned for RulesChat/CharacterSheet's mostly-
 * text content, and had the user scrolling once the Region tab grew a
 * map image plus zoom/pan chrome, marker add/edit row, position chips
 * and edit row, and an upload/delete-map row all stacked under one
 * another. Wider first (image + controls have more room to sit on fewer
 * lines), taller second for whatever's still stacked after that.
 *
 * Mobile doesn't use this wrapper — `MobileJournalView` renders
 * `MapsPanel` directly under its own "Maps" bottom tab, which already
 * has its own header-with-close chrome; see `MapsPanel`'s doc comment. */
export function MapsOverlay({ open, campaignId, isOwner, characters, sessionId, turnOrder, onTurnOrderChange, onClose }: MapsOverlayProps) {
  return (
    <Overlay open={open} onClose={onClose} header={<h2 className={text.h2}>Maps</h2>} width="wide" tall>
      <MapsPanel
        campaignId={campaignId}
        isOwner={isOwner}
        characters={characters}
        sessionId={sessionId}
        turnOrder={turnOrder}
        onTurnOrderChange={onTurnOrderChange}
      />
    </Overlay>
  )
}
