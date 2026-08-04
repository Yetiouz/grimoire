import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatTile } from './StatTile'

describe('StatTile', () => {
  it('renders the label and value', () => {
    render(<StatTile label="HP" value="12/15" />)
    expect(screen.getByText('HP')).toBeInTheDocument()
    expect(screen.getByText('12/15')).toBeInTheDocument()
  })

  it('applies an accent border color when given a tone', () => {
    const { container } = render(<StatTile label="Torch" value="45m" accent="orange" />)
    expect(container.firstChild).toHaveClass('border-l-orange')
  })
})
