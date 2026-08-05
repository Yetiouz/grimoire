import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Icon } from '../ui/Icon'
import { PortraitAvatar } from '../ui/PortraitAvatar'
import { readCharacterGold, readCharacterSheet } from '../../lib/characters'
import type { Character } from '../../lib/characters'

interface PlayerCardProps {
  character: Character
  onClick?: () => void
  className?: string
}

/**
 * Party-rail PlayerCard, specced directly from `player-view-mockup.html`'s
 * `.pcard` (per the "from the latest mockup" resolution to this slice's
 * open questions) rather than designed fresh. Renders as a simple
 * stacked card inside the existing `max-w-2xl` phone-first journal
 * column for this slice — the mockup's full left-rail/initiative-
 * tracker composition (turn order, the tool dock) is later table-view
 * work, not built here.
 *
 * `status !== 'active'` (Constantine/LaLa, imported as `awaiting`)
 * renders dimmed at the mockup's exact `.pcard.offline{opacity:0.45}`
 * rather than hidden — the resolved open question. Unlike the mockup's
 * own "Miri · In town" example, no fabricated location text is added;
 * the real `status` value is shown instead.
 *
 * `hp_current <= 0` gets the mockup's `.pcard.down` border/background
 * treatment — real, derivable from data already on hand — but not its
 * down-timer countdown line, which needs stabilize-DC/rounds-remaining
 * data this schema doesn't carry. No `active-turn`/turn-badge state
 * either: that needs initiative-order data from the (unbuilt) Encounter
 * slice.
 *
 * No torch/luck icons — no light-tracking or luck-token data exists in
 * the schema. Only the bless icon, and only when `sheet.active_blessing`
 * is a real, present string.
 */
export function PlayerCard({ character, onClick, className }: PlayerCardProps) {
  const gold = readCharacterGold(character.gold)
  const sheet = readCharacterSheet(character.sheet)
  const isAwaiting = character.status !== 'active'
  const isDown = character.hp_current <= 0
  const hpPct = character.hp_max > 0 ? Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100)) : 0
  const activatable = Boolean(onClick)

  return (
    <div
      className={cx(
        'relative rounded-card border border-line bg-panel p-3 transition-[border-color,transform] duration-150',
        activatable && 'cursor-pointer hover:-translate-y-0.5 hover:border-line-hover',
        activatable &&
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        isDown && 'border-red/55 bg-red/5',
        isAwaiting && 'opacity-45',
        className,
      )}
      role={activatable ? 'button' : undefined}
      tabIndex={activatable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        activatable
          ? (event: { key: string; preventDefault: () => void }) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      <div className="mb-2 flex items-center gap-2">
        <PortraitAvatar name={character.name} color={character.color ?? '#9b5cff'} size="sm" />
        <div className="min-w-0">
          <p className={cx(text.body, 'truncate font-semibold leading-tight')}>{character.name}</p>
          <p className={cx(text.caption, 'truncate uppercase tracking-eyebrow text-ink-faint')}>
            {character.class_title} {character.level}
            {isAwaiting && ` · ${character.status}`}
          </p>
        </div>
        {sheet.active_blessing && (
          <span
            className="ml-auto flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border border-purple/40 bg-panel2"
            title={sheet.active_blessing}
          >
            <Icon name="bless" state="active" className="h-3 w-3" label="Blessing active" />
          </span>
        )}
      </div>
      <div className="mb-2 h-[5px] overflow-hidden rounded-full bg-line">
        <div className={cx('h-full rounded-full', isDown ? 'bg-red' : 'bg-green')} style={{ width: `${hpPct}%` }} />
      </div>
      <div className={cx('flex flex-wrap gap-3', text.caption, 'text-ink-dim')}>
        <span>
          <span className="text-ink-faint">HP</span>{' '}
          <b className={cx('font-semibold tabular-nums', isDown ? 'text-red' : 'text-ink')}>
            {character.hp_current}/{character.hp_max}
          </b>
        </span>
        <span>
          <span className="text-ink-faint">AC</span> <b className="font-semibold tabular-nums text-ink">{character.ac}</b>
        </span>
        {character.gear_current != null && character.gear_max != null && (
          <span>
            <span className="text-ink-faint">BAG</span>{' '}
            <b className="font-semibold tabular-nums text-ink">
              {character.gear_current}/{character.gear_max}
            </b>
          </span>
        )}
        {gold.gp != null && (
          <span>
            <span className="text-ink-faint">GP</span> <b className="font-semibold tabular-nums text-ink">{gold.gp}</b>
          </span>
        )}
      </div>
    </div>
  )
}
