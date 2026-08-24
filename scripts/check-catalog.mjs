// Invariant checks over the generated catalog. Run after `catalog:build`.
//
// The important one: the daily song must be identical for Hook and Intro
// players. That only holds if either every track in the daily pool is playable
// in both modes, or Intro mode is switched off for the daily entirely.

import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const DIR = new URL('../src/data/generated/', import.meta.url)
const read = async (name) => JSON.parse(await readFile(new URL(name, DIR), 'utf8'))

const index = await read('index.json')
const daily = await read('daily-pool.json')

// Index and files agree
for (const info of index.playlists) {
  const { tracks } = await read(`${info.id}.json`)
  assert.equal(tracks.length, info.count, `${info.id}: index count disagrees with file`)
  assert.equal(
    tracks.filter((t) => t.youtubeId).length,
    info.introCount,
    `${info.id}: index introCount disagrees with file`,
  )
}
assert.equal(daily.tracks.length, index.daily.count, 'daily: index count disagrees with file')
assert.equal(index.daily.bothModes, daily.bothModes, 'daily: bothModes disagrees with file')

// The daily invariant
if (index.daily.bothModes) {
  const missing = daily.tracks.filter((t) => !t.youtubeId)
  assert.equal(
    missing.length,
    0,
    `daily claims both modes but ${missing.length} tracks have no YouTube id — ` +
      'Hook and Intro players would get different songs',
  )
} else {
  assert.equal(
    index.daily.introCount < 100,
    true,
    'daily has enough intro tracks to switch to bothModes but did not',
  )
}

// No track is unplayable in the mode its playlist claims to support
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
for (const info of index.playlists) {
  const { tracks } = await read(`${info.id}.json`)
  assert.ok(tracks.every((t) => t.id && t.title && t.artist), `${info.id}: incomplete track record`)
  // Preview URLs must never be committed — they expire after ~15 minutes.
  assert.ok(
    tracks.every((t) => !('preview' in t)),
    `${info.id}: a preview URL was baked into the catalog`,
  )
  // A malformed id would leave the intro player dead on that round.
  const malformed = tracks.filter((t) => t.youtubeId && !VIDEO_ID.test(t.youtubeId))
  assert.equal(
    malformed.length,
    0,
    `${info.id}: malformed YouTube ids — ${malformed.map((t) => t.youtubeId).join(', ')}`,
  )
  // Without a known length the player can't tell the song from a pre-roll ad, so
  // an id that has one is the price of admission to intro mode.
  const unmeasured = tracks.filter((t) => t.youtubeId && !(t.ytDuration > 0))
  assert.equal(
    unmeasured.length,
    0,
    `${info.id}: ${unmeasured.length} YouTube ids have no ytDuration — intro mode ` +
      'could not detect an ad on those tracks',
  )
}

// The daily schedule is what actually gets served
const schedule = await read('daily-schedule.json')
const dates = Object.keys(schedule).sort()
assert.ok(dates.length > 0, 'daily schedule is empty')

const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const upcoming = dates.filter((d) => d >= today)
assert.ok(upcoming.length >= 30, `only ${upcoming.length} days scheduled from today — rebuild`)

for (const [date, track] of Object.entries(schedule)) {
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/, `bad date key ${date}`)
  assert.ok(track?.id && track.title && track.artist, `${date}: incomplete scheduled track`)
  assert.ok(!('preview' in track), `${date}: a preview URL was baked into the schedule`)
  assert.ok(
    !track.youtubeId || track.ytDuration > 0,
    `${date}: scheduled track has a YouTube id but no ytDuration`,
  )
}

// Consecutive days must not repeat, and a month should feel varied
const firstMonth = upcoming.slice(0, 30).map((d) => schedule[d].id)
for (let i = 1; i < firstMonth.length; i++) {
  assert.notEqual(firstMonth[i], firstMonth[i - 1], 'the same song is scheduled two days running')
}
assert.ok(
  new Set(firstMonth).size >= 28,
  `next 30 days hold only ${new Set(firstMonth).size} distinct songs`,
)

// Intro readiness must reflect the schedule, since that is what players get
const scheduledAhead = upcoming.map((d) => schedule[d])
assert.equal(
  index.daily.bothModes,
  scheduledAhead.every((t) => t.youtubeId),
  'daily bothModes disagrees with what is actually scheduled',
)
const picks = new Set(firstMonth)

// A playlist is only offered in intro mode above this many mapped tracks; it
// must match MIN_INTRO_TRACKS in src/data/playlists.ts.
const MIN_INTRO_TRACKS = 30
const introReady = index.playlists.filter((p) => p.introCount >= MIN_INTRO_TRACKS)

console.log(
  `catalog ok — ${index.playlists.length} playlists, ${index.daily.count} daily tracks, ` +
    `bothModes=${index.daily.bothModes}, ${picks.size}/30 distinct daily songs`,
)
console.log(
  introReady.length
    ? `intro mode: ${introReady.map((p) => `${p.id} (${p.introCount})`).join(', ')}`
    : 'intro mode: no playlist has reached 30 mapped tracks yet',
)
