import { useState } from 'react'
import { PLAYLISTS, supportsIntro } from '../data/playlists'
import type { ClipMode } from '../lib/game'
import { Leaderboard } from './Leaderboard'

type Props = {
  clipMode: ClipMode
  onHome: () => void
}

/** Browsable boards, one per playlist and clip mode, reached from the home screen. */
export function LeaderboardScreen({ clipMode: initialMode, onHome }: Props) {
  const [clipMode, setClipMode] = useState(initialMode)
  const available = PLAYLISTS.filter((p) => clipMode === 'hook' || supportsIntro(p))
  const [playlistId, setPlaylistId] = useState(available[0]?.id ?? '')
  // Switching to intro can hide the selected list; fall back to the first one.
  const selected = available.some((p) => p.id === playlistId) ? playlistId : available[0]?.id

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between text-xs text-white/40">
        <button type="button" onClick={onHome} className="transition hover:text-white">
          ← Menu
        </button>
        <span>Papan skor</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['hook', 'intro'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setClipMode(mode)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              clipMode === mode
                ? 'border-emerald-400/60 bg-emerald-400/10 text-white'
                : 'border-white/10 text-white/60 hover:bg-white/5'
            }`}
          >
            {mode === 'intro' ? 'Intro' : 'Reff'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {available.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlaylistId(p.id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              p.id === selected
                ? 'border-emerald-400/60 bg-emerald-400/10 text-white'
                : 'border-white/10 text-white/60 hover:bg-white/5'
            }`}
          >
            {p.emoji} {p.title}
          </button>
        ))}
      </div>

      {selected ? (
        <Leaderboard playlistId={selected} clipMode={clipMode} />
      ) : (
        <p className="text-center text-sm text-white/40">Belum ada daftar lagu untuk mode ini.</p>
      )}
    </div>
  )
}
