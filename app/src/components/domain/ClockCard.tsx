import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { Stepper } from '../ui/Stepper'
import { TextInput } from '../ui/TextInput'
import type { Clock } from '../../lib/world'
import type { Faction } from '../../lib/world'

interface ClockUpdateFields {
  name: string
  description: string
  segments: number
  factionId: string | null
  revealed: boolean
}

interface ClockCardProps {
  clock: Clock
  /** The linked faction's name, resolved by the caller (`WorldTabs`
   * already has the full `factions` list in scope) rather than looked
   * up in here — same "caller resolves, card just renders" split
   * `NpcCard`'s `statBlock` prop already follows. `null` for a
   * freestanding clock with no `faction_id`. */
  factionName: string | null
  /** Every campaign faction, for the edit form's faction-link picker.
   * Only read when `editing` — a non-owner viewer never sees the edit
   * form at all, so this is otherwise unused. */
  factions: Faction[]
  /** Gates every mutation control (advance/reduce, edit, delete) — RLS
   * would reject a non-owner's write regardless (see migration
   * `0025_clocks`'s `SECURITY DEFINER` functions), but hiding the
   * controls entirely for a player is the honest UI: there's no
   * legitimate click for them to make here. */
  isOwner: boolean
  onAdjust: (delta: number) => Promise<void>
  onUpdateFields: (fields: ClockUpdateFields) => Promise<void>
  onDelete: () => Promise<void>
  className?: string
}

/** The segmented progress meter — one small square per segment, filled
 * (purple) up to `filled`. A visual clock, not a numeric readout alone:
 * SESSION_PROTOCOL.md's "decide what advances this session" reads
 * naturally as filling in the next box, same mental model Blades-in-
 * the-Dark-style clocks use everywhere else this mechanic appears. */
function ClockDots({ segments, filled }: { segments: number; filled: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          className={cx('h-3.5 w-3.5 shrink-0 rounded-sm border', index < filled ? 'border-purple bg-purple' : 'border-line-hover bg-transparent')}
        />
      ))}
    </div>
  )
}

/** One threat/faction clock — the detail-view shape, same "only rendered
 * inside `WorldDetailOverlay`" role every other `*Card` here plays
 * (BUILD_PLAN.md item 15 slice 2). Unlike those, this one has a real
 * owner-only edit surface: `clocks` is the first `WorldTabs` table
 * that's mutable in-app at all (see `lib/world.ts`'s `adjustClock`/
 * `updateClock`/`deleteClock` doc comments for why that's a schema-level
 * distinction, not just a UI one). `editing`/`pending`/`error` are all
 * local — this card owns its own edit-form and in-flight state, the
 * same shape `CharacterCommands` uses for character mutations, rather
 * than lifting either up to `WorldTabs`. */
export function ClockCard({ clock, factionName, factions, isOwner, onAdjust, onUpdateFields, onDelete, className }: ClockCardProps) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adjustAmount, setAdjustAmount] = useState(1)

  // Edit-form-local fields — reset from `clock` whenever edit mode opens
  // (not a `useEffect`: this only ever needs to happen at the moment
  // `editing` flips true, and re-deriving it inline on open avoids a
  // sync effect for what's really an "open the form" event).
  const [name, setName] = useState(clock.name)
  const [description, setDescription] = useState(clock.description)
  const [segments, setSegments] = useState(clock.segments)
  const [factionId, setFactionId] = useState<string | null>(clock.faction_id)
  const [revealed, setRevealed] = useState(clock.revealed)

  function openEdit() {
    setName(clock.name)
    setDescription(clock.description)
    setSegments(clock.segments)
    setFactionId(clock.faction_id)
    setRevealed(clock.revealed)
    setError(null)
    setEditing(true)
  }

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That failed.')
    } finally {
      setPending(false)
    }
  }

  // Not routed through `run()` above: that helper always resolves (it
  // swallows the error into `error` state), so chaining `.then(() =>
  // setConfirmingDelete(false))` after it would collapse the confirm
  // row even on a FAILED delete, stranding the error message with no
  // visible row explaining it. This only clears `confirmingDelete` on
  // genuine success — a failed delete leaves the confirm row (and the
  // error text above it) exactly where the owner was looking.
  async function handleDelete() {
    setPending(true)
    setError(null)
    try {
      await onDelete()
      setConfirmingDelete(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That failed.')
      setPending(false)
    }
  }

  if (editing) {
    return (
      <div className={cx('rounded-card border border-line-soft bg-panel2 px-3 py-3', className)}>
        {error && <p className={cx(text.caption, 'mb-2 text-red')}>{error}</p>}
        <div className="flex flex-col gap-3">
          <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          <TextInput label="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full" />
          <div className="flex items-center gap-3">
            <span className={cx(text.label, 'text-ink-faint')}>Segments</span>
            <Stepper value={segments} onChange={setSegments} min={1} max={12} label="segments" />
          </div>
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
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            className={cx(text.caption, 'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1', revealed ? 'border-green/45 text-green' : 'border-line-soft text-ink-dim')}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', revealed ? 'bg-green' : 'bg-ink-faint')} />
            {revealed ? 'Revealed to players' : 'GM only'}
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={pending || !name.trim()}
              onClick={() =>
                void run(async () => {
                  await onUpdateFields({ name: name.trim(), description: description.trim(), segments, factionId, revealed })
                  setEditing(false)
                })
              }
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <button type="button" disabled={pending} onClick={() => setEditing(false)} className={cx(text.label, 'disabled:opacity-40')}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-3 py-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={cx(text.body, 'font-semibold')}>{clock.name}</span>
        <span
          className={cx(
            text.caption,
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 uppercase tracking-eyebrow',
            clock.revealed ? 'border-green/45 text-green' : 'border-purple/45 text-purple',
          )}
        >
          <span className={cx('h-1.5 w-1.5 rounded-full', clock.revealed ? 'bg-green' : 'bg-purple')} />
          {clock.revealed ? 'Revealed' : 'GM only'}
        </span>
      </div>
      {factionName && <p className={cx(text.caption, 'mt-0.5 text-ink-dim')}>{factionName}</p>}

      <div className="mt-2.5 flex items-center gap-3">
        <ClockDots segments={clock.segments} filled={clock.filled} />
        <span className={cx(text.numeric, 'text-ink-dim')}>
          {clock.filled}/{clock.segments}
        </span>
      </div>

      {clock.description && <p className={cx(text.bodySecondary, 'mt-2.5')}>{clock.description}</p>}

      {isOwner && (
        <div className="mt-3 flex flex-col gap-3 border-t border-line-soft pt-3">
          {error && <p className={cx(text.caption, 'text-red')}>{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <Stepper value={adjustAmount} onChange={setAdjustAmount} min={1} max={clock.segments} label="segments" />
            <button
              type="button"
              disabled={pending || clock.filled <= 0}
              onClick={() => void run(() => onAdjust(-adjustAmount))}
              className={cx(
                'inline-flex h-11 items-center justify-center rounded-button border px-3 font-mono uppercase',
                text.caption,
                'border-red/45 bg-red/10 text-red disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              Reduce
            </button>
            <button
              type="button"
              disabled={pending || clock.filled >= clock.segments}
              onClick={() => void run(() => onAdjust(adjustAmount))}
              className={cx(
                'inline-flex h-11 items-center justify-center rounded-button border px-3 font-mono uppercase',
                text.caption,
                'border-green/45 bg-green/10 text-green disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              Advance
            </button>
          </div>

          {!confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={openEdit} className={text.label}>
                Edit clock
              </button>
              <button type="button" onClick={() => setConfirmingDelete(true)} className={text.label} style={{ color: 'var(--color-red)' }}>
                Delete clock
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-red/35 bg-panel px-3 py-2">
              <span className={cx(text.caption, 'text-ink-dim')}>Delete this clock? This can't be undone.</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => void handleDelete()}
                className={cx(text.label, 'disabled:opacity-40')}
                style={{ color: 'var(--color-red)' }}
              >
                {pending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirmingDelete(false)} className={cx(text.label, 'disabled:opacity-40')}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
