import { useCallback, useMemo, useState } from 'react'
import { GameScreen } from './components/GameScreen'
import { HomeScreen } from './components/HomeScreen'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { RunSummary, type RunResult } from './components/RunSummary'
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
  pickRunTracks,
  RUN_LENGTH,
  scoreForRound,
  todayInJakarta,
  type ClipMode,
  type PlayMode,
} from './lib/game'
import { markSeen, seenToday } from './lib/storage'

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

/**
 * A free-play run: a fixed set of songs dealt up front, scored as a whole. Its
 * clip mode is the one the run was started in and decides which board the
 * score goes to, even if a single round had to fall back to hook mode.
 */
type Run = {
  playlist: Playlist
  clipMode: ClipMode
  tracks: Track[]
  /**
   * Stand-ins for a round an ad made unplayable. "Lagu lain" swaps the song
   * rather than scoring it, since the player never got to hear it.
   */
  spares: Track[]
  index: number
  results: RunResult[]
}

/** Spare songs dealt with each run, for swapping out ad-blocked rounds. */
const SPARES = 5

type View = 'home' | 'round' | 'summary' | 'leaderboard'

export default function App() {
  const [clipMode, setClipMode] = useState<ClipMode>('hook')
  const [view, setView] = useState<View>('home')
  const [round, setRound] = useState<Round | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const date = useMemo(() => todayInJakarta(), [])

  const playRunRound = (next: Run) => {
    const track = next.tracks[next.index]
    // Marked as each round starts rather than when the run is dealt, so quitting
    // early doesn't use up songs that were never heard.
    markSeen(date, [track.id])
    setRun(next)
    setRound({ track, playlist: next.playlist, playMode: 'unlimited', clipMode: next.clipMode })
    setView('round')
  }

  const startDaily = async () => {
    setLoading(true)
    setError(null)
    try {
      const playlist = await loadPlaylist(DAILY_INFO)
      // Falls back to a seeded pick only past the end of the schedule.
      const track = (await loadDailyTrack(date)) ?? pickDailyTrack(playlist.tracks, date)
      setRun(null)
      setRound({ track, playlist, playMode: 'daily', clipMode })
      setView('round')
    } catch {
      setError('Gagal memuat daftar lagu.')
    } finally {
      setLoading(false)
    }
  }

  const startRun = async (info: PlaylistInfo, mode: ClipMode) => {
    setLoading(true)
    setError(null)
    try {
      const playlist = await loadPlaylist(info)
      const exclude = seenToday(date)
      // Today's daily song never turns up in free play, played yet or not —
      // hearing it here first would give the daily away.
      const daily = await loadDailyTrack(date).catch(() => null)
      if (daily) exclude.add(daily.id)
      const dealt = pickRunTracks(tracksForMode(playlist, mode), RUN_LENGTH + SPARES, exclude)
      const tracks = dealt.slice(0, RUN_LENGTH)
      if (!tracks.length) throw new Error('Playlist kosong')
      playRunRound({
        playlist,
        clipMode: mode,
        tracks,
        spares: dealt.slice(RUN_LENGTH),
        index: 0,
        results: [],
      })
    } catch {
      setError('Gagal memuat daftar lagu.')
    } finally {
      setLoading(false)
    }
  }

  // Keyed by position, so a round reported twice can't be counted twice.
  const recordResult = useCallback((won: boolean, attempts: number) => {
    setRun((current) => {
      if (!current) return current
      const results = [...current.results]
      results[current.index] = {
        track: current.tracks[current.index],
        won,
        attempts,
        points: scoreForRound(won, attempts),
      }
      return { ...current, results }
    })
  }, [])

  const next = () => {
    if (!run) return
    // Leaving a round that never finished means an ad blocked it: deal a spare
    // into the same slot. With none left, it counts as a miss.
    if (!run.results[run.index]) {
      const [spare, ...spares] = run.spares
      if (spare) {
        const tracks = [...run.tracks]
        tracks[run.index] = spare
        playRunRound({ ...run, tracks, spares })
        return
      }
    }
    const results = [...run.results]
    results[run.index] ??= { track: run.tracks[run.index], won: false, attempts: 0, points: 0 }
    if (run.index + 1 < run.tracks.length) playRunRound({ ...run, results, index: run.index + 1 })
    else {
      setRun({ ...run, results })
      setView('summary')
    }
  }

  const home = () => {
    setRound(null)
    setRun(null)
    setView('home')
  }

  const runScore = run?.results.reduce((sum, r) => sum + (r?.points ?? 0), 0) ?? 0

  return (
    <div className="min-h-dvh px-5 py-8">
      <main className="mx-auto w-full max-w-md">
        {view === 'round' && round ? (
          <GameScreen
            key={`${round.track.id}-${round.clipMode}`}
            track={round.track}
            playlist={round.playlist}
            playMode={round.playMode}
            clipMode={round.clipMode}
            fellBack={round.fellBack}
            date={date}
            run={run ? { index: run.index, total: run.tracks.length, score: runScore } : undefined}
            onFinish={run ? recordResult : undefined}
            onNext={next}
            onHome={home}
            // The daily pool guarantees every scheduled song plays in either
            // mode, so hook mode is always there to fall back to.
            onFallbackHook={() =>
              setRound((current) =>
                current ? { ...current, clipMode: 'hook', fellBack: true } : current,
              )
            }
          />
        ) : view === 'summary' && run ? (
          <RunSummary
            playlist={run.playlist}
            clipMode={run.clipMode}
            results={run.results}
            onPlayAgain={() => void startRun(run.playlist, run.clipMode)}
            onHome={home}
          />
        ) : view === 'leaderboard' ? (
          <LeaderboardScreen clipMode={clipMode} onHome={home} />
        ) : (
          <>
            <HomeScreen
              clipMode={clipMode}
              onClipMode={setClipMode}
              onDaily={() => void startDaily()}
              onUnlimited={(info) => void startRun(info, clipMode)}
              onLeaderboard={() => setView('leaderboard')}
              date={date}
              loading={loading}
            />
            {error && <p className="mt-4 text-center text-sm text-tape-red">{error}</p>}
          </>
        )}
      </main>
    </div>
  )
}
