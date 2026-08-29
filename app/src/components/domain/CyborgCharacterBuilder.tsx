import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { ErrorBanner } from '../ui/ErrorBanner'
import { Shop } from './Shop'
import { createCharacter, adjustCharacterLuck } from '../../lib/characters'
import type { Character, CyborgCharacterAbilities, CharacterSheetData, AbilityScore } from '../../lib/characters'
import {
  CYBORG_ABILITY_ORDER,
  CYBORG_ABILITY_INFO,
  CYBORG_DR_TABLE,
  CYBORG_CLASSES,
  CYBORG_DEBT,
  CYBORG_GLITCH_USES,
  CYBORG_UNIVERSAL_START,
  CYBORG_RANDOM_GEAR,
  scoreForRoll,
  getCyborgClass,
} from '../../lib/rules/cyborg'
import type { CyborgAbility, CyborgClass } from '../../lib/rules/cyborg'
import {
  CYBORG_STYLE,
  CYBORG_FEATURE,
  CYBORG_OBSESSION,
  CYBORG_QUIRK,
  CYBORG_WANTS,
  CYBORG_STARTING_WEAPONS,
  CYBORG_CORPKILLER_WEAPONS,
  CYBORG_CYBERSLASHER_WEAPONS,
  CYBORG_ARMOR_TIERS,
  pairedIndexForD100,
} from '../../lib/rules/cyborgTraits'
import { goldDeltaForSpend, goldToCp } from '../../lib/rules/equipment'
import { CYBORG_EQUIPMENT } from '../../lib/rules/cyborgEquipment'

interface CyborgCharacterBuilderProps {
  open: boolean
  onClose: () => void
  campaignId: string
  sessionId: string | null
  memberId: string | null
  onCreated: (character: Character) => void
}

type Step = 'class' | 'abilities' | 'gear' | 'flavor' | 'debt' | 'glitches' | 'review'
const STEPS: Step[] = ['class', 'abilities', 'gear', 'flavor', 'debt', 'glitches', 'review']
const STEP_LABEL: Record<Step, string> = {
  class: 'Class',
  abilities: 'Abilities',
  gear: 'Gear',
  flavor: 'Flavor',
  debt: 'Debt',
  glitches: 'Glitches',
  review: 'Review',
}

const PALETTE = ['#9b5cff', '#39ff8f', '#ff3b52', '#ffd23f', '#ff8a3d', '#ff3fd6', '#35f0ff']
const ROLL_NEEDED_RING = 'ring-2 ring-orange/60 ring-offset-2 ring-offset-bg'
const cardBase = 'rounded-[12px] border border-line-soft bg-panel2 p-5 text-left transition-colors hover:border-line-hover'
const cardSelected = 'border-purple bg-purple/10'

function rollDie(sides: number): number {
  return 1 + Math.floor(Math.random() * sides)
}

function roll3d6Sum(): number {
  return rollDie(6) + rollDie(6) + rollDie(6)
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/** Parses a class's own printed armor-roll formula ('d2', 'd4+1') and
 * rolls it, capped to the highest real tier in `CYBORG_ARMOR_TIERS` (a
 * literal 'd4+1' can roll a 5, which isn't a printed tier — Discharged
 * CorpKiller's own text doesn't address this edge case, so this caps
 * rather than silently producing an out-of-range tier). */
function rollDiceFormula(formula: string, maxTier: number): number {
  const match = /^d(\d+)([+-]\d+)?$/.exec(formula.trim())
  if (!match) return 0
  const die = Number(match[1])
  const bonus = match[2] ? Number(match[2]) : 0
  return Math.min(maxTier, Math.max(0, rollDie(die) + bonus))
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

/**
 * CY_BORG's own creation wizard — a sibling to `CharacterBuilder.tsx`,
 * not a branch inside it (owner, 2026-08-26 AskUserQuestion: "Give
 * CY_BORG its own separate types + wizard branch"). `CharacterBuilder`
 * is built floor-to-ceiling around `RulesModule`'s Shadowdark shape
 * (six str/dex/con/int/wis/cha abilities with a score+modifier split,
 * ancestries, alignment, deities); CY_BORG's five −3..+3 abilities,
 * Debt, and Glitches don't fit that interface without either lying
 * about what its fields mean or growing it into a blob that fits
 * neither system well. This file is the CY_BORG-shaped equivalent,
 * reading from `lib/rules/cyborg.ts` instead of `lib/rules/`.
 *
 * Step order follows the book's own "Make a Punk" flowchart (p.39)
 * rather than inventing one: pick/roll abilities (a class's own reroll
 * bonuses apply once a class is picked, so Class comes first here),
 * randomize your stuff, roll for flavor (features/style/obsession,
 * p.54-57 — kept as free text; those d100/d20 tables aren't transcribed
 * into this app yet, see claude/cyborg-class-roster-grounded.md), roll
 * debt, roll Glitches, roll HP. HP itself lives on the Review step
 * rather than being its own step, matching `CharacterBuilder`'s own
 * established pattern (`setCharacterHpMax`'s doc comment: "Roll HP" is
 * an optional Review-step button, nothing gates Create on having
 * clicked it).
 */
export function CyborgCharacterBuilder({ open, onClose, campaignId, sessionId, memberId, onCreated }: CyborgCharacterBuilderProps) {
  const [step, setStep] = useState<Step>('class')
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [classKey, setClassKey] = useState<string | null>(null)
  const [abilityRolls, setAbilityRolls] = useState<Partial<Record<CyborgAbility, number>>>({})
  const [money, setMoney] = useState('')
  const [moneyRolled, setMoneyRolled] = useState(false)
  const [personalItem, setPersonalItem] = useState<string | null>(null)
  const [randomGear, setRandomGear] = useState<string | null>(null)
  const [techOrDrug, setTechOrDrug] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string[]>([])
  const [styleRoll, setStyleRoll] = useState<string | null>(null)
  const [featureRoll, setFeatureRoll] = useState<string | null>(null)
  const [obsessionRoll, setObsessionRoll] = useState<string | null>(null)
  const [wantsRoll, setWantsRoll] = useState<string | null>(null)
  const [quirkRoll, setQuirkRoll] = useState<string | null>(null)
  const [weaponRoll, setWeaponRoll] = useState<{ name: string; damage: string; note?: string } | null>(null)
  const [armorTier, setArmorTier] = useState<number | null>(null)
  const [flavorText, setFlavorText] = useState('')
  const [debtCreditor, setDebtCreditor] = useState<string | null>(null)
  const [debtAmount, setDebtAmount] = useState<number | null>(null)
  const [glitchesMax, setGlitchesMax] = useState<number | null>(null)
  const [hpRoll, setHpRoll] = useState<number | null>(null)
  const [status, setStatus] = useState<'active' | 'awaiting'>('active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingClose, setConfirmingClose] = useState(false)

  const klass: CyborgClass | null = getCyborgClass(classKey)
  const stepIndex = STEPS.indexOf(step)

  function modifierFor(ability: CyborgAbility): number {
    if (!klass) return 0
    return klass.abilityRerolls.filter((r) => r.ability === ability).reduce((total, r) => total + r.modifier, 0)
  }

  function scoreFor(ability: CyborgAbility): number | null {
    const rollTotal = abilityRolls[ability]
    if (rollTotal === undefined) return null
    return scoreForRoll(rollTotal + modifierFor(ability))
  }

  function rollAbility(ability: CyborgAbility) {
    setAbilityRolls((prev) => ({ ...prev, [ability]: roll3d6Sum() }))
  }

  function rollAllAbilities() {
    const next: Partial<Record<CyborgAbility, number>> = {}
    for (const ability of CYBORG_ABILITY_ORDER) next[ability] = roll3d6Sum()
    setAbilityRolls(next)
  }

  const abilitiesFilled = CYBORG_ABILITY_ORDER.every((a) => abilityRolls[a] !== undefined)
  const toughnessScore = scoreFor('toughness') ?? 0

  const goldCp = goldToCp({ gp: money })

  // `goldDeltaForSpend` returns a DELTA to add to the current balance,
  // not the new balance itself — matching `CharacterBuilder.tsx`'s own
  // `applyGoldDeltaCp` exactly (see that function's doc comment for why
  // it re-normalizes the whole balance on every purchase rather than
  // subtracting from just the one `gp` field in isolation).
  function applyGoldDeltaCp(deltaCp: number) {
    setMoney((current) => String((Number(current) || 0) + goldDeltaForSpend({ gp: current }, deltaCp).gp))
  }

  function handleBuy(item: (typeof CYBORG_EQUIPMENT)[number]) {
    applyGoldDeltaCp(-item.costCp)
    setEquipment((prev) => [...prev, item.name])
  }

  function handleReturn(item: (typeof CYBORG_EQUIPMENT)[number]) {
    const idx = equipment.lastIndexOf(item.name)
    if (idx === -1) return
    applyGoldDeltaCp(item.costCp)
    setEquipment((prev) => prev.filter((_, i) => i !== idx))
  }

  function weaponTableFor(k: CyborgClass): { roll: number; name: string; damage: string; note?: string }[] {
    if (k.weaponTable === 'corpkiller') return CYBORG_CORPKILLER_WEAPONS
    if (k.weaponTable === 'cyberslasher') return CYBORG_CYBERSLASHER_WEAPONS
    const die = k.weaponRollDie ?? CYBORG_STARTING_WEAPONS.length
    return CYBORG_STARTING_WEAPONS.slice(0, die)
  }

  function rollWeapon() {
    if (!klass) return
    const table = weaponTableFor(klass)
    setWeaponRoll(pick(table))
  }

  function rollArmor() {
    if (!klass?.armorRollFormula) return
    const tier = rollDiceFormula(klass.armorRollFormula, CYBORG_ARMOR_TIERS.length - 1)
    setArmorTier(tier)
  }

  function rollDebt() {
    setDebtCreditor(pick(CYBORG_DEBT.creditors))
    setDebtAmount((rollDie(6) + rollDie(6) + rollDie(6)) * 1000)
  }

  function rollGlitches() {
    if (!klass) return
    setGlitchesMax(rollDie(klass.glitchesDie))
  }

  function rollHp() {
    if (!klass) return
    setHpRoll(rollDie(klass.hpDie))
  }

  const computedHpMax = klass ? Math.max(1, (hpRoll ?? 0) + toughnessScore) : 0

  const canContinue: Record<Step, boolean> = {
    class: klass !== null,
    abilities: abilitiesFilled,
    gear: moneyRolled || money.trim() !== '',
    flavor: true,
    debt: debtCreditor !== null && debtAmount !== null,
    glitches: glitchesMax !== null,
    review: true,
  }

  function resetAll() {
    setStep('class')
    setName('')
    setColor(PALETTE[0])
    setClassKey(null)
    setAbilityRolls({})
    setMoney('')
    setMoneyRolled(false)
    setPersonalItem(null)
    setRandomGear(null)
    setTechOrDrug(null)
    setEquipment([])
    setStyleRoll(null)
    setFeatureRoll(null)
    setObsessionRoll(null)
    setWantsRoll(null)
    setQuirkRoll(null)
    setWeaponRoll(null)
    setArmorTier(null)
    setFlavorText('')
    setDebtCreditor(null)
    setDebtAmount(null)
    setGlitchesMax(null)
    setHpRoll(null)
    setStatus('active')
    setError(null)
    setConfirmingClose(false)
  }

  function goNext() {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1])
  }
  function goBack() {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1])
  }

  function requestClose() {
    if (name.trim() !== '' || classKey !== null || stepIndex > 0) {
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
    if (!klass) return
    setSaving(true)
    setError(null)
    try {
      const abilities: CyborgCharacterAbilities = {}
      for (const ability of CYBORG_ABILITY_ORDER) {
        const score = scoreFor(ability) ?? 0
        const entry: AbilityScore = { score, mod: score }
        abilities[ability] = entry
      }

      const weaponItem = weaponRoll ? `${weaponRoll.name} (${weaponRoll.damage})${weaponRoll.note ? ` — ${weaponRoll.note}` : ''}` : null
      const armorItem = armorTier !== null && armorTier > 0 ? `${CYBORG_ARMOR_TIERS[armorTier].name} (${CYBORG_ARMOR_TIERS[armorTier].reduction})` : null

      const startingItems = [
        ...CYBORG_UNIVERSAL_START.items,
        ...(weaponItem ? [weaponItem] : []),
        ...(armorItem ? [armorItem] : []),
        ...(personalItem ? [personalItem] : []),
        ...(randomGear ? [randomGear] : []),
        ...(techOrDrug ? [techOrDrug] : []),
        ...equipment,
      ]

      const traits = [
        styleRoll ? `Style: ${styleRoll}` : null,
        featureRoll ? `Feature: ${featureRoll}` : null,
        obsessionRoll ? `Current Obsession: ${obsessionRoll}` : null,
        wantsRoll ? `Wants: ${wantsRoll}` : null,
        quirkRoll ? `Quirk: ${quirkRoll}` : null,
      ].filter((t): t is string => t !== null)

      const appearance = [traits.join(' · '), flavorText.trim()].filter(Boolean).join('\n\n')

      const sheet: CharacterSheetData = {
        attacks_talents: [klass.gearGrant, ...(klass.gearRollNote ? [klass.gearRollNote] : [])].filter(Boolean),
        equipment: startingItems,
        appearance: appearance || undefined,
        debt: debtCreditor && debtAmount ? `${debtAmount.toLocaleString()}¤ owed to: ${debtCreditor}` : undefined,
      }

      const created = await createCharacter({
        campaignId,
        name: name.trim(),
        classTitle: klass.name,
        hpMax: Math.max(1, computedHpMax),
        // CY_BORG has no AC formula to compute — armor is a flat per-hit
        // damage reduction die (cyborgEquipment.ts's own "ARMOR — tiers,
        // not AC" comment), not a single defense number the way
        // Shadowdark's `10 + DEX mod` is. `characters.ac` is a required
        // plain number column regardless of system, so this starts at 0
        // (no armor) rather than fabricating a meaningless target
        // number; `CYBORG_DISPLAY.acLabel` relabels the sheet tile
        // "Armor" but a player's actual damage reduction lives in their
        // equipment list, not this column.
        ac: 0,
        level: 1,
        memberId,
        background: flavorText.trim() || null,
        gold: { gp: Number(money) || 0 },
        abilities,
        sheet,
        status,
        color,
        sessionId,
      })

      // Glitches piggyback on `luck_tokens` — `CYBORG_DISPLAY.luckLabel`
      // in `lib/rules/index.ts` already relabels that column "Glitches"
      // for this system, matching how CharacterSheet reads it. The
      // create_character RPC doesn't take luck as a param (it's set
      // post-creation everywhere else in this app too — see
      // `adjustCharacterLuck`), so this is a second write rather than a
      // creation-time one. A failure here isn't worth blocking the whole
      // character on — the row already exists with the right class/
      // abilities/HP; the GM can adjust Glitches by hand same as any
      // other in-play luck change.
      const finalCharacter =
        glitchesMax !== null && glitchesMax !== created.luck_tokens
          ? await adjustCharacterLuck(created.id, glitchesMax - created.luck_tokens, sessionId).catch(() => created)
          : created

      onCreated(finalCharacter)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the character.')
    } finally {
      setSaving(false)
    }
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
            <p className={cx(text.caption, 'mt-1 text-ink-faint')}>CY_BORG · Step {stepIndex + 1} of {STEPS.length}</p>
          </div>
        }
      >
        <div className="flex items-center gap-1 overflow-x-auto border-b border-line-soft px-4 py-2 sm:px-6">
          {STEPS.map((key, index) => (
            <div key={key} className={cx('flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1', text.caption, index === stepIndex ? 'bg-purple/15 text-purple' : index < stepIndex ? 'text-ink-dim' : 'text-ink-faint')}>
              <span>{index + 1}</span>
              <span className={cx(index !== stepIndex && 'hidden sm:inline')}> {STEP_LABEL[key]}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {error && <ErrorBanner className="mb-4">{error}</ErrorBanner>}

          {step === 'class' && (
            <div className="flex flex-col gap-4">
              <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your handle" />
              <div>
                <p className={cx(text.label, 'mb-2 text-ink-faint')}>Class</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CYBORG_CLASSES.map((c) => (
                    <button key={c.key} type="button" onClick={() => setClassKey(c.key)} className={cx(cardBase, classKey === c.key && cardSelected)}>
                      <p className="font-semibold text-ink">{c.name}</p>
                      <p className={cx(text.bodySecondary, 'mt-1')}>{c.blurb}</p>
                      <p className={cx(text.caption, 'mt-2 text-ink-faint')}>HP {c.hpFormula} · d{c.glitchesDie} Glitches</p>
                    </button>
                  ))}
                </div>
              </div>
              {klass && (
                <div className={cardBase}>
                  <p className={cx(text.label, 'text-ink-faint')}>What {klass.name} grants</p>
                  <p className={cx(text.bodySecondary, 'mt-1')}>{klass.gearGrant}</p>
                  {klass.gearRollNote && <p className={cx(text.caption, 'mt-2 text-ink-faint')}>{klass.gearRollNote}</p>}
                  {klass.levelFeatures && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {klass.levelFeatures.map((f) => (
                        <p key={f.tier} className={text.caption}>
                          <span className="font-semibold text-ink">{f.tier}. {f.name}.</span> <span className="text-ink-faint">{f.effect}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'abilities' && klass && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Button type="button" onClick={rollAllAbilities} className={cx(!abilitiesFilled && ROLL_NEEDED_RING)}>Roll All (3d6)</Button>
                <span className={cx(text.caption, 'text-ink-faint')}>DR: {CYBORG_DR_TABLE.map((d) => `${d.dr} ${d.label}`).join(' · ')}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CYBORG_ABILITY_ORDER.map((ability) => {
                  const info = CYBORG_ABILITY_INFO[ability]
                  const mod = modifierFor(ability)
                  const reroll = klass.abilityRerolls.find((r) => r.ability === ability)
                  const score = scoreFor(ability)
                  return (
                    <div key={ability} className={cardBase}>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-ink">{info.label}</p>
                        <button type="button" onClick={() => rollAbility(ability)} className="rounded-[8px] border border-line-soft bg-panel px-2.5 py-1 text-ink-dim hover:border-line-hover">
                          <span className={text.caption}>Roll 3d6{mod !== 0 ? formatSigned(mod) : ''}</span>
                        </button>
                      </div>
                      <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{info.tests}</p>
                      {reroll?.tag && <p className={cx(text.caption, 'mt-1 text-purple')}>{reroll.tag}</p>}
                      <p className={cx('mt-2 font-mono text-numeric font-semibold tabular-nums', score === null ? 'text-ink-faint' : score >= 0 ? 'text-green' : 'text-red')}>
                        {score === null ? '—' : formatSigned(score)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'gear' && klass && (
            <div className="flex flex-col gap-5">
              <div>
                <p className={cx(text.label, 'mb-2 text-ink-faint')}>Starting money ({CYBORG_UNIVERSAL_START.money})</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setMoney(String((rollDie(6) + rollDie(6)) * 10))
                      setMoneyRolled(true)
                    }}
                    className={cx(!canContinue.gear && ROLL_NEEDED_RING)}
                  >
                    Roll (2d6×10¤)
                  </Button>
                  <TextInput value={money} onChange={(e) => setMoney(e.target.value)} placeholder="¤" className="w-32" />
                </div>
                <p className={cx(text.caption, 'mt-2 text-ink-faint')}>Everyone also starts with: {CYBORG_UNIVERSAL_START.items.join(' ')}</p>
              </div>

              {(klass.weaponRollDie !== undefined || klass.weaponTable !== undefined || klass.armorRollFormula !== undefined) && (
                <div>
                  <p className={cx(text.label, 'mb-2 text-ink-faint')}>Class weapon &amp; armor</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(klass.weaponRollDie !== undefined || klass.weaponTable !== undefined) && (
                      <div className={cardBase}>
                        <div className="flex items-center justify-between">
                          <p className={cx(text.label, 'text-ink-faint')}>Weapon (d{klass.weaponTable ? 6 : klass.weaponRollDie})</p>
                          <button type="button" onClick={rollWeapon} className="rounded-[8px] border border-line-soft bg-panel px-2 py-1 text-ink-dim hover:border-line-hover">
                            <span className={text.caption}>Roll</span>
                          </button>
                        </div>
                        {weaponRoll ? (
                          <>
                            <p className={cx(text.bodySecondary, 'mt-2 font-semibold text-ink')}>{weaponRoll.name} <span className="font-mono text-ink-dim">{weaponRoll.damage}</span></p>
                            {weaponRoll.note && <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{weaponRoll.note}</p>}
                          </>
                        ) : (
                          <p className={cx(text.bodySecondary, 'mt-2 text-ink-faint')}>—</p>
                        )}
                      </div>
                    )}
                    {klass.armorRollFormula !== undefined && (
                      <div className={cardBase}>
                        <div className="flex items-center justify-between">
                          <p className={cx(text.label, 'text-ink-faint')}>Armor ({klass.armorRollFormula})</p>
                          <button type="button" onClick={rollArmor} className="rounded-[8px] border border-line-soft bg-panel px-2 py-1 text-ink-dim hover:border-line-hover">
                            <span className={text.caption}>Roll</span>
                          </button>
                        </div>
                        {armorTier !== null ? (
                          <>
                            <p className={cx(text.bodySecondary, 'mt-2 font-semibold text-ink')}>
                              {CYBORG_ARMOR_TIERS[armorTier].name} <span className="font-mono text-ink-dim">{CYBORG_ARMOR_TIERS[armorTier].reduction}</span>
                            </p>
                            {CYBORG_ARMOR_TIERS[armorTier].note && <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{CYBORG_ARMOR_TIERS[armorTier].note}</p>}
                          </>
                        ) : (
                          <p className={cx(text.bodySecondary, 'mt-2 text-ink-faint')}>—</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className={cx(text.label, 'mb-2 text-ink-faint')}>Randomize your stuff — roll once on each table</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      { label: 'Personal item (d8)', value: personalItem, set: setPersonalItem, table: CYBORG_RANDOM_GEAR.personalItem },
                      { label: 'Gear (d12)', value: randomGear, set: setRandomGear, table: CYBORG_RANDOM_GEAR.gear },
                      { label: 'Tech/drug (d12)', value: techOrDrug, set: setTechOrDrug, table: CYBORG_RANDOM_GEAR.techOrDrug },
                    ] as const
                  ).map((col) => (
                    <div key={col.label} className={cardBase}>
                      <div className="flex items-center justify-between">
                        <p className={cx(text.label, 'text-ink-faint')}>{col.label}</p>
                        <button type="button" onClick={() => col.set(pick(col.table))} className="rounded-[8px] border border-line-soft bg-panel px-2 py-1 text-ink-dim hover:border-line-hover">
                          <span className={text.caption}>Roll</span>
                        </button>
                      </div>
                      <p className={cx(text.bodySecondary, 'mt-2')}>{col.value ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className={cx(text.label, 'mb-2 text-ink-faint')}>Shop</p>
                <Shop items={CYBORG_EQUIPMENT} goldCp={goldCp} owned={equipment} onBuy={handleBuy} onReturn={handleReturn} currency="credits" />
              </div>
            </div>
          )}

          {step === 'flavor' && klass && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    { label: 'Style (d100)', value: styleRoll, roll: () => setStyleRoll(CYBORG_STYLE[pairedIndexForD100(rollDie(100))]) },
                    { label: 'Feature (d100)', value: featureRoll, roll: () => setFeatureRoll(CYBORG_FEATURE[pairedIndexForD100(rollDie(100))]) },
                    { label: 'Current Obsession (d100)', value: obsessionRoll, roll: () => setObsessionRoll(CYBORG_OBSESSION[pairedIndexForD100(rollDie(100))]) },
                    { label: 'Wants (d20)', value: wantsRoll, roll: () => setWantsRoll(pick(CYBORG_WANTS)) },
                    { label: 'Quirk (d20)', value: quirkRoll, roll: () => setQuirkRoll(pick(CYBORG_QUIRK)) },
                  ] as const
                ).map((row) => (
                  <div key={row.label} className={cardBase}>
                    <div className="flex items-center justify-between">
                      <p className={cx(text.label, 'text-ink-faint')}>{row.label}</p>
                      <button type="button" onClick={row.roll} className="rounded-[8px] border border-line-soft bg-panel px-2 py-1 text-ink-dim hover:border-line-hover">
                        <span className={text.caption}>Roll</span>
                      </button>
                    </div>
                    <p className={cx(text.bodySecondary, 'mt-2')}>{row.value ?? '—'}</p>
                  </div>
                ))}
              </div>
              {klass.flavorPrompts.map((prompt, i) => (
                <p key={i} className={cx(text.caption, 'text-ink-faint')}>{prompt}</p>
              ))}
              <TextInput
                label="Backstory, appearance, whatever else fits"
                value={flavorText}
                onChange={(e) => setFlavorText(e.target.value)}
                placeholder="Grew up in Bigmosse running debt for the Virid Vipers."
              />
            </div>
          )}

          {step === 'debt' && (
            <div className="flex flex-col gap-4">
              <Button type="button" onClick={rollDebt} className={cx(!canContinue.debt && ROLL_NEEDED_RING)}>Roll debt ({CYBORG_DEBT.formula})</Button>
              {debtCreditor && debtAmount && (
                <div className={cardBase}>
                  <p className="font-semibold text-ink">{debtAmount.toLocaleString()}¤</p>
                  <p className={cx(text.bodySecondary, 'mt-1')}>{debtCreditor}</p>
                  <p className={cx(text.caption, 'mt-2 text-ink-faint')}>How badly do they want it back? {CYBORG_DEBT.wantItBack}</p>
                </div>
              )}
            </div>
          )}

          {step === 'glitches' && klass && (
            <div className="flex flex-col gap-4">
              <Button type="button" onClick={rollGlitches} className={cx(!canContinue.glitches && ROLL_NEEDED_RING)}>Roll Glitches (d{klass.glitchesDie})</Button>
              {glitchesMax !== null && (
                <div className={cardBase}>
                  <p className="font-semibold text-ink">{glitchesMax} Glitches</p>
                  <p className={cx(text.caption, 'mt-2 text-ink-faint')}>Spend a Glitch to:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {CYBORG_GLITCH_USES.map((use) => (
                      <li key={use} className={cx(text.bodySecondary, 'text-ink-dim')}>{use}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 'review' && klass && (
            <div className="flex flex-col gap-4">
              <div className={cardBase}>
                <p className={cx(text.h3)}>{name.trim() || 'Unnamed'}</p>
                <p className={cx(text.bodySecondary, 'text-ink-dim')}>{klass.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CYBORG_ABILITY_ORDER.map((a) => {
                    const score = scoreFor(a)
                    return (
                      <span key={a} className={cx(text.caption, 'rounded-full border border-line-soft bg-panel px-3 py-1')}>
                        {CYBORG_ABILITY_INFO[a].short} {score === null ? '—' : formatSigned(score)}
                      </span>
                    )
                  })}
                </div>
              </div>

              {(styleRoll || featureRoll || obsessionRoll || wantsRoll || quirkRoll || weaponRoll || (armorTier !== null && armorTier > 0)) && (
                <div className={cardBase}>
                  <p className={cx(text.label, 'text-ink-faint')}>Traits &amp; class gear</p>
                  <div className="mt-2 flex flex-col gap-1">
                    {styleRoll && <p className={text.bodySecondary}><span className="text-ink-faint">Style:</span> {styleRoll}</p>}
                    {featureRoll && <p className={text.bodySecondary}><span className="text-ink-faint">Feature:</span> {featureRoll}</p>}
                    {obsessionRoll && <p className={text.bodySecondary}><span className="text-ink-faint">Obsession:</span> {obsessionRoll}</p>}
                    {wantsRoll && <p className={text.bodySecondary}><span className="text-ink-faint">Wants:</span> {wantsRoll}</p>}
                    {quirkRoll && <p className={text.bodySecondary}><span className="text-ink-faint">Quirk:</span> {quirkRoll}</p>}
                    {weaponRoll && <p className={text.bodySecondary}><span className="text-ink-faint">Weapon:</span> {weaponRoll.name} ({weaponRoll.damage})</p>}
                    {armorTier !== null && armorTier > 0 && <p className={text.bodySecondary}><span className="text-ink-faint">Armor:</span> {CYBORG_ARMOR_TIERS[armorTier].name} ({CYBORG_ARMOR_TIERS[armorTier].reduction})</p>}
                  </div>
                </div>
              )}

              <div>
                <p className={cx(text.label, 'mb-2 text-ink-faint')}>Hit Points</p>
                <div className="flex items-center gap-3">
                  <Button type="button" onClick={rollHp} className={cx(hpRoll === null && ROLL_NEEDED_RING)}>Roll HP (d{klass.hpDie})</Button>
                  <span className={text.bodySecondary}>{hpRoll === null ? 'Not rolled yet' : `${hpRoll} + ${formatSigned(toughnessScore)} Toughness = ${computedHpMax} HP`}</span>
                </div>
              </div>

              <div>
                <p className={cx(text.label, 'mb-2 text-ink-faint')}>Color</p>
                <div className="flex gap-2">
                  {PALETTE.map((c) => (
                    <button key={c} type="button" onClick={() => setColor(c)} className={cx('h-8 w-8 rounded-full border-2', color === c ? 'border-ink' : 'border-transparent')} style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
                  ))}
                </div>
              </div>

              <div>
                <p className={cx(text.label, 'mb-2 text-ink-faint')}>Status</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStatus('active')} className={cx('rounded-[8px] border px-3 py-1.5', text.caption, status === 'active' ? 'border-purple bg-purple/10 text-purple' : 'border-line-soft text-ink-faint')}>Active</button>
                  <button type="button" onClick={() => setStatus('awaiting')} className={cx('rounded-[8px] border px-3 py-1.5', text.caption, status === 'awaiting' ? 'border-purple bg-purple/10 text-purple' : 'border-line-soft text-ink-faint')}>Awaiting a player</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line-soft px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" onClick={stepIndex === 0 ? requestClose : goBack}>
            {stepIndex === 0 ? 'Cancel' : '← Back'}
          </Button>
          {step === 'review' ? (
            <Button type="button" disabled={saving || !name.trim()} onClick={() => void handleCreate()}>
              {saving ? 'Creating…' : 'Create Character'}
            </Button>
          ) : (
            <Button type="button" disabled={!canContinue[step]} onClick={goNext}>Continue →</Button>
          )}
        </div>
      </Overlay>

      {confirmingClose && (
        <Modal
          title="Discard this character?"
          onCancel={() => setConfirmingClose(false)}
          onConfirm={() => {
            setConfirmingClose(false)
            handleClose()
          }}
          confirmLabel="Discard"
        >
          <p className={text.bodySecondary}>Your progress on this character will be lost.</p>
        </Modal>
      )}
    </>
  )
}
