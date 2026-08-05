import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

  it('stays presentational when interactive has no onClick — no button role attached to nothing', () => {
    render(<Panel interactive>Just for show</Panel>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('becomes a real keyboard-operable control once interactive + onClick are both set', () => {
    const onClick = vi.fn()
    render(
      <Panel interactive onClick={onClick}>
        Open character
      </Panel>,
    )
    const panel = screen.getByRole('button', { name: 'Open character' })
    expect(panel).toHaveAttribute('tabIndex', '0')

    fireEvent.click(panel)
    expect(onClick).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(panel, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(panel, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(3)

    fireEvent.keyDown(panel, { key: 'a' })
    expect(onClick).toHaveBeenCalledTimes(3)
  })
})
