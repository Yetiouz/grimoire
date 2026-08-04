import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the style guide without crashing', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Style guide' })).toBeInTheDocument()
  })
})
