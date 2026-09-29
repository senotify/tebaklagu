import { PlaylistIcon } from './PlaylistIcon'

type Props = {
  covers?: readonly string[]
  /** Shown instead when the playlist has no cover art to show. */
  icon: string
  className?: string
}

/**
 * A playlist's album covers in a square: four as a 2×2 grid, or the first one
 * full-bleed when there aren't enough for a grid that doesn't repeat itself.
 */
export function CoverMosaic({ covers = [], icon, className = '' }: Props) {
  const shown = covers.length >= 4 ? covers.slice(0, 4) : covers.slice(0, 1)

  if (!shown.length) {
    return (
      <div className={`flex aspect-square items-center justify-center bg-tape ${className}`}>
        <PlaylistIcon name={icon} className="size-8 text-cream/60" />
      </div>
    )
  }

  return (
    <div className={`grid aspect-square bg-tape ${shown.length > 1 ? 'grid-cols-2' : ''} ${className}`}>
      {shown.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ))}
    </div>
  )
}
