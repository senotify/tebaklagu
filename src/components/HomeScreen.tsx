import { ArrowDown, PartyPopper, Trophy } from 'lucide-react'
import {
  dailySupportsIntro,
  PLAYLISTS,
  supportsIntro,
  type PlaylistInfo,
} from '../data/playlists'
import { RUN_LENGTH, type ClipMode } from '../lib/game'
import { resultForDate } from '../lib/storage'
import { CoverMosaic } from './CoverMosaic'

type Props = {
  clipMode: ClipMode
  onClipMode: (mode: ClipMode) => void
  onDaily: () => void
  onUnlimited: (playlist: PlaylistInfo) => void
  onLeaderboard: () => void
  date: string
  loading?: boolean
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']

/** Today's date stamped on the daily card, split so the day can print large. */
function DateStamp({ date, className = '' }: { date: string; className?: string }) {
  const [, month, day] = date.split('-')
  return (
    <span className={`flex w-14 shrink-0 flex-col items-center ${className}`}>
      <span className="display text-4xl tabular-nums">{Number(day)}</span>
      <span className="font-mono text-[11px] font-semibold tracking-widest">
        {MONTHS[Number(month) - 1]}
      </span>
    </span>
  )
}

export function HomeScreen({
  clipMode,
  onClipMode,
  onDaily,
  onUnlimited,
  onLeaderboard,
  date,
  loading = false,
}: Props) {
  // Intro mode needs both a daily pool that works in either mode and at least
  // one free-play list with enough mapped tracks to be worth opening.
  const introReady = dailySupportsIntro() || PLAYLISTS.some(supportsIntro)
  // Intro mode may be open because a free-play list qualifies while the daily
  // pool still doesn't, so the daily is gated on its own readiness.
  const dailyReady = clipMode === 'hook' || dailySupportsIntro()
  const playedToday = resultForDate(date)

  const modes = [
    { mode: 'hook', label: 'Reff', hint: 'Bagian tengah lagu', ready: true },
    { mode: 'intro', label: 'Intro', hint: introReady ? 'Dari detik pertama' : 'Belum tersedia', ready: introReady },
  ] as const

  return (
    <div className="flex w-full flex-col gap-8">
      <header>
        <h1 className="display text-6xl">Tebak Lagu</h1>
        <div className="stripes mt-3" />
        <p className="mt-3 text-sm text-ink/70">
          Dengar potongan singkat, tebak lagunya. Salah tebak = potongan makin panjang.
        </p>
      </header>

      <section>
        <h2 className="mb-2 font-mono text-xs text-ink/60">Jenis potongan</h2>
        <div role="radiogroup" aria-label="Jenis potongan" className="paper grid grid-cols-2 p-1">
          {modes.map(({ mode, label, hint, ready }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={clipMode === mode}
              onClick={() => ready && onClipMode(mode)}
              disabled={!ready}
              className={`rounded-sm px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                clipMode === mode ? 'bg-ink text-card' : 'hover:bg-ink/5'
              }`}
            >
              <span className="block text-sm font-bold">{label}</span>
              <span className={`block text-xs ${clipMode === mode ? 'text-card/70' : 'text-ink/60'}`}>
                {hint}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-mono text-xs text-ink/60">Sisi A · Tantangan harian</h2>
        {/* Replaying a finished daily would reveal the answer again and produce a
            second, different share result for the same date. */}
        {playedToday ? (
          <div className="paper flex items-center gap-4 px-4 py-4">
            <DateStamp date={date} className="text-ink/50" />
            <div>
              <p className="flex items-center gap-1.5 font-bold">
                {playedToday.won ? (
                  <>
                    Selesai dalam {playedToday.attempts} tebakan
                    <PartyPopper aria-hidden className="size-4 text-tape-green" />
                  </>
                ) : (
                  'Sudah dimainkan hari ini'
                )}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink/60">
                Lagu baru besok. Main bebas di bawah
                <ArrowDown aria-hidden className="size-3" />
              </p>
            </div>
          </div>
        ) : !dailyReady ? (
          <div className="paper flex items-center gap-4 px-4 py-4 text-ink/60">
            <DateStamp date={date} />
            <p className="text-sm">
              Belum tersedia untuk mode Intro — pilih mode Reff untuk memainkannya.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDaily}
            disabled={loading}
            className="btn-primary justify-start gap-4 px-4 py-4 text-left"
          >
            <DateStamp date={date} />
            <span className="border-l-2 border-card/30 pl-4">
              <span className="display block text-2xl leading-none">Tantangan Harian</span>
              <span className="mt-1 block text-sm font-normal text-card/85">
                Satu lagu yang sama untuk semua orang
              </span>
            </span>
          </button>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-mono text-xs text-ink/60">Sisi B · Main bebas, {RUN_LENGTH} lagu</h2>
          <button
            type="button"
            onClick={onLeaderboard}
            className="flex items-center gap-1 text-xs font-semibold text-tape-red underline-offset-2 transition hover:underline"
          >
            <Trophy aria-hidden className="size-3.5" />
            Papan skor
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {PLAYLISTS.map((playlist) => {
            const available = clipMode === 'hook' || supportsIntro(playlist)
            // Styled as a cassette's J-card: the covers are the art, the strip
            // below is the label someone wrote the title on.
            return (
              <button
                key={playlist.id}
                type="button"
                disabled={!available || loading}
                onClick={() => onUnlimited(playlist)}
                className="paper group overflow-hidden text-left shadow-[3px_3px_0_var(--color-ink)] outline-none transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[3px_5px_0_var(--color-ink)] focus-visible:ring-2 focus-visible:ring-tape-mustard disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0"
              >
                <CoverMosaic
                  covers={playlist.covers}
                  icon={playlist.icon}
                  className={`border-b-2 border-ink ${available ? '' : 'grayscale'}`}
                />
                <div className="stripes" />
                <div className="flex items-baseline justify-between gap-2 px-2.5 pt-1.5 pb-2">
                  <span className="display min-w-0 text-base leading-none">{playlist.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink/60">{playlist.count}</span>
                </div>
                {!available && (
                  <span className="-mt-1.5 block px-2.5 pb-2 text-[11px] text-ink/70">
                    Mode intro belum siap
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
