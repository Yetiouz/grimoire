import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogEntryRow } from './LogEntryRow'

describe('LogEntryRow', () => {
  it('renders the sender name and message', () => {
    render(<LogEntryRow senderName="Bjorn" senderColor="#9b5cff" message="Opens the door." />)
    expect(screen.getByText('Bjorn')).toBeInTheDocument()
    expect(screen.getByText('Opens the door.')).toBeInTheDocument()
  })

  it('gives a narration entry the quiet panel-card treatment', () => {
    const { container } = render(
      <LogEntryRow senderName="GM" senderColor="#66666f" message="The hall opens before you." kind="narration" />,
    )
    expect(container.firstChild).toHaveClass('bg-panel')
  })

  it('mutes narration entries to a fixed ink-dim name color, ignoring senderColor', () => {
    render(<LogEntryRow senderName="GM" senderColor="#9b5cff" message="..." kind="narration" />)
    expect(screen.getByText('GM')).toHaveStyle({ color: 'var(--color-ink-dim)' })
  })

  it('applies senderColor to an action entry name', () => {
    render(<LogEntryRow senderName="Bjorn" senderColor="#9b5cff" message="Draws steel." kind="action" />)
    expect(screen.getByText('Bjorn')).toHaveStyle({ color: '#9b5cff' })
  })

  it('shows a ROLL tag for roll entries', () => {
    render(<LogEntryRow senderName="Bjorn" senderColor="#9b5cff" message="d20+1 -> 16" kind="roll" />)
    expect(screen.getByText('roll')).toBeInTheDocument()
  })

  it('shows a NOTE tag for note entries and no tag for action entries', () => {
    render(<LogEntryRow senderName="Bjorn" senderColor="#9b5cff" message="Remember the flagstones." kind="note" />)
    expect(screen.getByText('note')).toBeInTheDocument()
  })
})
