// Replaces mapped videos that don't start with the music.
//
//   YT_API_KEY=... node scripts/remap-intros.mjs [--dry-run] [--limit N]
//
// Intro mode plays the first seconds from 0:00, which is fine for an audio
// upload and useless for an official music video: "God's Plan" runs 5:57
// against a 3:19 recording, and the difference is two and a half minutes of
// short film before a note is played. Thriller opens with a horror-movie
// monologue. The player hears dialogue and spends guesses on it.
//
// A video running much longer than its recording is the tell, so this walks the
// catalog for that shape and asks pickBestVideo for something closer to the
// track's real length — which is how it finds the "Artist - Topic" audio
// uploads. A song that genuinely runs long (Hey Jude, Master of Puppets) has a
// ratio near 1.0 and is never touched.
//
// Results go to youtube-remaps.json rather than youtube-seed.json: these are
// machine-picked, and mixing them into the hand-verified seeds would make a bad
// automated write indistinguishable from a human decision.

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { api } from './lib/deezer.mjs'
import { pickBestVideo, QuotaError } from './lib/youtube.mjs'

const OUT_DIR = new URL('../src/data/generated/', import.meta.url)
const REMAP_FILE = new URL('./youtube-remaps.json', import.meta.url)
const YT_KEY = process.env.YT_API_KEY
const dryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.indexOf('--limit')
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

if (!YT_KEY) throw new Error('YT_API_KEY is required')

/**
 * Above this, the video carries something the recording does not — an intro, a
 * skit, a short film. Below it, the difference is a fade or a count-in.
 */
const SUSPECT_RATIO = 1.5
/**
 * A replacement has to be meaningfully closer, not marginally. Swapping a 1.7x
 * video for a 1.6x one churns the catalog and fixes nothing.
 */
const MIN_IMPROVEMENT = 30

const remaps = JSON.parse(await readFile(REMAP_FILE, 'utf8').catch(() => '{}'))

// One entry per Deezer track, since the same track appears in several lists.
const mapped = new Map()
for (const file of await readdir(OUT_DIR)) {
  if (!file.endsWith('.json') || file === 'index.json') continue
  const parsed = JSON.parse(await readFile(new URL(file, OUT_DIR), 'utf8'))
  const tracks = file === 'daily-schedule.json' ? Object.values(parsed) : (parsed.tracks ?? [])
  for (const track of tracks) {
    if (track?.youtubeId && track.ytDuration) mapped.set(track.id, track)
  }
}

console.log(`${mapped.size} mapped tracks; measuring against their recordings`)

const suspects = []
for (const track of mapped.values()) {
  const { duration } = await api(`/track/${track.id}`)
  if (!duration) continue
  const ratio = track.ytDuration / duration
  if (ratio > SUSPECT_RATIO) suspects.push({ ...track, trackSeconds: duration, ratio })
}

suspects.sort((a, b) => b.ratio - a.ratio)
console.log(`\n${suspects.length} videos run more than ${SUSPECT_RATIO}x their recording:`)
for (const s of suspects) {
  console.log(`  ${s.ratio.toFixed(1)}x  ${s.title} — ${s.artist} (${s.ytDuration}s vs ${s.trackSeconds}s)`)
}

const replaced = []
const kept = []
let quotaGone = false

for (const suspect of suspects.slice(0, limit)) {
  if (quotaGone) break
  if (remaps[String(suspect.id)]?.videoId) continue // already handled by an earlier run

  let best
  try {
    // Official only: the incumbent video is at least the right recording, just
    // preceded by film. Trading it for a fan upload that might be a cover would
    // fix the intro and break the answer.
    best = await pickBestVideo(
      YT_KEY,
      { title: suspect.title, artist: suspect.artist, trackSeconds: suspect.trackSeconds },
      { requireOfficial: true },
    )
  } catch (err) {
    if (!(err instanceof QuotaError)) throw err
    console.log('\n! YouTube quota exhausted; run again tomorrow for the rest')
    quotaGone = true
    break
  }

  const oldGap = Math.abs(suspect.ytDuration - suspect.trackSeconds)
  if (!best || best.videoId === suspect.youtubeId || oldGap - best.gap < MIN_IMPROVEMENT) {
    kept.push(`${suspect.title} — ${suspect.artist}: nothing materially closer found`)
    continue
  }

  remaps[String(suspect.id)] = { videoId: best.videoId, seconds: best.seconds }
  replaced.push(
    `${suspect.title} — ${suspect.artist}\n` +
      `      was ${suspect.youtubeId} (${suspect.ytDuration}s, ${suspect.ratio.toFixed(1)}x)\n` +
      `      now ${best.videoId} (${best.seconds}s) [${best.channel}]`,
  )
}

console.log(`\nreplaced ${replaced.length}:`)
for (const line of replaced) console.log(`  + ${line}`)
console.log(`\nkept ${kept.length}:`)
for (const line of kept) console.log(`  = ${line}`)

if (!dryRun && replaced.length) {
  await writeFile(REMAP_FILE, JSON.stringify(remaps, null, 2) + '\n')
  console.log(`\nwrote ${REMAP_FILE.pathname} — run catalog:build to apply`)
} else if (dryRun) {
  console.log('\n(dry run — nothing written)')
}
