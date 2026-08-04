import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SceneDivider } from './SceneDivider'

describe('SceneDivider', () => {
  it('renders its label', () => {
    render(<SceneDivider>Three days later</SceneDivider>)
    expect(screen.getByText('Three days later')).toBeInTheDocument()
  })

  it('exposes a separator role', () => {
    render(<SceneDivider>Chapter II</SceneDivider>)
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })
})
