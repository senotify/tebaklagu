import { useState, type FormEvent } from 'react'
import type { PlaylistInfo } from '../data/playlists'
import type { Track } from '../lib/deezer'
import { MAX_ATTEMPTS, type ClipMode } from '../lib/game'
import { cleanUsername, submitScore, USERNAME_MAX, USERNAME_MIN } from '../lib/leaderboard'
import { loadUsername, saveUsername } from '../lib/storage'
import { Leaderboard } from './Leaderboard'

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
        <p className="text-xs uppercase tracking-wide text-white/40">
          {playlist.emoji} {playlist.title} · {clipMode === 'intro' ? 'Intro' : 'Reff'}
        </p>
        <p className="mt-2 text-5xl font-bold text-emerald-400 tabular-nums">{total}</p>
        <p className="text-sm text-white/50">dari {max} poin</p>
      </header>

      <ul className="flex flex-col gap-1.5">
        {results.map(({ track, won, attempts, points }) => (
          <li
            key={track.id}
            className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            {track.cover && <img src={track.cover} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />}
            <span className="min-w-0 flex-1 truncate">
              <span className="text-white">{track.title}</span>
              <span className="text-white/40"> — {track.artist}</span>
            </span>
            <span className={`shrink-0 text-xs ${won ? 'text-emerald-400' : 'text-rose-400'}`}>
              {won ? `${attempts}× · +${points}` : '✗'}
            </span>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-white/40">Papan skor</h2>

        {submitted ? (
          <p className="text-center text-sm text-emerald-300">
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
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {status === 'sending' ? 'Mengirim…' : 'Kirim skor'}
            </button>
          </form>
        )}
        {error && <p className="text-center text-xs text-rose-400">{error}</p>}

        <Leaderboard
          playlistId={playlist.id}
          clipMode={clipMode}
          highlightId={submitted?.id}
          refreshKey={submitted?.id}
        />
      </section>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full rounded-xl bg-emerald-500 py-3 font-medium text-black transition hover:bg-emerald-400"
        >
          Main lagi
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/70 transition hover:bg-white/5"
        >
          Menu utama
        </button>
      </div>
    </div>
  )
}
