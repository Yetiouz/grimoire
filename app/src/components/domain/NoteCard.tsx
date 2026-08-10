import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { Note } from '../../lib/world'

interface NoteCardProps {
  note: Note
  className?: string
}

function formattedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

/** One campaign note — the detail-view shape for `WorldTabs`' 5th tab
 * (2026-08-10, owner's call: "I think on the quest log panel we add
 * these tabs" plus a follow-up "I would consider... adding notes" —
 * resolved to a freeform scratchpad tab, not a field bolted onto NPCs/
 * Quests). Simplest of the four detail cards: no status dot (a note has
 * no status to derive one from, unlike quests/NPCs/factions/treasure),
 * no stacked field list (a note is just a title and a body) — just the
 * title, a dated byline, and the full body text, matching this table's
 * only three real columns (`lib/world.ts`'s `campaign_notes` migration).
 */
export function NoteCard({ note, className }: NoteCardProps) {
  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-3 py-3', className)}>
      <span className={cx(text.body, 'font-semibold')}>{note.title}</span>
      <p className={cx(text.label, 'mt-0.5 text-ink-faint')}>{formattedDate(note.created_at)}</p>
      {note.body && <p className={cx(text.bodySecondary, 'mt-2.5 whitespace-pre-wrap')}>{note.body}</p>}
    </div>
  )
}
