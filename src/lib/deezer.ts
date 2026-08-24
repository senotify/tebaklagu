// Runtime Deezer access. Both dev (vite proxy) and production (nginx) expose
// the API under /api/deezer to work around its missing CORS headers.

const BASE = '/api/deezer'

export type Track = {
  id: number
  title: string
  artist: string
  cover: string
  youtubeId?: string
  /**
   * Length of the YouTube video in seconds. Intro mode compares it against what
   * the player reports, which is how it notices a pre-roll ad is playing instead
   * of the song. Always present alongside youtubeId — check-catalog enforces it.
   */
  ytDuration?: number
}

export type Suggestion = Track & { key: string }

type DeezerTrack = {
  id: number
  title: string
  preview: string
  artist: { name: string }
  album?: { cover_medium?: string }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, { signal })
  if (!res.ok) throw new Error(`Deezer request failed (${res.status})`)
  const body = await res.json()
  if (body?.error) throw new Error(body.error.message ?? 'Deezer error')
  return body as T
}

/**
 * Preview URLs are signed and expire about 15 minutes after they are issued,
 * so they are fetched per round rather than stored with the track lists.
 */
export async function fetchPreviewUrl(trackId: number, signal?: AbortSignal): Promise<string> {
  const track = await get<DeezerTrack>(`/track/${trackId}`, signal)
  if (!track.preview) throw new Error('Track has no preview')
  return track.preview
}

// All players share one server IP against Deezer's rate limit, so repeat
// queries are answered from memory before they ever leave the browser.
const searchCache = new Map<string, Suggestion[]>()
const MAX_CACHE_ENTRIES = 200

export async function searchTracks(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const cached = searchCache.get(q)
  if (cached) return cached

  const body = await get<{ data: DeezerTrack[] }>(
    `/search?q=${encodeURIComponent(q)}&limit=12`,
    signal,
  )

  const seen = new Set<string>()
  const results: Suggestion[] = []
  for (const t of body.data ?? []) {
    // Deezer returns many cover uploads of the same song; one row per
    // title+artist pair keeps the dropdown readable.
    const key = `${t.title.toLowerCase()}::${t.artist.name.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push({
      id: t.id,
      title: t.title,
      artist: t.artist.name,
      cover: t.album?.cover_medium ?? '',
      key,
    })
  }

  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    searchCache.delete(searchCache.keys().next().value as string)
  }
  searchCache.set(q, results)
  return results
}
