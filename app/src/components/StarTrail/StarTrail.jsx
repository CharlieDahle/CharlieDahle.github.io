import { useEffect } from 'react'
import './StarTrail.css'

const GLYPHS = ['★', '✦', '✧', '⋆', '✶']

export default function StarTrail() {
  useEffect(() => {
    let lastX = 0, lastY = 0

    const onMove = (e) => {
      if (document.querySelector('.guestbook-overlay, .aboutme-overlay')) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (dx * dx + dy * dy < 80) return // distance throttle

      lastX = e.clientX
      lastY = e.clientY

      const el = document.createElement('span')
      el.className = 'star-trail-particle'
      el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      el.style.left = e.clientX + 'px'
      el.style.top = e.clientY + 'px'
      el.style.fontSize = (10 + Math.random() * 12) + 'px'
      el.style.setProperty('--drift-x', (Math.random() - 0.5) * 40 + 'px')
      el.style.setProperty('--drift-y', (-15 - Math.random() * 25) + 'px')
      el.style.setProperty('--spin', (Math.random() * 180 - 90) + 'deg')

      document.body.appendChild(el)
      setTimeout(() => el.remove(), 700)
    }

    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return null
}
