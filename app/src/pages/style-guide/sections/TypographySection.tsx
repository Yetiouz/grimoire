import { text } from '../../../lib/typography'
import { Section } from '../Section'

interface LevelDemo {
  key: keyof typeof text
  example: string
  use: string
  /** Long-form levels (display/h1-h3/body) render their own example text
   * at the level's real style. label/numeric render a compact real-world
   * value instead, since a full sentence in either isn't representative. */
  as?: 'p' | 'span'
}

const levels: LevelDemo[] = [
  { key: 'display', example: 'Grimoire', use: 'Brand moments only — never a UI heading.' },
  { key: 'h1', example: 'Style guide', use: 'Page title. One per screen.' },
  { key: 'h2', example: 'Typography', use: 'Section heading.' },
  { key: 'h3', example: 'Bjorn Ironhand', use: 'Sub-heading — card titles, grouped content.' },
  {
    key: 'body',
    example: 'The torch gutters as you push open the vault door. Something shifts in the dark ahead.',
    use: 'Reading content — scene log, descriptions. Never below 16px on phones.',
  },
  {
    key: 'bodySecondary',
    example: 'Rolled 14 vs AC 13 — hit.',
    use: 'Supporting detail alongside body text — timestamps, metadata lines.',
  },
  { key: 'label', example: 'Hit Points', use: 'Eyebrow / field label. May shrink below 16px.', as: 'span' },
  { key: 'numeric', example: '12 / 15', use: 'Stat values and dice results — tabular figures.', as: 'span' },
]

export function TypographySection() {
  return (
    <Section
      title="Typography"
      description="A closed set of eight named levels (SPEC.md: “Typography is a closed set”). Every screen composes text from these — no ad-hoc font sizes or weights."
    >
      <div className="flex flex-col divide-y divide-line rounded-card border border-line bg-panel">
        {levels.map(({ key, example, use, as = 'p' }) => {
          const Tag = as
          return (
            <div key={key} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="w-24 shrink-0 font-mono text-xs text-ink-faint">{key}</span>
              <div className="min-w-0 flex-1">
                <Tag className={text[key]}>{example}</Tag>
                <p className={`mt-1 ${text.label}`}>{use}</p>
                {key === 'display' && (
                  <p className="mt-1 text-xs text-ink-faint">
                    Pirata One (blackletter), self-hosted from app/public/fonts. If this reads as a plain serif
                    instead, the font failed to load — that's the regression to watch for.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="rounded-card border border-purple/30 bg-panel2 px-4 py-3">
        <p className={text.body}>
          Rule: screens use only these eight named levels — no ad-hoc font sizes or weights anywhere.
        </p>
      </div>
    </Section>
  )
}
