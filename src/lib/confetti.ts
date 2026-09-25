// A one-shot confetti burst on a throwaway full-screen canvas. Hand-rolled
// rather than a dependency: a few dozen lines covers what a win needs.

const COLORS = ['#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#a78bfa', '#f87171']
const PIECES = 160
const GRAVITY = 0.25
const DRAG = 0.985
/** Frames before the canvas is torn down, whatever is still falling. */
const LIFETIME = 240

type Piece = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  angle: number
  spin: number
}

export function launchConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  // Above everything but inert, so it can't swallow a click on the result card.
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  const ratio = window.devicePixelRatio || 1
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = width * ratio
  canvas.height = height * ratio
  ctx.scale(ratio, ratio)

  // Two cannons in the bottom corners, aimed up and inwards.
  const pieces: Piece[] = Array.from({ length: PIECES }, (_, i) => {
    const fromLeft = i % 2 === 0
    const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7
    const speed = 9 + Math.random() * 9
    return {
      x: fromLeft ? 0 : width,
      y: height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * (height / 700),
      size: 5 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
    }
  })

  let frame = 0
  const tick = () => {
    ctx.clearRect(0, 0, width, height)
    for (const p of pieces) {
      p.vx *= DRAG
      p.vy = p.vy * DRAG + GRAVITY
      p.x += p.vx
      p.y += p.vy
      p.angle += p.spin

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      // Fade out over the last stretch rather than vanishing mid-fall.
      ctx.globalAlpha = Math.min(1, (LIFETIME - frame) / 40)
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }

    if (++frame < LIFETIME) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}
