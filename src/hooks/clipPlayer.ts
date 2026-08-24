/**
 * The two clip engines — a Deezer preview in an <audio> element and a YouTube
 * iframe playing from 0:00 — expose the same surface so GameScreen can swap
 * between them without knowing which is which.
 */
export type ClipPlayer = {
  /**
   * Hook mode takes a preview URL; intro mode takes a YouTube video id plus the
   * video's known length, which it uses to verify the right thing is playing.
   */
  load: (source: string, expectedDuration?: number) => void
  /** Plays the opening `seconds` of the clip, then stops. */
  play: (seconds: number) => void
  /** Plays the clip in full, used after the answer is revealed. */
  playFull: () => void
  stop: () => void
  isPlaying: boolean
  /** Playback head in seconds, for the progress bar. */
  position: number
  isReady: boolean
  error: string | null
  /**
   * The engine reached something other than the requested song — in practice a
   * YouTube pre-roll ad. Playing would give the round advertisement audio, so
   * the caller has to route around it rather than start the clip. Always false
   * for hook mode, which owns its <audio> element outright.
   */
  blocked: boolean
}
