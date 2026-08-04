import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it('renders the label and value', () => {
    render(<StatusChip label="Torch" value="38m" />)
    expect(screen.getByText('Torch:')).toBeInTheDocument()
    expect(screen.getByText('38m')).toBeInTheDocument()
  })

  it('renders no tone dot when tone is omitted', () => {
    const { container } = render(<StatusChip label="Torch" value="38m" />)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument()
  })

  it('renders a tone dot when tone is given', () => {
    const { container } = render(<StatusChip label="Torch" value="38m" tone="orange" />)
    expect(container.querySelector('.bg-orange')).toBeInTheDocument()
  })
})
