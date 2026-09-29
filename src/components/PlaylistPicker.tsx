import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { PlaylistInfo } from '../data/playlists'
import { PlaylistIcon } from './PlaylistIcon'

type Props = {
  playlists: readonly PlaylistInfo[]
  value: string
  onChange: (id: string) => void
}

/** A playlist's first cover as a thumbnail, or its icon where it has none. */
function Thumb({ playlist, size }: { playlist: PlaylistInfo; size: string }) {
  const cover = playlist.covers?.[0]
  return cover ? (
    <img src={cover} alt="" className={`${size} shrink-0 rounded-sm border border-ink/30 object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-sm bg-tape`}>
      <PlaylistIcon name={playlist.icon} className="size-4 text-cream/70" />
    </span>
  )
}

/**
 * Picks which playlist's board to show. A listbox rather than a native select
 * so each option can carry its cover art; keyboard handling follows the ARIA
 * select-only combobox pattern (arrows, Home/End, Enter, Escape).
 */
export function PlaylistPicker({ playlists, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()

  const selectedIndex = Math.max(
    0,
    playlists.findIndex((p) => p.id === value),
  )
  const selected = playlists[selectedIndex]

  const show = () => {
    setActive(selectedIndex)
    setOpen(true)
  }

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  const choose = (index: number) => {
    onChange(playlists[index].id)
    close()
  }

  // Focus moves into the list while it's open so the arrow keys drive it.
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  // Keep the highlighted option in view as the arrows walk past the edge.
  useEffect(() => {
    if (!open) return
    document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, id, open])

  // A tap anywhere else dismisses it, the way a native select would.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const last = playlists.length - 1
    if (e.key === 'ArrowDown') setActive((i) => Math.min(last, i + 1))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(last)
    else if (e.key === 'Enter' || e.key === ' ') choose(active)
    else if (e.key === 'Escape') close()
    else if (e.key === 'Tab') close(false)
    else return
    if (e.key !== 'Tab') e.preventDefault()
  }

  if (!selected) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`Daftar lagu: ${selected.title}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
            e.preventDefault()
            show()
          }
        }}
        className="paper flex w-full items-center gap-3 p-2 pr-3 text-left shadow-[3px_3px_0_var(--color-ink)] outline-none transition focus-visible:ring-2 focus-visible:ring-tape-mustard"
      >
        <Thumb playlist={selected} size="size-11" />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] text-ink/60">Daftar lagu</span>
          <span className="display block truncate text-xl leading-none">{selected.title}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={`size-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label="Daftar lagu"
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKeyDown}
          className="paper absolute z-30 mt-2 max-h-80 w-full overflow-y-auto p-1 shadow-[3px_3px_0_var(--color-ink)] outline-none"
        >
          {playlists.map((p, i) => {
            const isSelected = p.id === selected.id
            return (
              <li
                key={p.id}
                id={`${id}-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 ${
                  i === active ? 'bg-tape-mustard/35' : ''
                }`}
              >
                <Thumb playlist={p} size="size-8" />
                <span className={`min-w-0 flex-1 truncate text-sm ${isSelected ? 'font-bold' : ''}`}>
                  {p.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-ink/55">{p.count}</span>
                <Check
                  aria-hidden
                  className={`size-4 shrink-0 text-tape-red ${isSelected ? '' : 'invisible'}`}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
