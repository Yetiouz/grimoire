import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { listCampaignEventsSince } from '../../lib/campaigns'
import type { CampaignSession } from '../../lib/campaigns'
import type { Character } from '../../lib/characters'

interface EndSessionReviewProps {
  open: boolean
  campaignId: string
  /** The session about to end — `null` only for the brief instant
   * between `onOpenReview` firing and `openSession` resolving, which
   * in practice never happens (the Stop Session button that opens this
   * is itself disabled without an open session). Guarded anyway rather
   * than assumed, same as every other `| null` session reference on
   * this screen. */
  session: CampaignSession | null
  characters: Character[]
  ending: boolean
  onClose: () => void
  onConfirm: (recapNote: string) => void
}

interface CharacterTally {
  name: string
  color: string | null
  xpDelta: number
  gpDelta: number
  spDelta: number
  cpDelta: number
  hpDelta: number
  gearAdded: number
  gearRemoved: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${n}`
}

function formatTally(tally: CharacterTally): string {
  const parts: string[] = []
  if (tally.xpDelta !== 0) parts.push(`${signed(tally.xpDelta)} XP`)
  if (tally.gpDelta !== 0) parts.push(`${signed(tally.gpDelta)} gp`)
  if (tally.spDelta !== 0) parts.push(`${signed(tally.spDelta)} sp`)
  if (tally.cpDelta !== 0) parts.push(`${signed(tally.cpDelta)} cp`)
  if (tally.hpDelta !== 0) parts.push(`HP ${signed(tally.hpDelta)}`)
  if (tally.gearAdded > 0) parts.push(`+${tally.gearAdded} item${tally.gearAdded === 1 ? '' : 's'}`)
  if (tally.gearRemoved > 0) parts.push(`-${tally.gearRemoved} item${tally.gearRemoved === 1 ? '' : 's'}`)
  return parts.join(', ')
}

/**
 * BUILD_PLAN.md item 7's remaining gap (2026-08-14) — "Stop Session"
 * used to just call `endSession` and update state (see
 * `JournalScreen.tsx`'s old `handleEndSession`), with no XP/treasure
 * summary and no "next pickup" note anywhere, the exact gap the audit
 * flagged. `SESSION_PROTOCOL.md`'s own after-session checklist has the
 * GM write both by hand into `campaign-state.md` every session; this
 * is the in-app review step that replaces it.
 *
 * This component only PREVIEWS the recap — it independently re-derives
 * the same numbers `end_session` itself computes server-side (same
 * event kinds, same "since this session's own `started_at`" window —
 * see migration `0028_session_recap.sql`) by reading `campaign_events`
 * directly, so the GM sees before confirming roughly what's about to
 * be written to the log. The server is still the one source of truth
 * for what actually gets logged; a mutation landing in the gap between
 * this preview loading and the GM clicking "End Session" would show up
 * in the real log line but not this preview. Acceptable for a summary
 * a human is about to read and possibly add to, not a ledger.
 *
 * The "next time" note is free text, matching `campaign-state.md`'s
 * own "next-session pickup point" — deliberately not asking for
 * anything structured (location, threads, clocks) the way the rest of
 * this app's commands do, since GM prep notes are exactly the kind of
 * loose, associative text a fixed schema would fight rather than help.
 */
export function EndSessionReview({ open, campaignId, session, characters, ending, onClose, onConfirm }: EndSessionReviewProps) {
  const [note, setNote] = useState('')
  const [tallies, setTallies] = useState<CharacterTally[] | null>(null)
  const [clocksAdvanced, setClocksAdvanced] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !session) return
    setNote('')
    setLoading(true)
    setError(null)
    let cancelled = false
    void listCampaignEventsSince(campaignId, session.started_at)
      .then((events) => {
        if (cancelled) return
        const byCharacterId = new Map<string, CharacterTally>()
        let clockCount = 0
        for (const event of events) {
          if (event.kind === 'clock_advanced') {
            clockCount += 1
            continue
          }
          if (!isRecord(event.payload)) continue
          const characterId = event.payload.character_id
          if (typeof characterId !== 'string') continue
          const character = characters.find((candidate) => candidate.id === characterId)
          if (!character) continue

          const tally: CharacterTally = byCharacterId.get(characterId) ?? {
            name: character.name,
            color: character.color,
            xpDelta: 0,
            gpDelta: 0,
            spDelta: 0,
            cpDelta: 0,
            hpDelta: 0,
            gearAdded: 0,
            gearRemoved: 0,
          }
          if (event.kind === 'character_xp_changed') tally.xpDelta += asInt(event.payload.delta)
          if (event.kind === 'character_hp_changed') tally.hpDelta += asInt(event.payload.delta)
          if (event.kind === 'character_gold_changed') {
            tally.gpDelta += asInt(event.payload.delta_gp)
            tally.spDelta += asInt(event.payload.delta_sp)
            tally.cpDelta += asInt(event.payload.delta_cp)
          }
          if (event.kind === 'character_gear_added') tally.gearAdded += 1
          if (event.kind === 'character_gear_removed') tally.gearRemoved += 1
          byCharacterId.set(characterId, tally)
        }
        setTallies(
          Array.from(byCharacterId.values())
            .filter((tally) => formatTally(tally) !== '')
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
        setClocksAdvanced(clockCount)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this session's recap.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignId, session?.id])

  if (!session) return null

  const hasRecap = (tallies?.length ?? 0) > 0 || clocksAdvanced > 0

  return (
    <Modal
      open={open}
      title={`End Session ${session.number}?`}
      onCancel={onClose}
      onConfirm={() => {
        if (!ending) onConfirm(note)
      }}
      cancelLabel="Keep playing"
      confirmLabel={ending ? 'Ending…' : 'End Session'}
      className="max-w-lg"
    >
      <div className="flex flex-col gap-4">
        {error && <p className="text-red">{error}</p>}
        {loading && <p className={cx(text.caption, 'text-ink-faint')}>Checking what changed this session…</p>}
        {!loading && !error && (
          <div className="flex flex-col gap-1.5">
            <p className={cx(text.caption, 'uppercase tracking-eyebrow text-ink-faint')}>This session</p>
            {hasRecap ? (
              <>
                {tallies?.map((tally) => (
                  <p key={tally.name}>
                    <span className="font-semibold" style={{ color: tally.color ?? undefined }}>
                      {tally.name}
                    </span>
                    {': '}
                    {formatTally(tally)}
                  </p>
                ))}
                {clocksAdvanced > 0 && (
                  <p>
                    {clocksAdvanced} clock{clocksAdvanced === 1 ? '' : 's'} advanced
                  </p>
                )}
              </>
            ) : (
              <p className="text-ink-faint">No character or clock changes logged this session.</p>
            )}
          </div>
        )}
        <Textarea
          label="Next time (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Where things stand, what's next…"
          rows={3}
        />
      </div>
    </Modal>
  )
}
