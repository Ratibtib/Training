import { useEffect, useRef, useState } from 'react'

// Chrono de récup au niveau de l'exercice, réutilisable série après série.
// `seconds` = temps de récup prévu (déduit de la cible, défaut 90s).
export function RestTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (tick.current) clearInterval(tick.current) }, [])

  function beep() {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext)
      if (!Ctx) return
      const ctx = new Ctx()
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880; o.type = 'sine'
      g.gain.setValueAtTime(0.001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      o.start(); o.stop(ctx.currentTime + 0.5)
    } catch { /* silencieux si audio indisponible */ }
  }

  function start() {
    setRemaining(seconds); setRunning(true)
    if (tick.current) clearInterval(tick.current)
    tick.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          if (tick.current) clearInterval(tick.current)
          setRunning(false); beep()
          if (navigator.vibrate) navigator.vibrate(200)
          return 0
        }
        return r - 1
      })
    }, 1000)
  }

  function stop() {
    if (tick.current) clearInterval(tick.current)
    setRunning(false); setRemaining(seconds)
  }

  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, '0')
  const done = remaining === 0

  return (
    <div className={'rest' + (running ? ' running' : '') + (done ? ' done' : '')}
      onClick={running ? stop : start}>
      <span className="rest-clock">{mm}:{ss}</span>
      <span className="rest-lbl">
        {running ? 'Récup en cours — touche pour arrêter'
          : done ? 'Récup terminée — touche pour relancer'
          : `Récup ${mm}:${ss} — touche pour lancer`}
      </span>
      <span className="rest-go">{running ? 'Stop' : 'Start'}</span>
    </div>
  )
}