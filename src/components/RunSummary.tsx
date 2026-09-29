import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { PlaylistInfo } from '../data/playlists'
import type { Track } from '../lib/deezer'
import { MAX_ATTEMPTS, type ClipMode } from '../lib/game'
import { cleanUsername, submitScore, USERNAME_MAX, USERNAME_MIN } from '../lib/leaderboard'
import { loadUsername, saveUsername } from '../lib/storage'
import { Leaderboard } from './Leaderboard'
import { PlaylistIcon } from './PlaylistIcon'

export type RunResult = { track: Track; won: boolean; attempts: number; points: number }

type Props = {
  playlist: PlaylistInfo
  clipMode: ClipMode
  results: readonly RunResult[]
  onPlayAgain: () => void
  onHome: () => void
}

export function RunSummary({ playlist, clipMode, results, onPlayAgain, onHome }: Props) {
  const total = results.reduce((sum, r) => sum + r.points, 0)
  const max = results.length * MAX_ATTEMPTS
  const [username, setUsername] = useState(loadUsername)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<null | { id: number; rank: number }>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const name = cleanUsername(username)
    if (!name) {
      setError(`Nama ${USERNAME_MIN}–${USERNAME_MAX} karakter.`)
      return
    }
    setStatus('sending')
    setError(null)
    try {
      const result = await submitScore({
        username: name,
        playlist: playlist.id,
        mode: clipMode,
        score: total,
        songs: results.length,
      })
      saveUsername(name)
      setSubmitted(result)
      setStatus('idle')
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="text-center">
        <p className="flex items-center justify-center gap-1.5 font-mono text-xs text-ink/60">
          <PlaylistIcon name={playlist.icon} className="size-3.5" />
          {playlist.title} · {clipMode === 'intro' ? 'Intro' : 'Reff'}
        </p>
        <p className="display mt-3 text-8xl text-tape-red tabular-nums">{total}</p>
        <p className="mt-1 font-mono text-sm text-ink/60">dari {max} poin</p>
      </header>

      <ul className="flex flex-col">
        {results.map(({ track, won, attempts, points }) => (
          <li
            key={track.id}
            className="flex items-center gap-3 border-b-2 border-ink/15 px-1 py-2 text-sm"
          >
            {track.cover && <img src={track.cover} alt="" className="h-8 w-8 shrink-0 rounded-sm border border-ink/30 object-cover" />}
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{track.title}</span>
              <span className="text-ink/60"> — {track.artist}</span>
            </span>
            <span className={`shrink-0 font-mono text-xs ${won ? 'text-tape-green' : 'text-tape-red'}`}>
              {won ? `${attempts}× · +${points}` : <X aria-label="Gagal" className="size-4" />}
            </span>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs text-ink/60">Papan skor</h2>

        {submitted ? (
          <p className="text-center text-sm font-semibold text-tape-green">
            Skor terkirim — peringkat #{submitted.rank}
          </p>
        ) : (
          <form onSubmit={submit} className="flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={USERNAME_MAX}
              placeholder="Nama kamu"
              aria-label="Nama kamu"
              className="min-w-0 flex-1 rounded-md border-2 border-ink bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink/45 focus:outline-none focus:ring-2 focus:ring-tape-mustard"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn-primary w-auto shrink-0 px-4 py-2.5 text-sm"
            >
              {status === 'sending' ? 'Mengirim…' : 'Kirim skor'}
            </button>
          </form>
        )}
        {error && <p className="text-center text-xs text-tape-red">{error}</p>}

        <Leaderboard
          playlistId={playlist.id}
          clipMode={clipMode}
          highlightId={submitted?.id}
          refreshKey={submitted?.id}
        />
      </section>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          className="btn-primary"
        >
          Main lagi
        </button>
        <button
          type="button"
          onClick={onHome}
          className="btn-secondary text-sm"
        >
          Menu utama
        </button>
      </div>
    </div>
  )
}
