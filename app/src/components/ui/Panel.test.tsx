import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Panel } from './Panel'

describe('Panel', () => {
  it('renders its children', () => {
    render(<Panel>Hello</Panel>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('only applies interactive hover styling when requested', () => {
    const { container, rerender } = render(<Panel>Static</Panel>)
    expect(container.firstChild).not.toHaveClass('cursor-pointer')

    rerender(<Panel interactive>Clickable</Panel>)
    expect(container.firstChild).toHaveClass('cursor-pointer')
  })
})
