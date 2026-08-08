import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders plain text as a paragraph unchanged', () => {
    render(<Markdown text="Stabilizing is a DC 15 INT check." />)
    expect(screen.getByText('Stabilizing is a DC 15 INT check.')).toBeInTheDocument()
  })

  it('renders **bold** as a strong element', () => {
    const { container } = render(<Markdown text="A shield gives **+1 AC**." />)
    const strong = container.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong).toHaveTextContent('+1 AC')
  })

  it('renders *italic* and _italic_ as em elements', () => {
    const { container } = render(<Markdown text="This is *italic* and _also italic_." />)
    const ems = container.querySelectorAll('em')
    expect(ems).toHaveLength(2)
    expect(ems[0]).toHaveTextContent('italic')
    expect(ems[1]).toHaveTextContent('also italic')
  })

  it('renders a heading as a bold line, not a real h1/h2/h3', () => {
    const { container } = render(<Markdown text="## Modes of Play" />)
    expect(container.querySelector('h1, h2, h3')).toBeNull()
    expect(screen.getByText('Modes of Play')).toBeInTheDocument()
  })

  it('renders a hyphen list as a ul with list items', () => {
    render(<Markdown text={'- Hunter\n- Momentum\n- Pulp'} />)
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('UL')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Hunter')).toBeInTheDocument()
  })

  it('renders a numbered list as an ol with list items', () => {
    render(<Markdown text={'1. Roll initiative\n2. Resolve turns'} />)
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('OL')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('keeps a single line break inside one paragraph, not a new block', () => {
    const { container } = render(<Markdown text={'Line one\nLine two'} />)
    expect(container.querySelectorAll('p')).toHaveLength(1)
    expect(container.querySelector('br')).not.toBeNull()
  })

  it('starts a new paragraph on a blank line', () => {
    const { container } = render(<Markdown text={'First paragraph.\n\nSecond paragraph.'} />)
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('leaves an unmatched asterisk as plain text', () => {
    render(<Markdown text="3 * 4 = 12" />)
    expect(screen.getByText('3 * 4 = 12')).toBeInTheDocument()
  })
})
