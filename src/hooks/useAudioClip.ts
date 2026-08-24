import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClipPlayer } from './clipPlayer'

type Options = {
  /** Called when playback stops on its own, not via stop(). */
  onEnded?: () => void
}

/**
 * Plays the opening N seconds of an audio source.
 *
 * A setTimeout alone is too coarse for the 0.1s stage — timers fire late and the
 * player hears noticeably more than a tenth of a second. So playback is watched
 * on every animation frame and stopped the moment currentTime passes the limit,
 * with a timeout as a backstop for when the tab is hidden and frames pause.
 */
export function useAudioClip({ onEnded }: Options = {}): ClipPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endedRef = useRef(onEnded)
  endedRef.current = onEnded

  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'auto'
  }

  const clearTimers = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    frameRef.current = null
    timerRef.current = null
  }, [])

  const stop = useCallback(() => {
    clearTimers()
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setIsPlaying(false)
    setPosition(0)
  }, [clearTimers])

  const load = useCallback(
    (src: string) => {
      const audio = audioRef.current
      if (!audio) return
      clearTimers()
      setIsReady(false)
      setError(null)
      setIsPlaying(false)
      setPosition(0)
      audio.src = src
      audio.load()
    },
    [clearTimers],
  )

  const play = useCallback(
    async (seconds: number) => {
      const audio = audioRef.current
      if (!audio || !audio.src) return

      clearTimers()
      audio.currentTime = 0
      setError(null)

      try {
        await audio.play()
      } catch {
        // Autoplay policies reject playback without a user gesture; the button
        // press that triggers this normally satisfies them.
        setError('Ketuk tombol putar untuk memulai audio')
        return
      }

      setIsPlaying(true)

      const finish = () => {
        clearTimers()
        audio.pause()
        audio.currentTime = 0
        setIsPlaying(false)
        setPosition(0)
        endedRef.current?.()
      }

      const watch = () => {
        if (audio.currentTime >= seconds || audio.ended) {
          finish()
          return
        }
        setPosition(audio.currentTime)
        frameRef.current = requestAnimationFrame(watch)
      }
      frameRef.current = requestAnimationFrame(watch)

      // Backstop: rAF is throttled in background tabs, where the clip would
      // otherwise keep playing well past its limit.
      timerRef.current = setTimeout(finish, seconds * 1000 + 120)
    },
    [clearTimers],
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onCanPlay = () => setIsReady(true)
    const onError = () => setError('Gagal memuat audio')
    audio.addEventListener('canplaythrough', onCanPlay)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('canplaythrough', onCanPlay)
      audio.removeEventListener('error', onError)
    }
  }, [])

  useEffect(
    () => () => {
      clearTimers()
      audioRef.current?.pause()
    },
    [clearTimers],
  )

  /** Plays the whole preview, used once the answer is revealed. */
  const playFull = useCallback(async () => {
    const audio = audioRef.current
    if (!audio?.src) return
    clearTimers()
    audio.currentTime = 0
    try {
      await audio.play()
      setIsPlaying(true)
      const watch = () => {
        if (audio.ended || audio.paused) {
          setIsPlaying(false)
          setPosition(0)
          return
        }
        setPosition(audio.currentTime)
        frameRef.current = requestAnimationFrame(watch)
      }
      frameRef.current = requestAnimationFrame(watch)
    } catch {
      setError('Gagal memutar audio')
    }
  }, [clearTimers])

  return {
    load,
    // The async internals are fire-and-forget so both clip engines share one
    // synchronous surface.
    play: (seconds: number) => void play(seconds),
    playFull: () => void playFull(),
    stop,
    isPlaying,
    position,
    isReady,
    error,
    // Nothing can come between an <audio> element and its own src.
    blocked: false,
  }
}
