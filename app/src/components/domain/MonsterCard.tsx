import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Stepper } from '../ui/Stepper'
import { readMonsterStatBlock } from '../../lib/encounters'
import type { EncounterMonster } from '../../lib/encounters'

interface MonsterCardProps {
  monster: EncounterMonster
  isOwner: boolean
  busy: boolean
  onDamage: (delta: number) => void
  onToggleVisibility: (input: { visibleToPlayers?: boolean; hpVisibleToPlayers?: boolean }) => void
}

const ZONE_LABEL: Record<string, string> = { close: 'Close', near: 'Near', far: 'Far' }

/**
 * One monster's card inside `EncounterPanel` — presence/HP visibility
 * toggles and GM-only add/damage controls, per BUILD_PLAN's own
 * component-list entry. A non-owner only ever sees monsters RLS already
 * let through (`visible_to_players = true`), so this component doesn't
 * re-check that half of the gate — only `hp_visible_to_players`, which
 * Postgres can't enforce column-by-column (see migration
 * `0031_encounter_mode`'s own doc comment on that limitation), gets
 * checked client-side here.
 *
 * `attacks`/`notes` are shown to everyone who can see the card at all —
 * once a monster is visible, its attacks are the kind of thing players
 * would see or ask about at the table; `notes` is the one field kept
 * owner-only regardless of `visible_to_players`, since it's the GM's own
 * behind-the-scenes tactics, not something a monster being visible
 * implies a player should read.
 */
export function MonsterCard({ monster, isOwner, busy, onDamage, onToggleVisibility }: MonsterCardProps) {
  const [damageAmount, setDamageAmount] = useState(1)
  const statBlock = readMonsterStatBlock(monster.stat_block)
  const hasHp = statBlock.hp_max != null
  const showHp = isOwner || monster.hp_visible_to_players
  const isDefeated = hasHp && (statBlock.hp_current ?? statBlock.hp_max ?? 0) <= 0

  return (
    <div className={cx('flex flex-col gap-2 rounded-card border border-line bg-panel p-3', isDefeated && 'opacity-60')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx(text.body, 'truncate font-semibold')}>{monster.label}</span>
          {isDefeated && <span className={cx(text.caption, 'uppercase text-red')}>Defeated</span>}
        </div>
        <span className={cx(text.caption, 'shrink-0 rounded-full border border-line-soft bg-panel2 px-2 py-0.5 uppercase text-ink-dim')}>
          {ZONE_LABEL[monster.zone] ?? monster.zone}
        </span>
      </div>

      <div className={cx('flex flex-wrap gap-3', text.caption, 'text-ink-dim')}>
        {statBlock.ac != null && (
          <span>
            <span className="text-ink-faint">AC</span> <b className="font-semibold tabular-nums text-ink">{statBlock.ac}</b>
          </span>
        )}
        {hasHp && showHp && (
          <span>
            <span className="text-ink-faint">HP</span>{' '}
            <b className={cx('font-semibold tabular-nums', isDefeated ? 'text-red' : 'text-ink')}>
              {statBlock.hp_current ?? statBlock.hp_max}/{statBlock.hp_max}
            </b>
          </span>
        )}
        {hasHp && !showHp && <span className="text-ink-faint">HP hidden</span>}
      </div>

      {statBlock.attacks && statBlock.attacks.length > 0 && (
        <p className={cx(text.caption, 'text-ink-dim')}>{statBlock.attacks.join(' · ')}</p>
      )}

      {isOwner && statBlock.notes && <p className={cx(text.caption, 'italic text-ink-faint')}>{statBlock.notes}</p>}

      {isOwner && (
        <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-line-soft pt-2">
          <Stepper value={damageAmount} onChange={setDamageAmount} min={1} max={999} label="damage" />
          <button
            type="button"
            disabled={busy || !hasHp}
            onClick={() => onDamage(-damageAmount)}
            className={cx(
              'inline-flex h-9 items-center justify-center rounded-button border px-3 font-mono uppercase',
              text.caption,
              'border-red/45 bg-red/10 text-red disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            Dmg
          </button>
          <button
            type="button"
            disabled={busy || !hasHp}
            onClick={() => onDamage(damageAmount)}
            className={cx(
              'inline-flex h-9 items-center justify-center rounded-button border px-3 font-mono uppercase',
              text.caption,
              'border-green/45 bg-green/10 text-green disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            Heal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleVisibility({ visibleToPlayers: !monster.visible_to_players })}
            aria-pressed={monster.visible_to_players}
            className={cx(
              'inline-flex h-9 items-center justify-center rounded-button border px-3 font-mono uppercase',
              text.caption,
              monster.visible_to_players ? 'border-purple/45 bg-purple/10 text-purple' : 'border-line-soft bg-panel2 text-ink-dim',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            {monster.visible_to_players ? 'Visible' : 'Hidden'}
          </button>
          {hasHp && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleVisibility({ hpVisibleToPlayers: !monster.hp_visible_to_players })}
              aria-pressed={monster.hp_visible_to_players}
              className={cx(
                'inline-flex h-9 items-center justify-center rounded-button border px-3 font-mono uppercase',
                text.caption,
                monster.hp_visible_to_players ? 'border-purple/45 bg-purple/10 text-purple' : 'border-line-soft bg-panel2 text-ink-dim',
                'disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              HP {monster.hp_visible_to_players ? 'shown' : 'hidden'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
