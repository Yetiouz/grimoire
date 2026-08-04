import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { TokensSection } from './sections/TokensSection'
import { TypographySection } from './sections/TypographySection'
import { SpacingSection } from './sections/SpacingSection'
import { PanelSection } from './sections/PanelSection'
import { ButtonSection } from './sections/ButtonSection'
import { BadgeSection } from './sections/BadgeSection'
import { StatusChipSection } from './sections/StatusChipSection'
import { StatTileSection } from './sections/StatTileSection'
import { LogEntrySection } from './sections/LogEntrySection'
import { TorchTimerSection } from './sections/TorchTimerSection'
import { DiceResultSection } from './sections/DiceResultSection'
import { PortraitAvatarSection } from './sections/PortraitAvatarSection'
import { SceneDividerSection } from './sections/SceneDividerSection'
import { DangerBannerSection } from './sections/DangerBannerSection'
import { TextInputSection } from './sections/TextInputSection'
import { ModalSection } from './sections/ModalSection'

// Shared column: the header and every section below share this exact
// max-width + padding so their left edges align — one layout system for
// the whole page, not a full-width header sitting above a centered
// content column.
const CONTAINER = 'mx-auto max-w-4xl px-6'

/** The living style-guide page (CLAUDE.md: "design system before
 * screens"). Right now this IS the whole app — there are no real
 * screens to route to yet. */
export function StyleGuide() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line">
        <div className={cx(CONTAINER, 'py-8')}>
          {/* Bebas Neue + uppercase are now baked into the h1 token itself
           * (this page's own headline is what proved the treatment out —
           * see typography.ts) — no per-instance override needed here
           * anymore. */}
          <h1 className={text.h1}>Style guide</h1>
          <p className={cx('mt-1', text.bodySecondary)}>
            Design tokens and the UI kit's core pieces, each shown in every state it supports.
          </p>
        </div>
      </header>
      {/* py-12 (48px, "section") — was py-10 (40px, off the closed
       * spacing scale). */}
      <main className={cx(CONTAINER, 'flex flex-col gap-12 py-12')}>
        <TokensSection />
        <TypographySection />
        <SpacingSection />
        <PanelSection />
        <ButtonSection />
        <BadgeSection />
        <StatusChipSection />
        <StatTileSection />
        <LogEntrySection />
        <TorchTimerSection />
        <DiceResultSection />
        <PortraitAvatarSection />
        <SceneDividerSection />
        <DangerBannerSection />
        <TextInputSection />
        <ModalSection />
      </main>
    </div>
  )
}
