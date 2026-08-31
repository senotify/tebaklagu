import { useCallback, useEffect, useRef, useState } from 'react'
import type { Playlist } from '../data/playlists'
import { useAudioClip } from '../hooks/useAudioClip'
import { useYouTubeClip } from '../hooks/useYouTubeClip'
import { fetchPreviewUrl, type Suggestion, type Track } from '../lib/deezer'
import {
  isCorrectGuess,
  MAX_ATTEMPTS,
  STAGES,
  type ClipMode,
  type Guess,
  type PlayMode,
} from '../lib/game'
import { recordDaily } from '../lib/storage'
import { GuessHistory } from './GuessHistory'
import { GuessInput } from './GuessInput'
import { PlayerBar } from './PlayerBar'
import { ResultCard } from './ResultCard'

type Props = {
  track: Track
  playlist: Playlist
  playMode: PlayMode
  clipMode: ClipMode
  date: string
  onNext: () => void
  onHome: () => void
  /** Switches this round alone to hook mode, used when an ad blocks intro mode. */
  onFallbackHook: () => void
  /** This round already fell back from intro mode, so say why. */
  fellBack?: boolean
}

export function GameScreen({
  track,
  playlist,
  playMode,
  clipMode,
  date,
  onNext,
  onHome,
  onFallbackHook,
  fellBack,
}: Props) {
  const stages = STAGES[clipMode]
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [finished, setFinished] = useState<null | { won: boolean }>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const recorded = useRef(false)

  // Both engines are instantiated (hooks can't be conditional) but only the one
  // for the active mode is ever given a source, so the other stays inert.
  const audio = useAudioClip()
  const youtube = useYouTubeClip()
  const isIntro = clipMode === 'intro'
  const { load, play, extend, seek, playFull, stop, isPlaying, position, isReady, error, blocked } =
    isIntro ? youtube : audio

  const stageIndex = Math.min(guesses.length, MAX_ATTEMPTS - 1)

  // Intro mode plays a YouTube video from 0:00 and needs nothing fetched. Hook
  // mode needs a preview URL, which expires ~15 minutes after it is issued, so
  // each round asks for a fresh one and a stale-tab failure is retried once.
  const loadPreview = useCallback(
    async (signal?: AbortSignal) => {
      setLoadError(null)
      if (isIntro) {
        // The length is as necessary as the id: without it the player can't tell
        // the song from a pre-roll ad, so it refuses to play at all.
        if (!track.youtubeId || !track.ytDuration) {
          setLoadError('Lagu ini belum tersedia untuk mode intro.')
          return
        }
        load(track.youtubeId, track.ytDuration)
        return
      }
      try {
        load(await fetchPreviewUrl(track.id, signal))
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setLoadError('Gagal memuat lagu. Coba lagi.')
      }
    },
    [isIntro, load, track.id, track.youtubeId, track.ytDuration],
  )

  useEffect(() => {
    const controller = new AbortController()
    setGuesses([])
    setFinished(null)
    recorded.current = false
    stop()
    void loadPreview(controller.signal)
    return () => controller.abort()
  }, [loadPreview, stop])

  // A tab left open past the token's lifetime gets one silent retry.
  const retried = useRef(false)
  useEffect(() => {
    if (error === 'Gagal memuat audio' && !retried.current) {
      retried.current = true
      void loadPreview()
    }
  }, [error, loadPreview])

  const finish = useCallback(
    (won: boolean, finalGuesses: Guess[]) => {
      setFinished({ won })
      stop()
      if (playMode === 'daily' && !recorded.current) {
        recorded.current = true
        recordDaily({ date, won, attempts: finalGuesses.length, clipMode })
      }
    },
    [clipMode, date, playMode, stop],
  )

  const addGuess = (guess: Guess) => {
    const next = [...guesses, guess]
    setGuesses(next)
    if (guess.outcome === 'correct') finish(true, next)
    else if (next.length >= MAX_ATTEMPTS) finish(false, next)
    // The attempt unlocked a longer clip. If audio is still running, let it play
    // on to the new limit rather than cutting out at the old one — otherwise the
    // player has to press play again to hear what they just unlocked.
    else extend(stages[next.length])
  }

  const onGuess = (choice: Suggestion) => {
    const correct = isCorrectGuess(choice, track)
    addGuess({
      outcome: correct ? 'correct' : 'wrong',
      label: `${choice.title} — ${choice.artist}`,
    })
  }

  const onSkip = () => addGuess({ outcome: 'skip', label: 'Dilewati' })

  const remaining = MAX_ATTEMPTS - guesses.length
  const nextStage = stages[Math.min(guesses.length + 1, MAX_ATTEMPTS - 1)]
  // What skipping buys, rather than the new total — the gain is what the player
  // is weighing. Null on the last attempt, where skipping ends the round.
  const skipGain = remaining > 1 ? Number((nextStage - stages[stageIndex]).toFixed(1)) : null

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between text-xs text-white/40">
        <button type="button" onClick={onHome} className="transition hover:text-white">
          ← Menu
        </button>
        <span>
          {playMode === 'daily' ? `Harian · ${date}` : playlist.title} ·{' '}
          {clipMode === 'intro' ? 'Intro' : 'Reff'}
        </span>
      </div>

      {fellBack && (
        <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-white/50">
          Iklan YouTube menghalangi mode intro, jadi ronde ini pakai potongan reff.
        </p>
      )}

      {loadError ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-rose-400">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadPreview()}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <>
          {isIntro && (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              <div ref={youtube.containerRef} className="h-full w-full" />
              {/* The video frame names the song, so it stays covered until the
                  round is over — the audio is the puzzle. */}
              {!finished && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-900 text-center">
                  <span className="text-2xl">🎧</span>
                  <span className="text-xs text-white/35">Dengarkan, jangan mengintip</span>
                </div>
              )}
            </div>
          )}

          {/* An ad in front of the video would play advertisement audio in place
              of the song, and a guess spent on that is a guess wasted. So the
              round stops here and offers a way out instead. */}
          {blocked && !finished ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-6 text-center">
              <p className="text-sm text-amber-300">
                YouTube memutar iklan sebelum lagu ini, jadi mode intro tidak bisa dipakai.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {playMode === 'unlimited' && (
                  <button
                    type="button"
                    onClick={onNext}
                    className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
                  >
                    Lagu lain
                  </button>
                )}
                <button
                  type="button"
                  onClick={onFallbackHook}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
                >
                  Pakai mode Reff
                </button>
              </div>
            </div>
          ) : (
            <>
              <PlayerBar
                stages={stages}
                stageIndex={stageIndex}
                position={position}
                isPlaying={isPlaying}
                isReady={isReady}
                revealed={Boolean(finished)}
                onPlay={() => (finished ? void playFull() : void play(stages[stageIndex]))}
                onStop={stop}
                onSkip={onSkip}
                onSeek={seek}
                skipGain={skipGain}
              />

              {error && !loadError && (
                <p className="text-center text-xs text-amber-400">{error}</p>
              )}

              {finished ? (
                <ResultCard
                  track={track}
                  won={finished.won}
                  guesses={guesses}
                  playMode={playMode}
                  clipMode={clipMode}
                  date={date}
                  onNext={onNext}
                  onHome={onHome}
                />
              ) : (
                <>
                  <GuessHistory guesses={guesses} />
                  <GuessInput onGuess={onGuess} />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
