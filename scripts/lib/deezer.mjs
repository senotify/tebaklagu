// Shared Deezer helpers for the build-time scripts.
// Deezer allows 50 requests per 5 seconds per IP, so every call goes through
// a small throttle rather than firing in parallel.

const MIN_INTERVAL_MS = 150
let lastCall = 0

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function api(path) {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastCall = Date.now()

  const res = await fetch('https://api.deezer.com' + path)
  if (!res.ok) throw new Error(`Deezer ${res.status} for ${path}`)
  const body = await res.json()

  // Deezer signals quota errors in the body with HTTP 200
  if (body.error) {
    const { code, message } = body.error
    if (code === 4) {
      await sleep(5000)
      return api(path)
    }
    throw new Error(`Deezer error ${code}: ${message} (${path})`)
  }
  return body
}

/** Strip accents, punctuation and case so "P!nk" and "Pink" compare equal. */
export function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Chart endpoints omit `readable` entirely, so only an explicit false means
// the track can't be played — requiring the field drops every chart result.
export const isPlayable = (t) => Boolean(t?.preview) && t?.readable !== false

export const topTracks = (artistId, limit) =>
  api(`/artist/${artistId}/top?limit=${limit}`).then((r) => (r.data ?? []).filter(isPlayable))

/** Whether a search result is plausibly the artist that was asked for. */
export function namesMatch(requested, found) {
  const a = normalize(requested)
  const b = normalize(found)
  if (a === b) return true
  // "The Black Eyed Peas" vs "Black Eyed Peas" — allow one to contain the other,
  // but only when the shorter side is substantial enough to mean something.
  const shorter = a.length <= b.length ? a : b
  return shorter.length >= 4 && (a.includes(b) || b.includes(a))
}

/**
 * Is this a version other than the song everyone knows? Judged on the bracketed
 * parts of the title only — "(GAMEBOYS RMX) (Radio Edit)", "(Soul Seekerz Radio
 * Edit)", "(Live)" — while a plain "(Radio Edit)" of the original is fine.
 */
function isAlternateVersion(title) {
  return (title.match(/[([][^)\]]*[)\]]/g) ?? []).some((part) => {
    const p = part.slice(1, -1).trim().toLowerCase()
    if (/\b(remix|rmx|mix|live|acoustic|karaoke|instrumental|cover|sped up|slowed|demo|tribute)\b/.test(p)) return true
    return /\bedit\b/.test(p) && !/^(radio|single) edit$/.test(p)
  })
}

/**
 * Finds one specific song, for hand-picked lists. Search results mix in remixes,
 * karaoke and tribute uploads, so only the named artist's own recording of that
 * exact title is accepted; among those, the most-played version wins, which is
 * almost always the original single.
 */
export async function findSong(artist, title) {
  const { data = [] } = await api(
    '/search?q=' + encodeURIComponent(`${artist} ${title}`) + '&limit=25',
  )
  const bareTitle = (s) => normalize(s.replace(/\s*[([].*$/, ''))
  return (
    data
      .filter(isPlayable)
      .filter((t) => namesMatch(artist, t.artist.name))
      .filter((t) => bareTitle(t.title) === bareTitle(title))
      .filter((t) => !isAlternateVersion(t.title))
      .sort((a, b) => b.rank - a.rank)[0] ?? null
  )
}

/**
 * Deezer's artist search returns tribute acts, fan uploads and duplicate artist
 * pages that hold no tracks at all — "Peterpan" and "NOAH" both resolve to ids
 * whose top-track list is empty. So candidates must both look like the artist
 * asked for and actually have playable tracks.
 *
 * Crucially, a candidate whose name does NOT match is never accepted, however
 * popular it is. Deezer's fuzzy search puts big names next to small ones, and
 * "D'MASIV" happily returns the French rapper Damso with five million fans;
 * silently swapping in the wrong artist poisons a whole playlist, so an
 * unresolvable name is reported instead. Use ARTIST_OVERRIDES for the genuine
 * cases where the catalog name differs.
 */
export async function resolveArtist(name, minTracks = 3) {
  const { data = [] } = await api('/search/artist?q=' + encodeURIComponent(name) + '&limit=10')

  const candidates = data
    .filter((a) => namesMatch(name, a.name))
    .sort((a, b) => b.nb_fan - a.nb_fan)

  for (const artist of candidates) {
    const tracks = await topTracks(artist.id, 5)
    if (tracks.length >= minTracks) return { ...artist, sampleTracks: tracks.map((t) => t.title) }
  }
  return null
}
