import { Check, ChevronRight, X } from 'lucide-react'
import { MAX_ATTEMPTS, type Guess } from '../lib/game'

export function GuessHistory({ guesses }: { guesses: readonly Guess[] }) {
  const rows = [...guesses, ...Array(Math.max(0, MAX_ATTEMPTS - guesses.length)).fill(null)]

  return (
    <ul className="flex w-full flex-col gap-1.5">
      {rows.map((guess: Guess | null, i) => (
        <li
          key={i}
          // Laid out like a tape's tracklist: numbered lines, filled in as you go.
          className={`flex items-center gap-2 border-b-2 px-2 py-2 text-sm ${
            guess
              ? guess.outcome === 'correct'
                ? 'border-tape-green bg-tape-green/15 font-semibold text-tape-green'
                : guess.outcome === 'wrong'
                  ? 'border-ink/15 text-ink/80'
                  : 'border-ink/15 text-ink/55'
              : 'border-dashed border-ink/15 text-ink/30'
          }`}
        >
          <span className="w-4 shrink-0 font-mono text-xs text-ink/45">{i + 1}</span>
          <span
            className={`flex w-4 shrink-0 justify-center ${guess?.outcome === 'wrong' ? 'text-tape-red' : ''}`}
          >
            {guess?.outcome === 'correct' ? (
              <Check aria-hidden className="size-3.5" />
            ) : guess?.outcome === 'skip' ? (
              <ChevronRight aria-hidden className="size-3.5" />
            ) : guess ? (
              <X aria-hidden className="size-3.5" />
            ) : null}
          </span>
          <span className="truncate">{guess ? guess.label : '—'}</span>
        </li>
      ))}
    </ul>
  )
}
