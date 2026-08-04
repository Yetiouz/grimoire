import { describe, expect, it } from 'vitest'
import { text } from './typography'

describe('typography', () => {
  it('exposes exactly the ten closed-set levels', () => {
    expect(Object.keys(text).sort()).toEqual(
      ['body', 'bodySecondary', 'caption', 'dataDisplay', 'display', 'h1', 'h2', 'h3', 'label', 'numeric'].sort(),
    )
  })

  it('keeps display scoped to the brand font', () => {
    expect(text.display).toContain('font-brand')
  })

  it('keeps numeric on tabular figures', () => {
    expect(text.numeric).toContain('tabular-nums')
  })

  it('keeps dataDisplay on tabular figures too', () => {
    expect(text.dataDisplay).toContain('tabular-nums')
  })

  it('leaves caption without a baked-in color (every other level bakes one)', () => {
    expect(text.caption).not.toMatch(/text-ink|text-white/)
  })
})
