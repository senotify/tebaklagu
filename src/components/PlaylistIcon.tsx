import {
  CalendarDays,
  Disc3,
  Flag,
  Globe,
  Guitar,
  Heart,
  Mic,
  Music,
  Ribbon,
  Sparkles,
  Star,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

// Listed by hand rather than looked up in the whole lucide set, so only these
// icons end up in the bundle. The names come from `icon` in scripts/sources.mjs.
const ICONS: Record<string, LucideIcon> = {
  calendar: CalendarDays,
  disc: Disc3,
  flag: Flag,
  globe: Globe,
  guitar: Guitar,
  heart: Heart,
  mic: Mic,
  ribbon: Ribbon,
  sparkles: Sparkles,
  star: Star,
  trophy: Trophy,
}

/**
 * The Weeknd's XO wordmark. Lucide has nothing like it, so it is drawn on the
 * same 24px grid in currentColor to size and tint like the icons around it.
 */
function XoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        letterSpacing="-0.5"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        XO
      </text>
    </svg>
  )
}

/** A playlist's icon; unknown names fall back to a note rather than nothing. */
export function PlaylistIcon({ name, className }: { name: string; className?: string }) {
  if (name === 'xo') return <XoMark className={className} />
  const Icon = ICONS[name] ?? Music
  return <Icon aria-hidden className={className} />
}
