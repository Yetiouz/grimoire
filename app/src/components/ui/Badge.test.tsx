import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders its label text', () => {
    render(<Badge tone="green">Live</Badge>)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('uses the panel background for status and panel2 for indicator', () => {
    const { container: statusContainer } = render(
      <Badge tone="red" variant="status">
        Status
      </Badge>,
    )
    expect(statusContainer.firstChild).toHaveClass('bg-panel')

    const { container: indicatorContainer } = render(
      <Badge tone="red" variant="indicator">
        Indicator
      </Badge>,
    )
    expect(indicatorContainer.firstChild).toHaveClass('bg-panel2')
  })
})
