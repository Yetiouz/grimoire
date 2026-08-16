import { useEffect, useMemo, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { ErrorBanner } from '../ui/ErrorBanner'
import { GearSlotGrid } from './GearSlotGrid'
import { Shop } from './Shop'
import { createCharacter } from '../../lib/characters'
import type { Character, CharacterAbilities, CharacterSheetData, AbilityScore } from '../../lib/characters'
import { getRulesModule, abilityModifier, ABILITY_ORDER } from '../../lib/rules'
import type { Ability, RulesClass, RulesTalentTableRow } from '../../lib/rules'
import { goldDeltaForSpend, goldToCp } from '../../lib/rules/equipment'
import type { RulesEquipmentItem } from '../../lib/rules/equipment'

interface CharacterBuilderProps {
  open: boolean
  onClose: () => void
  campaignId: string
  /** `campaigns.system` — resolves which `RulesModule` this build runs
   * on (see `lib/rules/index.ts`'s doc comment: the same multi-system
   * seam the AI GM's `system_packs` already uses, for structured
   * creation data instead of prose). */
  system: string | null
  sessionId: string | null
  /** The signed-in caller's own `campaign_members.id` for this campaign
   * (2026-08-11, join-by-code + character-ownership pass) — passed
   * straight through to `createCharacter` as `memberId` so whoever
   * builds a character here is automatically claiming it for
   * themselves. This is a deliberate simplification, not the only
   * possible shape: the schema (`create_character`'s own `p_member_id`
   * param) also supports a GM staging an unclaimed PC (`member_id =
   * null`) ahead of a real player joining, same convention the
   * imported LaLa/Constantine rows already modeled — but this wizard
   * doesn't expose that as a choice yet, since nothing asked for it.
   * Null while the caller's own membership row hasn't loaded yet
   * (`JournalScreen`'s `myMembershipId`); every legitimate visitor to
   * this screen has a real membership row by the time they'd actually
   * reach the Review step and click Create. */
  memberId: string | null
  onCreated: (character: Character) => void
}

type StepKey = 'level' | 'stats' | 'ancestry' | 'class' | 'background' | 'gear' | 'review'

const PALETTE = ['#9b5cff', '#39ff8f', '#ff3b52', '#ffd23f', '#ff8a3d', '#ff3fd6', '#35f0ff']

/** Owner request, 2026-08-15 ("i think we need to highlight all the
 * rolls so someone knows when to roll when making this") — every roll
 * button below moved from `variant="ghost"` (the same subdued style
 * generic secondary actions like Cancel/Clear use) to the default
 * `primary` fill, so a roll reads as the button to press on its step
 * rather than blending in. This ring is a second, sharper layer on top
 * of that for the specific rolls `canContinue`/`hpReady` actually gate
 * (Stats, Gear's gold-or-gear, Review's HP roll) — reusing the style
 * guide's own orange = alert/incomplete language, the same color the
 * caption text right below each of these buttons already uses, rather
 * than inventing a new signal. Applied only while that requirement is
 * still unmet; typing a value by hand (every one of these rolls has a
 * manual-entry equivalent) satisfies it too and drops the ring, same as
 * pressing the button would. */
const ROLL_NEEDED_RING = 'ring-2 ring-orange/60 ring-offset-2 ring-offset-bg'

function rollD6(): number {
  return 1 + Math.floor(Math.random() * 6)
}

function roll3d6(): number[] {
  return [rollD6(), rollD6(), rollD6()]
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/** Matches a 2d6 (or, for the zero-level gear table, 1d4/1d12) roll
 * total against a table row's printed range ("2", "3-6", "12", ...). */
function matchTableRoll<T extends { roll: string }>(table: T[], total: number): T | undefined {
  return table.find((row) => {
    const cleaned = row.roll.trim()
    if (cleaned.includes('-')) {
      const [low, high] = cleaned.split('-').map((part) => Number(part))
      return total >= low && total <= high
    }
    return Number(cleaned) === total
  })
}

function abilityLabel(ability: Ability): string {
  return ability.toUpperCase()
}

const emptyStats = (): Record<Ability, { value: string; dice: number[] | null }> =>
  Object.fromEntries(ABILITY_ORDER.map((ability) => [ability, { value: '', dice: null }])) as Record<
    Ability,
    { value: string; dice: number[] | null }
  >

const cardBase =
  'rounded-[12px] border border-line-soft bg-panel2 p-3 text-left transition-colors hover:border-line-hover'
const cardSelected = 'border-purple bg-purple/10'

// One color per sourcebook (owner request, 2026-08-15 — playtesting
// surfaced that all three expansions rendered as the identical orange
// badge, only Core stood apart). Reuses existing palette tokens rather
// than inventing new ones (`grimoire-style-guide.md`'s "don't introduce
// a new color without giving it a job first") — cyan and pink are
// already documented as flexible "secondary indicator accent" slots,
// and orange/yellow get a second job here the same way orange already
// had one before this change (the badge itself, not "alert/attention").
// Purple/green/red are left alone: they're this app's buttons, live-
// status, and danger colors respectively, and a sourcebook badge reading
// as any of those in a class list would be actively misleading.
const SOURCE_BADGE: Record<RulesClass['source'], string> = {
  Core: 'border-cyan/35 text-cyan',
  Diablerie: 'border-pink/35 text-pink',
  'Red Sands': 'border-orange/35 text-orange',
  'Midnight Sun': 'border-yellow/35 text-yellow',
}

const STEP_LABEL: Record<StepKey, string> = {
  level: 'Level',
  stats: 'Stats',
  ancestry: 'Ancestry',
  class: 'Class',
  background: 'Background',
  gear: 'Gear',
  review: 'Review',
}

/**
 * The character-creation wizard (BUILD_PLAN.md slice 12) — greenfield;
 * nothing before this built a way to create a `characters` row outside
 * of 0004's one-time SQL import. Every rule this wizard applies (stat
 * method, classes, backgrounds, starting gear) comes from whichever
 * `RulesModule` `system` resolves to (`getRulesModule`, see
 * `lib/rules/index.ts`) — this component itself is not Shadowdark-
 * specific, it just renders whatever a module's data describes.
 *
 * Two paths, one wizard: a 0-level (fragile, funnel-style) start skips
 * Class entirely (no class until surviving a first adventure, per the
 * rulebook) and computes HP from CON mod alone; a 1st-level start walks
 * through Class (one talent roll, spellcasting picks, deity if
 * required) and rolls HP from the class's hit die. `STEPS` below is
 * built from `isZeroLevel` so the step list itself reflects that
 * branch rather than a fixed 7-step sequence with a skipped/disabled
 * step in the middle.
 *
 * Owner request, 2026-08-15 ("when you get to the gear screen there
 * needs to be a shop list...") — the Gear step now offers a priced
 * Core-rulebook `Shop` (see `lib/rules/equipment.ts`) for 1st-level
 * characters spending rolled/typed gold, in addition to the plain
 * freeform add/remove list, the exact same shape `sheet.equipment`
 * (and `CharacterCommands`' own "Add item" control) already use.
 */
export function CharacterBuilder({ open, onClose, campaignId, system, sessionId, memberId, onCreated }: CharacterBuilderProps) {
  const module = useMemo(() => getRulesModule(system), [system])

  const [level, setLevel] = useState<0 | 1>(1)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [stats, setStats] = useState(emptyStats)
  const [ancestryKey, setAncestryKey] = useState<string | null>(null)
  const [classKey, setClassKey] = useState<string | null>(null)
  // An array, not a single roll: some ancestries (Human's "Ambitious")
  // grant a bonus 1st-level talent roll on top of the class's own one
  // (see `RulesAncestry.bonusTalentRolls`) — a visual review caught that
  // the UI only ever offered one roll regardless, 2026-08-11.
  const [talentRolls, setTalentRolls] = useState<Array<{ total: number; row: RulesTalentTableRow }>>([])
  const [knownSpells, setKnownSpells] = useState<string[]>([])
  const [spellDraft, setSpellDraft] = useState('')
  const [deityName, setDeityName] = useState<string | null>(null)
  const [backgroundTableKey, setBackgroundTableKey] = useState(module.backgroundTables[0]?.key ?? '')
  const [backgroundText, setBackgroundText] = useState('')
  const [alignmentKey, setAlignmentKey] = useState<'Lawful' | 'Neutral' | 'Chaotic' | null>(null)
  const [gold, setGold] = useState({ gp: '', sp: '', cp: '' })
  const [goldRolled, setGoldRolled] = useState(false)
  const [equipment, setEquipment] = useState<string[]>([])
  const [gearDraft, setGearDraft] = useState('')
  const [hpRoll, setHpRoll] = useState<number | null>(null)
  const [acOverride, setAcOverride] = useState<string | null>(null)
  const [status, setStatus] = useState<'active' | 'awaiting'>('active')
  const [step, setStep] = useState<StepKey>('level')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Guards accidental data loss: Overlay closes on backdrop click,
  // Escape, or its own Close button, and until now that always wiped
  // the whole in-progress character instantly with zero confirmation
  // (`resetAll()` ran unconditionally). Rather than a native
  // `window.confirm()` (this app deliberately avoids those --
  // see `DeleteMapButton`'s own doc comment), an attempted close with
  // real progress on the line arms this inline row instead of closing
  // right away.
  const [confirmingClose, setConfirmingClose] = useState(false)

  const isZeroLevel = level === 0
  const steps: StepKey[] = isZeroLevel
    ? ['level', 'stats', 'ancestry', 'background', 'gear', 'review']
    : ['level', 'stats', 'ancestry', 'class', 'background', 'gear', 'review']
  const stepIndex = steps.indexOf(step)

  const ancestry = module.ancestries.find((a) => a.key === ancestryKey) ?? null
  const klass = !isZeroLevel ? module.classes.find((c) => c.key === classKey) ?? null : null
  const backgroundTable = module.backgroundTables.find((t) => t.key === backgroundTableKey) ?? module.backgroundTables[0]
  // 1 (the class's own roll, rulebook pg. 14) plus whatever the chosen
  // ancestry grants on top (Human's Ambitious talent, currently the only
  // one in Shadowdark) — see `RulesAncestry.bonusTalentRolls`.
  const maxTalentRolls = 1 + (ancestry?.bonusTalentRolls ?? 0)
  // Sliced rather than clamped in state: if someone rolls talents as a
  // Human then goes Back and switches to a non-bonus ancestry, this
  // quietly drops the extra roll from what's shown/saved without an
  // effect racing the render.
  const effectiveTalentRolls = talentRolls.slice(0, maxTalentRolls)

  const statsFilled = ABILITY_ORDER.every((a) => stats[a].value.trim() !== '' && !Number.isNaN(Number(stats[a].value)))
  const anyStatHigh = ABILITY_ORDER.some((a) => Number(stats[a].value) >= 14)
  const showRerollBanner = Boolean(module.statMethod.rerollRule) && statsFilled && !anyStatHigh
  // Owner request, 2026-08-15 ("let's add suggestions") — same >=14
  // threshold `anyStatHigh`/the reroll banner above already treat as
  // "a stat worth noticing" (rulebook pg. 15's own reroll trigger, and
  // the first modifier bracket above average), reused here rather than
  // inventing a second cutoff. Drives the Class step's ability-pill
  // highlighting below (`RulesClass.primaryAbilities`) — Class is only
  // ever reachable after Stats is filled (linear step-gating via
  // `canContinue`), so `stats` is always real data by the time this set
  // is read there, not a guess against blank fields.
  const strongAbilities = new Set(ABILITY_ORDER.filter((a) => Number(stats[a].value) >= 14))

  const conScore = Number(stats.con.value) || 0
  const conMod = statsFilled ? abilityModifier(module, conScore) : 0
  const dexMod = statsFilled ? abilityModifier(module, Number(stats.dex.value) || 0) : 0
  const strScore = Number(stats.str.value) || 0

  const computedHpMax = isZeroLevel
    ? Math.max(1, conMod)
    : klass
      ? Math.max(1, (hpRoll ?? 0) + conMod)
      : 0
  const computedAc = 10 + dexMod
  const ac = acOverride !== null && acOverride !== '' ? Number(acOverride) : computedAc
  const gearMax = Math.max(10, strScore || 10)

  function rollOneStat(ability: Ability) {
    const dice = roll3d6()
    setStats((prev) => ({ ...prev, [ability]: { value: String(sum(dice)), dice } }))
  }

  function rollAllStats() {
    const next = emptyStats()
    for (const ability of ABILITY_ORDER) {
      const dice = roll3d6()
      next[ability] = { value: String(sum(dice)), dice }
    }
    setStats(next)
  }

  function clearStats() {
    setStats(emptyStats())
  }

  function selectClass(nextKlass: RulesClass) {
    setClassKey(nextKlass.key)
    setTalentRolls([])
    setKnownSpells([])
    setDeityName(null)
    setHpRoll(null)
  }

  function rollTalent() {
    if (!klass) return
    if (talentRolls.length >= maxTalentRolls) return
    const dice = [rollD6(), rollD6()]
    const total = sum(dice)
    const row = matchTableRoll(klass.talentTable, total)
    if (row) setTalentRolls((prev) => [...prev, { total, row }])
  }

  function rollHp() {
    if (!klass) return
    setHpRoll(1 + Math.floor(Math.random() * klass.hpDie))
  }

  function toggleSpell(spellName: string) {
    setKnownSpells((prev) => (prev.includes(spellName) ? prev.filter((s) => s !== spellName) : [...prev, spellName]))
  }

  function addDraftSpell() {
    const trimmed = spellDraft.trim()
    if (trimmed === '' || knownSpells.includes(trimmed)) return
    setKnownSpells((prev) => [...prev, trimmed])
    setSpellDraft('')
  }

  function pickBackgroundEntry(entryName: string, detail: string) {
    setBackgroundText(`${entryName}. ${detail}`)
  }

  function rollBackground() {
    if (!backgroundTable) return
    const roll = 1 + Math.floor(Math.random() * 20)
    const entry = backgroundTable.entries.find((e) => e.roll === roll)
    if (entry) pickBackgroundEntry(entry.name, entry.detail)
  }

  function rollGold() {
    // 2d6 x 5 gp (rulebook pg. 33) — 1st-level only; 0-level characters
    // never roll gold, they roll gear directly (see rollZeroLevelGear).
    const total = sum([rollD6(), rollD6()]) * 5
    setGold({ gp: String(total), sp: '', cp: '' })
    setGoldRolled(true)
  }

  function rollZeroLevelGear() {
    const count = 1 + Math.floor(Math.random() * 4)
    const items: string[] = []
    for (let i = 0; i < count; i++) {
      const roll = 1 + Math.floor(Math.random() * module.zeroLevelGear.table.length)
      const entry = module.zeroLevelGear.table.find((g) => g.roll === roll)
      if (entry) items.push(entry.item)
    }
    setEquipment(items)
    setGoldRolled(true)
  }

  function addGearItem() {
    const trimmed = gearDraft.trim()
    if (trimmed === '') return
    setEquipment((prev) => [...prev, trimmed])
    setGearDraft('')
  }

  function removeGearItem(index: number) {
    setEquipment((prev) => prev.filter((_, i) => i !== index))
  }

  // Owner request, 2026-08-15 ("shop list where you can be like 1 of
  // these 1 of these 1 of these and submit/or refund") — `Shop`'s own
  // "+"/"−" per row, wired to this component's existing local `gold`/
  // `equipment` state rather than a new state shape. `goldDeltaForSpend`
  // (see its doc comment in `lib/rules/equipment.ts`) re-normalizes the
  // WHOLE balance to the fewest coins on every purchase rather than
  // decrementing just the item's own gp/sp/cp breakdown against
  // whatever denominations happen to be sitting in the three text
  // fields right now — the same clamp risk that comment explains for
  // `adjustCharacterGold` applies here too, since `gold.sp`/`gold.cp`
  // are free-typed text that can easily be "0" while `gold.gp` holds
  // everything.
  function applyGoldDeltaCp(deltaCp: number) {
    setGold((g) => {
      const delta = goldDeltaForSpend(g, deltaCp)
      return {
        gp: String((Number(g.gp) || 0) + delta.gp),
        sp: String((Number(g.sp) || 0) + delta.sp),
        cp: String((Number(g.cp) || 0) + delta.cp),
      }
    })
  }

  function buyShopItem(item: RulesEquipmentItem) {
    if (item.costCp > goldToCp(gold)) return
    applyGoldDeltaCp(-item.costCp)
    setEquipment((prev) => [...prev, item.name])
  }

  // Refunds the catalog price and drops ONE matching entry — the first
  // one found, same "Shop only knows the name, not which array index"
  // reasoning documented on `Shop`'s own `onReturn` prop. Distinct from
  // `removeGearItem` (GearSlotGrid's plain "Drop"): Drop discards
  // anything with no refund (rolled 0-level gear included, which was
  // never bought); Return only appears on a Shop row you've bought from
  // and always gives the catalog price back.
  function returnShopItem(item: RulesEquipmentItem) {
    const index = equipment.findIndex((name) => name === item.name)
    if (index === -1) return
    applyGoldDeltaCp(item.costCp)
    setEquipment((prev) => prev.filter((_, i) => i !== index))
  }

  function goNext() {
    if (stepIndex < steps.length - 1) setStep(steps[stepIndex + 1])
  }
  function goBack() {
    if (stepIndex > 0) setStep(steps[stepIndex - 1])
  }

  // The Overlay body keeps its scroll position across step changes, so
  // moving from a long step to the next one landed the player mid-list
  // instead of at the top (live report: reached the Gear step 2000px+
  // deep in the shop with the starting-gold roll scrolled out of view).
  // The breadcrumb row is the scroller's first child, so its parent IS
  // the scroll container — reset it whenever the step changes.
  const crumbRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    crumbRef.current?.parentElement?.scrollTo({ top: 0 })
  }, [step])

  // Both gates below exist because of a live report: a first-time
  // player reached Create having never engaged either "Roll HP"
  // (Review step) or "Roll starting gold" (Gear step) -- neither was
  // required, so nothing signaled anything was missing, and the
  // resulting character was created at 1 HP with 0 gold and no gear.
  // These don't force a specific roll (typing a gold amount by hand, or
  // adding a manually-chosen item, counts too) -- they just require
  // *some* deliberate action instead of silently passing through.
  const goldOrGearEngaged = isZeroLevel
    ? goldRolled || equipment.length > 0
    : goldRolled || gold.gp.trim() !== '' || equipment.length > 0
  const hpReady = isZeroLevel || hpRoll !== null

  const canContinue: Record<StepKey, boolean> = {
    level: name.trim() !== '',
    stats: statsFilled,
    ancestry: ancestryKey !== null,
    class: klass !== null,
    background: backgroundText.trim() !== '' && alignmentKey !== null && (!klass?.requiresDeity || deityName !== null),
    gear: goldOrGearEngaged,
    review: true,
  }

  const titleAtLevel1 =
    !isZeroLevel && klass?.titleAtLevel1 && alignmentKey
      ? klass.titleAtLevel1[alignmentKey.toLowerCase() as 'lawful' | 'chaotic' | 'neutral']
      : null

  function resetAll() {
    setLevel(1)
    setName('')
    setColor(PALETTE[0])
    setStats(emptyStats())
    setAncestryKey(null)
    setClassKey(null)
    setTalentRolls([])
    setKnownSpells([])
    setSpellDraft('')
    setDeityName(null)
    setBackgroundTableKey(module.backgroundTables[0]?.key ?? '')
    setBackgroundText('')
    setAlignmentKey(null)
    setGold({ gp: '', sp: '', cp: '' })
    setGoldRolled(false)
    setEquipment([])
    setGearDraft('')
    setHpRoll(null)
    setAcOverride(null)
    setStatus('active')
    setStep('level')
    setError(null)
    setConfirmingClose(false)
  }

  function requestClose() {
    if (name.trim() !== '' || ancestryKey !== null || stepIndex > 0) {
      setConfirmingClose(true)
      return
    }
    handleClose()
  }

  function handleClose() {
    resetAll()
    onClose()
  }

  async function handleCreate() {
    if (!ancestry) return
    setSaving(true)
    setError(null)
    try {
      const abilities: CharacterAbilities = {}
      for (const ability of ABILITY_ORDER) {
        const score = Number(stats[ability].value)
        const entry: AbilityScore = { score, mod: abilityModifier(module, score) }
        abilities[ability] = entry
      }

      const classTitle = isZeroLevel ? `${ancestry.name} (0-level)` : `${ancestry.name} ${klass?.name ?? ''}`.trim()
      const alignmentTitle = alignmentKey ? (titleAtLevel1 ? `${alignmentKey} ${titleAtLevel1}` : alignmentKey) : null

      const sheet: CharacterSheetData = {
        languages: ancestry.languages,
        attacks_talents: [
          ancestry.talent,
          ...(klass?.features ?? []),
          ...effectiveTalentRolls.map((roll) => `Talent roll (${roll.total}): ${roll.row.effect}`),
        ].filter((v): v is string => Boolean(v)),
        spells: knownSpells.length > 0 ? knownSpells : undefined,
        equipment: equipment.length > 0 ? equipment : undefined,
      }
      if (klass?.requiresDeity && deityName) {
        sheet.attacks_talents = [...(sheet.attacks_talents ?? []), `Deity: ${deityName}.`]
      }

      const created = await createCharacter({
        campaignId,
        name: name.trim(),
        classTitle,
        hpMax: Math.max(1, computedHpMax),
        ac,
        level,
        memberId,
        background: backgroundText.trim() || null,
        alignmentTitle,
        gearMax,
        gold: {
          gp: Number(gold.gp) || 0,
          sp: Number(gold.sp) || 0,
          cp: Number(gold.cp) || 0,
        },
        abilities,
        sheet,
        status,
        color,
        sessionId,
      })
      onCreated(created)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the character.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Overlay
      open={open}
      onClose={requestClose}
      width="wide"
      tall
      header={
        <div className="min-w-0">
          <h2 className={cx(text.h2, 'truncate')}>New Character</h2>
          <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{module.label} · Step {stepIndex + 1} of {steps.length}</p>
        </div>
      }
    >
      {/* Owner request, 2026-08-15 ("the back and continue buttons and
        * the breadcrumb header should be sticky so I don't have to
        * scroll to see them") — `sticky top-0`, not a second fixed
        * header: `Overlay`'s own title/step-counter row is already
        * pinned outside the scrolling body (see its own doc comment on
        * "the header is now always pinned and only the body scrolls
        * beneath it"), but this pill row is the first thing INSIDE that
        * scrolling body, so it was scrolling away the moment a step's
        * content (a 9-card Class grid, two 20-row Background tables)
        * grew past one screenful. `bg-panel` matches the scroll
        * container's own background (`Overlay`'s panel fill) so nothing
        * shows through underneath once stuck; `z-10` keeps it above
        * scrolled-past card content, which has no z-index of its own.
        *
        * Follow-up, same day (owner: "it shows the scroll on the top
        * and bottom, i think you just shorten that panel to be inside
        * the sticky bars") — the scroll container (`Overlay`'s body)
        * carries its own `pt-4`/`px-4 sm:px-6`, and this pill row is
        * its first child, so a sliver of that padding sat ABOVE the
        * `bg-panel` box even while stuck, letting scrolled-past content
        * peek through above the bar. `-mt-4`/`-mx-4 sm:-mx-6` cancels
        * that padding on this element, and the matching `pt-4`/`px-4
        * sm:px-6` restores the exact same visual inset — the row's own
        * static (unstuck) position is now already flush with the true
        * top of the scrollport (the canceled margin moves it there
        * directly), so plain `top: 0` is the correct stuck threshold.
        *
        * Second follow-up, same day (owner: "the top still has a
        * sliver") — the first pass over-corrected by ALSO setting
        * `top: -1rem` here, reasoning it needed to match the canceled
        * padding the same way the offset does elsewhere. It doesn't:
        * once the margin trick already puts the row's natural position
        * at the scrollport's true top edge, a *negative* `top` pushes
        * the stuck threshold a further 16px past that, so for the
        * first 16px of scrolling the row's own top edge — and the
        * border-b along with it — sat up to 16px above the visible
        * viewport, clipped by `overflow-y-auto`, which is exactly the
        * remaining sliver. Plain `top-0` has no such window: the row's
        * rendered position is `max(-scrollTop, 0)`, which is already 0
        * at `scrollTop: 0` and stays exactly 0 for every scroll
        * position after, no transition to glitch through. */}
      {/* `-top-4`, not `top-0` (2026-08-15): Chrome changed sticky
        * positioning to constrain the MARGIN box, so with this bar's
        * `-mt-4` a `top-0` pin lands 16px below the scrollport edge and
        * the sliver this bar's full-bleed treatment fixed came back —
        * same code, new browser. `-top-4` compensates exactly; on
        * engines with the old border-box behavior the bar would pin
        * 16px above the scrollport instead, where the Overlay body's
        * overflow clip swallows it. Flush on both behaviors. The
        * footer's `-bottom-6` below is the same fix for its `-mb-6`. */}
      {/* The `before:` apron: an opaque bg-panel strip extending 16px
        * past the bar's top edge. Belt to the `-top-4` suspenders —
        * pinning math varies with browser version, display scaling and
        * fractional zoom (the sliver reproduced on the owner's machine
        * at 0px measured gap on another), and an apron of panel color
        * over the gap zone is immune to all of it. Clipped by the
        * Overlay body's overflow when pinned, so it can never cover
        * anything real. */}
      <div ref={crumbRef} className="sticky -top-4 z-10 -mx-4 -mt-4 flex flex-wrap gap-1.5 border-b border-line-soft bg-panel px-4 pb-4 pt-4 before:absolute before:inset-x-0 before:bottom-full before:h-4 before:bg-panel sm:-mx-6 sm:px-6">
        {steps.map((key, index) => (
          <span
            key={key}
            className={cx(
              text.label,
              'rounded-full border px-3 py-1 uppercase tracking-eyebrow',
              index === stepIndex
                ? 'border-purple bg-purple/15 text-ink'
                : index < stepIndex
                  ? 'border-green/35 text-green'
                  : 'border-line-soft text-ink-faint',
            )}
          >
            {index + 1} {STEP_LABEL[key]}
          </span>
        ))}
      </div>

      {confirmingClose && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-red/35 bg-red/10 px-3 py-2">
          <span className={cx(text.caption, 'text-ink')}>Discard this character? Nothing is saved until you click Create.</span>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmingClose(false)}>
              Keep editing
            </Button>
            <Button type="button" onClick={handleClose}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorBanner onRetry={() => setError(null)}>{error}</ErrorBanner>
        </div>
      )}

      {step === 'level' && (
        <div className="flex flex-col gap-4">
          <TextInput label="Character name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brynhild Frostmane" />

          <div>
            <p className={cx(text.label, 'mb-2 text-ink-faint')}>Color</p>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  aria-label={`Use color ${hex}`}
                  // 44px touch target (2026-08-11, mobile polish pass) —
                  // these were h-8 (32px), a real tap target below
                  // CLAUDE.md's stated 44px minimum; the swatch itself
                  // still reads as a compact dot via the padding+ring,
                  // not a suddenly-huge circle.
                  className={cx(
                    'flex h-11 w-11 items-center justify-center rounded-full',
                    color === hex && 'ring-2 ring-ink ring-offset-2 ring-offset-bg',
                  )}
                >
                  <span className="h-8 w-8 rounded-full border-2 border-transparent" style={{ backgroundColor: hex }} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={cx(text.label, 'mb-2 text-ink-faint')}>Starting level</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setLevel(1)} className={cx(cardBase, level === 1 && cardSelected)}>
                <p className="font-semibold">1st level</p>
                <p className={cx(text.bodySecondary, 'mt-1 text-ink-faint')}>
                  A fledgling hero — full stats, choose a class, one talent roll, and starting gold to buy gear.
                </p>
              </button>
              {module.supportsZeroLevel && (
                <button type="button" onClick={() => setLevel(0)} className={cx(cardBase, level === 0 && cardSelected)}>
                  <p className="font-semibold">0-level</p>
                  <p className={cx(text.bodySecondary, 'mt-1 text-ink-faint')}>
                    A fragile peasant — no class yet, HP from Constitution alone, gear from the random table. Reaches 1st
                    level after surviving a first adventure.
                  </p>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 'stats' && (
        <div className="flex flex-col gap-3">
          <p className={cx(text.bodySecondary, 'text-ink-faint')}>
            "Roll" fills a stat with a fresh {module.statMethod.formula} — every field is also just a number you can type
            into directly, so a score you already rolled on paper works the same way.
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={rollAllStats} className={cx(!statsFilled && ROLL_NEEDED_RING)}>Roll All</Button>
            <Button type="button" variant="ghost" onClick={clearStats}>Clear</Button>
          </div>
          {ABILITY_ORDER.map((ability) => {
            const entry = stats[ability]
            const score = Number(entry.value)
            const mod = entry.value.trim() !== '' && !Number.isNaN(score) ? abilityModifier(module, score) : null
            return (
              <div key={ability} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line-soft bg-panel2 p-3">
                <span className={cx(text.label, 'w-10 text-ink-faint')}>{abilityLabel(ability)}</span>
                <div className="flex w-24 gap-1">
                  {(entry.dice ?? [null, null, null]).map((die, i) => (
                    <div
                      key={i}
                      className={cx(
                        'flex h-6 w-6 items-center justify-center rounded-[6px] border font-mono text-[11px]',
                        die === null ? 'border-dashed border-line-hover text-ink-faint opacity-40' : 'border-line-hover text-ink-dim',
                      )}
                    >
                      {die ?? '·'}
                    </div>
                  ))}
                </div>
                <input
                  value={entry.value}
                  onChange={(e) => setStats((prev) => ({ ...prev, [ability]: { value: e.target.value, dice: null } }))}
                  inputMode="numeric"
                  className="h-9 w-14 rounded-[8px] border border-line-hover bg-bg text-center font-mono text-[15px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50"
                />
                <span className={cx(text.caption, 'w-8 text-center', mod !== null && mod >= 0 ? 'text-green' : mod !== null ? 'text-red' : 'text-ink-faint')}>
                  {mod !== null ? (mod >= 0 ? `+${mod}` : mod) : '—'}
                </span>
                <Button type="button" className="ml-auto" onClick={() => rollOneStat(ability)}>Roll</Button>
              </div>
            )
          })}
          {showRerollBanner && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-yellow/35 bg-yellow/10 p-3">
              <span className={cx(text.bodySecondary, 'text-yellow')}>⚠ {module.statMethod.rerollRule ?? ''}</span>
              <Button type="button" onClick={rollAllStats}>Reroll All</Button>
            </div>
          )}
        </div>
      )}

      {step === 'ancestry' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {module.ancestries.map((a) => (
            <button key={a.key} type="button" onClick={() => setAncestryKey(a.key)} className={cx(cardBase, ancestryKey === a.key && cardSelected)}>
              <p className="font-semibold">{a.name}</p>
              <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{a.languages.join(', ')}</p>
              <p className={cx(text.bodySecondary, 'mt-1')}>{a.talent}</p>
            </button>
          ))}
        </div>
      )}

      {step === 'class' && (
        <div className="flex flex-col gap-4">
          {/* Owner request, 2026-08-15 ("let's add suggestions") — a
            * one-line legend rather than a silent color change: the
            * purple/green pills below now carry two DIFFERENT meanings
            * (which stat a class is built around vs. which stat YOU
            * rolled well), and a prior question this same session
            * ("are the highlighted ones there to know those are good for
            * me?") showed that distinction doesn't read as obvious on
            * its own. */}
          <p className={cx(text.caption, 'text-ink-faint')}>
            <span className="text-purple">Purple</span> = that class's spellcasting stat ·{' '}
            <span className="text-green">Green</span> = a stat you rolled 14+ on
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {module.classes.map((c) => (
              <button key={c.key} type="button" onClick={() => selectClass(c)} className={cx(cardBase, classKey === c.key && cardSelected)}>
                <p className="font-semibold">
                  {c.name}
                  <span className={cx(text.label, 'ml-2 rounded-full border px-2 py-0.5', SOURCE_BADGE[c.source])}>{c.source}</span>
                </p>
                <p className={cx(text.caption, 'mt-1 text-ink-faint')}>
                  Weapons {c.weapons} · Armor {c.armor} · HP 1d{c.hpDie}/lvl
                </p>
                {/* Owner request, 2026-08-15 ("I may want a strength or
                  * dex class") — every ability this class's own talent
                  * table names as a stat-boost option (see
                  * `RulesClass.primaryAbilities`'s doc comment), so
                  * browsing for e.g. a STR/DEX class doesn't require
                  * clicking into each card first.
                  *
                  * Two independent signals, layered rather than
                  * conflated (follow-up same day, "let's add
                  * suggestions"): purple marks the class's spellcasting
                  * stat (a fact about the CLASS, same for every player);
                  * a green fill marks a stat THIS character rolled 14+
                  * on (a fact about the PLAYER, via `strongAbilities`).
                  * A pill can be neither, either, or both — a caster
                  * class's casting stat that the player also rolled well
                  * on gets a filled purple pill (`bg-purple/15`) rather
                  * than picking one color over the other, so "this class
                  * fits you AND happens to be its casting stat" doesn't
                  * silently collapse into just one of those two true
                  * facts. */}
                {c.primaryAbilities.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.primaryAbilities.map((ability) => {
                      const isCasting = c.spellcasting?.ability === ability
                      const isStrong = strongAbilities.has(ability)
                      return (
                        <span
                          key={ability}
                          className={cx(
                            text.label,
                            'rounded-full border px-1.5 py-0.5',
                            isCasting && isStrong
                              ? 'border-purple bg-purple/15 text-purple'
                              : isCasting
                                ? 'border-purple/40 text-purple'
                                : isStrong
                                  ? 'border-green/40 bg-green/10 text-green'
                                  : 'border-line-soft text-ink-dim',
                          )}
                        >
                          {ability.toUpperCase()}
                        </span>
                      )
                    })}
                  </div>
                )}
              </button>
            ))}
          </div>

          {klass && (
            <div className="rounded-[12px] border border-line-soft bg-panel2 p-3">
              <p className={cx(text.label, 'mb-2 text-purple')}>{klass.name} features</p>
              <div className="flex flex-col gap-1">
                {klass.features.map((f, i) => (
                  <p key={i} className={text.bodySecondary}>{f}</p>
                ))}
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {effectiveTalentRolls.map((roll, i) => (
                  <span key={i} className={cx(text.bodySecondary)}>
                    Rolled {roll.total}: {roll.row.effect}
                  </span>
                ))}
                {effectiveTalentRolls.length < maxTalentRolls && (
                  <div className="flex items-center gap-3">
                    <Button type="button" onClick={rollTalent}>Roll talent (2d6)</Button>
                    {/* Only shown once there's a second roll to explain
                      * (Human's Ambitious bonus) — a single-roll class
                      * needs no extra label. */}
                    {maxTalentRolls > 1 && (
                      <span className={cx(text.caption, 'text-ink-faint')}>
                        {effectiveTalentRolls.length}/{maxTalentRolls} rolled
                        {ancestry && effectiveTalentRolls.length === 0 ? ` — ${ancestry.name}'s bonus roll included` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {klass.spellcasting && (
                <div className="mt-3">
                  <p className={cx(text.label, 'mb-2 text-ink-faint')}>
                    Known spells (choose {klass.spellcasting.knownAtLevel1}, using your {klass.spellcasting.ability.toUpperCase()})
                  </p>
                  {klass.spellcasting.spellList ? (
                    <div className="flex flex-wrap gap-2">
                      {klass.spellcasting.spellList.map((spellName) => {
                        const selected = knownSpells.includes(spellName)
                        const atLimit = knownSpells.length >= klass.spellcasting!.knownAtLevel1
                        return (
                          <button
                            key={spellName}
                            type="button"
                            disabled={!selected && atLimit}
                            onClick={() => toggleSpell(spellName)}
                            className={cx(
                              text.caption,
                              'rounded-full border px-3 py-1 disabled:pointer-events-none disabled:opacity-40',
                              selected ? 'border-purple bg-purple/15 text-ink' : 'border-line-soft text-ink-dim',
                            )}
                          >
                            {spellName}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className={cx(text.caption, 'text-ink-faint')}>
                        This book's full spell list wasn't transcribed into the builder — type in the spells you're choosing.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {knownSpells.map((spellName) => (
                          <span key={spellName} className={cx(text.caption, 'rounded-full border border-line-soft bg-panel px-3 py-1')}>{spellName}</span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <TextInput value={spellDraft} onChange={(e) => setSpellDraft(e.target.value)} placeholder="Spell name" className="flex-1" />
                        <Button type="button" variant="ghost" onClick={addDraftSpell}>Add</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'background' && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {module.backgroundTables.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setBackgroundTableKey(t.key)}
                  className={cx(
                    text.label,
                    'rounded-full border px-3 py-1',
                    backgroundTableKey === t.key ? 'border-purple bg-purple/15 text-ink' : 'border-line-soft text-ink-faint',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mb-2 flex items-center gap-2">
              <Button type="button" onClick={rollBackground}>Roll (d20)</Button>
              <span className={cx(text.caption, 'text-ink-faint')}>or pick one below, or type your own</span>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {backgroundTable?.entries.map((entry) => (
                <button
                  key={entry.roll}
                  type="button"
                  onClick={() => pickBackgroundEntry(entry.name, entry.detail)}
                  className="rounded-[8px] border border-line-soft bg-panel2 px-2.5 py-1.5 text-left hover:border-line-hover"
                >
                  <span className={cx(text.caption, 'font-semibold')}>{entry.name}.</span>{' '}
                  <span className={cx(text.caption, 'text-ink-faint')}>{entry.detail}</span>
                </button>
              ))}
            </div>
            <TextInput label="Background" value={backgroundText} onChange={(e) => setBackgroundText(e.target.value)} />
          </div>

          <div>
            <p className={cx(text.label, 'mb-2 text-ink-faint')}>Alignment</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {module.alignments.map((a) => (
                <button key={a.key} type="button" onClick={() => setAlignmentKey(a.key)} className={cx(cardBase, alignmentKey === a.key && cardSelected)}>
                  <p className="font-semibold">{a.key}</p>
                  <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{a.blurb}</p>
                </button>
              ))}
            </div>
          </div>

          {klass?.requiresDeity && (
            <div>
              <p className={cx(text.label, 'mb-2 text-ink-faint')}>Deity (must match your alignment)</p>
              {!alignmentKey ? (
                <p className={cx(text.caption, 'text-ink-faint')}>Choose an alignment first.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {module.deities
                    .filter((d) => d.alignment === alignmentKey)
                    .map((d) => (
                      <button key={d.name} type="button" onClick={() => setDeityName(d.name)} className={cx(cardBase, deityName === d.name && cardSelected)}>
                        <p className="font-semibold">{d.name}</p>
                        <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{d.blurb}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'gear' && (
        <div className="flex flex-col gap-5">
          {isZeroLevel ? (
            <div>
              {/* Section label, matching SHOP/SEARCH below — the step
                * used to open straight onto the button with nothing
                * above it ("gear page is tight at the top"). */}
              <p className={cx(text.label, 'mb-2 text-ink-faint')}>Starting gear</p>
              <div className="mb-2 flex items-center gap-3">
                <Button type="button" onClick={rollZeroLevelGear} className={cx(!goldOrGearEngaged && ROLL_NEEDED_RING)}>
                  Roll starting gear ({module.zeroLevelGear.rollCount})
                </Button>
                {goldRolled && <span className={cx(text.caption, 'text-ink-faint')}>Rerolling replaces the list below.</span>}
              </div>
            </div>
          ) : (
            <div>
              {/* Same tight-top fix as the 0-level branch above. */}
              <p className={cx(text.label, 'mb-2 text-ink-faint')}>Starting gold</p>
              <div className="mb-2 flex items-center gap-3">
                <Button type="button" onClick={rollGold} className={cx(!goldOrGearEngaged && ROLL_NEEDED_RING)}>
                  Roll starting gold ({module.firstLevelGoldFormula})
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <TextInput label="GP" inputMode="numeric" value={gold.gp} onChange={(e) => setGold((g) => ({ ...g, gp: e.target.value }))} className="w-24" />
                <TextInput label="SP" inputMode="numeric" value={gold.sp} onChange={(e) => setGold((g) => ({ ...g, sp: e.target.value }))} className="w-24" />
                <TextInput label="CP" inputMode="numeric" value={gold.cp} onChange={(e) => setGold((g) => ({ ...g, cp: e.target.value }))} className="w-24" />
              </div>
            </div>
          )}

          {/* Owner request, 2026-08-15 — Core-rulebook priced catalog,
            * only shown for 1st-level (0-level characters roll gear
            * directly above and never get starting gold to shop with,
            * per the rulebook's own Starting Gear section). Buying
            * charges `gold` and appends straight into the same
            * `equipment` list the manual add box and 0-level gear roll
            * both already write to. */}
          {!isZeroLevel && (
            <div>
              <p className={cx(text.label, 'mb-2 text-ink-faint')}>Shop</p>
              <Shop goldCp={goldToCp(gold)} owned={equipment} onBuy={buyShopItem} onReturn={returnShopItem} />
            </div>
          )}

          <div>
            <p className={cx(text.label, 'mb-2 text-ink-faint')}>
              Gear — carries up to {gearMax} items (10 or your Strength score, whichever is higher)
            </p>
            {equipment.length > 0 && <GearSlotGrid items={equipment} onRemove={removeGearItem} className="mb-2" />}
            <div className="flex items-end gap-2">
              <TextInput
                label={isZeroLevel ? 'Add item' : "Add an item the shop doesn't carry"}
                value={gearDraft}
                onChange={(e) => setGearDraft(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="ghost" onClick={addGearItem}>Add</Button>
            </div>
          </div>

          {!goldOrGearEngaged && (
            <p className={cx(text.caption, 'text-orange')}>
              {isZeroLevel
                ? 'Roll starting gear above to continue.'
                : 'Roll (or type in) starting gold, or add at least one item, to continue.'}
            </p>
          )}
        </div>
      )}

      {step === 'review' && ancestry && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xl font-semibold">{name || 'Unnamed'}</p>
              <p className={cx(text.caption, 'mt-1 text-ink-faint')}>
                {isZeroLevel ? `${ancestry.name} (0-level)` : `${ancestry.name} ${klass?.name ?? ''}`}
                {alignmentKey && ` · ${alignmentKey}${titleAtLevel1 ? ` ${titleAtLevel1}` : ''}`}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl">
                {Math.max(1, computedHpMax)} <span className={cx(text.caption, 'text-ink-faint')}>HP</span>
              </p>
              <p className={cx(text.caption, 'text-ink-faint')}>
                AC{' '}
                <input
                  value={acOverride ?? String(computedAc)}
                  onChange={(e) => setAcOverride(e.target.value)}
                  inputMode="numeric"
                  className="w-10 rounded-[6px] border border-line-hover bg-bg text-center font-mono text-ink"
                />
              </p>
            </div>
          </div>

          {!isZeroLevel && klass && (
            <div className="flex items-center gap-3">
              <span className={cx(text.label, 'text-ink-faint')}>HP roll</span>
              <span className={text.bodySecondary}>1d{klass.hpDie} ({hpRoll ?? '—'}) + CON {conMod >= 0 ? `+${conMod}` : conMod}</span>
              <Button type="button" onClick={rollHp} className={cx(!hpReady && ROLL_NEEDED_RING)}>
                {hpRoll === null ? 'Roll HP' : 'Reroll HP'}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ABILITY_ORDER.map((ability) => {
              const score = Number(stats[ability].value) || 0
              const mod = abilityModifier(module, score)
              return (
                <div key={ability} className="rounded-[10px] border border-line-soft bg-panel2 p-2 text-center">
                  <p className={cx(text.label, 'text-ink-faint')}>{abilityLabel(ability)}</p>
                  <p className={cx(text.numeric, 'mt-1')}>{score}</p>
                  <p className={cx(text.caption, mod >= 0 ? 'text-green' : 'text-red')}>{mod >= 0 ? `+${mod}` : mod}</p>
                </div>
              )
            })}
          </div>

          <div>
            <p className={cx(text.label, 'mb-2 text-ink-faint')}>Talents &amp; features</p>
            <div className="flex flex-wrap gap-1.5">
              <span className={cx(text.caption, 'rounded-full border border-line-soft bg-panel2 px-3 py-1')}>{ancestry.talent}</span>
              {klass?.features.map((f, i) => (
                <span key={i} className={cx(text.caption, 'rounded-full border border-line-soft bg-panel2 px-3 py-1')}>{f}</span>
              ))}
              {effectiveTalentRolls.map((roll, i) => (
                <span key={i} className={cx(text.caption, 'rounded-full border border-line-soft bg-panel2 px-3 py-1')}>{roll.row.effect}</span>
              ))}
              {knownSpells.map((s) => (
                <span key={s} className={cx(text.caption, 'rounded-full border border-line-soft bg-panel2 px-3 py-1')}>{s}</span>
              ))}
              {deityName && <span className={cx(text.caption, 'rounded-full border border-line-soft bg-panel2 px-3 py-1')}>Deity: {deityName}</span>}
            </div>
          </div>

          {equipment.length > 0 && (
            <div>
              <p className={cx(text.label, 'mb-2 text-ink-faint')}>Gear</p>
              <GearSlotGrid items={equipment} />
            </div>
          )}

          <div>
            <p className={cx(text.label, 'mb-2 text-ink-faint')}>Party status</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStatus('active')} className={cx(cardBase, 'px-4 py-2', status === 'active' && cardSelected)}>
                Active
              </button>
              <button type="button" onClick={() => setStatus('awaiting')} className={cx(cardBase, 'px-4 py-2', status === 'awaiting' && cardSelected)}>
                Awaiting a player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bug found live, same day (owner: "character creation is
        * getting hung up on background. it wont let me select one and
        * then continue") — the real cause: once the sticky footer
        * below is scrolled to its stuck position, it opaquely covers
        * roughly its own height's worth of whatever content is
        * scrolled into that same screen region — normal for ANY
        * bottom-sticky bar, but on a short step (Background: a text
        * field plus one Alignment grid, no long list) that covered
        * zone can BE the step's last real controls, with no further
        * room to scroll past max-scroll to bring them clear. Alignment
        * is required to continue (see `canContinue.background` below),
        * so a trapped-behind-the-footer alignment grid reads exactly
        * as "picking a background doesn't let me continue" — the
        * background text was never the blocker, the un-reachable
        * alignment buttons were. This spacer (sized to roughly the
        * footer's own rendered height: `pt-4` + one button row + `pb-7`
        * ≈ 88px, rounded up) guarantees every step always has that much
        * extra scrollable room after its real content, so the last
        * control can always be scrolled clear of the footer's covered
        * zone. Plain flow, not sticky itself — only real content needs
        * never sit here, this box is disposable. */}
      <div className="h-24" aria-hidden="true" />

      {/* Sticky footer, same request/reasoning as the breadcrumb row
        * above — `sticky bottom-0` keeps Back/Continue (or Create, on
        * Review) reachable without scrolling down past a long step's
        * content first.
        *
        * Follow-up, same day (owner: "it shows the scroll on the top
        * and bottom, i think you just shorten that panel to be inside
        * the sticky bars") — same fix as the breadcrumb row's own
        * follow-up above, mirrored for this edge: the scroll
        * container's own `pb-6`/`px-4 sm:px-6` sat BELOW this box even
        * while stuck (this is the last child), so scrolled-past content
        * could peek through beneath the buttons. `-mb-6`/`-mx-4
        * sm:-mx-6` cancels that padding here, and `pb-7` (the old
        * `pb-1` breathing room plus the canceled `pb-6`, folded into
        * one value so the total gap above the buttons to the true edge
        * is unchanged) plus `px-4 sm:px-6` restores the original
        * visual spacing.
        *
        * Second follow-up, same day (owner: "the top still has a
        * sliver") — same over-correction as the breadcrumb row's own
        * second pass, mirrored: this originally also set `bottom:
        * -1.5rem` reasoning it needed to match `-mb-6`, which pushed
        * the stuck threshold 24px past where the margin trick had
        * already put this row's natural position (flush with the
        * scrollport's true bottom edge). Plain `bottom-0` needs no such
        * extra offset — `-mb-6` alone already gets the row there. */}
      {/* `-bottom-6`, not `bottom-0` — see the breadcrumb bar's
        * comment: compensates Chrome's sticky margin-box pinning for
        * this bar's `-mb-6`; clipped harmlessly on older engines. */}
      {/* `after:` apron below — mirror of the breadcrumb bar's `before:`
        * strip above; see its comment. */}
      <div className="sticky -bottom-6 z-10 -mx-4 mt-6 -mb-6 flex items-center justify-between border-t border-line-soft bg-panel px-4 pb-7 pt-4 after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-panel sm:-mx-6 sm:px-6">
        <Button type="button" variant="ghost" onClick={stepIndex === 0 ? requestClose : goBack}>
          {stepIndex === 0 ? 'Cancel' : '← Back'}
        </Button>
        {step === 'review' ? (
          <div className="flex flex-col items-end gap-1">
            {!hpReady && (
              <span className={cx(text.caption, 'text-orange')}>Roll HP above before creating.</span>
            )}
            <Button type="button" disabled={saving || !hpReady} onClick={() => void handleCreate()}>
              {saving ? 'Creating…' : 'Create Character'}
            </Button>
          </div>
        ) : (
          <Button type="button" disabled={!canContinue[step]} onClick={goNext}>
            Continue →
          </Button>
        )}
      </div>
    </Overlay>
  )
}
