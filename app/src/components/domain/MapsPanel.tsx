import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { ErrorBanner } from '../ui/ErrorBanner'
import { Skeleton, SkeletonGroup } from '../ui/Skeleton'
import { MapsRegionTab } from './MapsRegionTab'
import { MapsSiteTab } from './MapsSiteTab'
import { MapsSceneTab } from './MapsSceneTab'
import { getMapImageUrls, getPartyPosition, listCampaignMaps } from '../../lib/maps'
import type { CampaignMap, CampaignMapPosition, MapKind } from '../../lib/maps'
import type { Character } from '../../lib/characters'

interface MapsPanelProps {
  campaignId: string
  /** BUILD_PLAN.md item 15 slice 4 (2026-08-14) — threaded to
   * `MapsRegionTab`/`MapsSiteTab` to gate the new player-handout
   * controls AND to pick which image a viewer sees by default (their
   * own working map, always, vs. the handout when one exists and
   * they're not the owner). See migration `0026_map_handouts`' own doc
   * comment for why this is the first owner-only gate anywhere in the
   * maps command layer. */
  isOwner: boolean
  /** BUILD_PLAN.md item 8 (2026-08-14) — threaded straight to
   * `MapsSceneTab`, the only tab that needs it (Region/Site work off
   * map images and a shared party pin, not per-character state). Both
   * call sites (`MapsOverlay`, `MobileJournalView`) already have
   * `characters` in scope from `JournalScreen`'s own load. */
  characters: Character[]
}

const TAB_ORDER: Array<{ key: MapKind; label: string; live: boolean }> = [
  { key: 'region', label: 'Region', live: true },
  { key: 'site', label: 'Site', live: true },
  { key: 'scene', label: 'Scene', live: true },
]

function MapsTabButton({
  tabKey,
  label,
  live,
  active,
  onSelect,
}: {
  tabKey: MapKind
  label: string
  live: boolean
  active: boolean
  onSelect: (key: MapKind) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tabKey)}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'flex items-center gap-2 rounded-t-button border border-b-0 px-4 py-2.5',
        active ? 'border-line-hover bg-panel2' : 'border-line-soft hover:border-line-hover',
      )}
    >
      <span className={text.label} style={active ? { color: 'var(--color-ink)' } : undefined}>
        {label}
      </span>
      <span
        className={cx(text.label, 'rounded-full border px-2 py-0.5', live && 'border-green/35')}
        style={live ? { color: 'var(--color-green)' } : undefined}
      >
        {live ? 'live' : 'stub'}
      </span>
    </button>
  )
}

/**
 * Region + Site + Scene tabs (BUILD_PLAN.md slice 8, "Maps overlay").
 * Region and Site are real; Scene stays an honest stub — Close/Near/Far
 * zone positioning ships with Encounter mode, not this pass. Approved as
 * an HTML mockup before any of this was written (mockup-before-code
 * gate, same discipline Slice 17's CheckCard variants went through).
 *
 * Shared between two call sites rather than built twice: `MapsOverlay`
 * wraps this in `Overlay` for the desktop `ToolsDock` entry point, and
 * `MobileJournalView` renders it directly inline under its own "Maps"
 * bottom tab (which already provides the header-with-close chrome every
 * mobile tab gets — a second nested `Overlay` there would just wrap one
 * closeable panel inside another).
 *
 * This file owns data-fetching and the tab shell only; `MapsRegionTab`/
 * `MapsSiteTab` (CLAUDE.md's ~300-line component cap) own their own tab
 * content and interaction state, reporting results back up via
 * `onPositionUpdate`/`onMapUploaded` so this file's `maps`/`position`
 * stay the one source of truth both tabs read from.
 *
 * No GM-only gate on the working map itself: any campaign member can
 * still drop the pin or replace a region/site image, matching
 * `adjust_character_hp`/`log_journal_entry`'s "trust any member
 * equally" convention. Slice 4 (2026-08-14, migration
 * `0026_map_handouts`) adds the first owner-only exception to that
 * convention anywhere in the maps command layer: setting or clearing a
 * map's player-facing HANDOUT variant is owner-only, since it's the one
 * piece here that's actually curated by whoever is running the table —
 * `isOwner` (threaded through from `JournalScreen`'s existing
 * ownership check) is what gates that, and what picks which image a
 * non-owner viewer sees by default; see `MapsRegionTab`/`MapsSiteTab`'s
 * own doc comments for the display-swap logic.
 */
export function MapsPanel({ campaignId, isOwner, characters }: MapsPanelProps) {
  const [maps, setMaps] = useState<CampaignMap[] | null>(null)
  const [position, setPosition] = useState<CampaignMapPosition | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<MapKind>('region')

  // Fetch on mount rather than refetch-on-`open` (RulesChat's pattern):
  // both call sites only ever mount this component while it's actually
  // showing (`Overlay` unmounts its children when closed; MobileJournalView's
  // tab switch is a plain ternary, not a keep-alive), so mount already
  // means "just became visible" at both.
  useEffect(() => {
    let cancelled = false
    setMaps(null)
    setPosition(null)
    setError(null)
    Promise.all([listCampaignMaps(campaignId), getPartyPosition(campaignId)])
      .then(async ([mapsData, positionData]) => {
        if (cancelled) return
        setMaps(mapsData)
        setPosition(positionData)
        // Slice 4: request the handout path alongside the working path
        // for every map that has one — same batched call, just a longer
        // list (up to 2x the map count now, still one round trip).
        const paths = mapsData.flatMap((m) => [m.storage_path, m.handout_storage_path].filter((p): p is string => Boolean(p)))
        const urls = await getMapImageUrls(paths)
        if (!cancelled) setImageUrls(urls)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the maps.')
      })
    return () => {
      cancelled = true
    }
  }, [campaignId])

  // Also handles a handout being set/cleared (slice 4): `set_map_handout`/
  // `clear_map_handout` return the same `campaign_maps` row shape as
  // `set_campaign_map`, so one handler covers both — the row just may or
  // may not carry a `handout_storage_path` now.
  async function handleMapUploaded(updated: CampaignMap) {
    setMaps((prev) => [...(prev ?? []).filter((m) => m.kind !== updated.kind), updated])
    try {
      const paths = [updated.storage_path, updated.handout_storage_path].filter((p): p is string => Boolean(p))
      const urls = await getMapImageUrls(paths)
      setImageUrls((prev) => ({ ...prev, ...urls }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the uploaded map image.')
    }
  }

  // Mirror of `handleMapUploaded` for the delete direction — `maps` and
  // `imageUrls` are the two pieces of state a cleared map needs to drop
  // out of; `campaign_map_position`/markers deliberately aren't touched
  // here either (see `clearCampaignMap`'s own doc comment).
  function handleMapCleared(kind: MapKind) {
    setMaps((prev) => (prev ?? []).filter((m) => m.kind !== kind))
  }

  const regionMap = maps?.find((m) => m.kind === 'region') ?? null
  const siteMap = maps?.find((m) => m.kind === 'site') ?? null

  return (
    <div className="flex flex-col">
      {error && (
        <ErrorBanner className="mb-3" onRetry={() => setError(null)}>
          {error}
        </ErrorBanner>
      )}

      <div className="flex gap-1.5">
        {TAB_ORDER.map((tab) => (
          <MapsTabButton key={tab.key} tabKey={tab.key} label={tab.label} live={tab.live} active={activeTab === tab.key} onSelect={setActiveTab} />
        ))}
      </div>

      <div className="rounded-b-card rounded-tr-card border border-line-hover bg-panel2 p-4">
        {maps === null ? (
          <SkeletonGroup label="Loading maps">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-10 w-full" />
          </SkeletonGroup>
        ) : activeTab === 'region' ? (
          <MapsRegionTab
            campaignId={campaignId}
            map={regionMap}
            imageUrl={regionMap ? imageUrls[regionMap.storage_path] : undefined}
            handoutImageUrl={regionMap?.handout_storage_path ? imageUrls[regionMap.handout_storage_path] : undefined}
            isOwner={isOwner}
            position={position}
            onPositionUpdate={setPosition}
            onMapUploaded={(updated) => void handleMapUploaded(updated)}
            onMapCleared={handleMapCleared}
            onError={setError}
          />
        ) : activeTab === 'site' ? (
          <MapsSiteTab
            campaignId={campaignId}
            map={siteMap}
            imageUrl={siteMap ? imageUrls[siteMap.storage_path] : undefined}
            handoutImageUrl={siteMap?.handout_storage_path ? imageUrls[siteMap.handout_storage_path] : undefined}
            isOwner={isOwner}
            onMapUploaded={(updated) => void handleMapUploaded(updated)}
            onMapCleared={handleMapCleared}
            onError={setError}
          />
        ) : (
          <MapsSceneTab campaignId={campaignId} characters={characters} onError={setError} />
        )}
      </div>
    </div>
  )
}
