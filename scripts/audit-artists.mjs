// Audits scripts/artist-ids.json for ids that resolved to the wrong artist.
//
//   node scripts/audit-artists.mjs
//
// The failure this exists to catch: Deezer's fuzzy search returns big names
// alongside small ones, so "D'MASIV" can resolve to the French rapper Damso.
// A fan-count threshold won't catch that — Damso has five million — so the
// check is whether the resolved name actually resembles the one asked for.

import { readFile } from 'node:fs/promises'
import { normalize, topTracks } from './lib/deezer.mjs'
import { ARTIST_OVERRIDES } from './sources.mjs'

const ids = JSON.parse(await readFile(new URL('./artist-ids.json', import.meta.url), 'utf8'))

const looksRight = (requested, found) => {
  const a = normalize(requested)
  const b = normalize(found)
  if (a === b) return true
  const shorter = a.length <= b.length ? a : b
  return shorter.length >= 4 && (a.includes(b) || b.includes(a))
}

const mismatched = []
const empty = []

for (const [requested, entry] of Object.entries(ids)) {
  // Overrides are deliberate, so a differing name there is expected.
  if (ARTIST_OVERRIDES[requested]) continue

  if (!looksRight(requested, entry.name)) {
    mismatched.push({ requested, entry })
    continue
  }
  const tracks = await topTracks(entry.id, 5)
  if (tracks.length === 0) empty.push({ requested, entry })
}

if (mismatched.length) {
  console.log('WRONG ARTIST — resolved name does not match the one requested:')
  for (const { requested, entry } of mismatched) {
    console.log(`  ${requested.padEnd(22)} -> "${entry.name}" (id ${entry.id}, ${entry.fans} fans)`)
  }
}

if (empty.length) {
  console.log('\nNO TRACKS — id is right but the page is empty, so it contributes nothing:')
  for (const { requested, entry } of empty) {
    console.log(`  ${requested.padEnd(22)} -> "${entry.name}" (id ${entry.id})`)
  }
}

const total = Object.keys(ids).length
if (!mismatched.length && !empty.length) {
  console.log(`all ${total} artist ids look right`)
} else {
  console.log(
    `\n${total} ids checked: ${mismatched.length} wrong, ${empty.length} empty. ` +
      'Remove the entry from artist-ids.json and either drop the artist from ' +
      'sources.mjs or pin it in ARTIST_OVERRIDES, then re-run resolve + build.',
  )
  process.exit(1)
}
