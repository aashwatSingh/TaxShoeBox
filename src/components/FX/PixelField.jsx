import { useEffect, useRef } from 'react'

/**
 * PixelField: the interactive background.
 *
 * A fixed grid of 1.5px "pixels" drawn on one <canvas>.
 *  - Hover / touch-drag: pixels near the pointer lean away from it and
 *    light up in the signal colour, then ease home (exponential smoothing,
 *    so nothing overshoots or bounces).
 *  - Click / tap on empty background: a raindrop. A wave packet travels
 *    outward, displacing and lighting the pixels it passes, with two
 *    fading rings drawn on the surface. Drops interfere where they meet.
 *
 * Cost control: the animation loop only runs while something is moving,
 * pauses in hidden tabs, caps devicePixelRatio at 2 and widens the grid
 * on very large screens. With prefers-reduced-motion the field is drawn
 * once and stays still.
 */

const SIGNAL = [92, 232, 242]
const INK = [238, 240, 243]
const POINTER_R = 150        // px of influence around the pointer
const POINTER_PUSH = 16      // max px a pixel leans away
const WAVE_SPEED = 0.5       // px per ms
const WAVE_LIFE = 2200       // ms
const WAVE_AMP = 11          // px
const WAVE_K = 0.085         // wavelength ≈ 74px
const WAVE_SIGMA = 38        // packet width
const MAX_DROPS = 6
const SMOOTH_POS = 110       // ms time constant for pointer easing
const SMOOTH_GLOW = 160

// Elements that own their clicks: no raindrop when one of these is the target.
const INTERACTIVE =
  'a,button,input,select,textarea,label,summary,[role="button"],[role="dialog"],[role="menu"],[data-lit],[data-no-ripple]'

export function PixelField() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d', { alpha: true })
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = motionQuery.matches

    let W = 0, H = 0, dpr = 1, gap = 24, n = 0
    let hx, hy, ox, oy, glow                      // home position, eased offset, eased glow
    const pointer = { x: -1e4, y: -1e4, inside: false }
    const drops = []
    let raf = 0, running = false, last = 0

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      gap = W < 640 ? 20 : 24
      const budget = 9000 // keep huge monitors cheap
      if ((W / gap) * (H / gap) > budget) gap = Math.ceil(Math.sqrt((W * H) / budget))
      const cols = Math.ceil(W / gap) + 1
      const rows = Math.ceil(H / gap) + 1
      const x0 = (W - (cols - 1) * gap) / 2
      const y0 = (H - (rows - 1) * gap) / 2
      n = cols * rows
      hx = new Float32Array(n); hy = new Float32Array(n)
      ox = new Float32Array(n); oy = new Float32Array(n); glow = new Float32Array(n)
      for (let r = 0, i = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++, i++) { hx[i] = x0 + c * gap; hy[i] = y0 + r * gap }
      }
    }

    // Glow is quantised into a few buckets so we change fillStyle ~8 times
    // per frame instead of once per lit pixel.
    const BUCKETS = 8
    const bucketStyles = Array.from({ length: BUCKETS }, (_, b) => {
      const g = (b + 1) / BUCKETS
      const mix = (k) => Math.round(INK[k] + (SIGNAL[k] - INK[k]) * Math.min(1, g * 1.4))
      return `rgba(${mix(0)},${mix(1)},${mix(2)},${(0.12 + 0.78 * g).toFixed(3)})`
    })
    const buckets = Array.from({ length: BUCKETS }, () => [])

    function draw(now) {
      ctx.clearRect(0, 0, W, H)
      for (const b of buckets) b.length = 0
      ctx.fillStyle = 'rgba(238,240,243,0.12)'
      const s = 1.5
      for (let i = 0; i < n; i++) {
        const g = glow[i]
        if (g < 0.03) ctx.fillRect(hx[i] + ox[i] - s / 2, hy[i] + oy[i] - s / 2, s, s)
        else buckets[Math.min(BUCKETS - 1, (g * BUCKETS) | 0)].push(i)
      }
      for (let b = 0; b < BUCKETS; b++) {
        const list = buckets[b]
        if (!list.length) continue
        ctx.fillStyle = bucketStyles[b]
        const sz = s + 1.6 * ((b + 1) / BUCKETS)
        for (const i of list) ctx.fillRect(hx[i] + ox[i] - sz / 2, hy[i] + oy[i] - sz / 2, sz, sz)
      }
      // Surface rings: the visible "drop" on water.
      for (const d of drops) {
        const age = now - d.t
        const life = 1 - age / WAVE_LIFE
        if (life <= 0) continue
        const r = age * WAVE_SPEED
        ctx.lineWidth = 1
        ctx.strokeStyle = `rgba(${SIGNAL.join(',')},${(0.42 * life * life).toFixed(3)})`
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.stroke()
        if (r > 40) {
          ctx.strokeStyle = `rgba(${SIGNAL.join(',')},${(0.16 * life * life).toFixed(3)})`
          ctx.beginPath(); ctx.arc(d.x, d.y, r * 0.62, 0, Math.PI * 2); ctx.stroke()
        }
        if (age < 220) { // the splash point
          ctx.fillStyle = `rgba(${SIGNAL.join(',')},${(0.5 * (1 - age / 220)).toFixed(3)})`
          ctx.beginPath(); ctx.arc(d.x, d.y, 3 + age * 0.02, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    function step(now) {
      const dt = Math.min(48, now - (last || now))
      last = now
      const aPos = 1 - Math.exp(-dt / SMOOTH_POS)
      const aGlow = 1 - Math.exp(-dt / SMOOTH_GLOW)
      for (let k = drops.length - 1; k >= 0; k--) if (now - drops[k].t > WAVE_LIFE) drops.splice(k, 1)

      let unsettled = 0 // largest distance any pixel still has to travel
      const px = pointer.x, py = pointer.y
      for (let i = 0; i < n; i++) {
        const x = hx[i], y = hy[i]
        let tx = 0, ty = 0, tg = 0
        // Pointer: lean away, light up.
        const dx = x - px, dy = y - py
        const d2 = dx * dx + dy * dy
        if (d2 < POINTER_R * POINTER_R) {
          const d = Math.sqrt(d2) || 1
          const f = 1 - d / POINTER_R
          const ff = f * f
          tx = (dx / d) * POINTER_PUSH * ff
          ty = (dy / d) * POINTER_PUSH * ff
          tg = ff
        }
        // Raw wave displacement on top of the eased pointer offset, so the
        // crest stays crisp while the pointer response stays soft.
        let wx = 0, wy = 0, wg = 0
        for (const dr of drops) {
          const age = now - dr.t
          const front = age * WAVE_SPEED
          const ddx = x - dr.x, ddy = y - dr.y
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1
          const off = dist - front
          if (off > 3 * WAVE_SIGMA || off < -5 * WAVE_SIGMA) continue
          const life = 1 - age / WAVE_LIFE
          const env = Math.exp(-(off * off) / (2 * WAVE_SIGMA * WAVE_SIGMA))
          const wave = (Math.sin(off * WAVE_K) * env * life * life) / (1 + dist / 520)
          wx += (ddx / dist) * WAVE_AMP * wave
          wy += (ddy / dist) * WAVE_AMP * wave
          wg += Math.abs(wave) * 0.9
        }
        tx += wx; ty += wy
        const gt = Math.min(1, Math.max(tg, wg))
        const ex = tx - ox[i], ey = ty - oy[i], eg = gt - glow[i]
        ox[i] += ex * (wx || wy ? Math.min(1, aPos * 2.2) : aPos)
        oy[i] += ey * (wx || wy ? Math.min(1, aPos * 2.2) : aPos)
        glow[i] += eg * aGlow
        const u = Math.max(Math.abs(ex), Math.abs(ey), Math.abs(eg) * 20)
        if (u > unsettled) unsettled = u
      }
      const moving = drops.length > 0 || unsettled > 0.04
      draw(now)
      if (moving && !document.hidden) raf = requestAnimationFrame(step)
      else { running = false; last = 0 }
    }

    function wake() {
      if (reduced || running || document.hidden) return
      running = true
      raf = requestAnimationFrame(step)
    }

    function drawStill() {
      ox.fill(0); oy.fill(0); glow.fill(0); drops.length = 0
      draw(performance.now())
    }

    // ── input ───────────────────────────────────────────────────────
    const onMove = (e) => {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true
      wake()
    }
    const onTouchMove = (e) => {
      const t = e.touches[0]
      if (t) onMove(t)
    }
    const release = () => { pointer.inside = false; pointer.x = pointer.y = -1e4; wake() }
    // pointerout with no relatedTarget means the pointer left the window.
    const onLeave = (e) => { if (!e.relatedTarget) release() }
    const onUp = (e) => {
      // A finger lifting is the pointer leaving; a mouse button lifting isn't.
      if (e.pointerType !== 'mouse') release()
    }
    const drop = (x, y) => {
      if (reduced) return
      drops.push({ x, y, t: performance.now() })
      if (drops.length > MAX_DROPS) drops.shift()
      wake()
    }
    const onDown = (e) => {
      if (e.button !== 0) return
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return
      if (window.getSelection?.()?.toString()) return
      drop(e.clientX, e.clientY)
    }

    let resizeTimer = 0
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => { build(); reduced ? drawStill() : (draw(performance.now()), wake()) }, 60)
    }
    const onVisibility = () => { if (!document.hidden) wake() }
    const onMotionChange = () => { reduced = motionQuery.matches; if (reduced) { cancelAnimationFrame(raf); running = false; drawStill() } }

    build()
    drawStill()
    // One drop shortly after load, so visitors learn the surface is alive.
    const intro = setTimeout(() => drop(W * 0.72, Math.min(H * 0.32, 320)), 900)

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onUp, { passive: true })
    document.addEventListener('pointerout', onLeave, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    motionQuery.addEventListener?.('change', onMotionChange)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(intro); clearTimeout(resizeTimer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.removeEventListener('pointerout', onLeave)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      motionQuery.removeEventListener?.('change', onMotionChange)
    }
  }, [])

  return (
    <>
      <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-field h-full w-full" />
      {/* A soft vignette keeps the edges matte and the centre readable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-field"
        style={{ background: 'radial-gradient(120% 90% at 50% 0%, transparent 45%, rgb(var(--void) / 0.7) 100%)' }}
      />
    </>
  )
}
