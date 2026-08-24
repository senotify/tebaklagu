// YouTube helpers for the build-time scripts.
//
// Two ways in, and they serve different purposes:
//   - the Data API searches for a video but needs a key and burns quota
//   - oEmbed needs no key and confirms a known id is real and embeddable
// So search finds candidates and oEmbed vets them before they reach the game.

/**
 * Returns { title, author_name } for a video, or null when it can't be embedded
 * — wrong id, private, deleted, or embedding disabled by the uploader.
 */
export async function oembed(videoId) {
  try {
    const res = await fetch(
      'https://www.youtube.com/oembed?format=json&url=' +
        encodeURIComponent('https://www.youtube.com/watch?v=' + videoId),
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Thrown when the daily Data API quota is gone, so callers can stop asking. */
export class QuotaError extends Error {}

/**
 * Searches for the official upload of a track. Each call costs 100 of the
 * default 10,000 daily quota units, so roughly 100 tracks map per day.
 */
export async function searchVideo(apiKey, { title, artist }) {
  const q = `${artist} ${title} official audio`
  const url =
    'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video' +
    `&videoCategoryId=10&videoEmbeddable=true&maxResults=1&q=${encodeURIComponent(q)}&key=${apiKey}`

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })

  // A spent quota arrives as either 403 or 429 depending on which limit was hit.
  // Both must stop the run: left unhandled, 429 falls through to "no result" and
  // the build quietly asks for every remaining track in turn, mapping none.
  if (res.status === 403 || res.status === 429) {
    const body = await res.json().catch(() => ({}))
    const reason = body.error?.errors?.[0]?.reason ?? 'unknown'
    // A rejected key also returns 403, and treating that as "quota gone" would
    // silently produce an empty build instead of reporting a bad key.
    if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded' || res.status === 429) {
      throw new QuotaError(`YouTube quota exhausted (${reason})`)
    }
    throw new Error(`YouTube rejected the API key (${reason}): ${body.error?.message ?? ''}`)
  }

  if (!res.ok) return null

  const body = await res.json()
  return body.items?.[0]?.id?.videoId ?? null
}

/** "PT3M52S" -> 232. Returns null for the shapes the API shouldn't produce. */
function parseIsoDuration(value) {
  const m = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? '')
  if (!m) return null
  const [, h = 0, min = 0, s = 0] = m
  const total = Number(h) * 3600 + Number(min) * 60 + Number(s)
  return total > 0 ? total : null
}

/**
 * Looks up how long each video runs, keyed by video id.
 *
 * This is what lets the player tell "our song is playing" from "an ad is
 * playing": the IFrame API exposes no ad state, but during a pre-roll
 * getDuration() reports the ad, not the video. Comparing against a known length
 * is the check.
 *
 * Unlike search, videos.list costs 1 quota unit per *call* and accepts 50 ids at
 * a time, so mapping the whole catalog costs tens of units rather than hundreds
 * of thousands.
 */
export async function videoDurations(apiKey, videoIds) {
  const out = new Map()

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/videos?part=contentDetails' +
        `&id=${batch.join(',')}&key=${apiKey}`,
      { signal: AbortSignal.timeout(15000) },
    )

    if (res.status === 403 || res.status === 429) {
      const body = await res.json().catch(() => ({}))
      const reason = body.error?.errors?.[0]?.reason ?? 'unknown'
      if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded' || res.status === 429) {
        throw new QuotaError(`YouTube quota exhausted (${reason})`)
      }
      throw new Error(`YouTube rejected the API key (${reason})`)
    }
    if (!res.ok) throw new Error(`videos.list failed with ${res.status}`)

    const body = await res.json()
    // Ids the API omits are deleted or private; they simply stay unmapped, and
    // the build then drops intro mode for those tracks.
    for (const item of body.items ?? []) {
      const seconds = parseIsoDuration(item.contentDetails?.duration)
      if (seconds) out.set(item.id, seconds)
    }
  }

  return out
}
