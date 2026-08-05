import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'

interface LevelDemo {
  key: keyof typeof text
  example: string
  use: string
  /** Right-aligned mono spec column (styleguide-mockup.html's `.spec`) —
   * family plus the real size/line-height pulled straight from
   * index.css's `--text-*` tokens, not restated by hand. */
  spec: string
  /** Long-form levels (display/h1-h3/body) render their own example text
   * at the level's real style. label/numeric/caption/dataDisplay render a
   * compact real-world value instead, since a full sentence in any of
   * them isn't representative. */
  as?: 'p' | 'span'
}

const levels: LevelDemo[] = [
  { key: 'display', example: 'Grimoire', use: 'Brand moments only — never a UI heading.', spec: 'Pirata One · brand only' },
  {
    key: 'h1',
    example: 'Style guide',
    use: 'Page title. One per screen. Bebas Neue — condensed, uppercase.',
    spec: 'Bebas · 48/1.1',
  },
  {
    key: 'h2',
    example: 'Typography',
    use: 'Section heading. Bebas Neue — condensed, uppercase.',
    spec: 'Bebas · 32/1.2',
  },
  {
    key: 'h3',
    example: 'Bjorn Ironhand',
    use: 'Sub-heading — card titles, grouped content. Bebas Neue — condensed, uppercase.',
    spec: 'Bebas · 24/1.3',
  },
  {
    key: 'body',
    example: 'The torch gutters as you push open the vault door. Something shifts in the dark ahead.',
    use: 'Reading content — scene log, descriptions. Never below 16px on phones.',
    spec: 'Instrument · 16/1.7',
  },
  {
    key: 'bodySecondary',
    example: 'Rolled 14 vs AC 13 — hit.',
    use: 'Supporting detail alongside body text — timestamps, metadata lines.',
    spec: 'Instrument · 16/1.7 dim',
  },
  {
    key: 'caption',
    example: 'Bjorn',
    use: 'Small secondary text — Badge, Button labels, LogEntryRow sender/timestamp. Chivo Mono, no baked-in color (the caller sets one).',
    spec: 'Chivo · 12/1.4',
    as: 'span',
  },
  {
    key: 'label',
    example: 'Hit Points',
    use: 'Eyebrow / field label. Chivo Mono — technical UI chrome. May shrink below 16px.',
    spec: 'Chivo · 11 · +0.12em',
    as: 'span',
  },
  {
    key: 'numeric',
    example: '12 / 15',
    use: 'Compact stat values — the header strip. Chivo Mono, tabular figures.',
    spec: 'Chivo · 16 · tabular',
    as: 'span',
  },
  {
    key: 'dataDisplay',
    example: '38m',
    use: 'Larger standalone readouts — torch time, dice math, coordinates-style values. Chivo Mono, tabular figures.',
    spec: 'Chivo · 28 · tabular',
    as: 'span',
  },
]

export function TypographySection() {
  return (
    <Section
      id="sec-type"
      number="002"
      group="Foundation"
      title="Typography"
      description="A closed set of ten named levels (SPEC.md: “Typography is a closed set”). Every screen composes text from these — no ad-hoc font sizes or weights."
    >
      <div className="flex flex-col divide-y divide-line rounded-card border border-line bg-panel">
        {levels.map(({ key, example, use, spec, as = 'p' }) => {
          const Tag = as
          return (
            <div key={key} className="flex flex-col gap-2 p-4 sm:grid sm:grid-cols-[96px_1fr_auto] sm:items-baseline sm:gap-6">
              {/* key label purged from ad-hoc font-mono text-xs to the
               * closed-set caption level — caption bakes in no color
               * (typography.ts), so text-ink-faint is set explicitly here. */}
              <span className={cx(text.caption, 'text-ink-faint')}>{key}</span>
              <div className="min-w-0">
                <Tag className={cx(key === 'caption' ? 'text-ink' : undefined, text[key])}>{example}</Tag>
                <p className={cx('mt-1', text.label)}>{use}</p>
                {key === 'display' && (
                  <p className={cx('mt-1', text.caption, 'text-ink-faint')}>
                    Pirata One (blackletter), self-hosted from app/public/fonts. If this reads as a plain serif
                    instead, the font failed to load — that's the regression to watch for.
                  </p>
                )}
              </div>
              <span className={cx(text.caption, 'whitespace-nowrap text-ink-faint sm:text-right')}>{spec}</span>
            </div>
          )
        })}
      </div>
      <div className="rounded-card border border-purple/30 bg-panel2 px-4 py-3">
        <p className={text.body}>
          Rule: screens use only these ten named levels — no ad-hoc font sizes or weights anywhere.
        </p>
      </div>
    </Section>
  )
}
