import { useEffect } from 'react'

/**
 * One delegated listener for the whole app: whichever [data-lit] surface
 * is under the pointer gets --mx / --my (pointer position inside it), which
 * index.css turns into a glow and a lit border that follows the pointer.
 * Batched to one write per animation frame.
 */
export function usePointerLight() {
  useEffect(() => {
    let frame = 0
    let pending = null
    const flush = () => {
      frame = 0
      if (!pending) return
      const { el, x, y } = pending
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${x - r.left}px`)
      el.style.setProperty('--my', `${y - r.top}px`)
      pending = null
    }
    const onMove = (e) => {
      if (e.pointerType === 'touch') return
      const el = e.target instanceof Element ? e.target.closest('[data-lit]') : null
      if (!el) return
      pending = { el, x: e.clientX, y: e.clientY }
      if (!frame) frame = requestAnimationFrame(flush)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(frame) }
  }, [])
}
