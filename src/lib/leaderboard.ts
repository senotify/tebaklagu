// Shared free-play leaderboard, served by server/index.mjs. Dev reaches it
// through the vite proxy, production through nginx — same path either way.

import type { ClipMode } from './game'

const BASE = '/api/scores'

export const USERNAME_MIN = 2
export const USERNAME_MAX = 20

export type ScoreEntry = {
  id: number
  username: string
  score: number
  createdAt: string
}

export type SubmitResult = { id: number; rank: number }

/** Trimmed, inner whitespace collapsed; null when it doesn't fit the rules. */
export function cleanUsername(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim()
  return name.length >= USERNAME_MIN && name.length <= USERNAME_MAX ? name : null
}

export async function fetchLeaderboard(
  playlist: string,
  mode: ClipMode,
  signal?: AbortSignal,
): Promise<ScoreEntry[]> {
  const params = new URLSearchParams({ playlist, mode })
  const res = await fetch(`${BASE}?${params}`, { signal })
  if (!res.ok) throw new Error(`Leaderboard ${res.status}`)
  const body = (await res.json()) as { scores: ScoreEntry[] }
  return body.scores
}

export async function submitScore(entry: {
  username: string
  playlist: string
  mode: ClipMode
  score: number
  songs: number
}): Promise<SubmitResult> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (res.status === 429) throw new Error('Terlalu sering, coba lagi sebentar.')
  if (!res.ok) throw new Error('Gagal mengirim skor.')
  return (await res.json()) as SubmitResult
}
