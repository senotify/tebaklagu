import { useRef, useState } from 'react'
import { CLIP_WINDOW } from '../lib/game'

type Props = {
  stages: readonly number[]
  stageIndex: number
  position: number
  isPlaying: boolean
  isReady: boolean
  onPlay: () => void
  onStop: () => void
  onSkip: () => void
  onSeek: (seconds: number) => void
  /** Seconds this skip would add, or null on the last attempt where it ends the round. */
  skipGain: number | null
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
  onSkip,
  onSeek,
  skipGain,
  revealed = false,
}: Props) {
  const unlocked = revealed ? CLIP_WINDOW : stages[stageIndex]
  const pct = (seconds: number) => (seconds / CLIP_WINDOW) * 100

  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const head = Math.min(position, unlocked)

  /**
   * Scrubbing is clamped to what the player has unlocked — dragging past the
   * current stage would hand them song they haven't earned yet.
   */
  const seekTo = (clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const fraction = (clientX - rect.left) / rect.width
    onSeek(Math.max(0, Math.min(unlocked, fraction * CLIP_WINDOW)))
  }

  const nudge = (delta: number) => onSeek(Math.max(0, Math.min(unlocked, head + delta)))

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Posisi pemutaran"
        aria-valuemin={0}
        aria-valuemax={Number(unlocked.toFixed(1))}
        aria-valuenow={Number(head.toFixed(1))}
        aria-valuetext={`${head.toFixed(1)} dari ${unlocked} detik`}
        // touch-none so dragging scrubs instead of scrolling the page.
        className="relative cursor-pointer touch-none select-none py-2 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setDragging(true)
          seekTo(e.clientX)
        }}
        onPointerMove={(e) => dragging && seekTo(e.clientX)}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          setDragging(false)
        }}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          // Fine steps, since the early stages are fractions of a second.
          if (e.key === 'ArrowLeft') nudge(-0.5)
          else if (e.key === 'ArrowRight') nudge(0.5)
          else if (e.key === 'Home') onSeek(0)
          else if (e.key === 'End') onSeek(unlocked)
          else return
          e.preventDefault()
        }}
      >
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

        {/* Drag handle. Outside the clipped track so it can overhang the bar. */}
        <div
          className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow ring-2 ring-neutral-950 transition-transform ${
            dragging ? 'scale-125' : ''
          }`}
          style={{ left: `${pct(head)}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-white/40">
        <span>0:00</span>
        <span className="text-emerald-400">
          {revealed ? 'Penuh' : `${stages[stageIndex]} detik`}
        </span>
        <span>0:30</span>
      </div>

      <div className="mt-5 flex items-start justify-center gap-4">
        {/* Spacer, so the play button stays centred with the skip beside it. */}
        <div className="w-14 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={isPlaying ? onStop : onPlay}
          disabled={!isReady}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
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

        {revealed ? (
          <div className="w-14 shrink-0" aria-hidden="true" />
        ) : (
          <div className="flex w-14 shrink-0 flex-col items-center gap-1">
            <button
              type="button"
              onClick={onSkip}
              className="flex h-16 w-14 items-center justify-center rounded-2xl border border-white/10 text-white/70 transition hover:bg-white/5 hover:text-white"
              aria-label={
                skipGain === null ? 'Lewati, tebakan terakhir' : `Lewati, tambah ${skipGain} detik`
              }
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M5 5.14v13.72a1 1 0 0 0 1.54.84l9.3-6.86a1 1 0 0 0 0-1.68L6.54 4.3A1 1 0 0 0 5 5.14Z" />
                <rect x="17" y="5" width="2.5" height="14" rx="1" />
              </svg>
            </button>
            <span className="text-[11px] tabular-nums text-white/40">
              {skipGain === null ? 'terakhir' : `+${skipGain}s`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
