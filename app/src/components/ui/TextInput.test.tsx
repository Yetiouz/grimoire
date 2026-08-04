import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TextInput } from './TextInput'

describe('TextInput', () => {
  it('renders a label wired to the input via htmlFor/id', () => {
    render(<TextInput label="Character name" id="char-name" />)
    const input = screen.getByLabelText('Character name')
    expect(input).toHaveAttribute('id', 'char-name')
  })

  it('shows the error message and marks the field invalid', () => {
    render(<TextInput label="Character name" error="Name is required" />)
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Character name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('has no error styling or message by default', () => {
    render(<TextInput label="Character name" />)
    const input = screen.getByLabelText('Character name')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toHaveClass('border-line')
  })
})
