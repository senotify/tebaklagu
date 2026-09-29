import { Medal } from 'lucide-react'
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

/** Gold, silver and bronze for the top three. */
const MEDALS = ['text-tape-mustard', 'text-ink/45', 'text-tape-red']

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

  if (failed) return <p className="py-4 text-center text-sm text-tape-red">Gagal memuat papan skor.</p>
  if (!scores) return <p className="py-4 text-center font-mono text-sm text-ink/55">Memuat…</p>
  if (!scores.length)
    return <p className="py-4 text-center text-sm text-ink/60">Belum ada skor. Jadilah yang pertama!</p>

  return (
    <ol className="flex w-full flex-col">
      {scores.map((entry, i) => (
        <li
          key={entry.id}
          className={`flex items-center gap-3 border-b-2 px-2 py-2 text-sm ${
            entry.id === highlightId
              ? 'rounded-sm border-ink bg-tape-mustard/35 font-semibold'
              : 'border-ink/15'
          }`}
        >
          <span className="flex w-6 shrink-0 justify-center font-mono text-xs text-ink/55">
            {MEDALS[i] ? <Medal aria-label={`Peringkat ${i + 1}`} strokeWidth={2.5} className={`size-4 ${MEDALS[i]}`} /> : i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{entry.username}</span>
          <span className="shrink-0 font-mono font-semibold tabular-nums">{entry.score}</span>
        </li>
      ))}
    </ol>
  )
}
