import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Icon } from '../ui/Icon'
import { PortraitAvatar } from '../ui/PortraitAvatar'
import { readCharacterGold, readCharacterSheet } from '../../lib/characters'
import { getSystemDisplay } from '../../lib/rules'
import type { Character } from '../../lib/characters'

interface PlayerCardProps {
  /** The campaign's system — picks the stat-span label language (owner:
   * "separate games using same interface"): AC/GP/LUCK for Shadowdark,
   * ARM/¤/GLITCH for CY_BORG. Optional, Shadowdark fallback. */
  system?: string | null
  character: Character
  onClick?: () => void
  /**
   * `'full'` (default) is the original party-rail card, unchanged.
   * `'compact'` (mobile layout slice) is the horizontal self-card
   * pinned above the mobile journal feed, per `mobile-view-mockup.html`
   * — same character fields, laid out as one row instead of a stacked
   * card. A `variant` prop rather than a second component: the compact
   * card needs the exact same data reads (gold/sheet/isDown/isAwaiting/
   * hpPct) as the full card, and keeping both in one file means a
   * future field (when torch data eventually lands) only needs wiring
   * once instead of being kept in sync across two files.
   *
   * The mockup's compact card also shows a torch bar with a live mm:ss
   * countdown — not built here. That still needs schema this app
   * doesn't have yet (no light-tracking column on `characters`); see
   * the mobile layout slice's "what this will not build" list. (Luck
   * *is* built now — migration 0022 added `luck_tokens` — see the
   * `statSpans` LUCK entry below.)
   */
  variant?: 'full' | 'compact'
  className?: string
  /**
   * BUILD_PLAN.md item 14 (realtime/presence, 2026-08-14) —
   * `useCampaignPresence`'s online set, already narrowed to "is THIS
   * character's `member_id` currently connected" by the caller (see
   * `JournalDesktopLayout`/`MobileJournalView`), not the raw set
   * itself — this component has no reason to know about member ids in
   * general. `undefined`/`false` both render nothing; there's no
   * "unknown" state worth drawing, since the presence hook always
   * resolves to a real (possibly empty) set once mounted.
   */
  isOnline?: boolean
  /**
   * Encounter mode phase 2 (BUILD_PLAN.md item 13, 2026-08-14) — true
   * when `turn_order.combatants[active_index]` is THIS character (the
   * caller matches `character.id` against `JournalScreen`'s own
   * `activeTurnCharacterId`, same "narrow before handing down" shape
   * `isOnline` above already established for presence). `undefined`/
   * `false` both render nothing, same as `isOnline` — no encounter
   * running is the common case, not an "unknown" state worth drawing.
   */
  isActiveTurn?: boolean
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
 * data this schema doesn't carry (Encounter mode phase 3, not built
 * yet).
 *
 * Active-turn ring (Encounter mode phase 2, 2026-08-14): a purple
 * `ring` around the whole card plus a small "Active" caption next to the
 * name when `isActiveTurn` is true — a ring rather than reusing the
 * online dot's corner-badge shape, since this needs to read clearly even
 * when `isDown`'s red border is also present (a downed character can
 * still technically be up in the initiative order). The caption is a
 * deliberate second signal alongside the ring, not decoration — color
 * alone shouldn't be the only way this state reads.
 *
 * No torch icon — no light-tracking data exists in the schema. Luck
 * *does* now (migration 0022, `characters.luck_tokens`) — added to
 * `statSpans` below alongside HP/AC/BAG/GP, same "only real data,
 * always shown since the column is never null" treatment GP already
 * gets. Only the bless icon, and only when `sheet.active_blessing` is
 * a real, present string.
 *
 * Online dot (BUILD_PLAN.md item 14, 2026-08-14): a small green ring on
 * the avatar's corner when `isOnline` is true, meaning this character's
 * owning member currently has a live connection to this campaign (see
 * `useCampaignPresence`). Purely additive over everything above — the
 * dot is the only thing this slice changes about the card.
 */
export function PlayerCard({ character, onClick, variant = 'full', className, isOnline, isActiveTurn, system }: PlayerCardProps) {
  const gold = readCharacterGold(character.gold)
  const sheet = readCharacterSheet(character.sheet)
  const isAwaiting = character.status !== 'active'
  const isDown = character.hp_current <= 0
  const hpPct = character.hp_max > 0 ? Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100)) : 0
  const activatable = Boolean(onClick)

  const display = getSystemDisplay(system)
  const statSpans = (
    <>
      <span>
        <span className="text-ink-faint">HP</span>{' '}
        <b className={cx('font-semibold tabular-nums', isDown ? 'text-red' : 'text-ink')}>
          {character.hp_current}/{character.hp_max}
        </b>
      </span>
      <span>
        <span className="text-ink-faint">{display.acShort}</span> <b className="font-semibold tabular-nums text-ink">{character.ac}</b>
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
          <span className="text-ink-faint">{display.moneyShort}</span> <b className="font-semibold tabular-nums text-ink">{gold.gp}</b>
        </span>
      )}
      <span>
        <span className="text-ink-faint">{display.luckShort}</span>{' '}
        <b className="font-semibold tabular-nums text-purple">{character.luck_tokens}</b>
      </span>
    </>
  )

  const sharedInteractionProps = {
    role: activatable ? ('button' as const) : undefined,
    tabIndex: activatable ? 0 : undefined,
    onClick,
    onKeyDown: activatable
      ? (event: { key: string; preventDefault: () => void }) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick?.()
          }
        }
      : undefined,
  }

  if (variant === 'compact') {
    return (
      <div
        className={cx(
          'flex items-center gap-3 rounded-card border border-line bg-panel px-3 py-2.5 transition-[border-color] duration-150',
          activatable && 'cursor-pointer hover:border-line-hover',
          activatable &&
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          isDown && 'border-red/55 bg-red/5',
          isActiveTurn && 'ring-2 ring-purple ring-offset-2 ring-offset-bg',
          className,
        )}
        {...sharedInteractionProps}
      >
        <div className="relative shrink-0">
          <PortraitAvatar name={character.name} color={character.color ?? '#9b5cff'} size="md" />
          {isOnline && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green ring-2 ring-panel"
              title="Online now"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cx(text.body, 'truncate font-semibold leading-tight')}>
            {character.name}
            {isActiveTurn && <span className={cx(text.caption, 'ml-2 font-mono uppercase text-purple')}>Active</span>}
          </p>
          <div className={cx('mt-1 flex flex-wrap gap-3', text.caption, 'text-ink-dim')}>{statSpans}</div>
          <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-line">
            <div className={cx('h-full rounded-full', isDown ? 'bg-red' : 'bg-green')} style={{ width: `${hpPct}%` }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cx(
        'relative rounded-card border border-line bg-panel p-3 transition-[border-color,transform] duration-150',
        activatable && 'cursor-pointer hover:-translate-y-0.5 hover:border-line-hover',
        activatable &&
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        isDown && 'border-red/55 bg-red/5',
        isAwaiting && 'opacity-45',
        isActiveTurn && 'ring-2 ring-purple ring-offset-2 ring-offset-bg',
        className,
      )}
      {...sharedInteractionProps}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="relative shrink-0">
          <PortraitAvatar name={character.name} color={character.color ?? '#9b5cff'} size="sm" />
          {isOnline && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green ring-2 ring-panel"
              title="Online now"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className={cx(text.body, 'truncate font-semibold leading-tight')}>
            {character.name}
            {isActiveTurn && <span className={cx(text.caption, 'ml-2 font-mono uppercase text-purple')}>Active</span>}
          </p>
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
      <div className={cx('flex flex-wrap gap-3', text.caption, 'text-ink-dim')}>{statSpans}</div>
    </div>
  )
}
