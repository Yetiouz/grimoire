import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the Grimoire placeholder without crashing', () => {
    render(<App />)
    expect(screen.getByText('Grimoire')).toBeInTheDocument()
  })
})
