import { Section } from '../Section'

const colorTokens = [
  { name: 'bg', className: 'bg-bg' },
  { name: 'panel', className: 'bg-panel' },
  { name: 'panel2', className: 'bg-panel2' },
  { name: 'line', className: 'bg-line' },
  { name: 'ink', className: 'bg-ink' },
  { name: 'purple', className: 'bg-purple' },
  { name: 'green', className: 'bg-green' },
  { name: 'red', className: 'bg-red' },
  { name: 'yellow', className: 'bg-yellow' },
  { name: 'orange', className: 'bg-orange' },
  { name: 'pink', className: 'bg-pink' },
  { name: 'cyan', className: 'bg-cyan' },
] as const

export function TokensSection() {
  return (
    <Section
      title="Tokens"
      description="Colors seeded from the landing page's palette. Two new named radii: rounded-card (16px, panels/containers) and rounded-button (11px, buttons specifically — deliberately not full-round; see the Button section below). Fonts and type sizes live in the Typography section below."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {colorTokens.map((token) => (
          <div key={token.name} className="flex items-center gap-2 rounded-lg border border-line bg-panel p-2">
            <span className={`h-6 w-6 rounded-md border border-line-soft ${token.className}`} />
            <span className="text-xs text-ink-dim">{token.name}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}
