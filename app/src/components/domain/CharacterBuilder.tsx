import { useMemo, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { ErrorBanner } from '../ui/ErrorBanner'
import { GearSlotGrid } from './GearSlotGrid'
import { createCharacter } from '../../lib/characters'
import type { Character, CharacterAbilities, CharacterSheetData, AbilityScore } from '../../lib/characters'
import { getRulesModule, abilityModifier, ABILITY_ORDER } from '../../lib/rules'
import type { Ability, RulesClass, RulesTalentTableRow } from '../../lib/rules'

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
  onCreated: (character: Character) => void
}

type StepKey = 'level' | 'stats' | 'ancestry' | 'class' | 'background' | 'gear' | 'review'

const PALETTE = ['#9b5cff', '#39ff8f', '#ff3b52', '#ffd23f', '#ff8a3d', '#ff3fd6', '#35f0ff']

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

const SOURCE_BADGE: Record<RulesClass['source'], string> = {
  Core: 'border-cyan/35 text-cyan',
  Diablerie: 'border-orange/35 text-orange',
  'Red Sands': 'border-orange/35 text-orange',
  'Midnight Sun': 'border-orange/35 text-orange',
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
 * Deliberately does NOT model a priced gear shop — no item-price table
 * exists anywhere in this project (Gear, pg. 34, lists items without a
 * price list this app has transcribed), so starting gold is rolled and
 * shown as a number the player self-tracks, and equipment is a plain
 * freeform add/remove list, the exact same shape `sheet.equipment`
 * (and `CharacterCommands`' own "Add item" control) already use.
 */
export function CharacterBuilder({ open, onClose, campaignId, system, sessionId, onCreated }: CharacterBuilderProps) {
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

  function goNext() {
    if (stepIndex < steps.length - 1) setStep(steps[stepIndex + 1])
  }
  function goBack() {
    if (stepIndex > 0) setStep(steps[stepIndex - 1])
  }

  const canContinue: Record<StepKey, boolean> = {
    level: name.trim() !== '',
    stats: statsFilled,
    ancestry: ancestryKey !== null,
    class: klass !== null,
    background: backgroundText.trim() !== '' && alignmentKey !== null && (!klass?.requiresDeity || deityName !== null),
    gear: true,
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
      onClose={handleClose}
      width="wide"
      tall
      header={
        <div className="min-w-0">
          <h2 className={cx(text.h2, 'truncate')}>New Character</h2>
          <p className={cx(text.caption, 'mt-1 text-ink-faint')}>{module.label} · Step {stepIndex + 1} of {steps.length}</p>
        </div>
      }
    >
      <div className="flex flex-wrap gap-1.5 pb-4">
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
                  className={cx('h-8 w-8 rounded-full border-2', color === hex ? 'border-ink' : 'border-transparent')}
                  style={{ backgroundColor: hex }}
                />
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
            <Button type="button" variant="ghost" onClick={rollAllStats}>Roll All</Button>
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
                <Button type="button" variant="ghost" className="ml-auto" onClick={() => rollOneStat(ability)}>Roll</Button>
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
                    <Button type="button" variant="ghost" onClick={rollTalent}>Roll talent (2d6)</Button>
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
                          <span key={spellName} className={cx(text.caption, 'rounded-full border border-line-soft bg-panel px-3 py-1')}>
                            {spellName}
                          </span>
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
              <Button type="button" variant="ghost" onClick={rollBackground}>Roll (d20)</Button>
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
              <div className="mb-2 flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={rollZeroLevelGear}>Roll starting gear ({module.zeroLevelGear.rollCount})</Button>
                {goldRolled && <span className={cx(text.caption, 'text-ink-faint')}>Rerolling replaces the list below.</span>}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={rollGold}>Roll starting gold ({module.firstLevelGoldFormula})</Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <TextInput label="GP" inputMode="numeric" value={gold.gp} onChange={(e) => setGold((g) => ({ ...g, gp: e.target.value }))} className="w-24" />
                <TextInput label="SP" inputMode="numeric" value={gold.sp} onChange={(e) => setGold((g) => ({ ...g, sp: e.target.value }))} className="w-24" />
                <TextInput label="CP" inputMode="numeric" value={gold.cp} onChange={(e) => setGold((g) => ({ ...g, cp: e.target.value }))} className="w-24" />
              </div>
              <p className={cx(text.caption, 'mt-2 text-ink-faint')}>
                No priced gear catalog exists in this app yet — spend the gold above however you like and add the items
                you bought to the list below.
              </p>
            </div>
          )}

          <div>
            <p className={cx(text.label, 'mb-2 text-ink-faint')}>
              Gear — carries up to {gearMax} items (10 or your Strength score, whichever is higher)
            </p>
            {equipment.length > 0 && <GearSlotGrid items={equipment} onRemove={removeGearItem} className="mb-2" />}
            <div className="flex items-end gap-2">
              <TextInput label="Add item" value={gearDraft} onChange={(e) => setGearDraft(e.target.value)} className="flex-1" />
              <Button type="button" variant="ghost" onClick={addGearItem}>Add</Button>
            </div>
          </div>
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
              <Button type="button" variant="ghost" onClick={rollHp}>{hpRoll === null ? 'Roll HP' : 'Reroll HP'}</Button>
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

      <div className="mt-6 flex items-center justify-between border-t border-line-soft pt-4">
        <Button type="button" variant="ghost" onClick={stepIndex === 0 ? handleClose : goBack}>
          {stepIndex === 0 ? 'Cancel' : '← Back'}
        </Button>
        {step === 'review' ? (
          <Button type="button" disabled={saving} onClick={() => void handleCreate()}>
            {saving ? 'Creating…' : 'Create Character'}
          </Button>
        ) : (
          <Button type="button" disabled={!canContinue[step]} onClick={goNext}>
            Continue →
          </Button>
        )}
      </div>
    </Overlay>
  )
}
