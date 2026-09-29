import { useEffect, useMemo, useRef, useState } from 'react'
import { searchTracks, type Suggestion } from '../lib/deezer'

type Props = {
  disabled?: boolean
  onGuess: (track: Suggestion) => void
}

const DEBOUNCE_MS = 320

export function GuessInput({ disabled, onGuess }: Props) {
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
          className="w-full rounded-md border-2 border-ink bg-card px-4 py-3 text-ink placeholder:text-ink/45 outline-none transition focus:ring-2 focus:ring-tape-mustard disabled:opacity-40"
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink/50">…</span>
        )}

        {open && visible.length > 0 && (
          <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-md border-2 border-ink bg-card shadow-[3px_3px_0_var(--color-ink)]">
            {visible.map((track, i) => (
              <li key={track.key}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => submit(track)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                    i === highlight ? 'bg-tape-mustard/30' : 'hover:bg-ink/5'
                  }`}
                >
                  {track.cover && (
                    <img src={track.cover} alt="" className="h-9 w-9 rounded-sm object-cover" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{track.title}</span>
                    <span className="block truncate text-xs text-ink/60">{track.artist}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
