import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/ErrorBanner'
import { Stepper } from '../ui/Stepper'
import { TextInput } from '../ui/TextInput'
import { GearSlotGrid } from './GearSlotGrid'
import { Shop } from './Shop'
import {
  adjustCharacterGold,
  adjustCharacterHp,
  adjustCharacterLuck,
  adjustCharacterXp,
  addCharacterGear,
  readCharacterGold,
  readCharacterSheet,
  removeCharacterGear,
  restCharacter,
  setCharacterHpMax,
} from '../../lib/characters'
import type { Character } from '../../lib/characters'
import { goldDeltaForSpend, goldToCp } from '../../lib/rules/equipment'
import type { RulesEquipmentItem } from '../../lib/rules/equipment'
import { getShopCatalog } from '../../lib/rules'

interface CharacterCommandsProps {
  character: Character
  /** The campaign's currently open session, if any — threaded straight
   * through to every command as `p_session_id` so the mutation echoes a
   * `system`-kind journal entry (see 0009's header comment). Every
   * command still works with this null; it just logs nothing. */
  sessionId: string | null
  /** Called with the row a command's RPC returned — the host screen
   * echoes it into both the party rail and this open sheet, same "echo
   * what the RPC returned" pattern every other command in the app
   * already uses. */
  onUpdate: (updated: Character) => void
  /** The campaign's `system` (2026-08-17, second-system shop) — picks
   * which catalog the Add-item Shop sells from and how money renders
   * (`getShopCatalog`). Optional: omitted (or unknown) falls back to
   * the Shadowdark Core list, so nothing changes for existing call
   * sites until they thread it. */
  system?: string | null
}

// Same visual treatment as `CharacterSheet.tsx`'s own `sectionLabelClass`
// — duplicated rather than imported cross-file (this component is
// mounted *inside* `CharacterSheet`, so importing back from it would be
// a circular import between the two) — but WITHOUT that one's
// `first:mt-0`. Copying that modifier here was a bug: it exists there
// to zero the margin on the sheet's true first section label, but
// "Edit" is the first child of *this component's own* local
// `flex flex-col` wrapper, so `first:` matched it regardless of what's
// actually rendered above `CharacterCommands` in the overall sheet
// (Covenant Duties, or at minimum the vitals strip + identity bar —
// "Edit" is never really first). That zeroed the intended 48px gap, so
// the last read-only line above it ran straight into "EDIT" with almost
// no breathing room. Caught 2026-08-11 ("spacing here is goofy") — same
// class of first-child mistake as the Fragment fix in
// `CharacterSheet.tsx`'s own `DETAIL_FIELDS` map, different cause.
const sectionLabelClass = 'mt-12 mb-3 font-mono text-base font-semibold uppercase tracking-eyebrow text-purple'

// `h-11` (44px) is non-negotiable — SPEC's touch-target minimum, same
// guarantee every other interactive control in the kit bakes in. The
// mockup review that shortened these labels (Damage -> Dmg, Full Rest
// -> Rest) also shrank the buttons themselves to fit one line in a
// static reference page; that shrink doesn't carry over here since
// static-mockup layout isn't bound by the real touch-target rule and
// this row already wraps cleanly via `flex-wrap` at any width. Only the
// label text and horizontal padding changed.
const tintButtonClass = (color: 'green' | 'red' | 'purple') =>
  cx(
    'inline-flex h-11 items-center justify-center rounded-button border px-3 font-mono uppercase',
    text.caption,
    'disabled:pointer-events-none disabled:opacity-40',
    color === 'green' && 'border-green/45 bg-green/10 text-green',
    color === 'red' && 'border-red/45 bg-red/10 text-red',
    color === 'purple' && 'border-purple/45 bg-purple/10 text-purple',
  )

/**
 * The mutation half of the character sheet (BUILD_PLAN.md slice 6) —
 * HP/XP/gold/luck adjust, gear add/remove, full rest, each a real
 * `SECURITY DEFINER` command call, never a local-only edit. Mounted at
 * the bottom of `CharacterSheet`'s overlay content, below the read-only
 * sections that slice 3 already built. One `pending`/`error` pair
 * covers every action here (only one can run at a time from one sheet),
 * same shape as `JournalScreen`'s own start/end-session handling.
 *
 * Luck row added 2026-08-11 alongside migration 0022 (`luck_tokens`) —
 * same stepper + tinted +/- shape as XP, since Luck has no natural
 * "damage/heal" verb pair the way HP does.
 */
export function CharacterCommands({ character, sessionId, onUpdate, system }: CharacterCommandsProps) {
  const catalog = getShopCatalog(system)
  const [hpAmount, setHpAmount] = useState(1)
  const [hpMaxDraft, setHpMaxDraft] = useState('')
  const [xpAmount, setXpAmount] = useState(1)
  const [luckAmount, setLuckAmount] = useState(1)
  const [goldGp, setGoldGp] = useState('')
  const [goldSp, setGoldSp] = useState('')
  const [goldCp, setGoldCp] = useState('')
  const [gearName, setGearName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const equipment = readCharacterSheet(character.sheet).equipment ?? []

  async function run(action: () => Promise<Character>) {
    setPending(true)
    setError(null)
    try {
      onUpdate(await action())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That command failed.')
    } finally {
      setPending(false)
    }
  }

  // Owner request, 2026-08-15 ("since we will have that it might be
  // good to have a general store also — pulls up the same or similar
  // list of things the game has prices for") — the follow-up half of
  // the Character Builder's Shop feature, wired here to the two RPCs
  // that already existed for exactly this (`adjustCharacterGold`,
  // `addCharacterGear`/`removeCharacterGear` — the same calls the Gold
  // and Gear sections above already make). `goldDeltaForSpend` does the
  // same whole-balance re-normalize `CharacterBuilder`'s own shop
  // handlers use, for the same reason (see its doc comment in
  // `lib/rules/equipment.ts`).
  //
  // Two sequential RPC calls, not one atomic transaction — this app has
  // no `buy_character_gear`/`return_character_gear` RPC that adjusts
  // gold and gear together in a single statement, and adding one is a
  // real schema change (a new migration against the live Supabase
  // project) that's out of scope for this pass. If the second call
  // fails after the first succeeds, gold moves but gear doesn't; `run`'s
  // existing error banner surfaces that failure the same way it
  // surfaces any other command error, and a GM can true up the balance
  // by hand via the Gold section above. Every other multi-field mutation
  // in this file already accepts this same non-atomic shape (nothing
  // here wraps two RPCs in one transaction), so this isn't a new risk
  // class, just the first place two calls happen back to back.
  function shopBuy(item: RulesEquipmentItem) {
    const currentGold = readCharacterGold(character.gold)
    if (item.costCp > goldToCp(currentGold)) return
    const delta = goldDeltaForSpend(currentGold, -item.costCp)
    void run(async () => {
      await adjustCharacterGold(character.id, delta, sessionId)
      return addCharacterGear(character.id, item.name, sessionId)
    })
  }

  function shopReturn(item: RulesEquipmentItem) {
    const index = equipment.findIndex((name) => name === item.name)
    if (index === -1) return
    const delta = goldDeltaForSpend(readCharacterGold(character.gold), item.costCp)
    void run(async () => {
      await adjustCharacterGold(character.id, delta, sessionId)
      return removeCharacterGear(character.id, index, sessionId)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className={sectionLabelClass}>Edit</p>

      {error && <ErrorBanner onRetry={() => setError(null)}>{error}</ErrorBanner>}

      <div className="flex flex-wrap items-center gap-3">
        <span className={cx(text.label, 'w-12 text-ink-faint')}>HP</span>
        <Stepper value={hpAmount} onChange={setHpAmount} min={1} max={character.hp_max} label="amount" />
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => adjustCharacterHp(character.id, -hpAmount, sessionId))}
          className={tintButtonClass('red')}
        >
          Dmg
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => adjustCharacterHp(character.id, hpAmount, sessionId))}
          className={tintButtonClass('green')}
        >
          Heal
        </button>
        <button
          type="button"
          disabled={pending || character.hp_current >= character.hp_max}
          onClick={() => void run(() => restCharacter(character.id, sessionId))}
          className={tintButtonClass('purple')}
          title="Restore HP to max"
        >
          Rest
        </button>
      </div>

      {/* Max HP has no roll-based verb pair the way hp_current does --
        * it's set once by CharacterBuilder (0030_set_character_hp_max.sql)
        * and was otherwise permanently locked after creation. Added
        * after a live report: the wizard's own "Roll HP" button lives
        * on its Review step as an optional, ungated action, so a
        * character can reach Create having never rolled it, landing at
        * the bare floor value with no way to correct it in-app. This is
        * that correction, not a general respec control -- a plain
        * "set to this number" rather than another delta stepper, since
        * the number being corrected usually comes from a roll made
        * outside this UI (the in-app Dice Roller, or a physical die). */}
      <div className="flex flex-wrap items-end gap-2">
        <TextInput
          label="Set Max HP"
          type="number"
          inputMode="numeric"
          value={hpMaxDraft}
          onChange={(event) => setHpMaxDraft(event.target.value)}
          className="w-24"
        />
        <Button
          type="button"
          variant="ghost"
          disabled={pending || hpMaxDraft.trim() === '' || Number(hpMaxDraft) < 1}
          onClick={() =>
            void run(async () => {
              const updated = await setCharacterHpMax(character.id, Number(hpMaxDraft), sessionId)
              setHpMaxDraft('')
              return updated
            })
          }
        >
          Set
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={cx(text.label, 'w-12 text-ink-faint')}>XP</span>
        <Stepper value={xpAmount} onChange={setXpAmount} min={1} max={999} label="amount" />
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => adjustCharacterXp(character.id, -xpAmount, sessionId))}
          className={tintButtonClass('red')}
        >
          −XP
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => adjustCharacterXp(character.id, xpAmount, sessionId))}
          className={tintButtonClass('green')}
        >
          +XP
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={cx(text.label, 'w-12 text-ink-faint')}>Luck</span>
        <Stepper value={luckAmount} onChange={setLuckAmount} min={1} max={99} label="amount" />
        <button
          type="button"
          disabled={pending || character.luck_tokens <= 0}
          onClick={() => void run(() => adjustCharacterLuck(character.id, -luckAmount, sessionId))}
          className={tintButtonClass('red')}
        >
          −Luck
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => adjustCharacterLuck(character.id, luckAmount, sessionId))}
          className={tintButtonClass('purple')}
        >
          +Luck
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <TextInput
          label="+/− GP"
          type="number"
          inputMode="numeric"
          value={goldGp}
          onChange={(event) => setGoldGp(event.target.value)}
          className="w-24"
        />
        <TextInput
          label="+/− SP"
          type="number"
          inputMode="numeric"
          value={goldSp}
          onChange={(event) => setGoldSp(event.target.value)}
          className="w-24"
        />
        <TextInput
          label="+/− CP"
          type="number"
          inputMode="numeric"
          value={goldCp}
          onChange={(event) => setGoldCp(event.target.value)}
          className="w-24"
        />
        <Button
          type="button"
          variant="ghost"
          disabled={pending || (!goldGp && !goldSp && !goldCp)}
          onClick={() =>
            void run(async () => {
              const updated = await adjustCharacterGold(
                character.id,
                { gp: Number(goldGp) || 0, sp: Number(goldSp) || 0, cp: Number(goldCp) || 0 },
                sessionId,
              )
              setGoldGp('')
              setGoldSp('')
              setGoldCp('')
              return updated
            })
          }
        >
          Apply
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className={cx(text.label, 'text-ink-faint')}>General Store</span>
        <Shop items={catalog.items} currency={catalog.currency} goldCp={goldToCp(readCharacterGold(character.gold))} owned={equipment} onBuy={shopBuy} onReturn={shopReturn} disabled={pending} />
      </div>

      <div className="flex flex-col gap-2">
        <span className={cx(text.label, 'text-ink-faint')}>
          Gear
          {character.gear_current != null && character.gear_max != null
            ? ` — ${character.gear_current} of ${character.gear_max} slots`
            : ''}
        </span>
        {equipment.length > 0 && (
          <GearSlotGrid
            items={equipment}
            onRemove={(index) => void run(() => removeCharacterGear(character.id, index, sessionId))}
            removeDisabled={pending}
          />
        )}
        <div className="flex items-end gap-2">
          <TextInput
            label="Add item"
            value={gearName}
            onChange={(event) => setGearName(event.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            disabled={pending || gearName.trim() === ''}
            onClick={() =>
              void run(async () => {
                const updated = await addCharacterGear(character.id, gearName, sessionId)
                setGearName('')
                return updated
              })
            }
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
