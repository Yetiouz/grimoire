import { supabase } from './supabase'
import type { Tables } from './database.types'

export type CampaignMap = Tables<'campaign_maps'>
export type CampaignMapPosition = Tables<'campaign_map_position'>

/** `campaign_maps.kind` is `text` with a check constraint, not a real
 * enum (migration `maps_overlay_v1`) — this is the client-side mirror of
 * that constraint, kept here rather than trusting whatever string a
 * caller happens to pass. */
export type MapKind = 'region' | 'site' | 'scene'

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
