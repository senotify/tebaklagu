import { MAX_ATTEMPTS, type ClipMode } from './game'

const KEY = 'tebaklagu.stats.v1'

export type DailyResult = {
  date: string
  won: boolean
  attempts: number
  clipMode: ClipMode
}

export type Stats = {
  played: number
  wins: number
  currentStreak: number
  maxStreak: number
  /** Wins bucketed by attempt count; index 0 means solved on the first clip. */
  distribution: number[]
  lastDate: string | null
  results: Record<string, DailyResult>
}

const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: Array(MAX_ATTEMPTS).fill(0),
  lastDate: null,
  results: {},
})

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyStats()
    const parsed = JSON.parse(raw) as Partial<Stats>
    return { ...emptyStats(), ...parsed }
  } catch {
    // Private browsing or corrupted data — play on with a clean slate.
    return emptyStats()
  }
}

function save(stats: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats))
  } catch {
    // Storage unavailable; stats simply won't persist.
  }
}

const previousDay = (date: string) => {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Records a finished daily round. Replaying a stored date is ignored. */
export function recordDaily(result: DailyResult): Stats {
  const stats = loadStats()
  if (stats.results[result.date]) return stats

  stats.results[result.date] = result
  stats.played += 1

  if (result.won) {
    stats.wins += 1
    stats.distribution[result.attempts - 1] += 1
    stats.currentStreak =
      stats.lastDate === previousDay(result.date) ? stats.currentStreak + 1 : 1
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak)
  } else {
    stats.currentStreak = 0
  }

  stats.lastDate = result.date
  save(stats)
  return stats
}

export const resultForDate = (date: string): DailyResult | undefined => loadStats().results[date]
