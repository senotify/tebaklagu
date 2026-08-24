// Adds a hand-picked YouTube id to scripts/youtube-seed.json, after checking
// with oEmbed that the video exists and reporting its real title so a wrong id
// is obvious. Useful without a YouTube Data API key.
//
//   node scripts/add-youtube-id.mjs 4091937401 fJ9rUzIMcZQ
//   node scripts/add-youtube-id.mjs --check          (re-check every seed)

import { readFile, writeFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { oembed } from './lib/youtube.mjs'

const SEED = new URL('./youtube-seed.json', import.meta.url)
const GENERATED = new URL('../src/data/generated/', import.meta.url)

const seed = JSON.parse(await readFile(SEED, 'utf8'))

/** Finds a track in the generated catalog so its title can be shown. */
async function findTrack(deezerId) {
  const files = (await readdir(GENERATED)).filter((f) => f.endsWith('.json') && f !== 'index.json')
  for (const file of files) {
    const { tracks } = JSON.parse(await readFile(new URL(file, GENERATED), 'utf8'))
    const hit = tracks.find((t) => String(t.id) === String(deezerId))
    if (hit) return hit
  }
  return null
}

const args = process.argv.slice(2)

if (args[0] === '--check') {
  for (const [deezerId, videoId] of Object.entries(seed)) {
    if (deezerId.startsWith('_')) continue
    const info = await oembed(videoId)
    const track = await findTrack(deezerId)
    const label = track ? `${track.title} — ${track.artist}` : '(not in catalog)'
    console.log(
      info
        ? `  ok   ${videoId}  ${label.padEnd(42)} -> "${info.title.slice(0, 40)}" by ${info.author_name}`
        : `  DEAD ${videoId}  ${label}`,
    )
  }
  process.exit(0)
}

const [deezerId, videoId] = args
if (!deezerId || !videoId) {
  console.error('usage: node scripts/add-youtube-id.mjs <deezerTrackId> <youtubeVideoId>')
  process.exit(1)
}

const info = await oembed(videoId)
if (!info) {
  console.error(`${videoId} is not playable via oEmbed — wrong id, private, or embedding disabled`)
  process.exit(1)
}

const track = await findTrack(deezerId)
if (!track) console.warn(`warning: ${deezerId} is not in the generated catalog`)
else console.log(`catalog: ${track.title} — ${track.artist}`)
console.log(`youtube: "${info.title}" by ${info.author_name}`)

seed[deezerId] = videoId
await writeFile(SEED, JSON.stringify(seed, null, 2) + '\n')
console.log(`\nsaved. run "npm run catalog:build" to fold it into the track lists.`)
