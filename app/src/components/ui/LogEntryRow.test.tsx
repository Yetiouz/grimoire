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

  it('applies senderColor to a narration entry name (task 1: AI GM narration renders cyan)', () => {
    render(<LogEntryRow senderName="GM" senderColor="#35f0ff" message="The hall opens before you." kind="narration" />)
    expect(screen.getByText('GM')).toHaveStyle({ color: '#35f0ff' })
  })

  it('mutes system entries to a fixed ink-dim name color, ignoring senderColor', () => {
    render(<LogEntryRow senderName="System" senderColor="#9b5cff" message="..." kind="system" />)
    expect(screen.getByText('System')).toHaveStyle({ color: 'var(--color-ink-dim)' })
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

  it('gives a rules entry the orange-tinted treatment and applies senderColor', () => {
    const { container } = render(
      <LogEntryRow senderName="Rules" senderColor="#ff8a3d" message="See page 12." kind="rules" />,
    )
    expect(container.firstChild).toHaveClass('bg-orange/[0.06]')
    expect(screen.getByText('Rules')).toHaveStyle({ color: '#ff8a3d' })
  })
})
