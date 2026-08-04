import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PortraitAvatar } from './PortraitAvatar'

describe('PortraitAvatar', () => {
  it('renders initials when no image is given', () => {
    render(<PortraitAvatar name="Bjorn Ironhand" color="#9b5cff" />)
    expect(screen.getByText('BI')).toBeInTheDocument()
  })

  it('exposes the character name to assistive tech', () => {
    render(<PortraitAvatar name="Allindra" color="#35f0ff" />)
    expect(screen.getByRole('img', { name: 'Allindra' })).toBeInTheDocument()
  })

  it('renders an image instead of initials when a portrait src is given', () => {
    render(<PortraitAvatar name="Bjorn" color="#9b5cff" src="/portraits/bjorn.png" />)
    expect(screen.queryByText('B')).not.toBeInTheDocument()
  })
})
