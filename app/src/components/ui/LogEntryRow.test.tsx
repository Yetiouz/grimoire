import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogEntryRow } from './LogEntryRow'

describe('LogEntryRow', () => {
  it('renders the sender name and message', () => {
    render(<LogEntryRow senderName="Bjorn" senderColor="#9b5cff" message="Opens the door." />)
    expect(screen.getByText('Bjorn')).toBeInTheDocument()
    expect(screen.getByText('Opens the door.')).toBeInTheDocument()
  })

  it('gives a system-kind entry the panel2 background', () => {
    const { container } = render(
      <LogEntryRow senderName="System" senderColor="#a5a5ae" message="Round 3 begins." kind="system" />,
    )
    expect(container.firstChild).toHaveClass('bg-panel2')
  })
})
