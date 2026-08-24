import { useMemo, useState } from 'react'
import { GameScreen } from './components/GameScreen'
import { HomeScreen } from './components/HomeScreen'
import {
  DAILY_INFO,
  loadDailyTrack,
  loadPlaylist,
  tracksForMode,
  type Playlist,
  type PlaylistInfo,
} from './data/playlists'
import type { Track } from './lib/deezer'
import {
  pickDailyTrack,
  pickRandomTrack,
  todayInJakarta,
  type ClipMode,
  type PlayMode,
} from './lib/game'

type Round = {
  track: Track
  playlist: Playlist
  playMode: PlayMode
  /**
   * Held per round rather than read from the app-wide setting, so a round that
   * has to abandon intro mode — a YouTube ad in front of the video — falls back
   * on its own without changing what the home screen offers next time.
   */
  clipMode: ClipMode
  fellBack?: boolean
}

export default function App() {
  const [clipMode, setClipMode] = useState<ClipMode>('hook')
  const [round, setRound] = useState<Round | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const date = useMemo(() => todayInJakarta(), [])

  const start = async (info: PlaylistInfo, playMode: PlayMode, previous?: Track) => {
    setLoading(true)
    setError(null)
    try {
      const playlist = await loadPlaylist(info)

      let track: Track
      if (playMode === 'daily') {
        // Falls back to a seeded pick only past the end of the schedule.
        track = (await loadDailyTrack(date)) ?? pickDailyTrack(playlist.tracks, date)
      } else {
        const pool = tracksForMode(playlist, clipMode)
        if (!pool.length) throw new Error('Playlist kosong')
        track = pickRandomTrack(pool, previous)
      }

      setRound({ track, playlist, playMode, clipMode })
    } catch {
      setError('Gagal memuat daftar lagu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-950 px-5 py-8 text-white">
      <main className="mx-auto w-full max-w-md">
        {round ? (
          <GameScreen
            key={`${round.track.id}-${round.clipMode}`}
            track={round.track}
            playlist={round.playlist}
            playMode={round.playMode}
            clipMode={round.clipMode}
            fellBack={round.fellBack}
            date={date}
            onNext={() => void start(round.playlist, 'unlimited', round.track)}
            onHome={() => setRound(null)}
            // The daily pool guarantees every scheduled song plays in either
            // mode, so hook mode is always there to fall back to.
            onFallbackHook={() =>
              setRound((current) =>
                current ? { ...current, clipMode: 'hook', fellBack: true } : current,
              )
            }
          />
        ) : (
          <>
            <HomeScreen
              clipMode={clipMode}
              onClipMode={setClipMode}
              onDaily={() => void start(DAILY_INFO, 'daily')}
              onUnlimited={(info) => void start(info, 'unlimited')}
              date={date}
              loading={loading}
            />
            {error && <p className="mt-4 text-center text-sm text-rose-400">{error}</p>}
          </>
        )}
      </main>
    </div>
  )
}
