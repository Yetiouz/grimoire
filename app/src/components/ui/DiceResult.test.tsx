import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiceResult } from './DiceResult'

describe('DiceResult', () => {
  it('renders the total (roll + modifier) and the breakdown', () => {
    render(<DiceResult roll={14} modifier={3} />)
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('14 + 3')).toBeInTheDocument()
  })

  it('labels a critical outcome', () => {
    render(<DiceResult roll={20} outcome="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('falls back to the die type when outcome is default', () => {
    render(<DiceResult roll={11} sides={20} />)
    expect(screen.getByText('d20')).toBeInTheDocument()
  })
})
