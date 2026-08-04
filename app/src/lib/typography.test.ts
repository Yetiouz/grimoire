import { describe, expect, it } from 'vitest'
import { text } from './typography'

describe('typography', () => {
  it('exposes exactly the eight closed-set levels', () => {
    expect(Object.keys(text).sort()).toEqual(
      ['body', 'bodySecondary', 'display', 'h1', 'h2', 'h3', 'label', 'numeric'].sort(),
    )
  })

  it('keeps display scoped to the brand font', () => {
    expect(text.display).toContain('font-brand')
  })

  it('keeps numeric on tabular figures', () => {
    expect(text.numeric).toContain('tabular-nums')
  })
})
