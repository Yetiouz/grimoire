import { supabase } from './supabase'
import type { Tables } from './database.types'

export type CampaignMap = Tables<'campaign_maps'>
export type CampaignMapPosition = Tables<'campaign_map_position'>
export type CampaignMapMarker = Tables<'campaign_map_markers'>

/** `campaign_maps.kind` is `text` with a check constraint, not a real
 * enum (migration `maps_overlay_v1`) — this is the client-side mirror of
 * that constraint, kept here rather than trusting whatever string a
 * caller happens to pass. */
export type MapKind = 'region' | 'site' | 'scene'

/** `campaign_map_markers.marker_kind` is a second, deliberately distinct
 * `text` + check constraint (migration `maps_overlay_v2_markers`) — not
 * to be confused with `MapKind` above, which is *which map* a marker
 * lives on (region/site), not what the marker itself represents.
 * Defaults to `'poi'` server-side when omitted. */
export type MarkerKind = 'poi' | 'npc' | 'danger' | 'custom'

const MAP_BUCKET = 'campaign-maps'

/** Signed URLs are re-fetched every time `MapsPanel` mounts (no
 * persistent cache anywhere client-side) — this only needs to outlive
 * one open overlay/tab visit, not survive a page reload, so an hour is
 * generous rather than tight. */
const SIGNED_URL_TTL_SECONDS = 3600

/** The maps set for a campaign — at most one row per `kind` (schema's
 * `campaign_maps_campaign_kind_idx` unique index), so this is never more
 * than three rows today. RLS already scopes this to membership, same as
 * every other campaign-scoped read in `campaigns.ts`/`characters.ts`. */
export async function listCampaignMaps(campaignId: string): Promise<CampaignMap[]> {
  const { data, error } = await supabase.from('campaign_maps').select('*').eq('campaign_id', campaignId)
  if (error) throw error
  return data
}

/** Null until the first `set_party_position` call ever happens for this
 * campaign — a real, distinct state from "no pin dropped yet" (which is
 * a row with `x`/`y` null but `location_label` set, e.g. prose-only
 * tracking). `maybeSingle` rather than `single`: no row is the expected
 * state for a brand-new campaign, not an error. */
export async function getPartyPosition(campaignId: string): Promise<CampaignMapPosition | null> {
  const { data, error } = await supabase.from('campaign_map_position').select('*').eq('campaign_id', campaignId).maybeSingle()
  if (error) throw error
  return data
}

/** Wraps `set_campaign_map` — records a map that's already been uploaded
 * to storage (see `uploadCampaignMap` below for the common case of doing
 * both in one call). */
export async function setCampaignMap(campaignId: string, kind: MapKind, label: string, storagePath: string): Promise<CampaignMap> {
  const { data, error } = await supabase.rpc('set_campaign_map', {
    p_campaign_id: campaignId,
    p_kind: kind,
    p_label: label,
    p_storage_path: storagePath,
  })
  if (error) throw error
  return data
}

export interface PartyPositionUpdate {
  x?: number | null
  y?: number | null
  locationLabel?: string | null
  travelPace?: string | null
  hexesRemaining?: number | null
  /** Drops the `x`/`y` pin specifically (e.g. the party leaves the
   * mapped region) without touching the other fields. */
  clearPin?: boolean
}

/** Wraps `set_party_position` — a partial update server-side (nulls left
 * alone via `coalesce`), so e.g. bumping `hexesRemaining` alone doesn't
 * require re-sending the location label and pace too. */
export async function setPartyPosition(campaignId: string, update: PartyPositionUpdate): Promise<CampaignMapPosition> {
  const { data, error } = await supabase.rpc('set_party_position', {
    p_campaign_id: campaignId,
    p_x: update.x ?? undefined,
    p_y: update.y ?? undefined,
    p_location_label: update.locationLabel ?? undefined,
    p_travel_pace: update.travelPace ?? undefined,
    p_hexes_remaining: update.hexesRemaining ?? undefined,
    p_clear_pin: update.clearPin ?? undefined,
  })
  if (error) throw error
  return data
}

/** All markers dropped on a given map. `kind` here is the *map* kind
 * (region/site — same domain as `CampaignMap['kind']`), not a marker's
 * own `marker_kind` — see the type comment above. RLS scopes this to
 * membership, same as every other campaign-scoped read in this file. */
export async function listMapMarkers(campaignId: string, kind: MapKind): Promise<CampaignMapMarker[]> {
  const { data, error } = await supabase
    .from('campaign_map_markers')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('kind', kind)
  if (error) throw error
  return data
}

export interface AddMapMarkerInput {
  kind: MapKind
  x: number
  y: number
  label: string
  markerKind?: MarkerKind
  notes?: string
}

/** Wraps `add_map_marker`. `markerKind` defaults to `'poi'` server-side
 * (the DB column default) when omitted, so callers that don't care yet
 * (e.g. a quick "drop a pin here" flow) don't have to pick one. */
export async function addMapMarker(campaignId: string, input: AddMapMarkerInput): Promise<CampaignMapMarker> {
  const { data, error } = await supabase.rpc('add_map_marker', {
    p_campaign_id: campaignId,
    p_kind: input.kind,
    p_x: input.x,
    p_y: input.y,
    p_label: input.label,
    p_marker_kind: input.markerKind ?? undefined,
    p_notes: input.notes ?? undefined,
  })
  if (error) throw error
  return data
}

export interface UpdateMapMarkerInput {
  x?: number
  y?: number
  label?: string
  markerKind?: MarkerKind
  notes?: string
}

/** Wraps `update_map_marker` — a partial update server-side (`coalesce`
 * on omitted args), same pattern as `setPartyPosition`: dragging a
 * marker to a new `x`/`y` shouldn't require resending its label too. */
export async function updateMapMarker(markerId: string, update: UpdateMapMarkerInput): Promise<CampaignMapMarker> {
  const { data, error } = await supabase.rpc('update_map_marker', {
    p_marker_id: markerId,
    p_x: update.x ?? undefined,
    p_y: update.y ?? undefined,
    p_label: update.label ?? undefined,
    p_marker_kind: update.markerKind ?? undefined,
    p_notes: update.notes ?? undefined,
  })
  if (error) throw error
  return data
}

/** Wraps `remove_map_marker`. No storage cleanup here — markers are pure
 * DB rows, nothing in the bucket is keyed to a marker id. */
export async function removeMapMarker(markerId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_map_marker', { p_marker_id: markerId })
  if (error) throw error
}

/** Wraps `clear_campaign_map` — drops the active image for a
 * `(campaign, kind)`. Deliberately does NOT cascade to
 * `campaign_map_position` or that campaign's markers (migration
 * comment: "which image is showing" and "the party's last-known
 * location / dropped markers" are separate facts that shouldn't vanish
 * together just because the map image did).
 *
 * `storagePath` is optional and, when passed, triggers a best-effort
 * storage-object removal *after* the DB row is gone — the DB row is the
 * source of truth for "does this campaign have a region/site map", so a
 * failed storage cleanup (e.g. the object was already gone) shouldn't
 * surface as an error to the caller. Mirrors `uploadCampaignMap`'s
 * storage-then-DB order, just reversed and with the DB step load-bearing
 * instead of the storage step. */
export async function clearCampaignMap(campaignId: string, kind: MapKind, storagePath?: string): Promise<void> {
  const { error } = await supabase.rpc('clear_campaign_map', { p_campaign_id: campaignId, p_kind: kind })
  if (error) throw error
  if (storagePath) {
    try {
      await supabase.storage.from(MAP_BUCKET).remove([storagePath])
    } catch {
      // best-effort — the DB row is already gone, which is what matters.
    }
  }
}

/** Uploads (or replaces — same path every time, `upsert: true`) the
 * active image for a `(campaign, kind)`, then records it via
 * `set_campaign_map` in one call. One path per `(campaign, kind)` by
 * design, matching the schema's own unique index — a real multi-site
 * library is a future need the schema doesn't block (see
 * migration.sql's header comment) but this pass doesn't surface it. */
export async function uploadCampaignMap(campaignId: string, kind: MapKind, label: string, file: File): Promise<CampaignMap> {
  const extMatch = /\.([a-z0-9]+)$/i.exec(file.name)
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg'
  const path = `${campaignId}/${kind}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(MAP_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (uploadError) throw uploadError
  return setCampaignMap(campaignId, kind, label, path)
}

/** Private bucket (`campaign-maps.public = false`) — every map image
 * needs a signed URL, never a public one. Some map art here is licensed
 * rulebook content the user owns a copy of, not something safe to
 * expose via a guessable public link (same "private signed-URL map
 * storage" call SPEC.md already made for attempt 1, carried forward).
 * Batched via `createSignedUrls` rather than one call per image — at
 * most two live paths (Region + Site) today, but no reason to make it
 * N round trips as that grows. */
export async function getMapImageUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from(MAP_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (error) throw error
  const result: Record<string, string> = {}
  // `data ?? []` rather than relying on `error` narrowing `data` to
  // non-null — storage-js's response type isn't guaranteed to be the
  // same discriminated union postgrest-js uses for `.from()`/`.rpc()`
  // (where that narrowing is already relied on elsewhere in this file).
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) result[entry.path] = entry.signedUrl
  }
  return result
}
