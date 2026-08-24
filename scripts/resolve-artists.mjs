// Resolves the artist names in sources.mjs to Deezer artist ids and writes
// scripts/artist-ids.json (committed). Run again only when adding artists.
//
//   node scripts/resolve-artists.mjs [--force]
//
// Review the printed table before committing: a suspiciously low fan count
// means the name matched a fan upload or tribute act rather than the artist.

import { readFile, writeFile } from 'node:fs/promises'
import { api, resolveArtist, topTracks } from './lib/deezer.mjs'
import { ALL_ARTISTS, ARTIST_OVERRIDES } from './sources.mjs'

const OUT = new URL('./artist-ids.json', import.meta.url)
const force = process.argv.includes('--force')

const existing = force ? {} : JSON.parse(await readFile(OUT, 'utf8').catch(() => '{}'))
const resolved = { ...existing }
const suspicious = []

const missing = []

for (const name of ALL_ARTISTS) {
  if (resolved[name]) continue

  let artist
  if (ARTIST_OVERRIDES[name]) {
    artist = await api(`/artist/${ARTIST_OVERRIDES[name]}`)
    artist.sampleTracks = (await topTracks(artist.id, 3)).map((t) => t.title)
  } else {
    artist = await resolveArtist(name)
  }

  if (!artist) {
    console.log(`  MISSING  ${name}`)
    missing.push(name)
    continue
  }

  resolved[name] = { id: artist.id, name: artist.name, fans: artist.nb_fan }
  // A wrong match usually gives itself away in the track titles, so print them.
  const sample = (artist.sampleTracks ?? []).slice(0, 2).join(' / ').slice(0, 44)
  if (artist.nb_fan < 1000) suspicious.push(name)
  console.log(
    `  ${String(artist.id).padEnd(10)} ${name.padEnd(22)} -> ${artist.name.padEnd(22)} ${String(artist.nb_fan).padStart(8)} fans | ${sample}`,
  )
}

const sorted = Object.fromEntries(Object.entries(resolved).sort(([a], [b]) => a.localeCompare(b)))
await writeFile(OUT, JSON.stringify(sorted, null, 2) + '\n')

console.log(`\nResolved ${Object.keys(sorted).length}/${ALL_ARTISTS.length} artists -> scripts/artist-ids.json`)
if (missing.length) console.log(`No usable match (drop or add an override): ${missing.join(', ')}`)
if (suspicious.length) {
  console.log(`Few fans — check the sample titles above: ${suspicious.join(', ')}`)
  console.log('Inspect further with: node scripts/verify-artists.mjs "<name>"')
}
