import { TokensSection } from './sections/TokensSection'
import { PanelSection } from './sections/PanelSection'
import { ButtonSection } from './sections/ButtonSection'
import { BadgeSection } from './sections/BadgeSection'
import { StatTileSection } from './sections/StatTileSection'
import { LogEntrySection } from './sections/LogEntrySection'

/** The living style-guide page (CLAUDE.md: "design system before
 * screens"). Right now this IS the whole app — there are no real
 * screens to route to yet. */
export function StyleGuide() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line px-6 py-8">
        <p className="font-brand text-2xl">Grimoire</p>
        <h1 className="mt-2 text-2xl font-semibold">Style guide</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Design tokens and the UI kit's core pieces, each shown in every state it supports.
        </p>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-12 px-6 py-10">
        <TokensSection />
        <PanelSection />
        <ButtonSection />
        <BadgeSection />
        <StatTileSection />
        <LogEntrySection />
      </main>
    </div>
  )
}
