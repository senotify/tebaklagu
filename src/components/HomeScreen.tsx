import {
  dailySupportsIntro,
  PLAYLISTS,
  supportsIntro,
  type PlaylistInfo,
} from '../data/playlists'
import type { ClipMode } from '../lib/game'
import { resultForDate } from '../lib/storage'

type Props = {
  clipMode: ClipMode
  onClipMode: (mode: ClipMode) => void
  onDaily: () => void
  onUnlimited: (playlist: PlaylistInfo) => void
  date: string
  loading?: boolean
}

export function HomeScreen({
  clipMode,
  onClipMode,
  onDaily,
  onUnlimited,
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

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Tebak <span className="text-emerald-400">Lagu</span>
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Dengar potongan singkat, tebak lagunya. Salah tebak = potongan makin panjang.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
          Jenis potongan
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onClipMode('hook')}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              clipMode === 'hook'
                ? 'border-emerald-400/60 bg-emerald-400/10'
                : 'border-white/10 hover:bg-white/5'
            }`}
          >
            <span className="block text-sm font-medium text-white">Reff</span>
            <span className="mt-0.5 block text-xs text-white/45">
              Bagian tengah lagu, mulai 0,1 detik
            </span>
          </button>

          <button
            type="button"
            onClick={() => introReady && onClipMode('intro')}
            disabled={!introReady}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              clipMode === 'intro'
                ? 'border-emerald-400/60 bg-emerald-400/10'
                : 'border-white/10 hover:bg-white/5'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <span className="block text-sm font-medium text-white">Intro</span>
            <span className="mt-0.5 block text-xs text-white/45">
              {introReady ? 'Dari detik pertama lagu' : 'Belum tersedia'}
            </span>
          </button>
        </div>
      </section>

      <section>
        {/* Replaying a finished daily would reveal the answer again and produce a
            second, different share result for the same date. */}
        {playedToday ? (
          <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="font-semibold text-white">Tantangan Harian</p>
            <p className="mt-0.5 text-sm text-white/50">
              {playedToday.won
                ? `Selesai dalam ${playedToday.attempts} tebakan 🎉`
                : 'Sudah dimainkan hari ini'}
            </p>
            <p className="mt-2 text-xs text-white/35">Lagu baru besok. Main bebas di bawah 👇</p>
          </div>
        ) : !dailyReady ? (
          <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="font-semibold text-white/60">Tantangan Harian</p>
            <p className="mt-0.5 text-sm text-white/40">
              Belum tersedia untuk mode Intro — pilih mode Reff untuk memainkannya.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDaily}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 px-4 py-4 text-left text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            <span className="block font-semibold">Tantangan Harian</span>
            <span className="mt-0.5 block text-sm text-black/70">
              Satu lagu yang sama untuk semua orang
            </span>
          </button>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
          Main bebas
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {PLAYLISTS.map((playlist) => {
            const available = clipMode === 'hook' || supportsIntro(playlist)
            const count = clipMode === 'intro' ? playlist.introCount : playlist.count
            return (
              <button
                key={playlist.id}
                type="button"
                disabled={!available || loading}
                onClick={() => onUnlimited(playlist)}
                className="rounded-xl border border-white/10 px-3 py-3 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span className="block text-lg">{playlist.emoji}</span>
                <span className="mt-1 block text-sm font-medium text-white">{playlist.title}</span>
                <span className="block text-xs text-white/40">
                  {available ? `${count} lagu` : 'Mode intro belum siap'}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
