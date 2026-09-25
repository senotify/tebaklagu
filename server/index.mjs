// Free-play leaderboard API. Deliberately dependency-free: Node's own http and
// sqlite modules cover a table of scores, so the image needs no npm install.
//
//   GET  /api/scores?playlist=rock&mode=hook   top scores for one board
//   POST /api/scores                           { username, playlist, mode, score, songs }
//
// Scores are submitted by the browser, so they can be forged; validation only
// keeps them inside what a real run could produce.

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const PORT = Number(process.env.PORT ?? 8787)
const DB_PATH = process.env.DB_PATH ?? '/data/scores.db'
const INDEX_PATH =
  process.env.INDEX_PATH ?? new URL('../src/data/generated/index.json', import.meta.url).pathname

// Mirrors src/lib/game.ts: a run is 10 songs, each worth at most 6 points.
const RUN_LENGTH = 10
const MAX_SCORE = RUN_LENGTH * 6
const TOP = 20
const MODES = new Set(['hook', 'intro'])
const USERNAME_MIN = 2
const USERNAME_MAX = 20
const MAX_BODY = 1024

// Only real playlists get a board, so the table can't be filled with junk ids.
const PLAYLISTS = new Set(
  JSON.parse(readFileSync(INDEX_PATH, 'utf8')).playlists.map((p) => p.id),
)

const db = new DatabaseSync(DB_PATH)
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    playlist TEXT NOT NULL,
    clip_mode TEXT NOT NULL,
    score INTEGER NOT NULL,
    songs INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS scores_board ON scores (playlist, clip_mode, score DESC, id);
`)

const topQuery = db.prepare(`
  SELECT id, username, score, created_at AS createdAt FROM scores
  WHERE playlist = ? AND clip_mode = ?
  ORDER BY score DESC, id ASC LIMIT ?
`)
const insert = db.prepare(`
  INSERT INTO scores (username, playlist, clip_mode, score, songs, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)
// Ties go to whoever got there first, matching the ORDER BY above.
const rankQuery = db.prepare(`
  SELECT COUNT(*) + 1 AS rank FROM scores
  WHERE playlist = ? AND clip_mode = ? AND (score > ? OR (score = ? AND id < ?))
`)

/** Crude per-IP limit on submissions: plenty for a person, useless for a script. */
const WINDOW_MS = 60_000
const MAX_POSTS = 10
const posts = new Map()

function allowPost(ip) {
  const now = Date.now()
  const recent = (posts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_POSTS) {
    posts.set(ip, recent)
    return false
  }
  recent.push(now)
  posts.set(ip, recent)
  return true
}
setInterval(() => {
  const now = Date.now()
  for (const [ip, times] of posts) if (times.every((t) => now - t >= WINDOW_MS)) posts.delete(ip)
}, WINDOW_MS).unref()

function cleanUsername(raw) {
  if (typeof raw !== 'string') return null
  const name = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return name.length >= USERNAME_MIN && name.length <= USERNAME_MAX ? name : null
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== '/api/scores') return send(res, 404, { error: 'not found' })

  if (req.method === 'GET') {
    const playlist = url.searchParams.get('playlist')
    const mode = url.searchParams.get('mode')
    if (!PLAYLISTS.has(playlist) || !MODES.has(mode)) return send(res, 400, { error: 'bad board' })
    return send(res, 200, { scores: topQuery.all(playlist, mode, TOP) })
  }

  if (req.method === 'POST') {
    // nginx sets X-Real-IP; without it (local dev) everyone shares one bucket.
    const ip = req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? 'unknown'
    if (!allowPost(ip)) return send(res, 429, { error: 'slow down' })

    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      return send(res, 400, { error: 'bad body' })
    }

    const username = cleanUsername(body?.username)
    const { playlist, mode, score, songs } = body ?? {}
    if (
      !username ||
      !PLAYLISTS.has(playlist) ||
      !MODES.has(mode) ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > MAX_SCORE ||
      songs !== RUN_LENGTH
    ) {
      return send(res, 400, { error: 'invalid score' })
    }

    const { lastInsertRowid } = insert.run(
      username,
      playlist,
      mode,
      score,
      songs,
      new Date().toISOString(),
    )
    const id = Number(lastInsertRowid)
    const { rank } = rankQuery.get(playlist, mode, score, score, id)
    return send(res, 201, { id, rank })
  }

  res.setHeader('Allow', 'GET, POST')
  return send(res, 405, { error: 'method not allowed' })
})

server.listen(PORT, () => console.log(`scores api on :${PORT}, db ${DB_PATH}`))

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close()
    db.close()
    process.exit(0)
  })
}
