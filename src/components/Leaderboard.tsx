import { useEffect, useState } from 'react'
import type { ClipMode } from '../lib/game'
import { fetchLeaderboard, type ScoreEntry } from '../lib/leaderboard'

type Props = {
  playlistId: string
  clipMode: ClipMode
  /** The player's own freshly submitted entry, picked out in the list. */
  highlightId?: number
  /** Bumped to refetch, e.g. right after a submission lands. */
  refreshKey?: number
}

const MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ playlistId, clipMode, highlightId, refreshKey = 0 }: Props) {
  const [scores, setScores] = useState<ScoreEntry[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setScores(null)
    setFailed(false)
    fetchLeaderboard(playlistId, clipMode, controller.signal)
      .then(setScores)
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setFailed(true)
      })
    return () => controller.abort()
  }, [playlistId, clipMode, refreshKey])

  if (failed) return <p className="py-4 text-center text-sm text-rose-400">Gagal memuat papan skor.</p>
  if (!scores) return <p className="py-4 text-center text-sm text-white/40">Memuat…</p>
  if (!scores.length)
    return <p className="py-4 text-center text-sm text-white/40">Belum ada skor. Jadilah yang pertama!</p>

  return (
    <ol className="flex w-full flex-col gap-1.5">
      {scores.map((entry, i) => (
        <li
          key={entry.id}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
            entry.id === highlightId
              ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100'
              : 'border-white/10 bg-white/5 text-white/80'
          }`}
        >
          <span className="w-6 shrink-0 text-center text-xs text-white/50">{MEDALS[i] ?? i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-left">{entry.username}</span>
          <span className="shrink-0 font-semibold tabular-nums">{entry.score}</span>
        </li>
      ))}
    </ol>
  )
}
