import { useState } from 'react'
import type { Track } from '../lib/deezer'
import {
  buildShareText,
  scoreForRound,
  type ClipMode,
  type Guess,
  type PlayMode,
} from '../lib/game'

type Props = {
  track: Track
  won: boolean
  guesses: readonly Guess[]
  playMode: PlayMode
  clipMode: ClipMode
  date: string
  onNext: () => void
  onHome: () => void
  /** The run's final song, so "next" leads to the score screen instead. */
  lastInRun?: boolean
}

export function ResultCard({
  track,
  won,
  guesses,
  playMode,
  clipMode,
  date,
  onNext,
  onHome,
  lastInRun = false,
}: Props) {
  const [shared, setShared] = useState(false)

  const share = async () => {
    const text = buildShareText(date, guesses, won, clipMode)
    try {
      // Web Share is the native path on mobile; clipboard is the desktop fallback.
      if (navigator.share) await navigator.share({ text })
      else await navigator.clipboard.writeText(text)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      // Cancelled share or blocked clipboard — nothing to report.
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4 text-center">
      <p className={`text-sm font-medium ${won ? 'text-emerald-400' : 'text-rose-400'}`}>
        {won ? `Benar dalam ${guesses.length} tebakan!` : 'Belum berhasil kali ini'}
        {playMode === 'unlimited' && ` · +${scoreForRound(won, guesses.length)} poin`}
      </p>

      {track.cover && (
        <img
          src={track.cover}
          alt=""
          className="h-36 w-36 rounded-xl object-cover shadow-lg shadow-black/40"
        />
      )}

      <div>
        <h2 className="text-xl font-semibold text-white">{track.title}</h2>
        <p className="text-white/50">{track.artist}</p>
      </div>

      <div className="flex w-full flex-col gap-2">
        {playMode === 'daily' && (
          <button
            type="button"
            onClick={share}
            className="w-full rounded-xl bg-emerald-500 py-3 font-medium text-black transition hover:bg-emerald-400"
          >
            {shared ? 'Tersalin!' : 'Bagikan hasil'}
          </button>
        )}

        {playMode === 'unlimited' && (
          <button
            type="button"
            onClick={onNext}
            className="w-full rounded-xl bg-emerald-500 py-3 font-medium text-black transition hover:bg-emerald-400"
          >
            {lastInRun ? 'Lihat skor' : 'Lagu berikutnya'}
          </button>
        )}

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
