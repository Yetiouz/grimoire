import { Footer } from './Footer'
import { Index, type IndexEntry } from './Index'
import { Masthead } from './Masthead'
import { TokensSection } from './sections/TokensSection'
import { TypographySection } from './sections/TypographySection'
import { SpacingSection } from './sections/SpacingSection'
import { IconographySection } from './sections/IconographySection'
import { PanelSection } from './sections/PanelSection'
import { ButtonSection } from './sections/ButtonSection'
import { BadgesChipsSection } from './sections/BadgesChipsSection'
import { StatTileSection } from './sections/StatTileSection'
import { TorchTimerSection } from './sections/TorchTimerSection'
import { DiceResultSection } from './sections/DiceResultSection'
import { PortraitAvatarSection } from './sections/PortraitAvatarSection'
import { SceneDividerSection } from './sections/SceneDividerSection'
import { LogEntrySection } from './sections/LogEntrySection'
import { InputsModalsSection } from './sections/InputsModalsSection'
import { AppStatesSection } from './sections/AppStatesSection'

// Shared column: the masthead, the index+content shell, and the footer
// all share this exact max-width + padding so their left/right edges
// align — one layout system for the whole page. Widened from max-w-4xl
// (896px) to 65rem (1040px) to match styleguide-mockup.html's shell —
// the extra room is what the 180px sticky index sits in.
const CONTAINER = 'mx-auto max-w-[65rem] px-6'

// Single source of truth for the sticky Index's links — kept in sync by
// hand with each section's own `id`/`number` props below, the same way
// styleguide-mockup.html keeps its <nav> list and <section id> tags in
// sync within one file.
const INDEX_ENTRIES: IndexEntry[] = [
  { id: 'sec-color', number: '001', label: 'Color' },
  { id: 'sec-type', number: '002', label: 'Typography' },
  { id: 'sec-spacing', number: '003', label: 'Spacing' },
  { id: 'sec-icons', number: '004', label: 'Iconography' },
  { id: 'sec-panel', number: '005', label: 'Panel' },
  { id: 'sec-buttons', number: '006', label: 'Buttons' },
  { id: 'sec-badges', number: '007', label: 'Badges & Chips' },
  { id: 'sec-stats', number: '008', label: 'Stat Tiles' },
  { id: 'sec-torch', number: '009', label: 'Torch Timer' },
  { id: 'sec-dice', number: '010', label: 'Dice Result' },
  { id: 'sec-portrait', number: '011', label: 'Portrait & Identity' },
  { id: 'sec-divider', number: '012', label: 'Scene Divider' },
  { id: 'sec-log', number: '013', label: 'Log Entries' },
  { id: 'sec-inputs', number: '014', label: 'Inputs & Modals' },
  { id: 'sec-states', number: '015', label: 'App States' },
]

/** The living style-guide page (CLAUDE.md: "design system before
 * screens"). Right now this IS the whole app — there are no real
 * screens to route to yet.
 *
 * Shell rebuilt to match styleguide-mockup.html (the approved target
 * composition, rendered from these same live tokens): masthead with
 * mono doc-metadata, numbered section eyebrows, a sticky side index
 * with scroll-spy, and every component state in a labeled specimen
 * cell. Pure composition — no token or component API changed; every
 * section below still renders the same UI-kit components it always did,
 * just wrapped differently. All 15 sections that existed before this
 * rebuild migrate in, in the mockup's category order (Foundation, then
 * Components) — Badge/StatusChip and TextInput/Modal merge into single
 * numbered sections per the mockup's "Badges & Chips" / "Inputs &
 * Modals" grouping; Panel gets its own Foundation slot since the mockup
 * doesn't name it but it's a primitive, not a component; Torch
 * timer/Dice result/Portrait/Scene divider keep their own numbers rather
 * than being crammed under "Stat Tiles" — the mockup's 10 index entries
 * are a pattern to extend, not a hard cap (four of them were literally
 * empty "SECTION CONTENT MIGRATES HERE" placeholders in the mockup
 * itself). App States is the one section that stays a placeholder for
 * real: Danger banner migrates in, but EmptyState/Skeleton/ErrorBanner
 * haven't been built yet. */
export function StyleGuide() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <Masthead />
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 gap-12 min-[800px]:grid-cols-[180px_1fr]">
          <Index entries={INDEX_ENTRIES} />
          <main className="flex min-w-0 flex-col gap-12 py-12">
            <TokensSection />
            <TypographySection />
            <SpacingSection />
            <IconographySection />
            <PanelSection />
            <ButtonSection />
            <BadgesChipsSection />
            <StatTileSection />
            <TorchTimerSection />
            <DiceResultSection />
            <PortraitAvatarSection />
            <SceneDividerSection />
            <LogEntrySection />
            <InputsModalsSection />
            <AppStatesSection />
          </main>
        </div>
      </div>
      <Footer />
    </div>
  )
}
