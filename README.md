# Tebak Lagu

Song guessing game in the style of Songless: you hear a short chunk of a song and
guess it, and every wrong guess or skip unlocks a longer chunk. Deployed at
<https://tebaklagu.senotify.com>.

React 19 + TypeScript + Vite + Tailwind 4, served by nginx in Docker.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
```

## How the audio works

Deezer supplies free 30-second preview clips and the search used for guess
autocomplete. Two things about it shape the whole design:

- **Preview URLs expire.** They are signed with a token good for about 15
  minutes, so they are never stored in the committed track lists — each round
  fetches a fresh one from `/track/{id}`.
- **Previews start mid-song**, usually at the hook, not at the song's opening.

That gives the two clip modes:

| Mode | Source | Stages | Notes |
| --- | --- | --- | --- |
| Reff (hook) | Deezer preview in `<audio>` | 0.1 / 0.5 / 2 / 4 / 8 / 15s | Sample-accurate |
| Intro | YouTube IFrame player from 0:00 | 0.5 / 1 / 2 / 4 / 8 / 15s | Player latency makes 0.1s unreliable |

Both engines implement the same `ClipPlayer` interface (`src/hooks/clipPlayer.ts`)
so `GameScreen` can swap between them.

Two details make intro mode work:

- **Each video is primed before it can be played** — loaded muted, then paused
  and rewound to 0:00. Without that, the player's start-up latency swallows a
  short clip. Muting comes first deliberately: `loadVideoById` starts playing on
  its own, and an unmuted burst would give the song away.
- **The video is covered while guessing.** A visible YouTube frame names the
  song, so it sits behind a panel until the round ends, then acts as the reveal.

`dev-yt-timing.html` measures how much audio really plays per stage (open
`/dev-yt-timing.html` with the dev server running). It's excluded from the build
and the Docker image. If the shortest stage overshoots, raise `STAGES.intro[0]`
in `src/lib/game.ts`.

A playlist is only offered in intro mode once **30** of its tracks have a
`youtubeId`, so a barely-mapped list can't serve the same three songs forever.

## The catalog

Track lists live in `src/data/generated/` and are **committed**, so the catalog
is fixed at build time and the daily song can't drift when Deezer reshuffles a
chart. Only `index.json` is bundled up front; the lists load on demand.

Regenerate them from `scripts/sources.mjs`:

```bash
npm run catalog:resolve            # artist names -> Deezer ids (scripts/artist-ids.json)
npm run catalog:audit              # flag ids that resolved to the wrong artist
npm run catalog:verify -- "Nidji"  # print an artist's top tracks to sanity-check an id
npm run catalog:build              # write src/data/generated/*.json, then check invariants
npm run catalog:check              # invariants only
```

**Run `catalog:audit` after every `catalog:resolve`.** Deezer's fuzzy search puts
huge names beside small ones, and a wrong match is silent: `D'MASIV` resolved to
the French rapper **Damso**, whose five million fans sailed past a
low-fan-count check and put French rap into the Indonesian playlist. The audit
compares the resolved name against the requested one, which is the check that
actually catches it.

### The daily schedule

`src/data/generated/daily-schedule.json` assigns a specific song to each date,
400 days ahead, and is committed. Rebuilds only fill in dates that have no song
yet — existing assignments are never touched.

This exists because the daily used to be `hash(date) % pool.length`, which meant
the pool growing from 773 tracks to 134 silently changed which song every date
played. Live, that would have swapped the song out from under players mid-day and
invalidated everyone's shared results. Each entry carries the full track, so
catalog drift can't disturb it either.

`catalog:check` guards this and the rule that keeps the daily fair across modes:
the daily may only advertise Intro mode when *every* scheduled song also plays in
Hook mode, otherwise the two modes would serve different songs on the same date.

Deezer's artist search is unreliable enough to need all three steps: it returns
tribute acts, fan uploads, and duplicate artist pages holding no tracks at all.
The resolver therefore accepts the first candidate that actually has playable
tracks, and `ARTIST_OVERRIDES` in `sources.mjs` pins the rest.

Caveats worth knowing before adding artists:

- **Fan count is a bad signal for Indonesian artists.** The Deezer page holding
  Ungu's real catalog has 32 fans. Judge by the track titles, not the number.
- **Some artists simply aren't on Deezer.** Peterpan / NOAH and Vierra return
  only cover uploads; D'MASIV's page exists but holds no playable tracks. All are
  deliberately excluded.
- **An artist page can empty out over time.** That's how the Damso mix-up
  happened: D'MASIV's page still resolved, but its top-track list had gone empty,
  so the resolver kept looking and accepted a name that didn't match. It now
  refuses non-matching names outright and reports the artist as unresolvable.

### Mapping tracks to YouTube (intro mode)

Ids come from three places, in priority order: `scripts/youtube-seed.json`
(hand-verified, committed), the previous build's output, then a Data API search.

With a key, searching is automatic:

```bash
YT_API_KEY=... npm run catalog:build
```

Search costs 100 of the default 10,000 daily quota units per track, so about 100
new tracks map per day; ids already known are reused rather than looked up again.
Every newly found id is confirmed with oEmbed before being committed, because a
video with embedding disabled would leave that round silent.

Without a key you can add ids by hand — oEmbed needs no key and reports the
video's real title, so a wrong id is caught immediately:

```bash
node scripts/add-youtube-id.mjs 4091937401 fJ9rUzIMcZQ
node scripts/add-youtube-id.mjs --check     # re-check every seeded id
```

This is how the current seeds were built. It is worth the paranoia: while
seeding, two ids that looked right turned out to be a Sinéad O'Connor video and
a Russian cartoon.

## Free play: scored runs and the leaderboard

"Main bebas" deals a run of **10 songs** from the chosen list. Each song scores
6 points if guessed on the first clip, down to 1 on the sixth; a miss scores 0,
so a run is worth up to 60. Five spare songs are dealt too: if a YouTube ad blocks
an intro round, "Lagu lain" swaps in a spare instead of scoring the song.

A device won't be dealt the same song twice in one WIB day, across all lists
(`tebaklagu.seen.v1` in localStorage). A song counts as heard when its round
starts. If a list runs out of unheard songs, the run tops up from heard ones.

At the end the player enters a name and submits the score to a shared board, one
per playlist and clip mode. The board is served by `server/index.mjs`, a small
Node API with no dependencies, which stores scores in SQLite (`node:sqlite`):

| | |
| --- | --- |
| `GET /api/scores?playlist=rock&mode=hook` | Top 20; ties go to the earlier score |
| `POST /api/scores` | `{ username, playlist, mode, score, songs }`, returns `{ id, rank }` |

Scores are submitted by the browser, so they can be forged. The API only checks
that each one is something a real run could produce: a known playlist, a valid
mode, 0–60 points, 10 songs, and a name of 2–20 characters. It also accepts at
most 10 submissions per minute per IP.

Local development runs both:

```bash
npm run api        # :8787, writes ./scores.db (gitignored)
npm run dev        # vite proxies /api/scores to it
```

In production the API is its own container, `tebaklagu-api`, built from the
Dockerfile's `api` target. It keeps the database in the named volume
`tebaklagu-scores`, so scores survive redeploys. nginx proxies `/api/scores` to it
over `proxy-network`, resolving the address per request, so the site still loads
while the API is down.

## Deezer rate limit

Deezer allows 50 requests per 5 seconds **per IP**, and in production every
player's request reaches Deezer from the one VPS address. Autocomplete is the hot
path, so it is debounced (320ms), cached in the browser per query, and cached
again by nginx. `/track` responses are explicitly *not* cached — a cached copy
would hand players an expired preview URL.

## Deploying

Same pattern as the other apps on the VPS:

```bash
scp -r . deploy@145.79.13.39:/home/deploy/tebaklagu/
ssh deploy@145.79.13.39
docker build -t tebaklagu /home/deploy/tebaklagu/
docker run -d --name tebaklagu --network proxy-network --restart unless-stopped tebaklagu
```

Then add a proxy host in Nginx Proxy Manager for `tebaklagu.senotify.com` →
`tebaklagu:80` with Let's Encrypt SSL. DNS: an A record for `tebaklagu` →
`145.79.13.39`.
