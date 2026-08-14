import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { Stepper } from '../ui/Stepper'
import { TextInput } from '../ui/TextInput'
import type { Faction } from '../../lib/world'

interface ClockCreateFormProps {
  factions: Faction[]
  onCreate: (fields: { name: string; segments: number; description: string; factionId: string | null }) => Promise<void>
}

/**
 * The Clocks tab's "+ New Clock" entry point (BUILD_PLAN.md item 15
 * slice 2) — split out of `WorldTabs.tsx` purely for CLAUDE.md's
 * ~300-line file cap (`ClockCard.tsx`'s owner-only edit form already
 * covers editing an existing clock; this is the create-a-new-one twin,
 * different enough in shape — no `revealed` toggle yet, since a
 * brand-new clock is GM-only by default same as `create_clock`'s own
 * server-side default — that folding it into `ClockCard` would mean
 * that component juggling "editing an existing row" and "there is no
 * row yet" at once).
 *
 * Closed state is a plain dashed `Button`, matching `JournalDesktopLayout`'s
 * `+ New Character` tile exactly (`variant="dashed"` is the app's one
 * "add a new thing" visual, not a bespoke look invented here).
 */
export function ClockCreateForm({ factions, onCreate }: ClockCreateFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [segments, setSegments] = useState(6)
  const [factionId, setFactionId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setDescription('')
    setSegments(6)
    setFactionId(null)
    setError(null)
  }

  async function handleCreate() {
    setPending(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), segments, description: description.trim(), factionId })
      reset()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that clock.')
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="dashed" onClick={() => setOpen(true)} className="w-full">
        + New Clock
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line-soft bg-panel2 px-3 py-3">
      {error && <p className={cx(text.caption, 'text-red')}>{error}</p>}
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full" placeholder="Varek's Rite to Awaken the Black Hart" />
      <TextInput label="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full" />
      <div className="flex items-center gap-3">
        <span className={cx(text.label, 'text-ink-faint')}>Segments</span>
        <Stepper value={segments} onChange={setSegments} min={1} max={12} label="segments" />
      </div>
      {factions.length > 0 && (
        <div>
          <span className={cx(text.label, 'text-ink-faint')}>Faction</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFactionId(null)}
              className={cx(
                text.caption,
                'rounded-full border px-3 py-1',
                factionId === null ? 'border-line-hover bg-panel text-ink' : 'border-line-soft text-ink-dim hover:border-line-hover',
              )}
            >
              None
            </button>
            {factions.map((faction) => (
              <button
                key={faction.id}
                type="button"
                onClick={() => setFactionId(faction.id)}
                className={cx(
                  text.caption,
                  'rounded-full border px-3 py-1',
                  factionId === faction.id ? 'border-line-hover bg-panel text-ink' : 'border-line-soft text-ink-dim hover:border-line-hover',
                )}
              >
                {faction.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={pending || !name.trim()} onClick={() => void handleCreate()}>
          {pending ? 'Creating…' : 'Create clock'}
        </Button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            reset()
            setOpen(false)
          }}
          className={cx(text.label, 'disabled:opacity-40')}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
