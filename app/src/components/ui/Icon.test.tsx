import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Icon } from './Icon'

describe('Icon', () => {
  it('renders on the 24px grid', () => {
    const { container } = render(<Icon name="hp" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '24')
    expect(svg).toHaveAttribute('height', '24')
  })

  it('defaults to the default-state color', () => {
    const { container } = render(<Icon name="hp" />)
    expect(container.querySelector('svg')).toHaveClass('text-ink-dim')
  })

  it('applies the active and danger state colors', () => {
    const { container: active } = render(<Icon name="hp" state="active" />)
    expect(active.querySelector('svg')).toHaveClass('text-purple')

    const { container: danger } = render(<Icon name="hp" state="danger" />)
    expect(danger.querySelector('svg')).toHaveClass('text-red')
  })

  it('is aria-hidden with no label', () => {
    const { container } = render(<Icon name="hp" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('is an accessible image when given a label', () => {
    const { container } = render(<Icon name="hp" label="Hit points" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('role', 'img')
    expect(svg).toHaveAttribute('aria-label', 'Hit points')
  })
})
