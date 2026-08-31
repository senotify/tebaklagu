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
  /**
   * Lets a clip that is already playing run on to a longer limit, without
   * restarting it. Skipping mid-clip unlocks more of the song, and cutting the
   * audio off at the old boundary only to make the player press play again
   * would be a worse way to deliver the thing they just earned. No-op when
   * nothing is playing, or when the new limit isn't longer.
   */
  extend: (seconds: number) => void
  /**
   * Moves the playhead. The caller is responsible for keeping `seconds` inside
   * what the player has unlocked — seeking past that would hand them song they
   * haven't earned. A clip that is playing carries on from the new point and
   * still stops at its limit; one that is paused resumes from here on next play.
   */
  seek: (seconds: number) => void
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
