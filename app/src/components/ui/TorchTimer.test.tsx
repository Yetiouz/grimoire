import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TorchTimer } from './TorchTimer'

describe('TorchTimer', () => {
  it('renders the label and remaining time', () => {
    render(<TorchTimer label="Torch" minutesRemaining={12} minutesTotal={60} />)
    expect(screen.getByText('Torch')).toBeInTheDocument()
    expect(screen.getByText('12m')).toBeInTheDocument()
  })

  it('exposes remaining time as a progressbar', () => {
    render(<TorchTimer minutesRemaining={30} minutesTotal={60} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '30')
    expect(bar).toHaveAttribute('aria-valuemax', '60')
  })
})
