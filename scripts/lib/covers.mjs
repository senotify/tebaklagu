/**
 * A few album covers for a playlist's home-screen tile. The top tracks often
 * share an artist or an album, so covers are taken one per artist first and
 * only then topped up from repeat artists, never repeating an image.
 *
 * Big hits sit in several playlists at once, so covers already on another
 * tile (`used`, shared across calls) are skipped while there's anything else.
 */
export function pickCovers(tracks, used = new Set(), count = 4) {
  const covers = []
  const artists = new Set()
  for (const [oneArtistEach, fresh] of [
    [true, true],
    [false, true],
    [false, false],
  ]) {
    for (const track of tracks) {
      if (covers.length >= count) break
      if (!track.cover || covers.includes(track.cover)) continue
      if (fresh && used.has(track.cover)) continue
      if (oneArtistEach && artists.has(track.artist)) continue
      artists.add(track.artist)
      covers.push(track.cover)
    }
  }
  for (const cover of covers) used.add(cover)
  return covers
}
