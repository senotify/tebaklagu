// Finds an artist id from a known song, for cases where artist search fails.
// Groups track-search results by artist so the right id is obvious.
//
//   node scripts/find-artist.mjs "Rasa Ini Vierra"

import { api } from './lib/deezer.mjs'

const query = process.argv.slice(2).join(' ')
if (!query) throw new Error('usage: node scripts/find-artist.mjs "<song> <artist>"')

const { data = [] } = await api('/search?q=' + encodeURIComponent(query) + '&limit=25')
const byArtist = new Map()
for (const t of data) {
  const key = t.artist.id
  if (!byArtist.has(key)) byArtist.set(key, { artist: t.artist, titles: [] })
  byArtist.get(key).titles.push(t.title)
}

console.log(`"${query}" -> ${byArtist.size} artists`)
for (const { artist, titles } of byArtist.values()) {
  console.log(`  ${String(artist.id).padEnd(11)} ${artist.name.padEnd(28)} ${titles.length}x  e.g. ${titles[0]}`)
}
