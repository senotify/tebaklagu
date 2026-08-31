// Swaps music-video mappings for the artist's own audio upload.
//
//   YT_API_KEY=... node scripts/prefer-audio.mjs [--fill] [--search] [--dry-run]
//
//     --fill    also map tracks that have no video yet
//     --search  spend 100 units per artist to find Topic channels we don't know
//
// remap-intros.mjs only catches videos that run much longer than the recording.
// That misses the common case: a music video roughly the right length that still
// opens on something other than the song. Rihanna's "Don't Stop The Music" is
// 0.88x its recording — the VEVO cut is *shorter* than the album version — so no
// ratio rule would ever flag it, yet intro mode still opens on video, not music.
//
// The fix is to prefer the audio upload outright rather than only when the
// length looks wrong. Searching per track would cost 100 quota units each, tens
// of thousands for the catalog. But YouTube's auto-generated "<Artist> - Topic"
// channels can be *enumerated*: channels.list gives the uploads playlist for 1
// unit, and playlistItems walks it 50 at a time for 1 unit a page. Michael
// Jackson's 1,270 art tracks cost ~26 units this way against ~127,000 by search.
//
// Better still, a Topic channel we already have one mapping from is free to
// identify (videos.list, 1 unit per 50), so most of this runs on pocket change.

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { api, normalize } from './lib/deezer.mjs'
import { QuotaError } from './lib/youtube.mjs'

const OUT_DIR = new URL('../src/data/generated/', import.meta.url)
const REMAP_FILE = new URL('./youtube-remaps.json', import.meta.url)
const CHANNEL_FILE = new URL('./topic-channels.json', import.meta.url)
const YT_KEY = process.env.YT_API_KEY
const dryRun = process.argv.includes('--dry-run')
const doFill = process.argv.includes('--fill')
const doSearch = process.argv.includes('--search')

if (!YT_KEY) throw new Error('YT_API_KEY is required')

const bare = (value) => normalize(String(value).replace(/\s*[([].*$/, ''))
/** A Topic upload should be the recording, so it matches the length closely. */
const LENGTH_TOLERANCE = 12

async function yt(path, params) {
  const url = `https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key: YT_KEY })}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (res.status === 403 || res.status === 429) {
    const body = await res.json().catch(() => ({}))
    const reason = body.error?.errors?.[0]?.reason ?? 'unknown'
    if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded' || res.status === 429) {
      throw new QuotaError(`quota exhausted on ${path} (${reason})`)
    }
    throw new Error(`${path} rejected (${reason})`)
  }
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`)
  return res.json()
}

// ---------------------------------------------------------------- catalog

const tracksById = new Map()
for (const file of await readdir(OUT_DIR)) {
  if (!file.endsWith('.json') || file === 'index.json') continue
  const parsed = JSON.parse(await readFile(new URL(file, OUT_DIR), 'utf8'))
  const list = file === 'daily-schedule.json' ? Object.values(parsed) : (parsed.tracks ?? [])
  for (const t of list) if (t?.id) tracksById.set(t.id, t)
}
const all = [...tracksById.values()]
const mapped = all.filter((t) => t.youtubeId)
console.log(`${all.length} tracks, ${mapped.length} with a video`)

// ------------------------------------------------- which are already audio

/** Batches of 50, 1 quota unit apiece. */
async function videoSnippets(ids) {
  const out = new Map()
  for (let i = 0; i < ids.length; i += 50) {
    const body = await yt('videos', { part: 'snippet,contentDetails', id: ids.slice(i, i + 50).join(',') })
    for (const item of body.items ?? []) out.set(item.id, item)
  }
  return out
}

const snippets = await videoSnippets(mapped.map((t) => t.youtubeId))
const isTopicChannel = (title) => /-\s*topic$/i.test((title ?? '').trim())

/**
 * Does this Topic channel actually belong to the artist asked for?
 *
 * Searching "Rihanna - Topic" returns four channels ending in "- Topic", and
 * they are not all Rihanna. Merging a stranger's catalogue in would let a
 * same-titled song of about the right length be mapped as this artist's — a
 * wrong answer that both the title and length gates would wave through.
 */
const channelBelongsTo = (channelTitle, artist) => {
  const name = normalize(String(channelTitle ?? '').replace(/-\s*topic$/i, ''))
  const want = normalize(artist)
  if (!name || !want) return false
  if (name === want) return true
  const shorter = name.length <= want.length ? name : want
  return shorter.length >= 4 && (name.includes(want) || want.includes(name))
}

const channels = JSON.parse(await readFile(CHANNEL_FILE, 'utf8').catch(() => '{}'))
let channelsChanged = false

/**
 * An artist can have more than one Topic channel — searching "Dua Lipa - Topic"
 * returns two — and the first is not always the fully populated one. So every
 * candidate is kept and their catalogues are merged when matching.
 */
const channelIds = (artist) => {
  const value = channels[artist]
  return Array.isArray(value) ? value : value ? [value] : []
}

const addChannel = (artist, id) => {
  if (!id || channelIds(artist).includes(id)) return
  channels[artist] = [...channelIds(artist), id]
  channelsChanged = true
}

// A mapping already on a Topic channel tells us that artist's channel for free.
for (const track of mapped) {
  const snippet = snippets.get(track.youtubeId)?.snippet
  if (!snippet || !isTopicChannel(snippet.channelTitle)) continue
  addChannel(track.artist, snippet.channelId)
}

const onVideo = mapped.filter((t) => !isTopicChannel(snippets.get(t.youtubeId)?.snippet?.channelTitle))
console.log(`${mapped.length - onVideo.length} already on audio channels, ${onVideo.length} on music videos`)
console.log(`${Object.keys(channels).length} Topic channels known`)

// ------------------------------------------- find channels we still lack

const wanted = [...new Set([...(doFill ? all : onVideo)].map((t) => t.artist))]
const missing = wanted.filter((a) => !channelIds(a).length)

if (doSearch && missing.length) {
  console.log(`\nsearching for ${missing.length} unknown Topic channels (100 units each)`)
  for (const artist of missing) {
    try {
      const body = await yt('search', { part: 'snippet', type: 'channel', maxResults: '5', q: `${artist} - Topic` })
      const hits = (body.items ?? []).filter((i) => {
        const title = i.snippet?.channelTitle ?? i.snippet?.title
        return isTopicChannel(title) && channelBelongsTo(title, artist)
      })
      for (const hit of hits) addChannel(artist, hit.snippet?.channelId ?? hit.id?.channelId)
      if (hits.length) console.log(`   + ${artist} -> ${channelIds(artist).join(', ')}`)
      else console.log(`   - ${artist}: no Topic channel found`)
    } catch (err) {
      if (!(err instanceof QuotaError)) throw err
      console.log('   ! search quota exhausted; run again tomorrow for the rest')
      break
    }
  }
} else if (missing.length) {
  console.log(`\n${missing.length} artists have no known Topic channel — re-run with --search to find them`)
}

// Confirm every cached channel really is this artist's. Ids collected before
// the ownership check existed, or by a looser earlier run, are dropped here —
// 1 quota unit per 50, so verifying the whole cache costs almost nothing.
{
  const ids = [...new Set(Object.values(channels).flat())]
  const titles = new Map()
  for (let i = 0; i < ids.length; i += 50) {
    const body = await yt('channels', { part: 'snippet', id: ids.slice(i, i + 50).join(',') })
    for (const item of body.items ?? []) titles.set(item.id, item.snippet?.title ?? '')
  }

  let dropped = 0
  for (const [artist, list] of Object.entries(channels)) {
    const kept = channelIds(artist).filter((id) => {
      // An id the API no longer returns is gone; drop it rather than trust it.
      if (!titles.has(id)) return false
      return channelBelongsTo(titles.get(id), artist)
    })
    if (kept.length !== channelIds(artist).length) {
      dropped += channelIds(artist).length - kept.length
      channelsChanged = true
    }
    if (kept.length) channels[artist] = kept
    else {
      delete channels[artist]
      channelsChanged = true
    }
    void list
  }
  console.log(`verified Topic channels: ${Object.keys(channels).length} artists, dropped ${dropped} that belong to someone else`)
}

if (channelsChanged && !dryRun) {
  await writeFile(CHANNEL_FILE, JSON.stringify(channels, null, 2) + '\n')
}

// --------------------------------------------- enumerate the audio catalogs

/** Walks a Topic channel's uploads: 1 unit for the channel, 1 per 50 videos. */
async function topicUploads(channelId) {
  const info = await yt('channels', { part: 'contentDetails', id: channelId })
  const uploads = info.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) return []
  // Some Topic channels advertise an uploads playlist that 404s. One dud must
  // not abandon the whole run — the artist just contributes nothing.

  const items = []
  let pageToken = ''
  // Cap the walk: a few artists have thousands of art tracks and the catalog
  // only ever needs their best known dozen.
  while (items.length < 600) {
    let page
    try {
      page = await yt('playlistItems', {
        part: 'contentDetails,snippet',
        maxResults: '50',
        playlistId: uploads,
        ...(pageToken ? { pageToken } : {}),
      })
    } catch (err) {
      if (err instanceof QuotaError) throw err
      break
    }
    for (const item of page.items ?? []) {
      items.push({ videoId: item.contentDetails?.videoId, title: item.snippet?.title ?? '' })
    }
    pageToken = page.nextPageToken ?? ''
    if (!pageToken) break
  }
  return items
}

const targets = doFill ? all : onVideo
const byArtist = new Map()
for (const track of targets) {
  if (!channelIds(track.artist).length) continue
  if (!byArtist.has(track.artist)) byArtist.set(track.artist, [])
  byArtist.get(track.artist).push(track)
}

const remaps = JSON.parse(await readFile(REMAP_FILE, 'utf8').catch(() => '{}'))
const replaced = []
const filled = []
const skipped = []

for (const [artist, artistTracks] of byArtist) {
  let uploads = []
  try {
    for (const id of channelIds(artist)) uploads.push(...(await topicUploads(id)))
  } catch (err) {
    if (!(err instanceof QuotaError)) throw err
    console.log('\n! quota exhausted while reading audio catalogs; stopping here')
    break
  }
  if (!uploads.length) continue

  // Several art tracks can share a title (remasters, live cuts), so keep them
  // all and let the recording's length choose.
  const byTitle = new Map()
  for (const item of uploads) {
    const key = bare(item.title)
    if (!byTitle.has(key)) byTitle.set(key, [])
    byTitle.get(key).push(item)
  }

  for (const track of artistTracks) {
    const candidates = byTitle.get(bare(track.title))
    if (!candidates?.length) {
      skipped.push(`${track.title} — ${artist}: no audio upload with that title`)
      continue
    }

    const { duration: trackSeconds } = await api(`/track/${track.id}`)
    const lengths = await videoSnippets(candidates.map((c) => c.videoId))

    let best = null
    for (const candidate of candidates) {
      const iso = lengths.get(candidate.videoId)?.contentDetails?.duration ?? ''
      const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
      if (!m) continue
      const seconds = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
      const gap = Math.abs(seconds - (trackSeconds || seconds))
      if (gap <= LENGTH_TOLERANCE && (!best || gap < best.gap)) {
        best = { videoId: candidate.videoId, seconds, gap }
      }
    }

    if (!best) {
      skipped.push(`${track.title} — ${artist}: audio upload's length doesn't match the recording`)
      continue
    }
    if (best.videoId === track.youtubeId) continue

    remaps[String(track.id)] = { videoId: best.videoId, seconds: best.seconds }
    const line = `${track.title} — ${artist}: ${best.videoId} (${best.seconds}s vs ${trackSeconds}s)`
    if (track.youtubeId) replaced.push(line)
    else filled.push(line)
  }
}

console.log(`\nreplaced ${replaced.length} music videos with audio:`)
for (const line of replaced) console.log(`  + ${line}`)
if (doFill) {
  console.log(`\nnewly mapped ${filled.length}:`)
  for (const line of filled) console.log(`  + ${line}`)
}
console.log(`\nno audio match for ${skipped.length}`)
for (const line of skipped.slice(0, 15)) console.log(`  - ${line}`)
if (skipped.length > 15) console.log(`  … and ${skipped.length - 15} more`)

if (!dryRun && (replaced.length || filled.length)) {
  await writeFile(REMAP_FILE, JSON.stringify(remaps, null, 2) + '\n')
  console.log(`\nwrote ${REMAP_FILE.pathname} — run catalog:build to apply`)
} else if (dryRun) {
  console.log('\n(dry run — nothing written)')
}
