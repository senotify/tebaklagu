// Builds the committed track lists in src/data/generated/ from sources.mjs.
//
//   node scripts/build-playlists.mjs [playlist...] [--dry-run] [--no-search]
//
// Preview URLs are deliberately NOT baked in: Deezer signs them with a token
// that expires after ~15 minutes, so the app fetches a fresh one per round.
// Only stable fields (id, title, artist, cover) are written here.
//
// YouTube ids power Intro mode and need YT_API_KEY (YouTube Data API v3, free).
// Without the key the build still succeeds and Intro mode is simply unavailable
// for the affected tracks. Search costs 100 quota units of the 10,000/day
// default, so roughly 100 new tracks can be mapped per day; ids already present
// in the generated files are reused rather than looked up again.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { api, isPlayable, normalize, topTracks } from './lib/deezer.mjs'
import { pickBestVideo, QuotaError, videoDurations } from './lib/youtube.mjs'
import { DAILY_POOL, PLAYLISTS } from './sources.mjs'

const OUT_DIR = new URL('../src/data/generated/', import.meta.url)
/** How far ahead daily songs are assigned. Roughly a year. */
const SCHEDULE_DAYS = 400
const YT_KEY = process.env.YT_API_KEY
const dryRun = process.argv.includes('--dry-run')
// Search is metered separately from everything else — a few hundred queries a
// day, whatever the unit budget says — and prefer-audio.mjs needs that same
// allowance to find Topic channels, which is worth far more per query (one
// search maps an artist's whole catalogue, against one track here). So a build
// can be told to map nothing new and just reuse what is already known.
const noSearch = process.argv.includes('--no-search')
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const artistIds = JSON.parse(
  await readFile(new URL('./artist-ids.json', import.meta.url), 'utf8'),
)

/** Same song twice (remaster, re-release, "Perih (Perih)") is a bad round. */
function dedupe(tracks) {
  const best = new Map()
  for (const t of tracks) {
    const key = `${t.artist.id}::${normalize(t.title.replace(/\s*[([].*$/, ''))}`
    const prev = best.get(key)
    if (!prev || t.rank > prev.rank) best.set(key, t)
  }
  return [...best.values()]
}

async function collect(name, spec) {
  const tracks = []

  for (const artistName of spec.artists ?? []) {
    const entry = artistIds[artistName]
    if (!entry) {
      console.log(`   ! ${artistName}: no id, run resolve-artists.mjs`)
      continue
    }
    tracks.push(...(await topTracks(entry.id, spec.tracksPerArtist ?? 8)))
  }

  for (const genre of spec.charts ?? []) {
    const { data = [] } = await api(`/chart/${genre}/tracks?limit=${spec.chartLimit ?? 100}`)
    tracks.push(...data.filter(isPlayable))
  }

  return dedupe(tracks).sort((a, b) => b.rank - a.rank)
}

const seed = JSON.parse(await readFile(new URL('./youtube-seed.json', import.meta.url), 'utf8'))

// Replacements found by remap-intros.mjs for videos that didn't start with the
// music. They outrank the hand seeds because that is exactly what several of
// them are fixing — Thriller and Telephone were seeded by hand as music videos.
const remaps = JSON.parse(
  await readFile(new URL('./youtube-remaps.json', import.meta.url), 'utf8').catch(() => '{}'),
)

// videoId -> length in seconds. Committed, so a build without a key still knows
// the lengths of every id mapped so far. Intro mode needs this at runtime to
// tell the song apart from a pre-roll ad (see videoDurations).
const durationFile = new URL('./youtube-durations.json', import.meta.url)
const durations = new Map(
  Object.entries(JSON.parse(await readFile(durationFile, 'utf8').catch(() => '{}'))),
)
let durationsChanged = false

// remap-intros measured each replacement when it picked it, so those lengths are
// already known — taking them from the file avoids a needless lookup, and avoids
// the replacement being dropped as "length unknown" when the quota is spent.
for (const entry of Object.values(remaps)) {
  if (entry?.videoId && entry.seconds && !durations.has(entry.videoId)) {
    durations.set(entry.videoId, entry.seconds)
    durationsChanged = true
  }
}

await mkdir(OUT_DIR, { recursive: true })
const names = only.length ? only : Object.keys(PLAYLISTS)
const summary = []
let quotaGone = false

/** A single non-id in a batch makes videos.list reject the whole request. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * Could a video of this length plausibly be this track?
 *
 * Search happily returns "full album" uploads and hour-long compilations for a
 * song title, and oEmbed can't tell those from the song — it only confirms a
 * video exists and embeds. Intro mode would then play the opening of an album:
 * "Orang Gila — Iwan Fals" resolved to a 1994 full-album upload this way.
 *
 * The upper bound is deliberately generous, because a music video can honestly
 * run much longer than its recording — Thriller is 13:42 against a 5:57 track —
 * whereas an album runs ten times over.
 */
const lengthAgrees = (videoSeconds, trackSeconds) =>
  !trackSeconds || (videoSeconds >= trackSeconds * 0.5 && videoSeconds <= trackSeconds * 2.5 + 60)

/** Deezer track ids whose video was rejected, so the schedule can drop it too. */
const rejected = new Set()

/** Fills in any lengths we don't have yet, when a key is available. */
async function ensureDurations(videoIds) {
  const missing = [
    ...new Set(videoIds.filter((id) => VIDEO_ID.test(id ?? '') && !durations.has(id))),
  ]
  if (!missing.length || !YT_KEY || quotaGone) return

  try {
    for (const [id, seconds] of await videoDurations(YT_KEY, missing)) {
      durations.set(id, seconds)
      durationsChanged = true
    }
  } catch (err) {
    if (!(err instanceof QuotaError)) throw err
    console.log('   ! YouTube quota exhausted while reading video lengths')
    quotaGone = true
  }
}

// Lengths are looked up before any searching. Search costs 100 units against
// videos.list's 1, so a search run that exhausts the quota partway must not
// leave already-mapped ids unmeasured — the build drops those from intro mode,
// which would quietly empty the catalog it took days of quota to fill.
{
  const known = new Set(Object.values(seed))
  for (const name of Object.keys(PLAYLISTS)) {
    const { tracks = [] } = JSON.parse(
      await readFile(new URL(`${name}.json`, OUT_DIR), 'utf8').catch(() => '{"tracks":[]}'),
    )
    for (const t of tracks) if (t.youtubeId) known.add(t.youtubeId)
  }
  const previousSchedule = JSON.parse(
    await readFile(new URL('daily-schedule.json', OUT_DIR), 'utf8').catch(() => '{}'),
  )
  for (const t of Object.values(previousSchedule)) if (t.youtubeId) known.add(t.youtubeId)

  const before = durations.size
  await ensureDurations([...known])
  console.log(`== video lengths: ${durations.size} known (+${durations.size - before})`)
}

for (const name of names) {
  const spec = PLAYLISTS[name]
  if (!spec) throw new Error(`Unknown playlist "${name}"`)

  console.log(`\n== ${name} (${spec.title})`)
  const raw = await collect(name, spec)

  const outFile = new URL(`${name}.json`, OUT_DIR)
  const previous = JSON.parse(await readFile(outFile, 'utf8').catch(() => '{"tracks":[]}'))
  const knownYt = new Map(previous.tracks.map((t) => [t.id, t.youtubeId]).filter(([, v]) => v))

  const drafts = []
  for (const t of raw) {
    // Audio remaps win, then hand-verified seeds, then ids from the previous
    // build, then a fresh search. Only newly found ids need vetting — the
    // others were vetted once.
    let yt = remaps[String(t.id)]?.videoId ?? seed[String(t.id)] ?? knownYt.get(t.id) ?? null

    if (!yt && YT_KEY && !quotaGone && !noSearch) {
      try {
        // Ranks the search results by how close each runs to the recording, so
        // an audio upload beats the music video and its unplayable intro.
        const found = await pickBestVideo(YT_KEY, {
          title: t.title,
          artist: t.artist.name,
          trackSeconds: t.duration,
        })
        if (found) {
          yt = found.videoId
          // Keep the length the search already measured. Without this the id
          // waits on a later videos.list call, and if the quota dies in between
          // the build drops it as "length unknown" — throwing away a mapping it
          // had already paid 100 units for.
          durations.set(found.videoId, found.seconds)
          durationsChanged = true
        }
      } catch (err) {
        if (!(err instanceof QuotaError)) throw err
        console.log('   ! YouTube quota exhausted; remaining tracks are Hook-mode only')
        quotaGone = true
      }
    }
    drafts.push({
      id: t.id,
      title: t.title,
      artist: t.artist.name,
      cover: t.album.cover_medium,
      yt,
      trackSeconds: t.duration,
    })
  }

  await ensureDurations(drafts.map((d) => d.yt))

  // An id whose length we don't know can't be checked against an ad at runtime,
  // so it doesn't get to enter intro mode. Better a smaller intro catalog than
  // rounds that play an advertisement.
  let unmeasured = 0
  const mismatched = []
  const tracks = drafts.map(({ yt, trackSeconds, ...rest }) => {
    const seconds = yt ? durations.get(yt) : null
    if (yt && !seconds) unmeasured++

    if (yt && seconds && !lengthAgrees(seconds, trackSeconds)) {
      mismatched.push(`${rest.title} — ${rest.artist} (${seconds}s vs ${trackSeconds}s)`)
      rejected.add(rest.id)
      return rest
    }

    return { ...rest, ...(yt && seconds ? { youtubeId: yt, ytDuration: seconds } : {}) }
  })

  const withYt = tracks.filter((t) => t.youtubeId).length
  console.log(`   ${tracks.length} tracks, ${withYt} with YouTube ids`)
  if (unmeasured) console.log(`   ! ${unmeasured} ids dropped: length unknown, run again with YT_API_KEY`)
  for (const line of mismatched) console.log(`   ! dropped, length disagrees: ${line}`)
  console.log(tracks.slice(0, 12).map((t) => `     ${t.title} — ${t.artist}`).join('\n'))

  if (!dryRun) {
    const payload = { title: spec.title, emoji: spec.emoji, tracks }
    await writeFile(outFile, JSON.stringify(payload, null, 2) + '\n')
  }
  summary.push({ name, total: tracks.length, withYt })
}

// The daily song must be the same in both clip modes, so the pool only takes
// tracks that are playable either way. Without any YouTube ids we fall back to
// Hook-mode-only tracks so daily still works.
let dailySummary = null
if (!only.length) {
  const pool = []
  for (const name of DAILY_POOL) {
    const { tracks } = JSON.parse(await readFile(new URL(`${name}.json`, OUT_DIR), 'utf8'))
    pool.push(...tracks)
  }
  const introCapable = pool.filter((t) => t.youtubeId)
  // Only narrow the pool once there are enough intro-capable tracks to carry the
  // daily on their own; a mixed pool would give the two modes different songs.
  const useBothModes = introCapable.length >= 100
  const chosen = useBothModes ? introCapable : pool
  // Stable order so the date-seeded pick is reproducible across builds.
  chosen.sort((a, b) => a.id - b.id)

  dailySummary = {
    id: 'daily-pool',
    title: 'Tantangan Harian',
    emoji: '📅',
    count: chosen.length,
    introCount: chosen.filter((t) => t.youtubeId).length,
    // True only when every track in the pool works in either mode, which is
    // what lets the daily song be identical for Hook and Intro players.
    bothModes: useBothModes,
  }

  // The date-seeded pick used to index into the pool, which meant every rebuild
  // reshuffled the daily — the same date landing on a different song as the
  // catalog grew. So assignments are frozen in a committed schedule: existing
  // dates are never touched, only unassigned future dates get filled in, and
  // each entry carries the whole track so catalog drift can't disturb it.
  const scheduleFile = new URL('daily-schedule.json', OUT_DIR)
  const schedule = JSON.parse(await readFile(scheduleFile, 'utf8').catch(() => '{}'))
  const before = Object.keys(schedule).length

  // Entries frozen by earlier builds carry no ytDuration, and re-picking them
  // would change which song a date plays. So the YouTube fields are patched in
  // place: the scheduled track stays put, it just loses intro mode when its
  // length can't be established.
  await ensureDurations(Object.values(schedule).map((t) => t.youtubeId))
  const todayWib = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
  let redrawn = 0

  for (const entry of Object.values(schedule)) {
    if (!entry.youtubeId) continue
    const seconds = durations.get(entry.youtubeId)
    // A video the catalog just rejected must not survive here either, or the
    // daily would keep serving the album upload the playlists dropped.
    if (seconds && !rejected.has(entry.id)) {
      entry.ytDuration = seconds
      continue
    }

    delete entry.youtubeId
  }

  // Losing one track's video would otherwise take intro mode away from every
  // daily, since the mode is only offered when the whole schedule supports it.
  // A date still in the future can simply be re-drawn — nobody has played it, so
  // the freeze has nothing to protect there. Today and every past date stay put:
  // those results are already out in the world.
  if (useBothModes) {
    for (const [date, entry] of Object.entries(schedule)) {
      if (entry.youtubeId || date <= todayWib) continue
      delete schedule[date]
      redrawn++
    }
  }
  if (redrawn) console.log(`   ${redrawn} future dates re-drawn after losing their video`)

  // Deterministic shuffle so a given pool always fills dates the same way.
  let seed = 0x9e3779b9
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const shuffled = [...chosen]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const alreadyUsed = new Set(Object.values(schedule).map((t) => t.id))
  const startOfToday = Date.now() + 7 * 3600e3 // WIB
  let cursor = 0
  let filled = 0

  for (let day = 0; day < SCHEDULE_DAYS; day++) {
    const date = new Date(startOfToday + day * 86400e3).toISOString().slice(0, 10)
    if (schedule[date]) continue

    // Prefer a song not scheduled before; once the pool is used up, allow reuse.
    let pick = null
    for (let n = 0; n < shuffled.length; n++) {
      const candidate = shuffled[(cursor + n) % shuffled.length]
      if (!alreadyUsed.has(candidate.id)) {
        pick = candidate
        cursor = (cursor + n + 1) % shuffled.length
        break
      }
    }
    if (!pick) {
      pick = shuffled[cursor % shuffled.length]
      cursor = (cursor + 1) % shuffled.length
    }

    schedule[date] = pick
    alreadyUsed.add(pick.id)
    filled++
  }

  // Intro mode for the daily depends on what is actually scheduled, not on the
  // pool it was drawn from.
  const scheduledFrom = Object.entries(schedule)
    .filter(([date]) => date >= new Date(startOfToday).toISOString().slice(0, 10))
    .map(([, track]) => track)
  dailySummary.bothModes = scheduledFrom.length > 0 && scheduledFrom.every((t) => t.youtubeId)
  dailySummary.scheduledDays = Object.keys(schedule).length

  if (!dryRun) {
    await writeFile(scheduleFile, JSON.stringify(schedule, null, 2) + '\n')
    await writeFile(
      new URL('daily-pool.json', OUT_DIR),
      JSON.stringify({ ...dailySummary, tracks: chosen }, null, 2) + '\n',
    )
  }
  console.log(
    `\n== daily-schedule: ${before} kept, ${filled} newly assigned, ` +
      `${Object.keys(schedule).length} days total`,
  )
  console.log(
    `== daily-pool: ${chosen.length} tracks (${dailySummary.bothModes ? 'schedule playable in both modes' : 'schedule is Hook mode only'})`,
  )
}

// A small index lets the home screen render counts without pulling every track
// list into the initial bundle; the lists themselves are imported on demand.
if (!only.length && !dryRun) {
  const playlists = Object.entries(PLAYLISTS).map(([id, spec]) => {
    const found = summary.find((s) => s.name === id)
    return { id, title: spec.title, emoji: spec.emoji, count: found.total, introCount: found.withYt }
  })
  // The daily pool gets its own entry: its intro readiness is a property of the
  // pool itself, not something derivable by summing the other playlists.
  await writeFile(
    new URL('index.json', OUT_DIR),
    JSON.stringify({ playlists, daily: dailySummary }, null, 2) + '\n',
  )
}

if (durationsChanged && !dryRun) {
  const sorted = Object.fromEntries([...durations].sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(durationFile, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`\n== youtube-durations: ${durations.size} video lengths known`)
}

console.log('\n' + summary.map((s) => `  ${s.name.padEnd(16)} ${String(s.total).padStart(4)} tracks  ${s.withYt} yt`).join('\n'))
if (dryRun) console.log('\n(dry run — nothing written)')
