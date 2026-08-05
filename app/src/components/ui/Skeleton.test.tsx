import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton, SkeletonGroup } from './Skeleton'

describe('Skeleton', () => {
  it('renders hidden from assistive tech', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('SkeletonGroup', () => {
  it('announces once at the group level', () => {
    render(
      <SkeletonGroup label="Loading character sheet">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </SkeletonGroup>,
    )
    expect(screen.getByRole('status', { name: 'Loading character sheet' })).toBeInTheDocument()
  })

  it('defaults the label to "Loading"', () => {
    render(
      <SkeletonGroup>
        <Skeleton className="h-4 w-32" />
      </SkeletonGroup>,
    )
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})
