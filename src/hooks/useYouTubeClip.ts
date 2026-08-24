import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClipPlayer } from './clipPlayer'

export type YouTubeClipPlayer = ClipPlayer & {
  /** Attach to the element that should hold the player. */
  containerRef: (node: HTMLDivElement | null) => void
}

// Minimal shape of the bits of the IFrame API we use.
type YTPlayer = {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  mute: () => void
  unMute: () => void
  loadVideoById: (id: string) => void
  cueVideoById: (id: string) => void
  destroy: () => void
}

type YTNamespace = {
  Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const API_SRC = 'https://www.youtube.com/iframe_api'
let apiPromise: Promise<YTNamespace> | null = null

/** Loads the IFrame API once per page, on first use rather than at startup. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('YouTube API loaded without a Player'))
    }

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement('script')
      script.src = API_SRC
      script.async = true
      script.onerror = () => reject(new Error('Could not load the YouTube API'))
      document.head.appendChild(script)
    }
  })

  return apiPromise
}

/**
 * Catalog lengths are whole seconds while getDuration returns a float, and
 * uploads occasionally differ from the reported length by a hair.
 */
const DURATION_TOLERANCE = 2
/** How often the priming pass re-reads the duration while it waits. */
const PROBE_INTERVAL = 150
/**
 * How long a disagreeing duration must persist before it counts as an ad rather
 * than metadata still settling. Pre-rolls run far longer than this, so there is
 * no risk of mistaking the tail of one for the song.
 */
const PROBE_LIMIT = 2000
/** If autoplay never starts at all, stop waiting and accept a slower first play. */
const PRIME_TIMEOUT = 4000

/**
 * Plays the opening seconds of a YouTube video.
 *
 * Unlike an <audio> element, the iframe player takes a noticeable moment to
 * start, which would swallow a short clip whole. So each video is primed on
 * load — played muted, paused, and rewound to 0 — leaving it buffered and ready
 * to start near-instantly when the player actually presses play. Even so the
 * first stage is 0.5s rather than the 0.1s hook mode can manage.
 *
 * The other thing priming has to establish is that the *song* is what is cued
 * up. A monetised video serves a pre-roll ad first, and the IFrame API exposes
 * no ad state at all — during a pre-roll, getCurrentTime and getDuration report
 * the ad. Left unchecked the round would play advertisement audio and the player
 * would spend a guess on it. Comparing getDuration against the length recorded
 * in the catalog is the available signal, so that is what both priming and
 * playback check. When an ad turns up the round is reported `blocked` and handed
 * back to the caller, which moves to another song or falls back to hook mode —
 * deliberately rather than sitting through the ad muted behind the cover.
 */
export function useYouTubeClip(): YouTubeClipPlayer {
  // A callback ref rather than useRef: the player has to be rebuilt whenever the
  // container mounts again, which happens when the mode changes and when an
  // error screen is dismissed. A ref alone wouldn't re-run the effect.
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => setContainer(node), [])
  const playerRef = useRef<YTPlayer | null>(null)
  const frameRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const probeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const primingRef = useRef(false)
  // The video this round wants, and how long it should run. Kept (not cleared on
  // use) so that rebuilding the player — after a mode switch or a dismissed
  // error — re-primes the current track rather than nothing at all.
  const currentVideoRef = useRef<string | null>(null)
  const expectedRef = useRef<number | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)

  const clearTimers = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    if (probeRef.current !== null) clearTimeout(probeRef.current)
    frameRef.current = null
    timerRef.current = null
    probeRef.current = null
  }, [])

  const durationOf = (player: YTPlayer): number => {
    try {
      return player.getDuration()
    } catch {
      return 0
    }
  }

  /** True once the player reports our video's length rather than anything else. */
  const isOurVideo = useCallback((player: YTPlayer): boolean => {
    const expected = expectedRef.current
    if (!expected) return false
    const actual = durationOf(player)
    return actual > 0 && Math.abs(actual - expected) <= DURATION_TOLERANCE
  }, [])

  /**
   * True only when the player is definitely on something else. A duration of 0
   * means metadata hasn't arrived yet, which is not evidence of an ad — treating
   * it as one would refuse to play on any slow connection.
   */
  const isOtherVideo = useCallback((player: YTPlayer): boolean => {
    const expected = expectedRef.current
    if (!expected) return true
    const actual = durationOf(player)
    return actual > 0 && Math.abs(actual - expected) > DURATION_TOLERANCE
  }, [])

  const stop = useCallback(() => {
    clearTimers()
    try {
      playerRef.current?.pauseVideo()
      playerRef.current?.seekTo(0, true)
    } catch {
      // Player torn down mid-call; nothing to stop.
    }
    setIsPlaying(false)
    setPosition(0)
  }, [clearTimers])

  /**
   * Buffers a video and parks it at 0:00 so the next play starts promptly.
   *
   * Muting comes first and deliberately: loadVideoById starts playing on its
   * own, and an unmuted burst here would give the song away before the player
   * has guessed. It also keeps the priming pass within autoplay policy, which
   * allows muted playback without a user gesture.
   */
  const prime = useCallback(
    (player: YTPlayer, videoId: string, expectedDuration: number) => {
      primingRef.current = true
      expectedRef.current = expectedDuration
      setIsReady(false)
      setBlocked(false)
      try {
        player.mute()
        player.loadVideoById(videoId)
      } catch {
        setError('Gagal menyiapkan video')
        return
      }

      clearTimers()
      timerRef.current = setTimeout(() => {
        if (primingRef.current) {
          primingRef.current = false
          setIsReady(true)
        }
      }, PRIME_TIMEOUT)
    },
    [clearTimers],
  )

  /**
   * Waits for the player to actually be on our video, then parks it at the
   * start. A duration that disagrees for longer than PROBE_LIMIT is a pre-roll,
   * and the round is abandoned rather than played through.
   */
  const settleOrBlock = useCallback(
    (player: YTPlayer) => {
      const startedAt = performance.now()

      const tick = () => {
        if (!primingRef.current) return

        if (isOurVideo(player)) {
          primingRef.current = false
          clearTimers()
          try {
            player.pauseVideo()
            player.seekTo(0, true)
            player.unMute()
          } catch {
            // Ignore; readiness is reported either way.
          }
          setIsReady(true)
          return
        }

        if (isOtherVideo(player) && performance.now() - startedAt > PROBE_LIMIT) {
          primingRef.current = false
          clearTimers()
          try {
            player.pauseVideo()
          } catch {
            // Already gone.
          }
          setIsReady(false)
          setBlocked(true)
          return
        }

        probeRef.current = setTimeout(tick, PROBE_INTERVAL)
      }

      tick()
    },
    [clearTimers, isOtherVideo, isOurVideo],
  )

  const onStateChange = useCallback(
    (state: number) => {
      const player = playerRef.current
      const YT = window.YT
      if (!player || !YT) return

      // Muted priming pass reached PLAYING. That alone doesn't mean the song is
      // up — a pre-roll reports PLAYING too — so hand off to the duration check.
      if (primingRef.current && state === YT.PlayerState.PLAYING) {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        settleOrBlock(player)
      }
    },
    [settleOrBlock],
  )

  // Create the player once the container exists. Nothing here runs in hook
  // mode, where the container is never rendered — not even loading the API.
  useEffect(() => {
    if (!container) return

    let cancelled = false
    // The API swaps the element it is given for an <iframe>. Handing it a node
    // React doesn't manage avoids React later trying to remove a child that is
    // no longer there.
    const mount = document.createElement('div')
    mount.className = 'h-full w-full'
    container.appendChild(mount)

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || playerRef.current) return
        playerRef.current = new YT.Player(mount, {
          width: '100%',
          height: '100%',
          playerVars: {
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            fs: 0,
          },
          events: {
            onReady: () => {
              const wanted = currentVideoRef.current
              const expected = expectedRef.current
              if (wanted && expected && playerRef.current) {
                prime(playerRef.current, wanted, expected)
              }
            },
            onStateChange: (e: { data: number }) => onStateChange(e.data),
            onError: () => setError('Video tidak dapat diputar'),
          },
        })
      })
      .catch(() => setError('Gagal memuat pemutar YouTube'))

    return () => {
      cancelled = true
      clearTimers()
      try {
        playerRef.current?.destroy()
      } catch {
        // Already gone.
      }
      playerRef.current = null
      container.replaceChildren()
    }
  }, [container, clearTimers, onStateChange, prime])

  const load = useCallback(
    (videoId: string, expectedDuration?: number) => {
      clearTimers()
      setError(null)
      setIsPlaying(false)
      setPosition(0)
      setIsReady(false)
      setBlocked(false)
      currentVideoRef.current = videoId
      expectedRef.current = expectedDuration ?? null

      // Nothing can be verified without a known length, and playing unverified
      // risks handing the round an advertisement. The catalog guarantees one
      // (check-catalog enforces it), so this only fires on a wiring mistake.
      if (!expectedDuration) {
        setBlocked(true)
        return
      }

      const player = playerRef.current
      if (!player) return // onReady primes it once the player exists
      prime(player, videoId, expectedDuration)
    },
    [clearTimers, prime],
  )

  const runClip = useCallback(
    (seconds: number | null) => {
      const player = playerRef.current
      if (!player) return

      clearTimers()
      setError(null)

      // Priming usually catches an ad first, but not when autoplay never ran, so
      // the same check gates playback.
      //
      // Only for staged clips (seconds !== null). The full play happens after the
      // reveal, where the answer is already out and the iframe is uncovered — an
      // ad there is visible and the player can simply skip it, so refusing to
      // play would take away the one case that needs no protection.
      if (seconds !== null && isOtherVideo(player)) {
        setBlocked(true)
        return
      }

      try {
        player.seekTo(0, true)
        player.unMute()
        player.playVideo()
      } catch {
        setError('Gagal memutar video')
        return
      }
      setIsPlaying(true)

      const finish = () => {
        clearTimers()
        try {
          player.pauseVideo()
          player.seekTo(0, true)
        } catch {
          // Player gone.
        }
        setIsPlaying(false)
        setPosition(0)
      }

      const watch = () => {
        // An ad that starts once playback is under way would otherwise drive the
        // progress bar and burn the stage on advertisement audio. Again only
        // while a clip is staged; after the reveal there is nothing to protect.
        if (seconds !== null && isOtherVideo(player)) {
          finish()
          setBlocked(true)
          return
        }

        let current = 0
        try {
          current = player.getCurrentTime()
        } catch {
          finish()
          return
        }
        if (seconds !== null && current >= seconds) {
          finish()
          return
        }
        setPosition(current)
        frameRef.current = requestAnimationFrame(watch)
      }
      frameRef.current = requestAnimationFrame(watch)

      if (seconds !== null) {
        // Backstop for background tabs, where animation frames stop firing.
        timerRef.current = setTimeout(finish, seconds * 1000 + 400)
      }
    },
    [clearTimers, isOtherVideo],
  )

  const play = useCallback((seconds: number) => runClip(seconds), [runClip])
  const playFull = useCallback(() => runClip(null), [runClip])

  return {
    containerRef,
    load,
    play,
    playFull,
    stop,
    isPlaying,
    position,
    isReady,
    error,
    blocked,
  }
}
