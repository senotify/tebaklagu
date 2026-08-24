// Adds hand-picked YouTube ids to scripts/youtube-seed.json, verifying each one
// before it is allowed in.
//
//   node scripts/seed-batch.mjs scripts/seed-candidates.json [--dry-run]
//
// Why this exists: mapping a track by Data API search costs 100 quota units, so
// only ~100 tracks map per day. Naming a candidate id by hand costs nothing, but
// an unchecked guess is worse than no mapping at all — earlier rounds of this
// produced a Sinéad O'Connor video for "Mockingbird" and a Russian cartoon for
// "Here Comes The Sun". So every candidate has to clear three gates:
//
//   1. it matches a track actually in the catalog
//   2. oEmbed (keyless) returns a title and channel that name the right song
//   3. its length agrees with the Deezer recording, which is what catches the
//      "full album" uploads that gate 2 happily waves through
//
// Gate 3 needs YT_API_KEY, but videos.list costs 1 unit per 50 ids — nothing
// like the search budget, and it draws on a separate daily limit besides.

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { api, normalize } from './lib/deezer.mjs'
import { oembed, videoDurations } from './lib/youtube.mjs'

const OUT_DIR = new URL('../src/data/generated/', import.meta.url)
const SEED_FILE = new URL('./youtube-seed.json', import.meta.url)
const YT_KEY = process.env.YT_API_KEY
const dryRun = process.argv.includes('--dry-run')
const listPath = process.argv[2]

if (!listPath) throw new Error('usage: node scripts/seed-batch.mjs <candidates.json> [--dry-run]')
if (!YT_KEY) throw new Error('YT_API_KEY is required to check video lengths')

const candidates = JSON.parse(await readFile(listPath, 'utf8')).filter((c) => c.videoId)
const seed = JSON.parse(await readFile(SEED_FILE, 'utf8'))

// Every track in the catalog, so a candidate can be matched to a real Deezer id.
const catalog = []
for (const file of await readdir(OUT_DIR)) {
  if (!file.endsWith('.json') || file === 'index.json' || file === 'daily-schedule.json') continue
  const { tracks = [] } = JSON.parse(await readFile(new URL(file, OUT_DIR), 'utf8'))
  for (const track of tracks) catalog.push({ playlist: file.replace('.json', ''), ...track })
}

/** Same normalisation the game uses, so "Song (Remastered 2011)" matches "Song". */
const key = (value) => normalize(String(value).replace(/\s*[([].*$/, ''))

function findTrack({ artist, title }) {
  const wantArtist = key(artist)
  const wantTitle = key(title)
  const matches = catalog.filter((t) => {
    const haveArtist = key(t.artist)
    if (haveArtist !== wantArtist && !haveArtist.includes(wantArtist)) return false
    const haveTitle = key(t.title)
    return haveTitle === wantTitle || haveTitle.startsWith(wantTitle)
  })
  // Prefer one that isn't mapped yet; otherwise the first, so re-running is safe.
  return matches.find((t) => !t.youtubeId) ?? matches[0] ?? null
}

/**
 * Does the video's own title and channel name the song we asked for? Uploaders
 * decorate titles freely ("(Official Video) [4K]"), so this only insists the
 * song title appears somewhere and that the artist shows up in title or channel.
 */
function describesTrack(info, { artist, title }) {
  // Normalised but NOT bracket-stripped: uploaders put the artist after the
  // decoration ("Faint (Official Music Video) [4K UPGRADE] – Linkin Park"), so
  // cutting at the first bracket would throw away the very name being checked.
  const haystack = normalize(`${info.title} ${info.author_name}`)
  return haystack.includes(key(title)) && haystack.includes(key(artist))
}

const accepted = []
const rejected = []

// Lengths for the whole batch in one or two calls rather than one call each.
const lengths = await videoDurations(YT_KEY, [...new Set(candidates.map((c) => c.videoId))])

for (const candidate of candidates) {
  const { artist, title, videoId } = candidate
  const label = `${artist} — ${title}`

  const track = findTrack(candidate)
  if (!track) {
    rejected.push(`${label}: no such track in the catalog`)
    continue
  }
  if (seed[String(track.id)] === videoId) continue // already seeded, nothing to do

  const info = await oembed(videoId)
  if (!info) {
    rejected.push(`${label}: ${videoId} is not embeddable`)
    continue
  }
  if (!describesTrack(info, candidate)) {
    rejected.push(`${label}: ${videoId} is "${info.title}" [${info.author_name}]`)
    continue
  }

  const videoSeconds = lengths.get(videoId)
  if (!videoSeconds) {
    rejected.push(`${label}: ${videoId} has no readable length`)
    continue
  }

  // Deezer's own duration for this recording, fetched fresh — the catalog does
  // not carry it.
  const { duration: trackSeconds } = await api(`/track/${track.id}`)
  if (trackSeconds && (videoSeconds < trackSeconds * 0.5 || videoSeconds > trackSeconds * 2.5 + 60)) {
    rejected.push(`${label}: ${videoId} runs ${videoSeconds}s against a ${trackSeconds}s track`)
    continue
  }

  seed[String(track.id)] = videoId
  accepted.push(`${track.playlist.padEnd(14)} ${track.title} — ${track.artist}  (${videoId})`)
}

console.log(`\naccepted ${accepted.length}:`)
for (const line of accepted) console.log(`  + ${line}`)
console.log(`\nrejected ${rejected.length}:`)
for (const line of rejected) console.log(`  - ${line}`)

if (!dryRun && accepted.length) {
  await writeFile(SEED_FILE, JSON.stringify(seed, null, 2) + '\n')
  console.log(`\nwrote ${SEED_FILE.pathname}`)
} else if (dryRun) {
  console.log('\n(dry run — nothing written)')
}
