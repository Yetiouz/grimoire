import { useMemo, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { TextInput } from '../ui/TextInput'
import { CORE_EQUIPMENT, formatCp } from '../../lib/rules/equipment'
import type { EquipmentCategory, RulesEquipmentItem } from '../../lib/rules/equipment'

interface ShopProps {
  /** Defaults to the Core catalog — the only one that exists today (see
   * `equipment.ts`'s own doc comment on Core-only v1 scope). A future
   * Cursed Scroll catalog would be passed in here rather than this
   * component reaching for a specific rules module itself. */
  items?: RulesEquipmentItem[]
  /** Current spendable gold, normalized to copper — `goldToCp` from
   * `equipment.ts` converts either gold shape this app has (creation's
   * string-valued `{gp,sp,cp}` fields, or play's numeric `CharacterGold`)
   * into this one number. */
  goldCp: number
  /** The character's current freeform `equipment: string[]` — Shop never
   * owns gear/gold state itself (both callers already have a state
   * source of truth: local `useState` during creation, the character row
   * during play), it only reads this to compute a per-catalog-item owned
   * count so the same row can offer both "+" (buy another) and "−"
   * (return one for a refund). Matched by exact name against each
   * catalog entry — an item bought through Shop always pushes the
   * catalog's own `name` string, so this always finds it; a freeform
   * typed item or a 0-level gear-roll result that happens not to match
   * any catalog name just shows an owned count of 0 here (no refund
   * offered for it) rather than guessing at a price for something never
   * priced. */
  owned: string[]
  /** Caller charges `item.costCp` and appends `item.name` to `owned`
   * (locally during creation, or via `adjustCharacterGold` +
   * `addCharacterGear` during play). Shop only calls this when
   * `item.costCp <= goldCp`, but the caller is the one place that
   * actually knows the real current balance at click time, so it's
   * still worth a defensive re-check there too, same trust-boundary
   * shape every RPC wrapper in `characters.ts` already assumes. */
  onBuy: (item: RulesEquipmentItem) => void
  /** Caller refunds `item.costCp` and removes ONE matching `owned` entry
   * (the first match — same "index, not name" addressing
   * `removeCharacterGear`'s own migration comment explains, just chosen
   * for the caller here since Shop only knows the name, not which
   * array index it lives at). Only enabled when the owned count for
   * that row is above zero. */
  onReturn: (item: RulesEquipmentItem) => void
  /** True while a buy/return is in flight (during play, an RPC round-
   * trip) — disables every row's +/− so a second click can't fire
   * before the first one's balance update lands. Creation has no
   * network call to wait on, so its caller never needs this. */
  disabled?: boolean
  className?: string
}

const CATEGORY_TABS: { key: 'all' | EquipmentCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'gear', label: 'Gear' },
  { key: 'armor', label: 'Armor' },
  { key: 'weapon', label: 'Weapons' },
]

/**
 * Owner request, 2026-08-15 ("when you get to the gear screen there
 * needs to be a shop list where you can be like 1 of these 1 of these 1
 * of these and submit/or refund") plus the follow-up scoping answer
 * ("for sure in need to live in character creation ... it might be good
 * to have a general store also"). One shared component for both spots —
 * `CharacterBuilder`'s Gear step wires it to local component state,
 * `CharacterCommands`' General Store panel wires the same component to
 * real RPCs — Shop itself never touches gold or equipment storage
 * directly (see `onBuy`/`onReturn`/`owned` above), which is what makes
 * that reuse possible without Shop needing to know which context it's
 * in.
 *
 * "Submit/or refund" became a live +/− stepper per catalog row rather
 * than a staged cart-then-submit flow: during creation nothing is
 * persisted until "Create Character" regardless, so a separate submit
 * step would just be a second confirmation of a confirmation; during
 * play every click already IS the real, immediate action (same as every
 * other command in `CharacterCommands.tsx`). "Refund" is the "−" button
 * on a row you've already bought from — it only lights up once that
 * row's owned count is above zero, and always returns/charges the
 * catalog's own listed price, never a haggled or partial amount.
 */
export function Shop({ items = CORE_EQUIPMENT, goldCp, owned, onBuy, onReturn, disabled, className }: ShopProps) {
  const [category, setCategory] = useState<'all' | EquipmentCategory>('all')
  const [query, setQuery] = useState('')

  const ownedCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const name of owned) counts.set(name, (counts.get(name) ?? 0) + 1)
    return counts
  }, [owned])

  const filtered = items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false
    if (query.trim() !== '' && !item.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategory(tab.key)}
              className={cx(
                'rounded-full border px-3 py-1',
                text.caption,
                category === tab.key
                  ? 'border-purple bg-purple/10 text-purple'
                  : 'border-line-soft bg-panel2 text-ink-faint hover:border-line-hover',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className={cx(text.label, 'text-ink-faint')}>
          You have <span className="text-ink">{formatCp(goldCp)}</span>
        </p>
      </div>

      <TextInput
        label="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter items…"
      />

      <div className="flex flex-col gap-1.5">
        {filtered.map((item) => {
          const ownedCount = ownedCounts.get(item.name) ?? 0
          const canAfford = item.costCp <= goldCp

          return (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-[9px] border border-line-soft bg-panel2 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className={cx(text.bodySecondary, 'font-semibold text-ink')}>{item.name}</p>
                {item.detail && <p className={cx(text.caption, 'text-ink-faint')}>{item.detail}</p>}
              </div>
              <p className={cx(text.caption, 'shrink-0 text-ink-faint')}>{formatCp(item.costCp)}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={disabled || ownedCount === 0}
                  onClick={() => onReturn(item)}
                  aria-label={`Return one ${item.name} for a refund`}
                  title="Return one for a refund"
                  className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line-soft text-ink-faint hover:border-red hover:text-red disabled:pointer-events-none disabled:opacity-40"
                >
                  −
                </button>
                {ownedCount > 0 && <span className={cx(text.numeric, 'w-4 text-center')}>{ownedCount}</span>}
                <button
                  type="button"
                  disabled={disabled || !canAfford}
                  onClick={() => onBuy(item)}
                  aria-label={`Buy one ${item.name}`}
                  title={canAfford ? 'Buy one' : "You can't afford this"}
                  className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line-soft text-ink-faint hover:border-purple hover:text-purple disabled:pointer-events-none disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <p className={cx(text.caption, 'text-ink-faint')}>No items match.</p>}
      </div>
    </div>
  )
}
