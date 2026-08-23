import { useEffect, useMemo, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { ErrorBanner } from '../ui/ErrorBanner'
import { EmptyState } from '../ui/EmptyState'
import { GearSlotGrid } from './GearSlotGrid'
import { Shop } from './Shop'
import { createCharacter } from '../../lib/characters'
import type { Character, CharacterAbilities, CharacterSheetData, AbilityScore } from '../../lib/characters'
import { AncestryBustIcon, AncestrySpriteArt, ClassBustIcon, classColor } from './AncestryClassArt'
import { getRulesModule, hasRulesModule, abilityModifier, ABILITY_ORDER } from '../../lib/rules'
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

/** Three small icons for the Class step's weapons/armor/hit-die tiles
 * (2026-08-22 redesign) — plain inline SVGs rather than another entry
 * in `AncestryClassArt`'s `ITEM_ICONS`, since that map is keyed to
 * structured Shop-catalog item keys and a class's `weapons`/`armor`
 * fields are free text (things like "razor chain" or "blowgun" have no
 * matching catalog icon to fuzzy-match against) — one generic icon per
 * category avoids guessing at a per-weapon icon that doesn't exist.
 * `WeaponsIcon` is crossed swords (owner request, replacing an earlier
 * single-dagger glyph); `strokeWidth`/`fill` are camelCase here (JSX
 * SVG props), unlike the kebab-case attributes the equivalent HTML
 * mockup used. */
function WeaponsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="4" cy="20" r="1.1" fill="currentColor" stroke="none" />
      <path d="M4 20L6.5 17.5" />
      <path d="M5.2 16.2L7.8 18.8" />
      <path d="M6.5 17.5L20 4" />
      <circle cx="20" cy="20" r="1.1" fill="currentColor" stroke="none" />
      <path d="M20 20L17.5 17.5" />
      <path d="M18.8 16.2L16.2 18.8" />
      <path d="M17.5 17.5L4 4" />
    </svg>
  )
}
function ArmorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3l7 3v6c0 5-3 8.5-7 9-4-.5-7-4-7-9V6z" />
    </svg>
  )
}
function HitDieIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20s-7-4.4-9.5-9C.7 7.6 2.4 4 6 4c2 0 3.4 1.1 4 2.4C10.6 5.1 12 4 14 4c3.6 0 5.3 3.6 3.5 7-2.5 4.6-9.5 9-9.5 9z" />
    </svg>
  )
}
function BrowseSparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
    </svg>
  )
}

/** Weapons / Armor / Hit die tiles — replaces the old single dense
 * caption line ("Weapons X · Armor Y · HP Zd/lvl") the owner flagged as
 * hard to read. Module-level (not a component-body closure) since it
 * only needs the class it's given, same reasoning as `SOURCE_BADGE`
 * living outside the component. */
function ClassStatTiles({ c }: { c: RulesClass }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="flex items-start gap-2 rounded-[10px] border border-line-soft bg-panel/60 p-2.5">
        <WeaponsIcon className="mt-0.5 h-[15px] w-[15px] shrink-0 text-red" />
        <div className="min-w-0">
          <p className={cx(text.label, 'text-ink-faint')}>Weapons</p>
          <p className={cx(text.bodySecondary, 'leading-snug')}>{c.weapons}</p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-[10px] border border-line-soft bg-panel/60 p-2.5">
        <ArmorIcon className="mt-0.5 h-[15px] w-[15px] shrink-0 text-stone" />
        <div className="min-w-0">
          <p className={cx(text.label, 'text-ink-faint')}>Armor</p>
          <p className={cx(text.bodySecondary, 'leading-snug')}>{c.armor}</p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-[10px] border border-line-soft bg-panel/60 p-2.5">
        <HitDieIcon className="mt-0.5 h-[15px] w-[15px] shrink-0 text-green" />
        <div className="min-w-0">
          <p className={cx(text.label, 'text-ink-faint')}>Hit die</p>
          <p className={cx(text.bodySecondary, 'font-mono font-semibold text-ink')}>1d{c.hpDie} / level</p>
        </div>
      </div>
    </div>
  )
}

const emptyStats = (): Record<Ability, { value: string; dice: number[] | null }> =>
  Object.fromEntries(ABILITY_ORDER.map((ability) => [ability, { value: '', dice: null }])) as Record<
    Ability,
    { value: string; dice: number[] | null }
  >

const cardBase =
  // Padding bumped 3->4->5 (12px->16px->20px) 2026-08-20 (owner: "give
  // things some more room to breathe", then "even more") — raised here
  // rather than per-step so every card built on this base (Ancestry,
  // Class, and anything later) stays consistent rather than drifting
  // apart card-family by card-family the way the color systems did
  // before grimoire-ancestry-class-icon-colors.md unified those.
  'rounded-[12px] border border-line-soft bg-panel2 p-5 text-left transition-colors hover:border-line-hover'
const cardSelected = 'border-purple bg-purple/10'

// Flat neutral, no per-book color (owner request, 2026-08-17: "let's
// remove color from expansion" — see claude/grimoire-ancestry-class-
// icon-colors.md §5 in the Shadowdark project, which had already
// recorded this decision but the code still had the old per-sourcebook
// coloring below until this pass caught it, same as the Class sigil
// colors and ghost overlay that doc's §3/§6 also documented ahead of
// actually shipping). One color per sourcebook (2026-08-15 — playtesting
// surfaced that all three expansions rendered as the identical orange
// badge, only Core stood apart) was the fix at the time, but per that
// doc's §1, a per-book color here collided with the SAME seven tokens
// meaning ancestry/class identity on the surrounding cards — "cyan"
// meant Elf/Sea Wolf/Seer AND "this is Core content" depending on
// which element you looked at. Flat neutral removes that collision
// instead of managing it.
const SOURCE_BADGE_CLASSES = 'border-line-hover text-ink-dim'
const SOURCE_BADGE: Record<RulesClass['source'], string> = {
  Core: SOURCE_BADGE_CLASSES,
  Diablerie: SOURCE_BADGE_CLASSES,
  'Red Sands': SOURCE_BADGE_CLASSES,
  'Midnight Sun': SOURCE_BADGE_CLASSES,
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
  // Class step redesign (2026-08-22, owner: "lets go with B" — the
  // master/detail mockup): below `md:`, only one of the list-of-12 or
  // the selected class's detail is visible at a time, and this is
  // which. It's deliberately separate from `classKey` — tapping "← All
  // classes" to browse and compare another class must not un-pick the
  // one already chosen (and must not reset its talent roll / spells,
  // which `selectClass` wipes). Reset to "show the list" whenever the
  // Class step is freshly entered with nothing picked yet, and to "show
  // the detail" when re-entering with a class already chosen (see the
  // effect next to the scroll-reset one below) — the same "land on
  // what you were doing" feel Ancestry etc. already have for free by
  // just always rendering everything at once.
  const [classListView, setClassListView] = useState(true)
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

  // The scroll container keeps its position across step changes, so
  // moving from a long step to the next one landed the player mid-list
  // instead of at the top (live report: reached the Gear step 2000px+
  // deep in the shop with the starting-gold roll scrolled out of view).
  // Reset whenever the step changes. The ref points at the builder's
  // own scrolling middle (flushBody layout — see the row comment in
  // the JSX).
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [step])

  // See `classListView`'s own comment above — only relevant on mobile,
  // where the Class step shows the list OR the detail pane, never both.
  // Keyed on `classKey` too (not just `step`) so picking a class also
  // flips this to "show detail" — belt-and-suspenders with the list
  // row's own click handler doing the same, and harmless since
  // `classKey` only ever goes from unset to set while on this step.
  useEffect(() => {
    if (step === 'class') setClassListView(!classKey)
  }, [step, classKey])

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

  // Unsupported-system gate (2026-08-17, owner: "all the Shadowdark
  // stuff is not in the CY_BORG campaign"): `getRulesModule`'s
  // defensive Shadowdark fallback is right for read paths, but HERE it
  // would present the full Shadowdark wizard inside a CY_BORG campaign
  // and happily build an elf into Cy. Until that system's builder slice
  // lands (CYBORG_PACKAGE_PLAN.md, cyborg-3), an honest empty state
  // beats the wrong wizard.
  if (!hasRulesModule(system)) {
    return (
      <Overlay
        open={open}
        onClose={onClose}
        header={
          <div className="min-w-0">
            <h2 className={cx(text.h2, 'truncate')}>New Character</h2>
            <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{system ?? 'unknown system'}</p>
          </div>
        }
      >
        <EmptyState
          icon="party"
          title="No builder for this system yet"
          description="Guided character creation for this ruleset is coming. For now, roll your character with the GM in chat and it gets added to the party for you."
        />
      </Overlay>
    )
  }

  return (
    <>
    <Overlay
      open={open}
      onClose={requestClose}
      width="wide"
      tall
      flushBody
      header={
        <div className="min-w-0">
          <h2 className={cx(text.h2, 'truncate')}>New Character</h2>
          <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{module.label} · Step {stepIndex + 1} of {steps.length}</p>
        </div>
      }
    >
      {/* Owner's final architecture call after four rounds of sticky-bar
        * sliver fixes ("make the nav and buttons the top and bottom and
        * the panel would fit inside those — not really sticky anymore,
        * just built in better"): the breadcrumb row and the Back/
        * Continue row are now REAL rows of the panel via Overlay's
        * `flushBody`, with the scrolling area a separate sibling
        * between them. Nothing is sticky, nothing overlaps content, no
        * negative margins, no pinning math for a browser update to
        * change out from under us — the full saga of what that cost
        * lives in this file's git history (a3350a8 through 5cdf20c). */}
      {/* Below sm:, only the CURRENT step spells its name — the rest
        * are bare numbers, one row, never wrapping (owner, 2026-08-16:
        * seven labeled chips wrapped to three lines on a phone — "so
        * many tabs it looks a bit crazy"). The green/faint/purple
        * states already say done/current/upcoming without words, and
        * the header's "Step N of 7" plus the current chip's own label
        * cover the rest. Desktop (sm:+) keeps every label. */}
      <div className="flex shrink-0 flex-nowrap gap-1.5 overflow-x-auto border-b border-line-soft px-4 py-4 sm:flex-wrap sm:px-6" style={{ scrollbarWidth: 'none' }}>
        {steps.map((key, index) => (
          <span
            key={key}
            className={cx(
              text.label,
              'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 uppercase tracking-eyebrow',
              index === stepIndex
                ? 'border-purple bg-purple/15 text-ink'
                : index < stepIndex
                  ? 'border-green/35 text-green'
                  : 'border-line-soft text-ink-faint',
            )}
          >
            {index + 1}
            <span className={cx(index !== stepIndex && 'hidden sm:inline')}> {STEP_LABEL[key]}</span>
          </span>
        ))}
      </div>

      {/* The scrolling middle — owns the padding the Overlay body used
        * to carry, plus the step-change scroll reset (the ref). */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">

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
        // Owner, 2026-08-17 ("cut some height off the stat row... so
        // things don't get hidden when the 14 warning comes up") — the
        // reroll banner below only renders once all six stats are
        // filled and none rolled 14+, so it was landing at the bottom
        // of an already-tall stack and could end up below the fold.
        // Trimmed gap-3 -> gap-2 here (between the intro line, the Roll
        // All/Clear row, all six stat rows, and the banner).
        //
        // Follow-up same day, after the owner saw it live: the first
        // pass only moved the row's own padding, but the per-row Roll
        // button (min-h-9/sm:min-h-11, the 44px touch-target minimum)
        // was still the tallest thing in the row and dominated its
        // height regardless — "a lot of space above and below the stat
        // roll... scale down the size of the buttons." Per-row Roll
        // dropped the touch-target minimum entirely below, same
        // deliberate, scoped exception CLAUDE.md already documents for
        // JournalComposer's kind-toggle pills ("a deliberate, scoped
        // exception to the standing... rule... not a change to the rule
        // itself") — six of these sit in a tight list exactly like that
        // pill row does, and the shared 44px Roll All/Clear buttons
        // above remain full-size since those aren't part of the dense
        // list.
        <div className="flex flex-col gap-2">
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
              // One line, always (owner, 2026-08-16: "the formatting on
              // mobile... looks bad" — the shared 44px/px-6 Button
              // wrapped below the fields on a phone, leaving each stat
              // a tall card that was mostly empty). No `flex-wrap`;
              // everything is compact below sm: (smaller dice boxes,
              // tighter gaps, a hand-rolled compact Roll button — same
              // precedent as the composer's send block). Originally
              // grew back to the shared Button's 44px size at sm:+;
              // the 2026-08-17 pass (see the step-level comment above)
              // made the Roll button compact at every breakpoint
              // instead, since the owner's complaint about row height
              // applied on desktop too, not just mobile.
              <div key={ability} className="flex items-center gap-2 rounded-[10px] border border-line-soft bg-panel2 p-1.5 sm:gap-3 sm:p-2">
                <span className={cx(text.label, 'w-8 shrink-0 text-ink-faint sm:w-10')}>{abilityLabel(ability)}</span>
                <div className="flex shrink-0 gap-1">
                  {(entry.dice ?? [null, null, null]).map((die, i) => (
                    <div
                      key={i}
                      className={cx(
                        'flex h-5 w-5 items-center justify-center rounded-[6px] border font-mono text-[10px] sm:h-6 sm:w-6 sm:text-[11px]',
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
                  className="h-9 w-12 shrink-0 rounded-[8px] border border-line-hover bg-bg text-center font-mono text-[15px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 sm:w-14"
                />
                <span className={cx(text.caption, 'w-7 shrink-0 text-center sm:w-8', mod !== null && mod >= 0 ? 'text-green' : mod !== null ? 'text-red' : 'text-ink-faint')}>
                  {mod !== null ? (mod >= 0 ? `+${mod}` : mod) : '—'}
                </span>
                <button
                  type="button"
                  onClick={() => rollOneStat(ability)}
                  className={cx(
                    text.caption,
                    'ml-auto inline-flex shrink-0 items-center justify-center rounded-button bg-purple px-3 py-1 font-semibold uppercase text-white shadow-[0_0_0_1px_rgba(155,92,255,0.25),0_8px_24px_-8px_rgba(155,92,255,0.55)] hover:bg-purple-hover sm:px-4 sm:py-1.5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  )}
                >
                  Roll
                </button>
              </div>
            )
          })}
          {showRerollBanner && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-yellow/35 bg-yellow/10 p-2.5">
              <span className={cx(text.bodySecondary, 'text-yellow')}>⚠ {module.statMethod.rerollRule ?? ''}</span>
              <Button type="button" onClick={rollAllStats}>Reroll All</Button>
            </div>
          )}
        </div>
      )}

      {/* Pictograms (2026-08-16, "races need visuals on what they are"
        * — style approved via ancestry-art-mockup.html): each card
        * leads with its mark in its own accent color, text to the
        * right. Ancestry's mark swapped 2026-08-17 from the sigil to a
        * real bust icon (`AncestryBustIcon`); Class got its own matching
        * bust-icon set the same day (`ClassBustIcon` — see
        * AncestryClassArt.tsx's doc comments on both swaps). Neither
        * step uses its sigil mark for this front icon anymore — the
        * sigil maps (`ANCESTRY_SIGILS` / `CLASS_SIGILS`) still exist
        * because both bust icons reuse them for tint color and as the
        * "no art yet for this key" fallback.
        *
        * Same day's follow-up ("art for the right side is here"), SECOND
        * pass after the owner's first live look: full-color character
        * art now sits in its own column to the right of the text — a
        * real flex sibling, not an absolutely positioned overlay bleeding
        * off the edge — specifically because the overlay version clipped
        * (goblin's head) on any card whose text rendered shorter than
        * the art's fixed height, and needed a fade to keep the two from
        * visually fighting where they overlapped. Side-by-side columns
        * make both problems structural non-issues: a flex row's height
        * is always at least its tallest child, so nothing can clip, and
        * art/text never occupy the same pixels, so there's nothing to
        * fade. Every ancestry renders at the same height — a per-
        * ancestry relative scale was tried and reverted same-day, see
        * `AncestrySpriteArt`'s own doc comment. */}
      {step === 'ancestry' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {module.ancestries.map((a) => (
            <button key={a.key} type="button" onClick={() => setAncestryKey(a.key)} className={cx(cardBase, 'flex items-stretch justify-between gap-5', ancestryKey === a.key && cardSelected)}>
              <span className="flex min-w-0 flex-1 items-start gap-5">
                <AncestryBustIcon k={a.key} className="mt-0.5 h-9 w-9 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{a.name}</span>
                  <span className={cx(text.caption, 'mt-2 block text-ink-faint')}>{a.languages.join(', ')}</span>
                  {/* leading-normal tightens off text-body's default 1.7
                    * line-height (owner, 2026-08-20: "tighten leading a
                    * bit on descriptions") — explicit leading-* wins
                    * over the paired line-height text-body carries, so
                    * this overrides cleanly rather than fighting it. */}
                  <span className={cx(text.bodySecondary, 'mt-2.5 block leading-normal')}>{a.talent}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-end">
                <AncestrySpriteArt k={a.key} baseHeightPx={116} />
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 'class' && (
        <div className="flex flex-col gap-4">
          {/* Class step redesign, 2026-08-22 (owner: "we still need to
            * work on the class page ... when I select thief the
            * features are at the bottom ... the weapons line are also
            * not easy to read" → mocked up two directions → "lets go
            * with B"). Two things this replaces:
            *
            * 1. The old grid-of-12-cards had the selected class's
            *    features panel render as a sibling AFTER the entire
            *    grid closed — so opening Thief's features meant
            *    scrolling past all 12 cards to find them, regardless of
            *    which one was clicked. This is a browse/compare layout
            *    instead: a scannable list on one side, a detail pane on
            *    the other that's always in the same place — nothing to
            *    scroll past, ever, on desktop or mobile.
            * 2. The old "Weapons X · Armor Y · HP Zd/lvl" caption
            *    crammed three different facts into one dense line —
            *    replaced by `ClassStatTiles` below.
            *
            * The old "Purple = casting stat · Green = 14+" sentence
            * (2026-08-15, "let's add suggestions") is gone too, in favor
            * of a real rolled-stats strip that demonstrates the same
            * two colors directly: the tile for whichever ability is the
            * OPEN class's spellcasting stat highlights purple right
            * here, and any stat this character actually rolled 14+ on
            * (`strongAbilities`, same threshold the reroll banner and
            * the ability pills below already use) highlights green —
            * the meaning shows itself instead of needing a caption. */}
          <div className="rounded-[12px] border border-line-soft bg-panel2/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
              <span className={cx(text.label, 'text-ink-faint')}>Your rolled stats</span>
              <span className="flex gap-3">
                <span className={cx(text.caption, 'flex items-center gap-1.5 text-ink-faint')}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple" aria-hidden="true" /> Casting stat
                </span>
                <span className={cx(text.caption, 'flex items-center gap-1.5 text-ink-faint')}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green" aria-hidden="true" /> Rolled 14+
                </span>
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {ABILITY_ORDER.map((ability) => {
                const isStrong = strongAbilities.has(ability)
                const isCasting = klass?.spellcasting?.ability === ability
                return (
                  <div
                    key={ability}
                    className={cx(
                      'flex flex-col items-center gap-0.5 rounded-[8px] border p-1.5 sm:p-2',
                      isCasting ? 'border-purple bg-purple/10' : isStrong ? 'border-green/40 bg-green/10' : 'border-line-soft bg-panel2',
                    )}
                  >
                    <span className={cx(text.label, 'text-[9px] sm:text-[10px]', isCasting ? 'text-purple' : 'text-ink-faint')}>{abilityLabel(ability)}</span>
                    <span className={cx('font-mono text-[12px] font-semibold tabular-nums sm:text-[13px]', isCasting ? 'text-purple' : isStrong ? 'text-green' : 'text-ink')}>
                      {stats[ability].value || '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Only relevant below `md:`, where exactly one of the list or
            * detail pane below is visible — see `classListView`'s own
            * comment near its `useState`. */}
          {(() => {
            const showDetail = Boolean(klass) && !classListView
            return (
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
                <div className={cx('overflow-hidden rounded-[12px] border border-line-soft bg-panel2/40 md:w-[300px] md:shrink-0', showDetail ? 'hidden md:block' : 'block')}>
                  <div className="md:max-h-[600px] md:overflow-y-auto">
                    {module.classes.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          // Guard against re-wiping talent rolls / known
                          // spells when the row for the ALREADY-selected
                          // class is tapped again just to view it (e.g.
                          // coming back from "← All classes") — the old
                          // grid's onClick called `selectClass` unconditionally
                          // on every click, class-unchanged included, which
                          // this deliberately no longer does here.
                          if (c.key !== classKey) selectClass(c)
                          setClassListView(false)
                        }}
                        className={cx(
                          'flex w-full items-center gap-3 border-b border-line-soft p-3 text-left last:border-b-0 hover:bg-panel2',
                          classKey === c.key && 'bg-purple/10',
                        )}
                      >
                        {/* Bust icon dropped from this row (owner,
                         * 2026-08-23: "the icons are so small you cant
                         * see what they are so maybe just remove them
                         * from there") — at 28px the bust shape mostly
                         * read as noise, not a distinguishing mark. The
                         * class's WoW-analog identity color (§3,
                         * grimoire-ancestry-class-icon-colors.md) moves
                         * to the name text instead via `classColor` —
                         * same request, "then color code the names" —
                         * so the row keeps a color cue without needing
                         * icon real estate to carry it. The bust icon
                         * itself is still the detail pane's job (now at
                         * 80px, where the shape actually reads). */}
                        <span className="min-w-0 flex-1">
                          {/* Hit-die chip moved up into the title row
                           * (owner, 2026-08-23: "move the DMG dice roll
                           * ie like the D8 to the title row to give
                           * description more space") — it used to be a
                           * separate `shrink-0` column sibling to this
                           * whole text block, which ate a fixed slice of
                           * row width the blurb couldn't reclaim. Now
                           * it's a third item in the name/badge line, so
                           * the blurb below gets the full row. */}
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[13.5px] font-semibold" style={{ color: classColor(c.key) }}>{c.name}</span>
                            <span className={cx(text.label, 'shrink-0 rounded-full border px-1.5 py-0.5', SOURCE_BADGE[c.source])}>{c.source}</span>
                            <span className={cx(text.caption, 'shrink-0 rounded-[6px] border border-line-soft px-1.5 py-0.5 text-ink-dim')}>d{c.hpDie}</span>
                          </span>
                          {/* Full blurb, not truncated (owner, 2026-08-23,
                           * reversing an earlier same-day melee/ranged-
                           * badge swap: "the ranged melee thing is not
                           * gonna work... lets make the initial box at
                           * least contain the whole description").
                           *
                           * Body copy, not `text.caption` (owner,
                           * same day, after seeing it live: "change the
                           * description copy to the body copy style not
                           * the indicator or button style") — caption's
                           * mono face reads as UI chrome, the same
                           * treatment the CORE badge and hp-die chip
                           * above deliberately use, but this is prose,
                           * not a control label. The badge and hp-die
                           * chip stay on `text.caption`/`text.label`
                           * as-is; only this line's family changed.
                           *
                           * Sized down off the full `text.bodySecondary`
                           * token, though (owner, same day: "the font
                           * size is bigger than the title of the class
                           * size so bring down the body copy") —
                           * `text.bodySecondary` bakes in `text-body`
                           * (16px), which outsized the row's own
                           * `text-[13.5px]` name. Reusing `text-caption`'s
                           * own 0.75rem/12px value here keeps the same
                           * family swap (sans, not mono) the owner asked
                           * for while landing clearly under the name —
                           * this list row already isn't strict
                           * closed-set typography (the name's own
                           * `text-[13.5px]` predates this), so a second
                           * explicit size follows that same precedent
                           * rather than introducing a new one. */}
                          <span className={cx('font-sans text-[0.75rem] leading-snug text-ink-dim text-pretty', 'mt-0.5 block')}>{c.blurb}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={cx('min-w-0 flex-1 overflow-hidden rounded-[12px] border border-line-soft bg-panel2/40', showDetail ? 'block' : 'hidden md:block')}>
                  <div className="p-4 sm:p-6 md:max-h-[600px] md:overflow-y-auto">
                    {!klass ? (
                      <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 py-6 text-center">
                        <BrowseSparkIcon className="h-8 w-8 text-ink-faint" />
                        <p className={cx(text.bodySecondary, 'max-w-[30ch] text-ink-faint')}>
                          Select a class to see its full details — features, weapons and armor, talent roll, and spells, all in one place.
                        </p>
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => setClassListView(true)} className={cx(text.caption, 'mb-4 flex items-center gap-1.5 text-ink-dim md:hidden')}>
                          ← All classes
                        </button>

                        <div className="flex items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-[22px] font-semibold leading-tight">
                              {klass.name}
                              <span className={cx(text.label, 'rounded-full border px-2 py-0.5', SOURCE_BADGE[klass.source])}>{klass.source}</span>
                            </p>
                            <p className={cx(text.bodySecondary, 'mt-2 leading-normal')}>{klass.blurb}</p>
                          </div>
                          {/* Bust icon on the right (owner, 2026-08-23:
                           * "on the big panel should we move the icon to
                           * the right") — same 80px icon, just reordered
                           * after the text column instead of before it. */}
                          <ClassBustIcon k={klass.key} className="h-20 w-20 shrink-0" />
                        </div>

                        <ClassStatTiles c={klass} />

                        {/* Same two-signal pill logic as before (owner,
                          * 2026-08-15, "let's add suggestions" /
                          * "I may want a strength or dex class") — purple
                          * marks the class's own spellcasting stat, green
                          * marks a stat THIS character rolled 14+ on, and
                          * a pill can be neither/either/both. */}
                        {klass.primaryAbilities.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {klass.primaryAbilities.map((ability) => {
                              const isCasting = klass.spellcasting?.ability === ability
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

                        <div className="mt-5 border-t border-line-soft pt-4">
                          <p className={cx(text.label, 'mb-2 text-purple')}>Class features</p>
                          <div className="flex flex-col gap-1">
                            {klass.features.map((f, i) => (
                              <p key={i} className={text.bodySecondary}>{f}</p>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-4">
                          {effectiveTalentRolls.map((roll, i) => (
                            <span key={i} className={cx(text.bodySecondary)}>
                              Rolled {roll.total}: {roll.row.effect}
                            </span>
                          ))}
                          {effectiveTalentRolls.length < maxTalentRolls && (
                            <div className="flex items-center gap-3">
                              <Button type="button" onClick={rollTalent}>Roll talent (2d6)</Button>
                              {/* Only shown once there's a second roll to
                                * explain (Human's Ambitious bonus) — a
                                * single-roll class needs no extra label. */}
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
                          <div className="mt-4 border-t border-line-soft pt-4">
                            <p className={cx(text.label, 'mb-2 text-ink-faint')}>
                              Known spells (choose {klass.spellcasting.knownAtLevel1}, using your {klass.spellcasting.ability.toUpperCase()})
                            </p>
                            {klass.spellcasting.spellList ? (
                              // Two-column table, not boxed rows (2026-08-22,
                              // owner: reference screenshot of a term/
                              // definition table — bold left-column term,
                              // regular-weight right-column description,
                              // thin divider lines — "something like
                              // this"). Superseded the prior per-row
                              // bordered-button treatment: each spell is
                              // now name | description in aligned columns
                              // with a `border-b border-line-soft` divider
                              // between rows (same divider convention the
                              // class-list pane above already uses), name
                              // always full `text.body` weight regardless
                              // of selection (per the earlier "better
                              // indication" fix — the row's own state
                              // shouldn't dim the name) and description
                              // one step dimmer at `text-ink-faint`.
                              //
                              // The reference is a static table with no
                              // selection affordance, but this list stays
                              // a functional tap-to-choose picker — so a
                              // small leading dot (outline → filled purple)
                              // carries "selected" instead of a border/
                              // background box, keeping the table's clean
                              // look while the picker still reads clearly.
                              <div className="flex flex-col">
                                {klass.spellcasting.spellList.map((spell) => {
                                  const selected = knownSpells.includes(spell.name)
                                  const atLimit = knownSpells.length >= klass.spellcasting!.knownAtLevel1
                                  return (
                                    <button
                                      key={spell.name}
                                      type="button"
                                      disabled={!selected && atLimit}
                                      onClick={() => toggleSpell(spell.name)}
                                      className="grid grid-cols-[0.9rem_6.5rem_1fr] items-baseline gap-x-4 border-b border-line-soft py-4 text-left last:border-b-0 disabled:pointer-events-none disabled:opacity-40 sm:grid-cols-[0.9rem_8rem_1fr] sm:gap-x-6"
                                    >
                                      <span
                                        aria-hidden="true"
                                        className={cx(
                                          'h-2.5 w-2.5 shrink-0 self-center rounded-full border',
                                          selected ? 'border-purple bg-purple' : 'border-line-soft bg-transparent',
                                        )}
                                      />
                                      <span className={cx(text.body, 'font-semibold')}>{spell.name}</span>
                                      <span className="font-sans text-body leading-relaxed text-ink-faint text-pretty">{spell.description}</span>
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
                                    <span key={spellName} className={cx('font-sans text-body text-ink-dim', 'rounded-full border border-line-soft bg-panel px-3 py-1')}>{spellName}</span>
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
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {step === 'background' && (
        // Owner, overnight 2026-08-17/18 ("when you roll you dont know
        // if it selected something and then the second part is always
        // hidden... layout could be better") — two real bugs, not one:
        //
        // 1. No selected state. Rolling (or clicking) an entry below
        //    only ever wrote into `backgroundText`; none of the option
        //    buttons ever reflected which one — if any — matched it.
        //    Every option always looked identically unselected, roll
        //    or no roll. Fixed by comparing each entry's
        //    `${name}. ${detail}` against `backgroundText` and applying
        //    the same `cardSelected` treatment (border-purple bg-purple/10)
        //    every other choice card in this wizard already uses —
        //    Alignment and Deity right below both already did this;
        //    Background was the one card style that never got it.
        //
        // 2. The readout was buried. Each background table has a full
        //    20-entry d20 grid (`lib/rules/shadowdark.ts`) — 10 rows at
        //    sm:grid-cols-2. The `TextInput` showing what your roll (or
        //    click) actually produced sat BELOW that entire grid, so on
        //    most screens confirming a roll meant scrolling past ~10
        //    rows of options to find it — "the second part is always
        //    hidden" was literal, not a figure of speech. Moved the
        //    TextInput up to sit directly under the Roll button, so the
        //    result is visible the instant you roll with zero
        //    scrolling. The full option grid stays below for browsing,
        //    now in its own `max-h-64 overflow-y-auto` panel so a
        //    20-entry table can't push Alignment/Deity off-screen the
        //    way it could when it rendered at full natural height.
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
            <TextInput label="Background" value={backgroundText} onChange={(e) => setBackgroundText(e.target.value)} className="mb-3" />
            <p className={cx(text.label, 'mb-2 text-ink-faint')}>Browse all</p>
            <div className="mb-3 grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto rounded-[10px] border border-line-soft bg-bg/40 p-1.5 sm:grid-cols-2">
              {backgroundTable?.entries.map((entry) => {
                const isSelected = backgroundText === `${entry.name}. ${entry.detail}`
                return (
                  <button
                    key={entry.roll}
                    type="button"
                    onClick={() => pickBackgroundEntry(entry.name, entry.detail)}
                    className={cx(
                      'rounded-[8px] border px-2.5 py-1.5 text-left',
                      isSelected ? 'border-purple bg-purple/10' : 'border-line-soft bg-panel2 hover:border-line-hover',
                    )}
                  >
                    <span className={cx(text.caption, 'font-semibold')}>{entry.name}.</span>{' '}
                    <span className={cx(text.caption, 'text-ink-faint')}>{entry.detail}</span>
                  </button>
                )
              })}
            </div>
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

      </div>

      {/* Real footer row — see the breadcrumb row's comment above. */}
      <div className="flex shrink-0 items-center justify-between border-t border-line-soft px-4 py-4 sm:px-6">
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
    {/* A true fixed-position popup rather than a banner inside the
      * builder's own scrolling middle column (what this replaced,
      * 2026-08-17): that inline banner rendered at the TOP of the
      * scroll container, so hitting close while scrolled deep into a
      * step (e.g. Gear) left it off-screen above the viewport — "the
      * discard notification is hidden until i scroll and find it".
      * Rendered as a sibling AFTER </Overlay> (not nested inside it) so
      * it's a later paint at the same z-50 stacking level and always
      * wins, centered over the whole screen regardless of the
      * builder's scroll position. */}
    {confirmingClose && (
      <Modal
        title="Discard this character?"
        onCancel={() => setConfirmingClose(false)}
        onConfirm={handleClose}
        cancelLabel="Keep editing"
        confirmLabel="Discard"
      >
        Nothing is saved until you click Create.
      </Modal>
    )}
    </>
  )
}
