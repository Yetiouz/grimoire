import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton, SkeletonGroup } from '../ui/Skeleton'
import { ErrorBanner } from '../ui/ErrorBanner'
import { Markdown } from '../ui/Markdown'
import { listSystemPacks } from '../../lib/gm'
import type { SystemPack } from '../../lib/gm'

interface GmReferenceProps {
  open: boolean
  /** The campaign's `system` column ('shadowdark' today) — packs are
   * per-ruleset, not per-campaign, same as `CharacterBuilder`'s own
   * `system` prop (see `JournalScreen.tsx`'s identical `campaign.system`
   * pass-through). */
  system: string
  onClose: () => void
}

/** `section` values are lowercase/underscored keys ('quick_reference'),
 * not display copy — falls back to this when a row's `title` is null
 * (the column is nullable; every real row today has one set, but a
 * future pack added directly in SQL might not). */
function fallbackTitle(section: string): string {
  return section
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * The GM reference viewer (BUILD_PLAN.md item 15 slice 3) — reads the
 * four `system_packs` rows (persona, house rules, quick reference,
 * encounter & treasure reference) that already feed the live AI GM's
 * system prompt every turn (`gm_turn/prompt.ts`'s own header comment).
 * This is not new content: it's a read surface onto prose the app
 * already depends on, previously only visible by reading the source
 * markdown files or the AI's own behavior.
 *
 * Visible to any campaign member, not owner-gated. The original scope
 * doc assumed this would need to be GM-only, matching the npcs/
 * locations "GM-only secret" precedent — but `system_packs`' own RLS
 * policy (`system_packs_select_authenticated`) is already `true` for
 * any authenticated user, not campaign- or owner-scoped, and it's
 * already consumed exactly that way by `CharacterBuilder`/`lib/rules/*`
 * for character-creation content. Gating this one new viewer behind
 * ownership would invent a restriction the underlying data model
 * doesn't actually have, for content that's table lore and house
 * rules, not a GM-only secret like an NPC's hidden stat block.
 *
 * Structure mirrors `RulesChat.tsx`: `Overlay` + refetch-on-open (packs
 * are effectively static within a session, but refetching is cheap and
 * keeps this from ever showing stale copy after a GM edits a pack's
 * row directly in SQL — the documented "no deploy" editing path).
 * Content renders through the existing `Markdown` component, same
 * renderer `RulesChat`'s transcript already uses — the pack bodies are
 * plain markdown-subset prose (headers/lists/bold), not raw HTML.
 *
 * Tabs key off `section` (the table's real column — see `SystemPack`'s
 * own doc comment in `lib/gm.ts` for the earlier `id`/`slug` mistake
 * this replaced after a live 400 caught it), not `title`: `title` is
 * nullable and purely display copy, `section` is what's actually
 * stable/unique per row.
 */
export function GmReference({ open, system, onClose }: GmReferenceProps) {
  const [packs, setPacks] = useState<SystemPack[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPacks(null)
    setError(null)
    listSystemPacks(system)
      .then((rows) => {
        if (cancelled) return
        setPacks(rows)
        setActiveSection(rows[0]?.section ?? null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the GM reference.')
      })
    return () => { cancelled = true }
  }, [open, system])

  const activePack = packs?.find((pack) => pack.section === activeSection) ?? null

  return (
    <Overlay
      open={open}
      onClose={onClose}
      width="wide"
      tall
      header={
        <div>
          <div className={text.body}>GM Reference</div>
          <div className={cx(text.label, 'mt-1')}>Persona, house rules, and quick references</div>
        </div>
      }
    >
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {packs === null && !error && (
        <SkeletonGroup label="Loading GM reference" className="gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
        </SkeletonGroup>
      )}

      {packs !== null && packs.length === 0 && (
        <EmptyState
          icon="rules"
          title="No reference content yet"
          description="Persona and house-rules packs for this system show up here once they're added."
        />
      )}

      {packs !== null && packs.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 flex-wrap gap-1.5 pb-1">
            {packs.map((pack) => (
              <button
                key={pack.section}
                type="button"
                onClick={() => setActiveSection(pack.section)}
                className={cx(
                  text.caption,
                  'shrink-0 rounded-full border px-3 py-1.5 font-semibold uppercase tracking-eyebrow',
                  activeSection === pack.section ? 'border-purple bg-purple text-white' : 'border-line-soft bg-panel2 text-ink-dim',
                )}
              >
                {pack.title ?? fallbackTitle(pack.section)}
              </button>
            ))}
          </div>

          {activePack && (
            <div className="rounded-card border border-line-soft bg-panel2 px-4 py-3.5">
              <Markdown text={activePack.body} variant="body" />
            </div>
          )}
        </div>
      )}
    </Overlay>
  )
}
