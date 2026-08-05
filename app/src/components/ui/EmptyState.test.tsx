import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No entries yet" />)
    expect(screen.getByText('No entries yet')).toBeInTheDocument()
  })

  it('renders description and action only when given', () => {
    const { rerender } = render(<EmptyState title="No entries yet" />)
    expect(screen.queryByText('The pages await.')).not.toBeInTheDocument()

    rerender(
      <EmptyState title="No entries yet" description="The pages await." action={<button>Create</button>} />,
    )
    expect(screen.getByText('The pages await.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
})
