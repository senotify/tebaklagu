import type { Track } from './deezer'

export type ClipMode = 'hook' | 'intro'
export type PlayMode = 'daily' | 'unlimited'

/**
 * Hook mode plays a Deezer preview through an <audio> element, which can be cut
 * to a tenth of a second. Intro mode drives a YouTube iframe, where player
 * start-up latency makes anything under half a second unreliable, so its first
 * stage is longer.
 */
export const STAGES: Record<ClipMode, readonly number[]> = {
  hook: [0.1, 0.5, 2, 4, 8, 15],
  intro: [0.5, 1, 2, 4, 8, 15],
}

export const MAX_ATTEMPTS = STAGES.hook.length
export const CLIP_WINDOW = 30

export type GuessOutcome = 'correct' | 'wrong' | 'skip'

export type Guess = {
  outcome: GuessOutcome
  label: string
}

/** Strips accents, bracketed suffixes and "feat." credits before comparing. */
export function normalizeTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*[([][^)\]]*[)\]]/g, '')
    .replace(/\b(feat|ft|featuring|with)\b.*$/g, '')
    .replace(/\s*-\s*(remaster|remastered|live|radio edit|album version).*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function isCorrectGuess(guess: Track, answer: Track): boolean {
  if (guess.id === answer.id) return true
  return (
    normalizeTitle(guess.title) === normalizeTitle(answer.title) &&
    normalizeTitle(guess.artist) === normalizeTitle(answer.artist)
  )
}

/** Deterministic 32-bit hash, so a given date always yields the same song. */
function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Today's date in WIB (UTC+7) as YYYY-MM-DD, independent of device timezone. */
export function todayInJakarta(now: Date = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return wib.toISOString().slice(0, 10)
}

export function pickDailyTrack<T>(pool: readonly T[], date: string): T {
  if (!pool.length) throw new Error('Daily pool is empty')
  return pool[hashString(date) % pool.length]
}

export function pickRandomTrack<T>(pool: readonly T[], exclude?: T): T {
  const options = exclude && pool.length > 1 ? pool.filter((t) => t !== exclude) : pool
  return options[Math.floor(Math.random() * options.length)]
}

export function buildShareText(
  date: string,
  guesses: readonly Guess[],
  won: boolean,
  clipMode: ClipMode,
): string {
  const squares = guesses
    .map((g) => (g.outcome === 'correct' ? '🟩' : g.outcome === 'skip' ? '⬜️' : '🟥'))
    .join('')
  const padding = '⬛️'.repeat(Math.max(0, MAX_ATTEMPTS - guesses.length))
  const score = won ? `${guesses.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`
  const mode = clipMode === 'intro' ? 'Intro' : 'Hook'

  return [
    `Tebak Lagu ${date} (${mode}) ${score}`,
    squares + padding,
    'https://tebaklagu.senotify.com',
  ].join('\n')
}
