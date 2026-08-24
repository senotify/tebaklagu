// Prints the top tracks of the given artists so a human can confirm the id in
// artist-ids.json really is the artist we meant.
//
//   node scripts/verify-artists.mjs "Nidji" "Vierra"
//   node scripts/verify-artists.mjs --all

import { readFile } from 'node:fs/promises'
import { api, isPlayable } from './lib/deezer.mjs'

const ids = JSON.parse(await readFile(new URL('./artist-ids.json', import.meta.url), 'utf8'))
const args = process.argv.slice(2)
const names = args.includes('--all') ? Object.keys(ids) : args

for (const name of names) {
  const entry = ids[name]
  if (!entry) {
    console.log(`\n### ${name}: not in artist-ids.json`)
    continue
  }
  const { data = [] } = await api(`/artist/${entry.id}/top?limit=5`)
  console.log(`\n### ${name} -> "${entry.name}" (id ${entry.id}, ${entry.fans} fans)`)
  if (!data.length) console.log('   (no top tracks)')
  for (const t of data) {
    console.log(`   ${t.title.slice(0, 40).padEnd(40)} ${isPlayable(t) ? '' : 'UNPLAYABLE'}`)
  }
}
