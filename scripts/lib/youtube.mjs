// YouTube helpers for the build-time scripts.
//
// Two ways in, and they serve different purposes:
//   - the Data API searches for a video but needs a key and burns quota
//   - oEmbed needs no key and confirms a known id is real and embeddable
// So search finds candidates and oEmbed vets them before they reach the game.

import { normalize } from './deezer.mjs'

/** Title with any "(Remastered 2011)" / "[4K]" decoration cut off, normalised. */
const bare = (value) => normalize(String(value).replace(/\s*[([].*$/, ''))

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
 * Searches for uploads of a track. Each call costs 100 of the default 10,000
 * daily quota units regardless of how many results it returns, so asking for
 * several candidates instead of one is free — and necessary, because the first
 * hit is usually the music video rather than the audio (see pickBestVideo).
 */
export async function searchVideos(apiKey, { title, artist }, max = 5) {
  const q = `${artist} ${title} official audio`
  const url =
    'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video' +
    `&videoCategoryId=10&videoEmbeddable=true&maxResults=${max}&q=${encodeURIComponent(q)}&key=${apiKey}`

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

  if (!res.ok) return []

  const body = await res.json()
  return (body.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet?.title ?? '',
      channel: item.snippet?.channelTitle ?? '',
    }))
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

/**
 * Does a video's own title and channel name the song we asked for?
 *
 * Normalised but NOT bracket-stripped: uploaders put the artist after the
 * decoration ("Faint (Official Music Video) [4K UPGRADE] – Linkin Park"), so
 * cutting at the first bracket would throw away the very name being checked.
 */
export function describesTrack({ title, channel }, want) {
  const haystack = normalize(`${title} ${channel}`)
  return haystack.includes(bare(want.title)) && haystack.includes(bare(want.artist))
}

/** How much longer than the recording a video may run before it's suspect. */
const MAX_RATIO = 2.5
const MIN_RATIO = 0.5

/**
 * Picks the upload that is most likely to *start with the music*.
 *
 * The first search hit is usually the official music video, and those open with
 * anything but the song — "God's Plan" runs 5:57 against a 3:19 recording, the
 * difference being two and a half minutes of short film before a note is
 * played. Intro mode would serve fifteen seconds of dialogue.
 *
 * The signal that sorts this out is length. YouTube's auto-generated "Artist -
 * Topic" uploads are audio only and match the recording almost to the second,
 * so ranking candidates by how close they are to Deezer's duration finds them
 * without depending on the channel naming convention — which varies, and which
 * plenty of legitimate official-audio uploads don't follow. Channel name is
 * used only to break ties between candidates of near-equal length.
 *
 * Ranking happens strictly *among* candidates that already passed the name
 * check: duration alone would happily match a completely different 3:19 song.
 */
/**
 * Is this plausibly the rightsholder's own upload?
 *
 * Matters because the name and length gates can't tell a faithful cover, a live
 * take or a sped-up re-upload from the recording — a channel called "Rap
 * Samurai" posting "Katy Perry - Last Friday Night" at exactly the right length
 * passes both. In a guessing game the wrong recording is a wrong answer.
 */
const isOfficial = (channel, artist) =>
  /-\s*topic$/i.test(channel.trim()) ||
  /vevo/i.test(channel) ||
  normalize(channel).includes(normalize(artist))

export async function pickBestVideo(apiKey, { title, artist, trackSeconds }, { requireOfficial = false } = {}) {
  const candidates = await searchVideos(apiKey, { title, artist })
  if (!candidates.length) return null

  const lengths = await videoDurations(apiKey, candidates.map((c) => c.videoId))
  const scored = []

  for (const candidate of candidates) {
    if (!describesTrack(candidate, { title, artist })) continue

    const seconds = lengths.get(candidate.videoId)
    if (!seconds) continue
    if (trackSeconds && (seconds < trackSeconds * MIN_RATIO || seconds > trackSeconds * MAX_RATIO + 60)) {
      continue
    }

    // oEmbed last: it is the slowest gate and the cheapest to skip.
    if (!(await oembed(candidate.videoId))) continue

    scored.push({
      ...candidate,
      seconds,
      gap: trackSeconds ? Math.abs(seconds - trackSeconds) : 0,
      isTopic: /-\s*topic$/i.test(candidate.channel.trim()),
      official: isOfficial(candidate.channel, artist),
    })
  }

  // Official uploads are considered as a group first, and only then by length —
  // not blended into one score. Blending would let a fan upload that happens to
  // match the runtime beat the rightsholder's own audio, which is the wrong
  // trade: an unofficial upload may be a different recording entirely.
  const official = scored.filter((c) => c.official)
  const pool = official.length ? official : requireOfficial ? [] : scored
  if (!pool.length) return null

  // Within the pool, closest to the recording wins — that is what finds the
  // audio upload rather than the music video. Near-equal lengths go to the
  // Topic upload, which is audio by construction.
  pool.sort((a, b) => (Math.abs(a.gap - b.gap) <= 3 ? Number(b.isTopic) - Number(a.isTopic) : a.gap - b.gap))
  return pool[0]
}
