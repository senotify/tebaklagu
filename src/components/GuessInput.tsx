import { useEffect, useMemo, useRef, useState } from 'react'
import { searchTracks, type Suggestion } from '../lib/deezer'

type Props = {
  disabled?: boolean
  onGuess: (track: Suggestion) => void
  onSkip: () => void
  skipLabel: string
}

const DEBOUNCE_MS = 320

export function GuessInput({ disabled, onGuess, onSkip, skipLabel }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [highlight, setHighlight] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced so typing doesn't burn through Deezer's shared rate limit.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      searchTracks(q, controller.signal)
        .then((found) => {
          setResults(found)
          setHighlight(0)
          setOpen(true)
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') setResults([])
        })
        .finally(() => setLoading(false))
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const submit = (track: Suggestion) => {
    onGuess(track)
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  const visible = useMemo(() => results.slice(0, 8), [results])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !visible.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % visible.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + visible.length) % visible.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit(visible[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Ketik judul lagu atau penyanyi…"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-emerald-400/60 disabled:opacity-40"
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">…</span>
        )}

        {open && visible.length > 0 && (
          <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 shadow-xl">
            {visible.map((track, i) => (
              <li key={track.key}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => submit(track)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                    i === highlight ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  {track.cover && (
                    <img src={track.cover} alt="" className="h-9 w-9 rounded object-cover" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white">{track.title}</span>
                    <span className="block truncate text-xs text-white/45">{track.artist}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onSkip}
        disabled={disabled}
        className="mt-3 w-full rounded-xl border border-white/10 py-3 text-sm text-white/70 transition hover:bg-white/5 disabled:opacity-40"
      >
        {skipLabel}
      </button>
    </div>
  )
}
