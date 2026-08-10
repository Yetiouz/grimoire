/**
 * One status vocabulary for every Quest Log tab (2026-08-10 — the
 * owner's call to unify status indicators across Quests/NPCs/Factions/
 * Treasure rather than each tab inventing its own chip/color logic, which
 * is what `NpcCard`/`FactionCard`/`TreasureRow` each did independently
 * before this file existed).
 *
 * The six tones below aren't per-entity-type — they're a general-purpose
 * reading of "where does this thing stand," and the same tone means the
 * same thing regardless of which tab it's in:
 *   positive  — resolved, recruited, accepted, held, secured, allied, alive
 *   negative  — hostile
 *   caution   — pending, awaiting
 *   info      — active / in progress
 *   special   — captured or contained — NOT "bad", just "not free right
 *               now": a captured NPC and a contained cursed relic are the
 *               same shape of fact (something dangerous, presently
 *               constrained), which is why they share a color instead of
 *               orange meaning something different per tab.
 *   neutral   — deceased, lead-only/unconfirmed, or anything unrecognized
 *
 * `deriveStatusIndicator` is the one function every tab's status chip
 * calls — `quests.status`/`factions.disposition`/`treasure.status` are
 * real freeform prose in The Black Road's imported data (e.g. "Resolved
 * — Maela Rusk captured", "Accepted; complete if safely possible"), not
 * clean enums, while `npcs.status` already is a clean short enum (alive/
 * deceased/captured). Both cases go through the same pipeline: take the
 * leading clause (before the first strong separator) as the chip label,
 * derive the tone from keywords in THAT clause specifically — not the
 * full sentence, which matters for a case like "Resolved — Maela Rusk
 * captured": scanning the whole string would hit "captured" (a `special`
 * keyword) before "Resolved" and mislabel a completed quest as
 * still-in-progress. Scanning only the leading clause gets "Resolved"
 * right.
 */

export type StatusTone = 'positive' | 'negative' | 'caution' | 'info' | 'special' | 'neutral'

export interface StatusIndicator {
  label: string
  tone: StatusTone
}

export const TONE_DOT_CLASS: Record<StatusTone, string> = {
  positive: 'bg-green',
  negative: 'bg-red',
  caution: 'bg-yellow',
  info: 'bg-cyan',
  special: 'bg-orange',
  neutral: 'bg-ink-faint',
}

const CLAUSE_SEPARATORS = ['—', ';', ',']
const MAX_LABEL_LENGTH = 28

function leadingClause(text: string): string {
  let cut = text.length
  for (const separator of CLAUSE_SEPARATORS) {
    const index = text.indexOf(separator)
    if (index !== -1 && index < cut) cut = index
  }
  const clause = text.slice(0, cut).trim()
  return clause.length > MAX_LABEL_LENGTH ? `${clause.slice(0, MAX_LABEL_LENGTH - 1)}…` : clause
}

const SPECIAL_WORDS = ['captured', 'contained']
const NEGATIVE_WORDS = ['hostile']
const CAUTION_WORDS = ['pending', 'awaiting']
const INFO_WORDS = ['active']
const POSITIVE_WORDS = ['resolved', 'recruited', 'complete', 'accepted', 'held', 'secured', 'alive', 'allied', 'on loan']

function toneFromClause(clause: string): StatusTone {
  const lower = clause.toLowerCase()
  if (SPECIAL_WORDS.some((word) => lower.includes(word))) return 'special'
  if (NEGATIVE_WORDS.some((word) => lower.includes(word))) return 'negative'
  if (CAUTION_WORDS.some((word) => lower.includes(word))) return 'caution'
  if (INFO_WORDS.some((word) => lower.includes(word))) return 'info'
  if (POSITIVE_WORDS.some((word) => lower.includes(word))) return 'positive'
  return 'neutral'
}

/** `null`/`undefined`-safe — `factions.disposition` and `treasure.status`
 * are nullable columns; `quests.status` and `npcs.status` aren't, but
 * callers can pass either without a separate guard. */
export function deriveStatusIndicator(text: string | null | undefined): StatusIndicator | null {
  if (!text) return null
  const label = leadingClause(text)
  return { label, tone: toneFromClause(label) }
}
