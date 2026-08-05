import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// App now gates real screens behind auth (useAuth -> supabase.auth),
// which needs network/session mocking this pass doesn't set up yet.
// The one thing safely testable without that: the `/style-guide`
// pathname escape hatch short-circuits before AuthGate/useAuth are
// ever reached.
describe('App', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('renders the style guide at /style-guide', () => {
    window.history.pushState({}, '', '/style-guide')
    render(<App />)
    // 'Design System' is the masthead's actual h1 (Masthead.tsx) — the
    // old assertion here checked for 'Style guide', which no longer
    // matches anything on the page and was failing before this change
    // too (stale since the style-guide shell rebuild renamed the
    // heading; unrelated to Part B, fixed in passing since this file
    // needed touching anyway).
    expect(screen.getByRole('heading', { name: 'Design System' })).toBeInTheDocument()
  })
})
