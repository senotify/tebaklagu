import { MAX_ATTEMPTS, type Guess } from '../lib/game'

export function GuessHistory({ guesses }: { guesses: readonly Guess[] }) {
  const rows = [...guesses, ...Array(Math.max(0, MAX_ATTEMPTS - guesses.length)).fill(null)]

  return (
    <ul className="flex w-full flex-col gap-1.5">
      {rows.map((guess: Guess | null, i) => (
        <li
          key={i}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            guess
              ? guess.outcome === 'correct'
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                : 'border-white/10 bg-white/5 text-white/60'
              : 'border-white/5 bg-white/[0.02] text-white/20'
          }`}
        >
          <span className="w-4 shrink-0 text-center text-xs">
            {guess?.outcome === 'correct' ? '✓' : guess?.outcome === 'skip' ? '›' : guess ? '✗' : ''}
          </span>
          <span className="truncate">{guess ? guess.label : '—'}</span>
        </li>
      ))}
    </ul>
  )
}
