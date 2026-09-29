import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { PLAYLISTS, supportsIntro } from '../data/playlists'
import type { ClipMode } from '../lib/game'
import { Leaderboard } from './Leaderboard'
import { PlaylistPicker } from './PlaylistPicker'

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
      <div className="flex items-center justify-between font-mono text-xs text-ink/60">
        <button type="button" onClick={onHome} className="flex items-center gap-1 transition hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" />
          Menu
        </button>
        <h1 className="display font-sans text-2xl text-ink">Papan Skor</h1>
      </div>

      <div role="radiogroup" aria-label="Jenis potongan" className="paper grid grid-cols-2 p-1">
        {(['hook', 'intro'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setClipMode(mode)}
            role="radio"
            aria-checked={clipMode === mode}
            className={`rounded-sm px-3 py-1.5 text-sm font-bold transition ${
              clipMode === mode ? 'bg-ink text-card' : 'text-ink/70 hover:bg-ink/5'
            }`}
          >
            {mode === 'intro' ? 'Intro' : 'Reff'}
          </button>
        ))}
      </div>

      {selected && (
        <PlaylistPicker playlists={available} value={selected} onChange={setPlaylistId} />
      )}

      {selected ? (
        <Leaderboard playlistId={selected} clipMode={clipMode} />
      ) : (
        <p className="text-center text-sm text-ink/60">Belum ada daftar lagu untuk mode ini.</p>
      )}
    </div>
  )
}
