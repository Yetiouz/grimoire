import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { PortraitAvatar } from '../ui/PortraitAvatar'
import { EncounterPanel } from './EncounterPanel'
import { clearScene, listScenePositions, setScenePosition } from '../../lib/maps'
import type { ScenePosition, SceneZone } from '../../lib/maps'
import type { Character } from '../../lib/characters'
import type { TurnOrder } from '../../lib/encounters'

interface MapsSceneTabProps {
  campaignId: string
  /** Same "load everything, filter for display" shape `JournalScreen`
   * already passes to `JournalDesktopLayout`'s Party card — filtered
   * here to `status === 'active'` (an `awaiting` character isn't at the
   * table to have a zone) rather than upstream, so this tab stays a
   * plain consumer of the same `characters` prop every other panel
   * already gets. */
  characters: Character[]
  /** Encounter mode phase 2 (BUILD_PLAN.md item 13, 2026-08-14) — threaded
   * straight to `EncounterPanel`, the only consumer here; see that
   * component's own doc comment for what each one gates. */
  isOwner: boolean
  sessionId: string | null
  turnOrder: TurnOrder | null
  onTurnOrderChange: Dispatch<SetStateAction<TurnOrder | null>>
  onError: (message: string) => void
}

const ZONES: Array<{ zone: SceneZone; label: string }> = [
  { zone: 'close', label: 'Close' },
  { zone: 'near', label: 'Near' },
  { zone: 'far', label: 'Far' },
]

/**
 * BUILD_PLAN.md item 8's remaining gap (2026-08-14) -- the Scene tab was
 * an honest, labeled stub ("Scene (coming soon)") since the Maps
 * overlay first shipped; full Close/Near/Far positioning was
 * deliberately deferred to land with Encounter mode (item 13). Owner's
 * call, asked directly: ship a standalone zone tracker now rather than
 * wait on item 13's bigger lift -- real and usable today, independent
 * of initiative/monster cards/HP toggles, which Encounter mode phase 2
 * (same day, `EncounterPanel` below) layers on top of this same
 * `scene_positions` table rather than replacing it -- per the scope
 * doc's decision #3, this tab is that feature's "turn tracker home."
 *
 * One radio-style zone picker per active character -- same
 * `role="radiogroup"`/`role="radio"` pill pattern `JournalComposer`'s
 * kind chips already use, not a new interaction idiom. Each button
 * click is its own `setScenePosition` call (optimistic local update,
 * same "echo immediately, surface an error if the RPC disagrees"
 * pattern every other command on this screen uses) -- there's no "save"
 * step; a zone change is as immediate as dropping a map pin.
 *
 * "Clear scene" resets every character's zone to unset (not to some
 * default) via `clear_scene` -- the natural action between encounters,
 * when the last scene's positions stop meaning anything and a re-render
 * of empty pickers is more honest than everyone silently starting the
 * next scene already parked at "Near."
 *
 * Fetched here, not lifted to `MapsPanel` -- unlike `maps`/`position`,
 * scene data is only ever read by this one tab, matching how
 * `MapsRegionTab`'s own markers are fetched locally for the same
 * reason (see that file's doc comment).
 */
export function MapsSceneTab({ campaignId, characters, isOwner, sessionId, turnOrder, onTurnOrderChange, onError }: MapsSceneTabProps) {
  const [positions, setPositions] = useState<ScenePosition[] | null>(null)
  const [savingCharacterId, setSavingCharacterId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPositions(null)
    listScenePositions(campaignId)
      .then((rows) => {
        if (!cancelled) setPositions(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) onError(err instanceof Error ? err.message : 'Could not load the scene.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  const activeCharacters = characters.filter((character) => character.status === 'active')
  const positionByCharacterId = new Map((positions ?? []).map((position) => [position.character_id, position] as const))

  async function handleSetZone(characterId: string, zone: SceneZone) {
    setSavingCharacterId(characterId)
    // Optimistic: this tab has no other reader to desync from (see the
    // doc comment above), so there's nothing lost by updating local
    // state immediately and only rolling back on a real error.
    const previous = positions
    setPositions((prev) => {
      const next = (prev ?? []).filter((position) => position.character_id !== characterId)
      next.push({ id: `optimistic-${characterId}`, campaign_id: campaignId, character_id: characterId, zone, updated_at: new Date().toISOString() })
      return next
    })
    try {
      const saved = await setScenePosition(campaignId, characterId, zone)
      setPositions((prev) => [...(prev ?? []).filter((position) => position.character_id !== characterId), saved])
    } catch (err) {
      setPositions(previous)
      onError(err instanceof Error ? err.message : 'Could not update that zone.')
    } finally {
      setSavingCharacterId(null)
    }
  }

  async function handleClearScene() {
    setClearing(true)
    const previous = positions
    setPositions([])
    try {
      await clearScene(campaignId)
    } catch (err) {
      setPositions(previous)
      onError(err instanceof Error ? err.message : 'Could not clear the scene.')
    } finally {
      setClearing(false)
    }
  }

  if (positions === null) {
    return <p className={cx(text.caption, 'text-ink-faint')}>Loading the scene…</p>
  }

  if (activeCharacters.length === 0) {
    return <EmptyState icon="map" title="No active party yet" description="Characters marked active show up here once there's a scene to position them in." />
  }

  const hasAnyPosition = positions.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className={cx(text.caption, 'uppercase tracking-eyebrow text-ink-faint')}>Close / Near / Far</p>
        <Button type="button" variant="ghost" onClick={() => void handleClearScene()} disabled={clearing || !hasAnyPosition}>
          {clearing ? 'Clearing…' : 'Clear scene'}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {activeCharacters.map((character) => {
          const currentZone = positionByCharacterId.get(character.id)?.zone ?? null
          const saving = savingCharacterId === character.id
          return (
            <div
              key={character.id}
              className="flex items-center justify-between gap-3 rounded-card border border-line bg-panel p-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <PortraitAvatar name={character.name} color={character.color ?? '#9b5cff'} size="sm" />
                <span className={cx(text.body, 'truncate font-semibold')}>{character.name}</span>
              </div>
              <div
                className="flex shrink-0 items-center gap-1.5"
                role="radiogroup"
                aria-label={`${character.name}'s zone`}
              >
                {ZONES.map(({ zone, label }) => {
                  const isOn = currentZone === zone
                  return (
                    <button
                      key={zone}
                      type="button"
                      role="radio"
                      aria-checked={isOn}
                      disabled={saving}
                      onClick={() => void handleSetZone(character.id, zone)}
                      className={cx(
                        'inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 uppercase',
                        text.caption,
                        isOn ? 'border-purple/45 bg-purple/15 text-purple' : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
                        saving && 'pointer-events-none opacity-40',
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <EncounterPanel
        campaignId={campaignId}
        isOwner={isOwner}
        sessionId={sessionId}
        turnOrder={turnOrder}
        onTurnOrderChange={onTurnOrderChange}
        onError={onError}
      />
    </div>
  )
}
