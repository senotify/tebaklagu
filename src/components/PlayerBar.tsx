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
  /**
   * The bar spans only as far as the round can actually reach — the longest
   * stage, 15s — so the stages fill it instead of crowding into the first half
   * of a 30s scale whose back end is unreachable. Once the answer is out, the
   * whole preview is in play and the scale opens up to the full window.
   */
  const span = revealed ? CLIP_WINDOW : stages[stages.length - 1]
  const unlocked = revealed ? CLIP_WINDOW : stages[stageIndex]
  const pct = (seconds: number) => (seconds / span) * 100
  const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

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
    onSeek(Math.max(0, Math.min(unlocked, fraction * span)))
  }

  const nudge = (delta: number) => onSeek(Math.max(0, Math.min(unlocked, head + delta)))

  return (
    <div className="w-full">
      <Cassette isPlaying={isPlaying} progress={Math.min(position, span) / span} />

      {/* One cell per stage, equal width so the sub-second ones are readable.
          The scrub bar below stays to scale; these only say where the round is. */}
      <ol className="mt-5 grid grid-cols-6 gap-1" aria-label="Tahap potongan">
        {stages.map((s, i) => {
          const state = revealed || i < stageIndex ? 'past' : i === stageIndex ? 'current' : 'future'
          return (
            <li
              key={s}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`rounded-sm border-2 py-0.5 text-center font-mono text-[11px] tabular-nums transition-colors ${
                state === 'current'
                  ? 'border-ink bg-tape-mustard font-semibold text-ink'
                  : state === 'past'
                    ? 'border-transparent bg-ink/10 text-ink/60'
                    : 'border-dashed border-ink/25 text-ink/50'
              }`}
            >
              {s}s
            </li>
          )
        })}
      </ol>

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
        className="relative mt-3 cursor-pointer touch-none select-none py-2 outline-none focus-visible:ring-2 focus-visible:ring-tape-mustard"
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
        {/* The strip of tape: dark where it's still locked, lighter where this
            stage has unlocked it, red where it has played. */}
        <div className="relative h-3 w-full overflow-hidden rounded-[2px] bg-tape">
          <div
            className="absolute inset-y-0 left-0 bg-cream/25 transition-[width] duration-500"
            style={{ width: `${pct(unlocked)}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-tape-red"
            style={{ width: `${pct(Math.min(position, span))}%` }}
          />
          {/* Stage boundaries. The last stage sits exactly on the right edge
              while the round runs, where a tick is just a notch in the rim. */}
          {stages
            .filter((s) => s < span)
            .map((s) => (
              <div
                key={s}
                className="absolute inset-y-0 w-px bg-shell/70"
                style={{ left: `${pct(s)}%` }}
              />
            ))}
        </div>

        {/* Drag handle. Outside the clipped track so it can overhang the bar. */}
        <div
          className={`pointer-events-none absolute top-1/2 h-5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] bg-cream shadow ring-2 ring-shell transition-transform ${
            dragging ? 'scale-125' : ''
          }`}
          style={{ left: `${pct(head)}%` }}
        />
      </div>

      <div className="mt-1 flex items-center justify-between font-mono text-[11px] tabular-nums text-ink/60">
        {/* The deck's counter: where the tape is, to a tenth of a second. */}
        <span className="rounded-sm bg-ink px-1.5 py-0.5 text-tape-mustard">
          {head.toFixed(1).padStart(4, '0')}
        </span>
        <span>{revealed ? 'penuh · ' : ''}{clock(span)}</span>
      </div>

      {/* Transport keys, the chunky kind on a tape deck. Play latches down
          while the tape is running. */}
      <div className="mt-5 flex items-start justify-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={isPlaying ? onStop : onPlay}
            disabled={!isReady}
            className={`flex h-14 w-28 items-center justify-center rounded-sm border-2 border-ink transition-[transform,box-shadow] disabled:cursor-not-allowed disabled:border-ink/20 disabled:bg-ink/5 disabled:text-ink/30 disabled:shadow-none ${
              isPlaying
                ? 'translate-y-[3px] bg-tape-red text-card shadow-[0_1px_0_var(--color-ink)]'
                : 'bg-tape-mustard text-ink shadow-[0_4px_0_var(--color-ink)] hover:brightness-105 active:translate-y-[4px] active:shadow-none'
            }`}
            aria-label={isPlaying ? 'Hentikan' : 'Putar'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-0.5" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
              </svg>
            )}
          </button>
          <span aria-hidden className="font-mono text-[10px] uppercase tracking-widest text-ink/60">
            {isPlaying ? 'stop' : 'putar'}
          </span>
        </div>

        {!revealed && (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onSkip}
              className="flex h-14 w-16 items-center justify-center rounded-sm border-2 border-ink bg-card text-ink shadow-[0_4px_0_var(--color-ink)] transition-[transform,box-shadow] hover:bg-white active:translate-y-[4px] active:shadow-none"
              aria-label={
                skipGain === null ? 'Lewati, tebakan terakhir' : `Lewati, tambah ${skipGain} detik`
              }
            >
              {/* Fast-forward, since a skip buys more tape. */}
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M3 6.2v11.6a.8.8 0 0 0 1.25.66L12 13v4.8a.8.8 0 0 0 1.25.66l8.3-5.8a.8.8 0 0 0 0-1.32l-8.3-5.8A.8.8 0 0 0 12 6.2V11L4.25 5.54A.8.8 0 0 0 3 6.2Z" />
              </svg>
            </button>
            <span className="font-mono text-[10px] tracking-widest tabular-nums text-ink/60">
              {skipGain === null ? 'terakhir' : `+${skipGain}s`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The cassette itself. Its reels turn while audio plays, and tape winds from
 * the left reel onto the right as the clip goes by.
 */
function Cassette({ isPlaying, progress }: { isPlaying: boolean; progress: number }) {
  // Tape pack radius on each reel. Area, not radius, tracks how much tape a
  // reel holds, hence the square roots.
  const pack = (share: number) => 14 + 12 * Math.sqrt(Math.max(0, Math.min(1, share)))

  const reel = (cx: number, share: number) => (
    <g>
      <circle cx={cx} cy={82} r={pack(share)} fill="#2a1d15" className="transition-[r] duration-300" />
      <g className="reel" data-playing={isPlaying}>
        <circle cx={cx} cy={82} r={11} fill="var(--color-cream)" />
        <circle cx={cx} cy={82} r={5} fill="var(--color-shell)" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect
            key={deg}
            x={cx - 1.25}
            y={82 - 10}
            width={2.5}
            height={4}
            fill="var(--color-shell)"
            transform={`rotate(${deg} ${cx} 82)`}
          />
        ))}
      </g>
    </g>
  )

  return (
    <svg viewBox="0 0 320 200" className="mx-auto block w-full max-w-[300px]" aria-hidden>
      {/* Shell */}
      <rect x="2" y="2" width="316" height="196" rx="12" fill="var(--color-shell)" stroke="#ffffff14" strokeWidth="2" />
      {[
        [14, 14],
        [306, 14],
        [14, 186],
        [306, 186],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="#0b0908" />
      ))}

      {/* Label card */}
      <rect x="22" y="16" width="276" height="126" rx="5" fill="var(--color-cream)" />
      <rect x="22" y="16" width="276" height="22" rx="5" fill="var(--color-tape-red)" />
      <rect x="22" y="32" width="276" height="6" fill="var(--color-tape-red)" />
      <text x="34" y="32" fill="var(--color-cream)" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" letterSpacing="2">
        TEBAK LAGU
      </text>
      <text x="286" y="32" textAnchor="end" fill="var(--color-cream)" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
        A
      </text>
      <line x1="34" y1="130" x2="286" y2="130" stroke="#3a2a2033" strokeWidth="1" />

      {/* Window onto the reels */}
      <rect x="70" y="52" width="180" height="60" rx="30" fill="#0b0908" />
      {/* The run of tape between the reels, along the bottom of the window. */}
      <line x1="112" y1="108" x2="208" y2="108" stroke="#2a1d15" strokeWidth="2" />
      {reel(112, 1 - progress)}
      {reel(208, progress)}

      {/* Head opening at the bottom edge */}
      <path d="M78 198 L92 160 H228 L242 198 Z" fill="#171310" />
      {[112, 160, 208].map((x) => (
        <circle key={x} cx={x} cy={180} r={x === 160 ? 5 : 3.5} fill="#0b0908" />
      ))}
    </svg>
  )
}
