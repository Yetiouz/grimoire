import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DangerBanner } from './DangerBanner'

describe('DangerBanner', () => {
  it('renders its message as an alert', () => {
    render(<DangerBanner>You are dying.</DangerBanner>)
    expect(screen.getByRole('alert')).toHaveTextContent('You are dying.')
  })

  it('labels the warning tone', () => {
    render(<DangerBanner tone="warning">The trap is triggered.</DangerBanner>)
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })
})
