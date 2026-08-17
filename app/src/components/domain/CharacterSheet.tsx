import { Fragment } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { TalentRow } from './TalentRow'
import { SpellCard } from './SpellCard'
import { CharacterCommands } from './CharacterCommands'
import { readCharacterAbilities, readCharacterGold, readCharacterSheet } from '../../lib/characters'
import { getSystemDisplay } from '../../lib/rules'
import type { AbilityScore, Character, CharacterAbilities, CharacterSheetData } from '../../lib/characters'

interface CharacterSheetProps {
  character: Character | null
  /** The campaign's currently open session, if any — passed straight
   * through to `CharacterCommands` (BUILD_PLAN.md slice 6). */
  sessionId: string | null
  /** The campaign's `system` — threaded to `CharacterCommands`' shop so
   * a CY_BORG sheet sells CY_BORG gear (2026-08-17). Optional with a
   * Shadowdark fallback downstream, same posture as every rules-module
   * read. */
  system?: string | null
  onClose: () => void
  /** Called with the row a `CharacterCommands` action's RPC returned —
   * the host screen (`JournalScreen`) echoes it into the party rail and
   * back into this open sheet. */
  onUpdate: (updated: Character) => void
}

const ABILITY_ORDER: Array<{ key: keyof CharacterAbilities; label: string }> = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
]

const DETAIL_FIELDS: Array<{ key: keyof CharacterSheetData; label: string }> = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'personal_revelation', label: 'Personal Revelation' },
  { key: 'covenant_duties', label: 'Covenant Duties' },
  { key: 'familiar', label: 'Familiar' },
]

function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`
}

function formatGold(gold: { gp?: number; sp?: number; cp?: number }): string {
  const parts: string[] = []
  if (gold.gp) parts.push(`${gold.gp} gp`)
  if (gold.sp) parts.push(`${gold.sp} sp`)
  if (gold.cp) parts.push(`${gold.cp} cp`)
  return parts.length > 0 ? parts.join(' ') : '0 gp'
}

function clampPct(current: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
}

// The mockup's `.sec-label` (mono, uppercase, purple) — composed
// directly rather than starting from `text.label` (which bakes in
// `text-ink-faint`) and overriding the color: both are Tailwind text-*
// color utilities targeting the same CSS property, so which one wins
// would depend on undocumented stylesheet-output order. Reusing just
// the font-size token (`text-label`, a distinct utility namespace from
// text color) avoids that risk entirely.
//
// Bug fix: the mockup's own `.sec-label` is 10px, which reads fine
// there because everything around it (rowline text, pills, spell rows)
// is also small (12.5-13.5px). Grimoire's real body copy is 16px
// (SPEC's mobile floor), so `text-label` (11px) rendered these section
// titles smaller than the content they're heading — the opposite of
// what a sub-head should do. Sized to `text-base` (16px, matching
// body) instead, with `font-semibold` added since Chivo Mono at that
// size otherwise reads thinner than the Instrument Sans body text next
// to it.
//
// Spacing above each label is `mt-12` (48px) — bumped twice now: 24px
// originally, then 32px, and still reading as barely-there once the
// `first:mt-0` bug above was fixed (that bug was zeroing the margin on
// every Details-block label, not just the sheet's true first section —
// the real cause of labels sitting almost flush against the content
// above them). 48px is the next step up on the closed
// 4/8/12/16/24/32/48/64 scale.
const sectionLabelClass = 'mt-12 mb-3 font-mono text-base font-semibold uppercase tracking-eyebrow text-purple first:mt-0'

function AbilityScoreTile({ label, score }: { label: string; score: AbilityScore }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-panel2 px-2.5 py-2 text-center">
      <p className={cx(text.label, 'text-ink-faint')}>{label}</p>
      <p className={cx(text.numeric, 'mt-1')}>{score.score}</p>
      {/* Color-coded per CharacterBuilder's own established rule
       * (`mod >= 0` -> green, else red — see its ability-score tiles):
       * `text.caption` deliberately doesn't bake in a color (see
       * typography.ts), so swapping it here is a plain, unconflicted
       * utility override, not a two-color-utility clash. */}
      <p className={cx(text.caption, score.mod >= 0 ? 'text-green' : 'text-red')}>{formatMod(score.mod)}</p>
    </div>
  )
}

/** One tile in the vitals strip (HP/AC/Gear/XP/Gold/Luck) — moved up
 * from being buried in the header's meta line (Gold/XP) or not shown
 * in the Sheet at all (HP/AC/Gear lived only on PlayerCard) into one
 * scannable row at the top of the overlay, per the reorganized
 * Character Sheet mockup review. `value` takes a pre-formatted string
 * for Gold ("20 gp 4 sp") and Luck ("1 token") since neither has a
 * single numeric "current" the way HP/Gear/XP do; those three pass a
 * bare number plus an optional `max` for the "5 / 5" pairing and the
 * progress bar. No bar at all when `barColorClass` is omitted (AC has
 * no max to show progress toward; Gold/Luck aren't a fill-toward-a-cap
 * kind of stat). */
function VitalTile({
  label,
  value,
  max,
  barPct,
  barColorClass,
  accentClass,
}: {
  label: string
  value: string | number
  max?: number
  barPct?: number
  barColorClass?: string
  accentClass?: string
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-panel2 px-3 py-2.5">
      <p className={cx(text.label, 'text-ink-faint')}>{label}</p>
      <p className={cx('mt-1 font-mono tabular-nums text-numeric font-semibold', accentClass ?? 'text-ink')}>
        {value}
        {max != null && <span className="ml-1 text-caption font-medium text-ink-dim">/ {max}</span>}
      </p>
      {barColorClass && (
        <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-line">
          <div className={cx('h-full rounded-full', barColorClass)} style={{ width: `${barPct ?? 0}%` }} />
        </div>
      )}
    </div>
  )
}

/**
 * Full character-sheet overlay content — the mockup's "Sheet" (abilities
 * grid, talents, languages, spells with ready/locked state, gear slots
 * with capacity math) — rendered inside the new `Overlay` primitive.
 * Composite of the smaller pieces BUILD_PLAN.md names for this slice:
 * an inline ability grid, `TalentRow`, `SpellCard`, `GearSlotGrid`.
 *
 * Every section is conditional on the real data actually having
 * something to show — no character has every field the schema allows
 * (only Kimbo has `covenant_duties`/`active_blessing`, only Kimbo and
 * LaLa have `spells`, only LaLa has `familiar`), and nothing here
 * fabricates a placeholder for an absent one.
 *
 * Reorganized 2026-08-11 per the mockup review: the header now carries
 * only the character's name (was also carrying a class/level/alignment
 * meta line, which read as crowded and was moved to its own row); a
 * new vitals strip (HP/AC/Gear/XP/Gold/Luck) surfaces the numbers that
 * used to be scattered (some in the old header meta line, some not
 * shown in the Sheet at all — only on PlayerCard) as one scannable row
 * up top; ability modifiers are now color-coded green/red, matching
 * CharacterBuilder's own established rule instead of a flat ink-dim.
 */
export function CharacterSheet({ character, sessionId, system, onClose, onUpdate }: CharacterSheetProps) {
  const open = character !== null
  const abilities = character ? readCharacterAbilities(character.abilities) : {}
  const sheet = character ? readCharacterSheet(character.sheet) : {}
  const gold = character ? readCharacterGold(character.gold) : {}
  // Per-system display language (owner: "separate games using same
  // interface") — see SystemDisplay's doc comment in lib/rules.
  const display = getSystemDisplay(system)
  // The cyborg abilities live under different keys than Shadowdark's
  // typed CharacterAbilities — read them generically for that branch.
  const rawAbilities = character ? ((character.abilities ?? {}) as Record<string, { score?: number; mod?: number }>) : {}

  const talents = sheet.attacks_talents ?? []
  const languages = sheet.languages ?? []
  const spells = sheet.spells ?? []
  const details = DETAIL_FIELDS.map((field) => ({ ...field, value: sheet[field.key] })).filter(
    (field) => field.value !== undefined,
  )

  return (
    <Overlay
      open={open}
      onClose={onClose}
      variant="slideUp"
      header={
        character && (
          <div className="min-w-0">
            <h2 className={cx(text.h2, 'truncate')}>{character.name}</h2>
          </div>
        )
      }
    >
      {character && (
        <div>
          {/* Identity bar: class/level/alignment, moved out of the
           * header meta line. `class_title` is stored as one opaque
           * string ("Human Knight of St. Ydris" — see lib/characters.ts'
           * CreateCharacterInput doc comment on why ancestry has no
           * column of its own), so it renders as a single segment here
           * rather than splitting "Human" from "Knight of St. Ydris" —
           * there's no delimiter in the data to split on safely. */}
          <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line-soft pb-4 font-mono text-caption text-ink-dim">
            <span className="font-semibold text-ink">{character.class_title}</span>
            {display.showProgression && (
              <>
                <span className="text-ink-faint">·</span>
                <span>
                  Level <span className="font-semibold text-ink">{character.level}</span>
                </span>
              </>
            )}
            {character.alignment_title && (
              <>
                <span className="text-ink-faint">·</span>
                <span>{character.alignment_title}</span>
              </>
            )}
          </div>

          {/* Vitals strip */}
          <div className="mb-7 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            <VitalTile
              label="HP"
              value={character.hp_current}
              max={character.hp_max}
              barPct={clampPct(character.hp_current, character.hp_max)}
              barColorClass="bg-green"
            />
            <VitalTile label={display.acLabel} value={display.showProgression ? character.ac : `Tier ${character.ac}`} />
            {character.gear_current != null && character.gear_max != null && (
              <VitalTile
                label="Gear"
                value={character.gear_current}
                max={character.gear_max}
                barPct={clampPct(character.gear_current, character.gear_max)}
                barColorClass="bg-purple"
              />
            )}
            {display.showProgression && (
              <VitalTile
                label="XP"
                value={character.xp_current}
                max={character.xp_needed}
                barPct={clampPct(character.xp_current, character.xp_needed)}
                barColorClass="bg-cyan"
              />
            )}
            <VitalTile label={display.moneyLabel} value={display.formatMoney(gold)} accentClass="text-yellow" />
            <VitalTile
              label={display.luckLabel}
              value={display.showProgression ? `${character.luck_tokens} token${character.luck_tokens === 1 ? '' : 's'}` : character.luck_tokens}
              accentClass="text-purple"
            />
          </div>

          {/* Per-system abilities (cyborg: five −3..+3 scores, shown as
            * the signed mod alone — there is no separate raw score to
            * pair it with the way Shadowdark's tiles do). */}
          {display.abilities !== null && display.abilities.some(({ key }) => rawAbilities[key]) && (
            <>
              <p className={sectionLabelClass}>Abilities</p>
              <div className="grid grid-cols-5 gap-2">
                {display.abilities.map(({ key, label }) => {
                  const entry = rawAbilities[key]
                  if (!entry) return null
                  const mod = entry.mod ?? 0
                  return (
                    <div key={key} className="rounded-xl border border-line-soft bg-panel2 px-3 py-2.5 text-center">
                      <p className={cx(text.label, 'text-ink-faint')}>{label}</p>
                      <p className={cx('mt-1 font-mono text-numeric font-semibold tabular-nums', mod >= 0 ? 'text-green' : 'text-red')}>{formatMod(mod)}</p>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {display.abilities === null && ABILITY_ORDER.some(({ key }) => abilities[key]) && (
            <>
              <p className={sectionLabelClass}>Abilities</p>
              <div className="grid grid-cols-6 gap-2">
                {ABILITY_ORDER.map(({ key, label }) => {
                  const score = abilities[key]
                  return score ? <AbilityScoreTile key={key} label={label} score={score} /> : null
                })}
              </div>
            </>
          )}

          {talents.length > 0 && (
            <>
              <p className={sectionLabelClass}>Talents</p>
              <div>
                {talents.map((talent, index) => (
                  <TalentRow key={index} label={talent} />
                ))}
              </div>
            </>
          )}

          {languages.length > 0 && (
            <>
              <p className={sectionLabelClass}>Languages</p>
              <div className="flex flex-wrap gap-2">
                {languages.map((language) => (
                  <span
                    key={language}
                    className={cx('rounded-full border border-line-soft bg-panel2 px-3 py-1', text.bodySecondary)}
                  >
                    {language}
                  </span>
                ))}
              </div>
            </>
          )}

          {spells.length > 0 && (
            <>
              <p className={sectionLabelClass}>Spells</p>
              <div>
                {spells.map((spell, index) => (
                  <SpellCard key={index} name={spell} />
                ))}
              </div>
            </>
          )}

          {details.map((field) => (
            // Fragment, not a wrapping <div> (the bug this replaced): a
            // per-field <div> made each field's own label its parent's
            // *only* child, so `first:mt-0` matched every one of them —
            // Appearance, Personal Revelation, Covenant Duties all lost
            // their top margin, not just the sheet's true first section.
            // A Fragment keeps every label a flat sibling of the other
            // section labels, so `first:` only ever matches the one
            // that's actually first in the whole sheet.
            <Fragment key={field.key}>
              <p className={sectionLabelClass}>{field.label}</p>
              {Array.isArray(field.value) ? (
                <div className="flex flex-col gap-2">
                  {field.value.map((line, index) => (
                    <p key={index} className={text.bodySecondary}>
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <p className={text.bodySecondary}>{field.value}</p>
              )}
            </Fragment>
          ))}

          <CharacterCommands character={character} sessionId={sessionId} system={system} onUpdate={onUpdate} />
        </div>
      )}
    </Overlay>
  )
}
