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
      <p className={`font-mono text-sm font-semibold ${won ? 'text-tape-green' : 'text-tape-red'}`}>
        {won ? `Benar dalam ${guesses.length} tebakan!` : 'Belum berhasil kali ini'}
        {playMode === 'unlimited' && ` · +${scoreForRound(won, guesses.length)} poin`}
      </p>

      {track.cover && (
        <img
          src={track.cover}
          alt=""
          className="h-40 w-40 rounded-sm border-2 border-ink object-cover shadow-[4px_4px_0_var(--color-ink)]"
        />
      )}

      <div>
        <h2 className="display text-3xl leading-none">{track.title}</h2>
        <p className="mt-1 text-ink/70">{track.artist}</p>
      </div>

      <div className="mt-2 flex w-full flex-col gap-3">
        {playMode === 'daily' && (
          <button
            type="button"
            onClick={share}
            className="btn-primary"
          >
            {shared ? 'Tersalin!' : 'Bagikan hasil'}
          </button>
        )}

        {playMode === 'unlimited' && (
          <button
            type="button"
            onClick={onNext}
            className="btn-primary"
          >
            {lastInRun ? 'Lihat skor' : 'Lagu berikutnya'}
          </button>
        )}

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
