import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { deriveStatusIndicator } from '../../lib/statusTone'
import { StatusDot } from '../ui/StatusDot'
import type { Npc, NpcStatBlock } from '../../lib/world'

interface NpcCardProps {
  npc: Npc
  /** From `WorldTabs`' `listNpcStatBlocks` map, keyed by `npc_id` — `undefined`
   * for both "this NPC genuinely has no stat block" and "the viewer isn't
   * the campaign owner and RLS filtered it out." Those two cases render
   * identically (no GM section at all) by design: see `listNpcStatBlock`'s
   * doc comment in lib/world.ts. No separate `isGm` prop needed here. */
  statBlock?: NpcStatBlock
  className?: string
}

/** One NPC — the detail-view shape (2026-08-10: this used to be the list
 * card too; `WorldPreviewRow` took over the always-visible list, so this
 * now only renders inside `WorldDetailOverlay`). Name + status dot, role,
 * a meta-chip row (location/attitude/hireling terms), the freeform
 * summary, and — GM only, and only when one exists — a stat block
 * section. `attitude` renders as a plain meta chip rather than a status
 * dot: the real data ranges from one word ("Curious") to a full sentence
 * ("Exceptionally helpful on first meeting"), so unlike `status` it isn't
 * short enough to be one. Status tone/label now come from
 * `lib/statusTone.ts`'s shared `deriveStatusIndicator`, not a
 * component-local color map — see that file's doc comment for the
 * cross-tab tone vocabulary this is part of. */
export function NpcCard({ npc, statBlock, className }: NpcCardProps) {
  const metaChips: string[] = []
  if (npc.location) metaChips.push(`📍 ${npc.location}`)
  if (npc.attitude) metaChips.push(npc.attitude)
  if (npc.is_hireling && npc.hire_terms) metaChips.push(npc.hire_terms)
  const statusIndicator = deriveStatusIndicator(npc.status)

  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-3 py-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={cx(text.body, 'font-semibold')}>{npc.name}</span>
        {statusIndicator && <StatusDot {...statusIndicator} />}
      </div>
      {npc.role && <p className={cx(text.caption, 'mt-0.5 text-ink-dim')}>{npc.role}</p>}
      {metaChips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {metaChips.map((chip, index) => (
            <span
              key={index}
              className={cx(
                text.caption,
                'rounded-full border px-2.5 py-0.5',
                npc.is_hireling && chip === npc.hire_terms
                  ? 'border-cyan/30 text-cyan'
                  : 'border-line-soft bg-panel text-ink-faint',
              )}
            >
              {chip}
            </span>
          ))}
        </div>
      )}
      <p className={cx(text.bodySecondary, 'mt-2')}>{npc.summary}</p>

      {statBlock && <NpcStatBlockSection statBlock={statBlock} />}
    </div>
  )
}

/** `stat_block` is `Json` (string | number | boolean | null | object |
 * array) at the type level — Postgres doesn't know or enforce a shape for
 * it — so this narrows to a plain record once, here, rather than
 * repeating the `typeof`/`Array.isArray` guard at every field access the
 * way an inline version would. Every field is read defensively (`?.`,
 * optional chaining into a possibly-absent key) since the three real rows
 * today (Rowan Pike/Miri Sedge/Hester Crowe) don't all carry the same
 * keys — only Miri and Hester have `notes`, for instance. */
function NpcStatBlockSection({ statBlock }: { statBlock: NpcStatBlock }) {
  const raw = statBlock.stat_block
  const fields: Record<string, unknown> = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}
  const attacks = Array.isArray(fields.attacks) ? (fields.attacks as unknown[]).map(String) : null

  return (
    <div className="mt-2.5 rounded-lg border border-purple/25 bg-panel px-2.5 py-2">
      <p className={cx(text.label, 'text-purple')}>⛨ GM only — stat block</p>
      <div className={cx(text.caption, 'mt-1.5 flex flex-wrap gap-4 text-ink')}>
        {fields.ac !== undefined && (
          <span>
            <span className="text-ink-faint">AC </span>
            {String(fields.ac)}
          </span>
        )}
        {fields.hp_current !== undefined && fields.hp_max !== undefined && (
          <span>
            <span className="text-ink-faint">HP </span>
            {String(fields.hp_current)}/{String(fields.hp_max)}
          </span>
        )}
      </div>
      {attacks && attacks.length > 0 && (
        <p className={cx(text.caption, 'mt-1.5 text-ink-dim')}>
          <span className={cx(text.label, 'mr-1 text-ink-faint')}>Attacks</span>
          {attacks.join(' · ')}
        </p>
      )}
      {typeof fields.notes === 'string' && <p className={cx(text.caption, 'mt-1 italic text-ink-faint')}>{fields.notes}</p>}
    </div>
  )
}
