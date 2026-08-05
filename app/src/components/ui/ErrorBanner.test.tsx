import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  it('renders its message as an alert', () => {
    render(<ErrorBanner>Failed to load your character.</ErrorBanner>)
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load your character.')
  })

  it('omits the retry button when onRetry is not given', () => {
    render(<ErrorBanner>Failed to load your character.</ErrorBanner>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('fires onRetry from the retry button', () => {
    const onRetry = vi.fn()
    render(<ErrorBanner onRetry={onRetry}>Failed to load your character.</ErrorBanner>)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
