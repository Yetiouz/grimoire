import { Fragment } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { TalentRow } from './TalentRow'
import { SpellCard } from './SpellCard'
import { CharacterCommands } from './CharacterCommands'
import { readCharacterAbilities, readCharacterGold, readCharacterSheet } from '../../lib/characters'
import type { AbilityScore, Character, CharacterAbilities, CharacterSheetData } from '../../lib/characters'

interface CharacterSheetProps {
  character: Character | null
  /** The campaign's currently open session, if any — passed straight
   * through to `CharacterCommands` (BUILD_PLAN.md slice 6). */
  sessionId: string | null
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
      <p className={cx(text.caption, 'text-ink-dim')}>{formatMod(score.mod)}</p>
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
 */
export function CharacterSheet({ character, sessionId, onClose, onUpdate }: CharacterSheetProps) {
  const open = character !== null
  const abilities = character ? readCharacterAbilities(character.abilities) : {}
  const sheet = character ? readCharacterSheet(character.sheet) : {}
  const gold = character ? readCharacterGold(character.gold) : {}

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
            <p className={cx(text.caption, 'mt-1 text-ink-faint')}>
              {character.class_title} {character.level}
              {character.alignment_title && ` · ${character.alignment_title}`}
              {' · XP '}
              <span className="tabular-nums text-ink">
                {character.xp_current}/{character.xp_needed}
              </span>
              {' · '}
              <span className="tabular-nums text-ink">{formatGold(gold)}</span>
            </p>
          </div>
        )
      }
    >
      {character && (
        <div>
          {ABILITY_ORDER.some(({ key }) => abilities[key]) && (
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

          <CharacterCommands character={character} sessionId={sessionId} onUpdate={onUpdate} />
        </div>
      )}
    </Overlay>
  )
}
