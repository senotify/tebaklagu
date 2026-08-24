# Tebak Lagu — Plan & Status

Song guessing game (Songless-style) at **tebaklagu.senotify.com**: hear a short
chunk of a song, guess it, each wrong guess or skip unlocks a longer chunk.

Design rationale and day-to-day commands live in [README.md](./README.md); this
file tracks what is done and what is left.

## Status

**Hook mode is complete and verified end to end.** Intro mode is scaffolded but
inactive until YouTube ids are generated.

| | |
| --- | --- |
| ✅ Scaffold | React 19 + TS + Vite + Tailwind 4, Docker + nginx, dev/prod Deezer proxy |
| ✅ Catalog | 1,177 tracks across 7 playlists, 773 in the daily pool |
| ✅ Game logic | Stages, answer matching, WIB daily pick, share text — all unit-checked |
| ✅ Hook mode | Preview playback, autocomplete, history, reveal, stats |
| ✅ Intro mode | YouTube player built; live for Pop Indonesia (116) and Rock (37) |
| ✅ Daily schedule | 400 days assigned and frozen, playable in both clip modes |
| ⬜ Intro coverage | Indo Kekinian, Dangdut, K-Pop, Global Hits still unmapped |
| ⬜ Browser check | Clip timing unmeasured here; harness ready at `/dev-yt-timing.html` |
| ⬜ Prod nginx | Config written; unverified (no Docker locally) |
| ⬜ Deploy | DNS record + VPS steps |

## What the API forced

Three findings from probing Deezer shaped the design:

1. **Preview URLs expire after ~15 minutes.** They are never committed; each
   round fetches a fresh one, and a stale tab retries once on audio error.
2. **Previews start mid-song**, so "guess from the intro" needs YouTube — hence
   two clip modes rather than one.
3. **Chart endpoints omit the `readable` field**, which silently emptied two
   playlists until the filter was loosened to reject only an explicit `false`.

## Remaining work

### 1. Intro mode coverage
The player works and 153 tracks are mapped (Pop Indonesia 116, Rock 37). What's
left is breadth — one day's free quota maps ~100 more:

```bash
YT_API_KEY=... npm run catalog:build     # repeat daily; already-mapped ids are reused
```

Priority order: Indo Kekinian (190 tracks, 1 mapped), then K-Pop, Dangdut, Global
Hits. Without a key, `node scripts/add-youtube-id.mjs <deezerId> <videoId>` adds
them one at a time.

Note that Peterpan / NOAH are absent from Deezer but *do* exist on YouTube, so
intro mode is the only route those songs could ever reach the game — that would
need a track record not sourced from Deezer.

### 2. Measure intro clip timing
`STAGES.intro` starts at 0.5s on the assumption that player latency rules out
0.1s. Confirm on real hardware: `npm run dev`, open `/dev-yt-timing.html`, press
"Measure all stages". Overshoot within ±0.25s means the table is honest;
otherwise raise `STAGES.intro[0]` in `src/lib/game.ts`.

### 3. Stats modal
`src/lib/storage.ts` already records streaks and a win distribution; no UI reads
them yet beyond the home screen's "played today" line.

### 4. Verify production nginx
Needs Docker running:
```bash
docker build -t tebaklagu . && docker run --rm -p 8080:80 tebaklagu
curl -sI localhost:8080/api/deezer/search?q=test   # expect X-Cache-Status
curl -s localhost:8080/api/deezer/track/3509628671 # must NOT be cached
```

### 5. Deploy
DNS A record `tebaklagu` → `145.79.13.39`, then the scp/docker/NPM steps in the
README. Optionally push to a private `senotify/tebaklagu` repo.

## Verification done

- Game logic asserted: title normalization, id and title+artist matching, daily
  determinism, WIB midnight rollover, share text.
- Catalog invariants (`npm run catalog:check`): index matches files, no preview
  URLs committed, daily pool never claims Intro readiness while partially
  mapped, 30 consecutive dates give 30 distinct songs.
- Live chain through the dev proxy: index → daily pick → fresh preview URL → a
  real 480 KB `audio/mpeg` response; autocomplete returns correct hits.
- `tsc -b` clean; initial bundle 214 KB (68 KB gzipped) after lazy-loading the
  track lists.
- Intro gating against the real catalog, and no committed YouTube id malformed.
- Every seeded YouTube id confirmed through oEmbed to exist, be embeddable, and
  match the intended song.
- Daily schedule survives a full rebuild unchanged (0 of 400 dates moved), holds
  no duplicate on consecutive days, and gives 30 distinct songs in 30 days.
- All 112 artist ids audited for wrong matches (`npm run catalog:audit`).

Not yet verified: clip timing in a real browser for **either** mode (the Chrome
extension blocks localhost on this machine — play a round with `npm run dev`,
and use `/dev-yt-timing.html` for intro), and the production nginx config.
