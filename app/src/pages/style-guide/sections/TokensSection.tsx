import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'

const colorTokens = [
  { name: 'bg', hex: '#050506', className: 'bg-bg' },
  { name: 'panel', hex: '#101013', className: 'bg-panel' },
  { name: 'panel2', hex: '#17171B', className: 'bg-panel2' },
  { name: 'line', hex: '#232329', className: 'bg-line' },
  { name: 'line-hover', hex: '#33333C', className: 'bg-line-hover' },
  { name: 'ink', hex: '#F4F4F6', className: 'bg-ink' },
  { name: 'purple', hex: '#9B5CFF', className: 'bg-purple' },
  { name: 'green', hex: '#39FF8F', className: 'bg-green' },
  { name: 'red', hex: '#FF3B52', className: 'bg-red' },
  { name: 'yellow', hex: '#FFD23F', className: 'bg-yellow' },
  { name: 'orange', hex: '#FF8A3D', className: 'bg-orange' },
  { name: 'pink', hex: '#FF3FD6', className: 'bg-pink' },
  { name: 'cyan', hex: '#35F0FF', className: 'bg-cyan' },
] as const

export function TokensSection() {
  return (
    <Section
      id="sec-color"
      number="001"
      group="Foundation"
      title="Color"
      description="Torchlight purple leads. Indicator color lives in dots and edges, never fills. Surfaces are near-black; three ink tiers carry all text. Seeded from the landing page — two named radii (rounded-card 16px, rounded-button 11px) and four font families live in Typography below, not here."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {colorTokens.map((token) => (
          <div key={token.name} className="overflow-hidden rounded-card border border-line bg-panel">
            <div className={cx('h-14', token.className)} />
            <div className="flex items-baseline justify-between gap-2 px-3 py-2.5">
              <span className={text.body}>{token.name}</span>
              <span className={cx(text.caption, 'uppercase text-ink-faint')}>{token.hex}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
