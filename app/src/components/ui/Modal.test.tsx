import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders the title and body', () => {
    render(
      <Modal title="Delete character?" onCancel={() => {}} onConfirm={() => {}} inline>
        This can't be undone.
      </Modal>,
    )
    expect(screen.getByText('Delete character?')).toBeInTheDocument()
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument()
  })

  it('fires onCancel/onConfirm from the ghost-cancel and primary action', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <Modal title="Delete character?" onCancel={onCancel} onConfirm={onConfirm} inline>
        This can't be undone.
      </Modal>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when open is false', () => {
    const { container } = render(
      <Modal title="Delete character?" onCancel={() => {}} onConfirm={() => {}} open={false} inline>
        This can't be undone.
      </Modal>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
