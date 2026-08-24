import { CLIP_WINDOW } from '../lib/game'

type Props = {
  stages: readonly number[]
  stageIndex: number
  position: number
  isPlaying: boolean
  isReady: boolean
  onPlay: () => void
  onStop: () => void
  /** When revealed the whole clip is unlocked. */
  revealed?: boolean
}

export function PlayerBar({
  stages,
  stageIndex,
  position,
  isPlaying,
  isReady,
  onPlay,
  onStop,
  revealed = false,
}: Props) {
  const unlocked = revealed ? CLIP_WINDOW : stages[stageIndex]
  const pct = (seconds: number) => (seconds / CLIP_WINDOW) * 100

  return (
    <div className="w-full">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
        {/* How much audio this stage has unlocked */}
        <div
          className="absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-500"
          style={{ width: `${pct(unlocked)}%` }}
        />
        {/* Playback head */}
        <div
          className="absolute inset-y-0 left-0 bg-emerald-400"
          style={{ width: `${pct(Math.min(position, CLIP_WINDOW))}%` }}
        />
        {/* Stage boundaries */}
        {stages.map((s) => (
          <div
            key={s}
            className="absolute inset-y-0 w-px bg-black/50"
            style={{ left: `${pct(s)}%` }}
          />
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-white/40">
        <span>0:00</span>
        <span className="text-emerald-400">
          {revealed ? 'Penuh' : `${stages[stageIndex]} detik`}
        </span>
        <span>0:30</span>
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={isPlaying ? onStop : onPlay}
          disabled={!isReady}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
          aria-label={isPlaying ? 'Hentikan' : 'Putar'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-0.5" fill="currentColor">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
